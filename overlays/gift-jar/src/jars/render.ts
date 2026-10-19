// The glass, drawn as SVG for this overlay. Each jar is two layers with the gifts' canvas between
// them: the far wall, the floor and the far half of each rim behind the gifts, and the near
// wall, its reflections and the near halves over them. Colors come from CSS variables set from
// the glass color setting, so a new color doesn't redraw anything.
import {
  halfEllipse,
  num,
  pathOf,
  range,
  type Ellipse,
  type Round,
  type Surface,
} from "./profile";
import type { JarDesign, Point } from "./types";

const TONES = {
  white: "#fff",
  light: "var(--glass-light)",
  glass: "var(--glass)",
  edge: "var(--glass-edge)",
  deep: "var(--glass-deep)",
};

export type Tone = keyof typeof TONES;

/** A fill or stroke in one of the glass's tones. */
export function paint(
  property: "fill" | "stroke",
  tone: Tone,
  opacity: number,
): string {
  return `${property}:${TONES[tone]};${property}-opacity:${opacity}`;
}

/** A gradient stop in one of the glass's tones. */
export function stop(offset: number, tone: Tone, opacity: number): string {
  return `<stop offset="${offset}" style="stop-color:${TONES[tone]};stop-opacity:${opacity}"/>`;
}

/**
 * The glass's color over the gifts behind it: about nothing for clear glass, more the more
 * colorful the glass is (main.ts sets --glass-tint).
 */
export function tint(d: string): string {
  return `<path d="${d}" style="fill:var(--glass);fill-opacity:var(--glass-tint, 0)"/>`;
}

/**
 * What a glass jar casts on the surface it stands on, centered at (cx, y) with half-width rx:
 * a shadow, falling a little right of the window on the left, darkest where the glass touches,
 * and a soft caustic in the glass's color where it focuses the light.
 */
export function castShadow(
  prefix: string,
  cx: number,
  y: number,
  rx: number,
  ry: number,
): string {
  return `<ellipse cx="${num(cx + rx * 0.08)}" cy="${num(y + ry * 0.35)}" rx="${num(rx + 30)}" ry="${num(ry + 12)}" fill="url(#${prefix}-shadow)" ${blur(prefix, 3)}/>
  <ellipse cx="${num(cx)}" cy="${num(y - ry * 0.45)}" rx="${num(rx * 0.97)}" ry="${num(ry * 0.75)}" fill="#000" opacity=".4" ${blur(prefix, 2)}/>
  <ellipse cx="${num(cx + rx * 0.4)}" cy="${num(y)}" rx="${num(rx * 0.42)}" ry="${num(ry * 0.45)}" style="${paint("fill", "light", 0.16)}" ${blur(prefix, 4)}/>`;
}

/** A filled shape. */
export function shape(d: string, style: string, extra = ""): string {
  return `<path d="${d}" style="${style}" ${extra}/>`;
}

/** A line, round at its ends. */
export function line(
  d: string,
  tone: Tone,
  opacity: number,
  width: number,
  extra = "",
): string {
  return `<path d="${d}" style="fill:none;${paint("stroke", tone, opacity)};stroke-width:${width};stroke-linecap:round;stroke-linejoin:round" ${extra}/>`;
}

/** A line drawn with a gradient, round at its ends. */
export function lineUrl(
  d: string,
  gradient: string,
  opacity: number,
  width: number,
  extra = "",
): string {
  return `<path d="${d}" style="fill:none;stroke:url(#${gradient});stroke-opacity:${opacity};stroke-width:${width};stroke-linecap:round;stroke-linejoin:round" ${extra}/>`;
}

/** Gaussian blurs `<prefix>-blur<n>` for each n, sized to the jar so nothing is clipped. */
export function blurs(
  prefix: string,
  width: number,
  height: number,
  sizes: number[],
): string {
  return sizes
    .map(
      (size) =>
        `<filter id="${prefix}-blur${String(size).replace(".", "_")}" filterUnits="userSpaceOnUse" x="-80" y="-80" width="${width + 160}" height="${height + 160}"><feGaussianBlur stdDeviation="${size}"/></filter>`,
    )
    .join("");
}

