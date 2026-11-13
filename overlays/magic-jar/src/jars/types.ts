import type { JarShape, Point } from "@tokio-overlays/shared/jar/types";

/**
 * One jar the streamer can pick. Its body is two SVG layers with the gifts' canvas between them:
 * the inside behind the gifts, and the body with its ornaments over them, open where the gifts
 * show. The physics come from the same numbers, so the gifts rest where the body is. The jar's
 * engine was written for glass jars: there "glass" means the body.
 */
export interface JarDesign extends JarShape {
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
  /** The body's top: once gifts rest above it, the jar is full. */
  bodyTop: number;
  /** The area inside the body below its top, in px², for how many gifts a reload pours. */
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
}
