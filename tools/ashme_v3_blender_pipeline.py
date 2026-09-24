"""Reproducible Blender-first asset preparation for the AshMe V3 intro."""
from __future__ import annotations

import bpy
import math
import os
import random
import sys
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
OUT = os.path.join(ROOT, "artifacts", "ashme-v3")
os.makedirs(OUT, exist_ok=True)


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def import_gltf(name):
    bpy.ops.import_scene.gltf(filepath=os.path.join(ASSETS, name))
    imported = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    return imported


def material_nodes(name, base, roughness=0.8, metallic=0.0, noise_scale=160.0, bump_strength=0.08):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*base, 1.0)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    principled = nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*base, 1.0)
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    texcoord = nodes.new("ShaderNodeTexCoord")
    texcoord.location = (-800, 100)
    noise = nodes.new("ShaderNodeTexNoise")
    noise.location = (-590, 150)
    noise.inputs["Scale"].default_value = noise_scale
    noise.inputs["Detail"].default_value = 2.2
    noise.inputs["Roughness"].default_value = 0.72
    links.new(texcoord.outputs["Generated"], noise.inputs["Vector"])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.location = (-340, 250)
    ramp.color_ramp.elements[0].position = 0.18
    ramp.color_ramp.elements[0].color = (*(c * 0.91 for c in base), 1.0)
    ramp.color_ramp.elements[1].position = 0.82
    ramp.color_ramp.elements[1].color = (*(min(1.0, c * 1.07) for c in base), 1.0)
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], principled.inputs["Base Color"])
    bump = nodes.new("ShaderNodeBump")
    bump.location = (-90, -90)
    bump.inputs["Strength"].default_value = bump_strength
    bump.inputs["Distance"].default_value = 0.006
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], principled.inputs["Normal"])
    return mat


def improve_tray_material(tray):
    mat = bpy.data.materials.new("AshMe | satin violet resin")
    mat.use_nodes = True
    mat.diffuse_color = (0.19, 0.075, 0.34, 1.0)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    out.location = (620, 80)
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (350, 80)
    bsdf.inputs["Roughness"].default_value = 0.43
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["IOR"].default_value = 1.46
    bsdf.inputs["Coat Weight"].default_value = 0.14
    bsdf.inputs["Coat Roughness"].default_value = 0.31
    tex = nodes.new("ShaderNodeTexCoord")
    tex.location = (-850, -200)
    noise = nodes.new("ShaderNodeTexNoise")
    noise.location = (-640, -200)
    noise.inputs["Scale"].default_value = 145.0
    noise.inputs["Detail"].default_value = 2.5
    links.new(tex.outputs["Generated"], noise.inputs["Vector"])
    albedo = nodes.new("ShaderNodeValToRGB")
    albedo.location = (-120, 40)
    albedo.color_ramp.elements[0].color = (0.105, 0.033, 0.205, 1.0)
    albedo.color_ramp.elements[1].color = (0.20, 0.085, 0.34, 1.0)
    links.new(noise.outputs["Fac"], albedo.inputs["Fac"])
    links.new(albedo.outputs["Color"], bsdf.inputs["Base Color"])
    rough = nodes.new("ShaderNodeMapRange")
    rough.location = (-400, -180)
    rough.inputs["From Min"].default_value = 0.0
    rough.inputs["From Max"].default_value = 1.0
    rough.inputs["To Min"].default_value = 0.39
    rough.inputs["To Max"].default_value = 0.49
    links.new(noise.outputs["Fac"], rough.inputs["Value"])
    links.new(rough.outputs["Result"], bsdf.inputs["Roughness"])
    bump = nodes.new("ShaderNodeBump")
    bump.location = (100, -170)
    bump.inputs["Strength"].default_value = 0.022
    bump.inputs["Distance"].default_value = 0.0012
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    tray.data.materials.clear()
    tray.data.materials.append(mat)
    for poly in tray.data.polygons:
        poly.use_smooth = True
    normal = tray.modifiers.new("Weighted studio normals", "WEIGHTED_NORMAL")
    normal.keep_sharp = True
    normal.weight = 30
    return mat


