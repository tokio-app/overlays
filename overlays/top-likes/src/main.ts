import {
  tokio,
  TOKIO_EVENTS,
  type ConfigData,
  type UserData,
} from "@tokioapp/overlay";
import { CROWN, HEART, medal, PLACEHOLDER } from "./icons";
import { Ranking, type Viewer } from "./ranking";
import "./style.css";

interface Row {
  el: HTMLLIElement;
  rank: HTMLDivElement;
  photo: HTMLDivElement;
  name: HTMLSpanElement;
  heart: HTMLSpanElement;
  count: HTMLSpanElement;
  position: number;
  likes: number;
  picture: string | null;
}

const list = document.getElementById("ranking")!;
const total = document.getElementById("total")!;
const totalCount = document.getElementById("total-count")!;
const totalLabel = document.getElementById("total-label")!;
total.querySelector(".heart")!.innerHTML = HEART;
const params = new URLSearchParams(location.search);
// Tokio fills in the ID. While developing, open the page with ?id=<test ID>, made on Tokio's
// Tools page, or with ?demo for the sample viewers. Tokio's Test button makes up a new viewer for
// every event, so only the samples (or a real LIVE) show a viewer's likes adding up.
const overlayId = window.__OVERLAY_ID__ || params.get("id") || "";
// Tokio's Overlays page previews the overlay in an iframe with this name. There, and with ?demo,
// sample viewers keep liking until the first real like, so the preview doesn't sit empty.
const preview = window.name === `TOKIO_APP-${overlayId}`;
const demo = preview || params.has("demo");
const storageKey = `top-likes:${overlayId}`;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

const SAMPLE_USERS: UserData[] = [
  "Sunny Fox",
  "Pixel Panda",
  "Lucky Tiger",
  "Cosmic Owl",
  "Happy Koala",
  "Neon Wolf",
  "Chill Otter",
  "Brave Lynx",
].map((name, i) => ({
  username: name,
  handle: `@${name.toLowerCase().replace(" ", "_")}`,
  // Placeholders show instead when offline.
  profilePictures: [`https://picsum.photos/seed/tokio${i + 1}/200/200`],
}));

let maxUsers = 3;
let resetMs = hours(6);
let showTotal = true;
applyConfig(window.__OVERLAY_CONFIG__);

// Kept across reloads, since streaming apps reload overlays when scenes change.
let ranking = demo ? sampleRanking() : Ranking.restore(load(), resetMs);
const rows = new Map<string, Row>();
let frame = 0;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

render();
let stopSample = demo ? playSample() : undefined;

// Sent when the streamer saves the overlay's settings.
tokio.on(TOKIO_EVENTS.CONFIG, (config) => {
  applyConfig(config);
  ranking.resetMs = resetMs;
  scheduleRender();
});

tokio.on(TOKIO_EVENTS.LIKE, (data) => {
  // The first like replaces the sample viewers.
  if (stopSample) {
    stopSample();
    stopSample = undefined;
    ranking = new Ranking(resetMs);
    scheduleRender();
  }
  if (!ranking.add(data.user, data.likeCount, data.totalLikes)) return;
  scheduleRender();
  scheduleSave();
});

tokio.connect(overlayId);

// The keys are the field ids in config.yaml.
function applyConfig(config: ConfigData) {
  if (typeof config.max_users === "number") maxUsers = config.max_users;
  if (typeof config.reset_hours === "number") {
    resetMs = hours(config.reset_hours);
  }
  list.classList.toggle("no-crown", config.show_crown === false);
  showTotal = config.show_total !== false;
  if (typeof config.total_label === "string") {
    totalLabel.textContent = config.total_label;
  }

  const colors = {
    "--name-color": config.name_color,
    "--count-color": config.count_color,
    "--heart-color": config.heart_color,
  };
  for (const [property, value] of Object.entries(colors)) {
    if (typeof value === "string") {
      document.documentElement.style.setProperty(property, value);
    }
  }
}

// Likes come in bursts, so the list is drawn at most once a frame.
function scheduleRender() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    render();
  });
}

function render() {
  // Hidden until a LIKE event reports the total.
  total.hidden = !showTotal || ranking.total === 0;
  totalCount.textContent = ranking.total.toLocaleString();

  const top = ranking.top(maxUsers);
  const before = new Map(
    [...rows].map(([handle, row]) => [
      handle,
      row.el.getBoundingClientRect().top,
    ]),
  );

  const shown = new Set(top.map((viewer) => viewer.handle));
  for (const [handle, row] of rows) {
    if (shown.has(handle)) continue;
    row.el.remove();
    rows.delete(handle);
  }

  top.forEach((viewer, i) => {
    let row = rows.get(viewer.handle);
    if (!row) {
      row = createRow();
      rows.set(viewer.handle, row);
    }
    updateRow(row, viewer, i + 1);
    // Appending in order moves each row to its place.
    list.append(row.el);
  });

  if (!reduceMotion.matches) animateMoves(before);
}

