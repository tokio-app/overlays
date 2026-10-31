// A hexagonal honey jar. Seen with a face toward the viewer, it shows a wide front face and two
// narrow side faces between straight vertical edges, faceted shoulders up to a short round neck
// with threads, and a hexagonal bottom in perspective. Flat glass reflects with crisp edges and
// shifts what's behind a face seen at an angle, unlike a round jar's curved glass.
import {
  areaBelow,
  bubbleEdge,
  cubic,
  num,
  pathOf,
  wallStrips,
  type Surface,
} from "./profile";
import {
  blur,
  blurs,
  castShadow,
  glassDefs,
  helix,
  line,
  lineUrl,
  paint,
  rim,
  shadowDefs,
  shape,
  stop,
  threads,
  tint,
} from "./render";
import type { JarDesign, Lens, Point } from "./types";

const WIDTH = 300;
const HEIGHT = 432;
const CX = WIDTH / 2;
// The hexagon's corners from the axis, outside and inside.
const R = 148;
const R_IN = 138;
const NECK = { top: 22, bottom: 76, outer: 74, inner: 63, lip: 78 };
const BODY = { top: 128, bottom: 405 };
const FLOOR_Y = 392;
const BUBBLE_Y = 260;

const jar: Surface = {
  cx: CX,
  tiltAt: (y) => 0.1 + (0.03 * y) / HEIGHT,
  around(y, rx, angle) {
    const a = (angle * Math.PI) / 180;
    return {
      x: CX + rx * Math.sin(a),
      y: y + rx * jar.tiltAt(y) * Math.cos(a),
    };
  },
};

/** A corner of the hexagon at `y`, `angle` degrees round from the front. */
const corner = (y: number, angle: number, radius = R) =>
  jar.around(y, radius, angle);
const top = (angle: number) => corner(BODY.top, angle);
const bottom = (angle: number) => corner(BODY.bottom, angle);
const floorAt = (angle: number) => corner(FLOOR_Y - 4, angle, R_IN);
const neckAt = (angle: number) => jar.around(NECK.bottom, NECK.outer, angle);

function polygon(points: Point[]): string {
  return `${pathOf(points)}Z`;
}

// The neck's circle from one angle to another, as points.
function neckArc(from: number, to: number): Point[] {
  const steps = Math.ceil(Math.abs(to - from) / 6);
  return Array.from({ length: steps + 1 }, (_, i) =>
    neckAt(from + ((to - from) * i) / steps),
  );
}

// The inside's left half, from the opening down to the floor's center.
const insideLeft: Point[] = [
  { x: CX - 64, y: NECK.top },
  { x: CX - NECK.inner, y: 30 },
  { x: CX - NECK.inner, y: 84 },
  { x: CX - R_IN, y: 137 },
  { x: CX - R_IN, y: FLOOR_Y - 12 },
  ...cubic(
    { x: CX - R_IN, y: FLOOR_Y - 12 },
    { x: CX - R_IN, y: FLOOR_Y - 4 },
    { x: CX - R_IN + 4, y: FLOOR_Y },
    { x: CX - R_IN + 12, y: FLOOR_Y },
    5,
  ),
  { x: CX, y: FLOOR_Y },
];
const outline: Point[] = [
  ...insideLeft,
  ...insideLeft
    .slice(0, -1)
    .map(({ x, y }) => ({ x: WIDTH - x, y }))
    .reverse(),
];

const lipTilt = jar.tiltAt(NECK.top);
const lip = rim(
  jar,
  { y: NECK.top, rx: NECK.lip, ry: NECK.lip * lipTilt },
  { y: NECK.top, rx: 64, ry: 64 * lipTilt },
  6,
);

// The outside's left half, from the lip down to the bottom's side corner.
const outsideLeft: Point[] = [
  { x: CX - NECK.lip, y: NECK.top },
  { x: CX - NECK.lip, y: 28 },
  { x: CX - NECK.outer, y: 31 },
  neckAt(-90),
  top(-90),
  bottom(-90),
];
// The whole silhouette, round the bottom's front corners and up the right.
const outside = [
  ...outsideLeft,
  bottom(-30),
  bottom(30),
  ...outsideLeft.map(({ x, y }) => ({ x: WIDTH - x, y })).reverse(),
];
const silhouette = `${pathOf(outside)} A${NECK.lip} ${num(NECK.lip * lipTilt)} 0 0 0 ${num(CX - NECK.lip)} ${NECK.top}Z`;
const outerEdge = pathOf(outside.slice(1, -1));
const inside = polygon(outline);

