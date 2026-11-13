import { entrance, leaving, play } from "@tokio-overlays/shared/entrances";
import { tokio, TOKIO_EVENTS, type MusicInfo } from "@tokioapp/overlay";
import { DEFAULTS, readSettings } from "./config";
import { RECORD } from "./icons";
import { CHANGE_MS, EASE, Line, scrollAcross } from "./line";
import { sampleQueue, splitTitle } from "./songs";
import "./style.css";

const stage = document.getElementById("stage")!;
const card = document.getElementById("card")!;
const flipper = document.getElementById("flip")!;
// The record sleeve's record, which turns inside its slide.
const vinyl = document.getElementById("vinyl")!;
document.getElementById("vinyl-spin")!.innerHTML = RECORD;
const layers = [
  document.getElementById("cover-a")!,
  document.getElementById("cover-b")!,
];
const text = document.getElementById("text")!;
const artistRoot = document.getElementById("artist")!;
const songLine = new Line(document.getElementById("song")!);
const artistLine = new Line(artistRoot);
const next = document.getElementById("next")!;
const nextLabel = document.getElementById("next-label")!;
const nextList = document.getElementById("next-list")!;
// Up next inside the card: the next song on its third line.
const up = document.getElementById("up")!;
const upLabel = document.getElementById("up-label")!;
const upLine = new Line(document.getElementById("up-song")!);

const params = new URLSearchParams(location.search);
// Tokio fills in the ID. While developing, open the page with ?id=<test ID>, made on Tokio's
// Tools page, or ?demo for sample songs.
const overlayId = window.__OVERLAY_ID__ || params.get("id") || "";
// Tokio's Overlays page previews the overlay in an iframe with this name. Tokio sends the queue
// there only with Test, so the preview, like ?demo, starts with sample songs.
const preview = window.name === `TOKIO_APP-${overlayId}`;
const demo = preview || params.has("demo");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
// The longest a cover's picture holds up a song, while it loads.
const LOAD_MS = 1000;
// How long the card takes to ease to a new width, about as long as the old text takes to go.
const RESIZE_MS = 220;
// How long a sample song plays.
const SAMPLE_MS = 6000;
// The overlay's own font.
const OWN_FONT = "system-ui, sans-serif";

let settings = readSettings(window.__OVERLAY_CONFIG__, DEFAULTS);
// The queue Tokio last sent.
let queue: MusicInfo[] = [];
// "leaving" is the card's exit, which a new song can still cancel.
let state: "hidden" | "shown" | "leaving" = "hidden";
// The playing song the card shows or is about to, by title and picture, or null when it's none.
let wantKey: string | null = null;
// The song on the card, or null while it's hidden.
let shownKey: string | null = null;
// Bumped by every change of song, so one still loading its cover can see it's stale.
let version = 0;
// The card's exit and Up next's.
let exit: Animation | undefined;
let nextExit: Animation | undefined;
// The cover layer on top, and the fade that brings in a new one.
let top = 0;
let fade: Animation | undefined;
// The half turns the song changes have added to the disc.
let halfTurns = 0;
// The ticker's slide, while its songs don't fit.
let tickerScroll: Animation | undefined;
let stopSample: (() => void) | undefined;

applySettings();

// Sent when the streamer saves the overlay's settings. The preview gets one on every edit.
tokio.on(TOKIO_EVENTS.CONFIG, (config) => {
  settings = readSettings(config, settings);
  applySettings();
  renderNext(false);
  measure();
});

tokio.on(TOKIO_EVENTS.MUSIC_CHANGE, (songs) => {
  // The first real queue ends the demo.
  stopSample?.();
  stopSample = undefined;
  handleQueue(songs);
});

// The scrolling lines are measured again when their room changes, and after a font loads.
let textWidth = 0;
new ResizeObserver(() => {
  if (text.clientWidth === textWidth) return;
  textWidth = text.clientWidth;
  measure();
}).observe(text);
document.fonts.addEventListener("loadingdone", measure);
reduceMotion.addEventListener("change", measure);

tokio.connect(overlayId);
if (demo) stopSample = playSample();

/** The whole queue, played songs first. The card shows the playing song, Up next what's after. */
function handleQueue(songs: MusicInfo[]) {
  queue = songs;
  const playing = songs.find((song) => song.playing);
  // Nothing playing: the queue was cleared or its last song ended.
  if (!playing) {
    leave();
    return;
  }
  const key = `${playing.title}\n${playing.thumbnail}`;
  // Only the queue changed.
  if (key === wantKey) {
    resizing(() => renderNext(state === "shown"));
    return;
  }
  wantKey = key;
  void show(playing, key);
}

