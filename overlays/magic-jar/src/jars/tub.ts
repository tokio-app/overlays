// A bubble bath: a clawfoot tub on gold feet, foam spilling over its rim, a gold tap at the far
// end and a rubber duck on the rim.
import {
  dot,
  fill,
  highlight,
  leftEdge,
  part,
  rim,
  shell,
  vessel,
} from "./art";
import { cubic, num, pathOf } from "./geometry";
import type { Point } from "./types";

const WIDTH = 380;
const HEIGHT = 320;
const CX = WIDTH / 2;
const RIM = { y: 112, outer: 182, inner: 160, tilt: 0.15, height: 16 };
const GROUND = 310;

// The tub's side, left half: under the rim, down and round its bottom.
const side: Point[] = [
  { x: CX - RIM.outer, y: RIM.y },
  { x: CX - RIM.outer, y: RIM.y + RIM.height },
  { x: 16, y: 132 },
  ...cubic(
    { x: 16, y: 132 },
    { x: 16, y: 212 },
    { x: 40, y: 262 },
    { x: 110, y: 268 },
    14,
  ),
  ...cubic(
    { x: 110, y: 268 },
    { x: 140, y: 270 },
    { x: 170, y: 270 },
    { x: CX, y: 270 },
    4,
  ),
];
// The tub down to the ground, its feet taken as part of it.
const silhouette: Point[] = [
  ...side.filter(({ y }) => y < 250),
  { x: 36, y: 296 },
  { x: 32, y: GROUND },
  { x: CX, y: GROUND },
];

// The inside, left half: the opening in the rim, down and round the bottom.
const inside: Point[] = [
  { x: CX - RIM.inner, y: RIM.y },
  { x: 32, y: 130 },
  ...cubic(
    { x: 32, y: 130 },
    { x: 32, y: 200 },
    { x: 54, y: 244 },
    { x: 118, y: 250 },
    14,
  ),
  ...cubic(
    { x: 118, y: 250 },
    { x: 150, y: 252 },
    { x: 170, y: 252 },
    { x: CX, y: 252 },
    4,
  ),
];

const lip = rim(CX, RIM.y, RIM.outer, RIM.inner, RIM.tilt, RIM.height, {
  top: "mainLight",
  face: "main",
  shade: "mainDark",
});
// Where the rim's face is at x: its top and its bottom.
const faceTop = (x: number) =>
  RIM.y +
  RIM.outer *
    RIM.tilt *
    Math.sqrt(Math.max(0, 1 - ((x - CX) / RIM.outer) ** 2));

// A claw foot: a gold leg curving out from under the tub to a round paw. The right one is its
// mirror.
const leg = `M58 252C54 270 40 280 38 296L64 296C66 284 78 274 88 258Z`;
const foot = `${part(leg, "trim", "trimDark", 5)}
  <ellipse cx="50" cy="${GROUND - 9}" rx="17" ry="9" fill="var(--trim)" stroke="var(--line)" stroke-width="4"/>
  <path d="M42 ${GROUND - 13}V${GROUND - 4}M51 ${GROUND - 15}V${GROUND - 3}M60 ${GROUND - 13}V${GROUND - 4}" stroke="var(--trim-dark)" stroke-width="2.5" stroke-linecap="round"/>`;
const feet = `${foot}<g transform="matrix(-1 0 0 1 ${WIDTH} 0)">${foot}</g>`;

// Foam spilling over the rim's front, in clumps of bubbles.
const foamAt: [number, number, number][] = [
  [26, 4, 15],
  [50, 10, 19],
  [92, 12, 13],
  [118, 14, 17],
  [168, 16, 12],
  [206, 16, 18],
  [248, 14, 13],
  [286, 12, 19],
  [326, 9, 14],
  [354, 4, 16],
];
const foam = foamAt
  .map(([x, dy, r]) => {
    const y = faceTop(x) + RIM.height / 2 + dy;
    return `<circle cx="${x}" cy="${num(y)}" r="${r}" fill="#fff" stroke="var(--line)" stroke-width="4"/>`;
  })
  .join("");
// The bubbles' shine, drawn after them all so no bubble covers another's.
const foamShine = foamAt
  .map(([x, dy, r]) => {
    const y = faceTop(x) + RIM.height / 2 + dy;
    return `<circle cx="${num(x - r * 0.35)}" cy="${num(y - r * 0.35)}" r="${num(r * 0.22)}" fill="var(--main-light)"/>`;
  })
  .join("");
// Bubbles floating up from the bath, behind the gifts.
const floating = [
  [104, 62, 9],
  [150, 30, 6],
  [228, 44, 12],
  [276, 74, 7],
  [196, 4, 5],
]
  .map(
    ([x, y, r]) =>
      `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" fill-opacity=".25" stroke="#fff" stroke-opacity=".8" stroke-width="2.5"/><circle cx="${num(x - r * 0.35)}" cy="${num(y - r * 0.35)}" r="${num(r * 0.25)}" fill="#fff"/>`,
  )
  .join("");

// The tap at the far end: a gold pipe up from behind the rim, bent over into a spout, with a
// handle and a drop of water.
const pipe = `M44 ${RIM.y - 2}V52Q44 34 62 34H80Q90 34 90 44V50`;
const tap = `<path d="${pipe}" fill="none" stroke="var(--line)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${pipe}" fill="none" stroke="var(--trim)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  ${highlight("M40 98V54", 2.5, 0.6)}
  ${dot(44, 74, 9, "trimLight")}
  <path d="M90 60Q96 70 90 74Q84 70 90 60Z" fill="#9ad8ff" stroke="var(--line)" stroke-width="2.5" stroke-linejoin="round"/>`;

// A rubber duck sitting on the rim's right end, looking into the tub.
const duck = `<ellipse cx="364" cy="${RIM.y - 14}" rx="24" ry="16" fill="#ffd84a" stroke="var(--line)" stroke-width="4.5"/>
  <path d="M372 ${RIM.y - 18}Q382 ${RIM.y - 8} 368 ${RIM.y - 6}" fill="none" stroke="#e8a317" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="352" cy="${RIM.y - 36}" r="14" fill="#ffd84a" stroke="var(--line)" stroke-width="4.5"/>
  <path d="M340 ${RIM.y - 38}Q328 ${RIM.y - 36} 330 ${RIM.y - 31}Q336 ${RIM.y - 28} 342 ${RIM.y - 31}Z" fill="#ff8f3d" stroke="var(--line)" stroke-width="3.5" stroke-linejoin="round"/>
  <circle cx="348" cy="${RIM.y - 40}" r="2.6" fill="var(--line)"/>
  <circle cx="355" cy="${RIM.y - 44}" r="3" fill="#fff" fill-opacity=".8"/>`;

export const tub = vessel({
  id: "tub",
  label: "Bubble bath",
  palette: { main: "#5fb3d9", trim: "#f2c14e" },
  width: WIDTH,
  height: HEIGHT,
  inside,
  silhouette,
  bodyTop: 130,
  bubbleY: 200,
  leftmost: leftEdge(silhouette),
  ground: { y: GROUND, rx: 190 },
  back: `${fill(lip.hollow(inside), "mainDeep")}
    ${tap}
    ${lip.back}
    ${floating}`,
  front: `${feet}
    ${shell(side, inside, WIDTH)}
    ${highlight(pathOf(side.filter(({ y }) => y > 150 && y < 240).map(({ x, y }) => ({ x: x + 9, y }))), 4, 0.45)}
    ${lip.front}
    ${foam}
    ${foamShine}
    ${duck}`,
});
