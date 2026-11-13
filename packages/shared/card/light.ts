// The kinds of light behind the gift, each drawn in a 200 x 200 box centered on it, in the light
// color's tones (CSS variables). Most sit on a dark glow (.halo) that keeps them, and the text over
// them, readable on any video. Each moving part is an element of its own, which style.css turns,
// sweeps or scales, so the motion runs on the compositor and nothing is painted again.

export const LIGHTS = [
  "rays",
  "sunburst",
  "spiral",
  "spotlights",
  "burst",
  "ripples",
  "star",
  "hearts",
  "glow",
  "none",
] as const;
export type Light = (typeof LIGHTS)[number];

const BOX = 'viewBox="-100 -100 200 200"';
const HALO = '<div class="halo"></div>';
const CORE = '<div class="core"></div>';

// The point `along` a line at `degrees`, moved `across` it.
function at(degrees: number, along: number, across = 0) {
  const a = (degrees * Math.PI) / 180;
  const x = Math.cos(a) * along - Math.sin(a) * across;
  const y = Math.sin(a) * along + Math.cos(a) * across;
  return `${x.toFixed(2)} ${y.toFixed(2)}`;
}

// A fill that fades out toward the box's edge, from stops of [offset, tone, opacity].
function fade(id: string, stops: [number, string, number][]) {
  const list = stops
    .map(
      ([offset, tone, opacity]) =>
        `<stop offset="${offset}" style="stop-color: var(--${tone})" stop-opacity="${opacity}"/>`,
    )
    .join("");
  return `<radialGradient id="${id}" cx="0" cy="0" r="100" gradientUnits="userSpaceOnUse">${list}</radialGradient>`;
}

// A wedge from the middle out to `length`, `half` degrees to each side of `degrees`.
function wedge(degrees: number, half: number, length: number) {
  return `M0 0L${at(degrees - half, length)}L${at(degrees + half, length)}Z`;
}

function svg(className: string, defs: string, body: string) {
  return `<svg class="${className}" ${BOX} aria-hidden="true">${defs}${body}</svg>`;
}

// Long thin rays of uneven length turning one way, and broad soft ones turning the other. Each long
// ray: its length, half its width at the root, and how far it's nudged off even spacing.
const LONG: [number, number, number][] = [
  [96, 5, 0],
  [70, 3.5, 3],
  [88, 4.5, -2],
  [64, 3, 4],
  [92, 5.5, -3],
  [74, 3.5, 2],
  [98, 6, 0],
  [66, 3, -4],
  [84, 4.5, 3],
  [72, 3.5, -1],
  [94, 5, 2],
  [62, 3, -3],
  [90, 5.5, 1],
  [76, 4, 4],
  [86, 4.5, -2],
  [68, 3, 3],
  [97, 6, -1],
  [71, 3.5, 2],
];

function rays() {
  const long = LONG.map(([length, half, nudge], i) => {
    const degrees = (i * 360) / LONG.length + nudge;
    // From close to the middle, so their roots leave no ring.
    return `M${at(degrees, 1.5, -half)}L${at(degrees, length)}L${at(degrees, 1.5, half)}Z`;
  }).join("");
  const broad = Array.from({ length: 9 }, (_, i) =>
    wedge(((i + 0.5) * 360) / 9, 7, 96),
  ).join("");
  return (
    HALO +
    svg(
      "rays-broad",
      fade("lg-broad", [
        [0, "ray-light", 0.3],
        [1, "ray", 0],
      ]),
      `<path d="${broad}" fill="url(#lg-broad)"/>`,
    ) +
    svg(
      "rays-long",
      fade("lg-long", [
        [0.08, "ray-light", 1],
        [0.45, "ray", 0.8],
        [1, "ray", 0],
      ]),
      `<path d="${long}" fill="url(#lg-long)"/>`,
    ) +
    CORE
  );
}

// Even stripes all the way round, like a prize behind a game show's curtain.
function sunburst() {
  const count = 16;
  const stripes = Array.from({ length: count }, (_, i) =>
    wedge((i * 360) / count, 360 / count / 4, 100),
  ).join("");
  return (
    HALO +
    svg(
      "sunburst",
      fade("lg-sun", [
        [0, "ray-light", 0.95],
        [0.4, "ray", 0.75],
        [1, "ray", 0],
      ]),
      `<path d="${stripes}" fill="url(#lg-sun)"/>`,
    ) +
    CORE
  );
}

// Curved arms swirling out from the gift, each widest a third of the way out and a point at its
// tip.
function spiral() {
  const arms = 9;
  const steps = 24;
  const arm = (start: number) => {
    const point = (t: number): [number, number] => {
      const radius = 4 + 94 * t;
      const a = ((start + 120 * t) * Math.PI) / 180;
      return [Math.cos(a) * radius, Math.sin(a) * radius];
    };
    const left: string[] = [];
    const right: string[] = [];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const [x, y] = point(t);
      const [nx, ny] = point(Math.min(1, t + 0.01));
      const length = Math.hypot(nx - x, ny - y) || 1;
      // Across the arm, square to the way it runs.
      const [ax, ay] = [-(ny - y) / length, (nx - x) / length];
      const half =
        6 * Math.sin(Math.PI * Math.min(1, t * 1.2)) ** 0.8 * (1 - 0.3 * t);
      left.push(`${(x + ax * half).toFixed(2)} ${(y + ay * half).toFixed(2)}`);
      right.push(`${(x - ax * half).toFixed(2)} ${(y - ay * half).toFixed(2)}`);
    }
    return `M${left.join("L")}L${right.reverse().join("L")}Z`;
  };
  const d = Array.from({ length: arms }, (_, i) => arm((i * 360) / arms)).join(
    "",
  );
  return (
    HALO +
    svg(
      "spiral",
      fade("lg-spiral", [
        [0.05, "ray-light", 1],
        [0.5, "ray", 0.8],
        [1, "ray", 0],
      ]),
      `<path d="${d}" fill="url(#lg-spiral)"/>`,
    ) +
    CORE
  );
}

