// A heart bowl: a puffy glass heart seen from the front, standing on a small foot at its point,
// with a short neck and a rolled rim in the dip between its lobes. It isn't round, so it has its
// own geometry: the inside is the outside moved in by the glass's thickness, and reflections run
// along the outside at set depths, as they do on a rounded surface.
import {
  areaBelow,
  bubbleEdge,
  cubic,
  num,
  pathOf,
  range,
  wallStrips,
  type Ellipse,
  type Surface,
} from "./profile";
import {
  arc,
  bandFront,
  blur,
  blurs,
  castShadow,
  glassDefs,
  line,
  lineUrl,
  paint,
  rim,
  shadowDefs,
  shape,
  stop,
  tint,
} from "./render";
import type { JarDesign, Lens, Point, Strip } from "./types";

const WIDTH = 380;
const HEIGHT = 402;
const CX = WIDTH / 2;
// The opening and its rim, and the neck under it, as half-widths.
const MOUTH_Y = 22;
const RIM = { outer: 92, inner: 76, height: 7 };
const NECK = { outer: 85, inner: 73, top: 30 };
// Each lobe's top is a circle, `u` units left or right of the axis. The neck rises from where
// the two meet.
const LOBE = { u: 124, y: 104, r: 64 };
// Where the gifts rest in the point, and the foot under it. The point meets the foot's top in a
// circle `waist` units wide.
const FLOOR_Y = 348;
const FOOT = { top: 378, rx: 38, height: 8, waist: 18 };
// The fill limit counts the inside below about halfway down. The point gathers the gifts in its
// middle, so the pile stands taller than in a round jar: this way even the two biggest gifts
// stacked on the rest stay clear of the neck.
const BODY_TOP = 165;
const BUBBLE_Y = 140;

const surface: Surface = {
  cx: CX,
  tiltAt: (y) => 0.1 + (0.04 * y) / HEIGHT,
  around(y, rx, angle) {
    const a = (angle * Math.PI) / 180;
    return {
      x: CX + rx * Math.sin(a),
      y: y + rx * surface.tiltAt(y) * Math.cos(a),
    };
  },
};

const ellipse = (y: number, rx: number): Ellipse => ({
  y,
  rx,
  ry: rx * surface.tiltAt(y),
});
/** A point `u` units left of the axis. */
const left = (u: number, y: number): Point => ({ x: CX - u, y });
const mirror = ({ x, y }: Point): Point => ({ x: WIDTH - x, y });
const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** Points along a line through `points`, `step` units apart. */
function resample(points: Point[], step: number): Point[] {
  const out = [points[0]];
  let travelled = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    let at = step - travelled;
    for (; at <= length; at += step) out.push(lerp(a, b, at / length));
    travelled = length - (at - step);
  }
  const end = points[points.length - 1];
  if (travelled > step * 0.3) out.push(end);
  else out[out.length - 1] = end;
  return out;
}

/** The points of a line, keeping one every `step` units or so, and its ends. */
function thin(points: Point[], step: number): Point[] {
  const out = [points[0]];
  for (const p of points.slice(1, -1)) {
    const last = out[out.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) >= step) out.push(p);
  }
  out.push(points[points.length - 1]);
  return out;
}

/** The half-width of the leftmost place a line through `points` crosses the row at y. */
function reach(points: Point[], y: number): number | undefined {
  let best: number | undefined;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.y === b.y || (a.y - y) * (b.y - y) > 0) continue;
    const u = CX - (a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y));
    if (best === undefined || u > best) best = u;
  }
  return best;
}

