import { tokio, TOKIO_EVENTS, type GiftData } from "@tokioapp/overlay";
import { DEFAULTS, readSettings, type Settings } from "./config";
import { COIN, PLACEHOLDER, SPARK } from "./icons";
import { drawLight } from "./light";
import { SAMPLE_GIFTS, SAMPLE_USERS } from "./samples";
import { Streaks } from "./streaks";
import "./style.css";

type RGB = [number, number, number];
type Timer = ReturnType<typeof setTimeout> | undefined;

/** A gift on the card, or waiting for it. */
interface Shown {
  /** The gifter and gift, so the same gift sent again adds to the card. */
  key: string;
  name: string;
  picture: string;
  gift: { name: string; image: string; coins: number };
  count: number;
}

/** What's saved across reloads. */
interface Saved {
  at: number;
  shown: Shown;
}

const stage = document.getElementById("stage")!;
const card = document.getElementById("card")!;
const title = document.getElementById("title")!;
const light = document.getElementById("light")!;
const sparks = document.getElementById("sparks")!;
const pic = document.getElementById("pic")!;
const gift = find("gift", HTMLImageElement);
const box = document.getElementById("box")!;
const combo = document.getElementById("combo")!;
const comboCount = document.getElementById("combo-count")!;
const who = document.getElementById("who")!;
const photo = document.getElementById("photo")!;
const nameInk = document.getElementById("name")!;
const worth = document.getElementById("worth")!;
const coinsInk = document.getElementById("coins")!;

const params = new URLSearchParams(location.search);
// Tokio fills in the ID. While developing, open the page with ?id=<test ID>, made on Tokio's
// Tools page, or ?demo for the sample gifts.
const overlayId = window.__OVERLAY_ID__ || params.get("id") || "";
// Tokio's Overlays page previews the overlay in an iframe with this name. There, and with ?demo,
// sample gifters keep sending gifts until the first real one, so the preview shows the animations.
const preview = window.name === `TOKIO_APP-${overlayId}`;
const demo = preview || params.has("demo");
const storageKey = `biggest-gift:${overlayId}`;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
// A gift stays on the card at least this long before the next one replaces it, so each can be read
// on a busy LIVE. Gifts that come in meanwhile wait, and only the newest of them shows next.
const HOLD_MS = 2500;
// Names longer than this many characters are cut short.
const NAME_MAX = 18;
// The longest a gift's picture holds up its entrance while it loads.
const LOAD_MS = 1500;
// The overlay's own font: the heaviest face of the system's. Windows has it as a family of its own.
const OWN_FONT = '"Segoe UI Black", system-ui, sans-serif';
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];
const segmenter = new Intl.Segmenter();

let settings = readSettings(window.__OVERLAY_CONFIG__, DEFAULTS);
const streaks = new Streaks();
// The biggest gift so far, on the card, null before the first one. With "For a few seconds when it
// changes" it stays set while the card is hidden: it's still the one to beat.
let shown: Shown | null = null;
// When it came onto the card, for HOLD_MS.
let shownAt = -Infinity;
// The newest gift waiting for HOLD_MS to pass.
let pending: Shown | null = null;
// When the last gift came, for clearing the card after clear_hours.
let lastGiftAt = 0;
// The coins the card shows right now, which a growing combo counts up from.
let coinsShown = 0;
// The photo on the card, so a new copy of the same one isn't loaded.
let photoUrl: string | null = null;
// Bumped by every change of what the card shows, so a change still animating knows it's stale.
let version = 0;
// The version of a change waiting for the old gift to leave and the new one's picture to load.
// Meanwhile more of the new gift only add to its count. Any newer change ends the wait.
let swapVersion = -1;
// When the last entrance ends: a combo's bump doesn't cut into it.
let settledAt = 0;
let holdTimer: Timer;
let hideTimer: Timer;
let clearTimer: Timer;
let saveTimer: Timer;
let countFrame = 0;
// The card's animations that a change stops. Not the light's own motion, nor sparkles in flight.
const running = new Set<Animation>();
// The light drawn behind the gift, and whether it moves.
let drawnLight = "";

