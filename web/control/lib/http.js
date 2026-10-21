// @ts-check
import { timingSafeEqual } from "node:crypto";

/** @param {unknown} body @param {number} [status] @param {Record<string, string>} [headers] */
export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

/** Whether the request carries `Authorization: Bearer <process.env[name]>`. @param {Request} request @param {string} name */
export function authorized(request, name) {
  const secret = process.env[name];
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** @param {unknown} error */
export function failure(error) {
  return json({ error: error instanceof Error ? error.message : String(error) }, 502);
}
