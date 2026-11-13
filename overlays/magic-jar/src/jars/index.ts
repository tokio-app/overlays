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

export type { JarDesign } from "./types";

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
