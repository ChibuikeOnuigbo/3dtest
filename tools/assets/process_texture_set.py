#!/usr/bin/env python3
"""Turn a single source image into a seamless PBR texture set (albedo / normal / roughness).

    python3 tools/assets/process_texture_set.py <source.png> <set-name> --size 1024 --tile 3 --blend 0.05

Output: public/textures/sets/<set-name>/{albedo,normal,roughness}.jpg and an updated
public/textures/sets/manifest.json (physical tile size in metres, provenance, licence).

Method (documented for the asset manifest):
  1. Square-crop + resize the source.
  2. Make it seamless with an edge cross-blend (`--blend` fraction of the width). 0.05 keeps
     the blend narrow so photographic detail is not smeared into ghost bands.
  3. Normal map from a blurred luminance height field (Sobel), normalised, OpenGL +Y.
  4. Roughness from inverted local contrast, biased to `--rough` so nothing is 100 % rough
     or 100 % glossy (Poly Haven guidance: keep roughness in a physically plausible band).
This is a *derived* set, not a photometric scan. Poly Haven CC0 scans are preferred when
present; see src/world/materials.js SET_SOURCES.
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_ROOT = os.path.join(ROOT, 'public', 'textures', 'sets')


def square_resize(image, size):
    w, h = image.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return image.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)


def make_seamless(arr, blend):
    """Cross-blend the opposite edges so the tile wraps without a visible seam."""
    h, w, _ = arr.shape
    bw = max(2, int(w * blend))
    out = arr.astype(np.float32).copy()
    # horizontal wrap: blend the left `bw` columns with the mirrored right edge
    ramp = np.linspace(0, 1, bw, dtype=np.float32)[None, :, None]
    left = out[:, :bw, :]
    right = out[:, w - bw:, :]
    mixed = left * ramp + right[:, ::-1, :] * (1 - ramp)
    out[:, :bw, :] = mixed
    out[:, w - bw:, :] = mixed[:, ::-1, :]
    ramp_v = np.linspace(0, 1, bw, dtype=np.float32)[:, None, None]
    top = out[:bw, :, :]
    bottom = out[h - bw:, :, :]
    mixed_v = top * ramp_v + bottom[::-1, :, :] * (1 - ramp_v)
    out[:bw, :, :] = mixed_v
    out[h - bw:, :, :] = mixed_v[::-1, :, :]
    return np.clip(out, 0, 255).astype(np.uint8)


def height_field(albedo, blur=1.2):
    gray = Image.fromarray(albedo).convert('L').filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(gray, dtype=np.float32) / 255.0


def normal_map(height, strength):
    dx = np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)
    dy = np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)
    nx = -dx * strength
    ny = dy * strength  # OpenGL convention (+Y up)
    nz = np.ones_like(height)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.stack([nx / length, ny / length, nz / length], axis=-1)
    return ((normal * 0.5 + 0.5) * 255).astype(np.uint8)


def roughness_map(albedo, base, spread):
    gray = np.asarray(Image.fromarray(albedo).convert('L'), dtype=np.float32) / 255.0
    local = np.asarray(Image.fromarray((gray * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4)), dtype=np.float32) / 255.0
    contrast = np.abs(gray - local)
    contrast = contrast / max(1e-5, contrast.max())
    rough = np.clip(base + (0.5 - contrast) * spread, 0.25, 0.95)
    return (rough * 255).astype(np.uint8)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('name')
    parser.add_argument('--size', type=int, default=1024)
    parser.add_argument('--tile', type=float, default=2.0, help='physical size of one tile in metres')
    parser.add_argument('--blend', type=float, default=0.05)
    parser.add_argument('--normal-strength', type=float, default=2.2)
    parser.add_argument('--rough', type=float, default=0.75)
    parser.add_argument('--rough-spread', type=float, default=0.3)
    parser.add_argument('--family', default='')
    parser.add_argument('--provenance', default='generated:image-model (project-owned derivative)')
    parser.add_argument('--license', default='project-generated, CC0-equivalent for this repository')
    args = parser.parse_args()

    image = Image.open(args.source).convert('RGB')
    image = square_resize(image, args.size)
    albedo = make_seamless(np.asarray(image), args.blend)
    height = height_field(albedo)
    normal = normal_map(height, args.normal_strength)
    rough = roughness_map(albedo, args.rough, args.rough_spread)

    out_dir = os.path.join(OUT_ROOT, args.name)
    os.makedirs(out_dir, exist_ok=True)
    # Note: PIL's optimize=True + subsampling=0 on noisy 1024² normal maps raised
    # "broken data stream" in this environment; plain quality saves are reliable.
    Image.fromarray(albedo).save(os.path.join(out_dir, 'albedo.jpg'), quality=82)
    Image.fromarray(normal).save(os.path.join(out_dir, 'normal.jpg'), quality=80)
    Image.fromarray(rough).save(os.path.join(out_dir, 'roughness.jpg'), quality=78)

    manifest_path = os.path.join(OUT_ROOT, 'manifest.json')
    manifest = {'schema': 'rivet-run-texture-sets/v1', 'sets': {}}
    if os.path.exists(manifest_path):
        with open(manifest_path) as handle:
            manifest = json.load(handle)
    manifest['sets'][args.name] = {
        'family': args.family or args.name,
        'tile_m': args.tile,
        'size_px': args.size,
        'maps': ['albedo', 'normal', 'roughness'],
        'source': os.path.relpath(args.source, ROOT),
        'provenance': args.provenance,
        'license': args.license,
        'derived_maps': 'normal from blurred luminance height (Sobel); roughness from inverted local contrast',
        'quality_class': 'derived (not photometric) — replace with Poly Haven scan when CI fetch succeeds',
    }
    with open(manifest_path, 'w') as handle:
        json.dump(manifest, handle, indent=2)
    print(f'wrote {out_dir} ({args.size}px, tile {args.tile} m)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
