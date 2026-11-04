"""Find short, finger-friendly algorithms for every front-right F2L case.

Usage:  python3 tools/find_f2l.py [max_len]

Enumerates all 41 F2L cases (corner and edge in the top layer or their own
slot), then runs a meet-in-the-middle search over <R, U, F> moves. The top-layer
pieces that don't belong to the pair are treated as interchangeable, so the goal
is a single state. Prints the best few algorithms per case, ranked by a rough
ergonomics score. Used to fill in and check data/f2l.json.
"""
import sys
import pathlib
from collections import deque

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import cube  # noqa: E402

JUNK = 255
MOVESET = [f + s for f in "RUF" for s in ("", "'", "2")]
PERMS = {m: cube._perm(m) for m in MOVESET}
INVERSE = {m: (m if m.endswith("2") else m[:-1] if m.endswith("'") else m + "'") for m in MOVESET}
TOP = {i for i, (p, n) in enumerate(cube.SLOTS) if p[1] == 1}
PAIR_SLOTS = {i for i, (p, n) in enumerate(cube.SLOTS) if p in (cube.PAIR_CORNER, cube.PAIR_EDGE)}


def step(state, m):
    p = PERMS[m]
    return bytes(state[i] for i in p)


def reduce(state):
    """Hide the identity of top-layer pieces (they're free to end up anywhere)."""
    return bytes(JUNK if l in TOP else l for l in state)


GOAL = reduce(cube.SOLVED)


def enumerate_cases():
    """All F2L cases, one representative per AUF class."""
    pair_only = bytes(l if l in cube.PAIR_LABELS else JUNK for l in cube.SOLVED)
    faces = [f + s for f in "RLUDFB" for s in ("", "'", "2")]
    perms = {m: cube._perm(m) for m in faces}
    seen = {pair_only}
    q = deque([pair_only])
    while q:
        s = q.popleft()
        for m in faces:
            t = bytes(s[i] for i in perms[m])
            if t not in seen:
                seen.add(t)
                q.append(t)
    cases = {}
    for s in seen:
        where = [i for i in range(54) if s[i] != JUNK]
        if not all(i in TOP or i in PAIR_SLOTS for i in where):
            continue
        full = bytes(s[i] if s[i] != JUNK else (i if i not in TOP and i not in PAIR_SLOTS else JUNK) for i in range(54))
        if full == GOAL:
            continue
        key = min(tuple(sorted((v[i], i) for i in range(54) if v[i] in cube.PAIR_LABELS))
                  for v in (full, step(full, "U"), step(full, "U2"), step(full, "U'")))
        cases.setdefault(key, full)
    return cases


def build_table(depth):
    """mid-state -> list of move sequences that finish the solve from it."""
    table = {GOAL: [()]}
    frontier = [(GOAL, ())]
    for _ in range(depth):
        nxt = []
        for s, seq in frontier:
            last = seq[0][0] if seq else None
            for m in MOVESET:
                if m[0] == last:
                    continue
                t = step(s, m)
                cont = (INVERSE[m],) + seq
                lst = table.setdefault(t, [])
                if len(lst) < 40:
                    lst.append(cont)
                nxt.append((t, cont))
        frontier = nxt
    return table


def score(seq):
    cost = 0.0
    for m in seq:
        cost += {"R": 1.0, "U": 1.0, "F": 1.7}[m[0]] + (0.25 if m.endswith("2") else 0)
    return cost


def search(start, table, depth):
    sols = []

    def dfs(s, seq):
        if s in table:
            for cont in table[s]:
                if not cont or not seq or cont[0][0] != seq[-1][0]:
                    sols.append(tuple(seq) + cont)
        if len(seq) == depth:
            return
        last = seq[-1][0] if seq else None
        for m in MOVESET:
            if m[0] != last:
                seq.append(m)
                dfs(step(s, m), seq)
                seq.pop()

    dfs(start, [])
    return sols


if __name__ == "__main__":
    max_len = int(sys.argv[1]) if len(sys.argv) > 1 else 11
    back = max_len // 2
    table = build_table(back)
    cases = enumerate_cases()
    print(f"{len(cases)} cases")
    for key, start in sorted(cases.items()):
        sols = search(start, table, max_len - back)
        sols = sorted(set(sols), key=lambda s: (score(s), len(s)))
        print(key)
        for s in sols[:4]:
            print("   ", " ".join(s), f"[{score(s):.1f}]")
