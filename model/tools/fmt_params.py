"""Rewrite model/params/machine.json in the house style: one line per value entry ({v, unit, conf,
src}), nested groups indented. python3 -I model/tools/fmt_params.py"""

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "params", "machine.json")


def leaf(x):
    return isinstance(x, dict) and "v" in x or not isinstance(x, (dict, list)) or (
        isinstance(x, list) and all(not isinstance(i, dict) for i in x))


def dump(x, ind=0):
    if leaf(x):
        return json.dumps(x, ensure_ascii=False)
    pad = "  " * (ind + 1)
    if isinstance(x, list):
        return "[\n" + ",\n".join(pad + dump(i, ind + 1) for i in x) + "\n" + "  " * ind + "]"
    items = [f"{pad}{json.dumps(k, ensure_ascii=False)}: {dump(v, ind + 1)}" for k, v in x.items()]
    return "{\n" + ",\n".join(items) + "\n" + "  " * ind + "}"


if __name__ == "__main__":
    with open(PATH, encoding="utf-8") as f:
        d = json.load(f)
    with open(PATH, "w", encoding="utf-8") as f:
        f.write(dump(d) + "\n")
