#!/usr/bin/env python3
"""Read-only forensic inventory for isolated GitHub reference checkouts.

It intentionally never copies reference media into the game. The output is a
provenance-first manifest: every source asset defaults to BLOCKED until its original
creator/license and visual/technical fit have been checked.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import struct
import wave
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any

MODEL_SUFFIXES = {".gltf", ".glb", ".obj", ".fbx", ".blend", ".dae", ".3ds"}
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tga", ".hdr", ".exr", ".tif", ".tiff"}
AUDIO_SUFFIXES = {".wav", ".mp3", ".ogg", ".flac", ".aac", ".m4a", ".opus"}
FONT_SUFFIXES = {".ttf", ".otf", ".woff", ".woff2"}
ARCHIVE_SUFFIXES = {".zip", ".7z", ".rar", ".tar", ".gz"}
SKIP_NAMES = {".git", "node_modules", "dist", "build", "coverage", "__pycache__"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def png_size(stream) -> dict[str, int] | None:
    if stream.read(8) != b"\x89PNG\r\n\x1a\n":
        return None
    length = struct.unpack(">I", stream.read(4))[0]
    if stream.read(4) != b"IHDR" or length < 8:
        return None
    width, height = struct.unpack(">II", stream.read(8))
    return {"width": width, "height": height}


def jpeg_size(stream) -> dict[str, int] | None:
    if stream.read(2) != b"\xff\xd8":
        return None
    while True:
        marker_prefix = stream.read(1)
        if not marker_prefix:
            return None
        if marker_prefix != b"\xff":
            continue
        marker = stream.read(1)
        while marker == b"\xff":
            marker = stream.read(1)
        if not marker or marker in {b"\xd8", b"\xd9"}:
            continue
        length_bytes = stream.read(2)
        if len(length_bytes) != 2:
            return None
        length = struct.unpack(">H", length_bytes)[0]
        if marker[0] in {*range(0xC0, 0xC4), *range(0xC5, 0xC8), *range(0xC9, 0xCC), *range(0xCD, 0xD0)}:
            data = stream.read(5)
            if len(data) != 5:
                return None
            _, height, width = struct.unpack(">BHH", data)
            return {"width": width, "height": height}
        stream.seek(max(0, length - 2), 1)


def gif_size(stream) -> dict[str, int] | None:
    header = stream.read(10)
    if header[:6] not in {b"GIF87a", b"GIF89a"}:
        return None
    width, height = struct.unpack("<HH", header[6:10])
    return {"width": width, "height": height}


def webp_size(stream) -> dict[str, int] | None:
    header = stream.read(30)
    if len(header) < 16 or header[:4] != b"RIFF" or header[8:12] != b"WEBP":
        return None
    tag = header[12:16]
    if tag == b"VP8X" and len(header) >= 30:
        return {"width": 1 + int.from_bytes(header[24:27], "little"), "height": 1 + int.from_bytes(header[27:30], "little")}
    if tag == b"VP8L" and len(header) >= 25 and header[20] == 0x2F:
        bits = int.from_bytes(header[21:25], "little")
        return {"width": (bits & 0x3FFF) + 1, "height": ((bits >> 14) & 0x3FFF) + 1}
    if tag == b"VP8 " and len(header) >= 30:
        start = header.find(b"\x9d\x01\x2a")
        if start >= 0 and len(header) >= start + 7:
            return {"width": struct.unpack("<H", header[start + 3:start + 5])[0] & 0x3FFF, "height": struct.unpack("<H", header[start + 5:start + 7])[0] & 0x3FFF}
    return None


def image_details(path: Path) -> dict[str, Any]:
    try:
        with path.open("rb") as stream:
            details = png_size(stream) if path.suffix.lower() == ".png" else None
            if details is None and path.suffix.lower() in {".jpg", ".jpeg"}:
                stream.seek(0); details = jpeg_size(stream)
            if details is None and path.suffix.lower() == ".gif":
                stream.seek(0); details = gif_size(stream)
            if details is None and path.suffix.lower() == ".webp":
                stream.seek(0); details = webp_size(stream)
        return details or {}
    except (OSError, struct.error):
        return {"inspection_error": "unreadable_or_unsupported_image"}


def flac_details(path: Path) -> dict[str, Any]:
    try:
        data = path.read_bytes()[:42]
        if data[:4] != b"fLaC" or len(data) < 42:
            return {}
        block_len = int.from_bytes(data[5:8], "big")
        if block_len != 34:
            return {}
        stream_info = data[8:42]
        packed = int.from_bytes(stream_info[10:18], "big")
        sample_rate = packed >> 44
        channels = ((packed >> 41) & 0x7) + 1
        total_samples = packed & ((1 << 36) - 1)
        result: dict[str, Any] = {"sample_rate": sample_rate, "channels": channels}
        if sample_rate:
            result["duration_seconds"] = round(total_samples / sample_rate, 3)
        return result
    except OSError:
        return {"inspection_error": "unreadable_flac"}


def audio_details(path: Path) -> dict[str, Any]:
    suffix = path.suffix.lower()
    if suffix == ".wav":
        try:
            with wave.open(str(path), "rb") as data:
                frames, rate = data.getnframes(), data.getframerate()
                return {"channels": data.getnchannels(), "sample_rate": rate, "duration_seconds": round(frames / rate, 3) if rate else None}
        except (OSError, wave.Error):
            return {"inspection_error": "unreadable_wav"}
    if suffix == ".flac":
        return flac_details(path)
    return {}


def triangle_count(mode: int, index_count: int) -> int | None:
    if mode == 4: return index_count // 3
    if mode in {5, 6}: return max(0, index_count - 2)
    return None


def gltf_details(payload: dict[str, Any]) -> dict[str, Any]:
    accessors = payload.get("accessors", [])
    triangles = 0
    known_triangles = True
    primitives = 0
    vertex_count = 0
    for mesh in payload.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            primitives += 1
            position = primitive.get("attributes", {}).get("POSITION")
            if isinstance(position, int) and position < len(accessors):
                vertex_count += int(accessors[position].get("count", 0))
            index = primitive.get("indices")
            if isinstance(index, int) and index < len(accessors):
                count = int(accessors[index].get("count", 0))
            elif isinstance(position, int) and position < len(accessors):
                count = int(accessors[position].get("count", 0))
            else:
                known_triangles = False; continue
            value = triangle_count(int(primitive.get("mode", 4)), count)
            if value is None: known_triangles = False
            else: triangles += value
    detail: dict[str, Any] = {
        "mesh_count": len(payload.get("meshes", [])), "primitive_count": primitives,
        "node_count": len(payload.get("nodes", [])), "material_count": len(payload.get("materials", [])),
        "animation_count": len(payload.get("animations", [])), "vertex_count": vertex_count,
    }
    if known_triangles: detail["estimated_triangles"] = triangles
    return detail


def model_details(path: Path) -> dict[str, Any]:
    suffix = path.suffix.lower()
    try:
        if suffix == ".gltf":
            return gltf_details(json.loads(path.read_text(encoding="utf-8")))
        if suffix == ".glb":
            with path.open("rb") as stream:
                header = stream.read(12)
                if len(header) != 12 or header[:4] != b"glTF": return {"inspection_error": "invalid_glb"}
                _, _, total_length = struct.unpack("<4sII", header)
                chunk_header = stream.read(8)
                if len(chunk_header) != 8: return {"inspection_error": "missing_glb_json"}
                chunk_length, chunk_type = struct.unpack("<I4s", chunk_header)
                if chunk_type != b"JSON": return {"inspection_error": "unexpected_first_glb_chunk"}
                payload = json.loads(stream.read(chunk_length).decode("utf-8").rstrip(" \t\r\n\x00"))
                result = gltf_details(payload)
                result["glb_length"] = total_length
                return result
        if suffix == ".obj":
            vertices = normals = texcoords = faces = 0
            with path.open("r", encoding="utf-8", errors="ignore") as stream:
                for line in stream:
                    if line.startswith("v "): vertices += 1
                    elif line.startswith("vn "): normals += 1
                    elif line.startswith("vt "): texcoords += 1
                    elif line.startswith("f "): faces += 1
            return {"vertex_count": vertices, "normal_count": normals, "uv_count": texcoords, "face_count": faces}
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, struct.error):
        return {"inspection_error": "unreadable_or_unsupported_model"}
    return {}


def archive_details(path: Path) -> dict[str, Any]:
    if path.suffix.lower() != ".zip": return {}
    try:
        with zipfile.ZipFile(path) as archive:
            files = [entry for entry in archive.infolist() if not entry.is_dir()]
            kinds = Counter(Path(entry.filename).suffix.lower() or "[none]" for entry in files)
            return {"contained_file_count": len(files), "contained_extension_counts": dict(sorted(kinds.items()))}
    except (OSError, zipfile.BadZipFile):
        return {"inspection_error": "unreadable_zip"}


def category(path: Path) -> str | None:
    suffix = path.suffix.lower()
    if suffix in MODEL_SUFFIXES: return "model"
    if suffix in IMAGE_SUFFIXES: return "image"
    if suffix in AUDIO_SUFFIXES: return "audio"
    if suffix in FONT_SUFFIXES: return "font"
    if suffix in ARCHIVE_SUFFIXES: return "archive"
    return None


def scan_repo(repo: Path) -> dict[str, Any]:
    asset_records: list[dict[str, Any]] = []
    for path in sorted(repo.rglob("*")):
        if not path.is_file() or any(part in SKIP_NAMES for part in path.relative_to(repo).parts): continue
        kind = category(path)
        if kind is None: continue
        relative = path.relative_to(repo).as_posix()
        record: dict[str, Any] = {
            "path": relative, "category": kind, "extension": path.suffix.lower(),
            "bytes": path.stat().st_size, "sha256": sha256(path),
            "status": "DISCOVERED",
            "eligibility": "BLOCKED_PENDING_PROVENANCE_AND_VISUAL_REVIEW",
            "block_reason": "Reference media needs original-source licensing, visual-fit, scale and performance review before any legal production import.",
        }
        if kind == "image": record["technical"] = image_details(path)
        elif kind == "audio": record["technical"] = audio_details(path)
        elif kind == "model": record["technical"] = model_details(path)
        elif kind == "archive": record["technical"] = archive_details(path)
        asset_records.append(record)
    by_category = Counter(record["category"] for record in asset_records)
    by_extension = Counter(record["extension"] for record in asset_records)
    bytes_by_category: Counter[str] = Counter()
    for record in asset_records: bytes_by_category[record["category"]] += record["bytes"]
    return {
        "checkout": repo.as_posix(),
        "asset_count": len(asset_records),
        "asset_counts_by_category": dict(sorted(by_category.items())),
        "asset_bytes_by_category": dict(sorted(bytes_by_category.items())),
        "asset_counts_by_extension": dict(sorted(by_extension.items())),
        "assets": asset_records,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default="research/github_repos", type=Path)
    parser.add_argument("--output", default="research/github/asset_forensics.json", type=Path)
    args = parser.parse_args()
    repositories = [path for path in sorted(args.root.iterdir()) if path.is_dir() and (path / ".git").exists()]
    result = {
        "schema": "reference-asset-forensics/v1",
        "policy": "Read-only reference scan. This manifest is not asset permission and never authorizes copying or merging media into production.",
        "repositories": {repo.name: scan_repo(repo) for repo in repositories},
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    for name, data in result["repositories"].items():
        print(f"{name}: {data['asset_count']} assets; {data['asset_counts_by_category']}; {data['asset_bytes_by_category']}")

if __name__ == "__main__":
    main()
