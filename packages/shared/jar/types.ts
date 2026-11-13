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