/** A new playing song. It waits a moment for its cover, so the two come together. */
async function show(song: MusicInfo, key: string) {
  const mine = ++version;
  const cover = await loadCover(song.thumbnail, (late) => {
    if (mine === version) setCover(late, false);
  });
  if (mine !== version) return;
  if (state === "leaving") cancelLeave();
  if (state === "hidden") {
    setSong(song, key, cover, false);
    state = "shown";
    card.hidden = false;
    const motion = entrance(settings, corners());
    play(card, motion);
    // Up next comes in half way through the card's entrance.
    renderNext(false, motion.duration / 2);
  } else {
    resizing(() => {
      // A leave cancelled by the same song keeps what the card shows.
      if (key !== shownKey) setSong(song, key, cover, true);
      // Up next changes with the song it follows, not before the cover has loaded.
      renderNext(true);
    });
  }
  measure();
}

/** Puts the song on the card: its name, its artist and its cover. `animate` for a song change. */
function setSong(song: MusicInfo, key: string, cover: Node, animate: boolean) {
  shownKey = key;
  const { song: name, artist } = splitTitle(song.title);
  songLine.set(name, animate);
  // The artist line comes and goes without sliding.
  artistLine.set(artist, animate && artistLine.text !== "");
  artistRoot.hidden = artist === "";
  setCover(cover, animate);
  if (animate) changeMotion();
}

/**
 * Runs a change to what the card shows, and eases the card to its new width instead of jumping,
 * since it's as wide as what it shows. Not while it's hidden, nor with less motion.
 */
function resizing(change: () => void) {
  const before = card.offsetWidth;
  change();
  const after = card.offsetWidth;
  if (before === after || before === 0 || reduceMotion.matches) return;
  card.animate([{ width: `${before}px` }, { width: `${after}px` }], {
    duration: RESIZE_MS,
    easing: "ease-out",
  });
}

/**
 * The cover's own move as a new one fades in: a disc spins half a turn, and a sleeve's record
 * slides back in and out again. A big cover and text alone only change.
 */
function changeMotion() {
  if (reduceMotion.matches) return;
  const { layout } = settings;
  // A frozen disc would be left upside down.
  if ((layout === "pill" || layout === "bar") && settings.spin) flip();
  if (layout === "sleeve") {
    vinyl.animate(
      [
        { transform: "none" },
        { transform: "translateX(-1.3rem)", offset: 0.45 },
        { transform: "none" },
      ],
      { duration: CHANGE_MS + 200, easing: "ease-in-out" },
    );
  }
}

/** The disc spins half a turn on top of its own turning, as the new cover fades in. */
function flip() {
  const from = halfTurns * 180;
  halfTurns++;
  const to = halfTurns * 180;
  flipper.style.transform = `rotate(${to}deg)`;
  flipper.animate(
    [{ transform: `rotate(${from}deg)` }, { transform: `rotate(${to}deg)` }],
    { duration: CHANGE_MS, easing: EASE },
  );
}

/**
 * The cover's picture, once loaded, or the drawn record when there's none or it fails. After
 * LOAD_MS the record shows, and `late` gets the picture if it does load.
 */
function loadCover(url: string, late: (cover: Node) => void): Promise<Node> {
  if (!url) return Promise.resolve(record());
  return new Promise((resolve) => {
    let settled = false;
    const settle = (cover: Node) => {
      if (settled) return late(cover);
      settled = true;
      clearTimeout(timer);
      resolve(cover);
    };
    const timer = setTimeout(() => settle(record()), LOAD_MS);
    const img = new Image();
    img.alt = "";
    img.decoding = "async";
    // Tokio's covers come from other sites' servers, which can refuse requests that name another.
    img.referrerPolicy = "no-referrer";
    img.addEventListener("load", () => settle(img));
    img.addEventListener("error", () => {
      if (!settled) settle(record());
    });
    img.src = url;
  });
}

function record() {
  const el = document.createElement("span");
  el.className = "record";
  el.innerHTML = RECORD;
  return el;
}

/** Puts the cover on the layer that isn't on top, and fades it in over the old one. */
function setCover(cover: Node, animate: boolean) {
  fade?.cancel();
  fade = undefined;
  const from = layers[top];
  top = 1 - top;
  const to = layers[top];
  to.replaceChildren(cover);
  to.style.zIndex = "1";
  from.style.zIndex = "0";
  if (!animate) {
    from.replaceChildren();
    return;
  }
  const incoming = to.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: CHANGE_MS,
    easing: "ease-out",
  });
  fade = incoming;
  incoming.addEventListener("finish", () => {
    if (layers[top] !== from) from.replaceChildren();
  });
}

/**
 * Up next: the songs after the playing one, as many as the setting says, in the panel under the
 * card, or the next one alone on the card's third line. `animate` slides that line's change.
 */
function renderNext(animate: boolean, delay = 0) {
  const at = queue.findIndex((song) => song.playing);
  // Nothing playing: the card leaves, and Up next with it.
  if (at < 0) return;
  const songs = queue
    .slice(at + 1)
    .filter((song) => !song.played)
    .slice(0, settings.nextCount);
  const inside = settings.nextStyle === "inside";
  // Inside the card, the line goes when the queue runs out, and the card shrinks to two.
  const first = inside ? songs[0] : undefined;
  const wasShown = !up.hidden;
  up.hidden = !first;
  card.toggleAttribute("data-up", !up.hidden);
  if (first) upLine.set(splitTitle(first.title).song, animate && wasShown);
  nextList.replaceChildren(...(inside ? [] : rows(songs)));
  syncNext(delay);
  measureTicker();
}

