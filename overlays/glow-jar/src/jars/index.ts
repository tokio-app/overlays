import { mason } from "./mason";
import type { JarPictures } from "./types";

export type { JarDesign, JarPictures, Point } from "./types";
export { contains, glassWalls, walls } from "./geometry";
export { loadDesign } from "./trace";
export { loadLayer, type Layer, type RGB } from "./tint";

/**
 * The design stage, in px. Its height is fixed and its width is the page's, at least
 * `minWidth`: the jar's pictures (400) with room for a gift bubble on each side. Pages as wide as
 * 16:9 never need it; narrower ones show the stage a little smaller instead. main.ts scales it to
 * fit.
 */
export const STAGE = { height: 700, minWidth: 1180 };

// The pictures' bottom edge sits on this line, in the middle of the stage. The jar stands a little
// above it, with the total under it.
const BOTTOM = 630;

export const JAR: JarPictures = mason;

/** Where a jar's box sits on a stage `stageWidth` px wide. */
export function placement(jar: JarPictures, stageWidth: number) {
  return {
    x: stageWidth / 2 - jar.width / 2,
    y: BOTTOM - jar.height,
    width: jar.width,
    height: jar.height,
  };
}
