// Reads the overlay's settings. A missing or bad value keeps the previous one.
import type { ConfigData } from "@tokioapp/overlay";

// The fan's TikTok name, or their @handle
const NAMES = ["name", "handle"] as const;
const ALIGNS = ["left", "center", "right"] as const;
const ENTRANCES = ["slide", "fade", "pop", "drop", "flip", "wipe"] as const;
const EFFECTS = ["sweep", "pulse", "sparkles", "none"] as const;

export interface Settings {
  minLevel: number;
  superfansOnly: boolean;
  seconds: number;
  shownName: (typeof NAMES)[number];
  label: string;
  align: (typeof ALIGNS)[number];
  font: string;
  size: number;
  entrance: (typeof ENTRANCES)[number];
  superfanEffect: (typeof EFFECTS)[number];
  bannerColor: string;
  nameColor: string;
  levelColor: string;
  superfanColor: string;
}

// The same as config.yaml's defaults.
export const DEFAULTS: Settings = {
  minLevel: 1,
  superfansOnly: false,
  seconds: 5,
  shownName: "name",
  label: "Fan level",
  align: "left",
  font: "",
  size: 100,
  entrance: "slide",
  superfanEffect: "sweep",
  bannerColor: "#18181b",
  nameColor: "#f1f5f9",
  levelColor: "#f43f5e",
  superfanColor: "#f43f5e",
};

// The font setting's limit.
const FONT_MAX_LENGTH = 60;
const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;

function oneOf<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
): T {
  return options.find((option) => option === value) ?? fallback;
}

function number(value: unknown, min: number, fallback: number) {
  return typeof value === "number" && value >= min ? value : fallback;
}

function boolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function color(value: unknown, fallback: string) {
  return typeof value === "string" && HEX.test(value) ? value : fallback;
}

/** The keys are the field ids in config.yaml. */
export function readSettings(config: ConfigData, previous: Settings): Settings {
  const font = typeof config.font === "string" ? config.font : previous.font;
  return {
    minLevel: number(config.min_level, 1, previous.minLevel),
    superfansOnly: boolean(config.superfans_only, previous.superfansOnly),
    seconds: number(config.seconds, 1, previous.seconds),
    shownName: oneOf(config.shown_name, NAMES, previous.shownName),
    label:
      typeof config.label === "string" ? config.label.trim() : previous.label,
    align: oneOf(config.align, ALIGNS, previous.align),
    font: font.length <= FONT_MAX_LENGTH ? font : previous.font,
    size: number(config.size, 1, previous.size),
    entrance: oneOf(config.entrance, ENTRANCES, previous.entrance),
    superfanEffect: oneOf(
      config.superfan_effect,
      EFFECTS,
      previous.superfanEffect,
    ),
    bannerColor: color(config.banner_color, previous.bannerColor),
    nameColor: color(config.name_color, previous.nameColor),
    levelColor: color(config.level_color, previous.levelColor),
    superfanColor: color(config.superfan_color, previous.superfanColor),
  };
}
