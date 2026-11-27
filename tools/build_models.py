"""build_models.py — the low-poly models for GRAY WORLD, built with Blender

Builds three models in a scene called "GrayWorld" and exports them for the
site — the objects on the stream tiles:

    terminal   CS stream
    brush      Art stream
    play       Video stream

(The heart is NOT a model — it stays the painting in assets/heart.png.)

Outputs (both committed, both safe to overwrite):

    assets/models/grayworld.glb     what the website loads
    assets/models/grayworld.blend   the same models, to open and edit by hand

Run it headless, so it never touches a Blender you have open:

    /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/build_models.py

It only uses Blender's data API (no operators, no scene evaluation), and it
only ever writes the "GrayWorld" scene.

How colour works: every face carries a flat colour (the "Color" attribute).
Greys are tones, painted here as they look in day mode — the site re-maps
them onto its paper/ink palette, so night mode flips them for free.

To change a model by hand instead: edit it in grayworld.blend, keep the
object names, then File > Export > glTF 2.0 (.glb) over grayworld.glb with
Data > Mesh > Vertex Colors set to "Active".
"""

import json
import math
import os
import random
import struct

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "models")
GLB = os.path.join(OUT_DIR, "grayworld.glb")
BLEND = os.path.join(OUT_DIR, "grayworld.blend")
SCENE = "GrayWorld"

# greys = tones, as they look in day mode (the site re-maps them per theme)
PAPER, LIGHT, MID, DIM, INK = "#e9e9e9", "#c6c6c6", "#8c8c8c", "#565656", "#1b1b1b"

PALETTE = []          # face colour ids index into this


def C(hexstr):
    if hexstr not in PALETTE:
        PALETTE.append(hexstr)
    return PALETTE.index(hexstr)


def srgb_to_linear_rgba(hexstr):
    h = hexstr.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (lin[0], lin[1], lin[2], 1.0)


# ---------------------------------------------------------------- scene ----

def fresh_scene():
    """The GrayWorld scene, emptied of whatever an earlier run left in it."""
    scn = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    for ob in list(scn.collection.all_objects):
        data = ob.data
        bpy.data.objects.remove(ob, do_unlink=True)
        if data is not None and data.users == 0:
            if isinstance(data, bpy.types.Mesh):
                bpy.data.meshes.remove(data)
            elif isinstance(data, bpy.types.Camera):
                bpy.data.cameras.remove(data)
    return scn


# -------------------------------------------------------------- helpers ----

def new_bm():
    bm = bmesh.new()
    return bm, bm.faces.layers.int.new("gw_cid")


def tag(verts, layer, cid):
    for f in {f for v in verts for f in v.link_faces}:
        f[layer] = cid


def box(bm, layer, size, center, color):
    vs = bmesh.ops.create_cube(bm, size=1.0)["verts"]
    bmesh.ops.scale(bm, vec=Vector(size), verts=vs)
    bmesh.ops.translate(bm, vec=Vector(center), verts=vs)
    tag(vs, layer, color)
    return vs


def cone(bm, layer, r_bottom, r_top, z0, z1, color, segments=6):
    """A faceted frustum along Z, from z0 (radius r_bottom) to z1 (r_top)."""
    vs = bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=segments,
        radius1=r_bottom, radius2=r_top, depth=(z1 - z0))["verts"]
    bmesh.ops.translate(bm, vec=Vector((0, 0, (z0 + z1) / 2)), verts=vs)
    tag(vs, layer, color)
    return vs


def prism(bm, layer, profile_xz, y0, y1, color):
    """Extrude a flat X/Z outline along Y."""
    front = [bm.verts.new((x, y0, z)) for x, z in profile_xz]
    back = [bm.verts.new((x, y1, z)) for x, z in profile_xz]
    n = len(profile_xz)
    faces = [bm.faces.new(front), bm.faces.new(list(reversed(back)))]
    for i in range(n):
        j = (i + 1) % n
        faces.append(bm.faces.new((front[j], front[i], back[i], back[j])))
    for f in faces:
        f[layer] = color
    return front + back


def normalise(bm, size=2.0):
    """Centre on the origin and scale so the longest side is `size`."""
    lo = Vector((min(v.co.x for v in bm.verts), min(v.co.y for v in bm.verts), min(v.co.z for v in bm.verts)))
    hi = Vector((max(v.co.x for v in bm.verts), max(v.co.y for v in bm.verts), max(v.co.z for v in bm.verts)))
    mid, k = (lo + hi) / 2, size / max(hi - lo)
    for v in bm.verts:
        v.co = (v.co - mid) * k