// Two pairs of searchlight beams crossing behind the gift, sweeping opposite ways.
function spotlights() {
  const defs = (id: string) =>
    fade(`${id}-soft`, [
      [0, "ray-light", 0.6],
      [0.6, "ray", 0.3],
      [1, "ray", 0],
    ]) +
    fade(id, [
      [0, "ray-light", 1],
      [0.6, "ray", 0.75],
      [1, "ray", 0],
    ]);
  const beams = (id: string, angles: number[]) =>
    angles
      .map(
        (degrees) =>
          `<path d="${wedge(degrees, 15, 100)}" fill="url(#${id}-soft)"/><path d="${wedge(degrees, 6, 100)}" fill="url(#${id})"/>`,
      )
      .join("");
  return (
    HALO +
    svg("beams-a", defs("lg-beam-a"), beams("lg-beam-a", [-60, 120])) +
    svg("beams-b", defs("lg-beam-b"), beams("lg-beam-b", [-120, 60])) +
    CORE
  );
}

// A jagged comic-book burst, outlined like the text, with a lighter one inside it.
function burst() {
  const outer = [
    82, 70, 78, 66, 84, 72, 76, 68, 82, 70, 78, 66, 84, 72, 76, 68,
  ];
  const points = (scale: number) =>
    outer
      .flatMap((length, i) => {
        const degrees = (i * 360) / outer.length - 90;
        return [
          at(degrees, length * scale),
          at(degrees + 180 / outer.length, (50 + (i % 3) * 3) * scale),
        ];
      })
      .join("L");
  return svg(
    "burst",
    `<linearGradient id="lg-burst" x1="0" y1="-84" x2="0" y2="84" gradientUnits="userSpaceOnUse">
      <stop offset="0" style="stop-color: var(--ray-light)"/>
      <stop offset=".55" style="stop-color: var(--ray)"/>
      <stop offset="1" style="stop-color: var(--ray-deep)"/>
    </linearGradient>`,
    `<path class="burst-edge" d="M${points(1)}Z" fill="url(#lg-burst)"/>
    <path d="M${points(0.7)}Z" style="fill: var(--ray-light)" fill-opacity=".45"/>`,
  );
}

// Rings spreading out from the gift and fading, one after another.
function ripples() {
  return HALO + '<div class="ripple"></div>'.repeat(4) + CORE;
}

// A big four-pointed star, and a smaller one across it that twinkles.
function star() {
  const star4 = (long: number, waist: number, turn: number) => {
    const tip = (degrees: number) => at(degrees + turn, long);
    const side = (degrees: number) => at(degrees + turn, waist * Math.SQRT2);
    return `M${tip(-90)}Q${side(-45)} ${tip(0)}Q${side(45)} ${tip(90)}Q${side(135)} ${tip(180)}Q${side(225)} ${tip(270)}Z`;
  };
  const shine = (id: string) =>
    `<radialGradient id="${id}" cx="0" cy="0" r="100" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity=".95"/>
      <stop offset=".22" style="stop-color: var(--ray-light)" stop-opacity=".9"/>
      <stop offset=".6" style="stop-color: var(--ray)" stop-opacity=".55"/>
      <stop offset="1" style="stop-color: var(--ray)" stop-opacity="0"/>
    </radialGradient>`;
  return (
    HALO +
    svg(
      "star-a",
      shine("lg-star-a"),
      `<path d="${star4(98, 7, 0)}" fill="url(#lg-star-a)"/>`,
    ) +
    svg(
      "star-b",
      shine("lg-star-b"),
      `<path d="${star4(62, 6, 45)}" fill="url(#lg-star-b)"/>`,
    ) +
    CORE
  );
}

// Hearts going round the gift, staying upright, big and small in turn.
function hearts() {
  const count = 6;
  const heart = `<svg viewBox="-14 -13 28 24" aria-hidden="true"><path d="M0 9C-12 1-13-8-6.5-10.5-3-11.8-.6-9.6 0-7.4.6-9.6 3-11.8 6.5-10.5 13-8 12 1 0 9Z"/><ellipse class="shine" cx="-5.5" cy="-5.5" rx="3" ry="1.8" transform="rotate(-35 -5.5 -5.5)"/></svg>`;
  const ring = Array.from({ length: count }, (_, i) => {
    // Starting a sixth of a turn round, so none sits on the title or the coins while still.
    const a = ((i * 360) / count - 60) * (Math.PI / 180);
    // Its middle 90% of the way out, clear of the text in the stacked layout.
    const left = 50 + Math.cos(a) * 45;
    const top = 50 + Math.sin(a) * 45;
    const size = i % 2 ? "small" : "big";
    return `<span class="heart ${size}" style="left: ${left.toFixed(2)}%; top: ${top.toFixed(2)}%">${heart}</span>`;
  }).join("");
  return `${HALO}<div class="orbit">${ring}</div>${CORE}`;
}

// Only the glow, breathing.
function glow() {
  return `${HALO}<div class="core glow-core"></div>`;
}

const DRAW: Record<Light, () => string> = {
  rays,
  sunburst,
  spiral,
  spotlights,
  burst,
  ripples,
  star,
  hearts,
  glow,
  none: () => "",
};

/** The markup of a kind of light. */
export function drawLight(light: Light) {
  return DRAW[light]();
}
