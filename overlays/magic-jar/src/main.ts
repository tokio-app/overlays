import { startJarApp } from "@tokio-overlays/shared/jar/app";
import { css, mix, parseColor, type RGB } from "@tokio-overlays/shared/color";
import { jarById, type JarDesign } from "./jars";
import "./style.css";

let customColors = false;
let jarColor = "#7048d8";
let trimColor = "#e6e0f5";

startJarApp({
  id: "magic-jar",
  jarById,
  // The keys are the field ids in config.yaml.
  readColors: (config) => {
    if (typeof config.custom_colors === "boolean") {
      customColors = config.custom_colors;
    }
    if (typeof config.jar_color === "string") jarColor = config.jar_color;
    if (typeof config.trim_color === "string") trimColor = config.trim_color;
  },
  // Each jar has its own colors, and the streamer may have picked theirs.
  showColors,
});

// The jar's tones, from its own two colors or the streamer's: lighter where the light falls,
// darker in the shade and inside, and its outline darker still. The art only uses these, so
// new colors don't redraw anything.
function showColors(next: JarDesign) {
  const pick = (mine: string, own: string): RGB =>
    (customColors ? parseColor(mine) : null) ?? parseColor(own) ?? [0, 0, 0];
  const main = pick(jarColor, next.palette.main);
  const trim = pick(trimColor, next.palette.trim);
  const tones = {
    "--main": main,
    "--main-light": mix(main, [255, 255, 255], 0.35),
    "--main-dark": mix(main, [0, 0, 0], 0.28),
    "--main-deep": mix(main, [0, 0, 0], 0.6),
    "--trim": trim,
    "--trim-light": mix(trim, [255, 255, 255], 0.55),
    "--trim-dark": mix(trim, [0, 0, 0], 0.3),
    "--line": mix(main, [0, 0, 0], 0.78),
  };
  const root = document.documentElement.style;
  for (const [property, value] of Object.entries(tones)) {
    root.setProperty(property, css(value));
  }
}
