/* DataNexa Official Site — theme / i18n / motion */

(function () {
  "use strict";

  var root = document.documentElement;

  /* Keep the reading order aligned with the product story. The sections are
     moved after parsing so anchors, reveal observers and keyboard navigation
     all see the same order. */
  var main = document.querySelector("main");
  var defenseSection = document.getElementById("defense");
  var previewSection = document.getElementById("preview");
  if (main && defenseSection && previewSection) {
    main.insertBefore(defenseSection, previewSection);
  }

  /* ---------- Theme ---------- */
  var mediaDark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  var themeSeg = document.getElementById("themeSeg");

  function resolveTheme(pref) {
    if (pref === "system") return mediaDark && mediaDark.matches ? "dark" : "light";
    return pref;
  }

  function applyTheme(pref) {
    if (resolveTheme(pref) === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try { localStorage.setItem("datanexa-theme", pref); } catch (e) { /* ignore */ }
    if (themeSeg) {
      var segBtns = themeSeg.querySelectorAll("[data-theme-opt]");
      segBtns.forEach(function (btn) {
        btn.classList.toggle("active", btn.getAttribute("data-theme-opt") === pref);
      });
    }
  }

  var savedTheme = null;
  try { savedTheme = localStorage.getItem("datanexa-theme"); } catch (e) { /* ignore */ }
  var themePref = savedTheme || "system";
  applyTheme(themePref);

  if (mediaDark && mediaDark.addEventListener) {
    mediaDark.addEventListener("change", function () {
      if (themePref === "system") applyTheme("system");
    });
  }

  document.getElementById("themeToggle").addEventListener("click", function () {
    themePref = root.classList.contains("dark") ? "light" : "dark";
    applyTheme(themePref);
  });

  if (themeSeg) {
    themeSeg.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-theme-opt]");
      if (!btn) return;
      themePref = btn.getAttribute("data-theme-opt");
      applyTheme(themePref);
    });
  }

  /* ---------- Mini status card demo ---------- */
  var miniCommandBtn = document.getElementById("miniCommandBtn");
  if (miniCommandBtn) {
    miniCommandBtn.addEventListener("click", function () {
      miniCommandBtn.closest(".mini-command").classList.toggle("running");
    });
  }

  /* ---------- i18n ---------- */
  var i18n = {
    en: {
      "nav.features": "Features",
      "nav.databases": "DB Support",
      "nav.jdbc": "JDBC Support",
      "nav.tools": "MCP Tools",
      "nav.defense": "Defense",
      "nav.preview": "Preview",
      "nav.quickstart": "Quick Start",
      "nav.security": "Security",
      "nav.home": "Home",
      "hero.badge": "Local read-only MCP gateway",
      "hero.title1": "Connect AI Agents to",
      "hero.title2": "your databases, safely",
      "hero.sub": "DataNexa is a database MCP service running on your machine. It gives AI Agents a unified, controlled and auditable data access entry — enforcing read-only policies before queries, with limits on returned rows, execution time and connections.",
      "hero.download": "Download",
      "hero.source": "View Source",
      "hero.support": "Supported Databases",
      "hero.jdbc": "JDBC Support",
      "flow.agent": "AI Agent",
      "flow.db": "Your Database",
      "flow.caption": "Every query is validated against the SQL syntax tree — only read-only statements pass, so Agents can never write to your data",
      "features.tag": "Features",
      "features.title": "Every detail designed for controlled access",
      "features.sub": "From connection management to audit trails, DataNexa moves the database security boundary between the Agent and your data.",
      "f1.title": "Unified Connections",
      "f1.desc": "Manage read-only connections for SQLite, MySQL and PostgreSQL in one place, reach more databases via JDBC support, with diagnostics and import/export.",
      "f2.title": "AST-Level Read-Only Validation",
      "f2.desc": "Queries are validated against the SQL syntax tree, structurally rejecting any writes or DDL operations.",
      "f3.title": "Secure Credential Storage",
      "f3.desc": "Database passwords live in the OS credential store, never in plain config files. Tokens support manual rotation.",
      "f4.title": "Resource Guardrails",
      "f4.desc": "Triple limits on max returned rows, query timeout and connection pool size keep runaway queries in check.",
      "f5.title": "Local Audit Logs",
      "f5.desc": "Complete local audit records with automatic SQL literal masking — every access is traceable.",
      "f6.title": "Fine-Grained Controls",
      "f6.desc": "Per-tool toggles and an emergency kill switch expose only the MCP tools your task requires.",
      "tools.tag": "MCP Tools",
      "tools.title": "Seven handy read-only tools",
      "tools.sub": "Built on Streamable HTTP and JSON-RPC 2.0, grouped into Discovery / Access / Analysis, each independently toggleable.",
      "tools.g1.title": "Discovery",
      "tools.g1.count": "3 tools",
      "tools.g2.title": "Access",
      "tools.g2.count": "2 tools",
      "tools.g3.title": "Analysis",
      "tools.g3.count": "2 tools",
      "t1.desc": "List enabled local read-only database connections.",
      "t2.desc": "List all tables and views under a connection.",
      "t3.desc": "Describe the columns of a given table.",
      "t4.desc": "Read a small bounded sample from a table.",
      "t5.desc": "Execute one read-only query; returns a truncated flag when results exceed the limit.",
      "t6.desc": "Run EXPLAIN for a read-only SQL statement.",
      "t7.desc": "Validate SQL against the read-only policy without executing it.",
      "preview.tag": "Interface",
      "preview.title": "Crafted for beauty and ease",
      "preview.sub": "Clear status feedback, flexible light and dark appearances, and window materials that feel at home on each platform.<br>From information hierarchy to interaction feedback, every detail is designed to feel natural and easy to use.",
      "ui.a.status": "Server",
      "ui.a.running": "Running",
      "ui.a.stopped": "Stopped",
      "ui.a.start": "Start",
      "ui.a.stop": "Stop",
      "ui.a.m1": "Connections",
      "ui.a.m2": "Tools",
      "ui.a.m3": "24h Calls",
      "ui.a.title": "A status card that breathes",
      "ui.a.desc": "Whenever an Agent finishes a call, ripples and a light sweep wash over the status card — green on success, red on failure, state at a glance.",
      "ui.b.system": "System",
      "ui.b.light": "Light",
      "ui.b.dark": "Dark",
      "ui.b.title": "Light or dark, your choice",
      "ui.b.desc": "Choose a light or dark appearance, or let it follow your system automatically. The interface stays clear and comfortable, with smooth transitions between themes.",
      "ui.c.p1": "Succeeded",
      "ui.c.p2": "Denied",
      "ui.c.p3": "Paused",
      "ui.c.title": "A consistent component language",
      "ui.c.desc": "From switches and status labels to subtle edge fades in scrollable areas, every interface element follows one visual language for a cohesive, considered experience.",
      "ui.d.pane": "System window materials",
      "ui.d.title": "Window materials that fit your system",
      "ui.d.desc": "DataNexa uses Vibrancy on macOS and Mica on Windows 11, following each platform's visual language so the app feels at home on your desktop.",
      "native.tag": "Database Support",
      "native.title": "SQLite · MySQL · PostgreSQL<br><span class=\"grad-text\">Natively supported, out of the box</span>",
      "native.sub": "Built on SQLx from the Rust ecosystem. Support for all three databases ships inside DataNexa — just fill in the connection details. No JVM, no drivers to install.",
      "native.badge.embedded": "Embedded",
      "native.badge.protocol": "Native protocol",
      "native.sqlite.desc": "A single-file embedded database, the go-to for local development and small projects. DataNexa opens the file read-only — no server process required.",
      "native.mysql.desc": "DataNexa connects over SQLx's native protocol, switching the session to a read-only transaction before execution. No drivers to install.",
      "native.pg.desc": "Also connected via the SQLx native protocol, with <code>default_transaction_read_only</code> enabled on the session — plus AST validation as a second line of defense.",
      "native.m.zerodeploy": "Zero setup",
      "native.m.roopen": "Read-only open",
      "native.m.singlefile": "Single file",
      "native.m.tcp": "Direct TCP",
      "native.m.tls": "TLS",
      "native.m.pool": "Connection pool",
      "jdbc.tag": "JDBC Support",
      "jdbc.title": "Databases without native support?<br><span class=\"grad-text\">DataNexa can still reach them</span>",
      "jdbc.sub": "Enterprise databases, domestic databases, legacy systems — if the vendor ships a JDBC driver, add it to DataNexa, paste a connection URL, and you are in. The same read-only checks and audit trail still apply.",
      "jdbc.panel.title": "DataNexa now supports JDBC connections",
      "jdbc.ver": "Tech Preview",
      "jdbc.panel.desc": "Just like creating a native connection: pick an installed driver, paste the JDBC URL, test and save — then hand it to your AI Agent to query.",
      "jdbc.drivers": "Get a driver by",
      "jdbc.driver.maven": "Maven coordinates",
      "jdbc.driver.jar": "Local JARs",
      "jdbc.driver.bundle": "Offline bundle",
      "jdbc.gate.name": "Every query passes the same checks",
      "jdbc.gate.desc": "Token permissions · Read-only checks · Row & timeout limits · Audit",
      "jdbc.lane.native": "Native · SQLx",
      "jdbc.lane.jdbc": "JDBC · Java Runtime",
      "jdbc.lane.jdbc.db": "Your driver + JDBC URL",
      "jdbc.c1.title": "No vendor whitelist",
      "jdbc.c1.desc": "Install from Maven coordinates, local JARs or offline bundles. If a driver won't work, the connection test tells you why.",
      "jdbc.c2.title": "Isolated by design",
      "jdbc.c2.desc": "Drivers and queries run in a separate Java process with a DataNexa-managed JRE. A crash there stays there — your other connections and the MCP service are unaffected.",
      "jdbc.c3.title": "Same guardrails",
      "jdbc.c3.desc": "Read-only checks, token permissions, audit, timeout and row limits all apply to JDBC connections. Dialects the parser can't read fall back to lexical analysis.",
      "qs.tag": "Quick Start",
      "qs.title": "Connect your Agent in four steps",
      "s1.title": "Add a connection",
      "s1.desc": "Create a database connection, preferably with a read-only account.",
      "s2.title": "Test the connection",
      "s2.desc": "Verify network, credentials and permissions are all correct.",
      "s3.title": "Start the service",
      "s3.desc": "Launch the local service from the MCP Service page.",
      "s4.title": "Connect your Agent",
      "s4.desc": "Copy the connection config into any MCP-capable client.",
      "def.tag": "Defense in Depth",
      "def.title": "Multiple constraints, reducing risk layer by layer",
      "def.sub": "From network to audit, guarded across the full chain.",
      "def.legend.block": "Blocked",
      "def.legend.pass": "Read-only pass",
      "def.caption": "Writes and dangerous statements are stopped long before they reach your database — only read-only queries get through.",
      "def.l1.name": "Network",
      "def.l1.body": "Listens only on <code>127.0.0.1</code> / <code>localhost</code>, with a strict CSP and Host / Origin header checks, keeping traffic on the local machine.",
      "def.l2.name": "Authentication",
      "def.l2.body": "Bearer token (UUIDv4) on by default, with manual rotation that needs no server restart.",
      "def.l3.name": "Syntax",
      "def.l3.body": "Validated via the <code>sqlparser</code> AST — rejects DDL / DML / SELECT INTO / row locks / EXPLAIN ANALYZE, and blocks side-effect functions like pg_sleep, dblink and lo_*. Unknown JDBC dialects go through a generic AST baseline plus lexical fallback, so even the highest-risk dialects are covered.",
      "def.l4.name": "Database",
      "def.l4.body": "SQLite opened read-only; MySQL runs <code>SET SESSION TRANSACTION READ ONLY</code>; PostgreSQL sets <code>default_transaction_read_only=on</code>.",
      "def.l5.name": "Resource",
      "def.l5.body": "Rows 1–5000, timeout 500–60000ms, pool 1–3, result 64KB–8MB, global concurrency 8, rate limit 2/s — constraining the blast radius of runaway queries.",
      "def.l6.name": "Audit",
      "def.l6.body": "Local SQLite (WAL) records 5 statuses, SQL literals can be redacted, auto-trimmed to a 5000-event cap, and error messages are redacted too.",
      "sec.tag": "Security",
      "sec.title": "Read-only is a guardrail, not everything",
      "sec.desc": "Read-only policies reduce risk but are not absolute safety. Before connecting real data, consider these measures:",
      "sec.i1": "Create a dedicated least-privilege database account for DataNexa",
      "sec.i2": "Add extra access controls for sensitive tables, fields and production networks",
      "sec.i3": "Keep Bearer Token authentication on and never leak the token",
      "sec.i4": "Review audit logs regularly and enable only the tools you need",
      "sec.i5": "Back up your databases — do not rely on DataNexa as the only boundary",
      "cta.title": "Start a simpler, more secure way<br>to connect AI to your databases",
      "cta.sub": "Download DataNexa — making AI database connections simpler",
      "cta.download": "Download Now",
      "cta.issue": "Report an Issue",
      "credits.tag": "Links & Credits",
      "credits.title": "To open source, to friends",
      "credits.sub": "DataNexa grows with the support of the open-source community and friends — this page is our thank-you note.",
      "credits.nav.ack": "Acknowledgements",
      "credits.nav.links": "Friendly Links",
      "credits.ack.tag": "Acknowledgements",
      "credits.ack.title": "To inspire and be inspired —<br><span class=\"grad-text\">the best cycle of open source</span>",
      "credits.ack.desc": "Special thanks to the DBX project. While implementing JDBC support, DataNexa drew on DBX's architecture design and implementation ideas. Our sincere gratitude goes to the DBX project and its contributors.",
      "credits.links.tag": "Friendly Links",
      "credits.links.title": "Sites worth a visit",
      "credits.friend.xd.name": "XD Lab",
      "credits.friend.xd.desc": "A software engineer's personal site — engineering write-ups, cloud-native and AI explorations, and open-source projects.",
      "credits.back": "Back to Home",
      "footer.tag": "MCP Database Gateway",
      "footer.friends": "Links & Credits",
      "footer.copy1": "Copyright © 2026 Zachary Wu All Rights Reserved.",
      "footer.copy2": "MySQL, PostgreSQL, SQLite and other names and trademarks belong to their respective owners"
    }
  };

  var zhCache = {};
  var langBtn = document.getElementById("langToggle");

  /* The document title is per-page: body[data-title-zh / data-title-en] overrides
     the site default, so subpages keep their own title after a language switch. */
  function applyLang(lang) {
    var nodes = document.querySelectorAll("[data-i18n]");
    if (lang === "en") {
      nodes.forEach(function (node) {
        var key = node.getAttribute("data-i18n");
        if (!(key in zhCache)) zhCache[key] = node.innerHTML;
        if (i18n.en[key]) node.innerHTML = i18n.en[key];
      });
      root.setAttribute("lang", "en");
      langBtn.textContent = "EN";
      document.title = document.body.getAttribute("data-title-en") || "DataNexa — Local Read-Only Database MCP Gateway for AI Agents";
    } else {
      nodes.forEach(function (node) {
        var key = node.getAttribute("data-i18n");
        if (key in zhCache) node.innerHTML = zhCache[key];
      });
      root.setAttribute("lang", "zh-CN");
      langBtn.textContent = "中";
      document.title = document.body.getAttribute("data-title-zh") || "DataNexa — 面向 AI Agent 的本地只读数据库 MCP 网关";
    }
    try { localStorage.setItem("datanexa-lang", lang); } catch (e) { /* ignore */ }
  }

  function applyLangPreservingScroll(lang) {
    var currentY = window.scrollY;
    var anchor = null;
    var anchorTop = -Infinity;
    var sections = document.querySelectorAll("main section[id]");
    sections.forEach(function (section) {
      var top = section.getBoundingClientRect().top;
      if (top <= 96 && (!anchor || top > anchorTop)) {
        anchor = section;
        anchorTop = top;
      }
    });
    applyLang(lang);
    requestAnimationFrame(function () {
      var delta = anchor ? anchor.getBoundingClientRect().top - anchorTop : 0;
      window.scrollTo(0, Math.max(0, currentY + delta));
    });
  }

  var savedLang = null;
  try { savedLang = localStorage.getItem("datanexa-lang"); } catch (e) { /* ignore */ }
  if (savedLang === "en") applyLang("en");
  else langBtn.textContent = "中";

  langBtn.addEventListener("click", function () {
    applyLangPreservingScroll(root.getAttribute("lang") === "en" ? "zh" : "en");
    updateNavLayout();
  });

  /* ---------- Nav scroll state ---------- */
  var nav = document.getElementById("nav");
  function onScroll() {
    if (window.scrollY > 12) nav.classList.add("scrolled");
    else nav.classList.remove("scrolled");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Responsive nav: compact mode + drawer ---------- */
  var navToggle = document.getElementById("navToggle");
  var navDrawer = document.getElementById("navDrawer");
  var navInner = document.querySelector(".nav-inner");
  nav.classList.add("nav-js");

  function closeNavDrawer() {
    nav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  }

  /* Keep the full navigation on desktop. The drawer is a deliberate tablet/mobile
     layout, rather than a content-width toggle that can hide links on wide screens. */
  function updateNavLayout() {
    if (!navInner) return;
    var compact = window.innerWidth <= 1080;
    nav.classList.toggle("nav-compact", compact);
    if (!compact) closeNavDrawer();
  }

  window.addEventListener("resize", updateNavLayout, { passive: true });
  window.addEventListener("load", updateNavLayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateNavLayout);
  if (window.ResizeObserver && navInner) {
    new ResizeObserver(updateNavLayout).observe(navInner);
  }

  navToggle.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  navDrawer.addEventListener("click", function (e) {
    if (e.target.closest("a")) closeNavDrawer();
  });
  document.addEventListener("click", function (e) {
    if (nav.classList.contains("open") && !nav.contains(e.target)) closeNavDrawer();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeNavDrawer();
  });

  updateNavLayout();

  /* ---------- Scroll reveal ---------- */
  var revealNodes = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealNodes.forEach(function (node) { observer.observe(node); });
  } else {
    revealNodes.forEach(function (node) { node.classList.add("visible"); });
  }
})();