// The outside's left half, from where the neck meets the lobe, over the lobe and down its side
// to the point, about 2 units apart. The side follows a drawn heart's.
const meet = Math.acos((NECK.outer - LOBE.u) / LOBE.r);
const widestU = LOBE.u + LOBE.r;
const body = resample(
  [
    ...range(meet, 0, 0.04).map((a) =>
      left(LOBE.u + LOBE.r * Math.cos(a), LOBE.y - LOBE.r * Math.sin(a)),
    ),
    ...cubic(
      left(widestU, LOBE.y),
      left(widestU, LOBE.y + 95),
      left(100, 274),
      left(FOOT.waist, FOOT.top),
      40,
    ),
  ],
  2,
);
const JOINT = body[0];
// Each point's way in, toward the inside.
const normals = body.map((_, i) => {
  const a = body[Math.max(0, i - 1)];
  const b = body[Math.min(body.length - 1, i + 1)];
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  return { x: (b.y - a.y) / length, y: (a.x - b.x) / length };
});
// Distances along the outside from the neck.
const along: number[] = [];
body.forEach((p, i) => {
  const last = body[i - 1] ?? p;
  along.push((along[i - 1] ?? 0) + Math.hypot(p.x - last.x, p.y - last.y));
});
/** The index of the outside's first point at least `s` units along it, or its last. */
const indexAt = (s: number) => {
  const i = along.findIndex((at) => at >= s);
  return i < 0 ? body.length - 1 : i;
};
// The glass gets thicker toward the point, where it pools.
const thickness = (y: number) =>
  9 + 4 * Math.min(1, Math.max(0, (y - 220) / 160));
const insideOf = body.map((p, i) => {
  const t = thickness(p.y);
  return { x: p.x + normals[i].x * t, y: p.y + normals[i].y * t };
});

// The floor's ellipse sits a little above where the gifts rest, so its front edge draws over
// their bottoms.
const FLOOR_E = FLOOR_Y - 3;
const widest = body.reduce((best, p, i) => (p.x < body[best].x ? i : best), 0);
/** Where the inside's side, past the lobe, comes down to y: the index before it and how far on. */
function down(y: number): { i: number; t: number } {
  let i = widest;
  while (insideOf[i + 1].y < y) i++;
  return { i, t: (y - insideOf[i].y) / (insideOf[i + 1].y - insideOf[i].y) };
}

interface Pair {
  outer: Point;
  inner: Point;
}

/** The point `s` units along the outside's left half from the neck. */
function atLength(s: number): Point {
  const i = indexAt(s);
  if (i === 0 || s >= along[i]) return body[i];
  return lerp(
    body[i - 1],
    body[i],
    (s - along[i - 1]) / (along[i] - along[i - 1]),
  );
}

// Under the crease where the neck meets the lobe the glass fills in: the inside turns off the
// neck, runs flat and only rises into the lobe's top clear of it. Rising sooner, it would face
// the neck, and the walls the gifts rest on would reach from it through the crease into the neck.
const join = indexAt(LOBE.r * (meet - Math.PI / 2));
const creaseTop = left(NECK.inner, JOINT.y - 3);
const turn = 12;
const flat = { x: creaseTop.x - turn, y: creaseTop.y + turn };
const creaseInner = [
  ...range(0, Math.PI / 2, 0.2).map((a) => ({
    x: flat.x + turn * Math.cos(a),
    y: creaseTop.y + turn * Math.sin(a),
  })),
  ...cubic(
    flat,
    { x: flat.x - 20, y: flat.y },
    { x: insideOf[join].x + 16, y: insideOf[join].y },
    insideOf[join],
    16,
  ),
];
const crease: Pair[] = creaseInner.map((inner, i, all) => ({
  outer: atLength(
    Math.max(0, (i / (all.length - 1) - 0.25) / 0.75) * along[join],
  ),
  inner,
}));

const end = down(FLOOR_E);
/** The glass's left wall, outside and inside, from the opening down to the floor. */
const wall: Pair[] = [
  { outer: left(RIM.outer, MOUTH_Y), inner: left(RIM.inner, MOUTH_Y) },
  {
    outer: left(RIM.outer, MOUTH_Y + RIM.height),
    inner: left(NECK.inner, MOUTH_Y + 6),
  },
  ...range(NECK.top, JOINT.y - 5, 2).map((y) => ({
    outer: left(NECK.outer, y),
    inner: left(NECK.inner, y),
  })),
  ...crease,
  ...body.slice(join + 1, end.i + 1).map((outer, i) => ({
    outer,
    inner: insideOf[join + 1 + i],
  })),
  {
    outer: lerp(body[end.i], body[end.i + 1], end.t),
    inner: lerp(insideOf[end.i], insideOf[end.i + 1], end.t),
  },
];
const bottom = wall[wall.length - 1];

