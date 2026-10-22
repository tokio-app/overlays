// A witch's cauldron: a round iron pot with a thick rolled rim, on short legs. Its brew glows
// inside, bubbles rise from it, and a little has dripped over the rim.
import {
  fill,
  highlight,
  leftEdge,
  part,
  rim,
  shell,
  stop,
  uid,
  vessel,
} from "./art";
import { cubic, num, pathOf } from "./geometry";
import type { Point } from "./types";

const WIDTH = 380;
const HEIGHT = 408;
const CX = WIDTH / 2;
const RIM = { y: 112, outer: 160, inner: 128, tilt: 0.16, height: 20 };
const GROUND = 398;

// The pot's outside, left half: under the rim, the neck, out to the belly and round to the bottom.
const pot: Point[] = [
  { x: CX - RIM.outer, y: RIM.y },
  { x: CX - RIM.outer, y: RIM.y + RIM.height },
  { x: 46, y: 136 },
  ...cubic(
    { x: 46, y: 136 },
    { x: 26, y: 152 },
    { x: 8, y: 196 },
    { x: 8, y: 252 },
    12,
  ),
  ...cubic(
    { x: 8, y: 252 },
    { x: 8, y: 330 },
    { x: 98, y: 374 },
    { x: CX, y: 374 },
    16,
  ),
];
// The pot down to the ground, its legs taken as part of it.
const silhouette: Point[] = [
  ...pot.filter(({ y }) => y < 344),
  { x: 52, y: GROUND },
  { x: CX, y: GROUND },
];

// The inside, left half: the opening at the rim, the neck, the belly and the floor.
const inside: Point[] = [
  { x: CX - RIM.inner, y: RIM.y },
  { x: CX - RIM.inner, y: 136 },
  ...cubic(
    { x: 62, y: 136 },
    { x: 46, y: 152 },
    { x: 28, y: 196 },
    { x: 28, y: 252 },
    12,
  ),
  ...cubic(
    { x: 28, y: 252 },
    { x: 28, y: 318 },
    { x: 108, y: 354 },
    { x: CX, y: 354 },
    16,
  ),
];

const lip = rim(CX, RIM.y, RIM.outer, RIM.inner, RIM.tilt, RIM.height, {
  top: "mainLight",
  face: "main",
  shade: "mainDark",
});
// Where the rim's face ends at x, so drips hang from it.
const faceBottom = (x: number) =>
  RIM.y +
  RIM.height +
  RIM.outer *
    RIM.tilt *
    Math.sqrt(Math.max(0, 1 - ((x - CX) / RIM.outer) ** 2));

// A stubby leg, splayed a little; the right one is its mirror. Its top stays under the pot's
// side, as anything under the pot shows through where the gifts do.
const leg = `M68 348L54 ${GROUND - 6}Q52 ${GROUND} 60 ${GROUND}H96Q104 ${GROUND} 104 ${GROUND - 8}L112 360Z`;
const legs = `${part(leg, "mainDark", "mainDeep", 6)}<g transform="matrix(-1 0 0 1 ${WIDTH} 0)">${part(leg, "mainDark", "mainDeep", 6)}</g>`;

// The brew's glow, brightest at its surface near the top.
const glow = uid();
const glowDefs = `<defs><radialGradient id="${glow}" cx=".5" cy=".12" r=".85">
  ${stop(0, "trim", 0.85)}
  ${stop(0.45, "trim", 0.28)}
  ${stop(1, "trim", 0)}
</radialGradient></defs>`;
// The inside and the opening over it, which the glow fills.
const lit = lip.hollow(inside);

// Bubbles rising from the brew, behind the gifts.
const bubbles = [
  [150, 86, 9],
  [214, 70, 13],
  [250, 98, 7],
  [124, 52, 6],
  [182, 30, 5],
]
  .map(
    ([x, y, r]) =>
      `<circle cx="${x}" cy="${y}" r="${r}" fill="var(--trim)" fill-opacity=".35" stroke="var(--trim-light)" stroke-width="2.5"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${num(r * 0.22)}" fill="#fff" fill-opacity=".8"/>`,
  )
  .join("");

// Brew dripped over the rim's front.
const drip = (x: number, length: number, width: number) => {
  const top = faceBottom(x) - 6;
  const half = width / 2;
  return `M${num(x - half)} ${num(top)}V${num(top + length - half)}A${num(half)} ${num(half)} 0 0 0 ${num(x + half)} ${num(top + length - half)}V${num(top)}Z`;
};
const drips = [drip(122, 26, 12), drip(236, 18, 10), drip(266, 30, 13)]
  .map((d) => part(d, "trim", "trimDark", 4))
  .join("");

export const cauldron = vessel({
  id: "cauldron",
  label: "Witch's cauldron",
  palette: { main: "#3d3650", trim: "#8ee36b" },
  width: WIDTH,
  height: HEIGHT,
  inside,
  silhouette,
  bodyTop: 160,
  bubbleY: 252,
  leftmost: leftEdge(pot),
  ground: { y: GROUND, rx: 176 },
  back: `${glowDefs}
    ${fill(lit, "mainDeep")}
    <path d="${lit}" fill="url(#${glow})" fill-rule="evenodd"/>
    ${lip.back}
    ${bubbles}`,
  front: `${legs}
    ${shell(pot, inside, WIDTH, 12)}
    ${highlight(pathOf(cubic({ x: 22, y: 210 }, { x: 22, y: 180 }, { x: 34, y: 160 }, { x: 52, y: 148 }, 8)), 5, 0.4)}
    ${highlight(pathOf(cubic({ x: 22, y: 262 }, { x: 22, y: 290 }, { x: 30, y: 312 }, { x: 42, y: 326 }, 8)), 4, 0.25)}
    ${lip.front}
    ${highlight(`M${CX - 140} ${num(faceBottom(CX - 140) - 14)}Q${CX - 90} ${num(faceBottom(CX - 90) - 10)} ${CX - 40} ${num(faceBottom(CX - 40) - 12)}`, 3.5, 0.45)}
    ${drips}`,
});
