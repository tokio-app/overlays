import { cauldron } from "./cauldron";
import { chest } from "./chest";
import { cone } from "./cone";
import { gumballMachine } from "./gumball";
import { hat } from "./hat";
import { moonCup } from "./moon";
import { piggy } from "./piggy";
import { trophy } from "./trophy";
import { tub } from "./tub";
import type { JarDesign } from "./types";

export type { JarDesign, Point, Rect, Strip } from "./types";
export { contains, glassWalls, walls } from "./geometry";

/**
 * The design stage, in px. Its height is fixed and its width is the page's, at least
 * `minWidth`: the widest jar (380) with room for a typical message (about 380) on each side, so
 * short names aren't cut. Pages as wide as 16:9 never need it; narrower ones show the stage a
 * little smaller instead. main.ts scales it to fit.
 */
export const STAGE = { height: 700, minWidth: 1180 };

// Every jar stands on the same line, in the middle of the stage, so the gifter and the total stay
// put when the jar changes.
const BOTTOM = 560;

/** The jars to pick from, in the settings' order. */
export const JARS: readonly JarDesign[] = [
  moonCup,
  chest,
  cauldron,
  trophy,
  hat,
  cone,
  tub,
  gumballMachine,
  piggy,
];

export const DEFAULT_JAR = "moon";

/** The jar with this id, or the default one for an unknown id. */
export function jarById(id: unknown): JarDesign {
  return (
    JARS.find((jar) => jar.id === id) ??
    JARS.find((jar) => jar.id === DEFAULT_JAR) ??
    JARS[0]
  );
}

/** Where a jar's box sits on a stage `stageWidth` px wide. */
export function placement(jar: JarDesign, stageWidth: number) {
  return {
    x: stageWidth / 2 - jar.width / 2,
    y: BOTTOM - jar.height,
    width: jar.width,
    height: jar.height,
  };
}
