/** A point in a jar's own units: x from the left of the jar's box, y from its top. */
export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A thin static rectangle the gifts rest against, in the jar's units. */
export interface Wall {
  x: number;
  y: number;
  length: number;
  thickness: number;
  angle: number;
}

/**
 * A piece of the gifts' canvas that the glass bends: the gifts in `from` are drawn into `to`,
 * squeezed or mirrored, then darkened by `shade` (0 to 1). In the jar's units.
 */
export interface Strip {
  from: Rect;
  to: Rect;
  flipX?: boolean;
  flipY?: boolean;
  shade: number;
}

/** Strips drawn inside one outline (an SVG path in the jar's units), so their edges follow it. */
export interface Lens {
  clip: string;
  strips: Strip[];
}

/** What the jar's engine reads of a jar, in the jar's own units. */
export interface JarShape {
  /** The jar's box. Every jar stands on the same line, centered on the same x. */
  width: number;
  height: number;
  /** The inner wall, from the opening's left edge around the floor to its right edge. */
  outline: Point[];
  /** The jar's silhouette, from the rim's top on the left around and back up. Closed across it. */
  outside: Point[];
  /** The gifts drop in between `left` and `right`, above `y`. */
  mouth: { left: number; right: number; y: number };
  /** The body's top: once gifts rest above it, the jar is full. */
  bodyTop: number;
  /** The area inside the body below its top, in px², for how many gifts a reload pours. */
  bodyArea: number;
  /** How the glass bends the gifts behind it. None bends nothing. */
  lenses?: Lens[];
}
