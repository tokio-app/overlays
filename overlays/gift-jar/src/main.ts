import {
  tokio,
  TOKIO_EVENTS,
  type ConfigData,
  type GiftData,
  type UserData,
} from "@tokioapp/overlay";
import { GIFT_BOX, SAMPLE_GIFTS } from "./gifts";
import { COIN, medal, PLACEHOLDER } from "./icons";
import { Jar } from "./jar";
import { DEFAULT_JAR, jarById, placement, STAGE, type JarDesign } from "./jars";
import { Tally, type Gifting } from "./tally";
import "./style.css";

const stage = document.getElementById("stage")!;
const canvas = find("gifts", HTMLCanvasElement);
const spill = find("spill", HTMLCanvasElement);
const message = document.getElementById("message")!;
const messageName = document.getElementById("message-name")!;
const messageImage = find("message-image", HTMLImageElement);
const messageGift = document.getElementById("message-gift")!;
const messageCount = document.getElementById("message-count")!;
const messageCoins = document.getElementById("message-coins")!;
const gifter = document.getElementById("gifter")!;
const gifterMedal = document.getElementById("gifter-medal")!;
const gifterPhoto = document.getElementById("gifter-photo")!;
const gifterName = document.getElementById("gifter-name")!;
const gifterCoins = document.getElementById("gifter-coins")!;
const gifterBar = document.getElementById("gifter-bar")!;
const gifterPill = gifter.querySelector(".pill")!;
const total = document.getElementById("total")!;
const totalCoins = document.getElementById("total-coins")!;
const jarBack = document.getElementById("jar-back")!;
const jarFront = document.getElementById("jar-front")!;
for (const coin of document.querySelectorAll(".coin")) coin.innerHTML = COIN;
// A gift picture that doesn't load shows the drawn box.
messageImage.addEventListener("error", () => {
  if (messageImage.src !== GIFT_BOX) messageImage.src = GIFT_BOX;
});

const params = new URLSearchParams(location.search);
// Tokio fills in the ID. While developing, open the page with ?id=<test ID>, made on Tokio's
// Tools page, or with ?demo for the sample gifters, and ?jar=<id> to pick a jar. Tokio's Test button makes up a new gifter for
// every event, so only the samples (or a real LIVE) show a gifter's coins adding up.
const overlayId = window.__OVERLAY_ID__ || params.get("id") || "";
// Tokio's Overlays page previews the overlay in an iframe with this name. There, and with ?demo,
// sample gifters keep sending gifts until the first real one, so the preview doesn't sit empty.
const preview = window.name === `TOKIO_APP-${overlayId}`;
const demo = preview || params.has("demo");
const storageKey = `gift-jar:${overlayId}`;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
// With nobody waiting, the gifter pill goes round this many of the top gifters.
const TOP_GIFTERS = 5;

type RGB = [number, number, number];

// The default glass color, a cool grey.
const CLEAR_GLASS: RGB = [196, 208, 216];

const SAMPLE_USERS: UserData[] = [
  "Sunny Fox",
  "Pixel Panda",
  "Lucky Tiger",
  "Cosmic Owl",
  "Happy Koala",
  "Neon Wolf",
].map((name, i) => ({
  username: name,
  handle: `@${name.toLowerCase().replace(" ", "_")}`,
  // Placeholders show instead when offline.
  profilePictures: [`https://picsum.photos/seed/tokio${i + 1}/200/200`],
}));

let jarId = DEFAULT_JAR;
let glassColor = "#c4d0d8";
let maxGifts = 150;
let giftSize = 20;
let resetMs = hours(6);
let showTotal = true;
let showMessage = true;
let messageMs = 5000;
let showGifter = true;
let gifterMs = 8000;
let overflow = false;
applyConfig(window.__OVERLAY_CONFIG__);

let design = jarById(jarId);
// The stage's width in px, set by fit().
let stageWidth = STAGE.minWidth;
const jar = new Jar(canvas, spill, design, { maxGifts, giftSize });
jar.setOverflow(overflow);
// Kept across reloads, since streaming apps reload overlays when scenes change.
let tally = demo ? new Tally(resetMs, dropLimit()) : load();
jar.onRemove = (drop) => {
  tally.forget(drop);
  scheduleSave();
};
let messageKey = "";
let messageTimer: ReturnType<typeof setTimeout> | undefined;
// The gifter on screen, and the ones waiting for their turn.
let gifterHandle = "";
let gifterPicture: string | null = null;
let gifterTimer: ReturnType<typeof setTimeout> | undefined;
const waiting: string[] = [];
let saveTimer: ReturnType<typeof setTimeout> | undefined;

