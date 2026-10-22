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
  /** A 1-coin gift's diameter in px. Pricier gifts are bigger, up to 2.4 times. */
  giftSize: number;
}

interface Piece {
  body: Body;
  drop: Drop;
  diameter: number;
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
// Gifts outside the jar newer than this stay. With no older ones there, the oldest in the jar go
// instead, so a gift that just landed isn't the first to go.
const SPILL_MS = 10_000;
// The gifts may cover this much of the jar's body. Past it the oldest go, so the pile never
// reaches the neck and blocks the mouth.
const FILL = 0.6;
// When the pile reaches the page's top, the oldest go until this much of it is left, so new gifts
// land where they're seen. At most once per PAGE_SETTLE_MS, as the pile takes a while to settle.
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
// The biggest gift, against a 1-coin one.
const MAX_GROWTH = 2.4;
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
 * onto the surface it stands on. Those outside the glass go on a canvas over it, unbent, as wide
 * as the stage. Gifts that leave the page go, and when the pile reaches its top, the oldest go to
 * make room.
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
   * Lets the gifts overflow the jar, or keeps them in it again: then the gifts outside it fade
   * out, and so do the oldest until the pile is back under the fill limit.
   */
  setOverflow(overflow: boolean) {
    if (overflow === this._overflow) return;
    // The pouring is done the way it started.
    this.pourFor(Infinity);
    const now = performance.now();
    if (overflow) {
      for (const piece of this._pieces) piece.outside = this.isOutside(piece);
    } else {
      const outside = this._pieces.filter((piece) => piece.outside);
      this._pieces = this._pieces.filter((piece) => !piece.outside);
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
   * the gifts show once it's done.
   */
  settle(drops: readonly Drop[]) {
    this._pour = this.pour(drops);
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
    this.frame(time);
    // Whether any gift is awake is asked of the bodies themselves: a gift released or woken in a
    // frame that took no step is awake but hasn't moved yet, and stopping then would leave it
    // hanging where it was until something else woke the loop.
    const busy =
      this._queue.length > 0 ||
      this._pour !== undefined ||
      this._ghosts.length > 0 ||
      this._dirty ||
      this._innerMoved ||
      this._spillMoved ||
      this._pieces.some(({ body }) => !body.isSleeping);
    if (busy) requestAnimationFrame(this._tick);
    else this._running = false;
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
    for (let i = 0; i < drops.length;) {
      const batch: Piece[] = [];
      let lift = 0;
      for (let row = 0; row < SETTLE_ROWS && i < drops.length; row++) {
        let x = this._box.x + left + 4;
        let tallest = 0;
        while (i < drops.length) {
          const diameter = this.diameter(drops[i].coins);
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

  // Bigger for more coins: 1 coin is 1×, 100 about 1.7×, 1,000 about 2× and 10,000 2.4×. Never
  // wider than the mouth, so the biggest gift still drops in.
  private diameter(coins: number): number {
    const growth = Math.min(
      MAX_GROWTH,
      1 + 0.35 * Math.log10(Math.max(coins, 1)),
    );
    const { left, right } = this._design.mouth;
    return Math.min(this.options.giftSize * growth, right - left - 24);
  }

  // Puts a gift over the mouth, just above the page's top, at a random x and with a little spin.
  // Saved gifts pour in at a given x, from just over the mouth.
  private release(drop: Drop, at?: number, lift = 0): Piece {
    const diameter = this.diameter(drop.coins);
    const radius = (diameter * BODY_SHRINK) / 2;
    const margin = radius + 6;
    const left = this._box.x + this._design.mouth.left;
    const right = this._box.x + this._design.mouth.right;
    const x =
      at ??
      left + margin + Math.random() * Math.max(0, right - left - 2 * margin);
    let y =
      at === undefined
        ? -diameter * Math.SQRT1_2
        : this._box.y - radius - 4 - lift;
    // Above the gifts heaped over the opening, so it doesn't drop into them. A live gift minds only
    // those that dropped in a while ago, as gifts dropping in together slow each other.
    if (this._overflow) {
      const now = performance.now();
      for (const { body, since } of this._pieces) {
        const { min, max } = body.bounds;
        const resting =
          body.speed < 1 && (at !== undefined || now - since > LANDING_MS);
        if (resting && max.x > left && min.x < right) {
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
        friction: 0.3,
        frictionStatic: 0.5,
        frictionAir: 0.01,
        sleepThreshold: 45,
      },
      GIFT_SIDES,
    );
    Body.setAngle(body, Math.random() * Math.PI * 2);
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.16);
    // Hardly sideways, so the long fall from the page's top still ends in the mouth.
    Body.setVelocity(body, { x: (Math.random() - 0.5) * 0.2, y: 2 });
    Composite.add(this._engine.world, body);

    const piece: Piece = {
      body,
      drop,
      diameter,
      since: performance.now(),
      nudges: 0,
      outside: false,
      awake: true,
    };
    piece.outside = this._overflow && this.isOutside(piece);
    this._pieces.push(piece);
    this.removeExtra(performance.now());
    return piece;
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

  // The jar's walls. With overflow they're the whole glass, inside and out, and the surface the
  // jar stands on spans the stage, so spilled gifts pile beside it out to the page's edges.
  private buildWalls() {
    const { x, y } = this._box;
    Composite.remove(this._engine.world, this._walls);
    const list = this._overflow
      ? glassWalls(this._design.outline, this._design.outside)
      : walls(this._design.outline);
    this._walls = list.map((wall) =>
      Bodies.rectangle(x + wall.x, y + wall.y, wall.length, wall.thickness, {
        isStatic: true,
        angle: wall.angle,
        friction: 0.4,
        restitution: 0.15,
      }),
    );
    if (this._overflow) {
      this._walls.push(
        Bodies.rectangle(
          this._stageWidth / 2,
          this._outsideBox.bottom + 50,
          this._stageWidth,
          100,
          { isStatic: true, friction: 0.4, restitution: 0.15 },
        ),
      );
    }
    Composite.add(this._engine.world, this._walls);
    for (const { body } of this._pieces) Sleeping.set(body, false);
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

    // Room for the biggest gift turned any way at the sides, and up to the page's top, where gifts
    // drop in from.
    const reach = biggest * Math.SQRT1_2;
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
    // Only while gifts may be outside the glass, and down to the gifts on the surface the jar
    // stands on.
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

  // Whether gifts may be outside the glass: with overflow, or while the last ones fade.
  private spills(): boolean {
    return this._overflow || this._ghosts.some((ghost) => ghost.outside);
  }

  // Fades out the oldest gifts while the jar holds too many, or more than `limit`. With overflow,
  // the oldest outside the jar go first, but not ones that only just landed.
  private removeExtra(now: number, limit = this.options.maxGifts) {
    let removed = false;
    while (this._pieces.length > 1 && this.tooMany(limit)) {
      const outside = this._overflow
        ? this._pieces.findIndex(
            (piece) => now - piece.since > SPILL_MS && piece.outside,
          )
        : -1;
      const [piece] = this._pieces.splice(Math.max(0, outside), 1);
      this.letGo(piece, now);
      removed = true;
    }
    // The gifts that rested on the removed ones have to fall. With overflow, letGo wakes only
    // the gifts over it, as a full jar is too many to wake each time one goes.
    if (removed && !this._overflow) {
      for (const { body } of this._pieces) Sleeping.set(body, false);
    }
  }

  private tooMany(limit: number): boolean {
    if (this._pieces.length > limit) return true;
    if (this._overflow) return false;
    let area = 0;
    for (const { diameter } of this._pieces) {
      area += Math.PI * ((diameter * BODY_SHRINK) / 2) ** 2;
    }
    return area > this._design.bodyArea * FILL;
  }

  // Takes a gift out of the world, fading out where it was.
  private letGo(piece: Piece, now: number) {
    Composite.remove(this._engine.world, piece.body);
    const outside = this._overflow && piece.outside;
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

  // Whether a gift left the stage, or got out of the jar without overflow.
  private isGone({ body }: Piece): boolean {
    const { x, y } = body.position;
    if (this._overflow)
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
    if (this._overflow) this.slump();
    const now = performance.now();
    let full = false;
    // Only gifts awake before or after the step can have moved.
    for (let i = this._pieces.length - 1; i >= 0; i--) {
      const piece = this._pieces[i];
      const moved = piece.awake || !piece.body.isSleeping;
      piece.awake = !piece.body.isSleeping;
      if (!moved) continue;
      // One resting above the page's top means the pile reached it. Not one still dropping in,
      // as gifts dropping in together slow each other, and not while pouring: the pour stacks
      // gifts faster than they spread, and clears up after itself.
      const above =
        this._overflow &&
        !this._pour &&
        now - piece.since > LANDING_MS &&
        this.isAbove(piece);
      if (above || this.isGone(piece)) {
        full ||= above;
        this._pieces.splice(i, 1);
        if (this._overflow) {
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
      if (this._overflow && piece.outside) this._spillMoved = true;
      else this._innerMoved = true;
    }
    // The oldest make room for the next gifts, and the pile settles into it: the heap over the
    // mouth is nudged again, as its gifts may have given up.
    if (full && now - this._fullAt > PAGE_SETTLE_MS) {
      this._fullAt = now;
      this.removeExtra(now, Math.floor(this._pieces.length * PAGE_ROOM));
      for (const piece of this._pieces) {
        piece.nudges = 0;
        Sleeping.set(piece.body, false);
      }
    }
  }

  // Discs heap into steep cones, which would rise off the stage over a tall jar. Gifts resting
  // too high over the rim are nudged off the jar's axis, so the heap slides over the rim instead.
  // It may rise 1.5 gifts over the rim, but keeps 1.5 gifts of room under the page's top, so the
  // next gifts land in view.
  private slump() {
    const top = this._outsideBox.top;
    const room = this.options.giftSize * 1.5;
    const ceiling = Math.min(top, Math.max(top - room, room));
    const axis = this._box.x + this._box.width / 2;
    for (const piece of this._pieces) {
      const { body } = piece;
      if (body.position.y > ceiling || body.speed > 1) continue;
      // One wedged in place gives up, so it can sleep.
      if (piece.nudges++ > NUDGE_STEPS) continue;
      const side = body.position.x < axis ? -1 : 1;
      Sleeping.set(body, false);
      Body.setVelocity(body, {
        x: body.velocity.x + side * 0.3,
        y: body.velocity.y,
      });
    }
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

    const head = this._queue[0];
    if (head && time >= this._nextRelease && isSettled(head.image)) {
      this._queue.shift();
      this.release(head);
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
      const target = this._overflow && outside ? spill : inner;
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

function meets(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}
