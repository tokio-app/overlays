// The mason jar: clear glass with a steel band, a ribbon tied round the neck and a bow the top
// gifter's tag hangs from, glowing in Tokio's rose. Its pictures leave room round the jar for the
// glow and the shadow.
import type { JarPictures } from "../types";
import backTint from "./back-tint.png";
import back from "./back.png";
import frontTint from "./front-tint.png";
import front from "./front.png";
import walls from "./walls.png?inline";

export const mason: JarPictures = {
  width: 400,
  height: 520,
  back,
  front,
  color: "#f43f5e",
  backTint,
  frontTint,
  walls,
  // Below the shoulder, so the pile stops short of the neck.
  bodyTop: 160,
  tag: { x: 282, y: 116 },
  sparkles: [
    { x: 134, y: 216, r: 9 },
    { x: 266, y: 188, r: 6 },
    { x: 228, y: 250, r: 11 },
    { x: 156, y: 308, r: 5 },
    { x: 294, y: 282, r: 7 },
    { x: 188, y: 168, r: 4 },
    { x: 170, y: 234, r: 1.8 },
    { x: 252, y: 224, r: 2.2 },
    { x: 116, y: 270, r: 1.6 },
    { x: 280, y: 338, r: 2 },
    { x: 210, y: 318, r: 1.6 },
    { x: 142, y: 372, r: 1.8 },
  ],
  bubbles: {
    left: [
      { x: 36, y: 269 },
      { x: 36, y: 339 },
      { x: 36, y: 409 },
    ],
    right: [
      { x: 364, y: 234 },
      { x: 364, y: 304 },
      { x: 364, y: 374 },
    ],
  },
};
