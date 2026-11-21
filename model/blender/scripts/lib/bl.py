"""bpy helpers: scene reset, materials, and a mesh builder working in millimetres."""

import math

import os

import bpy
from mathutils import Matrix, Vector

MM = 0.001  # Blender scene is in metres; all helper inputs are in mm.


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 1.0
    sc.unit_settings.length_unit = "MILLIMETERS"
    return sc


# --- materials -------------------------------------------------------------------

def _lin(hex_srgb):
    """sRGB '#RRGGBB' -> linear RGB (Blender's base colour is linear)."""
    out = []
    for i in (1, 3, 5):
        c = int(hex_srgb[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(round(x, 4) for x in out)


MATERIALS = {
    # name: (base colour, linear RGB; metallic; roughness; texture kind or None)
    # Colours from model/params/machine.json "colours", and photographs of a real machine (a guide only).
    "case_plastic": (_lin("#D3CEC1"), 0.0, 0.62, None),      # the case as new: an off-white, matt-ish, toned down so it does not glare
    "flap_grey": (_lin("#C8C7C0"), 0.0, 0.62, None),         # the slot flap, a little greyer
    "key_tan": (_lin("#C1B5A3"), 0.0, 0.58, None),           # keycaps
    "ink_dark": (_lin("#2A2622"), 0.0, 0.55, None),          # key legends
    "steel_black": (_lin("#141414"), 0.3, 0.30, None),       # the keyboard's painted steel plate
    "switch_dark": (_lin("#1E1E1E"), 0.0, 0.60, None),       # switch housings and stems
    "pcb_green": (_lin("#4F7F55"), 0.0, 0.45, None),         # the mainboard
    "pcb_dark": (_lin("#25452C"), 0.0, 0.50, None),
    "trace_green": (_lin("#3F6B47"), 0.2, 0.40, None),       # copper under the keyboard board's green lacquer
    "silk_white": (_lin("#E8E8E0"), 0.0, 0.60, None),        # silkscreen
    "ic_black": (_lin("#1A1A1A"), 0.0, 0.60, None),
    "ic_mark": (_lin("#9A9A96"), 0.0, 0.60, None),           # chip markings, a faint grey
    "socket_black": (_lin("#101010"), 0.0, 0.70, None),
    "insert_grey": (_lin("#3C3C3C"), 0.0, 0.55, None),      # a socket's insert, a shade lighter than its holes
    "tin": ((0.70, 0.71, 0.72), 1.0, 0.35, None),            # leads, pins, crystal cans
    "gold": ((0.90, 0.62, 0.30), 1.0, 0.25, None),           # header pins
    "cap_disc": (_lin("#B4642C"), 0.0, 0.50, None),
    "resistor_tan": (_lin("#C9A27A"), 0.0, 0.55, None),      # resistors' bodies          # the orange-brown disc capacitors
    "cap_blue": (_lin("#2F62B0"), 0.0, 0.40, None),          # electrolytics
    "cap_green": (_lin("#5FA86A"), 0.0, 0.40, None),
    "trimmer_yellow": (_lin("#C9A23A"), 0.0, 0.45, None),
    "trimmer_red": (_lin("#8E2A1A"), 0.0, 0.50, None),
    "coil_black": (_lin("#1C1C1C"), 0.0, 0.50, None),
    "band_brown": (_lin("#5A3418"), 0.0, 0.55, None),          # resistors' colour bands
    "band_black": (_lin("#141414"), 0.0, 0.55, None),
    "band_red": (_lin("#B0261C"), 0.0, 0.55, None),
    "band_gold": (_lin("#B8963E"), 0.6, 0.40, None),
    "cap_film": (_lin("#A4502A"), 0.0, 0.45, None),            # the film capacitors, a deeper brown
    "copper": ((0.80, 0.42, 0.22), 1.0, 0.35, None),
    "dip_red": (_lin("#D2302A"), 0.0, 0.45, None),           # the DIP switch's body
    "plastic_white": (_lin("#E6E3DA"), 0.0, 0.55, None),     # connectors, the DIP switch's levers
    "ribbon_grey": (_lin("#A9A9A6"), 0.0, 0.60, None),       # the flat cable
    "ribbon_red": (_lin("#B02020"), 0.0, 0.60, None),        # its red edge
    "cord_black": ((0.012, 0.012, 0.012), 0.0, 0.50, None),
    "wire_red": (_lin("#C8261E"), 0.0, 0.50, None),
    "wire_yellow": (_lin("#E3C21E"), 0.0, 0.50, None),
    "wire_white": (_lin("#E8E6E0"), 0.0, 0.50, None),
    "wire_orange": (_lin("#E07A1E"), 0.0, 0.50, None),
    "rubber_black": ((0.012, 0.012, 0.012), 0.0, 0.85, None),  # the power switch, the grommet
    "foot_white": (_lin("#C9C3B2"), 0.0, 0.70, None),        # the feet, case-coloured
    "hole_black": ((0.002, 0.002, 0.002), 0.0, 1.00, None),  # openings
    "led_red": ((0.11, 0.006, 0.004), 0.0, 0.22, None),      # unlit; the page lights it
    "shield_metal": (_lin("#A79F80"), 0.85, 0.45, None),     # the power supply's galvanised shield
    "can_silver": (_lin("#B9BAB6"), 0.9, 0.35, None),        # the RF modulator's can
    "screw_silver": ((0.75, 0.75, 0.76), 1.0, 0.25, None),
    "label_black": (_lin("#141414"), 0.0, 0.55, None),       # the back labels
    "label_ink": (_lin("#E8E2D0"), 0.0, 0.60, None),         # their pale lettering
    "paper": (_lin("#ECE6D2"), 0.0, 0.80, None),             # stickers
    "pen_blue": (_lin("#2B3F8C"), 0.0, 0.70, None),          # the serial number, stamped in blue
    "pen_red": (_lin("#C0302A"), 0.0, 0.70, None),
    "plate_silver": ((0.74, 0.75, 0.77), 0.8, 0.30, None),   # the nameplate's metal-look field
    "plate_blue": (_lin("#2A4E9C"), 0.0, 0.40, None),        # its blue
    "stripe_red": (_lin("#D2382A"), 0.0, 0.40, None),
    "stripe_green": (_lin("#2E9A4A"), 0.0, 0.40, None),
    "stripe_blue": (_lin("#2A5CB4"), 0.0, 0.40, None),
    "logo_red": (_lin("#D0281E"), 0.0, 0.45, None),          # the Kaige logo
    "logo_white": (_lin("#F2F0EA"), 0.0, 0.50, None),
    "speaker_cone": (_lin("#2A2A2A"), 0.0, 0.85, None),
    "speaker_rim": (_lin("#8A6A4A"), 0.0, 0.70, None),
    "wire_brown": (_lin("#5A3A24"), 0.0, 0.50, None),
    "tv_body": (_lin("#A9ABAD"), 0.35, 0.42, None),           # the TV's cabinet: silver-grey, as colour sets of the late 1980s
    "tv_front": (_lin("#4A4C50"), 0.0, 0.45, None),           # its control panel, a darker grey
    "tv_surround": (_lin("#4A4C50"), 0.0, 0.50, None),        # the dark lip round the screen, framing the picture
    "tv_back": (_lin("#7A7C80"), 0.2, 0.50, None),            # the tube's tapered back, a darker grey
    "tv_trim": ((0.72, 0.73, 0.75), 1.0, 0.30, None),          # the silver line round the screen
    "tv_tube": (_lin("#060606"), 0.0, 0.35, None),            # the tube's black mask behind the glass
    "tv_knob": (_lin("#18181A"), 0.0, 0.40, None),
    "crt_glass": ((0.0704, 0.0976, 0.0931), 0.0, 0.32, None),  # the tube's face (as the TRS-80's); the page draws the picture
    "crt_rim": ((0.008, 0.008, 0.008), 0.0, 0.25, None),       # the dark band round the tube's face
    "magnet": (_lin("#3A3A3A"), 0.6, 0.45, None),
    "transformer_yellow": (_lin("#E0B830"), 0.0, 0.55, None),
}

# Textures repeat every UV_MM millimetres (box-projected UVs, see MeshBuilder.build).
UV_MM = 250.0
TEX_SIZE = {"brushed": 512, "net": 1024}


def _periodic_noise(rng, n, stretch_u, scale, beta=1.0):
    """Seamless (periodic) noise, n x n, rows = v and columns = u, normalised to 0..1.

    White noise filtered in Fourier space with a 1/f^beta falloff above 1/scale cycles
    per tile; stretch_u > 1 makes features long along u (grain, brushing)."""
    import numpy as np

    fv = np.fft.fftfreq(n)[:, None] * n
    fu = np.fft.fftfreq(n)[None, :] * n
    f = np.sqrt((fu * stretch_u) ** 2 + fv ** 2)
    amp = 1.0 / np.maximum(f, 1.0) ** beta * np.exp(-((f / scale) ** 2))
    amp[0, 0] = 0.0
    w = np.fft.ifft2(np.fft.fft2(rng.standard_normal((n, n))) * amp).real
    w -= w.min()
    return w / max(w.max(), 1e-9)


def _image(name, rgb, non_color, alpha=None):
    """Blender image from an (n, n, 3) array of linear values (rows = v, bottom row first),
    with an (n, n) alpha array if given (then kept as PNG in the .glb, not JPEG)."""
    import numpy as np

    n = rgb.shape[0]
    img = bpy.data.images.new(name, n, n, alpha=alpha is not None, float_buffer=False)
    img.file_format = "PNG" if alpha is not None else "JPEG"
    # set the colour space first: changing it regenerates (blanks) a generated image
    img.colorspace_settings.name = "Non-Color" if non_color else "sRGB"
    c = np.clip(rgb, 0.0, 1.0)
    if not non_color:  # pixels of an sRGB byte image are sRGB-encoded
        c = np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055)
    px = np.ones((n, n, 4), np.float32)
    px[..., :3] = c
    if alpha is not None:
        px[..., 3] = alpha
    img.pixels.foreach_set(px.ravel())
    return img


def _texture_images(name, kind, rgb, metallic, rough):
    """(base colour image or None, ORM image: G = roughness, B = metallic) for a material.

    Generated with a fixed seed, so rebuilds give the same .glb."""
    import numpy as np

    rng = np.random.default_rng(sum(map(ord, name)))
    n = TEX_SIZE[kind]
    if kind == "brushed":
        streak = _periodic_noise(rng, n, 40.0, n / 3)        # fine brushing along u
        patch = _periodic_noise(rng, n, 2.0, 12.0)           # soft wear patches
        r = rough * (0.82 + 0.28 * streak + 0.18 * (patch - 0.5))
        color = alpha = None
    elif kind == "net":
        # expanded metal: diamond holes in staggered rows, long across (u), as on SN #09;
        # 36 x 72 diamonds a tile, so the holes are about 6.9 x 3.5 mm and the tile repeats
        v, u = (np.mgrid[0:n, 0:n] + 0.5) / n
        du = (u * 36) % 1.0 - 0.5
        dv = (v * 72) % 1.0 - 0.5
        hole = np.minimum(np.abs(du) + np.abs(dv), np.abs(np.abs(du) - 0.5) + np.abs(np.abs(dv) - 0.5)) < 0.40
        alpha = np.where(hole, 0.0, 1.0)
        color = np.broadcast_to(np.asarray(rgb, np.float32), (n, n, 3)).copy()
        r = np.full((n, n), rough)
    else:
        raise ValueError(kind)
    orm = np.stack([np.ones_like(r), r, np.full_like(r, metallic)], -1)
    img_c = _image(f"{name}_color", color, False, alpha) if color is not None else None
    return img_c, _image(f"{name}_orm", orm, True)


def material(name):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    rgb, metallic, rough, kind = MATERIALS[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    mat.diffuse_color = (*rgb, 1.0)
    mat.use_backface_culling = True   # exported single-sided: every part is closed or faces the viewer
    if kind:
        img_c, img_orm = _texture_images(name, kind, rgb, metallic, rough)
        orm = nodes.new("ShaderNodeTexImage")
        orm.image = img_orm
        sep = nodes.new("ShaderNodeSeparateColor")
        links.new(orm.outputs["Color"], sep.inputs["Color"])
        links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
        links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])
        if img_c:
            col = nodes.new("ShaderNodeTexImage")
            col.image = img_c
            links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
            if kind == "net":
                # alpha clip, as the glTF exporter reads it (alphaMode MASK): 1 - (alpha < 0.5)
                lt = nodes.new("ShaderNodeMath")
                lt.operation = "LESS_THAN"
                lt.inputs[1].default_value = 0.5
                inv = nodes.new("ShaderNodeMath")
                inv.operation = "SUBTRACT"
                inv.inputs[0].default_value = 1.0
                links.new(col.outputs["Alpha"], lt.inputs[0])
                links.new(lt.outputs["Value"], inv.inputs[1])
                links.new(inv.outputs["Value"], bsdf.inputs["Alpha"])
                mat.use_backface_culling = False
    return mat


