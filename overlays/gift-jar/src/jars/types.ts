import type { Lens, Point } from "@tokio-overlays/shared/jar/types";

/**
 * One jar the streamer can pick. The glass is two SVG layers with the gifts' canvas between
 * them; the physics and the canvas's refraction come from the same numbers, so the gifts rest
 * where the glass is.
 */
export interface JarDesign {
  id: string;
  label: string;
  /** The jar's box. Every jar stands on the same line, centered on the same x. */
  width: number;
  height: number;
  /** The inner wall, from the opening's left edge around the floor to its right edge. */
  outline: Point[];
  /**
   * The glass's outer silhouette, from the rim's top on the left down around the bottom's front
   * and up to the rim's top on the right, as drawn. Closed across the rim.
   */
  outside: Point[];
  /** The gifts drop in between `left` and `right`, above `y`. */
  mouth: { left: number; right: number; y: number };
  /** The body's top: once gifts rest above it, the jar is full. */
  bodyTop: number;
  /** The area inside the body below its top, in px², for how many gifts a reload pours. */
  bodyArea: number;
  /**
   * Where the message's tail touches the glass, on its left side. The jars are symmetric, so on
   * the right it touches at `width - bubbleX`.
   */
  bubbleX: number;
  bubbleY: number;
  /** SVG markup behind and over the gifts. Its viewBox is the jar's box. */
  back: string;
  front: string;
  /** How the glass bends the gifts behind it. */
  lenses: Lens[];
}