def make_gel_surface(parent):
    gel = bpy.data.materials.new("AshMe | translucent aqua gel")
    gel.diffuse_color = (0.018, 0.27, 0.45, 1.0)
    gel.use_nodes = True
    shader = gel.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.018, 0.27, 0.45, 1.0)
    shader.inputs["Roughness"].default_value = 0.43
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["IOR"].default_value = 1.38
    shader.inputs["Coat Weight"].default_value = 0.04
    shader.inputs["Coat Roughness"].default_value = 0.28
    segments = 64
    radii = (0.18, 0.38, 0.57, 0.70)
    verts = [(0.0, 0.0, 0.25)]
    for ring, r in enumerate(radii):
        for j in range(segments):
            a = math.tau * j / segments
            ripple = 0.0012 * math.sin(a * 5 + ring * 0.6) + 0.0007 * math.sin(a * 11)
            verts.append((math.cos(a) * r, math.sin(a) * r, 0.25 + ripple))
    faces = []
    for j in range(segments):
        faces.append((0, 1 + j, 1 + (j + 1) % segments))
    for ring in range(len(radii) - 1):
        inner_start = 1 + ring * segments
        outer_start = inner_start + segments
        for j in range(segments):
            a, b = inner_start + j, inner_start + (j + 1) % segments
            c, d = outer_start + j, outer_start + (j + 1) % segments
            faces.append((a, c, d, b))
    mesh = bpy.data.meshes.new("AshMe aqua gel | shallow molded fill")
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(gel)
    for poly in mesh.polygons:
        poly.use_smooth = True
    surface = bpy.data.objects.new("AshMe gel | aqua top surface", mesh)
    bpy.context.scene.collection.objects.link(surface)
    surface.parent = parent
    return surface


def make_rim_and_brand(parent):
    rim_mat = bpy.data.materials.new("AshMe | warm ivory rim")
    rim_mat.diffuse_color = (0.72, 0.66, 0.53, 1.0)
    rim_mat.use_nodes = True
    rim_bsdf = rim_mat.node_tree.nodes.get("Principled BSDF")
    rim_bsdf.inputs["Base Color"].default_value = (0.72, 0.66, 0.53, 1.0)
    rim_bsdf.inputs["Roughness"].default_value = 0.47
    segments = 64
    verts, faces = [], []
    for radius in (0.70, 0.90):
        for j in range(segments):
            a = math.tau * j / segments
            r = radius * (1 + 0.008 * math.sin(a * 5 + 0.4))
            verts.append((math.cos(a) * r, math.sin(a) * r, 0.34 + 0.004 * math.sin(a * 4)))
    for j in range(segments):
        a, b = j, (j + 1) % segments
        faces.append((a, 64 + a, 64 + b, b))
    mesh = bpy.data.meshes.new("AshMe lip | softly irregular ivory annulus")
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(rim_mat)
    for poly in mesh.polygons:
        poly.use_smooth = True
    lip = bpy.data.objects.new("AshMe rim | warm ivory lip", mesh)
    bpy.context.scene.collection.objects.link(lip)
    lip.parent = parent

    gold = bpy.data.materials.new("AshMe | muted gold branding")
    gold.diffuse_color = (0.78, 0.48, 0.13, 1.0)
    gold.use_nodes = True
    gold_bsdf = gold.node_tree.nodes.get("Principled BSDF")
    gold_bsdf.inputs["Base Color"].default_value = (0.78, 0.48, 0.13, 1.0)
    gold_bsdf.inputs["Metallic"].default_value = 0.42
    gold_bsdf.inputs["Roughness"].default_value = 0.38
    bpy.ops.object.text_add(location=(0.0, 1.02, -0.10), rotation=(-math.pi / 2, 0, 0))
    label = bpy.context.object
    label.name = "AshMe branding | gold wordmark"
    # The front-facing tray transform mirrors local text order; reverse the source string.
    label.data.body = "eMhsA"
    label.data.align_x = "CENTER"
    label.data.size = 0.255
    label.data.extrude = 0.0015
    label.data.bevel_depth = 0.001
    label.data.bevel_resolution = 2
    label.scale.y = -1
    bpy.ops.object.convert(target="MESH")
    label = bpy.context.object
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    label.name = "AshMe branding | gold wordmark"
    label.data.materials.append(gold)
    label.parent = parent
    return lip, label


def pbr_material(name, base, roughness, metallic=0.0, scale=180.0, bump_strength=0.035, emission=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*base, 1.0)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    out.location = (620, 80)
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.location = (370, 80)
    shader.inputs["Base Color"].default_value = (*base, 1.0)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    tex = nodes.new("ShaderNodeTexCoord")
    tex.location = (-850, 80)
    noise = nodes.new("ShaderNodeTexNoise")
    noise.location = (-620, 120)
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 2.5
    noise.inputs["Roughness"].default_value = 0.7
    links.new(tex.outputs["Object"], noise.inputs["Vector"])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.location = (-360, 200)
    ramp.color_ramp.elements[0].position = 0.18
    ramp.color_ramp.elements[0].color = (*(c * 0.88 for c in base), 1.0)
    ramp.color_ramp.elements[1].position = 0.82
    ramp.color_ramp.elements[1].color = (*(min(1.0, c * 1.12) for c in base), 1.0)
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    bump = nodes.new("ShaderNodeBump")
    bump.location = (100, -120)
    bump.inputs["Strength"].default_value = bump_strength
    bump.inputs["Distance"].default_value = 0.004
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    if emission:
        shader.inputs["Emission Color"].default_value = (*emission, 1.0)
        shader.inputs["Emission Strength"].default_value = 3.5
    links.new(shader.outputs["BSDF"], out.inputs["Surface"])
    return mat


