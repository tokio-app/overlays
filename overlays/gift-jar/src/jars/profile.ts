// Geometry shared by the jars. A round jar is a surface of revolution: its outside and inside are
// half-widths from the axis at each height, and every circle around it is seen slightly from
// above, as an ellipse. The physics walls, the glass's SVG and the canvas's refraction all come
// from those numbers.
import type { Lens, Point, Strip, Wall } from "./types";

export interface Ellipse {
  y: number;
  rx: number;
  ry: number;
}

/** Points on a cubic Bézier from a to d, without a. */
export function cubic(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
  steps: number,
): Point[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = (i + 1) / steps;
    const u = 1 - t;
    return {
      x:
        u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x,
      y:
        u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y,
    };
  });
}

/** The values from `from` to `to` (both included), about `step` apart. */
export function range(from: number, to: number, step: number): number[] {
  const count = Math.max(1, Math.ceil(Math.abs(to - from) / step));
  return Array.from(
    { length: count + 1 },
    (_, i) => from + ((to - from) * i) / count,
  );
}

export function num(value: number): string {
  return value.toFixed(1);
}

/** An SVG path through the points. */
export function pathOf(points: Point[], first: "M" | "L" = "M"): string {
  return points
    .map(({ x, y }, i) => `${i === 0 ? first : "L"}${num(x)} ${num(y)}`)
    .join(" ");
}

/** Half of an ellipse, from its left end to its right end: the front (lower) half or the back. */
export function halfEllipse(cx: number, e: Ellipse, front: boolean): string {
  return `M${num(cx - e.rx)} ${num(e.y)}A${num(e.rx)} ${num(e.ry)} 0 0 ${front ? 0 : 1} ${num(cx + e.rx)} ${num(e.y)}`;
}

/** The half-width of a line through `points` (top to bottom) at `y`, clamped to its ends. */
export function widthAt(points: Point[], y: number): number {
  if (y <= points[0].y) return points[0].x;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (y <= b.y && b.y > a.y) {
      return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
    }
  }
  return points[points.length - 1].x;
}

/** The area of a polygon, in square units. */
export function polygonArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** The area inside an outline below `top`: the part the fill limit counts. */
export function areaBelow(outline: Point[], top: number): number {
  // The outline cut at `top`, with a point where each side crosses it.
  const below: Point[] = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    if (a.y >= top) below.push(a);
    if (a.y >= top !== b.y >= top) {
      below.push({
        x: a.x + ((b.x - a.x) * (top - a.y)) / (b.y - a.y),
        y: top,
      });
    }
  }
  return polygonArea(below);
}

/** Wall thickness. Thick, so a fast gift can't pass through. */
export const WALL_THICKNESS = 40;

/**
 * Thin rectangles along an inner wall, lying just outside it so the gifts rest against the wall
 * itself. The first and last walls reach well past the page's top, where gifts drop in from, to
 * keep them from bouncing out: every jar's box starts less than 200 below the page's top, and the
 * biggest gift at most 85 above it.
 */
export function walls(outline: Point[]): Wall[] {
  const points = simplify(outline);
  const first = points[0];
  const last = points[points.length - 1];
  const list = [{ x: first.x, y: -400 }, ...points, { x: last.x, y: -400 }];
  const result: Wall[] = [];
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i];
    const b = list[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    // Going down the left side, along the floor and up the right, the outside is to the left
    // of the direction.
    const nx = -dy / length;
    const ny = dx / length;
    result.push({
      x: (a.x + b.x) / 2 + (nx * WALL_THICKNESS) / 2,
      y: (a.y + b.y) / 2 + (ny * WALL_THICKNESS) / 2,
      // A little extra so corners leave no gaps.
      length: length + 6,
      thickness: WALL_THICKNESS,
      angle: Math.atan2(dy, dx),
    });
  }
  return result;
}

/**
 * The whole glass's walls, for gifts on both sides of it: around its cross-section, up the
 * outside, over the rim, down the inside and back. Each lies inside the glass and is only as
 * thick as the glass is there, so none pokes out of the other side.
 */
