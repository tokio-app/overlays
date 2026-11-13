import { apothecary } from "./apothecary";
import { fishbowl } from "./fishbowl";
import { heart } from "./heart";
import { honey } from "./honey";
import { mason } from "./mason";
import { tip } from "./tip";
import type { JarDesign } from "./types";

export type { JarDesign } from "./types";

/** The jars to pick from, in the settings' order. */
export const JARS: readonly JarDesign[] = [
  mason,
  apothecary,
  fishbowl,
  tip,
  honey,
  heart,
];

export const DEFAULT_JAR = "mason";

/** The jar with this id, or the default one for an unknown id. */
export function jarById(id: unknown): JarDesign {
  return (
    JARS.find((jar) => jar.id === id) ??
    JARS.find((jar) => jar.id === DEFAULT_JAR) ??
    JARS[0]
  );
}
