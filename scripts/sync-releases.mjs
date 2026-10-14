#!/usr/bin/env node
/* Build data/releases.json — the bilingual changelog data file the website renders.
 *
 * Three inputs, merged in this order (first hit wins, per release):
 *
 *   1. CHANGELOG  — the maintained file in the main repository (default CHANGELOG.md).
 *                   Written for humans, published as-is: no boilerplate filtering,
 *                   both languages in one file, one section per release. This is the
 *                   path new releases take.
 *   2. archive    — the notes already stored in data/releases.json. Published history
 *                   lives in this repository, so an existing entry is carried over
 *                   untouched instead of being re-derived from GitHub.
 *   3. release    — the GitHub release body (plus docs/RELEASE_NOTES.en.md), with the
 *                   shared installation / feedback sections filtered out. Only used
 *                   for a release that has no CHANGELOG section yet, so the site is
 *                   never empty right after a release.
 *
 * Release metadata (date, prerelease flag, download assets) always comes from the
 * Releases API; only the notes text is merged as above.
 *
 * Usage:
 *   node scripts/sync-releases.mjs [--repo=owner/name] [--out=path] [--check]
 *                                  [--dry-run] [--quiet] [--api-dump=file]
 *                                  [--changelog-path=CHANGELOG.md] [--changelog-ref=HEAD]
 *                                  [--refresh-notes] [--keep-boilerplate]
 *
 * Env: GITHUB_TOKEN (recommended in CI, avoids the anonymous API rate limit).
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { renderMarkdown } from "./lib/markdown.mjs";
import { DEFAULT_FILTERS, filterBoilerplate, stripNoteHeader } from "./lib/notes.mjs";
import { parseChangelog, versionKey } from "./lib/changelog.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

const DEFAULTS = {
  /* The source repository is fixed; do not default it from GITHUB_REPOSITORY —
     this script also runs inside the website repository, where that variable
     points at the site itself. */
  repo: "MingoZacwu/DataNexa",
  out: "data/releases.json",
  enNotesPath: "docs/RELEASE_NOTES.en.md",
  changelogPath: "CHANGELOG.md",
  /* Read the changelog from the default branch: it is the maintained copy, and
     editing an old section there is picked up on the next sync. */
  changelogRef: "HEAD",
  schema: 2,
};

const inActions = process.env.GITHUB_ACTIONS === "true";

function log(message) {
  if (!options.quiet) process.stdout.write(message + "\n");
}

function warn(message) {
  process.stderr.write((inActions ? "::warning::" : "warning: ") + message + "\n");
}

function notice(message) {
  if (inActions) process.stdout.write("::notice::" + message + "\n");
  else log(message);
}

function fail(message, code = 1) {
  process.stderr.write((inActions ? "::error::" : "error: ") + message + "\n");
  process.exit(code);
}

/* ---------- options ---------- */

function parseArgs(argv) {
  const opts = {
    ...DEFAULTS,
    check: false,
    dryRun: false,
    quiet: false,
    apiDump: "",
    changelogFile: "",
    keepBoilerplate: false,
    refreshNotes: false,
    token: process.env.GITHUB_TOKEN || "",
  };
  for (const arg of argv) {
    if (arg === "--check") opts.check = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--quiet") opts.quiet = true;
    else if (arg === "--keep-boilerplate") opts.keepBoilerplate = true;
    else if (arg === "--refresh-notes") opts.refreshNotes = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg.startsWith("--repo=")) opts.repo = arg.slice("--repo=".length);
    else if (arg.startsWith("--out=")) opts.out = arg.slice("--out=".length);
    else if (arg.startsWith("--en-path=")) opts.enNotesPath = arg.slice("--en-path=".length);
    else if (arg.startsWith("--changelog-path=")) opts.changelogPath = arg.slice("--changelog-path=".length);
    else if (arg.startsWith("--changelog-ref=")) opts.changelogRef = arg.slice("--changelog-ref=".length);
    else if (arg.startsWith("--changelog-file=")) opts.changelogFile = arg.slice("--changelog-file=".length);
    else if (arg.startsWith("--api-dump=")) opts.apiDump = arg.slice("--api-dump=".length);
    else if (arg.startsWith("--token=")) opts.token = arg.slice("--token=".length);
    else fail(`Unknown option: ${arg} (use --help for usage)`);
  }
  if (!/^[^/\s]+\/[^/\s]+$/.test(opts.repo)) fail(`Invalid --repo value: ${opts.repo}`);
  return opts;
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  process.stdout.write(
    "Usage: node scripts/sync-releases.mjs [options]\n\n" +
    "  --repo=owner/name       Source repository (default: " + DEFAULTS.repo + ")\n" +
    "  --out=path              Output file (default: " + DEFAULTS.out + ")\n" +
    "  --changelog-path=path   Maintained changelog in the main repo (default: " + DEFAULTS.changelogPath + ")\n" +
    "  --changelog-ref=ref     Ref to read it from (default: " + DEFAULTS.changelogRef + " = default branch)\n" +
    "  --changelog-file=path   Read the changelog from a local file (preview before pushing)\n" +
    "  --en-path=path          English release notes path (default: " + DEFAULTS.enNotesPath + ")\n" +
    "  --refresh-notes         Ignore stored notes; re-derive from release bodies\n" +
    "  --keep-boilerplate      Keep installation / feedback sections (release bodies only)\n" +
    "  --api-dump=file         Read the releases JSON from a local file instead of the API\n" +
    "  --check                 Do not write; exit 1 when the file is out of date\n" +
    "  --dry-run               Build but do not write the file\n" +
    "  --quiet                 Only report errors\n"
  );
  process.exit(0);
}

