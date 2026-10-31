// Inline SVG icons, drawn for this overlay.

/** A coin in the coin color, with a ring and a shine. */
export const COIN = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="11" fill="currentColor"/>
  <circle cx="12" cy="12" r="11" fill="none" stroke="rgb(0 0 0 / .18)" stroke-width="1.2"/>
  <circle cx="12" cy="12" r="7" fill="none" stroke="rgb(0 0 0 / .2)" stroke-width="1.8"/>
  <path d="M7.4 8.6a6.4 6.4 0 0 1 4.2-2.4" fill="none" stroke="rgb(255 255 255 / .6)" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

/** A four-pointed sparkle, its points a fifth of the way in from the edge of its box. */
export const STAR = `<svg viewBox="-26 -26 52 52" aria-hidden="true">
  <path d="M0 -10Q2 -2 10 0Q2 2 0 10Q-2 2 -10 0Q-2 -2 0 -10Z" fill="#fff"/>
</svg>`;

/** A crown for the top gifter, in the coin color. */
export const CROWN = `<svg viewBox="0 0 26 20" aria-hidden="true">
  <path d="M2.5 16 1 5.5l6.5 4.5L13 2l5.5 8L25 5.5 23.5 16z" fill="currentColor" stroke="rgb(0 0 0 / .28)" stroke-width="1" stroke-linejoin="round"/>
  <rect x="2.5" y="15.5" width="21" height="3.5" rx="1.5" fill="currentColor" stroke="rgb(0 0 0 / .28)" stroke-width="1"/>
  <path d="M5 13h16" stroke="rgb(255 255 255 / .55)" stroke-width="1.2" stroke-linecap="round"/>
  <circle cx="13" cy="2.6" r="1.7" fill="#fff" fill-opacity=".9"/>
</svg>`;

// For gifters without a profile picture, or when it doesn't load. Its container rounds it.
export const PLACEHOLDER = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <rect width="100" height="100" fill="#d4d4d4"/>
  <circle cx="50" cy="40" r="17" fill="#ececec"/>
  <path d="M14 100c2-22 17-34 36-34s34 12 36 34z" fill="#ececec"/>
</svg>`;