// The wall seen edge-on down each side: the neck, the shoulder and the body's side corner.
function band(sign: -1 | 1): string {
  const at = (x: number, y: number) => ({ x: CX + sign * x, y });
  return polygon([
    at(NECK.outer, 31),
    at(NECK.outer, NECK.bottom),
    at(R, BODY.top),
    at(R, FLOOR_Y),
    at(R_IN, FLOOR_Y),
    at(R_IN, 137),
    at(NECK.inner, 84),
    at(NECK.inner, 31),
  ]);
}

// The faces in front, between their top and bottom corners.
const face = (a: number, b: number) =>
  polygon([top(a), top(b), bottom(b), bottom(a)]);
const frontFace = face(-30, 30);
const leftFace = face(-90, -30);
const rightFace = face(30, 90);
// The shoulder's facets, from the body's top edge up to the neck.
const facet = (a: number, b: number) =>
  polygon([top(a), top(b), ...neckArc(b, a)]);

// The glass bottom's front: between the floor's near edges and the bottom's.
const slab = polygon([
  floorAt(-90),
  floorAt(-30),
  floorAt(30),
  floorAt(90),
  bottom(90),
  bottom(30),
  bottom(-30),
  bottom(-90),
]);
// Edges inside the glass bottom, between the floor's and the bottom's: its own edges seen again
// through its thickness.
const slabRing = (t: number) =>
  pathOf(
    [-90, -30, 30, 90].map((angle) => {
      const a = floorAt(angle);
      const b = bottom(angle);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }),
  );

const thread = threads(helix(jar, 36, NECK.outer + 1.5, 12, -200, 520, 5));

const lenses: Lens[] = [
  ...([-1, 1] as const).map((sign) => ({
    clip: band(sign),
    strips: [
      ...wallStrips(CX, sign, NECK.outer, NECK.inner, 31, 80),
      ...wallStrips(CX, sign, R, R_IN, 137, FLOOR_Y),
    ],
  })),
  // A side face seen at an angle shifts what's behind it, like a prism.
  ...([-1, 1] as const).map((sign) => {
    const x = sign < 0 ? CX - R_IN : CX + R / 2;
    const width = R_IN - R / 2;
    return {
      clip: polygon([
        { x: CX + sign * R_IN, y: 137 },
        { x: CX + (sign * R) / 2, y: top(sign * 30).y },
        { x: CX + (sign * R) / 2, y: FLOOR_Y + 8 },
        { x: CX + sign * R_IN, y: FLOOR_Y },
      ]),
      strips: [
        {
          from: { x: x - sign * 5, y: 120, width, height: FLOOR_Y - 112 },
          to: { x, y: 120, width, height: FLOOR_Y - 112 },
          shade: 0.16,
        },
      ],
    };
  }),
  {
    clip: slab,
    strips: [
      {
        from: { x: CX - R_IN, y: FLOOR_Y - 30, width: R_IN * 2, height: 30 },
        to: {
          x: CX - R_IN,
          y: floorAt(-90).y,
          width: R_IN * 2,
          height: bottom(0).y - floorAt(-90).y,
        },
        flipY: true,
        shade: 0.55,
      },
    ],
  },
];

// The wall's lines on one side, as on the round jars: light, dark, light, dark and the inner
// edge's light. The window is on the left, so that side is brighter.
function wallLines(sign: -1 | 1): string {
  const lit = sign < 0 ? 1 : 0.7;
  const down = (x: number, y0: number, y1: number) =>
    `M${num(CX + sign * x)} ${y0}V${y1}`;
  const at = (t: number) =>
    `${down(NECK.outer - (NECK.outer - NECK.inner) * t, 31, 80)} ${down(R - (R - R_IN) * t, 137, FLOOR_Y)}`;
  return `${lineUrl(at(0.24), "jf-vd", 0.6, 1.3)}
    ${lineUrl(at(0.55), "jf-vw", 0.55 * lit, 1.4, blur("jf", 0.6))}
    ${lineUrl(at(0.86), "jf-vd", 0.5, 1.1)}
    ${lineUrl(at(1), "jf-vw", 0.8 * lit, 1.1)}`;
}

