// Gift pictures: loading them, the gift box drawn for a picture that doesn't load, and the
// sample gifts for the demo.

export interface GiftPicture {
  img: HTMLImageElement;
  status: "loading" | "loaded" | "failed";
}

// Kept so a gift dropped again doesn't load again. The oldest go first.
const MAX_PICTURES = 200;
// A picture that takes longer is dropped as a box, so a slow one doesn't hold up the others.
const LOAD_TIMEOUT_MS = 4000;

const pictures = new Map<string, GiftPicture>();
const listeners = new Set<() => void>();

/** Calls `listener` whenever a picture finishes loading, so the jar can draw it. */
export function onGiftPicture(listener: () => void) {
  listeners.add(listener);
}

/** The picture at `url`, loading it the first time. An empty url is a failed picture. */
export function loadGiftPicture(url: string): GiftPicture {
  const known = pictures.get(url);
  if (known) return known;

  const img = new Image();
  const picture: GiftPicture = { img, status: url ? "loading" : "failed" };
  pictures.set(url, picture);
  if (pictures.size > MAX_PICTURES) {
    const oldest = pictures.keys().next().value;
    if (oldest !== undefined) pictures.delete(oldest);
  }
  if (!url) return picture;

  const settle = (status: GiftPicture["status"]) => {
    picture.status = status;
    for (const listener of listeners) listener();
  };
  img.decoding = "async";
  // TikTok's image servers can refuse requests that name another site.
  img.referrerPolicy = "no-referrer";
  img.addEventListener("load", () => settle("loaded"), { once: true });
  img.addEventListener("error", () => settle("failed"), { once: true });
  setTimeout(() => {
    if (picture.status === "loading") settle("failed");
  }, LOAD_TIMEOUT_MS);
  img.src = url;
  return picture;
}

/** Whether the picture has loaded or failed, so the gift can drop. */
export function isSettled(url: string): boolean {
  return loadGiftPicture(url).status !== "loading";
}

/** Shown in place of a gift's picture when it doesn't load, or isn't sent. */
export const GIFT_BOX = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <rect x="14" y="44" width="72" height="46" rx="6" fill="#7c4dff"/>
  <rect x="8" y="32" width="84" height="16" rx="5" fill="#9b72ff"/>
  <rect x="43" y="32" width="14" height="58" fill="#ffc93c"/>
  <path d="M50 32C32 8 14 24 32 32zM50 32C68 8 86 24 68 32z" fill="#ffc93c"/>
  <rect x="14" y="44" width="72" height="8" rx="3" fill="rgb(0 0 0 / .12)"/>
</svg>`)}`;

export interface SampleGift {
  id: string;
  name: string;
  coins: number;
  image: string;
  /** How often the demo picks it, against the others. */
  weight: number;
  /** The most gifts in one combo. */
  maxCombo: number;
}

// Real gifts for the demo and the preview. Their pictures load from TikTok's CDN, so offline the
// gift box shows instead. Cheap ones are common and the big one is rare.
export const SAMPLE_GIFTS: SampleGift[] = [
  {
    id: "13651",
    name: "Go Popular",
    coins: 1,
    image:
      "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b342e28d73dac6547e0b3e2ad57f6597.png~tplv-obj.webp",
    weight: 5,
    maxCombo: 8,
  },
  {
    id: "5655",
    name: "Rose",
    coins: 1,
    image:
      "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp",
    weight: 5,
    maxCombo: 8,
  },
  {
    id: "5660",
    name: "Hand Heart",
    coins: 100,
    image:
      "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/374dfe46d5b09ce1db19be06202d34f5.png~tplv-obj.webp",
    weight: 2,
    maxCombo: 3,
  },
  {
    id: "6149",
    name: "Interstellar",
    coins: 10000,
    image:
      "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/8520d47b59c202a4534c1560a355ae06~tplv-obj.webp",
    weight: 0.4,
    maxCombo: 1,
  },
];
