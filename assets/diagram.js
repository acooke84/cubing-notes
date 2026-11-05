// SVG diagrams for each stage. Data comes from tools/cube.py via assets/cases.js.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const STICKER = { Y: "var(--c-yellow)", W: "var(--c-white)", G: "var(--c-green)", O: "var(--c-orange)",
                    R: "var(--c-red)", B: "var(--c-blue)", x: "var(--c-top)", s: "var(--c-solved)" };

  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function frame(label) {
    return svgEl("svg", { viewBox: "0 0 120 120", role: "img", "aria-label": label });
  }

  // Top view used by OLL and PLL: 3x3 top face plus a strip for each side sticker.
  const O = 15, C = 30, G = 3;
  const cell = (r, c) => [O + c * C + G / 2, O + r * C + G / 2];
  const centre = (r, c) => [O + c * C + C / 2, O + r * C + C / 2];

  function sideStrips(svg, fills) {
    // fills: {back:[3], front:[3], left:[3], right:[3]} of CSS colours or null
    for (let i = 0; i < 3; i++) {
      const x = O + i * C + G / 2 + 2, y = O + i * C + G / 2 + 2, len = C - G - 4;
      if (fills.back[i]) svgEl("rect", { x, y: 3, width: len, height: 8, rx: 2, style: "fill:" + fills.back[i] }, svg);
      if (fills.front[i]) svgEl("rect", { x, y: 109, width: len, height: 8, rx: 2, style: "fill:" + fills.front[i] }, svg);
      if (fills.left[i]) svgEl("rect", { x: 3, y, width: 8, height: len, rx: 2, style: "fill:" + fills.left[i] }, svg);
      if (fills.right[i]) svgEl("rect", { x: 109, y, width: 8, height: len, rx: 2, style: "fill:" + fills.right[i] }, svg);
    }
  }

  // OLL: grid is 5 strings of 5 chars. Inner 3x3: '#' yellow up, '?' ignore, ' ' not yellow.
  // Border: '-' (back/front rows) or '|' (left/right columns) is a yellow side sticker.
  function oll(grid, label) {
    const svg = frame(label + ", top view");
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const ch = grid[r + 1][c + 1];
      const [x, y] = cell(r, c);
      const style = ch === "#" ? "fill:var(--c-yellow)"
        : ch === "?" ? "fill:var(--unknown);stroke:var(--muted);stroke-width:1;stroke-dasharray:3 2"
        : "fill:var(--blank)";
      svgEl("rect", { x, y, width: C - G, height: C - G, rx: 4, style }, svg);
    }
    const Y = "var(--c-yellow)";
    const fills = { back: [], front: [], left: [], right: [] };
    for (let i = 0; i < 3; i++) {
      fills.back.push(grid[0][i + 1] === "-" ? Y : null);
      fills.front.push(grid[4][i + 1] === "-" ? Y : null);
      fills.left.push(grid[i + 1][0] === "|" ? Y : null);
      fills.right.push(grid[i + 1][4] === "|" ? Y : null);
    }
    sideStrips(svg, fills);
    return svg;
  }

  function arrowHead(svg, x, y, dx, dy) {
    const len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, s = 6.5;
    const pts = [[x, y], [x - ux * s - uy * s * 0.6, y - uy * s + ux * s * 0.6], [x - ux * s + uy * s * 0.6, y - uy * s - ux * s * 0.6]];
    svgEl("polygon", { points: pts.map(p => p.join(",")).join(" "), style: "fill:var(--arrow)" }, svg);
  }

  // PLL: top face all yellow, side colours around it, arrows from each piece to where it goes.
  function pll(d, label) {
    const svg = frame(label + ", top view with arrows");
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const [x, y] = cell(r, c);
      svgEl("rect", { x, y, width: C - G, height: C - G, rx: 4, style: "fill:var(--c-yellow)" }, svg);
    }
    const toFill = s => s.split("").map(ch => STICKER[ch]);
    sideStrips(svg, { back: toFill(d.sides.back), front: toFill(d.sides.front), left: toFill(d.sides.left), right: toFill(d.sides.right) });
    for (const [r1, c1, r2, c2, both] of d.arrows) {
      let [x1, y1] = centre(r1, c1), [x2, y2] = centre(r2, c2);
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), trim = 7;
      const ux = dx / len, uy = dy / len;
      const sx = x1 + ux * (both ? trim : 4), sy = y1 + uy * (both ? trim : 4);
      const ex = x2 - ux * trim, ey = y2 - uy * trim;
      svgEl("line", { x1: sx, y1: sy, x2: ex - ux * 4, y2: ey - uy * 4, style: "stroke:var(--arrow);stroke-width:2.6;stroke-linecap:round" }, svg);
      arrowHead(svg, ex, ey, dx, dy);
      if (both) {
        svgEl("line", { x1: sx, y1: sy, x2: sx + ux * 4, y2: sy + uy * 4, style: "stroke:var(--arrow);stroke-width:2.6" }, svg);
        arrowHead(svg, sx, sy, -dx, -dy);
      } else {
        svgEl("circle", { cx: x1, cy: y1, r: 3, style: "fill:var(--arrow)" }, svg);
      }
    }
    return svg;
  }

  // F2L: isometric view of the top, front and right faces.
  const K = 18.5, CX = 60, CY = 60;
  const proj = (x, y, z) => [CX + (x - z) * K * 0.866, CY + ((x + z) * 0.5 - y) * K];

  function quad(svg, pts, fill, inset) {
    const cx = pts.reduce((a, p) => a + p[0], 0) / 4, cy = pts.reduce((a, p) => a + p[1], 0) / 4;
    const shrunk = pts.map(([x, y]) => [cx + (x - cx) * (1 - inset), cy + (y - cy) * (1 - inset)]);
    svgEl("polygon", { points: shrunk.map(p => p.map(v => v.toFixed(2)).join(",")).join(" "), style: "fill:" + fill + ";stroke-linejoin:round" }, svg);
  }

  // With `mirrored`, faces.R holds the left face and the picture is flipped to show the front-left slot.
  function f2l(faces, label, mirrored) {
    const root = frame(label + (mirrored ? ", front-left view" : ", front-right view"));
    const svg = mirrored ? svgEl("g", { transform: "translate(120 0) scale(-1 1)" }, root) : root;
    const h = 1.5;
    quad(svg, [proj(-h, h, -h), proj(h, h, -h), proj(h, h, h), proj(-h, h, h)], "var(--c-body)", -0.02);
    quad(svg, [proj(-h, h, h), proj(h, h, h), proj(h, -h, h), proj(-h, -h, h)], "var(--c-body)", -0.02);
    quad(svg, [proj(h, h, h), proj(h, h, -h), proj(h, -h, -h), proj(h, -h, h)], "var(--c-body)", -0.02);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      // U: row 0 = back, col 0 = left
      const ux = -h + c, uz = -h + r;
      quad(svg, [proj(ux, h, uz), proj(ux + 1, h, uz), proj(ux + 1, h, uz + 1), proj(ux, h, uz + 1)], STICKER[faces.U[r][c]], 0.16);
      // F: row 0 = top, col 0 = left
      const fx = -h + c, fy = h - r;
      quad(svg, [proj(fx, fy, h), proj(fx + 1, fy, h), proj(fx + 1, fy - 1, h), proj(fx, fy - 1, h)], STICKER[faces.F[r][c]], 0.16);
      // R: row 0 = top, col 0 = front
      const rz = h - c, ry = h - r;
      quad(svg, [proj(h, ry, rz), proj(h, ry, rz - 1), proj(h, ry - 1, rz - 1), proj(h, ry - 1, rz)], STICKER[faces.R[r][c]], 0.16);
    }
    return root;
  }

  window.CubeDiagram = { oll, pll, f2l };
})();
