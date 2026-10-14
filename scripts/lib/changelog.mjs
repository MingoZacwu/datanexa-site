/* Parse the bilingual CHANGELOG maintained in the main repository.
 *
 * Canonical shape, one section per released version, newest first:
 *
 *   ## [0.9.0] - 2026-11-01
 *
 *   ### 中文
 *   ### 新增功能
 *   - ...
 *
 *   ### English
 *   ### Added
 *   - ...
 *
 * Tolerant by design, so the file stays pleasant to write:
 *   · version heading — `## [0.9.0] - 2026-11-01`, `## 0.9.0 (2026-11-01)`, `## v0.9.0`,
 *     `## 0.9.0 - 2026-11-01`; `[Unreleased]` / `未发布` sections are skipped
 *   · language labels — 中文 / 简体中文 / 中文说明 / Chinese and 英文 / 英语 / English,
 *     at `###` or `####`; everything before the first label counts as Chinese
 *   · no language label at all — the whole section is Chinese and English falls back
 *
 * Only the versions present in the file are returned: the site keeps its own
 * archive of already-published versions and merges this file on top of it.
 */

const VERSION_HEADING = /^\s*##\s+(.*?)\s*#*\s*$/;
const HEADING = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*(`{3,}|~{3,})/;

const ZH_LABELS = new Set(["中文", "简体中文", "中文说明", "中文版", "chinese"]);
const EN_LABELS = new Set(["英文", "英语", "英文说明", "英文版", "english"]);

/** Version key used for merging: `v0.9.0` and `0.9.0` are the same release. */
export function versionKey(value) {
  return String(value || "").trim().replace(/^v/i, "");
}

function normalizeLabel(text) {
  return String(text)
    .toLowerCase()
    .replace(/[（(][^)）]*[)）]/g, "")
    .replace(/[\s　:：、,，.。·—-]+/g, "");
}

function detectLanguage(text) {
  const label = normalizeLabel(text);
  if (ZH_LABELS.has(label)) return "zh";
  if (EN_LABELS.has(label)) return "en";
  return null;
}

/** `[0.9.0] - 2026-11-01`, `0.9.0 (2026-11-01)`, `v0.9.0` → { version, date }. */
function parseVersionHeading(text) {
  const unwrapped = String(text).trim().replace(/^\[([^\]]+)\]/, "$1").trim();
  if (/^(?:unreleased|未发布|待发布)$/i.test(unwrapped)) return null;
  const match = /^v?(\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.-]+)?)\s*(?:[-–—(]\s*(\d{4}-\d{2}-\d{2})\s*[)\]]?)?/.exec(unwrapped);
  if (!match) return null;
  return { version: versionKey(match[1]), date: match[2] || "" };
}

/**
 * @param {string} markdown
 * @returns {Map<string, {version: string, date: string, zh: string, en: string}>}
 */
export function parseChangelog(markdown) {
  const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
  const versions = new Map();

  let current = null;
  let language = "zh";
  let parts = { zh: [], en: [] };
  let inFence = false;
  let fenceMarker = "";

  const commit = () => {
    if (!current) return;
    const zh = parts.zh.join("\n").trim();
    const en = parts.en.join("\n").trim();
    versions.set(current.version, { version: current.version, date: current.date, zh, en });
  };

  for (const line of lines) {
    const fence = FENCE.exec(line);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fence[1][0];
      } else if (fence[1][0] === fenceMarker) {
        inFence = false;
      }
      if (current) parts[language].push(line);
      continue;
    }

    if (!inFence) {
      const versionHeading = VERSION_HEADING.exec(line);
      if (versionHeading) {
        commit();
        current = parseVersionHeading(versionHeading[1]);
        language = "zh";
        parts = { zh: [], en: [] };
        continue;
      }

      const heading = HEADING.exec(line);
      if (current && heading) {
        const level = heading[1].length;
        const detected = level >= 3 && level <= 4 ? detectLanguage(heading[2]) : null;
        if (detected) {
          language = detected; /* a label, not content — drop it from the output */
          continue;
        }
      }
    }

    if (current) parts[language].push(line);
  }

  commit();
  return versions;
}
