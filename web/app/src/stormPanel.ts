// Detail panel for one storm: a time table with class badges, wind and
// pressure, the row nearest the selected time highlighted, and a link to the
// issuing agency's latest warning.

import { categoryKt, type StormRow } from "./storms";
import { windFromKt, windLabel, type Settings } from "./units";

export interface StormDetail {
  title: string;
  subtitle: string;
  rows: StormRow[];
  link?: { label: string; url: string };
  note?: string;
}

const rowTime = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "numeric",
  hour12: true,
});

function utcOffsetLabel(): string {
  const minutes = -new Date().getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const hours = Math.floor(Math.abs(minutes) / 60);
  const rest = Math.abs(minutes) % 60;
  return `UTC${sign}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
}

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export class StormPanel {
  private detail: StormDetail | null = null;
  private time = 0;

  constructor(
    private element: HTMLElement,
    private settings: () => Settings,
    private onSelectTime: (time: number) => void,
  ) {
    element.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (target.closest(".panel-close")) this.close();
      const row = target.closest<HTMLElement>("tr[data-time]");
      if (row) this.onSelectTime(Number(row.dataset.time));
    });
  }

  get isOpen(): boolean {
    return this.detail !== null;
  }

  open(detail: StormDetail, time: number): void {
    this.detail = detail;
    this.time = time;
    this.render();
    this.element.hidden = false;
    this.element.querySelector<HTMLElement>("tr.current")?.scrollIntoView({ block: "nearest" });
  }

  close(): void {
    this.detail = null;
    this.element.hidden = true;
  }

  setTime(time: number): void {
    if (!this.detail) return;
    this.time = time;
    this.render();
  }

  refresh(): void {
    if (this.detail) this.render();
  }

  // Row closest to the selected time.
  private currentIndex(rows: StormRow[]): number {
    let best = -1;
    let distance = Infinity;
    rows.forEach((row, i) => {
      const d = Math.abs(row.time - this.time);
      if (d < distance) [best, distance] = [i, d];
    });
    return distance <= 6 * 3600 * 1000 ? best : -1;
  }

  private render(): void {
    const detail = this.detail!;
    const settings = this.settings();
    const current = this.currentIndex(detail.rows);
    const wind = (kt: number | null) => (kt == null ? "–" : Math.round(windFromKt(kt, settings)).toString());
    const rows = detail.rows
      .map((row, i) => {
        const cat = categoryKt(row.windKt ?? 0);
        const pressure = row.pressure != null ? Math.round(row.pressure) : row.forecast ? "예보" : "–";
        return `<tr data-time="${row.time}" class="${i === current ? "current" : ""}${row.forecast ? " forecast" : ""}"
            style="--row-color:${cat.color}">
          <td>${rowTime.format(row.time)}</td>
          <td><span class="badge" style="background:${cat.color}" title="${cat.label}">${cat.code}</span></td>
          <td class="num">${wind(row.windKt)}</td>
          <td class="num">${pressure}</td>
        </tr>`;
      })
      .join("");
    const focus = detail.rows[current] ?? detail.rows.find((row) => !row.forecast) ?? detail.rows[0];
    const focusCat = focus ? categoryKt(focus.windKt ?? 0) : null;
    this.element.innerHTML = `
      <div class="panel-head">
        <h2>${escape(detail.title)}</h2>
        <button class="panel-close" aria-label="닫기">×</button>
      </div>
      <p class="panel-note">${escape(detail.subtitle)}</p>
      <div class="storm-table-wrap">
        <table class="storm-table">
          <thead>
            <tr><th>날짜·시각<small>${utcOffsetLabel()}</small></th><th>등급</th>
            <th class="num">바람<small>${windLabel(settings)}</small></th><th class="num">기압<small>hPa</small></th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${
        focus && focusCat
          ? `<p class="storm-focus"><span class="badge" style="background:${focusCat.color}">${focusCat.code}</span>
             ${focusCat.label} · 풍속 ${wind(focus.windKt)} ${windLabel(settings)}</p>`
          : ""
      }
      ${detail.note ? `<p class="panel-note">${escape(detail.note)}</p>` : ""}
      ${
        detail.link
          ? `<a class="panel-action" href="${detail.link.url}" target="_blank" rel="noopener">⚠ ${escape(detail.link.label)}</a>`
          : ""
      }`;
  }
}
