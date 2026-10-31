/** A point in a jar's own units: x from the left of the jar's box, y from its top. */
export interface Point {
  x: number;
  y: number;
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
 * A jar as it ships: three pictures the same size, drawn at twice the stage's scale, and where
 * the tag and the bubbles attach to it. `back` and `front` go behind and over the gifts' canvas;
 * `walls` is the glass painted solid, open across the mouth, which trace.ts reads once into the
 * edges the gifts collide with. Nothing about the jar is worked out while it runs.
 */
export interface JarPictures {
  /** The pictures' size in stage px. The jar stands on the stage's line, centered on its x. */
  width: number;
  height: number;
  back: string;
  front: string;
  /** The main color the pictures are drawn in. */
  color: string;
  /**
   * How much of each pixel of `back` and `front` that color made, from black to white: what
   * the main color repaints. A layer without one keeps its colors.
   */
  backTint?: string;
  frontTint?: string;
  /** Sparkles in the empty jar, behind the gifts: stars, and dots under 3 units across. */
  sparkles: { x: number; y: number; r: number }[];
  /** A data URL, so its pixels can be read wherever the overlay is served from. */
  walls: string;
  /** What the tag's cord is, to match what the jar is tied with. */
  cord: "ribbon" | "rope";
  /** The body's top: once gifts rest above it, the jar is full. */
  bodyTop: number;
  /** The knot the top gifter's tag hangs from. */
  tag: Point;
  /** Where each gift bubble's tail touches the jar, on each side, top to bottom. */
  bubbles: { left: Point[]; right: Point[] };
}

/** A jar with the edges read from its walls picture, in its own units. */
export interface JarDesign extends JarPictures {
  /** The inner wall, from the opening's left edge around the floor to its right edge. */
  outline: Point[];
  /**
   * The glass's silhouette, from the rim's top on the left down to where it stands and up to the
   * rim's top on the right. Closed across the rim.
   */
  outside: Point[];
  /**
   * The narrowest opening above the body, which the gifts drop through: the mouth, or the neck
   * under a flared rim. They drop in between `left` and `right`, above `y`.
   */
  mouth: { left: number; right: number; y: number };
  /** The area inside the body below its top, in px², for how many gifts a reload pours. */
  bodyArea: number;
}