def is_textured(name):
    return MATERIALS[name][3] is not None


# glTF export settings shared by the build scripts: textures as JPEG, the net as PNG (it has alpha).
EXPORT_IMAGES = dict(export_image_format="AUTO", export_image_quality=88)   # each image in its own format (above)


# --- mesh building -------------------------------------------------------------------

# Plane mappings for 2D profiles (u, w) and the extrusion axis.
# "XZ": profile in the X-Z plane, extruded along +Y (shafts running front to back).
# "XY": profile in the X-Y plane, extruded along +Z (vertical shafts).
def _map(plane, u, w, t):
    if plane == "XZ":
        return (u, t, w)
    if plane == "XY":
        return (u, w, t)
    if plane == "YZ":
        return (t, u, w)
    raise ValueError(plane)


def _signed_area(poly):
    a = 0.0
    for i in range(len(poly)):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % len(poly)]
        a += x0 * y1 - x1 * y0
    return a / 2.0


class MeshBuilder:
    """Accumulates polygons (mm, in the node's local frame) with material slots."""

    def __init__(self):
        self.verts = []
        self.faces = []
        self.mat_idx = []
        self.smooth = []
        self.mats = []

    def _mat(self, name):
        if name not in self.mats:
            self.mats.append(name)
        return self.mats.index(name)

    def prism(self, poly, plane, t0, t1, mat, smooth=False, offset=(0.0, 0.0, 0.0)):
        """Extrude a closed 2D polygon from t0 to t1 along the plane's normal axis."""
        if _signed_area(poly) < 0:
            poly = list(reversed(poly))
        mi = self._mat(mat)
        n = len(poly)
        base = len(self.verts)
        ox, oy, oz = offset
        for t in (t0, t1):
            for u, w in poly:
                x, y, z = _map(plane, u, w, t)
                self.verts.append((x + ox, y + oy, z + oz))
        # Orientation: for XZ the extrusion axis +Y gives a left-handed (u,w,t) frame.
        flip = plane == "XZ"
        cap0 = list(range(base, base + n))
        cap1 = list(range(base + n, base + 2 * n))
        if flip:
            self._add(cap0, mi, False)
            self._add(list(reversed(cap1)), mi, False)
        else:
            self._add(list(reversed(cap0)), mi, False)
            self._add(cap1, mi, False)
        for i in range(n):
            a, b = base + i, base + (i + 1) % n
            c, d = b + n, a + n
            self._add([a, d, c, b] if flip else [a, b, c, d], mi, smooth)

    def lathe(self, profile, n, mat, axis="Y", offset=(0.0, 0.0, 0.0), flip=None):
        """Surface of revolution: profile is a list of (radius, t) from one end to the other,
        turned about the local axis ("Y" or "Z"); a radius of 0 closes that end."""
        mi = self._mat(mat)
        ox, oy, oz = offset
        rings = []
        for r, t in profile:
            ring = []
            for i in range(n if r > 1e-9 else 1):
                a = 2.0 * math.pi * i / n
                u, w = r * math.cos(a), r * math.sin(a)
                x, y, z = (u, t, w) if axis == "Y" else (u, w, t)
                ring.append(len(self.verts))
                self.verts.append((x + ox, y + oy, z + oz))
            rings.append(ring)
        # Unflipped faces point outward when t decreases along the profile for axis Y
        # ((u, t, w) is a left-handed frame) and when it increases for axis Z.
        # (flip given: a piece of a longer profile, oriented as that profile is)
        if flip is None:
            rising = profile[-1][1] > profile[0][1]
            flip = rising if axis == "Y" else not rising
        for k in range(len(rings) - 1):
            r0, r1 = rings[k], rings[k + 1]
            for i in range(n):
                j = (i + 1) % n
                if len(r0) == 1 and len(r1) == 1:
                    continue
                if len(r0) == 1:
                    f = [r0[0], r1[j], r1[i]]
                elif len(r1) == 1:
                    f = [r0[i], r0[j], r1[0]]
                else:
                    f = [r0[i], r0[j], r1[j], r1[i]]
                self._add(list(reversed(f)) if flip else f, mi, True)

    def tube(self, r_out, r_in, n, plane, t0, t1, mat, offset=(0.0, 0.0, 0.0)):
        """Hollow cylinder (a bushing) from t0 to t1 along the plane's normal axis."""
        mi = self._mat(mat)
        ox, oy, oz = offset
        base = len(self.verts)
        for t in (t0, t1):
            for r in (r_out, r_in):
                for i in range(n):
                    a = 2.0 * math.pi * i / n
                    x, y, z = _map(plane, r * math.cos(a), r * math.sin(a), t)
                    self.verts.append((x + ox, y + oy, z + oz))
        o0, i0, o1, i1 = base, base + n, base + 2 * n, base + 3 * n
        flip = plane == "XZ"
        for i in range(n):
            j = (i + 1) % n
            quads = [
                [o0 + i, o0 + j, o1 + j, o1 + i],      # outer wall
                [i0 + j, i0 + i, i1 + i, i1 + j],      # inner wall
                [o0 + j, o0 + i, i0 + i, i0 + j],      # cap at t0
                [o1 + i, o1 + j, i1 + j, i1 + i],      # cap at t1
            ]
            for k, q in enumerate(quads):
                self._add(list(reversed(q)) if flip else q, mi, k < 2)

    def hexa(self, bottom, top, mat):
        """A solid with a quadrilateral bottom and top (each 4 (x, y, z) points, counter-clockwise
        seen from above, top[i] over bottom[i]): a tapered post."""
        mi = self._mat(mat)
        base = len(self.verts)
        self.verts += [tuple(v) for v in bottom] + [tuple(v) for v in top]
        b = [base + i for i in range(4)]
        t = [base + 4 + i for i in range(4)]
        self._add(list(reversed(b)), mi, False)
        self._add(t, mi, False)
        for i in range(4):
            j = (i + 1) % 4
            self._add([b[i], b[j], t[j], t[i]], mi, False)

    def _add(self, face, mi, smooth):
        self.faces.append(face)
        self.mat_idx.append(mi)
        self.smooth.append(smooth)

    def add_mesh_data(self, verts, faces, matrix, mat):
        """Append raw mesh data (e.g. a converted text glyph) transformed by matrix (mm)."""
        mi = self._mat(mat)
        base = len(self.verts)
        for v in verts:
            p = matrix @ Vector(v)
            self.verts.append((p.x, p.y, p.z))
        for f in faces:
            self._add([base + i for i in f], mi, False)

    def build(self, name, collection, location_mm=(0, 0, 0)):
        me = bpy.data.meshes.new(name)
        me.from_pydata([(x * MM, y * MM, z * MM) for x, y, z in self.verts], [], self.faces)
        me.update()
        for m in self.mats:
            me.materials.append(material(m))
        me.polygons.foreach_set("material_index", self.mat_idx)
        me.polygons.foreach_set("use_smooth", self.smooth)
        me.validate()
        if any(is_textured(m) for m in self.mats):
            _box_uvs(me)
        if hasattr(me, "set_sharp_from_angle"):
            me.set_sharp_from_angle(angle=math.radians(40))
        obj = bpy.data.objects.new(name, me)
        obj.location = tuple(c * MM for c in location_mm)
        collection.objects.link(obj)
        return obj


