import { tokio, TOKIO_EVENTS } from "@tokioapp/overlay";
import { DEFAULTS, readSettings, type Account, type Settings } from "./config";
import { HEART } from "./icons";
import { platformOf } from "./platforms";
import "./style.css";

interface Card {
  el: HTMLDivElement;
  tile: HTMLSpanElement;
  text: HTMLSpanElement;
  platform: HTMLSpanElement;
  name: HTMLSpanElement;
  button: HTMLSpanElement;
  heart: HTMLSpanElement;
  label: HTMLSpanElement;
}

// "show": the card is on screen, so it jumps to the account without a transition. "enter": a
// round starts now. "wait": the card is hidden until the next round.
type Mode = "show" | "enter" | "wait";
type Kind = Settings["transition"];

const stage = document.getElementById("stage")!;
// Tokio fills in the ID. While developing, open the page with ?id=<test ID>, made on Tokio's
// Tools page.
const overlayId =
  window.__OVERLAY_ID__ || new URLSearchParams(location.search).get("id") || "";
// Tokio's Overlays page previews the overlay in an iframe with this name. There the card never
// stays hidden for long, so the preview isn't empty.
const preview = window.name === `TOKIO_APP-${overlayId}`;
const PREVIEW_HIDDEN_MS = 3000;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

// The whole card coming in or out, and each half of a swap (tile and text only, for the flip).
const CARD_MS: Record<Kind, number> = { flip: 300, slide: 350, fade: 250 };
const HALF_MS = 220;
const STAGGER_MS = 90;
const REST: Keyframe = { opacity: 1, transform: "none" };
// A fade changes nothing but opacity, which is also all reduced motion allows.
const FADE_REST: Keyframe = { opacity: 1 };

let settings = readSettings(window.__OVERLAY_CONFIG__, DEFAULTS);
// Whether the card is on screen, and the account it shows (or whose heart is beating).
let shown = false;
let current = 0;
// Each run has its own controller, so a new one stops the last.
let run: AbortController | undefined;
// Set only while the card is hidden and waiting: the chat command ends the wait.
let onCommand: (() => void) | undefined;

applyStyle(settings);
start(0, settings.visibility === "command" ? "wait" : "enter");

// Sent when the streamer saves the overlay's settings. The preview gets one on every edit.
tokio.on(TOKIO_EVENTS.CONFIG, (config) => {
  const next = readSettings(config, settings);
  if (JSON.stringify(next) === JSON.stringify(settings)) return;
  const index = firstChange(settings.accounts, next.accounts) ?? current;
  settings = next;
  applyStyle(next);
  if (shown || preview) start(index, "show");
  else start(0, next.visibility === "command" ? "wait" : "enter");
});

tokio.on(TOKIO_EVENTS.CHAT, (data) => {
  const command = normalize(settings.command);
  if (!onCommand || !command) return;
  const message = normalize(data.comment.content);
  if (message === command || message.startsWith(`${command} `)) onCommand();
});

tokio.connect(overlayId);

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function firstChange(before: Account[], after: Account[]) {
  const length = Math.max(before.length, after.length);
  for (let i = 0; i < length; i++) {
    if (JSON.stringify(before[i]) !== JSON.stringify(after[i])) return i;
  }
  return undefined;
}

function applyStyle(s: Settings) {
  const style = document.documentElement.style;
  style.setProperty("--scale", String(s.size / 100));
  style.setProperty("--roundness", String(s.roundness));
  style.setProperty("--card", s.cardColor);
  style.setProperty("--text", s.textColor);
  style.setProperty("--edge", hairline(s.textColor));
  style.setProperty(
    "--font",
    `${s.font ? `${JSON.stringify(s.font)}, ` : ""}system-ui, sans-serif`,
  );
  stage.dataset.align = s.align;
}