/* ---------- http ---------- */

const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);

function apiHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "datanexa-site-changelog-sync",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (options.token) headers.Authorization = "Bearer " + options.token;
  return headers;
}

/** GET with a small retry ladder. Returns null on 404 when `optional` is set. */
async function get(url, { optional = false, raw = false, attempts = 3 } = {}) {
  let lastError = "";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: raw ? { "User-Agent": "datanexa-site-changelog-sync" } : apiHeaders(),
        redirect: "follow",
      });
      if (response.status === 404 && optional) return null;
      if (response.ok) return await response.text();
      if (!RETRY_STATUS.has(response.status) || attempt === attempts) {
        lastError = `HTTP ${response.status} ${response.statusText} for ${url}`;
        if (response.status === 403 || response.status === 429) {
          if (response.headers.get("x-ratelimit-remaining") === "0") {
            lastError += " (GitHub rate limit reached — pass GITHUB_TOKEN or --token to raise the quota)";
          }
        }
        break;
      }
      lastError = `HTTP ${response.status} for ${url}`;
    } catch (error) {
      lastError = `${error.message} for ${url}`;
      if (attempt === attempts) break;
    }
    await new Promise((done) => setTimeout(done, attempt * 700));
    log(`  retrying (${lastError})`);
  }
  if (optional) {
    warn(lastError);
    return null;
  }
  fail(lastError);
}

/* ---------- sources ---------- */

async function fetchReleases() {
  if (options.apiDump) {
    log(`Reading releases from ${options.apiDump}`);
    return JSON.parse(await readFile(options.apiDump, "utf8"));
  }

  const all = [];
  for (let page = 1; page <= 20; page++) {
    const url = `https://api.github.com/repos/${options.repo}/releases?per_page=100&page=${page}`;
    const body = await get(url);
    const batch = JSON.parse(body);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  log(`Fetched ${all.length} release(s) from ${options.repo}`);
  return all;
}

/** The maintained changelog: the primary source for new releases. */
async function fetchChangelog() {
  const path = options.changelogPath.replace(/^\/+/, "");
  const url = `https://github.com/${options.repo}/blob/${options.changelogRef}/${path}`;

  /* --changelog-file lets you preview a local edit before it is pushed. */
  const markdown = options.changelogFile
    ? await readFile(resolve(REPO_ROOT, options.changelogFile), "utf8").catch((error) => {
        fail(`Could not read --changelog-file=${options.changelogFile}: ${error.message}`);
      })
    : await get(`https://raw.githubusercontent.com/${options.repo}/${options.changelogRef}/${path}`, {
        optional: true,
        raw: true,
      });

  if (!markdown) {
    notice(`${options.changelogPath} not found at ${options.changelogRef} — falling back to stored notes and release bodies.`);
    return null;
  }

  const versions = parseChangelog(markdown);
  log(
    `Read ${options.changelogFile || options.changelogPath} ` +
    (versions.size
      ? `(${versions.size} version section${versions.size === 1 ? "" : "s"}: ` +
        `${[...versions.keys()].slice(0, 5).join(", ")}${versions.size > 5 ? ", …" : ""})`
      : "(no usable version sections)")
  );
  return { versions, url };
}

/** Turn a github.com blob link into its raw.githubusercontent.com equivalent. */
function blobToRaw(url) {
  const match = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/.exec(url.trim());
  if (!match) return "";
  return `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}`;
}

/* The Chinese release body links to the English file; that link is the most
   reliable pointer available, so it wins over the configured default path. */
function findEnglishNotesLink(body) {
  const links = String(body || "").match(/\]\((https?:\/\/[^)\s]+)\)/g) || [];
  for (const link of links) {
    const url = link.slice(2, -1);
    if (/\.en\.md$/i.test(url) || /RELEASE_NOTES\.en/i.test(url)) return { raw: blobToRaw(url), blob: url };
  }
  return null;
}

