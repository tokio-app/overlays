// What the jar overlays' pages share: the saved jar and the demo's gifts.
import type { GiftData } from "@tokioapp/overlay";
import { SAMPLE_USERS } from "../samples";
import { pickWeighted, randomInt } from "../util";
import { SAMPLE_GIFTS } from "./gifts";
import { Tally } from "./tally";

// The demo's gifters: the first six sample viewers.
const SAMPLE_GIFTERS = SAMPLE_USERS.slice(0, 6);

/** The jar saved under `key`, or an empty one when there's none or storage is off. */
export function loadTally(key: string, resetMs: number, maxDrops: number) {
  try {
    return Tally.restore(localStorage.getItem(key), resetMs, maxDrops);
  } catch {
    return new Tally(resetMs, maxDrops);
  }
}

export function saveTally(key: string, tally: Tally) {
  try {
    localStorage.setItem(key, tally.serialize());
  } catch {
    // Storage can be full or turned off. The jar still works, it just won't survive a reload.
  }
}

/**
 * Sample gifters send a combo of a sample gift, one event for each gift as on a LIVE, then wait
 * 1 to 3 seconds. Returns a function that stops it.
 */
export function playSample(send: (data: GiftData) => void) {
  let timer: ReturnType<typeof setTimeout>;

  const combo = () => {
    const user = SAMPLE_GIFTERS[randomInt(0, SAMPLE_GIFTERS.length - 1)];
    const gift = pickWeighted(SAMPLE_GIFTS);
    const size = randomInt(1, gift.maxCombo);
    let count = 0;

    const next = () => {
      count++;
      send({
        user,
        gift: {
          id: gift.id,
          name: gift.name,
          coins: gift.coins,
          type: 1,
          comboCount: count,
          repeatEnd: count === size,
          image: gift.image,
        },
      });
      timer =
        count < size
          ? setTimeout(next, 250)
          : setTimeout(combo, randomInt(1000, 3000));
    };
    next();
  };

  timer = setTimeout(combo, 400);
  return () => clearTimeout(timer);
}
