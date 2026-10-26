/* Progress tiles consume build-time data and events only. AGPL-3.0-or-later. */
(function () {
  "use strict";
  const pending = [];
  let dispatch = e => pending.push(e);
  for (const name of ["ctm:result", "ctm:store-restore", "ctm:store-clear", "ctm:answer-change"]) {
    document.addEventListener(name, event => dispatch({type: name, detail: event.detail}));
  }
  function init() {
    const node = document.getElementById("ctm-store-manifest");
    if (!node) return;
    let manifest;
    try { manifest = JSON.parse(node.textContent); } catch (_) { return; }
    const messages = manifest.messages || {};
    const text = (key, fallback) => typeof messages[key] === "string" ? messages[key] : fallback;
    const states = new Map(), tiles = new Map(), panels = [];
    const identity = e => typeof e.runtimeId === "string" && e.runtimeId ? e.runtimeId : e.id;
    const key = e => JSON.stringify([e.component, identity(e)]);
    const exercises = (manifest.exercises || []).filter(e =>
      (e.component === "math-exercise" || e.component === "py-exercise") && typeof identity(e) === "string" && identity(e));
    const duplicates = new Set(), seen = new Set();
    // Labels are page-wide DOM identities, including across components.
    for (const e of manifest.exercises || []) {
      if (e.runtimeId || typeof e.id !== "string" || !e.id) continue;
      if (seen.has(e.id)) duplicates.add(e.id);
      seen.add(e.id);
    }
    const findTarget = e => {
      if (e.runtimeId) return [...document.querySelectorAll("[data-ctm-runtime-id]")].find(element =>
        element.getAttribute("data-ctm-runtime-id") === e.runtimeId &&
        element.getAttribute("data-ctm-component") === e.component);
      return [...document.querySelectorAll("[data-ctm-id]")].find(element =>
      element.getAttribute("data-ctm-id") === e.id &&
      element.getAttribute("data-ctm-component") === e.component) || document.getElementById(e.id);
    };
    // Component filters register in batches. Prefer build-time source order;
    // older manifests use rendered roots. Neither path starts Python.
    const rootOrder = new Map([...document.querySelectorAll("[data-ctm-runtime-id], [data-ctm-id], [id]")].map((node, i) => [node, i]));
    const hasSourceOrder = exercises.every(e => Number.isSafeInteger(e.order) && e.order > 0);
    const entries = exercises.filter(e => e.runtimeId || !duplicates.has(e.id)).map((entry, i) => ({
      entry, order: hasSourceOrder ? entry.order : (rootOrder.get(findTarget(entry)) ?? rootOrder.size + i)
    })).sort((a, b) => a.order - b.order).map(row => row.entry);
    const number = n => {
      try { return new Intl.NumberFormat(text("locale", document.documentElement.lang || "en"), {maximumFractionDigits: 3}).format(n); }
      catch (_) { return String(n); }
    };
    const statusText = (key, fallback) => text(key, fallback).replace(/^\s*[✓½✗–]\s*/, "");
    const words = {
      answered: ["●", text("answered", "Answered, not graded")],
      correct: ["✓", statusText("correct", "correct")],
      partial: ["½", statusText("partial", "partly correct")],
      wrong: ["✗", statusText("wrong", "wrong")],
      unattempted: ["–", statusText("unattempted", "not attempted")]
    };
    let currentKey;
    function update() {
      for (const panel of panels) {
        let score = 0;
        panel.entries.forEach((e, i) => {
          const result = states.get(key(e)), status = result ? result.status : "unattempted";
          const label = words[status], button = tiles.get(key(e));
          const outdated = result && result.outdated ? " (" + text("outdated", "outdated") + ")" : "";
          button.textContent = number(i + 1);
          const credit = result && typeof result.score === "number" ? ", " + text("total", "{score} of {count}")
            .replace("{score}", number(result.score)).replace("{count}", number(1)) : "";
          button.setAttribute("aria-label", text("exercise", "Exercise") + " " + number(i + 1) + ": " + label[1] + credit + outdated);
          button.title = button.getAttribute("aria-label");
          button.style.setProperty("--ctm-credit", ((result && !result.outdated ? result.score || 0 : 0) * 100) + "%");
          if (key(e) === currentKey) button.setAttribute("aria-current", "step"); else button.removeAttribute("aria-current");
          button.dataset.status = status;
          button.classList.toggle("ctm-progress-outdated", Boolean(result && result.outdated));
          if (result && !result.outdated) score += result.score || 0;
        });
        panel.total.textContent = text("total", "{score} of {count}")
          .replace("{score}", number(score)).replace("{count}", number(panel.entries.length));
      }
    }
    function panel(items, title, slot) {
      if (!items.length || !slot) return;
      const region = document.createElement("section");
      region.className = "ctm-progress";
      if (slot.dataset.ctmQuiz) region.dataset.ctmQuiz = slot.dataset.ctmQuiz;
      if (slot.classList.contains("ctm-progress-page")) region.classList.add("ctm-progress-page");
      region.setAttribute("aria-label", title);
      const heading = document.createElement("p");
      heading.className = "ctm-progress-title ctm-sr-only";
      heading.textContent = title;
      const total = document.createElement("p");
      total.className = "ctm-progress-total ctm-sr-only";
      const list = document.createElement("ol");
      // Keep list semantics when native markers are hidden in WebKit.
      list.setAttribute("role", "list");
      items.forEach(e => {
        const li = document.createElement("li"), button = document.createElement("button");
        button.type = "button"; button.className = "ctm-question-tile";
        button.addEventListener("click", async () => {
          // Component roots may have generated DOM ids. Match the shared
          // registration attributes as data, without interpolating a selector.
          const target = findTarget(e);
          if (!target || !window.CTMNav || typeof window.CTMNav.reveal !== "function") return;
          if (questionDialog.open) questionDialog.close();
          currentKey = key(e); update();
          await window.CTMNav.reveal(target);
          // CTMNav owns scrolling and focus, including nested tabs and reveals.
        });
        tiles.set(key(e), button);
        li.append(button); list.append(li);
      });
      region.append(heading, total, list); slot.append(region);
      panels.push({entries: items, total, region});
    }
    const slots = [...document.querySelectorAll(".ctm-progress-slot[data-ctm-quiz]")];
    for (const q of manifest.quizzes || []) {
      panel(entries.filter(e => e.quiz === q.id), q.title || q.id,
        slots.find(s => s.getAttribute("data-ctm-quiz") === q.id));
    }
    if (manifest.progress) {
      const slot = document.createElement("div");
      slot.className = "ctm-progress-page";
      const bar = document.querySelector(".ctm-save-bar");
      if (bar && !bar.closest("dialog")) bar.after(slot);
      else (document.querySelector("main") || document.body).prepend(slot);
      panel(entries.filter(e => !e.quiz), text("progressTitle", "Page progress"), slot);
    }
    // Move only the generated controls; authored anchors stay in the content.
    const rail = document.createElement("nav"); rail.className = "ctm-quiz-rail";
    rail.setAttribute("aria-label", text("progressTitle", "Page progress"));
    for (const panel of panels) rail.append(panel.region);
    const questionDialog = document.createElement("dialog"); questionDialog.id = "ctm-questions";
    questionDialog.className = "ctm-questions-dialog";
    questionDialog.setAttribute("aria-label", text("progressTitle", "Page progress"));
    const close = window.CTMSettings ? window.CTMSettings.text("copyClose", "Close") : text("exportClose", "Close");
    const closeButton = document.createElement("button"); closeButton.type = "button"; closeButton.className = "ctm-icon-button";
    closeButton.textContent = "×"; closeButton.setAttribute("aria-label", close); closeButton.onclick = () => questionDialog.close();
    const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "ctm-questions-toggle ctm-icon-button";
    toggle.setAttribute("aria-label", text("progressTitle", "Page progress")); toggle.title = toggle.getAttribute("aria-label");
    toggle.setAttribute("aria-haspopup", "dialog"); toggle.setAttribute("aria-controls", questionDialog.id);
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg>';
    toggle.onclick = () => { questionDialog.showModal(); toggle.setAttribute("aria-expanded", "true"); };
    questionDialog.addEventListener("close", () => toggle.setAttribute("aria-expanded", "false"));
    questionDialog.append(closeButton, rail);
    if (panels.length) document.body.append(questionDialog, toggle);
    const position = () => {
      if (!panels.length) return;
      const main = document.querySelector("main"), margin = document.querySelector("#quarto-margin-sidebar");
      const rect = main?.getBoundingClientRect(), marginRect = margin?.getBoundingClientRect();
      const inMargin = window.innerWidth >= 1200 && marginRect?.width >= 148 && marginRect.left >= rect?.right;
      const inGutter = window.innerWidth >= 1200 && rect?.width > 0 && window.innerWidth - rect.right >= 184;
      const desktop = inMargin || inGutter;
      if (desktop && questionDialog.open) questionDialog.close();
      toggle.hidden = desktop;
      if (inMargin) {
        if (rail.parentElement !== margin) margin.prepend(rail);
        rail.classList.remove("ctm-quiz-rail-fixed"); rail.style.removeProperty("left");
      } else if (inGutter) {
        if (rail.parentElement !== document.body) document.body.append(rail);
        rail.classList.add("ctm-quiz-rail-fixed"); rail.style.left = (rect.right + 24) + "px";
      } else {
        if (rail.parentElement !== questionDialog) questionDialog.append(rail);
        rail.classList.remove("ctm-quiz-rail-fixed"); rail.style.removeProperty("left");
      }
    };
    const layout = window.CTMLayout.task(position);
    window.addEventListener("resize", () => layout.schedule());
    // Mobile browser chrome and keyboards must not leave a floating control over inputs.
    const keyboard = () => { toggle.classList.toggle("ctm-keyboard-open", Boolean(window.visualViewport && window.visualViewport.height < window.innerHeight * .75)); };
    window.visualViewport?.addEventListener("resize", keyboard);
    position(); keyboard();
    if (window.ResizeObserver && document.querySelector("main")) new ResizeObserver(() => layout.schedule()).observe(document.querySelector("main"));
    document.addEventListener("focusin", event => {
      const entry = entries.find(e => findTarget(e)?.contains(event.target));
      if (entry) { currentKey = key(entry); update(); }
    });
    const followScroll = window.CTMLayout.task(() => {
      const visible = entries.map(e => ({e, target: findTarget(e)})).filter(({target}) => target && target.getClientRects().length)
        .map(({e, target}) => ({e, rect: target.getBoundingClientRect()}));
      const active = visible.find(({rect}) => rect.bottom > 100 && rect.top < window.innerHeight / 2);
      if (active && key(active.e) !== currentKey) { currentKey = key(active.e); update(); }
    });
    window.addEventListener("scroll", () => followScroll.schedule(), {passive: true});
    function result(e, outdated) {
      const k = key(e);
      if (!tiles.has(k) || !["correct", "partial", "wrong"].includes(e.status)
        || typeof e.score !== "number" || !Number.isFinite(e.score) || e.score < 0 || e.score > 1) return;
      states.set(k, {status: e.status, score: e.score, outdated: Boolean(outdated)});
      update();
    }
    dispatch = event => {
      const e = event.detail;
      if (event.type === "ctm:answer-change") {
        if (e && tiles.has(key(e))) {
          if (e.answered) states.set(key(e), {status: "answered"}); else states.delete(key(e));
          update();
        }
        return;
      }
      if (event.type === "ctm:result") { if (e) result(e, false); return; }
      if (event.type === "ctm:store-restore") {
        if (!e) return;
        if (e.result) result({component: e.component, id: e.id, runtimeId: e.runtimeId, ...e.result},
          e.outdated || e.state === "changed" || e.state === "withdrawn");
        else { if (e.answered) states.set(key(e), {status: "answered", outdated: Boolean(e.outdated || e.state === "changed" || e.state === "withdrawn")}); else states.delete(key(e)); update(); }
        return;
      }
      const store = window.CTMStore;
      if (e && e.course && store && store.course && e.course !== store.course) return;
      const page = store && store.page;
      const current = typeof page === "function" ? page() : page;
      if (e && e.page && current && e.page !== current) return;
      if (e && e.runtimeId) {
        for (const entry of entries) {
          if (entry.runtimeId === e.runtimeId && (!e.component || entry.component === e.component)) states.delete(key(entry));
        }
      } else if (e && typeof e.id === "string") {
        for (const entry of entries) {
          if (entry.id === e.id && (!e.component || entry.component === e.component)) states.delete(key(entry));
        }
      } else states.clear();
      update();
    };
    for (const event of pending.splice(0)) dispatch(event);
    update(); // No live region on load; tiles are available before Python starts.
  }
  window.CTMLayout.ready(init);
})();
