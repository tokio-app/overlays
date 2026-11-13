// Inline SVG icons, drawn for the overlays.
const MEDALS = {
  1: { edge: "#f5a623", face: "#ffcf4a", ribbon: "#e07b16" },
  2: { edge: "#9a9a9a", face: "#d2d2d2", ribbon: "#767676" },
  3: { edge: "#ef8a26", face: "#ffb05a", ribbon: "#cf6512" },
};

// A rosette: a circle with a scalloped edge, 24 points around (16, 15). Worked out as a medal is
// drawn, so overlays without medals don't bundle it.
function rosette() {
  return Array.from({ length: 24 }, (_, i) => {
    const angle = (i * Math.PI) / 12;
    const radius = i % 2 === 0 ? 14 : 12.2;
    return `${(16 + radius * Math.sin(angle)).toFixed(2)},${(15 - radius * Math.cos(angle)).toFixed(2)}`;
  }).join(" ");
}

/** The ribbon medal for the top three, with the rank on it. */
export function medal(rank: 1 | 2 | 3): string {
  const { edge, face, ribbon } = MEDALS[rank];
  return `<svg viewBox="0 0 32 42" aria-hidden="true">
    <path d="M9 23 4 40l6-3.5 4 5.5 3.5-15z" fill="${ribbon}"/>
    <path d="M23 23l5 17-6-3.5-4 5.5-3.5-15z" fill="${ribbon}"/>
    <polygon points="${rosette()}" fill="${edge}"/>
    <circle cx="16" cy="15" r="9" fill="${face}"/>
    <text x="16" y="19.4" text-anchor="middle" font-size="12.5" font-weight="800" font-family="system-ui, sans-serif" fill="#fff">${rank}</text>
  </svg>`;
}

/** A coin in the coin color, with a ring and a shine. */
export const COIN = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="11" fill="currentColor"/>
  <circle cx="12" cy="12" r="11" fill="none" stroke="rgb(0 0 0 / .18)" stroke-width="1.2"/>
  <circle cx="12" cy="12" r="7" fill="none" stroke="rgb(0 0 0 / .2)" stroke-width="1.8"/>
  <path d="M7.4 8.6a6.4 6.4 0 0 1 4.2-2.4" fill="none" stroke="rgb(255 255 255 / .6)" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

// Filled by the page's CSS.
export const HEART = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 21s-9-6.5-9-12.2C3 5.6 5.4 3.5 8 3.5c1.8 0 3.2 1 4 2.5.8-1.5 2.2-2.5 4-2.5 2.6 0 5 2.1 5 5.3C21 14.5 12 21 12 21z"/>
</svg>`;

// For viewers without a profile picture, or when it doesn't load. Its container rounds it.
export const PLACEHOLDER = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <rect width="100" height="100" fill="#d4d4d4"/>
  <circle cx="50" cy="40" r="17" fill="#ececec"/>
  <path d="M14 100c2-22 17-34 36-34s34 12 36 34z" fill="#ececec"/>
</svg>`;
