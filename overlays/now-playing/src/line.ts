// One line of text on the card. A new text slides up in place of the old one, and a text wider
// than the card scrolls to its end and back, or ends in an ellipsis with less motion.

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

/** How long a text takes to change, in ms. */
export const CHANGE_MS = 450;
export const EASE = "cubic-bezier(0.3, 0.7, 0.3, 1)";
// The old text is gone by OUT_MS, and the new one rises in from IN_AT, so the two lines' texts
// never stack up half way: the new song over the old artist read as one garbled line.
const OUT_MS = 200;
const IN_AT = 180;
// A long text waits this long at each end, in ms.
const PAUSE_MS = 2000;
// How fast it scrolls, in rem per second.
const SPEED = 2.5;

/**
 * Scrolls `run` to its end and back inside `box` when it's wider than the room between the box's
 * side paddings, where a scrolling text fades out. `box` has data-scroll while it scrolls, which
 * drops the ellipsis. Returns the animation, or undefined when the text fits.
 */
export function scrollAcross(box: HTMLElement, run: HTMLElement) {
  const pad = parseFloat(getComputedStyle(box).paddingLeft) || 0;
  const room = box.clientWidth - 2 * pad;
  // The text, no longer cut by an ellipsis, as wide as it is. Layout widths, which the card's
  // entrance doesn't change: a bounding box read during Pop came out at 55%.
  box.dataset.scroll = "";
  const distance = run.offsetWidth - room;
  if (room <= 0 || distance <= 1) {
    delete box.dataset.scroll;
    return undefined;
  }
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const travel = (distance / (SPEED * (rem || 24))) * 1000;
  const total = 2 * PAUSE_MS + 2 * travel;
  const pause = PAUSE_MS / total;
  const end = pause + travel / total;
  const there = `translateX(${-distance}px)`;
  return run.animate(
    [
      { transform: "translateX(0)", offset: 0 },
      { transform: "translateX(0)", offset: pause, easing: "ease-in-out" },
      { transform: there, offset: end },
      { transform: there, offset: end + pause, easing: "ease-in-out" },
      { transform: "translateX(0)", offset: 1 },
    ],
    { duration: total, iterations: Infinity },
  );
}

/** The line holds two, one leaving as the other comes in. */
interface Slot {
  el: HTMLElement;
  run: HTMLElement;
  scroll?: Animation;
  leave?: Animation;
}

export class Line {
  /** What the line shows, or "" before the first text. */
  text = "";
  private readonly slots: [Slot, Slot];
  private current = 0;

  constructor(root: HTMLElement) {
    const make = (): Slot => {
      const run = document.createElement("span");
      run.className = "run";
      const el = document.createElement("span");
      el.className = "slot";
      el.append(run);
      root.append(el);
      return { el, run };
    };
    this.slots = [make(), make()];
    this.slots[1].el.hidden = true;
  }

  /** Shows the text: the old one rises and fades out, then the new one rises in from below. */
  set(text: string, animate: boolean) {
    if (text === this.text) return;
    this.text = text;
    const from = this.slots[this.current];
    this.current = 1 - this.current;
    const to = this.slots[this.current];
    this.retire(to);
    to.run.textContent = text;
    to.el.hidden = false;
    if (!animate || from.el.hidden) {
      this.retire(from);
      return;
    }
    // Only a fade, with less motion.
    const move = (y: string) => (reduceMotion.matches ? "none" : y);
    from.el.classList.add("out");
    const out = from.el.animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: move("translateY(-45%)") },
      ],
      { duration: OUT_MS, easing: "ease-in", fill: "forwards" },
    );
    from.leave = out;
    out.addEventListener("finish", () => {
      if (from.leave === out) this.retire(from);
    });
    to.el.animate(
      [
        { opacity: 0, transform: move("translateY(45%)") },
        { opacity: 1, transform: "none" },
      ],
      {
        duration: CHANGE_MS - IN_AT,
        delay: IN_AT,
        easing: EASE,
        fill: "backwards",
      },
    );
  }

  /**
   * Works out whether the text fits, and scrolls it if not. Call it when the text, the size, the
   * fonts or the card's width change.
   */
  measure() {
    const slot = this.slots[this.current];
    this.stopScroll(slot);
    if (slot.el.hidden || reduceMotion.matches) return;
    slot.scroll = scrollAcross(slot.el, slot.run);
  }

  private stopScroll(slot: Slot) {
    slot.scroll?.cancel();
    slot.scroll = undefined;
    delete slot.el.dataset.scroll;
  }

  private retire(slot: Slot) {
    slot.leave?.cancel();
    slot.leave = undefined;
    this.stopScroll(slot);
    slot.el.classList.remove("out");
    slot.el.hidden = true;
  }
}
