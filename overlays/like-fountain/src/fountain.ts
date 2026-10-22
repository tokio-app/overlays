import type { UserData } from "@tokioapp/overlay";

/** Where the hearts rise from: the values of the `origin` setting. */
export const ORIGINS = ["right", "left", "middle", "sides", "all"] as const;
export type Origin = (typeof ORIGINS)[number];

export function isOrigin(value: unknown): value is Origin {
  return ORIGINS.some((origin) => origin === value);
}

export interface FountainOptions {
  origin: Origin;
  /** A heart's width, in px. */
  size: number;
  /** Whether a viewer's profile picture rises with their hearts. */
  pictures: boolean;
  /** Each heart takes one of the two. */
  colors: [string, string];
}

// Where one like's hearts rise: a column at a side or in the middle, or anywhere along the bottom.
type Lane = "right" | "left" | "middle" | "all";

interface Floater {
  sprite: HTMLCanvasElement;
  /** The sprite's size, in px. */
  width: number;
  height: number;
  born: number;
  /** How long it takes to rise, in ms. */
  life: number;
  x: number;
  drift: number;
  sway: number;
  waves: number;
  phase: number;
  tilt: number;
  /** Set for a viewer's picture. */
  picture?: Picture;
}

interface QueuedHeart {
  lane: Lane;
  due: number;
  color: number;
}

interface WaitingPicture {
  lane: Lane;
  due: number;
  picture: Picture;
}

interface Picture {
  img: HTMLImageElement;
  status: "loading" | "loaded" | "failed";
  sprite?: HTMLCanvasElement;
}

// TikTok sends a viewer's taps in batches, after a short while or every 15 taps.
const MAX_BATCH = 15;
// A batch's hearts rise one after another over about this long, as they were tapped.
const BATCH_MS = 900;
// How many hearts may start rising each second: a column gets one for each heart that fits up the
// page, and All along the bottom one for every ten that fit on it. Likes over it are dropped, so a
// busy LIVE keeps a steady fountain that looks the same at any size. Pictures get a sixth of it.
const COLUMN_RATE = 1;
const ALL_RATE = 0.1;
// Bounds for very small or very big hearts, the upper one so a big page stays cheap to draw.
const MIN_RATE = 4;
const MAX_RATE = 150;
// Faces smaller than this are hard to make out, so pictures stay at least this wide.
const MIN_PICTURE = 32;
// A heart that couldn't rise for this long is dropped, so a hidden page doesn't burst on waking.
const MAX_LATE_MS = 1000;
// A picture still loading this long after its hearts is skipped.
const PICTURE_WAIT_MS = 2000;
const RISE_MS = { min: 3400, max: 4600 };
// Hearts pop up to full size over this much of the rise, and fade out from this far up.
const POP = 0.08;
const FADE_FROM = 0.45;
// Hearts are small, so sharper canvases would only cost memory.
const MAX_PIXEL_RATIO = 2;

// The heart's path, and its box in the path's units.
const HEART = new Path2D(
  "M12 21s-9-6.5-9-12.2C3 5.6 5.4 3.5 8 3.5c1.8 0 3.2 1 4 2.5.8-1.5 2.2-2.5 4-2.5 2.6 0 5 2.1 5 5.3C21 14.5 12 21 12 21z",
);
const HEART_BOX = { x: 3, y: 3.5, width: 18, height: 17.5 };

// Kept so a viewer who likes again doesn't load their picture again. The oldest go first.
const MAX_PICTURES = 100;
// A picture that takes longer is skipped.
const LOAD_TIMEOUT_MS = 4000;
const pictures = new Map<string, Picture>();

/**
 * Hearts rising from the bottom of the page, one for each like, with the viewer's picture.
 *
 * Everything is drawn on one canvas, from sprites drawn once. The frame loop only runs while
 * something is rising or waiting to, so an idle page costs nothing.
 */
export class Fountain {
  options: FountainOptions = {
    origin: "middle",
    size: 48,
    pictures: true,
    colors: ["#ff1f2f", "#22e632"],
  };
  private _ctx: CanvasRenderingContext2D;
  private _width = 0;
  private _height = 0;
  private _ratio = 1;
  private _sprites: HTMLCanvasElement[] = [];
  private _hearts: Floater[] = [];
  private _pictures: Floater[] = [];
  private _queue: QueuedHeart[] = [];
  private _waiting: WaitingPicture[] = [];
  private _heartBudget = new Budget();
  private _pictureBudget = new Budget();
  private _running = false;

  constructor(private _canvas: HTMLCanvasElement) {
    this._ctx = context(_canvas);
    this.drawSprites();
  }

  /** New settings apply to the hearts that rise from now on. */
  setOptions(options: FountainOptions) {
    this.options = options;
    this.drawSprites();
  }

