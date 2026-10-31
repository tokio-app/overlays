// Reads a jar's walls picture into the edges its gifts collide with, once, when the overlay loads.
import { areaBelow, simplify } from "./geometry";
import type { JarDesign, JarPictures, Point } from "./types";

/**
 * The jar with its edges. Each row of the walls picture crosses the glass on both sides: where
 * the inside runs across the row, the glass's inner edges are the inner wall, down to the floor;
 * its outer edges are the outside, down to the bottom. Rows are read one unit apart.
 */
// shortcut: each row may cross the glass once on each side, which a jar with an inward lip or two
// lobes (a heart) breaks; trace the picture as a contour when a jar like that comes.
export async function loadDesign(jar: JarPictures): Promise<JarDesign> {
  const img = new Image();
  img.src = jar.walls;
  await img.decode();
  const { naturalWidth: width, naturalHeight: height } = img;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser can't read the jar's walls.");
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);
  canvas.width = 0;
  canvas.height = 0;

  const scale = width / jar.width;
  const solid = (x: number, row: number) =>
    data[(row * width + x) * 4 + 3] > 127;
  const innerLeft: Point[] = [];
  const innerRight: Point[] = [];
  const outerLeft: Point[] = [];
  const outerRight: Point[] = [];
  let floor = 0;
  for (let y = 0; y < jar.height; y++) {
    const row = Math.min(height - 1, Math.floor((y + 0.5) * scale));
    let a = 0;
    while (a < width && !solid(a, row)) a++;
    if (a === width) continue;
    let c = width - 1;
    while (!solid(c, row)) c--;
    outerLeft.push({ x: a / scale, y: y + 0.5 });
    outerRight.push({ x: (c + 1) / scale, y: y + 0.5 });
    // The glass on each side, and the inside between them, unless the row is solid across.
    let b = a;
    while (b < c && solid(b, row)) b++;
    let d = c;
    while (d > b && solid(d, row)) d--;
    if (solid(b, row)) continue;
    innerLeft.push({ x: b / scale, y: y + 0.5 });
    innerRight.push({ x: (d + 1) / scale, y: y + 0.5 });
    floor = y + 1;
  }
  if (innerLeft.length < 2) {
    throw new Error("The jar's walls picture has no inside, open at the top.");
  }

  // The gifts drop through the narrowest opening above the body: the mouth, or the neck under a
  // flared rim.
  let narrowest = 0;
  for (let i = 1; i < innerLeft.length && innerLeft[i].y < jar.bodyTop; i++) {
    const width = innerRight[i].x - innerLeft[i].x;
    if (width < innerRight[narrowest].x - innerLeft[narrowest].x) narrowest = i;
  }
  const mouth = {
    left: innerLeft[narrowest].x,
    right: innerRight[narrowest].x,
    y: innerLeft[narrowest].y,
  };

  const bottomLeft = innerLeft[innerLeft.length - 1];
  const bottomRight = innerRight[innerRight.length - 1];
  const outline = simplify([
    ...innerLeft,
    { x: bottomLeft.x, y: floor },
    { x: bottomRight.x, y: floor },
    ...innerRight.reverse(),
  ]);
  const outside = simplify([...outerLeft, ...outerRight.reverse()]);
  return {
    ...jar,
    outline,
    outside,
    mouth,
    bodyArea: areaBelow(outline, jar.bodyTop),
  };
}
