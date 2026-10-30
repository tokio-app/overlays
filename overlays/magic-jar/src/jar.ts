import { Bodies, Body, Composite, Engine, Sleeping } from "matter-js";
import { GIFT_BOX, isSettled, loadGiftPicture, onGiftPicture } from "./gifts";
import {
  contains,
  glassWalls,
  placement,
  STAGE,
  walls,
  type JarDesign,
  type Point,
  type Rect,
  type Strip,
} from "./jars";
import type { Drop } from "./tally";

export interface JarOptions {
  /** The most gifts in the jar. */
  maxGifts: number;
  /** A 1-coin gift's diameter in px. Each 10 times the coins doubles it. */
  giftSize: number;
}

interface Piece {
  body: Body;
  drop: Drop;
  diameter: number;
  /** Too wide for the jar, so it rests beside it, outside the glass. */
  beside: boolean;
  /** When it was dropped. */
  since: number;
  /** Steps it was nudged off the heap. */
  nudges: number;
  /** Outside the glass, so drawn over it. Kept up to date while the jar overflows. */
  outside: boolean;
  /** Awake after the last step, so it may still move. */
  awake: boolean;
}

// A gift that was removed, fading out where it was.
interface Ghost {
  drop: Drop;
  diameter: number;
  x: number;
  y: number;
  angle: number;
  since: number;
  /** Outside the glass, so drawn over it. */
  outside: boolean;
}

// Which gifts are too many: all of them, or with overflow off, those in the jar or those beside it.
type Extra = "all" | "jar" | "beside";

type Wall = ReturnType<typeof walls>[number];

// A canvas the gifts are drawn on, and its place on the stage in px.
interface Target {
  ctx: CanvasRenderingContext2D;
  left: number;
  top: number;
}

/**
 * A part of the glass that bends the gifts behind it. Its layers cover only the lens, at whole
 * pixels of the inner canvas, so they're copied without resampling.
 */
interface Lens {
  clip: Path2D;
  strips: Strip[];
  /** The strips' `to` together, in the jar's units. */
  bounds: Rect;
  /** Each strip's `from` in the occupancy grid: first and last column, first and last row. */
  cells: Int32Array;
  /** The bounds' cells. */
  area: Int32Array;
  /** The lenses before it whose strips may reach into it. */
  overlaps: Lens[];
  /** Drawn this frame. */
  drawn: boolean;
  /** Each strip's transform onto the layers and its source on the gifts' canvas, in px. */
  draws: Float64Array;
  /** Where the layers sit on the inner canvas, in px, and the jar's corner on them. */
  x: number;
  y: number;
  originX: number;
  originY: number;
  /** Where the glass shows its bent gifts instead of the gifts behind it. */
  mask: CanvasRenderingContext2D;
  /** How much the glass darkens each strip. */
  shade: CanvasRenderingContext2D;
  /** This frame's bent gifts. */
  bent: CanvasRenderingContext2D;
}

const STEP_MS = 1000 / 60;
// Gifts leave the queue one at a time, so a burst streams in instead of landing on itself.
const RELEASE_MS = 80;
// Up to this many waiting gifts leave RELEASE_MS apart. More leave faster, up to one a frame, so
// a big streak doesn't go on dropping long after it ends.
const STREAM_QUEUE = 10;
const FADE_MS = 400;
// The most steps a gift resting too high over the rim is nudged.
const NUDGE_STEPS = 120;
// About how long a gift takes to drop into the jar.
const LANDING_MS = 1000;
// How fast a gift starts falling, in px a step.
const START_SPEED = 2;
// Gifts outside the jar newer than this stay. With no older ones there, the oldest in the jar go
// instead, so a gift that just landed isn't the first to go.
const SPILL_MS = 10_000;
// A full jar lets its oldest gifts go to make room, but none that dropped in more recently than
// this.
const SINK_MS = 3000;
// The gifts may cover this much of the jar's body. Past it the oldest go, so the pile never
// reaches the neck and blocks the mouth.
const FILL = 0.6;
// When the pile reaches the page's top, the oldest go until this much of it is left, so new gifts
// land where they're seen. That and a full jar's sinking happen at most once per PAGE_SETTLE_MS,
// as the pile takes a while to settle.
const PAGE_ROOM = 0.9;
const PAGE_SETTLE_MS = 3000;
// A reload pours this many rows of gifts at once.
const SETTLE_ROWS = 4;
// How long that pouring may take before the first frame, and then in each frame.
const POUR_FIRST_MS = 50;
// Nothing is drawn meanwhile, so most of a frame can go to it.
const POUR_FRAME_MS = 25;
// Pictures aren't perfect circles, so the bodies are a little smaller than they are.
const BODY_SHRINK = 0.9;
// The biggest gift is as wide as the room beside the jar on the narrowest stage, less this, so it
// still shows whole.
const BESIDE_MARGIN = 10;
// Without overflow, the gifts beside the jar have the room on its sides, from the slump's ceiling
// down to the surface it stands on, packed this full.
const BESIDE_PACK = 0.7;
// With overflow, a reload pours only the newest saved gifts that fit under the slump's ceiling out
// to the stage's sides, packed this full: about what the pile holds live.
const POUR_PACK = 0.85;
// matter-js's default density. Bigger gifts get less, so their weight grows with their width
// rather than their area, and a big one doesn't crush the pile or push gifts through the glass.
const DENSITY = 0.001;
// What collides with what: the gifts and those beside the jar, the jar's inside with its chute, the
// whole glass with the surface the jar stands on, and the stage's sides, which keep the gifts
// beside the jar on the page.
const GIFT = 0x1;
const BESIDE = 0x2;
const INSIDE = 0x4;
const OUTSIDE = 0x8;
const EDGE = 0x10;
// Only pictures show, so the bodies needn't be round: fewer sides collide faster.
const GIFT_SIDES = 12;
// Gift pictures are about 100 to 250 px, so sharper canvases would only cost memory.
const MAX_PIXEL_RATIO = 2;
// The occupancy grid's cells, in the jar's units. Strips with no gift under them are skipped.
const CELL = 8;