  resize(width: number, height: number, devicePixelRatio: number) {
    const ratio = Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
    this._width = width;
    this._height = height;
    this._canvas.width = Math.round(width * ratio);
    this._canvas.height = Math.round(height * ratio);
    if (ratio !== this._ratio) {
      this._ratio = ratio;
      this.drawSprites();
    }
  }

  /** A viewer's batch of `likes` taps: that many hearts, up to 15, and their picture. */
  add(user: UserData, likes: number, now = performance.now()) {
    const { origin, size } = this.options;
    const lane: Lane =
      origin === "sides" ? (Math.random() < 0.5 ? "left" : "right") : origin;
    const fit = this._height / size;
    const rate = clamp(
      origin === "all"
        ? ALL_RATE * fit * (this._width / size)
        : (origin === "sides" ? 2 : 1) * COLUMN_RATE * fit,
      MIN_RATE,
      MAX_RATE,
    );

    // A hidden page gets no frames to rise what's waiting, so likes would pile up until it shows.
    prune(this._queue, ({ due }) => now - due < MAX_LATE_MS);
    prune(this._waiting, ({ due }) => now - due <= PICTURE_WAIT_MS);

    const wanted = Math.max(1, Math.min(MAX_BATCH, Math.floor(likes) || 1));
    const count = this._heartBudget.take(wanted, rate, now);
    for (let i = 0; i < count; i++) {
      this._queue.push({
        lane,
        due: now + (i * BATCH_MS) / count,
        color: Math.random() < 0.5 ? 0 : 1,
      });
    }

    const url = user.profilePictures[0];
    if (this.options.pictures && url) {
      const picture = loadPicture(url);
      // One of each viewer at a time, so a fast tapper doesn't fill the fountain with their face.
      const shown =
        this._waiting.some((waiting) => waiting.picture === picture) ||
        this._pictures.some((floater) => floater.picture === picture);
      if (!shown && this._pictureBudget.take(1, rate / 6, now)) {
        this._waiting.push({ lane, due: now, picture });
      }
    }
    this.wake();
  }

  private wake() {
    if (this._running) return;
    this._running = true;
    requestAnimationFrame(this._tick);
  }

  private _tick = (now: number) => {
    this.frame(now);
    const busy =
      this._hearts.length ||
      this._pictures.length ||
      this._queue.length ||
      this._waiting.length;
    if (busy) requestAnimationFrame(this._tick);
    else this._running = false;
  };

  private frame(now: number) {
    prune(this._queue, (heart) => {
      if (heart.due > now) return true;
      if (now - heart.due < MAX_LATE_MS) {
        const sprite = this._sprites[heart.color];
        this._hearts.push(this.float(sprite, heart.lane, now, true));
      }
      return false;
    });
    prune(this._waiting, ({ lane, due, picture }) => {
      if (due > now) return true;
      if (now - due > PICTURE_WAIT_MS) return false;
      if (picture.status === "loading") return true;
      const sprite = picture.status === "loaded" && this.pictureSprite(picture);
      if (sprite) {
        this._pictures.push({
          ...this.float(sprite, lane, now, false),
          picture,
        });
      }
      return false;
    });

    const ctx = this._ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    const draw = (floater: Floater) => this.draw(floater, now);
    prune(this._hearts, draw);
    // Over the hearts, so the faces show.
    prune(this._pictures, draw);
    ctx.globalAlpha = 1;
  }

  // Starts a heart or a picture rising from its lane.
  private float(
    sprite: HTMLCanvasElement,
    lane: Lane,
    now: number,
    tilts: boolean,
  ): Floater {
    const { size } = this.options;
    const width = this._width;
    let x: number;
    let drift: number;
    // The columns fan out as they rise, those at the sides toward the middle.
    if (lane === "middle") {
      x = width / 2 + random(-0.5, 0.5) * size;
      drift = random(-3.5, 3.5) * size;
    } else if (lane === "right") {
      x = width - 1.5 * size + random(-0.5, 0.5) * size;
      drift = random(-3, 0) * size;
    } else if (lane === "left") {
      x = 1.5 * size + random(-0.5, 0.5) * size;
      drift = random(0, 3) * size;
    } else {
      x = random(size, width - size);
      drift = random(-0.5, 0.5) * size;
    }
    return {
      sprite,
      width: sprite.width / this._ratio,
      height: sprite.height / this._ratio,
      born: now,
      life: random(RISE_MS.min, RISE_MS.max),
      x,
      drift,
      sway: random(0.15, 0.4) * size,
      waves: random(0.8, 1.6),
      phase: random(0, 2 * Math.PI),
      tilt: tilts ? 0.2 : 0,
    };
  }