for (const coin of document.querySelectorAll(".coin")) coin.innerHTML = COIN;
// A gift picture that doesn't load shows the drawn box.
gift.addEventListener("error", () => showPicture(false));
applySettings();
if (!demo) restore();
paint();
card.hidden = settings.visibility === "after_gift";
scheduleClear();
// Streaming apps reload overlays when scenes change, so the last second's gift is saved first.
addEventListener("pagehide", () => {
  if (saveTimer) save();
});
let stopSample = demo ? playSample() : undefined;

// Sent when the streamer saves the overlay's settings. The preview gets one on every edit.
tokio.on(TOKIO_EVENTS.CONFIG, (config) => {
  const before = settings;
  settings = readSettings(config, settings);
  applySettings();
  // Plays the new light's flare, for the streamer picking one.
  if (
    (settings.light !== before.light ||
      settings.lightMoves !== before.lightMoves) &&
    !card.hidden
  ) {
    flare(false);
  }
  if (settings.clearHours !== before.clearHours) scheduleClear();
  if (
    settings.visibility !== before.visibility ||
    settings.seconds !== before.seconds
  ) {
    if (settings.visibility === "always") {
      clearTimeout(hideTimer);
      hideTimer = undefined;
      // Stops the card leaving, if it was.
      version++;
      stopAnimations();
      card.hidden = false;
    } else if (isUp()) keepUp();
    else card.hidden = true;
  }
  paint();
  // Plays the new entrance on the card, for the streamer picking one.
  if (settings.entrance !== before.entrance && isUp()) {
    version++;
    stopAnimations();
    enter(false);
  }
  // Tokio's previews don't always put a change of style on the screen until something else
  // moves. A moment as a layer of its own repaints the whole stage.
  stage.animate([{ opacity: 0.99 }, { opacity: 1 }], { duration: 100 });
});

tokio.on(TOKIO_EVENTS.GIFT, (data) => {
  // The first gift ends the demo, and shows at once.
  if (stopSample) {
    stopSample();
    stopSample = undefined;
    streaks.clear();
    // The samples' biggest gift isn't one to beat.
    shown = null;
    pending = null;
    clearTimeout(holdTimer);
    holdTimer = undefined;
    shownAt = -Infinity;
  }
  handleGift(data);
});

tokio.connect(overlayId);

function handleGift({ user, gift: sent }: GiftData) {
  const handle = user.handle || user.username;
  if (!handle) return;
  const key = `${handle}:${sent.id}`;
  const { added, total } = streaks.add(key, sent.comboCount, sent.repeatEnd);
  // A combo's closing event, or an update that came late.
  if (added === 0) return;
  lastGiftAt = Date.now();
  scheduleClear();
  scheduleSave();

  const name = user.username || user.handle;
  const picture = user.profilePictures[0] ?? "";
  // The biggest gift sent again by the same gifter adds to it. If the card had left, it comes back.
  if (shown?.key === key) {
    shown.count += added;
    shown.name = name;
    if (isUp()) {
      keepUp();
      grow();
    } else if (!pending) {
      void swapTo(shown);
    }
    return;
  }
  if (pending?.key === key) {
    pending.count += added;
    return;
  }
  // Gifts compare by one gift's coins, however many a combo has. One that costs less than the
  // biggest, or than one waiting to show, changes nothing; one that costs as much takes its place.
  const coins = Math.max(0, sent.coins);
  const record = Math.max(shown?.gift.coins ?? 0, pending?.gift.coins ?? 0);
  if (coins < record) return;
  pending = {
    key,
    name,
    picture,
    gift: { name: sent.name, image: sent.image, coins },
    count: total,
  };
  const wait = shownAt + HOLD_MS - performance.now();
  if (!isUp() || wait <= 0) showPending();
  else holdTimer ??= setTimeout(showPending, wait);
}

/** Whether the card is on screen with a gift. */
function isUp() {
  return shown !== null && !card.hidden;
}

