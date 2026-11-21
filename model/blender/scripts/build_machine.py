"""The CEC-I (中华学习机), built from its parameters (model/params/machine.json).

  Blender --background --factory-startup --python-exit-code 1 --python build_machine.py -- [--out PATH]

Builds, in the machine frame (mm; origin at the centre of the footprint on the table, +X right,
+Y back, +Z up; model/params/machine.json), under the empty `cec-i`:
  case.base            the base tray: back, sides, floor, with every opening and label     (static)
    case.feet            the four feet
    switch.power         the rocker switch on the left side                               (rotate)
  case.lid             the one-piece lid: deck, raised part, grille, openings               (path)
    case.nameplate       CEC—I / 中华学习机, on the deck
    case.flap            the slot cover, hinged at its front edge                         (rotate)
  keyboard             the keyboard assembly on its steel plate                            (path)
    keyboard.plate, board.keyboard, keyboard.switches
    key.<id>             the 69 keycaps (model/params/keyboard.json)                           (translate)
    led.power            the power lamp, under the lid's small square hole                 (light)
  board.main           the mainboard ZH-1(875) with its parts                              (path)
    part.<ref>           the parts the page names (U1, U4, U15, U33, U34, U35, U32, ...)
  psu                  the power supply: shield box, its board, the transformer
  speaker              the speaker, loose on the floor
  cable.ribbon         the keyboard's 26-way flat cable to J9
  cable.power          the power supply's five wires to the mainboard
  cable.speaker        the speaker's two wires to J8
  cable.mains          the mains cable out of the back
  tv                   a colour TV of the 1980s behind the computer (generic)
    tv.power, tv.lamp    its power button and lamp
    tv.knob.brightness, tv.knob.colour   its two knobs (turn about glTF z)
    tv.screen            the tube's glass, UV-mapped 0..1: the page draws the picture on it
Writes model/cec-i.glb (pnpm build:model).
"""

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from lib import bl, params, shapes  # noqa: E402
from lib.bl import MeshBuilder  # noqa: E402
from lib.shapes import boolean, box_obj, prism_obj, rounded_rect  # noqa: E402

DEFAULT_OUT = os.path.join(params.MACHINE_DIR, "cec-i.glb")


def load_json(name):
    with open(os.path.join(params.MACHINE_DIR, "params", name), encoding="utf-8") as f:
        return json.load(f)


def V(d):
    return d["v"]


# --- geometry helpers --------------------------------------------------------------------

def fillet_polygon(corners, radii, step_deg=7.5):
    """A closed polygon [(u, w)] with each corner rounded by a tangent arc of its radius."""
    out = []
    n = len(corners)
    for i, (p, r) in enumerate(zip(corners, radii)):
        a, b = corners[i - 1], corners[(i + 1) % n]
        u1 = (a[0] - p[0], a[1] - p[1]); l1 = math.hypot(*u1); u1 = (u1[0] / l1, u1[1] / l1)
        u2 = (b[0] - p[0], b[1] - p[1]); l2 = math.hypot(*u2); u2 = (u2[0] / l2, u2[1] / l2)
        th = math.acos(max(-1.0, min(1.0, u1[0] * u2[0] + u1[1] * u2[1])))
        if r <= 0 or th > math.pi - 1e-6:
            out.append(p)
            continue
        t = r / math.tan(th / 2)
        bis = (u1[0] + u2[0], u1[1] + u2[1]); lb = math.hypot(*bis); bis = (bis[0] / lb, bis[1] / lb)
        cdist = r / math.sin(th / 2)
        cx, cy = p[0] + bis[0] * cdist, p[1] + bis[1] * cdist
        t1 = (p[0] + u1[0] * t, p[1] + u1[1] * t)
        t2 = (p[0] + u2[0] * t, p[1] + u2[1] * t)
        a1 = math.atan2(t1[1] - cy, t1[0] - cx)
        a2 = math.atan2(t2[1] - cy, t2[0] - cx)
        da = (a2 - a1 + math.pi) % (2 * math.pi) - math.pi
        k = max(2, int(abs(math.degrees(da)) / step_deg) + 1)
        for j in range(k + 1):
            ang = a1 + da * j / k
            out.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    return out


def offset_polygon(pts, d):
    """Offset a closed polygon by d, mitred (inward for a counter-clockwise outline if d < 0)."""
    n = len(pts)
    out = []
    for i in range(n):
        p, a, b = pts[i], pts[i - 1], pts[(i + 1) % n]
        e1 = (p[0] - a[0], p[1] - a[1]); l1 = math.hypot(*e1) or 1.0
        e2 = (b[0] - p[0], b[1] - p[1]); l2 = math.hypot(*e2) or 1.0
        n1 = (e1[1] / l1, -e1[0] / l1)
        n2 = (e2[1] / l2, -e2[0] / l2)
        m = (n1[0] + n2[0], n1[1] + n2[1])
        k = 1.0 + n1[0] * n2[0] + n1[1] * n2[1]
        out.append((p[0] + d * m[0] / k, p[1] + d * m[1] / k))
    return out


def offset_chain(pts, d):
    """Offset an open polyline by d to its right (walking along it), mitred at the corners:
    for a profile drawn front to back over the top, that is into the part."""
    n = len(pts)
    out = []
    for i in range(n):
        p = pts[i]
        normals = []
        for a, b in ((pts[i - 1], p) if i > 0 else (None, None), (p, pts[i + 1]) if i < n - 1 else (None, None)):
            if a is None:
                continue
            ex, ey = b[0] - a[0], b[1] - a[1]
            L = math.hypot(ex, ey) or 1.0
            normals.append((ey / L, -ex / L))
        if len(normals) == 1:
            nx, ny = normals[0]
            out.append((p[0] + nx * d, p[1] + ny * d))
        else:
            (ax, ay), (bx, by) = normals
            m = (ax + bx, ay + by)
            k = 1.0 + ax * bx + ay * by
            out.append((p[0] + d * m[0] / k, p[1] + d * m[1] / k))
    return out


def polyline_length(pts):
    return sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1))


def arc_at(pts, q):
    """The distance along an open polyline to its vertex nearest the point q."""
    best, acc, at = None, 0.0, 0.0
    for i, p in enumerate(pts):
        if i:
            acc += math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])
        d = math.hypot(p[0] - q[0], p[1] - q[1])
        if best is None or d < best:
            best, at = d, acc
    return at


def sub_chain(pts, a0, a1):
    """The part of an open polyline between the distances a0 and a1 along it."""
    out, acc = [], 0.0
    for i in range(len(pts) - 1):
        p, q = pts[i], pts[i + 1]
        L = math.hypot(q[0] - p[0], q[1] - p[1])
        for a in (a0, a1):
            if acc <= a <= acc + L and L > 0:
                t = (a - acc) / L
                out.append((a, (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)))
        if a0 < acc + L and acc + L < a1:
            out.append((acc + L, q))
        acc += L
    out.sort(key=lambda e: e[0])
    res = []
    for _, pt in out:                      # no repeated points (a boolean's cutter must be clean)
        if not res or math.hypot(pt[0] - res[-1][0], pt[1] - res[-1][1]) > 0.05:
            res.append(pt)
    return res


def _area(poly):
    return 0.5 * sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))


def bevelled_solid(name, closed, m, half, b, mat, col):
    """A side profile [(Y, Z)] extruded across X from -half to +half, with a 45-degree bevel of
    b on the edges where its first m points (an open chain: the outer surface) meet the two
    side faces. The other edges (the seam's) stay square. In plan, the bevel at a face that
    runs up and down (the front, the back, an end face) shows as a small 45-degree corner;
    seen from the side, it follows every curve of the profile."""
    chain, rest = closed[:m], closed[m:]
    a = offset_chain(chain, b)
    c = offset_chain(chain, -b)
    inset = a if abs(_area(a + rest)) < abs(_area(c + rest)) else c   # inward is the side that shrinks it
    rings = [inset + rest, list(closed), list(closed), inset + rest]
    xs = [-half, -half + b, half - b, half]
    n = len(closed)
    verts = [(x, y, z) for x, ring in zip(xs, rings) for (y, z) in ring]
    faces = []
    for k in range(3):
        for i in range(n):
            j = (i + 1) % n
            faces.append((k * n + i, k * n + j, (k + 1) * n + j, (k + 1) * n + i))
    faces.append(tuple(reversed(range(n))))
    faces.append(tuple(range(3 * n, 4 * n)))
    # outward normals whatever the profile's turn: (x, y, z) with the ring in (y, z) at rising x
    if _area(closed) < 0:
        faces = [tuple(reversed(f)) for f in faces]
    mb = MeshBuilder()
    mb.add_mesh_data(verts, faces, Matrix.Identity(4), mat)
    return mb.build(name, col)


def cyl(mb, cx, cy, cz, r, axis, length, mat, n=16):
    """A cylinder of radius r centred at (cx, cy, cz) along axis 'X', 'Y' or 'Z'."""
    circle = [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n)) for i in range(n)]
    if axis == "Z":
        mb.prism([(cx + u, cy + w) for u, w in circle], "XY", cz - length / 2, cz + length / 2, mat)
    elif axis == "X":
        mb.prism([(cy + u, cz + w) for u, w in circle], "YZ", cx - length / 2, cx + length / 2, mat)
    else:
        mb.prism([(cx + u, cz + w) for u, w in circle], "XZ", cy - length / 2, cy + length / 2, mat)