showDesign(design);
showGlass(glassColor);
fit();
addEventListener("resize", fit);
// Streaming apps reload overlays when scenes change, so the last second's gifts are saved first.
addEventListener("pagehide", () => {
  if (saveTimer) save();
});
jar.settle(tally.drops);
jar.start();
renderTotal();
// A reloaded overlay goes on showing the gifters it has.
if (showGifter) nextGifter();
let stopSample = demo ? playSample() : undefined;

// Sent when the streamer saves the overlay's settings.
tokio.on(TOKIO_EVENTS.CONFIG, (config) => {
  applyConfig(config);
  tally.resetMs = resetMs;
  Object.assign(jar.options, { maxGifts, giftSize });
  jar.setOverflow(overflow);
  tally.maxDrops = dropLimit();
  // A new jar gets the same gifts, poured in again.
  if (jarId !== design.id) {
    design = jarById(jarId);
    showDesign(design);
    jar.setDesign(design, tally.drops);
  } else {
    jar.trim();
  }
  showGlass(glassColor);
  renderTotal();
  if (!showMessage) hideMessage();
  if (!showGifter) hideGifter();
  else if (!gifterHandle) nextGifter();
});

tokio.on(TOKIO_EVENTS.GIFT, (data) => {
  // The first gift replaces the sample ones.
  if (stopSample) {
    stopSample();
    stopSample = undefined;
    tally = new Tally(resetMs, dropLimit());
    jar.clear();
    hideMessage();
    hideGifter();
    renderTotal();
  }
  handleGift(data);
});

tokio.connect(overlayId);

// The keys are the field ids in config.yaml.
function applyConfig(config: ConfigData) {
  // ?jar=<id> wins, to look at each jar while developing.
  const jarValue = params.get("jar") ?? config.jar;
  if (typeof jarValue === "string") jarId = jarById(jarValue).id;
  if (typeof config.glass_color === "string") glassColor = config.glass_color;
  if (typeof config.max_gifts === "number") maxGifts = config.max_gifts;
  if (typeof config.gift_size === "number") giftSize = config.gift_size;
  if (typeof config.overflow === "boolean") overflow = config.overflow;
  if (typeof config.reset_hours === "number") {
    resetMs = hours(config.reset_hours);
  }
  showTotal = config.show_total !== false;
  showMessage = config.show_message !== false;
  if (typeof config.message_seconds === "number") {
    messageMs = config.message_seconds * 1000;
  }
  showGifter = config.show_gifter !== false;
  if (typeof config.gifter_seconds === "number") {
    gifterMs = config.gifter_seconds * 1000;
  }
  // Without the gifter pill, the total moves up into its place.
  stage.classList.toggle("no-gifter", !showGifter);

  const colors = {
    "--text-color": config.text_color,
    "--coin-color": config.coin_color,
    "--bar-color": config.bar_color,
    "--panel-color": config.panel_color,
  };
  for (const [property, value] of Object.entries(colors)) {
    if (typeof value === "string") {
      document.documentElement.style.setProperty(property, value);
    }
  }
}

// Puts the jar's glass on the page.
function showDesign(next: JarDesign) {
  placeDesign(next);
  jarBack.innerHTML = next.back;
  jarFront.innerHTML = next.front;
}

// Puts the jar in the middle of the stage, and the message's tail where it touches the glass on
// either side.
function placeDesign(next: JarDesign) {
  const box = placement(next, stageWidth);
  const root = document.documentElement.style;
  root.setProperty("--stage-width", `${stageWidth}px`);
  root.setProperty("--jar-x", `${box.x}px`);
  root.setProperty("--jar-y", `${box.y}px`);
  root.setProperty("--jar-width", `${box.width}px`);
  root.setProperty("--jar-height", `${box.height}px`);
  root.setProperty("--bubble-x", `${box.x + next.bubbleX}px`);
  root.setProperty(
    "--bubble-right-x",
    `${box.x + next.width - next.bubbleX}px`,
  );
  root.setProperty("--bubble-y", `${box.y + next.bubbleY}px`);
}

// The glass's tones, from its color: lighter for haze, darker for its edges and thick parts,
// as real glass looks darker where light crosses more of it.
function showGlass(color: string) {
  const rgb = parseColor(color) ?? CLEAR_GLASS;
  const tones = {
    "--glass": rgb,
    "--glass-light": mix(rgb, [255, 255, 255], 0.6),
    "--glass-edge": mix(rgb, [0, 0, 0], 0.5),
    "--glass-deep": mix(rgb, [0, 0, 0], 0.72),
  };
  const root = document.documentElement.style;
  for (const [property, value] of Object.entries(tones)) {
    root.setProperty(property, css(value));
  }
  // Colored glass colors the gifts behind it; clear glass hardly does.
  root.setProperty("--glass-tint", (0.2 * saturation(rgb)).toFixed(3));
  jar.setShade(css(tones["--glass-deep"]));
}

