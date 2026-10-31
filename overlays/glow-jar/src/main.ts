import {
  tokio,
  TOKIO_EVENTS,
  type ConfigData,
  type GiftData,
  type UserData,
} from "@tokioapp/overlay";
import { GIFT_BOX, SAMPLE_GIFTS } from "./gifts";
import { COIN, CROWN, PLACEHOLDER, STAR } from "./icons";
import { Jar } from "./jar";
import {
  DEFAULT_JAR,
  JARS,
  loadDesign,
  loadLayer,
  placement,
  STAGE,
  type JarPictures,
  type Point,
  type RGB,
} from "./jars";
import { Tally, type Gifting } from "./tally";
import "./style.css";

type Side = "left" | "right";

// A gift bubble beside the jar. Its tail touches the jar at `anchor`, a point of the jar's own.
interface Bubble {
  el: HTMLElement;
  photo: HTMLElement;
  name: HTMLElement;
  gift: HTMLImageElement;
  coins: HTMLElement;
  side: Side;
  anchor: Point;
  /** The gifter and gift's streak it shows. Empty while it's hidden. */
  key: string;
  picture: string;
  /** When it was last filled in, for reusing the stalest one. */
  shownAt: number;
  timer?: ReturnType<typeof setTimeout>;
}

const stage = document.getElementById("stage")!;
const canvas = find("gifts", HTMLCanvasElement);
const spill = find("spill", HTMLCanvasElement);
const jarBack = document.getElementById("jar-back")!;
const jarFront = document.getElementById("jar-front")!;
const sparkleLayer = document.getElementById("sparkles")!;
const tag = document.getElementById("tag")!;
const tagPhoto = document.getElementById("tag-photo")!;
const tagName = document.getElementById("tag-name")!;
const bubbleList = document.getElementById("bubbles")!;
const bubbleTemplate = find("bubble-template", HTMLTemplateElement);
const total = document.getElementById("total")!;
const totalCoins = document.getElementById("total-coins")!;

const params = new URLSearchParams(location.search);
// Tokio fills in the ID. While developing, open the page with ?id=<test ID>, made on Tokio's
// Tools page, ?demo for the sample gifters, ?jar=<id> to pick a jar, or ?edges to draw the jar's
// map over its art. Tokio's Test button makes up a new gifter for every event, so only the samples
// (or a real LIVE) show a gifter's coins adding up.
const overlayId = window.__OVERLAY_ID__ || params.get("id") || "";
// Tokio's Overlays page previews the overlay in an iframe with this name. There, and with ?demo,
// sample gifters keep sending gifts until the first real one, so the preview doesn't sit empty.
const preview = window.name === `TOKIO_APP-${overlayId}`;
const demo = preview || params.has("demo");
const storageKey = `glow-jar:${overlayId}`;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
// The tag hangs at this angle, in degrees: its bottom leans away from the glass. Keep it in sync
// with .tag in style.css.
const TAG_REST = -6;

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
let accent = "#f43f5e";
let maxGifts = 150;
let giftSize = 20;
let resetMs = hours(6);
let showTotal = true;
let showBubbles = true;
let bubbleMs = 5000;
let showTopGifter = true;
let overflow = false;
applyConfig(window.__OVERLAY_CONFIG__);

// The stage's width in px, set by fit().
let stageWidth = STAGE.minWidth;
// The jar's edges come from its walls picture, read before anything drops into it.
let design = await loadDesign(JARS[jarId]);
let [backLayer, frontLayer] = await loadLayers(design);
// The jar on the stage, or the one loading to replace it.
let shownJar = jarId;
const jar = new Jar(canvas, spill, design, { maxGifts, giftSize });
jar.setOverflow(overflow);
// Kept across reloads, since streaming apps reload overlays when scenes change.
let tally = demo ? new Tally(resetMs, dropLimit()) : load();
jar.onRemove = (drop) => {
  tally.forget(drop);
  scheduleSave();
};
let bubbles = makeBubbles();
// The side of the bubble that last took a new gift, so the next one goes to the other.
let lastSide: Side | undefined;
// The top gifter on the tag.
let tagHandle = "";
let tagPicture: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

