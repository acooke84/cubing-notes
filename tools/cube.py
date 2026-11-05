"""Small 3x3 cube simulator used to draw and check every case on the site.

The cube is held yellow on top and green in front, so orange is on the right,
red on the left, blue at the back and white at the bottom.

A state is a tuple of 54 labels, one per sticker slot. In the solved state each
slot holds its own index, so a label says which slot (and therefore which piece
and colour) the sticker belongs to. Moves are permutations of slots.
"""
from functools import lru_cache

# x points Right, y points Up, z points Front.
# move letter -> (axis, side the turn is seen from, layers turned)
MOVES = {
    "R": (0, 1, {1}), "L": (0, -1, {-1}),
    "U": (1, 1, {1}), "D": (1, -1, {-1}),
    "F": (2, 1, {1}), "B": (2, -1, {-1}),
    "r": (0, 1, {0, 1}), "l": (0, -1, {-1, 0}),
    "u": (1, 1, {0, 1}), "d": (1, -1, {-1, 0}),
    "f": (2, 1, {0, 1}), "b": (2, -1, {-1, 0}),
    "M": (0, -1, {0}), "E": (1, -1, {0}), "S": (2, 1, {0}),
    "x": (0, 1, {-1, 0, 1}), "y": (1, 1, {-1, 0, 1}), "z": (2, 1, {-1, 0, 1}),
}

FACE_OF_NORMAL = {(0, 1, 0): "U", (0, -1, 0): "D", (0, 0, 1): "F", (0, 0, -1): "B", (1, 0, 0): "R", (-1, 0, 0): "L"}
COLOUR_OF_FACE = {"U": "Y", "D": "W", "F": "G", "B": "B", "R": "O", "L": "R"}


def _rotate(vec, axis, side):
    """Quarter turn clockwise, as seen looking at the cube from the `side` end of `axis`."""
    x, y, z = vec
    out = (x, z, -y) if axis == 0 else (-z, y, x) if axis == 1 else (y, -x, z)
    if side < 0:
        out = _rotate(_rotate(out, axis, 1), axis, 1)
    return out


SLOTS = []  # (position, normal) for each of the 54 stickers
for _x in (-1, 0, 1):
    for _y in (-1, 0, 1):
        for _z in (-1, 0, 1):
            _p = (_x, _y, _z)
            for _a in range(3):
                if _p[_a]:
                    _n = [0, 0, 0]
                    _n[_a] = _p[_a]
                    SLOTS.append((_p, tuple(_n)))
SLOT_INDEX = {s: i for i, s in enumerate(SLOTS)}
SOLVED = tuple(range(54))


def slot_colour(i):
    return COLOUR_OF_FACE[FACE_OF_NORMAL[SLOTS[i][1]]]


def slot(pos, normal):
    return SLOT_INDEX[(tuple(pos), tuple(normal))]


@lru_cache(maxsize=None)
def _perm(token):
    axis, side, layers = MOVES[token[0]]
    turns = 2 if token.endswith("2") else 3 if token.endswith("'") else 1
    perm = list(range(54))
    for _ in range(turns):
        nxt = perm[:]
        for j, (p, n) in enumerate(SLOTS):
            if p[axis] * 1 in layers:
                k = SLOT_INDEX[(_rotate(p, axis, side), _rotate(n, axis, side))]
                nxt[k] = perm[j]
        perm = nxt
    return tuple(perm)


def parse(alg):
    tokens = alg.replace("(", " ").replace(")", " ").split()
    for t in tokens:
        if t[0] not in MOVES or t[1:] not in ("", "'", "2", "2'"):
            raise ValueError(f"Unknown move {t!r} in {alg!r}")
    return [t.replace("2'", "2") for t in tokens]


def apply(state, alg):
    for t in parse(alg) if isinstance(alg, str) else alg:
        p = _perm(t)
        state = tuple(state[i] for i in p)
    return state


def invert(alg):
    out = []
    for t in reversed(parse(alg)):
        out.append(t if t.endswith("2") else t[:-1] if t.endswith("'") else t + "'")
    return " ".join(out)


MIRROR_FACE = {"R": "L", "L": "R", "r": "l", "l": "r"}


def mirror(alg):
    """Left-right mirror image of `alg`: R becomes L', U becomes U', and so on."""
    out = []
    for t in parse(alg):
        face = MIRROR_FACE.get(t[0], t[0])
        if t[0] in "xM":  # turns about the left-right axis keep their direction
            out.append(face + t[1:])
        else:
            out.append(face + ("" if t.endswith("'") else "2" if t.endswith("2") else "'"))
    return " ".join(out)


def move_count(alg):
    """Half-turn metric: slice moves count once, cube rotations are free."""
    return sum(1 for t in parse(alg) if t[0] not in "xyz")


def case_state(alg):
    """The state that `alg` solves, as seen while holding the cube to start it."""
    return apply(SOLVED, invert(alg))