// A front corner's hard edge: a bright line on the front face, a dark one on the side face.
function edge(sign: -1 | 1): string {
  const x = CX + (sign * R) / 2;
  const y0 = top(sign * 30).y;
  const y1 = bottom(sign * 30).y;
  return `${line(`M${num(x - sign * 1.8)} ${num(y0)}V${num(y1)}`, "deep", 0.55, 1.6)}
    ${line(`M${num(x + sign * 0.8)} ${num(y0)}V${num(y1)}`, "white", sign < 0 ? 0.85 : 0.6, 1.2)}`;
}

// A crisp reflection on a flat side face, between two x's, following its slanted ends.
function pane(x0: number, x1: number, sign: -1 | 1, inset = 10): string {
  const along = (x: number, edgeY: (angle: number) => number) => {
    const a = top(sign * 90);
    const b = top(sign * 30);
    const t = (x - a.x) / (b.x - a.x);
    return edgeY(sign * 90) + (edgeY(sign * 30) - edgeY(sign * 90)) * t;
  };
  const topY = (x: number) => along(x, (angle) => top(angle).y) + inset;
  const bottomY = (x: number) => along(x, (angle) => bottom(angle).y) - inset;
  return polygon([
    { x: x0, y: topY(x0) },
    { x: x1, y: topY(x1) },
    { x: x1, y: bottomY(x1) },
    { x: x0, y: bottomY(x0) },
  ]);
}

const back = `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">
  <defs>
    ${blurs("jb", WIDTH, HEIGHT, [0.6, 1, 2, 3, 4])}
    ${shadowDefs("jb")}
  </defs>
  ${castShadow("jb", CX, bottom(0).y, R, bottom(0).y - BODY.bottom)}
  ${shape(inside, paint("fill", "glass", 0.035))}
  ${shape(polygon([-90, -30, 30, 90, 150, -150].map(floorAt)), paint("fill", "light", 0.07))}
  ${line(pathOf([floorAt(-90), floorAt(-150), floorAt(150), floorAt(90)]), "white", 0.38, 1.2)}
  ${line(pathOf([floorAt(-90), floorAt(-150), floorAt(150), floorAt(90)].map(({ x, y }) => ({ x, y: y + 2.5 }))), "deep", 0.35, 1.6, blur("jb", 0.6))}
  ${[-150, 150]
    .map((angle) => {
      const x = corner(0, angle, R_IN).x;
      return line(
        `M${num(x)} ${num(corner(137, angle, R_IN).y)}V${num(floorAt(angle).y)}`,
        "white",
        0.22,
        1,
      );
    })
    .join("")}
  ${line(pathOf([top(-90), top(-150), top(150), top(90)]), "white", 0.2, 1)}
  ${line(`${pathOf([neckAt(-150), top(-150)])} ${pathOf([neckAt(150), top(150)])}`, "white", 0.16, 1)}
  ${lip.back}
  ${thread.back}
</svg>`;

