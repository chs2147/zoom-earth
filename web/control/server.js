// @ts-check
// Long-running control server (Railway or any always-on host).
//
// Runs the scheduled check every TICK_MINUTES (default 10) in-process, and
// serves the same dashboard and API as the Vercel deployment:
//   /                 dashboard (public/)
//   /api/status       GET, read-only state
//   /api/dispatch     POST, admin actions (ADMIN_TOKEN)
//   /api/tick         GET or POST, external trigger (CRON_SECRET)
//   /api/scheduler    GET, when the in-process check last ran and its outcome
//   /healthz          GET, liveness for the host

import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { POST as dispatchRoute } from "./api/dispatch.js";
import { GET as statusRoute } from "./api/status.js";
import { GET as tickRoute } from "./api/tick.js";
import { json } from "./lib/http.js";
import { tick } from "./lib/status.js";

const PORT = Number(process.env.PORT ?? 3000);
const TICK_MINUTES = Number(process.env.TICK_MINUTES ?? 10);
const PUBLIC = fileURLToPath(new URL("./public/", import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

/** @type {{intervalMinutes: number, running: boolean, startedAt: string | null, finishedAt: string | null, nextAt: string | null, outcome: string | null, dispatched: unknown, error: string | null}} */
const scheduler = {
  intervalMinutes: TICK_MINUTES,
  running: false,
  startedAt: null,
  finishedAt: null,
  nextAt: null,
  outcome: null,
  dispatched: null,
  error: null,
};

async function runTick() {
  // A slow source must not let two checks overlap.
  if (scheduler.running) return;
  scheduler.running = true;
  scheduler.startedAt = new Date().toISOString();
  try {
    const result = await tick();
    scheduler.outcome = result.dispatched ? `started: ${result.dispatched.reason}` : `waiting: ${result.wait ?? ""}`;
    scheduler.dispatched = result.dispatched;
    scheduler.error = result.errors.length ? result.errors.join("; ") : null;
  } catch (error) {
    scheduler.outcome = "error";
    scheduler.error = error instanceof Error ? error.message : String(error);
  } finally {
    scheduler.running = false;
    scheduler.finishedAt = new Date().toISOString();
    scheduler.nextAt = new Date(Date.now() + TICK_MINUTES * 60_000).toISOString();
    console.log(`[tick] ${scheduler.finishedAt} ${scheduler.outcome}${scheduler.error ? ` (${scheduler.error})` : ""}`);
  }
}

/** @param {import("node:http").IncomingMessage} req */
async function toRequest(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
  }
  const body = chunks.length && req.method !== "GET" && req.method !== "HEAD" ? Buffer.concat(chunks) : undefined;
  return new Request(`http://${req.headers.host ?? "localhost"}${req.url}`, { method: req.method, headers, body });
}

/** @param {string} pathname */
async function staticFile(pathname) {
  const path = normalize(join(PUBLIC, pathname === "/" ? "index.html" : pathname));
  if (!path.startsWith(PUBLIC)) return null;
  try {
    const type = TYPES[/** @type {keyof typeof TYPES} */ (extname(path))] ?? "application/octet-stream";
    return new Response(await readFile(path), { headers: { "Content-Type": type } });
  } catch {
    return null;
  }
}

/** @param {Request} request */
async function route(request) {
  const { pathname } = new URL(request.url);
  const method = request.method;
  if (pathname === "/healthz") return new Response("ok");
  if (pathname === "/api/scheduler" && method === "GET") return json(scheduler);
  if (pathname === "/api/status" && method === "GET") return statusRoute();
  if (pathname === "/api/tick" && (method === "GET" || method === "POST")) return tickRoute(request);
  if (pathname === "/api/dispatch" && method === "POST") return dispatchRoute(request);
  if (pathname.startsWith("/api/")) return json({ error: "not found" }, 404);
  if (method === "GET") return (await staticFile(pathname)) ?? new Response("not found", { status: 404 });
  return new Response("method not allowed", { status: 405 });
}

const server = createServer(async (req, res) => {
  try {
    const response = await route(await toRequest(req));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.writeHead(500).end("internal error");
  }
});

server.listen(PORT, () => {
  console.log(`control server on :${PORT}, checking every ${TICK_MINUTES} min`);
  runTick();
  setInterval(runTick, TICK_MINUTES * 60_000);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
