"""Generate model/params/keyboard_matrix.json: each key's place in the keyboard matrix (X0-X7, Y0-Y9),
read from the keyboard ROM (roms/u26.*): its codes come in groups of four (normal, Shift, Ctrl,
both), group 10 * X + Y; the books' examples agree (Book 2 §4, fig. 4-19: S is X0 Y5, L X1 Y4,
3 X3 Y0). Ctrl, the Shifts, Caps Lock and Reset are not in the matrix: each has its own line
on the 26-way cable (fig. 4-19 (b)).

    python3 -I model/tools/make_matrix.py
"""

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CHAR_KEY = {"'": "quote", "`": "grave", "-": "minus", ",": "comma", "=": "equal", ".": "period",
            "\\": "backslash", "/": "slash", "[": "lbracket", "]": "rbracket", ";": "semicolon", " ": "space"}
CODE_KEY = {20: "f4", 6: "f5", 31: "zhongwen", 27: "esc", 9: "tab", 17: "xiwen", 3: "quit", 8: "left",
            22: "test", 1: "f1", 11: "up", 12: "f2", 10: "down", 23: "f3", 13: "return", 21: "right"}


def main():
    rom = open(os.path.join(ROOT, "..", "roms", "u26.9433c-0201.rcl-zh-16.bin"), "rb").read()
    out = {}
    for g in range(80):
        code = rom[4 * g] & 0x7F
        if code == 0:
            continue
        x, y = divmod(g, 10)
        ch = chr(code)
        if code in CODE_KEY:
            kid = CODE_KEY[code]
        elif ch.isalnum():
            kid = ch.lower()
        else:
            kid = CHAR_KEY[ch]
        out[kid] = [x, y]
    for kid, net in (("ctrl", "CTRL"), ("lshift", "SHIFT"), ("rshift", "SHIFT"), ("capslock", "CAPLOCK"), ("reset", "RESET")):
        out[kid] = net
    doc = {"_generated": "by model/tools/make_matrix.py from the keyboard ROM U26; do not edit",
           "_note": "[X, Y]: the key joins line X (scanned by the KB3600) and line Y (read back); a name: the key's own line on the cable",
           "keys": out}
    with open(os.path.join(ROOT, "params", "keyboard_matrix.json"), "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"keyboard_matrix.json: {len(out)} keys")


if __name__ == "__main__":
    main()