for (const coin of document.querySelectorAll(".coin")) coin.innerHTML = COIN;
for (const crown of document.querySelectorAll(".crown"))
  crown.innerHTML = CROWN;
showDesign();
showColors();
fit();
addEventListener("resize", fit);
// Streaming apps reload overlays when scenes change, so the last second's gifts are saved first.
addEventListener("pagehide", () => {
  if (saveTimer) save();
});
jar.settle(tally.drops);
jar.start();
renderTotal();
renderTag();
let stopSample = demo ? playSample() : undefined;

// Sent when the streamer saves the overlay's settings.
tokio.on(TOKIO_EVENTS.CONFIG, (config) => {
  applyConfig(config);
  tally.resetMs = resetMs;
  Object.assign(jar.options, { maxGifts, giftSize });
  jar.setOverflow(overflow);
  tally.maxDrops = dropLimit();
  jar.trim();
  if (jarId !== shownJar) void showJar(jarId);
  showColors();
  renderTotal();
  renderTag();
  if (!showBubbles) hideBubbles();
});

tokio.on(TOKIO_EVENTS.GIFT, (data) => {
  // The first gift replaces the sample ones.
  if (stopSample) {
    stopSample();
    stopSample = undefined;
    tally = new Tally(resetMs, dropLimit());
    jar.clear();
    hideBubbles();
    renderTag();
    renderTotal();
  }
  handleGift(data);
});

tokio.connect(overlayId);

// The keys are the field ids in config.yaml.
function applyConfig(config: ConfigData) {
  // ?jar=<id> wins, to look at each jar while developing.
  const jarValue = params.get("jar") ?? config.jar;
  if (typeof jarValue === "string" && Object.hasOwn(JARS, jarValue)) {
    jarId = jarValue;
  }
  if (typeof config.accent_color === "string") accent = config.accent_color;
  if (typeof config.max_gifts === "number") maxGifts = config.max_gifts;
  if (typeof config.gift_size === "number") giftSize = config.gift_size;
  if (typeof config.overflow === "boolean") overflow = config.overflow;
  if (typeof config.reset_hours === "number") {
    resetMs = hours(config.reset_hours);
  }
  showTotal = config.show_total !== false;
  showBubbles = config.show_bubbles !== false;
  if (typeof config.bubble_seconds === "number") {
    bubbleMs = config.bubble_seconds * 1000;
  }
  showTopGifter = config.show_top_gifter !== false;

  const colors = {
    "--text-color": config.text_color,
    "--coin-color": config.coin_color,
  };
  for (const [property, value] of Object.entries(colors)) {
    if (typeof value === "string") {
      document.documentElement.style.setProperty(property, value);
    }
  }
}

// A jar's pictures, on canvases the main color repaints.
function loadLayers(pictures: JarPictures) {
  const own = parseColor(pictures.color) ?? [244, 63, 94];
  return Promise.all([
    loadLayer(pictures.back, pictures.backTint, own),
    loadLayer(pictures.front, pictures.frontTint, own),
  ]);
}

// Puts another jar on the stage, with the same gifts poured into it. If the jar setting changes
// again while it loads, the newer one wins.
async function showJar(id: string) {
  shownJar = id;
  const next = await loadDesign(JARS[id]);
  const layers = await loadLayers(next);
  if (id !== shownJar) return;
  design = next;
  [backLayer, frontLayer] = layers;
  hideBubbles();
  bubbles = makeBubbles();
  jar.setDesign(design, tally.drops);
  showDesign();
  showColors();
}

// Puts the jar's pictures and its sparkles on the page, and ties the tag on with a cord like
// what the jar is tied with.
function showDesign() {
  placeDesign();
  tag.dataset.cord = design.cord;
  jarBack.replaceChildren(backLayer.canvas);
  jarFront.replaceChildren(frontLayer.canvas);
  // Each sparkle twinkles on a beat of its own, so they never pulse together.
  sparkleLayer.replaceChildren(
    ...design.sparkles.map(({ x, y, r }, i) => {
      const sparkle = document.createElement("span");
      const dot = r < 3;
      // A star's glow reaches 2.6 times as far as its points.
      const reach = dot ? r : r * 2.6;
      sparkle.className = dot ? "sparkle dot" : "sparkle";
      if (!dot) sparkle.innerHTML = STAR;
      Object.assign(sparkle.style, {
        left: `${x - reach}px`,
        top: `${y - reach}px`,
        width: `${reach * 2}px`,
        height: `${reach * 2}px`,
        animationDuration: `${2.6 + (i % 5) * 0.45}s`,
        animationDelay: `${-i * 0.7}s`,
      });
      return sparkle;
    }),
  );
  if (params.has("edges")) showEdges();
}

