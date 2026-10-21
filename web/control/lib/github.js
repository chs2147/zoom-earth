// @ts-check
// GitHub Actions calls for the deploy workflow.

export const CONFIG = {
  owner: process.env.GITHUB_OWNER ?? "chs2147",
  repo: process.env.GITHUB_REPO ?? "zoom-earth",
  workflow: process.env.GITHUB_WORKFLOW ?? "typhoon-lens.yml",
  ref: process.env.GITHUB_REF_NAME ?? "main",
  siteUrl: (process.env.SITE_URL ?? "https://chs2147.github.io/zoom-earth/").replace(/\/?$/, "/"),
};

/** @param {string} path @param {RequestInit} [init] */
async function github(path, init = {}) {
  /** @type {Record<string, string>} */
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "TyphoonLens-control",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}${path}`, {
    ...init,
    headers: { ...headers, ...init.headers },
  });
  if (!response.ok) throw new Error(`GitHub ${path}: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  return response;
}

/** Recent deploy workflow runs, newest first. @returns {Promise<import("./planner.js").WorkflowRun[]>} */
export async function listRuns(perPage = 30) {
  const response = await github(`/actions/workflows/${CONFIG.workflow}/runs?per_page=${perPage}`);
  const { workflow_runs: runs } = await response.json();
  return runs.map((/** @type {any} */ run) => ({
    id: run.id,
    title: run.display_title,
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    url: run.html_url,
  }));
}

/** Start the deploy workflow. @param {Record<string, string>} inputs */
export async function dispatch(inputs) {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not set");
  await github(`/actions/workflows/${CONFIG.workflow}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref: CONFIG.ref, inputs }),
  });
}

/** Model runs the published site serves, from its data/index.json. @returns {Promise<Record<string, string>>} */
export async function deployedRuns() {
  // The query string skips the Pages CDN copy, cached for up to 10 minutes.
  const response = await fetch(`${CONFIG.siteUrl}data/index.json?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`site index: HTTP ${response.status}`);
  const { models } = await response.json();
  return Object.fromEntries(Object.entries(models).map(([id, model]) => [id, /** @type {any} */ (model).latest]));
}
