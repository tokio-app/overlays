import { entrance, leaving, play } from "@tokio-overlays/shared/entrances";
import { SAMPLE_USERS } from "@tokio-overlays/shared/samples";
import { tokio, TOKIO_EVENTS, type Fan } from "@tokioapp/overlay";
import { DEFAULTS, readSettings } from "./config";
import { HEART, SPARK } from "./icons";
import "./style.css";

type Timer = ReturnType<typeof setTimeout> | undefined;

// Where the Super Fan sparkles twinkle around the banner, in % of its width and height, and their
// size in rem.
const TWINKLES = [
  [10, -40, 0.9],
  [34, 140, 0.7],
  [55, -46, 1.1],
  [80, 138, 0.8],
  [97, -34, 0.95],
  [104, 60, 0.7],
];

const stage = document.getElementById("stage")!;
const banner = document.getElementById("banner")!;
const nameText = document.getElementById("name")!;
const label = document.getElementById("label")!;
const levelText = document.getElementById("level")!;
const badge = document.getElementById("badge")!;
const band = document.getElementById("band")!;
document.getElementById("spark")!.innerHTML = SPARK;
const twinkles = TWINKLES.map(([x, y, size]) => {
  const twinkle = document.createElement("span");
  twinkle.className = "twinkle";
  twinkle.innerHTML = SPARK;
  Object.assign(twinkle.style, {
    left: `${x}%`,
    top: `${y}%`,
    width: `${size}rem`,
    height: `${size}rem`,
    margin: `${-size / 2}rem`,
  });
  document.getElementById("twinkles")!.append(twinkle);
  return twinkle;
});

const params = new URLSearchParams(location.search);
// Tokio fills in the ID. While developing, open the page with ?id=<test ID>, made on Tokio's
// Tools page, or ?demo for sample fans.
const overlayId = window.__OVERLAY_ID__ || params.get("id") || "";
// Tokio's Overlays page previews the overlay in an iframe with this name. Tokio sends its fans
// there only with Test, so the preview, like ?demo, starts with sample fans.
const preview = window.name === `TOKIO_APP-${overlayId}`;
const demo = preview || params.has("demo");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
// The pause between one fan leaving and the next coming in.
const GAP_MS = 300;
// The overlay's own font, and its heaviest face for the level. Windows has that as a family of
// its own.
const OWN_FONT = "system-ui, sans-serif";
const HEAVY_FONT = '"Segoe UI Black", system-ui, sans-serif';
// The wipe's corners: the banner's round ends.
const ROUND = "999px";

let settings = readSettings(window.__OVERLAY_CONFIG__, DEFAULTS);
// Tokio's fans, the highest level first: up to 100, sent as the overlay connects and when they
// change.
let fans: Fan[] = demo ? sampleFans() : [];
// The fan on the banner, null while it's hidden or between two fans.
let showing: Fan | null = null;
// The last fan who showed, so the turns carry on after them.
let lastId = "";
// From one fan leaving until the next one comes in.
let switching = false;
// The fan's time on the banner, or the pause before the next one.
let timer: Timer;
// The badge picture on the banner, so the same one isn't loaded again.
let badgeUrl: string | null = null;
// Bumped for each picture, so one that loads late can't replace a newer one.
let badgeToken = 0;

applySettings();
refresh();

// Sent when the streamer saves the overlay's settings. The preview gets one on every edit.
tokio.on(TOKIO_EVENTS.CONFIG, (config) => {
  settings = readSettings(config, settings);
  applySettings();
  refresh();
});

tokio.on(TOKIO_EVENTS.FANS, (data) => {
  fans = data.fans;
  refresh();
});

tokio.connect(overlayId);

/**
 * After new fans or settings: the turns start, the fan on the banner shows what's newest about
 * them, or the next one comes in now when they no longer take turns.
 */
function refresh() {
  // The next fan is picked after the pause.
  if (switching) return;
  const latest = fans.find((fan) => fan.userId === showing?.userId);
  if (latest && takesTurns(latest)) put(latest);
  else advance();
}

// Fans at the lowest level or above take turns, only Super Fans when the streamer picks that.
function takesTurns(fan: Fan) {
  return (
    fan.fanLevel >= settings.minLevel &&
    (fan.superfan || !settings.superfansOnly)
  );
}

/** The next fan's turn. The only fan who shows stays, and the banner hides when no one shows. */
function advance() {
  clearTimeout(timer);
  timer = undefined;
  const next = nextFan();
  if (!showing) {
    if (next) enter(next);
    return;
  }
  if (next?.userId === showing.userId) {
    put(next);
    timer = setTimeout(advance, settings.seconds * 1000);
    return;
  }
  // The fan leaves, and after the pause whoever is next by then comes in.
  switching = true;
  const exit = play(banner, leaving(settings, ROUND), "forwards");
  exit.addEventListener(
    "finish",
    () => {
      banner.hidden = true;
      exit.cancel();
      showing = null;
      timer = setTimeout(() => {
        switching = false;
        advance();
      }, GAP_MS);
    },
    { once: true },
  );
}

