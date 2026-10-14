/* Minimal, dependency-free Markdown → HTML renderer.
 *
 * Scope: the subset used by DataNexa release notes, plus a few neighbours so the
 * pipeline keeps working when the notes get richer later — ATX headings (with
 * GitHub-compatible anchors), fenced code blocks, unordered / ordered lists with
 * nesting, blockquotes, horizontal rules, GFM tables, and the inline set
 * (code spans, links, images, autolinks, bold, italic, strikethrough).
 *
 * Raw HTML in the source is escaped rather than passed through: release notes are
 * rendered into the page, so untrusted input must never become live markup.
 *
 * Anchors: headings are emitted with `id`, and in-document links such as
 * [调整与改进](#调整与改进) are rewritten to point at that id. Because every
 * release repeats headings like "Highlights", renderMarkdown takes an
 * `anchorPrefix` (the release tag) so ids stay unique on the changelog page.
 * A link whose target heading is missing — dropped by the boilerplate filter,
 * for example — falls back to `anchorFallbackBase`.
 */

/** Escape a plain-text fragment for use in HTML text / quoted attributes. */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* GitHub strips punctuation and symbol characters from anchors, lowercases what
   is left and turns whitespace into hyphens. CJK characters survive untouched,
   which is what makes [调整与改进](#调整与改进) work. */
const SLUG_DROP = /[\u2000-\u206F\u2E00-\u2E7F\u3000-\u303F\uFF00-\uFFEF\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g;

export function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(SLUG_DROP, "")
    .replace(/\s+/g, "-");
}

/** Strip inline markers so text can be slugified / matched the way GitHub does. */
export function stripInline(text) {
  return String(text)
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1$2")
    .replace(/~~([^~]+)~~/g, "$1");
}

const HEADING_RE = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE_RE = /^\s*(`{3,}|~{3,})\s*([\w+-]*)\s*$/;
const LIST_ITEM_RE = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;

/* ---------- inline ---------- */

function findClosing(text, start, open, close) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "\\") { i++; continue; }
    if (text[i] === open) depth++;
    else if (text[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Split `url "title"` into its two parts. */
function splitDestination(raw) {
  const match = /^(\S+?)(?:\s+["'(](.*?)["')])?$/.exec(raw.trim());
  if (!match) return { href: raw.trim(), title: "" };
  return { href: match[1], title: match[2] || "" };
}

function safeHref(href) {
  const value = href.trim();
  return /^(?:https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(value) ? value : "";
}

function renderInline(text, ctx) {
  const out = [];
  let buffer = "";
  let i = 0;

  const flush = () => {
    if (buffer) {
      out.push(escapeHtml(buffer));
      buffer = "";
    }
  };

  while (i < text.length) {
    const ch = text[i];

    /* code span */
    if (ch === "`") {
      const match = /^(`+)([\s\S]*?)\1/.exec(text.slice(i));
      if (match) {
        flush();
        out.push("<code>" + escapeHtml(match[2].replace(/^ | $/g, "")) + "</code>");
        i += match[0].length;
        continue;
      }
    }

    /* image or link */
    if ((ch === "!" && text[i + 1] === "[") || ch === "[") {
      const isImage = ch === "!";
      const labelStart = i + (isImage ? 2 : 1);
      const labelEnd = text.indexOf("]", labelStart);
      if (labelEnd > -1 && text[labelEnd + 1] === "(") {
        const destEnd = findClosing(text, labelEnd + 1, "(", ")");
        if (destEnd > -1) {
          const label = text.slice(labelStart, labelEnd);
          const { href, title } = splitDestination(text.slice(labelEnd + 2, destEnd));
          let url = safeHref(href);
          /* in-document anchor → this release's heading id, or the release page */
          if (url.startsWith("#")) {
            const slug = url.slice(1);
            if (ctx.slugs.has(slug)) {
              url = "#" + ctx.anchorPrefix + slug;
            } else if (ctx.anchorFallbackBase) {
              url = ctx.anchorFallbackBase + "#" + slug;
            }
          }
          if (url) {
            flush();
            const titleAttr = title ? ' title="' + escapeHtml(title) + '"' : "";
            if (isImage) {
              out.push(
                '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(label) + '"' +
                titleAttr + ' loading="lazy">'
              );
            } else {
              const external = /^https?:/i.test(url);
              out.push(
                '<a href="' + escapeHtml(url) + '"' + titleAttr +
                (external ? ' target="_blank" rel="noopener"' : "") + ">" +
                renderInline(label, ctx) + "</a>"
              );
            }
            i = destEnd + 1;
            continue;
          }
        }
      }
    }

    /* autolinks */
    if (ch === "<") {
      const url = /^<((?:https?:\/\/|mailto:)[^>\s]+)>/.exec(text.slice(i));
      if (url) {
        flush();
        out.push(
          '<a href="' + escapeHtml(url[1]) + '" target="_blank" rel="noopener">' +
          escapeHtml(url[1]) + "</a>"
        );
        i += url[0].length;
        continue;
      }
    }

    /* bold / italic / strikethrough */
    if (ch === "*" || ch === "_" || ch === "~") {
      const strong = new RegExp("^\\" + ch + "{2}(?=\\S)([\\s\\S]*?\\S)\\" + ch + "{2}").exec(text.slice(i));
      if (strong) {
        flush();
        out.push("<strong>" + renderInline(strong[1], ctx) + "</strong>");
        i += strong[0].length;
        continue;
      }
      if (ch === "~") {
        const strike = /^~~(?=\S)([\s\S]*?\S)~~/.exec(text.slice(i));
        if (strike) {
          flush();
          out.push("<del>" + renderInline(strike[1], ctx) + "</del>");
          i += strike[0].length;
          continue;
        }
      } else {
        const em = new RegExp(
          "^\\" + ch + "(?=\\S)([\\s\\S]*?\\S)\\" + ch + "(?![\\s\\S])?(?![\\w])"
        ).exec(text.slice(i));
        if (em) {
          flush();
          out.push("<em>" + renderInline(em[1], ctx) + "</em>");
          i += em[0].length;
          continue;
        }
      }
    }

    buffer += ch;
    i++;
  }

  flush();
  return out.join("");
}

/* ---------- headings ---------- */

/** Assign each heading its GitHub-compatible slug, de-duplicating repeats. */
function scanHeadings(lines) {
  const headings = [];
  const counts = new Map();
  let inFence = false;
  let fenceMarker = "";

  lines.forEach((line) => {
    const fence = FENCE_RE.exec(line);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fence[1][0];
      } else if (fence[1][0] === fenceMarker) {
        inFence = false;
      }
      return;
    }
    if (inFence) return;

    const heading = HEADING_RE.exec(line);
    if (!heading) return;
    const text = stripInline(heading[2]);
    let slug = slugify(text);
    if (counts.has(slug)) {
      const next = counts.get(slug) + 1;
      counts.set(slug, next);
      slug = slug + "-" + next;
    } else {
      counts.set(slug, 0);
    }
    headings.push({ level: heading[1].length, text, slug });
  });

  return headings;
}

function clampLevel(level) {
  return Math.min(6, Math.max(1, level));
}

/* ---------- blocks ---------- */

function splitTableRow(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let current = "";
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "\\" && trimmed[i + 1] === "|") {
      current += "|";
      i++;
      continue;
    }
    if (ch === "|") {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function isTableDelimiter(line) {
  return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(line) && line.includes("-");
}

/** Convert a nested item tree into HTML. */
function renderList(items, ctx) {
  const html = [];
  const stack = [];

  const closeTo = (indent) => {
    while (stack.length && stack[stack.length - 1].indent > indent) {
      html.push(stack.pop().ordered ? "</ol>" : "</ul>");
    }
  };

  items.forEach((item) => {
    closeTo(item.indent);
    const top = stack[stack.length - 1];
    if (!top || top.indent < item.indent || top.ordered !== item.ordered) {
      if (top && top.indent === item.indent && top.ordered !== item.ordered) {
        html.push(top.ordered ? "</ol>" : "</ul>");
        stack.pop();
      }
      stack.push({ indent: item.indent, ordered: item.ordered });
      html.push(item.ordered ? "<ol>" : "<ul>");
    }
    const body = item.children.length
      ? renderInline(item.text, ctx) + renderList(item.children, ctx)
      : renderInline(item.text, ctx);
    html.push("  <li>" + body + "</li>");
  });

  closeTo(-1);
  return html.join("\n");
}

/**
 * @param {string} source Markdown source.
 * @param {{anchorPrefix?: string, anchorFallbackBase?: string, headingOffset?: number,
 *          normalizeHeadings?: boolean}} [options]
 *   normalizeHeadings lifts the shallowest heading of this document to `##`, and
 *   headingOffset shifts every level by a fixed amount. Notes written at different
 *   depths — a release body starting at `##`, a CHANGELOG section starting at `###`
 *   — therefore render with the same visual hierarchy on the page.
 * @returns {{html: string, headings: Array<{level: number, text: string, slug: string, id: string}>}}
 */
export function renderMarkdown(source, options = {}) {
  const anchorPrefix = options.anchorPrefix || "";
  const lines = String(source || "").replace(/\r\n?/g, "\n").split("\n");

  let offset = Number.isFinite(options.headingOffset) ? options.headingOffset : 0;
  if (options.normalizeHeadings) {
    const levels = scanHeadings(lines).map((heading) => heading.level);
    if (levels.length) offset += 2 - Math.min(...levels);
  }
  const headings = scanHeadings(lines).map((heading) => ({
    ...heading,
    level: clampLevel(heading.level + offset),
  }));
  const ctx = {
    anchorPrefix,
    anchorFallbackBase: options.anchorFallbackBase || "",
    slugs: new Set(headings.map((heading) => heading.slug)),
  };

  const html = [];
  let headingIndex = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    /* fenced code */
    const fence = FENCE_RE.exec(line);
    if (fence) {
      const marker = fence[1];
      const lang = fence[2];
      const body = [];
      i++;
      while (i < lines.length && !new RegExp("^\\s*" + marker[0] + "{" + marker.length + ",}\\s*$").test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; /* closing fence (or end of input) */
      const className = lang ? ' class="language-' + escapeHtml(lang) + '"' : "";
      html.push("<pre><code" + className + ">" + escapeHtml(body.join("\n")) + "</code></pre>");
      continue;
    }

    /* horizontal rule */
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      html.push("<hr>");
      i++;
      continue;
    }

    /* heading */
    const heading = HEADING_RE.exec(line);
    if (heading) {
      const info = headings[headingIndex++] || {
        level: clampLevel(heading[1].length + offset),
        text: heading[2],
        slug: slugify(heading[2]),
      };
      const id = anchorPrefix + info.slug;
      html.push(
        '<h' + info.level + ' id="' + escapeHtml(id) + '">' + renderInline(heading[2], ctx) +
        "</h" + info.level + ">"
      );
      i++;
      continue;
    }

    /* blockquote */
    if (/^\s*>/.test(line)) {
      const body = [];
      while (
        i < lines.length &&
        (/^\s*>/.test(lines[i]) || (/^\s*$/.test(lines[i]) && /^\s*>/.test(lines[i + 1] || "")))
      ) {
        body.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      html.push("<blockquote>\n" + renderMarkdown(body.join("\n"), options).html + "\n</blockquote>");
      continue;
    }

    /* table */
    if (line.includes("|") && isTableDelimiter(lines[i + 1] || "")) {
      const header = splitTableRow(line);
      const align = splitTableRow(lines[i + 1]).map((cell) => {
        const left = cell.startsWith(":");
        const right = cell.endsWith(":");
        if (left && right) return "center";
        if (right) return "right";
        if (left) return "left";
        return "";
      });
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && !/^\s*$/.test(lines[i])) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      const cell = (content, index, tag) => {
        const style = align[index] ? ' style="text-align:' + align[index] + '"' : "";
        return "<" + tag + style + ">" + renderInline(content, ctx) + "</" + tag + ">";
      };
      html.push(
        "<table>\n<thead>\n<tr>" + header.map((c, n) => cell(c, n, "th")).join("") + "</tr>\n</thead>\n<tbody>\n" +
        rows.map((row) => "<tr>" + header.map((_, n) => cell(row[n] || "", n, "td")).join("") + "</tr>").join("\n") +
        "\n</tbody>\n</table>"
      );
      continue;
    }

    /* list (with nesting and continuation lines) */
    if (LIST_ITEM_RE.test(line)) {
      const flat = [];
      while (i < lines.length) {
        const item = LIST_ITEM_RE.exec(lines[i]);
        if (item) {
          flat.push({
            indent: item[1].replace(/\t/g, "  ").length,
            ordered: /\d/.test(item[2]),
            text: item[3],
            children: [],
          });
          i++;
          continue;
        }
        if (/^\s*$/.test(lines[i])) {
          const next = lines[i + 1];
          if (next && LIST_ITEM_RE.test(next)) {
            const nextIndent = LIST_ITEM_RE.exec(next)[1].replace(/\t/g, "  ").length;
            if (nextIndent >= flat[flat.length - 1].indent) {
              i++;
              continue;
            }
          }
          break;
        }
        /* continuation line belongs to the previous item */
        if (flat.length && /^\s+\S/.test(lines[i])) {
          flat[flat.length - 1].text += " " + lines[i].trim();
          i++;
          continue;
        }
        break;
      }

      /* fold the flat run into a tree using a monotonic indent stack */
      const roots = [];
      const stack = [];
      flat.forEach((item) => {
        while (stack.length && stack[stack.length - 1].indent >= item.indent) stack.pop();
        if (stack.length) stack[stack.length - 1].children.push(item);
        else roots.push(item);
        stack.push(item);
      });

      html.push(renderList(roots, ctx));
      continue;
    }

    /* paragraph */
    const paragraph = [];
    while (i < lines.length && !/^\s*$/.test(lines[i])) {
      const next = lines[i];
      if (
        HEADING_RE.test(next) ||
        FENCE_RE.test(next) ||
        /^\s*>/.test(next) ||
        LIST_ITEM_RE.test(next) ||
        /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(next)
      ) break;
      paragraph.push(next.trim());
      i++;
    }
    if (paragraph.length) {
      html.push("<p>" + renderInline(paragraph.join("\n"), ctx) + "</p>");
    } else {
      i++; /* defensive: never loop forever on an unexpected line */
    }
  }

  return {
    html: html.join("\n"),
    headings: headings.map((heading) => ({ ...heading, id: anchorPrefix + heading.slug })),
  };
}
