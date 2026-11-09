// Reads the overlay's settings. A missing or bad value keeps the previous one.
import type { ConfigData } from "@tokioapp/overlay";

// How Up next looks: a list, a list with covers, the covers alone, one sliding line, or the next
// song on the card's third line.
const STYLES = ["list", "covers", "discs", "ticker", "inside"] as const;
// The song playing: a pill with a disc, a record sleeve, a big cover, a slim bar, or text alone.
const LAYOUTS = ["pill", "sleeve", "big", "bar", "text"] as const;
const ALIGNS = ["left", "center", "right"] as const;
const ENTRANCES = ["slide", "fade", "pop", "drop", "flip", "wipe"] as const;

export interface Settings {
  nextCount: number;
  nextStyle: (typeof STYLES)[number];
  nextLabel: string;
  layout: (typeof LAYOUTS)[number];
  align: (typeof ALIGNS)[number];
  font: string;
  size: number;
  entrance: (typeof ENTRANCES)[number];
  spin: boolean;
  cardColor: string;
  textColor: string;
  accentColor: string;
}

// The same as config.yaml's defaults.
export const DEFAULTS: Settings = {
  nextCount: 2,
  nextStyle: "list",
  nextLabel: "Up next",
  layout: "pill",
  align: "left",
  font: "",
  size: 100,
  entrance: "slide",
  spin: true,
  cardColor: "#18181b",
  textColor: "#f1f5f9",
  accentColor: "#f43f5e",
};

// The most songs Up next lists: the slider's top.
const NEXT_MAX = 5;
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
    nextCount: Math.min(
      NEXT_MAX,
      Math.round(number(config.next_count, 0, previous.nextCount)),
    ),
    nextStyle: oneOf(config.next_style, STYLES, previous.nextStyle),
    nextLabel:
      typeof config.next_label === "string"
        ? config.next_label.trim()
        : previous.nextLabel,
    layout: oneOf(config.layout, LAYOUTS, previous.layout),
    align: oneOf(config.align, ALIGNS, previous.align),
    font: font.length <= FONT_MAX_LENGTH ? font : previous.font,
    size: number(config.size, 1, previous.size),
    entrance: oneOf(config.entrance, ENTRANCES, previous.entrance),
    spin: boolean(config.spin, previous.spin),
    cardColor: color(config.card_color, previous.cardColor),
    textColor: color(config.text_color, previous.textColor),
    accentColor: color(config.accent_color, previous.accentColor),
  };
}
