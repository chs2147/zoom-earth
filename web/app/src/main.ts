import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";

import { baseStyle, configureOverlays, FIRST_LINE_LAYER, OVERLAYS, PLACES } from "./basemap";
import {
  loadIndex,
  loadLatestRun,
  loadOfficial,
  loadOverlays,
  type LayerInfo,
  type OfficialStorm,
  type Run,
  type Track,
} from "./data";
import { FieldLayer } from "./fieldLayer";
import { LANDMARKS, landmarkSize, landmarksVisible } from "./landmarks";
import { FrameCache, sampleFrame, type Frame } from "./frames";
import { cssGradient, SCALES, scaleCoordinate } from "./palettes";
import { WindParticles } from "./particles";
import { StormPanel } from "./stormPanel";
import {
  category,
  categoryKt,
  matchOfficial,
  modelRows,
  officialFeatures,
  officialPositionAt,
  officialRows,
  officialTitle,
  officialType,
  positionAt,
  trackFeatures,
} from "./storms";
import {
  formatValue,
  legendTicks,
  loadSettings,
  saveSettings,
  shortValue,
  unitLabel,
  windFromKt,
  windFromMs,
  windLabel,
  type WindUnit,
} from "./units";

const HOUR = 3600 * 1000;
const PLAY_HOURS_PER_SECOND = 6;

const MODELS: Record<string, { name: string; range: string }> = {
  icon: { name: "ICON", range: "7.5일" },
  gfs: { name: "GFS", range: "16일" },
};

// Forecast menu: one entry per map; wind has speed and gust variants.
const FORECAST_MENU: { id: string; title: string; variants?: { id: string; title: string }[] }[] = [
  { id: "precipitation", title: "강수" },
  {
    id: "wind",
    title: "바람",
    variants: [
      { id: "wind", title: "풍속" },
      { id: "gust", title: "돌풍" },
    ],
  },
  { id: "temperature", title: "기온" },
  { id: "humidity", title: "습도" },
  { id: "pressure", title: "기압" },
];

type Base = "forecast" | "satellite" | "radar";

const $ = <T extends HTMLElement>(selector: string) => document.querySelector(selector) as T;

const settings = loadSettings();
const narrow = window.matchMedia("(max-width: 899px)");

const state = {
  model: "gfs",
  base: "forecast" as Base,
  layer: "wind",
  time: Date.now(),
  playing: false,
  fires: false,
  official: true,
  storms: true,
  frames: null as [Frame, Frame] | null,
  windFrames: null as [Frame, Frame] | null,
  ratio: 0,
};

// URL hash: #model=icon&base=forecast&layer=wind&lat=25&lon=128&z=4&t=2026-10-22T03Z
function readHash(): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
}

const clockFormat = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit", hour12: true });
const dayFormat = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" });
const listFormat = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "numeric",
  hour12: true,
});
const shortTime = new Intl.DateTimeFormat("ko-KR", { day: "numeric", hour: "numeric", hour12: false });
const runFormat = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "numeric", hour12: false });
const updatedFormat = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// Returning to a page left in the background reloads it at the current
// time. A long-idle page can point at a model run a later deploy replaced
// (old frames are deleted), which made frame loads fail.
let reloading = false;
let sharing = false;
let hiddenAt = 0;

function reloadAtNow(overrides: Record<string, string> = {}): void {
  if (reloading) return;
  reloading = true;
  const params = new URLSearchParams(location.hash.slice(1));
  params.delete("t");
  for (const [key, value] of Object.entries(overrides)) params.set(key, value);
  const hash = params.toString();
  history.replaceState(null, "", hash ? `#${hash}` : location.pathname + location.search);
  location.reload();
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") hiddenAt = Date.now();
  // The system share sheet hides the page too; that is not leaving it.
  else if (hiddenAt && !sharing) reloadAtNow();
});
// Pages restored from the back/forward cache skip the load event.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) reloadAtNow();
});

// A failed forecast load reloads the page too: a page kept open while a
// deploy replaced its run asks for deleted frames. Reloads are at least
// RELOAD_GAP apart, so a site or network outage retries at that pace
// instead of looping; without session storage every reload waits the gap.
const RELOAD_GAP = 2 * 60 * 1000;
const RELOAD_KEY = "typhoonLens.errorReloadAt";
let retryTimer = 0;

function reloadAfterLoadError(overrides: Record<string, string> = {}): void {
  let last = Date.now();
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
  } catch {
    // Storage blocked: keep `last` at now so this waits the full gap.
  }
  const wait = last + RELOAD_GAP - Date.now();
  if (wait <= 0) {
    try {
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
      // Without storage the next failure waits the full gap.
    }
    reloadAtNow(overrides);
    return;
  }
  $("#status").textContent = `예보 데이터를 불러오지 못했습니다. ${Math.ceil(wait / 60_000)}분 안에 다시 불러옵니다.`;
  if (!retryTimer) {
    retryTimer = window.setTimeout(() => {
      retryTimer = 0;
      reloadAfterLoadError(overrides);
    }, wait);
  }
}