def create_cigarette_and_ash():
    reset_scene()
    mesh_sources = import_gltf("ashme-cigarette.glb")
    source = next(o for o in mesh_sources if o.name.startswith("Cylinder") and o.type == "MESH")
    transform = source.matrix_world.copy()
    source_material = source.data.materials[0].copy()
    source_image = next(n.image.copy() for n in source_material.node_tree.nodes if n.type == "TEX_IMAGE" and n.image)
    source_mesh = source.data.copy()
    source_mesh.transform(transform)
    source_mesh.transform(Matrix.Rotation(-math.pi / 2, 4, "Z"))
    extents = [max(v.co[i] for v in source_mesh.vertices) - min(v.co[i] for v in source_mesh.vertices) for i in range(3)]
    source_length = max(extents)
    source_diameter = (sum(sorted(extents)[:2]) * 0.5) * (4.62 / source_length)
    for obj in list(bpy.context.scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    source_image.name = "AshMe cigarette | 1024px baked albedo"
    source_image.scale(1024, 1024)
    source_image.filepath_raw = os.path.join(OUT, "cigarette-source-albedo-1024.png")
    source_image.file_format = "PNG"
    source_image.save()

    def cigarette_material(name, roughness, tint=(1.0, 1.0, 1.0, 1.0), fiber_scale=180.0, bump_strength=0.025, atlas_texture=True):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        mat.diffuse_color = (0.78 * tint[0], 0.75 * tint[1], 0.63 * tint[2], 1.0)
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        nodes.clear()
        output = nodes.new("ShaderNodeOutputMaterial")
        shader = nodes.new("ShaderNodeBsdfPrincipled")
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = 0.0
        shader.inputs["Specular IOR Level"].default_value = 0.24
        uv = nodes.new("ShaderNodeTexCoord")
        image = nodes.new("ShaderNodeTexImage")
        image.image = source_image
        image.interpolation = "Linear"
        links.new(uv.outputs["UV"], image.inputs["Vector"])
        if not atlas_texture:
            shader.inputs["Base Color"].default_value = tint
        elif tint[:3] != (1.0, 1.0, 1.0):
            multiply = nodes.new("ShaderNodeMixRGB")
            multiply.blend_type = "MULTIPLY"
            multiply.inputs["Fac"].default_value = 0.82
            multiply.inputs["Color2"].default_value = tint
            links.new(image.outputs["Color"], multiply.inputs["Color1"])
            links.new(multiply.outputs["Color"], shader.inputs["Base Color"])
        else:
            links.new(image.outputs["Color"], shader.inputs["Base Color"])
        noise = nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = fiber_scale
        noise.inputs["Detail"].default_value = 2.2
        noise.inputs["Roughness"].default_value = 0.73
        links.new(uv.outputs["UV"], noise.inputs["Vector"])
        rough = nodes.new("ShaderNodeMapRange")
        rough.inputs["From Min"].default_value = 0.0
        rough.inputs["From Max"].default_value = 1.0
        rough.inputs["To Min"].default_value = max(0.0, roughness - 0.045)
        rough.inputs["To Max"].default_value = min(1.0, roughness + 0.045)
        links.new(noise.outputs["Fac"], rough.inputs["Value"])
        links.new(rough.outputs["Result"], shader.inputs["Roughness"])
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = bump_strength
        bump.inputs["Distance"].default_value = 0.002
        links.new(noise.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], shader.inputs["Normal"])
        links.new(shader.outputs["BSDF"], output.inputs["Surface"])
        for node, location in ((uv, (-850, 80)), (image, (-620, 260)), (noise, (-620, -120)), (rough, (-380, -100)), (bump, (-80, -150)), (shader, (220, 80)), (output, (500, 80))):
            node.location = location
        return mat

    paper = cigarette_material("Cigarette | paper fiber albedo", 0.92, fiber_scale=225.0, bump_strength=0.021)
    filter_mat = cigarette_material("Cigarette | warm filter fibers", 0.88, tint=(0.50, 0.245, 0.105, 1.0), fiber_scale=310.0, bump_strength=0.022, atlas_texture=False)
    burn = cigarette_material("Cigarette | toasted burn edge", 0.95, tint=(0.66, 0.39, 0.24, 1.0), fiber_scale=115.0, bump_strength=0.09)
    char = cigarette_material("Cigarette | char and ash map", 0.985, tint=(0.43, 0.43, 0.39, 1.0), fiber_scale=84.0, bump_strength=0.12)

    # Retopologize the source cylinder while retaining its UV texture atlas and measured diameter.
    half_length = 2.31
    radius = source_diameter * 0.5
    sides = 64
    regions = [
        (-half_length, -1.62, 1, 8, (0.0, 0.31, 0.01, 0.33)),
        (-1.62, 1.76, 0, 32, (0.0, 0.31, 0.35, 0.82)),
        (1.76, 2.06, 2, 5, (0.0, 0.31, 0.78, 0.90)),
        (2.06, half_length, 3, 5, (0.0, 0.31, 0.83, 0.99)),
    ]
    ring_x = [regions[0][0]]
    interval_regions = []
    for start, end, mat_id, subdivisions, uv_range in regions:
        for step in range(1, subdivisions + 1):
            ring_x.append(start + (end - start) * step / subdivisions)
            interval_regions.append((start, end, mat_id, uv_range))
    verts, faces, material_ids, face_uvs = [], [], [], []
    for axial, x in enumerate(ring_x):
        for side in range(sides + 1):
            angle = math.tau * side / sides + math.pi
            irregularity = 1.0 + 0.0035 * math.sin(angle * 9.0 + 0.4) + 0.002 * math.sin(angle * 17.0 + axial * 0.21)
            r = radius * irregularity
            verts.append((x, math.cos(angle) * r, math.sin(angle) * r))
    for axial in range(len(ring_x) - 1):
        region_start, region_end, mat_id, uv_range = interval_regions[axial]
        for side in range(sides):
            a = axial * (sides + 1) + side
            b = a + 1
            c = (axial + 1) * (sides + 1) + side
            d = c + 1
            faces.append((a, b, d, c))
            material_ids.append(mat_id)
            u0, u1, v0, v1 = uv_range
            t0 = (ring_x[axial] - region_start) / (region_end - region_start)
            t1 = (ring_x[axial + 1] - region_start) / (region_end - region_start)
            face_uvs.append(((u0 + (u1 - u0) * side / sides, v0 + (v1 - v0) * t0),
                             (u0 + (u1 - u0) * (side + 1) / sides, v0 + (v1 - v0) * t0),
                             (u0 + (u1 - u0) * (side + 1) / sides, v0 + (v1 - v0) * t1),
                             (u0 + (u1 - u0) * side / sides, v0 + (v1 - v0) * t1)))
    left_center = len(verts)
    verts.append((-half_length, 0, 0))
    right_center = len(verts)
    verts.append((half_length, 0, 0))
    left_ring = 0
    right_ring = (len(ring_x) - 1) * (sides + 1)
    for side in range(sides):
        faces.append((left_center, left_ring + side + 1, left_ring + side))
        material_ids.append(1)
        faces.append((right_center, right_ring + side, right_ring + side + 1))
        material_ids.append(3)
        u0, u1 = 0.0, 0.31
        faces_uv_filter = ((u0 + (u1-u0) * (side + 0.5) / sides, 0.17), (u0 + (u1-u0) * (side + 1) / sides, 0.17), (u0 + (u1-u0) * side / sides, 0.17))
        faces_uv_char = ((u0 + (u1-u0) * (side + 0.5) / sides, 0.92), (u0 + (u1-u0) * side / sides, 0.92), (u0 + (u1-u0) * (side + 1) / sides, 0.92))
        face_uvs.extend((faces_uv_filter, faces_uv_char))
    mesh = bpy.data.meshes.new("Cigarette | retopologized 64-side paper tube")
    mesh.from_pydata(verts, [], faces)
    mesh.materials.clear()
    for mat in (paper, filter_mat, burn, char):
        mesh.materials.append(mat)
    uv_layer = mesh.uv_layers.new(name="CigaretteAtlasUV")
    for index, poly in enumerate(mesh.polygons):
        poly.material_index = material_ids[index]
        poly.use_smooth = True
        for loop_index, uv in zip(poly.loop_indices, face_uvs[index]):
            uv_layer.data[loop_index].uv = uv
    cigarette = bpy.data.objects.new("Cigarette | paper + filter", mesh)
    bpy.context.scene.collection.objects.link(cigarette)
    cigarette.location = (0, 0, 0)
    cigarette.rotation_euler = (0, 0, 0)
    basis = cigarette.shape_key_add(name="CIGARETTE_STATE_0")
    state_keys = []
    for stage in range(1, 5):
        key = cigarette.shape_key_add(name=f"CIGARETTE_STATE_{stage}")
        threshold = 1.78 + (stage - 1) * 0.105
        for index, basis_vert in enumerate(basis.data):
            co = basis_vert.co
            progress = max(0.0, min(1.0, (co.x - threshold) / 0.5))
            progress = progress * progress * (3.0 - 2.0 * progress)
            key.data[index].co = (co.x + progress * 0.025, co.y * (1.0 - progress * 0.025 * stage), co.z * (1.0 - progress * 0.025 * stage))
        start, end = 1 + (stage - 1) * 13, 1 + stage * 13
        key.value = 0.0
        key.keyframe_insert(data_path="value", frame=start, group="BURN_MORPH_STATES")
        key.value = 1.0
        key.keyframe_insert(data_path="value", frame=end, group="BURN_MORPH_STATES")
        state_keys.append(key)
    if mesh.shape_keys.animation_data and mesh.shape_keys.animation_data.action:
        mesh.shape_keys.animation_data.action.name = "ASHME_V3_BURN_MORPH_STATES"
    bpy.context.view_layer.update()

    ash_mat = pbr_material("Ash | layered porous gray", (0.018, 0.02, 0.019), 0.99, scale=72.0, bump_strength=0.21)
    ash_dark = pbr_material("Ash | charcoal fissures", (0.003, 0.0035, 0.003), 1.0, scale=96.0, bump_strength=0.17)
    ember_mat = pbr_material("Ember | hot orange core", (0.42, 0.038, 0.006), 0.92, scale=33.0, bump_strength=0.025, emission=(1.0, 0.12, 0.008))
    ember_hot = pbr_material("Ember | yellow-hot flecks", (0.65, 0.12, 0.008), 0.88, scale=42.0, bump_strength=0.015, emission=(1.0, 0.30, 0.025))
    ember_mat.node_tree.nodes.get("Principled BSDF").inputs["Emission Strength"].default_value = 0.75
    ember_hot.node_tree.nodes.get("Principled BSDF").inputs["Emission Strength"].default_value = 1.15
    random.seed(26)
    # A sculpt-like, broken ash collar built as an uneven ring mesh with a porous fractured end face.
    sides, rings = 32, [2.015, 2.105, 2.205, 2.315]
    verts, faces = [], []
    for ri, x in enumerate(rings):
        for j in range(sides):
            a = math.tau * j / sides
            wobble = 1.0 + 0.045 * math.sin(a * 5 + 0.8) + 0.025 * math.sin(a * 11 + 1.9) + random.uniform(-0.025, 0.025)
            # A few charred slumps pull the lower edge down and fracture the crown.
            slump = max(0.0, math.sin(a * 3.0 + 1.3)) ** 10 * (0.04 if ri in (2, 3) else 0.018)
            ash_radius = radius * 0.96 * wobble
            verts.append((x + slump, math.cos(a) * ash_radius, math.sin(a) * ash_radius - slump * 0.55))
    for ri in range(len(rings) - 1):
        for j in range(sides):
            a = ri * sides + j
            b = ri * sides + (j + 1) % sides
            c = (ri + 1) * sides + j
            d = (ri + 1) * sides + (j + 1) % sides
            faces.extend([(a, c, b), (b, c, d)])
    # Irregular angular end fragments leave dark pores between pale fractured faces.
    center = len(verts)
    verts.append((2.325, 0, 0))
    last = (len(rings) - 1) * sides
    for j in range(sides):
        point = verts[last + j]
        verts.append((2.305 + random.uniform(-0.018, 0.008), point[1] * random.uniform(0.23, 0.79), point[2] * random.uniform(0.23, 0.79)))
        faces.append((last + j, last + (j + 1) % sides, len(verts) - 1))
        faces.append((len(verts) - 1, center, last + (j + 1) % sides))
    ash_mesh = bpy.data.meshes.new("Ash crown | sculpted fracture surface")
    ash_mesh.from_pydata(verts, [], faces)
    ash_mesh.materials.append(ash_mat)
    ash_mesh.materials.append(ash_dark)
    ash_mesh.update()
    crown = bpy.data.objects.new("Ash crown | attached buildup", ash_mesh)
    bpy.context.scene.collection.objects.link(crown)
    # Darken alternating triangular sectors to form deep crack lines and open porous mouths.
    for i, poly in enumerate(ash_mesh.polygons):
        poly.material_index = 1 if i % 17 in (3, 4) else 0
        poly.use_smooth = i < (len(rings) - 1) * sides * 2
    crown.parent = cigarette
    crown.location = (0, 0, 0)
    crown_basis = crown.shape_key_add(name="ASH_STATE_0")
    sag_key = crown.shape_key_add(name="ASH_SAG_AND_CRACK")
    for index, base_vert in enumerate(crown_basis.data):
        co = base_vert.co
        edge = max(0.0, min(1.0, (abs(co.y) + abs(co.z) - 0.17) / 0.08))
        sag_key.data[index].co = (co.x + edge * 0.025, co.y, co.z - edge * 0.028)
    sag_key.value = 0.0
    sag_key.keyframe_insert(data_path="value", frame=66, group="ASH_SAG_AND_BREAK")
    sag_key.value = 1.0
    sag_key.keyframe_insert(data_path="value", frame=78, group="ASH_SAG_AND_BREAK")
    for dim in range(3):
        crown.scale[dim] = 0.001
        crown.keyframe_insert(data_path="scale", frame=1, index=dim, group="BURN_PROGRESSION")
        crown.scale[dim] = 1.0
        crown.keyframe_insert(data_path="scale", frame=66, index=dim, group="BURN_PROGRESSION")

    # A few manually shaped mineral-like chips, not particle spheres.
    chip_objects = []
    for idx, spec in enumerate(((2.39, 0.13, 0.12, 0.085), (2.2, -0.18, 0.10, 0.075), (2.51, 0.04, -0.11, 0.07))):
        x, y, z, size = spec
        chip_verts = [
            (x - size * 0.8, y - size, z), (x + size, y - size * 0.45, z - size * 0.25),
            (x + size * 0.6, y + size * 0.9, z + size * 0.15), (x - size * 0.65, y + size * 0.2, z + size),
            (x + size * 0.12, y, z - size * 0.85),
        ]
        chip_faces = [(0, 1, 2), (0, 2, 3), (0, 4, 1), (1, 4, 2), (2, 4, 3), (3, 4, 0)]
        chip_mesh = bpy.data.meshes.new(f"Ash fracture chip {idx + 1}")
        chip_mesh.from_pydata(chip_verts, [], chip_faces)
        chip_mesh.materials.append(ash_mat)
        chip_mesh.materials.append(ash_dark)
        chip_mesh.update()
        chip = bpy.data.objects.new(f"Ash fracture | flake {idx + 1}", chip_mesh)
        bpy.context.scene.collection.objects.link(chip)
        chip.parent = cigarette
        chip.location = (0, 0, 0)
        for dim in range(3):
            chip.scale[dim] = 0.001
            chip.keyframe_insert(data_path="scale", frame=1, index=dim, group="BURN_PROGRESSION")
            chip.scale[dim] = 0.001
            chip.keyframe_insert(data_path="scale", frame=66, index=dim, group="BURN_PROGRESSION")
            chip.scale[dim] = 0.82
            chip.keyframe_insert(data_path="scale", frame=78, index=dim, group="BURN_PROGRESSION")
            chip.scale[dim] = 0.0
            chip.keyframe_insert(data_path="scale", frame=83, index=dim, group="ASH_BREAK")
            chip.scale[dim] = 1.0
            chip.keyframe_insert(data_path="scale", frame=90, index=dim, group="ASH_BREAK")
            chip.location = (0, 0, 0)
            chip.keyframe_insert(data_path="location", frame=83, group="ASH_BREAK")
            chip.location = (0.2 + idx * 0.045, (idx - 1) * 0.08, -0.35 - idx * 0.05)
            chip.keyframe_insert(data_path="location", frame=110, group="ASH_BREAK")
        chip_objects.append(chip)

    # A narrow irregular hot seam follows the outside of the charred tip.
    ember_verts = []
    ember_faces = []
    ember_sections = (2.264, 2.315)
    ember_sides = 32
    for x in ember_sections:
        for j in range(ember_sides):
            a = math.tau * j / ember_sides + math.pi
            r = radius * (1.018 + 0.018 * math.sin(a * 5 + 0.3) + 0.008 * math.sin(a * 9 + 1.1))
            ember_verts.append((x + 0.003 * math.sin(a * 3 + 0.4), math.cos(a) * r, math.sin(a) * r))
    for j in range(32):
        a = j
        b = (j + 1) % ember_sides
        ember_faces.append((a, b, ember_sides + b, ember_sides + a))
    ember_mesh = bpy.data.meshes.new("Ember core | irregular exposed heat")
    ember_mesh.from_pydata(ember_verts, [], ember_faces)
    ember_mesh.materials.append(ember_mat)
    ember_mesh.materials.append(ember_hot)
    for index, poly in enumerate(ember_mesh.polygons):
        poly.material_index = 1 if index in (3, 4, 11, 12, 20, 27) else 0
    ember = bpy.data.objects.new("Ember | irregular hot seam", ember_mesh)
    bpy.context.scene.collection.objects.link(ember)
    ember.parent = cigarette
    ember.location = (0, 0, 0)
    main_mesh = bpy.data.meshes.new("Primary ash fracture | jagged sector chunk")
    shell_face_count = (len(rings) - 1) * sides * 2
    retained_faces = []
    retained_indices = []
    for poly in ash_mesh.polygons:
        sector = (poly.index // 2) % sides if poly.index < shell_face_count else ((poly.index - shell_face_count) // 2) % sides
        if sector <= 3 or sector >= 29:
            retained_faces.append(tuple(poly.vertices))
            retained_indices.append(poly.index)
    used_vertices = sorted({vertex for face in retained_faces for vertex in face})
    vertex_map = {old: new for new, old in enumerate(used_vertices)}
    main_mesh.from_pydata([ash_mesh.vertices[index].co[:] for index in used_vertices], [], [tuple(vertex_map[index] for index in face) for face in retained_faces])
    main_mesh.materials.append(ash_mat)
    main_mesh.materials.append(ash_dark)
    for poly, source_index in zip(main_mesh.polygons, retained_indices):
        source_poly = ash_mesh.polygons[source_index]
        poly.material_index = source_poly.material_index
        poly.use_smooth = source_poly.use_smooth
    main_mesh.name = "Primary ash fracture | detached main chunk"
    main = bpy.data.objects.new("Ash break | primary chunk", main_mesh)
    bpy.context.scene.collection.objects.link(main)
    main.parent = cigarette
    main.location = (0, 0, 0)
    for dim in range(3):
        main.scale[dim] = 0.001
        main.keyframe_insert(data_path="scale", frame=1, index=dim, group="ASH_BREAK")
        main.scale[dim] = 0.001
        main.keyframe_insert(data_path="scale", frame=78, index=dim, group="ASH_BREAK")
        main.scale[dim] = 1.0
        main.keyframe_insert(data_path="scale", frame=84, index=dim, group="ASH_BREAK")
    main.location = (0, 0, 0)
    main.keyframe_insert(data_path="location", frame=84, group="ASH_BREAK")
    main.location = (-0.35, 0.12, -2.3)
    main.keyframe_insert(data_path="location", frame=126, group="ASH_BREAK")
    main.rotation_euler = (0, 0, 0)
    main.keyframe_insert(data_path="rotation_euler", frame=84, group="ASH_BREAK")
    main.rotation_euler = (0.35, -0.48, 0.64)
    main.keyframe_insert(data_path="rotation_euler", frame=126, group="ASH_BREAK")
    for dim in range(3):
        crown.scale[dim] = 1.0
        crown.keyframe_insert(data_path="scale", frame=78, index=dim, group="ASH_BREAK")
        crown.scale[dim] = 0.001
        crown.keyframe_insert(data_path="scale", frame=84, index=dim, group="ASH_BREAK")
    for obj in [cigarette, crown, main, *chip_objects]:
        if obj.animation_data and obj.animation_data.action:
            obj.animation_data.action.name = "ASHME_V3_BURN_AND_BREAK"
    return cigarette, crown, main, chip_objects, ember


def add_ground(scene, z):
    mat = pbr_material("Studio | graphite sweep", (0.018, 0.027, 0.027), 0.48, scale=80.0, bump_strength=0.012)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, z))
    floor = bpy.context.object
    floor.name = "Ground | seamless shadow plane"
    floor.data.materials.append(mat)
    return floor