def _box_uvs(me):
    """Box-projected UVs (1 unit = UV_MM): each face uses the plane across its normal's
    largest axis, with u along X where it can (grain and brushing run along the machine)."""
    import numpy as np

    n = len(me.polygons)
    nrm = np.empty(n * 3, np.float32)
    me.polygons.foreach_get("normal", nrm)
    axis = np.abs(nrm.reshape(n, 3)).argmax(1)
    loop_start = np.empty(n, np.int64)
    loop_total = np.empty(n, np.int64)
    me.polygons.foreach_get("loop_start", loop_start)
    me.polygons.foreach_get("loop_total", loop_total)
    lv = np.empty(len(me.loops), np.int64)
    me.loops.foreach_get("vertex_index", lv)
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3) / (UV_MM * MM)
    loop_axis = np.repeat(axis, loop_total)
    p = co[lv]
    u = np.where(loop_axis == 0, p[:, 1], p[:, 0])
    v = np.where(loop_axis == 2, p[:, 1], p[:, 2])
    uv = me.uv_layers.new(name="UVMap")
    uv.data.foreach_set("uv", np.stack([u, v], 1).ravel().astype(np.float32))


def empty(name, collection, location_mm=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    obj.location = tuple(c * MM for c in location_mm)
    collection.objects.link(obj)
    return obj


def parent(child, par):
    """Parent keeping the child's world position (build-time objects are unrotated).

    The child's location becomes relative to the parent and no parent-inverse matrix
    is used, so the glTF local transforms stay clean and easy to animate."""
    child.parent = par
    child.matrix_parent_inverse.identity()
    child.location = child.location - par.location


def glyph_mesh(text, size_mm, depth_mm):
    """Mesh data (verts in mm, faces) of a centred, extruded text string, facing +Z."""
    curve = bpy.data.curves.new("glyph_tmp", "FONT")
    curve.body = text
    curve.size = size_mm
    curve.extrude = depth_mm / 2.0
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.resolution_u = 3
    obj = bpy.data.objects.new("glyph_tmp", curve)
    bpy.context.scene.collection.objects.link(obj)
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    verts = [tuple(v.co) for v in me.vertices]
    faces = [tuple(p.vertices) for p in me.polygons]
    bpy.data.objects.remove(obj)
    bpy.data.curves.remove(curve)
    bpy.data.meshes.remove(me)
    if max_width_mm and verts:
        w = max(v[0] for v in verts) - min(v[0] for v in verts)
        if w > max_width_mm:
            k = max_width_mm / w
            verts = [(x * k, y * k, z) for x, y, z in verts]
    return verts, faces


_FONT_SCALE = {}


def font_scale(font):
    """Blender lays some OpenType fonts out small (the Noto CJK subsets about a third of the
    size asked for). Scale so that a CJK character's ink is 0.9 of the size asked for, and a
    capital letter's about 0.7, as in Blender's own font: measured once per font on 中."""
    if font not in _FONT_SCALE:
        curve = bpy.data.curves.new("glyph_probe", "FONT")
        curve.body = "中"
        curve.size = 10.0
        curve.font = bpy.data.fonts.load(font, check_existing=True)
        curve.fill_mode = "FRONT"
        obj = bpy.data.objects.new("glyph_probe", curve)
        bpy.context.scene.collection.objects.link(obj)
        dg = bpy.context.evaluated_depsgraph_get()
        dg.update()
        me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
        ys = [v.co.y for v in me.vertices]
        h = (max(ys) - min(ys)) if ys else 9.0            # a font without 中 keeps its own size
        bpy.data.objects.remove(obj)
        bpy.data.curves.remove(curve)
        bpy.data.meshes.remove(me)
        _FONT_SCALE[font] = 9.0 / h
    return _FONT_SCALE[font]


def glyph_mesh_flat(text, size_mm, align="CENTER", bold_mm=0.0, spacing=1.0, font=None, max_width_mm=None):
    """Mesh data (verts in mm, faces) of flat lettering facing +Z: printed ink, no depth.

    align is "CENTER" or "LEFT" (the text starts at x = 0); bold_mm thickens the strokes;
    spacing scales the gaps between characters (bold text needs a little more); font is a
    font file (Blender's own if None); max_width_mm shrinks the lettering to fit that width."""
    if font:
        size_mm = size_mm * font_scale(font)
    curve = bpy.data.curves.new("glyph_tmp", "FONT")
    curve.body = text
    curve.size = size_mm
    curve.extrude = 0.0
    curve.offset = bold_mm
    curve.space_character = spacing
    if font:
        curve.font = bpy.data.fonts.load(font, check_existing=True)
    curve.align_x = align
    curve.align_y = "CENTER"
    curve.resolution_u = 3
    curve.fill_mode = "FRONT"
    obj = bpy.data.objects.new("glyph_tmp", curve)
    bpy.context.scene.collection.objects.link(obj)
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    verts = [tuple(v.co) for v in me.vertices]
    faces = [tuple(p.vertices) for p in me.polygons]
    bpy.data.objects.remove(obj)
    bpy.data.curves.remove(curve)
    bpy.data.meshes.remove(me)
    if max_width_mm and verts:
        w = max(v[0] for v in verts) - min(v[0] for v in verts)
        if w > max_width_mm:
            k = max_width_mm / w
            verts = [(x * k, y * k, z) for x, y, z in verts]
    return verts, faces


def svg_mesh_flat(path, width_mm=None, height_mm=None):
    """Mesh data (verts in mm, faces) of a filled SVG drawing, flat in XY facing +Z, centred
    on its bounding box and scaled to width_mm or height_mm (the one that fits both, if both
    are given). For logos: every path is imported, filled, and turned into one mesh."""
    before = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    verts, faces = [], []
    for o in new:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        base = len(verts)
        mw = o.matrix_world
        verts += [tuple(mw @ v.co) for v in me.vertices]
        faces += [tuple(base + i for i in p.vertices) for p in me.polygons]
        bpy.data.meshes.remove(me)
    for o in new:
        data = o.data
        bpy.data.objects.remove(o)
        if data is not None and data.users == 0:
            bpy.data.curves.remove(data)
    for c in [c for c in bpy.data.collections if c.name.endswith(".svg")]:
        bpy.data.collections.remove(c)
    xs, ys = [v[0] for v in verts], [v[1] for v in verts]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    k = min(x for x in ((width_mm / w) if width_mm else None, (height_mm / h) if height_mm else None) if x is not None)
    verts = [((x - cx) * k, (y - cy) * k, 0.0) for x, y, _ in verts]
    # keep every face facing +Z
    out = []
    for f in faces:
        a, b, c = verts[f[0]], verts[f[1]], verts[f[2]]
        nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
        out.append(f if nz >= 0 else tuple(reversed(f)))
    return verts, out


_ASSETS = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "assets")
FONT_CJK = os.path.join(_ASSETS, "fonts", "NotoSansSC-Regular-subset.otf")        # OFL; subset by tools/font-chars.txt
FONT_CJK_BOLD = os.path.join(_ASSETS, "fonts", "NotoSansSC-Bold-subset.otf")
FONT_CJK_SERIF = os.path.join(_ASSETS, "fonts", "NotoSerifSC-Regular-subset.otf")   # 中文, 西文 on their keys
FONT_SYMBOLS = os.path.join(_ASSETS, "fonts", "Arimo-symbols-subset.ttf")   # the keys' signs ($ with its line through), OFL


