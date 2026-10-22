// A treasure chest: a wooden box with gold corners, two gold straps across its front and a lock,
// on gold feet. Its lid stands open behind the gifts, showing its inside.
import {
  dot,
  fill,
  highlight,
  leftEdge,
  outline,
  part,
  symmetric,
  vessel,
} from "./art";
import { cubic } from "./geometry";
import type { Point } from "./types";

const WIDTH = 380;
const HEIGHT = 402;
const CX = WIDTH / 2;
// The box, its posts and rails, and where it stands.
const BOX = { left: 12, top: 178, bottom: 370 };
const POST = 26;
const TOP_RAIL = 22;
const BOTTOM_RAIL = 20;
const GROUND = 392;
const FLOOR = BOX.bottom - BOTTOM_RAIL;
const IN = BOX.left + POST;

// The inside, left half, from the opening at the box's top down to the floor.
const inside: Point[] = [
  { x: IN, y: BOX.top },
  { x: IN, y: FLOOR - 10 },
  ...cubic(
    { x: IN, y: FLOOR - 10 },
    { x: IN, y: FLOOR },
    { x: IN, y: FLOOR },
    { x: IN + 10, y: FLOOR },
    3,
  ),
  { x: CX, y: FLOOR },
];
// The box down to the ground, its feet taken as part of it.
const silhouette: Point[] = [
  { x: BOX.left, y: BOX.top },
  { x: BOX.left, y: GROUND },
  { x: CX, y: GROUND },
];

// The frame: the box with the window under the top rail cut out.
const box = `M${BOX.left} ${BOX.top}H${WIDTH - BOX.left}V${BOX.bottom - 8}Q${WIDTH - BOX.left} ${BOX.bottom} ${WIDTH - BOX.left - 8} ${BOX.bottom}H${BOX.left + 8}Q${BOX.left} ${BOX.bottom} ${BOX.left} ${BOX.bottom - 8}Z`;
const pane = symmetric(
  [{ x: IN, y: BOX.top + TOP_RAIL }, ...inside.slice(1)],
  WIDTH,
);
const frame = `${box} ${pane}`;
// Grooves between the planks of the rails and posts.
const grooves = [
  `M${BOX.left + 6} ${BOX.top + 11}H${WIDTH - BOX.left - 6}`,
  `M${BOX.left + 6} ${BOX.bottom - 10}H${WIDTH - BOX.left - 6}`,
  `M${BOX.left + 13} ${BOX.top + TOP_RAIL + 4}V${BOX.bottom - BOTTOM_RAIL - 4}`,
  `M${WIDTH - BOX.left - 13} ${BOX.top + TOP_RAIL + 4}V${BOX.bottom - BOTTOM_RAIL - 4}`,
]
  .map(
    (d) =>
      `<path d="${d}" stroke="var(--main-dark)" stroke-width="2.5" stroke-linecap="round"/>`,
  )
  .join("");

// The lid, open and standing behind the box: its inside, in a gold edging.
const lidEdge = `M24 172V96Q24 42 ${CX} 40Q${WIDTH - 24} 42 ${WIDTH - 24} 96V172Z`;
const lidInside = `M38 172V100Q38 58 ${CX} 56Q${WIDTH - 38} 58 ${WIDTH - 38} 100V172Z`;
const lidPlanks = [84, 118, 150]
  .map(
    (y) =>
      `<path d="M40 ${y}H${WIDTH - 40}" stroke="var(--main-deep)" stroke-width="3" stroke-linecap="round"/>`,
  )
  .join("");
// The back of the box's top, seen over the opening.
const backRail = `M20 166H${WIDTH - 20}V${BOX.top}H20Z`;
// The planks of the box's back wall, seen through the window.
const backPlanks = [232, 280, 326]
  .map(
    (y) =>
      `<path d="M${IN + 4} ${y}H${WIDTH - IN - 4}" stroke="var(--main-dark)" stroke-opacity=".55" stroke-width="3"/>`,
  )
  .join("");

// Two gold straps over the front, with rivets at their ends.
const strapX = [CX - 92, CX + 92];
const straps = strapX
  .map((x) => {
    const d = `M${x - 12} ${BOX.top - 6}H${x + 12}V${BOX.bottom + 4}H${x - 12}Z`;
    return `${part(d, "trim", "trimDark", 5)}${dot(x, BOX.top + 6, 4, "trimLight")}${dot(x, BOX.bottom - 8, 4, "trimLight")}${highlight(`M${x - 6} ${BOX.top + 18}V${BOX.top + 60}`, 3, 0.6)}`;
  })
  .join("");

// Gold corners, the right ones mirrored.
const corner = (d: string) =>
  `${part(d, "trim", "trimDark", 4)}<g transform="matrix(-1 0 0 1 ${WIDTH} 0)">${part(d, "trim", "trimDark", 4)}</g>`;
const corners =
  corner(`M7 173H54V196H32V222H7Z`) +
  corner(`M7 ${BOX.bottom + 4}H54V${BOX.bottom - 18}H32V${BOX.bottom - 44}H7Z`);

// The lock's plate on the top rail, and its keyhole.
const lock = `M${CX - 24} ${BOX.top - 8}H${CX + 24}V${BOX.top + 30}Q${CX} ${BOX.top + 48} ${CX - 24} ${BOX.top + 30}Z`;
const keyhole = `M${CX} ${BOX.top + 6}a6 6 0 0 1 3.5 10.9L${CX + 5} ${BOX.top + 28}H${CX - 5}L${CX - 3.5} ${BOX.top + 16.9}A6 6 0 0 1 ${CX} ${BOX.top + 6}Z`;

const foot = `M18 ${BOX.bottom - 2}H60V${GROUND - 9}Q60 ${GROUND} 51 ${GROUND}H27Q18 ${GROUND} 18 ${GROUND - 9}Z`;

export const chest = vessel({
  id: "chest",
  label: "Treasure chest",
  palette: { main: "#9b6235", trim: "#f5c242" },
  width: WIDTH,
  height: HEIGHT,
  inside,
  silhouette,
  bodyTop: 190,
  bubbleY: 270,
  leftmost: leftEdge(silhouette),
  ground: { y: GROUND, rx: 196 },
  back: `${part(lidEdge, "trim", "trimDark", 6)}
    ${part(lidInside, "mainDark", "mainDeep", 10)}
    ${lidPlanks}
    ${highlight(`M30 150V100Q30 52 ${CX - 60} 48`, 3, 0.55)}
    ${part(backRail, "main", "mainDark", 4)}
    ${fill(symmetric(inside, WIDTH), "mainDeep")}
    ${backPlanks}`,
  front: `${part(foot, "trim", "trimDark", 5)}
    <g transform="matrix(-1 0 0 1 ${WIDTH} 0)">${part(foot, "trim", "trimDark", 5)}</g>
    ${part(frame, "main", "mainDark", 9)}
    ${grooves}
    ${outline(pane)}
    ${highlight(`M${BOX.left + 5} ${BOX.top + 5}H${CX - 50}`, 3, 0.5)}
    ${straps}
    ${corners}
    ${part(lock, "trim", "trimDark", 5)}
    ${fill(keyhole, "line")}`,
});
