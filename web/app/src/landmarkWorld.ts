// Landmark miniatures for the second tier of cities (shown once zoomed in a
// little). Same grid and lighting as landmarks.ts: 120×120, base plate at
// the bottom, darker right side.

import { GRASS, PALM, PAVED, ROCK, SAND, SAVANNA, SNOW, STEPPE, WATER, plate } from "./landmarkParts";

const MUD = plate("#2f5a4a", "#4f8a6e");

const text = (x: number, y: number, size: number, fill: string, value: string) =>
  `<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="900" fill="${fill}">${value}</text>`;

// Suspension bridge across the plate (towers, main cable, hangers, deck).
function suspension(tower: string, shade: string, cable: string, deck: string, deckShade: string): string {
  return (
    `<rect x="40" y="82" width="5" height="16" fill="${shade}"/><rect x="76" y="82" width="5" height="16" fill="${shade}"/>` +
    `<rect x="38" y="40" width="3" height="44" fill="${tower}"/><rect x="44" y="40" width="3" height="44" fill="${shade}"/><rect x="38" y="46" width="9" height="2.5" fill="${tower}"/><rect x="38" y="60" width="9" height="2.5" fill="${tower}"/>` +
    `<rect x="74" y="40" width="3" height="44" fill="${tower}"/><rect x="80" y="40" width="3" height="44" fill="${shade}"/><rect x="74" y="46" width="9" height="2.5" fill="${tower}"/><rect x="74" y="60" width="9" height="2.5" fill="${tower}"/>` +
    `<path d="M22 78V64M30 78V57M36 78V50M50 78V51M55 78V54M60.5 78V55.5M66 78V54M71 78V51M85 78V50M91 78V57M99 78V64" stroke="${cable}" stroke-width="1"/>` +
    `<path d="M14 70Q28 64 42.5 41Q60.5 70 78.5 41Q93 64 106 70" fill="none" stroke="${cable}" stroke-width="1.8"/>` +
    `<rect x="14" y="78" width="92" height="5" rx="1" fill="${deck}"/><rect x="14" y="83" width="92" height="2.5" fill="${deckShade}"/>`
  );
}

// Cable-stayed bridge: two pylons with fanned stays.
function cableStayed(pylon: (x: number) => string, top: number): string {
  const fan = (x: number, ends: number[]) => ends.map((e) => `M${x} ${top + 4}L${e} 78`).join("");
  return (
    `<rect x="10" y="78" width="100" height="4" rx="1" fill="#e6ebf1"/><rect x="10" y="82" width="100" height="2" fill="#8f9bab"/>` +
    `<path d="${fan(43, [16, 23, 30, 37, 50, 56])}${fan(79, [66, 72, 86, 93, 100, 106])}" stroke="#dfe5ec" stroke-width=".8"/>` +
    pylon(43) +
    pylon(79)
  );
}

// Round onion dome on a drum, two-tone.
const onion = (x: number, y: number, light: string, dark: string, drum: string) =>
  `<rect x="${x - 4}" y="${y}" width="8" height="12" fill="${drum}"/>` +
  `<path d="M${x - 7} ${y}Q${x - 8} ${y - 8} ${x} ${y - 14}Q${x + 8} ${y - 8} ${x + 7} ${y}Z" fill="${light}"/>` +
  `<path d="M${x} ${y - 14}Q${x + 8} ${y - 8} ${x + 7} ${y}H${x}Z" fill="${dark}"/><rect x="${x - 0.6}" y="${y - 19}" width="1.2" height="5" fill="#e3b341"/>`;

// A pointed tower (minaret, spire) of width w from y0 down to the base.
const spire = (x: number, w: number, y0: number, color: string, cap: string) =>
  `<rect x="${x - w / 2}" y="${y0}" width="${w}" height="${96 - y0}" fill="${color}"/><path d="M${x - w / 2 - 0.5} ${y0}L${x} ${y0 - w * 2}L${x + w / 2 + 0.5} ${y0}Z" fill="${cap}"/>`;