async function fetchEnglishNotes(release) {
  const fromBody = findEnglishNotesLink(release.body);
  const fallbackPath = `${options.enNotesPath.replace(/^\/+/, "")}`;
  const candidates = [];
  if (fromBody && fromBody.raw) candidates.push({ raw: fromBody.raw, blob: fromBody.blob });
  candidates.push({
    raw: `https://raw.githubusercontent.com/${options.repo}/${release.tag_name}/${fallbackPath}`,
    blob: `https://github.com/${options.repo}/blob/${release.tag_name}/${fallbackPath}`,
  });

  for (const candidate of candidates) {
    const text = await get(candidate.raw, { optional: true, raw: true });
    if (text && text.trim()) return { markdown: text, url: candidate.blob };
  }
  return null;
}

/* ---------- transforms ---------- */

/* Updater plumbing (signature files, latest.json, *.app.tar.gz bundles) is not
   meant for manual download, so the changelog only offers installable artifacts. */
const ASSET_SKIP = [/\.sig$/i, /\.json$/i, /\.tar\.gz$/i];

function classifyAsset(name) {
  const lower = name.toLowerCase();
  if (ASSET_SKIP.some((pattern) => pattern.test(lower))) return null;
  if (lower.endsWith(".dmg")) return "macos";
  if (lower.endsWith(".exe") || lower.endsWith(".msi")) return "windows";
  if (lower.endsWith(".appimage") || lower.endsWith(".deb") || lower.endsWith(".rpm")) return "linux";
  return "other";
}

function buildAssets(release) {
  return (release.assets || [])
    .map((asset) => {
      const platform = classifyAsset(asset.name);
      if (!platform) return null;
      return {
        name: asset.name,
        platform,
        sizeBytes: asset.size || 0,
        downloadUrl: asset.browser_download_url || "",
      };
    })
    .filter(Boolean);
}

/** Bare semver-ish version, used for display and sorting. */
function versionOf(tag) {
  return versionKey(tag);
}

function compareVersions(a, b) {
  const parse = (value) => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(versionOf(value));
    if (!match) return null;
    return { parts: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] || "" };
  };
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return 0;
  for (let i = 0; i < 3; i++) {
    if (left.parts[i] !== right.parts[i]) return right.parts[i] - left.parts[i];
  }
  if (left.pre === right.pre) return 0;
  if (!left.pre) return -1; /* a stable release ranks above its prereleases */
  if (!right.pre) return 1;
  return left.pre < right.pre ? 1 : -1;
}

/** Render one language: optional header strip + boilerplate filter, then Markdown
    with per-release heading anchors. Heading levels are normalised so a release
    body (`##`) and a CHANGELOG section (`###`) look the same on the page. */
function renderNotes(markdown, { tag, url, filters }) {
  const source = stripNoteHeader(markdown);
  const filtered = filters
    ? filterBoilerplate(source, filters)
    : { markdown: source, dropped: { sections: [], blocks: [] } };

  const rendered = renderMarkdown(filtered.markdown, {
    anchorPrefix: tag + "--",
    anchorFallbackBase: url,
    normalizeHeadings: true,
  });

  return {
    html: rendered.html,
    url,
    empty: !rendered.html.trim(),
    dropped: filtered.dropped,
  };
}

/** The notes stored by a previous run, reused verbatim so published history stays
    stable (and hand-fixable) in this repository. */
function storedNotes(previousEntry, fallbackUrl) {
  const zh = previousEntry.notes.zh;
  const en = previousEntry.notes.en;
  return {
    source: "archive",
    zh: { html: zh.html, url: zh.url || fallbackUrl, empty: Boolean(zh.empty) },
    en: {
      html: en.html,
      url: en.url || fallbackUrl,
      empty: Boolean(en.empty),
      fallbackFromZh: Boolean(en.fallbackFromZh),
    },
    filtered: previousEntry.filtered || null,
  };
}

