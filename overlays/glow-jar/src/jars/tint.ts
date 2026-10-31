// Repaints a jar's pictures in the main color, when they load and when the color changes. Never
// while gifts drop.

export type RGB = [number, number, number];

/**
 * A layer of the jar: its picture on a canvas, which `paint` redraws in another color. The tint
 * picture says, for each pixel, how much of it the picture's own color made, from 0 to 255: the
 * glow, the ribbon, the haze. Swapping the color moves each pixel by that share of the
 * difference, which is what drawing the art in the new color gives, as glows and gradients mix
 * linearly. The rest keeps its colors.
 */
export interface Layer {
  canvas: HTMLCanvasElement;
  paint(rgb: RGB): void;
}

export async function loadLayer(
  src: string,
  tint: string | undefined,
  own: RGB,
): Promise<Layer> {
  const [picture, shares] = await Promise.all([
    load(src),
    tint ? load(tint) : undefined,
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = picture.naturalWidth;
  canvas.height = picture.naturalHeight;
  const ctx = context(canvas);
  let painted = "";
  return {
    canvas,
    paint(rgb) {
      const key = rgb.join();
      if (key === painted) return;
      painted = key;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(picture, 0, 0);
      if (!shares || key === own.join()) return;
      try {
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const share = pixels(shares, canvas.width, canvas.height);
        const { data } = image;
        const dr = rgb[0] - own[0];
        const dg = rgb[1] - own[1];
        const db = rgb[2] - own[2];
        for (let i = 0; i < data.length; i += 4) {
          const s = share[i] / 255;
          if (s === 0) continue;
          data[i] += dr * s;
          data[i + 1] += dg * s;
          data[i + 2] += db * s;
        }
        ctx.putImageData(image, 0, 0);
      } catch {
        // Pictures that can't be read, say from a server without CORS, keep their own color.
      }
    },
  };
}

function load(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  // Tokio's previews load the overlay from local-resource:, where only CORS lets a page read
  // its own pictures' pixels.
  img.crossOrigin = "anonymous";
  img.src = url;
  return img.decode().then(() => img);
}

// A picture's pixels, read from a canvas of its own.
function pixels(
  img: HTMLImageElement,
  width: number,
  height: number,
): Uint8ClampedArray {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = context(canvas);
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);
  canvas.width = 0;
  canvas.height = 0;
  return data;
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser can't draw the jar.");
  return ctx;
}
