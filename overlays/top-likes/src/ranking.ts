import type { UserData } from "@tokioapp/overlay";

export interface Viewer {
  handle: string;
  name: string;
  picture: string;
  likes: number;
}

// Saved across reloads. Viewers below this start over, which keeps the save small.
const SAVED_VIEWERS = 500;

/** Each viewer's likes, added up from LIKE events. */
export class Ranking {
  private _viewers = new Map<string, Viewer>();
  private _updatedAt = 0;

  constructor(private _resetMs: number) {}

  set resetMs(ms: number) {
    this._resetMs = ms;
  }

  /**
   * Adds a viewer's likes. A like after resetMs without any starts the ranking over, so a new
   * LIVE doesn't keep the last one's viewers. Returns whether anything changed.
   */
  add(user: UserData, likes: number, now = Date.now()): boolean {
    const handle = user.handle || user.username;
    if (!handle || !(likes > 0)) return false;

    if (this._updatedAt && now - this._updatedAt > this._resetMs) {
      this._viewers.clear();
    }
    this._updatedAt = now;

    const name = user.username || user.handle;
    const picture = user.profilePictures[0] ?? "";
    const viewer = this._viewers.get(handle);
    if (viewer) {
      viewer.likes += likes;
      viewer.name = name;
      viewer.picture = picture || viewer.picture;
    } else {
      this._viewers.set(handle, { handle, name, picture, likes });
    }
    return true;
  }

  /** The viewers with the most likes. Ties keep the order they first liked in. */
  top(count: number): Viewer[] {
    return [...this._viewers.values()]
      .sort((a, b) => b.likes - a.likes)
      .slice(0, count);
  }

  serialize(): string {
    return JSON.stringify({
      updatedAt: this._updatedAt,
      viewers: this.top(SAVED_VIEWERS),
    });
  }

  /** A saved ranking, or an empty one when it's missing, invalid or older than resetMs. */
  static restore(json: string | null, resetMs: number, now = Date.now()) {
    const ranking = new Ranking(resetMs);
    let saved: unknown;
    try {
      saved = JSON.parse(json ?? "null");
    } catch {
      return ranking;
    }
    if (
      typeof saved !== "object" ||
      saved === null ||
      !("updatedAt" in saved) ||
      typeof saved.updatedAt !== "number" ||
      now - saved.updatedAt > resetMs ||
      !("viewers" in saved) ||
      !Array.isArray(saved.viewers)
    ) {
      return ranking;
    }

    ranking._updatedAt = saved.updatedAt;
    for (const viewer of saved.viewers) {
      if (isViewer(viewer)) ranking._viewers.set(viewer.handle, viewer);
    }
    return ranking;
  }
}

function isViewer(value: unknown): value is Viewer {
  return (
    typeof value === "object" &&
    value !== null &&
    "handle" in value &&
    typeof value.handle === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "picture" in value &&
    typeof value.picture === "string" &&
    "likes" in value &&
    typeof value.likes === "number"
  );
}