def frame_matrix(origin, x_axis, y_axis):
    """4x4 matrix mapping local X/Y/Z (Z = X x Y) to the given axes at origin (mm)."""
    x = Vector(x_axis).normalized()
    y = Vector(y_axis).normalized()
    z = x.cross(y)
    m = Matrix.Identity(4)
    for i in range(3):
        m[i][0], m[i][1], m[i][2], m[i][3] = x[i], y[i], z[i], origin[i]
    return m


def gltf_point(p_mm):
    """Blender-local point (mm) -> glTF-local point (m, Y-up)."""
    x, y, z = p_mm
    return [x * MM, z * MM, -y * MM]


def set_anchors(obj, key, points_mm):
    """Store points (node-local, Blender mm) as a flat glTF-local list in extras[key].

    Acceptance tests use anchors to identify features (which glyph is which digit,
    where the gear plane is) without re-deriving the build geometry."""
    flat = []
    for p in points_mm:
        flat += gltf_point(p)
    obj[key] = flat


def set_labels(obj, label_en):
    """Hover/callout name (glTF extras), for parts without motion too. More languages later."""
    obj["label_en"] = label_en


def set_explode(obj, offset_mm):
    """Exploded-view offset (Blender mm, in the parent's frame) as glTF-frame mm in extras."""
    x, y, z = offset_mm
    obj["explode"] = [x, z, -y]


