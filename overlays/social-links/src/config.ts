// Reads the overlay's settings. The published SDK has no type for a table's rows, so everything
// comes in as unknown, and a bad value keeps the previous one.
import {
  ALIGNS,
  boolean,
  color,
  FONT_MAX_LENGTH,
  number,
  oneOf,
} from "@tokio-overlays/shared/settings";
import { isRecord } from "@tokio-overlays/shared/util";

export interface Account {
  platform: string;
  username: string;
  iconColor: string;
  iconBackground: string;
}

const LAYOUTS = ["one", "all"] as const;
const VISIBILITIES = ["always", "interval", "command"] as const;
const TRANSITIONS = ["flip", "slide", "fade"] as const;
const TEXTS = ["username", "platform", "both"] as const;

export interface Settings {
  accounts: Account[];
  layout: (typeof LAYOUTS)[number];
  accountSeconds: number;
  visibility: (typeof VISIBILITIES)[number];
  hiddenMinutes: number;
  command: string;
  transition: (typeof TRANSITIONS)[number];
  text: (typeof TEXTS)[number];
  showButton: boolean;
  buttonText: string;
  font: string;
  size: number;
  roundness: number;
  align: (typeof ALIGNS)[number];
  cardColor: string;
  textColor: string;
}

const PAPER = "#f1f5f9";
const ROSE = "#f43f5e";

// The same as config.yaml's defaults.
export const DEFAULTS: Settings = {
  accounts: ["instagram", "youtube", "x"].map((platform) => ({
    platform,
    username: "",
    iconColor: PAPER,
    iconBackground: ROSE,
  })),
  layout: "one",
  accountSeconds: 6,
  visibility: "always",
  hiddenMinutes: 5,
  command: "!socials",
  transition: "flip",
  text: "username",
  showButton: true,
  buttonText: "Follow",
  font: "",
  size: 100,
  roundness: 10,
  align: "left",
  cardColor: "#18181b",
  textColor: PAPER,
};

function string(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function readAccounts(value: unknown, fallback: Account[]): Account[] {
  if (!Array.isArray(value)) return fallback;
  const accounts: Account[] = [];
  for (const row of value) {
    if (!isRecord(row) || typeof row.platform !== "string") continue;
    accounts.push({
      platform: row.platform,
      username: string(row.username, "").trim(),
      iconColor: color(row.icon_color, PAPER),
      iconBackground: color(row.icon_background, ROSE),
    });
  }
  return accounts;
}

/** The keys are the field ids in config.yaml. */
export function readSettings(
  config: Record<string, unknown>,
  previous: Settings,
): Settings {
  const font = string(config.font, previous.font);
  return {
    accounts: readAccounts(config.accounts, previous.accounts),
    layout: oneOf(config.layout, LAYOUTS, previous.layout),
    accountSeconds: number(config.account_seconds, 1, previous.accountSeconds),
    visibility: oneOf(config.visibility, VISIBILITIES, previous.visibility),
    hiddenMinutes: number(config.hidden_minutes, 1, previous.hiddenMinutes),
    command: string(config.command, previous.command),
    transition: oneOf(config.transition, TRANSITIONS, previous.transition),
    text: oneOf(config.text, TEXTS, previous.text),
    showButton: boolean(config.show_button, previous.showButton),
    buttonText: string(config.button_text, previous.buttonText),
    font: font.length <= FONT_MAX_LENGTH ? font : previous.font,
    size: number(config.size, 1, previous.size),
    // 0 is square corners.
    roundness: number(config.roundness, 0, previous.roundness),
    align: oneOf(config.align, ALIGNS, previous.align),
    cardColor: color(config.card_color, previous.cardColor),
    textColor: color(config.text_color, previous.textColor),
  };
}