const front = `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">
  <defs>
    ${blurs("jf", WIDTH, HEIGHT, [0.6, 1, 1.5, 2, 4, 6])}
    <clipPath id="jf-inside"><path d="${inside}"/></clipPath>
    <clipPath id="jf-glass"><path d="${silhouette}"/></clipPath>
    ${glassDefs(NECK.top, bottom(0).y)}
    <linearGradient id="jf-left" x1="0" x2="1" y1="0" y2="0">
      ${stop(0, "light", 0.3)}
      ${stop(1, "light", 0.12)}
    </linearGradient>
    <linearGradient id="jf-right" x1="0" x2="1" y1="0" y2="0">
      ${stop(0, "glass", 0.1)}
      ${stop(1, "glass", 0.22)}
    </linearGradient>
    <linearGradient id="jf-front" x1="0" x2="0" y1="0" y2="1">
      ${stop(0, "white", 0.07)}
      ${stop(0.4, "white", 0)}
      ${stop(1, "glass", 0.05)}
    </linearGradient>
    <linearGradient id="jf-sky" x1="0" x2="0" y1="0" y2="1">
      ${stop(0, "white", 0.42)}
      ${stop(1, "light", 0.14)}
    </linearGradient>
  </defs>

  <g clip-path="url(#jf-inside)">
    ${lineUrl(pathOf(outline), "jf-vl", 0.5, 20, blur("jf", 6))}
    ${lineUrl(pathOf(outline), "jf-vw", 0.38, 4, blur("jf", 1.5))}
  </g>
  ${tint(inside)}
  ${shape(frontFace, "fill:url(#jf-front)")}
  ${shape(leftFace, "fill:url(#jf-left)")}
  ${shape(rightFace, "fill:url(#jf-right)")}
  ${shape(pane(CX - 132, CX - 104, -1), "fill:#fff;fill-opacity:.2", blur("jf", 0.6))}
  ${shape(pane(CX - 97, CX - 94, -1, 18), "fill:#fff;fill-opacity:.45", blur("jf", 0.6))}
  ${shape(pane(CX + 122, CX + 127, 1, 14), "fill:#fff;fill-opacity:.3", blur("jf", 0.6))}
  ${shape(
    polygon([
      { x: CX - 62, y: top(-30).y + 14 },
      { x: CX - 38, y: top(-30).y + 14 },
      { x: CX - 38, y: bottom(-30).y - 30 },
      { x: CX - 62, y: bottom(-30).y - 30 },
    ]),
    "fill:#fff;fill-opacity:.06",
    blur("jf", 4),
  )}

  ${shape(facet(-30, 30), "fill:url(#jf-sky)")}
  ${shape(facet(-90, -30), paint("fill", "light", 0.3))}
  ${shape(facet(30, 90), paint("fill", "glass", 0.24))}
  ${line(pathOf([neckAt(-30), top(-30)]), "white", 0.6, 1.2)}
  ${line(pathOf([neckAt(30), top(30)]), "white", 0.45, 1.2)}

  ${shape(`${band(-1)} ${band(1)}`, "fill:url(#jf-wall)")}
  ${shape(slab, "fill:url(#jf-slab)")}
  ${line(slabRing(0.3), "white", 0.3, 1.2)}
  ${line(slabRing(0.55), "deep", 0.45, 1.6)}
  ${line(slabRing(0.78), "white", 0.25, 1.1)}

  ${edge(-1)}
  ${edge(1)}
  <g clip-path="url(#jf-glass)">
    ${lineUrl(outerEdge, "jf-vw", 0.35, 5, blur("jf", 2))}
    ${wallLines(-1)}
    ${wallLines(1)}
    ${lineUrl(outerEdge, "jf-vl", 1, 1.4)}
  </g>
  ${line(pathOf([top(-90), top(-30), top(30), top(90)].map(({ x, y }) => ({ x, y: y + 2.5 }))), "deep", 0.5, 1.6, blur("jf", 0.6))}
  ${line(pathOf([top(-90), top(-30), top(30), top(90)]), "white", 0.8, 1.4)}
  ${line(pathOf([floorAt(-90), floorAt(-30), floorAt(30), floorAt(90)].map(({ x, y }) => ({ x, y: y + 2.5 }))), "deep", 0.5, 2, blur("jf", 1))}
  ${line(pathOf([floorAt(-90), floorAt(-30), floorAt(30), floorAt(90)]), "white", 0.8, 1.6)}
  ${line(pathOf([bottom(-90), bottom(-30), bottom(30), bottom(90)].map(({ x, y }) => ({ x, y: y - 3 }))), "white", 0.45, 1.4)}

  ${thread.front}
  ${lip.front}
  <ellipse cx="${CX - 120}" cy="${num(top(-90).y + 6)}" rx="10" ry="2" fill="#fff" opacity=".7" ${blur("jf", 1)}/>
</svg>`;

export const honey: JarDesign = {
  id: "honey",
  label: "Honey jar",
  width: WIDTH,
  height: HEIGHT,
  outline,
  outside,
  mouth: { left: CX - 64, right: CX + 64, y: NECK.top },
  bodyTop: 140,
  bodyArea: areaBelow(outline, 140),
  bubbleX: bubbleEdge(() => CX - R, BUBBLE_Y),
  bubbleY: BUBBLE_Y,
  back,
  front,
  lenses,
};