/**
 * The gifts in the jar: a matter-js world with the jar's walls, drawn onto a canvas that sits
 * between the jar's two glass layers. Gifts are round bodies, and each picture is drawn rotated
 * with its body. The gifts are drawn on a canvas of their own first, then copied with the glass's
 * refraction: squeezed and darker next to the walls, as seen through thick glass. Both canvases
 * cover only the jar and the room above it, up to the page's top, where gifts drop in from.
 *
 * With overflow, the jar fills to the brim and the gifts spill over its rim, down its outside and
 * onto the surface it stands on. A full jar lets its oldest gifts go as new ones drop in, so the
 * heap over it sinks, and past the gift limit or the page's top the oldest go too. A gift too wide
 * for the jar drops beside it onto that surface, with or without overflow. Gifts outside the glass
 * go on a canvas over it, unbent, as wide as the stage. Gifts that leave the page go.
 *
 * Frames are only drawn while something moves: the loop stops when every gift sleeps.
 */
export class Jar {
  private _engine = Engine.create({ enableSleeping: true });
  private _ctx: CanvasRenderingContext2D;
  private _gifts = document.createElement("canvas");
  // Where the gifts inside the glass are drawn, unbent, and those outside it.
  private _giftsTarget: Target;
  private _spillTarget: Target;
  private _design!: JarDesign;
  private _stageWidth = STAGE.minWidth;
  private _box = { x: 0, y: 0, width: 0, height: 0 };
  // What the canvases and the lenses' layers were last sized for.
  private _fitted = "";
  // The glass's silhouette on the stage, and its bounds, for telling gifts outside it.
  private _outside: Point[] = [];
  private _outsideBox = { left: 0, top: 0, right: 0, bottom: 0 };
  // The widest gift the jar takes, and the biggest gift, which drops beside it.
  private _widest = 0;
  private _biggest = 0;
  private _overflow = false;
  private _walls: Body[] = [];
  private _lenses: Lens[] = [];
  private _shade = "#3c4246";
  // Which cells of the jar's box the inner canvas has gifts in, this frame.
  private _grid = new Uint8Array(0);
  private _columns = 0;
  private _rows = 0;
  private _hits = new Uint8Array(0);
  private _pieces: Piece[] = [];
  private _ghosts: Ghost[] = [];
  private _queue: Drop[] = [];
  private _nextRelease = 0;
  // When the pile last reached the page's top.
  private _fullAt = 0;
  private _accumulator = 0;
  private _last = 0;
  private _pixelRatio = 1;
  // Redraw everything, or only the canvas whose gifts moved.
  private _dirty = true;
  private _innerMoved = false;
  private _spillMoved = false;
  private _running = false;
  private _resumed = false;
  // Saved gifts still pouring in.
  private _pour?: Generator<void, void>;

  /**
   * Called with each gift the jar lets go of while overflow is on, when it no longer goes
   * oldest first, so the saved gifts stay the ones in it.
   */
  onRemove?: (drop: Drop) => void;

  /** `canvas` sits between the glass's layers and `spill` over them. */
  constructor(
    private _canvas: HTMLCanvasElement,
    private _spill: HTMLCanvasElement,
    design: JarDesign,
    public options: JarOptions,
  ) {
    this._ctx = context(_canvas);
    this._giftsTarget = { ctx: context(this._gifts), left: 0, top: 0 };
    this._spillTarget = { ctx: context(_spill), left: 0, top: 0 };

    this._engine.gravity.y = 1.1;
    this.setDesign(design, []);

    // A picture that loads late is drawn on the next frame.
    onGiftPicture(() => {
      this._dirty = true;
      this.wake();
    });
  }

  /** Swaps the jar, and pours `drops` into the new one. */
  setDesign(design: JarDesign, drops: readonly Drop[]) {
    this.clear();
    this._design = design;
    // Through its mouth, and covering at most a third of what it holds, so one gift can't empty
    // it or plug its neck.
    const { left, right } = design.mouth;
    const third = (design.bodyArea * FILL) / 3;
    this._widest = Math.min(
      right - left - 24,
      (2 * Math.sqrt(third / Math.PI)) / BODY_SHRINK,
    );
    this._biggest = (STAGE.minWidth - design.width) / 2 - BESIDE_MARGIN;
    this._columns = Math.ceil(design.width / CELL);
    this._rows = Math.ceil(design.height / CELL);
    this._grid = new Uint8Array(this._columns * this._rows);
    for (const lens of this._lenses) {
      for (const ctx of [lens.mask, lens.shade, lens.bent]) {
        ctx.canvas.width = 0;
        ctx.canvas.height = 0;
      }
    }
    this._lenses = [];
    for (const { clip, strips } of design.lenses) {
      this._lenses.push(this.lens(clip, strips, this._lenses));
    }
    this._hits = new Uint8Array(
      Math.max(0, ...this._lenses.map(({ strips }) => strips.length)),
    );
    this._fitted = "";
    this.place();
    this.settle(drops);
  }

  /**
   * Lets the gifts overflow the jar, or keeps them in it again: then the gifts that spilled out
   * fade out, and so do the oldest until the pile is back under the fill limit. Those too wide for
   * the jar stay beside it.
   */
  setOverflow(overflow: boolean) {
    if (overflow === this._overflow) return;
    // The pouring is done the way it started.
    this.pourFor(Infinity);
    const now = performance.now();
    if (overflow) {
      for (const piece of this._pieces) piece.outside = this.isOutside(piece);
    } else {
      const spilled = (piece: Piece) => piece.outside && !piece.beside;
      const outside = this._pieces.filter(spilled);
      this._pieces = this._pieces.filter((piece) => !spilled(piece));
      for (const piece of outside) this.letGo(piece, now);
    }
    this._overflow = overflow;
    this.buildWalls();
    if (!overflow) this.removeExtra(now);
    this.fit();
    this._dirty = true;
    this.wake();
  }

  /** The color the glass darkens the gifts behind its edges with. */
  setShade(color: string) {
    if (color === this._shade) return;
    this._shade = color;
    this.paintShades();
    this._dirty = true;
    this.wake();
  }

  /**
   * Sizes the canvases for the stage's scale on the page, in device pixels, and puts the jar in
   * the middle of the stage's width, moving the gifts with it.
   */
  resize(scale: number, devicePixelRatio: number, stageWidth: number) {
    // Capped, so a big source on a high-density screen doesn't make huge canvases.
    this._pixelRatio = Math.min(scale * devicePixelRatio, MAX_PIXEL_RATIO);
    this._stageWidth = stageWidth;
    this.place();
    this.wake();
  }

  /** Starts the render loop. It stops by itself while nothing moves. */
  start() {
    this.wake();
  }

  /** Queues a gift. It drops once its picture has loaded or failed. */
  drop(drop: Drop) {
    loadGiftPicture(drop.image);
    this._queue.push(drop);
    this.wake();
  }

