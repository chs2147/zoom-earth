// @ts-check
// Gather every source and plan the next step; shared by the API routes.

import { CONFIG, deployedRuns, dispatch, listRuns } from "./github.js";
import { MODELS } from "./models.js";
import { plan, runTitle } from "./planner.js";

/** @param {unknown} error */
const message = (error) => (error instanceof Error ? error.message : String(error));

/** @param {{now?: Date, force?: string | null}} [options] */
export async function check({ now = new Date(), force = null } = {}) {
  const errors = [];
  const [upstream, deployed, runs] = await Promise.all([
    Promise.all(
      MODELS.map((model) =>
        model.latest(now).catch((error) => {
          errors.push(`${model.id} source: ${message(error)}`);
          return null;
        }),
      ),
    ),
    deployedRuns().catch((error) => {
      errors.push(`site: ${message(error)}`);
      return null;
    }),
    listRuns(),
  ]);
  const models = MODELS.map((model, i) => ({
    id: model.id,
    title: model.title,
    required: model.required,
    cycleHours: model.cycleHours,
    readyAfterHours: model.readyAfterHours,
    upstream: upstream[i],
    deployed: deployed?.[model.id] ?? null,
  }));
  const result = plan({ now, models, runs, force });
  // Without the site index every model looks out of date; do not act on that.
  if (!deployed && result.dispatch) {
    result.wait = "사이트 data/index.json을 읽지 못해 배포를 보류합니다";
    result.dispatch = null;
  }
  return {
    checked: now.toISOString(),
    repo: `${CONFIG.owner}/${CONFIG.repo}`,
    site: CONFIG.siteUrl,
    ...result,
    runs: runs.slice(0, 10),
    errors,
  };
}

/** Check, then start the deploy workflow when the plan calls for it. @param {{force?: string | null}} [options] */
export async function tick(options = {}) {
  const status = await check(options);
  let dispatched = null;
  if (status.dispatch) {
    const inputs = { reason: status.dispatch.reason, ...status.dispatch.inputs };
    await dispatch(inputs);
    dispatched = { ...inputs, title: runTitle(status.dispatch.reason, status.dispatch.inputs) };
  }
  return { ...status, dispatched };
}
