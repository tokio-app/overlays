import type { GiftData, UserData } from "@tokioapp/overlay";

export interface Gifter {
  handle: string;
  name: string;
  picture: string;
  coins: number;
}

/** A gift in the jar. `coins` is one gift's worth. */
export interface Drop {
  image: string;
  giftId: string;
  coins: number;
}

/** What a GIFT event adds to the jar. */
export interface Gifting {
  /** The gifter and gift's streak, so a message can tell it continues. */
  key: string;
  gifter: Gifter;
  gift: { name: string; image: string; coins: number };
  /** The streak's count and coins so far. */
  count: number;
  coins: number;
  /** The gifts to drop for this event. */
  drops: Drop[];
  /** The jar was emptied first, for sitting too long without gifts. */
  reset: boolean;
}

// Saved across reloads. Gifters below this start over, which keeps the save small.
const SAVED_GIFTERS = 500;
// The slider's top value.
const SAVED_DROPS = 300;
// A lower count this soon after a streak's last event is a late update, not a new streak.
// Updates can arrive out of order within a batch, and TikTok closes a combo 3 to 4 s after its
// last one, so a new combo comes later than this.
const LATE_MS = 2000;

interface Streak {
  /** The last count TikTok sent. */
  last: number;
  /** The gifts counted so far: more than `last` when the same count came again. */
  total: number;
  /** When the last event that counted came. */
  at: number;
}

/**
 * The jar's contents and the coins sent, added up from GIFT events.
 *
 * TikTok sends a combo as a run of events whose `comboCount` grows, and a last one with
 * `repeatEnd` set. A gift that isn't a combo has `repeatEnd` set at once. So each event adds
 * the count's growth since the combo's last one, and the closing event adds nothing. The same
 * count again before the close is the gift sent again, as TikTok sends a gift sent one at a
 * time. A lower count is an update that arrived late, unless the combo went quiet for LATE_MS:
 * then a new combo started. Every gift sent drops.
 */
export class Tally {
  private _gifters = new Map<string, Gifter>();
  private _drops: Drop[] = [];
  private _streaks = new Map<string, Streak>();
  private _total = 0;
  private _updatedAt = 0;

  constructor(
    private _resetMs: number,
    private _maxDrops: number,
  ) {}

  set resetMs(ms: number) {
    this._resetMs = ms;
  }

  /** The most gifts the saved jar keeps. */
  set maxDrops(count: number) {
    this._maxDrops = count;
    this.trim();
  }

  /** The coins sent since the jar was last emptied. */
  get total(): number {
    return this._total;
  }

  /** Takes a gift the jar let go of out of the saved ones. */
  forget(drop: Drop) {
    // A new list, as the jar may be pouring the old one.
    this._drops = this._drops.filter((saved) => saved !== drop);
  }

  /** The gifts in the jar, oldest first. */
  get drops(): readonly Drop[] {
    return this._drops;
  }

  /**
   * Adds a GIFT event. A gift after resetMs without any empties the jar first. Returns what to
   * show, or null when the event adds nothing (a combo's closing event or a late update, or no
   * gifter).
   */
  add(
    user: UserData,
    gift: GiftData["gift"],
    now = Date.now(),
  ): Gifting | null {
    let reset = false;
    if (this._updatedAt && now - this._updatedAt > this._resetMs) {
      this.clear();
      reset = true;
    }
    this._updatedAt = now;

    const handle = user.handle || user.username;
    const key = `${handle}:${gift.id}`;
    const count = Math.max(1, gift.comboCount);
    const streak = this._streaks.get(key);

    // A new streak, unless this one goes on: a count that grows adds the growth, the same count
    // again is the gift sent again unless it closes the combo, and a lower one is a late update.
    let added = count;
    let total = count;
    if (streak && (count >= streak.last || now - streak.at < LATE_MS)) {
      if (count > streak.last) added = count - streak.last;
      else if (count < streak.last || gift.repeatEnd) added = 0;
      total = streak.total + added;
    }

    const unit = Math.max(0, gift.coins);
    const drops: Drop[] = Array.from({ length: added }, () => ({
      image: gift.image,
      giftId: gift.id,
      coins: unit,
    }));
    if (gift.repeatEnd) {
      this._streaks.delete(key);
    } else if (added > 0) {
      this._streaks.set(key, { last: count, total, at: now });
    }
    if (!handle || added === 0) return null;

    this._total += unit * added;
    const name = user.username || user.handle;
    const picture = user.profilePictures[0] ?? "";
    let gifter = this._gifters.get(handle);
    if (gifter) {
      gifter.coins += unit * added;
      gifter.name = name;
      gifter.picture = picture || gifter.picture;
    } else {
      gifter = { handle, name, picture, coins: unit * added };
      this._gifters.set(handle, gifter);
    }

    this._drops.push(...drops);
    this.trim();
    return {
      key,
      gifter: { ...gifter },
      gift: { name: gift.name, image: gift.image, coins: unit },
      count: total,
      coins: unit * total,
      drops,
      reset,
    };
  }