  /**
   * Pours saved gifts into the jar a few rows at a time, then lets the pile settle. A full jar
   * takes a while, so the pouring goes on over the next frames instead of freezing the page, and
   * the gifts show once it's done. Only the newest that fit are poured.
   */
  settle(drops: readonly Drop[]) {
    this._pour = this.pour(this.fitting(drops));
    this.pourFor(POUR_FIRST_MS);
    if (this._pour) this.blank();
    this.wake();
  }

  /** Empties the jar. */
  clear() {
    for (const { body } of this._pieces) {
      Composite.remove(this._engine.world, body);
    }
    this._pieces = [];
    this._ghosts = [];
    this._queue = [];
    this._pour = undefined;
    this._dirty = true;
    this.wake();
  }

  /** Applies new options: fewer gifts, or another size and the room it needs. */
  trim() {
    this.fit();
    this.removeExtra(performance.now());
    this.wake();
  }

  // Runs the loop until nothing moves.
  private wake() {
    if (this._running) return;
    this._running = true;
    // The time asleep isn't simulated.
    this._resumed = true;
    requestAnimationFrame(this._tick);
  }

  private _tick = (time: number) => {
    let busy = true;
    try {
      this.frame(time);
      // Whether any gift is awake is asked of the bodies themselves: a gift released or woken in a
      // frame that took no step is awake but hasn't moved yet, and stopping then would leave it
      // hanging where it was until something else woke the loop.
      busy =
        this._queue.length > 0 ||
        this._pour !== undefined ||
        this._ghosts.length > 0 ||
        this._dirty ||
        this._innerMoved ||
        this._spillMoved ||
        this._pieces.some(({ body }) => !body.isSleeping);
    } finally {
      // Even after a frame that failed, or no later gift would ever drop.
      if (busy) requestAnimationFrame(this._tick);
      else this._running = false;
    }
  };

  // Pours for up to `ms`, and draws the gifts once it's done.
  private pourFor(ms: number) {
    const end = performance.now() + ms;
    while (this._pour && performance.now() < end) {
      if (this._pour.next().done) {
        this._pour = undefined;
        this._dirty = true;
      }
    }
  }

  // A full jar's gifts heap over the opening instead of falling in, so one at a time would take
  // too long. They pour a few rows at a time, side by side across the opening and stacked.
  // Yields after each step.
  private *pour(drops: readonly Drop[]): Generator<void, void> {
    const { left, right } = this._design.mouth;
    // Gifts too wide for the jar drop in beside it, one above the other.
    let besideLift = 0;
    for (let i = 0; i < drops.length;) {
      const batch: Piece[] = [];
      let lift = 0;
      for (let row = 0; row < SETTLE_ROWS && i < drops.length; row++) {
        let x = this._box.x + left + 4;
        let tallest = 0;
        while (i < drops.length) {
          const diameter = this.diameter(drops[i].coins);
          if (diameter > this._widest) {
            loadGiftPicture(drops[i].image);
            this.release(drops[i], this.besideX(diameter), besideLift);
            besideLift += diameter + 8;
            i++;
            continue;
          }
          if (
            x > this._box.x + left + 4 &&
            x + diameter > this._box.x + right - 4
          )
            break;
          loadGiftPicture(drops[i].image);
          batch.push(this.release(drops[i], x + diameter / 2, lift));
          tallest = Math.max(tallest, diameter);
          x += diameter + 2;
          i++;
        }
        lift += tallest + 4;
      }
      // They fall together, so none lands hard on another. The next batch starts where this one
      // did, once it has fallen clear. One that lands on the heap needn't roll off first: the next
      // goes above it.
      const bottom = Math.max(...batch.map(({ body }) => body.position.y));
      for (let step = 0; step < 16; step++) {
        this.step();
        yield;
        const clear = batch.every(
          ({ body, diameter }) =>
            body.speed < 1 || body.position.y > bottom + diameter,
        );
        if (clear) break;
      }
    }
    for (let i = 0; i < 150; i++) {
      this.step();
      yield;
      if (this._pieces.every(({ body }) => body.isSleeping)) break;
    }
    // Gifts left above the page's top go, as they do once poured. Nothing was drawn meanwhile, so
    // the gifts let go while pouring don't fade in afterwards.
    if (this._overflow) {
      const now = performance.now();
      const above = this._pieces.filter((piece) => this.isAbove(piece));
      this._pieces = this._pieces.filter((piece) => !this.isAbove(piece));
      for (const piece of above) this.letGo(piece, now);
    }
    this._ghosts = [];
  }

  // Clears what's on the canvases, for while the gifts pour.
  private blank() {
    wipe(this._ctx);
    wipe(this._spillTarget.ctx);
  }

  // Twice as wide for each 10 times the coins: 10 coins 2×, 100 coins 4×, 1,000 coins 8×. Only
  // the room beside the jar limits it, so the biggest still shows whole. Gifts wider than the jar
  // takes drop beside it.
  private diameter(coins: number): number {
    return Math.min(
      this.options.giftSize * 2 ** Math.log10(Math.max(coins, 1)),
      this._biggest,
    );
  }

