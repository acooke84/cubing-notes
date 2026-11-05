// Cube model for the move player, ported from tools/cube.py: same sticker slots, same moves.
// Yellow on top, green in front. A state lists, for each of the 54 slots, the label of the
// sticker in it; in the solved state slot i holds label i.
(function (root) {
  // x points Right, y points Up, z points Front.
  // move letter -> [axis, side the turn is seen from, layers turned]
  const MOVES = {
    R: [0, 1, [1]], L: [0, -1, [-1]], U: [1, 1, [1]], D: [1, -1, [-1]], F: [2, 1, [1]], B: [2, -1, [-1]],
    r: [0, 1, [0, 1]], l: [0, -1, [-1, 0]], u: [1, 1, [0, 1]], d: [1, -1, [-1, 0]], f: [2, 1, [0, 1]], b: [2, -1, [-1, 0]],
    M: [0, -1, [0]], E: [1, -1, [0]], S: [2, 1, [0]], x: [0, 1, [-1, 0, 1]], y: [1, 1, [-1, 0, 1]], z: [2, 1, [-1, 0, 1]],
  };
  const FACE_OF_NORMAL = { "0,1,0": "U", "0,-1,0": "D", "0,0,1": "F", "0,0,-1": "B", "1,0,0": "R", "-1,0,0": "L" };

  // Quarter turn clockwise, as seen looking at the cube from the `side` end of `axis`.
  function rotate(v, axis, side) {
    const [x, y, z] = v;
    let out = axis === 0 ? [x, z, -y] : axis === 1 ? [-z, y, x] : [y, -x, z];
    if (side < 0) out = rotate(rotate(out, axis, 1), axis, 1);
    return out;
  }

  const SLOTS = []; // [position, normal] for each sticker, in the same order as cube.py
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) {
    const p = [x, y, z];
    for (let a = 0; a < 3; a++) {
      if (!p[a]) continue;
      const n = [0, 0, 0];
      n[a] = p[a];
      SLOTS.push([p, n]);
    }
  }
  const key = (p, n) => p.join() + "|" + n.join();
  const SLOT_INDEX = new Map(SLOTS.map(([p, n], i) => [key(p, n), i]));
  const SOLVED = SLOTS.map((_, i) => i);

  const permCache = new Map();
  function perm(token) {
    if (permCache.has(token)) return permCache.get(token);
    const [axis, side, layers] = MOVES[token[0]];
    const turns = token.endsWith("2") ? 2 : token.endsWith("'") ? 3 : 1;
    let out = SOLVED.slice();
    for (let t = 0; t < turns; t++) {
      const nxt = out.slice();
      SLOTS.forEach(([p, n], j) => {
        if (layers.includes(p[axis])) nxt[SLOT_INDEX.get(key(rotate(p, axis, side), rotate(n, axis, side)))] = out[j];
      });
      out = nxt;
    }
    permCache.set(token, out);
    return out;
  }

  function parse(alg) {
    const tokens = alg.replace(/[()]/g, " ").split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      if (!(t[0] in MOVES) || !["", "'", "2", "2'"].includes(t.slice(1))) throw new Error(`Unknown move ${t} in ${alg}`);
    }
    return tokens.map(t => t.replace("2'", "2"));
  }

  function invert(tokens) {
    return tokens.slice().reverse().map(t => t.endsWith("2") ? t : t.endsWith("'") ? t.slice(0, -1) : t + "'");
  }

  function apply(state, tokens) {
    for (const t of tokens) {
      const p = perm(t);
      state = p.map(i => state[i]);
    }
    return state;
  }

  // Face ("U", "F", ...) whose colour the sticker with this label has.
  const faceOf = label => FACE_OF_NORMAL[SLOTS[label][1].join()];

  const api = { MOVES, SLOTS, SOLVED, parse, invert, apply, faceOf, perm };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CubeModel = api;
})(this);
