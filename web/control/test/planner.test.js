// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";

import { parseTargets, plan, runTitle } from "../lib/planner.js";

const now = new Date("2026-10-21T12:00:00Z");
const minutesBefore = (minutes) => new Date(now.getTime() - minutes * 60_000).toISOString();

const model = (overrides = {}) => ({
  id: "gfs",
  title: "GFS",
  required: true,
  cycleHours: 6,
  readyAfterHours: 5,
  upstream: "2026102106",
  deployed: "2026102100",
  ...overrides,
});

/** @returns {import("../lib/planner.js").WorkflowRun} */
const run = ({ title = "Merge pull request #1", status = "completed", conclusion = "success", created = 120, updated = created - 10 } = {}) => ({
  id: created,
  title,
  event: "workflow_dispatch",
  status,
  conclusion: status === "completed" ? conclusion : null,
  createdAt: minutesBefore(created),
  updatedAt: minutesBefore(updated),
  url: "",
});

test("titles round-trip the model runs", () => {
  const title = runTitle("update gfs", { gfs_run: "2026102106", icon_run: "skip" });
  assert.equal(title, "Typhoon Lens · update gfs · gfs 2026102106 · icon skip");
  assert.deepEqual(parseTargets(title), { gfs: "2026102106", icon: "skip" });
  assert.deepEqual(parseTargets("Typhoon Lens · refresh · gfs auto · icon auto"), {});
});

test("a new complete run starts a deploy carrying it", () => {
  const result = plan({ now, models: [model(), model({ id: "icon", required: false, upstream: "2026102100" })], runs: [run()] });
  assert.equal(result.models[0].state, "pending");
  assert.equal(result.models[1].state, "current");
  assert.equal(result.models[1].failures, 0);
  assert.deepEqual(result.dispatch, { reason: "update gfs", inputs: { gfs_run: "2026102106", icon_run: "2026102100" } });
});

test("nothing starts while a deploy is queued or running", () => {
  const result = plan({ now, models: [model()], runs: [run({ status: "in_progress", created: 5 })] });
  assert.equal(result.dispatch, null);
  assert.match(String(result.wait), /in_progress/);
});

test("a run being built or just deployed is not started again", () => {
  const title = "Typhoon Lens · update gfs · gfs 2026102106";
  const building = plan({ now, models: [model()], runs: [run({ title, status: "queued", created: 3 })] });
  assert.equal(building.models[0].state, "building");

  // The site index lags the deploy; wait for it instead of rebuilding.
  const settling = plan({ now, models: [model()], runs: [run({ title, created: 20, updated: 5 })] });
  assert.equal(settling.models[0].state, "publishing");
  assert.equal(settling.dispatch, null);
});

test("a deploy that did not change the site counts as a failed attempt", () => {
  const title = "Typhoon Lens · update gfs · gfs 2026102106";
  const result = plan({ now, models: [model()], runs: [run({ title, created: 40, updated: 30 })] });
  assert.equal(result.models[0].failures, 1);
  assert.equal(result.models[0].state, "pending");
  assert.ok(result.dispatch);
});

test("after repeated failures the model keeps its deployed run", () => {
  const title = "Typhoon Lens · update gfs · gfs 2026102106";
  const runs = [70, 110, 150].map((created) => run({ title, conclusion: "failure", created }));
  const result = plan({ now, models: [model()], runs });
  assert.equal(result.models[0].state, "failed");
  assert.equal(result.models[0].target, "2026102100");
  // The hourly refresh still goes out with the run already deployed.
  assert.deepEqual(result.dispatch, { reason: "refresh", inputs: { gfs_run: "2026102100" } });

  const forced = plan({ now, models: [model()], runs, force: "gfs" });
  assert.equal(forced.models[0].state, "pending");
  assert.equal(forced.dispatch?.inputs.gfs_run, "2026102106");
});

test("an optional model with nothing deployed is skipped once it fails", () => {
  const title = "Typhoon Lens · update icon · gfs 2026102100 · icon 2026102100";
  const runs = [1, 2, 3].map((i) => run({ title, conclusion: "failure", created: 30 * i + 30 }));
  const icon = model({ id: "icon", required: false, upstream: "2026102100", deployed: null });
  const result = plan({ now, models: [model({ upstream: "2026102100" }), icon], runs });
  assert.equal(result.models[1].state, "failed");
  assert.equal(result.models[1].target, "skip");
});

test("the site is redeployed hourly when no model changed", () => {
  const current = model({ upstream: "2026102100" });
  assert.equal(plan({ now, models: [current], runs: [run({ created: 30 })] }).dispatch, null);
  assert.equal(plan({ now, models: [current], runs: [run({ created: 61 })] }).dispatch?.reason, "refresh");
  assert.equal(plan({ now, models: [current], runs: [] }).dispatch?.reason, "refresh");
});

test("an unreachable source keeps the deployed run", () => {
  const result = plan({ now, models: [model({ upstream: null })], runs: [run({ created: 61 })] });
  assert.equal(result.models[0].state, "unknown");
  assert.deepEqual(result.dispatch?.inputs, { gfs_run: "2026102100" });
});

test("the next run is expected one cycle plus the publishing delay later", () => {
  const result = plan({ now, models: [model()], runs: [] });
  assert.equal(result.models[0].nextRunExpected, "2026-10-21T17:00:00.000Z");
});
