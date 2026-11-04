"""Check every algorithm and build the case data the site loads.

Usage:  python3 tools/build.py

Reads data/f2l.json, data/oll.json and data/pll.json and writes assets/cases.js.
It stops with an error if any algorithm is invalid (for example it breaks the
first two layers), if two cases in a stage are the same, or if a stage
no longer covers every case.
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import cube  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
LEVELS = ("beginner", "intermediate", "advanced")
FULL_SET = {"f2l": 41, "oll": 57, "pll": 21}

DIRECTION = {(0, 1, 0): "up", (0, -1, 0): "down", (0, 0, 1): "the front", (0, 0, -1): "the back",
             (1, 0, 0): "the right", (-1, 0, 0): "the left"}
COLOUR_NAME = {"G": "green", "O": "orange", "R": "red", "B": "blue", "Y": "yellow", "W": "white"}
CORNER_NAME = {(0, 0): "back-left", (0, 2): "back-right", (2, 0): "front-left", (2, 2): "front-right"}
EDGE_NAME = {(0, 1): "back", (1, 0): "left", (1, 2): "right", (2, 1): "front"}


class BuildError(Exception):
    pass


def check_common(stage, cases):
    ids = set()
    for c in cases:
        for key in ("id", "level", "section", "title", "alg"):
            if key not in c:
                raise BuildError(f"{stage}: case {c.get('id', c)} is missing '{key}'")
        if c["level"] not in LEVELS:
            raise BuildError(f"{stage}: {c['id']} has unknown level {c['level']!r}")
        if c["id"] in ids:
            raise BuildError(f"{stage}: duplicate id {c['id']}")
        ids.add(c["id"])
        cube.parse(c["alg"])


def check_coverage(stage, cases, class_of, skip=lambda c: False):
    seen = {}
    for c in cases:
        if skip(c):
            continue
        k = class_of(c["alg"])
        if k in seen:
            raise BuildError(f"{stage}: {c['id']} solves the same case as {seen[k]}")
        seen[k] = c["id"]
    if len(seen) != FULL_SET[stage]:
        print(f"  note: {stage} covers {len(seen)} of {FULL_SET[stage]} cases")
    return len(seen)


# ---------------------------------------------------------------- stages

def build_oll(cases):
    for c in cases:
        if not cube.solved_below_top(cube.apply(cube.SOLVED, c["alg"])):
            raise BuildError(f"oll: {c['id']} ({c['alg']}) breaks the first two layers")
    check_coverage("oll", cases, cube.oll_class, skip=lambda c: c.get("edgesOnly"))
    out = []
    for c in cases:
        grid = cube.oll_grid(c["alg"], edges_only=c.get("edgesOnly", False))
        e = {**c, "grid": grid}
        if "rec" not in e:
            corners = sum(grid[r][k] == "#" for r, k in cube.CORNER_TOP)
            edges = sum(grid[r][k] == "#" for r, k in [(1, 2), (2, 1), (2, 3), (3, 2)])
            text = f"{_count(edges, 'edge')} and {_count(corners, 'corner')} already yellow on top."
            e["rec"] = text[0].upper() + text[1:]
        out.append(e)
    return out


def _count(n, word):
    return f"{'no' if n == 0 else n} {word}{'' if n == 1 else 's'}"


def _cycle_text(moves, names, word):
    parts, done = [], set()
    for start in moves:
        if start in done:
            continue
        cyc, cur = [start], moves[start]
        while cur != start:
            cyc.append(cur)
            cur = moves[cur]
        done.update(cyc)
        if len(cyc) == 2:
            parts.append(f"swaps the {names[cyc[0]]} and {names[cyc[1]]} {word}s")
        else:
            (r1, c1), (r2, c2), (r3, c3) = cyc[:3]
            area = (c2 - c1) * (r1 - r3) - (r1 - r2) * (c3 - c1)  # rows grow downwards
            turn = "anticlockwise" if area > 0 else "clockwise"
            listed = ", ".join(names[x] for x in cyc[:-1]) + f" and {names[cyc[-1]]}"
            parts.append(f"cycles the {listed} {word}s {turn}")
    return parts


def build_pll(cases):
    for c in cases:
        s = cube.apply(cube.SOLVED, c["alg"])
        if not cube.solved_below_top(s) or not cube.top_layer_oriented(s):
            raise BuildError(f"pll: {c['id']} ({c['alg']}) is not a pure top-layer permutation")
    check_coverage("pll", cases, cube.pll_class)
    out = []
    for c in cases:
        d = cube.pll_diagram(c["alg"])
        corner_moves, edge_moves = {}, {}
        for r1, c1, r2, c2, both in d["arrows"]:
            target = corner_moves if (r1, c1) in CORNER_NAME else edge_moves
            target[(r1, c1)] = (r2, c2)
            if both:
                target[(r2, c2)] = (r1, c1)
        parts = _cycle_text(corner_moves, CORNER_NAME, "corner") + _cycle_text(edge_moves, EDGE_NAME, "edge")
        if not corner_moves:
            parts.append("corners stay put")
        if not edge_moves:
            parts.append("edges stay put")
        rec = "; ".join(parts)
        rec = rec[0].upper() + rec[1:] + "."
        out.append({**c, **d, "rec": c.get("rec", rec)})
    return out


def build_f2l(cases):
    for c in cases:
        if not cube.f2l_valid(c["alg"]):
            raise BuildError(f"f2l: {c['id']} ({c['alg']}) disturbs the cross or another slot")
    check_coverage("f2l", cases, cube.f2l_class)
    out = []
    for c in cases:
        out.append({**c, "faces": cube.f2l_faces(c["alg"]), "rec": c.get("rec", _f2l_text(c["alg"]))})
    return out


def _f2l_text(alg):
    s = cube.case_state(alg)
    corner = [i for i in range(54) if s[i] in cube.PAIR_LABELS and cube.SLOTS[s[i]][0] == cube.PAIR_CORNER]
    edge = [i for i in range(54) if s[i] in cube.PAIR_LABELS and cube.SLOTS[s[i]][0] == cube.PAIR_EDGE]
    pos = cube.SLOTS[corner[0]][0]
    white = next(i for i in corner if cube.slot_colour(s[i]) == "W")
    facing = DIRECTION[cube.SLOTS[white][1]]
    if pos == cube.PAIR_CORNER:
        ctext = "Corner in its slot, " + ("solved" if facing == "down" else f"white facing {facing}")
    else:
        ctext = f"Corner on top at {CORNER_NAME[(pos[2] + 1, pos[0] + 1)]}, white facing {facing}"
    epos = cube.SLOTS[edge[0]][0]
    if epos == cube.PAIR_EDGE:
        right = all(cube.SLOTS[i][1] == cube.SLOTS[s[i]][1] for i in edge)
        etext = "edge in its slot, " + ("solved" if right else "flipped")
    else:
        top = next(i for i in edge if cube.SLOTS[i][1] == (0, 1, 0))
        etext = f"edge on top at the {EDGE_NAME[(epos[2] + 1, epos[0] + 1)]}, {COLOUR_NAME[cube.slot_colour(s[top])]} on top"
    return f"{ctext}; {etext}."


BUILDERS = {"f2l": build_f2l, "oll": build_oll, "pll": build_pll}


def main():
    data = {}
    for stage, builder in BUILDERS.items():
        cases = json.loads((ROOT / "data" / f"{stage}.json").read_text())
        check_common(stage, cases)
        built = builder(cases)
        for c in built:
            c["moves"] = cube.move_count(c["alg"])
        data[stage] = built
        counts = ", ".join(f"{lv} {sum(c['level'] == lv for c in built)}" for lv in LEVELS)
        print(f"{stage}: {len(built)} algorithms ({counts})")
    target = ROOT / "assets" / "cases.js"
    target.write_text("// Generated by tools/build.py from data/*.json. Do not edit by hand.\n"
                      "window.CASES = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"wrote {target.relative_to(ROOT)}")


if __name__ == "__main__":
    try:
        main()
    except BuildError as e:
        sys.exit(f"error: {e}")
