// Shared pieces of the landmark miniatures: a shadow and a round base plate
// on a 120×120 grid, lit from the upper left.

export const SHADOW = `<ellipse cx="60" cy="106" rx="44" ry="8" fill="#000" opacity=".35"/>`;

export function plate(side: string, top: string): string {
  return `${SHADOW}<path d="M20 98v6a40 10 0 0 0 80 0v-6Z" fill="${side}"/><ellipse cx="60" cy="98" rx="40" ry="10" fill="${top}"/>`;
}

export const GRASS = plate("#2f4a33", "#5b8a52");
export const WATER =
  plate("#1f4f80", "#3d86c6") +
  `<path d="M30 100h10M72 103h12M50 105h8M84 96h6" stroke="#8cc4f0" stroke-width="1.5" stroke-linecap="round"/>`;
export const SAND = plate("#b8995c", "#e8d29b");
export const PAVED = plate("#3c4148", "#767b84");

export const PALM = (x: number) =>
  `<path d="M${x} 96q2-22 6-40" stroke="#8b5a2b" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
  `<path d="M${x + 6} 56q-12-4-18 4q10-2 18-4Zm0 0q10-8 18-4q-10 0-18 4Zm0 0q-6-12-16-12q8 4 16 12Zm0 0q4-12 14-12q-8 4-14 12Z" fill="#3f8f4f"/>`;

export const SNOW = plate("#8fa3b8", "#e8f0f7");
export const ROCK = plate("#3e434a", "#7b828c");
export const STEPPE = plate("#4f5f2e", "#9fb45a");
export const SAVANNA = plate("#6b5a2f", "#c9b45a");

