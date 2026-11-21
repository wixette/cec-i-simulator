"""Preview renders for checking the model against photographs of a real CEC-I.

  Blender --background --factory-startup --python render_previews.py -- [all|<view>]
Writes PNGs to model/blender/out/previews/ (git-ignored). Workbench, studio light, cavity on, so
shapes read clearly; the browser page is the place for materials. Each view is placed like
one of those photographs.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import build_machine as bm  # noqa: E402
from lib import params  # noqa: E402
from lib.bl import MM  # noqa: E402

OUT = os.path.join(params.MACHINE_DIR, "blender", "out", "previews")


def camera(name, loc_mm, target_mm, lens=50, ortho_mm=None):
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = lens
    cam_data.clip_start = 0.002
    if ortho_mm:
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = ortho_mm * MM
    cam = bpy.data.objects.new(name, cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = Vector(loc_mm) * MM
    d = Vector(target_mm) - Vector(loc_mm)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return cam


def setup_render():
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "MATERIAL"
    sc.display.shading.show_shadows = True
    sc.display.shading.show_cavity = True
    sc.display.shading.show_specular_highlight = True
    world = bpy.data.worlds.new("w")
    world.color = (0.05, 0.05, 0.06)   # the photos' dark cloth
    sc.world = world


def render(cam, name, res=(1600, 1000)):
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.camera = cam
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print("RENDERED", sc.render.filepath)


VIEWS = {
    # straight down, as the top's photographs
    "top": lambda: render(camera("c", (0, 0, 1500), (0, 0, 0), ortho_mm=420), "p01_top_ortho.png", (1600, 1220)),
    # the side profile
    "left": lambda: render(camera("c", (-1500, 0, 45), (0, 0, 45), ortho_mm=300), "p02_left_ortho.png", (1600, 600)),
    "right": lambda: render(camera("c", (1500, 0, 45), (0, 0, 45), ortho_mm=300), "p03_right_ortho.png", (1600, 600)),
    "back": lambda: render(camera("c", (0, 1500, 45), (0, 0, 45), ortho_mm=390), "p04_back_ortho.png", (1600, 500)),
    "front": lambda: render(camera("c", (0, -1500, 45), (0, 0, 45), ortho_mm=390), "p05_front_ortho.png", (1600, 500)),
    # as images/photos/cec-i-front-left.jpg
    "front34": lambda: render(camera("c", (-420, -620, 520), (0, 0, 40), 42), "p06_front_left_three_quarter.png"),
    "rear34": lambda: render(camera("c", (520, 620, 420), (0, 0, 40), 42), "p07_back_right_three_quarter.png"),
    "keys": lambda: render(camera("c", (40, -260, 260), (10, -40, 55), 50), "p08_keys_close.png"),
    "plate": lambda: render(camera("c", (64, -60, 200), (64, 30, 66), 50), "p09_nameplate.png"),
    # the back part from the left, nearly square on
    "leftback": lambda: render(camera("c", (-700, 75, 47), (0, 75, 47), ortho_mm=150), "p15_left_back.png", (1500, 1125)),
    # the left end from straight above
    "cornerstop": lambda: render(camera("c", (-160, -5, 900), (-160, -5, 0), ortho_mm=290), "p16_left_end_top.png", (800, 1900)),
    "corner34": lambda: render(camera("c", (-330, -260, 160), (-170, -110, 45), 40), "p17_front_left_corner.png"),
    # where the keyboard part meets the raised part, from the left
    "junction": lambda: render(camera("c", (-600, 62, 66), (0, 62, 66), ortho_mm=50), "p18_junction.png", (1168, 740)),
    "junction34": lambda: render(camera("c", (-250, 140, 110), (-178, 50, 60), 50), "p19_junction_34.png"),
    # the rocker from the side, and from above
    "rocker": lambda: render(camera("c", (-400, 86, 37), (0, 86, 37), ortho_mm=40), "p20_rocker_side.png", (800, 400)),
    "rockertop": lambda: render(camera("c", (-182, 86, 300), (-182, 86, 0), ortho_mm=60), "p21_rocker_top.png", (800, 400)),
    "rocker34": lambda: render(camera("c", (-250, 30, 80), (-183, 86, 37), 50), "p22_rocker_34.png", (1000, 700)),
    # the front edges from the left side
    "frontside": lambda: render(camera("c", (-700, -105, 30), (0, -105, 30), ortho_mm=80), "p23_front_side.png", (1050, 876)),
    # the grille from the front, above
    "grille": lambda: render(camera("c", (-125, -170, 330), (-125, 95, 72), 50), "p24_grille.png", (1500, 1125)),
    # the expansion slot's opening, closed and open
    "slot": lambda: render(camera("c", (66, -60, 330), (66, 90, 70), 50), "p25_slot_closed.png"),
    "slotopen": lambda: (setattr(bpy.data.objects["case.flap"].rotation_euler, "x", -1.5708), render(camera("c", (66, -60, 330), (66, 90, 70), 50), "p26_slot_open.png")),
    "lamp": lambda: render(camera("c", (146.15, 12, 95), (146.15, 24.4, 64.3), 50), "p27_lamp.png", (900, 700)),
    "arrows": lambda: render(camera("c", (110, -60, 150), (151.5, -38, 60), 45), "p28_arrows.png", (1200, 900)),
    "cjkkeys": lambda: render(camera("c", (-95, -140, 150), (-95, -80, 50), 45), "p29_cjk_keys.png", (1400, 800)),
    "numrow": lambda: render(camera("c", (-40, -40, 175), (-40, 0, 60), 40), "p30_number_row.png", (1600, 700)),
    "signs": lambda: render(camera("c", (65, -90, 190), (65, -30, 52), 40), "p31_signs.png", (1600, 1100)),
    "rightjacks": lambda: render(camera("c", (500, 60, 25), (0, 60, 25), ortho_mm=110), "p32_right_jacks.png", (1400, 700)),
    "rightjacks34": lambda: render(camera("c", (290, 0, 60), (180, 60, 22), 45), "p33_right_jacks_34.png", (1400, 900)),
    "din": lambda: (setattr(bpy.data.objects["case.base"], "hide_render", True), render(camera("c", (260, 86, 22.5), (0, 86, 22.5), ortho_mm=26), "p34_din.png", (900, 900))),
    "rfpsu": lambda: ([setattr(bpy.data.objects[n], "hide_render", True) for n in ("case.lid", "keyboard")], render(camera("c", (-110, 20, 320), (-110, 100, 20), 45), "p35_rf_psu.png", (1500, 900))),
    "jacks": lambda: render(camera("c", (-58, 400, 19.5), (-58, 0, 19.5), ortho_mm=60), "p36_jacks.png", (1200, 600)),
    "drive": lambda: render(camera("c", (60, 330, 70), (35, 120, 22), 40), "p37_drive.png", (1200, 800)),
    "screw": lambda: render(camera("c", (-50, 200, 70), (-81, 135, 48), 50), "p38_screw.png", (900, 700)),
    "stickers_back": lambda: render(camera("c", (20, 600, 28), (20, 0, 28), ortho_mm=300), "p39_stickers_back.png", (2000, 500)),
    "groove": lambda: (setattr(bpy.data.objects["case.lid"], "hide_render", True), render(camera("c", (120, -40, 140), (150, 10, 50), 40), "p40_groove.png", (1200, 800))),
    "spaceend": lambda: render(camera("c", (-150, -150, 90), (-100, -98, 48), 45), "p41_space_end.png", (1000, 800)),
    "ribbon": lambda: ([setattr(bpy.data.objects[n], "hide_render", True) for n in ("case.lid", "case.base")], render(camera("c", (330, -170, 90), (160, -82, 22), 40), "p42_ribbon.png", (1300, 900))),
    "bottom": lambda: render(camera("c", (0, 0, -1500), (0, 0, 0), ortho_mm=420), "p10_bottom_ortho.png", (1600, 1220)),
}


def open_views():
    lid = bpy.data.objects["case.lid"]
    lid.location.z += 120 * MM
    render(camera("c", (-420, -620, 620), (0, 0, 60), 40), "p11_lid_up.png")
    lid.location.z -= 120 * MM
    lid.hide_render = True
    render(camera("c", (0, -10, 900), (0, 0, 0), ortho_mm=420), "p12_inside_top_ortho.png", (1600, 1220))
    kb = bpy.data.objects["keyboard"]
    kb.hide_render = True
    render(camera("c", (0, -10, 900), (0, 0, 0), ortho_mm=420), "p13_board_top_ortho.png", (1600, 1220))
    render(camera("c", (-300, -380, 300), (-20, 20, 10), 40), "p14_board_oblique.png")


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    which = argv[0] if argv else "all"
    os.makedirs(OUT, exist_ok=True)
    bm.build(params.load())
    setup_render()
    for k, f in VIEWS.items():
        if which in ("all", k):
            f()
    if which in ("all", "open"):
        open_views()
    _ = math
    print("PREVIEWS_OK", OUT)
