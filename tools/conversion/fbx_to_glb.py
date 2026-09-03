#!/usr/bin/env python3
"""Repeatable Blender conversion entry point. Requires a locally installed Blender executable."""
import argparse, shutil, subprocess, sys
p=argparse.ArgumentParser(); p.add_argument('input'); p.add_argument('output'); a=p.parse_args()
blender=shutil.which('blender')
if not blender: print('Blender is not installed; FBX conversion intentionally not attempted.', file=sys.stderr); raise SystemExit(2)
script="import bpy; bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.fbx(filepath=%r); bpy.ops.export_scene.gltf(filepath=%r, export_format='GLB')" % (a.input,a.output)
raise SystemExit(subprocess.call([blender,'--background','--python-expr',script]))
