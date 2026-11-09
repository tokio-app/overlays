import type { MusicInfo } from "@tokioapp/overlay";

/**
 * A title split into the song and its artist.
 *
 * shortcut: this relies on Tokio building every title as "Song - Artist", and splits at the last
 * " - " since song names have dashes more often than artists do. Add an `artist` field to the
 * payload if the format ever changes. A title without " - " is all song.
 */
export function splitTitle(title: string) {
  const at = title.lastIndexOf(" - ");
  if (at <= 0) return { song: title.trim(), artist: "" };
  return {
    song: title.slice(0, at).trim(),
    artist: title.slice(at + 3).trim(),
  };
}

const svg = (body: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">${body}</svg>`,
  )}`;

// Covers drawn for the demo and the preview: a gradient and a few plain shapes each.
const COVERS = [
  // A sun over hills
  svg(`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fb923c"/><stop offset="1" stop-color="#be185d"/>
  </linearGradient></defs>
  <rect width="400" height="400" fill="url(#g)"/>
  <circle cx="270" cy="150" r="82" fill="#fde68a"/>
  <path d="M0 400V290Q110 200 220 300T400 270V400Z" fill="#3b0a2c" fill-opacity=".85"/>
  <path d="M0 400V340Q140 280 260 350T400 330V400Z" fill="#1a0615"/>`),
  // Diagonal stripes and a ring
  svg(`<defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0">
    <stop offset="0" stop-color="#0f766e"/><stop offset="1" stop-color="#1e3a8a"/>
  </linearGradient></defs>
  <rect width="400" height="400" fill="url(#g)"/>
  <g stroke="#fff" stroke-opacity=".16" stroke-width="26">
    <path d="M-40 120L120 -40M-40 260L260 -40M0 440L440 0M140 440L440 140M280 440L440 280"/>
  </g>
  <circle cx="150" cy="250" r="70" fill="none" stroke="#99f6e4" stroke-width="14"/>`),
  // Rings
  svg(`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#facc15"/><stop offset="1" stop-color="#ea580c"/>
  </linearGradient></defs>
  <rect width="400" height="400" fill="url(#g)"/>
  <g fill="none" stroke="#431407" stroke-width="16">
    <circle cx="130" cy="290" r="40"/><circle cx="130" cy="290" r="80" stroke-opacity=".7"/>
    <circle cx="130" cy="290" r="120" stroke-opacity=".45"/><circle cx="130" cy="290" r="160" stroke-opacity=".25"/>
  </g>
  <circle cx="310" cy="95" r="26" fill="#431407"/>`),
  // A moon and stars
  svg(`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#6d28d9"/><stop offset="1" stop-color="#0ea5e9"/>
  </linearGradient></defs>
  <rect width="400" height="400" fill="url(#g)"/>
  <circle cx="240" cy="190" r="105" fill="#f5f3ff"/>
  <circle cx="285" cy="165" r="95" fill="#6d28d9"/>
  <g fill="#fff"><circle cx="90" cy="90" r="7"/><circle cx="330" cy="320" r="9"/><circle cx="70" cy="300" r="5"/><circle cx="200" cy="60" r="5"/></g>`),
];

// Made-up songs and artists.
const SAMPLES = [
  "Salt Lamp Summer - Amber Finch",
  "Slow Comet - Velvet Moth",
  "Cardboard Moon - Pale Harbor",
  "Orange Static - Quiet Kites",
].map((title, i) => ({ title, thumbnail: COVERS[i] }));

/**
 * The sample queue at a step: each step the next song plays and the others wait, so Up next is
 * always full.
 */
export function sampleQueue(step: number): MusicInfo[] {
  return SAMPLES.map((_, i) => SAMPLES[(step + i) % SAMPLES.length]).map(
    (song, i) => ({ ...song, playing: i === 0, played: false }),
  );
}
