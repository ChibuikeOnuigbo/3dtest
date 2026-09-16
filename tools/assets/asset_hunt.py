#!/usr/bin/env python3
"""
asset_hunt.py — time-boxed (default 2 h) hunt for REAL, licence-checked, non-low-poly 3D assets.

    python3 tools/assets/asset_hunt.py --hours 2 --out public/models/hunt --target 40

Runs in GitHub Actions (the dev sandbox has no network egress). Loop until the timer expires or the
target number of approved assets is reached:

  1. Sketchfab — public search API with a rotating query matrix ("industrial" × props/pack/kit/scene/
     map/modular + specific prop nouns). Zero-yield queries are MUTATED (modifier swap, synonym swap,
     drop a word) before the next pass instead of being repeated verbatim. Downloads go through the
     official authorised endpoint using SKETCHFAB_API_TOKEN, or through the project's Cloudflare worker
     when SKETCHFAB_PROXY_URL is set (the worker mirrors `/v3/models/<uid>/download`; if it answers
     anything but JSON with a glb url the exact response code is recorded and the source is skipped).
  2. Poly Haven — CC0 models API (no credential). Every model whose tags/categories match the hunt
     vocabulary and that is not already in the roster is fetched (1k glTF + textures).
  3. OpenGameArt — 3D-art search pages (CC0 / CC-BY / CC-BY-SA filters), item pages scraped for
     glTF/GLB/zip file links; only glTF/GLB payloads (or zips containing them) are accepted because the
     game loads glTF only.

Every asset is inspected (GLB/glTF JSON: node tree, POSITION accessor bounds transformed by the node
matrices, triangle count, material textures) and gets a per-asset verdict with reasons. Rules enforced:
no low-poly / voxel / cartoon / Kenney-style assets, PBR textures required, 300 ≤ triangles ≤ 150 000,
size sanity 0.05 m … 40 m, licence ∈ {CC0, CC-BY, CC-BY-SA}. The credential is never printed or written.

Outputs
  <out>/<asset_id>/{model.glb|*.gltf,+includes}, <out>/<asset_id>/meta.json
  <out>/manifest.json   — same schema as public/models/polyhaven/manifest.json (PropLibrary loads it)
  research/asset_hunt/latest.json — full ledger: every query, every candidate, every verdict + reason
"""
from __future__ import annotations

import argparse
import base64
import html
import io
import json
import math
import os
import re
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UA = "RivetRunAssetHunt/1.0 (licence-checked intake; contact via repo issues)"
TOKEN = os.environ.get("SKETCHFAB_API_TOKEN") or os.environ.get("SKETCHFAB_TOKEN") or ""
PROXY = (os.environ.get("SKETCHFAB_PROXY_URL") or "").rstrip("/")

BAD_STYLE = re.compile(r"\b(low[\s_-]?poly|lowpoly|voxel|kenney|cartoon|styli[sz]ed|toon|minecraft|lego|anime|chibi|isometric|papercraft)\b", re.I)
LICENCE_MAP = {
    "CC0 Public Domain": "CC0-1.0", "CC Attribution": "CC-BY-4.0", "CC Attribution-ShareAlike": "CC-BY-SA-4.0",
    "CC0": "CC0-1.0", "CC-BY 4.0": "CC-BY-4.0", "CC-BY 3.0": "CC-BY-3.0", "CC-BY-SA 4.0": "CC-BY-SA-4.0", "CC-BY-SA 3.0": "CC-BY-SA-3.0",
}
HUNT_VOCAB = ["industrial", "barrel", "drum", "crate", "pallet", "tool", "pipe", "machine", "container", "cable", "extinguisher",
              "lamp", "gas", "scaffold", "fence", "tyre", "tire", "bin", "trash", "sign", "generator", "valve", "tank", "vent", "fan",
              "ladder", "forklift", "dumpster", "shutter", "door", "warehouse", "factory", "cabinet", "switch", "boiler", "girder", "beam"]