  // Puts a gift just above the page's top: over the mouth at a random x and with a little spin, or
  // upright over the room beside the jar when it's too wide for it. Saved gifts pour in at a given
  // x, from just over the mouth, or from above the room beside the jar.
  private release(drop: Drop, at?: number, lift = 0): Piece {
    const now = performance.now();
    const diameter = this.diameter(drop.coins);
    const radius = (diameter * BODY_SHRINK) / 2;
    const beside = diameter > this._widest;
    const margin = radius + 6;
    let left = this._box.x + this._design.mouth.left;
    let right = this._box.x + this._design.mouth.right;
    const x =
      at ??
      (beside
        ? this.besideX(diameter)
        : left +
          margin +
          Math.random() * Math.max(0, right - left - 2 * margin));
    if (beside) {
      left = x - radius;
      right = x + radius;
    }
    let y =
      at === undefined || beside
        ? -diameter * Math.SQRT1_2 - lift
        : this._box.y - radius - 4 - lift;
    if (at === undefined) {
      // A full jar lets its oldest gifts go as a gift drops in, so the heap sinks while it falls.
      // Without gifts old enough to go, the gifts heaped where it lands make room instead.
      const sunk =
        this._overflow &&
        !beside &&
        this.heapArea() > 0 &&
        this.sink(area(diameter), now);
      if (!sunk) this.makeRoom(left, right, diameter, beside, now);
      // Above the gifts released just before it that haven't fallen clear yet, so a burst falls
      // in a column instead of starting on top of itself.
      for (const { body } of this._pieces) {
        const { min, max } = body.bounds;
        if (
          body.velocity.y >= START_SPEED &&
          max.x > x - radius &&
          min.x < x + radius &&
          max.y > y - radius - 2
        ) {
          y = Math.min(y, min.y - radius - 2);
        }
      }
    } else if (this._overflow && !beside) {
      // Above the gifts heaped over the opening, so it doesn't pour into them.
      for (const { body } of this._pieces) {
        const { min, max } = body.bounds;
        if (body.speed < 1 && max.x > left && min.x < right) {
          y = Math.min(y, min.y - radius - 4 - lift);
        }
      }
    }
    const body = Bodies.circle(
      x,
      y,
      radius,
      {
        restitution: 0.3,
        // A gift beside the jar grips the pile, so it stays where it lands.
        friction: beside ? 0.8 : 0.3,
        frictionStatic: beside ? 1 : 0.5,
        frictionAir: 0.01,
        sleepThreshold: 45,
        density: (DENSITY * this.options.giftSize) / diameter,
        collisionFilter: {
          category: beside ? BESIDE : GIFT,
          mask: this.mask(beside),
        },
      },
      GIFT_SIDES,
    );
    if (beside) {
      // Upright and never turning, so a big picture reads as what it is.
      Body.setInertia(body, Infinity);
    } else {
      Body.setAngle(body, Math.random() * Math.PI * 2);
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.16);
    }
    // Hardly sideways, so the long fall from the page's top still ends in the mouth.
    Body.setVelocity(body, {
      x: (Math.random() - 0.5) * 0.2,
      y: START_SPEED,
    });
    Composite.add(this._engine.world, body);

