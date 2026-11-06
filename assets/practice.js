// Practice mode: flashcards for one level of one stage.
//
// Spaced repetition (FSRS, from assets/srs.js) shows each case when it's due, Anki style:
// look at the case, recall the algorithm (ideally do it on a cube), reveal, then rate it.
// Drill goes through every case once in random order, like a recap, without touching the schedule.
// Progress is saved in this browser only.
(function () {
  const STORE = "cfop-practice";
  const ROLLOVER = 4 * 3600e3; // a practice day starts at 4am, as in Anki
  const LEARN_AHEAD = 20 * SRS.MINUTE; // when nothing else is left, show learning cards due this soon
  const NEW_PER_DAY = [3, 5, 10, 20];
  const PRE_AUF = ["", "U'", "U2", "U"]; // undoes a view turned by k quarter turns
  const VIEW_TURN = ["", "U", "U2", "U'"];
  const RATINGS = [
    [1, "Again", "Couldn't remember it"],
    [2, "Hard", "Got there, but slowly"],
    [3, "Good", "Remembered it"],
    [4, "Easy", "Instant"],
  ];

  // ---------------------------------------------------------------- storage
  function load() {
    let data = {};
    try { data = JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch (e) {}
    data.cards = data.cards || {};
    data.settings = { newPerDay: 5, randomAngle: true, ...(data.settings || {}) };
    if (!data.today || data.today.day !== dayKey(Date.now())) data.today = { day: dayKey(Date.now()), started: {}, extra: {} };
    return data;
  }
  function save(data) { try { localStorage.setItem(STORE, JSON.stringify(data)); } catch (e) {} }

  function dayKey(t) {
    const d = new Date(t - ROLLOVER);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }
  // Review cards count as due all day, so this is when today's practice day ends.
  function dayEnd(t) {
    const d = new Date(t - ROLLOVER);
    d.setHours(24, 0, 0, 0);
    return d.getTime() + ROLLOVER;
  }

  // ---------------------------------------------------------------- queue
  function deckState(data, deckId, cases, now) {
    const st = c => data.cards[c.id];
    const learning = cases.filter(c => st(c) && st(c).state !== "review").sort((a, b) => st(a).due - st(b).due);
    const review = cases.filter(c => st(c) && st(c).state === "review" && st(c).due < dayEnd(now)).sort((a, b) => st(a).due - st(b).due);
    const fresh = cases.filter(c => !st(c));
    const limit = data.settings.newPerDay + (data.today.extra[deckId] || 0);
    const newLeft = Math.max(0, Math.min(fresh.length, limit - (data.today.started[deckId] || 0)));
    const upcoming = cases.filter(st).map(c => st(c).due).filter(t => t > now).sort((a, b) => a - b);
    return { learning, review, fresh, newLeft, next: upcoming[0] };
  }

  function pickNext(data, deckId, cases, now, lastId) {
    const s = deckState(data, deckId, cases, now);
    const st = c => data.cards[c.id];
    const order = [
      ...s.learning.filter(c => st(c).due <= now),
      ...s.review,
      ...s.fresh.slice(0, s.newLeft),
      ...s.learning.filter(c => st(c).due > now && st(c).due <= now + LEARN_AHEAD),
    ];
    return order.find(c => c.id !== lastId) || order[0] || null;
  }

  // ---------------------------------------------------------------- helpers
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function duration(ms) {
    const m = ms / SRS.MINUTE, h = m / 60, d = h / 24;
    if (m < 60) return `${Math.max(1, Math.round(m))}m`;
    if (h < 24) return `${Math.round(h)}h`;
    if (d < 30) return `${Math.round(d)}d`;
    if (d < 365) return `${+(d / 30).toFixed(1)}mo`;
    return `${+(d / 365).toFixed(1)}y`;
  }
  function inWords(ms) {
    const m = Math.round(ms / SRS.MINUTE);
    if (m < 1) return "in under a minute";
    if (m < 60) return `in ${m} minute${m === 1 ? "" : "s"}`;
    const h = Math.round(m / 60);
    if (h < 24) return `in ${h} hour${h === 1 ? "" : "s"}`;
    const d = Math.round(h / 24);
    return d === 1 ? "tomorrow" : `in ${d} days`;
  }
  const seconds = ms => (ms / 1000).toFixed(1) + "s";

  function fullMoves(c) {
    return [...Array(c.repeat || 1).fill(c.alg), c.then || "", c.auf || ""].join(" ").trim();
  }
  // Moves that take a solved cube to this case, as seen with the view turned k times.
  function setupMoves(c, k) {
    const tokens = CubeModel.invert(CubeModel.parse(fullMoves(c)));
    if (k) tokens.push(VIEW_TURN[k]);
    // merge U turns that end up next to each other
    const out = [];
    const amount = t => t.endsWith("2") ? 2 : t.endsWith("'") ? 3 : 1;
    for (const t of tokens) {
      const prev = out[out.length - 1];
      if (prev && prev[0] === t[0] && t[0] === "U") {
        out.pop();
        const n = (amount(prev) + amount(t)) % 4;
        if (n) out.push(["", "U", "U2", "U'"][n]);
      } else out.push(t);
    }
    return out.join(" ");
  }

  // ---------------------------------------------------------------- summary bar on the level page
  function bar(stage, level, cases) {
    const data = load();
    const s = deckState(data, stage + "-" + level, cases, Date.now());
    const wrap = el("div", "practice-bar");
    const text = el("div", "practice-bar-text");
    text.appendChild(el("strong", null, "Practise this level"));
    let status;
    if (s.review.length || s.newLeft || s.learning.some(c => data.cards[c.id].due <= Date.now() + LEARN_AHEAD)) {
      const parts = [];
      if (s.review.length + s.learning.length) parts.push(`${s.review.length + s.learning.length} to review`);
      if (s.newLeft) parts.push(`${s.newLeft} new`);
      status = parts.join(" · ");
    } else if (s.next) status = "All caught up · next review " + inWords(s.next - Date.now());
    else status = "All caught up for today";
    text.appendChild(el("span", null, status));
    const links = el("div", "practice-bar-links");
    const go = el("a", "btn primary", "Practise");
    go.href = `#${stage}-${level}-practice`;
    const drill = el("a", "btn", "Drill all");
    drill.href = `#${stage}-${level}-drill`;
    links.append(go, drill);
    wrap.append(text, links);
    return wrap;
  }

  // ---------------------------------------------------------------- session
  let session = null;

  function stop() {
    if (session) clearInterval(session.timer);
    session = null;
  }

  // opts: { stage, level, mode ("practice" or "drill"), cases, title, diagram(c), watch(c, preAuf), backHref }
  function render(main, opts) {
    stop();
    const deckId = opts.stage + "-" + opts.level;
    const root = el("div", "practice");
    session = { ...opts, opts, deckId, root, main, lastId: null, timer: null };

    const head = el("div", "practice-head");
    const h = el("h2", null, opts.title);
    const back = el("a", "practice-back", "← All algorithms");
    back.href = opts.backHref;
    head.append(h, back);

    const modes = el("div", "practice-modes");
    modes.setAttribute("role", "tablist");
    for (const [m, label] of [["practice", "Spaced repetition"], ["drill", "Drill all"]]) {
      const a = el("a", "practice-mode", label);
      a.href = `#${deckId}-${m}`;
      a.setAttribute("role", "tab");
      a.setAttribute("aria-selected", m === opts.mode);
      modes.appendChild(a);
    }
    head.appendChild(modes);
    root.appendChild(head);

    const help = el("p", "practice-help", opts.mode === "drill"
      ? "Every case once, in random order. Recall the algorithm, do it on your cube if you have it, then check. Cases you get wrong come back at the end. This doesn't change your spaced-repetition schedule."
      : "Look at the case and recall its algorithm, ideally by doing it on your cube. Then show the answer and rate how it went. Cases you find hard come back sooner; ones you know well get spaced further apart.");
    root.appendChild(help);

    session.status = el("div", "practice-status");
    session.box = el("div", "practice-card");
    root.append(session.status, session.box);
    if (opts.mode !== "drill") root.appendChild(settings());
    main.appendChild(root);

    if (opts.mode === "drill") {
      session.queue = shuffle(opts.cases.slice());
      session.drillTimes = [];
      session.total = opts.cases.length;
    }
    next();
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function settings() {
    const data = load();
    const box = el("div", "practice-settings");
    const newLabel = el("label", null, "New cases a day ");
    const sel = el("select");
    sel.id = "practice-new-per-day";
    for (const n of NEW_PER_DAY) {
      const o = el("option", null, String(n));
      o.value = n;
      if (n === data.settings.newPerDay) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener("change", () => { const d = load(); d.settings.newPerDay = +sel.value; save(d); if (!session.revealed) next(); });
    newLabel.appendChild(sel);
    const angle = el("label");
    const cb = el("input");
    cb.type = "checkbox"; cb.id = "practice-random-angle"; cb.checked = data.settings.randomAngle;
    cb.addEventListener("change", () => { const d = load(); d.settings.randomAngle = cb.checked; save(d); });
    angle.append(cb, document.createTextNode(" Show OLL and PLL cases from a random angle"));
    const reset = el("button", "practice-reset", "Reset progress for this level");
    reset.type = "button";
    reset.addEventListener("click", () => {
      if (!confirm("Forget your practice history for every case in this level?")) return;
      const d = load();
      for (const c of session.cases) delete d.cards[c.id];
      delete d.today.started[session.deckId];
      delete d.today.extra[session.deckId];
      save(d);
      next();
    });
    box.append(newLabel, angle, reset);
    return box;
  }

  function updateStatus() {
    if (session.mode === "drill") {
      const done = session.total - session.queue.length;
      session.status.textContent = `${Math.min(done + 1, session.total)} of ${session.total}`;
      return;
    }
    const data = load();
    const s = deckState(data, session.deckId, session.cases, Date.now());
    session.status.textContent = "";
    for (const [n, label, cls] of [[s.newLeft, "New", "new"], [s.learning.length, "Learning", "learning"], [s.review.length, "To review", "review"]]) {
      const chip = el("span", "practice-count " + cls);
      chip.append(el("b", null, String(n)), document.createTextNode(" " + label));
      session.status.appendChild(chip);
    }
  }

  function next() {
    clearInterval(session.timer);
    session.revealed = false;
    let c;
    if (session.mode === "drill") c = session.queue[0] || null;
    else c = pickNext(load(), session.deckId, session.cases, Date.now(), session.lastId);
    updateStatus();
    if (!c) { finished(); return; }
    session.current = c;
    session.turn = load().settings.randomAngle && session.stage !== "f2l" ? Math.floor(Math.random() * 4) : 0;
    showFront(c);
  }

  function showFront(c) {
    const box = session.box;
    box.textContent = "";
    const dia = el("div", "practice-diagram");
    const svg = session.diagram(c);
    svg.style.transform = `rotate(${90 * session.turn}deg)`;
    session.svg = svg;
    dia.appendChild(svg);
    if (session.stage !== "f2l") dia.appendChild(el("span", "front", "Front"));
    const side = el("div", "practice-side");
    side.appendChild(el("p", "practice-prompt", "Which algorithm solves this case?"));
    const clock = el("div", "practice-timer", "0.0s");
    side.appendChild(clock);
    const reveal = el("button", "btn primary practice-reveal", "Show answer");
    reveal.type = "button"; reveal.id = "practice-reveal";
    reveal.appendChild(el("kbd", null, "Space"));
    reveal.addEventListener("click", showAnswer);
    side.appendChild(reveal);
    const setup = el("details", "practice-setup");
    setup.appendChild(el("summary", null, "Set it up on your cube"));
    setup.appendChild(el("p", null, "Starting from a solved cube (yellow top, green front), do:"));
    setup.appendChild(el("div", "alg", setupMoves(c, session.turn)));
    side.appendChild(setup);
    box.append(dia, side);
    session.started = performance.now();
    session.timer = setInterval(() => { clock.textContent = seconds(performance.now() - session.started); }, 100);
    session.clock = clock;
    reveal.focus({ preventScroll: true });
  }

  function showAnswer() {
    if (!session || session.revealed) return;
    session.revealed = true;
    clearInterval(session.timer);
    session.took = performance.now() - session.started;
    session.clock.textContent = seconds(session.took);
    const c = session.current;
    const side = session.box.querySelector(".practice-side");
    side.querySelector(".practice-reveal").remove();
    side.querySelector(".practice-prompt").remove();
    side.querySelector(".practice-setup").removeAttribute("open");
    // turn the diagram back to the angle the answer is written for
    if (session.turn) {
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) session.svg.style.transition = "transform 0.45s ease";
      session.svg.style.transform = `rotate(${session.turn === 3 ? 360 : 0}deg)`;
    }

    const answer = el("div", "practice-answer");
    const tr = el("div", "title-row");
    tr.appendChild(el("h3", null, c.title));
    if (c.oll && !c.title.startsWith("OLL")) tr.appendChild(el("span", "num", "OLL " + c.oll));
    answer.appendChild(tr);
    answer.appendChild(el("p", "rec", c.rec));
    const alg = el("div", "alg");
    const pre = PRE_AUF[session.turn];
    if (pre) {
      const p = el("span", "auf", pre + "  ");
      p.title = "The case was shown from another angle: turn the top like this first, or turn the whole cube";
      alg.appendChild(p);
    }
    alg.appendChild(document.createTextNode(c.alg));
    if (c.repeat) alg.appendChild(el("span", "auf", "  ×" + c.repeat));
    if (c.auf) alg.appendChild(el("span", "auf", "  then " + c.auf));
    answer.appendChild(alg);
    const watch = el("button", "practice-watch", "▶ Watch it");
    watch.type = "button"; watch.id = "practice-watch";
    watch.addEventListener("click", () => session.watch(c, pre));
    answer.appendChild(watch);
    side.insertBefore(answer, side.querySelector(".practice-setup"));

    const grades = el("div", "practice-grades");
    if (session.mode === "drill") {
      grades.append(gradeButton("Again", "Show it again later", "1", () => drillAnswer(false)),
                    gradeButton("Got it", "Next case", "Space", () => drillAnswer(true), true));
    } else {
      const data = load();
      const card = data.cards[c.id] || SRS.newCard();
      const now = Date.now();
      for (const [g, label, hint] of RATINGS) {
        const due = SRS.review(card, g, now, { useFuzz: false }).due;
        grades.appendChild(gradeButton(label, hint, String(g), () => rate(g), g === 3, duration(due - now)));
      }
    }
    side.appendChild(grades);
    grades.querySelector(".primary").focus({ preventScroll: true });
  }

  function gradeButton(label, hint, key, onClick, primary, when) {
    const b = el("button", "practice-grade" + (primary ? " primary" : ""));
    b.type = "button";
    b.id = "practice-grade-" + label.toLowerCase().replace(/\s+/g, "-");
    b.title = hint;
    b.append(el("span", "grade-label", label));
    if (when) b.append(el("span", "grade-when", when));
    b.append(el("kbd", null, key));
    b.addEventListener("click", onClick);
    return b;
  }

  function rate(g) {
    const data = load();
    const c = session.current;
    const prev = data.cards[c.id];
    if (!prev) data.today.started[session.deckId] = (data.today.started[session.deckId] || 0) + 1;
    const card = SRS.review(prev || SRS.newCard(), g, Date.now());
    card.times = [...((prev && prev.times) || []), Math.round(session.took)].slice(-10);
    data.cards[c.id] = card;
    save(data);
    session.lastId = c.id;
    next();
  }

  function drillAnswer(ok) {
    const c = session.queue.shift();
    session.drillTimes.push([c, session.took, ok]);
    if (!ok) session.queue.push(c);
    next();
  }

  function finished() {
    const box = session.box;
    box.textContent = "";
    const done = el("div", "practice-done");
    if (session.mode === "drill") {
      const firstTry = new Map();
      for (const [c, t, ok] of session.drillTimes) if (!firstTry.has(c.id)) firstTry.set(c.id, [c, t, ok]);
      const right = [...firstTry.values()].filter(x => x[2]).length;
      const avg = session.drillTimes.reduce((a, x) => a + x[1], 0) / Math.max(1, session.drillTimes.length);
      done.appendChild(el("h3", null, "Drill done"));
      done.appendChild(el("p", null, `${right} of ${session.total} right first time · ${seconds(avg)} average to recall`));
      const slow = [...firstTry.values()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      if (slow.length) {
        done.appendChild(el("p", "practice-slow-title", "Slowest to recall:"));
        const ul = el("ul", "practice-slow");
        for (const [c, t] of slow) ul.appendChild(el("li", null, `${c.title} · ${seconds(t)}`));
        done.appendChild(ul);
      }
      const again = el("button", "btn primary", "Drill again");
      again.type = "button"; again.id = "practice-drill-again";
      again.addEventListener("click", () => { session.root.remove(); render(session.main, session.opts); });
      done.appendChild(actions(again));
    } else {
      const data = load();
      const s = deckState(data, session.deckId, session.cases, Date.now());
      done.appendChild(el("h3", null, "All done for now"));
      done.appendChild(el("p", null, s.next ? `Your next case is due ${inWords(s.next - Date.now())}.` : "Come back tomorrow for more."));
      const btns = [];
      if (s.fresh.length) {
        const more = el("button", "btn primary", `Learn ${Math.min(5, s.fresh.length)} more today`);
        more.type = "button"; more.id = "practice-more";
        more.addEventListener("click", () => {
          const d = load();
          d.today.extra[session.deckId] = (d.today.extra[session.deckId] || 0) + 5;
          save(d);
          next();
        });
        btns.push(more);
      }
      const drill = el("a", "btn" + (btns.length ? "" : " primary"), "Drill all");
      drill.href = `#${session.deckId}-drill`;
      btns.push(drill);
      done.appendChild(actions(...btns));
    }
    box.appendChild(done);
    const first = done.querySelector(".btn");
    if (first) first.focus({ preventScroll: true });
  }

  function actions(...items) {
    const row = el("div", "practice-actions");
    const back = el("a", "btn", "Back to the algorithms");
    back.href = session.backHref;
    row.append(...items, back);
    return row;
  }

  // ---------------------------------------------------------------- keyboard
  document.addEventListener("keydown", e => {
    if (!session || !document.body.contains(session.root)) return;
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    const k = e.key;
    // a focused button handles its own Space and Enter
    if ((k === " " || k === "Enter") && /^(BUTTON|A|SUMMARY)$/.test(e.target.tagName) && !e.target.classList.contains("practice-reveal")) return;
    if (!session.revealed) {
      if (session.current && (k === " " || k === "Enter")) {
        e.preventDefault();
        showAnswer();
      }
      return;
    }
    if (session.mode === "drill") {
      if (k === "1") { e.preventDefault(); drillAnswer(false); }
      else if (k === " " || k === "Enter") { e.preventDefault(); drillAnswer(true); }
    } else if (["1", "2", "3", "4"].includes(k)) { e.preventDefault(); rate(+k); }
    else if (k === " " || k === "Enter") { e.preventDefault(); rate(3); }
  });

  window.Practice = { bar, render, stop };
})();
