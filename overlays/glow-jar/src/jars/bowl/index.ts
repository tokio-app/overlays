// The crystal bowl: clear glass with a fluted rim, a round belly and three curled feet, and a rope
// tied in a bow round its neck that the top gifter's tag hangs from, glowing softly in Tokio's
// rose. Its pictures leave room round the bowl for the glow and the shadow.
import type { JarPictures } from "../types";
import backTint from "./back-tint.png";
import back from "./back.png";
import frontTint from "./front-tint.png";
import front from "./front.png";
import walls from "./walls.png?inline";

export const bowl: JarPictures = {
  width: 460,
  height: 450,
  back,
  front,
  color: "#f43f5e",
  backTint,
  frontTint,
  walls,
  cord: "rope",
  // The neck's waist, where the rope is, so the pile fills the belly.
  bodyTop: 140,
  tag: { x: 330, y: 162 },
  sparkles: [
    // Glints on the rim's tips and the base, and stars in the belly.
    { x: 46, y: 61, r: 8 },
    { x: 414, y: 62, r: 6 },
    { x: 322, y: 394, r: 6 },
    { x: 150, y: 226, r: 9 },
    { x: 232, y: 196, r: 6 },
    { x: 250, y: 262, r: 11 },
    { x: 168, y: 318, r: 5 },
    { x: 112, y: 276, r: 7 },
    { x: 214, y: 344, r: 4 },
    { x: 190, y: 246, r: 1.8 },
    { x: 266, y: 224, r: 2.2 },
    { x: 108, y: 238, r: 1.6 },
    { x: 236, y: 322, r: 2 },
    { x: 140, y: 356, r: 1.8 },
    { x: 200, y: 290, r: 1.6 },
  ],
  bubbles: {
    left: [
      { x: 57, y: 205 },
      { x: 48, y: 275 },
      { x: 79, y: 345 },
    ],
    right: [
      { x: 413, y: 240 },
      { x: 403, y: 310 },
      { x: 352, y: 372 },
    ],
  },
};