export const WORLD_ICONS: Record<string, [string, string]> = {
  // --- North America -------------------------------------------------------
  로스앤젤레스: [
    "할리우드 사인",
    GRASS +
      `<path d="M18 98Q36 56 64 54Q88 56 102 98Z" fill="#8a9a5b"/><path d="M64 54Q88 56 102 98H64Z" fill="#6f7f46"/>` +
      `<path d="M26 82h68" stroke="#5f6d3b" stroke-width="1"/>` +
      text(60, 79, 11, "#ffffff", "HOLLYWOOD"),
  ],
  샌프란시스코: ["금문교", WATER + suspension("#d64a2f", "#a8361f", "#d64a2f", "#c8442b", "#8e2d1c")],
  시애틀: [
    "스페이스 니들",
    GRASS +
      `<path d="M44 96Q54 74 57 50M76 96Q66 74 63 50" stroke="#eef1f5" stroke-width="3" fill="none"/>` +
      `<rect x="58" y="48" width="4" height="48" fill="#dfe4ea"/><rect x="60" y="48" width="2" height="48" fill="#b9c1cb"/>` +
      `<path d="M50 72h20" stroke="#dfe4ea" stroke-width="2"/>` +
      `<ellipse cx="60" cy="46" rx="20" ry="4" fill="#e9edf2"/><ellipse cx="60" cy="47" rx="18" ry="2" fill="#4f86bd"/>` +
      `<path d="M44 44Q60 32 76 44Z" fill="#f0a14a"/><path d="M60 37Q70 38 76 44H60Z" fill="#d1832f"/>` +
      `<rect x="59" y="14" width="2" height="24" fill="#f4f6f9"/>`,
  ],
  라스베이거스: [
    "환영 간판",
    SAND +
      `<rect x="50" y="70" width="3" height="26" fill="#dfe5ec"/><rect x="67" y="70" width="3" height="26" fill="#b9c1cb"/>` +
      `<path d="M20 54L60 34L100 54L60 74Z" fill="#f7f3e8" stroke="#e5484d" stroke-width="2"/>` +
      text(60, 50, 6, "#2b6cb0", "WELCOME") +
      text(60, 61, 8.5, "#e5484d", "LAS VEGAS") +
      `<path d="M60 24l2 5h5l-4 3l1.5 5l-4.5-3l-4.5 3l1.5-5l-4-3h5Z" fill="#ffd166"/>`,
  ],
  샌디에이고: [
    "범선",
    WATER +
      `<path d="M28 84H92L86 94H34Z" fill="#3b2a20"/><path d="M60 84H92L86 94H60Z" fill="#2a1d16"/>` +
      `<path d="M44 84V36M60 84V30M76 84V38" stroke="#5f3920" stroke-width="2"/>` +
      [44, 60, 76]
        .map(
          (x) =>
            `<path d="M${x - 9} 46H${x + 9}L${x + 8} 56H${x - 8}Z" fill="#f4f1ea"/><path d="M${x - 8} 58H${x + 8}L${x + 7} 68H${x - 7}Z" fill="#f4f1ea"/><path d="M${x - 7} 70H${x + 7}L${x + 6} 80H${x - 6}Z" fill="#e3ddd0"/>`,
        )
        .join("") +
      `<path d="M60 30l8 3l-8 3Z" fill="#e5484d"/>`,
  ],
  시카고: [
    "윌리스 타워",
    PAVED +
      `<rect x="44" y="62" width="8" height="34" fill="#2f343b"/><rect x="52" y="40" width="8" height="56" fill="#363b43"/>` +
      `<rect x="60" y="30" width="8" height="66" fill="#23272d"/><rect x="68" y="52" width="8" height="44" fill="#1d2025"/>` +
      `<path d="M44 70h8M44 80h8M52 50h8M52 60h8M52 70h8M52 80h8M60 40h8M60 50h8M60 60h8M60 70h8M60 80h8M68 62h8M68 72h8M68 82h8" stroke="#55606e" stroke-width=".8"/>` +
      `<rect x="61" y="12" width="1.6" height="18" fill="#e9edf2"/><rect x="65.5" y="16" width="1.6" height="14" fill="#c5ccd5"/>`,
  ],
  휴스턴: [
    "우주 로켓",
    PAVED +
      `<rect x="36" y="30" width="6" height="66" fill="#d64a2f"/><path d="M36 40h6M36 52h6M36 64h6M36 76h6M36 88h6M36 34l6 6M36 46l6 6M36 58l6 6M36 70l6 6" stroke="#8e2d1c" stroke-width=".8"/>` +
      `<path d="M42 44h12M42 66h12" stroke="#a8361f" stroke-width="1.5"/>` +
      `<rect x="54" y="28" width="12" height="62" fill="#f4f6f9"/><rect x="60" y="28" width="6" height="62" fill="#cfd6de"/>` +
      `<path d="M54 28L60 12L66 28Z" fill="#e9edf2"/><path d="M60 12L66 28H60Z" fill="#c5ccd5"/>` +
      `<rect x="54" y="40" width="12" height="4" fill="#2b2f36"/><rect x="54" y="62" width="12" height="6" fill="#2b2f36"/>` +
      `<path d="M54 80L48 94H54ZM66 80L72 94H66Z" fill="#2b2f36"/><rect x="52" y="92" width="16" height="4" fill="#8f9bab"/>`,
  ],
  댈러스: [
    "리유니언 타워",
    GRASS +
      `<rect x="56" y="42" width="8" height="54" fill="#d9dde3"/><rect x="60" y="42" width="4" height="54" fill="#b0b8c2"/>` +
      `<circle cx="60" cy="32" r="15" fill="#f3e7c9"/><path d="M60 17a15 15 0 0 1 0 30Z" fill="#dccb9f"/>` +
      `<g fill="none" stroke="#c9a24a" stroke-width=".9"><ellipse cx="60" cy="32" rx="15" ry="5"/><ellipse cx="60" cy="32" rx="15" ry="10"/><ellipse cx="60" cy="32" rx="5" ry="15"/><ellipse cx="60" cy="32" rx="10" ry="15"/></g>` +
      `<rect x="52" y="46" width="16" height="3" rx="1.5" fill="#c5ccd5"/>`,
  ],
  뉴올리언스: [
    "증기선",
    WATER +
      `<rect x="22" y="82" width="70" height="9" fill="#f4f1ea"/><rect x="22" y="86" width="70" height="2" fill="#c0392b"/>` +
      `<rect x="28" y="70" width="58" height="12" fill="#fbf8f2"/><rect x="36" y="60" width="44" height="10" fill="#fbf8f2"/><rect x="52" y="50" width="14" height="10" fill="#f4f1ea"/>` +
      `<path d="M30 74h54M38 64h40" stroke="#c0392b" stroke-width="1.2" stroke-dasharray="2 2"/>` +
      `<rect x="32" y="34" width="5" height="36" fill="#1f2328"/><rect x="40" y="34" width="5" height="36" fill="#1f2328"/><path d="M31 34h7M39 34h7" stroke="#e3b341" stroke-width="2"/>` +
      `<rect x="86" y="66" width="12" height="22" rx="2" fill="#c0392b"/><path d="M92 66v22M86 77h12M87 70l10 14M97 70l-10 14" stroke="#8e2924" stroke-width="1"/>`,
  ],
  "워싱턴 D.C.": [
    "국회의사당",
    PAVED +
      `<rect x="20" y="74" width="80" height="20" fill="#f4f1ea"/><rect x="60" y="74" width="40" height="20" fill="#d6d2c8"/>` +
      `<path d="M26 78v14M32 78v14M38 78v14M82 78v14M88 78v14M94 78v14" stroke="#bdb6a8" stroke-width="1.5"/>` +
      `<path d="M48 74L60 66L72 74Z" fill="#e9e4d8"/>` +
      `<rect x="45" y="52" width="30" height="22" fill="#f4f1ea"/><rect x="60" y="52" width="15" height="22" fill="#d6d2c8"/>` +
      `<path d="M49 56v16M54 56v16M66 56v16M71 56v16" stroke="#bdb6a8" stroke-width="1.5"/>` +
      `<path d="M43 52Q43 30 60 30Q77 30 77 52Z" fill="#f6f4ef"/><path d="M60 30Q77 30 77 52H60Z" fill="#d8d3c8"/>` +
      `<rect x="57" y="22" width="6" height="9" fill="#f6f4ef"/><rect x="59" y="16" width="2" height="6" fill="#bdb6a8"/>`,
  ],
  보스턴: [
    "등대",
    ROCK +
      `<rect x="28" y="82" width="16" height="12" fill="#f4f1ea"/><path d="M26 82L36 74L46 82Z" fill="#c0392b"/>` +
      `<path d="M50 94L54 38H66L70 94Z" fill="#b5523b"/><path d="M60 38H66L70 94H60Z" fill="#8f3d2b"/>` +
      `<path d="M52 50h16M51.5 62h17M51 74h18M50.5 86h19" stroke="#8a3a29" stroke-width=".8"/>` +
      `<rect x="50" y="34" width="20" height="4" fill="#2b2f36"/><rect x="54" y="24" width="12" height="10" fill="#ffd166"/>` +
      `<path d="M57 24v10M63 24v10" stroke="#2b2f36" stroke-width="1"/><path d="M53 24Q60 16 67 24Z" fill="#2b2f36"/>`,
  ],
  올랜도: [
    "대관람차",
    GRASS +
      `<path d="M44 96L60 52L76 96" stroke="#9aa3ae" stroke-width="3" fill="none"/>` +
      `<circle cx="60" cy="52" r="30" fill="none" stroke="#e9edf2" stroke-width="2.5"/>` +
      `<path d="M60 22v60M30 52h60M38.8 30.8l42.4 42.4M81.2 30.8L38.8 73.2" stroke="#c5ccd5" stroke-width="1"/>` +
      [
        [60, 22, "#e5484d"],
        [81.2, 30.8, "#ffd166"],
        [90, 52, "#06d6a0"],
        [81.2, 73.2, "#7fb3ff"],
        [60, 82, "#ff8fab"],
        [38.8, 73.2, "#ffd166"],
        [30, 52, "#06d6a0"],
        [38.8, 30.8, "#7fb3ff"],
      ]
        .map(([x, y, c]) => `<rect x="${Number(x) - 3.5}" y="${Number(y) - 1}" width="7" height="6" rx="1.5" fill="${c}"/>`)
        .join("") +
      `<circle cx="60" cy="52" r="3" fill="#9aa3ae"/>`,
  ],
  앵커리지: [
    "오로라와 설산",
    SNOW +
      `<path d="M14 40Q40 18 60 32Q80 46 106 22" stroke="#4be3a5" stroke-width="7" fill="none" opacity=".75" stroke-linecap="round"/>` +
      `<path d="M18 52Q44 34 62 44Q82 54 104 36" stroke="#7a7bff" stroke-width="4" fill="none" opacity=".55" stroke-linecap="round"/>` +
      `<path d="M18 98L44 56L60 74L76 50L102 98Z" fill="#6b7c93"/><path d="M76 50L102 98H76Z" fill="#55657a"/>` +
      `<path d="M44 56L37 68L44 65L50 68Z" fill="#f4f8fb"/><path d="M76 50L68 63L76 60L84 64Z" fill="#f4f8fb"/>` +
      `<circle cx="30" cy="22" r="1" fill="#fff"/><circle cx="92" cy="14" r="1" fill="#fff"/>`,
  ],
  밴쿠버: [
    "캐나다 플레이스",
    WATER +
      `<rect x="22" y="76" width="76" height="14" fill="#e3e8ee"/><rect x="60" y="76" width="38" height="14" fill="#b8c2cd"/>` +
      `<path d="M26 82h68" stroke="#8ea3b8" stroke-width="1"/>` +
      [
        [26, 36, 46],
        [40, 50, 60],
        [54, 64, 74],
        [68, 78, 88],
        [82, 90, 98],
      ]
        .map(([a, p, b], i) => `<path d="M${a} 76L${p} ${54 - (i === 2 ? 4 : i % 2 ? 2 : 0)}L${b} 76Z" fill="#ffffff"/><path d="M${p} ${54 - (i === 2 ? 4 : i % 2 ? 2 : 0)}L${b} 76H${p}Z" fill="#d7dde4"/>`)
        .join(""),
  ],
  토론토: [
    "CN 타워",
    GRASS +
      `<path d="M54 96L58 40H62L66 96Z" fill="#c9ced6"/><path d="M60 40H62L66 96H60Z" fill="#a3abb6"/>` +
      `<path d="M50 96L56 70M70 96L64 70" stroke="#b7bec8" stroke-width="2"/>` +
      `<ellipse cx="60" cy="44" rx="11" ry="5" fill="#e3e7ec"/><rect x="49" y="42" width="22" height="3" fill="#3a4048"/><ellipse cx="60" cy="49" rx="9" ry="2.5" fill="#c9ced6"/>` +
      `<ellipse cx="60" cy="30" rx="3.5" ry="2" fill="#e3e7ec"/>` +
      `<path d="M59 40V6h2v34Z" fill="#e9edf2"/><path d="M59 14h2M59 22h2" stroke="#e5484d" stroke-width="2"/>`,
  ],
  멕시코시티: [
    "독립기념탑",
    PAVED +
      `<rect x="46" y="82" width="28" height="12" fill="#d8d2c4"/><rect x="60" y="82" width="14" height="12" fill="#b9b2a2"/>` +
      `<rect x="56" y="34" width="8" height="48" fill="#e8e3d6"/><rect x="60" y="34" width="4" height="48" fill="#c9c2b2"/>` +
      `<path d="M56 46h8M56 58h8M56 70h8" stroke="#bdb6a8" stroke-width="1.5"/><rect x="54" y="30" width="12" height="5" fill="#d8d2c4"/>` +
      `<path d="M60 16l-9-6l4 10Z" fill="#e3b341"/><path d="M60 16l9-6l-4 10Z" fill="#c99a2e"/><ellipse cx="60" cy="22" rx="3" ry="7" fill="#e3b341"/>` +
      `<circle cx="60" cy="14" r="2" fill="#e3b341"/><circle cx="64" cy="11" r="1.8" fill="none" stroke="#e3b341" stroke-width="1"/>`,
  ],
  칸쿤: [
    "마야 피라미드",
    SAND +
      `<path d="M26 96H94V86H88V76H82V66H76V58H44V66H38V76H32V86H26Z" fill="#c7b48e"/><path d="M60 58H76V66H82V76H88V86H94V96H60Z" fill="#a8956f"/>` +
      `<path d="M26 86H94M32 76H88M38 66H82" stroke="#9a8865" stroke-width=".8"/>` +
      `<rect x="55" y="58" width="10" height="38" fill="#d8c8a4"/><path d="M55 64h10M55 70h10M55 76h10M55 82h10M55 88h10" stroke="#a8956f" stroke-width=".8"/>` +
      `<rect x="48" y="46" width="24" height="12" fill="#c7b48e"/><rect x="60" y="46" width="12" height="12" fill="#a8956f"/><rect x="57" y="50" width="6" height="8" fill="#4a3a26"/>` +
      `<rect x="46" y="44" width="28" height="3" fill="#b8a47c"/>`,
  ],

  // --- Latin America -------------------------------------------------------
  아바나: [
    "클래식카",
    PAVED +
      `<path d="M22 80Q24 70 38 68L48 58H74L84 68Q98 70 100 80V86H22Z" fill="#3cc9b9"/><path d="M60 58H74L84 68Q98 70 100 80V86H60Z" fill="#2ea99b"/>` +
      `<path d="M50 60H60V68H45ZM62 60H72L80 68H62Z" fill="#274c77"/>` +
      `<rect x="20" y="82" width="82" height="3" rx="1.5" fill="#dfe5ec"/><path d="M94 70l8-4v6Z" fill="#2ea99b"/>` +
      `<circle cx="38" cy="86" r="7" fill="#1d1f23"/><circle cx="38" cy="86" r="4" fill="#f4f6f9"/><circle cx="38" cy="86" r="2" fill="#9aa3ae"/>` +
      `<circle cx="84" cy="86" r="7" fill="#1d1f23"/><circle cx="84" cy="86" r="4" fill="#f4f6f9"/><circle cx="84" cy="86" r="2" fill="#9aa3ae"/>` +
      `<circle cx="99" cy="76" r="2" fill="#ffd166"/>`,
  ],
  리우데자네이루: [
    "구세주 그리스도상",
    GRASS +
      `<path d="M20 98Q46 52 60 48Q74 52 100 98Z" fill="#4e7d47"/><path d="M60 48Q74 52 100 98H60Z" fill="#3f6a3a"/>` +
      `<rect x="55" y="46" width="10" height="5" fill="#9aa3ae"/>` +
      `<path d="M56 47L58.5 30H61.5L64 47Z" fill="#f4f6f9"/><path d="M60 30H61.5L64 47H60Z" fill="#cfd6de"/>` +
      `<rect x="44" y="27" width="32" height="3.5" rx="1.5" fill="#f4f6f9"/><rect x="60" y="27" width="16" height="3.5" fill="#cfd6de"/>` +
      `<circle cx="60" cy="23" r="3" fill="#f4f6f9"/>`,
  ],
  상파울루: [
    "대성당",
    PAVED +
      `<rect x="40" y="58" width="40" height="36" fill="#c9c2b2"/><rect x="60" y="58" width="20" height="36" fill="#a8a090"/>` +
      `<path d="M55 94V80q5-8 10 0V94Z" fill="#4a3f33"/><circle cx="60" cy="68" r="5" fill="#7a5a8a"/><circle cx="60" cy="68" r="2" fill="#c9a24a"/>` +
      `<path d="M50 58Q50 40 60 40Q70 40 70 58Z" fill="#3f9a80"/><path d="M60 40Q70 40 70 58H60Z" fill="#2f7a65"/><rect x="59" y="32" width="2" height="8" fill="#c9a24a"/>` +
      spire(38, 8, 36, "#c9c2b2", "#3f9a80") +
      spire(82, 8, 36, "#a8a090", "#2f7a65"),
  ],
  리마: [
    "라마 (페루 상징)",
    GRASS +
      `<path d="M14 92L34 62L48 80L66 56L90 92Z" fill="#7c8aa0" opacity=".6"/><path d="M66 56L60 64L66 62L72 64Z" fill="#f4f8fb" opacity=".8"/>` +
      `<ellipse cx="64" cy="74" rx="17" ry="9" fill="#f2e6d4"/><path d="M64 65a17 9 0 0 1 0 18Z" fill="#d9ccb8"/>` +
      `<rect x="55" y="66" width="18" height="6" fill="#e5484d"/><rect x="55" y="68" width="18" height="2" fill="#ffd166"/>` +
      `<path d="M50 80v14M56 81v13M72 81v13M78 79v15" stroke="#d9ccb8" stroke-width="3.5" stroke-linecap="round"/>` +
      `<rect x="44" y="44" width="9" height="30" rx="4.5" fill="#f2e6d4"/>` +
      `<ellipse cx="45" cy="44" rx="8" ry="5" fill="#f2e6d4"/><circle cx="43" cy="43" r="1.2" fill="#2b2b2b"/>` +
      `<path d="M47 39l1-6l2 6ZM51 40l2-6l1 6Z" fill="#d9ccb8"/><circle cx="49" cy="33" r="1.6" fill="#ff5d8f"/><circle cx="53" cy="34" r="1.6" fill="#ffd166"/>`,
  ],
  부에노스아이레스: [
    "오벨리스크",
    PAVED +
      `<circle cx="34" cy="86" r="7" fill="#3f8f4f"/><circle cx="86" cy="86" r="7" fill="#357a43"/>` +
      `<rect x="46" y="92" width="28" height="4" fill="#d6d2c8"/>` +
      `<path d="M54 93L56.5 24H63.5L66 93Z" fill="#f4f1ea"/><path d="M60 24H63.5L66 93H60Z" fill="#d6d2c8"/>` +
      `<path d="M56.5 24L60 15L63.5 24Z" fill="#e9e4d8"/><rect x="58.5" y="28" width="3" height="4" fill="#4a3f33"/>`,
  ],

  // --- Oceania -------------------------------------------------------------
  멜버른: [
    "플린더스 스트리트역",
    PAVED +
      `<rect x="22" y="64" width="76" height="30" fill="#f2c14e"/><rect x="60" y="64" width="38" height="30" fill="#d4a63a"/>` +
      `<path d="M26 74q3-5 6 0v12h-6ZM38 74q3-5 6 0v12h-6ZM76 74q3-5 6 0v12h-6ZM88 74q3-5 6 0v12h-6Z" fill="#7a4a2a"/>` +
      `<path d="M52 94V76q8-10 16 0V94Z" fill="#7a4a2a"/><g fill="#f4f1ea"><circle cx="54" cy="70" r="1.6"/><circle cx="58" cy="70" r="1.6"/><circle cx="62" cy="70" r="1.6"/><circle cx="66" cy="70" r="1.6"/></g>` +
      `<path d="M28 64Q28 46 40 46Q52 46 52 64Z" fill="#5aa58b"/><path d="M40 46Q52 46 52 64H40Z" fill="#478a72"/><rect x="39" y="38" width="2" height="8" fill="#5aa58b"/>` +
      `<rect x="82" y="46" width="12" height="18" fill="#f2c14e"/><rect x="88" y="46" width="6" height="18" fill="#d4a63a"/><circle cx="88" cy="52" r="3" fill="#f4f1ea"/><path d="M80 46L88 38L96 46Z" fill="#5aa58b"/>`,
  ],
  브리즈번: [
    "스토리 브리지",
    WATER +
      `<rect x="38" y="78" width="5" height="20" fill="#7d8ea3"/><rect x="77" y="78" width="5" height="20" fill="#7d8ea3"/>` +
      `<rect x="12" y="74" width="96" height="4" fill="#9fb0c4"/><rect x="12" y="78" width="96" height="2" fill="#6f8099"/>` +
      `<path d="M12 74L40 46L60 64L80 46L108 74" stroke="#5f7894" stroke-width="3" fill="none" stroke-linejoin="round"/>` +
      `<path d="M20 74L26 60L32 74L36 53L40 74M40 46V74M44 74L48 52L52 74L56 60L60 74M64 74L68 60L72 74L76 52L80 74M80 46V74M84 74L88 53L92 74L98 62L104 74" stroke="#5f7894" stroke-width="1.2" fill="none"/>`,
  ],
  골드코스트: [
    "서퍼스 파라다이스",
    SAND +
      `<rect x="28" y="44" width="10" height="50" fill="#dfe8f0"/><rect x="40" y="22" width="12" height="72" fill="#eef3f8"/><rect x="46" y="22" width="6" height="72" fill="#c3d0dd"/><rect x="45.2" y="10" width="1.6" height="12" fill="#c3d0dd"/>` +
      `<rect x="54" y="48" width="10" height="46" fill="#cfdbe6"/><rect x="66" y="34" width="12" height="60" fill="#e6eef5"/><rect x="72" y="34" width="6" height="60" fill="#b7c6d5"/><rect x="80" y="54" width="9" height="40" fill="#d5e0ea"/>` +
      `<path d="M40 30h12M40 40h12M40 50h12M40 60h12M40 70h12M66 44h12M66 54h12M66 64h12M66 74h12" stroke="#7fb3dd" stroke-width="1"/>` +
      `<ellipse cx="90" cy="84" rx="5" ry="15" fill="#ffd166" transform="rotate(12 90 84)"/><path d="M89 70l3 28" stroke="#e5484d" stroke-width="2" transform="rotate(12 90 84)"/>`,
  ],
  케언스: [
    "산호초와 바다거북",
    WATER +
      `<path d="M22 96q-2-12 4-16q2 6 0 10q6-10 10-6q-4 4-6 12Z" fill="#ff8a65"/><path d="M90 96q-4-10 2-16q2 6 0 8q8-8 10-4q-6 4-8 12Z" fill="#f06292"/>` +
      `<path d="M78 70q12-10 18-4q-8 2-16 10Z" fill="#6d9f5a"/><path d="M42 70q-12-10-18-4q8 2 16 10Z" fill="#6d9f5a"/>` +
      `<path d="M50 86q-8 8-14 8q6-6 10-12Z" fill="#6d9f5a"/><path d="M70 86q8 8 14 8q-6-6-10-12Z" fill="#5a8a48"/>` +
      `<ellipse cx="60" cy="74" rx="20" ry="14" fill="#5f8f4e"/><path d="M60 60a20 14 0 0 1 0 28Z" fill="#4c7740"/>` +
      `<path d="M52 66l8-4l8 4v10l-8 4l-8-4ZM44 72l8-6M68 66l8 6M44 78l8 2M68 80l8-2" stroke="#8fbf6a" stroke-width="1.2" fill="none"/>` +
      `<ellipse cx="60" cy="54" rx="6" ry="7" fill="#6d9f5a"/><circle cx="57.5" cy="52" r="1.2" fill="#1d1f23"/><circle cx="62.5" cy="52" r="1.2" fill="#1d1f23"/>`,
  ],
  다윈: [
    "악어",
    MUD +
      `<path d="M14 84Q24 80 40 78L74 76Q88 74 98 72L106 76Q98 80 90 82L102 84Q96 88 84 86L40 88Q24 88 14 84Z" fill="#4b6b3a"/>` +
      `<path d="M40 88L74 86L84 86Q96 88 102 84H40Z" fill="#3c5630"/>` +
      `<path d="M36 78l3-5l3 5M46 77l3-5l3 5M56 77l3-5l3 5M66 76l3-5l3 5" fill="#3c5630"/>` +
      `<path d="M90 82l2 2l2-2l2 2l2-2M92 76l2-2l2 2l2-2" stroke="#f4f1ea" stroke-width="1.2" fill="none"/>` +
      `<circle cx="84" cy="73" r="3" fill="#4b6b3a"/><circle cx="84" cy="73" r="1.6" fill="#ffd166"/><circle cx="84.4" cy="73" r=".7" fill="#1d1f23"/>` +
      `<path d="M44 88l-2 6M54 88l2 6M70 87l-2 6M78 87l2 6" stroke="#3c5630" stroke-width="3" stroke-linecap="round"/>`,
  ],
  퍼스: [
    "블랙 스완",
    WATER +
      `<path d="M36 80Q38 68 58 68Q78 68 86 76Q78 86 56 86Q40 86 36 80Z" fill="#1d1f23"/>` +
      `<path d="M54 72Q66 66 80 74Q70 76 58 76Z" fill="#3a3f46"/><path d="M60 74q6-2 12 1M62 78q6-2 12 1" stroke="#555b63" stroke-width="1" fill="none"/>` +
      `<path d="M44 74Q36 52 46 42Q52 36 58 42" stroke="#1d1f23" stroke-width="5.5" fill="none" stroke-linecap="round"/>` +
      `<circle cx="57" cy="43" r="4" fill="#1d1f23"/><path d="M60 42L70 45L60 47Z" fill="#e5484d"/><circle cx="57" cy="42" r=".9" fill="#fff"/>` +
      `<path d="M38 90q20 4 44 0" stroke="#8cc4f0" stroke-width="1.5" fill="none"/>`,
  ],
  애들레이드: [
    "포도밭과 와인",
    GRASS +
      `<path d="M24 94q8-4 16 0M44 94q8-4 16 0M24 86q8-4 16 0M44 86q8-4 16 0" stroke="#3f7a3a" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      `<path d="M78 96V56Q78 48 82 44V30H88V44Q92 48 92 56V96Z" fill="#2f5a3a"/><path d="M85 30H88V44Q92 48 92 56V96H85Z" fill="#244a2f"/>` +
      `<rect x="80" y="62" width="12" height="16" fill="#f4f1ea"/><rect x="82" y="28" width="6" height="4" fill="#8e2924"/>` +
      `<path d="M58 44q8-6 14 0q-6 4-14 0Z" fill="#5aa04a"/><path d="M62 44v4" stroke="#6b4a2a" stroke-width="1.5"/>` +
      `<g fill="#7b3f8f"><circle cx="56" cy="52" r="3.5"/><circle cx="63" cy="52" r="3.5"/><circle cx="70" cy="52" r="3.5"/><circle cx="59.5" cy="58" r="3.5"/><circle cx="66.5" cy="58" r="3.5"/><circle cx="63" cy="64" r="3.5"/></g>` +
      `<g fill="#9b5bb0"><circle cx="55" cy="51" r="1.2"/><circle cx="62" cy="51" r="1.2"/><circle cx="58.5" cy="57" r="1.2"/></g>`,
  ],
  오클랜드: [
    "스카이 타워",
    WATER +
      `<rect x="44" y="84" width="32" height="10" fill="#c9d1db"/>` +
      `<path d="M56 88L57.5 40H62.5L64 88Z" fill="#d9dde3"/><path d="M60 40H62.5L64 88H60Z" fill="#b7bec8"/>` +
      `<path d="M52 44L54 36H66L68 44Z" fill="#e3e7ec"/><rect x="52" y="30" width="16" height="7" rx="2" fill="#e3e7ec"/><rect x="52" y="32.5" width="16" height="2.5" fill="#4f86bd"/>` +
      `<rect x="60" y="30" width="8" height="7" fill="#c9ced6" opacity=".6"/>` +
      `<rect x="58" y="16" width="4" height="14" fill="#d9dde3"/><rect x="59.3" y="4" width="1.4" height="12" fill="#e9edf2"/>`,
  ],

  // --- Europe --------------------------------------------------------------
  파리: [
    "에펠탑",
    GRASS +
      `<path d="M28 94Q44 70 53 42L56.5 18H63.5L67 42Q76 70 92 94H80Q68 78 60 78Q52 78 40 94Z" fill="#8a6a48"/>` +
      `<path d="M60 18H63.5L67 42Q76 70 92 94H80Q68 78 60 78Z" fill="#6e5236"/>` +
      `<path d="M40 86L60 70L80 86M46 60L60 50L74 60M52 34L60 28L68 34" stroke="#5a4229" stroke-width=".8" fill="none"/>` +
      `<rect x="40" y="62" width="40" height="4" fill="#9c7b55"/><rect x="50" y="40" width="20" height="3" fill="#9c7b55"/>` +
      `<rect x="59" y="6" width="2" height="12" fill="#8a6a48"/>`,
  ],
  로마: [
    "콜로세움",
    PAVED +
      `<path d="M18 92V58Q60 46 102 58V80L96 76V92Q60 100 18 92Z" fill="#d9c3a0"/><path d="M60 52Q82 52 102 58V80L96 76V92Q80 96 60 96Z" fill="#bba27b"/>` +
      `<ellipse cx="60" cy="56" rx="38" ry="5" fill="#8a7558"/>` +
      [64, 75, 86]
        .map((y) =>
          [24, 33, 42, 51, 60, 69, 78, 87]
            .map((x) => `<rect x="${x}" y="${y + Math.abs(x - 58) / 12}" width="5" height="7" rx="2.5" fill="#6b553a"/>`)
            .join(""),
        )
        .join("") +
      `<path d="M18 70Q60 60 102 70M18 81Q60 72 102 81" stroke="#c4ab84" stroke-width="1" fill="none"/>`,
  ],
  베를린: [
    "브란덴부르크 문",
    PAVED +
      `<rect x="24" y="88" width="72" height="6" fill="#d8cfbd"/>` +
      [29, 40, 51, 64, 75, 86].map((x) => `<rect x="${x}" y="58" width="5" height="30" fill="${x < 60 ? "#e5dccb" : "#c7bda9"}"/>`).join("") +
      `<rect x="24" y="50" width="72" height="9" fill="#e5dccb"/><rect x="60" y="50" width="36" height="9" fill="#c7bda9"/>` +
      `<rect x="40" y="42" width="40" height="8" fill="#e5dccb"/><rect x="60" y="42" width="20" height="8" fill="#c7bda9"/>` +
      `<path d="M48 42l2-8h4l2-4l3 4h4l2-4l3 4h4l2 8Z" fill="#5f8f7a"/><path d="M60 22v12" stroke="#5f8f7a" stroke-width="1.5"/><circle cx="60" cy="22" r="2" fill="#5f8f7a"/>`,
  ],
  바르셀로나: [
    "사그라다 파밀리아",
    PAVED +
      `<rect x="28" y="70" width="64" height="24" fill="#c8b48a"/><rect x="60" y="70" width="32" height="24" fill="#a8956c"/>` +
      `<path d="M52 94V80q8-10 16 0V94Z" fill="#5a4a33"/>` +
      [
        [32, 40],
        [44, 26],
        [56, 12],
        [68, 18],
        [80, 34],
      ]
        .map(
          ([x, top]) =>
            `<path d="M${x} 72L${x + 1.5} ${top + 8}Q${x + 4} ${top} ${x + 6.5} ${top + 8}L${x + 8} 72Z" fill="${x < 56 ? "#d4c098" : "#b3a079"}"/>` +
            `<path d="M${x + 4} ${top + 14}v4M${x + 4} ${top + 24}v4M${x + 4} ${top + 34}v4" stroke="#6b5a3e" stroke-width="1.2"/>` +
            `<circle cx="${x + 4}" cy="${top}" r="2" fill="${x % 3 ? "#e5484d" : "#ffd166"}"/>`,
        )
        .join(""),
  ],
  암스테르담: [
    "풍차",
    GRASS +
      `<g fill="#e5484d"><circle cx="28" cy="96" r="2"/><circle cx="34" cy="99" r="2"/><circle cx="90" cy="96" r="2"/></g><g fill="#ffd166"><circle cx="32" cy="94" r="2"/><circle cx="86" cy="99" r="2"/></g>` +
      `<path d="M48 96L52 54H68L72 96Z" fill="#5a6b4a"/><path d="M60 54H68L72 96H60Z" fill="#46553a"/>` +
      `<rect x="56" y="82" width="8" height="14" rx="4" fill="#3a2a1c"/><rect x="54" y="66" width="5" height="6" fill="#f4f1ea"/>` +
      `<path d="M49 56Q60 40 71 56Z" fill="#3f4a3a"/>` +
      `<g transform="rotate(20 60 48)"><rect x="58.5" y="14" width="3" height="68" fill="#e9e4d8"/><rect x="26" y="46.5" width="68" height="3" fill="#e9e4d8"/>` +
      `<path d="M61.5 16h8v28h-8ZM26 49.5h28v8H26ZM50.5 52h8v28h-8ZM66 38.5h28v8H66Z" fill="#f4f1ea" opacity=".85"/>` +
      `<path d="M61.5 24h8M61.5 32h8M34 49.5v8M42 49.5v8M50.5 64h8M50.5 72h8M78 38.5v8M86 38.5v8" stroke="#bdb6a8" stroke-width=".8"/></g>` +
      `<circle cx="60" cy="48" r="3" fill="#3a2a1c"/>`,
  ],
  모스크바: [
    "성 바실리 대성당",
    PAVED +
      `<rect x="28" y="72" width="64" height="22" fill="#c0392b"/><rect x="60" y="72" width="32" height="22" fill="#9c2e23"/>` +
      `<path d="M28 76h64M28 86h64" stroke="#f4f1ea" stroke-width="1"/><path d="M54 94V84q6-6 12 0V94Z" fill="#4a1611"/>` +
      `<rect x="55" y="38" width="10" height="34" fill="#d9a066"/><path d="M54 38L60 14L66 38Z" fill="#3f9a80"/><path d="M60 14L66 38H60Z" fill="#2f7a65"/>` +
      onion(38, 56, "#e5484d", "#f4f1ea", "#d9a066") +
      onion(82, 56, "#3f9a80", "#ffd166", "#d9a066") +
      onion(48, 62, "#4f86bd", "#f4f1ea", "#c0392b") +
      onion(72, 62, "#ff8a3d", "#3f9a80", "#c0392b"),
  ],
  이스탄불: [
    "아야 소피아",
    PAVED +
      `<rect x="34" y="64" width="52" height="30" fill="#d9a77a"/><rect x="60" y="64" width="26" height="30" fill="#bb8a5d"/>` +
      `<path d="M38 68h44" stroke="#c4936a" stroke-width="1"/><path d="M54 94V82q6-6 12 0V94Z" fill="#5a3f2a"/>` +
      `<path d="M34 66Q34 56 44 56Q50 56 52 64ZM86 66Q86 56 76 56Q70 56 68 64Z" fill="#8e9aa6"/>` +
      `<path d="M40 64Q40 40 60 40Q80 40 80 64Z" fill="#8e9aa6"/><path d="M60 40Q80 40 80 64H60Z" fill="#717d89"/>` +
      `<path d="M44 56h32" stroke="#6a7682" stroke-width="1"/><rect x="59" y="32" width="2" height="8" fill="#e3b341"/>` +
      spire(26, 4, 34, "#e9ddcb", "#8e9aa6") +
      spire(94, 4, 34, "#cbbfab", "#717d89") +
      spire(32, 3.5, 44, "#e9ddcb", "#8e9aa6") +
      spire(88, 3.5, 44, "#cbbfab", "#717d89"),
  ],
  아테네: [
    "파르테논 신전",
    ROCK +
      `<path d="M18 98Q24 82 40 78H82Q96 82 102 98Z" fill="#8a8f84"/><path d="M60 78H82Q96 82 102 98H60Z" fill="#6f7469"/>` +
      `<rect x="24" y="72" width="72" height="6" fill="#efe6d2"/><rect x="60" y="72" width="36" height="6" fill="#d3c8b0"/>` +
      [28, 36, 44, 52, 64, 72, 80, 88]
        .map((x) => `<rect x="${x}" y="${x === 80 ? 58 : 52}" width="4" height="${x === 80 ? 14 : 20}" fill="${x < 60 ? "#f4ecdb" : "#d8ceb6"}"/>`)
        .join("") +
      `<rect x="24" y="46" width="66" height="6" fill="#efe6d2"/><rect x="60" y="46" width="30" height="6" fill="#d3c8b0"/>` +
      `<path d="M24 46L58 36L90 46Z" fill="#e6dcc4"/>`,
  ],

  // --- Middle East and Africa ----------------------------------------------
  두바이: [
    "부르즈 할리파",
    SAND +
      `<path d="M48 96L51 72H53L54.5 52H56.5L57.5 32H58.5L59.4 8H60.6L61.5 32H62.5L63.5 52H65.5L67 72H69L72 96Z" fill="#cfd8e3"/>` +
      `<path d="M60 8H60.6L61.5 32H62.5L63.5 52H65.5L67 72H69L72 96H60Z" fill="#a5b3c4"/>` +
      `<path d="M55 90V76M60 92V40M65 90V76" stroke="#8ea3b8" stroke-width=".8"/>` +
      PALM(26),
  ],
  카이로: [
    "피라미드",
    SAND +
      `<path d="M12 94L34 64L56 94Z" fill="#e2c288"/><path d="M34 64L56 94H34Z" fill="#c4a066"/>` +
      `<path d="M28 94L62 42L96 94Z" fill="#d9b26a"/><path d="M62 42L96 94H62Z" fill="#b88e46"/>` +
      `<path d="M38 80h48M44 70h36M50 60h24M56 50h12" stroke="#c49e58" stroke-width=".8"/>` +
      `<path d="M62 42L58 48H66Z" fill="#f2dca6"/>`,
  ],
  마라케시: [
    "쿠투비아 모스크 첨탑",
    SAND +
      `<rect x="52" y="30" width="16" height="64" fill="#c9845a"/><rect x="60" y="30" width="8" height="64" fill="#a8673f"/>` +
      `<path d="M54 40h4v8h-4zM62 40h4v8h-4zM54 58h4v8h-4zM62 58h4v8h-4zM54 76h4v8h-4z" fill="#7a4a2c"/>` +
      `<path d="M52 34h16" stroke="#3f9a80" stroke-width="2"/>` +
      `<rect x="56" y="20" width="8" height="10" fill="#c9845a"/><path d="M56 20Q60 14 64 20Z" fill="#a8673f"/>` +
      `<g fill="#e3b341"><circle cx="60" cy="12" r="1.6"/><circle cx="60" cy="8" r="1.3"/><circle cx="60" cy="5" r="1"/></g>` +
      PALM(30),
  ],
  나이로비: [
    "기린과 아카시아",
    SAVANNA +
      `<path d="M86 96V64" stroke="#6b4a2a" stroke-width="3"/><path d="M86 70l-8-6M86 68l8-6" stroke="#6b4a2a" stroke-width="2"/>` +
      `<ellipse cx="86" cy="58" rx="18" ry="6" fill="#4f7a3a"/><ellipse cx="82" cy="55" rx="12" ry="3" fill="#5f8f46"/>` +
      `<path d="M36 94V76M42 94V77M54 94V77M60 94V76" stroke="#d99a45" stroke-width="3" stroke-linecap="round"/>` +
      `<ellipse cx="48" cy="72" rx="15" ry="8" fill="#e8b45a"/>` +
      `<path d="M56 70L62 34L67 34L62 72Z" fill="#e8b45a"/>` +
      `<ellipse cx="66" cy="32" rx="7" ry="4" fill="#e8b45a"/><path d="M62 28l-1-5M65 28l1-5" stroke="#8a5a2b" stroke-width="1.5"/>` +
      `<g fill="#a8642b"><circle cx="42" cy="70" r="2.5"/><circle cx="50" cy="68" r="2.5"/><circle cx="54" cy="75" r="2.2"/><circle cx="46" cy="76" r="2"/><circle cx="61" cy="48" r="1.8"/><circle cx="60" cy="58" r="1.8"/><circle cx="63" cy="40" r="1.5"/></g>` +
      `<circle cx="68" cy="31" r=".9" fill="#1d1f23"/>`,
  ],
  케이프타운: [
    "테이블 마운틴",
    WATER +
      `<path d="M12 92L24 60L34 52H84L92 60L108 92Z" fill="#7d8a72"/><path d="M60 52H84L92 60L108 92H60Z" fill="#646f5a"/>` +
      `<path d="M90 60L98 46L104 60Z" fill="#6f7b64"/>` +
      `<g fill="#f4f6f9"><ellipse cx="42" cy="52" rx="10" ry="4"/><ellipse cx="58" cy="51" rx="12" ry="4.5"/><ellipse cx="76" cy="52" rx="10" ry="4"/></g>` +
      `<path d="M38 58q4 6 2 12M80 58q-2 6 0 12" stroke="#f4f6f9" stroke-width="2" opacity=".7" fill="none"/>` +
      `<path d="M30 92h6v-5h-6ZM40 92h5v-7h-5ZM50 92h6v-4h-6ZM70 92h5v-6h-5ZM80 92h6v-4h-6Z" fill="#f4f1ea"/>`,
  ],

  // --- Asia ----------------------------------------------------------------
  인천: [
    "인천대교",
    WATER +
      cableStayed(
        (x) =>
          `<path d="M${x - 6} 82L${x - 1.5} 34H${x + 1.5}L${x + 6} 82H${x + 2.5}L${x} 56L${x - 2.5} 82Z" fill="#eef2f6"/>` +
          `<path d="M${x} 34H${x + 1.5}L${x + 6} 82H${x + 2.5}L${x} 56Z" fill="#c3ccd6"/>`,
        34,
      ),
  ],
  후쿠오카: [
    "후쿠오카 타워",
    SAND +
      `<path d="M50 96L56 22H64L70 96Z" fill="#6fa8dc"/><path d="M60 22H64L70 96H60Z" fill="#4f86bd"/>` +
      `<path d="M52 80L68 64M51.5 88L69 70M53 66L67 52M54 52L66 40M55 38L65 28M68 80L52 64M68.5 88L51 70M67 66L53 52M66 52L54 40" stroke="#b9daf5" stroke-width=".7"/>` +
      `<rect x="53" y="30" width="14" height="6" fill="#e9eef3"/><rect x="59.2" y="6" width="1.6" height="16" fill="#e9edf2"/>`,
  ],
  교토: [
    "도리이",
    GRASS +
      `<path d="M46 98V60M74 98V60" stroke="#c9382a" stroke-width="3.5"/><path d="M42 56Q60 53 78 56L77 59Q60 57 43 59Z" fill="#2b2b2b"/><rect x="45" y="63" width="30" height="3" fill="#c9382a"/>` +
      `<rect x="34" y="52" width="7" height="46" fill="#e0452e"/><rect x="79" y="52" width="7" height="46" fill="#b93622"/>` +
      `<path d="M26 44Q60 38 94 44L92 50Q60 46 28 50Z" fill="#1f2328"/><rect x="30" y="50" width="60" height="4" fill="#e0452e"/><rect x="60" y="50" width="30" height="4" fill="#b93622"/>` +
      `<rect x="32" y="60" width="56" height="5" fill="#e0452e"/><rect x="60" y="60" width="28" height="5" fill="#b93622"/><rect x="57" y="54" width="6" height="6" fill="#e0452e"/>` +
      `<rect x="32" y="92" width="11" height="5" fill="#1f2328"/><rect x="77" y="92" width="11" height="5" fill="#1f2328"/>`,
  ],
  삿포로: [
    "시계탑",
    SNOW +
      `<rect x="30" y="66" width="60" height="28" fill="#f4f1ea"/><rect x="60" y="66" width="30" height="28" fill="#d6d2c8"/>` +
      `<path d="M36 72h6v8h-6zM48 72h6v8h-6zM66 72h6v8h-6zM78 72h6v8h-6z" fill="#4f86bd"/><path d="M56 94V82h8v12Z" fill="#8a5a3a"/>` +
      `<path d="M26 68L60 54L94 68Z" fill="#c0392b"/><path d="M60 54L94 68H60Z" fill="#9c2e23"/><path d="M30 66L60 54L90 66" stroke="#f4f8fb" stroke-width="2" fill="none"/>` +
      `<rect x="51" y="36" width="18" height="20" fill="#f4f1ea"/><rect x="60" y="36" width="9" height="20" fill="#d6d2c8"/>` +
      `<circle cx="60" cy="45" r="6" fill="#ffffff" stroke="#2b2f36" stroke-width="1"/><path d="M60 45V41M60 45h3" stroke="#2b2f36" stroke-width="1.2" stroke-linecap="round"/>` +
      `<path d="M49 38L60 24L71 38Z" fill="#c0392b"/><path d="M52 36L60 26L68 36" stroke="#f4f8fb" stroke-width="1.5" fill="none"/><rect x="59.3" y="18" width="1.4" height="6" fill="#2b2f36"/>`,
  ],
  블라디보스토크: [
    "금각교",
    WATER +
      cableStayed(
        (x) =>
          `<path d="M${x - 8} 82L${x - 1} 18H${x + 1}L${x + 8} 82H${x + 5}L${x} 40L${x - 5} 82Z" fill="#eef2f6"/>` +
          `<path d="M${x} 18H${x + 1}L${x + 8} 82H${x + 5}L${x} 40Z" fill="#c3ccd6"/><circle cx="${x}" cy="17" r="1.5" fill="#ffd166"/>`,
        18,
      ),
  ],
  울란바토르: [
    "게르",
    STEPPE +
      `<path d="M28 90V72Q60 68 92 72V90Q60 94 28 90Z" fill="#f4f1ea"/><path d="M60 69Q76 70 92 72V90Q76 92 60 92Z" fill="#d6d2c8"/>` +
      `<path d="M28 76Q60 72 92 76" stroke="#3a6ea5" stroke-width="2.5" fill="none"/>` +
      `<path d="M26 72Q42 54 60 50Q78 54 94 72Q60 66 26 72Z" fill="#e9e4d8"/><path d="M60 50Q78 54 94 72Q78 68 60 68Z" fill="#cbc4b4"/>` +
      `<path d="M34 66Q60 58 86 66" stroke="#3a6ea5" stroke-width="2" fill="none"/><circle cx="60" cy="50" r="4" fill="#c0392b"/>` +
      `<rect x="54" y="76" width="12" height="15" fill="#e0662e"/><path d="M56 80h8M56 84h8M60 78v12" stroke="#ffd166" stroke-width="1"/>`,
  ],
  광저우: [
    "캔톤 타워",
    GRASS +
      `<path d="M42 96Q56 62 52 30H68Q64 62 78 96Z" fill="#c86bd1"/><path d="M60 30H68Q64 62 78 96H60Z" fill="#9b4aa3"/>` +
      `<path d="M46 86L72 70M50 76L70 58M52 64L68 46M53 50L67 36M74 86L48 70M70 76L50 58M68 64L52 46M67 50L53 36" stroke="#f3c6f7" stroke-width=".7"/>` +
      `<rect x="51" y="28" width="18" height="3" fill="#e9b3ef"/><rect x="59" y="6" width="2" height="22" fill="#e9edf2"/>`,
  ],
  마카오: [
    "성 바울 성당 유적",
    PAVED +
      `<path d="M30 96H90V92H34ZM36 92H84V88H38Z" fill="#b9b2a4"/>` +
      `<rect x="34" y="60" width="52" height="28" fill="#d9c09a"/><rect x="60" y="60" width="26" height="28" fill="#bba27b"/>` +
      `<path d="M40 88V74q3-5 6 0V88ZM56 88V70q4-6 8 0V88ZM74 88V74q3-5 6 0V88Z" fill="#5a4a33"/>` +
      `<rect x="40" y="46" width="40" height="14" fill="#d9c09a"/><rect x="60" y="46" width="20" height="14" fill="#bba27b"/>` +
      `<path d="M46 58V50q2-3 4 0V58ZM58 58V50q2-3 4 0V58ZM70 58V50q2-3 4 0V58Z" fill="#6b5a3e"/>` +
      `<rect x="48" y="34" width="24" height="12" fill="#d9c09a"/><path d="M46 34L60 24L74 34Z" fill="#c9ad82"/>` +
      `<path d="M60 14v10M57 17h6" stroke="#8a7350" stroke-width="1.5"/>`,
  ],
  다낭: [
    "골든 브리지",
    GRASS +
      `<path d="M20 98Q30 60 46 56M100 98Q90 60 74 56" stroke="#2f5a33" stroke-width="16" fill="none" opacity=".5"/>` +
      `<path d="M34 98V70Q34 62 40 62Q46 62 46 70V98Z" fill="#8a8f84"/><path d="M74 98V70Q74 62 80 62Q86 62 86 70V98Z" fill="#6f7469"/>` +
      `<path d="M34 64q-2-8 1-10q2 4 2 10M38 62q-1-9 2-11q2 5 1 11M42 62q0-9 3-10q1 5-1 10M45 66q3-6 6-6q-1 5-4 8" stroke="#8a8f84" stroke-width="3" fill="none" stroke-linecap="round"/>` +
      `<path d="M86 64q2-8-1-10q-2 4-2 10M82 62q1-9-2-11q-2 5-1 11M78 62q0-9-3-10q-1 5 1 10M75 66q-3-6-6-6q1 5 4 8" stroke="#6f7469" stroke-width="3" fill="none" stroke-linecap="round"/>` +
      `<path d="M12 50Q60 62 108 50L108 55Q60 67 12 55Z" fill="#e3b341"/><path d="M12 48Q60 60 108 48" stroke="#f2d27a" stroke-width="1.2" fill="none"/>` +
      `<path d="M40 70q2 4 6 2M80 70q-2 4-6 2" stroke="#5a8a48" stroke-width="2" fill="none"/>`,
  ],
  호찌민: [
    "노트르담 대성당",
    PAVED +
      `<circle cx="28" cy="86" r="7" fill="#3f8f4f"/>` +
      `<rect x="42" y="54" width="36" height="40" fill="#b5523b"/><rect x="60" y="54" width="18" height="40" fill="#8f3d2b"/>` +
      `<path d="M54 94V80q6-8 12 0V94Z" fill="#4a1d14"/><circle cx="60" cy="66" r="5" fill="#f4f1ea"/><circle cx="60" cy="66" r="2.5" fill="#4f86bd"/>` +
      `<path d="M42 54L60 44L78 54Z" fill="#b5523b"/>` +
      spire(40, 10, 34, "#b5523b", "#6b7079") +
      spire(80, 10, 34, "#8f3d2b", "#55595f") +
      `<path d="M40 12v6M38 14h4M80 12v6M78 14h4" stroke="#2b2f36" stroke-width="1"/>`,
  ],
  세부: [
    "마젤란 십자가",
    PAVED +
      `<rect x="32" y="84" width="56" height="10" fill="#f4f1ea"/><rect x="60" y="84" width="28" height="10" fill="#d6d2c8"/>` +
      `<path d="M36 84V58M84 84V58" stroke="#e9e4d8" stroke-width="4"/>` +
      `<path d="M26 60L60 40L94 60Z" fill="#c0392b"/><path d="M60 40L94 60H60Z" fill="#9c2e23"/><rect x="30" y="58" width="60" height="4" fill="#f4f1ea"/>` +
      `<rect x="57" y="50" width="6" height="34" fill="#7a4a2a"/><rect x="49" y="58" width="22" height="5" fill="#7a4a2a"/><rect x="60" y="50" width="3" height="34" fill="#5f3920"/>` +
      `<rect x="56" y="80" width="8" height="4" fill="#5a5e65"/>`,
  ],
  쿠알라룸푸르: [
    "페트로나스 트윈 타워",
    PAVED +
      [40, 80]
        .map(
          (x) =>
            `<path d="M${x - 9} 96V44H${x - 7}V34H${x - 5}V26H${x - 2}V18H${x + 2}V26H${x + 5}V34H${x + 7}V44H${x + 9}V96Z" fill="#d3d9e0"/>` +
            `<path d="M${x} 18H${x + 2}V26H${x + 5}V34H${x + 7}V44H${x + 9}V96H${x}Z" fill="#a8b2be"/>` +
            `<rect x="${x - 0.6}" y="4" width="1.2" height="14" fill="#e9edf2"/>` +
            `<path d="M${x - 8} 54h16M${x - 8} 64h16M${x - 8} 74h16M${x - 8} 84h16" stroke="#8796a6" stroke-width=".8"/>`,
        )
        .join("") +
      `<rect x="49" y="56" width="22" height="4" fill="#c3ccd6"/><path d="M52 60L60 70L68 60" stroke="#c3ccd6" stroke-width="1.5" fill="none"/>`,
  ],
  자카르타: [
    "모나스 (독립기념탑)",
    GRASS +
      `<path d="M28 94L38 82H82L92 94Z" fill="#f4f1ea"/><path d="M60 82H82L92 94H60Z" fill="#d6d2c8"/>` +
      `<path d="M56 82L57.5 34H62.5L64 82Z" fill="#f4f1ea"/><path d="M60 34H62.5L64 82H60Z" fill="#d6d2c8"/>` +
      `<path d="M52 34H68L65 28H55Z" fill="#e9e4d8"/>` +
      `<path d="M60 28Q53 20 57 11Q59 18 61 11Q67 20 60 28Z" fill="#f2b632"/><path d="M60 26Q57 20 59 15Q61 20 60 26Z" fill="#ffd166"/>`,
  ],
  양곤: [
    "쉐다곤 파고다",
    GRASS +
      `<rect x="26" y="86" width="68" height="8" fill="#f4f1ea"/><rect x="60" y="86" width="34" height="8" fill="#d6d2c8"/>` +
      `<path d="M36 86Q38 64 50 58Q54 42 60 20Q66 42 70 58Q82 64 84 86Z" fill="#e3b341"/><path d="M60 20Q66 42 70 58Q82 64 84 86H60Z" fill="#c49a2e"/>` +
      `<path d="M42 76h36M46 66h28M52 54h16M55 44h10" stroke="#f2d27a" stroke-width="1.2"/>` +
      `<path d="M56 22L60 14L64 22Z" fill="#f2d27a"/><circle cx="60" cy="12" r="1.5" fill="#ffffff"/>` +
      spire(30, 4, 76, "#e3b341", "#c49a2e") +
      spire(90, 4, 76, "#c49a2e", "#a8822a"),
  ],
  델리: [
    "꾸뜹 미나르",
    GRASS +
      `<path d="M50 96L54 20H66L70 96Z" fill="#c46a4a"/><path d="M60 20H66L70 96H60Z" fill="#9e4e33"/>` +
      `<path d="M53 92L55 24M57 94L58 22M63 94L62 22M67 92L65 24" stroke="#a85a3c" stroke-width=".8"/>` +
      `<rect x="49" y="74" width="22" height="3" fill="#e2c79a"/><rect x="50.5" y="54" width="19" height="3" fill="#e2c79a"/><rect x="52" y="36" width="16" height="3" fill="#e2c79a"/>` +
      `<path d="M54 20Q60 12 66 20Z" fill="#e2c79a"/>`,
  ],
  카트만두: [
    "보우더나트 스투파",
    GRASS +
      `<path d="M60 22L22 62M60 22L98 62" stroke="#c5ccd5" stroke-width=".6"/>` +
      [0.2, 0.35, 0.5, 0.65, 0.8]
        .map((t, i) => {
          const colors = ["#3a6ea5", "#f4f6f9", "#e5484d", "#3f9a80", "#ffd166"];
          const lx = 60 - 38 * t;
          const rx = 60 + 38 * t;
          const y = 22 + 40 * t;
          return `<path d="M${lx} ${y}l3 4l2-5Z" fill="${colors[i]}"/><path d="M${rx} ${y}l-3 4l-2-5Z" fill="${colors[(i + 2) % 5]}"/>`;
        })
        .join("") +
      `<rect x="26" y="88" width="68" height="6" fill="#f4f1ea"/><rect x="60" y="88" width="34" height="6" fill="#d6d2c8"/>` +
      `<path d="M30 88Q32 66 60 64Q88 66 90 88Z" fill="#f4f1ea"/><path d="M60 64Q88 66 90 88H60Z" fill="#d6d2c8"/>` +
      `<rect x="50" y="50" width="20" height="14" fill="#e3b341"/><rect x="60" y="50" width="10" height="14" fill="#c49a2e"/>` +
      `<path d="M52 56q3-2 6 0q-3 2-6 0ZM62 56q3-2 6 0q-3 2-6 0Z" fill="#ffffff"/><circle cx="55" cy="56" r="1" fill="#1f3b5a"/><circle cx="65" cy="56" r="1" fill="#1f3b5a"/>` +
      `<path d="M52 50L60 22L68 50Z" fill="#e3b341"/><path d="M60 22L68 50H60Z" fill="#c49a2e"/><path d="M54 44h12M55.5 38h9M57 32h6" stroke="#f2d27a" stroke-width="1"/>`,
  ],
};
