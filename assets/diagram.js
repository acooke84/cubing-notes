// Draws a last-layer top view from a 5x5 grid produced by tools/cube.py.
// Inner 3x3 = U face ('#' yellow up, '?' ignore, ' ' not yellow).
// Border = side stickers ('-' on back/front rows, '|' on left/right columns).
(function () {
  const NS = "http://www.w3.org/2000/svg";

  function rect(svg, x, y, w, h, style, rx) {
    const r = document.createElementNS(NS, "rect");
    r.setAttribute("x", x); r.setAttribute("y", y);
    r.setAttribute("width", w); r.setAttribute("height", h);
    r.setAttribute("rx", rx); r.setAttribute("style", style);
    svg.appendChild(r);
  }

  window.topViewDiagram = function (grid, label) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 120 120");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label + " top view");
    const O = 15, C = 30, G = 3;
    for (let r = 1; r <= 3; r++) for (let c = 1; c <= 3; c++) {
      const ch = grid[r][c];
      const style = ch === "#" ? "fill:var(--sticker)"
        : ch === "?" ? "fill:var(--unknown);stroke:var(--muted);stroke-width:1;stroke-dasharray:3 2"
        : "fill:var(--blank)";
      rect(svg, O + (c - 1) * C + G / 2, O + (r - 1) * C + G / 2, C - G, C - G, style, 4);
    }
    const S = "fill:var(--sticker)";
    for (let c = 1; c <= 3; c++) {
      if (grid[0][c] === "-") rect(svg, O + (c - 1) * C + G / 2 + 2, 3, C - G - 4, 8, S, 2);
      if (grid[4][c] === "-") rect(svg, O + (c - 1) * C + G / 2 + 2, 109, C - G - 4, 8, S, 2);
    }
    for (let r = 1; r <= 3; r++) {
      if (grid[r][0] === "|") rect(svg, 3, O + (r - 1) * C + G / 2 + 2, 8, C - G - 4, S, 2);
      if (grid[r][4] === "|") rect(svg, 109, O + (r - 1) * C + G / 2 + 2, 8, C - G - 4, S, 2);
    }
    return svg;
  };
})();
