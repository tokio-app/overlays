// Inline SVG icons, drawn for this overlay.

const MEDALS = {
  1: { edge: "#f5a623", face: "#ffcf4a", ribbon: "#e07b16" },
  2: { edge: "#9a9a9a", face: "#d2d2d2", ribbon: "#767676" },
  3: { edge: "#ef8a26", face: "#ffb05a", ribbon: "#cf6512" },
};

// A rosette: a circle with a scalloped edge, 24 points around (16, 15).
const ROSETTE = Array.from({ length: 24 }, (_, i) => {
  const angle = (i * Math.PI) / 12;
  const radius = i % 2 === 0 ? 14 : 12.2;
  return `${(16 + radius * Math.sin(angle)).toFixed(2)},${(15 - radius * Math.cos(angle)).toFixed(2)}`;
}).join(" ");

/** The ribbon medal for the top three, with the rank on it. */
export function medal(rank: 1 | 2 | 3): string {
  const { edge, face, ribbon } = MEDALS[rank];
  return `<svg viewBox="0 0 32 42" aria-hidden="true">
    <path d="M9 23 4 40l6-3.5 4 5.5 3.5-15z" fill="${ribbon}"/>
    <path d="M23 23l5 17-6-3.5-4 5.5-3.5-15z" fill="${ribbon}"/>
    <polygon points="${ROSETTE}" fill="${edge}"/>
    <circle cx="16" cy="15" r="9" fill="${face}"/>
    <text x="16" y="19.4" text-anchor="middle" font-size="12.5" font-weight="800" font-family="system-ui, sans-serif" fill="#fff">${rank}</text>
  </svg>`;
}

// Drawn at 1px per unit. The band's lower edge is an arc of an 80px avatar's circle, centered at
// (32, 80), so the crown rests on the avatar instead of floating over it.
export const CROWN = `<svg viewBox="-3 -3 70 62" aria-hidden="true">
  <g stroke="#1a1a1a" stroke-width="2.5" stroke-linejoin="round">
    <path d="M1 54.7 3 14l15 14L32 4l14 24 15-14 2 40.7A40 40 0 0 0 1 54.7z" fill="#ffd21f"/>
    <path d="M1 43.4A48 48 0 0 1 63 43.4v11.3A40 40 0 0 0 1 54.7z" fill="#f5b700"/>
    <circle cx="3" cy="13" r="3.5" fill="#ffe15a"/>
    <circle cx="32" cy="4" r="4" fill="#ffe15a"/>
    <circle cx="61" cy="13" r="3.5" fill="#ffe15a"/>
    <circle cx="32" cy="36.3" r="2.8" fill="#e8222b"/>
  </g>
</svg>`;

export const HEART = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 21s-9-6.5-9-12.2C3 5.6 5.4 3.5 8 3.5c1.8 0 3.2 1 4 2.5.8-1.5 2.2-2.5 4-2.5 2.6 0 5 2.1 5 5.3C21 14.5 12 21 12 21z"/>
</svg>`;

// For viewers without a profile picture, or when it doesn't load. Its container rounds it.
export const PLACEHOLDER = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <rect width="100" height="100" fill="#d4d4d4"/>
  <circle cx="50" cy="40" r="17" fill="#ececec"/>
  <path d="M14 100c2-22 17-34 36-34s34 12 36 34z" fill="#ececec"/>
</svg>`;