export function blur(prefix: string, size: number): string {
  return `filter="url(#${prefix}-blur${String(size).replace(".", "_")})"`;
}

/** The far (upper) or near (lower) half of the ring between two ellipses at the same height. */
export function ringHalf(
  cx: number,
  y: number,
  outer: Ellipse,
  inner: Ellipse,
  near: boolean,
): string {
  const sweep = near ? 0 : 1;
  return `M${num(cx - outer.rx)} ${num(y)}A${num(outer.rx)} ${num(outer.ry)} 0 0 ${sweep} ${num(cx + outer.rx)} ${num(y)}L${num(cx + inner.rx)} ${num(y)}A${num(inner.rx)} ${num(inner.ry)} 0 0 ${1 - sweep} ${num(cx - inner.rx)} ${num(y)}Z`;
}

/** The front of a band around the jar, from the front half of `top` down `height` units. */
export function bandFront(cx: number, top: Ellipse, height: number): string {
  return `M${num(cx - top.rx)} ${num(top.y)}A${num(top.rx)} ${num(top.ry)} 0 0 0 ${num(cx + top.rx)} ${num(top.y)}L${num(cx + top.rx)} ${num(top.y + height)}A${num(top.rx)} ${num(top.ry)} 0 0 1 ${num(cx - top.rx)} ${num(top.y + height)}Z`;
}

/** Half an ellipse, as an open line. */
export function arc(cx: number, e: Ellipse, near: boolean): string {
  return halfEllipse(cx, e, near);
}

/**
 * A raised thread on a neck of half-width `rx`, from `from` to `to` degrees round from the front,
 * dropping `pitch` units a turn. Returns the ridge's outline and its upper and lower edges.
 */
export function thread(
  jar: Surface,
  y: number,
  rx: number,
  pitch: number,
  from: number,
  to: number,
  thickness: number,
  // Where the whole thread starts and ends, for its tapered ends.
  start = from,
  end = to,
): { ridge: string; upper: string; lower: string } {
  const upper: Point[] = [];
  const lower: Point[] = [];
  // The edges' lines stop short of the tapered ends.
  const edges: { upper: Point; lower: Point }[] = [];
  for (const angle of range(from, to, 3)) {
    // The ends taper, as a thread's do.
    const taper = Math.min(1, (angle - start) / 30, (end - angle) / 30);
    const at = jar.around(y + (pitch * angle) / 360, rx, angle);
    const below = { x: at.x, y: at.y + thickness * Math.max(0.1, taper) };
    upper.push(at);
    lower.push(below);
    if (taper > 0.6) edges.push({ upper: at, lower: below });
  }
  return {
    ridge: `${pathOf(upper)} ${pathOf([...lower].reverse(), "L")}Z`,
    upper: edges.length > 1 ? pathOf(edges.map((e) => e.upper)) : "",
    lower: edges.length > 1 ? pathOf(edges.map((e) => e.lower)) : "",
  };
}

/**
 * A helix of thread from `from` to `to` degrees, split into the halves seen through the neck
 * (behind the gifts) and the halves in front.
 */
export function helix(
  jar: Surface,
  y: number,
  rx: number,
  pitch: number,
  from: number,
  to: number,
  thickness: number,
): { near: ReturnType<typeof thread>[]; far: ReturnType<typeof thread>[] } {
  const near: ReturnType<typeof thread>[] = [];
  const far: ReturnType<typeof thread>[] = [];
  // Cut at the sides, every half turn: -90, 90, 270...
  let a = from;
  while (a < to) {
    const turn = Math.floor((a + 90) / 180);
    const b = Math.min(to, turn * 180 + 90);
    if (b - a > 1) {
      (turn % 2 === 0 ? near : far).push(
        thread(jar, y, rx, pitch, a, b, thickness, from, to),
      );
    }
    a = b;
  }
  return { near, far };
}