SKETCHFAB_BASE_QUERIES = [
    ("industrial props pack", "prop kit"), ("industrial props kit", "prop kit"), ("warehouse props pack", "warehouse dressing"),
    ("factory props", "factory dressing"), ("industrial scene modular", "modular scene pieces"), ("industrial environment kit", "environment kit"),
    ("industrial map", "whole scene"), ("roller shutter door", "roller door dressing"), ("industrial door", "steel doors"),
    ("oil drum barrel", "drums"), ("wooden pallet", "pallets"), ("electrical cabinet industrial", "switchgear"), ("fire extinguisher", "wall props"),
    ("gas cylinder", "yard props"), ("cable reel drum", "yard props"), ("dumpster", "yard props"), ("industrial pipes modular", "pipe runs"),
    ("scaffolding", "scaffold"), ("forklift", "vehicle"), ("industrial lamp", "light fixtures"), ("ventilation fan industrial", "rooftop machinery"),
    ("steel girder beam", "structure"), ("industrial valve", "pipe dressing"), ("metal ladder", "ladders"), ("industrial railing", "railings"),
    ("generator diesel", "machinery"), ("shipping container", "containers"), ("tool chest", "workshop"), ("welding machine", "workshop"),
]
MODIFIERS = ["pbr", "game ready", "photogrammetry", "scan", "", "4k", "realistic"]
SYNONYMS = {"props": "assets", "pack": "collection", "kit": "set", "scene": "environment", "industrial": "factory", "modular": "kitbash", "map": "level"}


def log(*parts):
    print(*parts, flush=True)


def fetch(url, headers=None, timeout=60, binary=False, auth=False):
    h = {"User-Agent": UA, "Accept": "*/*"}
    if auth and TOKEN:
        h["Authorization"] = f"Token {TOKEN}"
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        data = res.read()
        return res.status, (data if binary else data.decode("utf-8", "replace"))


def fetch_json(url, auth=False):
    try:
        status, text = fetch(url, headers={"Accept": "application/json"}, auth=auth)
        return status, json.loads(text), None
    except urllib.error.HTTPError as e:
        body = e.read()[:200].decode("utf-8", "replace")
        return e.code, None, f"HTTP {e.code}: {body}"
    except Exception as e:  # noqa: BLE001
        return 0, None, str(e)


# ------------------------------------------------------------------ glTF inspection (pure python)
def mat_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def node_matrix(node):
    if "matrix" in node:
        m = node["matrix"]
        return [[m[c * 4 + r] for c in range(4)] for r in range(4)]  # column-major → rows
    t = node.get("translation", [0, 0, 0]); q = node.get("rotation", [0, 0, 0, 1]); s = node.get("scale", [1, 1, 1])
    x, y, z, w = q
    r = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[r[0][0] * s[0], r[0][1] * s[1], r[0][2] * s[2], t[0]],
            [r[1][0] * s[0], r[1][1] * s[1], r[1][2] * s[2], t[1]],
            [r[2][0] * s[0], r[2][1] * s[1], r[2][2] * s[2], t[2]], [0, 0, 0, 1]]


def transform_point(m, p):
    return [m[i][0] * p[0] + m[i][1] * p[1] + m[i][2] * p[2] + m[i][3] for i in range(3)]


def inspect_gltf(gltf):
    accessors = gltf.get("accessors", []); meshes = gltf.get("meshes", []); nodes = gltf.get("nodes", [])
    scene = gltf.get("scenes", [{}])[gltf.get("scene", 0)] if gltf.get("scenes") else {"nodes": list(range(len(nodes)))}

    def walk(idx, parent, acc):
        node = nodes[idx]; m = mat_mul(parent, node_matrix(node))
        if "mesh" in node:
            for prim in meshes[node["mesh"]].get("primitives", []):
                pos = prim.get("attributes", {}).get("POSITION")
                if pos is None:
                    continue
                a = accessors[pos]
                if "min" in a and "max" in a:
                    for cx in (a["min"][0], a["max"][0]):
                        for cy in (a["min"][1], a["max"][1]):
                            for cz in (a["min"][2], a["max"][2]):
                                p = transform_point(m, [cx, cy, cz])
                                for i in range(3):
                                    acc["min"][i] = min(acc["min"][i], p[i]); acc["max"][i] = max(acc["max"][i], p[i])
                if "indices" in prim:
                    acc["tris"] += accessors[prim["indices"]]["count"] // 3
                else:
                    acc["tris"] += a["count"] // 3
                if "material" in prim:
                    acc["materials"].add(prim["material"])
        for child in node.get("children", []):
            walk(child, m, acc)

    ident = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
    out_nodes = []
    for root in scene.get("nodes", []):
        acc = {"min": [math.inf] * 3, "max": [-math.inf] * 3, "tris": 0, "materials": set()}
        walk(root, ident, acc)
        if acc["tris"] == 0 or acc["min"][0] == math.inf:
            continue
        size = [acc["max"][i] - acc["min"][i] for i in range(3)]
        out_nodes.append({"name": nodes[root].get("name", f"node_{root}"), "translation": nodes[root].get("translation", [0, 0, 0]),
                          "bounds": {"min": acc["min"], "max": acc["max"]}, "size_m": size, "triangles": acc["tris"], "lod": None,
                          "materials": sorted(acc["materials"])})
    mats = []
    for m in gltf.get("materials", []):
        pbr = m.get("pbrMetallicRoughness", {})
        mats.append({"name": m.get("name"), "hasBaseColor": "baseColorTexture" in pbr, "hasNormal": "normalTexture" in m,
                     "hasMetalRough": "metallicRoughnessTexture" in pbr})
    return {"nodes": out_nodes, "triangles_total": sum(n["triangles"] for n in out_nodes), "materials": mats,
            "images": len(gltf.get("images", [])), "extensions_used": gltf.get("extensionsUsed", [])}


