/* Release-note hygiene.
 *
 * Every DataNexa release carries the same tail: installation instructions for
 * macOS / Windows, usage disclaimers, and "how to report an issue / where to find
 * the debug logs" text. The website shows changes, not a manual, so the shared
 * boilerplate is stripped here — while version-specific upgrade warnings (an
 * audit-log retention change, a format that older builds cannot import, …) are
 * deliberately kept, because those *are* part of the release record.
 *
 * Two knobs, both plain regex lists in DEFAULT_FILTERS:
 *   dropSections — a whole section (heading + body) is removed
 *   noiseBlocks  — a single paragraph or list item is removed wherever it appears
 * A section left without content afterwards loses its heading too. Passing
 * `null` as the filter keeps everything (the CLI exposes this as
 * --keep-boilerplate).
 */

import { stripInline } from "./markdown.mjs";

export const DEFAULT_FILTERS = {
  /* Headings of sections that only ever repeat installation / usage steps. */
  dropSections: [
    /^安装(?:与使用)?(?:说明|指南)$/,
    /^安装与升级说明$/,
    /^使用须知$/,
    /^使用说明$/,
    /^注意事项$/,
    /^install(?:ation)?(?: (?:and|&) (?:upgrade|usage))?(?: (?:notes|instructions|guide))?$/i,
    /^usage notes?$/i,
    /^notes on usage$/i,
  ],

  /* Paragraphs / list items that are feedback and troubleshooting boilerplate.
     Matched against the plain text of the block. */
  noiseBlocks: [
    /连续点按版本号区域\s*5\s*次/,
    /如需协助定位问题/,
    /欢迎在[\s\S]{0,80}GitHub Issues?[\s\S]{0,80}反馈/,
    /欢迎提交[\s\S]{0,60}GitHub Issues?[\s\S]{0,60}反馈/,
    /如遇到问题，欢迎/,
    /本次版本更新中改动内容较多/,
    /我们无法保证针对所有功能与使用场景/,
    /tap the version number area 5 times/i,
    /to help us diagnose problems faster/i,
    /if you run into problems after upgrading/i,
    /we could not fully test/i,
    /if you encounter any problems/i,
    /please (?:report|file|open) (?:them|an issue|it) (?:on|through|at)/i,
  ],
};