function showPending() {
  clearTimeout(holdTimer);
  holdTimer = undefined;
  const next = pending;
  pending = null;
  if (next) void swapTo(next);
}

// The old gift leaves and the new one comes in, once its picture has loaded. If the card was
// hidden, it comes in whole.
async function swapTo(next: Shown) {
  const appearing = card.hidden === true;
  shown = next;
  shownAt = performance.now();
  keepUp();
  const current = ++version;
  swapVersion = current;
  stopAnimations();
  const loading = loadPicture(next.gift.image);
  if (!appearing) await leave();
  await loading;
  if (current !== version) return;
  stopAnimations();
  swapVersion = -1;
  paint();
  card.hidden = false;
  enter(appearing);
}

// In "For a few seconds when it changes", the card leaves this many seconds after it last changed.
function keepUp() {
  clearTimeout(hideTimer);
  hideTimer =
    settings.visibility === "after_gift"
      ? setTimeout(hideCard, settings.seconds * 1000)
      : undefined;
}

async function hideCard() {
  hideTimer = undefined;
  if (pending) {
    showPending();
    return;
  }
  const current = ++version;
  stopAnimations();
  await done(
    play(
      card,
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: "scale(0.94)" },
      ],
      { duration: 320, easing: "ease-in", fill: "forwards" },
    ),
  );
  if (current !== version) return;
  stopAnimations();
  card.hidden = true;
}

// After clear_hours without gifts, the card goes back to the gift box, or hides.
function scheduleClear() {
  clearTimeout(clearTimer);
  clearTimer = lastGiftAt
    ? setTimeout(
        clearCard,
        Math.max(0, lastGiftAt + hours(settings.clearHours) - Date.now()),
      )
    : undefined;
}

function clearCard() {
  clearTimer = undefined;
  shown = null;
  pending = null;
  lastGiftAt = 0;
  streaks.clear();
  version++;
  stopAnimations();
  if (!demo) save();
  paint();
  if (settings.visibility === "after_gift") card.hidden = true;
}

// The settings that don't change what the card shows: sizes, colors and motion.
function applySettings() {
  const s = settings;
  const root = document.documentElement.style;
  root.setProperty("--scale", String(s.size / 100));
  root.setProperty(
    "--font",
    `${s.font ? `${JSON.stringify(s.font)}, ` : ""}${OWN_FONT}`,
  );
  // Each color's tones, lighter where the light falls and darker below, mixed here because older
  // OBS browsers lack color-mix().
  const tones = (name: string, color: RGB, deep: number) => {
    root.setProperty(`--${name}`, css(color));
    root.setProperty(`--${name}-light`, css(mix(color, WHITE, 0.4)));
    root.setProperty(`--${name}-deep`, css(mix(color, BLACK, deep)));
  };
  const main = parseColor(s.mainColor);
  tones("accent", main, 0.24);
  tones("name", parseColor(s.nameColor), 0.14);
  tones("coin", parseColor(s.coinColor), 0.24);
  const outline = parseColor(s.outlineColor);
  root.setProperty("--outline", css(outline));
  // The light behind the gift has its own color. The dark glow under it is a deep tone of that
  // color, so over light video it reads as colored light, not a smudge.
  const ray = parseColor(s.lightColor);
  tones("ray", ray, 0.24);
  const dusk = mix(ray, BLACK, 0.72);
  root.setProperty("--halo", css(dusk, 0.62));
  root.setProperty("--halo-soft", css(dusk, 0.26));
  root.setProperty("--glow", css(mix(ray, WHITE, 0.45), 0.55));

  const motion = !reduceMotion.matches;
  stage.dataset.layout = s.layout;
  stage.dataset.align = s.align;
  stage.dataset.float = String(s.float && motion);
  // Another kind of light, or one that starts or stops moving, is drawn anew, and None leaves
  // nothing behind the gift.
  const moves = s.lightMoves && motion;
  const drawn = `${s.light}:${moves}`;
  if (drawn !== drawnLight) {
    drawnLight = drawn;
    stage.dataset.moves = String(moves);
    light.innerHTML = drawLight(s.light);
  }
}

