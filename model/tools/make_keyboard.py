"""Generate model/params/keyboard.json from model/params/machine.json: every key's place and shape.

    python3 -I tools/make_keyboard.py

The layout is a real machine's (photographed from above with a ruler, and measured): five
rows on an 18.9 mm pitch, the F-row above, the four arrow keys in their own square. Each
key gets its cap's centre in the keyboard's flat frame (x across, y along the plate from
its front edge; machine.json "keyboard"), its bottom size, its outline if it is not a plain
rectangle, its top's dish, and its legends. Never edit keyboard.json by hand.
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

GAP = 1.9  # between caps: 18.9 pitch, 17.0 cap

# Each row: [id, legend lines (main first, a shifted legend above it as a second line), width in pitches].
# Legend lines are drawn top-left, as printed on the caps.
ROWS = {
    "r1": (0.0, [
        ("esc", ["Esc"], 1), ("1", ["1", "!"], 1), ("2", ["2", "@"], 1), ("3", ["3", "#"], 1),
        ("4", ["4", "$"], 1), ("5", ["5", "%"], 1), ("6", ["6", "^"], 1), ("7", ["7", "&"], 1),
        ("8", ["8", "*"], 1), ("9", ["9", "("], 1), ("0", ["0", ")"], 1), ("minus", ["-", "_"], 1),
        ("equal", ["=", "+"], 1), ("backslash", ["\\", "|"], 1), ("reset", ["Reset"], 1)]),
    "r2": (0.0, [
        ("tab", ["Tab"], 1.5), ("q", ["Q"], 1), ("w", ["W"], 1), ("e", ["E"], 1), ("r", ["R"], 1),
        ("t", ["T"], 1), ("y", ["Y"], 1), ("u", ["U"], 1), ("i", ["I"], 1), ("o", ["O"], 1),
        ("p", ["P"], 1), ("lbracket", ["[", "{"], 1), ("rbracket", ["]", "}"], 1)]),
    "r3": (0.0, [
        ("ctrl", ["Ctrl"], 1.75), ("a", ["A"], 1), ("s", ["S"], 1), ("d", ["D"], 1), ("f", ["F"], 1),
        ("g", ["G"], 1), ("h", ["H"], 1), ("j", ["J"], 1), ("k", ["K"], 1), ("l", ["L"], 1),
        ("semicolon", [";", ":"], 1), ("quote", ["'", '"'], 1), ("grave", ["`", "~"], 1)]),
    "r4": (0.0, [
        ("lshift", ["Shift"], 2.25), ("z", ["Z"], 1), ("x", ["X"], 1), ("c", ["C"], 1), ("v", ["V"], 1),
        ("b", ["B"], 1), ("n", ["N"], 1), ("m", ["M"], 1), ("comma", [",", "<"], 1), ("period", [".", ">"], 1),
        ("slash", ["/", "?"], 1), ("test", ["Test"], 1), ("rshift", ["Shift"], 1.75)]),
    "r5": (2.15, [
        ("capslock", ["Caps", "Lock"], 1), ("zhongwen", ["中文"], 1), ("space", [], 8.1), ("xiwen", ["西文"], 1)]),
}


def v(d):
    return d["v"]


def main():
    with open(os.path.join(ROOT, "params", "machine.json"), encoding="utf-8") as f:
        m = json.load(f)
    kb = m["keyboard"]
    p = v(kb["pitch"])
    x0 = v(kb["slot_x0"])
    rows_y = v(kb["rows_y"])
    keys = []

    def add(kid, legends, x, y, w, d, row, **extra):
        k = {"id": kid, "node": f"key.{kid}", "row": row, "x": round(x, 2), "y": round(y, 2),
             "w": round(w, 2), "d": round(d, 2), "legends": legends, "dish": "lr", "legend_at": "top_left"}
        k.update(extra)
        keys.append(k)

    for row, (start, items) in ROWS.items():
        u = start
        for kid, legends, wu in items:
            x = x0 + (u + wu / 2) * p
            extra = {}
            if kid == "space":
                extra = {"dish": "convex", "w_top": v(kb["space"])[1]}
            if kid in ("zhongwen", "xiwen"):
                extra = {"legend_at": "centre"}
            if kid == "capslock":
                extra = {"latching": True, "latched_drop": v(kb["caps_lock_down"])}
            add(kid, legends, x, rows_y[row], wu * p - GAP, p - GAP, row, **extra)
            u += wu

    # Return: an inverted L over rows 2 and 3, 27 wide above and 23 below (measured)
    up_w, lo_w = v(kb["return"])
    right = x0 + 15 * p - GAP / 2
    top = rows_y["r2"] + (p - GAP) / 2
    bottom = rows_y["r3"] - (p - GAP) / 2
    mid = (rows_y["r2"] + rows_y["r3"]) / 2
    cx, cy = right - up_w / 2, mid
    outline = [(right - up_w, top), (right, top), (right, bottom), (right - lo_w, bottom),
               (right - lo_w, rows_y["r2"] - (p - GAP) / 2 - GAP / 2), (right - up_w, rows_y["r2"] - (p - GAP) / 2 - GAP / 2)]
    add("return", ["Return"], cx, cy, up_w, top - bottom, "r2", dish="fb",
        outline=[[round(a - cx, 2), round(b - cy, 2)] for a, b in outline])

    # The F-row: Quit, then F1-F5, touching
    fk = kb["fkeys"]
    cw, cd = v(fk["cap"])
    add("quit", ["Quit"], v(fk["quit_x"]), rows_y["f"], cw, cd, "f")
    for i in range(5):
        add(f"f{i + 1}", [f"F{i + 1}"], v(fk["f1_x"]) + i * v(fk["pitch"]), rows_y["f"], cw, cd, "f")

    # The arrows: an octagon (a square with its corners cut) split along its diagonals
    ar = kb["arrows"]
    acx, acy = v(ar["centre"])
    s = v(ar["size"]) / 2
    c = v(ar["corner_cut"])
    g = v(ar["gap"]) / 2
    # each piece: the octagon's quarter towards its direction, between the two diagonals
    pieces = {
        "up": [(-s + c, s), (s - c, s), (s - c * 0.5, s - c * 0.5), (0, 0), (-s + c * 0.5, s - c * 0.5)],
        "down": [(s - c, -s), (-s + c, -s), (-s + c * 0.5, -s + c * 0.5), (0, 0), (s - c * 0.5, -s + c * 0.5)],
        "left": [(-s, -s + c), (-s, s - c), (-s + c * 0.5, s - c * 0.5), (0, 0), (-s + c * 0.5, -s + c * 0.5)],
        "right": [(s, s - c), (s, -s + c), (s - c * 0.5, -s + c * 0.5), (0, 0), (s - c * 0.5, s - c * 0.5)],
    }
    dirs = {"up": (0, 1), "down": (0, -1), "left": (-1, 0), "right": (1, 0)}
    for name, poly in pieces.items():
        dx, dy = dirs[name]
        # shrink away from the diagonals by the gap: move the piece outward along its direction
        poly = [(a + dx * g * 1.41, b + dy * g * 1.41) for a, b in poly]
        xs, ys = [a for a, _ in poly], [b for _, b in poly]
        pcx, pcy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        add(name, [], acx + pcx, acy + pcy, max(xs) - min(xs), max(ys) - min(ys), "arrows", dish="flat",
            outline=[[round(a - pcx, 2), round(b - pcy, 2)] for a, b in poly], arrow=name)

    out = {
        "_generated": "by model/tools/make_keyboard.py from model/params/machine.json; do not edit",
        "frame": "the keyboard's flat frame: x across (machine X), y along the steel plate from its front edge, z up from the plate's top (mm)",
        "count": len(keys),
        "keys": keys,
    }
    with open(os.path.join(ROOT, "params", "keyboard.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"keyboard.json: {len(keys)} keys")


if __name__ == "__main__":
    main()
