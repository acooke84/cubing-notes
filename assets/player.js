// Move player: a small 3D cube in a panel at the bottom of the window that plays an algorithm
// move by move. Drawn with CSS 3D transforms; the cube itself comes from assets/cube.js.
(function () {
  const M = window.CubeModel;
  const S = 26; // cubie size in px
  const COLOUR = { U: "var(--c-yellow)", D: "var(--c-white)", F: "var(--c-green)", B: "var(--c-blue)", R: "var(--c-orange)", L: "var(--c-red)" };
  // Each cubie face starts facing the viewer; this turns it to face along its normal (CSS y points down).
  const FACE_TRANSFORM = {
    "0,0,1": "", "0,0,-1": "rotateY(180deg)", "1,0,0": "rotateY(90deg)", "-1,0,0": "rotateY(-90deg)",
    "0,1,0": "rotateX(90deg)", "0,-1,0": "rotateX(-90deg)",
  };
  const SPEEDS = [["Slow", 0.5], ["Normal", 1], ["Fast", 2]];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  // ---------------------------------------------------------------- panel
  const panel = el("aside", "player");
  panel.id = "player";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Algorithm player");
  const view = el("div", "player-view");
  view.title = "Drag to turn the cube";
  const scene = el("div", "player-scene");
  view.appendChild(scene);
  const body = el("div", "player-body");
  const head = el("div", "player-head");
  const title = el("h3", "player-title");
  const close = el("button", "player-close", "×");
  close.type = "button"; close.id = "player-close"; close.setAttribute("aria-label", "Close player");
  head.append(title, close);
  const moveList = el("div", "player-moves");
  const status = el("p", "player-status");
  status.setAttribute("aria-live", "polite");
  const controls = el("div", "player-controls");
  const button = (id, text, label) => {
    const b = el("button", null, text);
    b.type = "button"; b.id = "player-" + id; b.setAttribute("aria-label", label);
    controls.appendChild(b);
    return b;
  };
  const restartBtn = button("restart", "↺", "Back to the start");
  const prevBtn = button("prev", "‹", "Previous move");
  const playBtn = button("play", "Play", "Play");
  const nextBtn = button("next", "›", "Next move");
  const speedBtn = button("speed", "Normal", "Speed: Normal");
  body.append(head, moveList, status, controls);
  panel.append(view, body);

  // 26 cubies, each with six faces; outer faces carry a sticker.
  const cubies = [];
  const stickers = new Array(54);
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) {
    if (!x && !y && !z) continue;
    const pos = [x, y, z];
    const cubie = el("div", "cubie");
    const base = `translate3d(${x * S}px, ${-y * S}px, ${z * S}px)`;
    cubie.style.transform = base;
    for (const nk in FACE_TRANSFORM) {
      const n = nk.split(",").map(Number);
      const face = el("div", "cf");
      face.style.transform = `${FACE_TRANSFORM[nk]} translateZ(${S / 2}px)`;
      const a = n.findIndex(v => v);
      if (pos[a] === n[a]) {
        const st = el("div", "st");
        stickers[M.SLOTS.findIndex(([p, q]) => p.join() === pos.join() && q.join() === nk)] = st;
        face.appendChild(st);
      }
      cubie.appendChild(face);
    }
    scene.appendChild(cubie);
    cubies.push({ el: cubie, pos, base });
  }

  // ---------------------------------------------------------------- state
  let state = M.SOLVED, start = M.SOLVED, moves = [], index = 0;
  let playing = false, busy = false, session = 0, running = [];
  let speed = 1, yaw = -38, pitch = -28;

  function paint() { state.forEach((label, i) => { stickers[i].style.background = COLOUR[M.faceOf(label)]; }); }
  function orient() { scene.style.transform = `rotateX(${pitch}deg) rotateY(${yaw}deg)`; }

  // Animate one move, then update the stickers and put the cubies back where they were.
  function turn(token) {
    const [axis, side, layers] = M.MOVES[token[0]];
    const v = [0, 0, 0];
    v[axis] = side;
    const axisCss = `${v[0]}, ${-v[1]}, ${v[2]}`;
    const angle = token.endsWith("2") ? 180 : token.endsWith("'") ? -90 : 90;
    const duration = reduceMotion.matches ? 0 : (token.endsWith("2") ? 520 : 360) / speed;
    running = cubies.filter(c => layers.includes(c.pos[axis])).map(c => c.el.animate(
      [{ transform: `rotate3d(${axisCss}, 0deg) ${c.base}` }, { transform: `rotate3d(${axisCss}, ${angle}deg) ${c.base}` }],
      { duration, easing: "ease-in-out", fill: "forwards" }));
    const mine = session;
    return Promise.all(running.map(a => a.finished)).then(() => {
      if (mine !== session) return false;
      state = M.apply(state, [token]);
      paint();
      running.forEach(a => a.cancel());
      running = [];
      return true;
    }, () => false);
  }

  async function step(dir) {
    if (busy || (dir > 0 ? index >= moves.length : index <= 0)) return false;
    busy = true;
    const target = dir > 0 ? index : index - 1;
    sync(target);
    const done = await turn(dir > 0 ? moves[index].token : M.invert([moves[index - 1].token])[0]);
    if (done) index += dir;
    busy = false;
    sync();
    return done;
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function play() {
    if (index >= moves.length) reset();
    playing = true;
    sync();
    const mine = session;
    while (playing && mine === session && index < moves.length) {
      if (!(await step(1))) break;
      if (index < moves.length) await sleep(reduceMotion.matches ? 450 : 140 / speed);
    }
    if (mine === session) { playing = false; sync(); }
  }

  function stopAnimations() {
    session++;
    running.forEach(a => a.cancel());
    running = [];
    busy = false;
    playing = false;
  }

  function reset() {
    stopAnimations();
    state = start;
    index = 0;
    paint();
    sync();
  }

  // ---------------------------------------------------------------- move list
  function renderMoves() {
    moveList.textContent = "";
    let group = null;
    moves.forEach((m, i) => {
      if (m.group !== group) {
        if (m.label) moveList.appendChild(el("span", "player-label", m.label));
        group = m.group;
      }
      m.node = el("span", "player-move", m.token);
      m.node.addEventListener("click", () => jump(i));
      moveList.appendChild(m.node);
    });
  }

  // Jump straight to the state just before move i.
  function jump(i) {
    stopAnimations();
    state = M.apply(start, moves.slice(0, i).map(m => m.token));
    index = i;
    paint();
    sync();
  }

  function sync(active) {
    moves.forEach((m, i) => {
      m.node.classList.toggle("done", i < index && i !== active);
      m.node.classList.toggle("now", i === active);
      m.node.classList.toggle("next", active == null && i === index && index < moves.length);
    });
    const shown = active != null ? active : index;
    status.textContent = index >= moves.length && active == null ? "Done" : index === 0 && active == null ? `${moves.length} moves` : `Move ${shown + 1} of ${moves.length}`;
    playBtn.textContent = playing ? "Pause" : index >= moves.length ? "Replay" : "Play";
    playBtn.setAttribute("aria-label", playBtn.textContent);
    prevBtn.disabled = index <= 0 || playing;
    nextBtn.disabled = index >= moves.length || playing;
  }

  // ---------------------------------------------------------------- open / close
  // parts: [{ alg, label }] played in order. Starts from the state the whole sequence solves.
  function open(name, parts, opts = {}) {
    stopAnimations();
    moves = [];
    parts.forEach((p, g) => { for (const token of M.parse(p.alg)) moves.push({ token, group: g, label: p.label }); });
    start = M.apply(M.SOLVED, M.invert(moves.map(m => m.token)));
    yaw = opts.yaw != null ? opts.yaw : -38;
    pitch = opts.pitch != null ? opts.pitch : -28;
    orient();
    title.textContent = name;
    renderMoves();
    reset();
    if (panel.hidden) {
      panel.hidden = false;
      document.body.classList.add("player-open");
    }
    const mine = session;
    setTimeout(() => { if (mine === session && !panel.hidden) play(); }, 600);
  }

  function hide() {
    stopAnimations();
    panel.hidden = true;
    document.body.classList.remove("player-open");
  }

  // ---------------------------------------------------------------- controls
  close.addEventListener("click", hide);
  playBtn.addEventListener("click", () => { if (playing) { playing = false; sync(); } else play(); });
  prevBtn.addEventListener("click", () => step(-1));
  nextBtn.addEventListener("click", () => step(1));
  restartBtn.addEventListener("click", reset);
  speedBtn.addEventListener("click", () => {
    const i = (SPEEDS.findIndex(s => s[1] === speed) + 1) % SPEEDS.length;
    [speedBtn.textContent, speed] = SPEEDS[i];
    speedBtn.setAttribute("aria-label", "Speed: " + speedBtn.textContent);
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) hide(); });

  // Drag to look around the cube.
  let drag = null;
  view.addEventListener("pointerdown", e => { drag = [e.clientX, e.clientY, yaw, pitch]; view.setPointerCapture(e.pointerId); });
  view.addEventListener("pointermove", e => {
    if (!drag) return;
    yaw = drag[2] + (e.clientX - drag[0]) * 0.6;
    pitch = Math.max(-85, Math.min(85, drag[3] - (e.clientY - drag[1]) * 0.6));
    orient();
  });
  const endDrag = () => { drag = null; };
  view.addEventListener("pointerup", endDrag);
  view.addEventListener("pointercancel", endDrag);

  document.body.appendChild(panel);
  window.CubePlayer = { open, close: hide };
})();
