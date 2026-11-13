// Reads the card's settings. A missing or bad value keeps the previous one.
import type { ConfigData } from "@tokioapp/overlay";
import {
  ALIGNS,
  boolean,
  color,
  FONT_MAX_LENGTH,
  number,
  oneOf,
} from "../settings";
import { LIGHTS, type Light } from "./light";

const VISIBILITIES = ["always", "after_gift"] as const;
const LAYOUTS = ["stacked", "row"] as const;
const ENTRANCES = ["pop", "drop", "spin", "slide", "fade"] as const;

export interface Settings {
  visibility: (typeof VISIBILITIES)[number];
  seconds: number;
  clearHours: number;
  title: string;
  showPhoto: boolean;
  showCombo: boolean;
  showCoins: boolean;
  layout: (typeof LAYOUTS)[number];
  align: (typeof ALIGNS)[number];
  font: string;
  size: number;
  entrance: (typeof ENTRANCES)[number];
  light: Light;
  lightMoves: boolean;
  float: boolean;
  sparkles: boolean;
  mainColor: string;
  lightColor: string;
  nameColor: string;
  coinColor: string;
  outlineColor: string;
}

/** The same as config.yaml's defaults. The title's is each overlay's own. */
export function defaults(title: string): Settings {
  return {
    visibility: "always",
    seconds: 10,
    clearHours: 6,
    title,
    showPhoto: true,
    showCombo: true,
    showCoins: true,
    layout: "stacked",
    align: "center",
    font: "",
    size: 100,
    entrance: "pop",
    light: "rays",
    lightMoves: true,
    float: true,
    sparkles: true,
    mainColor: "#f43f5e",
    lightColor: "#f43f5e",
    nameColor: "#f1f5f9",
    coinColor: "#ffc93c",
    outlineColor: "#18181b",
  };
}

/** The keys are the field ids in config.yaml. */
export function readSettings(config: ConfigData, previous: Settings): Settings {
  const font = typeof config.font === "string" ? config.font : previous.font;
  return {
    visibility: oneOf(config.visibility, VISIBILITIES, previous.visibility),
    seconds: number(config.seconds, 1, previous.seconds),
    clearHours: number(config.clear_hours, 1, previous.clearHours),
    title:
      typeof config.title === "string" ? config.title.trim() : previous.title,
    showPhoto: boolean(config.show_photo, previous.showPhoto),
    showCombo: boolean(config.show_combo, previous.showCombo),
    showCoins: boolean(config.show_coins, previous.showCoins),
    layout: oneOf(config.layout, LAYOUTS, previous.layout),
    align: oneOf(config.align, ALIGNS, previous.align),
    font: font.length <= FONT_MAX_LENGTH ? font : previous.font,
    size: number(config.size, 1, previous.size),
    entrance: oneOf(config.entrance, ENTRANCES, previous.entrance),
    light: oneOf(config.light, LIGHTS, previous.light),
    lightMoves: boolean(config.light_moves, previous.lightMoves),
    float: boolean(config.float, previous.float),
    sparkles: boolean(config.sparkles, previous.sparkles),
    mainColor: color(config.main_color, previous.mainColor),
    lightColor: color(config.light_color, previous.lightColor),
    nameColor: color(config.name_color, previous.nameColor),
    coinColor: color(config.coin_color, previous.coinColor),
    outlineColor: color(config.outline_color, previous.outlineColor),
  };
}
