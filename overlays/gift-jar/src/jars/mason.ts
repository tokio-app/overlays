// A mason jar: a rounded lip, a threaded neck, a sloped shoulder and a thick bottom.
import { cubic, Round } from "./profile";
import { heel, helix, rim, roundJar, threads } from "./render";

const jar = new Round({
  width: 360,
  height: 480,
  tilt: [0.095, 0.13],
  outer: [
    { x: 152, y: 22 },
    { x: 152, y: 32 },
    { x: 148, y: 37 },
    { x: 148, y: 100 },
    ...cubic(
      { x: 148, y: 100 },
      { x: 148, y: 146 },
      { x: 172, y: 136 },
      { x: 172, y: 188 },
      16,
    ),
    { x: 172, y: 420 },
    ...cubic(
      { x: 172, y: 420 },
      { x: 172, y: 438 },
      { x: 170, y: 446 },
      { x: 164, y: 449 },
      6,
    ),
  ],
  inner: [
    { x: 135, y: 22 },
    { x: 134, y: 30 },
    { x: 134, y: 102 },
    ...cubic(
      { x: 134, y: 102 },
      { x: 134, y: 150 },
      { x: 158, y: 140 },
      { x: 158, y: 192 },
      16,
    ),
    { x: 158, y: 423 },
  ],
  floorY: 437,
  corner: 14,
  baseY: 449,
  bodyTop: 130,
  bubbleY: 268,
});

const lip = rim(
  jar,
  jar.ellipse(jar.mouthY, 152),
  jar.ellipse(jar.mouthY, 135),
  11,
  16,
);
// One thread winding twice round the neck. It starts and ends at the back, where its tapered
// ends are only seen through the glass.
const thread = threads(helix(jar, 46, 151.5, 18, -200, 520, 7));

export const mason = roundJar({
  id: "mason",
  label: "Mason jar",
  jar,
  glints: [
    // A window on the left, its frame splitting it, and a narrow lamp on the right.
    { from: -62, to: -44, y0: 108, y1: 300, opacity: 0.3, blur: 4 },
    { from: -62, to: -44, y0: 312, y1: 422, opacity: 0.26, blur: 4 },
    { from: -56, to: -52, y0: 126, y1: 296, opacity: 0.6, blur: 1 },
    { from: -56, to: -52, y0: 316, y1: 410, opacity: 0.5, blur: 1 },
    { from: 53, to: 58, y0: 150, y1: 414, opacity: 0.42, blur: 1 },
    { from: -60, to: -50, y0: 40, y1: 98, opacity: 0.22, blur: 1 },
  ],
  farGlints: [
    { from: 126, to: 140, y0: 196, y1: 414, opacity: 0.14, blur: 4 },
    { from: -150, to: -144, y0: 200, y1: 404, opacity: 0.1, blur: 2 },
  ],
  parts: {
    back: `${lip.back}${thread.back}`,
    front: `${thread.front}${heel(jar, 441)}${lip.front}`,
  },
});
