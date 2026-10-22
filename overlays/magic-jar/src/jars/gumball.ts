// A gumball machine: a glass globe on a red stand with a coin knob and a chute, the gifts its
// gumballs. Its cap has been knocked off and lies on the floor, and one gumball rolled out.
import {
  around,
  dot,
  fill,
  highlight,
  leftAngle,
  leftEdge,
  part,
  rim,
  uid,
  vessel,
} from "./art";
import { num, pathOf } from "./geometry";
import type { Point } from "./types";

const WIDTH = 380;
const HEIGHT = 480;
const CX = WIDTH / 2;
const GLOBE = { cy: 196, outer: 150, inner: 140 };
// The metal collar the cap screwed onto, now the opening.
const NECK = { y: 52, outer: 80, inner: 66, tilt: 0.18, height: 22 };
const STAND = { top: 326, bottom: 468, upper: 92, lower: 120 };
const GROUND = STAND.bottom;

// Where the neck's inside meets the globe's, and its outside the globe's outside.
const neckEnd = GLOBE.cy - Math.sqrt(GLOBE.inner ** 2 - NECK.inner ** 2);
const collarEnd = NECK.y + NECK.height;

// The inside, left half: down the neck, then round the globe to its bottom.
const inside: Point[] = [
  { x: CX - NECK.inner, y: NECK.y },
  ...around(
    CX,
    GLOBE.cy,
    GLOBE.inner,
    GLOBE.inner,
    leftAngle(GLOBE.cy, GLOBE.inner, neckEnd),
    90,
    32,
  ),
];
// The outside, left half: the collar, round the globe down to the stand, and the stand down to
// the ground.
const silhouette: Point[] = [
  { x: CX - NECK.outer, y: NECK.y },
  { x: CX - NECK.outer, y: collarEnd },
  ...around(
    CX,
    GLOBE.cy,
    GLOBE.outer,
    GLOBE.outer,
    leftAngle(GLOBE.cy, GLOBE.outer, collarEnd),
    leftAngle(GLOBE.cy, GLOBE.outer, STAND.top),
    24,
  ),
  { x: CX - STAND.upper, y: STAND.top + 4 },
  { x: CX - STAND.lower, y: GROUND },
  { x: CX, y: GROUND },
];

const neck = rim(CX, NECK.y, NECK.outer, NECK.inner, NECK.tilt, NECK.height, {
  top: "trimLight",
  face: "trim",
  shade: "trimDark",
});

// The glass: a clear ring round the gifts, open under the neck.
const open = uid();
const circle = (r: number) =>
  `M${CX - r} ${GLOBE.cy}A${r} ${r} 0 1 1 ${CX + r} ${GLOBE.cy}A${r} ${r} 0 1 1 ${CX - r} ${GLOBE.cy}Z`;
const glass = `<clipPath id="${open}"><path d="M-60 -60H${WIDTH + 60}V${HEIGHT + 60}H-60Z M${CX - NECK.outer} -60H${CX + NECK.outer}V${collarEnd}H${CX - NECK.outer}Z" clip-rule="evenodd"/></clipPath>
  <g clip-path="url(#${open})">
    ${fill(`${circle(GLOBE.outer)} ${circle(GLOBE.inner)}`, "white", 0.3)}
    <path d="${circle(GLOBE.outer)}" fill="none" stroke="var(--line)" stroke-width="4.5"/>
    <path d="${circle(GLOBE.inner)}" fill="none" stroke="var(--line)" stroke-opacity=".35" stroke-width="2"/>
  </g>`;
// Light on the glass: a long soft curve on the upper left, a short sharp one and a glint, and a
// faint one low on the right.
const shine = (r: number, from: number, to: number) =>
  pathOf(around(CX, GLOBE.cy, r, r, from, to, 16));
const glints = `${highlight(shine(122, 196, 238), 12, 0.35)}
  ${highlight(shine(122, 246, 256), 6, 0.6)}
  <circle cx="${num(CX + 122 * Math.cos((262 * Math.PI) / 180))}" cy="${num(GLOBE.cy + 122 * Math.sin((262 * Math.PI) / 180))}" r="4" fill="#fff" fill-opacity=".7"/>
  ${highlight(shine(128, 18, 58), 5, 0.2)}`;