export function glassWalls(outline: Point[], outside: Point[]): Wall[] {
  // Clockwise on screen, so the glass is to the left of each edge's direction, as in walls().
  const ring = simplify([...outside].reverse().concat(outline));
  const result: Wall[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    const normal = { x: -dy / length, y: dx / length };
    let across = WALL_THICKNESS;
    for (const t of [0.15, 0.5, 0.85]) {
      const from = { x: a.x + dx * t, y: a.y + dy * t };
      across = Math.min(across, rayToRing(ring, i, from, normal));
    }
    const thickness = Math.max(2, across);
    result.push({
      x: (a.x + b.x) / 2 + (normal.x * thickness) / 2,
      y: (a.y + b.y) / 2 + (normal.y * thickness) / 2,
      // Less extra than walls() gives, so thin walls don't jut out at the glass's corners.
      length: length + Math.min(6, thickness),
      thickness,
      angle: Math.atan2(dy, dx),
    });
  }
  return result;
}

// Fewer points on a line, each kept segment within half a unit of the points it skips, so the
// physics has fewer walls to check.
function simplify(points: Point[]): Point[] {
  const kept = [points[0]];
  let from = 0;
  while (from < points.length - 1) {
    let to = from + 1;
    while (
      to + 1 < points.length &&
      fits(points, from, to + 1) &&
      Math.hypot(
        points[to + 1].x - points[from].x,
        points[to + 1].y - points[from].y,
      ) < 60
    ) {
      to++;
    }
    kept.push(points[to]);
    from = to;
  }
  return kept;
}

// Whether the points between two others lie within half a unit of the line between them.
function fits(points: Point[], from: number, to: number): boolean {
  const a = points[from];
  const b = points[to];
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length === 0) return false;
  for (let i = from + 1; i < to; i++) {
    const p = points[i];
    const off =
      Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / length;
    if (off > 0.5) return false;
  }
  return true;
}