    const piece: Piece = {
      body,
      drop,
      diameter,
      beside,
      since: now,
      nudges: 0,
      outside: beside,
      awake: true,
    };
    if (this._overflow) piece.outside = this.isOutside(piece);
    this._pieces.push(piece);
    // The canvas over the glass shows once a gift is outside it.
    if (piece.outside && this._spill.hidden) this.fit();
    this.removeExtra(now);
    return piece;
  }

  // A random x over the room on one side of the jar, for a gift too wide for it: the side whose
  // last such gift came longest ago, so big gifts sent together land apart, and the oldest make
  // room for the next.
  private besideX(diameter: number): number {
    const half = diameter / 2 + 4;
    const sides = [
      [half, this._outsideBox.left - half],
      [this._outsideBox.right + half, this._stageWidth - half],
    ].filter(([from, to]) => to >= from);
    const last = ([from, to]: number[]) => {
      let since = -Infinity;
      for (const piece of this._pieces) {
        const { x } = piece.body.position;
        if (piece.beside && x > from - half && x < to + half) {
          since = Math.max(since, piece.since);
        }
      }
      return since;
    };
    let best = sides[Math.floor(Math.random() * sides.length)] ?? [half, half];
    for (const side of sides) if (last(side) < last(best)) best = side;
    return best[0] + Math.random() * (best[1] - best[0]);
  }

  // Gifts on the heap where a new one lands, so high that it would rest with its middle above the
  // page's top, fade out to make room for it, as one resting there goes unseen. A gift beside the
  // jar gets room to rest whole, since few gifts are in its way; over a full jar that would clear
  // the heap for every gift. A gift is on the heap once its fall stopped, as it falls faster than
  // it starts: in a burst the heap is still moving.
  private makeRoom(
    left: number,
    right: number,
    diameter: number,
    beside: boolean,
    now: number,
  ) {
    const line = (beside ? diameter : diameter / 2) + 8;
    let removed = false;
    for (let i = this._pieces.length - 1; i >= 0; i--) {
      const piece = this._pieces[i];
      const { bounds, speed, velocity } = piece.body;
      if (
        (speed < 1 || velocity.y < START_SPEED) &&
        bounds.min.y < line &&
        bounds.max.x > left &&
        bounds.min.x < right
      ) {
        this._pieces.splice(i, 1);
        this.letGo(piece, now);
        removed = true;
      }
    }
    if (removed && !this._overflow) {
      for (const { body } of this._pieces) Sleeping.set(body, false);
    }
  }

  // Gifts in the jar collide with its inside. Those beside it, and with overflow every gift,
  // collide with the whole glass and the surface it stands on, and those beside it with the
  // stage's sides too.
  private mask(beside: boolean): number {
    if (beside) return GIFT | BESIDE | OUTSIDE | EDGE;
    return GIFT | BESIDE | (this._overflow ? OUTSIDE : INSIDE);
  }

  // Puts the jar in the middle of the stage, on its line, moving the gifts with it.
  private place() {
    const box = placement(this._design, this._stageWidth);
    const dx = box.x - this._box.x;
    const dy = box.y - this._box.y;
    this._box = box;
    if (dx || dy) {
      for (const { body } of this._pieces) {
        Body.translate(body, { x: dx, y: dy });
      }
      for (const ghost of this._ghosts) {
        ghost.x += dx;
        ghost.y += dy;
      }
    }
    this._outside = this._design.outside.map((p) => ({
      x: box.x + p.x,
      y: box.y + p.y,
    }));
    const xs = this._outside.map((p) => p.x);
    const ys = this._outside.map((p) => p.y);
    this._outsideBox = {
      left: Math.min(...xs),
      top: Math.min(...ys),
      right: Math.max(...xs),
      bottom: Math.max(...ys),
    };
    this.buildWalls();
    this.fit();
    this._dirty = true;
  }

  // The jar's walls. Gifts beside it, and with overflow every gift, rest on the whole glass, inside
  // and out, and on the surface the jar stands on, which spans the stage so they pile beside it
  // out to the page's edges. Without overflow, the gifts in the jar rest on its inside instead,
  // which rises in a chute past the page's top. The gifts beside the jar stop at the stage's
  // sides, so a big one that rolls doesn't leave the page.
  private buildWalls() {
    Composite.remove(this._engine.world, this._walls);
    const { outline, outside } = this._design;
    const width = this._stageWidth;
    // A picture is wider than its body, so the sides stand in by the biggest one's overhang.
    const inset = (this._biggest * (1 - BODY_SHRINK)) / 2;
    this._walls = [
      ...glassWalls(outline, outside).map((wall) =>
        this.wall(this._box.x + wall.x, this._box.y + wall.y, wall, OUTSIDE),
      ),
      ...(this._overflow ? [] : walls(outline)).map((wall) =>
        this.wall(this._box.x + wall.x, this._box.y + wall.y, wall, INSIDE),
      ),
      this.wall(
        width / 2,
        this._outsideBox.bottom + 50,
        { length: width, thickness: 100, angle: 0 },
        OUTSIDE,
      ),
      ...[inset - 50, width - inset + 50].map((x) =>
        this.wall(
          x,
          0,
          { length: 100, thickness: STAGE.height * 4, angle: 0 },
          EDGE,
        ),
      ),
    ];
    Composite.add(this._engine.world, this._walls);
    for (const piece of this._pieces) {
      piece.body.collisionFilter.mask = this.mask(piece.beside);
      Sleeping.set(piece.body, false);
    }
  }

  // A static wall centered at x and y. Gifts' masks pick which walls they meet.
  private wall(
    x: number,
    y: number,
    { length, thickness, angle }: Omit<Wall, "x" | "y">,
    category: number,
  ): Body {
    return Bodies.rectangle(x, y, length, thickness, {
      isStatic: true,
      angle,
      friction: 0.4,
      restitution: 0.15,
      collisionFilter: { category },
    });
  }

  // Sizes the canvases and the lenses' layers for the jar's place, the pixel ratio and the
  // gift size. Resizing a canvas clears it, so nothing is redone when nothing changed.
  private fit() {
    const ratio = this._pixelRatio;
    const box = this._box;
    const biggest = this.diameter(Infinity);
    const spills = this.spills();
    const key = [ratio, this._stageWidth, box.x, box.y, biggest, spills].join();
    if (key === this._fitted) return;
    this._fitted = key;

    // Room for the widest gift the jar takes turned any way at the sides, and up to the page's
    // top, where gifts drop in from. Wider ones are outside it, on the canvas over the glass.
    const reach = this._widest * Math.SQRT1_2;
    const stageWidth = Math.round(this._stageWidth * ratio);
    const stageHeight = Math.round(STAGE.height * ratio);
    const left = clamp(Math.floor((box.x - reach - 2) * ratio), 0, stageWidth);
    const top = 0;
    const right = clamp(
      Math.ceil((box.x + box.width + reach + 2) * ratio),
      left,
      stageWidth,
    );
    const bottom = clamp(
      Math.ceil((box.y + box.height + 2) * ratio),
      top,
      stageHeight,
    );
    this._giftsTarget.left = left;
    this._giftsTarget.top = top;
    this.size(this._canvas, left, top, right - left, bottom - top);
    this._gifts.width = right - left;
    this._gifts.height = bottom - top;
    // Only while gifts may be outside the glass, and down to the biggest gift on the surface the
    // jar stands on.
    const floor = Math.ceil(
      (this._outsideBox.bottom +
        biggest * (Math.SQRT1_2 - BODY_SHRINK / 2) +
        4) *
        ratio,
    );
    this.size(
      this._spill,
      0,
      0,
      spills ? stageWidth : 0,
      spills ? clamp(floor, 0, stageHeight) : 0,
    );
    this._spill.hidden = !spills;

    // The jar's corner on the inner canvas.
    const boxX = box.x * ratio - left;
    const boxY = box.y * ratio - top;
    for (const lens of this._lenses) {
      const { bounds, strips, draws, mask } = lens;
      lens.x = Math.max(0, Math.floor(boxX + bounds.x * ratio) - 1);
      lens.y = Math.max(0, Math.floor(boxY + bounds.y * ratio) - 1);
      lens.originX = boxX - lens.x;
      lens.originY = boxY - lens.y;
      const width =
        Math.min(
          right - left,
          Math.ceil(boxX + (bounds.x + bounds.width) * ratio) + 1,
        ) - lens.x;
      const height =
        Math.min(
          bottom - top,
          Math.ceil(boxY + (bounds.y + bounds.height) * ratio) + 1,
        ) - lens.y;
      for (const ctx of [lens.mask, lens.shade, lens.bent]) {
        ctx.canvas.width = Math.max(0, width);
        ctx.canvas.height = Math.max(0, height);
      }
      strips.forEach(({ from, to, flipX, flipY }, i) => {
        draws.set(
          [
            flipX ? -ratio : ratio,
            flipY ? -ratio : ratio,
            lens.originX + (to.x + (flipX ? to.width : 0)) * ratio,
            lens.originY + (to.y + (flipY ? to.height : 0)) * ratio,
            boxX + from.x * ratio,
            boxY + from.y * ratio,
            from.width * ratio,
            from.height * ratio,
            to.width,
            to.height,
          ],
          i * 10,
        );
      });
      // Where the strips replace the gifts behind the glass: inside the lens, under a strip.
      mask.save();
      mask.setTransform(ratio, 0, 0, ratio, lens.originX, lens.originY);
      mask.clip(lens.clip);
      for (const { to } of strips) {
        mask.fillRect(to.x, to.y, to.width, to.height);
      }
      mask.restore();
    }
    this.paintShades();
    this._dirty = true;
  }

  // Darker toward the outside, and in the glass's color: each strip's darkness, together, so a
  // frame darkens a lens's strips with one copy.
  private paintShades() {
    const ratio = this._pixelRatio;
    for (const { shade, clip, strips, originX, originY } of this._lenses) {
      wipe(shade);
      shade.save();
      shade.setTransform(ratio, 0, 0, ratio, originX, originY);
      shade.clip(clip);
      shade.fillStyle = this._shade;
      for (const { to, shade: alpha } of strips) {
        shade.globalAlpha = alpha;
        shade.fillRect(to.x, to.y, to.width, to.height);
      }
      shade.restore();
    }
  }

  // A canvas's size in px, and its place on the stage.
  private size(
    canvas: HTMLCanvasElement,
    left: number,
    top: number,
    width: number,
    height: number,
  ) {
    const ratio = this._pixelRatio;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const { style } = canvas;
    style.left = `${left / ratio}px`;
    style.top = `${top / ratio}px`;
    style.width = `${width / ratio}px`;
    style.height = `${height / ratio}px`;
  }

  // A lens's strips, laid out on the occupancy grid. Its layers are sized by fit().
  private lens(d: string, strips: Strip[], before: Lens[]): Lens {
    const cells = new Int32Array(strips.length * 4);
    strips.forEach(({ from }, i) => cells.set(this.cellsOf(from), i * 4));
    const left = Math.min(...strips.map(({ to }) => to.x));
    const top = Math.min(...strips.map(({ to }) => to.y));
    const right = Math.max(...strips.map(({ to }) => to.x + to.width));
    const bottom = Math.max(...strips.map(({ to }) => to.y + to.height));
    const bounds = {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    };
    const layer = () => context(document.createElement("canvas"));
    return {
      clip: new Path2D(d),
      strips,
      bounds,
      cells,
      area: this.cellsOf(bounds),
      overlaps: before.filter((lens) => meets(lens.bounds, bounds)),
      drawn: false,
      draws: new Float64Array(strips.length * 10),
      x: 0,
      y: 0,
      originX: 0,
      originY: 0,
      mask: layer(),
      shade: layer(),
      bent: layer(),
    };
  }

  // A rect's cells in the occupancy grid, clamped to it. None when it's off the grid.
  private cellsOf({ x, y, width, height }: Rect): Int32Array {
    return new Int32Array([
      Math.max(0, Math.floor(x / CELL)),
      Math.min(this._columns - 1, Math.floor((x + width) / CELL)),
      Math.max(0, Math.floor(y / CELL)),
      Math.min(this._rows - 1, Math.floor((y + height) / CELL)),
    ]);
  }

  // Whether any cell of a range (4 numbers at `at`) has gifts.
  private hit(cells: Int32Array, at: number): boolean {
    const grid = this._grid;
    const columns = this._columns;
    for (let row = cells[at + 2]; row <= cells[at + 3]; row++) {
      const start = row * columns;
      for (let column = cells[at]; column <= cells[at + 1]; column++) {
        if (grid[start + column]) return true;
      }
    }
    return false;
  }

  // Marks the cells under a gift's picture, turned any way, as having gifts.
  private mark(x: number, y: number, diameter: number) {
    const reach = diameter * Math.SQRT1_2;
    const left = Math.max(0, Math.floor((x - reach - this._box.x) / CELL));
    const right = Math.min(
      this._columns - 1,
      Math.floor((x + reach - this._box.x) / CELL),
    );
    const top = Math.max(0, Math.floor((y - reach - this._box.y) / CELL));
    const bottom = Math.min(
      this._rows - 1,
      Math.floor((y + reach - this._box.y) / CELL),
    );
    for (let row = top; row <= bottom; row++) {
      this._grid.fill(
        1,
        row * this._columns + left,
        row * this._columns + right + 1,
      );
    }
  }

  // Whether gifts may be outside the glass: with overflow, beside the jar, or while the last ones
  // fade.
  private spills(): boolean {
    return (
      this._overflow ||
      this._pieces.some((piece) => piece.outside) ||
      this._ghosts.some((ghost) => ghost.outside)
    );
  }

  // Fades out the oldest gifts while there are too many, or more than `limit`. With overflow, the
  // oldest outside the jar go first, but not ones that only just landed.
  private removeExtra(now: number, limit = this.options.maxGifts) {
    let removed = false;
    for (
      let extra = this.tooMany(limit);
      extra && this._pieces.length > 1;
      extra = this.tooMany(limit)
    ) {
      const at = this.oldest(extra, now);
      if (at < 0) break;
      const [piece] = this._pieces.splice(at, 1);
      this.letGo(piece, now);
      removed = true;
    }
    // The gifts that rested on the removed ones have to fall. With overflow, letGo wakes only
    // the gifts over it, as a full jar is too many to wake each time one goes.
    if (removed && !this._overflow) {
      for (const { body } of this._pieces) Sleeping.set(body, false);
    }
  }

  private tooMany(limit: number): Extra | undefined {
    if (this._pieces.length > limit) return "all";
    // With overflow the pile grows until it's full, and step() makes room then.
    if (this._overflow) return undefined;
    let inside = 0;
    let beside = 0;
    for (const piece of this._pieces) {
      if (piece.beside) beside += area(piece.diameter);
      else inside += area(piece.diameter);
    }
    return this.over(inside, beside);
  }

  // Which gifts are past their room without overflow, given the area their bodies cover: those in
  // the jar past what it holds, or those beside it past the room on its sides.
  private over(inside: number, beside: number): Extra | undefined {
    if (inside > this._design.bodyArea * FILL) return "jar";
    const sides = this._stageWidth - this._design.width;
    if (beside > this.roomArea(sides) * BESIDE_PACK) return "beside";
    return undefined;
  }

  // The oldest of the gifts that are too many, or -1 while they're all still dropping in: a burst
  // would otherwise fill the jar's room in midair, and its first gifts would go before they land.
  // A gift has landed once its fall stopped, as it falls faster than it starts.
  private oldest(extra: Extra, now: number): number {
    const landed = ({ body }: Piece) => body.velocity.y < START_SPEED;
    if (extra !== "all") {
      return this._pieces.findIndex(
        (piece) => landed(piece) && piece.beside === (extra === "beside"),
      );
    }
    if (this._overflow) {
      const outside = this._pieces.findIndex(
        (piece) => now - piece.since > SPILL_MS && piece.outside,
      );
      if (outside >= 0) return outside;
    }
    return this._pieces.findIndex(landed);
  }

  // The area between the slump's ceiling and the surface the jar stands on, across `width`.
  private roomArea(width: number): number {
    return width * (this._outsideBox.bottom - this.ceiling());
  }

  // The newest saved gifts that fit in what the jar holds, as a list of their own, since the saved
  // one grows while they pour. The older ones are let go.
  private fitting(drops: readonly Drop[]): Drop[] {
    const pile = this.roomArea(this._stageWidth) * POUR_PACK;
    let from = drops.length;
    let inside = 0;
    let beside = 0;
    while (from > 0 && drops.length - from < this.options.maxGifts) {
      const diameter = this.diameter(drops[from - 1].coins);
      if (diameter > this._widest) beside += area(diameter);
      else inside += area(diameter);
      const full = this._overflow
        ? inside + beside > pile
        : this.over(inside, beside);
      if (full) break;
      from--;
    }
    if (this._overflow) {
      for (const drop of drops.slice(0, from)) this.onRemove?.(drop);
    }
    return drops.slice(from);
  }

  // Takes a gift out of the world, fading out where it was.
  private letGo(piece: Piece, now: number) {
    Composite.remove(this._engine.world, piece.body);
    const { outside } = piece;
    this._ghosts.push({
      drop: piece.drop,
      diameter: piece.diameter,
      x: piece.body.position.x,
      y: piece.body.position.y,
      angle: piece.body.angle,
      since: now,
      outside,
    });
    if (outside) this._spillMoved = true;
    else this._innerMoved = true;
    if (!this._overflow) return;
    this.onRemove?.(piece.drop);
    // Gifts that touched it or rested over it have to move. Sleeping ones don't fall when what
    // held them goes, so the whole stack over it wakes. They wake the rest they knock into.
    const { position, circleRadius = 0 } = piece.body;
    for (const { body } of this._pieces) {
      const reach = circleRadius + (body.circleRadius ?? 0) + 4;
      if (
        Math.abs(body.position.x - position.x) < reach &&
        body.position.y - position.y < reach
      ) {
        Sleeping.set(body, false);
      }
    }
  }

  // Whether a gift's center is outside the glass's silhouette.
  private isOutside({ body }: Piece): boolean {
    const { x, y } = body.position;
    const box = this._outsideBox;
    if (x < box.left || x > box.right || y < box.top || y > box.bottom) {
      return true;
    }
    return !contains(this._outside, x, y);
  }

  // Whether a gift rests above the page's top. Falling ones move faster.
  private isAbove({ body }: Piece): boolean {
    return body.position.y < 0 && body.speed < 1;
  }

  // Whether a gift left the stage, or got out of the jar it was in without overflow.
  private isGone({ body, beside }: Piece): boolean {
    const { x, y } = body.position;
    if (this._overflow || beside)
      return x < 0 || x > this._stageWidth || y > STAGE.height;
    const box = this._box;
    return (
      y > box.y + box.height + 60 ||
      x < box.x - 40 ||
      x > box.x + box.width + 40
    );
  }

  private step() {
    Engine.update(this._engine, STEP_MS);
    // A gift that couldn't slide off the heap over the jar means the jar is full. Not while
    // pouring: the pour stacks gifts faster than they spread, and clears up after itself.
    const stuck = this._overflow && this.slump() && !this._pour;
    const now = performance.now();
    let full = false;
    // Only gifts awake before or after the step can have moved.
    for (let i = this._pieces.length - 1; i >= 0; i--) {
      const piece = this._pieces[i];
      const moved = piece.awake || !piece.body.isSleeping;
      piece.awake = !piece.body.isSleeping;
      if (!moved) continue;
      // One resting above the page's top means the pile reached it. Not one still dropping in, or
      // landed on a heap that's still sinking into a full jar, and not while pouring: the pour
      // stacks gifts faster than they spread, and clears up after itself.
      const above =
        this._overflow &&
        !this._pour &&
        now - piece.since > 2 * LANDING_MS &&
        this.isAbove(piece);
      if (above || this.isGone(piece)) {
        full ||= above;
        this._pieces.splice(i, 1);
        if (this._overflow || piece.beside) {
          this.letGo(piece, now);
        } else {
          Composite.remove(this._engine.world, piece.body);
          this._innerMoved = true;
        }
        continue;
      }
      if (this._overflow) {
        const outside = this.isOutside(piece);
        if (outside !== piece.outside) {
          piece.outside = outside;
          this._innerMoved = true;
          this._spillMoved = true;
        }
      }
      if (piece.outside) this._spillMoved = true;
      else this._innerMoved = true;
    }
    // The oldest make room for the next gifts, and the pile settles into it: the heap over the
    // mouth is nudged again, as its gifts may have given up.
    if ((full || stuck) && now - this._fullAt > PAGE_SETTLE_MS) {
      this._fullAt = now;
      if (full) {
        this.removeExtra(now, Math.floor(this._pieces.length * PAGE_ROOM));
      } else {
        this.sink(this.heapArea(), now);
      }
      for (const piece of this._pieces) {
        piece.nudges = 0;
        Sleeping.set(piece.body, false);
      }
    }
  }

  // Discs heap into steep cones, which would rise off the stage over a tall jar. Gifts resting
  // above the ceiling are nudged off the jar's axis, so the heap slides over the rim instead and
  // the next gifts land in view. Returns whether a gift over the jar gave up.
  private slump(): boolean {
    const ceiling = this.ceiling();
    const { x, width } = this._box;
    const axis = x + width / 2;
    let stuck = false;
    for (const piece of this._pieces) {
      const { body } = piece;
      if (body.position.y > ceiling || body.speed > 1) continue;
      // One wedged in place gives up, so it can sleep.
      if (piece.nudges++ > NUDGE_STEPS) {
        stuck ||= body.position.x > x && body.position.x < x + width;
        continue;
      }
      const side = body.position.x < axis ? -1 : 1;
      Sleeping.set(body, false);
      Body.setVelocity(body, {
        x: body.velocity.x + side * 0.3,
        y: body.velocity.y,
      });
    }
    return stuck;
  }

  // Makes room in a full jar: its oldest gifts go, as many as cover `room`, so the heap over it
  // sinks in. None that dropped in within SINK_MS go. Returns whether it made all that room.
  private sink(room: number, now: number): boolean {
    for (let i = 0; i < this._pieces.length && room > 0;) {
      const piece = this._pieces[i];
      if (piece.outside || now - piece.since < SINK_MS) {
        i++;
        continue;
      }
      this._pieces.splice(i, 1);
      this.letGo(piece, now);
      room -= area(piece.diameter);
    }
    return room <= 0;
  }

  // The area of the gifts heaped over the jar above the ceiling: more than it holds.
  private heapArea(): number {
    const ceiling = this.ceiling();
    const { x, width } = this._box;
    let heap = 0;
    for (const { body, diameter } of this._pieces) {
      const { position, speed, velocity } = body;
      if (
        (speed < 1 || velocity.y < START_SPEED) &&
        position.y < ceiling &&
        position.x > x &&
        position.x < x + width
      ) {
        heap += area(diameter);
      }
    }
    return heap;
  }

  // 1.5 gifts over the rim, but far enough under the page's top that the widest gift the jar
  // takes lands on the heap with its middle in view.
  private ceiling(): number {
    const top = this._outsideBox.top;
    const room = this.options.giftSize * 1.5;
    return Math.min(top, Math.max(top - room, this._widest / 2 + 8));
  }

  private frame(time: number) {
    if (this._pour) {
      this.pourFor(POUR_FRAME_MS);
      this._last = time;
      if (this._pour) return;
    }
    if (this._resumed) {
      this._resumed = false;
      this._last = time;
    }
    this._accumulator = Math.min(
      this._accumulator + (time - this._last),
      STEP_MS * 4,
    );
    this._last = time;

    // The first gift whose picture is ready, so one still loading holds back only gifts like it.
    // One too wide to share the room beside the jar waits until the last such gift has landed, so
    // they don't land on each other, but not for long: one can keep sliding on a pile that moves.
    const huge = this._biggest / 2;
    const falling = this._pieces.some(
      ({ diameter, body, since }) =>
        diameter > huge &&
        body.velocity.y >= START_SPEED &&
        time - since < 2 * LANDING_MS,
    );
    const next =
      time >= this._nextRelease
        ? this._queue.findIndex(
            (drop) =>
              isSettled(drop.image) &&
              !(falling && this.diameter(drop.coins) > huge),
          )
        : -1;
    if (next >= 0) {
      const [drop] = this._queue.splice(next, 1);
      this.release(drop);
      this._nextRelease =
        time + RELEASE_MS * Math.min(1, STREAM_QUEUE / this._queue.length);
    }

    while (this._accumulator >= STEP_MS) {
      this.step();
      this._accumulator -= STEP_MS;
    }

    // Ghosts go oldest first, and fade until they do.
    let faded = false;
    while (this._ghosts.length > 0 && time - this._ghosts[0].since >= FADE_MS) {
      const ghost = this._ghosts.shift();
      if (ghost?.outside) faded = true;
      else this._innerMoved = true;
    }
    if (faded) this._spillMoved = true;
    for (const { outside } of this._ghosts) {
      if (outside) this._spillMoved = true;
      else this._innerMoved = true;
    }
    // The last gifts outside the glass are gone, faded or cleared, and so is their canvas.
    if (!this._overflow && !this._spill.hidden && !this.spills()) this.fit();

    if (this._dirty || this._innerMoved || this._spillMoved) this.draw(time);
  }

  private draw(time: number) {
    const inner =
      this._dirty || this._innerMoved ? this._giftsTarget : undefined;
    const spill =
      this.spills() && (this._dirty || this._spillMoved)
        ? this._spillTarget
        : undefined;
    this._dirty = false;
    this._innerMoved = false;
    this._spillMoved = false;
    if (inner) {
      wipe(inner.ctx);
      this._grid.fill(0);
    }
    if (spill) wipe(spill.ctx);

    for (const { body, drop, diameter, outside } of this._pieces) {
      const target = outside ? spill : inner;
      if (!target) continue;
      const { x, y } = body.position;
      this.picture(target, drop, x, y, body.angle, diameter, 1);
      if (target === inner) this.mark(x, y, diameter);
    }
    for (const ghost of this._ghosts) {
      const target = ghost.outside ? spill : inner;
      if (!target) continue;
      const alpha = 1 - (time - ghost.since) / FADE_MS;
      const diameter = ghost.diameter * (0.6 + 0.4 * alpha);
      const { drop, x, y, angle } = ghost;
      this.picture(target, drop, x, y, angle, diameter, alpha);
      if (target === inner) this.mark(x, y, diameter);
    }

    if (!inner) return;
    wipe(this._ctx);
    this._ctx.drawImage(this._gifts, 0, 0);
    this.refract();
  }

  // Shows the gifts next to the glass's edges bent as the glass bends them. Each lens's strips
  // copy the gifts into its layer, mirrored and squeezed; its mask keeps them inside the lens,
  // and its shade darkens them. Then they replace the gifts behind the lens.
  private refract() {
    const ctx = this._ctx;
    const hits = this._hits;
    for (const lens of this._lenses) {
      const { cells, draws, bent } = lens;
      const count = lens.strips.length;
      let bending = false;
      for (let i = 0; i < count; i++) {
        hits[i] = this.hit(cells, i * 4) ? 1 : 0;
        if (hits[i]) bending = true;
      }
      // No gifts behind it, none to bend into it, and no lens before it drew into it.
      lens.drawn =
        bending ||
        this.hit(lens.area, 0) ||
        lens.overlaps.some(({ drawn }) => drawn);
      if (!lens.drawn) continue;

      ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(lens.mask.canvas, lens.x, lens.y);
      ctx.globalCompositeOperation = "source-over";
      if (bending) {
        wipe(bent);
        for (let i = 0; i < count; i++) {
          if (!hits[i]) continue;
          const at = i * 10;
          bent.setTransform(
            draws[at],
            0,
            0,
            draws[at + 1],
            draws[at + 2],
            draws[at + 3],
          );
          bent.drawImage(
            this._gifts,
            draws[at + 4],
            draws[at + 5],
            draws[at + 6],
            draws[at + 7],
            0,
            0,
            draws[at + 8],
            draws[at + 9],
          );
        }
        bent.setTransform(1, 0, 0, 1, 0, 0);
        bent.globalCompositeOperation = "destination-in";
        bent.drawImage(lens.mask.canvas, 0, 0);
        bent.globalCompositeOperation = "source-atop";
        bent.drawImage(lens.shade.canvas, 0, 0);
        bent.globalCompositeOperation = "source-over";
        ctx.drawImage(bent.canvas, lens.x, lens.y);
      }
    }
  }

  // Draws a gift's picture, or the box if it didn't load. Nothing while it loads.
  private picture(
    { ctx, left, top }: Target,
    drop: Drop,
    x: number,
    y: number,
    angle: number,
    diameter: number,
    alpha: number,
  ) {
    const loaded = loadGiftPicture(drop.image);
    const picture =
      loaded.status === "failed" ? loadGiftPicture(GIFT_BOX) : loaded;
    const { img } = picture;
    if (picture.status !== "loaded" || !img.naturalWidth) return;

    // Fits the picture in a square of the gift's size, whatever its shape.
    const fit = diameter / Math.max(img.naturalWidth, img.naturalHeight);
    const w = img.naturalWidth * fit;
    const h = img.naturalHeight * fit;
    const ratio = this._pixelRatio;
    const cos = Math.cos(angle) * ratio;
    const sin = Math.sin(angle) * ratio;
    ctx.setTransform(cos, sin, -sin, cos, x * ratio - left, y * ratio - top);
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    if (alpha < 1) ctx.globalAlpha = 1;
  }
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't draw the gifts.");
  return ctx;
}

// Clears a whole canvas.
function wipe(ctx: CanvasRenderingContext2D) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// The area a gift's body covers.
function area(diameter: number): number {
  return Math.PI * ((diameter * BODY_SHRINK) / 2) ** 2;
}

function meets(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}