const outerLeft = [...wall.map((p) => p.outer), ...body.slice(end.i + 1)];
const innerLeft = wall.map((p) => p.inner);
// The outside below the floor, down to the foot.
const pointLeft = [bottom.outer, ...body.slice(end.i + 1)];

const floor = ellipse(FLOOR_E, CX - bottom.inner.x);
const brim = ellipse(MOUTH_Y, RIM.outer);
const mouth = ellipse(MOUTH_Y, RIM.inner);
const waist = ellipse(FOOT.top, FOOT.waist);
const footTop = ellipse(FOOT.top, FOOT.rx);
const footBottom = ellipse(FOOT.top + FOOT.height, FOOT.rx);

// The physics: the inside, with the floor where the gifts rest.
const corner = down(FLOOR_Y);
const insideLeft = [
  ...thin(innerLeft, 6),
  lerp(insideOf[corner.i], insideOf[corner.i + 1], corner.t),
  { x: CX, y: FLOOR_Y },
];
const outline: Point[] = [
  ...insideLeft,
  ...insideLeft.slice(0, -1).map(mirror).reverse(),
];

// The whole silhouette as points: down the left, out along the foot's top and round its front,
// and back up the right.
const footLeft = left(FOOT.rx, FOOT.top);
const outsideLeft = thin(outerLeft, 3);
const outside: Point[] = [
  ...outsideLeft,
  footLeft,
  ...range(-90, 90, 10).map((angle) =>
    surface.around(footBottom.y, FOOT.rx, angle),
  ),
  mirror(footLeft),
  ...outsideLeft.map(mirror).reverse(),
];

const both = (points: Point[]) => [points, points.map(mirror)];
const side = (sign: -1 | 1, points: Point[]) =>
  sign < 0 ? [...points] : points.map(mirror);

const silhouette = `${pathOf(outerLeft)} A${num(waist.rx)} ${num(waist.ry)} 0 0 0 ${num(CX + waist.rx)} ${num(waist.y)} ${pathOf(outerLeft.map(mirror).reverse(), "L")} A${num(brim.rx)} ${num(brim.ry)} 0 0 0 ${num(CX - brim.rx)} ${num(brim.y)}Z`;
const footShape = `M${num(CX - footTop.rx)} ${num(footTop.y)} A${num(footTop.rx)} ${num(footTop.ry)} 0 0 1 ${num(CX + footTop.rx)} ${num(footTop.y)} L${num(CX + footBottom.rx)} ${num(footBottom.y)} A${num(footBottom.rx)} ${num(footBottom.ry)} 0 0 1 ${num(CX - footBottom.rx)} ${num(footBottom.y)}Z`;
const outerEdge = both(outerLeft)
  .map((points) => pathOf(points))
  .join(" ");
const insideEdge = both(innerLeft)
  .map((points) => pathOf(points))
  .join(" ");

/** The inside, closed by the floor's front edge and the opening's far edge. */
const inside = `${pathOf(innerLeft)} A${num(floor.rx)} ${num(floor.ry)} 0 0 0 ${num(CX + floor.rx)} ${num(floor.y)} ${pathOf(innerLeft.map(mirror).reverse(), "L")} A${num(mouth.rx)} ${num(mouth.ry)} 0 0 0 ${num(CX - mouth.rx)} ${num(mouth.y)}Z`;

/** The wall seen edge-on on one side, between the outside and the inside. */
function band(sign: -1 | 1): string {
  return `${pathOf(
    side(
      sign,
      wall.map((p) => p.outer),
    ),
  )} ${pathOf(side(sign, innerLeft).reverse(), "L")}Z`;
}