const HEADING_RE = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE_RE = /^\s*(`{3,}|~{3,})/;
const LIST_ITEM_RE = /^(\s*)([-*+]|\d{1,9}[.)])\s+/;

/** Drop the note header: the H1 repeats the version, and both language files
    start with a link to the other language. */
export function stripNoteHeader(markdown) {
  const lines = String(markdown || "").split("\n");
  let index = 0;
  let scanned = 0;
  while (index < lines.length && scanned < 16) {
    const line = lines[index].trim();
    if (line === "") {
      index++;
      scanned++;
      continue;
    }
    if (/^#\s+(?:DataNexa|v?\d+\.\d+)/i.test(line)) {
      index++;
      scanned++;
      continue;
    }
    if (/^\[[^\]]*\]\([^)]*RELEASE_NOTES[^)]*\)$/i.test(line)) {
      index++;
      scanned++;
      continue;
    }
    break;
  }
  return lines.slice(index).join("\n").trim();
}

/** Split markdown into blocks with their line ranges, so removal touches only
    the dropped lines and every other byte of the source is preserved. */
function splitBlocks(lines) {
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    if (/^\s*$/.test(lines[i])) {
      i++;
      continue;
    }
    const start = i;

    const heading = HEADING_RE.exec(lines[i]);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2].trim(), start, end: i });
      i++;
      continue;
    }

    if (FENCE_RE.test(lines[i])) {
      i++;
      while (i < lines.length && !FENCE_RE.test(lines[i])) i++;
      if (i < lines.length) i++;
      blocks.push({ kind: "code", start, end: i - 1, text: lines.slice(start, i).join("\n") });
      continue;
    }

    const item = LIST_ITEM_RE.exec(lines[i]);
    if (item) {
      /* one top-level item per block, nested items and continuations included */
      const indent = item[1].length;
      i++;
      while (i < lines.length) {
        const next = lines[i];
        if (/^\s*$/.test(next)) {
          const after = lines[i + 1];
          const afterItem = after ? LIST_ITEM_RE.exec(after) : null;
          if (afterItem && afterItem[1].length >= indent) {
            i++;
            continue;
          }
          break;
        }
        const nextItem = LIST_ITEM_RE.exec(next);
        if (nextItem) {
          if (nextItem[1].length > indent) {
            i++;
            continue;
          }
          break;
        }
        if (/^\s+\S/.test(next) || FENCE_RE.test(next)) {
          i++;
          continue;
        }
        break;
      }
      blocks.push({ kind: "item", indent, start, end: i - 1, text: lines.slice(start, i).join("\n") });
      continue;
    }

    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !HEADING_RE.test(lines[i]) &&
      !FENCE_RE.test(lines[i]) &&
      !LIST_ITEM_RE.test(lines[i])
    ) {
      i++;
    }
    blocks.push({ kind: "paragraph", start, end: i - 1, text: lines.slice(start, i).join("\n") });
  }

  return blocks;
}

function isDropped(block, dropped) {
  for (let line = block.start; line <= block.end; line++) {
    if (!dropped.has(line)) return false;
  }
  return true;
}

function firstLine(text, limit = 88) {
  const line = String(text).split("\n").find((entry) => entry.trim()) || "";
  const plain = stripInline(line.replace(/^\s*(?:#{1,6}|[-*+]|\d+[.)])\s*/, "")).trim();
  return plain.length > limit ? plain.slice(0, limit - 1) + "…" : plain;
}

/**
 * Remove boilerplate from release notes.
 * @param {string} markdown
 * @param {{dropSections: RegExp[], noiseBlocks: RegExp[]}|null} [filters]
 * @returns {{markdown: string, dropped: {sections: string[], blocks: string[]}}}
 */
export function filterBoilerplate(markdown, filters = DEFAULT_FILTERS) {
  const source = String(markdown || "");
  if (!filters) return { markdown: source, dropped: { sections: [], blocks: [] } };

  const lines = source.split("\n");
  const blocks = splitBlocks(lines);
  const dropped = new Set();
  const report = { sections: [], blocks: [] };

  /* 1. sections that are nothing but installation / usage instructions */
  blocks.forEach((block, index) => {
    if (block.kind !== "heading") return;
    if (!filters.dropSections.some((pattern) => pattern.test(block.text))) return;
    report.sections.push(block.text);
    for (let n = block.start; n <= block.end; n++) dropped.add(n);
    for (let k = index + 1; k < blocks.length; k++) {
      const next = blocks[k];
      if (next.kind === "heading" && next.level <= block.level) break;
      if (next.kind !== "heading") report.blocks.push(firstLine(next.text));
      for (let n = next.start; n <= next.end; n++) dropped.add(n);
    }
  });

  /* 2. feedback / troubleshooting boilerplate, wherever it sits */
  blocks.forEach((block) => {
    if (block.kind !== "item" && block.kind !== "paragraph") return;
    if (isDropped(block, dropped)) return;
    const plain = stripInline(block.text);
    if (!filters.noiseBlocks.some((pattern) => pattern.test(plain))) return;
    report.blocks.push(firstLine(block.text));
    for (let n = block.start; n <= block.end; n++) dropped.add(n);
  });

  /* 3. headings whose section lost all of its content — repeat until stable,
        since emptying an inner section can empty its parent */
  let changed = true;
  while (changed) {
    changed = false;
    blocks.forEach((block, index) => {
      if (block.kind !== "heading" || isDropped(block, dropped)) return;
      let hasContent = false;
      for (let k = index + 1; k < blocks.length; k++) {
        const next = blocks[k];
        if (next.kind === "heading" && next.level <= block.level) break;
        if (!isDropped(next, dropped)) {
          hasContent = true;
          break;
        }
      }
      if (hasContent) return;
      report.blocks.push(firstLine(block.text) + " (empty section)");
      for (let n = block.start; n <= block.end; n++) dropped.add(n);
      changed = true;
    });
  }

  const kept = lines.filter((_, index) => !dropped.has(index)).join("\n");
  return {
    markdown: kept.replace(/\n{3,}/g, "\n\n").trim(),
    dropped: report,
  };
}