def render_frame(scene, filename, target, camera_pos, lens, objects_visible=None):
    for obj in list(scene.objects):
        if obj.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(obj, do_unlink=True)
    studio(scene, target, camera_pos, resolution=(960, 720))
    scene.camera.data.lens = lens
    scene.render.filepath = os.path.join(OUT, filename)
    bpy.context.scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)


def save_asset_blend():
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "ashme-v3-authored-assets.blend"))


def export_scene_glb(filepath, objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_morph=True,
        export_apply=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )


def render_cigarette_checkpoints():
    cigarette, crown, main, chips, ember = create_cigarette_and_ash()
    scene = bpy.context.scene
    add_ground(scene, -0.25)
    scene.frame_set(1)
    render_frame(scene, "B1-cigarette-beauty.png", (0, 0, 0), (0.35, 2.8, 7.8), 56)
    scene.frame_set(55)
    render_frame(scene, "B2-burn-edge-ember.png", (1.9, 0, 0), (2.8, 3.7, 3.2), 60)
    scene.frame_set(78)
    render_frame(scene, "B3-full-ash-buildup.png", (1.9, 0, 0), (2.8, 3.7, 3.2), 60)
    scene.frame_set(96)
    render_frame(scene, "B4-detached-ash.png", (2.0, 0, -0.65), (3.1, 3.2, 1.75), 72)

    scene.frame_set(1)
    save_asset_blend()
    export_scene_glb(os.path.join(ASSETS, "ashme-intro-v3.glb"), [cigarette, crown, main, *chips, ember])