// Puts the gift on the card as it is now, without animating.
function paint() {
  setInk(title, settings.title);
  title.hidden = settings.title === "";
  card.dataset.empty = String(!shown);
  showPicture(Boolean(shown?.gift.image));
  who.hidden = !shown;
  if (shown) {
    if (shown.gift.image && gift.getAttribute("src") !== shown.gift.image) {
      gift.src = shown.gift.image;
    }
    setInk(nameInk, shorten(shown.name));
    if (photoUrl !== shown.picture) {
      photoUrl = shown.picture;
      setPicture(photo, shown.picture);
    }
  }
  photo.hidden = !settings.showPhoto;
  paintCombo();
  cancelAnimationFrame(countFrame);
  coinsShown = shown ? coinsOf(shown) : 0;
  setInk(coinsInk, coinsShown.toLocaleString());
  worth.hidden = !settings.showCoins || coinsShown === 0;
}

function paintCombo() {
  const count = shown?.count ?? 0;
  combo.hidden = !settings.showCombo || count < 2;
  setInk(comboCount, `×${count.toLocaleString()}`);
}

function showPicture(loaded: boolean) {
  gift.hidden = !loaded;
  // An SVG element has no hidden property.
  box.toggleAttribute("hidden", loaded);
}

function coinsOf(entry: Shown) {
  return entry.gift.coins * entry.count;
}

// The same gift again: the count bumps, the gift hops and the coins count up.
function grow() {
  if (swapVersion === version || !shown) return;
  paintCombo();
  const coins = coinsOf(shown);
  worth.hidden = !settings.showCoins || coins === 0;
  countCoins(coins, coinsShown, 420);
  if (reduceMotion.matches || performance.now() < settledAt) return;
  play(
    pic,
    [
      { transform: "none" },
      { transform: "scale(1.1)", offset: 0.35 },
      { transform: "none" },
    ],
    { duration: 260, easing: "ease-out" },
  );
  if (!combo.hidden) {
    play(comboCount, [{ transform: "scale(1.5)" }, { transform: "none" }], {
      duration: 280,
      easing: "cubic-bezier(0.3, 1.6, 0.6, 1)",
    });
  }
}

// The old gift and its text leave, the way the entrance came in.
function leave() {
  const kind = entrance();
  const out = { duration: 170, easing: "ease-in", fill: "forwards" } as const;
  if (kind === "slide") {
    const to = `translateX(${-slideFrom() * 1.6}rem)`;
    return Promise.all(
      [pic, who, worth, comboCount].map((el) =>
        done(
          play(
            el,
            [
              { opacity: 1, transform: "none" },
              { opacity: 0, transform: to },
            ],
            out,
          ),
        ),
      ),
    );
  }
  const fadeOnly = kind === "fade";
  return Promise.all([
    done(
      play(
        pic,
        fadeOnly
          ? [{ opacity: 1 }, { opacity: 0 }]
          : [
              { opacity: 1, transform: "none" },
              { opacity: 0, transform: "scale(0.5)" },
            ],
        out,
      ),
    ),
    ...[who, worth, comboCount].map((el) =>
      done(play(el, [{ opacity: 1 }, { opacity: 0 }], out)),
    ),
  ]);
}