/**
 * The front of the circle of half-width `rx` at `y`, from one angle to another: a line of light
 * along a curved shoulder or heel.
 */
export function ringArc(
  jar: Surface,
  y: number,
  rx: number,
  from: number,
  to: number,
): string {
  return pathOf(range(from, to, 3).map((angle) => jar.around(y, rx, angle)));
}

/** Light caught along a rounded heel at `y`, brighter on the window's side. */
export function heel(jar: Round, y: number): string {
  const rx = jar.outerAt(y) - 2;
  return `${line(ringArc(jar, y, rx, -82, -30), "white", 0.45, 2, blur("jf", 1))}
      ${line(ringArc(jar, y, rx, 40, 76), "white", 0.3, 1.5, blur("jf", 0.6))}`;
}

/** A neck's threads: their far halves, seen through the glass, and their near halves. */
export function threads(turns: ReturnType<typeof helix>): {
  back: string;
  front: string;
} {
  return {
    back: turns.far
      .map(
        (t) => `${shape(t.ridge, paint("fill", "light", 0.16))}
      ${line(t.upper, "white", 0.3, 1)}
      ${line(t.lower, "deep", 0.35, 1.2)}`,
      )
      .join(""),
    // Each ridge casts a soft shadow on the neck under it.
    front: turns.near
      .map(
        (
          t,
        ) => `${line(t.lower, "deep", 0.4, 3, `transform="translate(0 1.5)" ${blur("jf", 1)}`)}
      ${shape(t.ridge, paint("fill", "light", 0.5))}
      ${line(t.lower, "deep", 0.7, 1.4)}
      ${line(t.upper, "white", 0.85, 1.2)}`,
      )
      .join(""),
  };
}

/**
 * A rim seen from slightly above: the far half of its top behind the gifts, and the near half
 * with its front face, `height` units tall, over them. `depth` units of the neck's far inside
 * show below the opening.
 */
export function rim(
  surface: Surface,
  outer: Ellipse,
  inner: Ellipse,
  height: number,
  depth = 0,
): { back: string; front: string } {
  const { cx } = surface;
  const { y } = outer;
  const far =
    depth > 0
      ? shape(
          `${arc(cx, inner, false)} L${num(cx + inner.rx)} ${num(y + depth)} A${num(inner.rx)} ${num(inner.ry)} 0 0 0 ${num(cx - inner.rx)} ${num(y + depth)}Z`,
          paint("fill", "glass", 0.1),
        )
      : "";
  // Small sharp reflections of the window and the lamp on the rim's front.
  const window = surface.around(y + height * 0.45, outer.rx, -46);
  const lamp = surface.around(y + height * 0.35, outer.rx, 52);
  return {
    back: `${shape(ringHalf(cx, y, outer, inner, false), paint("fill", "light", 0.3))}
      ${line(arc(cx, outer, false), "white", 0.55, 1.4)}
      ${far}
      ${line(arc(cx, inner, false), "white", 0.75, 1.6)}
      ${line(arc(cx, { ...inner, y: y + 3 }, false), "deep", 0.5, 1.6, blur("jb", 0.6))}`,
    front: `${shape(bandFront(cx, outer, height), "fill:url(#jf-lip)")}
      ${shape(bandFront(cx, outer, height), "fill:url(#jf-sheen)")}
      ${shape(ringHalf(cx, y, outer, inner, true), paint("fill", "light", 0.42))}
      ${line(arc(cx, { ...outer, y: y + height }, true), "deep", 0.7, 1.5)}
      ${line(arc(cx, outer, true), "white", 0.95, 1.6)}
      ${line(arc(cx, inner, true), "white", 0.6, 1.2)}
      ${line(arc(cx, { ...inner, y: y + 2.5 }, true), "deep", 0.45, 1.2, blur("jf", 0.6))}
      <ellipse cx="${num(window.x)}" cy="${num(window.y)}" rx="9" ry="2.3" fill="#fff" opacity=".9" ${blur("jf", 1)}/>
      <ellipse cx="${num(lamp.x)}" cy="${num(lamp.y)}" rx="5" ry="1.6" fill="#fff" opacity=".6" ${blur("jf", 1)}/>`,
  };
}

