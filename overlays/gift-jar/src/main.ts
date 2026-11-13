import { startJarApp } from "@tokio-overlays/shared/jar/app";
import type { Jar } from "@tokio-overlays/shared/jar/jar";
import { css, mix, parseColor, type RGB } from "@tokio-overlays/shared/color";
import { jarById } from "./jars";
import "./style.css";

// The default glass color, a cool grey.
const CLEAR_GLASS: RGB = [196, 208, 216];

let glassColor = "#c4d0d8";

startJarApp({
  id: "gift-jar",
  jarById,
  // The keys are the field ids in config.yaml.
  readColors: (config) => {
    if (typeof config.glass_color === "string") glassColor = config.glass_color;
  },
  showColors: (_design, jar) => showGlass(jar),
});

// The glass's tones, from its color: lighter for haze, darker for its edges and thick parts,
// as real glass looks darker where light crosses more of it.
function showGlass(jar: Jar) {
  const rgb = parseColor(glassColor) ?? CLEAR_GLASS;
  const tones = {
    "--glass": rgb,
    "--glass-light": mix(rgb, [255, 255, 255], 0.6),
    "--glass-edge": mix(rgb, [0, 0, 0], 0.5),
    "--glass-deep": mix(rgb, [0, 0, 0], 0.72),
  };
  const root = document.documentElement.style;
  for (const [property, value] of Object.entries(tones)) {
    root.setProperty(property, css(value));
  }
  // Colored glass colors the gifts behind it; clear glass hardly does.
  root.setProperty("--glass-tint", (0.2 * saturation(rgb)).toFixed(3));
  jar.setShade(css(tones["--glass-deep"]));
}

// HSL saturation, 0 to 1.
function saturation(rgb: RGB): number {
  const max = Math.max(...rgb) / 255;
  const min = Math.min(...rgb) / 255;
  const lightness = (max + min) / 2;
  if (max === min) return 0;
  return (max - min) / (1 - Math.abs(2 * lightness - 1));
}
