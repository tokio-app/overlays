// A fishbowl: a glass sphere cut flat at the bottom, with a wide rolled rim at the top. The
// fill limit only counts the bowl below its middle, so the gifts never reach the overhang.
import { pathOf, range, Round } from "./profile";
import { blur, line, rim, ringArc, roundJar } from "./render";

// The sphere's center and radius, outside and inside.
const CENTER_Y = 172;
const OUTER = 188;
const INNER = 180;

const sphere = (radius: number, y: number) =>
  Math.sqrt(Math.max(0, radius ** 2 - (y - CENTER_Y) ** 2));

const jar = new Round({
  width: 380,
  height: 362,
  tilt: [0.1, 0.14],
  outer: [
    { x: 118, y: 12 },
    { x: 124, y: 17 },
    { x: 122, y: 22 },
    ...range(25, 340, 5).map((y) => ({ x: sphere(OUTER, y), y })),
  ],
  inner: [
    { x: 108, y: 17 },
    { x: 103, y: 23 },
    ...range(26, 318, 5).map((y) => ({ x: sphere(INNER, y), y })),
  ],
  floorY: 328,
  corner: 10,
  baseY: 340,
  bodyTop: CENTER_Y,
  bubbleY: 206,
});

const roll = rim(
  jar,
  jar.ellipse(jar.mouthY, 124),
  jar.ellipse(jar.mouthY, 108),
  7,
);

export const fishbowl = roundJar({
  id: "fishbowl",
  label: "Fishbowl",
  jar,
  glints: [
    { from: -60, to: -34, y0: 44, y1: 150, opacity: 0.32, blur: 4 },
    { from: -60, to: -34, y0: 162, y1: 262, opacity: 0.24, blur: 4 },
    { from: -50, to: -46, y0: 56, y1: 146, opacity: 0.6, blur: 1 },
    { from: -50, to: -46, y0: 166, y1: 250, opacity: 0.45, blur: 1 },
    { from: 48, to: 56, y0: 100, y1: 262, opacity: 0.4, blur: 1 },
  ],
  farGlints: [
    { from: 126, to: 142, y0: 80, y1: 270, opacity: 0.16, blur: 4 },
    { from: -152, to: -144, y0: 100, y1: 250, opacity: 0.1, blur: 2 },
  ],
  parts: {
    back: roll.back,
    // A curved line of light just inside the bowl's left edge, and one across its lower half.
    front: `
      ${line(pathOf(jar.meridian(-84, 70, 290, 4)), "white", 0.4, 3, blur("jf", 1.5))}
      ${line(ringArc(jar, 296, jar.outerAt(296) - 3, -70, -22), "white", 0.35, 2.5, blur("jf", 2))}
      ${roll.front}
    `,
  },
});
