# Cubing Notes

Algorithms, case diagrams and notes for solving the 3×3 Rubik's cube faster, published with GitHub Pages.

## What's here

| Path | What it is |
|---|---|
| `index.html` | Home page listing the guides |
| `oll/` | OLL case sheet (2-look OLL plus one-look starters) |
| `data/oll.json` | The OLL cases: name, how to recognise it, algorithm |
| `tools/cube.py` | Small cube simulator that works out each case's diagram from its algorithm |
| `tools/build.py` | Regenerates `<guide>/cases.js` from `data/<guide>.json` |
| `assets/` | Shared styles and the diagram renderer |

## Adding or changing an OLL case

1. Edit `data/oll.json`. Each case needs:
   - `group`: `edges`, `corners` or `full` (which section it appears in)
   - `name`, `rec` (how to recognise it) and `alg`
   - optional `oll` (the standard OLL number) and `edgesOnly: true` (greys out the corners)
2. Run `python3 tools/build.py`. It writes `oll/cases.js`.
3. Open `oll/index.html` in a browser to check the diagram, then commit both files.

The diagram shows the case the algorithm solves, held the way the algorithm expects. If a diagram looks wrong, the algorithm probably has a typo.

## Adding a new guide

1. Create `data/<guide>.json` and `<guide>/index.html` (copy `oll/index.html` as a starting point).
2. Add the guide to `GUIDES` in `tools/build.py`.
3. Link it from `index.html` and from the `site-nav` on each page.

The current diagram is the OLL-style top view. Other guides such as PLL (which need arrows) will need a new diagram type in `tools/cube.py` and `assets/diagram.js`.

## Previewing locally

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.