// JTWC amplifying remarks such as "120HR BECOMING EXTRATROPICAL".
const REMARK_PHRASES: [RegExp, string][] = [
  [/BECOMING EXTRATROPICAL/, "온대저기압으로 변질"],
  [/COMPLETED? EXTRATROPICAL TRANSITION/, "온대저기압으로 변질 완료"],
  [/DISSIPATING AS A SIGNIFICANT TROPICAL CYCLONE OVER WATER/, "해상에서 약화·소멸 중"],
  [/DISSIPATED AS A SIGNIFICANT TROPICAL CYCLONE OVER WATER/, "해상에서 소멸"],
  [/DISSIPATING AS A SIGNIFICANT TROPICAL CYCLONE OVER LAND/, "육상에서 약화·소멸 중"],
  [/DISSIPATED AS A SIGNIFICANT TROPICAL CYCLONE OVER LAND/, "육상에서 소멸"],
  [/OVER LAND/, "육상 통과"],
];

function translateRemark(remark: string): string {
  const match = /^(\d+)HR\s+(.*)$/.exec(remark);
  const [hours, phrase] = match ? [Number(match[1]), match[2]] : [null, remark];
  const korean = REMARK_PHRASES.find(([pattern]) => pattern.test(phrase))?.[1] ?? phrase.toLowerCase();
  return hours === null ? korean : `${hours}시간 후 ${korean}`;
}

function degrees(value: number, positive: string, negative: string): string {
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute);
  const minutes = Math.floor((absolute - whole) * 60);
  return `${whole}° ${String(minutes).padStart(2, "0")}′ ${value >= 0 ? positive : negative}`;
}

// A spiral cyclone symbol; it turns counter-clockwise in the northern
// hemisphere and clockwise in the southern.
const CYCLONE_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.6-5C16 2 11 3.6 8.4 7.3 5 8 2.9 11 3.4 15c.3-2.4 1.5-4.4 3.3-5.8a6 6 0 0 0 10.6 5.6c-1.4 4-5.5 6.5-10 6.2 4.7 1.4 9.6-.2 12.2-3.9 3.3-.6 5.4-3.6 4.8-7.6-.2 2.4-1.4 4.4-3.2 5.8a6 6 0 0 0-10.6-5.6c1.4-4 5.5-6.5 10-6.2Z"/></svg>`;

function cycloneIcon(color: string, lat: number, official: boolean): string {
  const turn = lat < 0 ? "clockwise" : "";
  return `<span class="cyclone ${official ? "official" : "model"} ${turn}" style="--storm-color:${color}">${CYCLONE_SVG}</span>`;
}

let toastTimer = 0;
function toast(message: string): void {
  const element = $("#toast");
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (element.hidden = true), 2500);
}