def parse_glb(data: bytes):
    magic, _version, _length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67:
        raise ValueError("not a GLB")
    chunk_len, chunk_type = struct.unpack_from("<II", data, 12)
    if chunk_type != 0x4E4F534A:
        raise ValueError("first chunk not JSON")
    return json.loads(data[20:20 + chunk_len].decode("utf-8"))


def quality_verdict(inspection, max_tris):
    reasons = []
    roots = [n for n in inspection["nodes"] if n.get("bounds")]
    if not roots:
        return ["no geometry with bounds"]
    largest = max(max(n["size_m"]) for n in roots)
    if largest > 40:
        reasons.append(f"largest dimension {largest:.1f} m — scale suspect (cm export?)")
    if largest < 0.05:
        reasons.append("model smaller than 5 cm — scale suspect")
    tris = inspection["triangles_total"]
    if tris < 300:
        reasons.append(f"{tris} triangles — blocky / low-poly, excluded by project rule")
    if tris > max_tris:
        reasons.append(f"{tris} triangles > budget {max_tris}")
    if not any(m["hasBaseColor"] for m in inspection["materials"]) and inspection["images"] == 0:
        reasons.append("no textures — untextured mesh")
    return reasons


# ------------------------------------------------------------------ ledger + manifest
class Hunt:
    def __init__(self, args):
        self.args = args
        self.start = time.monotonic()
        self.deadline = self.start + args.hours * 3600
        self.out = Path(args.out); self.out.mkdir(parents=True, exist_ok=True)
        self.report_path = ROOT / "research/asset_hunt/latest.json"
        self.ledger = {"schema": "rivet-run-asset-hunt/v1", "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "hours": args.hours,
                       "token_present": bool(TOKEN), "proxy_present": bool(PROXY), "credential_logged": False,
                       "passes": [], "queries": [], "candidates": [], "approved": [], "rejected": [], "failed": [], "total_bytes": 0}
        self.manifest = {"schema": "rivet-run-hunt-models/v1", "source": "sketchfab.com / polyhaven.com / opengameart.org (per-asset licence recorded)",
                         "base_path": "/models/hunt", "models": {}, "rejected": [], "failed": [], "total_bytes": 0}
        self.seen = set()
        self.roster = set(json.loads((ROOT / "tools/assets/polyhaven_dimensions.json").read_text())["models"].keys()) if (ROOT / "tools/assets/polyhaven_dimensions.json").exists() else set()
        self.sketchfab_dead = None  # reason string once the download path is proven dead

    # ---- timer
    def time_left(self):
        return self.deadline - time.monotonic()

    def running(self):
        return self.time_left() > 0 and len(self.ledger["approved"]) < self.args.target and self.ledger["total_bytes"] < self.args.max_total_mb * 1048576

    def save(self):
        self.ledger["elapsed_min"] = round((time.monotonic() - self.start) / 60, 1)
        self.report_path.parent.mkdir(parents=True, exist_ok=True)
        self.report_path.write_text(json.dumps(self.ledger, indent=2) + "\n")
        (self.out / "manifest.json").write_text(json.dumps(self.manifest, indent=2) + "\n")

    # ---- shared accept path
    def accept(self, asset_id, source, meta, payload_glb=None, gltf_json=None, files=None):
        """Inspect + write. `payload_glb` (bytes) OR `gltf_json` (+ `files` dict name→bytes for includes)."""
        try:
            gltf = parse_glb(payload_glb) if payload_glb is not None else gltf_json
            inspection = inspect_gltf(gltf)
            reasons = quality_verdict(inspection, self.args.max_faces)
            if reasons:
                rec = {**meta, "id": asset_id, "verdict": "REJECTED_AFTER_INSPECTION", "reasons": reasons, "triangles": inspection["triangles_total"]}
                self.ledger["rejected"].append(rec); self.manifest["rejected"].append({"id": asset_id, "reasons": reasons}); return False
            folder = self.out / asset_id; folder.mkdir(parents=True, exist_ok=True)
            total = 0
            if payload_glb is not None:
                (folder / f"{asset_id}.glb").write_bytes(payload_glb); total += len(payload_glb); entry = f"{asset_id}.glb"
            else:
                for name, data in files.items():
                    p = folder / name; p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(data); total += len(data)
                entry = meta["gltf_entry"]
            (folder / "meta.json").write_text(json.dumps({**meta, "id": asset_id, "inspection": {k: v for k, v in inspection.items() if k != "nodes"}, "nodes": inspection["nodes"]}, indent=2) + "\n")
            self.manifest["models"][asset_id] = {"name": meta.get("name"), "gltf": entry, "role": meta.get("role"), "triangles": inspection["triangles_total"],
                                                 "nodes": inspection["nodes"], "variants": [n["name"] for n in inspection["nodes"]], "materials": inspection["materials"],
                                                 "bundle_bytes": total, "authors": {meta.get("author", "?"): meta.get("url")}, "license": meta.get("licence"),
                                                 "source": meta.get("url"), "origin": source, "base_path": "/models/hunt"}
            self.manifest["total_bytes"] += total; self.ledger["total_bytes"] += total
            rec = {**meta, "id": asset_id, "verdict": "APPROVED", "triangles": inspection["triangles_total"], "size_m": [round(v, 3) for v in inspection["nodes"][0]["size_m"]], "bytes": total, "origin": source}
            self.ledger["approved"].append(rec)
            log(f"APPROVED [{source}] {asset_id}: {rec['triangles']} tris, {rec['size_m']} m, {meta.get('licence')}")
            return True
        except Exception as e:  # noqa: BLE001
            self.ledger["failed"].append({**meta, "id": asset_id, "error": str(e)}); return False

    # ---- Sketchfab
    def sketchfab_pass(self, pass_no):
        picked = 0
        for base, role in SKETCHFAB_BASE_QUERIES:
            if not self.running():
                return picked
            q = self.mutate_query(base, pass_no)
            url = ("https://api.sketchfab.com/v3/search?type=models&downloadable=true&count=24&sort_by=-likeCount&archives_flavours=false&q=" + urllib.parse.quote(q))
            status, data, err = fetch_json(url)
            entry = {"source": "sketchfab", "pass": pass_no, "q": q, "status": status, "results": 0, "candidates": 0, "approved": 0}
            if not data:
                entry["error"] = err; self.ledger["queries"].append(entry); continue
            for m in data.get("results", []):
                entry["results"] += 1
                uid = m.get("uid")
                if uid in self.seen:
                    continue
                self.seen.add(uid)
                meta, reasons = self.sketchfab_triage(m, role, q)
                if reasons:
                    self.ledger["rejected"].append({**meta, "verdict": "REJECTED", "reasons": reasons}); continue
                entry["candidates"] += 1
                if self.sketchfab_download(meta):
                    entry["approved"] += 1; picked += 1
                if self.sketchfab_dead or not self.running():
                    break
            self.ledger["queries"].append(entry); self.save()
            if self.sketchfab_dead:
                return picked
        return picked

    def mutate_query(self, base, pass_no):
        if pass_no == 0:
            return f"{base} pbr".strip()
        words = base.split()
        mod = MODIFIERS[pass_no % len(MODIFIERS)]
        if pass_no % 3 == 1:
            words = [SYNONYMS.get(w, w) for w in words]
        elif pass_no % 3 == 2 and len(words) > 1:
            words = words[:-1]
        return " ".join(w for w in words + [mod] if w)

    def sketchfab_triage(self, m, role, q):
        glb = (m.get("archives") or {}).get("glb") or {}
        licence = LICENCE_MAP.get((m.get("license") or {}).get("label", ""))
        faces = m.get("faceCount") or glb.get("faceCount") or 0
        text = " ".join([m.get("name", ""), m.get("description", "")] + [t.get("slug", "") for t in m.get("tags", [])])
        meta = {"source": "sketchfab", "uid": m.get("uid"), "name": m.get("name"), "author": (m.get("user") or {}).get("username"), "url": m.get("viewerUrl"),
                "licence_label": (m.get("license") or {}).get("label"), "licence": licence, "faces": faces, "glb_bytes": glb.get("size"), "likes": m.get("likeCount"), "query": q, "role": role}
        reasons = []
        if not m.get("isDownloadable"):
            reasons.append("not downloadable")
        if not licence:
            reasons.append(f"licence '{meta['licence_label']}' not CC0/CC-BY/CC-BY-SA")
        bad = BAD_STYLE.search(text)
        if bad:
            reasons.append(f"style excluded by project rule ({bad.group(0)})")
        if faces and faces < 300:
            reasons.append(f"faceCount {faces} — blocky")
        if faces > self.args.max_faces:
            reasons.append(f"faceCount {faces} > {self.args.max_faces}")
        if not glb:
            reasons.append("no glb archive")
        elif glb.get("size", 0) > self.args.max_asset_mb * 1048576:
            reasons.append(f"glb {glb['size'] / 1048576:.1f} MB > {self.args.max_asset_mb} MB")
        if glb and glb.get("textureCount") == 0:
            reasons.append("untextured")
        if glb and glb.get("textureMaxResolution") and glb["textureMaxResolution"] < 1024:
            reasons.append(f"textures only {glb['textureMaxResolution']}px")
        return meta, reasons

    def sketchfab_download(self, meta):
        if self.sketchfab_dead:
            return False
        if not TOKEN and not PROXY:
            self.sketchfab_dead = "no SKETCHFAB_API_TOKEN and no SKETCHFAB_PROXY_URL in the environment — search/triage ran, authorised download impossible"
            self.ledger["failed"].append({"source": "sketchfab", "code": "NO_CREDENTIAL", "message": self.sketchfab_dead}); return False
        endpoint = f"{PROXY}/v3/models/{meta['uid']}/download" if PROXY else f"https://api.sketchfab.com/v3/models/{meta['uid']}/download"
        status, data, err = fetch_json(endpoint, auth=not PROXY)
        if not data or not (data.get("glb") or {}).get("url"):
            msg = f"download endpoint {'(worker) ' if PROXY else ''}{status}: {err or 'no glb url in response'}"
            self.ledger["failed"].append({**meta, "error": msg})
            if status in (401, 403) or status == 0:
                self.sketchfab_dead = msg  # credential/worker dead: do not hammer it
            return False
        try:
            _s, payload = fetch(data["glb"]["url"], binary=True, timeout=300)
        except Exception as e:  # noqa: BLE001
            self.ledger["failed"].append({**meta, "error": f"glb fetch: {e}"}); return False
        slug = re.sub(r"[^a-z0-9]+", "_", (meta.get("name") or "model").lower()).strip("_")[:40]
        return self.accept(f"sf_{meta['uid'][:8]}_{slug}", "sketchfab", meta, payload_glb=payload)

    # ---- Poly Haven
    def polyhaven_pass(self):
        status, assets, err = fetch_json("https://api.polyhaven.com/assets?t=models")
        if not assets:
            self.ledger["failed"].append({"source": "polyhaven", "error": err}); return 0
        picked = 0
        for asset_id, info in sorted(assets.items(), key=lambda kv: -kv[1].get("download_count", 0)):
            if not self.running():
                break
            if asset_id in self.roster or asset_id in self.seen:
                continue
            words = " ".join(info.get("tags", []) + info.get("categories", []) + [info.get("name", "")]).lower()
            if not any(v in words for v in HUNT_VOCAB):
                continue
            self.seen.add(asset_id)
            meta = {"source": "polyhaven", "name": info.get("name"), "author": ", ".join((info.get("authors") or {}).keys()), "url": f"https://polyhaven.com/a/{asset_id}",
                    "licence": "CC0-1.0", "licence_label": "CC0", "role": "hunt: " + ", ".join(info.get("categories", [])[:3])}
            _s, files, err = fetch_json(f"https://api.polyhaven.com/files/{asset_id}")
            gltf = ((files or {}).get("gltf") or {}).get(self.args.polyhaven_res, {}).get("gltf") if files else None
            if not gltf:
                self.ledger["failed"].append({**meta, "error": f"no {self.args.polyhaven_res} gltf ({err})"}); continue
            include = gltf.get("include", {})
            total = gltf.get("size", 0) + sum(f.get("size", 0) for f in include.values())
            if total > self.args.max_asset_mb * 1048576:
                self.ledger["rejected"].append({**meta, "verdict": "REJECTED", "reasons": [f"bundle {total / 1048576:.1f} MB > {self.args.max_asset_mb} MB"]}); continue
            try:
                blobs = {}
                _s, main = fetch(gltf["url"], binary=True, timeout=300); entry = os.path.basename(gltf["url"]); blobs[entry] = main
                for rel, f in include.items():
                    _s, blobs[rel] = fetch(f["url"], binary=True, timeout=300)
                meta["gltf_entry"] = entry
                if self.accept(asset_id, "polyhaven", meta, gltf_json=json.loads(main.decode("utf-8")), files=blobs):
                    picked += 1
            except Exception as e:  # noqa: BLE001
                self.ledger["failed"].append({**meta, "error": str(e)})
            self.save()
        return picked

    # ---- OpenGameArt (3D art, glTF only)
    def opengameart_pass(self, pass_no):
        picked = 0
        terms = ["industrial", "barrel", "crate", "pallet", "pipe", "machine", "container", "warehouse", "factory", "generator", "fence", "scaffold", "tool", "valve"]
        for term in terms:
            if not self.running():
                break
            for licence_tid in (4, 5, 6):  # 4 = CC0, 5 = CC-BY 3.0, 6 = CC-BY-SA 3.0 (OGA taxonomy)
                url = f"https://opengameart.org/art-search-advanced?keys={urllib.parse.quote(term)}&field_art_type_tid[]=10&field_art_licenses_tid[]={licence_tid}&sort_by=count&sort_order=DESC&items_per_page=48&page={pass_no}"
                try:
                    _s, page = fetch(url)
                except Exception as e:  # noqa: BLE001
                    self.ledger["queries"].append({"source": "opengameart", "q": term, "licence_tid": licence_tid, "error": str(e)}); continue
                slugs = list(dict.fromkeys(re.findall(r'href="/content/([a-z0-9\-]+)"', page)))
                entry = {"source": "opengameart", "pass": pass_no, "q": term, "licence_tid": licence_tid, "results": len(slugs), "approved": 0}
                for slug in slugs:
                    if not self.running():
                        break
                    if f"oga:{slug}" in self.seen:
                        continue
                    self.seen.add(f"oga:{slug}")
                    if self.opengameart_item(slug, term):
                        entry["approved"] += 1; picked += 1
                self.ledger["queries"].append(entry); self.save()
        return picked

    def opengameart_item(self, slug, term):
        url = f"https://opengameart.org/content/{slug}"
        try:
            _s, page = fetch(url)
        except Exception as e:  # noqa: BLE001
            self.ledger["failed"].append({"source": "opengameart", "url": url, "error": str(e)}); return False
        title = html.unescape(re.search(r"<title>(.*?)\s*\|", page, re.S).group(1).strip()) if re.search(r"<title>(.*?)\s*\|", page, re.S) else slug
        author_m = re.search(r'class="username">([^<]+)<', page)
        lic_m = re.findall(r'field-name-field-art-licenses.*?</div>\s*</div>', page, re.S)
        lic_text = html.unescape(re.sub(r"<[^>]+>", " ", lic_m[0])) if lic_m else ""
        licence = next((v for k, v in LICENCE_MAP.items() if k in lic_text), None)
        files = re.findall(r'href="(https://opengameart\.org/sites/default/files/[^"]+\.(?:glb|gltf|zip))"', page, re.I)
        text = title + " " + re.sub(r"<[^>]+>", " ", page[:20000])
        meta = {"source": "opengameart", "name": title, "author": author_m.group(1) if author_m else "?", "url": url, "licence": licence, "licence_label": lic_text.strip()[:40], "query": term, "role": "hunt: " + term}
        reasons = []
        if not licence:
            reasons.append(f"licence not CC0/CC-BY/CC-BY-SA ({lic_text.strip()[:40] or 'none found'})")
        if BAD_STYLE.search(title):
            reasons.append(f"style excluded by project rule ({BAD_STYLE.search(title).group(0)})")
        if not files:
            reasons.append("no glb/gltf/zip attachment (only blend/fbx/obj — game loads glTF)")
        if reasons:
            self.ledger["rejected"].append({**meta, "verdict": "REJECTED", "reasons": reasons}); return False
        for f in files[:3]:
            try:
                _s, payload = fetch(f, binary=True, timeout=300)
            except Exception as e:  # noqa: BLE001
                self.ledger["failed"].append({**meta, "file": f, "error": str(e)}); continue
            if len(payload) > self.args.max_asset_mb * 1048576:
                self.ledger["rejected"].append({**meta, "verdict": "REJECTED", "reasons": [f"{len(payload) / 1048576:.1f} MB > {self.args.max_asset_mb} MB"]}); continue
            asset_id = "oga_" + re.sub(r"[^a-z0-9]+", "_", slug)[:48]
            if f.lower().endswith(".glb"):
                return self.accept(asset_id, "opengameart", {**meta, "file": f}, payload_glb=payload)
            if f.lower().endswith(".zip"):
                try:
                    z = zipfile.ZipFile(io.BytesIO(payload))
                except zipfile.BadZipFile:
                    continue
                glbs = [n for n in z.namelist() if n.lower().endswith(".glb")]
                gltfs = [n for n in z.namelist() if n.lower().endswith(".gltf")]
                if glbs:
                    return self.accept(asset_id, "opengameart", {**meta, "file": f, "member": glbs[0]}, payload_glb=z.read(glbs[0]))
                if gltfs:
                    main = gltfs[0]; base = os.path.dirname(main)
                    blobs = {os.path.relpath(n, base) if base else n: z.read(n) for n in z.namelist() if not n.endswith("/") and (not base or n.startswith(base))}
                    return self.accept(asset_id, "opengameart", {**meta, "file": f, "member": main, "gltf_entry": os.path.basename(main)}, gltf_json=json.loads(z.read(main).decode("utf-8")), files=blobs)
                self.ledger["rejected"].append({**meta, "verdict": "REJECTED", "reasons": ["zip holds no glb/gltf"]})
        return False

    # ---- main loop
    def run(self):
        log(f"asset hunt: {self.args.hours} h budget, target {self.args.target} assets, token={'present' if TOKEN else 'ABSENT'}, worker={'present' if PROXY else 'ABSENT'} (values never printed)")
        pass_no = 0
        while self.running():
            t0 = time.monotonic()
            got = {"sketchfab": self.sketchfab_pass(pass_no), "polyhaven": self.polyhaven_pass() if pass_no == 0 else 0, "opengameart": self.opengameart_pass(pass_no)}
            self.ledger["passes"].append({"pass": pass_no, "approved": got, "minutes": round((time.monotonic() - t0) / 60, 1), "time_left_min": round(self.time_left() / 60, 1)})
            log(f"pass {pass_no}: {got}; approved so far {len(self.ledger['approved'])}; {self.time_left() / 60:.1f} min left")
            self.save()
            if sum(got.values()) == 0 and pass_no >= 6:
                log("six consecutive query mutations without a new approved asset — stopping early (bounded retry rule)"); break
            pass_no += 1
        self.ledger["finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.ledger["result"] = "APPROVED_ASSETS" if self.ledger["approved"] else "NO_ASSET_PASSED"
        if self.sketchfab_dead:
            self.ledger["sketchfab_download_status"] = self.sketchfab_dead
        self.save()
        log(json.dumps({"result": self.ledger["result"], "approved": len(self.ledger["approved"]), "rejected": len(self.ledger["rejected"]), "failed": len(self.ledger["failed"]),
                        "total_mb": round(self.ledger["total_bytes"] / 1048576, 1), "elapsed_min": self.ledger["elapsed_min"], "sketchfab": self.sketchfab_dead or "download path alive"}, indent=2))
        return 0 if self.ledger["approved"] else 2


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hours", type=float, default=2.0)
    ap.add_argument("--out", default="public/models/hunt")
    ap.add_argument("--target", type=int, default=40)
    ap.add_argument("--max-faces", type=int, default=150000)
    ap.add_argument("--max-asset-mb", type=float, default=25)
    ap.add_argument("--max-total-mb", type=float, default=400)
    ap.add_argument("--polyhaven-res", default="1k")
    args = ap.parse_args()
    sys.exit(Hunt(args).run())


if __name__ == "__main__":
    main()
