import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";

import { baseStyle, OVERLAYS, PLACES } from "./basemap";
import { loadLatestRun, type LayerInfo, type Run, type Track } from "./data";
import { FieldLayer } from "./fieldLayer";
import { FrameCache, sampleFrame, type Frame } from "./frames";
import { cssGradient, SCALES, scaleCoordinate } from "./palettes";
import { category, knots, positionAt, trackFeatures } from "./storms";

const HOUR = 3600 * 1000;
const PLAY_HOURS_PER_SECOND = 6;

const $ = <T extends HTMLElement>(selector: string) => document.querySelector(selector) as T;

const state = {
  layer: "wind" as string | null,
  time: Date.now(),
  playing: false,
  overlays: new Set<string>(),
  storms: true,
  frames: null as [Frame, Frame] | null,
  ratio: 0,
};

const timeFormat = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatValue(layer: LayerInfo, values: number[]): string {
  if (layer.id === "wind") {
    const [u, v] = values;
    const speed = Math.hypot(u, v);
    const from = (Math.atan2(-u, -v) * 180) / Math.PI;
    const directions = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
    const direction = directions[Math.round(((from + 360) % 360) / 45) % 8];
    return `${speed.toFixed(1)} m/s · ${direction}풍`;
  }
  if (layer.id === "precipitation") {
    const [rate, clouds, snow] = values;
    if (rate < 0.05) return `강수 없음 · 구름 ${Math.round(clouds)}%`;
    return `${snow > 0.5 ? "눈" : "비"} ${rate.toFixed(1)} mm/h`;
  }
  const digits = layer.id === "pressure" ? 0 : 1;
  return `${values[0].toFixed(digits)} ${layer.unit}`;
}

