(function () {
  "use strict";
  var BASE = window.SI_BASE || "";
  var TERMS = window.SI_TERMS || {};

  /* ---------------------------------------------------------------- terms */
  var pop = null;
  var popFor = null;

  function closePop() {
    if (pop) { pop.remove(); pop = null; popFor = null; }
  }

  function openPop(el) {
    var id = el.getAttribute("data-term");
    var t = TERMS[id];
    if (!t) return;
    closePop();
    pop = document.createElement("div");
    pop.className = "gloss";
    var html = '<div class="gl">' + esc(t.l) + "</div>";
    (t.d || []).forEach(function (line) { html += '<p class="gd">' + esc(line) + "</p>"; });
    var href = el.getAttribute("data-href");
    if (href) html += '<a class="gmore" href="' + href + '">Full entry</a>';
    pop.innerHTML = html;
    document.body.appendChild(pop);
    var r = el.getBoundingClientRect();
    var top = r.bottom + window.scrollY + 7;
    var left = r.left + window.scrollX;
    var w = pop.offsetWidth;
    if (left + w > window.innerWidth - 16) left = Math.max(12, window.innerWidth - w - 16);
    if (r.bottom + pop.offsetHeight + 20 > window.innerHeight) {
      top = r.top + window.scrollY - pop.offsetHeight - 7;
    }
    pop.style.top = top + "px";
    pop.style.left = left + "px";
    popFor = el;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  document.addEventListener("mouseover", function (e) {
    var el = e.target.closest ? e.target.closest(".term") : null;
    if (el && el !== popFor) openPop(el);
  });
  document.addEventListener("mouseout", function (e) {
    var to = e.relatedTarget;
    if (!pop) return;
    if (to && (to.closest && (to.closest(".gloss") || to.closest(".term") === popFor))) return;
    setTimeout(function () {
      if (pop && !pop.matches(":hover") && popFor && !popFor.matches(":hover")) closePop();
    }, 120);
  });
  document.addEventListener("focusin", function (e) {
    if (e.target.classList && e.target.classList.contains("term")) openPop(e.target);
  });
  document.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest(".term") : null;
    if (el) { if (popFor === el) closePop(); else openPop(el); return; }
    if (!e.target.closest || !e.target.closest(".gloss")) closePop();
  });
  window.addEventListener("scroll", closePop, { passive: true });

  /* --------------------------------------------------------------- search */
  var input = document.getElementById("q");
  var panel = document.getElementById("results");
  var docs = null;
  var loading = false;
  var sel = -1;

  function load(cb) {
    if (docs) { cb(); return; }
    if (loading) return;
    loading = true;
    var xhr = new XMLHttpRequest();
    xhr.open("GET", window.SI_INDEX || BASE + "search-index.json", true);
    xhr.onload = function () {
      try { docs = JSON.parse(xhr.responseText); } catch (err) { docs = []; }
      loading = false;
      cb();
    };
    xhr.onerror = function () { docs = []; loading = false; cb(); };
    xhr.send();
  }

  function score(doc, terms, phrase) {
    var t = doc.t.toLowerCase(), s = (doc.s || "").toLowerCase(),
        x = (doc.x || "").toLowerCase(), b = doc.b || "";
    var total = 0, hit = 0;
    for (var i = 0; i < terms.length; i++) {
      var w = terms[i], n = 0;
      if (t === w) n += 220;
      if (t.indexOf(w) === 0) n += 90;
      if (t.indexOf(w) > -1) n += 55;
      if (s.indexOf(w) > -1) n += 8;
      if (x.indexOf(w) > -1) n += 14;
      var c = countOf(b, w);
      if (c) n += Math.min(26, 4 + c * 2);
      if (n) hit++;
      total += n;
    }
    if (hit < terms.length) total = total * 0.25;
    if (phrase.length > 3) {
      if (t.indexOf(phrase) > -1) total += 180;
      if (b.indexOf(phrase) > -1) total += 45;
    }
    return total;
  }

  function countOf(hay, needle) {
    var n = 0, i = hay.indexOf(needle);
    while (i > -1 && n < 40) { n++; i = hay.indexOf(needle, i + needle.length); }
    return n;
  }

  function snippet(doc, phrase, terms) {
    var b = doc.b || "";
    var key = b.indexOf(phrase) > -1 ? phrase : terms[0];
    var i = b.indexOf(key);
    if (i < 0) return doc.x || "";
    var start = Math.max(0, i - 60);
    if (start > 0) {
      var space = b.indexOf(" ", start);
      start = space > -1 && space < i ? space + 1 : start;
    }
    var cut = b.slice(start, start + 170);
    var last = cut.lastIndexOf(" ");
    if (last > 120) cut = cut.slice(0, last);
    return (start ? "…" : "") + cut.trim() + "…";
  }

  function render(list, phrase, terms) {
    if (!list.length) {
      panel.innerHTML = '<div class="none">Nothing found.</div>';
      panel.hidden = false;
      return;
    }
    panel.innerHTML = list.map(function (d) {
      return '<a href="' + BASE + d.u + '"><span class="rs">' + esc(d.s) + "</span>" +
        '<div class="rt">' + esc(d.t) + "</div>" +
        '<div class="rx">' + esc(snippet(d, phrase, terms)) + "</div></a>";
    }).join("");
    panel.hidden = false;
    sel = -1;
  }

  function run() {
    var raw = input.value.trim().toLowerCase();
    if (raw.length < 2) { panel.hidden = true; return; }
    load(function () {
      var terms = raw.split(/\s+/).filter(function (w) { return w.length > 1; });
      if (!terms.length) { panel.hidden = true; return; }
      var out = [];
      for (var i = 0; i < docs.length; i++) {
        var s = score(docs[i], terms, raw);
        if (s > 0) out.push([s, docs[i]]);
      }
      out.sort(function (a, b) { return b[0] - a[0]; });
      render(out.slice(0, 12).map(function (p) { return p[1]; }), raw, terms);
    });
  }

  if (input) {
    var timer = null;
    input.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(run, 70);
    });
    input.addEventListener("focus", function () { load(function () {}); });
    input.addEventListener("keydown", function (e) {
      var items = panel.hidden ? [] : panel.querySelectorAll("a");
      if (e.key === "Escape") { panel.hidden = true; input.blur(); return; }
      if (!items.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        sel = e.key === "ArrowDown" ? Math.min(items.length - 1, sel + 1) : Math.max(0, sel - 1);
        items.forEach(function (a) { a.classList.remove("sel"); });
        items[sel].classList.add("sel");
        items[sel].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && sel > -1) {
        e.preventDefault();
        window.location.href = items[sel].getAttribute("href");
      }
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest || !e.target.closest(".find")) panel.hidden = true;
    });
    document.addEventListener("keydown", function (e) {
      var isK = (e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey);
      var isSlash = e.key === "/" && document.activeElement !== input &&
          !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
      if (isK || isSlash) {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });
  }

  /* ----------------------------------------------------------- view switcher */
  var viewBtns = Array.prototype.slice.call(document.querySelectorAll(".view-btn"));
  if (viewBtns.length) {
    var cockpit = document.getElementById("cockpit");
    var deepRef = document.getElementById("deep-reference");
    viewBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var mode = btn.getAttribute("data-view");
        viewBtns.forEach(function (b) {
          b.classList.remove("active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        if (mode === "reference") {
          if (cockpit) cockpit.style.display = "none";
          if (deepRef) deepRef.style.display = "block";
        } else {
          if (cockpit) cockpit.style.display = "block";
          if (deepRef) deepRef.style.display = "none";
        }
      });
    });
  }

  /* ----------------------------------------------------------- filter chips */
  var filterChips = Array.prototype.slice.call(document.querySelectorAll(".filter-chip"));
  if (filterChips.length) {
    filterChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var group = chip.getAttribute("data-group");
        var container = chip.closest(".filter-bar");
        if (container) {
          container.querySelectorAll(".filter-chip").forEach(function (c) {
            c.classList.remove("active");
          });
        }
        chip.classList.add("active");
        var sections = Array.prototype.slice.call(document.querySelectorAll("section[id]"));
        sections.forEach(function (sec) {
          var isGroup = sec.classList.contains("group") ||
                        sec.classList.contains("solution-group-section") ||
                        sec.classList.contains("system-group-section") ||
                        sec.classList.contains("company-group-section") ||
                        sec.classList.contains("insight-group-section");
          if (!isGroup) return;
          if (group === "all" || sec.id === group) {
            sec.style.display = "";
          } else {
            sec.style.display = "none";
          }
        });
      });
    });
  }

  /* ----------------------------------------------------------- rail state */
  var railLinks = Array.prototype.slice.call(document.querySelectorAll(".rail a"));
  if (railLinks.length) {
    var targets = railLinks.map(function (a) {
      return document.getElementById(a.getAttribute("href").slice(1));
    });
    var mark = function () {
      var y = window.scrollY + 120, current = 0;
      for (var i = 0; i < targets.length; i++) {
        if (targets[i] && targets[i].offsetTop <= y) current = i;
      }
      railLinks.forEach(function (a, i) { a.classList.toggle("on", i === current); });
    };
    window.addEventListener("scroll", mark, { passive: true });
    mark();
  }
})();
