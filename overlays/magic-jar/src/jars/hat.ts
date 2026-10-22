// A magician's top hat, upturned: a felt hat with a wide brim and a band of stars, a wand leaning
// on it and a swirl inside. A bunny is in there too: its ears stick up from among the gifts.
import {
  fill,
  highlight,
  leftEdge,
  part,
  rim,
  shell,
  sparkle,
  vessel,
} from "./art";
import { num, pathOf } from "./geometry";
import type { Point } from "./types";

const WIDTH = 380;
const HEIGHT = 418;
const CX = WIDTH / 2;
const BRIM = { y: 72, outer: 180, inner: 124, tilt: 0.14, height: 9 };
const BAND = { top: 92, bottom: 124 };
// The crown, now the bottom: the hat flares a little toward it.
const CROWN = { y: 386, half: 146, tilt: 0.14 };
const GROUND = CROWN.y + CROWN.half * CROWN.tilt;

// The crown's front edge, from its left end to the middle.
const crown = Array.from({ length: 13 }, (_, i) => {
  const a = (i / 12) * (Math.PI / 2);
  return {
    x: CX - CROWN.half * Math.cos(a),
    y: CROWN.y + CROWN.half * CROWN.tilt * Math.sin(a),
  };
});
// The hat's outside, left half: the brim, then down the side and round the crown.
const silhouette: Point[] = [
  { x: CX - BRIM.outer, y: BRIM.y },
  { x: CX - BRIM.outer, y: BRIM.y + BRIM.height },
  { x: 50, y: 84 },
  ...crown,
];

// The inside, left half: the opening in the brim, straight down to a floor with round corners.
const inside: Point[] = [
  { x: CX - BRIM.inner, y: BRIM.y },
  { x: 64, y: 86 },
  { x: 60, y: 368 },
  { x: 62, y: 378 },
  { x: 70, y: 384 },
  { x: 82, y: 386 },
  { x: CX, y: 388 },
];

const brim = rim(CX, BRIM.y, BRIM.outer, BRIM.inner, BRIM.tilt, BRIM.height, {
  top: "main",
  face: "main",
  shade: "mainDark",
});

// The band under the brim, curving round the hat, with stars on it.
const bandHalf = 142;
const bandCurve = bandHalf * BRIM.tilt;
const band = `M${CX - bandHalf} ${BAND.top}A${bandHalf} ${num(bandCurve)} 0 0 0 ${CX + bandHalf} ${BAND.top}L${CX + bandHalf} ${BAND.bottom}A${bandHalf} ${num(bandCurve)} 0 0 1 ${CX - bandHalf} ${BAND.bottom}Z`;
const bandY = (x: number) =>
  (BAND.top + BAND.bottom) / 2 +
  bandCurve * Math.sqrt(Math.max(0, 1 - ((x - CX) / bandHalf) ** 2));
const bandStars = [-84, 0, 84]
  .map((dx) => sparkle(CX + dx, bandY(CX + dx), dx === 0 ? 10 : 7))
  .join("");

// A swirl in the dark inside, under the gifts.
const swirl = pathOf(
  Array.from({ length: 140 }, (_, i) => {
    const a = (i / 139) * Math.PI * 5;
    const r = 6 + a * 7;
    return { x: CX + r * Math.cos(a), y: 252 + r * 0.92 * Math.sin(a) };
  }),
);

// A bunny's ear, from its base up to its tip, `wide` across: an outer ear and its pink inside.
function ear(base: Point, tip: Point, wide: number): string {
  const shape = (scale: number, shorten: number) => {
    const t = {
      x: tip.x - (tip.x - base.x) * shorten,
      y: tip.y - (tip.y - base.y) * shorten,
    };
    const length = Math.hypot(t.x - base.x, t.y - base.y);
    const u = { x: (t.x - base.x) / length, y: (t.y - base.y) / length };
    const n = { x: -u.y, y: u.x };
    const w = wide * scale;
    const at = (along: number, across: number) =>
      `${num(base.x + u.x * length * along + n.x * w * across)} ${num(base.y + u.y * length * along + n.y * w * across)}`;
    return `M${at(0, -0.8)}C${at(0.55, -1.25)} ${at(0.92, -0.95)} ${at(1, 0)}C${at(0.92, 0.95)} ${at(0.55, 1.25)} ${at(0, 0.8)}Z`;
  };
  return `${part(shape(1, 0), "white")}${fill(shape(0.45, 0.12), "trimLight")}`;
}
// Their bases go down behind the brim's near half, so no cut end shows in the opening.
const ears = `${ear({ x: 152, y: 98 }, { x: 122, y: -28 }, 17)}${ear({ x: 184, y: 98 }, { x: 200, y: -22 }, 17)}`;

// The wand, leaning on the hat's right side, its tip clear of the opening. White tips on a black
// stick, and sparkles where the magic comes out.
const wand = { from: { x: 316, y: 406 }, to: { x: 364, y: 22 } };
const wandAt = (t: number) =>
  `${num(wand.from.x + (wand.to.x - wand.from.x) * t)} ${num(wand.from.y + (wand.to.y - wand.from.y) * t)}`;
const stick = (from: number, to: number, color: string, width: number) =>
  `<path d="M${wandAt(from)}L${wandAt(to)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
const wandParts = `${stick(0, 1, "var(--line)", 16)}
  ${stick(0.02, 0.98, "var(--main-deep)", 8)}
  ${stick(0.02, 0.12, "#fff", 8)}
  ${stick(0.88, 0.98, "#fff", 8)}
  ${sparkle(352, 0, 11, "trimLight")}
  ${sparkle(380, 34, 7, "trimLight")}
  ${sparkle(344, -30, 6, "trimLight")}`;

export const hat = vessel({
  id: "hat",
  label: "Magician's hat",
  palette: { main: "#2c2a3a", trim: "#e23a54" },
  width: WIDTH,
  height: HEIGHT,
  inside,
  silhouette,
  bodyTop: 110,
  bubbleY: 300,
  leftmost: leftEdge(silhouette),
  ground: { y: GROUND, rx: 160 },
  back: `${fill(brim.hollow(inside), "mainDeep")}
    <path d="${swirl}" fill="none" stroke="var(--trim)" stroke-opacity=".22" stroke-width="9" stroke-linecap="round"/>
    ${brim.back}
    ${ears}`,
  front: `${shell(silhouette, inside, WIDTH, 12)}
    ${highlight(`M58 140L55 340`, 4, 0.35)}
    ${part(band, "trim", "trimDark", 6)}
    ${bandStars}
    ${brim.front}
    ${highlight(`M${CX - 160} ${num(BRIM.y + 12)}Q${CX - 120} ${num(BRIM.y + 24)} ${CX - 70} ${num(BRIM.y + 28)}`, 3.5, 0.4)}
    ${wandParts}
    ${sparkle(14, 150, 9)}
    ${sparkle(30, 30, 7)}
    ${sparkle(8, 352, 6)}`,
});
