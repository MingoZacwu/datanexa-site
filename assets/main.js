/* DataNexa Official Site — theme / i18n / motion */

(function () {
  "use strict";

  var root = document.documentElement;

  /* ---------- Theme ---------- */
  function applyTheme(theme) {
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try { localStorage.setItem("datanexa-theme", theme); } catch (e) { /* ignore */ }
  }

  var savedTheme = null;
  try { savedTheme = localStorage.getItem("datanexa-theme"); } catch (e) { /* ignore */ }
  var initialTheme = savedTheme ||
    (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(initialTheme);

  document.getElementById("themeToggle").addEventListener("click", function () {
    applyTheme(root.classList.contains("dark") ? "light" : "dark");
  });

  /* ---------- i18n ---------- */
  var i18n = {
    en: {
      "nav.features": "Features",
      "nav.preview": "Preview",
      "nav.quickstart": "Quick Start",
      "nav.security": "Security",
      "hero.badge": "Local read-only MCP gateway",
      "hero.title1": "Connect AI Agents to",
      "hero.title2": "your databases, safely",
      "hero.sub": "DataNexa is a database MCP service running on your machine. It gives AI Agents a unified, controlled and auditable data access entry — enforcing read-only policies before queries, with limits on returned rows, execution time and connections.",
      "hero.download": "Download",
      "hero.source": "View Source",
      "hero.support": "Supported Databases",
      "flow.agent": "AI Agent",
      "flow.db": "Your Database",
      "flow.caption": "Every query is validated against the SQL syntax tree — only read-only statements pass, so Agents can never write to your data",
      "features.tag": "Features",
      "features.title": "Every detail designed for controlled access",
      "features.sub": "From connection management to audit trails, DataNexa moves the database security boundary between the Agent and your data.",
      "f1.title": "Unified Connections",
      "f1.desc": "Manage read-only connections for SQLite, MySQL and PostgreSQL in one place, with diagnostics and import/export.",
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
      "preview.tag": "Preview",
      "preview.title": "Desktop app, at a glance",
      "preview.sub": "Built with Tauri, React and Rust. Supports light / dark themes and Simplified Chinese / English UI.",
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
      "qs.build": "Build from source",
      "qs.copy": "Copy",
      "sec.tag": "Security",
      "sec.title": "Read-only is a guardrail, not everything",
      "sec.desc": "Read-only policies reduce risk but are not absolute safety. Before connecting real data, consider these measures:",
      "sec.i1": "Create a dedicated least-privilege database account for DataNexa",
      "sec.i2": "Add extra access controls for sensitive tables, fields and production networks",
      "sec.i3": "Keep Bearer Token authentication on and never leak the token",
      "sec.i4": "Review audit logs regularly and enable only the tools you need",
      "sec.i5": "Back up your databases — do not rely on DataNexa as the only boundary",
      "cta.title": "Data is priceless, use with care",
      "cta.sub": "DataNexa is open source under the MIT License, independently developed and maintained. Issues and Pull Requests are welcome.",
      "cta.download": "Download Now",
      "cta.issue": "Report an Issue",
      "footer.tag": "MCP Database Gateway",
      "footer.copy1": "Copyright © 2026 Zachary Wu All Rights Reserved.",
      "footer.copy2": "MySQL, PostgreSQL, SQLite and other names and trademarks belong to their respective owners"
    }
  };

  var zhCache = {};
  var langBtn = document.getElementById("langToggle");

  function applyLang(lang) {
    var nodes = document.querySelectorAll("[data-i18n]");
    if (lang === "en") {
      nodes.forEach(function (node) {
        var key = node.getAttribute("data-i18n");
        if (!(key in zhCache)) zhCache[key] = node.textContent;
        if (i18n.en[key]) node.textContent = i18n.en[key];
      });
      root.setAttribute("lang", "en");
      langBtn.textContent = "EN";
      document.title = "DataNexa — Local Read-Only Database MCP Gateway for AI Agents";
    } else {
      nodes.forEach(function (node) {
        var key = node.getAttribute("data-i18n");
        if (key in zhCache) node.textContent = zhCache[key];
      });
      root.setAttribute("lang", "zh-CN");
      langBtn.textContent = "中";
      document.title = "DataNexa — 面向 AI Agent 的本地只读数据库 MCP 网关";
    }
    try { localStorage.setItem("datanexa-lang", lang); } catch (e) { /* ignore */ }
  }

  var savedLang = null;
  try { savedLang = localStorage.getItem("datanexa-lang"); } catch (e) { /* ignore */ }
  if (savedLang === "en") applyLang("en");
  else langBtn.textContent = "中";

  langBtn.addEventListener("click", function () {
    applyLang(root.getAttribute("lang") === "en" ? "zh" : "en");
  });

  /* ---------- Nav scroll state ---------- */
  var nav = document.getElementById("nav");
  function onScroll() {
    if (window.scrollY > 12) nav.classList.add("scrolled");
    else nav.classList.remove("scrolled");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

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

  /* ---------- Copy button ---------- */
  document.querySelectorAll(".copy-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = document.getElementById(btn.getAttribute("data-copy-target"));
      if (!target) return;
      var text = target.textContent;
      function done() {
        var original = btn.textContent;
        btn.textContent = root.getAttribute("lang") === "en" ? "Copied" : "已复制";
        setTimeout(function () { btn.textContent = original; }, 1600);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
      } else {
        fallbackCopy(text, done);
      }
    });
  });

  function fallbackCopy(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }
})();