// The stand: a red body widening to the ground, a chrome collar the globe sits in, a coin plate
// with its slot and knob, and the chute.
const stand = `M${CX - STAND.upper} ${STAND.top}H${CX + STAND.upper}L${CX + STAND.lower} ${GROUND - 12}Q${CX + STAND.lower + 2} ${GROUND} ${CX + STAND.lower - 12} ${GROUND}H${CX - STAND.lower + 12}Q${CX - STAND.lower - 2} ${GROUND} ${CX - STAND.lower} ${GROUND - 12}Z`;
const collar = `M${CX - 98} ${STAND.top - 10}H${CX + 98}A8 8 0 0 1 ${CX + 106} ${STAND.top - 2}V${STAND.top + 6}A8 8 0 0 1 ${CX + 98} ${STAND.top + 14}H${CX - 98}A8 8 0 0 1 ${CX - 106} ${STAND.top + 6}V${STAND.top - 2}A8 8 0 0 1 ${CX - 98} ${STAND.top - 10}Z`;
const plate = `M${CX - 38} 364H${CX + 38}A10 10 0 0 1 ${CX + 48} 374V414A10 10 0 0 1 ${CX + 38} 424H${CX - 38}A10 10 0 0 1 ${CX - 48} 414V374A10 10 0 0 1 ${CX - 38} 364Z`;
const chute = `M${CX - 24} ${GROUND - 8}V${GROUND - 20}A24 14 0 0 1 ${CX + 24} ${GROUND - 20}V${GROUND - 8}Z`;
const machine = `${part(stand, "main", "mainDark", 10)}
  ${highlight(`M${CX - STAND.upper + 12} ${STAND.top + 24}L${CX - STAND.lower + 18} ${GROUND - 24}`, 4, 0.35)}
  ${part(plate, "trim", "trimDark", 5)}
  <rect x="${CX - 12}" y="372" width="24" height="5" rx="2.5" fill="var(--line)"/>
  ${dot(CX, 400, 15, "trimLight")}
  <path d="M${CX - 11} 400H${CX + 11}" stroke="var(--line)" stroke-width="5" stroke-linecap="round"/>
  ${part(chute, "mainDeep")}
  <path d="M${CX - 18} ${GROUND - 8}H${CX + 18}" stroke="var(--trim)" stroke-width="5" stroke-linecap="round"/>
  ${part(collar, "trim", "trimDark", 5)}`;

// The cap, knocked off onto the floor, and a gumball that rolled out of the chute.
const cap = `<g transform="translate(36 ${GROUND - 4}) rotate(-20)">
    ${part("M-32 0A32 24 0 0 1 32 0Z", "main", "mainDark", 6)}
    ${part("M-34 -2H34V6H-34Z", "trim", "trimDark", 3)}
    ${dot(0, -28, 7, "trim")}
    ${highlight("M-20 -10Q-16 -18 -6 -20", 3, 0.5)}
  </g>`;
const gumball = `<circle cx="${CX + 52}" cy="${GROUND - 9}" r="9" fill="#7dd3fc" stroke="var(--line)" stroke-width="4"/>
  <circle cx="${CX + 49}" cy="${GROUND - 12}" r="2.5" fill="#fff" fill-opacity=".8"/>`;

export const gumballMachine = vessel({
  id: "gumball",
  label: "Gumball machine",
  palette: { main: "#e63946", trim: "#d7dee8" },
  width: WIDTH,
  height: HEIGHT,
  inside,
  silhouette,
  bodyTop: 110,
  bubbleY: GLOBE.cy,
  leftmost: leftEdge(silhouette),
  ground: { y: GROUND, rx: 150 },
  back: `${fill(neck.hollow(inside), "white", 0.07)}
    ${neck.back}`,
  front: `${glass}
    ${glints}
    ${machine}
    ${neck.front}
    ${cap}
    ${gumball}`,
});