def box(mb, x0, y0, z0, x1, y1, z1, mat, r=0.0):
    poly = rounded_rect(x0, y0, x1, y1, r, 2) if r > 0 else [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    mb.prism(poly, "XY", z0, z1, mat)


def text(mb, s, size, m, mat, font=None, align="CENTER", bold=0.0, max_w=None):
    """Flat lettering, facing local +Z of matrix m (mm)."""
    v, f = bl.glyph_mesh_flat(s, size, align=align, bold_mm=bold, font=font, max_width_mm=max_w)
    if v:
        mb.add_mesh_data(v, f, m, mat)


def facing(origin, normal_axis):
    """A matrix placing flat (XY, +Z up) artwork on a face: 'back' (+Y), 'left' (-X), 'right' (+X)."""
    ox, oy, oz = origin
    if normal_axis == "back":      # seen from behind: text runs toward -X
        return bl.frame_matrix((ox, oy, oz), (-1, 0, 0), (0, 0, 1))
    if normal_axis == "left":      # seen from the left: text runs toward -Y
        return bl.frame_matrix((ox, oy, oz), (0, -1, 0), (0, 0, 1))
    if normal_axis == "right":     # seen from the right: text runs toward +Y
        return bl.frame_matrix((ox, oy, oz), (0, 1, 0), (0, 0, 1))
    raise ValueError(normal_axis)


def label(obj, en, zh):
    bl.set_labels(obj, en)
    obj["label_zh"] = zh


# --- the case ----------------------------------------------------------------------------

class Case:
    def __init__(self, p):
        c = p.raw["case"]
        self.W2 = V(c["width"]) / 2
        self.D = V(c["depth"])
        self.Y0 = -self.D / 2
        self.wall = V(c["wall"])
        self.seam = V(c["seam_z"])
        self.over = V(c["front_overhang"])           # the base's top front edge, behind the lid's
        bf = p.raw["base"]["front"]
        self.base_foot = self.D - V(bf["bottom_depth"])   # the base's front wall's foot (yf): it leans back as it rises
        self.wall_top = V(bf["wall_top_yf"])               # ... to here, under the lid's overhang
        self.base_lip_t = V(bf["lip_thickness"])           # then a thin lip runs forward to self.over
        self.lid_lean = math.tan(math.radians(V(c["lid_front_lean"])))
        self.lip = V(c["lip_thickness"])
        d = c["deck"]
        self.zf, self.zb, self.yb = V(d["front_z"]), V(d["back_z"]), V(d["back_yf"])
        self.r_front = V(d["front_radius"])
        rp = c["raised_part"]
        self.rp = rp
        self.corner = V(c["plan_corner_radius"])
        self.Wb2 = self.W2 - V(c["side_overhang"])     # the base and the raised part: narrower
        self.bottom = V(p.raw["base"]["bottom_z"])
        self.lid_top_y = self.lip * self.lid_lean      # where the lid's leaning front face meets the deck's rounding

    def Y(self, yf):
        return self.Y0 + yf

    def deck_z(self, yf):
        return self.zf + (self.zb - self.zf) * yf / self.yb

    def base_edge(self, yf):
        """The lid's lower edge (the seam) at yf: one straight line from the front lip's foot
        (12 mm under the deck's front edge) up to the keyboard part's back wall, then level
        along the raised part to the back."""
        z0 = self.zf - self.lip
        return z0 + (self.seam - z0) * min(1.0, yf / self.yb)

    def lid_profile(self):
        """The lid's outer side profile [(Y, Z)], closed along the seam, and the open chain of
        its outer surface (front face, deck, raised part, back face), front to back."""
        rp = self.rp
        ty, tz = V(rp["top"])
        wt, (w1, w2), (l1, l2) = self.junction()
        Y = self.Y
        top = [
            ((Y(0), self.zf - self.lip), 0.0),
            ((Y(self.lid_top_y), self.zf), self.r_front),     # the front face leans back as it rises
            # corners sharper than the edge bevel stay sharp (a rounding smaller than the
            # bevel would fold the bevel's inner edge over itself)
            ((Y(wt[0]), wt[1]), 0.0),              # the deck's back edge, on top of the leaning wall
            ((Y(w1), w2), 0.0),                    # down the wall to the ledge
            ((Y(l1), l2), 0.0),                    # back along the ledge to the slope's foot
            ((Y(ty), tz), 0.0),
            # the back: a slope of about 59 degrees from the top down to a plumb back face
            ((Y(self.D) - (tz - V(rp["back_slope"])[0]) / math.tan(math.radians(V(rp["back_slope"])[1])), tz), V(rp["back_round"])),
            ((Y(self.D), V(rp["back_slope"])[0]), 2.0),
            ((Y(self.D), self.seam), 0.0),
        ]
        yk = self.yb   # where the seam turns level: at the keyboard part's back wall
        bottom = [((Y(yk), self.seam), 0.0), ((Y(self.over), self.base_edge(self.over)), 0.0), ((Y(self.over), self.zf - self.lip), 0.0)]
        pts = [q for q, _ in top + bottom]
        rad = [r for _, r in top + bottom]
        closed = fillet_polygon(pts, rad, 6.0)
        # the chain: everything up to the back face's foot
        chain = fillet_polygon(pts, rad, 6.0)
        end = max(i for i, q in enumerate(chain) if abs(q[0] - Y(self.D)) < 1e-6 and abs(q[1] - self.seam) < 1e-6)
        # the inside: the outer surface offset by the wall (mitred), its corners rounded less,
        # closed well below the seam
        simple = list(top)
        ic = offset_chain([q for q, _ in simple], self.wall)
        ir = [max(0.0, r - self.wall) for _, r in simple]
        ic = ic + [(ic[-1][0], 10.0), (ic[0][0], 10.0)]
        ir = ir + [0.0, 0.0]
        inner = fillet_polygon(ic, ir, 6.0)
        return closed, chain[:end + 1], inner

    def junction(self):
        """Where the keyboard part meets the raised part: the keyboard
        part's back wall leans forward as it rises (its foot at deck.back_yf, on the band's
        lower edge); the deck ends on top of it; a ledge leaves the wall a little way down and
        runs back, rising with the deck, to the foot of the raised part's slope. Returns the
        wall's top (yf, z), the ledge's front (yf, z), and its back (yf, z)."""
        rp = self.rp
        lean = math.tan(math.radians(V(rp["wall_lean"])))
        foot_z = self.base_edge(self.yb)
        slope = (self.zb - self.zf) / self.yb
        # the wall's top: on the deck's line and on the leaning wall
        yt = self.yb - (self.deck_z(self.yb) - foot_z) * lean / (1 + slope * lean)
        zt = self.deck_z(yt)
        drop, back = V(rp["ledge"])
        y1, z1 = yt + drop * lean, zt - drop
        y2 = self.yb + back
        return (yt, zt), (y1, z1), (y2, z1 + (y2 - y1) * slope)

    def deck_profile(self):
        """The keyboard part of the lid, wider than the rest: its side profile (front face,
        deck, its end face down to the band's lower edge, along the band forward), closed,
        and its inside (the deck's underside, offset by the wall, closed well below)."""
        Y = self.Y
        yk = self.yb
        wt = self.junction()[0]
        top = [((Y(0), self.zf - self.lip), 0.0), ((Y(self.lid_top_y), self.zf), self.r_front), ((Y(wt[0]), wt[1]), 0.0)]
        rest = [((Y(self.yb), self.base_edge(self.yb)), 0.0)]   # the wall's foot; the lower edge runs straight on to the front
        _ = yk
        closed = fillet_polygon([q for q, _ in top + rest], [r for _, r in top + rest], 6.0)
        foot = (Y(self.yb), self.base_edge(self.yb))
        m = 1 + max(i for i, q in enumerate(closed) if abs(q[0] - foot[0]) < 1e-6 and abs(q[1] - foot[1]) < 1e-6)
        # the inside follows the outside at the wall's thickness, the leaning back wall too
        # (a plumb inner face would cut through the wall's top)
        ic = offset_chain([q for q, _ in top] + [foot], self.wall)
        ic = ic + [(ic[-1][0], 10.0), (ic[0][0], 10.0)]
        inner = fillet_polygon(ic, [0.0, max(0.0, self.r_front - self.wall), 0.0, 0.0, 0.0, 0.0], 6.0)
        return closed, inner, m


def build_lid(p, case, col, root):
    c = case
    W2, Wb2, wall = c.W2, c.Wb2, c.wall
    closed, chain, inner = c.lid_profile()
    # the raised part (and the deck under the keyboard part): as wide as the base
    bev = V(p.raw["case"]["edge_bevel"])
    lid = bevelled_solid("case.lid", closed, len(chain), Wb2, bev, "case_plastic", col)
    # the keyboard part: the full width, standing out past the base on each side, with its
    # own small end faces in front of the raised part
    dclosed, dinner, dm = c.deck_profile()
    deck = bevelled_solid("_deck", dclosed, dm, W2, bev, "case_plastic", col)
    boolean(lid, deck, "UNION")
    boolean(lid, prism_obj("_in", inner, "YZ", -Wb2 + wall, Wb2 - wall, "case_plastic", col))
    boolean(lid, prism_obj("_din", dinner, "YZ", -W2 + wall, W2 - wall, "case_plastic", col))
    lo = p.raw["lid_openings"]
    Y = c.Y
    # the openings in the deck, cut straight down
    k = lo["keys"]
    (x0, x1), (f0, f1) = V(k["x"]), V(k["yf"])
    (n0, n1), nf = V(k["notch_x"]), V(k["notch_front_yf"])
    keys_poly = [(x0, Y(f0)), (n0, Y(f0)), (n0, Y(nf)), (n1, Y(nf)), (n1, Y(f0)), (x1, Y(f0)), (x1, Y(f1)), (x0, Y(f1))]
    cut = MeshBuilder()
    cut.prism(keys_poly, "XY", 20, 110, "case_plastic")
    for name in ("quit", "fkeys"):
        (a0, a1), (b0, b1) = V(lo[name]["x"]), V(lo[name]["yf"])
        cut.prism(rounded_rect(a0, Y(b0), a1, Y(b1), 0.8, 2), "XY", 20, 110, "case_plastic")
    ap = lo["arrow_panel"]
    lx, ly = V(lo["led"]["centre"])
    ls = V(lo["led"]["size"]) / 2
    cut.prism([(lx - ls, Y(ly) - ls), (lx + ls, Y(ly) - ls), (lx + ls, Y(ly) + ls), (lx - ls, Y(ly) + ls)], "XY", 20, 110, "case_plastic")
    boolean(lid, cut.build("_cuts", col))
    build_slot_opening(p, case, col, lid)
    # the grille: a row of grooves sunk into the raised part's surface,
    # following it from its front slope over the top and down the back slope, ribs standing
    # between them; along each groove's floor a thin slit through the wall, in three lengths
    gr = lo["grille"]
    gx0 = -Wb2 + V(gr["from_side"])
    n = int(V(gr["count"]))
    gw = V(gr["groove"])
    pitch = (V(gr["width"]) - gw) / (n - 1)
    front_foot = (Y(c.junction()[2][0]), c.junction()[2][1])
    back_foot = (Y(c.D), V(c.rp["back_slope"])[0])
    a_f, a_b = arc_at(chain, front_foot), arc_at(chain, back_foot)
    run = sub_chain(chain, a_f + V(gr["front_margin"]), a_b - V(gr["back_margin"]))
    depth = V(gr["depth"])
    g = MeshBuilder()
    band = shapes.offset_polyline(run, -1.5) + list(reversed(shapes.offset_polyline(run, depth)))
    for i_ in range(n):
        x = gx0 + gw / 2 + i_ * pitch
        g.prism(band, "YZ", x - gw / 2, x + gw / 2, "case_plastic")
    boolean(lid, g.build("_grooves", col))
    L = polyline_length(run)
    sl = MeshBuilder()
    sw_ = V(gr["slit"])
    for f0, f1 in V(gr["slits"]):
        seg = sub_chain(run, f0 * L, f1 * L)
        sband = shapes.offset_polyline(seg, -1.5) + list(reversed(shapes.offset_polyline(seg, wall + 1.5)))
        for i_ in range(n):
            x = gx0 + gw / 2 + i_ * pitch
            sl.prism(sband, "YZ", x - sw_ / 2, x + sw_ / 2, "case_plastic")
    boolean(lid, sl.build("_slits", col), tolerant=True)
    shapes.shade_auto(lid, 35)
    label(lid, "The lid: one moulding, the keyboard's surround and the raised part behind it (the speaker grille, the slot cover)",
          "上盖：一体注塑，键盘四周的面板和后部的凸起部分（喇叭格栅、扩充槽盖）")
    bl.parent(lid, root)
    # the arrow keys' panel: a pocket sunk 1.5 mm into the deck, square to
    # its slope, cut from the lid itself (no separate part, so no slits round it), and the
    # octagon through its floor
    ah = lo["arrow_hole"]
    acx, acy = V(ah["centre"])
    s_, cc = V(ah["size"]) / 2, V(ah["corner_cut"])
    (a0, a1), (b0, b1) = V(ap["x"]), V(ap["yf"])
    dep = V(ap["depth"])
    th = math.atan((c.zb - c.zf) / c.yb)
    ymid = (Y(b0) + Y(b1)) / 2
    zmid = c.deck_z((b0 + b1) / 2)
    m = Matrix.Translation((0, ymid, zmid)) @ Matrix.Rotation(th, 4, "X")
    hd = (Y(b1) - Y(b0)) / 2 / math.cos(th)            # the pocket's half depth along the slope
    pk = MeshBuilder()
    pk.prism(rounded_rect(a0, -hd, a1, hd, 1.0, 3), "XY", -dep, 10.0, "case_plastic")
    v_, f_ = bl.mesh_data(pk.build("_pk", col))
    bpy.data.objects.remove(bpy.data.objects["_pk"])
    pm = MeshBuilder()
    pm.add_mesh_data(v_, f_, m, "case_plastic")
    boolean(lid, pm.build("_pocket", col))
    oct_ = [(acx - s_ + cc, Y(acy) - s_), (acx + s_ - cc, Y(acy) - s_), (acx + s_, Y(acy) - s_ + cc), (acx + s_, Y(acy) + s_ - cc),
            (acx + s_ - cc, Y(acy) + s_), (acx - s_ + cc, Y(acy) + s_), (acx - s_, Y(acy) + s_ - cc), (acx - s_, Y(acy) - s_ + cc)]
    boolean(lid, prism_obj("_oct", oct_, "XY", 20, 110, "case_plastic", col))
    shapes.shade_auto(lid, 35)
    build_nameplate(p, case, col, lid)
    build_flap(p, case, col, lid)
    return lid


def build_nameplate(p, case, col, lid):
    """The nameplate on the deck: its artwork (model/assets/stickers/nameplate.svg,
    28), laid flat on the sloping deck."""
    c = case
    np_ = p.raw["lid_openings"]["nameplate"]
    (x0, x1), (f0, f1) = V(np_["x"]), V(np_["yf"])
    W, H = x1 - x0, f1 - f0
    th = math.atan((c.zb - c.zf) / c.yb)
    ym = (f0 + f1) / 2
    base = Matrix.Translation(((x0 + x1) / 2, c.Y(ym), c.deck_z(ym) + 0.05)) @ Matrix.Rotation(th, 4, "X")
    mb = MeshBuilder()
    bl.add_sticker(mb, os.path.join(bl.STICKERS, "nameplate.svg"), W, H / math.cos(th), base)
    o = mb.build("case.nameplate", col)
    label(o, "The nameplate: CEC—I, 中华学习机 (China Educational Computer), and the Kaige logo of Shanghai No. 4 Radio Factory",
          "铭牌：CEC—I，中华学习机，上海无线电四厂的凯歌商标")
    bl.parent(o, lid)


def slot_rects(p, case):
    """The expansion slot's opening in the raised part's top: the outer
    rectangle on the surface and the inner one at the foot of its bevel, (x0, Y0, x1, Y1) each,
    and the top's height."""
    c = case
    so = p.raw["lid_openings"]["slot"]
    ow, od = V(so["outer"])
    iw, idp = V(so["inner"])
    x1 = c.Wb2 - V(so["from_right"])
    y0 = c.Y(V(c.rp["top"])[0] + V(so["from_top_front"]))
    outer = (x1 - ow, y0, x1, y0 + od)
    mx, my = (ow - iw) / 2, (od - idp) / 2
    inner = (outer[0] + mx, y0 + my, x1 - mx, y0 + od - my)
    return outer, inner, V(c.rp["top"])[1]


def build_slot_opening(p, case, col, lid):
    """The opening: its four edges bevelled inward and down to the inner rectangle; under it,
    walls on the left, right and back guard the card; the front stays open for the flap."""
    so = p.raw["lid_openings"]["slot"]
    (ox0, oy0, ox1, oy1), (ix0, iy0, ix1, iy1), tz = slot_rects(p, case)
    bd = V(so["bevel_depth"])
    t = V(so["wall"])
    # a collar under the top, thick enough to carry the bevel
    boolean(lid, box_obj("_collar", ox0 - t, oy0 - t, tz - bd - t, ox1 + t, oy1 + t, tz - 0.5, "case_plastic", col), "UNION")
    # the bevel: a frustum from the outer rectangle at the surface to the inner one below
    fr = MeshBuilder()
    fr.hexa([(ix0, iy0, tz - bd), (ix1, iy0, tz - bd), (ix1, iy1, tz - bd), (ix0, iy1, tz - bd)],
            [(ox0, oy0, tz), (ox1, oy0, tz), (ox1, oy1, tz), (ox0, oy1, tz)], "case_plastic")
    fr.prism([(ox0, oy0), (ox1, oy0), (ox1, oy1), (ox0, oy1)], "XY", tz - 0.01, tz + 5, "case_plastic")
    boolean(lid, fr.build("_bevel", col), tolerant=True)        # (its two pieces overlap a little)
    boolean(lid, box_obj("_through", ix0, iy0, tz - bd - t - 5, ix1, iy1, tz - bd + 0.01, "case_plastic", col))
    # the card guard: three walls down from the inner rectangle
    gd = V(so["guard_depth"])
    g = MeshBuilder()
    for x0, y0, x1, y1 in ((ix0 - t, iy0, ix0, iy1 + t), (ix1, iy0, ix1 + t, iy1 + t), (ix0 - t, iy1, ix1 + t, iy1 + t)):
        box(g, x0, y0, tz - bd - gd, x1, y1, tz - bd - t + 0.01, "case_plastic")
    go = g.build("case.slot_guard", col)
    label(go, "The card guard: walls on three sides under the expansion slot's opening, around a card in the slot J1",
          "扩充卡护板：扩充槽开口下三面的护壁，护住插在 J1 里的卡")
    bl.parent(go, lid)


def build_flap(p, case, col, lid):
    """The flap: in the inner rectangle, on three hinges along its front edge; pushed, it
    swings down and forward into the case, where there is no wall."""
    so = p.raw["lid_openings"]["slot"]
    _, (ix0, iy0, ix1, iy1), tz = slot_rects(p, case)
    bd = V(so["bevel_depth"])
    ft = V(so["flap_thickness"])
    g = 0.3
    mb = MeshBuilder()
    mb.prism(rounded_rect(ix0 + g, 0.0, ix1 - g, (iy1 - iy0) - g, 0.6, 2), "XY", -ft, 0.0, "flap_grey")
    for f in V(so["hinges"]):
        x = ix0 + (ix1 - ix0) * f
        cyl(mb, x, 0.0, -ft / 2, ft / 2 + 0.4, "X", 6.0, "flap_grey", 12)
    o = mb.build("case.flap", col, location_mm=(0, iy0, tz - bd))
    bl.set_motion(o, "rotate", (-1, 0, 0), "The expansion slot's flap: push it and it swings down on its three hinges, opening the way to the slot J1")
    o["label_zh"] = "扩充槽盖板：一推就绕三个铰链向下翻开，露出扩充槽 J1"
    o["max_deg"] = V(so["open_deg"])
    bl.parent(o, lid)


def mains_panel_outline(p, c, grow):
    """The mains panel's outline on the back, (x, z): a rectangle over a narrower part with a
    round foot; grow widens it all round (the case's cut-out)."""
    mp = p.raw["base"]["back_panel"]["mains_panel"]
    x0 = -c.Wb2 + V(mp["from_side"])                 # its edge 24 mm from the side (the left, seen from the front)
    w_up, h_up = V(mp["upper"])
    w_lo, h_lo = V(mp["lower"])
    top = c.base_edge(c.D) - V(p.raw["case"]["seam_groove"])[0]   # flush with the base's top edge
    x1 = x0 + w_up
    xm = (x0 + x1) / 2
    zu = top - h_up
    r = w_lo / 2
    pts = [(x0 - grow, top + grow), (x0 - grow, zu - grow), (xm - r - grow, zu - grow)]
    zc = zu - h_lo + r                             # the foot's centre
    for a in range(180, 361, 10):
        pts.append((xm + (r + grow) * math.cos(math.radians(a)), zc + (r + grow) * math.sin(math.radians(a))))
    pts += [(xm + r + grow, zu - grow), (x1 + grow, zu - grow), (x1 + grow, top + grow)]
    out = []
    for q in pts:
        if not out or math.hypot(q[0] - out[-1][0], q[1] - out[-1][1]) > 1e-6:
            out.append(q)
    return out


def mains_cord_x(p, c):
    mp = p.raw["base"]["back_panel"]["mains_panel"]
    return -c.Wb2 + V(mp["from_side"]) + V(mp["upper"])[0] / 2


def joystick_outline(p, c):
    """The joystick socket's opening on the right side, in (Y, Z): an inverted trapezoid,
    wider at the top, its corners rounded."""
    js = p.raw["base"]["right_side"]["joystick"]
    wt, wb, h = V(js["size"])
    yb = c.Y(c.D) - V(js["from_back"])            # its back edge (the top's)
    ym = yb - wt / 2
    z0 = c.bottom + V(js["from_bottom"])
    pts = [(ym - wb / 2, z0), (ym + wb / 2, z0), (ym + wt / 2, z0 + h), (ym - wt / 2, z0 + h)]
    return fillet_polygon(pts, [V(js["corner_radius"])] * 4, 15.0)


def cassette_centre(p, c):
    cs = p.raw["base"]["right_side"]["cassette"]
    r = V(cs["hole"]) / 2
    return c.Y(c.D) - V(cs["from_back"]) - r, c.bottom + V(cs["from_bottom"]) + r


def j9_geometry(p):
    """J9's place (world mm), from the case's right wall inward: the cable's plug,
    its right face 3.5 mm from the wall; the right-angle header's body to its left. Returns the
    body's x range, its middle y, the lower pin row's z, and the plug's right face x."""
    j9 = p.raw["main_board"]["j9"]
    W, D, _ = V(p.raw["main_board"]["size"])
    ox, oy = V(p.raw["main_board"]["back_left"])
    zt = V(p.raw["main_board"]["top_z"])
    c = Case(p)
    m_face = c.Wb2 - c.wall - V(j9["gap_to_wall"])
    x1 = m_face - V(j9["plug_depth"])
    x0 = x1 - V(j9["body_depth"])
    yc = oy - D + V(j9["from_front"]) + 18.0          # the plug's front end that far from the board's; the plug 36 long
    return x0, x1, yc, zt + 3.2, m_face


def j9_header(p):
    """The right-angle 2 x 13 header: its body on the board, its pins out of the body's right
    face into the plug, and out of its left face bent down at a right angle into the board,
    the upper row bent further out than the lower."""
    x0, x1, yc, zr, _ = j9_geometry(p)
    zt = V(p.raw["main_board"]["top_z"])
    out = [(x0, yc - 17.0, zt, x1, yc + 17.0, zr + 2.54 + 1.6, "socket_black")]
    for row in (0, 1):
        leg = 1.4 + row * 2.54                      # how far out of the body each row bends down
        for i_ in range(13):
            py_ = yc + (i_ - 6) * 2.54
            pz_ = zr + row * 2.54
            out.append((x0 - leg - 0.32, py_ - 0.32, pz_ - 0.32, x1 + 4.0, py_ + 0.32, pz_ + 0.32, "gold"))   # along, into the plug
            out.append((x0 - leg - 0.32, py_ - 0.32, zt - 0.5, x0 - leg + 0.32, py_ + 0.32, pz_ + 0.32, "gold"))  # down into the board
    return out


def side_connector(mb, p, ref):
    """The joystick socket (J2, a DE-9 female) and the recorder socket (J3, a 5-pin DIN on the
    board, as photographed), standing on the mainboard behind their openings in the
    right side."""
    c = Case(p)
    face_x = c.Wb2 - c.wall - 0.6                 # just inside the side wall
    zt = V(p.raw["main_board"]["top_z"])
    if ref == "J2":
        js = p.raw["base"]["right_side"]["joystick"]
        wt, _, h = V(js["size"])
        ym = c.Y(c.D) - V(js["from_back"]) - wt / 2
        zm = c.bottom + V(js["from_bottom"]) + h / 2
        # the metal flange, the body behind it down to the board, the D-shaped shell and its
        # insulator with five holes above and four below
        box(mb, face_x - 1.0, ym - 15.4, zm - 6.25, face_x - 0.4, ym + 15.4, zm + 6.25, "can_silver", 0.8)
        box(mb, face_x - 12.0, ym - 10.0, zt, face_x - 1.0, ym + 10.0, zm + 5.0, "socket_black", 0.6)
        dt, db, dh = 16.3, 13.4, 8.4
        d_out = fillet_polygon([(ym - db / 2, zm - dh / 2), (ym + db / 2, zm - dh / 2), (ym + dt / 2, zm + dh / 2), (ym - dt / 2, zm + dh / 2)], [1.2] * 4, 15.0)
        mb.prism(d_out, "YZ", face_x - 0.4, face_x + 5.4, "can_silver")
        d_in = fillet_polygon([(ym - db / 2 + 0.5, zm - dh / 2 + 0.5), (ym + db / 2 - 0.5, zm - dh / 2 + 0.5), (ym + dt / 2 - 0.5, zm + dh / 2 - 0.5), (ym - dt / 2 + 0.5, zm + dh / 2 - 0.5)], [0.9] * 4, 15.0)
        mb.prism(d_in, "YZ", face_x + 5.4, face_x + 5.45, "insert_grey")
        for i in range(5):
            cyl(mb, face_x + 5.48, ym + (i - 2) * 2.77, zm + 1.42, 0.5, "X", 0.05, "hole_black", 10)
        for i in range(4):
            cyl(mb, face_x + 5.48, ym + (i - 1.5) * 2.77, zm - 1.42, 0.5, "X", 0.05, "hole_black", 10)
    else:
        cy_, cz_ = cassette_centre(p, c)
        # a square face, its body behind, a round socket with its key at the top and five
        # holes on a half circle below, and the metal tab at its foot
        # an 18 mm cube
        cs_ = V(p.raw["base"]["right_side"]["cassette"]["socket"])
        box(mb, face_x - cs_, cy_ - cs_ / 2, zt, face_x - 2.0, cy_ + cs_ / 2, zt + cs_, "socket_black", 0.8)
        box(mb, face_x - 2.0, cy_ - cs_ / 2, zt, face_x, cy_ + cs_ / 2, zt + cs_, "socket_black", 0.4)
        cyl(mb, face_x + 0.05, cy_, cz_, 7.0, "X", 0.1, "hole_black", 40)
        cyl(mb, face_x + 0.15, cy_, cz_, 6.0, "X", 0.1, "insert_grey", 40)
        box(mb, face_x + 0.1, cy_ - 1.2, cz_ + 4.6, face_x + 0.22, cy_ + 1.2, cz_ + 7.0, "hole_black")
        # the five pin holes on a half circle round the bottom, each a round hole with a flat
        # slot through it, every slot aimed at the socket's top centre (the DIN pattern,
        top = (cy_, cz_ + 6.0)
        for a in (180, 225, 270, 315, 0):
            ang = math.radians(a)
            hy, hz = cy_ + 3.5 * math.cos(ang), cz_ + 3.5 * math.sin(ang) if a not in (180, 0) else cz_
            cyl(mb, face_x + 0.22, hy, hz, 0.65, "X", 0.05, "hole_black", 12)
            ux, uz = top[0] - hy, top[1] - hz
            L = math.hypot(ux, uz)
            ux, uz = ux / L, uz / L
            hl, hw = 1.5, 0.22                       # the slot's half length and half width
            quad = [(hy - ux * hl - uz * hw, hz - uz * hl + ux * hw), (hy + ux * hl - uz * hw, hz + uz * hl + ux * hw),
                    (hy + ux * hl + uz * hw, hz + uz * hl - ux * hw), (hy - ux * hl + uz * hw, hz - uz * hl - ux * hw)]
            mb.prism(quad, "YZ", face_x + 0.2, face_x + 0.26, "hole_black")
        box(mb, face_x + 0.1, cy_ - 3.0, zt + 0.5, face_x + 0.3, cy_ + 3.0, zt + 2.0, "can_silver")


def build_base(p, case, col, root):
    c = case
    W2, wall = c.Wb2, c.wall          # the base is as wide as the raised part
    bz = c.bottom
    Y = c.Y
    yk = c.yb
    # the outside: front face, bottom, back face bevelled where they meet the sides; the top
    # edge (the seam) square
    # its two bottom corners rounded, seen from the side
    rb = V(p.raw["case"]["base_bottom_radius"])
    # the front: the wall leans back from its foot up to wall_top, under the lid's overhang;
    # from there a thin lip runs forward to `over` and carries the lid
    lt = c.base_lip_t
    prof = fillet_polygon([(Y(c.over), c.base_edge(c.over)), (Y(c.over), c.base_edge(c.over) - lt),
                           (Y(c.wall_top), c.base_edge(c.wall_top) - lt), (Y(c.base_foot), bz), (Y(c.D), bz), (Y(c.D), c.seam), (Y(yk), c.seam)],
                          [0.0, 0.0, 0.0, rb, rb, 0.0, 0.0], 6.0)
    m = 1 + max(i for i, q in enumerate(prof) if abs(q[0] - Y(c.D)) < 1e-6 and abs(q[1] - c.seam) < 1e-6)
    base = bevelled_solid("case.base", prof, m, W2, V(p.raw["case"]["edge_bevel"]), "case_plastic", col)
    # the inside: the leaning front wall at its thickness (measured across it)
    zr = c.base_edge(c.wall_top) - lt
    lean_b = (c.base_foot - c.wall_top) / (zr - bz)
    fw = wall * math.sqrt(1 + lean_b * lean_b)
    inner = [(Y(c.base_foot) + fw - lean_b * wall, bz + wall), (Y(c.D) - wall, bz + wall), (Y(c.D) - wall, 100), (Y(c.wall_top) + fw, 100),
             (Y(c.wall_top) + fw, zr)]
    boolean(base, prism_obj("_in", inner, "YZ", -W2 + wall, W2 - wall, "case_plastic", col))
    b = p.raw["base"]
    bp = b["back_panel"]
    yb = Y(c.D)
    cut = MeshBuilder()
    # back: drive opening, the three jack holes, the grommet's notch, vents
    (a0, a1), (z0, z1) = V(bp["drive"]["x"]), V(bp["drive"]["z"])
    cut.prism(rounded_rect(a0, bz + z0, a1, bz + z1, 0.8, 2), "XZ", yb - 5, yb + 5, "case_plastic")
    jz = bz + V(bp["jack_z"])
    jr = V(bp["jack_hole"]) / 2
    for _, jx, _ in V(bp["jacks"]):
        cyl(cut, jx, yb, jz, jr, "Y", 10, "case_plastic", 28)
    cut.prism(mains_panel_outline(p, c, 0.15), "XZ", yb - 5, yb + 5, "case_plastic")    # the mains panel sits in this, a hair larger
    vz0, vz1 = V(bp["vent_z"])
    for vx0, vx1, nv in V(bp["vents"]):
        step = (vx1 - vx0) / nv
        for i in range(nv):
            xm = vx0 + (i + 0.5) * step
            cut.prism(rounded_rect(xm - step * 0.28, bz + vz0, xm + step * 0.28, bz + vz1, 0.4, 2), "XZ", yb - 5, yb + 5, "case_plastic")
    # left: the switch's opening and the vents under it
    ls = b["left_side"]
    sy, sz = V(ls["power_switch"]["y"]), bz + V(ls["power_switch"]["z"])
    ow, oh = V(ls["power_switch"]["opening"])
    cut.prism(rounded_rect(sy - ow / 2, sz - oh / 2, sy + ow / 2, sz + oh / 2, 0.6, 2), "YZ", -W2 - 5, -W2 + 5, "case_plastic")
    lv = ls["vents"]
    nvl = int(V(lv["count"]))
    sw, sh = V(lv["slot"])
    for i in range(nvl):
        yy = V(lv["y_centre"]) + (i - (nvl - 1) / 2) * V(lv["pitch"])
        cut.prism(rounded_rect(yy - sw / 2, bz + V(lv["z0"]), yy + sw / 2, bz + V(lv["z0"]) + sh, 0.4, 2), "YZ", -W2 - 5, -W2 + 5, "case_plastic")
    # right: the joystick's opening and the cassette socket's hole
    rs = b["right_side"]
    cut.prism(joystick_outline(p, c), "YZ", W2 - 5, W2 + 5, "case_plastic")
    cy_, cz_ = cassette_centre(p, c)
    cyl(cut, W2, cy_, cz_, V(rs["cassette"]["hole"]) / 2, "X", 10, "case_plastic", 40)
    # the floor: vents and the three front screw holes
    bv = c_bv = p.raw["case"]["bottom_vents"]
    slw, sll = V(bv["slot"])
    for vx0, vx1, yc in V(c_bv["rows"]):
        nn = int((vx1 - vx0) / V(bv["pitch"]))
        for i in range(nn):
            xm = vx0 + (i + 0.5) * V(bv["pitch"])
            for dy in (-V(bv["line_gap"]) / 2, V(bv["line_gap"]) / 2):
                cut.prism(rounded_rect(xm - slw / 2, yc + dy - sll / 2, xm + slw / 2, yc + dy + sll / 2, 0.5, 2), "XY", bz - 5, bz + 5, "case_plastic")
    for sx, sy_ in V(p.raw["case"]["bottom_screws"]):
        cyl(cut, sx, sy_, bz, 1.8, "Z", 10, "case_plastic", 16)
    boolean(base, cut.build("_cuts", col))
    # the seam's dark line: the base's outer face stops short of the lid, its inner half
    # (a lip) going on up to it
    gh, gd = V(p.raw["case"]["seam_groove"])
    top_edge = [(Y(c.D) + 5, c.seam), (Y(yk), c.seam), (Y(c.over), c.base_edge(c.over)), (Y(c.over) - 5, c.base_edge(c.over) - 5 * (c.zb - c.zf) / c.yb)]
    band = shapes.offset_polyline(top_edge, -2.0) + list(reversed(shapes.offset_polyline(top_edge, gh)))
    ring = prism_obj("_sg", band, "YZ", -W2 - 5, W2 + 5, "case_plastic", col)
    boolean(ring, prism_obj("_sgi", rounded_rect(-W2 + gd, Y(c.over) + gd, W2 - gd, Y(c.D) - gd, max(0.5, c.corner - gd), 6), "XY", -10, 120, "case_plastic", col))
    boolean(base, ring)
    shapes.shade_auto(base, 35)
    label(base, "The base: a tray holding the mainboard, the power supply and the speaker; the sockets are on its back and sides",
          "底壳：装着主板、电源和喇叭；接口在后面和两侧")
    bl.parent(base, root)
    build_feet(p, case, col, base)
    build_panels(p, case, col, base)
    return base


def build_feet(p, case, col, base):
    f = p.raw["case"]["feet"]
    mb = MeshBuilder()
    r0, r1, h = V(f["base_diameter"]) / 2, V(f["top_diameter"]) / 2, V(f["height"])
    for x, y in V(f["positions"]):
        # two steps: the wide part against the case, the narrow one on the table
        cyl(mb, x, y, case.bottom - h * 0.3, r0, "Z", h * 0.6 + 0.2, "foot_white", 24)
        cyl(mb, x, y, h * 0.35, r1, "Z", h * 0.7, "foot_white", 24)
    o = mb.build("case.feet", col)
    label(o, "The feet", "机脚")
    bl.parent(o, base)


def build_panels(p, case, col, base):
    """Everything on the base's outside: labels, the jacks, screws, the grommet, the rocker."""
    c = case
    W2 = c.Wb2
    bz = c.bottom
    yb = c.Y(c.D)
    bp = p.raw["base"]["back_panel"]
    mb = MeshBuilder()
    eps = 0.06
    # the maker's plate: its artwork (model/assets/stickers/makerplate.svg)
    (a0, a1), (z0, z1) = V(bp["label_plate"]["x"]), V(bp["label_plate"]["z"])
    bl.add_sticker(mb, os.path.join(bl.STICKERS, "makerplate.svg"), a1 - a0, z1 - z0,
                   facing(((a0 + a1) / 2, yb + eps, bz + (z0 + z1) / 2), "back"))
    # 驱动器 over the drive opening
    (a0, a1), (z0, z1) = V(bp["drive"]["x"]), V(bp["drive"]["z"])
    text(mb, "驱 动 器", 4.0, facing(((a0 + a1) / 2, yb + eps, bz + z1 + 5), "back"), "ink_dark", font=bl.FONT_CJK)
    # the jacks: RCA sockets in their holes, their labels over them
    jz = bz + V(bp["jack_z"])
    jr = V(bp["jack_hole"]) / 2
    for kind, jx, name in V(bp["jacks"]):
        if name:
            text(mb, " ".join(name) if len(name) == 2 else name, 4.0, facing((jx, yb + eps, jz + 11.5), "back"), "ink_dark", font=bl.FONT_CJK)
        if kind == "blank":
            continue                     # its sleeve is RF-1's (build_board)
        # an RCA socket: the aluminium rim, a ring (black for the monitor, white for
        # the TV), the black opening and its centre contact
        # three layers, each face a little proud of the one round it: the
        # aluminium outer ring, the inner ring, the centre hole
        cyl(mb, jx, yb - 4.0, jz, 5.4, "Y", 6.4, "can_silver", 32)           # face at yb - 0.8
        cyl(mb, jx, yb - 3.8, jz, 3.6, "Y", 6.4, "plastic_white" if kind == "tv" else "socket_black", 28)   # face at yb - 0.6
        cyl(mb, jx, yb - 3.7, jz, 1.4, "Y", 6.4, "hole_black", 16)            # face at yb - 0.5
    # the mains warning: its artwork (model/assets/stickers/warning.svg)
    (a0, a1), (z0, z1) = V(bp["warning"]["x"]), V(bp["warning"]["z"])
    bl.add_sticker(mb, os.path.join(bl.STICKERS, "warning.svg"), a1 - a0, z1 - z0,
                   facing(((a0 + a1) / 2, yb + eps, bz + (z0 + z1) / 2), "back"))
    # the mains panel: black plastic standing 2 mm out of the back, its top flush
    # with the base's top edge; a rectangle over a narrower part with a round foot, an opening
    # at the bottom for the cord
    mp = bp["mains_panel"]
    out = mains_panel_outline(p, c, 0.0)
    pm_ = MeshBuilder()
    pm_.prism(out, "XZ", yb - 2.6, yb + V(mp["proud"]), "rubber_black")   # its back clear of the wall's inner face
    po_ = pm_.build("_mp", col)
    ow_, oh_ = V(mp["cord_opening"])
    mx_ = mains_cord_x(p, c)
    zb_ = c.bottom + V(mp["bottom_z"])
    op = [(mx_ - ow_ / 2, zb_ - 1.0), (mx_ + ow_ / 2, zb_ - 1.0)] + [(mx_ + ow_ / 2 * math.cos(math.radians(a)), zb_ + oh_ - ow_ / 2 + ow_ / 2 * math.sin(math.radians(a))) for a in range(0, 181, 15)]
    boolean(po_, prism_obj("_op", op, "XZ", yb - 3, yb + 5, "rubber_black", col))
    v_, f_ = bl.mesh_data(po_)
    bpy.data.objects.remove(po_)
    mb.add_mesh_data(v_, f_, Matrix.Identity(4), "rubber_black")
    # the screws below the seam, into the lid's brass inserts
    sr = V(bp["screw_radius"])
    for sx in V(bp["screws"]):
        sz = bz + V(bp["screw_z"])
        # a pan head with a cross recess cut into it
        hd_ = MeshBuilder()
        hd_.lathe([(0.0, yb + 1.4), (sr * 0.75, yb + 1.35), (sr, yb + 0.9), (sr, yb), (0.0, yb)], 20, "screw_silver", axis="Y", offset=(sx, 0, sz))
        ho_ = hd_.build("_sh", col)
        xc = MeshBuilder()
        for wx, wz in ((sr * 1.2, 0.35), (0.35, sr * 1.2)):
            xc.prism([(sx - wx, sz - wz), (sx + wx, sz - wz), (sx + wx, sz + wz), (sx - wx, sz + wz)], "XZ", yb + 0.7, yb + 2.0, "screw_silver")
        boolean(ho_, xc.build("_x", col), tolerant=True)
        v_, f_ = bl.mesh_data(ho_)
        bpy.data.objects.remove(ho_)
        mb.add_mesh_data(v_, f_, Matrix.Identity(4), "screw_silver")
    # the right side's labels
    rs = p.raw["base"]["right_side"]
    jy = c.Y(c.D) - V(rs["joystick"]["from_back"]) - V(rs["joystick"]["size"])[0] / 2
    jz_top = bz + V(rs["joystick"]["from_bottom"]) + V(rs["joystick"]["size"])[2]
    spaced = lambda t: " ".join(t)   # noqa: E731  (the characters spread, as on the case: 游 戏 棒)
    text(mb, spaced(rs["joystick"]["label"]), 4.0, facing((W2 + eps, jy, jz_top + 5.5), "right"), "ink_dark", font=bl.FONT_CJK)
    cy_, cz_ = cassette_centre(p, c)
    text(mb, spaced(rs["cassette"]["label"]), 4.0, facing((W2 + eps, cy_, cz_ + V(rs["cassette"]["hole"]) / 2 + 6.5), "right"), "ink_dark", font=bl.FONT_CJK)
    o = mb.build("case.panels", col)
    label(o, "The back panel: the maker's plate, the disk drive connector (驱动器), the monitor (监视器) and TV (电视) sockets, the mains warning",
          "后面板：厂家铭牌、驱动器接口、监视器和电视插座、电源警告")
    bl.parent(o, base)
    # the rocker switch on the left: a symmetric piece with a concave face
    # and ends leaning in, tilted about its centre, so one end stands out tall and steep and
    # the face ramps down to the other; off tips the front end out, on the back end
    ls = p.raw["base"]["left_side"]["power_switch"]
    rp_ = ls["rocker"]
    L, Hz = V(rp_["size"])
    h_end, h_mid = V(rp_["face"])
    slant = math.tan(math.radians(V(rp_["end_slant"])))
    tilt = V(rp_["tilt"])
    se = L / 2 - h_end * slant            # where the face meets the leaning ends
    poly = [(-L / 2, -6.0), (L / 2, -6.0), (L / 2, 0.0)]
    n = 16
    for k in range(n + 1):
        sv = se - 2 * se * k / n
        poly.append((sv, h_mid + (h_end - h_mid) * (sv / se) ** 2))
    poly.append((-L / 2, 0.0))
    # (s along +Y, h outward = -X) -> local (x, y) = (-h, s); extruded up and down in Z;
    # the white pit near the front end of the face (the end pressed for on)
    sd = V(rp_["dot_s"])
    hd = h_mid + (h_end - h_mid) * (sd / se) ** 2 + 0.03
    d2 = V(rp_["dot_size"]) / 2
    # the off tilt baked in (front end out): turned about Z through the pivot
    rk2 = MeshBuilder()
    rk2.prism([(-h, sv) for sv, h in poly], "XY", -Hz / 2, Hz / 2, "rubber_black")
    # laid on the curved face: a strip of quads, each corner at the face's own height
    face_h = lambda sv: h_mid + (h_end - h_mid) * (sv / se) ** 2 + 0.04  # noqa: E731
    ss = [sd - d2 + 2 * d2 * k / 6 for k in range(7)]
    dv = [(-face_h(sv), sv, zz) for sv in ss for zz in (-d2, d2)]
    rk2.add_mesh_data(dv, [(2 * k, 2 * k + 1, 2 * k + 3, 2 * k + 2) for k in range(6)], Matrix.Identity(4), "logo_white")
    _ = hd
    rot = Matrix.Rotation(math.radians(-tilt), 4, "Z")
    rk2.verts = [tuple(rot @ Vector(v)) for v in rk2.verts]
    so = rk2.build("switch.power", col, location_mm=(-W2, V(ls["y"]), bz + V(ls["z"])))
    bl.set_motion(so, "rotate", (0, 0, 1), "The power switch: a rocker on the left side; press the front end in for on, the back end for off")
    so["label_zh"] = "电源开关：左侧的翘板开关；按下前端开机，按下后端关机"
    so["on_deg"] = 2 * tilt
    bl.parent(so, base)


# --- the keyboard ------------------------------------------------------------------------

def key_surface(k, kp):
    """z of the keycap's top at local (x, y): the edge height, dished or domed."""
    h = V(kp["keycap"]["height"])
    dish = V(kp["keycap"]["dish"])
    hw, hd = k["_tw"] / 2, k["_td"] / 2
    if k["dish"] == "lr":
        return lambda x, y: h - dish * (1 - min(1.0, (x / hw) ** 2))
    if k["dish"] == "fb":
        return lambda x, y: h - dish * (1 - min(1.0, (y / hd) ** 2))
    if k["dish"] == "convex":
        return lambda x, y: h + dish * (1 - min(1.0, (y / hd) ** 2))
    return lambda x, y: h - 1.0


def arrow_key_mesh(mb, k, kp):
    """One of the four arrow keys: a triangle of the 47 mm square, its long
    outer edge straight for 36.7 mm between two small 45-degree vertical chamfers, its short
    edges along the diagonal gaps. The lower layer rises straight; in the top 4 mm every edge
    but the long one slopes in at 45 degrees (the long one stays vertical), so the top is
    the outline inset 4 mm on those edges. Built in the key's own frame (origin at its
    keyboard.json place), the cap's bottom at z = 0."""
    ar = kp["arrows"]
    s2 = V(ar["size"]) / 2
    cut = (V(ar["size"]) - V(ar["long_edge"])) / 2
    kk = V(ar["gap"]) / 2 * math.sqrt(2)          # the gap's half-width, along the axis
    up_h, up_in = V(ar["upper"])
    h = V(kp["keycap"]["height"])
    m = s2 * 2 - cut                              # the chamfer's line: |x| + y = m
    # the "up" key's outline, counter-clockwise, and each edge's inset at the top
    pts = [(0.0, kk), ((m - kk) / 2, (m + kk) / 2), (s2 - cut, s2), (-(s2 - cut), s2), (-(m - kk) / 2, (m + kk) / 2)]
    insets = [up_in, up_in, 0.0, up_in, up_in]    # edges: short, chamfer, long, chamfer, short
    rot = {"up": 0, "left": 90, "down": 180, "right": 270}[k["arrow"]]
    ca, sa = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    acx, acy = V(ar["centre"])
    ox, oy = acx - k["x"], acy - k["y"]

    def place(x, y):
        return (ox + x * ca - y * sa, oy + x * sa + y * ca)

    # the top outline: each edge's line moved in by its inset, neighbours intersected
    n = len(pts)
    lines = []
    for i in range(n):
        (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
        L = math.hypot(x1 - x0, y1 - y0)
        nx, ny = -(y1 - y0) / L, (x1 - x0) / L      # inward normal (counter-clockwise)
        lines.append((x0 + nx * insets[i], y0 + ny * insets[i], (x1 - x0) / L, (y1 - y0) / L))
    top = []
    for i in range(n):
        ax, ay, adx, ady = lines[i - 1]
        bx, by, bdx, bdy = lines[i]
        den = adx * bdy - ady * bdx
        t = ((bx - ax) * bdy - (by - ay) * bdx) / den
        top.append((ax + adx * t, ay + ady * t))
    zl = h - up_h
    verts = [(*place(x, y), 0.0) for x, y in pts] + [(*place(x, y), zl) for x, y in pts] + [(*place(x, y), h) for x, y in top]
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))               # the lower layer's walls
        faces.append((n + i, n + j, 2 * n + j, 2 * n + i))  # the upper layer's walls and bevels
    faces.append(tuple(range(2 * n, 3 * n)))             # the flat top
    faces.append(tuple(reversed(range(n))))              # the underside
    mb.add_mesh_data(verts, faces, Matrix.Identity(4), "key_tan")
    # the legend (as photographed): a thin outline of an isosceles triangle, wider than tall,
    # its apex toward the long edge, near it
    tb, th_, dist, stroke = V(kp["legends"]["arrow"])
    cy = s2 - dist                                   # the triangle's middle, from the long edge
    side = math.hypot(tb / 2, th_)
    r = (tb * th_ / 2) / ((tb + 2 * side) / 2)       # its inradius
    ic = (0.0, cy - th_ / 2 + r)                      # its incentre
    outer = [(-tb / 2, cy - th_ / 2), (tb / 2, cy - th_ / 2), (0.0, cy + th_ / 2)]
    k_in = (r - stroke) / r
    inner = [(ic[0] + (x - ic[0]) * k_in, ic[1] + (y - ic[1]) * k_in) for x, y in outer]
    o_, i_ = [place(*q) for q in outer], [place(*q) for q in inner]
    for q in range(3):
        w = (q + 1) % 3
        quad = [o_[q], o_[w], i_[w], i_[q]]
        mb.add_mesh_data([(x, y, h + 0.04) for x, y in quad], [(0, 1, 2, 3)], Matrix.Identity(4), "ink_dark")