// The gift comes in the way "How a new gift comes in" says, the light flares behind it, sparkles
// burst as it lands, and its name and coins follow, the coins counting up. With `appearing`, the
// title and the light come in too.
function enter(appearing: boolean) {
  const kind = entrance();
  const motion = !reduceMotion.matches;
  if (appearing) {
    play(
      title,
      motion
        ? [
            { opacity: 0, transform: "translateY(-0.4em) scale(0.9)" },
            { opacity: 1, transform: "none" },
          ]
        : [{ opacity: 0 }, { opacity: 1 }],
      { duration: 320, easing: "ease-out" },
    );
  }
  flare(appearing);

  const [landing, length] = enterGift(kind);
  settledAt = performance.now() + length;
  burst(landing);

  const from: Keyframe =
    kind === "fade"
      ? { opacity: 0 }
      : kind === "slide"
        ? { opacity: 0, transform: `translateX(${slideFrom() * 1.6}rem)` }
        : { opacity: 0, transform: "translateY(0.45em)" };
  const to: Keyframe =
    kind === "fade" ? { opacity: 1 } : { opacity: 1, transform: "none" };
  const delay = kind === "slide" || kind === "fade" ? 80 : 200;
  [who, worth].forEach((el, i) =>
    play(el, [from, to], {
      duration: 300,
      delay: delay + i * 80,
      easing: "ease-out",
      fill: "backwards",
    }),
  );
  if (!combo.hidden) {
    play(
      comboCount,
      kind === "fade"
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: "scale(0)" },
            { opacity: 1, transform: "scale(1.3)", offset: 0.6 },
            { opacity: 1, transform: "none" },
          ],
      {
        duration: 360,
        delay: landing + 120,
        easing: "ease-out",
        fill: "backwards",
      },
    );
  }
  if (shown) countCoins(coinsOf(shown), 0, 700, delay + 80);
}

// The light flares up behind the gift, or comes in with the card.
function flare(appearing: boolean) {
  if (settings.light === "none") return;
  if (reduceMotion.matches) {
    if (appearing) {
      play(light, [{ opacity: 0 }, { opacity: 1 }], { duration: 320 });
    }
    return;
  }
  play(
    light,
    [
      appearing
        ? { opacity: 0, transform: "scale(0.3)" }
        : { opacity: 0.4, transform: "scale(0.6)" },
      { opacity: 1, transform: "scale(1.12)", offset: 0.55 },
      { opacity: 1, transform: "none" },
    ],
    { duration: 800, easing: "ease-out" },
  );
}

// Plays the gift's entrance. Returns when it lands and when it ends, in ms.
function enterGift(kind: Settings["entrance"]): [number, number] {
  pic.style.transformOrigin = kind === "drop" ? "50% 100%" : "";
  switch (kind) {
    case "pop":
      play(
        pic,
        [
          { opacity: 0, transform: "scale(0.3) rotate(-14deg)" },
          { opacity: 1, transform: "scale(1.16) rotate(5deg)", offset: 0.5 },
          { transform: "scale(0.95) rotate(-2deg)", offset: 0.75 },
          { transform: "none" },
        ],
        { duration: 620, easing: "ease-out" },
      );
      return [260, 620];
    case "drop":
      // It falls, squashes as it lands, and bounces once.
      play(
        pic,
        [
          {
            opacity: 0,
            transform: "translateY(-160%)",
            easing: "cubic-bezier(0.5, 0, 1, 0.5)",
          },
          { opacity: 1, offset: 0.2 },
          {
            transform: "translateY(0) scale(1.15, 0.82)",
            offset: 0.5,
            easing: "ease-out",
          },
          {
            transform: "translateY(-12%) scale(0.96, 1.05)",
            offset: 0.72,
            easing: "ease-in",
          },
          { transform: "none" },
        ],
        { duration: 780 },
      );
      return [390, 780];
    case "spin":
      // It turns one and a half times, like a tossed coin, as it grows.
      play(
        pic,
        [
          {
            opacity: 0,
            transform: "perspective(30em) rotateY(-540deg) scale(0.35)",
          },
          { opacity: 1, offset: 0.25 },
          { transform: "perspective(30em) rotateY(0deg) scale(1)" },
        ],
        { duration: 860, easing: "cubic-bezier(0.15, 0.75, 0.35, 1)" },
      );
      return [640, 860];
    case "slide":
      play(
        pic,
        [
          { opacity: 0, transform: `translateX(${slideFrom() * 2.4}rem)` },
          { opacity: 1, transform: "none" },
        ],
        { duration: 420, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)" },
      );
      return [260, 420];
    default:
      // Fade.
      play(pic, [{ opacity: 0 }, { opacity: 1 }], {
        duration: 320,
        easing: "ease-out",
      });
      return [120, 320];
  }
}

