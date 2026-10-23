// Miniature landmark icons for the city labels (design option A: a small
// diorama on a round base). Each is an inline SVG on a 120×120 grid: a
// shadow and base plate at the bottom, the landmark above, lit from the
// upper left with a darker right side.

const SHADOW = `<ellipse cx="60" cy="106" rx="44" ry="8" fill="#000" opacity=".35"/>`;

function plate(side: string, top: string): string {
  return `${SHADOW}<path d="M20 98v6a40 10 0 0 0 80 0v-6Z" fill="${side}"/><ellipse cx="60" cy="98" rx="40" ry="10" fill="${top}"/>`;
}

const GRASS = plate("#2f4a33", "#5b8a52");
const WATER =
  plate("#1f4f80", "#3d86c6") +
  `<path d="M30 100h10M72 103h12M50 105h8M84 96h6" stroke="#8cc4f0" stroke-width="1.5" stroke-linecap="round"/>`;
const SAND = plate("#b8995c", "#e8d29b");
const PAVED = plate("#3c4148", "#767b84");

const PALM = (x: number) =>
  `<path d="M${x} 96q2-22 6-40" stroke="#8b5a2b" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
  `<path d="M${x + 6} 56q-12-4-18 4q10-2 18-4Zm0 0q10-8 18-4q-10 0-18 4Zm0 0q-6-12-16-12q8 4 16 12Zm0 0q4-12 14-12q-8 4-14 12Z" fill="#3f8f4f"/>`;

export interface Landmark {
  name: string;
  svg: string;
}

const icons: Record<string, [string, string]> = {
  서울: [
    "N서울타워",
    GRASS +
      `<path d="M26 99Q44 70 60 68Q76 70 94 99Z" fill="#4e7d47"/><path d="M60 68Q76 70 94 99H60Z" fill="#3f6a3a"/>` +
      `<circle cx="38" cy="90" r="4" fill="#3b6636"/><circle cx="80" cy="90" r="4" fill="#335a2f"/>` +
      `<rect x="52" y="62" width="16" height="8" rx="1.5" fill="#dfe4ea"/><rect x="60" y="62" width="8" height="8" fill="#b9c1cb"/>` +
      `<rect x="56.5" y="38" width="7" height="25" fill="#eef1f5"/><rect x="60" y="38" width="3.5" height="25" fill="#c5ccd5"/>` +
      `<rect x="51" y="36" width="18" height="4" rx="2" fill="#d9dee5"/>` +
      `<rect x="47" y="25" width="26" height="12" rx="4" fill="#f4f6f9"/><path d="M60 25h9a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4h-9Z" fill="#cdd4dc"/>` +
      `<rect x="47" y="29" width="26" height="3.5" fill="#6fa8dc"/><rect x="60" y="29" width="13" height="3.5" fill="#4f86bd"/>` +
      `<rect x="53" y="21" width="14" height="5" rx="2" fill="#e9edf2"/>` +
      `<rect x="58.5" y="6" width="3" height="16" fill="#f4f6f9"/><rect x="58.5" y="8" width="3" height="3" fill="#e5484d"/><rect x="58.5" y="14" width="3" height="3" fill="#e5484d"/>`,
  ],
  부산: [
    "광안대교",
    WATER +
      `<rect x="40" y="82" width="5" height="16" fill="#c9d1db"/><rect x="76" y="82" width="5" height="16" fill="#c9d1db"/>` +
      `<rect x="38" y="40" width="3" height="44" fill="#eef2f6"/><rect x="44" y="40" width="3" height="44" fill="#c3ccd6"/><rect x="38" y="46" width="9" height="2.5" fill="#dfe5ec"/><rect x="38" y="60" width="9" height="2.5" fill="#dfe5ec"/>` +
      `<rect x="74" y="40" width="3" height="44" fill="#eef2f6"/><rect x="80" y="40" width="3" height="44" fill="#c3ccd6"/><rect x="74" y="46" width="9" height="2.5" fill="#dfe5ec"/><rect x="74" y="60" width="9" height="2.5" fill="#dfe5ec"/>` +
      `<path d="M22 78V64M30 78V57M36 78V50M50 78V51M55 78V54M60.5 78V55.5M66 78V54M71 78V51M85 78V50M91 78V57M99 78V64" stroke="#dfe5ec" stroke-width="1"/>` +
      `<path d="M14 70Q28 64 42.5 41Q60.5 70 78.5 41Q93 64 106 70" fill="none" stroke="#f3f6f9" stroke-width="1.8"/>` +
      `<rect x="14" y="78" width="92" height="5" rx="1" fill="#e6ebf1"/><rect x="14" y="83" width="92" height="2.5" fill="#8f9bab"/>` +
      `<circle cx="22" cy="80.5" r="1.1" fill="#ffd166"/><circle cx="52" cy="80.5" r="1.1" fill="#06d6a0"/><circle cx="70" cy="80.5" r="1.1" fill="#ef476f"/><circle cx="98" cy="80.5" r="1.1" fill="#7fb3ff"/>`,
  ],
  제주: [
    "돌하르방",
    GRASS +
      `<circle cx="30" cy="99" r="1.8" fill="#f5d142"/><circle cx="35" cy="102" r="1.8" fill="#f5d142"/><circle cx="88" cy="97" r="1.8" fill="#f5d142"/><circle cx="84" cy="102" r="1.6" fill="#f5d142"/>` +
      `<ellipse cx="36" cy="95" rx="5" ry="3" fill="#4f535a"/>` +
      `<rect x="46" y="86" width="28" height="9" rx="2" fill="#5d6168"/><rect x="60" y="86" width="14" height="9" rx="2" fill="#4b4f55"/>` +
      `<rect x="44" y="44" width="32" height="44" rx="13" fill="#7a7f87"/><path d="M60 44h3a13 13 0 0 1 13 13v18a13 13 0 0 1-13 13h-3Z" fill="#62676e"/>` +
      `<ellipse cx="60" cy="40" rx="17" ry="4.5" fill="#6a6f77"/><path d="M47 40Q47 24 60 24Q73 24 73 40Z" fill="#80858d"/><path d="M60 24Q73 24 73 40H60Z" fill="#666b73"/>` +
      `<circle cx="53.5" cy="54" r="4.2" fill="#5a5e65"/><circle cx="53.5" cy="54" r="2.4" fill="#8f949c"/><circle cx="66.5" cy="54" r="4.2" fill="#4a4e54"/><circle cx="66.5" cy="54" r="2.4" fill="#737880"/>` +
      `<ellipse cx="60" cy="62" rx="3.6" ry="5" fill="#8a8f97"/><path d="M54.5 70Q60 72 65.5 70" stroke="#4d5157" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
      `<rect x="47" y="75" width="20" height="4.5" rx="2.2" fill="#8a8f97"/><rect x="53" y="81" width="20" height="4.5" rx="2.2" fill="#6e737b"/>`,
  ],
  도쿄: [
    "도쿄 타워",
    GRASS +
      `<rect x="38" y="89" width="44" height="8" rx="1.5" fill="#d9dde3"/><rect x="60" y="89" width="22" height="8" fill="#b7bec8"/>` +
      `<path d="M36 90L56 30H64L84 90H74Q60 74 46 90Z" fill="#ea5a2a"/><path d="M60 30H64L84 90H74Q67 81 60 80Z" fill="#bf4320"/>` +
      `<path d="M42.7 70L44 66H76L77.3 70Z" fill="#f4f1ec"/><path d="M60 66H76L77.3 70H60Z" fill="#d6d1c8"/>` +
      `<path d="M51.7 43L52.7 40H67.3L68.3 43Z" fill="#f4f1ec"/><path d="M60 40H67.3L68.3 43H60Z" fill="#d6d1c8"/>` +
      `<path d="M41 80H79M48 54H72M41 80L60 70L79 80M47 54L60 46L73 54" stroke="#a83a1b" stroke-width=".7" fill="none"/>` +
      `<rect x="44" y="58" width="32" height="7" rx="1.5" fill="#f5f6f8"/><rect x="60" y="58" width="16" height="7" fill="#d4d9df"/><rect x="45.5" y="60.5" width="29" height="2.2" fill="#6fa8dc"/>` +
      `<rect x="53" y="34" width="14" height="4" rx="1" fill="#f5f6f8"/><rect x="60" y="34" width="7" height="4" fill="#d4d9df"/>` +
      `<rect x="58.8" y="10" width="2.4" height="21" fill="#f2f2f2"/><rect x="58.8" y="14" width="2.4" height="3" fill="#ea5a2a"/><rect x="58.8" y="22" width="2.4" height="3" fill="#ea5a2a"/>`,
  ],
  오사카: [
    "오사카성",
    GRASS +
      `<path d="M30 97L36 75H84L90 97Z" fill="#8d929a"/><path d="M60 75H84L90 97H60Z" fill="#6f747c"/>` +
      `<path d="M33.5 86H86.5M45 75L43 86M57 86L56 97M73 75L74 86M66 86L67 97" stroke="#5f646b" stroke-width=".7" fill="none"/>` +
      `<rect x="40" y="63" width="40" height="12" fill="#f4f1ea"/><rect x="60" y="63" width="20" height="12" fill="#d6d2c8"/>` +
      `<path d="M45 67h3v4h-3zM52 67h3v4h-3z" fill="#3b3f45"/><path d="M65 67h3v4h-3zM72 67h3v4h-3z" fill="#2f3237"/>` +
      `<path d="M33 64Q40 61 44 56H76Q80 61 87 64Z" fill="#3f9a80"/><path d="M60 56H76Q80 61 87 64H60Z" fill="#2f7a65"/>` +
      `<rect x="44" y="49" width="32" height="8" fill="#f4f1ea"/><rect x="60" y="49" width="16" height="8" fill="#d6d2c8"/>` +
      `<path d="M37 50Q44 47 47 43H73Q76 47 83 50Z" fill="#3f9a80"/><path d="M60 43H73Q76 47 83 50H60Z" fill="#2f7a65"/><path d="M54 50L60 45L66 50Z" fill="#e3b341"/>` +
      `<rect x="48" y="36" width="24" height="7.5" fill="#f4f1ea"/><rect x="60" y="36" width="12" height="7.5" fill="#d6d2c8"/>` +
      `<path d="M42 37Q48 34 51 30H69Q72 34 78 37Z" fill="#3f9a80"/><path d="M60 30H69Q72 34 78 37H60Z" fill="#2f7a65"/>` +
      `<rect x="51" y="24" width="18" height="6.5" fill="#f4f1ea"/><rect x="60" y="24" width="9" height="6.5" fill="#d6d2c8"/>` +
      `<path d="M45 25Q52 21 54 16H66Q68 21 75 25Z" fill="#3f9a80"/><path d="M60 16H66Q68 21 75 25H60Z" fill="#2f7a65"/>` +
      `<path d="M33 64H87M37 50H83M42 37H78M45 25H75" stroke="#e3b341" stroke-width=".6"/>` +
      `<path d="M53.5 16L55 11L57 16Z" fill="#e3b341"/><path d="M63 16L65 11L66.5 16Z" fill="#c99a2e"/>`,
  ],
  오키나와: [
    "시사",
    SAND +
      `<circle cx="26" cy="96" r="2.6" fill="#ff5d8f"/><circle cx="31" cy="95" r="2.6" fill="#ff5d8f"/><circle cx="28.5" cy="99.5" r="2.6" fill="#ff5d8f"/><circle cx="28.5" cy="97.5" r="1.2" fill="#ffd166"/>` +
      `<path d="M34 97L40 84H84L90 97Z" fill="#c8513a"/><path d="M60 84H84L90 97H60Z" fill="#a8412e"/>` +
      `<path d="M46 84L43 97M53 84L52 97M67 84L68 97M74 84L77 97" stroke="#f0e2d0" stroke-width="1.2"/><rect x="38" y="81" width="48" height="4" rx="2" fill="#f0e2d0"/>` +
      `<path d="M77 72q9-4 6-13q-2-5-6-2" stroke="#b9653a" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      `<ellipse cx="66" cy="73" rx="13" ry="9" fill="#cf7d48"/><path d="M46 82Q44 62 54 54L66 58Q70 70 66 82Z" fill="#e39a62"/>` +
      `<rect x="49" y="68" width="6" height="14" rx="3" fill="#eeb07e"/><rect x="58" y="68" width="6" height="14" rx="3" fill="#cf7d48"/>` +
      `<g fill="#c46f3c"><circle cx="42" cy="41" r="4.5"/><circle cx="45" cy="33" r="4.5"/><circle cx="53" cy="29" r="4.5"/><circle cx="43" cy="50" r="4.5"/></g>` +
      `<g fill="#b0602f"><circle cx="62" cy="31" r="4.5"/><circle cx="67" cy="38" r="4.5"/><circle cx="67.5" cy="47" r="4.5"/><circle cx="64" cy="55" r="4.5"/></g>` +
      `<circle cx="54" cy="45" r="13" fill="#e39a62"/>` +
      `<circle cx="49" cy="43.5" r="3.4" fill="#fff"/><circle cx="49.6" cy="44" r="1.7" fill="#2b2b2b"/><circle cx="58.5" cy="43.5" r="3.4" fill="#fff"/><circle cx="59.1" cy="44" r="1.7" fill="#2b2b2b"/>` +
      `<ellipse cx="54" cy="49" rx="3.5" ry="2.3" fill="#a9522a"/><path d="M47 53Q54 61 61 53Z" fill="#7a2a1c"/>`,
  ],
  타이베이: [
    "타이베이 101",
    GRASS +
      `<rect x="42" y="84" width="36" height="10" rx="1.5" fill="#c9d3d1"/><rect x="60" y="84" width="18" height="10" fill="#a3b0ad"/>` +
      [36, 42, 48, 54, 60, 66, 72, 78]
        .map(
          (y) =>
            `<path d="M51 ${y + 6}L49 ${y}H71L69 ${y + 6}Z" fill="#5fa59a"/><path d="M60 ${y + 6}V${y}H71L69 ${y + 6}Z" fill="#3f7f75"/><path d="M49 ${y}H71" stroke="#d9efe9" stroke-width=".8"/>`,
        )
        .join("") +
      `<rect x="54" y="26" width="12" height="10" fill="#5fa59a"/><rect x="60" y="26" width="6" height="10" fill="#3f7f75"/>` +
      `<rect x="56" y="20" width="8" height="6" fill="#6fb3a8"/><rect x="59" y="6" width="2" height="15" fill="#e9eef0"/>`,
  ],
  상하이: [
    "동방명주",
    GRASS +
      `<path d="M44 96L54 62M76 96L66 62" stroke="#c9ced6" stroke-width="4" stroke-linecap="round"/>` +
      `<rect x="57" y="18" width="6" height="78" fill="#e3e7ec"/><rect x="60" y="18" width="3" height="78" fill="#b9c0ca"/>` +
      `<circle cx="60" cy="74" r="13" fill="#e8558a"/><path d="M60 61a13 13 0 0 1 0 26Z" fill="#c23d6e"/><circle cx="55" cy="69" r="3.5" fill="#f4a3c0"/>` +
      `<circle cx="60" cy="40" r="8.5" fill="#e8558a"/><path d="M60 31.5a8.5 8.5 0 0 1 0 17Z" fill="#c23d6e"/><circle cx="57" cy="37" r="2.2" fill="#f4a3c0"/>` +
      `<circle cx="60" cy="24" r="3.5" fill="#e8558a"/><rect x="59" y="6" width="2" height="15" fill="#e9edf2"/>`,
  ],
  홍콩: [
    "정크선",
    WATER +
      `<path d="M28 84Q60 98 94 82L90 78H32Z" fill="#7a4a2a"/><path d="M60 78H90L94 82Q78 92 60 92Z" fill="#5f3920"/>` +
      `<path d="M50 78V24M76 78V36" stroke="#5f3920" stroke-width="2"/>` +
      `<path d="M50 24Q66 38 64 76H40Q36 50 50 24Z" fill="#d6453d"/><path d="M50 24Q66 38 64 76H52Q56 48 50 24Z" fill="#b5352f"/>` +
      `<path d="M76 36Q90 48 88 76H70Q68 54 76 36Z" fill="#d6453d"/><path d="M76 36Q90 48 88 76H79Q80 54 76 36Z" fill="#b5352f"/>` +
      `<path d="M42 36H58M40 46H62M39 56H63M39 66H64M72 48H86M70 58H88M70 68H88" stroke="#8e2924" stroke-width="1"/>`,
  ],
  베이징: [
    "천안문",
    PAVED +
      `<rect x="28" y="68" width="64" height="26" fill="#b8322a"/><rect x="60" y="68" width="32" height="26" fill="#952721"/>` +
      `<path d="M36 94V84a4 4 0 0 1 8 0V94ZM56 94V82a4 4 0 0 1 8 0V94ZM76 94V84a4 4 0 0 1 8 0V94Z" fill="#4a1611"/>` +
      `<rect x="26" y="65" width="68" height="4" fill="#efe8dc"/>` +
      `<rect x="38" y="50" width="44" height="15" fill="#c63a30"/><rect x="60" y="50" width="22" height="15" fill="#a32e26"/>` +
      `<path d="M42 54h3v11h-3zM50 54h3v11h-3zM67 54h3v11h-3zM75 54h3v11h-3z" fill="#7d1f19"/>` +
      `<path d="M30 53Q36 50 40 45H80Q84 50 90 53Z" fill="#e6b422"/><path d="M60 45H80Q84 50 90 53H60Z" fill="#c4951a"/>` +
      `<rect x="44" y="38" width="32" height="7" fill="#c63a30"/><rect x="60" y="38" width="16" height="7" fill="#a32e26"/>` +
      `<path d="M36 39Q43 36 46 31H74Q77 36 84 39Z" fill="#e6b422"/><path d="M60 31H74Q77 36 84 39H60Z" fill="#c4951a"/>` +
      `<rect x="57" y="74" width="6" height="7" fill="#f2e3b3"/>`,
  ],
  마닐라: [
    "지프니",
    PAVED +
      `<rect x="22" y="58" width="60" height="26" rx="3" fill="#e9e4d8"/><rect x="52" y="58" width="30" height="26" fill="#cfc8b8"/>` +
      `<path d="M82 66H96Q100 66 100 72V84H82Z" fill="#e9e4d8"/><path d="M90 66H96Q100 66 100 72V84H90Z" fill="#cfc8b8"/>` +
      `<rect x="20" y="54" width="64" height="5" rx="2" fill="#2a9d8f"/>` +
      `<path d="M26 63h8v8h-8zM38 63h8v8h-8zM50 63h8v8h-8zM62 63h8v8h-8z" fill="#274c77"/><rect x="84" y="69" width="10" height="7" fill="#274c77"/>` +
      `<rect x="22" y="74" width="78" height="3" fill="#e63946"/><rect x="22" y="78" width="78" height="2" fill="#f4a261"/>` +
      `<circle cx="38" cy="86" r="7" fill="#1d1f23"/><circle cx="38" cy="86" r="3" fill="#9aa3ae"/><circle cx="86" cy="86" r="7" fill="#1d1f23"/><circle cx="86" cy="86" r="3" fill="#9aa3ae"/>` +
      `<path d="M96 66V58l3 2v6Z" fill="#c0c7cf"/><circle cx="99" cy="76" r="2" fill="#ffd166"/>`,
  ],
  괌: [
    "라테 스톤",
    SAND +
      `<path d="M38 94L40 66H48L50 94Z" fill="#b9b2a4"/><path d="M44 66H48L50 94H44Z" fill="#948d80"/>` +
      `<path d="M32 60H56Q54 68 44 68Q34 68 32 60Z" fill="#c7c0b2"/><path d="M44 60H56Q54 68 44 68Z" fill="#a39c8f"/>` +
      `<path d="M58 94L60 70H67L69 94Z" fill="#b9b2a4"/><path d="M63.5 70H67L69 94H63.5Z" fill="#948d80"/>` +
      `<path d="M53 64H74Q72 71 63.5 71Q55 71 53 64Z" fill="#c7c0b2"/><path d="M63.5 64H74Q72 71 63.5 71Z" fill="#a39c8f"/>` +
      PALM(82),
  ],
  하노이: [
    "한기둥 사원",
    WATER +
      `<ellipse cx="32" cy="98" rx="6" ry="2.5" fill="#4f9a5a"/><ellipse cx="88" cy="99" rx="5" ry="2.2" fill="#4f9a5a"/><circle cx="86" cy="96" r="2" fill="#f28ab2"/>` +
      `<rect x="56" y="70" width="8" height="28" fill="#9aa1aa"/><rect x="60" y="70" width="4" height="28" fill="#767d86"/>` +
      `<rect x="42" y="64" width="36" height="7" fill="#8a4b2a"/><rect x="60" y="64" width="18" height="7" fill="#6e3a20"/>` +
      `<rect x="47" y="50" width="26" height="14" fill="#a55a32"/><rect x="60" y="50" width="13" height="14" fill="#86472a"/>` +
      `<path d="M51 53h4v11h-4zM65 53h4v11h-4z" fill="#3d2216"/>` +
      `<path d="M34 50Q42 50 46 40H74Q78 50 86 50Q74 54 60 53Q46 54 34 50Z" fill="#5a4d48"/><path d="M60 40H74Q78 50 86 50Q74 54 60 53Z" fill="#433834"/>` +
      `<path d="M50 40L60 34L70 40Z" fill="#5a4d48"/><circle cx="60" cy="33" r="1.8" fill="#e3b341"/>`,
  ],
  방콕: [
    "왓 아룬",
    PAVED +
      `<rect x="30" y="86" width="60" height="8" fill="#efe9dc"/><rect x="60" y="86" width="30" height="8" fill="#d2cab8"/>` +
      `<rect x="38" y="78" width="44" height="8" fill="#efe9dc"/><rect x="60" y="78" width="22" height="8" fill="#d2cab8"/>` +
      `<rect x="45" y="70" width="30" height="8" fill="#efe9dc"/><rect x="60" y="70" width="15" height="8" fill="#d2cab8"/>` +
      `<path d="M48 70Q50 40 57 18H63Q70 40 72 70Z" fill="#f0e8d6"/><path d="M60 18H63Q70 40 72 70H60Z" fill="#d3c7ad"/>` +
      `<path d="M50 60H70M51.5 50H68.5M53.5 40H66.5M55.5 30H64.5" stroke="#c9a24a" stroke-width="1.2"/>` +
      `<g fill="#4fa3d1"><circle cx="54" cy="64" r="1"/><circle cx="62" cy="55" r="1"/><circle cx="57" cy="45" r="1"/></g>` +
      `<g fill="#e05d5d"><circle cx="66" cy="64" r="1"/><circle cx="55" cy="55" r="1"/><circle cx="63" cy="35" r="1"/></g>` +
      `<rect x="59.3" y="8" width="1.4" height="11" fill="#c9a24a"/>` +
      `<path d="M30 86Q31 72 34 62H36Q39 72 40 86Z" fill="#f0e8d6"/><path d="M80 86Q81 72 84 62H86Q89 72 90 86Z" fill="#d3c7ad"/>`,
  ],
  싱가포르: [
    "마리나 베이 샌즈",
    WATER +
      `<rect x="32" y="42" width="12" height="52" fill="#e3e8ee"/><rect x="39" y="42" width="5" height="52" fill="#b8c2cd"/>` +
      `<rect x="54" y="42" width="12" height="52" fill="#e3e8ee"/><rect x="61" y="42" width="5" height="52" fill="#b8c2cd"/>` +
      `<rect x="76" y="42" width="12" height="52" fill="#e3e8ee"/><rect x="83" y="42" width="5" height="52" fill="#b8c2cd"/>` +
      `<path d="M32 52h12M32 62h12M32 72h12M32 82h12M54 52h12M54 62h12M54 72h12M54 82h12M76 52h12M76 62h12M76 72h12M76 82h12" stroke="#8ea3b8" stroke-width=".8"/>` +
      `<path d="M24 40Q60 33 100 37L98 42Q60 38 26 44Z" fill="#cfd6de"/><path d="M60 35.5Q80 35 100 37L98 42Q80 39.5 60 40Z" fill="#a9b4c0"/>` +
      `<path d="M30 38q3-3 6 0M50 36q3-3 6 0M70 35.5q3-3 6 0" stroke="#4f9a5a" stroke-width="2" fill="none"/>`,
  ],
  뭄바이: [
    "인도문",
    PAVED +
      `<rect x="32" y="46" width="56" height="48" fill="#e2c79a"/><rect x="60" y="46" width="28" height="48" fill="#c4a77a"/>` +
      `<path d="M50 94V68Q60 54 70 68V94Z" fill="#3a2a1a"/>` +
      `<path d="M36 94V80q3-5 6 0V94ZM78 94V80q3-5 6 0V94Z" fill="#5a4330"/>` +
      `<rect x="30" y="44" width="60" height="4" fill="#d1b483"/>` +
      `<path d="M34 44V36h8v8ZM78 44V36h8v8Z" fill="#e2c79a"/><path d="M34 36q4-6 8 0ZM78 36q4-6 8 0Z" fill="#d1b483"/>` +
      `<path d="M50 44V38h20v6Z" fill="#e2c79a"/><path d="M50 38q10-10 20 0Z" fill="#d1b483"/>` +
      `<path d="M38 56h4v6h-4zM78 56h4v6h-4z" fill="#8a6a45"/>`,
  ],
  시드니: [
    "오페라하우스",
    WATER +
      `<rect x="22" y="82" width="76" height="9" fill="#d9c8a8"/><rect x="60" y="82" width="38" height="9" fill="#bba985"/>` +
      `<path d="M28 82Q32 58 50 48Q45 66 50 82Z" fill="#f7f7f2"/><path d="M50 48Q45 66 50 82H44Q42 64 50 48Z" fill="#d7dbe0"/>` +
      `<path d="M44 82Q50 52 70 40Q63 64 67 82Z" fill="#f7f7f2"/><path d="M70 40Q63 64 67 82H60Q58 60 70 40Z" fill="#d7dbe0"/>` +
      `<path d="M62 82Q70 60 88 54Q81 70 85 82Z" fill="#f7f7f2"/><path d="M88 54Q81 70 85 82H79Q77 68 88 54Z" fill="#d7dbe0"/>` +
      `<path d="M36 70Q42 60 48 55M54 66Q60 54 66 46M72 70Q78 62 84 58" stroke="#c4c9d0" stroke-width=".8" fill="none"/>`,
  ],
  호놀룰루: [
    "다이아몬드 헤드",
    SAND +
      `<path d="M24 96Q34 70 50 62Q62 56 76 63Q90 70 98 96Z" fill="#7c8c4e"/><path d="M62 57Q76 63 76 63Q90 70 98 96H62Z" fill="#62713c"/>` +
      `<path d="M40 70Q56 62 76 66" stroke="#9fb06a" stroke-width="1.5" fill="none"/>` +
      `<path d="M46 80l4-10M58 82l2-12M72 82l-2-12" stroke="#55623a" stroke-width="1"/>` +
      `<path d="M30 98q2-16 4-20q2 4 4 20Z" fill="#ff8a3d"/><path d="M34 78v20" stroke="#fff3e0" stroke-width="1"/>` +
      PALM(86),
  ],
  마이애미: [
    "라이프가드 타워",
    SAND +
      `<path d="M46 96L50 72M74 96L70 72M48 86H72" stroke="#8b5a2b" stroke-width="2.5" stroke-linecap="round"/>` +
      `<path d="M74 72L94 96" stroke="#c9a46b" stroke-width="3" stroke-linecap="round"/>` +
      `<rect x="42" y="52" width="36" height="20" rx="2" fill="#ff8fab"/><rect x="60" y="52" width="18" height="20" fill="#e6748f"/>` +
      `<rect x="42" y="60" width="36" height="4" fill="#3cc9b9"/><rect x="60" y="60" width="18" height="4" fill="#2ea99b"/>` +
      `<rect x="47" y="55" width="8" height="4" fill="#274c77"/>` +
      `<path d="M38 53L60 40L82 53Z" fill="#ffd166"/><path d="M60 40L82 53H60Z" fill="#e8b84a"/>` +
      `<path d="M60 40V28" stroke="#e9edf2" stroke-width="1.5"/><path d="M60 28h9l-3 3l3 3h-9Z" fill="#e5484d"/>`,
  ],
  뉴욕: [
    "자유의 여신상",
    PAVED +
      `<rect x="46" y="76" width="28" height="20" fill="#c9b99a"/><rect x="60" y="76" width="14" height="20" fill="#a99a7c"/>` +
      `<rect x="43" y="73" width="34" height="4" fill="#d8c9aa"/>` +
      `<path d="M50 73L55 42H66L71 73Z" fill="#5fb8a3"/><path d="M60.5 42H66L71 73H60.5Z" fill="#479886"/>` +
      `<path d="M53 60l14-4M52 66l17-4" stroke="#3f8676" stroke-width="1"/>` +
      `<path d="M64 46L67 22H71L68 46Z" fill="#5fb8a3"/><path d="M67 21h5l-1 4h-3Z" fill="#d9a63a"/><path d="M69.5 21q-3-4 0-9q3 5 0 9Z" fill="#ffcc4d"/>` +
      `<rect x="49" y="48" width="6" height="9" rx="1" fill="#479886"/>` +
      `<circle cx="60" cy="38" r="4.5" fill="#6cc4ae"/>` +
      `<path d="M55 35l-3-3M57 33.5l-1-4M60 33v-4M63 33.5l1-4M65 35l3-3" stroke="#6cc4ae" stroke-width="1.6" stroke-linecap="round"/>`,
  ],
  런던: [
    "빅벤",
    GRASS +
      `<rect x="48" y="38" width="24" height="58" fill="#d9b77a"/><rect x="60" y="38" width="12" height="58" fill="#b8955a"/>` +
      `<path d="M52 62v30M56 62v30M64 62v30M68 62v30" stroke="#9c7b45" stroke-width="1"/>` +
      `<rect x="46" y="36" width="28" height="4" fill="#c9a66a"/>` +
      `<circle cx="60" cy="48" r="8" fill="#f6f1e3" stroke="#3a3f46" stroke-width="1.2"/><path d="M60 48V43M60 48h4" stroke="#2b2f35" stroke-width="1.3" stroke-linecap="round"/>` +
      `<rect x="51" y="28" width="18" height="8" fill="#d9b77a"/><rect x="60" y="28" width="9" height="8" fill="#b8955a"/>` +
      `<path d="M54 30h3v5h-3zM63 30h3v5h-3z" fill="#5a4630"/>` +
      `<path d="M49 28L60 9L71 28Z" fill="#4a5560"/><path d="M60 9L71 28H60Z" fill="#363f48"/><rect x="59.2" y="4" width="1.6" height="6" fill="#e3b341"/>`,
  ],
};

export const LANDMARKS: Record<string, Landmark> = Object.fromEntries(
  Object.entries(icons).map(([city, [name, body]]) => [
    city,
    { name, svg: `<svg viewBox="0 0 120 120" aria-hidden="true">${body}</svg>` },
  ]),
);

// Shown when the scale bar reads 200 km or less: MapLibre's bar spans up
// to 100 px and rounds down, so that is under 3000 m per pixel.
const MAX_METERS_PER_PIXEL = 3000;

export function landmarksVisible(zoom: number, latitude: number): boolean {
  const metersPerPixel = (40075016.686 * Math.cos((latitude * Math.PI) / 180)) / (512 * 2 ** zoom);
  return metersPerPixel < MAX_METERS_PER_PIXEL;
}

// Icon size grows from 48 px at the threshold to 64 px two zoom levels in.
export function landmarkSize(zoom: number, latitude: number): number {
  const threshold = Math.log2((40075016.686 * Math.cos((latitude * Math.PI) / 180)) / (512 * MAX_METERS_PER_PIXEL));
  return Math.round(48 + Math.min(16, Math.max(0, (zoom - threshold) * 8)));
}
