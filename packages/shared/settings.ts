// Readers for the settings Tokio sends. Each returns the fallback for a missing or bad value, so
// the setting keeps its previous one.

export const ALIGNS = ["left", "center", "right"] as const;

// The font setting's limit.
export const FONT_MAX_LENGTH = 60;
const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;

export function oneOf<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
): T {
  return options.find((option) => option === value) ?? fallback;
}

export function number(value: unknown, min: number, fallback: number) {
  return typeof value === "number" && value >= min ? value : fallback;
}

export function boolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function color(value: unknown, fallback: string) {
  return typeof value === "string" && HEX.test(value) ? value : fallback;
}
