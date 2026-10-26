/* ============================================================
   DataNexa Official Site — Help Center behaviors
   ------------------------------------------------------------
   1. 侧边目录（移动端折叠）+ 滚动高亮 + 阅读进度
   2. 全站内搜索（标题 / 正文 / FAQ），快捷键按平台显示，阅读中唤起悬浮搜索
   3. 代码块复制
   4. 截图位：图片存在则自动替换占位，支持点击放大
   5. 语言切换：与 main.js 的「中 / EN」按钮联动
      —— 中文文案直接写在 HTML，英文文案位于 assets/help-en.js
   ============================================================ */

(function () {
  "use strict";

  var root = document.documentElement;
  var doc = document;
  var HELP_EN = window.DataNexaHelpEn || {};

  /* ---------- 1. 侧边目录 / 高亮 / 进度 ---------- */
  var sideToggle = doc.getElementById("docNavToggle");
  var docNav = doc.getElementById("docNav");

  if (sideToggle && docNav) {
    sideToggle.addEventListener("click", function () {
      var open = docNav.classList.toggle("is-open");
      sideToggle.setAttribute("aria-expanded", String(open));
    });
    docNav.addEventListener("click", function (e) {
      if (e.target.closest("a") && window.innerWidth <= 900) {
        docNav.classList.remove("is-open");
        sideToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  var sections = Array.prototype.slice.call(doc.querySelectorAll(".doc-section[id]"));
  var navLinks = {};
  Array.prototype.forEach.call(doc.querySelectorAll(".docs-nav a[href^='#']"), function (link) {
    navLinks[link.getAttribute("href").slice(1)] = link;
  });

  var progressFill = doc.querySelector(".docs-progress i");
  var backTop = doc.querySelector(".docs-top");

  function setActive(id) {
    Object.keys(navLinks).forEach(function (key) {
      navLinks[key].classList.toggle("is-active", key === id);
    });
  }

  function onScroll() {
    var scrollY = window.scrollY || window.pageYOffset;
    var viewport = window.innerHeight;
    var docHeight = doc.documentElement.scrollHeight - viewport;

    if (progressFill) {
      var ratio = docHeight > 0 ? Math.min(1, Math.max(0, scrollY / docHeight)) : 0;
      progressFill.style.width = (ratio * 100).toFixed(2) + "%";
    }
    if (backTop) backTop.classList.toggle("is-visible", scrollY > 720);
    updateSearchFab();

    /* 以视口上方 120px 处为判定线，取最后一个越线的章节 */
    var current = sections.length ? sections[0].id : null;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top <= 120) current = sections[i].id;
      else break;
    }
    if (current) setActive(current);
  }

  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      onScroll();
      ticking = false;
    });
  }, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();

  /* ---------- 2. 搜索 ---------- */
  var searchHero = doc.querySelector(".docs-hero");
  var searchIsMac = (function () {
    var platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    return /mac|iphone|ipad|ipod/i.test(platform);
  })();
  var searchShortcut = searchIsMac ? "⌘ K" : "Ctrl K";

  Array.prototype.forEach.call(doc.querySelectorAll("[data-search-shortcut]"), function (node) {
    node.textContent = searchShortcut;
  });

  var searchPanels = [];
  var searchIndex = [];

  function normalize(text) {
    return (text || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function nearestHeading(el) {
    var node = el.previousElementSibling;
    while (node) {
      if (/^H[234]$/.test(node.tagName)) return node.textContent.replace(/#$/, "").trim();
      node = node.previousElementSibling;
    }
    var section = el.closest(".doc-section");
    var h2 = section ? section.querySelector("h2") : null;
    return h2 ? h2.textContent.replace(/#$/, "").trim() : "";
  }

  function buildSearchIndex() {
    searchIndex = [];
    Array.prototype.forEach.call(doc.querySelectorAll(".doc-section"), function (section) {
      if (section.id === "screenshots" || section.hidden) return;
      var sectionTitle = "";
      var h2 = section.querySelector("h2");
      if (h2) sectionTitle = h2.textContent.replace(/#$/, "").trim();

      var blocks = section.querySelectorAll("h3, h4, p, li, td, figcaption");
      Array.prototype.forEach.call(blocks, function (block, index) {
        if (block.closest("[data-search-skip]")) return;
        var text = block.textContent.replace(/\s+/g, " ").trim();
        if (text.length < 4) return;
        if (!block.id) block.id = section.id + "-s" + index;
        searchIndex.push({
          id: block.id,
          text: text,
          section: sectionTitle,
          title: /^H[234]$/.test(block.tagName) ? text.replace(/#$/, "").trim() : nearestHeading(block),
          isHeading: /^H[234]$/.test(block.tagName)
        });
      });
    });
  }
  buildSearchIndex();

  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function highlight(text, query) {
    var q = normalize(query);
    if (!q) return escapeHtml(text);
    var lower = text.toLowerCase();
    var at = lower.indexOf(q);
    if (at < 0) return escapeHtml(text);
    return escapeHtml(text.slice(0, at)) +
      "<mark>" + escapeHtml(text.slice(at, at + q.length)) + "</mark>" +
      escapeHtml(text.slice(at + q.length));
  }

  function snippet(text, query) {
    var q = normalize(query);
    var lower = text.toLowerCase();
    var at = lower.indexOf(q);
    var start = Math.max(0, at - 34);
    var end = Math.min(text.length, at + q.length + 74);
    return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
  }

  function search(query) {
    var q = normalize(query);
    if (q.length < 2) return [];
    var scored = [];
    searchIndex.forEach(function (entry) {
      var haystack = entry.text.toLowerCase();
      var title = entry.title.toLowerCase();
      var at = haystack.indexOf(q);
      if (at < 0) return;
      var score = 1;
      if (title.indexOf(q) > -1) score += 8;
      if (entry.isHeading) score += 4;
      if (at === 0) score += 2;
      score += Math.min(3, haystack.split(q).length - 1);
      scored.push({ entry: entry, score: score });
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, 10).map(function (item) { return item.entry; });
  }

  function createSearchPanel(config) {
    var input = doc.getElementById(config.inputId);
    var results = doc.getElementById(config.resultsId);
    if (!input || !results) return null;

    var panel = {
      input: input,
      results: results,
      wrap: config.wrap || input.closest(".docs-search"),
      activeResult: -1,
      nodes: [],
      /* 悬浮层由遮罩点击负责关闭；文档级的「点外部收起」只作用于头图搜索框，
         否则点 FAB 时这次点击会冒泡上来，把刚打开的悬浮层立刻关掉 */
      dismissOnOutsideClick: config.dismissOnOutsideClick !== false,
      onOpen: config.onOpen,
      onClose: config.onClose,
      onClear: config.onClear
    };
    searchPanels.push(panel);

    var timer = null;
    input.addEventListener("input", function () {
      window.clearTimeout(timer);
      var value = input.value;
      timer = window.setTimeout(function () {
        /* 关键词不足两个字符时只收起结果，不关闭所在的搜索层 */
        if (normalize(value).length < 2) {
          if (hideResults(panel) && panel.onClear) panel.onClear();
          return;
        }
        renderResults(panel, search(value), value);
      }, 110);
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); moveActive(panel, 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(panel, -1); }
      else if (e.key === "Enter") {
        if (panel.activeResult > -1 && panel.nodes[panel.activeResult]) {
          e.preventDefault();
          goToResult(panel.nodes[panel.activeResult].getAttribute("data-target"));
        }
      } else if (e.key === "Escape") {
        closePanel(panel);
        input.blur();
      }
    });

    return panel;
  }

  function hideResults(panel) {
    if (!panel) return false;
    var wasOpen = !panel.results.hidden;
    panel.results.hidden = true;
    panel.activeResult = -1;
    panel.nodes = [];
    return wasOpen;
  }

  function closePanel(panel, opts) {
    if (!panel) return;
    var wasOpen = hideResults(panel);
    if (panel.onClose) panel.onClose(wasOpen, opts || {});
  }

  function closeResults(opts) {
    searchPanels.forEach(function (panel) { closePanel(panel, opts); });
  }

  function emptyResultsText() {
    return root.getAttribute("lang") === "en"
      ? "No matches. Try a different keyword."
      : "没有找到相关内容，换个关键词试试。";
  }

  function renderResults(panel, entries, query) {
    var results = panel.results;
    if (!results) return;
    searchPanels.forEach(function (other) {
      if (other !== panel) closePanel(other);
    });
    panel.activeResult = -1;
    panel.nodes = [];
    if (panel.onOpen) panel.onOpen();
    if (!entries.length) {
      results.innerHTML = '<div class="docs-search-empty">' + emptyResultsText() + "</div>";
      results.hidden = false;
      return;
    }
    results.innerHTML = "";
    entries.forEach(function (entry) {
      var button = doc.createElement("button");
      button.type = "button";
      button.className = "docs-search-item";
      button.setAttribute("role", "option");
      button.setAttribute("data-target", entry.id);
      button.innerHTML =
        '<span class="docs-search-item-title">' + highlight(entry.title, query) +
        "<em>" + escapeHtml(entry.section) + "</em></span>" +
        (entry.isHeading ? "" : '<span class="docs-search-item-snippet">' + highlight(snippet(entry.text, query), query) + "</span>");
      button.addEventListener("click", function () { goToResult(entry.id); });
      results.appendChild(button);
      panel.nodes.push(button);
    });
    results.hidden = false;
  }

  var searchToast = null;
  var searchToastTimer = 0;

  function showSearchToast(title) {
    if (!searchToast) {
      searchToast = doc.createElement("div");
      searchToast.className = "docs-search-toast";
      doc.body.appendChild(searchToast);
    }
    var isEn = root.getAttribute("lang") === "en";
    var prefix = isEn ? "Jumped to: " : "已定位：";
    searchToast.textContent = prefix + (title || (isEn ? "search result" : "搜索结果"));
    searchToast.classList.add("is-visible");
    window.clearTimeout(searchToastTimer);
    searchToastTimer = window.setTimeout(function () {
      searchToast.classList.remove("is-visible");
    }, 2600);
  }

  function goToResult(id) {
    var target = doc.getElementById(id);
    if (!target) return;
    closeResults({ restoreFocus: false });
    if (doc.activeElement && doc.activeElement.blur) doc.activeElement.blur();

    /* 目标停在视口中上部：既避开固定顶栏，也避免落在章节末尾时
       屏幕里只剩下一章的大标题。 */
    var anchorOffset = Math.min(320, Math.max(96, window.innerHeight * 0.35));
    var top = target.getBoundingClientRect().top + (window.scrollY || window.pageYOffset) - anchorOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
    /* 图片比例已与占位框一致，落点后做一次极小的位置校正 */
    window.requestAnimationFrame(function () {
      var corrected = target.getBoundingClientRect().top + (window.scrollY || window.pageYOffset) - anchorOffset;
      if (Math.abs(corrected - (window.scrollY || window.pageYOffset)) > 2) {
        window.scrollTo({ top: Math.max(0, corrected), behavior: "auto" });
      }
    });

    var hit = null;
    for (var i = 0; i < searchIndex.length; i++) {
      if (searchIndex[i].id === id) { hit = searchIndex[i]; break; }
    }
    showSearchToast(hit ? hit.title : "");

    target.classList.add("is-search-hit");
    window.setTimeout(function () { target.classList.remove("is-search-hit"); }, 3000);
  }

  function moveActive(panel, delta) {
    if (!panel.nodes.length) return;
    panel.activeResult = (panel.activeResult + delta + panel.nodes.length) % panel.nodes.length;
    panel.nodes.forEach(function (node, index) {
      node.classList.toggle("is-active", index === panel.activeResult);
    });
    panel.nodes[panel.activeResult].scrollIntoView({ block: "nearest" });
  }

  var heroPanel = createSearchPanel({
    inputId: "docSearch",
    resultsId: "docSearchResults",
    onOpen: function () { if (searchHero) searchHero.classList.add("is-search-open"); },
    onClose: function () { if (searchHero) searchHero.classList.remove("is-search-open"); },
    onClear: function () { if (searchHero) searchHero.classList.remove("is-search-open"); }
  });

  var searchModal = doc.getElementById("docSearchModal");
  var searchModalPanel = doc.querySelector(".docs-search-modal-panel");
  var searchFab = doc.getElementById("docSearchFab");
  var searchModalLastFocus = null;

  function focusPanel(panel) {
    if (!panel) return;
    panel.input.focus({ preventScroll: true });
    panel.input.select();
  }

  function openSearchModal() {
    if (!searchModal || !searchModal.hidden) return;
    searchModalLastFocus = doc.activeElement;
    searchModal.hidden = false;
  }

  function closeSearchModal(opts) {
    if (!searchModal || searchModal.hidden) return;
    searchModal.hidden = true;
    hideResults(modalPanel);
    if (!opts || opts.restoreFocus !== false) {
      var previous = searchModalLastFocus;
      searchModalLastFocus = null;
      if (previous && previous.focus && doc.contains(previous)) previous.focus({ preventScroll: true });
    }
  }

  var modalPanel = createSearchPanel({
    inputId: "docSearchFloat",
    resultsId: "docSearchFloatResults",
    wrap: searchModalPanel,
    dismissOnOutsideClick: false,
    onOpen: function () { openSearchModal(); },
    onClose: function (wasOpen, opts) { closeSearchModal(opts); }
  });

  function isHeroSearchVisible() {
    if (!heroPanel) return false;
    var rect = heroPanel.input.getBoundingClientRect();
    var height = window.innerHeight || doc.documentElement.clientHeight;
    return rect.top >= 0 && rect.bottom <= height;
  }

  /* 「回到顶部」上方的小入口：头图搜索框滚出视口后出现 */
  function updateSearchFab() {
    if (!searchFab) return;
    var scrollY = window.scrollY || window.pageYOffset;
    searchFab.classList.toggle("is-visible", scrollY > 720 && !isHeroSearchVisible());
  }

  if (searchFab) {
    searchFab.addEventListener("click", openFloatingSearch);
    updateSearchFab();
  }

  function openFloatingSearch() {
    searchPanels.forEach(function (panel) {
      if (panel !== modalPanel) closePanel(panel);
    });
    openSearchModal();
    if (!modalPanel) return;
    var value = modalPanel.input.value;
    if (normalize(value).length >= 2) renderResults(modalPanel, search(value), value);
    focusPanel(modalPanel);
  }

  function openSearch() {
    if (modalPanel && searchModal && !searchModal.hidden) {
      focusPanel(modalPanel);
      return;
    }
    /* 头图里的搜索框仍然可见时就地聚焦，不做任何滚动；已滚出视口则唤起悬浮搜索 */
    if (heroPanel && isHeroSearchVisible()) {
      focusPanel(heroPanel);
      return;
    }
    openFloatingSearch();
  }

  if (searchModal) {
    searchModal.addEventListener("click", function (e) {
      if (e.target === searchModal) closeSearchModal();
    });

    /* 不用 overflow 锁滚动（会让 sticky 的侧边目录失效），
       改为在遮罩上吃掉滚轮与触摸手势；结果列表内部仍可滚动 */
    function allowInnerScroll(e) {
      var scroller = e.target.closest ? e.target.closest(".docs-search-results") : null;
      if (!scroller) return false;
      if (scroller.scrollHeight <= scroller.clientHeight) return false;
      var delta = e.deltaY;
      if (!delta && e.touches && e.touches.length) delta = 1;
      if (delta < 0) return scroller.scrollTop > 0;
      if (delta > 0) return scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1;
      return true;
    }

    searchModal.addEventListener("wheel", function (e) {
      if (!allowInnerScroll(e)) e.preventDefault();
    }, { passive: false });

    searchModal.addEventListener("touchmove", function (e) {
      if (!allowInnerScroll(e)) e.preventDefault();
    }, { passive: false });
  }

  /* 悬浮层没有用 overflow 锁滚动，按键滚动同样要挡掉；
     空格不挡，输入框里要能打空格 */
  doc.addEventListener("keydown", function (e) {
    if (!searchModal || searchModal.hidden) return;
    if (e.key === "PageUp" || e.key === "PageDown" || e.key === "Home" || e.key === "End") {
      e.preventDefault();
    }
  });

  doc.addEventListener("click", function (e) {
    searchPanels.forEach(function (panel) {
      if (!panel.dismissOnOutsideClick) return;
      if (!panel.results.hidden && panel.wrap && !panel.wrap.contains(e.target)) closePanel(panel);
    });
  });

  doc.addEventListener("keydown", function (e) {
    if (e.altKey || e.shiftKey) return;
    var modifier = searchIsMac ? e.metaKey : e.ctrlKey;
    if (!modifier || e.key.toLowerCase() !== "k") return;
    e.preventDefault();
    openSearch();
  });

  doc.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && searchModal && !searchModal.hidden) closeSearchModal();
  });

  /* 悬浮层是 aria-modal 对话框：Tab 在输入框与结果之间循环，不跑到背景正文 */
  doc.addEventListener("keydown", function (e) {
    if (e.key !== "Tab" || !searchModal || searchModal.hidden || !modalPanel) return;
    var focusables = [modalPanel.input].concat(modalPanel.nodes);
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (!searchModalPanel.contains(doc.activeElement)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && doc.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && doc.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  /* ---------- 3. 代码块复制 ---------- */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var area = doc.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      doc.body.appendChild(area);
      area.select();
      try {
        doc.execCommand("copy");
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        doc.body.removeChild(area);
      }
    });
  }

  Array.prototype.forEach.call(doc.querySelectorAll(".doc-code"), function (block) {
    if (block.querySelector(".doc-code-head")) return;
    var code = block.querySelector("pre code");
    var pre = block.querySelector("pre");
    if (!code || !pre) return;

    var lang = block.getAttribute("data-lang") || "";
    var head = doc.createElement("div");
    head.className = "doc-code-head";
    head.innerHTML =
      '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="8 6 3 12 8 18"/><polyline points="16 6 21 12 16 18"/></svg>' +
      (lang ? escapeHtml(lang) : "代码") + "</span>" +
      '<button class="doc-copy" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg><span>复制</span></button>';

    var copyBtn = head.querySelector(".doc-copy");
    copyBtn.addEventListener("click", function () {
      copyText(code.textContent).then(function () {
        copyBtn.classList.add("is-copied");
        copyBtn.querySelector("span").textContent = "已复制";
        window.setTimeout(function () {
          copyBtn.classList.remove("is-copied");
          copyBtn.querySelector("span").textContent = "复制";
        }, 1800);
      }).catch(function () {
        copyBtn.querySelector("span").textContent = "复制失败";
        window.setTimeout(function () { copyBtn.querySelector("span").textContent = "复制"; }, 1800);
      });
    });

    block.insertBefore(head, pre);
  });

  /* ---------- 4. 截图位：有图则显示，可放大 ---------- */
  var lightbox = null;

  function ensureLightbox() {
    if (lightbox) return lightbox;
    lightbox = doc.createElement("div");
    lightbox.className = "shot-lightbox";
    lightbox.hidden = true;
    lightbox.innerHTML =
      '<button class="shot-lightbox-close" type="button" aria-label="关闭大图">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<img alt="">';
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox || e.target.closest(".shot-lightbox-close")) closeLightbox();
    });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && lightbox && !lightbox.hidden) closeLightbox();
    });
    doc.body.appendChild(lightbox);
    return lightbox;
  }

  function openLightbox(src, alt) {
    var box = ensureLightbox();
    var image = box.querySelector("img");
    image.src = src;
    image.alt = alt || "";
    box.hidden = false;
    doc.body.classList.add("modal-open");
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    doc.body.classList.remove("modal-open");
  }

  Array.prototype.forEach.call(doc.querySelectorAll(".shot-frame"), function (frame) {
    var image = frame.querySelector("img");
    if (!image) return;

    function markLoaded() {
      if (image.naturalWidth > 0) frame.classList.add("is-loaded");
    }
    /* Always attach listeners: a lazy image can report complete=true with
       naturalWidth=0 before the browser actually starts fetching it. */
    image.addEventListener("load", markLoaded);
    image.addEventListener("error", function () { frame.classList.remove("is-loaded"); });
    if (image.complete) markLoaded();

    frame.addEventListener("click", function () {
      if (!frame.classList.contains("is-loaded")) return;
      openLightbox(image.currentSrc || image.src, image.alt);
    });
  });

  /* ---------- 5. 语言切换 ---------- */
  var zhCache = {};
  var attrCache = {};
  var helpNodes = Array.prototype.slice.call(doc.querySelectorAll('[data-i18n^="doc."]'));
  var helpAttrNodes = Array.prototype.slice.call(doc.querySelectorAll('[data-i18n-attr*="doc."]'));

  function captureScrollAnchor() {
    var probe = 128;
    var x = Math.min(window.innerWidth - 32, Math.max(32, window.innerWidth * 0.62));
    var el = doc.elementFromPoint ? doc.elementFromPoint(x, probe) : null;
    while (el && el !== doc.body) {
      var key = el.getAttribute && el.getAttribute("data-i18n");
      if (key && key.indexOf("doc.") === 0) {
        return { el: el, top: el.getBoundingClientRect().top };
      }
      el = el.parentElement;
    }
    for (var i = 0; i < sections.length; i++) {
      var rect = sections[i].getBoundingClientRect();
      if (rect.top <= probe && rect.bottom > probe) {
        return { el: sections[i], top: rect.top };
      }
    }
    var hero = doc.querySelector(".docs-hero");
    return hero ? { el: hero, top: hero.getBoundingClientRect().top } : null;
  }

  function restoreScrollAnchor(anchor) {
    if (!anchor || !anchor.el) return;
    var delta = anchor.el.getBoundingClientRect().top - anchor.top;
    if (Math.abs(delta) < 1) return;
    var html = doc.documentElement;
    var previous = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    window.scrollBy(0, delta);
    html.style.scrollBehavior = previous;
  }

  function applyHelpLanguage(lang) {
    var isEn = lang === "en";
    var anchor = captureScrollAnchor();
    closeResults();

    helpNodes.forEach(function (node) {
      var key = node.getAttribute("data-i18n");
      if (!(key in zhCache)) zhCache[key] = node.innerHTML;
      var html = isEn && HELP_EN[key] ? HELP_EN[key] : zhCache[key];
      if (html != null) node.innerHTML = html;
    });

    helpAttrNodes.forEach(function (node) {
      node.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var sep = pair.indexOf(":");
        if (sep < 1) return;
        var attr = pair.slice(0, sep).trim();
        var key = pair.slice(sep + 1).trim();
        if (!attr || key.indexOf("doc.") !== 0) return;
        var cacheKey = attr + "|" + key;
        if (!(cacheKey in attrCache)) attrCache[cacheKey] = node.getAttribute(attr) || "";
        var value = isEn && HELP_EN[key] ? HELP_EN[key] : attrCache[cacheKey];
        if (value != null) node.setAttribute(attr, value.replace(/<[^>]+>/g, ""));
      });
    });

    /* 语言切换后重建搜索索引，保证搜到的都是当前语言的文本 */
    buildSearchIndex();
    onScroll();

    /* 中英文高度不同，按当前章节锚点恢复滚动位置，避免视觉跳动 */
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        restoreScrollAnchor(anchor);
        onScroll();
      });
    });
  }

  function currentLang() {
    return root.getAttribute("lang") === "en" ? "en" : "zh";
  }

  applyHelpLanguage(currentLang());
  doc.addEventListener("datanexa:langchange", function (e) {
    applyHelpLanguage((e.detail && e.detail.lang) || currentLang());
  });

  /* ---------- 回到顶部 ---------- */
  if (backTop) {
    backTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
})();
