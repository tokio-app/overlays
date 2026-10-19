// A candy jar: a tall cylinder, a rounded shoulder into a wide, short neck with a thick flared
// rim, standing on a short solid stem and a disc foot.
import { cubic, num, pathOf, Round } from "./profile";
import {
  arc,
  bandFront,
  blur,
  heel,
  line,
  paint,
  rim,
  roundJar,
  shape,
  stop,
} from "./render";

const jar = new Round({
  width: 330,
  height: 500,
  tilt: [0.09, 0.135],
  outer: [
    { x: 128, y: 20 },
    { x: 128, y: 28 },
    ...cubic(
      { x: 128, y: 28 },
      { x: 121, y: 31 },
      { x: 107, y: 33 },
      { x: 106, y: 42 },
      6,
    ),
    { x: 106, y: 58 },
    ...cubic(
      { x: 106, y: 58 },
      { x: 106, y: 98 },
      { x: 150, y: 86 },
      { x: 150, y: 126 },
      16,
    ),
    { x: 150, y: 392 },
    ...cubic(
      { x: 150, y: 392 },
      { x: 150, y: 414 },
      { x: 140, y: 424 },
      { x: 118, y: 426 },
      6,
    ),
    ...cubic(
      { x: 118, y: 426 },
      { x: 84, y: 428 },
      { x: 50, y: 430 },
      { x: 46, y: 440 },
      6,
    ),
    { x: 46, y: 452 },
    ...cubic(
      { x: 46, y: 452 },
      { x: 46, y: 460 },
      { x: 64, y: 462 },
      { x: 114, y: 463 },
      6,
    ),
    { x: 118, y: 465 },
    { x: 118, y: 474 },
  ],
  inner: [
    { x: 96, y: 20 },
    { x: 94, y: 30 },
    { x: 94, y: 60 },
    ...cubic(
      { x: 94, y: 60 },
      { x: 94, y: 102 },
      { x: 138, y: 92 },
      { x: 138, y: 130 },
      16,
    ),
    { x: 138, y: 386 },
  ],
  floorY: 400,
  corner: 14,
  baseY: 426,
  bodyTop: 130,
  bubbleY: 262,
});

const { cx, base } = jar;
const flare = rim(
  jar,
  jar.ellipse(jar.mouthY, 128),
  jar.ellipse(jar.mouthY, 96),
  8,
  22,
);
const footTop = jar.ellipse(465, 118);
// The bowl's underside, the stem and its flare, down to the foot: solid glass.
const stem = `${pathOf(jar.outerSide(-1, base.y, 463))} ${pathOf(jar.outerSide(1, base.y, 463).reverse(), "L")} A${num(base.rx)} ${num(base.ry)} 0 0 1 ${num(cx - base.rx)} ${num(base.y)}Z`;

export const apothecary = roundJar({
  id: "apothecary",
  label: "Candy jar",
  jar,
  glints: [
    { from: -62, to: -44, y0: 64, y1: 250, opacity: 0.3, blur: 4 },
    { from: -62, to: -44, y0: 262, y1: 396, opacity: 0.26, blur: 4 },
    { from: -56, to: -52, y0: 84, y1: 246, opacity: 0.6, blur: 1 },
    { from: -56, to: -52, y0: 266, y1: 386, opacity: 0.5, blur: 1 },
    { from: 53, to: 58, y0: 110, y1: 392, opacity: 0.42, blur: 1 },
  ],
  farGlints: [
    { from: 126, to: 140, y0: 140, y1: 390, opacity: 0.14, blur: 4 },
    { from: -150, to: -144, y0: 150, y1: 380, opacity: 0.1, blur: 2 },
  ],
  parts: {
    defs: `<linearGradient id="jf-under" x1="0" x2="0" y1="0" y2="1">
      ${stop(0, "deep", 0.55)}
      ${stop(0.5, "glass", 0.3)}
      ${stop(1, "light", 0.25)}
    </linearGradient>
    <linearGradient id="jf-rod" x1="0" x2="1" y1="0" y2="0">
      ${stop(0, "deep", 0.55)}
      ${stop(0.12, "glass", 0.35)}
      ${stop(0.32, "white", 0.55)}
      ${stop(0.42, "light", 0.35)}
      ${stop(0.62, "deep", 0.35)}
      ${stop(0.82, "light", 0.4)}
      ${stop(0.9, "glass", 0.35)}
      ${stop(1, "deep", 0.55)}
    </linearGradient>
    <linearGradient id="jf-foot" x1="0" x2="0" y1="0" y2="1">
      ${stop(0, "white", 0.7)}
      ${stop(0.4, "light", 0.35)}
      ${stop(1, "deep", 0.6)}
    </linearGradient>`,
    back: flare.back,
    // The foot's top, seen from above, then its front edge, and the stem standing on it.
    inner: `
      ${shape(`M${num(cx - footTop.rx)} ${num(footTop.y)} A${num(footTop.rx)} ${num(footTop.ry)} 0 1 1 ${num(cx + footTop.rx)} ${num(footTop.y)} A${num(footTop.rx)} ${num(footTop.ry)} 0 1 1 ${num(cx - footTop.rx)} ${num(footTop.y)}Z`, paint("fill", "light", 0.22))}
      ${line(arc(cx, footTop, false), "white", 0.35, 1.2)}
      ${shape(bandFront(cx, footTop, 9), "fill:url(#jf-foot)")}
      ${shape(stem, "fill:url(#jf-rod)")}
      ${line(arc(cx, footTop, true), "white", 0.75, 1.4)}
      ${line(arc(cx, { ...footTop, y: footTop.y + 9 }, true), "deep", 0.6, 1.4)}
      ${line(`M${num(cx - 16)} ${num(base.y + 12)}V${num(footTop.y - 4)}`, "white", 0.6, 4, blur("jf", 1.5))}
      <ellipse cx="${num(cx - 74)}" cy="${num(footTop.y + 13)}" rx="9" ry="2" fill="#fff" opacity=".7" ${blur("jf", 1)}/>
    `,
    // The flare's underside, in the shadow of the rim.
    front: `
      ${shape(jar.strip(-90, 90, 28, 44), "fill:url(#jf-under)")}
      ${heel(jar, 418)}
      ${flare.front}
    `,
  },
});
