// A golden trophy: a wide gold cup with two loop handles, on a stem with a knot and a two-step
// base with a plaque.
import {
  fill,
  highlight,
  leftEdge,
  mirror,
  part,
  rim,
  shell,
  sparkle,
  symmetric,
  vessel,
} from "./art";
import { cubic, num, pathOf } from "./geometry";
import type { Point } from "./types";

const WIDTH = 380;
const HEIGHT = 458;
const CX = WIDTH / 2;
const RIM = { y: 48, outer: 150, inner: 132, tilt: 0.12, height: 12 };
const GROUND = 448;
// The base's two steps, as half-widths, and the plaque on the lower one.
const STEP = { top: 356, middle: 378, upper: 80, lower: 112 };

// The cup's outside, left half: under the rim, curving in to the stem.
const cup: Point[] = [
  { x: CX - RIM.outer, y: RIM.y },
  { x: CX - RIM.outer, y: RIM.y + RIM.height },
  { x: 42, y: 62 },
  ...cubic(
    { x: 42, y: 62 },
    { x: 42, y: 200 },
    { x: 54, y: 262 },
    { x: 106, y: 292 },
    16,
  ),
  ...cubic(
    { x: 106, y: 292 },
    { x: 128, y: 304 },
    { x: 150, y: 308 },
    { x: 168, y: 310 },
    6,
  ),
];
// The stem, its knot and the base, down to the ground.
const stand: Point[] = [
  { x: 168, y: 322 },
  { x: 156, y: 324 },
  { x: 156, y: 340 },
  { x: 170, y: 342 },
  { x: 170, y: 346 },
  { x: CX - STEP.upper, y: STEP.top },
  { x: CX - STEP.upper, y: STEP.middle },
  { x: CX - STEP.lower, y: STEP.middle },
  { x: CX - STEP.lower, y: GROUND },
];
const silhouette: Point[] = [...cup, ...stand, { x: CX, y: GROUND }];

// The inside, left half: the opening at the rim and the cup's rounded bottom.
const inside: Point[] = [
  { x: CX - RIM.inner, y: RIM.y },
  { x: CX - RIM.inner, y: 62 },
  ...cubic(
    { x: 58, y: 62 },
    { x: 58, y: 192 },
    { x: 68, y: 246 },
    { x: 112, y: 272 },
    16,
  ),
  ...cubic(
    { x: 112, y: 272 },
    { x: 136, y: 284 },
    { x: 160, y: 288 },
    { x: CX, y: 288 },
    6,
  ),
];

const lip = rim(CX, RIM.y, RIM.outer, RIM.inner, RIM.tilt, RIM.height, {
  top: "mainLight",
  face: "main",
  shade: "mainDark",
});

const stem = symmetric(
  [
    { x: 168, y: 306 },
    { x: 170, y: 352 },
    { x: CX, y: 352 },
  ],
  WIDTH,
);
const knot = `M154 322H226A9 9 0 0 1 226 340H154A9 9 0 0 1 154 322Z`;
const neck = `M136 346Q${CX} 336 244 346L${CX + STEP.upper} ${STEP.top}H${CX - STEP.upper}Z`;
const upperStep = `M${CX - STEP.upper} ${STEP.top}H${CX + STEP.upper}V${STEP.middle}H${CX - STEP.upper}Z`;
const lowerStep = `M${CX - STEP.lower} ${STEP.middle}H${CX + STEP.lower}V${GROUND - 6}Q${CX + STEP.lower} ${GROUND} ${CX + STEP.lower - 6} ${GROUND}H${CX - STEP.lower + 6}Q${CX - STEP.lower} ${GROUND} ${CX - STEP.lower} ${GROUND - 6}Z`;
const plaque = `M${CX - 70} 394H${CX + 70}V430H${CX - 70}Z`;

// A loop handle on the cup's left; the right one is its mirror. A thick outlined tube, whose ends
// stay on the cup's side: anything under the cup shows through where the gifts do.
const handlePath = `M46 84C-4 78 -14 176 44 204`;
const handle = `<path d="${handlePath}" fill="none" stroke="var(--line)" stroke-width="22" stroke-linecap="round"/>
  <path d="${handlePath}" fill="none" stroke="var(--main-dark)" stroke-width="13" stroke-linecap="round"/>
  <path d="${handlePath}" fill="none" stroke="var(--main)" stroke-width="9" stroke-linecap="round" transform="translate(-1.5 -1.5)"/>
  ${highlight("M30 92C8 100 4 140 22 168", 3, 0.6)}`;
const handles = `${handle}<g transform="matrix(-1 0 0 1 ${WIDTH} 0)">${handle}</g>`;
// The handles' outer edge, for where the message may touch.
const handleEdge: Point[] = [
  { x: 30, y: 80 },
  { x: 2, y: 112 },
  { x: -2, y: 150 },
  { x: 14, y: 186 },
  { x: 60, y: 214 },
];

const right = (x: number) => mirror(WIDTH)({ x, y: 0 }).x;

export const trophy = vessel({
  id: "trophy",
  label: "Golden trophy",
  palette: { main: "#f3b63a", trim: "#3a3150" },
  width: WIDTH,
  height: HEIGHT,
  inside,
  silhouette,
  bodyTop: 100,
  bubbleY: 135,
  leftmost: leftEdge(silhouette, handleEdge),
  ground: { y: GROUND, rx: 140 },
  back: `${fill(lip.hollow(inside), "mainDeep")}
    ${lip.back}`,
  front: `${handles}
    ${shell(cup.concat({ x: CX, y: 310 }), inside, WIDTH)}
    ${highlight(pathOf(cup.filter(({ y }) => y > 76 && y < 220).map(({ x, y }) => ({ x: x + 11, y }))), 5, 0.55)}
    ${part(stem, "main", "mainDark", 5)}
    ${part(knot, "mainLight", "main", 5)}
    ${part(neck, "main", "mainDark", 5)}
    ${part(lowerStep, "trim", "trimDark", 8)}
    ${part(upperStep, "main", "mainDark", 6)}
    ${part(plaque, "main", "mainDark", 5)}
    ${sparkle(CX, 412, 11, "mainLight")}
    ${lip.front}
    ${sparkle(28, 30, 9, "mainLight")}
    ${sparkle(right(20), 52, 7, "mainLight")}
    ${sparkle(right(34), 250, 8, "mainLight")}
    ${highlight(`M${CX - 104} ${num(STEP.middle + 6)}H${CX - 40}`, 3, 0.35)}`,
});
