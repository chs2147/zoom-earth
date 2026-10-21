// Dashboard: renders /api/status and sends admin actions to /api/dispatch.

const STATES = {
  current: ["최신", "ok"],
  pending: ["갱신 대기", "warn"],
  building: ["변환 중", "busy"],
  publishing: ["배포 반영 중", "busy"],
  failed: ["실패 · 이전 실행 유지", "bad"],
  unknown: ["원본 확인 불가", "bad"],
};

const RUN_STATES = {
  queued: "대기",
  in_progress: "진행 중",
  success: "성공",
  failure: "실패",
  cancelled: "취소",
  skipped: "건너뜀",
};

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter((child) => child != null));
  return node;
}

/** "2026102106" -> "10월 21일 06시 (UTC)" */
function runLabel(id) {
  if (!id) return "–";
  if (id === "skip") return "제외";
  return `${Number(id.slice(4, 6))}월 ${Number(id.slice(6, 8))}일 ${id.slice(8)}Z`;
}

const timeFormat = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

function ago(iso) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분 전`;
}

function duration(run) {
  const end = run.status === "completed" ? new Date(run.updatedAt) : new Date();
  const minutes = Math.max(0, Math.round((end.getTime() - new Date(run.createdAt).getTime()) / 60_000));
  return `${minutes}분`;
}

function renderModels(status) {
  $("models").replaceChildren(
    ...status.models.map((model) => {
      const [label, tone] = STATES[model.state] ?? [model.state, "warn"];
      const expected = model.nextRunExpected ? new Date(model.nextRunExpected) : null;
      const late = expected && expected.getTime() < Date.now();
      return el(
        "article",
        { class: "card" },
        el("div", { class: "card-head" }, el("h3", {}, model.title), el("span", { class: `badge ${tone}` }, label)),
        el(
          "dl",
          {},
          el("dt", {}, "배포된 실행"),
          el("dd", {}, runLabel(model.deployed)),
          el("dt", {}, "원본 최신 실행"),
          el("dd", {}, runLabel(model.upstream)),
          el("dt", {}, "다음 실행 예상"),
          el("dd", { class: late ? "late" : "" }, expected ? `${timeFormat.format(expected)}${late ? " (늦어짐)" : ""}` : "–"),
          model.failures ? el("dt", {}, "실패한 시도") : null,
          model.failures ? el("dd", {}, `${model.failures}회 (24시간)`) : null,
        ),
      );
    }),
  );
  $("checked").textContent = `점검 ${timeFormat.format(new Date(status.checked))}`;
  $("plan").textContent = status.dispatch
    ? `다음 점검 때 배포를 시작합니다: ${status.dispatch.reason}`
    : `대기: ${status.wait ?? ""}`;
  $("errors").replaceChildren(...status.errors.map((error) => el("li", {}, error)));
  $("site").href = status.site;
}

function renderRuns(status) {
  $("runs").replaceChildren(
    ...status.runs.map((run) => {
      const key = run.status === "completed" ? run.conclusion : run.status;
      return el(
        "tr",
        {},
        el("td", {}, el("a", { href: run.url, target: "_blank", rel: "noopener" }, run.title)),
        el("td", {}, el("span", { class: `dot ${key}` }), RUN_STATES[key] ?? key),
        el("td", { title: new Date(run.createdAt).toISOString() }, ago(run.createdAt)),
        el("td", {}, duration(run)),
      );
    }),
  );
}

// Only the always-on server (server.js) has an in-process scheduler.
async function loadScheduler() {
  try {
    const response = await fetch("/api/scheduler");
    if (!response.ok) return;
    const s = await response.json();
    const last = s.finishedAt ? `${ago(s.finishedAt)} · ${s.outcome}` : "아직 실행 전";
    const next = s.nextAt ? ` · 다음 ${timeFormat.format(new Date(s.nextAt))}` : "";
    $("scheduler").textContent = `자동 점검(${s.intervalMinutes}분마다): ${s.running ? "점검 중" : last}${next}${s.error ? ` · 오류: ${s.error}` : ""}`;
    $("scheduler").hidden = false;
  } catch {
    // Vercel deployment: no scheduler endpoint.
  }
}

async function load() {
  loadScheduler();
  try {
    const response = await fetch("/api/status");
    const status = await response.json();
    if (!response.ok) throw new Error(status.error ?? response.statusText);
    renderModels(status);
    renderRuns(status);
  } catch (error) {
    $("plan").textContent = `상태를 불러오지 못했습니다: ${error.message}`;
  }
}

function storedToken() {
  try {
    return localStorage.getItem("adminToken") ?? "";
  } catch {
    return "";
  }
}

$("token").value = storedToken();
$("token").addEventListener("change", (event) => {
  try {
    localStorage.setItem("adminToken", event.target.value);
  } catch {
    // Private windows may block storage; the field still works for this visit.
  }
});

for (const button of document.querySelectorAll("button[data-action]")) {
  button.addEventListener("click", async () => {
    const result = $("result");
    result.hidden = false;
    result.textContent = "실행 중…";
    try {
      const response = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${$("token").value}` },
        body: JSON.stringify({ action: button.dataset.action, model: button.dataset.model }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? response.statusText);
      result.textContent = body.dispatched ? `배포 작업을 시작했습니다: ${body.dispatched.reason}` : `시작할 작업이 없습니다: ${body.wait ?? ""}`;
      setTimeout(load, 5000);
    } catch (error) {
      result.textContent = `실패: ${error.message}`;
    }
  });
}

load();
setInterval(load, 60_000);
