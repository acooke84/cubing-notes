"""Minimal 3x3 cube simulator used to generate last-layer diagrams.

Each sticker is tracked as (position, normal, colour) in a coordinate system
where x points Right, y points Up and z points Front. A move rotates every
sticker in the affected layer(s). Yellow is on top (U) and green in front.
"""

# axis index, direction of the face the move is named after, layers it turns
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

FACE_COLOURS = {(0, 1): "R", (0, -1): "O", (1, 1): "Y", (1, -1): "W", (2, 1): "G", (2, -1): "B"}


def _rotate(vec, axis, direction):
    """Rotate vec a quarter turn clockwise, seen from the +axis side (or -axis if direction < 0)."""
    x, y, z = vec
    if axis == 0:
        out = (x, z, -y)
    elif axis == 1:
        out = (-z, y, x)
    else:
        out = (y, -x, z)
    if direction < 0:  # clockwise from the opposite side is the inverse rotation
        out = _rotate(_rotate(out, axis, 1), axis, 1)
    return out


def solved():
    stickers = []
    for x in (-1, 0, 1):
        for y in (-1, 0, 1):
            for z in (-1, 0, 1):
                pos = (x, y, z)
                for axis in range(3):
                    if pos[axis]:
                        normal = [0, 0, 0]
                        normal[axis] = pos[axis]
                        stickers.append([pos, tuple(normal), FACE_COLOURS[(axis, pos[axis])]])
    return stickers


def parse(alg):
    tokens = alg.replace("(", " ").replace(")", " ").split()
    for t in tokens:
        if t.rstrip("'2") not in MOVES:
            raise ValueError(f"Unknown move {t!r} in {alg!r}")
    return tokens


def apply(stickers, alg):
    for token in parse(alg):
        axis, direction, layers = MOVES[token[0]]
        turns = 2 if token.endswith("2") else 3 if token.endswith("'") else 1
        for _ in range(turns):
            for s in stickers:
                if s[0][axis] in layers:
                    s[0] = _rotate(s[0], axis, direction)
                    s[1] = _rotate(s[1], axis, direction)
    return stickers


def invert(alg):
    out = []
    for t in reversed(parse(alg)):
        if t.endswith("2"):
            out.append(t)
        elif t.endswith("'"):
            out.append(t[:-1])
        else:
            out.append(t + "'")
    return " ".join(out)


def move_count(alg):
    """Half-turn metric, counting slice moves as one and ignoring rotations."""
    return sum(1 for t in parse(alg) if t[0] not in "xyz")


CORNER_TOP = [(1, 1), (1, 3), (3, 1), (3, 3)]
CORNER_SIDES = [(0, 1), (0, 3), (4, 1), (4, 3), (1, 0), (3, 0), (1, 4), (3, 4)]


def oll_grid(alg, edges_only=False):
    """Top view of the case `alg` solves, as 5 strings of 5 characters.

    Row 0 is the back, row 4 the front. The inner 3x3 is the U face
    ('#' = yellow up, ' ' = not yellow, '?' = ignore). The border holds side
    stickers: '-' on the back/front rows, '|' on the left/right columns.
    """
    state = apply(solved(), invert(alg))
    g = [[" "] * 5 for _ in range(5)]
    for (x, y, z), (nx, ny, nz), colour in state:
        if colour != "Y" or y != 1:
            continue
        if ny == 1:
            g[z + 2][x + 2] = "#"
        elif nx == 1:
            g[z + 2][4] = "|"
        elif nx == -1:
            g[z + 2][0] = "|"
        elif nz == 1:
            g[4][x + 2] = "-"
        elif nz == -1:
            g[0][x + 2] = "-"
    if edges_only:
        for r, c in CORNER_TOP:
            g[r][c] = "?"
        for r, c in CORNER_SIDES:
            g[r][c] = " "
    return ["".join(row) for row in g]
