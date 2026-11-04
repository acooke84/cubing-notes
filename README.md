# Cubing Notes

CFOP algorithms for the 3×3 Rubik's cube, published with GitHub Pages at
<https://acooke84.github.io/cubing-notes/>.

The site has a tab for each CFOP step (Cross, F2L, OLL, PLL). Each step with
algorithms is split into Beginner, Intermediate and Advanced levels, so new
cubers only see a few algorithms at a time.

| Stage | Beginner | Intermediate | Advanced |
|---|---|---|---|
| F2L | 8: basic inserts and easy setups | 16: the rest of the cases with both pieces on top | 17: a piece stuck in the slot |
| OLL | 10: 2-look OLL | 11: one-look cases built from moves you already know | 39: the rest of full OLL |
| PLL | 6: 2-look PLL | 7: A, J, R and F perms | 8: E, V, N and G perms |

## What's here

| Path | What it is |
|---|---|
| `index.html` | The whole site (tabs are driven by the URL hash, e.g. `#oll-intermediate`) |
| `data/f2l.json`, `data/oll.json`, `data/pll.json` | The algorithms: id, level, section, title and algorithm |
| `tools/cube.py` | Cube simulator that checks algorithms and works out each diagram |
| `tools/build.py` | Checks every algorithm and writes `assets/cases.js` |
| `tools/find_f2l.py` | Searches for F2L algorithms; used to fill gaps in the F2L set |
| `assets/` | Shared styles, diagram drawing and the generated case data |
| `oll/` | Redirect from the old OLL-only page |

## Adding or changing an algorithm

1. Edit the stage's file in `data/`. Each case needs `id`, `level` (`beginner`, `intermediate` or `advanced`), `section` (the heading it appears under), `title` and `alg`.
   - Optional: `rec` (how to recognise it; if left out, a description is generated), and `oll` (the standard OLL number).
2. Run `python3 tools/build.py`. It stops with an error if an algorithm:
   - breaks the first two layers (OLL and PLL), or the cross and other slots (F2L),
   - isn't a pure top-layer swap (PLL),
   - solves the same case as another algorithm in that stage.

   It also prints a note if a stage no longer covers every case (41 F2L, 57 OLL, 21 PLL).
3. Preview it locally (see below), then commit and push. GitHub Pages updates within a minute or two.

The diagrams are worked out from the algorithms, so if a diagram looks wrong, the algorithm probably has a typo.

## Conventions

- Yellow on top, green in front, so orange is on the right and white is on the bottom.
- F2L cases are shown for the front-right slot.
- PLL algorithms that leave the top layer turned show the extra turn (for example "then U'") after the algorithm.

## Previewing locally

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.
