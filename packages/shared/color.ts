export type RGB = [number, number, number];

// "#rrggbb", or "#rrggbbaa" with its alpha ignored. Null for anything else.
export function parseColor(color: string): RGB | null {
  const match = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(color.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function mix(a: RGB, b: RGB, amount: number): RGB {
  const at = (i: 0 | 1 | 2) => Math.round(a[i] + (b[i] - a[i]) * amount);
  return [at(0), at(1), at(2)];
}

export function css([r, g, b]: RGB, alpha?: number): string {
  return alpha === undefined
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