  /** 1 to 3 for the gifters with the most coins, otherwise undefined. */
  rank(handle: string): 1 | 2 | 3 | undefined {
    const position =
      this.top(3).findIndex((gifter) => gifter.handle === handle) + 1;
    return position === 1 || position === 2 || position === 3
      ? position
      : undefined;
  }

  /** A gifter, with the coins they've sent so far. */
  gifter(handle: string): Gifter | undefined {
    const gifter = this._gifters.get(handle);
    return gifter && { ...gifter };
  }

  /** The gifters with the most coins, most first. Ties keep the order they first gave in. */
  top(count: number): Gifter[] {
    return [...this._gifters.values()]
      .sort((a, b) => b.coins - a.coins)
      .slice(0, count)
      .map((gifter) => ({ ...gifter }));
  }

  serialize(): string {
    return JSON.stringify({
      updatedAt: this._updatedAt,
      total: this._total,
      gifters: [...this._gifters.values()]
        .sort((a, b) => b.coins - a.coins)
        .slice(0, SAVED_GIFTERS),
      drops: this._drops.slice(-SAVED_DROPS),
    });
  }

  /** A saved tally, or an empty one when it's missing, invalid or older than resetMs. */
  static restore(
    json: string | null,
    resetMs: number,
    maxDrops: number,
    now = Date.now(),
  ) {
    const tally = new Tally(resetMs, maxDrops);
    let saved: unknown;
    try {
      saved = JSON.parse(json ?? "null");
    } catch {
      return tally;
    }
    if (
      typeof saved !== "object" ||
      saved === null ||
      !("updatedAt" in saved) ||
      typeof saved.updatedAt !== "number" ||
      now - saved.updatedAt > resetMs
    ) {
      return tally;
    }

    tally._updatedAt = saved.updatedAt;
    if ("total" in saved && typeof saved.total === "number") {
      tally._total = saved.total;
    }
    if ("gifters" in saved && Array.isArray(saved.gifters)) {
      for (const gifter of saved.gifters) {
        if (isGifter(gifter)) tally._gifters.set(gifter.handle, gifter);
      }
    }
    if ("drops" in saved && Array.isArray(saved.drops)) {
      tally._drops = saved.drops.filter(isDrop);
      tally.trim();
    }
    return tally;
  }

  private clear() {
    this._gifters.clear();
    this._drops = [];
    this._streaks.clear();
    this._total = 0;
  }

  // Only the newest drops are kept, as the jar removes the oldest ones.
  private trim() {
    if (this._drops.length > this._maxDrops) {
      this._drops = this._drops.slice(-this._maxDrops);
    }
  }
}

function isGifter(value: unknown): value is Gifter {
  return (
    typeof value === "object" &&
    value !== null &&
    "handle" in value &&
    typeof value.handle === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "picture" in value &&
    typeof value.picture === "string" &&
    "coins" in value &&
    typeof value.coins === "number"
  );
}

function isDrop(value: unknown): value is Drop {
  return (
    typeof value === "object" &&
    value !== null &&
    "image" in value &&
    typeof value.image === "string" &&
    "giftId" in value &&
    typeof value.giftId === "string" &&
    "coins" in value &&
    typeof value.coins === "number"
  );
}
