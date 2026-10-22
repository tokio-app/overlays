// A piggy bank, seen from the front: a round pink pig with a gold coin slot on top, floppy ears,
// a face painted on its belly, stubby legs and a curly tail, and a coin on the floor.
import {
  around,
  fill,
  highlight,
  leftAngle,
  leftEdge,
  part,
  rim,
  shell,
  vessel,
} from "./art";
import { pathOf } from "./geometry";
import type { Point } from "./types";

const WIDTH = 380;
const HEIGHT = 372;
const CX = WIDTH / 2;
// The body, outside and in, cut flat on top where the slot is.
const BODY = { cy: 208, rx: 168, ry: 132 };
const HOLLOW = { rx: 152, ry: 116 };
const SLOT = { y: 96, outer: 92, inner: 74, tilt: 0.24, height: 13 };
const GROUND = 362;

// Where the slot's inside meets the body's inside.
const slotEnd =
  BODY.cy - HOLLOW.ry * Math.sqrt(1 - (SLOT.inner / HOLLOW.rx) ** 2);

// The body's outside, left half: under the slot, round to the bottom.
const body: Point[] = [
  { x: CX - SLOT.outer, y: SLOT.y },
  { x: CX - SLOT.outer, y: SLOT.y + SLOT.height },
  ...around(
    CX,
    BODY.cy,
    BODY.rx,
    BODY.ry,
    leftAngle(BODY.cy, BODY.ry, SLOT.y + SLOT.height),
    90,
    36,
  ),
];
// The body down to the ground, its legs taken as part of it.
const silhouette: Point[] = [
  ...body.filter(({ y }) => y < 294),
  { x: 76, y: 296 },
  { x: 78, y: GROUND },
  { x: CX, y: GROUND },
];

// The inside, left half: down the slot, then round the body's inside to its bottom.
const inside: Point[] = [
  { x: CX - SLOT.inner, y: SLOT.y },
  ...around(
    CX,
    BODY.cy,
    HOLLOW.rx,
    HOLLOW.ry,
    leftAngle(BODY.cy, HOLLOW.ry, slotEnd),
    90,
    36,
  ),
];

const slot = rim(CX, SLOT.y, SLOT.outer, SLOT.inner, SLOT.tilt, SLOT.height, {
  top: "trimLight",
  face: "trim",
  shade: "trimDark",
});

// A floppy ear on the left of the head, and its darker inside. The right one is its mirror.
const ear = `${part("M98 100Q78 54 40 58Q48 98 62 128Z", "main", "mainDark", 6)}
  ${fill("M88 104Q72 72 50 68Q58 96 68 118Z", "mainDark")}`;
const ears = `${ear}<g transform="matrix(-1 0 0 1 ${WIDTH} 0)">${ear}</g>`;

// Stubby legs out from under the belly, each with a dark split hoof: the back ones darker and a
// little higher, further away. Their tops follow the band between the body's inside and outside,
// as anything under the body shows where the gifts do.
function leg(
  left: number,
  right: number,
  top: [number, number],
  bottom: number,
  tone: "main" | "mainDark",
): string {
  const hoof = bottom - 12;
  const middle = (left + right) / 2;
  const shape = `M${left} ${top[0]}L${right} ${top[1]}L${right - 1} ${bottom - 10}Q${right - 2} ${bottom} ${right - 12} ${bottom}H${left + 12}Q${left + 2} ${bottom} ${left + 1} ${bottom - 10}Z`;
  const cap = `M${left + 0.9} ${hoof}H${right - 0.9}L${right - 1} ${bottom - 10}Q${right - 2} ${bottom} ${right - 12} ${bottom}H${left + 12}Q${left + 2} ${bottom} ${left + 1} ${bottom - 10}Z`;
  return `${part(shape, tone, tone === "main" ? "mainDark" : "mainDeep", 6)}
    ${part(cap, "mainDeep")}
    <path d="M${middle} ${hoof + 3}V${bottom - 2}" stroke="var(--line)" stroke-width="3" stroke-linecap="round"/>`;
}
const legPair = `${leg(76, 116, [294, 316], GROUND - 6, "mainDark")}
  ${leg(124, 168, [320, 330], GROUND, "main")}`;
const legs = `${legPair}<g transform="matrix(-1 0 0 1 ${WIDTH} 0)">${legPair}</g>`;

// A curly tail out of the right side.
const tailPath = `M352 262C372 268 382 248 370 240C360 234 356 250 368 252`;
const tail = `<path d="${tailPath}" fill="none" stroke="var(--line)" stroke-width="10" stroke-linecap="round"/>
  <path d="${tailPath}" fill="none" stroke="var(--main)" stroke-width="4.5" stroke-linecap="round"/>`;

// The face, painted on the belly over the gifts: eyes, blushing cheeks, the snout and a smile.
const eye = (x: number) =>
  `<ellipse cx="${x}" cy="176" rx="9" ry="12" fill="var(--line)"/><circle cx="${x + 3}" cy="171" r="3.2" fill="#fff"/>`;
const snout = `M${CX - 46} 238A46 31 0 1 1 ${CX + 46} 238A46 31 0 1 1 ${CX - 46} 238Z`;
const nostril = (x: number) =>
  `<ellipse cx="${x}" cy="238" rx="7" ry="11" fill="var(--main-deep)"/>`;
const face = `${eye(CX - 56)}${eye(CX + 56)}
  <ellipse cx="${CX - 96}" cy="222" rx="18" ry="10" fill="var(--main-dark)" fill-opacity=".55"/>
  <ellipse cx="${CX + 96}" cy="222" rx="18" ry="10" fill="var(--main-dark)" fill-opacity=".55"/>
  ${part(snout, "mainLight", "main", 6)}
  ${nostril(CX - 16)}${nostril(CX + 16)}
  ${highlight(`M${CX - 30} 222Q${CX - 20} 214 ${CX - 6} 214`, 3, 0.6)}
  <path d="M${CX - 14} 282Q${CX} 292 ${CX + 14} 282" fill="none" stroke="var(--line)" stroke-width="4" stroke-linecap="round"/>`;

// A coin that missed the slot, standing on the floor between the front legs.
const coin = `<ellipse cx="${CX}" cy="${GROUND - 16}" rx="13" ry="15" fill="var(--trim)" stroke="var(--line)" stroke-width="4"/>
  <ellipse cx="${CX}" cy="${GROUND - 16}" rx="7" ry="9" fill="none" stroke="var(--trim-dark)" stroke-width="2.5"/>`;

export const piggy = vessel({
  id: "piggy",
  label: "Piggy bank",
  palette: { main: "#f59ac0", trim: "#ffcf4a" },
  width: WIDTH,
  height: HEIGHT,
  inside,
  silhouette,
  bodyTop: 130,
  bubbleY: BODY.cy,
  leftmost: leftEdge(silhouette),
  ground: { y: GROUND, rx: 160 },
  back: `${fill(slot.hollow(inside), "mainDeep")}
    ${slot.back}`,
  front: `${legs}
    ${tail}
    ${shell(body, inside, WIDTH, 12)}
    ${highlight(pathOf(around(CX, BODY.cy, BODY.rx - 10, BODY.ry - 10, 196, 232, 12)), 5, 0.45)}
    ${ears}
    ${face}
    ${slot.front}
    ${coin}`,
});