/**
 * The gradients every jar's front layer uses: lines that change down the jar (white, light and
 * deep, from `top` to `bottom`), the wall seen edge-on, the thick glass bottom and a rim's front.
 */
export function glassDefs(top: number, bottom: number): string {
  const down = `gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${num(top)}" y2="${num(bottom)}"`;
  return `<linearGradient id="jf-vw" ${down}>
      ${stop(0, "white", 1)}
      ${stop(0.2, "white", 0.85)}
      ${stop(0.5, "white", 0.5)}
      ${stop(0.8, "white", 0.75)}
      ${stop(1, "white", 1)}
    </linearGradient>
    <linearGradient id="jf-vl" ${down}>
      ${stop(0, "light", 1)}
      ${stop(0.25, "light", 0.8)}
      ${stop(0.55, "light", 0.55)}
      ${stop(0.85, "light", 0.8)}
      ${stop(1, "light", 1)}
    </linearGradient>
    <linearGradient id="jf-vd" ${down}>
      ${stop(0, "deep", 0.6)}
      ${stop(0.5, "deep", 1)}
      ${stop(1, "deep", 0.8)}
    </linearGradient>
    <linearGradient id="jf-wall" x1="0" x2="0" y1="0" y2="1">
      ${stop(0, "light", 0.6)}
      ${stop(0.25, "light", 0.44)}
      ${stop(0.7, "glass", 0.42)}
      ${stop(1, "glass", 0.5)}
    </linearGradient>
    <linearGradient id="jf-slab" x1="0" x2="0" y1="0" y2="1">
      ${stop(0, "white", 0.42)}
      ${stop(0.18, "light", 0.32)}
      ${stop(0.45, "glass", 0.34)}
      ${stop(0.75, "deep", 0.5)}
      ${stop(1, "edge", 0.6)}
    </linearGradient>
    <linearGradient id="jf-lip" x1="0" x2="0" y1="0" y2="1">
      ${stop(0, "white", 0.85)}
      ${stop(0.35, "light", 0.42)}
      ${stop(0.7, "glass", 0.32)}
      ${stop(1, "deep", 0.65)}
    </linearGradient>
    <linearGradient id="jf-sheen" x1="0" x2="1" y1="0" y2="0">
      ${stop(0, "deep", 0.5)}
      ${stop(0.06, "light", 0.2)}
      ${stop(0.18, "white", 0.5)}
      ${stop(0.3, "white", 0)}
      ${stop(0.75, "white", 0)}
      ${stop(0.88, "white", 0.35)}
      ${stop(0.95, "light", 0.15)}
      ${stop(1, "deep", 0.5)}
    </linearGradient>`;
}

/** The radial shadow's gradient, for castShadow. */
export function shadowDefs(prefix: string): string {
  return `<radialGradient id="${prefix}-shadow">
      <stop offset="0" stop-color="#000" stop-opacity=".55"/>
      <stop offset=".55" stop-color="#000" stop-opacity=".25"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </radialGradient>`;
}

/** A reflection on the outside of a round jar: a window (soft) or a lamp (sharp). */
export interface Glint {
  /** Its edges, in degrees round from the front. Negative is left. */
  from: number;
  to: number;
  y0: number;
  y1: number;
  opacity: number;
  /** The blur, in units. 0 is sharp. */
  blur: 0 | 1 | 2 | 4 | 8;
  /** Below the outside's surface, in units, to keep it off the silhouette's edge. */
  inset?: number;
}

