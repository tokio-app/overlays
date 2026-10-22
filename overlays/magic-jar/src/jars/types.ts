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

/**
 * One jar the streamer can pick. Its body is two SVG layers with the gifts' canvas between them:
 * the inside behind the gifts, and the body with its ornaments over them, open where the gifts
 * show. The physics come from the same numbers, so the gifts rest where the body is. jar.ts is
 * gift-jar's, whose jars are glass: there "glass" means the body.
 */
export interface JarDesign {
  id: string;
  label: string;
  /** The colors its tones are mixed from, unless the streamer picks their own. */
  palette: { main: string; trim: string };
  /** The jar's box. Every jar stands on the same line, centered on the same x. */
  width: number;
  height: number;
  /** The inner wall, from the opening's left edge around the floor to its right edge. */
  outline: Point[];
  /**
   * The body's silhouette, from the rim's top on the left down to where it stands and up to the
   * rim's top on the right, without the ornaments that stick out. Closed across the rim.
   */
  outside: Point[];
  /** The gifts drop in between `left` and `right`, above `y`. */
  mouth: { left: number; right: number; y: number };
  /** The area inside the body, in px², for how many gifts fit. */
  bodyArea: number;
  /**
   * Where the message's tail touches the jar, on its left side. The jars are symmetric, so on
   * the right it touches at `width - bubbleX`.
   */
  bubbleX: number;
  bubbleY: number;
  /** SVG markup behind and over the gifts. Its viewBox is the jar's box. */
  back: string;
  front: string;
  /** How a glass body bends the gifts behind it. A drawn one bends nothing, so always none. */
  lenses: Lens[];
}
