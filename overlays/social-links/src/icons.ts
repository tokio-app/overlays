// Inline SVG icons, drawn for this overlay.

// For the "Website" platform and for ones this version doesn't know. Its fill is on the <g>,
// since the stylesheet's svg { fill: currentColor } would beat it on the <svg>.
export const GLOBE = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <path d="M3 12h18"/>
    <path d="M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/>
  </g>
</svg>`;