async function resolveNotes(release, context) {
  const tag = release.tag_name;
  const key = versionKey(tag);
  const releaseUrl = release.html_url || `https://github.com/${options.repo}/releases/tag/${tag}`;

  /* 1. the maintained changelog in the main repository */
  const section = context.changelog ? context.changelog.versions.get(key) : null;
  if (section && (section.zh || section.en)) {
    if (!section.zh || !section.en) {
      warn(`${tag}: the CHANGELOG section is missing the ${section.zh ? "English" : "Chinese"} part.`);
    }
    const zhMarkdown = section.zh || section.en;
    const zh = renderNotes(zhMarkdown, { tag, url: context.changelog.url });
    const en = section.en
      ? renderNotes(section.en, { tag, url: context.changelog.url })
      : { ...zh, url: context.changelog.url, fallbackFromZh: true };
    return {
      source: "changelog",
      zh: { html: zh.html, url: zh.url, empty: zh.empty },
      en: {
        html: en.html,
        url: en.url,
        empty: en.empty,
        fallbackFromZh: Boolean(en.fallbackFromZh),
      },
      filtered: null,
    };
  }

  /* 2. already-published history, stored in this repository */
  const previousEntry = context.previousByTag.get(tag);
  if (!options.refreshNotes && previousEntry && previousEntry.notes && previousEntry.notes.zh && previousEntry.notes.en) {
    return storedNotes(previousEntry, releaseUrl);
  }

  /* 3. the release body + English notes file, with the shared boilerplate removed */
  const english = await fetchEnglishNotes(release);
  const filters = options.keepBoilerplate ? null : DEFAULT_FILTERS;
  const hasEnglish = Boolean(english && english.markdown && english.markdown.trim());
  const enSource = hasEnglish ? english.markdown : release.body || "";

  const zh = renderNotes(release.body || "", { tag, url: releaseUrl, filters });
  const en = hasEnglish
    ? renderNotes(enSource, { tag, url: english.url, filters })
    : { ...zh, url: releaseUrl, fallbackFromZh: true };

  return {
    source: "release",
    englishMissing: !hasEnglish,
    zh: { html: zh.html, url: zh.url, empty: zh.empty },
    en: {
      html: en.html,
      url: en.url,
      empty: en.empty,
      fallbackFromZh: Boolean(en.fallbackFromZh),
    },
    filtered: {
      sections: [...new Set([...zh.dropped.sections, ...(en.dropped ? en.dropped.sections : [])])],
      blocks: zh.dropped.blocks.length + (en.dropped ? en.dropped.blocks.length : 0),
    },
  };
}

function buildEntry(release, notes) {
  const tag = release.tag_name;
  return {
    tag,
    version: versionOf(tag),
    name: release.name || tag,
    publishedAt: release.published_at || release.created_at || "",
    date: (release.published_at || release.created_at || "").slice(0, 10),
    url: release.html_url || `https://github.com/${options.repo}/releases/tag/${tag}`,
    prerelease: Boolean(release.prerelease),
    assets: buildAssets(release),
    /* where this entry's notes came from: changelog | archive | release */
    notesSource: notes.source,
    notes: { zh: notes.zh, en: notes.en },
    ...(notes.filtered ? { filtered: notes.filtered } : {}),
  };
}

function sortReleases(entries) {
  return entries.sort((a, b) => {
    const byDate = String(b.publishedAt).localeCompare(String(a.publishedAt));
    if (byDate !== 0) return byDate;
    return compareVersions(a.tag, b.tag);
  });
}