  // Draws a floater where it is at `now`. Returns false once it has risen.
  private draw(floater: Floater, now: number): boolean {
    const progress = (now - floater.born) / floater.life;
    if (progress >= 1) return false;

    const { width, height } = floater;
    const wave = floater.phase + 2 * Math.PI * floater.waves * progress;
    const spread = 1 - (1 - progress) ** 2;
    const x = clamp(
      floater.x + floater.drift * spread + floater.sway * Math.sin(wave),
      width / 2,
      this._width - width / 2,
    );
    const bottom = this._height - height / 2;
    const y = bottom - (bottom - height / 2) * progress;
    const scale = progress < POP ? 0.3 + 0.7 * easeOutBack(progress / POP) : 1;
    // Leans the way it sways.
    const angle = floater.tilt * Math.cos(wave);

    const ratio = this._ratio * scale;
    const cos = Math.cos(angle) * ratio;
    const sin = Math.sin(angle) * ratio;
    const ctx = this._ctx;
    ctx.globalAlpha =
      progress < FADE_FROM ? 1 : (1 - progress) / (1 - FADE_FROM);
    ctx.setTransform(cos, sin, -sin, cos, x * this._ratio, y * this._ratio);
    ctx.drawImage(floater.sprite, -width / 2, -height / 2, width, height);
    return true;
  }

  private drawSprites() {
    this._sprites = this.options.colors.map((color) => this.heartSprite(color));
  }

  // A heart `size` px wide, with a soft shine on its left lobe.
  private heartSprite(color: string): HTMLCanvasElement {
    const scale = (this.options.size / HEART_BOX.width) * this._ratio;
    // Room for the edges' antialiasing.
    const pad = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(HEART_BOX.width * scale) + 2 * pad;
    canvas.height = Math.ceil(HEART_BOX.height * scale) + 2 * pad;
    const ctx = context(canvas);
    ctx.setTransform(
      scale,
      0,
      0,
      scale,
      pad - HEART_BOX.x * scale,
      pad - HEART_BOX.y * scale,
    );
    ctx.fillStyle = color;
    ctx.fill(HEART);
    ctx.fillStyle = "rgb(255 255 255 / 0.3)";
    ctx.beginPath();
    ctx.ellipse(7.4, 7.6, 2, 1.25, -0.7, 0, 2 * Math.PI);
    ctx.fill();
    return canvas;
  }

  // The picture cut round, as wide as a heart or MIN_PICTURE, with a white ring. Drawn again when
  // the size changes. False when the picture has no size.
  private pictureSprite(picture: Picture): HTMLCanvasElement | false {
    const { img } = picture;
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) return false;
    const diameter = Math.round(
      Math.max(this.options.size, MIN_PICTURE) * this._ratio,
    );
    // Room for the ring's antialiasing.
    const pad = 1;
    if (picture.sprite?.width === diameter + 2 * pad) return picture.sprite;

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = diameter + 2 * pad;
    const ctx = context(canvas);
    const ring = Math.max(1, diameter * 0.06);
    const center = diameter / 2 + pad;
    ctx.beginPath();
    ctx.arc(center, center, (diameter - ring) / 2, 0, 2 * Math.PI);
    ctx.save();
    ctx.clip();
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      pad,
      pad,
      diameter,
      diameter,
    );
    ctx.restore();
    ctx.lineWidth = ring;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    picture.sprite = canvas;
    return canvas;
  }
}

// The picture at `url`, loading it the first time.
function loadPicture(url: string): Picture {
  const known = pictures.get(url);
  if (known) return known;

  const img = new Image();
  const picture: Picture = { img, status: "loading" };
  pictures.set(url, picture);
  if (pictures.size > MAX_PICTURES) {
    const oldest = pictures.keys().next().value;
    if (oldest !== undefined) pictures.delete(oldest);
  }

  const settle = (status: Picture["status"]) => {
    if (picture.status === "loading") picture.status = status;
  };
  img.decoding = "async";
  // TikTok's image servers can refuse requests that name another site.
  img.referrerPolicy = "no-referrer";
  img.addEventListener("load", () => settle("loaded"), { once: true });
  img.addEventListener("error", () => settle("failed"), { once: true });
  setTimeout(() => settle("failed"), LOAD_TIMEOUT_MS);
  img.src = url;
  return picture;
}

// Lets through up to `rate` a second, and at most a second's worth at once.
class Budget {
  private _left = 0;
  private _at = -Infinity;

  /** How many of `wanted` may go now. */
  take(wanted: number, rate: number, now: number): number {
    this._left = Math.min(rate, this._left + ((now - this._at) / 1000) * rate);
    this._at = now;
    const taken = Math.min(wanted, Math.floor(this._left));
    this._left -= taken;
    return taken;
  }
}

// Keeps the items `keep` returns true for, in order, without making a new array each frame.
function prune<T>(list: T[], keep: (item: T) => boolean) {
  let kept = 0;
  for (const item of list) if (keep(item)) list[kept++] = item;
  list.length = kept;
}

// Rises past 1 and settles back, for the pop as a heart appears.
function easeOutBack(t: number): number {
  const overshoot = 1.70158;
  return 1 + (overshoot + 1) * (t - 1) ** 3 + overshoot * (t - 1) ** 2;
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't draw the hearts.");
  return ctx;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function random(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