/** The fan after the last one who showed, in Tokio's order, and the first again after the last. */
function nextFan(): Fan | undefined {
  const shown = fans.filter(takesTurns);
  if (shown.length === 0) return undefined;
  const at = shown.findIndex((fan) => fan.userId === lastId);
  return shown[(at + 1) % shown.length];
}

function enter(fan: Fan) {
  showing = fan;
  lastId = fan.userId;
  paint(fan);
  banner.hidden = false;
  const motion = entrance(settings, ROUND);
  play(banner, motion);
  if (fan.superfan) celebrate(motion.duration);
  timer = setTimeout(advance, settings.seconds * 1000);
}

/** The fan on the banner, with what's newest about them. */
function put(fan: Fan) {
  const turnedSuper = fan.superfan && !showing?.superfan;
  showing = fan;
  paint(fan);
  if (turnedSuper) celebrate(0);
}

/** A Super Fan's effect once they're in. The pulsing glow is in style.css. */
function celebrate(delay: number) {
  if (reduceMotion.matches) return;
  if (settings.superfanEffect === "sweep") {
    band.animate(
      [{ transform: "translateX(-100%)" }, { transform: "translateX(260%)" }],
      { duration: 1000, delay, easing: "ease-in-out" },
    );
  } else if (settings.superfanEffect === "sparkles") {
    twinkles.forEach((twinkle, i) =>
      twinkle.animate(
        [
          { opacity: 0, transform: "scale(0) rotate(0deg)" },
          { opacity: 1, transform: "scale(1) rotate(45deg)", offset: 0.4 },
          { opacity: 0, transform: "scale(0) rotate(90deg)" },
        ],
        { duration: 900, delay: delay + i * 90, easing: "ease-out" },
      ),
    );
  }
}

function paint(fan: Fan) {
  banner.classList.toggle("superfan", fan.superfan);
  // A fan without a name shows their @handle.
  nameText.textContent =
    settings.shownName === "handle" || !fan.username
      ? `@${fan.handle}`
      : fan.username;
  levelText.textContent = fan.fanLevel.toLocaleString();
  setBadge(fan.fanBadge);
}

// The slot keeps its width while the picture loads, so nothing moves when it shows up.
function setBadge(url: string) {
  if (url === badgeUrl) return;
  badgeUrl = url;
  const token = ++badgeToken;
  badge.replaceChildren();
  if (!url) {
    badge.innerHTML = HEART;
    return;
  }
  const img = new Image();
  img.alt = "";
  img.decoding = "async";
  // TikTok's image servers can refuse requests that name another site.
  img.referrerPolicy = "no-referrer";
  img.addEventListener("load", () => {
    if (token === badgeToken) badge.replaceChildren(img);
  });
  img.addEventListener("error", () => {
    if (token === badgeToken) badge.innerHTML = HEART;
  });
  img.src = url;
}

function applySettings() {
  const s = settings;
  const root = document.documentElement.style;
  root.setProperty("--scale", String(s.size / 100));
  const own = s.font ? `${JSON.stringify(s.font)}, ` : "";
  root.setProperty("--font", own + OWN_FONT);
  root.setProperty("--font-heavy", own + HEAVY_FONT);
  root.setProperty("--banner", s.bannerColor);
  root.setProperty("--name", s.nameColor);
  root.setProperty("--level", s.levelColor);
  root.setProperty("--super", s.superfanColor);
  // Mixed here because older OBS browsers lack color-mix().
  root.setProperty("--super-glow", withAlpha(s.superfanColor, 0.55));
  stage.dataset.align = s.align;
  stage.dataset.effect = s.superfanEffect;
  label.textContent = s.label;
  label.hidden = !s.label;
}

function withAlpha(hex: string, alpha: number) {
  const [r, g, b, a = 255] = (hex.slice(1).match(/../g) ?? []).map((pair) =>
    parseInt(pair, 16),
  );
  return `rgba(${r}, ${g}, ${b}, ${((a / 255) * alpha).toFixed(3)})`;
}

// Eight fans from level 48 down to 2, in Tokio's order, the second, fifth and eighth Super Fans.
function sampleFans(): Fan[] {
  const levels = [48, 41, 35, 27, 19, 12, 6, 2];
  return SAMPLE_USERS.map(({ username, handle }, i) => ({
    userId: `sample-${i}`,
    username,
    // Tokio sends a fan's handle without its @.
    handle: handle.slice(1),
    fanLevel: levels[i],
    fanBadge: "",
    superfan: i % 3 === 1,
    seenAt: 0,
  }));
}