def paint(me):
    """Turn the per-face colour ids into the flat 'Color' attribute."""
    cids = [d.value for d in me.attributes["gw_cid"].data]
    col = me.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
    for poly in me.polygons:
        rgba = srgb_to_linear_rgba(PALETTE[cids[poly.index]])
        for li in poly.loop_indices:
            col.data[li].color = rgba
    me.attributes.remove(me.attributes["gw_cid"])
    try:    # which attribute Blender shows and renders (cosmetic)
        me.color_attributes.active_color = me.color_attributes["Color"]
        me.color_attributes.render_color_index = me.color_attributes.find("Color")
    except Exception as e:
        print("  (could not mark Color as active:", e, ")")


def finish(bm, name, scn, x, weld=True):
    if weld:
        bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.004)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    normalise(bm)
    me = bpy.data.meshes.new("gw_" + name)
    bm.to_mesh(me)
    bm.free()
    paint(me)
    ob = bpy.data.objects.new(name, me)
    ob.location = (x, 0, 0)
    scn.collection.objects.link(ob)
    return ob


# ------------------------------------------------------------- terminal ----

def build_terminal(scn, x):
    bm, L = new_bm()
    body, screen, glyph, stand = C(LIGHT), C(INK), C(PAPER), C(MID)
    # CRT body, narrowing toward the back
    for v in box(bm, L, (2.2, 1.5, 1.65), (0, 0, 0), body):
        if v.co.y > 0:
            v.co.x *= 0.7
            v.co.z *= 0.7
    # screen plate on the front
    box(bm, L, (1.86, 0.08, 1.3), (0, -0.77, 0), screen)
    # ">_" in blocks, the same shape as the old pixel icon
    p, cols, rows = 0.2, 8, 5
    chevron = [(0, 0), (1, 0), (1, 1), (2, 1), (2, 2), (3, 2), (1, 3), (2, 3), (0, 4), (1, 4)]
    cursor = [(5, 4), (6, 4), (7, 4)]
    for cx, cy in chevron + cursor:
        px = (cx - (cols - 1) / 2) * p
        pz = ((rows - 1) / 2 - cy) * p
        box(bm, L, (p, 0.1, p), (px, -0.84, pz), glyph)
    # neck + foot
    box(bm, L, (0.6, 0.5, 0.34), (0, 0.05, -0.97), stand)
    box(bm, L, (1.5, 1.1, 0.16), (0, 0.05, -1.2), body)
    return finish(bm, "terminal", scn, x, weld=False)


# ---------------------------------------------------------------- brush ----

def build_brush(scn, x):
    bm, L = new_bm()
    ink, dim, metal, wood = C(INK), C(DIM), C(PAPER), C(MID)
    vs = []
    vs += cone(bm, L, 0.01, 0.46, 0.00, 0.62, ink)      # wet tip
    vs += cone(bm, L, 0.46, 0.36, 0.62, 1.10, dim)      # bristles
    vs += cone(bm, L, 0.39, 0.39, 1.10, 1.56, metal)    # ferrule
    vs += cone(bm, L, 0.28, 0.34, 1.56, 2.10, wood)     # handle, swelling
    vs += cone(bm, L, 0.34, 0.13, 2.10, 4.10, wood)     # handle, tapering
    vs += cone(bm, L, 0.13, 0.05, 4.10, 4.24, dim)      # end
    # lean it 45 degrees: tip low-left, handle high-right (like the old icon)
    bmesh.ops.rotate(bm, cent=Vector((0, 0, 0)), matrix=Matrix.Rotation(math.radians(45), 3, "Y"), verts=vs)
    # the puddle it is dipped in
    rng = random.Random(3)
    blob = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)["verts"]
    for v in blob:
        v.co += Vector((rng.uniform(-0.1, 0.1), rng.uniform(-0.1, 0.1), rng.uniform(-0.1, 0.1)))
        v.co.z *= 0.2
    bmesh.ops.translate(bm, vec=Vector((0.05, 0, -0.02)), verts=blob)
    tag(blob, L, ink)
    return finish(bm, "brush", scn, x, weld=False)


# ----------------------------------------------------------------- play ----

def build_play(scn, x):
    bm, L = new_bm()
    w, h, c = 1.25, 0.9, 0.42                       # half width, half height, corner cut
    slab = [(-w + c, -h), (w - c, -h), (w, -h + c), (w, h - c), (w - c, h), (-w + c, h), (-w, h - c), (-w, -h + c)]
    prism(bm, L, slab, -0.3, 0.3, C(INK))
    prism(bm, L, [(-0.4, -0.6), (0.66, 0.0), (-0.4, 0.6)], -0.52, -0.1, C(PAPER))
    return finish(bm, "play", scn, x, weld=False)


# --------------------------------------------------------------- output ----

