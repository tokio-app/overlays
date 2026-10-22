// The drawn style the jars share, and the builder that turns a jar's shapes into a design. Flat
// fills in the jar's tones, one outline color, a band of shade along each shape's right and lower
// edges and a few white highlights. No blurs, so the layers paint quickly. The colors are CSS
// variables main.ts sets from the jar's palette or the streamer's colors, so new colors don't
// redraw anything.
import { areaBelow, bubbleEdge, halfEllipse, num, pathOf } from "./geometry";
import type { JarDesign, Point } from "./types";

const TONES = {
  main: "var(--main)",
  mainLight: "var(--main-light)",
  mainDark: "var(--main-dark)",
  mainDeep: "var(--main-deep)",
  trim: "var(--trim)",
  trimLight: "var(--trim-light)",
  trimDark: "var(--trim-dark)",
  line: "var(--line)",
  white: "#fff",
};

export type Tone = keyof typeof TONES;

// The outline's width, in the jar's units.
const LINE = 4.5;

let ids = 0;

/** An id for a clip path or a gradient. Both of a jar's layers share the page, so ids never repeat. */
export function uid(): string {
  return `mj${++ids}`;
}

/** Mirrors points across the axis of a jar `width` wide. */
export function mirror(width: number) {
  return ({ x, y }: Point): Point => ({ x: width - x, y });
}

/**
 * A whole outline from its left half, which ends on the axis: down the left and back up the
 * right.
 */
export function both(left: Point[], width: number): Point[] {
  return [...left, ...left.slice(0, -1).map(mirror(width)).reverse()];
}

/** A closed path from a left half that ends on the axis. */
export function symmetric(left: Point[], width: number): string {
  return `${pathOf(both(left, width))}Z`;
}

/**
 * Points along an ellipse round (cx, cy), from `from` to `to` degrees, `steps` apart: 0 is right
 * and 90 is down.
 */
export function around(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  from: number,
  to: number,
  steps: number,
): Point[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
}

/** The angle, in degrees, of the point on an ellipse round (cx, cy) at height `y`, on its left. */
export function leftAngle(cy: number, ry: number, y: number): number {
  return (
    180 - (Math.asin(Math.max(-1, Math.min(1, (y - cy) / ry))) * 180) / Math.PI
  );
}

/** The outline round a path. */
export function outline(d: string, width = LINE): string {
  return `<path d="${d}" fill="none" stroke="${TONES.line}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
}

/** A path filled in a tone. Paths may hold holes. */
export function fill(d: string, name: Tone, opacity = 1): string {
  const alpha = opacity < 1 ? ` fill-opacity="${opacity}"` : "";
  return `<path d="${d}" fill="${TONES[name]}" fill-rule="evenodd"${alpha}/>`;
}

/**
 * A shape in a tone, outlined, with a band of `shade` along its right and lower edges: the shape
 * in the shade's tone, under itself in its own tone moved up and left, both clipped to it. The
 * outline follows `edges` when only some of the shape's edges are drawn.
 */
export function part(
  d: string,
  name: Tone,
  shade?: Tone,
  offset = 9,
  edges = d,
): string {
  if (!shade) return `${fill(d, name)}${outline(edges)}`;
  const id = uid();
  return `<clipPath id="${id}"><path d="${d}" clip-rule="evenodd"/></clipPath>
    <g clip-path="url(#${id})">
      ${fill(d, shade)}
      <path d="${d}" fill="${TONES[name]}" fill-rule="evenodd" transform="translate(${-offset} ${num(-offset * 0.45)})"/>
    </g>
    ${outline(edges)}`;
}

/**
 * A jar's body in its main tone: the outside with the inside cut out, both left halves that end
 * on the axis. Only their sides are outlined: they're closed across the top, where the rim is,
 * and a line there would cross the opening.
 */
export function shell(
  outside: Point[],
  inside: Point[],
  width: number,
  offset = 10,
): string {
  return part(
    `${symmetric(outside, width)} ${symmetric(inside, width)}`,
    "main",
    "mainDark",
    offset,
    `${pathOf(both(outside, width))} ${pathOf(both(inside, width))}`,
  );
}

/** A gradient stop in a tone. */
export function stop(offset: number, name: Tone, opacity = 1): string {
  return `<stop offset="${offset}" style="stop-color:${TONES[name]};stop-opacity:${opacity}"/>`;
}

/** A line of light along an edge. */
export function highlight(d: string, width = 4, opacity = 0.7): string {
  return `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${opacity}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** A four-pointed star, its points `r` from its center. */
export function sparkle(
  x: number,
  y: number,
  r: number,
  name: Tone = "trimLight",
  lined = true,
): string {
  const k = r * 0.24;
  const d = `M${num(x)} ${num(y - r)}Q${num(x + k)} ${num(y - k)} ${num(x + r)} ${num(y)}Q${num(x + k)} ${num(y + k)} ${num(x)} ${num(y + r)}Q${num(x - k)} ${num(y + k)} ${num(x - r)} ${num(y)}Q${num(x - k)} ${num(y - k)} ${num(x)} ${num(y - r)}Z`;
  return lined ? `${fill(d, name)}${outline(d, LINE * 0.55)}` : fill(d, name);
}

/** A dot, such as a rivet or a bubble. */
export function dot(x: number, y: number, r: number, name: Tone): string {
  return `<circle cx="${num(x)}" cy="${num(y)}" r="${num(r)}" fill="${TONES[name]}" stroke="${TONES.line}" stroke-width="${num(Math.min(LINE, r * 0.8))}"/>`;
}

/**
 * A crescent: the circle of radius `r` round (cx, cy), less the circle of radius `cut` round
 * (cx + dx, cy + dy). The cut circle must cross the first.
 */
export function crescent(
  cx: number,
  cy: number,
  r: number,
  dx: number,
  dy: number,
  cut: number,
): string {
  // Where the two circles cross.
  const d = Math.hypot(dx, dy);
  const a = (r * r - cut * cut + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r * r - a * a));
  const mx = cx + (dx * a) / d;
  const my = cy + (dy * a) / d;
  const p = { x: mx + (h * -dy) / d, y: my + (h * dx) / d };
  const q = { x: mx - (h * -dy) / d, y: my - (h * dx) / d };
  // The long way round the first circle, away from the cut, then back along the cut's edge.
  return `M${num(p.x)} ${num(p.y)}A${num(r)} ${num(r)} 0 1 1 ${num(q.x)} ${num(q.y)}A${num(cut)} ${num(cut)} 0 0 0 ${num(p.x)} ${num(p.y)}Z`;
}