def render_tray_beauty_and_export():
    reset_scene()
    imported = import_gltf("ashme-tray.glb")
    tray = next(obj for obj in imported if "tray" in obj.name.lower())
    for obj in list(bpy.context.scene.objects):
        if obj != tray:
            bpy.data.objects.remove(obj, do_unlink=True)
    improve_tray_material(tray)
    gel = make_gel_surface(tray)
    rim, branding = make_rim_and_brand(tray)
    tray.scale = tuple(axis * 36.5 for axis in tray.scale)
    tray.location = (0, 0, 0.6375)
    bpy.context.view_layer.update()
    print("TRAY BEAUTY DIMENSIONS", tuple(tray.dimensions), "scale", tuple(tray.scale), "location", tuple(tray.location))
    add_ground(bpy.context.scene, 0.0)
    render_frame(bpy.context.scene, "B5-ashme-tray-beauty.png", (0, 0, 0.6375), (0.3, 8.8, 4.4), 72)
    tray.location = (0, 0, 0)
    export_scene_glb(os.path.join(ASSETS, "ashme-tray-v3.glb"), [tray, gel, rim, branding])


def build_pipeline():
    bpy.context.scene.render.fps = 30
    if "--tray-only" in sys.argv:
        render_tray_beauty_and_export()
        return
    if "--cigarette-only" in sys.argv:
        render_cigarette_checkpoints()
        return
    render_cigarette_checkpoints()
    render_tray_beauty_and_export()