// For checking the edges read from the walls picture: the inner wall and the outside, over the
// art.
function showEdges() {
  const points = (list: Point[]) => list.map((p) => `${p.x},${p.y}`).join(" ");
  jarFront.insertAdjacentHTML(
    "beforeend",
    `<svg viewBox="0 0 ${design.width} ${design.height}" style="position: absolute; left: 0; top: 0" aria-hidden="true">
      <polyline points="${points(design.outline)}" fill="none" stroke="#84cc16" stroke-width="1.5"/>
      <polygon points="${points(design.outside)}" fill="none" stroke="#22d3ee" stroke-width="1.5"/>
    </svg>`,
  );
}

// Puts the jar in the middle of the stage, each bubble's tail on the jar, the tag's knot where its
// bow is, and the total under where it stands.
function placeDesign() {
  const box = placement(design, stageWidth);
  const ground = Math.max(...design.outside.map((p) => p.y));
  const root = document.documentElement.style;
  root.setProperty("--stage-width", `${stageWidth}px`);
  root.setProperty("--jar-x", `${box.x}px`);
  root.setProperty("--jar-y", `${box.y}px`);
  root.setProperty("--jar-width", `${box.width}px`);
  root.setProperty("--jar-height", `${box.height}px`);
  root.setProperty("--tag-x", `${box.x + design.tag.x}px`);
  root.setProperty("--tag-y", `${box.y + design.tag.y}px`);
  root.setProperty("--ground-y", `${box.y + ground}px`);
  for (const { el, anchor } of bubbles) {
    el.style.setProperty("--tip-x", `${box.x + anchor.x}px`);
    el.style.setProperty("--tip-y", `${box.y + anchor.y}px`);
  }
}

// The main color's tones, lighter where the light falls and darker below, and its glow, for the
// CSS. The jar's pictures are repainted in it too, once.
function showColors() {
  const main = parseColor(accent) ?? [244, 63, 94];
  const tones = {
    "--accent": css(main),
    "--accent-light": css(mix(main, [255, 255, 255], 0.35)),
    "--accent-deep": css(mix(main, [0, 0, 0], 0.25)),
    "--accent-glow": css(main, 0.55),
  };
  const root = document.documentElement.style;
  for (const [property, value] of Object.entries(tones)) {
    root.setProperty(property, value);
  }
  backLayer.paint(main);
  frontLayer.paint(main);
}

// "#rrggbb", or "#rrggbbaa" with its alpha ignored.
function parseColor(color: string): RGB | null {
  const match = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(color.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
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
    placeDesign();
  }
  jar.resize(scale, devicePixelRatio, stageWidth);
}

function handleGift(data: GiftData) {
  const gifting = tally.add(data.user, data.gift);
  if (!gifting) return;
  // The jar sat unused for the reset time, so it starts empty.
  if (gifting.reset) {
    jar.clear();
    hideBubbles();
  }
  for (const drop of gifting.drops) jar.drop(drop);

  if (showBubbles) showBubble(gifting);
  renderTag();
  renderTotal();
  scheduleSave();
}

// One bubble for each place the jar has for one, in place of the last jar's.
function makeBubbles(): Bubble[] {
  bubbleList.replaceChildren();
  return [
    ...design.bubbles.left.map((anchor) => makeBubble("left", anchor)),
    ...design.bubbles.right.map((anchor) => makeBubble("right", anchor)),
  ];
}

