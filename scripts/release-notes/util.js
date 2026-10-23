import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { z } from "zod";

const root = resolve(import.meta.dirname, "../..");

const INTRO =
  "Overlays for [Tokio](https://tokio.ialfaro.com). Download an overlay's zip, extract it and import the folder in **Settings → Overlay Library**. `overlays.json` lists every overlay, including those released earlier.";

/**
 * Release note sections in order. Each commit goes to the first section it matches.
 *
 * @type {{ title: string, match: (commit: Commit) => boolean }[]}
 */
const SECTIONS = [
  { title: "Breaking Changes", match: (c) => c.breaking },
  { title: "New Features", match: (c) => c.type === "feat" },
  { title: "Fixes", match: (c) => c.type === "fix" },
  { title: "Performance", match: (c) => c.type === "perf" },
  { title: "Other Changes", match: () => true },
];

/**
 * @typedef {object} Commit
 * @property {string} sha - The full hash.
 * @property {string} short - The abbreviated hash.
 * @property {string} author - The author's name.
 * @property {string} email - The author's email.
 * @property {string | null} type - The Conventional Commits type, or null if the subject doesn't follow it.
 * @property {string | null} scope - The Conventional Commits scope.
 * @property {boolean} breaking - Whether the commit is marked as a breaking change.
 * @property {string} title - The subject without type and scope, capitalized.
 */

/**
 * Runs git in the repository root and returns its output.
 *
 * @param {string[]} args - The git arguments.
 * @returns {string} The command's stdout.
 */
function git(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * Finds the latest v* tag reachable from a ref.
 *
 * @param {string} ref - Where to start looking, e.g. `v1.0.0^` or `HEAD`.
 * @returns {string | null} The tag, or null if there is none.
 */
export function previousTag(ref) {
  try {
    return git([
      "describe",
      "--tags",
      "--abbrev=0",
      "--match",
      "v*",
      ref,
    ]).trim();
  } catch {
    return null;
  }
}

/**
 * Parses a commit message as a Conventional Commit.
 *
 * @param {string} message - The full commit message.
 * @returns {Pick<Commit, "type" | "scope" | "breaking" | "title">} The parsed message.
 */
export function parseCommit(message) {
  const subject = message.split("\n", 1)[0].trim();
  const match = subject.match(/^(\w+)(?:\(([^)]+)\))?(!)?: (.+)$/);
  const text = match ? match[4] : subject;

  return {
    type: match ? match[1].toLowerCase() : null,
    scope: match?.[2] ?? null,
    breaking: !!match?.[3] || /^BREAKING[ -]CHANGE:/m.test(message),
    title: text.charAt(0).toUpperCase() + text.slice(1),
  };
}

/**
 * Reads the commits in a range, newest first, without merges and release commits.
 *
 * @param {string | null} from - The exclusive start, or null for the whole history.
 * @param {string} to - The inclusive end.
 * @returns {Commit[]} The commits.
 */
export function readCommits(from, to) {
  const range = from ? `${from}..${to}` : to;
  const log = git([
    "log",
    "--no-merges",
    "--format=%H%x1f%h%x1f%an%x1f%ae%x1f%B%x1e",
    range,
  ]);

  return log
    .split("\x1e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [sha, short, author, email, message] = record.split("\x1f");
      return { sha, short, author, email, ...parseCommit(message) };
    })
    .filter(
      (commit) => !(commit.type === "chore" && commit.scope === "release"),
    );
}

// The part of GitHub's commit response that names the author's account.
const CommitSchema = z.object({
  author: z.object({ login: z.string() }).nullish(),
});

/**
 * Looks up the GitHub account that authored a commit.
 *
 * @param {string} repo - The repository, as owner/name.
 * @param {string} sha - The commit hash.
 * @param {string} [token] - A GitHub token, to avoid the anonymous rate limit.
 * @returns {Promise<string | null>} The login, or null if it can't be found.
 */
export async function githubLogin(repo, sha, token) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/commits/${sha}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
    );
    if (!res.ok) return null;
    const data = CommitSchema.safeParse(await res.json());
    return data.success ? (data.data.author?.login ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * Renders the release notes as Markdown.
 *
 * @param {object} options
 * @param {string} options.repo - The repository, as owner/name.
 * @param {string | null} options.from - The previous tag, or null for the first release.
 * @param {string} options.to - The released tag or ref.
 * @param {Commit[]} options.commits - The commits in the release, newest first.
 * @param {Map<string, string | null>} options.logins - GitHub logins by author email.
 * @param {Changes | null} options.changes - What `yarn release:build` found, if it ran.
 * @returns {string} The notes.
 */
export function renderNotes({ repo, from, to, commits, logins, changes }) {
  const url = `https://github.com/${repo}`;
  const lines = ["## Tokio Overlays", "", INTRO, ""];

  if (changes) lines.push(...renderOverlays(changes));
  lines.push("## What's Changed", "");

  /** @type {Map<string, Commit[]>} */
  const groups = new Map(SECTIONS.map((section) => [section.title, []]));
  for (const commit of commits) {
    // The last section matches every commit.
    const section =
      SECTIONS.find((s) => s.match(commit)) ?? SECTIONS[SECTIONS.length - 1];
    groups.get(section.title)?.push(commit);
  }

  for (const [title, items] of groups) {
    if (items.length === 0) continue;

    lines.push(`## ${title}`, "");
    for (const commit of items) {
      const login = logins.get(commit.email);
      const author = login
        ? `[${commit.author}](https://github.com/${login})`
        : commit.author;
      // Scopes are overlay ids, e.g. feat(likes-counter): ...
      const scope = commit.scope ? `\`${commit.scope}\` ` : "";
      lines.push(
        `- [ [\`${commit.short}\`](${url}/commit/${commit.sha}) ] - ${scope}**${commit.title}** _by_ ${author}`,
      );
    }
    lines.push("");
  }

  if (commits.length === 0) lines.push("No changes.", "");

  const changelog = from
    ? `[\`${from}...${to}\`](${url}/compare/${from}...${to})`
    : `[\`${to}\`](${url}/commits/${to})`;
  lines.push("---", "", `**Full Changelog**: ${changelog}`, "");

  return lines.join("\n");
}

/**
 * @typedef {object} Changes
 * @property {{ id: string, name: string, version: string }[]} added
 * @property {{ id: string, name: string, from: string, to: string }[]} updated
 * @property {{ id: string, name: string, version: string }[]} removed
 * @property {string[]} unchanged
 */

/**
 * The overlays this release adds, updates and removes, as a table.
 *
 * @param {Changes} changes
 * @returns {string[]} The lines.
 */
function renderOverlays(changes) {
  const rows = [
    ...changes.added.map((o) => ({ ...o, change: "New" })),
    ...changes.updated.map((o) => ({
      id: o.id,
      name: o.name,
      version: `${o.from} → ${o.to}`,
      change: "Updated",
    })),
    ...changes.removed.map((o) => ({ ...o, change: "Removed" })),
  ];
  const lines = ["## Overlays", ""];

  if (rows.length > 0) {
    lines.push("| Overlay | Version | Change |", "| --- | --- | --- |");
    for (const { id, name, version, change } of rows) {
      lines.push(`| ${name} (\`${id}\`) | ${version} | ${change} |`);
    }
    lines.push("");
  }

  const count = changes.unchanged.length;
  if (count > 0) {
    lines.push(
      `${count} overlay${count === 1 ? "" : "s"} unchanged, still downloadable from the releases listed in \`overlays.json\`.`,
      "",
    );
  }
  if (rows.length === 0 && count === 0) lines.push("No overlays.", "");

  return lines;
}
