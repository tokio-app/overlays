import { PLACEHOLDER } from "./icons";

/** A whole number from `min` to `max`, both included. */
export function randomInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// One of the items, the likelier the heavier its weight.
export function pickWeighted<T extends { weight: number }>(
  items: readonly T[],
): T {
  let left = Math.random() * items.reduce((sum, item) => sum + item.weight, 0);
  for (const item of items) {
    left -= item.weight;
    if (left < 0) return item;
  }
  return items[0];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function hours(value: number) {
  return value * 60 * 60 * 1000;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function find<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`#${id} is missing.`);
  return el;
}

// A viewer's photo. The placeholder stays under the picture, so it shows while the picture loads
// or if it fails.
export function setPicture(photo: HTMLElement, url: string) {
  photo.innerHTML = PLACEHOLDER;
  if (!url) return;

  const img = new Image();
  img.alt = "";
  img.decoding = "async";
  // TikTok's image servers can refuse requests that name another site.
  img.referrerPolicy = "no-referrer";
  img.addEventListener("error", () => img.remove(), { once: true });
  img.src = url;
  photo.append(img);
}
