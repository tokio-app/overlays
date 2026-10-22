// A moon cup: a violet cup with a silver rim, a silver band with a gem round its waist, crescent
// moons on the rim's ends and stars about it, on a silver stem and foot. Inside, a night sky.
import {
  crescent,
  dot,
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
const HEIGHT = 450;
const CX = WIDTH / 2;
const RIM = { y: 62, outer: 162, inner: 134, tilt: 0.12, height: 14 };
const WAIST = { top: 184, bottom: 212 };
const GROUND = 440;

// The cup's outside, left half: under the rim, in to the waist, out to the belly and round to the
// stem.
const cup: Point[] = [
  { x: CX - RIM.outer, y: RIM.y },
  { x: CX - RIM.outer, y: RIM.y + RIM.height },
  { x: 34, y: 80 },
  ...cubic(
    { x: 34, y: 80 },
    { x: 38, y: 150 },
    { x: 58, y: 168 },
    { x: 58, y: 198 },
    12,
  ),
  ...cubic(
    { x: 58, y: 198 },
    { x: 58, y: 238 },
    { x: 32, y: 260 },
    { x: 32, y: 300 },
    12,
  ),
  ...cubic(
    { x: 32, y: 300 },
    { x: 32, y: 354 },
    { x: 108, y: 376 },
    { x: 156, y: 376 },
    14,
  ),
];
// The foot, from under the stem's ring out to its rim and down to the ground.
const foot: Point[] = [
  { x: 160, y: 404 },
  ...cubic(
    { x: 160, y: 404 },
    { x: 156, y: 420 },
    { x: 110, y: 424 },
    { x: 70, y: 428 },
    10,
  ),
  ...cubic(
    { x: 70, y: 428 },
    { x: 62, y: 429 },
    { x: 62, y: GROUND },
    { x: 72, y: GROUND },
    4,
  ),
];
const silhouette: Point[] = [
  ...cup,
  { x: 158, y: 382 },
  { x: 146, y: 384 },
  { x: 146, y: 402 },
  ...foot,
  { x: CX, y: GROUND },
];

// The inside, left half: the opening at the rim, the waist, the belly and the floor, about 24
// units in from the outside.
const inside: Point[] = [
  { x: CX - RIM.inner, y: RIM.y },
  { x: CX - RIM.inner, y: 80 },
  ...cubic(
    { x: 56, y: 80 },
    { x: 60, y: 140 },
    { x: 82, y: 170 },
    { x: 82, y: 198 },
    12,
  ),
  ...cubic(
    { x: 82, y: 198 },
    { x: 82, y: 238 },
    { x: 56, y: 262 },
    { x: 56, y: 300 },
    12,
  ),
  ...cubic(
    { x: 56, y: 300 },
    { x: 56, y: 336 },
    { x: 116, y: 352 },
    { x: CX, y: 352 },
    14,
  ),
];

const lip = rim(CX, RIM.y, RIM.outer, RIM.inner, RIM.tilt, RIM.height, {
  top: "trimLight",
  face: "trim",
  shade: "trimDark",
});

// The band round the waist, a little proud of the cup, curving with it.
const bandLeft = 52;
const bandCurve = 10;
const band = `M${bandLeft} ${WAIST.top}A${CX - bandLeft} ${bandCurve} 0 0 0 ${WIDTH - bandLeft} ${WAIST.top}L${WIDTH - bandLeft} ${WAIST.bottom}A${CX - bandLeft} ${bandCurve} 0 0 1 ${bandLeft} ${WAIST.bottom}Z`;
const bandY = (x: number, y: number) =>
  y + bandCurve * Math.sqrt(Math.max(0, 1 - ((x - CX) / (CX - bandLeft)) ** 2));
const middle = (WAIST.top + WAIST.bottom) / 2;
const gemY = bandY(CX, middle);
const gem = `M${CX} ${num(gemY - 27)}L${CX + 20} ${num(gemY)}L${CX} ${num(gemY + 27)}L${CX - 20} ${num(gemY)}Z`;
const studs = [62, 112]
  .flatMap((u) => [CX - u, CX + u])
  .map((x) => dot(x, bandY(x, middle), 4.5, "trimLight"))
  .join("");
// A fine line along the band's middle, either side of the gem.
const groove = [-1, 1]
  .map((sign) => {
    const xs = [CX + sign * 28, CX + sign * 134];
    return `<path d="M${num(xs[0])} ${num(bandY(xs[0], middle))}L${num(xs[1])} ${num(bandY(xs[1], middle))}" stroke="var(--trim-dark)" stroke-width="2" stroke-dasharray="1 9" stroke-linecap="round"/>`;
  })
  .join("");

const stem = symmetric(
  [
    { x: 158, y: 370 },
    { x: 160, y: 410 },
    { x: CX, y: 410 },
  ],
  WIDTH,
);
// A ring round the stem, with rounded ends.
const knot = `M146 383H234A9.5 9.5 0 0 1 234 402H146A9.5 9.5 0 0 1 146 383Z`;
const footShape = symmetric(foot.concat({ x: CX, y: GROUND }), WIDTH);
// Curls on the foot's ends.
const curl = `M74 432a7 7 0 1 1 9 -8`;

// A crescent moon on each end of the rim, its back to the cup and its horns out.
const moon = crescent(26, 52, 36, -15, -4, 31);
const moonParts = `${part(moon, "trim", "trimDark", 6)}${highlight("M44 34Q55 50 47 72", 3.5, 0.6)}`;
const moons = `${moonParts}<g transform="matrix(-1 0 0 1 ${WIDTH} 0)">${moonParts}</g>`;

// Faint stars in the night inside, under the gifts.
const night = [
  [112, 122, 7],
  [252, 108, 5],
  [288, 164, 8],
  [104, 248, 6],
  [196, 268, 9],
  [276, 300, 6],
  [150, 320, 5],
]
  .map(([x, y, r]) => sparkle(x, y, r, "trimLight", false))
  .join("");

// Light down the cup's left side, broken at the band.
const shine = (y0: number, y1: number) =>
  highlight(
    pathOf(
      cup
        .filter(({ y }) => y > y0 && y < y1)
        .map(({ x, y }) => ({ x: x + 10, y })),
    ),
    4,
    0.5,
  );

const right = (x: number) => mirror(WIDTH)({ x, y: 0 }).x;

export const moonCup = vessel({
  id: "moon",
  label: "Moon cup",
  palette: { main: "#7048d8", trim: "#e6e0f5" },
  width: WIDTH,
  height: HEIGHT,
  inside,
  silhouette,
  bodyTop: 110,
  bubbleY: 300,
  leftmost: leftEdge(silhouette),
  ground: { y: GROUND, rx: 150 },
  back: `${fill(lip.hollow(inside), "mainDeep")}
    <g opacity=".45">${night}</g>
    ${lip.back}`,
  front: `${shell(cup.concat({ x: CX, y: 376 }), inside, WIDTH)}
    ${shine(100, 178)}
    ${shine(226, 330)}
    ${sparkle(46, 254, 6, "trimLight")}
    ${sparkle(right(46), 254, 6, "trimLight")}
    ${part(band, "trim", "trimDark", 5)}
    ${groove}
    ${studs}
    ${part(gem, "mainLight", "main", 7)}
    ${highlight(`M${CX - 10} ${num(gemY - 11)}L${CX - 3} ${num(gemY - 19)}`, 3, 0.85)}
    ${part(stem, "trim", "trimDark", 5)}
    ${part(knot, "trimLight", "trim", 5)}
    ${part(footShape, "trim", "trimDark", 7)}
    <path d="${curl}" fill="none" stroke="var(--main)" stroke-width="4" stroke-linecap="round"/>
    <path d="${curl}" transform="matrix(-1 0 0 1 ${WIDTH} 0)" fill="none" stroke="var(--main)" stroke-width="4" stroke-linecap="round"/>
    ${lip.front}
    ${moons}
    ${sparkle(10, 150, 10)}
    ${sparkle(right(14), 120, 12)}
    ${sparkle(8, 372, 7)}
    ${sparkle(right(18), 360, 9)}
    ${sparkle(44, 0, 7)}
    ${sparkle(right(48), 8, 6)}`,
});
