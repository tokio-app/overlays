// Inline SVG icons, drawn for this overlay.

/** A coin in the coin color, with a ring and a shine. */
export const COIN = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="11" fill="currentColor"/>
  <circle cx="12" cy="12" r="11" fill="none" stroke="rgb(0 0 0 / .18)" stroke-width="1.2"/>
  <circle cx="12" cy="12" r="7" fill="none" stroke="rgb(0 0 0 / .2)" stroke-width="1.8"/>
  <path d="M7.4 8.6a6.4 6.4 0 0 1 4.2-2.4" fill="none" stroke="rgb(255 255 255 / .6)" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

/** A four-pointed sparkle, its points on the edges of its box. */
export const SPARK = `<svg viewBox="-10 -10 20 20" aria-hidden="true">
  <path d="M0 -10Q1.6 -1.6 10 0Q1.6 1.6 0 10Q-1.6 1.6 -10 0Q-1.6 -1.6 0 -10Z" fill="#fff"/>
</svg>`;

// For gifters without a profile picture, or when it doesn't load. Its container rounds it.
export const PLACEHOLDER = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <rect width="100" height="100" fill="#d4d4d4"/>
  <circle cx="50" cy="40" r="17" fill="#ececec"/>
  <path d="M14 100c2-22 17-34 36-34s34 12 36 34z" fill="#ececec"/>
</svg>`;
