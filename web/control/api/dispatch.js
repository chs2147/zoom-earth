// @ts-check
// POST /api/dispatch with `Authorization: Bearer $ADMIN_TOKEN` and a JSON body:
//   {"action": "check"}                  run the scheduled check now
//   {"action": "refresh"}                redeploy now with the current model runs
//   {"action": "retry", "model": "icon"} build that model's latest run again,
//                                        even after it has failed repeatedly

import { dispatch } from "../lib/github.js";
import { authorized, failure, json } from "../lib/http.js";
import { MODELS } from "../lib/models.js";
import { check, tick } from "../lib/status.js";

/** @param {Request} request */
export async function POST(request) {
  if (!authorized(request, "ADMIN_TOKEN")) return json({ error: "unauthorized" }, 401);
  /** @type {{action?: string, model?: string}} */
  const body = await request.json().catch(() => ({}));
  try {
    if (body.action === "check") return json(await tick());
    if (body.action === "retry") {
      if (!MODELS.some((model) => model.id === body.model)) return json({ error: "unknown model" }, 400);
      return json(await tick({ force: body.model }));
    }
    if (body.action === "refresh") {
      const status = await check();
      if (status.inflight) return json({ error: `배포 작업 ${status.inflight.id}이(가) 진행 중입니다 (${status.inflight.status})` }, 409);
      const inputs = { reason: "refresh (manual)", ...status.inputs };
      await dispatch(inputs);
      return json({ ...status, dispatched: inputs });
    }
    return json({ error: "action must be check, refresh or retry" }, 400);
  } catch (error) {
    return failure(error);
  }
}
