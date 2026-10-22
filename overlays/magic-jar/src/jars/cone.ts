// An ice cream cone: a waffle cone with a rolled rim, strawberry ice cream melting over it with
// sprinkles, and a cherry. The waffle's lattice crosses in front of the gifts; heaped over the
// rim, they're the scoop.
import {
  fill,
  leftEdge,
  part,
  rim,
  shell,
  symmetric,
  uid,
  vessel,
} from "./art";
import { num, pathOf } from "./geometry";
import type { Point } from "./types";

const WIDTH = 380;
const HEIGHT = 452;
const CX = WIDTH / 2;
const RIM = { y: 98, outer: 162, inner: 140, tilt: 0.13, height: 20 };
const TIP = 440;

// The cone's outside, left half: the rim, then straight down to its tip.
const silhouette: Point[] = [
  { x: CX - RIM.outer, y: RIM.y },
  { x: CX - RIM.outer, y: RIM.y + RIM.height },
  { x: 34, y: 122 },
  { x: CX, y: TIP },
];
// The inside, left half: the opening in the rim, then about 18 units in from the outside, down to
// a point.
const inside: Point[] = [
  { x: CX - RIM.inner, y: RIM.y },
  { x: 50, y: 114 },
  { x: CX, y: 399 },
];

const lip = rim(CX, RIM.y, RIM.outer, RIM.inner, RIM.tilt, RIM.height, {
  top: "mainLight",
  face: "main",
  shade: "mainDark",
});

// The cone under its rim, where the waffle shows.
const wall = symmetric(silhouette.slice(2), WIDTH);

// The waffle: two sets of crossing lines, over the gifts, inside the cone.
const clip = uid();
const lines = (angle: number) =>
  `<g transform="rotate(${angle} ${CX} 280)">${Array.from(
    { length: 17 },
    (_, i) =>
      `<path d="M-200 ${280 + (i - 8) * 40}H580" stroke="var(--main-dark)" stroke-width="6"/>`,
  ).join("")}</g>`;
const waffle = `<clipPath id="${clip}"><path d="${wall}"/></clipPath>
  <g clip-path="url(#${clip})">${lines(52)}${lines(-52)}</g>`;

// The ice cream melting over the rim's face: its top follows the face's middle, its bottom runs
// past the face and hangs in rounded drips.
const faceCurve = (x: number) =>
  RIM.outer *
  RIM.tilt *
  Math.sqrt(Math.max(0, 1 - ((x - CX) / RIM.outer) ** 2));
const drips = [
  { x: 76, length: 34, wide: 15 },
  { x: 150, length: 18, wide: 12 },
  { x: 214, length: 46, wide: 16 },
  { x: 290, length: 26, wide: 13 },
];
const hang = (x: number) =>
  Math.max(
    0,
    ...drips.map(
      ({ x: at, length, wide }) =>
        length * Math.sqrt(Math.max(0, 1 - ((x - at) / wide) ** 2)),
    ),
  );
const left = CX - RIM.outer + 2;
const right = CX + RIM.outer - 2;
const xs = Array.from(
  { length: 160 },
  (_, i) => left + ((right - left) * i) / 159,
);
const melt = `${pathOf(xs.map((x) => ({ x, y: RIM.y + 6 + faceCurve(x) })))} ${pathOf(
  [...xs]
    .reverse()
    .map((x) => ({ x, y: RIM.y + RIM.height + 5 + faceCurve(x) + hang(x) })),
  "L",
)}Z`;
// Sprinkles on the ice cream, in candy colors whatever the jar's: x, a nudge down, color, angle.
const sprinkles = (
  [
    [64, 0, "#ffd166", 30],
    [102, -1, "#7dd3fc", -40],
    [134, 1, "#fff", 70],
    [176, 0, "#86efac", -20],
    [204, 1, "#ffd166", 50],
    [246, 0, "#c4b5fd", -60],
    [276, 1, "#fff", 20],
    [312, 0, "#7dd3fc", -30],
  ] as const
)
  .map(([x, dy, color, angle]) => {
    const y = RIM.y + 15 + faceCurve(x) + dy;
    return `<rect x="${x - 5}" y="${num(y - 1.8)}" width="10" height="3.6" rx="1.8" fill="${color}" transform="rotate(${angle} ${x} ${num(y)})"/>`;
  })
  .join("");

// A cherry on the rim's right end, clear of the opening.
const cherry = `<path d="M346 84Q350 62 366 52" fill="none" stroke="var(--line)" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="344" cy="92" r="13" fill="#e8223a" stroke="var(--line)" stroke-width="4"/>
  <ellipse cx="339" cy="87" rx="4" ry="2.6" fill="#fff" fill-opacity=".8" transform="rotate(-30 339 87)"/>`;

export const cone = vessel({
  id: "cone",
  label: "Ice cream cone",
  palette: { main: "#d99a52", trim: "#ff8fb6" },
  width: WIDTH,
  height: HEIGHT,
  inside,
  silhouette,
  bodyTop: 110,
  bubbleY: 132,
  leftmost: leftEdge(silhouette),
  ground: { y: TIP, rx: 48 },
  back: `${fill(lip.hollow(inside), "mainDeep")}
    ${lip.back}`,
  front: `${shell(silhouette, inside, WIDTH, 8)}
    ${waffle}
    ${lip.front}
    ${part(melt, "trim", "trimDark", 5)}
    ${sprinkles}
    ${cherry}`,
});
