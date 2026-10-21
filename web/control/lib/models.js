// @ts-check
// Models the control server keeps up to date.
//
// `cycleHours` is how often a usable run starts and `readyAfterHours` roughly
// how long after its start the last file is published; together they give the
// dashboard an expected time for the next run. To add a model, add a pipeline
// source (web/pipeline/typhoon_lens/<id>.py), a `<id>_run` workflow input and
// an entry here.

import { gfsLatest, iconLatest } from "./upstream.js";

/**
 * @typedef {object} Model
 * @property {string} id
 * @property {string} title
 * @property {number} cycleHours
 * @property {number} readyAfterHours
 * @property {boolean} required  the site needs it; a failed optional model is skipped
 * @property {(now: Date) => Promise<string | null>} latest
 */

/** @type {Model[]} */
export const MODELS = [
  {
    id: "gfs",
    title: "NOAA GFS 0.5°",
    cycleHours: 6,
    readyAfterHours: 5,
    required: true,
    latest: (now) => gfsLatest({ now }),
  },
  {
    id: "icon",
    title: "DWD ICON 13 km",
    cycleHours: 12,
    readyAfterHours: 4,
    required: false,
    latest: () => iconLatest(),
  },
];
