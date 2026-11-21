# SPDX-License-Identifier: Apache-2.0
#
# Writes images/logo.svg and images/favicon.svg: the CEC-I in low poly, a few flat triangles
# and no lines. Seen from the front and above, a little in perspective: the case's top (its
# raised back, the deck), its front face, the keys' dark well, the arrow keys' panel and the
# nameplate's blue. The favicon is the same drawing. python3 -I tools/make_logo.py

import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "images")

# the case's back edge (narrower, further away) and its front edge, and the front face's foot
BACK_Y, BACK_X0, BACK_X1 = 13.0, 10.0, 54.0
FRONT_Y, FRONT_X0, FRONT_X1 = 45.0, 3.0, 61.0
FOOT_Y, FOOT_INSET = 52.0, 2.0
RAISED_Y = 21.0   # where the raised back meets the deck


def at(y, u):
    """A point on the case's top: y down the page, u 0 (left edge) .. 1 (right edge)."""
    k = (y - BACK_Y) / (FRONT_Y - BACK_Y)
    x0 = BACK_X0 + (FRONT_X0 - BACK_X0) * k
    x1 = BACK_X1 + (FRONT_X1 - BACK_X1) * k
    return (x0 + (x1 - x0) * u, y)


def tri(pts, colour):
    return '<polygon points="%s" fill="%s"/>' % (" ".join("%g,%g" % (round(x, 2), round(y, 2)) for x, y in pts), colour)


def drawing():
    out = []
    # the front face: two facets, the left a little lighter (the light comes from the left)
    fl, fr = at(FRONT_Y, 0), at(FRONT_Y, 1)
    bl, br = (FRONT_X0 + FOOT_INSET, FOOT_Y), (FRONT_X1 - FOOT_INSET, FOOT_Y)
    mid = (32.0, FOOT_Y)
    out += [tri([fl, fr, mid], "#aaa396"), tri([fl, mid, bl], "#b3ac9f"), tri([fr, br, mid], "#9c9588")]
    # the raised back: four facets round its middle, lit from the upper left
    a, b, c, d = at(BACK_Y, 0), at(BACK_Y, 1), at(RAISED_Y, 1), at(RAISED_Y, 0)
    m = at((BACK_Y + RAISED_Y) / 2, 0.42)
    out += [tri([a, b, m], "#e6e1d5"), tri([b, c, m], "#d9d3c6"), tri([c, d, m], "#cfc9bc"), tri([d, a, m], "#e0dbcf")]
    # the raised back's front, sloping down to the deck: a darker strip of two facets
    c2, d2 = at(RAISED_Y + 1.6, 1), at(RAISED_Y + 1.6, 0)
    out += [tri([d, c, d2], "#a9a295"), tri([c, c2, d2], "#9f988b")]
    c, d = c2, d2
    # the deck: four facets round a point left of the middle
    e, g = at(FRONT_Y, 1), at(FRONT_Y, 0)
    n = at(33.0, 0.4)
    out += [tri([d, c, n], "#d3cdc0"), tri([c, e, n], "#c8c2b5"), tri([e, g, n], "#bdb7aa"), tri([g, d, n], "#cdc7ba")]
    # the keys' dark well, in two facets
    k0, k1, k2, k3 = at(26.0, 0.09), at(26.0, 0.70), at(42.2, 0.70), at(42.2, 0.09)
    out += [tri([k0, k1, k3], "#34363a"), tri([k1, k2, k3], "#2a2b2e")]
    # the keys: three rows and the space bar, each two lighter facets: just enough to read as keys
    for y0, y1, u0, u1 in ((27.4, 30.4, 0.12, 0.67), (31.6, 34.6, 0.13, 0.67), (35.8, 38.8, 0.12, 0.66), (39.4, 41.0, 0.24, 0.52)):
        r0, r1, r2, r3 = at(y0, u0), at(y0, u1), at(y1, u1), at(y1, u0)
        out += [tri([r0, r1, r3], "#c6bba9"), tri([r1, r2, r3], "#aea391")]
    # the arrow keys' panel: four triangles round its middle, one per key
    p, q, r, s = at(28.0, 0.78), at(28.0, 0.92), at(39.5, 0.92), at(39.5, 0.78)
    o = ((p[0] + r[0]) / 2, (p[1] + r[1]) / 2)
    out += [tri([p, q, o], "#ece6da"), tri([q, r, o], "#c2bbad"), tri([r, s, o], "#aba496"), tri([s, p, o], "#d6d0c3")]
    # the nameplate's blue, and the red of its maker's mark
    n0, n1, n2, n3 = at(23.6, 0.56), at(23.6, 0.80), at(25.0, 0.80), at(25.0, 0.56)
    out += [tri([n0, n1, n3], "#2c5fc4"), tri([n1, n2, n3], "#244fa6")]
    t0, t1, t2 = at(23.6, 0.83), at(23.6, 0.88), at(25.0, 0.83)
    out += [tri([t0, t1, t2], "#d8392d")]
    return out


def svg(note):
    body = "\n  ".join(drawing())
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
  <!-- {note} Our own drawing, not the machine's or a maker's logo. Written by tools/make_logo.py. -->
  {body}
</svg>
'''


if __name__ == "__main__":
    note = "The simulator's mark: the CEC-I in low poly, a few flat triangles and no lines."
    for name in ("logo", "favicon"):
        with open(os.path.join(OUT, f"{name}.svg"), "w", encoding="utf-8") as f:
            f.write(svg(note))