def build_key(k, kp, col, parent):
    cap = kp["keycap"]
    w, d = k["w"], k["d"]
    bw, bd = V(cap["bottom"])
    tw_, td_ = V(cap["top"])
    ix, iy = (bw - tw_) / 2, (bd - td_) / 2          # 3 and 2 for a letter key
    if k["id"] == "space":
        ix = (w - k["w_top"]) / 2
    if "outline" in k:
        lo = [tuple(q) for q in k["outline"]]
        if sum(lo[i][0] * lo[(i + 1) % len(lo)][1] - lo[(i + 1) % len(lo)][0] * lo[i][1] for i in range(len(lo))) < 0:
            lo = list(reversed(lo))          # counter-clockwise, so the top is offset inward
        hi = offset_polygon(lo, -2.5 if k.get("arrow") else -ix)
    else:
        lo = rounded_rect(-w / 2, -d / 2, w / 2, d / 2, V(cap["corner_radius"]), 3)
        hi = rounded_rect(-w / 2 + ix, -d / 2 + iy, w / 2 - ix, d / 2 - iy, V(cap["corner_radius"]), 3)
    xs, ys = [q[0] for q in hi], [q[1] for q in hi]
    k["_tw"], k["_td"] = max(xs) - min(xs), max(ys) - min(ys)
    surf = key_surface(k, kp)
    hcx, hcy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2

    def zs(x, y):
        return surf(x - hcx, y - hcy)

    mb = MeshBuilder()
    body = "key_tan"
    skirt = 1.2
    if k.get("arrow"):
        arrow_key_mesh(mb, k, kp)
        sr, sh = V(kp["switch"]["stem"])
        cyl(mb, 0, 0, -sh / 2, sr, "Z", sh, "switch_dark", 12)
        return finish_key(mb, k, kp, col, parent, [])
    # the skirt's foot, then the tapered sides up to the top's outline, then the top: a fan
    # of strips across the dish so the curve is followed
    n = len(lo)
    area = sum(lo[i][0] * lo[(i + 1) % n][1] - lo[(i + 1) % n][0] * lo[i][1] for i in range(n))

    def subdivide(outline, k):
        out_ = []
        for i in range(len(outline)):
            a, b = outline[i], outline[(i + 1) % len(outline)]
            for j in range(k):
                t = j / k
                out_.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
        return out_

    # the sides: the foot's outline and the top's, each edge cut into the same pieces, so the
    # sides meet the curved top along its whole edge
    SUB = 6
    lo_r, ring = subdivide(lo, SUB), subdivide(hi, SUB)
    m_ = len(ring)
    verts = [(x, y, 0.0) for x, y in lo_r] + [(x, y, zs(x, y)) for x, y in ring]
    faces = [(i, (i + 1) % m_, m_ + (i + 1) % m_, m_ + i) for i in range(m_)]
    if area < 0:
        faces = [tuple(reversed(f)) for f in faces]
    mb.add_mesh_data(verts, faces, Matrix.Identity(4), body)
    # the top face: triangulated from its centre over the same ring
    tv = [(hcx, hcy, zs(hcx, hcy))]
    for x, y in ring:
        tv.append(((x + hcx) / 2, (y + hcy) / 2, zs((x + hcx) / 2, (y + hcy) / 2)))
    for x, y in ring:
        tv.append((x, y, zs(x, y)))
    m_ = len(ring)
    tf = []
    for i in range(m_):
        j = (i + 1) % m_
        tf.append((0, 1 + i, 1 + j))
        tf.append((1 + i, 1 + m_ + i, 1 + m_ + j, 1 + j))
    if area < 0:
        tf = [tuple(reversed(f)) for f in tf]
    mb.add_mesh_data(tv, tf, Matrix.Identity(4), body)
    # the underside, closing the skirt (a thin floor: the cap is hollow in life)
    mb.add_mesh_data([(x, y, 0.0) for x, y in lo], [tuple(reversed(range(n))) if area > 0 else tuple(range(n))], Matrix.Identity(4), body)
    # the stem down into the switch
    sr, sh = V(kp["switch"]["stem"])
    cyl(mb, 0, 0, -sh / 2, sr, "Z", sh, "switch_dark", 12)
    _ = skirt
    # legends: draped onto the top surface
    ink = "ink_dark"
    legends = k["legends"]

    def drape(s, size, x, y, font=None, bold=0.0):
        v, f = bl.glyph_mesh_flat(s, size, align="LEFT" if k["legend_at"] == "top_left" else "CENTER", bold_mm=bold, font=font)
        if not v:
            return
        v = [(vx + x, vy + y, zs(vx + x, vy + y) + 0.04) for vx, vy, _ in v]
        mb.add_mesh_data(v, f, Matrix.Identity(4), ink)

    # legends, as on the keys (as photographed): Noto Sans (the font's Latin),
    # medium weight. One top and one left padding for every key; the pair keys' two lines
    # are spaced so that their block sits with equal padding above and below, which sets
    # that common top padding. 中文, 西文, Reset, Test and Caps Lock are centred up and down
    # (Caps Lock across too); Tab, Ctrl, Return and Shift sit further in from the left.
    lg = kp["legends"]
    left0, top0 = min(xs), max(ys)
    tw, td = max(xs) - min(xs), max(ys) - min(ys)
    pair_cap, pair_gap = V(lg["pair"])
    pad_top = (V(kp["keycap"]["top"])[1] - (2 * pair_cap + pair_gap)) / 2
    pad_left = V(lg["pad_left"])

    def line(text, cap, x, base, font=bl.FONT_CJK, max_w=None, centre=False):
        """One line, its capitals `cap` high, its baseline at `base`; x is its left (or its
        middle, if centre)."""
        if text in ("*", "^"):
            # drawn as strokes, as on the caps: the asterisk three bars crossed, capital
            # high; the caret a wide inverted V in the top of the line
            w = cap * V(lg["stroke"])
            cx_ = x if centre else x + cap * 0.45
            if text == "*":
                cy_ = base + cap / 2
                r = cap * 0.5
                for a_ in (90, 30, -30):
                    dx_, dy_ = r * math.cos(math.radians(a_)), r * math.sin(math.radians(a_))
                    stroke(cx_ - dx_, cy_ - dy_, cx_ + dx_, cy_ + dy_, w)
            else:
                hw = cap * 0.5
                stroke(cx_ - hw, base + cap * 0.45, cx_, base + cap, w)
                stroke(cx_, base + cap, cx_ + hw, base + cap * 0.45, w)
            return
        sign = not text.isalnum() and font is bl.FONT_CJK and all(ord(ch) < 128 for ch in text)
        if sign:
            font = bl.FONT_SYMBOLS                       # the signs: $ with its line through
        size = cap / 0.74 if font is bl.FONT_CJK else (cap / 0.688 if sign else cap / 0.9)
        v, f = bl.glyph_mesh_flat(text, size, align="LEFT", bold_mm=V(lg["bold"]), font=font, max_width_mm=max_w)
        if not v:
            return
        ref, _ = bl.glyph_mesh_flat("中" if font is bl.FONT_CJK_SERIF else "H", size, align="LEFT", font=font)
        oy = base - min(q[1] for q in ref)
        if sign and len(text) == 1:
            # each sign kept inside its own capital-high slot, as on the caps:
            # the tall ones (bars, slashes, brackets) fitted to the slot; the dashes and the
            # tilde centred in it; the backquote and quotes at its top; the rest on the line
            y0_, y1_ = min(q[1] for q in v), max(q[1] for q in v)
            ymid = base + cap / 2
            if text in "|\\/()[]{}":
                k_ = cap * V(lg["tall_sign"]) / (y1_ - y0_)
                cx0 = sum(q[0] for q in v) / len(v)
                v = [(cx0 + (q[0] - cx0) * k_, ymid + (q[1] - (y0_ + y1_) / 2) * k_, 0.0) for q in v]
                oy = 0.0
            elif text in "-_~=+":
                oy = ymid - (y0_ + y1_) / 2
            elif text in "`'\"":
                oy = base + cap - y1_
        x0, x1 = min(q[0] for q in v), max(q[0] for q in v)
        ox = (x - (x0 + x1) / 2) if centre else (x - x0)
        # lifted 0.15 mm: the cap's top is built of flat facets that sit above the true dish
        v = [(vx + ox, vy + oy, zs(vx + ox, vy + oy) + 0.15) for vx, vy, _ in v]
        mb.add_mesh_data(v, f, Matrix.Identity(4), ink)

    def stroke(x0, y0, x1, y1, w):
        """A straight bar of width w from (x0, y0) to (x1, y1), draped on the cap's top."""
        L = math.hypot(x1 - x0, y1 - y0)
        nx, ny = -(y1 - y0) / L * w / 2, (x1 - x0) / L * w / 2
        pts = []
        for k_ in range(9):
            t = k_ / 8
            px_, py_ = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            pts += [(px_ - nx, py_ - ny), (px_ + nx, py_ + ny)]
        vv = [(a_, b_, zs(a_, b_) + 0.15) for a_, b_ in pts]
        mb.add_mesh_data(vv, [(2 * k_, 2 * k_ + 2, 2 * k_ + 3, 2 * k_ + 1) for k_ in range(8)], Matrix.Identity(4), ink)

    def block(lines, cap, gap, middle=False, centre=False, dx=pad_left, font=bl.FONT_CJK, max_w=None):
        h = len(lines) * cap + (len(lines) - 1) * gap
        top = (hcy + h / 2) if middle else (top0 - pad_top)
        for n_, t in enumerate(lines):
            base = top - n_ * (cap + gap) - cap
            line(t, cap, hcx if centre else left0 + dx, base, font=font, max_w=max_w, centre=centre)

    kid = k["id"]
    if k["legend_at"] == "centre":                       # 中文, 西文
        block([legends[0]], V(lg["cjk"]), 0, middle=True, centre=True, font=bl.FONT_CJK_SERIF)
    elif kid == "capslock":
        cap, gap = V(lg["caps_lock"])
        block(["Caps", "Lock"], cap, gap, middle=True, centre=True)
    elif len(legends) == 2:
        block([legends[1], legends[0]], pair_cap, pair_gap)
    elif legends:
        s0 = legends[0]
        if len(s0) == 1:
            block([s0], V(lg["letter"]), 0)
        elif s0.startswith("F") and s0[1:].isdigit():
            cap = V(lg["fkey"])
            sub, gap = V(lg["fkey_sub"])
            base = top0 - pad_top - cap
            line("F", cap, left0 + pad_left, base)
            line(s0[1:], sub, left0 + pad_left + cap * 0.62 + gap, base - 0.25)
        else:
            cap = V(lg["word"])
            middle = kid in ("reset", "test")
            dx = V(lg["pad_left_wide"]) if kid in ("tab", "ctrl", "return", "lshift", "rshift") else pad_left
            block([s0], cap, 0, middle=middle, dx=dx, max_w=tw - dx - pad_left)   # the same margin at the right
    return finish_key(mb, k, kp, col, parent, legends)