// "#rrggbb", or "#rrggbbaa" with its alpha ignored.
function parseColor(color: string): RGB | null {
  const match = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(color.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

// HSL saturation, 0 to 1.
function saturation(rgb: RGB): number {
  const max = Math.max(...rgb) / 255;
  const min = Math.min(...rgb) / 255;
  const lightness = (max + min) / 2;
  if (max === min) return 0;
  return (max - min) / (1 - Math.abs(2 * lightness - 1));
}

function mix(a: RGB, b: RGB, amount: number): RGB {
  const at = (i: 0 | 1 | 2) => Math.round(a[i] + (b[i] - a[i]) * amount);
  return [at(0), at(1), at(2)];
}

function css([r, g, b]: RGB): string {
  return `rgb(${r}, ${g}, ${b})`;
}

// Scales the stage to the page's height, at its bottom, and makes it as wide as the page, so the
// jar stands in the middle and spilled gifts reach the page's edges. A narrow page gets the
// stage's least width, scaled down to fit.
function fit() {
  // A source can be 0 px while it's hidden. The last size stays until it shows.
  if (!innerWidth || !innerHeight) return;
  const scale = Math.min(
    innerHeight / STAGE.height,
    innerWidth / STAGE.minWidth,
  );
  const width = Math.max(STAGE.minWidth, innerWidth / scale);
  stage.style.setProperty("--scale", String(scale));
  if (width !== stageWidth) {
    stageWidth = width;
    placeDesign(design);
  }
  jar.resize(scale, devicePixelRatio, stageWidth);
}

function handleGift(data: GiftData) {
  const gifting = tally.add(data.user, data.gift);
  if (!gifting) return;
  // The jar sat unused for the reset time, so it starts empty.
  if (gifting.reset) {
    jar.clear();
    hideMessage();
    hideGifter();
  }
  for (const drop of gifting.drops) jar.drop(drop);

  showGift(gifting);
  renderTotal();
  scheduleSave();
}

// The gift's message, and the gifter's turn in the pill. Each new message goes on either side of
// the jar, at random, and stays in place while the same gifter's combo of the same gift goes on.
function showGift(gifting: Gifting) {
  if (showMessage) {
    const same =
      gifting.key === messageKey && message.classList.contains("visible");
    messageKey = gifting.key;
    if (!same) message.classList.toggle("right", Math.random() < 0.5);
    messageName.textContent = gifting.gifter.name;
    messageGift.textContent = gifting.gift.name;
    messageCount.textContent = `x${gifting.count.toLocaleString()}`;
    messageCoins.textContent = `${gifting.coins.toLocaleString()} ${gifting.coins === 1 ? "Coin" : "Coins"}`;
    const image = gifting.gift.image || GIFT_BOX;
    if (messageImage.getAttribute("src") !== image) messageImage.src = image;
    // The gift's name shortens too only when the gifter's can't make room on its own.
    message.classList.remove("tight");
    if (message.scrollWidth > message.clientWidth) {
      message.classList.add("tight");
    }
    message.classList.add("visible");
    if (!same && !reduceMotion.matches) {
      message.animate(
        [
          { transform: "scale(0.94)", opacity: 0.4 },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: 200, easing: "ease-out" },
      );
    }
    clearTimeout(messageTimer);
    messageTimer = setTimeout(hideMessage, messageMs);
  }

  queueGifter(gifting.gifter.handle);
}

function hideMessage() {
  clearTimeout(messageTimer);
  message.classList.remove("visible");
}

// The gifter pill is a carousel. Each gifter keeps it for a whole countdown, whatever is sent
// meanwhile: new gifters wait their turn, once each, in the order they gave, and with nobody
// waiting it goes round the top gifters. A gift from the gifter on screen updates their coins.
function queueGifter(handle: string) {
  if (!showGifter) return;
  if (!gifterHandle) {
    showTurn(handle);
    return;
  }
  if (handle !== gifterHandle && !waiting.includes(handle)) {
    waiting.push(handle);
  }
  // The gifter on screen may have more coins, or another medal.
  renderGifter();
}

function nextGifter() {
  const handle = waiting.shift() ?? nextTopGifter();
  if (handle) showTurn(handle);
  else hideGifter();
}

// The top gifter after the one on screen, round and round.
function nextTopGifter(): string | undefined {
  const top = tally.top(TOP_GIFTERS);
  if (top.length === 0) return undefined;
  const at = top.findIndex((person) => person.handle === gifterHandle);
  return top[(at + 1) % top.length].handle;
}

function showTurn(handle: string) {
  const changed =
    gifter.classList.contains("visible") && handle !== gifterHandle;
  gifterHandle = handle;
  renderGifter();
  gifter.classList.add("visible");
  if (changed && !reduceMotion.matches) {
    gifterPill.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 300,
      easing: "ease-out",
    });
  }

  // The bar drains over the turn. It keeps running with reduced motion: it's the countdown, not
  // a flourish.
  for (const animation of gifterBar.getAnimations()) animation.cancel();
  gifterBar.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], {
    duration: gifterMs,
    easing: "linear",
    fill: "forwards",
  });
  clearTimeout(gifterTimer);
  gifterTimer = setTimeout(nextGifter, gifterMs);
}