def centre_colour(state, face):
    normal = {v: k for k, v in FACE_OF_NORMAL.items()}[face]
    return slot_colour(state[slot(normal, normal)])


def colour_at(state, i):
    return slot_colour(state[i])


def solved_below_top(state):
    """True if everything except the top layer matches its centres."""
    for i, (p, n) in enumerate(SLOTS):
        if p[1] < 1 and colour_at(state, i) != centre_colour(state, FACE_OF_NORMAL[n]):
            return False
    return True


def top_layer_oriented(state):
    top = centre_colour(state, "U")
    return all(colour_at(state, i) == top for i, (p, n) in enumerate(SLOTS) if n == (0, 1, 0))


# ---------------------------------------------------------------- OLL

CORNER_TOP = [(1, 1), (1, 3), (3, 1), (3, 3)]
CORNER_SIDES = [(0, 1), (0, 3), (4, 1), (4, 3), (1, 0), (3, 0), (1, 4), (3, 4)]


def oll_grid(alg, edges_only=False):
    """Top view of the case `alg` solves, as 5 strings of 5 characters.

    Row 0 is the back, row 4 the front. The inner 3x3 is the U face
    ('#' = yellow up, ' ' = not yellow, '?' = ignore). The border holds side
    stickers: '-' on the back/front rows, '|' on the left/right columns.
    """
    state = case_state(alg)
    top = centre_colour(state, "U")
    g = [[" "] * 5 for _ in range(5)]
    for i, ((x, y, z), (nx, ny, nz)) in enumerate(SLOTS):
        if y != 1 or colour_at(state, i) != top:
            continue
        if ny == 1:
            g[z + 2][x + 2] = "#"
        elif nx:
            g[z + 2][4 if nx == 1 else 0] = "|"
        elif nz:
            g[4 if nz == 1 else 0][x + 2] = "-"
    if edges_only:
        for r, c in CORNER_TOP:
            g[r][c] = "?"
        for r, c in CORNER_SIDES:
            g[r][c] = " "
    return ["".join(row) for row in g]


def _rotate_grid(g):
    """Rotate a 5x5 top-view grid 90 degrees (same as an AUF)."""
    rows = [list(r) for r in g]
    n = 5
    out = [[" "] * n for _ in range(n)]
    for r in range(n):
        for c in range(n):
            ch = rows[r][c]
            if ch == "|":
                ch = "-"
            elif ch == "-":
                ch = "|"
            out[c][n - 1 - r] = ch
    return ["".join(r) for r in out]


def oll_class(alg):
    """Same value for every algorithm that solves the same OLL case."""
    g = oll_grid(alg)
    best = []
    for _ in range(4):
        best.append("".join(g))
        g = _rotate_grid(g)
    return min(best)


# ---------------------------------------------------------------- PLL

# Top-layer positions on a 3x3 grid: (row, col) with row 0 at the back.
def _grid_rc(pos):
    x, _, z = pos
    return (z + 1, x + 1)


def pll_diagram(alg, corners_only=False):
    """Side colours around the top face plus arrows showing where pieces go.

    Returns {"sides": {"back": "...", "front": "...", "left": "...", "right": "..."},
             "arrows": [[r1, c1, r2, c2, both_ways], ...]}
    Sides are read left to right as seen from above (back row from the back-left
    corner, left column from the back). Arrows run from a piece's current spot to
    where the algorithm puts it.

    A PLL algorithm may finish with the top layer turned. The diagram shows the
    case for whichever final U turn moves the fewest pieces, as standard
    PLL diagrams do, and `auf` names that turn.

    With `corners_only`, edges are ignored: no edge arrows, and edge side
    stickers are 'x' (grey).
    """
    def piece_moves(state):
        moves = {}
        for i, (p, n) in enumerate(SLOTS):
            if p[1] == 1 and n == (0, 1, 0) and p != (0, 1, 0):
                if corners_only and 0 in (p[0], p[2]):
                    continue
                home = SLOTS[state[i]][0]
                if home != p:
                    moves[_grid_rc(p)] = _grid_rc(home)
        return moves

    def longest_cycle(moves):
        longest = 0
        for start in moves:
            n, cur = 1, moves[start]
            while cur != start:
                n, cur = n + 1, moves[cur]
            longest = max(longest, n)
        return longest

    best = None
    for auf in ("", "U", "U2", "U'"):
        state = case_state(f"{alg} {auf}")
        moves = piece_moves(state)
        rank = (len(moves), longest_cycle(moves))
        if best is None or rank < best[0]:
            best = (rank, auf, state, moves)
    _, auf, state, moves = best
    def side(pos, normal):
        return "x" if corners_only and 0 in (pos[0], pos[2]) else colour_at(state, slot(pos, normal))

    sides = {"back": "", "front": "", "left": "", "right": ""}
    for x in (-1, 0, 1):
        sides["back"] += side((x, 1, -1), (0, 0, -1))
        sides["front"] += side((x, 1, 1), (0, 0, 1))
    for z in (-1, 0, 1):
        sides["left"] += side((-1, 1, z), (-1, 0, 0))
        sides["right"] += side((1, 1, z), (1, 0, 0))
    arrows, seen = [], set()
    for a, b in moves.items():
        if (a, b) in seen:
            continue
        both = moves.get(b) == a
        seen.update({(a, b), (b, a)})
        arrows.append([a[0], a[1], b[0], b[1], both])
    return {"sides": sides, "arrows": arrows, "auf": auf}