/** Up next's rows for the panel, in the look the setting picks. */
function rows(songs: MusicInfo[]): HTMLElement[] {
  const style = settings.nextStyle;
  if (style === "discs") {
    return songs.map((song, i) => {
      const row = document.createElement("li");
      // The next song's cover on top of the ones after it.
      row.style.zIndex = String(songs.length - i);
      row.append(miniCover(song.thumbnail));
      return row;
    });
  }
  const items = songs.map((song) => {
    const { song: name, artist } = splitTitle(song.title);
    const item = document.createElement(style === "ticker" ? "span" : "li");
    if (style === "covers") item.append(miniCover(song.thumbnail));
    const title = document.createElement("span");
    title.textContent = name;
    item.append(title);
    if (artist) {
      const by = document.createElement("span");
      by.className = "by";
      by.textContent = artist;
      item.append(by);
    }
    return item;
  });
  if (style !== "ticker" || items.length === 0) return items;
  // The ticker is one line, which slides as a whole when it doesn't fit.
  const run = document.createElement("li");
  run.className = "run";
  items.forEach((item) => item.classList.add("item"));
  run.append(...items);
  return [run];
}

/** A queued song's cover as a small disc, or the drawn record when there's none or it fails. */
function miniCover(url: string) {
  const disc = document.createElement("span");
  disc.className = "mini";
  if (!url) {
    disc.innerHTML = RECORD;
    return disc;
  }
  const img = new Image();
  img.alt = "";
  img.referrerPolicy = "no-referrer";
  img.addEventListener("error", () => {
    disc.innerHTML = RECORD;
  });
  img.src = url;
  disc.append(img);
  return disc;
}

/** The ticker slides when its songs don't fit, unless the streamer wants less motion. */
function measureTicker() {
  tickerScroll?.cancel();
  tickerScroll = undefined;
  delete nextList.dataset.scroll;
  const run = nextList.querySelector<HTMLElement>(".run");
  if (!run || next.hidden || reduceMotion.matches) return;
  tickerScroll = scrollAcross(nextList, run);
}

/** Shows Up next under the card while there are songs to list, and fades it in. */
function syncNext(delay: number) {
  // A leaving card takes Up next with it.
  if (state === "leaving") return;
  const wanted = state === "shown" && nextList.childElementCount > 0;
  if (wanted === !next.hidden) return;
  next.hidden = !wanted;
  if (!wanted) return;
  next.animate(
    [
      {
        opacity: 0,
        transform: reduceMotion.matches ? "none" : "translateY(-0.4rem)",
      },
      { opacity: 1, transform: "none" },
    ],
    { duration: 300, delay, easing: "ease-out", fill: "backwards" },
  );
}

/** Nothing is playing: the card leaves the way it came in, backwards. */
function leave() {
  wantKey = null;
  // A song still loading its cover is dropped.
  version++;
  if (state !== "shown") return;
  state = "leaving";
  const motion = leaving(settings, corners());
  const out = play(card, motion, "forwards");
  exit = out;
  nextExit = next.hidden
    ? undefined
    : next.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: motion.duration,
        easing: "ease-in",
        fill: "forwards",
      });
  out.addEventListener("finish", () => {
    if (exit !== out) return;
    // The animations end with the card gone, so they can't show it again.
    card.hidden = true;
    next.hidden = true;
    cancelLeave();
    state = "hidden";
    shownKey = null;
  });
}

/** A song came in while the card was leaving: it stays. */
function cancelLeave() {
  exit?.cancel();
  nextExit?.cancel();
  exit = undefined;
  nextExit = undefined;
  state = "shown";
}

// The wipe's corners, those of the layout: round ends for the pill and the bar.
function corners() {
  const { layout } = settings;
  return layout === "pill" || layout === "bar" ? "999px" : "1.1rem";
}

function measure() {
  songLine.measure();
  artistLine.measure();
  upLine.measure();
  measureTicker();
}

function applySettings() {
  const s = settings;
  const root = document.documentElement.style;
  root.setProperty("--scale", String(s.size / 100));
  root.setProperty(
    "--font",
    (s.font ? `${JSON.stringify(s.font)}, ` : "") + OWN_FONT,
  );
  root.setProperty("--card", s.cardColor);
  root.setProperty("--text", s.textColor);
  root.setProperty("--accent", s.accentColor);
  stage.dataset.layout = s.layout;
  stage.dataset.align = s.align;
  stage.dataset.spin = s.spin ? "on" : "off";
  next.dataset.style = s.nextStyle;
  nextLabel.textContent = s.nextLabel;
  upLabel.textContent = s.nextLabel;
}

/** Four made-up songs, the next one playing every SAMPLE_MS, until the first real queue. */
function playSample() {
  let step = 0;
  handleQueue(sampleQueue(step));
  const timer = setInterval(() => handleQueue(sampleQueue(++step)), SAMPLE_MS);
  return () => clearInterval(timer);
}
