/* DataNexa Changelog — renders data/releases.json.
 *
 * The data file is owned by CI (scripts/sync-releases.mjs) and this page never
 * writes to it, so the two can evolve independently:
 *   · the main repo publishes a release  → data/releases.json changes
 *   · the design of this page           → only this file changes
 *
 * Language follows the site toggle: every string here exists twice, and the cards
 * are re-rendered when main.js reports a language change.
 */

(function () {
  "use strict";

  var DATA_URL = "data/releases.json";
  var RELEASES_URL = "https://github.com/MingoZacwu/DataNexa/releases";

  var listEl = document.getElementById("clList");
  if (!listEl) return;

  var statusEl = document.getElementById("clStatus");
  var searchEl = document.getElementById("clSearch");
  var prereleaseEl = document.getElementById("clPrerelease");
  var latestWrap = document.getElementById("latest");
  var latestEl = document.getElementById("clLatest");

  var S = {
    zh: {
      latest: "最新版本",
      latestStable: "最新稳定版",
      prerelease: "预发布",
      released: "发布于",
      downloads: "下载",
      recommended: "适用于当前系统",
      loading: "正在加载版本记录……",
      noMatch: "没有匹配的版本，换个关键词试试。",
      empty: "该版本的发布说明中没有独立的更新记录，完整内容可在 GitHub 上查看。",
      fallback: "该版本没有英文说明，以下为发布时的原始说明。",
      viewOnGithub: "在 GitHub 上查看",
      error: "无法加载更新日志数据（{detail}）。",
      errorHint: "本地预览请通过 HTTP 打开（例如：python -m http.server），file:// 下浏览器会阻止读取数据文件。"
    },
    en: {
      latest: "Latest",
      latestStable: "Latest stable",
      prerelease: "Pre-release",
      released: "Released",
      downloads: "Downloads",
      recommended: "For your system",
      loading: "Loading release history…",
      noMatch: "No matching release — try another keyword.",
      empty: "This release has no separate change log; view the full description on GitHub.",
      fallback: "English notes were not published for this version — the original notes are shown.",
      viewOnGithub: "View on GitHub",
      error: "Could not load the changelog data ({detail}).",
      errorHint: "To preview locally, serve the folder over HTTP (for example: python -m http.server) — browsers block reading data files over file://."
    }
  };

  var state = { data: null, entries: [], cards: [], query: "", includePrerelease: true, lang: "zh" };

  function currentLang() {
    return document.documentElement.lang === "en" ? "en" : "zh";
  }

  function t(key) {
    return (S[state.lang] && S[state.lang][key]) || S.zh[key] || key;
  }

  function format(value, values) {
    return String(value).replace(/\{(\w+)\}/g, function (match, name) {
      return name in values ? values[name] : match;
    });
  }

  /* ---------- tiny DOM helpers ---------- */

  var ICONS = {
    download: [["path", { d: "M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 19.5h16" }]],
    external: [["path", { d: "M7 17L17 7M9 7h8v8" }]],
    chevron: [["path", { d: "M6 9l6 6 6-6" }]]
  };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function svgIcon(name) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    (ICONS[name] || []).forEach(function (entry) {
      var child = document.createElementNS("http://www.w3.org/2000/svg", entry[0]);
      Object.keys(entry[1]).forEach(function (attribute) {
        child.setAttribute(attribute, entry[1][attribute]);
      });
      svg.appendChild(child);
    });
    return svg;
  }

  function formatBytes(bytes) {
    if (!bytes) return "";
    var mb = bytes / 1048576;
    if (mb >= 1) return (Math.round(mb * 10) / 10).toFixed(1) + " MB";
    return Math.max(1, Math.round(bytes / 1024)) + " KB";
  }

  function formatDate(value) {
    if (!value) return "";
    var date = new Date(value);
    if (isNaN(date.getTime())) return value;
    var pad = function (number) { return number < 10 ? "0" + number : String(number); };
    if (state.lang === "en") {
      var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return months[date.getMonth()] + " " + pad(date.getDate()) + ", " + date.getFullYear();
    }
    return date.getFullYear() + " 年 " + (date.getMonth() + 1) + " 月 " + date.getDate() + " 日";
  }

  /* Visitors looking for "the download" get their own platform first. */
  function detectPlatform() {
    var ua = navigator.userAgent || "";
    if (/Mac|iPhone|iPad|iPod/i.test(ua)) return "macos";
    if (/Win/i.test(ua)) return "windows";
    if (/Linux|X11|Android/i.test(ua)) return "linux";
    return "";
  }

  var PLATFORM_LABEL = { macos: "macOS", windows: "Windows", linux: "Linux", other: "" };

  /* ---------- rendering ---------- */

  function badge(text, variant) {
    return el("span", "cl-badge cl-badge-" + variant, text);
  }

  function buildAssetLinks(entry, options) {
    var wrap = el("div", "cl-assets" + (options.compact ? " is-compact" : ""));
    if (!options.compact) wrap.appendChild(el("span", "cl-assets-label", t("downloads")));

    entry.assets.forEach(function (asset) {
      var recommended = asset.platform && asset.platform === options.recommendedPlatform;
      var link = el("a", "cl-asset" + (recommended ? " is-recommended" : ""));
      link.href = asset.downloadUrl;
      link.rel = "noopener";
      link.appendChild(svgIcon("download"));
      link.appendChild(el("span", "cl-asset-name", PLATFORM_LABEL[asset.platform] || asset.platform));
      var meta = formatBytes(asset.sizeBytes);
      if (recommended) meta = meta ? meta + " · " + t("recommended") : t("recommended");
      if (meta) link.appendChild(el("span", "cl-asset-meta", meta));
      wrap.appendChild(link);
    });

    return wrap;
  }

  function buildCard(entry, index, platform) {
    var notes = entry.notes[state.lang] || entry.notes.zh;
    var card = el("details", "cl-card" + (index === 0 ? " is-latest" : ""));
    card.id = entry.tag;
    card.dataset.tag = entry.tag;
    card.dataset.prerelease = String(Boolean(entry.prerelease));

    /* head (summary) */
    var head = el("summary", "cl-head");
    head.appendChild(el("span", "cl-version", entry.tag));
    var badges = el("span", "cl-badges");
    if (entry.tag === state.data.latest) badges.appendChild(badge(t("latest"), "latest"));
    else if (entry.tag === state.data.latestStable) badges.appendChild(badge(t("latestStable"), "stable"));
    if (entry.prerelease) badges.appendChild(badge(t("prerelease"), "pre"));
    if (badges.childNodes.length) head.appendChild(badges);
    head.appendChild(el("span", "cl-head-date", formatDate(entry.publishedAt || entry.date)));
    var caret = el("span", "cl-caret");
    caret.appendChild(svgIcon("chevron"));
    head.appendChild(caret);
    card.appendChild(head);

    /* body */
    var body = el("div", "cl-body");

    if (notes.fallbackFromZh && state.lang === "en") {
      body.appendChild(el("p", "cl-note cl-note-fallback", t("fallback")));
    }

    var notesEl = el("div", "cl-notes");
    if (notes.empty) notesEl.appendChild(el("p", "cl-note", t("empty")));
    else notesEl.innerHTML = notes.html;
    body.appendChild(notesEl);

    if (entry.assets && entry.assets.length) {
      body.appendChild(buildAssetLinks(entry, { recommendedPlatform: platform }));
    }

    /* The link to the full release page closes the card, rather than sitting above
       the notes as an orphaned button. */
    var foot = el("div", "cl-foot");
    var githubLink = el("a", "cl-gh");
    githubLink.href = entry.url;
    githubLink.target = "_blank";
    githubLink.rel = "noopener";
    githubLink.appendChild(svgIcon("external"));
    githubLink.appendChild(el("span", null, t("viewOnGithub")));
    foot.appendChild(githubLink);
    body.appendChild(foot);

    card.appendChild(body);

    /* Searchable text spans both languages, so a keyword works in either UI language. */
    var searchText = [entry.tag, entry.version, entry.name, entry.date];
    Object.keys(entry.notes).forEach(function (lang) {
      var holder = document.createElement("div");
      holder.innerHTML = entry.notes[lang].html;
      searchText.push(holder.textContent);
    });
    card._searchText = searchText.join(" ").toLowerCase();

    return card;
  }

  function renderLatest(entry) {
    if (!latestEl || !latestWrap || !entry) return;
    latestEl.innerHTML = "";

    var info = el("div", "cl-latest-info");
    var top = el("div", "cl-latest-top");
    top.appendChild(badge(t("latest"), "latest"));
    top.appendChild(el("span", "cl-latest-tag", entry.tag));
    info.appendChild(top);
    info.appendChild(el("span", "cl-latest-date", t("released") + " " + formatDate(entry.publishedAt || entry.date)));
    latestEl.appendChild(info);

    var actions = el("div", "cl-latest-actions");
    if (entry.assets && entry.assets.length) {
      actions.appendChild(buildAssetLinks(entry, { compact: true, recommendedPlatform: detectPlatform() }));
    }
    var link = el("a", "btn btn-ghost cl-latest-link", t("viewOnGithub"));
    link.href = entry.url;
    link.target = "_blank";
    link.rel = "noopener";
    actions.appendChild(link);
    latestEl.appendChild(actions);

    latestWrap.hidden = false;
  }

  function render() {
    state.lang = currentLang();
    var platform = detectPlatform();
    var firstRender = state.cards.length === 0;
    var openTags = state.cards
      .filter(function (card) { return card.open; })
      .map(function (card) { return card.dataset.tag; });

    listEl.innerHTML = "";
    state.cards = [];
    state.entries.forEach(function (entry, index) {
      var card = buildCard(entry, index, platform);
      /* 首次渲染展开最新一版，之后只保留用户自己展开过的卡片 */
      if (openTags.indexOf(entry.tag) > -1 || (firstRender && index === 0)) card.open = true;
      state.cards.push(card);
      listEl.appendChild(card);
    });

    renderLatest(state.entries[0]);
    applyFilters();
  }

  /* ---------- filtering & status ---------- */

  function applyFilters() {
    var query = state.query.trim().toLowerCase();
    var visible = 0;

    state.entries.forEach(function (entry, index) {
      var card = state.cards[index];
      if (!card) return;
      var show = (!query || card._searchText.indexOf(query) > -1) &&
        (state.includePrerelease || !entry.prerelease);
      card.hidden = !show;
      if (show) visible++;
    });

    if (statusEl) {
      if (visible > 0) {
        statusEl.hidden = true;
      } else if (state.cards.length) {
        setStatus(t("noMatch"));
      }
    }
  }

  /* JS owns this node after the first write, so drop data-i18n to keep main.js
     from restoring the initial "loading" text on a language switch. */
  function setStatus(text) {
    if (!statusEl) return;
    statusEl.removeAttribute("data-i18n");
    statusEl.classList.remove("is-error");
    statusEl.innerHTML = "";
    if (text) statusEl.appendChild(el("span", null, text));
    statusEl.hidden = !text;
  }

  function showError(detail) {
    if (!statusEl) return;
    statusEl.removeAttribute("data-i18n");
    statusEl.classList.add("is-error");
    statusEl.hidden = false;
    statusEl.innerHTML = "";
    statusEl.appendChild(el("strong", null, format(t("error"), { detail: detail })));

    var link = el("a", null, "GitHub Releases");
    link.href = RELEASES_URL;
    link.target = "_blank";
    link.rel = "noopener";
    statusEl.appendChild(document.createTextNode(" "));
    statusEl.appendChild(link);

    if (location.protocol === "file:") {
      statusEl.appendChild(el("span", "cl-status-hint", t("errorHint")));
    }
  }

  /* ---------- deep links ---------- */

  function focusHash(scroll) {
    var raw = location.hash.replace(/^#/, "");
    if (!raw) return;
    var id = raw;
    try { id = decodeURIComponent(raw); } catch (error) { id = raw; }

    /* Section anchors carry the current language's slug, so a link shared by a
       reader of the other language lands on nothing — fall back to the version
       card the anchor belongs to (ids are "<tag>--<slug>"). */
    var target = document.getElementById(id);
    var section = true;
    if (!target) {
      var separator = id.lastIndexOf("--");
      var tag = separator > 0 ? id.slice(0, separator) : id;
      target = document.getElementById(tag);
      section = false;
    }
    if (!target) return;

    var card = target.closest ? target.closest("details.cl-card") : null;
    if (card) card.open = true;

    if (scroll !== false) {
      requestAnimationFrame(function () {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    if (section && target !== card) {
      target.classList.add("cl-flash");
      setTimeout(function () { target.classList.remove("cl-flash"); }, 1800);
    }
  }

  /* 首次进入带锚点的链接时，等页面加载完成再定位。浏览器在 load 时还会做一次
     原生片段定位，与提前发起的平滑滚动相互抢占，实测会让页面停在顶部。 */
  function focusHashWhenSettled() {
    if (!location.hash) return;
    var started = false;
    var run = function () {
      if (started) return;
      started = true;
      focusHash(true);
    };
    requestAnimationFrame(function () {
      if (document.readyState === "complete") {
        run();
        return;
      }
      window.addEventListener("load", run, { once: true });
      setTimeout(run, 1500); /* load 被慢资源拖住时的兜底 */
    });
  }

  /* ---------- events ---------- */

  if (searchEl) {
    searchEl.addEventListener("input", function () {
      state.query = searchEl.value;
      applyFilters();
    });
  }

  if (prereleaseEl) {
    prereleaseEl.addEventListener("change", function () {
      state.includePrerelease = prereleaseEl.checked;
      applyFilters();
    });
  }

  window.addEventListener("hashchange", function () { focusHash(true); });

  /* main.js owns the language toggle; re-render the cards when it fires */
  document.addEventListener("datanexa:langchange", function () {
    if (!state.entries.length) return;
    render();
    focusHash(false);
  });

  /* ---------- load ---------- */

  state.lang = currentLang();
  if (statusEl) setStatus(t("loading"));

  fetch(DATA_URL, { cache: "no-cache" })
    .then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    })
    .then(function (data) {
      if (!data || !Array.isArray(data.releases) || !data.releases.length) {
        throw new Error("empty data");
      }
      state.data = data;
      state.entries = data.releases;
      state.includePrerelease = prereleaseEl ? prereleaseEl.checked : true;
      render();
      setStatus("");
      focusHashWhenSettled();
    })
    .catch(function (error) {
      showError(error && error.message ? error.message : String(error));
    });
})();
