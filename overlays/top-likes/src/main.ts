import { tokio, TOKIO_EVENTS, type ConfigData } from "@tokioapp/overlay";
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
const params = new URLSearchParams(location.search);
// Tokio fills in the ID. While developing, open the page with ?id=<test ID>, made on Tokio's
// Tools page, or with ?demo for sample viewers.
const overlayId = window.__OVERLAY_ID__ || params.get("id") || "";
const demo = params.has("demo");
const storageKey = `top-likes:${overlayId}`;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

let maxUsers = 8;
let resetMs = hours(6);
applyConfig(window.__OVERLAY_CONFIG__);

// Kept across reloads, since streaming apps reload overlays when scenes change.
const ranking = demo ? sampleRanking() : Ranking.restore(load(), resetMs);
const rows = new Map<string, Row>();
let frame = 0;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

render();

// Sent when the streamer saves the overlay's settings.
tokio.on(TOKIO_EVENTS.CONFIG, (config) => {
  applyConfig(config);
  ranking.resetMs = resetMs;
  scheduleRender();
});

tokio.on(TOKIO_EVENTS.LIKE, (data) => {
  if (!ranking.add(data.user, data.likeCount)) return;
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

function sampleRanking() {
  const sample = new Ranking(resetMs);
  const likes = [15005, 10536, 7056, 1533, 830, 125, 90, 42];
  likes.forEach((count, i) => {
    sample.add(
      {
        username: `Example User ${i + 1}`,
        handle: `@example${i + 1}`,
        // Pictures for the top four, placeholders for the rest.
        profilePictures:
          i < 4 ? [`https://picsum.photos/seed/tokio${i + 1}/200/200`] : [],
      },
      count,
    );
  });
  return sample;
}
