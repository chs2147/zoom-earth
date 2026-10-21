// @ts-check
// GET /api/tick: the scheduled check. Vercel Cron calls it with
// `Authorization: Bearer $CRON_SECRET`; any other scheduler can do the same.
// It starts the deploy workflow when a model has a new complete run or the
// site has not been redeployed for an hour. `?dry=1` reports without acting.

import { authorized, failure, json } from "../lib/http.js";
import { check, tick } from "../lib/status.js";

/** @param {Request} request */
export async function GET(request) {
  if (!authorized(request, "CRON_SECRET")) return json({ error: "unauthorized" }, 401);
  try {
    const dry = new URL(request.url).searchParams.get("dry") === "1";
    return json(dry ? await check() : await tick());
  } catch (error) {
    return failure(error);
  }
}