export interface RoundParts {
  /** Behind the gifts, over the shared far wall and floor: the far half of rims and threads. */
  back?: string;
  /** Over the gifts, under the shared walls: things seen through the front glass. */
  inner?: string;
  /** Over everything: the near half of rims and threads, speculars. */
  front?: string;
  /** Defs used by the parts. */
  defs?: string;
}

export interface RoundSpec {
  id: string;
  label: string;
  jar: Round;
  /** Where the main reflections run, top to bottom. */
  glints: Glint[];
  /** Reflections on the far wall's inside, seen through the front. */
  farGlints: Glint[];
  parts: RoundParts;
}

const SIZES = [0.6, 1, 1.5, 2, 3, 4, 6, 8, 12];

/** A round jar, from its geometry and its own details. */
export function roundJar(spec: RoundSpec): JarDesign {
  const { jar, parts } = spec;
  const { width, height } = jar.profile;
  const view = `viewBox="0 0 ${width} ${height}"`;
  const { cx, floor, base, bottom } = jar;
  const glints = (prefix: string, list: Glint[]) =>
    list
      .map((glint) => {
        const d = jar.strip(
          glint.from,
          glint.to,
          glint.y0,
          glint.y1,
          glint.inset ?? 0,
        );
        const filter = glint.blur ? blur(prefix, glint.blur) : "";
        return `<path d="${d}" fill="url(#${prefix}-glint)" opacity="${glint.opacity}" ${filter}/>`;
      })
      .join("");

  const thickness = jar.outerAt(jar.wallEnd) - jar.innerAt(jar.wallEnd);
  // The inside's edge, both sides at once.
  const insideEdge = `${pathOf(jar.contour(1, -1))} ${pathOf(jar.contour(1, 1))}`;
  // The wall's lines on one side: light, dark, light, dark and the inner edge's light, as glass
  // seen edge-on bends what's around it. The window is on the left, so that side is brighter.
  // They go on down the wall's foot to the floor's edge, so the foot doesn't look like a patch.
  const wallLines = (sign: -1 | 1) => {
    const lit = sign < 0 ? 1 : 0.7;
    const at = (t: number) =>
      pathOf(jar.contour(t, sign, jar.mouthY, jar.floor.y));
    return `${lineUrl(at(0.24), "jf-vd", 0.6, Math.max(1.2, thickness * 0.12))}
    ${lineUrl(at(0.55), "jf-vw", 0.55 * lit, Math.max(1.2, thickness * 0.14), blur("jf", 0.6))}
    ${lineUrl(at(0.86), "jf-vd", 0.5, Math.max(1, thickness * 0.1))}
    ${lineUrl(at(1), "jf-vw", 0.8 * lit, 1.1)}`;
  };
  const bands = `${jar.band(-1)} ${jar.band(1)}`;

  // Rings inside the glass bottom, between its floor and its base: the bottom's own edges seen
  // again and again through its thickness.
  const rings = [0.28, 0.52, 0.74]
    .map((t, i) => {
      const e = {
        y: floor.y + (base.y - floor.y) * t,
        rx: floor.rx + (base.rx - floor.rx) * t,
        ry: floor.ry + (base.ry - floor.ry) * t,
      };
      return i % 2 === 0
        ? line(arc(cx, e, true), "white", 0.3, 1.2)
        : line(arc(cx, e, true), "deep", 0.45, 1.6);
    })
    .join("");

  const back = `<svg ${view} aria-hidden="true">
  <defs>
    ${blurs("jb", width, height, SIZES)}
    ${shadowDefs("jb")}
    <linearGradient id="jb-far" x1="0" x2="1" y1="0" y2="0">
      ${stop(0, "glass", 0.2)}
      ${stop(0.1, "glass", 0.06)}
      ${stop(0.3, "glass", 0.015)}
      ${stop(0.7, "glass", 0.015)}
      ${stop(0.9, "glass", 0.06)}
      ${stop(1, "glass", 0.2)}
    </linearGradient>
    <linearGradient id="jb-glint" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".2" stop-color="#fff" stop-opacity="1"/>
      <stop offset=".8" stop-color="#fff" stop-opacity=".8"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  ${castShadow("jb", cx, bottom.y + bottom.ry, bottom.rx, bottom.ry)}
  ${shape(jar.inside, "fill:url(#jb-far)")}
  ${glints("jb", spec.farGlints)}
  <ellipse cx="${cx}" cy="${num(floor.y)}" rx="${num(floor.rx)}" ry="${num(floor.ry)}" style="${paint("fill", "light", 0.07)}"/>
  ${line(arc(cx, { ...floor, rx: floor.rx - 5, ry: floor.ry - 1.5 }, false), "deep", 0.35, 2.4, blur("jb", 1))}
  ${line(arc(cx, floor, false), "white", 0.4, 1.3)}
  ${parts.back ?? ""}
</svg>`;

  const front = `<svg ${view} aria-hidden="true">
  <defs>
    ${blurs("jf", width, height, SIZES)}
    ${parts.defs ?? ""}
    <clipPath id="jf-inside"><path d="${jar.inside}"/></clipPath>
    <clipPath id="jf-glass"><path d="${jar.silhouette}"/></clipPath>
    <linearGradient id="jf-wash" x1="0" x2="1" y1="0" y2="0">
      ${stop(0, "glass", 0.14)}
      ${stop(0.08, "glass", 0.05)}
      ${stop(0.25, "glass", 0.015)}
      ${stop(0.75, "glass", 0.015)}
      ${stop(0.92, "glass", 0.05)}
      ${stop(1, "glass", 0.14)}
    </linearGradient>
    ${glassDefs(jar.top, bottom.y + bottom.ry)}
    <linearGradient id="jf-glint" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".14" stop-color="#fff" stop-opacity="1"/>
      <stop offset=".78" stop-color="#fff" stop-opacity=".85"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>

  ${shape(jar.inside, "fill:url(#jf-wash)")}
  ${tint(jar.inside)}
  <g clip-path="url(#jf-inside)">
    ${lineUrl(insideEdge, "jf-vl", 0.55, 22, blur("jf", 6))}
    ${lineUrl(insideEdge, "jf-vw", 0.42, 4, blur("jf", 1.5))}
  </g>
  ${parts.inner ?? ""}
  ${shape(bands, "fill:url(#jf-wall)")}
  ${shape(`${jar.foot(-1)} ${jar.foot(1)}`, paint("fill", "glass", 0.5))}
  ${shape(jar.slab, "fill:url(#jf-slab)")}
  ${rings}

  ${glints("jf", spec.glints)}

  <g clip-path="url(#jf-glass)">
    ${lineUrl(jar.outerEdge, "jf-vw", 0.35, 5, blur("jf", 2))}
    ${wallLines(-1)}
    ${wallLines(1)}
    ${lineUrl(jar.outerEdge, "jf-vl", 1, 1.4)}
  </g>
  ${line(arc(cx, { ...floor, y: floor.y + 2.5 }, true), "deep", 0.5, 2, blur("jf", 1))}
  ${line(arc(cx, floor, true), "white", 0.8, 1.6)}
  ${line(arc(cx, { ...base, y: base.y - 3, rx: base.rx - 4 }, true), "white", 0.45, 1.4)}
  ${parts.front ?? ""}
</svg>`;

  return {
    id: spec.id,
    label: spec.label,
    width,
    height,
    outline: jar.outline,
    outside: jar.outside,
    mouth: jar.mouth,
    bodyArea: jar.bodyArea,
    bubbleX: jar.bubbleX,
    bubbleY: jar.profile.bubbleY,
    back,
    front,
    lenses: jar.lenses,
  };
}
