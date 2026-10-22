// Geometry the vessels share: curves, paths, areas, and the physics walls around an inside or a
// whole body. The helpers are gift-jar's (src/jars/profile.ts), unchanged.
import type { Point, Wall } from "./types";

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