// Reduced motion leaves only fades.
function entrance(): Settings["entrance"] {
  return reduceMotion.matches ? "fade" : settings.entrance;
}

// The side a slide comes in from: the page's near edge, or the left when centered.
function slideFrom() {
  return settings.align === "right" ? 1 : -1;
}

// Sparkles fly out from behind the gift and fade.
function burst(delay: number) {
  if (!settings.sparkles || reduceMotion.matches) return;
  const size = pic.offsetWidth;
  const count = 12;
  for (let i = 0; i < count; i++) {
    const angle = ((i + Math.random() * 0.6) / count) * Math.PI * 2;
    const distance = size * (0.6 + Math.random() * 0.4);
    const width = size * (0.12 + Math.random() * 0.12);
    const spark = document.createElement("span");
    spark.className = "spark";
    spark.innerHTML = SPARK;
    Object.assign(spark.style, {
      width: `${width}px`,
      height: `${width}px`,
      margin: `${-width / 2}px`,
    });
    sparks.append(spark);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    spark
      .animate(
        [
          { opacity: 1, transform: "translate(0, 0) scale(0)" },
          {
            opacity: 1,
            transform: `translate(${x * 0.8}px, ${y * 0.8}px) scale(1) rotate(45deg)`,
            offset: 0.45,
          },
          {
            opacity: 0,
            transform: `translate(${x}px, ${y}px) scale(0.3) rotate(90deg)`,
          },
        ],
        {
          duration: 650 + Math.random() * 300,
          delay,
          easing: "cubic-bezier(0.2, 0.7, 0.4, 1)",
          fill: "backwards",
        },
      )
      .finished.catch(() => {})
      .finally(() => spark.remove());
  }
}

// Counts the coins up from `from` to `to`, starting after `delay`.
function countCoins(to: number, from: number, ms: number, delay = 0) {
  cancelAnimationFrame(countFrame);
  if (reduceMotion.matches || to === from) {
    coinsShown = to;
    setInk(coinsInk, to.toLocaleString());
    return;
  }
  const start = performance.now() + delay;
  const step = (now: number) => {
    const t = Math.min(1, Math.max(0, (now - start) / ms));
    coinsShown = Math.round(from + (to - from) * (1 - (1 - t) ** 3));
    setInk(coinsInk, coinsShown.toLocaleString());
    if (t < 1) countFrame = requestAnimationFrame(step);
  };
  coinsShown = from;
  setInk(coinsInk, from.toLocaleString());
  countFrame = requestAnimationFrame(step);
}

function play(
  el: Element,
  frames: Keyframe[],
  options: KeyframeAnimationOptions,
) {
  const animation = el.animate(frames, options);
  running.add(animation);
  // One that holds its last frame stays until it's stopped.
  if (options.fill !== "forwards") {
    animation.addEventListener("finish", () => running.delete(animation));
  }
  return animation;
}

function stopAnimations() {
  for (const animation of running) animation.cancel();
  running.clear();
}

/** Resolves when the animation ends or is stopped. */
function done(animation: Animation) {
  return animation.finished.then(
    () => {},
    () => {},
  );
}

// Writes an outlined text: its outline behind and its fill over it.
function setInk(el: HTMLElement, text: string) {
  for (const span of el.children) span.textContent = text;
}

function shorten(name: string) {
  const letters = Array.from(segmenter.segment(name), (part) => part.segment);
  return letters.length > NAME_MAX
    ? `${letters
        .slice(0, NAME_MAX - 1)
        .join("")
        .trimEnd()}…`
    : name;
}

// The placeholder stays under the picture, so it shows while the picture loads or if it fails.
function setPicture(el: HTMLElement, url: string) {
  el.innerHTML = PLACEHOLDER;
  if (!url) return;
  const img = new Image();
  img.alt = "";
  img.decoding = "async";
  // TikTok's image servers can refuse requests that name another site.
  img.referrerPolicy = "no-referrer";
  img.addEventListener("error", () => img.remove(), { once: true });
  img.src = url;
  el.append(img);
}