async function start(): Promise<void> {
  const style = baseStyle();
  let run: Run;
  try {
    run = await loadLatestRun();
  } catch (error) {
    $("#status").textContent = `예보 데이터를 불러오지 못했습니다: ${(error as Error).message}`;
    return;
  }
  const { manifest } = run;
  const layers = new Map(manifest.layers.map((layer) => [layer.id, layer]));
  const steps = manifest.steps.map((s) => ({ ...s, time: Date.parse(s.valid) }));
  const first = steps[0].time;
  const last = steps[steps.length - 1].time;
  const runTime = Date.parse(manifest.run);
  state.time = Math.min(last, Math.max(first, Math.round(Date.now() / HOUR) * HOUR));

  const runDate = new Date(runTime);
  $("#run").textContent = `${manifest.title} · ${runDate.getUTCDate()}일 ${String(runDate.getUTCHours()).padStart(2, "0")}Z 실행 · ${Math.round((last - runTime) / HOUR / 24)}일 예보`;
  $("#status").textContent = "";

  const map = new maplibregl.Map({
    container: "map",
    style: await style,
    center: [128, 25],
    zoom: 3,
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
      customAttribution: `${manifest.attribution} · Natural Earth`,
    }),
    "bottom-right",
  );

  const field = new FieldLayer();
  const frames = new FrameCache(run);

  await new Promise<void>((resolve) => map.once("load", () => resolve()));
  map.addLayer(field, "coast");

  for (const [name, lat, lon] of PLACES) {
    const element = document.createElement("div");
    element.className = "place";
    element.textContent = name;
    new maplibregl.Marker({ element, anchor: "left" }).setLngLat([lon, lat]).addTo(map);
  }

  // Storm tracks.
  const tracks = run.storms.tracks;
  map.addSource("tracks", { type: "geojson", data: trackFeatures(tracks) });
  map.addLayer({
    id: "track-lines",
    type: "line",
    source: "tracks",
    filter: ["==", ["get", "kind"], "segment"],
    paint: { "line-color": ["get", "color"], "line-width": 2.5, "line-opacity": 0.9 },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "track-points",
    type: "circle",
    source: "tracks",
    filter: ["==", ["get", "kind"], "point"],
    paint: {
      "circle-radius": 4,
      "circle-color": ["get", "color"],
      "circle-stroke-color": "#0d1117",
      "circle-stroke-width": 1.5,
    },
  });

  const stormMarkers = new Map<string, maplibregl.Marker>();
  function updateStormMarkers(): void {
    for (const track of tracks) {
      const position = state.storms ? positionAt(track, state.time) : null;
      let marker = stormMarkers.get(track.id);
      if (!position) {
        marker?.remove();
        stormMarkers.delete(track.id);
        continue;
      }
      const cat = category(position.wind);
      if (!marker) {
        const element = document.createElement("button");
        element.className = "storm-marker";
        element.addEventListener("click", () => showStorm(track));
        marker = new maplibregl.Marker({ element }).setLngLat([position.lon, position.lat]).addTo(map);
        stormMarkers.set(track.id, marker);
      }
      marker.setLngLat([position.lon, position.lat]);
      const element = marker.getElement();
      element.style.setProperty("--storm-color", cat.color);
      element.innerHTML = `<span class="storm-icon" aria-hidden="true"></span><span class="storm-label">${cat.label} · ${Math.round(position.mslp)} hPa</span>`;
      element.setAttribute("aria-label", `열대저기압 ${cat.label}, 중심기압 ${Math.round(position.mslp)} hPa`);
    }
  }

  function showStorm(track: Track): void {
    const lons = track.points.map((p) => p.lon);
    const lats = track.points.map((p) => p.lat);
    map.fitBounds(
      [
        [Math.min(...lons) - 2, Math.min(...lats) - 2],
        [Math.max(...lons) + 2, Math.max(...lats) + 2],
      ],
      { padding: 60, duration: 800 },
    );
    $("#storms-panel").hidden = true;
  }

  function renderStormList(): void {
    const list = $("#storm-list");
    list.innerHTML = "";
    if (tracks.length === 0) {
      list.innerHTML = `<li class="empty">이번 실행에서 감지된 열대저기압이 없습니다.</li>`;
      return;
    }
    tracks.forEach((track) => {
      const firstPoint = track.points[0];
      const lastPoint = track.points[track.points.length - 1];
      const cat = category(track.max_wind);
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.innerHTML = `
        <span class="swatch" style="background:${cat.color}"></span>
        <span class="storm-title">${cat.label} · 최저 ${Math.round(track.min_mslp)} hPa</span>
        <span class="storm-meta">최대 ${track.max_wind.toFixed(0)} m/s (${knots(track.max_wind)} kt) ·
        ${timeFormat.format(Date.parse(firstPoint.valid))} – ${timeFormat.format(Date.parse(lastPoint.valid))}</span>`;
      button.addEventListener("click", () => showStorm(track));
      item.append(button);
      list.append(item);
    });
  }
  renderStormList();

  // Forecast field rendering.
  let request = 0;
  async function updateField(): Promise<void> {
    const layer = state.layer ? layers.get(state.layer) : undefined;
    if (!layer) {
      field.setLayer(undefined);
      return;
    }
    let index = steps.findIndex((s) => s.time >= state.time);
    if (index <= 0) index = 1;
    const [a, b] = [steps[index - 1], steps[index]];
    const ratio = Math.min(1, Math.max(0, (state.time - a.time) / (b.time - a.time)));
    const current = ++request;
    const pair = await Promise.all([frames.get(layer.id, a.hour), frames.get(layer.id, b.hour)]);
    if (current !== request) return;
    state.frames = pair;
    state.ratio = ratio;
    field.setFrames(pair, ratio);
    // Warm the next step for playback.
    if (index + 1 < steps.length) frames.get(layer.id, steps[index + 1].hour).catch(() => {});
  }

  function selectLayer(id: string | null): void {
    state.layer = id;
    field.setLayer(id ? layers.get(id) : undefined);
    document.querySelectorAll<HTMLInputElement>("input[name=layer]").forEach((input) => {
      input.checked = input.value === (id ?? "none");
    });
    renderLegend();
    updateField();
  }

  function renderLegend(): void {
    const legend = $("#legend");
    const layer = state.layer ? layers.get(state.layer) : undefined;
    if (!layer) {
      legend.hidden = true;
      return;
    }
    legend.hidden = false;
    const scale = SCALES[layer.id];
    const ticks = scale.ticks
      .map((v) => `<span style="left:${(scaleCoordinate(layer.id, v) * 100).toFixed(1)}%">${v}</span>`)
      .join("");
    const snow = scale.alternate
      ? `<div class="legend-row"><span class="legend-name">눈</span><div class="legend-bar" style="background:${cssGradient(layer.id, true)}"></div></div>`
      : "";
    legend.innerHTML = `
      <div class="legend-row"><span class="legend-name">${scale.alternate ? "비" : layer.title}</span><div class="legend-bar" style="background:${cssGradient(layer.id)}"></div></div>
      ${snow}
      <div class="legend-ticks"><span class="legend-name">${layer.unit}</span><div class="legend-scale">${ticks}</div></div>`;
  }

  // Layer menu.
  const layerList = $("#layer-list");
  for (const layer of manifest.layers) {
    layerList.insertAdjacentHTML(
      "beforeend",
      `<label class="option"><input type="radio" name="layer" value="${layer.id}"> ${layer.title}</label>`,
    );
  }
  layerList.insertAdjacentHTML(
    "beforeend",
    `<label class="option"><input type="radio" name="layer" value="none"> 끄기</label>`,
  );
  layerList.addEventListener("change", (event) => {
    const value = (event.target as HTMLInputElement).value;
    selectLayer(value === "none" ? null : value);
  });

  const overlayList = $("#overlay-list");
  for (const overlay of OVERLAYS) {
    overlayList.insertAdjacentHTML(
      "beforeend",
      `<label class="option"><input type="checkbox" value="${overlay.id}"> ${overlay.title}<small>${overlay.note}</small></label>`,
    );
  }
  overlayList.insertAdjacentHTML(
    "beforeend",
    `<label class="option"><input type="checkbox" value="storms" checked> 열대저기압 진로<small>GFS 모델에서 추출 · 공식 예보 아님</small></label>`,
  );
  overlayList.addEventListener("change", async (event) => {
    const input = event.target as HTMLInputElement;
    if (input.value === "storms") {
      state.storms = input.checked;
      const visibility = input.checked ? "visible" : "none";
      map.setLayoutProperty("track-lines", "visibility", visibility);
      map.setLayoutProperty("track-points", "visibility", visibility);
      updateStormMarkers();
      return;
    }
    const overlay = OVERLAYS.find((o) => o.id === input.value)!;
    const id = `overlay-${overlay.id}`;
    if (!input.checked) {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
      return;
    }
    try {
      const source = await overlay.tiles();
      map.addSource(id, { type: "raster", tileSize: 256, ...source });
      // Imagery sits under the forecast field; fire points sit above it.
      map.addLayer(
        { id, type: "raster", source: id, paint: { "raster-opacity": overlay.opacity } },
        overlay.id === "fires" ? "coast" : field.id,
      );
    } catch (error) {
      input.checked = false;
      $("#status").textContent = `${overlay.title}을(를) 불러오지 못했습니다: ${(error as Error).message}`;
    }
  });

  $("#layers-button").addEventListener("click", () => {
    $("#layers-panel").hidden = !$("#layers-panel").hidden;
    $("#storms-panel").hidden = true;
  });
  $("#storms-button").addEventListener("click", () => {
    $("#storms-panel").hidden = !$("#storms-panel").hidden;
    $("#layers-panel").hidden = true;
  });
  document.querySelectorAll(".panel-close").forEach((button) =>
    button.addEventListener("click", () => ((button.closest(".panel") as HTMLElement).hidden = true)),
  );

  // Timeline.
  const slider = $<HTMLInputElement>("#time");
  slider.min = String(first / HOUR);
  slider.max = String(last / HOUR);
  slider.step = "1";
  const ticks = $("#ticks");
  // One tick per local midnight.
  const midnight = new Date(first);
  midnight.setHours(24, 0, 0, 0);
  for (const day = midnight; day.getTime() <= last; day.setDate(day.getDate() + 1)) {
    const offset = ((day.getTime() - first) / (last - first)) * 100;
    ticks.insertAdjacentHTML(
      "beforeend",
      `<span style="left:${offset.toFixed(2)}%">${day.getMonth() + 1}/${day.getDate()}</span>`,
    );
  }

  function updateTime(): void {
    slider.value = String(Math.round(state.time / HOUR));
    const lead = Math.round((state.time - runTime) / HOUR);
    const now = Math.round((state.time - Date.now()) / HOUR);
    const relative = Math.abs(now) < 1 ? "지금" : now > 0 ? `${now}시간 후` : `${-now}시간 전`;
    $("#clock").textContent = timeFormat.format(state.time);
    $("#lead").textContent = `${relative} · 예보 +${lead}h`;
    updateField();
    updateStormMarkers();
  }

  slider.addEventListener("input", () => {
    state.time = Number(slider.value) * HOUR;
    updateTime();
  });

  const playButton = $<HTMLButtonElement>("#play");
  let lastFrame = 0;
  function tick(now: number): void {
    if (!state.playing) return;
    const elapsed = lastFrame ? (now - lastFrame) / 1000 : 0;
    lastFrame = now;
    state.time += elapsed * PLAY_HOURS_PER_SECOND * HOUR;
    if (state.time > last) state.time = first;
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
    const layer = state.layer ? layers.get(state.layer) : undefined;
    if (!layer || !state.frames) {
      probe.hidden = true;
      return;
    }
    const lon = ((((lngLat.lng + 180) % 360) + 360) % 360) - 180;
    const a = sampleFrame(state.frames[0], layer, lon, lngLat.lat);
    const b = sampleFrame(state.frames[1], layer, lon, lngLat.lat);
    const values = a.map((v, k) => v + (b[k] - v) * state.ratio);
    probe.hidden = false;
    const text = formatValue(layer, values);
    probe.textContent = layer.id === "precipitation" ? text : `${layer.title} ${text}`;
    probe.style.transform = `translate(${point.x + 14}px, ${point.y - 14}px)`;
  }
  map.on("mousemove", (event) => showProbe(event.lngLat, event.point));
  map.on("click", (event) => showProbe(event.lngLat, event.point));
  map.on("mouseout", () => (probe.hidden = true));
  map.on("movestart", () => (probe.hidden = true));

  selectLayer(state.layer);
  updateTime();
}

start();
