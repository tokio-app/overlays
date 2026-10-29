// Inline SVG icons, drawn for this overlay.

export const HEART = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 21s-9-6.5-9-12.2C3 5.6 5.4 3.5 8 3.5c1.8 0 3.2 1 4 2.5.8-1.5 2.2-2.5 4-2.5 2.6 0 5 2.1 5 5.3C21 14.5 12 21 12 21z"/>
</svg>`;

// For the "Website" platform and for ones this version doesn't know. Its fill is on the <g>,
// since the stylesheet's svg { fill: currentColor } would beat it on the <svg>.
export const GLOBE = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <path d="M3 12h18"/>
    <path d="M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/>
  </g>
</svg>`;
