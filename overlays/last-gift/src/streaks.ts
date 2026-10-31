// Counts each gifter's streak of a gift from GIFT events, by the same rules as the jars' tally.ts.

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
 * TikTok sends a combo as a run of events whose `comboCount` grows, and a last one with
 * `repeatEnd` set. A gift that isn't a combo has `repeatEnd` set at once. So each event adds
 * the count's growth since the combo's last one, and the closing event adds nothing. The same
 * count again before the close is the gift sent again, as TikTok sends a gift sent one at a
 * time. A lower count is an update that arrived late, unless the combo went quiet for LATE_MS:
 * then a new combo started.
 */
export class Streaks {
  private _streaks = new Map<string, Streak>();

  /** Adds an event of the streak `key`: returns the gifts it adds and the streak's count so far. */
  add(key: string, comboCount: number, repeatEnd: boolean, now = Date.now()) {
    const count = Math.max(1, comboCount);
    const streak = this._streaks.get(key);
    let added = count;
    let total = count;
    if (streak && (count >= streak.last || now - streak.at < LATE_MS)) {
      if (count > streak.last) added = count - streak.last;
      else if (count < streak.last || repeatEnd) added = 0;
      total = streak.total + added;
    }
    if (repeatEnd) this._streaks.delete(key);
    else if (added > 0) this._streaks.set(key, { last: count, total, at: now });
    return { added, total };
  }

  clear() {
    this._streaks.clear();
  }
}