function stableStringify(value) {
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  if (value && typeof value === "object") {
    return (
      "{" +
      Object.keys(value)
        .sort()
        .filter((key) => key !== "generatedAt")
        .map((key) => JSON.stringify(key) + ":" + stableStringify(value[key]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

/* ---------- previous data ---------- */

const outPath = resolve(REPO_ROOT, options.out);
let previous = null;
if (existsSync(outPath)) {
  try {
    previous = JSON.parse(await readFile(outPath, "utf8"));
  } catch {
    warn(`${options.out} could not be parsed — it will be rebuilt from scratch.`);
  }
}

const previousByTag = new Map(
  (previous && Array.isArray(previous.releases) ? previous.releases : [])
    .filter((entry) => entry && entry.tag)
    .map((entry) => [entry.tag, entry])
);

/* ---------- main ---------- */

const releases = (await fetchReleases())
  .filter((release) => !release.draft)
  .sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || "")));

if (!releases.length) fail(`No published releases found for ${options.repo}`);

const changelog = await fetchChangelog();

const entries = [];
let englishMissing = 0;
let emptyNotes = 0;

for (const release of releases) {
  const notes = await resolveNotes(release, { changelog, previousByTag });
  if (notes.englishMissing) englishMissing++;
  if (notes.zh.empty && notes.en.empty) emptyNotes++;

  const entry = buildEntry(release, notes);
  entries.push(entry);

  const zhKb = (entry.notes.zh.html.length / 1024).toFixed(1).padStart(5);
  const enKb = entry.notes.en.fallbackFromZh
    ? "  zh "
    : (entry.notes.en.html.length / 1024).toFixed(1).padStart(5);
  /* Only the release-body path filters anything in this run; archived entries
     carry the values recorded when they were first generated. */
  const extra = entry.notesSource === "release" && entry.filtered
    ? ` · dropped ${entry.filtered.sections.join(" / ") || "—"}` +
      (entry.filtered.blocks ? ` +${entry.filtered.blocks} block(s)` : "")
    : "";
  log(
    `  ${entry.tag.padEnd(12)} ${entry.date}  ` +
    `${entry.notesSource.padEnd(9)} zh ${zhKb}kB · en ${enKb}kB · assets ${entry.assets.length}${extra}`
  );
}

sortReleases(entries);

/* Versions the website had, but that no longer exist upstream. */
const upstreamTags = new Set(entries.map((entry) => entry.tag));
const removed = [...previousByTag.keys()].filter((tag) => !upstreamTags.has(tag));
if (removed.length) {
  warn(`${removed.join(", ")} no longer exist in ${options.repo} and were removed from the page.`);
}

/* Sections written for versions that are not published (yet). */
if (changelog) {
  const published = new Set(entries.map((entry) => versionKey(entry.tag)));
  const unpublished = [...changelog.versions.keys()].filter((version) => !published.has(version));
  if (unpublished.length) {
    log(`  (in ${options.changelogPath} but not a published release yet: ${unpublished.join(", ")})`);
  }
}

const latestEntry = entries[0];
if (latestEntry && latestEntry.notesSource === "release") {
  warn(
    `${latestEntry.tag} has no section in ${options.changelogPath}, so its notes were taken from the ` +
    "GitHub release body (filtered). Add a section for it to the changelog to control the text."
  );
}

if (englishMissing) {
  warn(
    `${englishMissing} release(s) have no English notes at ${options.enNotesPath}; ` +
    "the Chinese text is shown for those versions."
  );
}

if (emptyNotes) {
  warn(`${emptyNotes} release(s) have no notes at all; the page falls back to the GitHub release link.`);
}

const stable = entries.find((entry) => !entry.prerelease) || entries[0];
const payload = {
  schema: DEFAULTS.schema,
  generatedAt: new Date().toISOString(),
  source: {
    repository: options.repo,
    releasesUrl: `https://github.com/${options.repo}/releases`,
    changelog: {
      path: options.changelogPath,
      ref: options.changelogRef,
      found: Boolean(changelog),
      sections: changelog ? changelog.versions.size : 0,
    },
  },
  latest: entries[0].tag,
  latestStable: stable.tag,
  releases: entries,
};

const unchanged = previous && stableStringify(previous) === stableStringify(payload);
if (unchanged) payload.generatedAt = previous.generatedAt;

if (options.check) {
  if (unchanged) {
    log(`${options.out} is up to date (${entries.length} releases).`);
    process.exit(0);
  }
  if (!previous) fail(`${options.out} does not exist — run: node scripts/sync-releases.mjs`);
  fail(`${options.out} is out of date — run: node scripts/sync-releases.mjs`);
}

if (options.dryRun) {
  log(`${entries.length} release(s) built; dry run, nothing written.`);
  process.exit(0);
}

if (unchanged) {
  log(`${options.out} already up to date (${entries.length} releases) — nothing written.`);
  process.exit(0);
}

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

const bySource = entries.reduce((counts, entry) => {
  counts[entry.notesSource] = (counts[entry.notesSource] || 0) + 1;
  return counts;
}, {});
log(
  `${entries.length} release(s) written to ${options.out} ` +
  `(changelog ${bySource.changelog || 0} · archive ${bySource.archive || 0} · release body ${bySource.release || 0}) — ` +
  `latest: ${payload.latest}`
);