// The card's edge over dark video. Written as rgb() because older OBS browsers lack color-mix().
function hairline(hex: string) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgb(${n >> 16} ${(n >> 8) & 255} ${n & 255} / 0.12)`;
}

function start(from: number, mode: Mode) {
  run?.abort();
  document.getAnimations().forEach((animation) => animation.cancel());
  onCommand = undefined;
  const controller = new AbortController();
  run = controller;
  session(controller.signal, from, mode).catch((error) => {
    // Stopping a run rejects whatever it was waiting for.
    if (!controller.signal.aborted) console.error(error);
  });
}

async function session(signal: AbortSignal, from: number, mode: Mode) {
  const s = settings;
  if (s.accounts.length === 0) {
    stage.replaceChildren();
    shown = false;
    return;
  }

  let phase = mode;
  for (;;) {
    if (phase === "wait") {
      stage.replaceChildren();
      shown = false;
      const hidden =
        s.visibility === "interval" ? s.hiddenMinutes * 60_000 : Infinity;
      await wait(
        preview ? Math.min(hidden, PREVIEW_HIDDEN_MS) : hidden,
        signal,
        true,
      );
    }
    await (s.layout === "all" ? roundAll : roundOne)(
      signal,
      s,
      Math.min(from, s.accounts.length - 1),
      phase === "show",
    );
    // "always" never leaves its round, so this is only for the other two.
    from = 0;
    phase = "wait";
  }
}

// One card, showing each account for a while.
async function roundOne(
  signal: AbortSignal,
  s: Settings,
  from: number,
  instant: boolean,
) {
  const card = createCard();
  stage.replaceChildren(card.el);
  shown = true;
  const last = s.accounts.length - 1;
  let i = from;
  current = i;
  fill(card, s.accounts[i], s);
  if (!instant) await enter([card], s, signal);

  for (;;) {
    beat(card);
    await wait(s.accountSeconds * 1000, signal);
    if (i === last && s.visibility !== "always") break;
    if (last === 0) continue;
    i = (i + 1) % s.accounts.length;
    await swap(card, s.accounts[i], s, signal);
    current = i;
  }

  await leave([card], s, signal);
  stage.replaceChildren();
  shown = false;
}

// A card per account. The hearts beat one after another.
async function roundAll(
  signal: AbortSignal,
  s: Settings,
  from: number,
  instant: boolean,
) {
  const cards = s.accounts.map((account) => {
    const card = createCard();
    fill(card, account, s);
    return card;
  });
  stage.replaceChildren(...cards.map((card) => card.el));
  shown = true;
  if (!instant) await enter(cards, s, signal);

  let first = from;
  do {
    for (let i = first; i < cards.length; i++) {
      current = i;
      beat(cards[i]);
      await wait(s.accountSeconds * 1000, signal);
    }
    first = 0;
  } while (s.visibility === "always");

  await leave(cards, s, signal);
  stage.replaceChildren();
  shown = false;
}

/** Resolves after the time, or early on the chat command when `early`. */
function wait(ms: number, signal: AbortSignal, early = false) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    // Infinity would fire at once.
    const timer = Number.isFinite(ms) ? setTimeout(finish, ms) : undefined;
    signal.addEventListener("abort", cancel, { once: true });
    if (early) onCommand = finish;

    function finish() {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      onCommand = undefined;
      resolve();
    }
    function cancel() {
      clearTimeout(timer);
      reject(signal.reason);
    }
  });
}

function span(className: string) {
  const el = document.createElement("span");
  el.className = className;
  return el;
}

function createCard(): Card {
  const el = document.createElement("div");
  el.className = "card";
  const tile = span("tile");
  const platform = span("platform");
  const name = span("name");
  const text = span("text");
  text.append(platform, name);
  const heart = span("heart");
  heart.innerHTML = HEART;
  const label = span("label");
  const button = span("button");
  button.append(heart, label);
  el.append(tile, text, button);
  return { el, tile, text, platform, name, button, heart, label };
}

function fill(card: Card, account: Account, s: Settings) {
  const { title, icon } = platformOf(account.platform);
  card.tile.innerHTML = icon;
  card.tile.style.color = account.iconColor;
  card.tile.style.background = account.iconBackground;
  // Without a username the platform's name stands in for it.
  card.name.textContent =
    s.text === "platform" ? title : account.username || title;
  card.platform.textContent = title;
  card.platform.hidden = s.text !== "both" || account.username === "";
  card.button.hidden = !s.showButton;
  card.el.classList.toggle("bare", !s.showButton);
  card.button.style.color = account.iconColor;
  card.button.style.background = account.iconBackground;
  card.label.textContent = s.buttonText;
}

function kindOf(s: Settings): Kind {
  return reduceMotion.matches ? "fade" : s.transition;
}

function restOf(kind: Kind) {
  return kind === "fade" ? FADE_REST : REST;
}

// How a card looks out of view. `turn` is the side a flip turns toward.
function away(card: Card, s: Settings, kind: Kind, turn: 1 | -1): Keyframe {
  if (kind === "fade") return { opacity: 0 };
  if (kind === "flip") {
    return {
      opacity: 0,
      transform: `perspective(20rem) rotateX(${turn * 90}deg)`,
    };
  }
  // A centered card has no edge to slide toward.
  if (s.align === "center") {
    return { opacity: 0, transform: "translateY(0.75rem)" };
  }
  const { offsetLeft, offsetWidth } = card.el;
  const distance =
    s.align === "left"
      ? -(offsetLeft + offsetWidth)
      : stage.clientWidth - offsetLeft;
  return { transform: `translateX(${distance}px)` };
}

async function enter(cards: Card[], s: Settings, signal: AbortSignal) {
  const kind = kindOf(s);
  const from = cards.map((card) => away(card, s, kind, -1));
  await Promise.all(
    cards.map(
      (card, i) =>
        card.el.animate([from[i], restOf(kind)], {
          duration: CARD_MS[kind],
          delay: i * STAGGER_MS,
          easing: "ease-out",
          fill: "backwards",
        }).finished,
    ),
  );
  signal.throwIfAborted();
}

// The cards stay out of view until the caller removes them.
async function leave(cards: Card[], s: Settings, signal: AbortSignal) {
  const kind = kindOf(s);
  const to = cards.map((card) => away(card, s, kind, 1));
  await Promise.all(
    cards.map(
      (card, i) =>
        card.el.animate([restOf(kind), to[i]], {
          duration: CARD_MS[kind],
          delay: i * STAGGER_MS,
          easing: "ease-in",
          fill: "forwards",
        }).finished,
    ),
  );
  signal.throwIfAborted();
}

// Changes the card to the next account.
async function swap(
  card: Card,
  account: Account,
  s: Settings,
  signal: AbortSignal,
) {
  const kind = kindOf(s);
  if (kind === "flip") return flip(card, account, s, signal);

  const out = card.el.animate([restOf(kind), away(card, s, kind, 1)], {
    duration: CARD_MS[kind],
    easing: "ease-in",
    fill: "forwards",
  });
  await out.finished;
  signal.throwIfAborted();
  fill(card, account, s);
  // The new width changes how far the card has to come.
  const from = away(card, s, kind, -1);
  out.cancel();
  await card.el.animate([from, restOf(kind)], {
    duration: CARD_MS[kind],
    easing: "ease-out",
  }).finished;
  signal.throwIfAborted();
}

// The tile turns edge-on while the text rises away. At that point the account changes in one
// task, and the tile and text come back while the card grows or shrinks to its new width.
async function flip(
  card: Card,
  account: Account,
  s: Settings,
  signal: AbortSignal,
) {
  const out = {
    duration: HALF_MS,
    easing: "ease-in",
    fill: "forwards",
  } as const;
  const turned = [
    card.tile.animate(
      [
        { transform: "none" },
        { transform: "perspective(6rem) rotateX(90deg)" },
      ],
      out,
    ),
    card.text.animate(
      [
        { transform: "none", opacity: 1 },
        { transform: "translateY(-0.6em)", opacity: 0 },
      ],
      out,
    ),
  ];
  await turned[0].finished;
  signal.throwIfAborted();

  const before = card.el.getBoundingClientRect().width;
  fill(card, account, s);
  const after = card.el.getBoundingClientRect().width;
  turned.forEach((animation) => animation.cancel());

  const back = { duration: HALF_MS, easing: "ease-out" };
  const returning = [
    card.tile.animate(
      [
        { transform: "perspective(6rem) rotateX(-90deg)" },
        { transform: "none" },
      ],
      back,
    ),
    card.text.animate(
      [
        { transform: "translateY(0.6em)", opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      back,
    ),
  ];
  if (Math.abs(before - after) > 0.5) {
    returning.push(
      card.el.animate(
        [{ width: `${before}px` }, { width: `${after}px` }],
        back,
      ),
    );
  }
  await Promise.all(returning.map((animation) => animation.finished));
  signal.throwIfAborted();
}

// Once an account settles, its heart beats once.
function beat(card: Card) {
  if (reduceMotion.matches || card.button.hidden) return;
  card.heart.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.3)" },
      { transform: "scale(1)" },
      { transform: "scale(1.15)" },
      { transform: "scale(1)" },
    ],
    { duration: 600, delay: 250, easing: "ease-in-out" },
  );
}
