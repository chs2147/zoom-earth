// @ts-check
// Decide what the deploy workflow should do next.
//
// The server keeps no database. Each check derives the state from three
// sources: the latest complete run at each model's source, the runs the
// published site serves (data/index.json), and the deploy workflow's recent
// runs, whose titles name the model runs they were asked to deploy.

import { runDate } from "./upstream.js";

/**
 * @typedef {object} WorkflowRun
 * @property {number} id
 * @property {string} title
 * @property {string} event
 * @property {string} status       queued | in_progress | completed | ...
 * @property {string | null} conclusion
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} url
 *
 * @typedef {object} ModelInput
 * @property {string} id
 * @property {string} title
 * @property {boolean} required
 * @property {number} cycleHours
 * @property {number} readyAfterHours
 * @property {string | null} upstream  latest complete run at the source
 * @property {string | null} deployed  run the site serves
 *
 * @typedef {"current" | "pending" | "building" | "publishing" | "failed" | "unknown"} ModelState
 */

export const DEFAULTS = {
  maxAttempts: 3, // builds of one model run before giving up on it
  attemptWindowHours: 24,
  settleMinutes: 15, // a finished deploy can take this long to show in data/index.json
  refreshMinutes: 60, // redeploy at least this often for official warnings and overlays
};

/** Model runs named in a run title, e.g. "Typhoon Lens · update · gfs 2026102106 · icon skip". */
export function parseTargets(title) {
  /** @type {Record<string, string>} */
  const targets = {};
  for (const match of title.matchAll(/· ([a-z]+) (\d{10}|skip)\b/g)) targets[match[1]] = match[2];
  return targets;
}

/** Title the workflow gives a dispatched run; parseTargets() reads it back. */
export function runTitle(reason, inputs) {
  const models = Object.entries(inputs)
    .filter(([key]) => key.endsWith("_run"))
    .map(([key, value]) => `${key.slice(0, -4)} ${value || "auto"}`);
  return ["Typhoon Lens", reason, ...models].join(" · ");
}

/** @param {Date} date @param {number} hours */
function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3600_000);
}

/**
 * @param {{now: Date, models: ModelInput[], runs: WorkflowRun[], force?: string | null, options?: Partial<typeof DEFAULTS>}} input
 */
export function plan({ now, models, runs, force = null, options = {} }) {
  const settings = { ...DEFAULTS, ...options };
  const minutesAgo = (/** @type {string} */ time) => (now.getTime() - new Date(time).getTime()) / 60_000;
  const recent = runs.filter((run) => minutesAgo(run.createdAt) <= settings.attemptWindowHours * 60);
  const inflight = runs.find((run) => run.status !== "completed") ?? null;

  const states = models.map((model) => {
    const { upstream, deployed } = model;
    const outdated = upstream !== null && !(deployed && upstream <= deployed);
    // Earlier deploys of the run the site already shows are not failed attempts.
    const attempts = outdated ? recent.filter((run) => parseTargets(run.title)[model.id] === upstream) : [];
    const failures = attempts.filter((run) => run.status === "completed" && minutesAgo(run.updatedAt) > settings.settleMinutes);
    /** @type {ModelState} */
    let state;
    if (!upstream) state = "unknown";
    else if (deployed && upstream <= deployed) state = "current";
    else if (attempts.some((run) => run.status !== "completed")) state = "building";
    else if (attempts.some((run) => run.conclusion === "success" && minutesAgo(run.updatedAt) <= settings.settleMinutes)) {
      state = "publishing";
    } else if (failures.length >= settings.maxAttempts && force !== model.id) state = "failed";
    else state = "pending";

    // What the next deploy should carry for this model.
    const fallback = deployed ?? (model.required ? "" : "skip");
    const target = state === "pending" || state === "building" || state === "publishing" ? upstream : fallback;
    const base = upstream ?? deployed;
    const nextStart = base ? addHours(runDate(base), model.cycleHours) : null;
    return {
      id: model.id,
      title: model.title,
      upstream,
      deployed,
      state,
      target,
      attempts: attempts.length,
      failures: failures.length,
      nextRunExpected: nextStart ? addHours(nextStart, model.readyAfterHours).toISOString() : null,
    };
  });

  const inputs = Object.fromEntries(states.map((model) => [`${model.id}_run`, model.target ?? ""]));
  const pending = states.filter((model) => model.state === "pending").map((model) => model.id);
  const latest = runs[0] ?? null;

  /** @type {{reason: string, inputs: Record<string, string>} | null} */
  let dispatch = null;
  let wait = null;
  if (inflight) wait = `배포 작업 ${inflight.id}이(가) 끝나기를 기다립니다 (${inflight.status})`;
  else if (pending.length) dispatch = { reason: `update ${pending.join(" ")}`, inputs };
  else if (!latest || minutesAgo(latest.createdAt) >= settings.refreshMinutes) dispatch = { reason: "refresh", inputs };
  else wait = `바뀐 모델이 없고, 마지막 배포가 ${Math.round(minutesAgo(latest.createdAt))}분 전에 시작됐습니다`;

  return { models: states, inflight, inputs, dispatch, wait };
}