/** The solid glass of the point, between the floor's front edge and the foot. */
const slab = `${pathOf(pointLeft)} A${num(waist.rx)} ${num(waist.ry)} 0 0 0 ${num(CX + waist.rx)} ${num(waist.y)} ${pathOf(pointLeft.map(mirror).reverse(), "L")} L${num(CX + floor.rx)} ${num(floor.y)} A${num(floor.rx)} ${num(floor.ry)} 0 0 1 ${num(CX - floor.rx)} ${num(floor.y)}Z`;

/** The point `depth` units in from the outside's left half, `s` units along it from the neck. */
function inset(s: number, depth: number): Point {
  const i = indexAt(s);
  return {
    x: body[i].x + normals[i].x * depth,
    y: body[i].y + normals[i].y * depth,
  };
}

/**
 * A reflection on the outside's left half, from `s0` to `s1` units along it from the neck: its
 * outer edge `depth` units in (or going from one depth to another), swelling to `width` in its
 * middle. Curved glass reflects a window as such a band, following its edge.
 */
function sheen(
  s0: number,
  s1: number,
  depth: number | [number, number],
  width: number,
): Point[] {
  const [d0, d1] = typeof depth === "number" ? [depth, depth] : depth;
  const edge: Point[] = [];
  const swell: Point[] = [];
  for (const s of range(s0, s1, 2)) {
    const t = (s - s0) / (s1 - s0);
    const d = d0 + (d1 - d0) * t;
    edge.push(inset(s, d));
    swell.push(inset(s, d + width * Math.sin(Math.PI * t) ** 0.7));
  }
  return [...edge, ...swell.reverse()];
}

/** A small sharp reflection `s` units along the outside's left half, lying along it. */
function spot(
  s: number,
  depth: number,
  rx: number,
  ry: number,
  opacity: number,
  sign: -1 | 1 = -1,
): string {
  const a = inset(s - 2, depth);
  const b = inset(s + 2, depth);
  const c = side(sign, [inset(s, depth)])[0];
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return `<ellipse cx="${num(c.x)}" cy="${num(c.y)}" rx="${rx}" ry="${ry}" transform="rotate(${num(-sign * angle)} ${num(c.x)} ${num(c.y)})" fill="#fff" opacity="${opacity}" ${blur("jf", 1)}/>`;
}

const closed = (points: Point[]) => `${pathOf(points)}Z`;

// How the glass bends the gifts: next to each wall the gifts are mirrored into it, and the point's
// solid glass shows the lowest ones upside down.
function sideStrips(sign: -1 | 1): Strip[] {
  const strips: Strip[] = [];
  for (let y0 = MOUTH_Y, y1 = y0; y0 < FLOOR_E; y0 = y1) {
    // Rows of 6 units where the wall slants, so each row's mirror stays close to in line with the
    // next, and longer where it's upright. Fewer rows draw faster.
    const a = reach(outerLeft, y0);
    const b = reach(outerLeft, y0 + 2);
    const slant = a === undefined || b === undefined ? 0 : Math.abs(b - a) / 2;
    y1 = Math.min(FLOOR_E, y0 + Math.min(12, Math.max(6, 3 / slant)));
    const y = (y0 + y1) / 2;
    const outer = reach(outerLeft, y);
    const inner = reach(innerLeft, y);
    // Where the wall runs across the row, as over a lobe's top, it doesn't mirror sideways.
    if (outer === undefined || inner === undefined) continue;
    if (outer - inner > 2.5 * thickness(y)) continue;
    strips.push(...wallStrips(CX, sign, outer, inner, y0, y1));
  }
  return strips;
}

