#!/usr/bin/env python3
"""Repeatable Blender GLB export entry point; preserves Blender scene materials/animations when Blender supports them."""
import argparse, shutil, subprocess, sys
p=argparse.ArgumentParser(); p.add_argument('input'); p.add_argument('output'); a=p.parse_args(); blender=shutil.which('blender')
if not blender: print('Blender is not installed; BLEND conversion intentionally not attempted.', file=sys.stderr); raise SystemExit(2)
raise SystemExit(subprocess.call([blender,'--background',a.input,'--python-expr',"import bpy; bpy.ops.export_scene.gltf(filepath=%r, export_format='GLB')" % a.output]))