// One element for a bubble place, hidden until a gift takes it.
function makeBubble(side: Side, anchor: Point): Bubble {
  const el = bubbleTemplate.content.firstElementChild?.cloneNode(true);
  if (!(el instanceof HTMLElement)) {
    throw new Error("#bubble-template is empty.");
  }
  el.classList.add(side);
  bubbleList.append(el);
  const gift = within(el, ".gift", HTMLImageElement);
  // A gift picture that doesn't load shows the drawn box.
  gift.addEventListener("error", () => {
    if (gift.src !== GIFT_BOX) gift.src = GIFT_BOX;
  });
  return {
    el,
    photo: within(el, ".photo", HTMLElement),
    name: within(el, ".name", HTMLElement),
    gift,
    coins: within(el, ".coins", HTMLElement),
    side,
    anchor,
    key: "",
    picture: "",
    shownAt: 0,
    timer: undefined,
  };
}

// A gift's bubble. A streak that's already in one updates it in place, with its coins as they are
// now. A new streak takes a hidden bubble on the side with fewer showing, at random, and with
// every bubble showing, the one filled in longest ago.
function showBubble(gifting: Gifting) {
  const showing = bubbles.find((b) => b.key === gifting.key);
  const bubble = showing ?? pickBubble();
  if (!showing) lastSide = bubble.side;

  bubble.key = gifting.key;
  bubble.shownAt = performance.now();
  bubble.name.textContent = gifting.gifter.name;
  bubble.coins.textContent = gifting.coins.toLocaleString();
  const image = gifting.gift.image || GIFT_BOX;
  if (bubble.gift.getAttribute("src") !== image) bubble.gift.src = image;
  if (bubble.picture !== gifting.gifter.picture) {
    bubble.picture = gifting.gifter.picture;
    setPicture(bubble.photo, bubble.picture);
  }
  bubble.el.classList.add("visible");
  if (!showing && !reduceMotion.matches) {
    bubble.el.animate(
      [
        { transform: "scale(0.92)", opacity: 0 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: 200, easing: "ease-out" },
    );
  }
  clearTimeout(bubble.timer);
  bubble.timer = setTimeout(() => hideBubble(bubble), bubbleMs);
}

function pickBubble(): Bubble {
  const showing = (side: Side) =>
    bubbles.filter((b) => b.side === side && b.key).length;
  const hidden = (side: Side) =>
    bubbles.filter((b) => b.side === side && !b.key);
  const left = showing("left");
  const right = showing("right");
  let side: Side;
  if (left !== right) side = left < right ? "left" : "right";
  else side = lastSide === "left" ? "right" : "left";
  const other: Side = side === "left" ? "right" : "left";

  const free = hidden(side).length > 0 ? hidden(side) : hidden(other);
  if (free.length > 0) return free[randomInt(0, free.length - 1)];
  return bubbles.reduce((oldest, b) =>
    b.shownAt < oldest.shownAt ? b : oldest,
  );
}

function hideBubble(bubble: Bubble) {
  clearTimeout(bubble.timer);
  bubble.key = "";
  bubble.el.classList.remove("visible");
}

function hideBubbles() {
  for (const bubble of bubbles) hideBubble(bubble);
}

// The tag shows the gifter with the most coins. When someone else takes the lead it swings once,
// around the knot it hangs from.
function renderTag() {
  const leader = showTopGifter ? tally.top(1)[0] : undefined;
  tag.hidden = !leader;
  if (!leader) {
    tagHandle = "";
    tagPicture = null;
    return;
  }
  tagName.textContent = leader.name;
  if (tagPicture !== leader.picture) {
    tagPicture = leader.picture;
    setPicture(tagPhoto, leader.picture);
  }
  const swing = tagHandle !== "" && tagHandle !== leader.handle;
  tagHandle = leader.handle;
  if (swing && !reduceMotion.matches) {
    const turn = (degrees: number) => ({
      transform: `rotate(${TAG_REST + degrees}deg)`,
    });
    tag.animate([turn(0), turn(12), turn(-8), turn(4), turn(0)], {
      duration: 900,
      easing: "ease-out",
    });
  }
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
  return within(document, `#${id}`, type);
}

function within<T extends Element>(
  root: ParentNode,
  selector: string,
  type: new () => T,
): T {
  const el = root.querySelector(selector);
  if (!(el instanceof type)) throw new Error(`${selector} is missing.`);
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