def set_motion(obj, motion, axis_blender, label_en, unit="deg"):
    """Record how the web code animates this node (glTF extras, axis in glTF Y-up)."""
    bx, by, bz = axis_blender
    obj["motion"] = motion
    obj["axis"] = [bx, bz, -by]  # Blender (x, y, z) -> glTF (x, z, -y)
    obj["unit"] = unit
    obj["label_en"] = label_en


def mesh_data(obj):
    """(verts in mm, faces) of an object's evaluated mesh, in its local frame."""
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    verts = [tuple(c / MM for c in v.co) for v in me.vertices]
    faces = [tuple(p.vertices) for p in me.polygons]
    bpy.data.meshes.remove(me)
    return verts, faces


def cut_holes(mb, holes, plane, t0, t1, collection, segments=32, polys=()):
    """Mesh data of MeshBuilder mb's single prism with holes cut through it.

    holes: (u, w, radius) round holes; polys: polygons [(u, w), ...] (slots, cut-outs); both in
    the plane's coordinates, cut from t0 - 1 to t1 + 1 mm.
    Returns (verts, faces) in mm, ready for MeshBuilder.add_mesh_data."""
    plate = mb.build("__plate", collection)
    cut = MeshBuilder()
    for u, w, r in holes:
        cut.prism([(u + du, w + dw) for du, dw in _circle(r, segments)], plane, t0 - 1.0, t1 + 1.0, mb.mats[0])
    for poly in polys:
        cut.prism(poly, plane, t0 - 1.0, t1 + 1.0, mb.mats[0])
    cutter = cut.build("__cutter", collection)
    mod = plate.modifiers.new("holes", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.solver = "EXACT"
    mod.object = cutter
    data = mesh_data(plate)
    for o in (plate, cutter):
        me = o.data
        bpy.data.objects.remove(o)
        bpy.data.meshes.remove(me)
    return data


def _circle(r, n):
    return [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def set_path(obj, moves_mm):
    """A unit's way out (glTF extras "path"): cumulative waypoints from its seated place, in
    glTF-frame mm, flattened; moves are Blender-frame (x, y, z) steps."""
    pts = [0.0, 0.0, 0.0]
    x = y = z = 0.0
    for dx, dy, dz in moves_mm:
        x, y, z = x + dx, y + dy, z + dz
        pts += [x, z, -y]
    obj["motion"] = "path"
    obj["path"] = pts


def tube_path(mb, points, radius, mat, n=12, bend=None, steps=8):
    """A cord: one round tube swept along a polyline of (x, y, z) mm points, each corner
    rounded into a quadratic Bezier bend (radius bend, 3 x the tube's by default, less where
    the segments are short), the ring carried along without twist; capped at both ends."""
    from mathutils import Vector

    pts = [Vector(p) for p in points]
    bend = 3.0 * radius if bend is None else bend
    # the centre line: straight runs, and a Bezier through each corner
    line = [pts[0]]
    for k in range(1, len(pts) - 1):
        a, c, b = pts[k - 1], pts[k], pts[k + 1]
        d0, d1 = (c - a), (b - c)
        if d0.length < 1e-6 or d1.length < 1e-6:
            continue
        ang = d0.angle(d1)
        if ang < 1e-3:
            continue
        t = min(bend * math.tan(ang / 2), 0.45 * d0.length, 0.45 * d1.length)
        p0, p2 = c - d0.normalized() * t, c + d1.normalized() * t
        m = max(2, round(steps * ang / (math.pi / 2)))
        for i in range(m + 1):
            u = i / m
            line.append((1 - u) ** 2 * p0 + 2 * (1 - u) * u * c + u ** 2 * p2)
    line.append(pts[-1])
    # tangents, and a ring frame transported along them (rotation-minimising)
    tans = []
    for k in range(len(line)):
        d = line[min(k + 1, len(line) - 1)] - line[max(k - 1, 0)]
        tans.append(d.normalized())
    nrm = tans[0].orthogonal().normalized()
    mi = mb._mat(mat)
    base = len(mb.verts)
    for k, (c, t) in enumerate(zip(line, tans)):
        if k:
            nrm = tans[k - 1].rotation_difference(t) @ nrm
            nrm = (nrm - t * nrm.dot(t)).normalized()
        bin_ = t.cross(nrm)
        for i in range(n):
            a = 2 * math.pi * i / n
            p = c + (nrm * math.cos(a) + bin_ * math.sin(a)) * radius
            mb.verts.append((p.x, p.y, p.z))
    rings = len(line)
    for k in range(rings - 1):
        r0, r1 = base + k * n, base + (k + 1) * n
        for i in range(n):
            j = (i + 1) % n
            mb._add([r0 + i, r0 + j, r1 + j, r1 + i], mi, True)
    mb._add(list(reversed(range(base, base + n))), mi, False)
    last = base + (rings - 1) * n
    mb._add(list(range(last, last + n)), mi, False)


STICKERS = os.path.join(_ASSETS, "stickers")


def svg_layers(path, width_mm, height_mm):
    """A sticker's artwork (an SVG of filled shapes, text already outlined): its shapes in
    drawing order, each [(verts (x, y) mm, faces, rgb linear)], the frame mapped onto
    width_mm x height_mm with its centre at (0, 0), x right and y up. The frame is the
    drawing's own extent (its first shape, a full-size background). Shapes past the frame
    are reported (the importer ignores clip paths)."""
    import addon_utils

    addon_utils.enable("io_curve_svg", default_set=False)
    before_o, before_c, before_m = set(bpy.data.objects), set(bpy.data.collections), set(bpy.data.materials)
    bpy.ops.import_curve.svg(filepath=path)
    new = [o for o in bpy.data.objects if o not in before_o and o.type == "CURVE"]
    for o in new:
        o.data.resolution_u = 6
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    raw = []
    for o in new:
        rgb = tuple(o.active_material.diffuse_color[:3]) if o.active_material else (0.0, 0.0, 0.0)
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        pts = [tuple((o.matrix_world @ v.co)[:2]) for v in me.vertices]
        faces = [tuple(p.vertices) for p in me.polygons]
        raw.append((pts, faces, rgb))
        bpy.data.meshes.remove(me)
    for o in [o for o in bpy.data.objects if o not in before_o]:
        d = o.data
        bpy.data.objects.remove(o)
        if d is not None and d.users == 0:
            bpy.data.curves.remove(d)
    for c in [c for c in bpy.data.collections if c not in before_c]:
        bpy.data.collections.remove(c)
    for m in [m for m in bpy.data.materials if m not in before_m]:
        bpy.data.materials.remove(m)
    # the frame: the first shape's extent (the background); Blender's SVG y runs up already
    fx = [p[0] for p in raw[0][0]]
    fy = [p[1] for p in raw[0][0]]
    x0, x1, y0, y1 = min(fx), max(fx), min(fy), max(fy)
    kx, ky = width_mm / (x1 - x0), height_mm / (y1 - y0)
    out, spill = [], 0
    for pts, faces, rgb in raw:
        q = [((x - x0) * kx - width_mm / 2, (y - y0) * ky - height_mm / 2) for x, y in pts]
        if q and (min(a for a, _ in q) < -width_mm / 2 - 0.05 or max(a for a, _ in q) > width_mm / 2 + 0.05
                  or min(b for _, b in q) < -height_mm / 2 - 0.05 or max(b for _, b in q) > height_mm / 2 + 0.05):
            spill += 1
        out.append((q, faces, rgb))
    print(f"SVG {os.path.basename(path)}: {len(out)} shapes, {spill} past the frame")
    return out


def sticker_material(rgb):
    """A plain material for one colour of a sticker's artwork (linear RGB)."""
    name = "sticker_%02x%02x%02x" % tuple(min(255, int(round(c * 255))) for c in rgb)
    if name not in MATERIALS:
        MATERIALS[name] = (tuple(rgb), 0.0, 0.5, None)
    return name


def add_sticker(mb, path, width_mm, height_mm, matrix, step=0.04):
    """Lay a sticker's artwork onto a face: matrix places its centre, x right and y up on the
    face, z out of it. Shapes are stacked in drawing order, one level for each run of shapes
    of one colour (letters of one colour lie side by side, never on each other), the levels
    `step` apart: enough for the depth buffer to keep them apart at a distance."""
    level, prev = -1, None
    for pts, faces, rgb in svg_layers(path, width_mm, height_mm):
        if rgb != prev:
            level += 1
            prev = rgb
        if not faces:
            continue
        verts = [(x, y, level * step) for x, y in pts]
        fs = []
        for f in faces:
            a, b, c = verts[f[0]], verts[f[1]], verts[f[2]]
            nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
            fs.append(f if nz >= 0 else tuple(reversed(f)))
        mb.add_mesh_data(verts, fs, matrix, sticker_material(rgb))
