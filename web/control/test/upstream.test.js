// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";

import { gfsLatest, iconLatest, iconNeededHours } from "../lib/upstream.js";

/** S3 ListObjectsV2 page with an .idx key per hour. */
const s3Listing = (/** @type {string} */ run, /** @type {number[]} */ hours) =>
  `<ListBucketResult>${hours
    .map((h) => `<Key>gfs.${run.slice(0, 8)}/${run.slice(8)}/atmos/gfs.t${run.slice(8)}z.pgrb2.0p50.f${String(h).padStart(3, "0")}.idx</Key>`)
    .join("")}</ListBucketResult>`;

const all = (/** @type {number} */ end, step = 3) => Array.from({ length: end / step + 1 }, (_, i) => i * step);

test("GFS needs every hour of a run, not only the last", async () => {
  /** @type {Record<string, number[]>} */
  const published = {
    "2026102112": [0, 3, 6],
    "2026102106": all(384).filter((h) => h !== 201), // final hour is up, one in the middle is not
    "2026102100": all(384),
  };
  const get = async (/** @type {string} */ url) => {
    const run = url.match(/gfs\.(\d{8})\/(\d{2})/);
    const id = `${run?.[1]}${run?.[2]}`;
    return s3Listing(id, published[id] ?? []);
  };
  assert.equal(await gfsLatest({ now: new Date("2026-10-21T13:40:00Z"), get }), "2026102100");
});

test("GFS listings are followed across pages", async () => {
  const urls = [];
  const get = async (/** @type {string} */ url) => {
    urls.push(url);
    return url.includes("continuation-token")
      ? s3Listing("2026102100", all(384).slice(60))
      : s3Listing("2026102100", all(384).slice(0, 60)) + "<NextContinuationToken>a+b/c=</NextContinuationToken>";
  };
  assert.equal(await gfsLatest({ now: new Date("2026-10-21T05:00:00Z"), get, lookback: 1 }), "2026102100");
  assert.match(urls[1], /continuation-token=a%2Bb%2Fc%3D/);
});

test("ICON accumulations need the preceding output hour", () => {
  const needed = iconNeededHours(3);
  // Hourly output to 78 h: 3 h needs 2 h; 3-hourly after: 81 h needs 78 h.
  for (const hour of [0, 1, 2, 3, 77, 78, 81, 177, 180]) assert.ok(needed.has(hour), `hour ${hour}`);
  assert.ok(!needed.has(4) && !needed.has(79));
});

test("ICON picks the newest run with every variable published", async () => {
  const dirHours = (/** @type {string} */ run, /** @type {number[]} */ hours, variable = "PMSL") =>
    hours.map((h) => `<a href="icon_global_icosahedral_single-level_${run}_${String(h).padStart(3, "0")}_${variable}.grib2.bz2">`).join("\n");
  const full = [...Array(181).keys()];
  const get = async (/** @type {string} */ url) => {
    const [, cycle, variable] = url.match(/grib\/(\d{2})\/([a-z_0-9]+)\//) ?? [];
    if (cycle === "12") {
      // 12Z reached 180 h for pressure, but 2 m temperature is still uploading.
      return dirHours("2026102112", variable === "t_2m" ? full.slice(0, 100) : full, variable.toUpperCase());
    }
    return dirHours("2026102100", variable === "vmax_10m" ? full.slice(1) : full, variable.toUpperCase());
  };
  assert.equal(await iconLatest({ get }), "2026102100");
});