function createRow(): Row {
  const el = document.createElement("li");
  el.className = "viewer";

  const rank = document.createElement("div");
  rank.className = "rank";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  const crown = document.createElement("span");
  crown.className = "crown";
  crown.innerHTML = CROWN;
  const photo = document.createElement("div");
  photo.className = "photo";
  avatar.append(crown, photo);

  const info = document.createElement("div");
  info.className = "info";
  const name = document.createElement("span");
  name.className = "name";
  const likes = document.createElement("span");
  likes.className = "likes";
  const heart = document.createElement("span");
  heart.className = "heart";
  heart.innerHTML = HEART;
  const count = document.createElement("span");
  likes.append(heart, count);
  info.append(name, likes);

  el.append(rank, avatar, info);
  return {
    el,
    rank,
    photo,
    name,
    heart,
    count,
    position: 0,
    likes: 0,
    picture: null,
  };
}

function updateRow(row: Row, viewer: Viewer, position: number) {
  if (row.position !== position) {
    row.position = position;
    row.el.dataset.rank = String(position);
    if (position === 1 || position === 2 || position === 3) {
      row.rank.innerHTML = medal(position);
    } else {
      row.rank.textContent = `${position}.`;
    }
  }

  if (row.picture !== viewer.picture) {
    row.picture = viewer.picture;
    setPicture(row.photo, viewer.picture);
  }

  row.name.textContent = viewer.name;
  if (row.likes !== viewer.likes) {
    if (row.likes > 0 && !reduceMotion.matches) {
      row.heart.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.3)" },
          { transform: "scale(1)" },
        ],
        { duration: 300, easing: "ease-out" },
      );
    }
    row.likes = viewer.likes;
    row.count.textContent = viewer.likes.toLocaleString();
  }
}

// The placeholder stays under the picture, so it shows while the picture loads or if it fails.
function setPicture(photo: HTMLDivElement, url: string) {
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

// Slides rows from where they were to where they are now, and fades new ones in.
function animateMoves(before: Map<string, number>) {
  for (const [handle, row] of rows) {
    const from = before.get(handle);
    if (from === undefined) {
      row.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
      continue;
    }
    const delta = from - row.el.getBoundingClientRect().top;
    if (delta === 0) continue;
    row.el.animate(
      [{ transform: `translateY(${delta}px)` }, { transform: "none" }],
      { duration: 400, easing: "ease-in-out" },
    );
  }
}

function scheduleSave() {
  if (demo || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    try {
      localStorage.setItem(storageKey, ranking.serialize());
    } catch {
      // Storage can be full or turned off. The ranking still works, it just won't survive a
      // reload.
    }
  }, 1000);
}

function load(): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function hours(value: number) {
  return value * 60 * 60 * 1000;
}

// The sample viewers start 9 likes apart, so they soon trade places.
function sampleRanking() {
  const sample = new Ranking(resetMs);
  SAMPLE_USERS.forEach((user, i) => {
    // The total also counts likes from viewers who aren't shown.
    sample.add(user, (SAMPLE_USERS.length - i) * 9, 4210);
  });
  return sample;
}

// Sample viewers send batches of 1 to 15 likes at uneven times, as on a LIVE. Every few seconds
// one of them starts tapping faster for a while, so they climb past the ones above them and the
// crown changes hands. Returns a function that stops it.
function playSample() {
  let timer: ReturnType<typeof setTimeout>;
  let climber: UserData | undefined;
  let streak = 0;

  const tick = () => {
    if (streak === 0) {
      climber = challenger();
      streak = randomInt(4, 9);
    }
    streak--;

    const user =
      climber && Math.random() < 0.7
        ? climber
        : SAMPLE_USERS[randomInt(0, SAMPLE_USERS.length - 1)];
    const likes = randomInt(1, 15);
    ranking.add(user, likes, ranking.total + likes + randomInt(0, 40));
    scheduleRender();
    timer = setTimeout(tick, randomInt(250, 900));
  };

  timer = setTimeout(tick, 400);
  return () => clearTimeout(timer);
}

// A sample viewer from second place to the first one below the shown rows.
function challenger() {
  const top = ranking.top(maxUsers + 1);
  const viewer = top[randomInt(1, top.length - 1)];
  return SAMPLE_USERS.find((user) => user.handle === viewer?.handle);
}

function randomInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