def pll_class(alg):
    """Same value for every algorithm that solves the same PLL case, whatever the AUF."""
    state = case_state(alg)
    ring = []
    for t in ("U", "U2", "U'", ""):
        s = apply(state, t) if t else state
        seq = []
        for (x, z, n) in [(-1, -1, (0, 0, -1)), (0, -1, (0, 0, -1)), (1, -1, (0, 0, -1)),
                          (1, -1, (1, 0, 0)), (1, 0, (1, 0, 0)), (1, 1, (1, 0, 0)),
                          (1, 1, (0, 0, 1)), (0, 1, (0, 0, 1)), (-1, 1, (0, 0, 1)),
                          (-1, 1, (-1, 0, 0)), (-1, 0, (-1, 0, 0)), (-1, -1, (-1, 0, 0))]:
            seq.append(colour_at(s, slot((x, 1, z), n)))
        ring.append(seq)
    order = "GRBO"  # side colours in the order a U turn moves them: front, left, back, right
    best = []
    for seq in ring:
        for shift in range(4):
            best.append("".join(order[(order.index(c) + shift) % 4] for c in seq))
    return min(best)


# ---------------------------------------------------------------- F2L (front-right slot)

PAIR_CORNER = (1, -1, 1)
PAIR_EDGE = (1, 0, 1)
PAIR_LABELS = {i for i, (p, n) in enumerate(SLOTS) if p in (PAIR_CORNER, PAIR_EDGE)}


def _middle_edge(p):
    return p[1] == 0 and 0 not in (p[0], p[2])


def f2l_valid(alg, corner_only=False):
    """True if `alg` solves a front-right F2L pair without disturbing the cross or other slots.

    With `corner_only`, `alg` only has to solve the corner (layer-by-layer style),
    and the middle-layer edges can be anywhere before and after.
    """
    state = case_state(alg)
    if state == SOLVED:
        return False
    for i, (p, n) in enumerate(SLOTS):
        if p[1] == 1 or p in (PAIR_CORNER, PAIR_EDGE) or (corner_only and _middle_edge(p)):
            continue
        if state[i] != i:
            return False
    if corner_only:
        done = apply(state, alg)
        return all(done[i] == i for i, (p, n) in enumerate(SLOTS) if p == PAIR_CORNER)
    # the pair must sit in the top layer or its own slot
    for i, (p, n) in enumerate(SLOTS):
        if state[i] in PAIR_LABELS and not (p[1] == 1 or p in (PAIR_CORNER, PAIR_EDGE)):
            return False
    return True


def f2l_class(alg):
    """Same value for every algorithm that solves the same F2L case, whatever the AUF."""
    state = case_state(alg)
    keys = []
    for t in ("", "U", "U2", "U'"):
        s = apply(state, t) if t else state
        keys.append(tuple(sorted((s[i], i) for i in range(54) if s[i] in PAIR_LABELS)))
    return min(keys)


def f2l_faces(alg, corner_only=False):
    """Visible U, F and R faces (3x3 each, rows top to bottom as drawn) for an isometric diagram.

    Pair stickers keep their colour. Centres of F and R keep their colour so the
    slot is easy to find. Other top-layer stickers are 'x', other solved stickers 's'.
    With `corner_only`, the edge and the rest of the middle layer are 'x' too.
    """
    state = case_state(alg)
    out = {}

    def mark(i):
        p, n = SLOTS[i]
        lab = state[i]
        if corner_only and (_middle_edge(p) or SLOTS[lab][0] == PAIR_EDGE):
            return "x"
        if lab in PAIR_LABELS:
            return slot_colour(lab)
        if p == n and FACE_OF_NORMAL[n] in "FRU":
            return slot_colour(lab)
        if SLOTS[lab][0][1] == 1:
            return "x"
        return "s"

    # U face seen from above: row 0 = back (z=-1), col 0 = left (x=-1)
    out["U"] = ["".join(mark(slot((x, 1, z), (0, 1, 0))) for x in (-1, 0, 1)) for z in (-1, 0, 1)]
    # F face seen from the front: row 0 = top (y=1), col 0 = left
    out["F"] = ["".join(mark(slot((x, y, 1), (0, 0, 1))) for x in (-1, 0, 1)) for y in (1, 0, -1)]
    # R face seen from the right: row 0 = top, col 0 = front (z=1)
    out["R"] = ["".join(mark(slot((1, y, z), (1, 0, 0))) for z in (1, 0, -1)) for y in (1, 0, -1)]
    return out
