// A tip jar: a straight cylinder with a rolled lip and a very heavy bottom, pushed up from below
// into a dome (the punt).
import { cubic, num, Round } from "./profile";
import { arc, blur, heel, line, rim, roundJar, shape, stop } from "./render";

const jar = new Round({
  width: 280,
  height: 470,
  tilt: [0.09, 0.13],
  outer: [
    { x: 136, y: 16 },
    { x: 140, y: 20 },
    { x: 138, y: 26 },
    { x: 134, y: 29 },
    { x: 134, y: 412 },
    ...cubic(
      { x: 134, y: 412 },
      { x: 134, y: 432 },
      { x: 132, y: 440 },
      { x: 124, y: 444 },
      6,
    ),
  ],
  inner: [
    { x: 126, y: 20 },
    { x: 125, y: 26 },
    { x: 125, y: 372 },
  ],
  floorY: 384,
  corner: 12,
  baseY: 444,
  bodyTop: 40,
  bubbleY: 250,
});

const { cx, base } = jar;
const lip = rim(
  jar,
  jar.ellipse(jar.mouthY, 140),
  jar.ellipse(jar.mouthY, 126),
  6,
);
// The punt: a dome pushed up into the bottom, seen through its thick glass.
const punt = { rx: 74, height: 34, opening: jar.ellipse(base.y, 74) };
const domeTop = `M${num(cx - punt.rx)} ${num(base.y)}A${punt.rx} ${punt.height} 0 0 1 ${num(cx + punt.rx)} ${num(base.y)}`;
const domeInside = `M${num(cx - punt.rx + 6)} ${num(base.y)}A${punt.rx - 6} ${punt.height - 5} 0 0 1 ${num(cx + punt.rx - 6)} ${num(base.y)}`;

export const tip = roundJar({
  id: "tip",
  label: "Tip jar",
  jar,
  glints: [
    { from: -62, to: -44, y0: 34, y1: 240, opacity: 0.3, blur: 4 },
    { from: -62, to: -44, y0: 252, y1: 386, opacity: 0.26, blur: 4 },
    { from: -56, to: -52, y0: 50, y1: 236, opacity: 0.6, blur: 1 },
    { from: -56, to: -52, y0: 256, y1: 376, opacity: 0.5, blur: 1 },
    { from: 53, to: 58, y0: 44, y1: 380, opacity: 0.42, blur: 1 },
  ],
  farGlints: [
    { from: 126, to: 140, y0: 50, y1: 370, opacity: 0.14, blur: 4 },
    { from: -150, to: -144, y0: 60, y1: 360, opacity: 0.1, blur: 2 },
  ],
  parts: {
    defs: `<radialGradient id="jf-punt" cx=".5" cy="1" r="1">
      ${stop(0, "deep", 0.15)}
      ${stop(0.7, "deep", 0.35)}
      ${stop(1, "light", 0.45)}
    </radialGradient>`,
    back: lip.back,
    front: `
      ${shape(`${domeTop}A${num(punt.rx)} ${num(punt.opening.ry)} 0 0 1 ${num(cx - punt.rx)} ${num(base.y)}Z`, "fill:url(#jf-punt)")}
      ${line(domeTop, "white", 0.55, 1.4)}
      ${line(domeInside, "deep", 0.5, 1.6, blur("jf", 0.6))}
      ${line(`M${num(cx - 52)} ${num(base.y - 18)}Q${num(cx - 36)} ${num(base.y - 31)} ${num(cx - 10)} ${num(base.y - 33)}`, "white", 0.7, 2.4, blur("jf", 1))}
      ${line(arc(cx, punt.opening, true), "white", 0.4, 1.2)}
      ${heel(jar, 430)}
      ${lip.front}
    `,
  },
});