def dress_scene(scn, objects):
    """Camera, grey backdrop and a material that shows the colours. Cosmetic:
    it only affects how grayworld.blend looks when opened, never the export."""
    try:
        cam = bpy.data.objects.new("gw_camera", bpy.data.cameras.new("gw_camera"))
        cam.data.lens = 40
        cam.location = (0, -16, 3.2)
        cam.rotation_euler = (math.radians(79), 0, 0)
        scn.collection.objects.link(cam)
        scn.camera = cam
        scn.render.resolution_x, scn.render.resolution_y = 1400, 480
        world = bpy.data.worlds.get("gw_world") or bpy.data.worlds.new("gw_world")
        world.color = (0.82, 0.82, 0.82)
        scn.world = world
        mat = bpy.data.materials.get("gw_face_colour") or bpy.data.materials.new("gw_face_colour")
        if mat.node_tree is None:
            mat.use_nodes = True
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        bsdf = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf is not None and not any(n.type == "VERTEX_COLOR" for n in nodes):
            attr = nodes.new("ShaderNodeVertexColor")
            attr.layer_name = "Color"
            attr.location = (bsdf.location.x - 220, bsdf.location.y)
            links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
            bsdf.inputs["Roughness"].default_value = 1.0
        for ob in objects:
            if not ob.data.materials:
                ob.data.materials.append(mat)
    except Exception as e:
        print("  (scene dressing skipped:", e, ")")


def f32(v):
    return struct.unpack("<f", struct.pack("<f", v))[0]


def write_glb(path, objects):
    """A minimal binary glTF: one flat-coloured triangle soup per object."""
    nodes, meshes, accessors, views, blob = [], [], [], [], bytearray()

    def add(floats, count, lo=None, hi=None):
        views.append({"buffer": 0, "byteOffset": len(blob), "byteLength": len(floats) * 4, "target": 34962})
        blob.extend(struct.pack("<%df" % len(floats), *floats))
        acc = {"bufferView": len(views) - 1, "componentType": 5126, "count": count, "type": "VEC3"}
        if lo is not None:
            acc["min"], acc["max"] = lo, hi
        accessors.append(acc)
        return len(accessors) - 1

    for ob in objects:
        me = ob.data
        me.calc_loop_triangles()
        col = me.color_attributes["Color"].data
        m3 = ob.matrix_basis.to_3x3()                 # rotation + scale, not the layout offset
        pos, rgb = [], []
        for tri in me.loop_triangles:
            for li in tri.loops:
                p = m3 @ me.vertices[me.loops[li].vertex_index].co
                pos += (f32(p.x), f32(p.z), f32(-p.y))        # Blender Z-up -> glTF Y-up
                rgb += [f32(c) for c in col[li].color[:3]]    # linear, as glTF wants
        n = len(pos) // 3
        lo = [min(pos[i::3]) for i in range(3)]
        hi = [max(pos[i::3]) for i in range(3)]
        a_pos, a_col = add(pos, n, lo, hi), add(rgb, n)
        meshes.append({"name": ob.name, "primitives": [{"attributes": {"POSITION": a_pos, "COLOR_0": a_col}, "mode": 4}]})
        nodes.append({"name": ob.name, "mesh": len(meshes) - 1})

    doc = {
        "asset": {"version": "2.0", "generator": "GRAY WORLD tools/build_models.py"},
        "scene": 0,
        "scenes": [{"name": SCENE, "nodes": list(range(len(nodes)))}],
        "nodes": nodes, "meshes": meshes, "accessors": accessors,
        "bufferViews": views, "buffers": [{"byteLength": len(blob)}],
    }
    js = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    js += b" " * (-len(js) % 4)
    with open(path, "wb") as fh:
        fh.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)))
        fh.write(struct.pack("<II", len(js), 0x4E4F534A))
        fh.write(js)
        fh.write(struct.pack("<II", len(blob), 0x004E4942))
        fh.write(blob)


def glb_summary(path):
    with open(path, "rb") as fh:
        raw = fh.read()
    doc = json.loads(raw[20:20 + struct.unpack_from("<I", raw, 12)[0]])
    out = {}
    for node in doc["nodes"]:
        prim = doc["meshes"][node["mesh"]]["primitives"][0]
        acc = doc["accessors"][prim["attributes"]["POSITION"]]
        out[node["name"]] = {
            "triangles": acc["count"] // 3,
            "size": [round(b - a, 2) for a, b in zip(acc["min"], acc["max"])],
        }
    return {"bytes": len(raw), "models": out}


def main():
    del PALETTE[:]
    os.makedirs(OUT_DIR, exist_ok=True)
    scn = fresh_scene()
    models = [
        build_terminal(scn, -3),
        build_brush(scn, 0),
        build_play(scn, 3),
    ]
    write_glb(GLB, models)
    dress_scene(scn, models)
    bpy.data.libraries.write(BLEND, {scn}, compress=True)
    return {"glb": glb_summary(GLB), "blend_bytes": os.path.getsize(BLEND)}


REPORT = main()
print("GRAY WORLD models: " + json.dumps(REPORT))
