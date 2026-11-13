// How a banner or card comes in and leaves, from the side it's aligned to.
import type { ALIGNS } from "./settings";

/** The entrance setting's options. */
export const ENTRANCES = [
  "slide",
  "fade",
  "pop",
  "drop",
  "flip",
  "wipe",
] as const;

/** The settings an entrance reads. */
export interface EntranceSettings {
  align: (typeof ALIGNS)[number];
  entrance: (typeof ENTRANCES)[number];
}

/** An animation of the banner or card. */
export interface Motion {
  frames: Keyframe[];
  duration: number;
  easing: string;
  // Where the element grows or squashes from
  origin: string;
}

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

/** Plays the motion on the element, from its origin. */
export function play(
  el: HTMLElement,
  { frames, duration, easing, origin }: Motion,
  fill?: FillMode,
) {
  el.style.transformOrigin = origin;
  return el.animate(frames, { duration, easing, fill });
}

/**
 * How the element comes in, from the side it's aligned to. Less motion leaves a fade. `radius` is
 * the wipe's corners, the element's own.
 */
export function entrance(settings: EntranceSettings, radius: string): Motion {
  const { align } = settings;
  const x = { left: "0%", center: "50%", right: "100%" }[align];
  const origin = `${x} 50%`;
  switch (reduceMotion.matches ? "fade" : settings.entrance) {
    case "slide": {
      const from =
        align === "center"
          ? "translateY(0.75rem)"
          : `translateX(${align === "right" ? 1.5 : -1.5}rem)`;
      return {
        frames: [
          { opacity: 0, transform: from },
          { opacity: 1, transform: "none" },
        ],
        duration: 320,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        origin,
      };
    }
    case "pop":
      // It grows from its side, a little past its size, and settles.
      return {
        frames: [
          { opacity: 0, transform: "scale(0.55)" },
          { opacity: 1, transform: "scale(1.06)", offset: 0.55 },
          { transform: "scale(0.98)", offset: 0.8 },
          { transform: "none" },
        ],
        duration: 460,
        easing: "ease-out",
        origin,
      };
    case "drop":
      // It falls, squashes as it lands, and bounces once.
      return {
        frames: [
          {
            opacity: 0,
            transform: "translateY(-1.8rem)",
            easing: "cubic-bezier(0.5, 0, 1, 0.5)",
          },
          { opacity: 1, offset: 0.25 },
          {
            transform: "translateY(0) scale(1.05, 0.9)",
            offset: 0.55,
            easing: "ease-out",
          },
          {
            transform: "translateY(-0.3rem) scale(0.99, 1.02)",
            offset: 0.78,
            easing: "ease-in",
          },
          { transform: "none" },
        ],
        duration: 620,
        easing: "linear",
        origin: `${x} 100%`,
      };
    case "flip":
      // It turns down into place like a flap on a departures board.
      return {
        frames: [
          { opacity: 0, transform: "perspective(40rem) rotateX(-90deg)" },
          {
            opacity: 1,
            transform: "perspective(40rem) rotateX(14deg)",
            offset: 0.6,
          },
          { transform: "perspective(40rem) rotateX(-5deg)", offset: 0.82 },
          { transform: "perspective(40rem) rotateX(0deg)" },
        ],
        duration: 560,
        easing: "ease-out",
        origin,
      };
    case "wipe": {
      // It's uncovered from its side, or from the middle out when centered. It ends wider than the
      // element, so a glow around it is already there when the clip goes.
      const hidden = {
        left: `inset(0 100% 0 0 round ${radius})`,
        center: `inset(0 50% 0 50% round ${radius})`,
        right: `inset(0 0 0 100% round ${radius})`,
      }[align];
      return {
        frames: [
          { clipPath: hidden },
          { clipPath: `inset(-1.5rem round ${radius})` },
        ],
        duration: 420,
        easing: "cubic-bezier(0.3, 0.7, 0.4, 1)",
        origin,
      };
    }
    default:
      return {
        frames: [{ opacity: 0 }, { opacity: 1 }],
        duration: 400,
        easing: "ease-out",
        origin,
      };
  }
}

/** How the element leaves: the way it came in, backwards and faster. A dropped one falls out. */
export function leaving(settings: EntranceSettings, radius: string): Motion {
  const motion = entrance(settings, radius);
  if (settings.entrance === "drop" && !reduceMotion.matches) {
    return {
      ...motion,
      frames: [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: "translateY(1rem)" },
      ],
      duration: 260,
      easing: "ease-in",
    };
  }
  return {
    ...motion,
    frames: [...motion.frames]
      .reverse()
      .map((frame) =>
        frame.offset == null ? frame : { ...frame, offset: 1 - frame.offset },
      ),
    duration: Math.round(motion.duration * 0.6),
    easing: "ease-in",
  };
}
