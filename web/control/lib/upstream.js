// @ts-check
// Latest complete run of each model at its source.
//
// These mirror latest_complete_run() in web/pipeline/typhoon_lens/gfs.py and
// icon.py: a run counts only when every file the build reads is published,
// because NOAA and DWD upload forecast hours and variables out of order.
// Keep the two in step when a model's hours or variables change.

const USER_AGENT = "TyphoonLens-control/0.1 (personal, non-commercial)";

/** @typedef {(url: string) => Promise<string>} FetchText */

/** @type {FetchText} */
export async function fetchText(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

/** @param {Date} date */
export function runId(date) {
  return date.toISOString().slice(0, 13).replace(/[-T]/g, "");
}

/** @param {string} id YYYYMMDDHH */
export function runDate(id) {
  return new Date(`${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}T${id.slice(8, 10)}:00:00Z`);
}

/** @param {number} start @param {number} end @param {number} step */
function range(start, end, step) {
  const values = [];
  for (let value = start; value <= end; value += step) values.push(value);
  return values;
}

/** @param {Iterable<number>} needed @param {Set<number>} published */
function covers(needed, published) {
  for (const hour of needed) if (!published.has(hour)) return false;
  return true;
}

// --- GFS ------------------------------------------------------------------

const GFS_BUCKET = "https://noaa-gfs-bdp-pds.s3.amazonaws.com";
const GFS_FINAL_HOUR = 384;

/** @param {string} run @param {FetchText} get */
async function gfsPublishedHours(run, get) {
  const prefix = `gfs.${run.slice(0, 8)}/${run.slice(8)}/atmos/gfs.t${run.slice(8)}z.pgrb2.0p50.f`;
  const hours = new Set();
  let token = null;
  do {
    let url = `${GFS_BUCKET}/?list-type=2&prefix=${prefix}&max-keys=1000`;
    if (token) url += `&continuation-token=${encodeURIComponent(token)}`;
    const listing = await get(url);
    for (const match of listing.matchAll(/\.f(\d{3})\.idx<\/Key>/g)) hours.add(Number(match[1]));
    token = listing.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] ?? null;
  } while (token);
  return hours;
}

/** @param {{now?: Date, step?: number, get?: FetchText, lookback?: number}} [options] */
export async function gfsLatest({ now = new Date(), step = 3, get = fetchText, lookback = 8 } = {}) {
  const run = new Date(now);
  run.setUTCMinutes(0, 0, 0);
  run.setUTCHours(run.getUTCHours() - (run.getUTCHours() % 6));
  const needed = range(0, GFS_FINAL_HOUR, step);
  for (let i = 0; i < lookback; i += 1) {
    const id = runId(run);
    if (covers(needed, await gfsPublishedHours(id, get))) return id;
    run.setUTCHours(run.getUTCHours() - 6);
  }
  return null;
}

// --- ICON -----------------------------------------------------------------

const ICON_BASE = "https://opendata.dwd.de/weather/nwp/icon/grib";
const ICON_FINAL_HOUR = 180;
const ICON_HOURLY_UNTIL = 78;
const ICON_VARIABLES = ["u_10m", "v_10m", "vmax_10m", "pmsl", "t_2m", "relhum_2m", "clct", "tot_prec", "snow_gsp", "snow_con"];

export function iconOutputHours() {
  return [...range(0, ICON_HOURLY_UNTIL, 1), ...range(ICON_HOURLY_UNTIL + 3, ICON_FINAL_HOUR, 3)];
}

/** Hours a build reads: the frames plus the previous output for accumulations. @param {number} step */
export function iconNeededHours(step = 3) {
  const outputs = iconOutputHours();
  const available = new Set(outputs);
  const needed = new Set([1]);
  for (const hour of range(0, ICON_FINAL_HOUR, step)) {
    if (!available.has(hour)) continue;
    needed.add(hour);
    const index = outputs.indexOf(hour);
    if (index > 0) needed.add(outputs[index - 1]);
  }
  return needed;
}

/** @param {string} run @param {string} variable @param {FetchText} get */
async function iconPublished(run, variable, get) {
  const listing = await get(`${ICON_BASE}/${run.slice(8)}/${variable}/`);
  const hours = new Set();
  for (const match of listing.matchAll(new RegExp(`single-level_${run}_(\\d{3})_`, "g"))) hours.add(Number(match[1]));
  return hours;
}

/** @param {{step?: number, get?: FetchText}} [options] */
export async function iconLatest({ step = 3, get = fetchText } = {}) {
  const candidates = new Set();
  for (const cycle of ["00", "12"]) {
    const listing = await get(`${ICON_BASE}/${cycle}/pmsl/`);
    for (const match of listing.matchAll(new RegExp(`single-level_(\\d{10})_${ICON_FINAL_HOUR}_PMSL`, "g"))) {
      candidates.add(match[1]);
    }
  }
  const needed = iconNeededHours(step);
  const withoutAnalysis = new Set([...needed].filter((hour) => hour !== 0));
  for (const run of [...candidates].sort().reverse()) {
    const published = await Promise.all(ICON_VARIABLES.map((variable) => iconPublished(run, variable, get)));
    // VMAX_10M is a maximum over the preceding hour and has no hour 0.
    if (published.every((hours, i) => covers(ICON_VARIABLES[i] === "vmax_10m" ? withoutAnalysis : needed, hours))) {
      return run;
    }
  }
  return null;
}
