// Inline SVG, drawn for this overlay.

/**
 * The cover when Tokio sent no picture, or it doesn't load: a record with grooves and two
 * highlights, so it can be seen turning. Its label takes the accent color.
 */
export const RECORD = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <circle cx="50" cy="50" r="50" fill="#0f0f12"/>
  <g fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="1.2">
    <circle cx="50" cy="50" r="45"/>
    <circle cx="50" cy="50" r="40"/>
    <circle cx="50" cy="50" r="35"/>
    <circle cx="50" cy="50" r="30"/>
    <circle cx="50" cy="50" r="25"/>
  </g>
  <g fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="3" stroke-linecap="round">
    <path d="M50 9A41 41 0 0 1 91 50"/>
    <path d="M50 91A41 41 0 0 1 9 50"/>
  </g>
  <circle cx="50" cy="50" r="17" fill="currentColor"/>
</svg>`;