/**
 * A round rim at `y` seen from slightly above: the ring between an outer and an inner ellipse
 * (ry = rx × tilt) and a face `height` tall under the outer one. The whole ring goes behind the
 * gifts (`back`) and its near half and its face over them (`front`), so the two halves overlap
 * instead of meeting in a seam. `hollow` is a jar's inside under the rim, as one shape with the
 * opening's far edge, to fill behind the gifts.
 */
export function rim(
  cx: number,
  y: number,
  outer: number,
  inner: number,
  tilt: number,
  height: number,
  tones: { top: Tone; face: Tone; shade: Tone },
): { back: string; front: string; hollow: (inside: Point[]) => string } {
  const o = { y, rx: outer, ry: outer * tilt };
  const i = { y, rx: inner, ry: inner * tilt };
  const ellipse = ({ rx, ry }: typeof o) =>
    `${halfEllipse(cx, { y, rx, ry }, false)}A${num(rx)} ${num(ry)} 0 0 1 ${num(cx - rx)} ${num(y)}Z`;
  const near = `${halfEllipse(cx, o, true)}L${num(cx + inner)} ${num(y)}A${num(inner)} ${num(i.ry)} 0 0 1 ${num(cx - inner)} ${num(y)}Z`;
  const face = `${halfEllipse(cx, o, true)}L${num(cx + outer)} ${num(y + height)}A${num(outer)} ${num(o.ry)} 0 0 1 ${num(cx - outer)} ${num(y + height)}Z`;
  // Each half is outlined along its curves only, so nothing marks where they meet.
  const curves = (front: boolean) =>
    `${halfEllipse(cx, o, front)} ${halfEllipse(cx, i, front)}`;
  return {
    back: part(
      `${ellipse(o)} ${ellipse(i)}`,
      tones.top,
      undefined,
      9,
      curves(false),
    ),
    front: `${part(face, tones.face, tones.shade, 6)}${part(near, tones.top, undefined, 9, curves(true))}`,
    hollow: (inside) =>
      `${pathOf(both(inside, cx * 2))}A${num(inner)} ${num(i.ry)} 0 0 0 ${num(cx - inner)} ${num(y)}Z`,
  };
}

/** How far left any of these lines reach at `y`, for where the message may touch. */
export function leftEdge(...lines: Point[][]): (y: number) => number {
  return (y) => {
    let x = Infinity;
    for (const points of lines) {
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        if ((a.y - y) * (b.y - y) > 0) continue;
        const at =
          a.y === b.y
            ? Math.min(a.x, b.x)
            : a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
        x = Math.min(x, at);
      }
    }
    return x;
  };
}

export interface VesselSpec {
  id: string;
  label: string;
  palette: { main: string; trim: string };
  width: number;
  height: number;
  /** The inside's left half: from the opening's left edge, on the rim, down to the floor on the axis. */
  inside: Point[];
  /**
   * The body's left half, for the physics: from the rim's top on the left down to where it
   * stands, ending on the axis. Ornaments that stick out aren't in it.
   */
  silhouette: Point[];
  /** The fill limit counts the inside below this. */
  bodyTop: number;
  /** Where the message's tail touches, and how far left the drawing reaches at each height. */
  bubbleY: number;
  leftmost: (y: number) => number;
  /** The ground it stands on: its height and how wide the shadow there is. */
  ground: { y: number; rx: number };
  /** SVG behind the gifts (after the shadow) and over them, in the jar's units. */
  back: string;
  front: string;
}

/** A jar from its shapes and its art. */
export function vessel(spec: VesselSpec): JarDesign {
  const { width, height, ground } = spec;
  const outline = both(spec.inside, width);
  const view = `viewBox="0 0 ${width} ${height}" aria-hidden="true"`;
  const opening = spec.inside[0];
  return {
    id: spec.id,
    label: spec.label,
    palette: spec.palette,
    width,
    height,
    outline,
    outside: both(spec.silhouette, width),
    mouth: { left: opening.x, right: width - opening.x, y: opening.y },
    bodyArea: areaBelow(outline, spec.bodyTop),
    bubbleX: bubbleEdge(spec.leftmost, spec.bubbleY),
    bubbleY: spec.bubbleY,
    back: `<svg ${view}>
  <ellipse cx="${width / 2}" cy="${num(ground.y)}" rx="${num(ground.rx)}" ry="${num(ground.rx * 0.11)}" fill="#000" fill-opacity=".32"/>
  ${spec.back}
</svg>`,
    front: `<svg ${view}>
  ${spec.front}
</svg>`,
    lenses: [],
  };
}