def studio(scene, target, camera_pos, resolution=(1200, 900)):
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 8
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.world.color = (0.018, 0.025, 0.025)
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    world = scene.world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.07, 0.095, 0.09, 1.0)
    bg.inputs["Strength"].default_value = 0.48

    def area(name, location, energy, color, size, size_y=None):
        data = bpy.data.lights.new(name, "AREA")
        data.energy, data.color = energy, color
        data.shape = "RECTANGLE" if size_y is not None else "DISK"
        data.size, data.size_y = size, size_y or size
        ob = bpy.data.objects.new(name, data)
        scene.collection.objects.link(ob)
        ob.location = location
        ob.rotation_euler = (Vector(target) - ob.location).to_track_quat("-Z", "Y").to_euler()
        return ob

    tx, ty, tz = target
    area("Key | warm silk", (tx - 1.2, ty + 1.35, tz + 1.25), 170, (1.0, 0.84, 0.7), 1.5, 0.62)
    area("Fill | aqua card", (tx + 1.5, ty + 0.3, tz + 1.0), 90, (0.55, 0.82, 0.81), 1.1, 0.54)
    area("Rim | soft strip", (tx + 0.4, ty - 1.0, tz + 1.45), 125, (0.56, 0.88, 0.85), 1.8, 0.38)
    area("Top | bounce", (tx - 0.5, ty + 1.55, tz + 1.4), 55, (0.88, 0.94, 0.9), 1.1)
    area("Front | logo fill", (tx + 0.15, ty + 2.2, tz + 0.55), 105, (0.88, 0.91, 1.0), 2.1, 1.0)

    cam_data = bpy.data.cameras.new("Beauty Camera")
    cam = bpy.data.objects.new("Beauty Camera", cam_data)
    scene.collection.objects.link(cam)
    cam.location = camera_pos
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.lens = 66
    scene.camera = cam
    return cam


