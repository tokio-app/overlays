import { bowl } from "./bowl";
import { mason } from "./mason";
import type { JarPictures } from "./types";

export type { JarDesign, JarPictures } from "./types";
export { loadDesign } from "./trace";
export { loadLayer, type Layer } from "./tint";

// The pictures' bottom edge sits on this line, in the middle of the stage. The jar stands a little
// above it, with the total under it.
export const BOTTOM = 630;

/** The jars, by their value in config.yaml's jar setting. */
export const JARS: Record<string, JarPictures> = { mason, bowl };
export const DEFAULT_JAR = "mason";