// Loads a gift's picture before it comes in, for up to LOAD_MS.
function loadPicture(url: string) {
  return new Promise<void>((resolve) => {
    if (!url) return resolve();
    const img = new Image();
    const timer = setTimeout(resolve, LOAD_MS);
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    img.referrerPolicy = "no-referrer";
    img.addEventListener("load", finish, { once: true });
    img.addEventListener("error", finish, { once: true });
    img.src = url;
  });
}

function scheduleSave() {
  if (demo || saveTimer) return;
  saveTimer = setTimeout(save, 1000);
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  const latest = pending ?? shown;
  try {
    if (latest) {
      const saved: Saved = { at: lastGiftAt, shown: latest };
      localStorage.setItem(storageKey, JSON.stringify(saved));
    } else {
      localStorage.removeItem(storageKey);
    }
  } catch {
    // Storage can be full or turned off. The card still works, it just won't survive a reload.
  }
}

// The biggest gift saved, unless it's older than clear_hours.
function restore() {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(storageKey) ?? "null",
    );
    if (!isSaved(saved)) return;
    if (Date.now() - saved.at > hours(settings.clearHours)) return;
    shown = saved.shown;
    lastGiftAt = saved.at;
  } catch {
    // A save that can't be read starts the card empty.
  }
}

function isSaved(value: unknown): value is Saved {
  if (!isRecord(value) || typeof value.at !== "number") return false;
  const entry = value.shown;
  return (
    isRecord(entry) &&
    typeof entry.key === "string" &&
    typeof entry.name === "string" &&
    typeof entry.picture === "string" &&
    typeof entry.count === "number" &&
    isRecord(entry.gift) &&
    typeof entry.gift.name === "string" &&
    typeof entry.gift.image === "string" &&
    typeof entry.gift.coins === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// "#rrggbb", or "#rrggbbaa" with its alpha ignored. The settings checked it's a color.
function parseColor(color: string): RGB {
  const value = parseInt(color.slice(1, 7), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mix(a: RGB, b: RGB, amount: number): RGB {
  const at = (i: 0 | 1 | 2) => Math.round(a[i] + (b[i] - a[i]) * amount);
  return [at(0), at(1), at(2)];
}

function css([r, g, b]: RGB, alpha?: number): string {
  return alpha === undefined
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function find<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`#${id} is missing.`);
  return el;
}

function hours(value: number) {
  return value * 60 * 60 * 1000;
}

// The demo's gifts, each costing as much as the last or more: which sample gift and how many in
// its combo.
const DEMO: [gift: number, combo: number][] = [
  [0, 6],
  [1, 10],
  [2, 1],
  [2, 3],
  [3, 1],
];

// Sample gifters send pricier and pricier gifts, each a combo with one event for each gift as on a
// LIVE, so each takes the card. After the priciest the card clears and it starts over, so the
// preview keeps showing gifts coming in. Returns a function that stops it.
function playSample() {
  let timer: Timer;
  let step = 0;

  const next = () => {
    if (step === DEMO.length) {
      step = 0;
      clearCard();
      timer = setTimeout(next, 1500);
      return;
    }
    const [index, size] = DEMO[step];
    const sample = SAMPLE_GIFTS[index];
    const user = SAMPLE_USERS[step % SAMPLE_USERS.length];
    step++;
    let count = 0;

    const send = () => {
      count++;
      handleGift({
        user,
        gift: {
          id: sample.id,
          name: sample.name,
          coins: sample.coins,
          type: 1,
          comboCount: count,
          repeatEnd: count === size,
          image: sample.image,
        },
      });
      timer =
        count < size
          ? setTimeout(send, 300)
          : setTimeout(next, step === DEMO.length ? 5000 : 3500);
    };
    send();
  };

  timer = setTimeout(next, 400);
  return () => clearTimeout(timer);
}