// How far a ray from an edge of the ring goes before it meets another edge.
function rayToRing(
  ring: Point[],
  skip: number,
  from: Point,
  direction: Point,
): number {
  let nearest = Infinity;
  for (let j = 0; j < ring.length; j++) {
    if (j === skip) continue;
    const a = ring[j];
    const b = ring[(j + 1) % ring.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const denominator = direction.x * ey - direction.y * ex;
    if (Math.abs(denominator) < 1e-9) continue;
    const wx = a.x - from.x;
    const wy = a.y - from.y;
    const distance = (wx * ey - wy * ex) / denominator;
    const along = (wx * direction.y - wy * direction.x) / denominator;
    if (distance > 0.01 && along >= 0 && along <= 1) {
      nearest = Math.min(nearest, distance);
    }
  }
  return nearest;
}

/** Whether a point is inside a closed polygon. */
export function contains(polygon: Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (
      a.y > y !== b.y > y &&
      x < a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y)
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** The left edge of the glass the message may reach, where nothing of the jar is to its left. */
export function bubbleEdge(leftmost: (y: number) => number, y: number): number {
  let x = Infinity;
  // The message is about 60 units tall above its tail.
  for (const at of range(y - 64, y, 2)) x = Math.min(x, leftmost(at));
  return x - 4;
}

export interface RoundProfile {
  width: number;
  height: number;
  /**
   * ry ÷ rx of the jar's circles at its top and its bottom. The jar is seen from slightly above,
   * so the lower circles look a little rounder.
   */
  tilt: readonly [number, number];
  /** The outside's half-widths from the axis, from the rim's top down to the bottom. */
  outer: Point[];
  /** The inside's half-widths, from the opening down to where the floor's corner starts. */
  inner: Point[];
  /** Where the gifts rest at the axis, and the radius of the floor's corner. */
  floorY: number;
  corner: number;
  /** The center of the ellipse under the glass bottom. */
  baseY: number;
  /** The fill limit counts the inside below this y. */
  bodyTop: number;
  /** Where the message's tail touches the glass. */
  bubbleY: number;
}

/** Something round seen from slightly above, where a point `angle` degrees round can be found. */
export interface Surface {
  cx: number;
  tiltAt(y: number): number;
  around(y: number, rx: number, angle: number): Point;
}

/** A round jar's geometry, in its own units, with the paths its glass is drawn from. */
export class Round implements Surface {
  readonly cx: number;
  /** The rim's top, the opening's center and the end of the inside's walls. */
  readonly top: number;
  readonly mouthY: number;
  readonly wallEnd: number;
  /** The floor's ellipse (the top of the glass bottom) and the one under the glass bottom. */
  readonly floor: Ellipse;
  readonly base: Ellipse;
  /** The ellipse the jar stands on: the base's, or a foot's under it. */
  readonly bottom: Ellipse;
  readonly outline: Point[];

  constructor(readonly profile: RoundProfile) {
    const { width, outer, inner, floorY, corner, baseY } = profile;
    this.cx = width / 2;
    this.top = outer[0].y;
    this.mouthY = inner[0].y;
    this.wallEnd = inner[inner.length - 1].y;

    const floorRx = inner[inner.length - 1].x;
    // A little above where the gifts rest, so the floor's front edge draws over their bottoms.
    const floorEllipseY = floorY - 4;
    this.floor = {
      y: floorEllipseY,
      rx: floorRx,
      ry: floorRx * this.tiltAt(floorEllipseY),
    };
    const baseRx = this.outerAt(baseY);
    this.base = { y: baseY, rx: baseRx, ry: baseRx * this.tiltAt(baseY) };
    const end = outer[outer.length - 1];
    this.bottom = { y: end.y, rx: end.x, ry: end.x * this.tiltAt(end.y) };

    // The inside's left half, then the floor's rounded corner and the floor to the axis.
    const last = inner[inner.length - 1];
    const left = [
      ...inner,
      ...cubic(
        last,
        { x: last.x, y: floorY - corner * 0.3 },
        { x: last.x - corner * 0.3, y: floorY },
        { x: last.x - corner, y: floorY },
        5,
      ),
    ].map(({ x, y }) => ({ x: this.cx - x, y }));
    left.push({ x: this.cx, y: floorY });
    this.outline = [
      ...left,
      ...left
        .slice(0, -1)
        .map(({ x, y }) => ({ x: width - x, y }))
        .reverse(),
    ];
  }

  outerAt(y: number): number {
    return widthAt(this.profile.outer, y);
  }

  innerAt(y: number): number {
    return widthAt(this.profile.inner, y);
  }

  tiltAt(y: number): number {
    const [top, bottom] = this.profile.tilt;
    return top + ((bottom - top) * y) / this.profile.height;
  }

  /** The circle of half-width `rx` at `y`, as the ellipse it's seen as. */
  ellipse(y: number, rx: number): Ellipse {
    return { y, rx, ry: rx * this.tiltAt(y) };
  }

  /** A point on the circle of half-width `rx` at `y`, `angle` degrees round from the front. */
  around(y: number, rx: number, angle: number): Point {
    const a = (angle * Math.PI) / 180;
    return {
      x: this.cx + rx * Math.sin(a),
      y: y + rx * this.tiltAt(y) * Math.cos(a),
    };
  }

  get mouth() {
    const rx = this.profile.inner[0].x;
    return { left: this.cx - rx, right: this.cx + rx, y: this.mouthY };
  }

  get bodyArea(): number {
    return areaBelow(this.outline, this.profile.bodyTop);
  }

  get bubbleX(): number {
    return bubbleEdge((y) => this.cx - this.outerAt(y), this.profile.bubbleY);
  }

  /** The outside's left (-1) or right (1) edge, from y0 down to y1. */
  outerSide(sign: -1 | 1, y0 = this.top, y1 = this.bottom.y): Point[] {
    return this.side(this.profile.outer, sign, y0, y1);
  }

  /** The inside's edge, from y0 down to y1. */
  innerSide(sign: -1 | 1, y0 = this.mouthY, y1 = this.wallEnd): Point[] {
    return this.side(this.profile.inner, sign, y0, y1);
  }

  /** A line down the glass's wall, `t` of the way from its outside (0) to its inside (1). */
  contour(t: number, sign: -1 | 1, y0 = this.mouthY, y1 = this.wallEnd) {
    return range(y0, y1, 2).map((y) => ({
      x: this.cx + sign * (this.outerAt(y) * (1 - t) + this.innerAt(y) * t),
      y,
    }));
  }

  /** A line on the outside's surface, `angle` degrees round from the front, from y0 to y1. */
  meridian(angle: number, y0: number, y1: number, inset = 0): Point[] {
    return range(y0, y1, 2).map((y) =>
      this.around(y, this.outerAt(y) - inset, angle),
    );
  }

  /** The band on the outside between two angles, from y0 to y1: a reflection's shape. */
  strip(a: number, b: number, y0: number, y1: number, inset = 0): string {
    return `${pathOf(this.meridian(a, y0, y1, inset))} ${pathOf(this.meridian(b, y0, y1, inset).reverse(), "L")}Z`;
  }

  /** The silhouette as points: down the left, round the bottom's front and up the right. */
  get outside(): Point[] {
    const { bottom } = this;
    const front = range(-90, 90, 10)
      .slice(1, -1)
      .map((angle) => this.around(bottom.y, bottom.rx, angle));
    return [...this.outerSide(-1), ...front, ...this.outerSide(1).reverse()];
  }

  /** The glass's whole silhouette, closed over the rim. */
  get silhouette(): string {
    return `${this.outerEdge} A${num(this.outerAt(this.top))} ${num(this.outerAt(this.top) * this.tiltAt(this.top))} 0 0 0 ${num(this.cx - this.outerAt(this.top))} ${num(this.top)}Z`;
  }

  /** The silhouette's edge, down the left, around the bottom's front and up the right. */
  get outerEdge(): string {
    const { bottom } = this;
    return `${pathOf(this.outerSide(-1))} A${num(bottom.rx)} ${num(bottom.ry)} 0 0 0 ${num(this.cx + bottom.rx)} ${num(bottom.y)} ${pathOf(this.outerSide(1).reverse(), "L")}`;
  }

  /** The solid glass under the base, such as a pedestal and its foot. */
  get below(): string {
    const { base, bottom, cx } = this;
    if (bottom.y - base.y < 1) return "";
    return `${pathOf(this.outerSide(-1, base.y, bottom.y))} A${num(bottom.rx)} ${num(bottom.ry)} 0 0 0 ${num(cx + bottom.rx)} ${num(bottom.y)} ${pathOf(this.outerSide(1, base.y, bottom.y).reverse(), "L")} A${num(base.rx)} ${num(base.ry)} 0 0 1 ${num(cx - base.rx)} ${num(base.y)}Z`;
  }

  /** The inside, closed by the floor's front edge and the opening's far edge. */
  get inside(): string {
    const { floor, cx } = this;
    const mouth = this.profile.inner[0].x;
    const left = [...this.innerSide(-1), { x: cx - floor.rx, y: floor.y }];
    const right = [
      { x: cx + floor.rx, y: floor.y },
      ...this.innerSide(1).reverse(),
    ];
    return `${pathOf(left)} A${num(floor.rx)} ${num(floor.ry)} 0 0 0 ${num(cx + floor.rx)} ${num(floor.y)} ${pathOf(right, "L")} A${num(mouth)} ${num(mouth * this.tiltAt(this.mouthY))} 0 0 0 ${num(cx - mouth)} ${num(this.mouthY)}Z`;
  }

  /** The wall seen edge-on, between the outside and the inside, from y0 to y1. */
  band(sign: -1 | 1, y0 = this.mouthY, y1 = this.wallEnd): string {
    const outer = range(y0, y1, 2).map((y) => ({
      x: this.cx + sign * this.outerAt(y),
      y,
    }));
    const inner = range(y0, y1, 2).map((y) => ({
      x: this.cx + sign * this.innerAt(y),
      y,
    }));
    return `${pathOf(outer)} ${pathOf(inner.reverse(), "L")}Z`;
  }

  /**
   * The wall's foot, under its band: from where the inside's wall ends, down the outside to the
   * base and back up the glass bottom's side. It covers the corner between the band, the inside
   * and the slab, which would otherwise show through as a hole in the glass.
   */
  foot(sign: -1 | 1): string {
    const { floor, base, cx, wallEnd } = this;
    const outer = range(wallEnd, base.y, 2).map((y) => ({
      x: cx + sign * this.outerAt(y),
      y,
    }));
    return `${pathOf(outer)} L${num(cx + sign * floor.rx)} ${num(floor.y)} L${num(cx + sign * this.innerAt(wallEnd))} ${num(wallEnd)}Z`;
  }

  /** The glass bottom's front, between the floor's front edge and the base's. */
  get slab(): string {
    const { floor, base, cx } = this;
    return `${halfEllipse(cx, base, true)} L${num(cx + floor.rx)} ${num(floor.y)} A${num(floor.rx)} ${num(floor.ry)} 0 0 1 ${num(cx - floor.rx)} ${num(floor.y)}Z`;
  }

  /**
   * How the glass bends the gifts: next to each wall, the gifts are mirrored into the wall's
   * edge, squeezed more toward the outside, as a thick cylinder does. And the glass bottom
   * shows the lowest gifts upside down, flattened.
   */
  get lenses(): Lens[] {
    const lenses = ([-1, 1] as const).map((sign) => ({
      clip: this.band(sign),
      strips: this.wallStrips(sign),
    }));
    const { floor, base, cx, profile } = this;
    const from = profile.floorY - 30;
    lenses.push({
      clip: this.slab,
      strips: [
        {
          from: { x: cx - floor.rx, y: from, width: floor.rx * 2, height: 30 },
          to: {
            x: cx - floor.rx,
            y: floor.y + floor.ry * 0.5,
            width: floor.rx * 2,
            height: base.y + base.ry - floor.y - floor.ry * 0.5,
          },
          flipY: true,
          shade: 0.55,
        },
      ],
    });
    return lenses;
  }

  private side(points: Point[], sign: -1 | 1, y0: number, y1: number): Point[] {
    const inRange = points.filter(({ y }) => y > y0 && y < y1);
    return [
      { x: widthAt(points, y0), y: y0 },
      ...inRange,
      { x: widthAt(points, y1), y: y1 },
    ].map(({ x, y }) => ({ x: this.cx + sign * x, y }));
  }

  private wallStrips(sign: -1 | 1): Strip[] {
    const strips: Strip[] = [];
    // Bands of a few units where the wall curves, longer where it's straight. The lens's clip
    // hides their steps.
    const rows = range(this.mouthY, this.wallEnd, 6);
    let start = rows[0];
    for (let i = 1; i < rows.length; i++) {
      const y = rows[i];
      const next = rows[i + 1];
      const straight =
        next !== undefined &&
        Math.abs(this.outerAt(next) - this.outerAt(start)) < 2 &&
        Math.abs(this.innerAt(next) - this.innerAt(start)) < 2;
      if (straight) continue;
      strips.push(...this.rowStrips(sign, start, y));
      start = y;
    }
    return strips;
  }

  private rowStrips(sign: -1 | 1, y0: number, y1: number): Strip[] {
    const mid = (y0 + y1) / 2;
    return wallStrips(
      this.cx,
      sign,
      this.outerAt(mid),
      this.innerAt(mid),
      y0,
      y1,
    );
  }
}

/**
 * A wall seen edge-on, from y0 to y1, between half-widths `outer` and `inner` from `cx`: the
 * gifts next to it are mirrored into it, squeezed more toward the outside, in three strips.
 */
export function wallStrips(
  cx: number,
  sign: -1 | 1,
  outer: number,
  inner: number,
  y0: number,
  y1: number,
): Strip[] {
  const reach = Math.max(18, (outer - inner) * 2.2);
  // Overlapping a little, so no seams show.
  const y = y0 - 0.5;
  const height = y1 - y0 + 1;
  const cuts = [0, 0.34, 0.68, 1];
  const shades = [0.62, 0.45, 0.3];
  const wallX = (t: number) => outer + (inner - outer) * t;
  const reachX = (t: number) => inner - reach * (1 - t) ** 1.4;
  return shades.map((shade, i) => {
    const a = cuts[i];
    const b = cuts[i + 1];
    const toLeft = cx + sign * (sign < 0 ? wallX(a) : wallX(b));
    const toRight = cx + sign * (sign < 0 ? wallX(b) : wallX(a));
    const fromLeft = cx + sign * (sign < 0 ? reachX(b) : reachX(a));
    const fromRight = cx + sign * (sign < 0 ? reachX(a) : reachX(b));
    return {
      from: { x: fromLeft, y, width: fromRight - fromLeft, height },
      to: { x: toLeft - 0.3, y, width: toRight - toLeft + 0.6, height },
      flipX: true,
      shade,
    };
  });
}