ARROW_NAMES = {"up": "↑ (up)", "down": "↓ (down)", "left": "← (left)", "right": "→ (right)"}


def finish_key(mb, k, kp, col, parent, legends):
    """Build the key's node at its place, with its motion and labels."""
    cap = kp["keycap"]
    loc = (k["x"], k["y"], V(cap["bottom_z"]))
    o = mb.build(k["node"], col, location_mm=loc)
    name = " ".join(legends) if legends else ARROW_NAMES.get(k["id"], k["id"])
    bl.set_motion(o, "translate", (0, 0, -1), f"Key {name}", unit="mm")
    o["label_zh"] = f"按键 {name}"
    o["travel"] = V(kp["travel"])
    o["key_id"] = k["id"]
    if k.get("latching"):
        o["latching"] = True
        o["latched_drop"] = k["latched_drop"]
    bl.parent(o, parent)
    return o


def build_keyboard_underside(p, kb, col, pcb, z_under, notch):
    """The keyboard board's underside: each key's two solder
    joints, the copper of the key matrix and the white key names. The wiring follows the
    keyboard ROM's matrix (params/keyboard_matrix.json): every key joins its X line and its Y
    line; Ctrl, the Shifts, Caps Lock and Reset have lines of their own, their other side to
    ground. The paths are drawn, not traced from the board: under each row of keys a channel
    where each line that row needs runs along, a trunk for each line down the gap between the
    main keys and the arrows, and a run from each trunk to its pin of the 26-way header."""
    kp = p.raw["keyboard"]
    xr, iy, nw, nd, hb = notch
    matrix = load_json("keyboard_matrix.json")["keys"]
    rows = V(kp["rows_y"])
    ax, ay = V(kp["arrows"]["centre"])
    arrow_sw = {"up": (0, 12), "down": (0, -12), "left": (-12, 0), "right": (12, 0)}
    mb = MeshBuilder()
    z0, z1 = z_under - 0.05, z_under            # copper, a hair proud of the board
    tw = 0.3                                    # a trace's width

    def hseg(x0, x1, y):
        if abs(x1 - x0) > 1e-6:
            mb.prism([(min(x0, x1) - tw / 2, y - tw / 2), (max(x0, x1) + tw / 2, y - tw / 2), (max(x0, x1) + tw / 2, y + tw / 2), (min(x0, x1) - tw / 2, y + tw / 2)], "XY", z0, z1, "trace_green")

    def vseg(x, y0, y1):
        if abs(y1 - y0) > 1e-6:
            mb.prism([(x - tw / 2, min(y0, y1) - tw / 2), (x + tw / 2, min(y0, y1) - tw / 2), (x + tw / 2, max(y0, y1) + tw / 2), (x - tw / 2, max(y0, y1) + tw / 2)], "XY", z0, z1, "trace_green")

    def joint(x, y):
        cyl(mb, x, y, z_under - 0.35, 0.95, "Z", 0.7, "tin", 12)

    # each key's two pins: [(net, x, y)]
    pins = []
    for k in kb["keys"]:
        x, y = k["x"], k["y"]
        if k.get("arrow"):
            dx, dy = arrow_sw[k["arrow"]]
            x, y = ax + dx, ay + dy
        m = matrix[k["id"]]
        a_, b_ = (f"X{m[0]}", f"Y{m[1]}") if isinstance(m, list) else (m, "GND")
        pins.append((a_, x - 2.5, y + 3.0, y))
        pins.append((b_, x + 2.5, y + 3.0, y))
    # channels: midway under each row of keys (and under the arrows' rows)
    chan_ys = sorted({rows[r] - 9.45 for r in rows} | {ay + 12 - 9.45, ay - 9.45, ay - 12 - 9.45})

    def channel_for(key_y):
        below = [c for c in chan_ys if c < key_y]
        return max(below) if below else min(chan_ys)

    nets = sorted({n for n, *_ in pins}, key=lambda n: (n[0], int(n[1:]) if n[1:].isdigit() else 0, n))
    trunk_x = {n: 114.0 + i * 0.6 for i, n in enumerate(nets)}      # down the gap by the arrows
    # the header's pads (on this side its pins come through), one a line; +5 V the spare
    nyc = iy + nd / 2
    pad_x = (xr - nw - hb + 1.5, xr - nw - hb + 4.0)
    pads = [(pad_x[i % 2], nyc + (i // 2 - 6) * 2.54) for i in range(26)]
    net_pad = {n: pads[i] for i, n in enumerate(nets)}
    for px_, py_ in pads:
        joint(px_, py_)
    # the channels' lanes: each line in a channel gets its own lane
    by_chan = {}
    for n, x, y, ky in pins:
        by_chan.setdefault(channel_for(ky), {}).setdefault(n, []).append((x, y))
    lanes = {}
    for c, d in by_chan.items():
        names = sorted(d, key=lambda n: nets.index(n))
        for i, n in enumerate(names):
            lanes[(c, n)] = c + (i - (len(names) - 1) / 2) * 0.55
    for c, d in by_chan.items():
        for n, pts in d.items():
            ly = lanes[(c, n)]
            for x, y in pts:
                joint(x, y)
                vseg(x, y, ly)                    # down from the pin to its lane
            hseg(min(x for x, _ in pts), trunk_x[n], ly)   # along the lane to the line's trunk
    for n in nets:
        ys = [lanes[(c, n)] for c in by_chan if (c, n) in lanes]
        px_, py_ = net_pad[n]
        vseg(trunk_x[n], min(ys + [py_]), max(ys + [py_]))
        hseg(trunk_x[n], px_, py_)                # to the header
    # the key names in white, read from this side (mirrored on the board)
    flip = Matrix.Rotation(math.pi, 4, "Y")
    for k in kb["keys"]:
        name = {"zhongwen": "中文", "xiwen": "西文", "capslock": "CAP", "lshift": "SHIFT", "rshift": "SHIFT", "return": "RETURN",
                "space": "", "up": "↑", "down": "↓", "left": "←", "right": "→"}.get(k["id"], (k["legends"][0] if k["legends"] else k["id"]).upper())
        if not name:
            continue
        x, y = k["x"], k["y"]
        if k.get("arrow"):
            dx, dy = arrow_sw[k["arrow"]]
            x, y = ax + dx, ay + dy
        text(mb, name, 2.8, Matrix.Translation((x, y - 2.8, z_under - 0.06)) @ flip, "silk_white", font=bl.FONT_CJK, max_w=13.0)
    # in the empty band between the F row's lanes and the number row
    text(mb, "CEC-1", 7.0, Matrix.Translation((-40.0, 112.0, z_under - 0.06)) @ flip, "silk_white", font=bl.FONT_CJK, bold=0.1)
    cyl(mb, -160.0, 18.0, z_under - 0.08, 4.0, "Z", 0.12, "paper", 20)        # the QA PASS sticker
    text(mb, "QA PASS", 1.2, Matrix.Translation((-160.0, 18.5, z_under - 0.16)) @ flip, "ink_dark", font=bl.FONT_CJK)
    o = mb.build("board.keyboard_solder", col)
    label(o, "The keyboard board's underside: each key's two solder joints, the copper of the key matrix (8 X lines by 10 Y lines, as the keyboard ROM reads them) and the key names",
          "键盘电路板的背面：每个键的两个焊点、键盘矩阵的铜线（8 条 X 线 × 10 条 Y 线）和键名")
    o.parent = pcb
    o.matrix_parent_inverse.identity()


def build_keyboard(p, col, root):
    kp = p.raw["keyboard"]
    kb = load_json("keyboard.json")
    pl = kp["plate"]
    PW, PD, PH = V(pl["size"])
    sheet = V(pl["sheet"])
    asm = bl.empty("keyboard", col)
    label(asm, "The keyboard: 69 keys on a black steel plate, read through the encoder U25 and the keyboard ROM U26",
          "键盘：69 个键装在黑色钢板上，由编码器 U25 和键盘 ROM U26 读出")
    # the plate: a sheet with its rim folded down, the groove under the F-keys
    mb = MeshBuilder()
    mb.prism(rounded_rect(-PW / 2, 0, PW / 2, PD, 1.5, 3), "XY", -sheet, 0.0, "steel_black")
    for x0, y0, x1, y1 in ((-PW / 2, 0, PW / 2, sheet), (-PW / 2, PD - sheet, PW / 2, PD), (-PW / 2, 0, -PW / 2 + sheet, PD), (PW / 2 - sheet, 0, PW / 2, PD)):
        mb.prism([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], "XY", -PH, -sheet, "steel_black")
    po = mb.build("keyboard.plate", col)
    # the groove pressed across the plate, between the F row and the main keys:
    # a trough with sloping sides and rounded ends cut into the sheet, and its pressed-out
    # underside below
    gy = V(pl["groove_y"])
    gw, gd = V(pl["groove"])
    gx = PW / 2 - 22

    def loft(top_ring, bot_ring, mat):
        """A solid between two rings of equal count (top above bottom), both counter-clockwise."""
        n_ = len(top_ring)
        m_ = MeshBuilder()
        verts = list(top_ring) + list(bot_ring)
        faces = [tuple(range(n_)), tuple(reversed(range(n_, 2 * n_)))]
        for k_ in range(n_):
            q = (k_ + 1) % n_
            faces.append((n_ + k_, n_ + q, q, k_))
        m_.add_mesh_data(verts, faces, Matrix.Identity(4), mat)
        return m_

    def stadium(half_len, half_w, z, n=10):
        return [(x, y, z) for x, y in rounded_rect(-half_len, gy - half_w, half_len, gy + half_w, half_w - 1e-3, n)]

    inset = gd * 0.5
    cut = loft(stadium(gx, gw / 2, 1.0), stadium(gx - inset, gw / 2 - inset, -gd), "steel_black")
    boolean(po, cut.build("_gr", col), tolerant=True)
    out_ = loft(stadium(gx + 0.3, gw / 2 + 0.3, -sheet + 0.05), stadium(gx - inset + 0.3, gw / 2 - inset + 0.3, -gd - sheet), "steel_black")
    hole_ = loft(stadium(gx - 0.2, gw / 2 - 0.2, -sheet + 0.06), stadium(gx - inset, gw / 2 - inset, -gd + 0.01), "steel_black")
    uo = out_.build("_under", col)
    boolean(uo, hole_.build("_uh", col), tolerant=True)
    boolean(po, uo, "UNION", tolerant=True)
    shapes.shade_auto(po, 30)
    label(po, "The keyboard's steel plate, painted black", "键盘钢板（黑漆）")
    bl.parent(po, asm)
    # the PCB below, and the switches: their housings on the plate, their bodies through it
    pc = kp["pcb"]
    ix, iy = V(pc["inset"])
    zb = -V(pc["below_plate"])
    t = V(pc["thickness"])
    mb = MeshBuilder()
    # the board, with a notch in the corner under the arrow keys where the cable's plug goes in
    # from the right
    nw, nd = V(pc["notch"])
    xr = PW / 2 - ix
    mb.prism([(-xr, iy), (xr - nw, iy), (xr - nw, iy + nd), (xr, iy + nd), (xr, PD - iy), (-xr, PD - iy)], "XY", zb - t, zb, "pcb_dark")
    # its 2 x 13 header on the components' side (the top, facing the plate) along the notch's
    # inner edge, the pins pointing right
    kh = kp["cable"]
    hb, hz0 = V(kh["kb_header"])          # its body's depth (x) and its pin rows' middle above the board
    nyc = iy + nd / 2
    box(mb, xr - nw - hb, nyc - 17.0, zb, xr - nw, nyc + 17.0, zb + hz0 + 3.0, "socket_black", 0.3)
    for row in (0, 1):
        for i_ in range(13):
            py_ = nyc + (i_ - 6) * 2.54
            pz_ = zb + hz0 + row * 2.54 - 1.27
            box(mb, xr - nw - hb + 1, py_ - 0.32, pz_ - 0.32, xr - nw + 6.0, py_ + 0.32, pz_ + 0.32, "gold")
    pcb = mb.build("board.keyboard", col)
    build_keyboard_underside(p, kb, col, pcb, zb - t, (xr, iy, nw, nd, hb))
    label(pcb, "The keyboard's circuit board (CEC-1): every key's switch, wired to the flat cable", "键盘电路板（CEC-1）")
    bl.parent(pcb, asm)
    sw = MeshBuilder()
    s = V(kp["switch"]["size"]) / 2
    shh = V(kp["switch"]["height"])
    for k in kb["keys"]:
        x, y = k["x"], k["y"]
        if k.get("arrow"):
            continue
        sw.prism(rounded_rect(x - s, y - s, x + s, y + s, 1.0, 2), "XY", 0.0, shh, "switch_dark")
        sw.prism([(x - s + 1, y - s + 1), (x + s - 1, y - s + 1), (x + s - 1, y + s - 1), (x - s + 1, y + s - 1)], "XY", zb, -sheet, "switch_dark")
    ax, ay = V(kp["arrows"]["centre"])
    for dx, dy in ((0, 12), (0, -12), (-12, 0), (12, 0)):
        sw.prism(rounded_rect(ax + dx - s, ay + dy - s, ax + dx + s, ay + dy + s, 1.0, 2), "XY", 0.0, shh, "switch_dark")
    so = sw.build("keyboard.switches", col)
    label(so, "The key switches", "按键开关")
    bl.parent(so, asm)
    for k in kb["keys"]:
        build_key(k, kp, col, asm)
    # the power lamp: a red lens on a post, filling the lid's small square hole from below
    # Its place is worked out from the hole: the hole's centre, just under
    # the deck's surface, taken into the plate's tilted frame
    c_ = Case(p)
    lh = p.raw["lid_openings"]["led"]
    hx, hyf = V(lh["centre"])
    hs = V(lh["size"])
    th_ = math.atan((V(pl["back_top_z"]) - V(pl["front_top_z"])) / math.sqrt(PD ** 2 - (V(pl["back_top_z"]) - V(pl["front_top_z"])) ** 2))
    dY, dZ = c_.Y(hyf) - V(pl["front_y"]), c_.deck_z(hyf) - 0.4 - V(pl["front_top_z"])
    ly = dY * math.cos(th_) + dZ * math.sin(th_)
    lz = -dY * math.sin(th_) + dZ * math.cos(th_)
    lx = hx
    # a red glass capsule standing on two long leads from the keyboard's circuit
    # board, up through a round hole in the plate, its domed top in the lid's square hole
    lp = kp["lamp"]
    r_ = V(lp["diameter"]) / 2
    cap_len = V(lp["length"])
    pcb_top = -V(kp["pcb"]["below_plate"])
    led = MeshBuilder()
    bottom = lz - cap_len
    prof = [(0.0, bottom), (r_ * 1.12, bottom), (r_ * 1.12, bottom + 0.8), (r_, bottom + 0.8), (r_, lz - r_)]
    for a_ in range(0, 91, 10):
        prof.append((r_ * math.cos(math.radians(a_)), lz - r_ + r_ * math.sin(math.radians(a_))))
    prof[-1] = (0.0, lz)
    led.lathe(prof, 20, "led_red", axis="Z")
    for dx in (-1.27, 1.27):            # the two leads, 2.54 apart, down to the board
        box(led, dx - 0.25, -0.25, pcb_top, dx + 0.25, 0.25, bottom, "tin")
    lo = led.build("led.power", col, location_mm=(lx, ly, 0))
    plate_o = bpy.data.objects["keyboard.plate"]
    hole = MeshBuilder()
    cyl(hole, lx, ly, -2.0, V(lp["plate_hole"]) / 2, "Z", 8.0, "steel_black", 24)
    boolean(plate_o, hole.build("_lamp_hole", col), tolerant=True)
    # the hole's cut leaves long thin triangles across the flat sheet; smooth shading would
    # bend the light across them: flat faces flat, only the groove's curves smooth
    shapes.shade_auto(plate_o, 20)
    plate_o.data.update()
    lo["motion"] = "light"
    label(lo, "The power lamp: a red glass lamp on two long leads from the keyboard's circuit board, up through the plate to the lid's square hole; red when the machine is on",
          "电源指示灯：红色玻璃灯，两根长引脚焊在键盘电路板上，穿过钢板伸到上盖的小方孔；开机时亮红灯")
    bl.parent(lo, asm)
    # tilt the assembly onto the plate's measured heights and put it in place
    th = math.atan((V(pl["back_top_z"]) - V(pl["front_top_z"])) / math.sqrt(PD ** 2 - (V(pl["back_top_z"]) - V(pl["front_top_z"])) ** 2))
    asm.rotation_euler = (th, 0.0, 0.0)
    asm.location = (0.0, V(pl["front_y"]) * bl.MM, V(pl["front_top_z"]) * bl.MM)
    bl.parent(asm, root)
    asm.location = (0.0, V(pl["front_y"]) * bl.MM, V(pl["front_top_z"]) * bl.MM)
    return asm


# --- the mainboard -----------------------------------------------------------------------

MARKINGS = {
    "U1": ["N3065", "4087"], "U4": ["4001/AA", "4087"], "U15": ["4005/AA", "4087"], "U17": ["8100/AA", "4387"],
    "U25": ["KB3600-PRO", "GI 8741"], "U13": ["9433C-0202", "GI 8743"], "U26": ["9433C-0201", "GI 8742"],
    "U33": ["MX231024-0059", "CECWL1"], "U34": ["MX231024-0060", "CECWL2"], "U5": ["M41464-15", "OKI"],
    "U6": ["M41464-15", "OKI"], "U30": ["TCA650"], "U32": ["74LS174"], "U19": ["NE558N"],
}


def part_geometry(mb, q, ref, to_xy, zt):
    """One board part on top of the board (zt), in machine coordinates."""
    bx0, by0, bx1, by1 = q["box"]
    (x0, y1), (x1, y0) = to_xy(bx0, by0), to_xy(bx1, by1)
    h = q["height"]
    kind = q["kind"]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    along_y = (y1 - y0) >= (x1 - x0)
    if kind.startswith("dip") and kind != "dipswitch":
        box(mb, x0, y0, zt, x1, y1, zt + 2.6, "socket_black")
        ix = 0.9
        box(mb, x0 + ix, y0 + 0.6, zt + 2.6, x1 - ix, y1 - 0.6, zt + h - 0.6, "ic_black", 0.4)
        # the legs along the long sides
        if along_y:
            for xx in (x0 + 0.4, x1 - 0.4):
                box(mb, xx - 0.3, y0 + 1.2, zt + 2.0, xx + 0.3, y1 - 1.2, zt + 3.4, "tin")
        else:
            for yy in (y0 + 0.4, y1 - 0.4):
                box(mb, x0 + 1.2, yy - 0.3, zt + 2.0, x1 - 1.2, yy + 0.3, zt + 3.4, "tin")
        # its decoupling capacitor at its far end
        if along_y:
            box(mb, cx - 2.2, y1 + 0.6, zt, cx + 2.2, y1 + 2.4, zt + 5.5, "cap_disc", 0.6)
        # (U7 and U35 carry paper stickers on the machine; the model shows their type instead)
    elif kind == "slot":
        box(mb, x0, y0, zt, x1, y1, zt + h, "socket_black", 0.5)
        box(mb, x0 + 3, cy - 0.9, zt + h - 6, x1 - 3, cy + 0.9, zt + h + 0.05, "hole_black")
    elif kind == "header":
        rows, cols = q["pins"]
        box(mb, x0, y0, zt, x1, y1, zt + 2.5, "socket_black")
        for i in range(rows):
            for j in range(cols):
                if along_y:
                    px = x0 + (i + 0.5) * (x1 - x0) / rows
                    py = y0 + (j + 0.5) * (y1 - y0) / cols
                else:
                    px = x0 + (j + 0.5) * (x1 - x0) / cols
                    py = y0 + (i + 0.5) * (y1 - y0) / rows
                box(mb, px - 0.32, py - 0.32, zt + 2.5, px + 0.32, py + 0.32, zt + h, "gold")
        if ref == "J9":       # the flat cable's plug sits on it
            box(mb, x0 - 1.5, y0 - 3, zt + 4.0, x1 + 1.5, y1 + 3, zt + h + 3, "socket_black", 0.5)
    elif kind == "din":
        box(mb, x0, y0, zt, x1 - 4, y1, zt + h, "socket_black", 0.8)
        cyl(mb, x1 - 2.5, cy, zt + h / 2, 7.0, "X", 5, "socket_black", 24)
    elif kind == "de9":
        box(mb, x0, y0, zt, x1 - 6, y1, zt + h * 0.6, "socket_black", 0.6)
        box(mb, x1 - 6, y0 - 3, zt, x1 - 5, y1 + 3, zt + h, "can_silver")
        box(mb, x1 - 5, y0 + 2, zt + 2, x1, y1 - 2, zt + h - 2, "can_silver", 1.5)
    elif kind == "can":
        box(mb, x0, y0, zt, x1, y1, zt + h, "can_silver", 0.6)
        box(mb, x0 + 3, y0 + 4, zt + h, x1 - 3, y1 - 4, zt + h + 0.1, "plate_blue", 0.6)
        text(mb, "RF-1", 6.0, Matrix.Translation((cx, cy, zt + h + 0.15)), "transformer_yellow", bold=0.15)
    elif kind == "dipswitch":
        # the red two-way switch: the slots side by side, running front to
        # back, "1 2" at the back and "OPEN" at the front, both sliders at the OPEN end
        box(mb, x0, y0, zt, x1, y1, zt + h, "dip_red", 0.4)
        sw, sl = 1.6, 4.6                       # a slot's width and length
        for i in range(2):
            xx = cx + (i - 0.5) * 2.6
            box(mb, xx - sw / 2, cy - sl / 2, zt + h - 0.6, xx + sw / 2, cy + sl / 2, zt + h + 0.02, "hole_black")
            box(mb, xx - sw / 2 + 0.1, cy - sl / 2 + 0.1, zt + h - 0.6, xx + sw / 2 - 0.1, cy - 0.1, zt + h + 0.5, "plastic_white", 0.2)
    elif kind == "crystal":
        box(mb, x0, y0, zt, x1, y1, zt + 4.5, "tin", 1.5)
    elif kind == "conn":
        box(mb, x0, y0, zt, x1, y1, zt + h, "plastic_white", 0.5)
    elif kind == "cap_e":
        r = min(x1 - x0, y1 - y0) / 2
        cyl(mb, cx, cy, zt + h / 2, r, "Z", h, "cap_blue", 16)
        cyl(mb, cx, cy, zt + h + 0.05, r * 0.85, "Z", 0.1, "tin", 16)
    elif kind == "coil":
        r = min(x1 - x0, y1 - y0) / 2
        cyl(mb, cx, cy, zt + (h - 0.4) / 2, r * 0.75, "Z", h - 0.4, "copper", 14)   # under the rings' tops
        cyl(mb, cx, cy, zt + h - 1, r, "Z", 2, "coil_black", 16)
        cyl(mb, cx, cy, zt + 1, r, "Z", 2, "coil_black", 16)
    elif kind == "trimmer":
        r = min(x1 - x0, y1 - y0) / 2
        cyl(mb, cx, cy, zt + h / 2, r, "Z", h, "trimmer_yellow", 16)
        cyl(mb, cx, cy, zt + h + 0.4, r * 0.6, "Z", 0.8, "trimmer_red", 12)
    elif kind == "res":
        # a resistor lying on the board: a tan body with colour bands, its leads bent down
        ax = "Y" if along_y else "X"
        L = max(x1 - x0, y1 - y0)
        r = min(x1 - x0, y1 - y0) / 2 - 0.2
        zc = zt + 0.6 + r
        cyl(mb, cx, cy, zc, r, ax, L - 2.4, "resistor_tan", 8)          # 8 sides: a 2 mm body (the triangle budget)
        for k, m_ in enumerate(("band_brown", "band_black", "band_red", "band_gold")):
            o_ = -L / 2 + 1.8 + k * 0.9 + (0.5 if k == 3 else 0.0)
            px_, py_ = (cx, cy + o_) if along_y else (cx + o_, cy)
            cyl(mb, px_, py_, zc, r + 0.05, ax, 0.45, m_, 8)
        for e in (-1, 1):
            px_, py_ = (cx, cy + e * (L / 2 - 0.6)) if along_y else (cx + e * (L / 2 - 0.6), cy)
            box(mb, px_ - 0.25, py_ - 0.25, zt, px_ + 0.25, py_ + 0.25, zc, "tin")
            q0, q1 = (cx, cy + e * (L / 2 - 1.2)), (cx, cy + e * (L / 2 - 0.35))
            if not along_y:
                q0, q1 = (cx + e * (L / 2 - 1.2), cy), (cx + e * (L / 2 - 0.35), cy)
            box(mb, min(q0[0], q1[0]) - 0.25, min(q0[1], q1[1]) - 0.25, zc - 0.25, max(q0[0], q1[0]) + 0.25, max(q0[1], q1[1]) + 0.25, zc + 0.25, "tin")
    elif kind == "disc":
        # a dipped capacitor standing on its two legs
        box(mb, cx - 0.3, cy - 0.3, zt, cx + 0.3, cy + 0.3, zt + 2.0, "tin")
        box(mb, x0, y0, zt + 1.5, x1, y1, zt + h, "cap_disc", 1.2)
    elif kind == "film":
        box(mb, x0, y0, zt, x1, y1, zt + h, "cap_film", 1.0)
    elif kind == "tr":
        # a TO-92 transistor: a half-round black body, flat face to the front, on three legs
        for k in (-1, 0, 1):
            box(mb, cx + k * 1.27 - 0.2, cy - 0.2, zt, cx + k * 1.27 + 0.2, cy + 0.2, zt + 1.5, "tin")
        cyl(mb, cx, cy + 0.4, zt + 1.5 + (h - 1.5) / 2, (x1 - x0) / 2, "Z", h - 1.5, "ic_black", 16)
        box(mb, x0 - 0.01, y0, zt + 1.5, x1 + 0.01, cy + 0.4, zt + h, "ic_black")
    elif kind == "sip":
        # a single-row resistor pack, red
        box(mb, x0, y0, zt, x1, y1, zt + h, "dip_red", 0.5)
    else:
        box(mb, x0, y0, zt, x1, y1, zt + h, "ic_black", 0.5)
    # markings on the named chips
    lines = MARKINGS.get(ref) or q.get("marking")      # read off the chip, or the book's type (board.json)
    if lines:
        top = zt + h - 0.6 + 0.03
        # as printed on the machine: seen from above, read from the back down to the
        # front, the letters' tops toward the right; the first line rightmost
        rot = Matrix.Rotation(-math.pi / 2, 4, "Z") if along_y else Matrix.Identity(4)
        size = 2.6 if kind in ("dip40", "dip28", "dip24") else 2.0
        for i, s in enumerate(lines):
            off = (i - (len(lines) - 1) / 2) * size * 1.5
            dx, dy = (-off, 0) if along_y else (0, -off)
            text(mb, s, size, Matrix.Translation((cx + dx, cy + dy, top)) @ rot, "ic_mark", max_w=(max(x1 - x0, y1 - y0) - 4))


def build_board(p, col, root):
    mbp = p.raw["main_board"]
    W, D, T = V(mbp["size"])
    zt = V(mbp["top_z"])
    ox, oy = V(mbp["back_left"])                 # the board's outline
    px0, py0 = V(mbp["parts_origin"])            # what board.json's positions are measured from
    bd = load_json("board.json")

    def to_xy(bx, by):
        return px0 + bx, py0 - by

    mb = MeshBuilder()
    mb.prism(rounded_rect(ox, oy - D, ox + W, oy, 1.5, 3), "XY", zt - T, zt, "pcb_green")
    # the printed name, and the Kaige sticker with the board's number
    text(mb, "ZH-1(875)", 7.0, Matrix.Translation((ox + 52, oy - D + 5.5, zt + 0.03)), "silk_white", bold=0.1)
    box(mb, ox + 85, oy - D + 1.5, zt, ox + 125, oy - D + 10, zt + 0.12, "paper")
    box(mb, ox + 86, oy - D + 2.5, zt + 0.12, ox + 93, oy - D + 9, zt + 0.2, "logo_red")
    for sx, sy in ((W - 6, 6), (6, D - 6), (W - 6, D - 6), (W / 2, D - 6)):   # (none under RF-1, at the back left)
        x, y = to_xy(sx, sy)
        cyl(mb, x, y, zt + 0.8, 2.8, "Z", 1.6, "screw_silver", 14)
    named = []
    for q in bd["parts"]:
        if q["label"]:
            named.append(q)
            continue
        part_geometry(mb, q, q["ref"], to_xy, zt)
    board = mb.build("board.main", col)
    label(board, "The mainboard ZH-1(875): the 6502, 64 KB of RAM, the ROMs and the two 1-Mbit Chinese font ROMs",
          "主板 ZH-1(875)：6502、64 KB 内存、ROM 和两片 1 兆位汉字字库 ROM")
    bl.parent(board, root)
    # the monitor socket: an RCA socket on a bent metal bracket standing on the board behind
    # the 监视器 hole (the TV socket and the blank hole are RF-1's)
    c_ = Case(p)
    bp_ = p.raw["base"]["back_panel"]
    mx = next(x for kind, x, _ in V(bp_["jacks"]) if kind == "monitor")
    mz = c_.bottom + V(bp_["jack_z"])
    yb_ = c_.Y(c_.D)
    ms = MeshBuilder()
    box(ms, mx - 5.0, yb_ - 14.0, zt, mx + 5.0, yb_ - 13.0, mz + 6.0, "tin")            # the bracket's upright
    box(ms, mx - 5.0, yb_ - 14.0, zt, mx + 5.0, yb_ - 8.0, zt + 1.0, "tin")              # its foot on the board
    for dx in (-3.5, 3.5):
        box(ms, mx + dx - 0.8, yb_ - 13.0, mz - 1.0, mx + dx + 0.8, yb_ - 3.0, mz + 1.0, "tin")   # the fork's two arms
    cyl(ms, mx, yb_ - 6.0, mz, 4.5, "Y", 6.0, "can_silver", 24)                          # the socket's sleeve
    mo_ = ms.build("part.monitor_socket", col)
    bl.set_labels(mo_, "The monitor socket (监视器): an RCA socket on a metal bracket, the composite video for a monitor or a TV's video input")
    mo_["label_zh"] = "监视器插座：金属支架上的 RCA 插座，复合视频信号，接监视器或电视机的视频输入"
    bl.parent(mo_, board)
    for q in named:
        pm = MeshBuilder()
        if q["ref"] in ("J2", "J3"):
            side_connector(pm, p, q["ref"])      # placed behind their openings, not from the photo
        elif q["ref"] == "J9":
            # the keyboard's connector: a right-angle 2 x 13 header at the board's
            # right, about 30 mm from its front, the plug going in from the right
            for b_ in j9_header(p):
                box(pm, *b_)
        elif q["ref"] == "J4":
            # the disk drive connector: a bare 2 x 10 pin header behind the 驱动器
            # opening, its pins pointing out through it, to the rear
            dr = bp_["drive"]
            (dx0, dx1), (dz0, dz1) = V(dr["x"]), V(dr["z"])
            hx = (dx0 + dx1) / 2
            face = yb_ - c_.wall - V(dr["header_inset"])
            pitch = 2.54
            # a right-angle header: its body low on the board, the two rows just above the
            # opening's lower edge
            row0, bh = V(dr["header_rows"])
            box(pm, hx - 13.2, face - 6.0, zt, hx + 13.2, face, zt + bh, "socket_black", 0.3)    # its plastic body
            for row in (0, 1):
                for i_ in range(10):
                    px_ = hx + (i_ - 4.5) * pitch
                    pz_ = zt + row0 + row * pitch
                    box(pm, px_ - 0.32, face - 6.0, pz_ - 0.32, px_ + 0.32, face + 6.0, pz_ + 0.32, "gold")
        elif q["ref"] == "RF1":
            # RF-1 stands just inside the back wall; the TV socket and the blank
            # hole's sleeve come out of its back face to their holes
            sl = V(bp_["rf_sleeve"])
            q = dict(q)
            by0 = py0 - (yb_ - c_.wall - sl)          # (board.json's frame)
            q["box"] = [q["box"][0], by0, q["box"][2], by0 + (q["box"][3] - q["box"][1])]
            part_geometry(pm, q, q["ref"], to_xy, zt)
            for kind, jx, _ in V(bp_["jacks"]):
                if kind in ("tv", "blank"):
                    cyl(pm, jx, yb_ - c_.wall - sl / 2, mz, 4.5, "Y", sl + 0.1, "can_silver", 24)
        else:
            part_geometry(pm, q, q["ref"], to_xy, zt)
        o = pm.build("part." + q["ref"].lower(), col)
        bl.set_labels(o, q["label"])
        if q.get("label_zh"):
            o["label_zh"] = q["label_zh"]
        bl.parent(o, board)
    return board


# --- the power supply, the speaker, the cables -------------------------------------------

def build_psu(p, col, root):
    ps = p.raw["power_supply"]
    w, d, h = V(ps["box"])
    x0, y1 = V(ps["box_at"])
    fl = V(p.raw["base"]["floor_z"])
    mb = MeshBuilder()
    # the power board: one long board at the mainboard's height, about half of it
    # inside the shield box, the rest out in front with the big parts
    bx0, by0, bx1, by1 = V(ps["board"])
    zt = V(p.raw["main_board"]["top_z"])
    mb.prism(rounded_rect(bx0, by1, bx1, by0, 1.0, 2), "XY", zt - 1.6, zt, "pcb_green")
    # the parts out in front of the box, placed from a photograph (5.4 px/mm): (x, y) in the machine's frame
    caps = (  # nine upright cylinders: x, y, radius, height, colour, top colour
        (-122.6, 14.6, 4.7, 12, "cap_blue", "tin"), (-112.4, 13.7, 4.7, 12, "cap_blue", "tin"),     # the pair, middle right
        (-147.6, 3.3, 6.5, 15, "cap_blue", "tin"), (-130.9, 4.2, 5.0, 13, "cap_green", "tin"),      # big blue, green
        (-166.1, -17.5, 4.6, 5, "trimmer_yellow", "trimmer_yellow"),                                 # the short golden one (a trimmer)
        (-145.8, -18.4, 5.2, 12, "cap_blue", "tin"), (-131.9, -17.5, 5.3, 13, "cap_green", "tin"),  # blue, large green
        (-123.6, -14.6, 2.8, 8, "wire_red", "tin"), (-114.3, -13.7, 3.7, 10, "cap_blue", "tin"),   # small red, small blue
    )
    for cx, cy, r, hh, mat, top in caps:
        cyl(mb, cx, cy, zt + (hh - 0.3) / 2, r, "Z", hh - 0.3, mat, 18)
        cyl(mb, cx, cy, zt + hh - 0.15, r * 0.82, "Z", 0.3, top, 18)
    for cx in (-147.6, -131.0):                    # two chokes lying down: copper windings on a black core
        cyl(mb, cx, -7.0, zt + 4.5, 4.0, "X", 9.0, "copper", 16)
        for e in (-5.0, 5.0):
            cyl(mb, cx + e, -7.0, zt + 4.5, 4.6, "X", 1.2, "coil_black", 16)
    # the small coil (a bobbin with a yellow band), left of the transformer's front
    box(mb, -172.6, 19.3, zt, -155.9, 33.5, zt + 9.0, "plastic_white", 1.0)
    box(mb, -172.0, 23.0, zt + 0.2, -156.5, 29.8, zt + 9.3, "transformer_yellow", 0.8)
    for cx in (-145.0, -140.5, -136.0):            # three diodes (864), standing along the board
        cyl(mb, cx, 29.5, zt + 1.6, 1.4, "Y", 7.0, "ic_black", 10)
        cyl(mb, cx, 29.5, zt + 1.6, 1.45, "Y", 1.0, "silk_white", 10)
    for cy in (11.0, 8.0, -5.0, -9.0):             # resistors on the left
        cyl(mb, -160.0, cy, zt + 1.2, 0.9, "X", 6.0, "resistor_tan", 8)
    for cx, cy in ((-169.0, 51.0), (-158.0, 51.0), (-169.0, 0.5)):   # transistors
        box(mb, cx - 2.2, cy - 1.2, zt, cx + 2.2, cy + 1.2, zt + 5.0, "ic_black", 0.8)
    # DC OUT: the five wires' solder pads by the board's front edge, red to orange left to right
    for i_ in range(5):
        cyl(mb, -137.0 + i_ * 5.0, by1 + 3.0, zt + 0.15, 1.2, "Z", 0.3, "tin", 10)
    # the transformer astride the box's front wall: a copper coil in a black frame open front
    # and back (its windings show there), a yellow tape round the frame marked TS0234
    tw_, td_, th_ = V(ps["transformer"])           # the frame's width, depth and height
    tcx, tcy = x0 + w - 0.8 - tw_ / 2, y1 - d       # against the box's right wall, inside
    fr = V(ps["transformer_frame"])                # the lip's thickness
    bh = V(ps["transformer_base"])                 # the base's height
    out = V(ps["coil_out"])
    tb = 10.0                                      # the tape's width
    # a black base and a black lip of one footprint, joined by two narrow side
    # walls under the tape; the copper coil stands on the base under the lip, seen from the
    # sides between them; the tape wraps the walls and the lip; the base, the coil and the lip
    # stand `out` beyond the tape front and back. No two faces share a plane (no flicker)
    L = tb + 2 * out
    y0_, y1_ = tcy - L / 2, tcy + L / 2
    box(mb, tcx - tw_ / 2, y0_, zt, tcx + tw_ / 2, y1_, zt + bh, "coil_black")                         # the base
    box(mb, tcx - tw_ / 2, y0_, zt + th_ - fr, tcx + tw_ / 2, y1_, zt + th_, "coil_black")             # the lip
    for sx in (-1, 1):                                                                                  # the side walls
        xo = tcx + sx * (tw_ / 2 - fr / 2)
        box(mb, xo - fr / 2, tcy - tb / 2 + 0.3, zt + bh - 0.1, xo + fr / 2, tcy + tb / 2 - 0.3, zt + th_ - fr + 0.1, "coil_black")
    cw, ch = tw_ - 2 * fr - 0.6, th_ - fr - bh - 0.4
    sec = rounded_rect(tcx - cw / 2, zt + bh + 0.1, tcx + cw / 2, zt + bh + 0.1 + ch, 3.0, 6)
    mb.prism(sec, "XZ", y0_ + 0.6, y1_ - 0.6, "copper")                                                # the coil
    box(mb, tcx - tw_ / 2 - 0.15, tcy - tb / 2, zt + bh + 0.3, tcx + tw_ / 2 + 0.15, tcy + tb / 2, zt + th_ + 0.15, "transformer_yellow")
    text(mb, "TS0234", 5.0, Matrix.Translation((tcx, tcy, zt + th_ + 0.2)), "ink_dark", max_w=tw_ - 2)
    # the shield: a box, open at the bottom, with its holes and the warning sticker
    sh = MeshBuilder()
    sh.prism([(x0, y1 - d), (x0 + w, y1 - d), (x0 + w, y1), (x0, y1)], "XY", fl + h - 0.8, fl + h, "shield_metal")
    # its two side walls only: no front wall (the power board and the transformer pass under
    # it into the box) and no back wall (the mains cord comes in there)
    for (a0, b0, a1, b1) in ((x0, y1 - d, x0 + 0.8, y1), (x0 + w - 0.8, y1 - d, x0 + w, y1)):
        sh.prism([(a0, b0), (a1, b0), (a1, b1), (a0, b1)], "XY", fl + 8, fl + h, "shield_metal")
    so = sh.build("_shield", col)
    holes = MeshBuilder()
    for hx, hy, r in ((x0 + 60, y1 - 50, 5.0), (x0 + 45, y1 - 64, 5.0), (x0 + 12, y1 - 68, 4.5)):
        cyl(holes, hx, hy, fl + h, r, "Z", 4, "shield_metal", 20)
    boolean(so, holes.build("_h", col), tolerant=True)      # (its walls overlap at the corners)
    v_, f_ = bl.mesh_data(so)
    bpy.data.objects.remove(so)
    mb.add_mesh_data(v_, f_, Matrix.Identity(4), "shield_metal")
    box(mb, x0 + 26, y1 - 32, fl + h, x0 + 68, y1 - 4, fl + h + 0.12, "paper")
    m = Matrix.Translation((x0 + 47, y1 - 18, fl + h + 0.16))
    text(mb, "高压危险", 4.4, m @ Matrix.Translation((0, 8, 0)), "pen_red", font=bl.FONT_CJK)
    text(mb, "请勿触摸", 4.4, m @ Matrix.Translation((0, -8, 0)), "pen_red", font=bl.FONT_CJK)
    bolt = [(-14, -1), (-2, 3), (-3, 0.5), (12, 2), (2, -2.5), (3, -0.2)]
    mb.add_mesh_data([(x, y, 0.02) for x, y in bolt], [tuple(range(len(bolt)))], m, "pen_red")
    o = mb.build("psu", col)
    label(o, "The power supply (SWENCO, Shekou): a switching supply under a shield marked 高压危险 (high voltage, do not touch)",
          "电源（西南电子，蛇口）：开关电源，屏蔽盒上写着“高压危险 请勿触摸”")
    bl.parent(o, root)
    return o


def build_speaker(p, col, root):
    """The speaker, facing up: a flat black base about two-thirds its
    width on the floor, a cone widening from the base's top to the rim, the rim's ring on top
    and the paper cone inside it, down to the dust cap."""
    s = p.raw["speaker"]
    x, y = V(s["centre"])
    r = V(s["diameter"]) / 2
    dd = V(s["depth"])
    fl = V(p.raw["base"]["floor_z"])
    rb, hb = r * 2 / 3, V(s["base_height"])
    z1 = fl + dd
    mb = MeshBuilder()
    cyl(mb, 0, 0, fl + hb / 2, rb, "Z", hb, "magnet", 32)                               # the base
    # one profile from the base's top out to the rim and in down the paper cone (its faces
    # turned as the whole profile's), in three pieces for their colours
    mb.lathe([(rb - 0.4, fl + hb), (r - 0.6, z1 - 1.2), (r, z1 - 0.8)], 40, "speaker_cone", axis="Z", flip=False)
    mb.lathe([(r, z1 - 0.8), (r, z1), (r - 3.0, z1)], 40, "speaker_rim", axis="Z", flip=False)
    mb.lathe([(r - 3.0, z1), (r * 0.3, z1 - 5.0), (r * 0.24, z1 - 4.4), (r * 0.12, z1 - 3.9), (0.0, z1 - 3.8)], 40, "speaker_cone", axis="Z", flip=False)
    # the two leads glued across the cone, black, from the dust cap out to the rim
    for a in (200.0, 0.0):
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        for k in range(6):
            t0 = r * 0.26 + k * (r * 0.55) / 6
            zz = z1 - 5.0 + (t0 - r * 0.3) / (r - 3.0 - r * 0.3) * 5.0 + 0.25
            box(mb, t0 * ca - 0.8, t0 * sa - 0.8, max(zz, z1 - 4.6) - 0.2, t0 * ca + 0.8, t0 * sa + 0.8, max(zz, z1 - 4.6) + 0.2, "magnet")
    o = mb.build("speaker", col, location_mm=(x, y, 0))
    label(o, "The speaker: the beep at power-on, the bell, MUSIC", "喇叭：开机的“哔”声、响铃、MUSIC 语句")
    bl.parent(o, root)
    return o


def loft_obj(name, rings, mat, col, n=8):
    """A closed solid through rounded rectangles across Y: rings of (y, x0, z0, x1, z1, r),
    front to back, capped at both ends; its faces turned outward. (The TV's
    cabinet and the tube's back, their edge rings bevelled by small insets at each end.)"""
    import bmesh
    mb = MeshBuilder()
    mi = mb._mat(mat)
    loops = []
    for (y, x0, z0, x1, z1, r) in rings:
        pts = rounded_rect(x0, z0, x1, z1, r, n)
        base = len(mb.verts)
        mb.verts += [(x, y, z) for x, z in pts]
        loops.append(list(range(base, base + len(pts))))
    m = len(loops[0])
    for a_, b_ in zip(loops, loops[1:]):
        for i in range(m):
            j = (i + 1) % m
            mb._add([a_[i], a_[j], b_[j], b_[i]], mi, True)
    for lp, (y, x0, z0, x1, z1, r) in ((loops[0], rings[0]), (loops[-1], rings[-1])):
        c = len(mb.verts)
        mb.verts.append(((x0 + x1) / 2, y, (z0 + z1) / 2))
        for i in range(m):
            mb._add([lp[i], lp[(i + 1) % m], c], mi, False)
    o = mb.build(name, col)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data)
    bm.free()
    shapes.shade_auto(o, 35)
    return o


def build_tv(p, col, root):
    """A colour TV of the 1980s: a generic 14-inch set, not
    a model of any; behind the computer, facing it. Its screen is built as the TRS-80 Video
    Display's (trs-80-simulator, build_video_display.py): the tube's glass a piece of a sphere,
    its middle level with the front, rounded corners and edges bowed outward; a dark tunnel
    narrowing from the rounded opening in the front back to the glass's rim; a dark band on
    the glass inside its outline; a backing behind. The glass stands out in front
    of the cabinet with a thick dark rim from the opening's edge to it, no silver line; thin
    borders. The controls on the right: fine vertical ribs, two knobs, the speaker's slots,
    a thin upright power button and its lamp. The picture is the
    page's, on tv.screen's UVs (0..1 across the glass)."""
    t = p.raw["tv"]
    W, D, H = V(t["size"])
    rw, rd, rh = V(t["rear"])
    fy, tx = V(t["front_y"]), V(t["x"])
    scx, scz = V(t["screen_centre"])
    cx = tx + scx
    x0, x1 = tx - W / 2, tx + W / 2
    foot = 4.0
    # the cabinet, rounded at its front corners, the opening cut through its front
    bv = 2.0                                           # the edge rings' bevel
    cab = loft_obj("_tvcab", [(fy, x0 + bv, foot + bv, x1 - bv, H - bv, 14.0 - bv), (fy + bv, x0, foot, x1, H, 14.0),
                              (fy + D - bv, x0, foot, x1, H, 14.0), (fy + D, x0 + bv, foot + bv, x1 - bv, H - bv, 14.0 - bv)], "tv_body", col)
    ow, oh, orr = V(t["screen_opening"])
    sx0, sx1, sz0, sz1 = cx - ow / 2, cx + ow / 2, scz - oh / 2, scz + oh / 2
    # the opening, its lip bevelled as the other edges: the cutter flares 2 mm at the front
    cut = loft_obj("_tvso", [(fy - 1.0, sx0 - bv - 1.0, sz0 - bv - 1.0, sx1 + bv + 1.0, sz1 + bv + 1.0, orr + bv + 1.0),
                             (fy + bv, sx0, sz0, sx1, sz1, orr), (fy + 70.0, sx0, sz0, sx1, sz1, orr)], "tv_surround", col)
    boolean(cab, cut)
    # the surround round the screen, level with the front
    bw, bd = V(t["bezel"])
    fb = fy - bd                                       # the bezel's face
    #
    # the glass: a piece of a sphere bulging toward the viewer, its outline bowed
    fw, fh, fr = V(t["tube_face"])
    tx0, tx1, tz0, tz1 = cx - fw / 2, cx + fw / 2, scz - fh / 2, scz + fh / 2
    R = V(t["sphere_radius"])
    bx, bz = V(t["outline_bow"])
    hx, hz = fw / 2, fh / 2

    proud = V(t["glass_proud"])

    def on_glass(x, z):
        return fb - proud + ((x - cx) ** 2 + (z - scz) ** 2) / (2 * R)

    def bowed(x, z):
        u, w = (x - cx) / hx, (z - scz) / hz
        return (cx + (x - cx) * (1 + bx / hx * max(0.0, 1 - w * w)),
                scz + (z - scz) * (1 + bz / hz * max(0.0, 1 - u * u)))

    rim = [bowed(x, z) for x, z in rounded_rect(tx0, tz0, tx1, tz1, fr, 12)]
    y_face = max(on_glass(x, z) for x, z in rim)
    # a short dark tunnel inside the bezel, from its face back to the glass's rim (hidden)
    tun = MeshBuilder()
    outer = shapes.ring_points(sx0, sz0, sx1, sz1, orr, 10, 40)
    innr = [bowed(x, z) for x, z in shapes.ring_points(tx0, tz0, tx1, tz1, fr, 10, 40)]
    nn = len(outer)
    for (x, z) in outer:
        tun.verts.append((x, fb, z))
    for (x, z) in innr:
        tun.verts.append((x, on_glass(x, z) - 0.5, z))
    mi = tun._mat("tv_surround")            # dark, framing the picture
    for i in range(nn):
        j = (i + 1) % nn
        tun._add([i, j, nn + j, nn + i], mi, False)
    tun_o = tun.build("_tvtun", col)
    me_ = tun_o.data
    if sum(f_.normal.y for f_ in me_.polygons) > 0:     # facing the viewer (-Y)
        me_.flip_normals()
    # a black backing inside the opening, behind the front
    yb_ = max(y_face, fy) + 1.0
    backing = prism_obj("_tvback", rounded_rect(sx0 - 1, sz0 - 1, sx1 + 1, sz1 + 1, orr + 1, 8), "XZ", yb_, yb_ + 1.0, "crt_rim", col)
    # the tube's back: tapering to a smaller end, its edges bevelled
    ew, eh = V(t["rear_end"])
    rz0 = scz - rh / 2
    ez0 = rz0 + (rh - eh) * 0.35                       # the end a little low, as the tube's neck
    rear = loft_obj("_tvrear", [(fy + D - 1.0, cx - rw / 2, rz0, cx + rw / 2, rz0 + rh, 30.0),
                                (fy + D + rd - bv, cx - ew / 2, ez0, cx + ew / 2, ez0 + eh, 20.0),
                                (fy + D + rd, cx - ew / 2 + bv, ez0 + bv, cx + ew / 2 - bv, ez0 + eh - bv, 20.0 - bv)], "tv_back", col)
    mb = MeshBuilder()
    for fx in (x0 + 30, x1 - 30):
        for fyy in (fy + 30, fy + D - 30):
            box(mb, fx - 12, fyy - 12, 0.0, fx + 12, fyy + 12, foot + 1.0, "tv_knob", 2.0)
    # the control panel on the right: a darker plate, the channel window, two knobs, the slots
    # the plate centred in the area right of the opening, 14 mm in from each side
    px0, px1 = sx1 + 14.0, x1 - 14.0
    px = (px0 + px1) / 2
    box(mb, px0, fy - 1.0, sz0, px1, fy + 0.5, sz1, "tv_front", 2.0)
    lw = 1.2                                # the ribs' and the slots' one width
    for k in range(12):                     # a band of fine vertical ribs above the knobs
        lx = px - 22 + k * 4.0
        box(mb, lx - lw / 2, fy - 1.6, sz1 - 40, lx + lw / 2, fy - 0.8, sz1 - 16, "tv_tube")
    knobs = ((sz1 - 66, "brightness", "亮度"), (sz1 - 112, "colour", "饱和度"))
    lab = MeshBuilder()
    for kz, _, zh in knobs:                 # their names under them, as sets of the time
        text(lab, zh, 5.0, Matrix.Translation((px, fy - 1.2, kz - 21.0)) @ Matrix.Rotation(math.pi / 2, 4, "X"), "silk_white", font=bl.FONT_CJK)
    lab_o = lab.build("_tvlab", col)
    for k in range(9):                      # the speaker's slots
        zz = sz0 + 52 + k * 4.0
        box(mb, px - 22, fy - 1.6, zz, px + 22, fy - 0.8, zz + lw, "tv_tube")
    extra = mb.build("_tvparts", col)
    shapes.shade_auto(cab, 30)
    body = shapes.merge("tv", [cab, tun_o, backing, rear, extra, lab_o], col)
    label(body, "A colour TV of the 1980s, on the computer's video (监视器) socket; a generic set, not a model of one",
          "八十年代的彩色电视机，接在学习机的视频（监视器）插座上；通用造型，不是某一型号")
    bl.parent(body, root)
    # the glass, UV-mapped for the page's picture
    scr = shapes.uv_grid("tv.screen", col, tx0, tx1, tz0, tz1,
                         lambda u, v: on_glass(tx0 + u * (tx1 - tx0), tz0 + v * (tz1 - tz0)),
                         "crt_glass", nx=28, nz=21, corner_r=fr, warp=bowed)
    label(scr, "The TV's screen: the picture tube's glass", "电视机屏幕：显像管的玻璃面")
    bl.parent(scr, body)
    # the dark band on the glass, just inside its outline (and a little over its edge)
    rw_ = V(t["rim_width"])
    outline = [bowed(x, z) for x, z in shapes.densify(rounded_rect(tx0, tz0, tx1, tz1, fr, 16), 3.0)]
    nr = len(outline)
    o_r, i_r = [], []
    for i in range(nr):
        (ax, az), (bx_, bz_) = outline[i - 1], outline[(i + 1) % nr]
        L = math.hypot(bx_ - ax, bz_ - az) or 1.0
        nx_, nz_ = -(bz_ - az) / L, (bx_ - ax) / L
        x, z = outline[i]
        o_r.append((x - nx_ * 2.0, z - nz_ * 2.0))
        i_r.append((x + nx_ * rw_, z + nz_ * rw_))
    rb_ = MeshBuilder()
    mi_ = rb_._mat("crt_rim")
    for (x, z) in o_r + i_r:
        rb_.verts.append((x, on_glass(x, z) - 0.3, z))
    for i in range(nr):
        j = (i + 1) % nr
        rb_._add([i, j, nr + j, nr + i], mi_, True)
    rim_o = rb_.build("tv.screen_rim", col)
    if sum(f_.normal.y for f_ in rim_o.data.polygons) > 0:
        rim_o.data.flip_normals()
    label(rim_o, "The dark band round the tube's glass", "显像管玻璃面四周的黑边")
    bl.parent(rim_o, body)
    # the power button, a thin upright push button at the panel's foot, and its lamp above
    #
    pz = sz0 + 20.0
    pb = MeshBuilder()
    box(pb, px - 8.5, fy - 6.0, pz - 14.0, px - 1.5, fy - 0.5, pz + 14.0, "tv_trim", 1.5)   # with the lamp, centred as a pair
    po = pb.build("tv.power", col)
    label(po, "The TV's power button: press to switch the TV on or off", "电视机电源开关：按下开或关")
    bl.parent(po, body)
    # the two knobs: brightness and colour; each turns about its own axis (the
    # page turns them by dragging, and the picture follows)
    for kz, nm, zh in knobs:
        kb = MeshBuilder()
        cyl(kb, 0.0, -2.0, 0.0, 15.0, "Y", 3.0, "tv_knob", 24)          # the skirt
        cyl(kb, 0.0, -8.0, 0.0, 12.5, "Y", 10.0, "tv_knob", 24)         # the cap
        box(kb, -1.0, -13.2, 4.0, 1.0, -12.9, 11.0, "tv_trim")          # its pointer line
        ko = kb.build(f"tv.knob.{nm}", col, location_mm=(px, fy, kz))
        en = "Brightness (亮度): drag to turn; the picture's black level rises" if nm == "brightness" else \
            "Colour (饱和度, saturation): drag to turn; all the way down, a black-and-white picture, as on the black-and-white sets the CEC-I was often used with"
        label(ko, en, f"{zh}：拖动旋转" + ("；画面的黑色变亮" if nm == "brightness" else "；转到底是黑白画面，如当年常用的黑白电视机"))
        ko["knob"] = nm
        bl.parent(ko, body)
    lb = MeshBuilder()
    cyl(lb, px + 6.0, fy - 1.8, pz + 8.0, 2.2, "Y", 2.0, "led_red", 16)
    lo = lb.build("tv.lamp", col)
    label(lo, "The TV's power lamp", "电视机电源指示灯")
    bl.parent(lo, body)
    return body


def build_cables(p, col, root, case):
    mbp = p.raw["main_board"]
    zt = V(mbp["top_z"])
    ox, oy = V(mbp["parts_origin"])              # board.json's positions are measured from here
    bd = {q["ref"]: q for q in load_json("board.json")["parts"]}
    # the keyboard's flat cable: 26 wires side by side in grey, the rearmost red;
    # a plug on J9 (pushed in from the right), out to the right, bent up and back to the left
    # into the plug on the keyboard's board, in its notch
    kp = p.raw["keyboard"]
    pl = kp["plate"]
    PW, PD, _ = V(pl["size"])
    th = math.atan((V(pl["back_top_z"]) - V(pl["front_top_z"])) / math.sqrt(PD ** 2 - (V(pl["back_top_z"]) - V(pl["front_top_z"])) ** 2))
    fy, fz = V(pl["front_y"]), V(pl["front_top_z"])

    def kb_world(x, y, z):                      # the keyboard's flat frame to the machine's
        return (x, fy + y * math.cos(th) - z * math.sin(th), fz + y * math.sin(th) + z * math.cos(th))

    pc = kp["pcb"]
    ix, iy = V(pc["inset"])
    zb, t = -V(pc["below_plate"]), V(pc["thickness"])
    nw, nd = V(pc["notch"])
    xr = PW / 2 - ix
    hb, hz0 = V(kp["cable"]["kb_header"])
    kz_local = zb + hz0                            # between the two pin rows, above the board
    k_face = xr - nw + 6.0 + 3.0                   # the keyboard plug's right face (x)
    k_lo, k_hi = kb_world(k_face, iy + nd / 2 - 16.5, kz_local), kb_world(k_face, iy + nd / 2 + 16.5, kz_local)
    _, _, yc, zr, m_face = j9_geometry(p)
    mz = zr + 1.27
    # the plugs: a black body on each header
    plugs = MeshBuilder()
    box(plugs, m_face - 9.0, yc - 18.0, mz - 3.5, m_face, yc + 18.0, mz + 3.5, "socket_black", 0.5)
    po_ = plugs.build("cable.plug_board", col)
    label(po_, "The flat cable's plug on J9", "扁平电缆在 J9 上的插头")
    bl.parent(po_, root)
    kplug = MeshBuilder()
    box(kplug, xr - nw + 0.3, iy + nd / 2 - 18.0, kz_local - 3.5, k_face, iy + nd / 2 + 18.0, kz_local + 3.5, "socket_black", 0.5)
    ko_ = kplug.build("keyboard.cable_plug", col)
    label(ko_, "The flat cable's plug on the keyboard's board, in its notch", "扁平电缆在键盘电路板缺口处的插头")
    ko_.parent = bpy.data.objects["keyboard"]          # built in the keyboard's own (flat) frame
    ko_.matrix_parent_inverse.identity()
    # the ribbon at rest: out of the J9 plug to the right, a
    # half loop up, left over the chips, folded back under the keyboard's board, right again,
    # and a half loop up and back left into the keyboard plug; its length kept (about 200 mm),
    # the fold's place found from it. The page reshapes it as the keyboard comes out
    kx, kzw = k_face, (k_lo[2] + k_hi[2]) / 2
    rb = kp["cable"]
    L_total = V(rb["length"])
    z_low = zt + V(rb["over_chips"])                 # the lower run, just over the chips
    z_up = kzw - V(rb["under_board"])                # the upper run, just under the keyboard's board

    def u_turn(x, z0, z1, right, n=10):
        """A half loop at x from height z0 up to z1, bulging right (or left)."""
        r = (z1 - z0) / 2
        zc = (z0 + z1) / 2
        sgn = 1 if right else -1
        return [(x + sgn * r * math.cos(math.radians(a)), zc + r * math.sin(math.radians(a))) for a in range(-90, 91, 180 // n)]

    def tight_turn(x, z0, z1, rb=2.0, n=6):
        """Out of the plug to the right and straight up beside the wall, then back left: two
        small bends."""
        pts = []
        for k in range(n + 1):                     # the lower bend, from rightward to upward
            a = math.radians(-90 + 90 * k / n)
            pts.append((x + rb * math.cos(a), z0 + rb + rb * math.sin(a)))
        for k in range(n + 1):                     # the upper bend, from upward to leftward
            a = math.radians(90 * k / n)
            pts.append((x + rb * math.cos(a), z1 - rb + rb * math.sin(a)))
        return pts

    def rest_path(x_fold):
        xr = m_face + 0.3          # the wall is 3.5 mm off: up at once
        pts = [(m_face, mz)] + tight_turn(xr, mz, z_low) + u_turn(x_fold, z_low, z_up, False) + u_turn(kx + 6.0, z_up, kzw, True) + [(kx + 4.0, kzw), (kx + 2.0, kzw), (kx, kzw)]   # straight into the plug
        return pts

    def plen(pts):
        return sum(math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]) for k in range(len(pts) - 1))

    lo_, hi_ = -150.0, kx - 5.0
    for _ in range(60):
        mid = (lo_ + hi_) / 2
        if plen(rest_path(mid)) > L_total:
            lo_ = mid
        else:
            hi_ = mid
    path = rest_path((lo_ + hi_) / 2)
    # resampled to points evenly along it, the same count the page uses
    N = 80
    acc = [0.0]
    for k in range(len(path) - 1):
        acc.append(acc[-1] + math.hypot(path[k + 1][0] - path[k][0], path[k + 1][1] - path[k][1]))
    even = []
    for q in range(N):
        target = acc[-1] * q / (N - 1)
        k = max(0, min(len(path) - 2, next((m for m in range(len(acc) - 1) if acc[m + 1] >= target), len(path) - 2)))
        t_ = (target - acc[k]) / max(1e-9, acc[k + 1] - acc[k])
        even.append((path[k][0] + (path[k + 1][0] - path[k][0]) * t_, path[k][1] + (path[k + 1][1] - path[k][1]) * t_))
    path = even
    n_ = len(path)
    # the sideways shift from J9's place to the keyboard plug's, made along the middle runs only:
    # square into both plugs
    def drift(i_):
        u = min(1.0, max(0.0, (i_ / (n_ - 1) - 0.2) / 0.6))
        return u * u * (3 - 2 * u)
    y_lo = [yc - 16.5 + (k_lo[1] - (yc - 16.5)) * drift(i_) for i_ in range(n_)]
    y_hi = [yc + 16.5 + (k_hi[1] - (yc + 16.5)) * drift(i_) for i_ in range(n_)]
    mb = MeshBuilder()
    half = 0.45
    for (f0, f1), mat in (((0.0, 25 / 26), "ribbon_grey"), ((25 / 26, 1.0), "ribbon_red")):
        verts, faces = [], []
        for i_, (x, z) in enumerate(path):
            a, b = path[max(i_ - 1, 0)], path[min(i_ + 1, n_ - 1)]
            dx, dz = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dz) or 1.0
            nx, nz = -dz / L * half, dx / L * half
            ya_ = y_lo[i_] + (y_hi[i_] - y_lo[i_]) * f0
            yb2 = y_lo[i_] + (y_hi[i_] - y_lo[i_]) * f1
            verts += [(x + nx, ya_, z + nz), (x + nx, yb2, z + nz), (x - nx, yb2, z - nz), (x - nx, ya_, z - nz)]
        for i_ in range(n_ - 1):
            q0, q1 = 4 * i_, 4 * (i_ + 1)
            for k_ in range(4):
                k2 = (k_ + 1) % 4
                faces.append((q0 + k_, q1 + k_, q1 + k2, q0 + k2))
        faces.append((0, 3, 2, 1))
        last = 4 * (n_ - 1)
        faces.append((last, last + 1, last + 2, last + 3))
        mb.add_mesh_data(verts, faces, Matrix.Identity(4), mat)
    # what the page needs to reshape it: the rest centre line, its ends, the width
    rest3 = [(x, (y_lo[i_] + y_hi[i_]) / 2, z) for i_, (x, z) in enumerate(path)]
    ko_["ribbon_end"] = bl.gltf_point((k_face, iy + nd / 2, kz_local))
    ko_["ribbon_end_dir"] = [1.0, 0.0, 0.0]                  # out of the plug, to the right
    ko_["ribbon_end_side"] = [0.0, 0.0, -1.0]                # across the ribbon, toward the back (+Y)
    o = mb.build("cable.ribbon", col)
    o["ribbon_rest"] = [c for q in rest3 for c in bl.gltf_point(q)]
    o["ribbon_width"] = 33.0
    o["ribbon_length"] = L_total
    o["ribbon_rise"] = V(rb["route"])[0]       # the route's rise over the side wall (glTF y, mm)
    o["ribbon_outside"] = V(rb["route"])[1]    # its line outside the plate's right edge (glTF x, mm)
    print("RIBBON rest", round(plen(path), 1), "mm, fold at x", round((lo_ + hi_) / 2, 1))
    label(o, "The keyboard's flat cable: 26 wires from J9 on the mainboard to the keyboard's circuit board (the red one marks wire 1)",
          "键盘的扁平电缆：26 根线，从主板的 J9 接到键盘电路板（红线是第 1 根）")
    o["motion"] = "stretch"
    bl.parent(o, root)
    # the power supply's five wires to the board's connector
    jp = bd["JP"]["box"]
    px_, py_ = ox + (jp[0] + jp[2]) / 2, oy - (jp[1] + jp[3]) / 2
    fl = V(p.raw["base"]["floor_z"])
    wm = MeshBuilder()
    # soldered straight to the power board by its front edge, red to orange left to
    # right; forward off the board, round to the right and back up the gap between the boards,
    # into the white connector on the mainboard's left, red at the back to orange at the front
    ps_ = p.raw["power_supply"]
    pby1 = V(ps_["board"])[3]
    jx0 = ox + jp[0]
    for i, mat in enumerate(("wire_red", "wire_yellow", "cord_black", "wire_white", "wire_orange")):
        sx = -137.0 + i * 5.0
        sy = pby1 + 3.0
        cy_ = oy - jp[1] - 3.0 - i * ((jp[3] - jp[1]) - 6.0) / 4      # back to front on the connector
        lane = -101.6 + (4 - i) * 0.0
        # into the connector from above: over it, then straight down into its top
        jcx = ox + (jp[0] + jp[2]) / 2
        jtop = zt + bd["JP"]["height"]
        bl.tube_path(wm, [(sx, sy, zt + 0.3), (sx, sy, zt + 3.0 + i * 0.4), (sx, pby1 - 6.0 - i * 1.6, zt + 3.0 + i * 0.4),
                          (lane, pby1 - 6.0 - i * 1.6, zt + 4.0 + i * 1.8), (lane, cy_, jtop + 3.0 + i * 1.2),
                          (jcx, cy_, jtop + 3.0 + i * 1.2), (jcx, cy_, jtop - 0.5)], 0.8, mat, n=8, bend=4.0)
    # the speaker's two wires, yellow and brown: out of its base on the side
    # toward the board, along the floor, up over the board's left edge and down into the top
    # of J8, the small white connector at the board's front left, as the power wires go into JP
    sp_ = p.raw["speaker"]
    scx, scy = V(sp_["centre"])
    srb = V(sp_["diameter"]) / 3
    j8 = bd["J8"]["box"]
    j8x, j8y = ox + (j8[0] + j8[2]) / 2, oy - (j8[1] + j8[3]) / 2
    j8top = zt + bd["J8"]["height"]
    ang = math.atan2(j8y - scy, j8x - scx)
    sm = MeshBuilder()
    bx_edge = V(mbp["back_left"])[0]                 # the board's left edge
    for i, mat in enumerate(("wire_brown", "wire_yellow")):      # brown at J8's left, yellow at its right
        e = (i - 0.5) * 2.5
        sx_, sy_ = scx + srb * math.cos(ang) - e * math.sin(ang), scy + srb * math.sin(ang) + e * math.cos(ang)
        ex_ = j8x + e
        bl.tube_path(sm, [(sx_, sy_, fl + 2.0), (bx_edge - 3.5, j8y + e, fl + 1.0),
                          (bx_edge - 2.5, j8y + e, zt + 6.0 + i * 1.2), (ex_ - 4.0, j8y + e * 0.3, j8top + 3.5 + i * 1.2),
                          (ex_, j8y, j8top + 3.0 + i * 1.2), (ex_, j8y, j8top - 0.5)], 0.6, mat, n=8, bend=4.0)
    so_ = sm.build("cable.speaker", col)
    label(so_, "The speaker's two wires, brown and yellow, to J8", "喇叭的两根线（棕、黄），接到 J8")
    bl.parent(so_, root)
    wo = wm.build("cable.power", col)
    label(wo, "The power supply's wires to the mainboard: +5 V, +12 V, -5 V, -12 V and ground", "电源到主板的连线")
    bl.parent(wo, root)
    # the mains cable out of the back through its grommet
    bp = p.raw["base"]["back_panel"]
    gx = mains_cord_x(p, case)
    yb = case.Y(case.D)
    gz = case.bottom + V(bp["mains_panel"]["bottom_z"]) + 3.0      # out of the panel's opening
    mm = MeshBuilder()
    # kept short: out of the panel, down to the table, a little way along it, so
    # the model's bounds stay close to the case (the viewer centres on them)
    bl.tube_path(mm, [(gx, yb - 2, gz), (gx, yb + 5, gz), (gx, yb + 14, 3.0), (gx + 6, yb + 30, 3.0)], 2.8, "cord_black", n=10, bend=8.0)
    mo = mm.build("cable.mains", col)
    label(mo, "The mains cable (220 V)", "电源线（220 伏）")
    bl.parent(mo, root)


# --- the whole machine -------------------------------------------------------------------

def build(p):
    bl.reset_scene()
    col = bpy.context.scene.collection
    root = bl.empty("cec-i", col)
    case = Case(p)
    build_base(p, case, col, root)
    build_lid(p, case, col, root)
    build_board(p, col, root)
    build_psu(p, col, root)
    build_speaker(p, col, root)
    build_keyboard(p, col, root)
    build_cables(p, col, root, case)
    build_tv(p, col, root)
    paths = {
        # up off the base, then set aside on the table to the left
        "case.lid": [(0, 0, 110), (-400, 0, 0), (0, 0, -110 - V(p.raw["case"]["seam_z"]) + 2.5)],
        "board.main": [(0, 0, 90)],
    }
    for name, moves in paths.items():
        bl.set_path(bpy.data.objects[name], moves)
    kb = bpy.data.objects["keyboard"]
    kb["motion"] = "flip"
    pl = p.raw["keyboard"]["plate"]
    # turned over forward about a line in front of the case, onto the table (as photographed)
    kb["flip_axis_point"] = bl.gltf_point((0.0, case.Y0 - 2.0, 0.0))
    kb["flip_lift"] = V(pl["size"])[2] + 20.0
    return root


def export(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", export_yup=True, export_extras=True, export_apply=True,
        export_cameras=False, export_lights=False, **bl.EXPORT_IMAGES)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = argv[argv.index("--out") + 1] if "--out" in argv else DEFAULT_OUT
    p = params.load()
    build(p)
    export(out)
    tris = {}
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        top = o
        while top.parent and top.parent.name != "cec-i":
            top = top.parent
        tris[top.name] = tris.get(top.name, 0) + sum(len(f.vertices) - 2 for f in o.data.polygons)
    total = sum(tris.values())
    print("CEC_BUILD_OK", out, f"{os.path.getsize(out) / 1e6:.2f} MB", f"triangles~{total}", json.dumps(tris))