async function start(): Promise<void> {
  const hash = readHash();
  const style = baseStyle();
  const officialData = loadOfficial();
  const overlayData = loadOverlays();
  let run: Run;
  let models: string[];
  try {
    const index = await loadIndex();
    models = Object.keys(MODELS).filter((name) => index.models[name]);
    const wanted = hash.model ?? "gfs";
    state.model = models.includes(wanted) ? wanted : models.includes("gfs") ? "gfs" : models[0];
    run = await loadLatestRun(state.model, index);
  } catch (error) {
    console.warn(error);
    reloadAfterLoadError();
    return;
  }
  if (hash.layer && SCALES[hash.layer]) state.layer = hash.layer;
  if (hash.base === "satellite" || hash.base === "radar") state.base = hash.base;

  // Everything that depends on the selected model's run.
  function makeView(run: Run) {
    const steps = run.manifest.steps.map((s) => ({ ...s, time: Date.parse(s.valid) }));
    return {
      run,
      label: run.manifest.model.toUpperCase(),
      layers: new Map(run.manifest.layers.map((layer) => [layer.id, layer])),
      steps,
      first: steps[0].time,
      last: steps[steps.length - 1].time,
      runTime: Date.parse(run.manifest.run),
      frames: new FrameCache(run),
      tracks: run.storms.tracks,
      matched: new Map<string, string | undefined>(),
    };
  }
  let view = makeView(run);
  const wantedTime = hash.t ? Date.parse(hash.t.replace(/Z$/, ":00Z")) : NaN;
  const startTime = Number.isFinite(wantedTime) ? wantedTime : Math.round(Date.now() / HOUR) * HOUR;
  state.time = Math.min(view.last, Math.max(view.first, startTime));

  // Which model run the map shows (local time and UTC cycle) and when its
  // frames were built; updated whenever the model changes.
  function renderRunInfo(): void {
    const runDate = new Date(view.runTime);
    const cycle = `${runDate.getUTCDate()}일 ${String(runDate.getUTCHours()).padStart(2, "0")}Z`;
    const days = Math.round(((view.last - view.runTime) / HOUR / 24) * 10) / 10;
    const generated = Date.parse(view.run.manifest.generated);
    const name = MODELS[state.model]?.name ?? view.label;
    $("#run").innerHTML = `<strong>${name}</strong> ${runFormat.format(runDate)} 기준 (${cycle}) · ${days}일 예보`;
    $("#run").title = view.run.manifest.title;
    const updated = $("#run-updated");
    updated.hidden = !Number.isFinite(generated);
    if (!updated.hidden) updated.textContent = `${name} 업데이트 ${updatedFormat.format(generated)}`;
  }
  renderRunInfo();
  $("#status").textContent = "";

  const lat = Number(hash.lat);
  const lon = Number(hash.lon);
  const zoom = Number(hash.z);
  const map = new maplibregl.Map({
    container: "map",
    style: await style,
    center: hash.lat && Number.isFinite(lat) && Number.isFinite(lon) ? [lon, lat] : [128, 25],
    zoom: hash.z && Number.isFinite(zoom) ? zoom : 3,
    minZoom: 1,
    maxZoom: 9,
    attributionControl: false,
    renderWorldCopies: true,
    dragRotate: false,
    pitchWithRotate: false,
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(
    new maplibregl.AttributionControl({
      compact: true,
      customAttribution: "NOAA GFS · DWD ICON · JTWC · NHC · NASA GIBS · RainViewer · Natural Earth",
    }),
    "bottom-left",
  );
  // Start the data credits collapsed; the (i) button opens them.
  map.once("load", () =>
    document.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"),
  );
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  map.addControl(
    new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: false }, trackUserLocation: false }),
    "bottom-right",
  );
  map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

  const field = new FieldLayer();
  await new Promise<void>((resolve) => map.once("load", () => resolve()));
  map.addLayer(field, FIRST_LINE_LAYER);
  const particles = new WindParticles(map);

  // City labels with the current value of the selected map, and a miniature
  // landmark above the name once zoomed in to a 200 km scale or closer.
  const places = PLACES.map(([name, lat, lon]) => {
    const element = document.createElement("div");
    element.className = "place";
    const landmark = LANDMARKS[name];
    element.innerHTML =
      (landmark ? `<span class="place-landmark" title="${landmark.name}">${landmark.svg}</span>` : "") +
      `<span class="place-name">${name}</span><span class="place-value" hidden></span>`;
    new maplibregl.Marker({ element, anchor: "bottom" }).setLngLat([lon, lat]).addTo(map);
    return { lat, lon, value: element.querySelector<HTMLElement>(".place-value")! };
  });

  const mapContainer = map.getContainer();
  function updateLandmarks(): void {
    const { lat } = map.getCenter();
    const zoom = map.getZoom();
    const on = settings.landmarks && landmarksVisible(zoom, lat);
    mapContainer.classList.toggle("landmarks-on", on);
    if (on) mapContainer.style.setProperty("--landmark-size", `${landmarkSize(zoom, lat)}px`);
  }
  map.on("move", updateLandmarks);
  updateLandmarks();

  const landmarkToggle = $<HTMLInputElement>("#landmark-toggle");
  landmarkToggle.checked = settings.landmarks;
  landmarkToggle.addEventListener("change", () => {
    settings.landmarks = landmarkToggle.checked;
    saveSettings(settings);
    updateLandmarks();
  });

  function updatePlaceValues(): void {
    const layer = currentLayer();
    for (const place of places) {
      if (!layer || !state.frames) {
        place.value.hidden = true;
        continue;
      }
      const a = sampleFrame(state.frames[0], layer, place.lon, place.lat);
      const b = sampleFrame(state.frames[1], layer, place.lon, place.lat);
      const text = shortValue(layer, a.map((v, k) => v + (b[k] - v) * state.ratio), settings);
      place.value.textContent = text;
      place.value.hidden = text === "";
    }
  }

  // Model storm tracks (thin, dotted) and official warnings (bold, coloured by class).
  map.addSource("tracks", { type: "geojson", data: trackFeatures(view.tracks) });
  map.addLayer({
    id: "track-lines",
    type: "line",
    source: "tracks",
    filter: ["==", ["get", "kind"], "segment"],
    paint: { "line-color": ["get", "color"], "line-width": 1.6, "line-opacity": 0.75, "line-dasharray": [1, 1.2] },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "track-points",
    type: "circle",
    source: "tracks",
    filter: ["==", ["get", "kind"], "point"],
    paint: {
      "circle-radius": 2.5,
      "circle-color": ["get", "color"],
      "circle-stroke-color": "#0d1117",
      "circle-stroke-width": 1,
      "circle-opacity": 0.85,
    },
  });

  const official = (await officialData)?.storms ?? [];
  map.addSource("official", { type: "geojson", data: officialFeatures(official) });
  map.addLayer(
    {
      id: "official-cone",
      type: "fill",
      source: "official",
      filter: ["==", ["get", "kind"], "cone"],
      paint: { "fill-color": "#ffffff", "fill-opacity": 0.12, "fill-outline-color": "rgba(255,255,255,0.55)" },
    },
    "track-lines",
  );
  map.addLayer(
    {
      id: "official-wind",
      type: "fill",
      source: "official",
      filter: ["==", ["get", "kind"], "wind"],
      paint: { "fill-color": ["get", "color"], "fill-opacity": 0.2 },
    },
    "track-lines",
  );
  map.addLayer({
    id: "official-history",
    type: "line",
    source: "official",
    filter: ["==", ["get", "kind"], "history-segment"],
    paint: { "line-color": ["get", "color"], "line-width": 3 },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "official-forecast",
    type: "line",
    source: "official",
    filter: ["==", ["get", "kind"], "forecast-segment"],
    paint: { "line-color": ["get", "color"], "line-width": 3 },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "official-points",
    type: "circle",
    source: "official",
    filter: ["any", ["==", ["get", "kind"], "forecast-point"], ["==", ["get", "kind"], "history-point"]],
    paint: {
      "circle-radius": ["case", ["==", ["get", "kind"], "forecast-point"], 5, 3],
      "circle-color": ["get", "color"],
      "circle-stroke-color": "#0d1117",
      "circle-stroke-width": 1.5,
    },
  });
  const OFFICIAL_LAYERS = ["official-cone", "official-wind", "official-history", "official-forecast", "official-points"];

  const forecastLabels: maplibregl.Marker[] = [];
  for (const storm of official) {
    for (const point of storm.forecast.slice(1)) {
      const label = document.createElement("div");
      label.className = "forecast-time";
      label.textContent = shortTime.format(Date.parse(point.time));
      forecastLabels.push(
        new maplibregl.Marker({ element: label, anchor: "left", offset: [9, 0] }).setLngLat([point.lon, point.lat]).addTo(map),
      );
    }
  }

  // Storm detail panel; tapping a row moves the timeline to that time.
  const panel = new StormPanel($("#storm-panel"), () => settings, (time) => {
    state.time = Math.min(view.last, Math.max(view.first, time));
    updateTime();
  });

  function closePanels(except?: string): void {
    for (const id of ["storms-panel", "settings-panel", "info-panel"]) {
      if (id !== except) $(`#${id}`).hidden = true;
    }
    if (except !== "storm-panel") panel.close();
    if (narrow.matches) setSidebar(false);
  }

  function fit(points: { lat: number; lon: number }[], pad: number): void {
    const lons = points.map((p) => p.lon);
    const lats = points.map((p) => p.lat);
    map.fitBounds(
      [
        [Math.min(...lons) - pad, Math.min(...lats) - pad],
        [Math.max(...lons) + pad, Math.max(...lats) + pad],
      ],
      { padding: { top: 80, bottom: 200, left: 60, right: 60 }, duration: 800, maxZoom: 6 },
    );
  }

  function openOfficial(storm: OfficialStorm, zoom: boolean): void {
    closePanels("storm-panel");
    const issued = listFormat.format(Date.parse(storm.issued));
    const kind = storm.kind === "warning" ? `경보 ${storm.warning}호` : storm.kind === "alert" ? "발생 경보" : "속보";
    const remarks = storm.remarks.map(translateRemark).join(" · ");
    panel.open(
      {
        title: officialTitle(storm, officialType(storm, storm.position.wind_kt)),
        subtitle: `${storm.agency} ${kind} · ${issued} 발표${remarks ? ` · ${remarks}` : ""}`,
        rows: officialRows(storm),
        note: "풍속은 1분 평균 최대풍입니다. 기압은 경보 시점 값만 공개됩니다.",
        link: storm.links ? { label: `최신 경보 원문 (${storm.agency})`, url: storm.links.warning } : undefined,
      },
      state.time,
    );
    if (zoom) fit([...storm.history.slice(-8), ...storm.forecast, storm.position], 3);
  }

  function openModel(track: Track, zoom: boolean): void {
    closePanels("storm-panel");
    const name = view.matched.get(track.id);
    const runDate = new Date(view.runTime);
    panel.open(
      {
        title: `${view.label} 예상 진로${name ? ` · ${name}` : ""}`,
        subtitle: `${runDate.getUTCDate()}일 ${String(runDate.getUTCHours()).padStart(2, "0")}Z 실행 · 모델에서 자동 추적 · 공식 예보 아님`,
        rows: modelRows(track, view.runTime),
        note: "풍속은 모델 10 m 최대풍으로 실제보다 약하게 나오는 경향이 있습니다.",
      },
      state.time,
    );
    if (zoom) fit(track.points, 2);
  }

  // One marker per official storm, moved along its track with the timeline.
  const officialMarkers = new Map<string, maplibregl.Marker>();
  for (const storm of official) {
    const element = document.createElement("button");
    element.className = "official-marker";
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      openOfficial(storm, false);
    });
    officialMarkers.set(
      storm.id,
      new maplibregl.Marker({ element, anchor: "bottom", offset: [0, 16] })
        .setLngLat([storm.position.lon, storm.position.lat])
        .addTo(map),
    );
  }

  function updateOfficialMarkers(): void {
    for (const storm of official) {
      const marker = officialMarkers.get(storm.id)!;
      const element = marker.getElement();
      const position = state.official ? officialPositionAt(storm, state.time) : null;
      element.hidden = position === null;
      if (!position) continue;
      marker.setLngLat([position.lon, position.lat]);
      const color = categoryKt(position.wind_kt ?? 0).color;
      const wind =
        position.wind_kt != null ? ` · ${Math.round(windFromKt(position.wind_kt, settings))} ${windLabel(settings)}` : "";
      const tense = position.forecast ? " (예보)" : "";
      const title = officialTitle(storm, officialType(storm, position.wind_kt));
      element.innerHTML = `${cycloneIcon(color, position.lat, true)}<span class="official-label">${title}${wind}${tense}</span>`;
      element.setAttribute("aria-label", `${storm.agency} ${title}${wind}${tense}, 상세 정보 보기`);
    }
  }

  function setOfficialVisible(visible: boolean): void {
    state.official = visible;
    for (const id of OFFICIAL_LAYERS) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    forecastLabels.forEach((marker) => (marker.getElement().hidden = !visible));
    updateOfficialMarkers();
  }

  const stormMarkers = new Map<string, maplibregl.Marker>();
  function updateStormMarkers(): void {
    for (const track of view.tracks) {
      const position = state.storms ? positionAt(track, state.time) : null;
      let marker = stormMarkers.get(track.id);
      if (!position) {
        marker?.remove();
        stormMarkers.delete(track.id);
        continue;
      }
      if (!marker) {
        const element = document.createElement("button");
        element.className = "storm-marker";
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          openModel(track, false);
        });
        // Anchor at the icon's centre (24px wide), not the icon-plus-label box.
        marker = new maplibregl.Marker({ element, anchor: "left", offset: [-12, 0] })
          .setLngLat([position.lon, position.lat])
          .addTo(map);
        stormMarkers.set(track.id, marker);
      }
      marker.setLngLat([position.lon, position.lat]);
      const element = marker.getElement();
      const cat = category(position.wind);
      const name = view.matched.get(track.id);
      element.innerHTML = `${cycloneIcon(cat.color, position.lat, false)}<span class="storm-label">${view.label}${name ? ` ${name}` : ""} · ${Math.round(position.mslp)} hPa</span>`;
      element.setAttribute("aria-label", `${view.label} 모델 열대저기압 ${cat.label}, 상세 정보 보기`);
    }
  }

  function matchTracks(): void {
    view.matched.clear();
    for (const track of view.tracks) {
      const storm = matchOfficial(track, official);
      view.matched.set(track.id, storm ? (storm.name ?? storm.number) : undefined);
    }
  }

  function renderStormList(): void {
    const list = $("#storm-list");
    list.innerHTML = `<li class="section">공식 예보 · JTWC/NHC</li>`;
    if (official.length === 0) list.insertAdjacentHTML("beforeend", `<li class="empty">현재 발표 중인 공식 경보가 없습니다.</li>`);
    for (const storm of official) {
      const cat = categoryKt(storm.position.wind_kt ?? 0);
      const wind =
        storm.position.wind_kt != null
          ? `최대 ${Math.round(windFromKt(storm.position.wind_kt, settings))} ${windLabel(settings)} · `
          : "";
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.innerHTML = `
        <span class="badge" style="background:${cat.color}">${cat.code}</span>
        <span class="storm-title">${officialTitle(storm)}</span>
        <span class="storm-meta">${wind}${storm.agency} · ${listFormat.format(Date.parse(storm.issued))} 발표</span>`;
      button.addEventListener("click", () => openOfficial(storm, true));
      item.append(button);
      list.append(item);
    }
    list.insertAdjacentHTML("beforeend", `<li class="section">모델 예상 진로 · ${view.label}</li>`);
    if (view.tracks.length === 0) {
      list.insertAdjacentHTML("beforeend", `<li class="empty">이번 실행에서 감지된 열대저기압이 없습니다.</li>`);
      return;
    }
    for (const track of view.tracks) {
      const cat = category(track.max_wind);
      const name = view.matched.get(track.id);
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.innerHTML = `
        <span class="badge" style="background:${cat.color}">${cat.code}</span>
        <span class="storm-title">${name ? `${name} · ` : ""}최저 ${Math.round(track.min_mslp)} hPa</span>
        <span class="storm-meta">최대 ${Math.round(windFromMs(track.max_wind, settings))} ${windLabel(settings)} ·
        ${listFormat.format(Date.parse(track.points[0].valid))} – ${listFormat.format(Date.parse(track.points[track.points.length - 1].valid))}</span>`;
      button.addEventListener("click", () => openModel(track, true));
      item.append(button);
      list.append(item);
    }
  }
  matchTracks();
  renderStormList();

  // Forecast field and the frames behind values, labels and particles.
  function currentLayer(): LayerInfo | undefined {
    return state.base === "forecast" ? view.layers.get(state.layer) : undefined;
  }

  let request = 0;
  async function updateField(): Promise<void> {
    const layer = currentLayer();
    const current = ++request;
    if (!layer) {
      state.frames = null;
      particles.setWind(null, null, 0);
      updatePlaceValues();
      return;
    }
    const { steps, frames } = view;
    let index = steps.findIndex((s) => s.time >= state.time);
    if (index <= 0) index = 1;
    const [a, b] = [steps[index - 1], steps[index]];
    const ratio = Math.min(1, Math.max(0, (state.time - a.time) / (b.time - a.time)));
    // Gusts still animate with the wind vectors.
    let pair: [Frame, Frame];
    let windPair: [Frame, Frame] | null;
    try {
      [pair, windPair] = await Promise.all([
        Promise.all([frames.get(layer.id, a.hour), frames.get(layer.id, b.hour)]),
        layer.id === "gust" ? Promise.all([frames.get("wind", a.hour), frames.get("wind", b.hour)]) : Promise.resolve(null),
      ]);
    } catch (error) {
      console.warn(error);
      if (current === request) reloadAfterLoadError();
      return;
    }
    if (current !== request) return;
    state.frames = pair;
    state.windFrames = layer.id === "wind" ? pair : windPair;
    state.ratio = ratio;
    field.setFrames(pair, ratio);
    particles.setWind(view.layers.get("wind") ?? null, state.windFrames, ratio);
    updatePlaceValues();
    // Warm the next step for playback.
    if (index + 1 < steps.length) frames.get(layer.id, steps[index + 1].hour).catch(() => {});
  }

  function updateParticles(): void {
    const layer = currentLayer();
    particles.setEnabled(settings.windAnimation && !!layer && (layer.id === "wind" || layer.id === "gust"));
  }

  function renderLegend(): void {
    const legend = $("#legend");
    const layer = currentLayer();
    if (!layer) {
      legend.hidden = true;
      return;
    }
    legend.hidden = false;
    const scale = SCALES[layer.id];
    const ticks = legendTicks(layer.id, settings)
      .map((t) => `<span style="left:${(scaleCoordinate(layer.id, t.value) * 100).toFixed(1)}%">${t.label}</span>`)
      .join("");
    const row = (name: string, alternate: boolean) =>
      `<div class="legend-row">${name ? `<span class="legend-name">${name}</span>` : ""}<div class="legend-bar" style="background:${cssGradient(layer.id, alternate)}">${alternate ? "" : `<div class="legend-scale">${ticks}</div>`}</div></div>`;
    legend.innerHTML =
      `<span class="legend-unit">${unitLabel(layer, settings)}</span>` +
      `<div class="legend-rows">${scale.alternate ? row("비", false) + row("눈", true) : row("", false)}</div>`;
  }

  // Sidebar menus.
  const liveList = $("#live-list");
  const forecastList = $("#forecast-list");
  function renderMenus(): void {
    const liveItems = OVERLAYS.filter((o) => o.id !== "fires")
      .map(
        (o) =>
          `<button class="menu-item${state.base === o.id ? " active" : ""}" data-base="${o.id}" aria-pressed="${state.base === o.id}"><span>${o.title}</span><small>${o.note}</small></button>`,
      )
      .join("");
    const fires = OVERLAYS.find((o) => o.id === "fires")!;
    liveList.innerHTML =
      liveItems +
      `<label class="menu-check"><input type="checkbox" data-overlay="fires"${state.fires ? " checked" : ""}><span>${fires.title}<small>${fires.note}</small></span></label>`;
    forecastList.innerHTML = FORECAST_MENU.map((item) => {
      const active = state.base === "forecast" && (item.variants ?? [item]).some((v) => v.id === state.layer);
      const variants =
        active && item.variants
          ? `<div class="menu-variants">${item.variants
              .map(
                (v) =>
                  `<button class="menu-variant${v.id === state.layer ? " active" : ""}" data-layer="${v.id}" aria-pressed="${v.id === state.layer}">${v.title}</button>`,
              )
              .join("")}</div>`
          : "";
      return `<button class="menu-item${active ? " active" : ""}" data-layer="${item.variants?.[0].id ?? item.id}" aria-pressed="${active}">${item.title}</button>${variants}`;
    }).join("");
    $("#storm-toggles").innerHTML = `
      <label class="menu-check"><input type="checkbox" data-storms="official"${state.official ? " checked" : ""}><span>공식 예보<small>JTWC·NHC</small></span></label>
      <label class="menu-check"><input type="checkbox" data-storms="model"${state.storms ? " checked" : ""}><span>모델 예상 진로<small>공식 예보 아님</small></span></label>`;
  }

  async function setBase(base: Base, layerId?: string): Promise<void> {
    for (const overlay of ["satellite", "radar"]) {
      const id = `overlay-${overlay}`;
      if (overlay !== base && map.getLayer(id)) {
        map.removeLayer(id);
        map.removeSource(id);
      }
    }
    if (base !== "forecast" && !map.getLayer(`overlay-${base}`)) {
      const overlay = OVERLAYS.find((o) => o.id === base)!;
      try {
        const source = await overlay.tiles();
        map.addSource(`overlay-${base}`, { type: "raster", tileSize: 256, ...source });
        map.addLayer(
          { id: `overlay-${base}`, type: "raster", source: `overlay-${base}`, paint: { "raster-opacity": overlay.opacity } },
          field.id,
        );
      } catch (error) {
        toast(`${overlay.title}: ${(error as Error).message}`);
        console.warn(error);
        renderMenus();
        return;
      }
    }
    state.base = base;
    if (layerId) state.layer = layerId;
    field.setLayer(currentLayer());
    renderMenus();
    renderLegend();
    updateParticles();
    updateField();
    scheduleHash();
  }

  async function setFires(on: boolean): Promise<void> {
    const id = "overlay-fires";
    state.fires = on;
    if (!on) {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
      return;
    }
    const overlay = OVERLAYS.find((o) => o.id === "fires")!;
    try {
      map.addSource(id, { type: "raster", tileSize: 256, ...(await overlay.tiles()) });
      map.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": overlay.opacity } }, FIRST_LINE_LAYER);
    } catch (error) {
      state.fires = false;
      renderMenus();
      toast(`${overlay.title}: ${(error as Error).message}`);
    }
  }

  $("#sidebar").addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const base = target.closest<HTMLElement>("[data-base]")?.dataset.base as Base | undefined;
    const layerId = target.closest<HTMLElement>("[data-layer]")?.dataset.layer;
    if (base) setBase(state.base === base ? "forecast" : base);
    else if (layerId) setBase("forecast", layerId);
    else return;
    // On phones the menu is a drawer over the map; close it once a map is
    // chosen, but keep it open after picking a map that offers variants.
    const offersVariants = !!target.closest(".menu-item") && FORECAST_MENU.some((m) => m.variants?.[0].id === layerId);
    if (narrow.matches && !offersVariants) setSidebar(false);
  });
  $("#sidebar").addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement;
    if (input.dataset.overlay === "fires") setFires(input.checked);
    if (input.dataset.storms === "official") setOfficialVisible(input.checked);
    if (input.dataset.storms === "model") {
      state.storms = input.checked;
      const visibility = input.checked ? "visible" : "none";
      map.setLayoutProperty("track-lines", "visibility", visibility);
      map.setLayoutProperty("track-points", "visibility", visibility);
      updateStormMarkers();
    }
  });

  function setSidebar(open: boolean): void {
    document.body.classList.toggle("sidebar-open", open);
    $("#menu-button").setAttribute("aria-expanded", String(open));
  }
  $("#menu-button").addEventListener("click", () => {
    const open = !document.body.classList.contains("sidebar-open");
    if (open) closePanels();
    setSidebar(open);
  });

  // Model switch and update time. They sit right of the timeline when there
  // is room, otherwise above it (always on phones), so the two never overlap.
  const timelineElement = $(".timeline");
  const dock = $("#model-dock");
  function layoutDock(): void {
    const root = document.documentElement;
    root.style.setProperty("--timeline-height", `${timelineElement.offsetHeight}px`);
    dock.classList.remove("stacked");
    if (narrow.matches) return;
    const timelineBox = timelineElement.getBoundingClientRect();
    if (dock.getBoundingClientRect().left < timelineBox.right + 12) {
      root.style.setProperty("--dock-right", `${window.innerWidth - timelineBox.right}px`);
      dock.classList.add("stacked");
    }
  }
  const layoutObserver = new ResizeObserver(layoutDock);
  layoutObserver.observe(timelineElement);
  layoutObserver.observe(dock);
  window.addEventListener("resize", layoutDock);
  const modelSwitch = $("#model-switch");
  function renderModelSwitch(): void {
    modelSwitch.hidden = models.length < 2;
    modelSwitch.innerHTML = Object.keys(MODELS)
      .filter((name) => models.includes(name))
      .map(
        (name) =>
          `<button role="radio" aria-checked="${name === state.model}" data-model="${name}"><strong>${MODELS[name].name}</strong> ${MODELS[name].range}</button>`,
      )
      .join("");
  }
  renderModelSwitch();
  modelSwitch.addEventListener("click", async (event) => {
    const name = (event.target as HTMLElement).closest<HTMLElement>("[data-model]")?.dataset.model;
    if (!name || name === state.model) return;
    try {
      view = makeView(await loadLatestRun(name));
      state.model = name;
    } catch (error) {
      toast(`${name.toUpperCase()} 예보를 불러오지 못했습니다`);
      console.warn(error);
      // Reload into the chosen model; the site may have published new runs.
      reloadAfterLoadError({ model: name });
      return;
    }
    stormMarkers.forEach((marker) => marker.remove());
    stormMarkers.clear();
    (map.getSource("tracks") as maplibregl.GeoJSONSource).setData(trackFeatures(view.tracks));
    matchTracks();
    renderStormList();
    panel.close();
    state.time = Math.min(view.last, Math.max(view.first, state.time));
    state.frames = null;
    renderModelSwitch();
    renderRunInfo();
    renderTimeline();
    field.setLayer(currentLayer());
    updateTime();
  });

  // Panels and tools.
  function togglePanel(id: string): void {
    const element = $(`#${id}`);
    const open = element.hidden;
    closePanels(open ? id : undefined);
    element.hidden = !open;
  }
  $("#storms-button").addEventListener("click", () => togglePanel("storms-panel"));
  $("#settings-button").addEventListener("click", () => togglePanel("settings-panel"));
  $("#info-button").addEventListener("click", () => togglePanel("info-panel"));
  document.querySelectorAll(".panel-close").forEach((button) =>
    button.addEventListener("click", () => ((button.closest(".panel") as HTMLElement).hidden = true)),
  );

  document.querySelectorAll<HTMLInputElement>("input[name=wind-unit]").forEach((input) => {
    input.checked = input.value === settings.windUnit;
    input.addEventListener("change", () => {
      settings.windUnit = input.value as WindUnit;
      saveSettings(settings);
      renderLegend();
      renderStormList();
      updatePlaceValues();
      updateOfficialMarkers();
      panel.refresh();
    });
  });
  const animation = $<HTMLInputElement>("#wind-animation");
  animation.checked = settings.windAnimation;
  animation.addEventListener("change", () => {
    settings.windAnimation = animation.checked;
    saveSettings(settings);
    updateParticles();
  });

  $("#share-button").addEventListener("click", async () => {
    writeHash();
    const url = location.href;
    try {
      if (navigator.share) {
        sharing = true;
        try {
          await navigator.share({ title: "Typhoon Lens", url });
        } finally {
          // Let the visibilitychange that follows the sheet see the flag.
          setTimeout(() => (sharing = false), 1000);
        }
        return;
      }
      await navigator.clipboard.writeText(url);
      toast("현재 화면 링크를 복사했습니다");
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") toast("공유하지 못했습니다");
    }
  });

  // Timeline.
  const slider = $<HTMLInputElement>("#time");
  function renderTimeline(): void {
    const { first, last } = view;
    slider.min = String(first / HOUR);
    slider.max = String(last / HOUR);
    slider.step = "1";
    const ticks = $("#ticks");
    ticks.innerHTML = "";
    const position = (time: number) => (((time - first) / (last - first)) * 100).toFixed(2);
    // Minor ticks every 6 hours; labelled ticks at local midnight.
    for (let time = Math.ceil(first / (6 * HOUR)) * 6 * HOUR; time <= last; time += 6 * HOUR) {
      ticks.insertAdjacentHTML("beforeend", `<i style="left:${position(time)}%"></i>`);
    }
    // Label every day while labels fit (about 44px each), else every 2nd or 3rd.
    const days = (last - first) / (24 * HOUR);
    const stride = Math.max(1, Math.ceil((days * 44) / Math.max(1, ticks.clientWidth)));
    const midnight = new Date(first);
    midnight.setHours(24, 0, 0, 0);
    for (let i = 0; midnight.getTime() <= last; i++, midnight.setDate(midnight.getDate() + 1)) {
      if (i % stride) continue;
      ticks.insertAdjacentHTML(
        "beforeend",
        `<span style="left:${position(midnight.getTime())}%">${midnight.getMonth() + 1}/${midnight.getDate()}</span>`,
      );
    }
  }
  renderTimeline();
  window.addEventListener("resize", renderTimeline);

  function updateTime(): void {
    slider.value = String(Math.round(state.time / HOUR));
    const lead = Math.round((state.time - view.runTime) / HOUR);
    const now = state.time - Date.now();
    const isNow = Math.abs(now) < 30 * 60 * 1000;
    $("#clock").textContent = isNow
      ? `지금 ${clockFormat.format(state.time)}`
      : `${dayFormat.format(state.time)} ${clockFormat.format(state.time)}`;
    const hours = Math.round(now / HOUR);
    const relative = isNow ? "" : hours > 0 ? `${hours}시간 후 · ` : `${-hours}시간 전 · `;
    $("#lead").textContent = `${relative}${view.label} 예보 +${lead}h`;
    updateField();
    updateStormMarkers();
    updateOfficialMarkers();
    panel.setTime(state.time);
    scheduleHash();
  }

  slider.addEventListener("input", () => {
    state.time = Number(slider.value) * HOUR;
    updateTime();
  });
  $("#now-button").addEventListener("click", () => {
    state.time = Math.min(view.last, Math.max(view.first, Date.now()));
    updateTime();
  });

  const playButton = $<HTMLButtonElement>("#play");
  let lastFrame = 0;
  function tick(now: number): void {
    if (!state.playing) return;
    const elapsed = lastFrame ? (now - lastFrame) / 1000 : 0;
    lastFrame = now;
    state.time += elapsed * PLAY_HOURS_PER_SECOND * HOUR;
    if (state.time > view.last) state.time = view.first;
    updateTime();
    requestAnimationFrame(tick);
  }
  playButton.addEventListener("click", () => {
    state.playing = !state.playing;
    playButton.setAttribute("aria-pressed", String(state.playing));
    playButton.setAttribute("aria-label", state.playing ? "일시정지" : "재생");
    lastFrame = 0;
    if (state.playing) requestAnimationFrame(tick);
  });

  // Value at the pointer or tapped point.
  const probe = $("#probe");
  function showProbe(lngLat: maplibregl.LngLat, point: maplibregl.Point): void {
    const layer = currentLayer();
    if (!layer || !state.frames) {
      probe.hidden = true;
      return;
    }
    const lon = ((((lngLat.lng + 180) % 360) + 360) % 360) - 180;
    const a = sampleFrame(state.frames[0], layer, lon, lngLat.lat);
    const b = sampleFrame(state.frames[1], layer, lon, lngLat.lat);
    probe.hidden = false;
    probe.textContent = formatValue(layer, a.map((v, k) => v + (b[k] - v) * state.ratio), settings);
    probe.style.transform = `translate(${point.x + 14}px, ${point.y - 14}px)`;
  }
  map.on("mousemove", (event) => showProbe(event.lngLat, event.point));
  map.on("click", (event) => showProbe(event.lngLat, event.point));
  map.on("mouseout", () => (probe.hidden = true));
  map.on("movestart", () => (probe.hidden = true));

  // Centre coordinates and URL state.
  const coordinates = $("#coordinates");
  function updateCoordinates(): void {
    const center = map.getCenter();
    coordinates.textContent = `${degrees(center.lat, "북", "남")}  ${degrees(((center.lng + 540) % 360) - 180, "동", "서")}`;
  }
  map.on("move", updateCoordinates);
  updateCoordinates();

  function writeHash(): void {
    if (reloading) return;
    const center = map.getCenter();
    const params = new URLSearchParams({
      model: state.model,
      base: state.base,
      layer: state.layer,
      lat: center.lat.toFixed(2),
      lon: center.lng.toFixed(2),
      z: map.getZoom().toFixed(1),
      t: new Date(Math.round(state.time / HOUR) * HOUR).toISOString().slice(0, 13) + "Z",
    });
    history.replaceState(null, "", `#${params}`);
  }
  let hashTimer = 0;
  function scheduleHash(): void {
    clearTimeout(hashTimer);
    hashTimer = window.setTimeout(writeHash, 400);
  }
  map.on("moveend", scheduleHash);

  configureOverlays(await overlayData);
  if (state.base !== "forecast") await setBase(state.base);
  field.setLayer(currentLayer());
  renderMenus();
  renderLegend();
  updateParticles();
  updateTime();
}

start();
