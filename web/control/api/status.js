// @ts-check
// GET /api/status: model, site and deploy state for the dashboard. Read-only.

import { failure, json } from "../lib/http.js";
import { check } from "../lib/status.js";

export async function GET() {
  try {
    // A short CDN cache keeps dashboard visits from each querying every source.
    return json(await check(), 200, { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" });
  } catch (error) {
    return failure(error);
  }
}