// Fills the pill from the tally, so it shows the gifter's coins as they are now.
function renderGifter() {
  const person = tally.gifter(gifterHandle);
  if (!person) return;
  const rank = tally.rank(person.handle);
  const badge = rank ? medal(rank) : "";
  if (gifterMedal.innerHTML !== badge) gifterMedal.innerHTML = badge;
  gifterMedal.hidden = !rank;
  gifterName.textContent = person.name;
  gifterCoins.textContent = person.coins.toLocaleString();
  if (gifterPicture !== person.picture) {
    gifterPicture = person.picture;
    setPicture(gifterPhoto, person.picture);
  }
}

function hideGifter() {
  clearTimeout(gifterTimer);
  gifterHandle = "";
  waiting.length = 0;
  gifter.classList.remove("visible");
}

function renderTotal() {
  // Hidden until a gift is sent.
  total.hidden = !showTotal || tally.total === 0;
  totalCoins.textContent = tally.total.toLocaleString();
}

// The placeholder stays under the picture, so it shows while the picture loads or if it fails.
function setPicture(photo: HTMLElement, url: string) {
  photo.innerHTML = PLACEHOLDER;
  if (!url) return;

  const img = new Image();
  img.alt = "";
  img.decoding = "async";
  // TikTok's image servers can refuse requests that name another site.
  img.referrerPolicy = "no-referrer";
  img.addEventListener("error", () => img.remove(), { once: true });
  img.src = url;
  photo.append(img);
}

function scheduleSave() {
  if (demo || saveTimer) return;
  saveTimer = setTimeout(save, 1000);
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  try {
    localStorage.setItem(storageKey, tally.serialize());
  } catch {
    // Storage can be full or turned off. The jar still works, it just won't survive a reload.
  }
}

function load(): Tally {
  try {
    return Tally.restore(
      localStorage.getItem(storageKey),
      resetMs,
      dropLimit(),
    );
  } catch {
    return new Tally(resetMs, dropLimit());
  }
}

// The most gifts the tally keeps. With overflow, the jar picks which gifts go and tells it.
function dropLimit() {
  return overflow ? Infinity : maxGifts;
}

function find<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`#${id} is missing.`);
  return el;
}

function hours(value: number) {
  return value * 60 * 60 * 1000;
}

// Sample gifters send a combo of a sample gift, one event for each gift as on a LIVE,
// then wait 1 to 3 seconds. Returns a function that stops it.
function playSample() {
  let timer: ReturnType<typeof setTimeout>;

  const combo = () => {
    const user = SAMPLE_USERS[randomInt(0, SAMPLE_USERS.length - 1)];
    const gift = pickGift();
    const size = randomInt(1, gift.maxCombo);
    let count = 0;

    const next = () => {
      count++;
      handleGift({
        user,
        gift: {
          id: gift.id,
          name: gift.name,
          coins: gift.coins,
          type: 1,
          comboCount: count,
          repeatEnd: count === size,
          image: gift.image,
        },
      });
      timer =
        count < size
          ? setTimeout(next, 250)
          : setTimeout(combo, randomInt(1000, 3000));
    };
    next();
  };

  timer = setTimeout(combo, 400);
  return () => clearTimeout(timer);
}

// A sample gift, the likelier the heavier its weight.
function pickGift() {
  let left =
    Math.random() * SAMPLE_GIFTS.reduce((sum, gift) => sum + gift.weight, 0);
  for (const gift of SAMPLE_GIFTS) {
    left -= gift.weight;
    if (left < 0) return gift;
  }
  return SAMPLE_GIFTS[0];
}

function randomInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