const slabTop = floor.y + floor.ry * 0.5;
const lenses: Lens[] = [
  ...([-1, 1] as const).map((sign) => ({
    clip: band(sign),
    strips: [
      ...wallStrips(CX, sign, NECK.outer, NECK.inner, NECK.top, JOINT.y),
      ...sideStrips(sign),
    ],
  })),
  {
    clip: slab,
    strips: [
      {
        from: {
          x: CX - floor.rx - 24,
          y: FLOOR_Y - 30,
          width: (floor.rx + 24) * 2,
          height: 30,
        },
        to: {
          x: bottom.outer.x,
          y: slabTop,
          width: (CX - bottom.outer.x) * 2,
          height: waist.y + waist.ry - slabTop,
        },
        flipY: true,
        shade: 0.55,
      },
    ],
  },
];

// The wall's lines on one side: light, dark, light, dark and the inner edge's light, as glass
// seen edge-on bends what's around it. The window is on the left, so that side is brighter.
function wallLines(sign: -1 | 1): string {
  const lit = sign < 0 ? 1 : 0.7;
  const at = (t: number) =>
    pathOf(
      side(
        sign,
        wall.map((p) => lerp(p.outer, p.inner, t)),
      ),
    );
  return `${lineUrl(at(0.24), "jf-vd", 0.6, 1.2)}
    ${lineUrl(at(0.55), "jf-vw", 0.55 * lit, 1.3, blur("jf", 0.6))}
    ${lineUrl(at(0.86), "jf-vd", 0.5, 1)}
    ${lineUrl(at(1), "jf-vw", 0.8 * lit, 1.1)}`;
}

// Rings inside the point's solid glass: its own edges seen again through its thickness.
const rings = [0.3, 0.55, 0.78]
  .map((t, i) => {
    const y = floor.y + (waist.y - floor.y) * t;
    const e = ellipse(y, (reach(outerLeft, y) ?? FOOT.waist) - 4);
    return i % 2 === 0
      ? line(arc(CX, e, true), "white", 0.3, 1.2)
      : line(arc(CX, e, true), "deep", 0.45, 1.6);
  })
  .join("");

const lip = rim(surface, brim, mouth, RIM.height);
const neckBase = ellipse(JOINT.y, NECK.outer);

// A reflection's band, soft (a window) or sharp (a lamp). Its ends taper, so it needs no fade.
const glint = (
  prefix: string,
  points: Point[],
  opacity: number,
  size: number,
) =>
  `<path d="${closed(points)}" fill="#fff" opacity="${opacity}" ${blur(prefix, size)}/>`;

const SIZES = [0.6, 1, 1.5, 2, 3, 4, 6, 8];

const back = `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">
  <defs>
    ${blurs("jb", WIDTH, HEIGHT, SIZES)}
    ${shadowDefs("jb")}
    <linearGradient id="jb-far" x1="0" x2="1" y1="0" y2="0">
      ${stop(0, "glass", 0.2)}
      ${stop(0.1, "glass", 0.06)}
      ${stop(0.3, "glass", 0.015)}
      ${stop(0.7, "glass", 0.015)}
      ${stop(0.9, "glass", 0.06)}
      ${stop(1, "glass", 0.2)}
    </linearGradient>
  </defs>
  ${castShadow("jb", CX, footBottom.y + footBottom.ry, footBottom.rx, footBottom.ry)}
  ${shape(inside, "fill:url(#jb-far)")}
  ${glint("jb", sheen(150, 330, [30, 40], 30).map(mirror), 0.16, 4)}
  ${glint("jb", sheen(170, 300, [64, 70], 12), 0.1, 2)}
  <ellipse cx="${CX}" cy="${num(floor.y)}" rx="${num(floor.rx)}" ry="${num(floor.ry)}" style="${paint("fill", "light", 0.07)}"/>
  ${line(arc(CX, floor, false), "white", 0.4, 1.3)}
  ${line(arc(CX, neckBase, false), "white", 0.18, 1)}
  ${lip.back}
</svg>`;