def render_tray_probe():
    reset_scene()
    tray = import_gltf("ashme-tray.glb")[0]
    bpy.context.view_layer.update()
    print("TRAY SOURCE", tray.name, "dims", tuple(tray.dimensions), "materials", [(m.name, tuple(m.diffuse_color), bool(m.use_nodes)) for m in tray.data.materials])
    improve_tray_material(tray)
    tray.scale = tuple(axis * 6.5 for axis in tray.scale)
    if tray.data.materials:
        for old in tray.data.materials:
            print("TRAY SOURCE MATERIAL", old.name, [(n.name, n.type, tuple(n.inputs["Base Color"].default_value) if n.type == "BSDF_PRINCIPLED" else "") for n in old.node_tree.nodes] if old.use_nodes else [])
    tray.location = (0, 0.65, 0.115)
    floor_mat = material_nodes("Studio charcoal", (0.025, 0.038, 0.038), 0.48, noise_scale=85, bump_strength=0.015)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.005))
    floor = bpy.context.object
    floor.name = "Ground"
    floor.data.materials.append(floor_mat)
    cam = studio(bpy.context.scene, (0, 0.65, 0.115), (0.15, 2.6, 1.21))
    cam.data.lens = 72
    bpy.context.scene.render.filepath = os.path.join(OUT, "tray-source-probe.png")
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    build_pipeline()