const front = `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">
  <defs>
    ${blurs("jf", WIDTH, HEIGHT, SIZES)}
    <clipPath id="jf-inside"><path d="${inside}"/></clipPath>
    <clipPath id="jf-glass"><path d="${silhouette}"/><path d="${footShape}"/></clipPath>
    <linearGradient id="jf-wash" x1="0" x2="1" y1="0" y2="0">
      ${stop(0, "glass", 0.14)}
      ${stop(0.08, "glass", 0.05)}
      ${stop(0.25, "glass", 0.015)}
      ${stop(0.75, "glass", 0.015)}
      ${stop(0.92, "glass", 0.05)}
      ${stop(1, "glass", 0.14)}
    </linearGradient>
    ${glassDefs(MOUTH_Y - 10, footBottom.y + footBottom.ry)}
    <linearGradient id="jf-foot" x1="0" x2="0" y1="0" y2="1">
      ${stop(0, "white", 0.7)}
      ${stop(0.4, "light", 0.35)}
      ${stop(1, "deep", 0.6)}
    </linearGradient>
  </defs>

  ${shape(inside, "fill:url(#jf-wash)")}
  ${tint(inside)}
  <g clip-path="url(#jf-inside)">
    ${lineUrl(insideEdge, "jf-vl", 0.55, 22, blur("jf", 6))}
    ${lineUrl(insideEdge, "jf-vw", 0.42, 4, blur("jf", 1.5))}
  </g>
  ${shape(`${band(-1)} ${band(1)}`, "fill:url(#jf-wall)")}
  ${shape(footShape, paint("fill", "light", 0.22))}
  ${line(arc(CX, footTop, false), "white", 0.35, 1.2)}
  ${shape(slab, "fill:url(#jf-slab)")}
  ${rings}
  ${shape(bandFront(CX, footTop, FOOT.height), "fill:url(#jf-foot)")}
  ${line(arc(CX, footTop, true), "white", 0.75, 1.4)}
  ${line(arc(CX, footBottom, true), "deep", 0.6, 1.4)}

  ${glint("jf", sheen(46, 150, [12, 24], 34), 0.3, 4)}
  ${glint("jf", sheen(160, 300, [24, 30], 40), 0.26, 4)}
  ${glint("jf", sheen(56, 146, [24, 40], 6), 0.55, 1)}
  ${glint("jf", sheen(168, 292, [42, 48], 6), 0.45, 1)}
  ${glint("jf", sheen(96, 320, [16, 30], 12).map(mirror), 0.4, 1)}
  ${glint("jf", sheen(6, 76, 12, 18).map(mirror), 0.24, 4)}
  ${line(pathOf(range(60, 330, 4).map((s) => inset(s, 4))), "white", 0.4, 3, blur("jf", 1.5))}

  <g clip-path="url(#jf-glass)">
    ${lineUrl(outerEdge, "jf-vw", 0.35, 5, blur("jf", 2))}
    ${wallLines(-1)}
    ${wallLines(1)}
    ${lineUrl(outerEdge, "jf-vl", 1, 1.4)}
  </g>
  ${line(arc(CX, { ...floor, y: floor.y + 2.5 }, true), "deep", 0.5, 2, blur("jf", 1))}
  ${line(arc(CX, floor, true), "white", 0.8, 1.6)}
  ${line(arc(CX, { ...neckBase, y: neckBase.y + 2.5 }, true), "deep", 0.4, 2, blur("jf", 1))}
  ${line(arc(CX, neckBase, true), "white", 0.45, 1.2)}
  ${lip.front}
  ${spot(74, 22, 10, 2.4, 0.85)}
  ${spot(34, 14, 7, 1.8, 0.6, 1)}
</svg>`;

export const heart: JarDesign = {
  id: "heart",
  label: "Heart bowl",
  width: WIDTH,
  height: HEIGHT,
  outline,
  outside,
  mouth: { left: CX - RIM.inner, right: CX + RIM.inner, y: MOUTH_Y },
  bodyArea: areaBelow(outline, BODY_TOP),
  bubbleX: bubbleEdge((y) => CX - (reach(outerLeft, y) ?? 0), BUBBLE_Y),
  bubbleY: BUBBLE_Y,
  back,
  front,
  lenses,
};
