#!/usr/bin/env python3
"""Create a reproducible FPS2 runtime asset/weapon registry from local research artifacts.

This tool only reads the ignored reference checkout and the generated inventory. It does
not copy, convert, or expose reference assets to the production game.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

COMMIT = "f8a2997798a969deb546ef5b6014cc031b04b01d"
BASE_URL = f"https://github.com/Parking-Master/FPS2/blob/{COMMIT}"

# Each entry is intentionally conservative: a README's informal "CC 4.0" wording is
# not enough to establish the precise upstream license or that this packaged derivative
# is eligible for a new game.
WEAPON_NOTES = {
    "Assault_Rifle": ("firearm", "README names Animated AK-47 arms and AK-47 rifle sources, both only described as ‘CC 4.0’.", "indirect, ambiguous"),
    "Desert_Eagle": ("firearm", "README links a Desert Eagle source described only as ‘CC 4.0’.", "indirect, ambiguous"),
    "Sniper_Rifle": ("firearm", "README links a Sniper Rifle source described only as ‘CC 4.0’.", "indirect, ambiguous"),
    "Rail_Gun": ("science-fiction firearm", "No matching upstream asset credit was found in README credits.", "absent"),
    "P90_SMG": ("firearm", "README links a P90 SMG source described only as ‘CC 4.0’.", "indirect, ambiguous"),
    "Grenade_Launcher": ("firearm", "README links an M32 Grenade Launcher source described only as ‘CC 4.0’.", "indirect, ambiguous"),
    "Remington_Shotgun": ("firearm", "README links a Remington Shotgun source described only as ‘CC 4.0’.", "indirect, ambiguous"),
    "Rocket_Launcher": ("firearm", "README links a Rocket Launcher source described only as ‘CC 4.0’.", "indirect, ambiguous"),
    "Nuke_Launcher": ("science-fiction firearm", "No matching upstream asset credit was found in README credits.", "absent"),
    "9mm_Pistol": ("firearm", "No matching upstream asset credit was found in README credits.", "absent"),
    "Odd_Ball": ("objective/melee object", "No matching upstream asset credit was found in README credits.", "absent"),
}


def source_line(text: str, needle: str) -> int | None:
    for index, line in enumerate(text.splitlines(), 1):
        if needle in line:
            return index
    return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("reference", type=Path, help="Path to the ignored FPS2 checkout")
    parser.add_argument("inventory", type=Path, help="Generated FPS2 inventory JSON")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))
    source_path = args.reference / "src.html"
    source = source_path.read_text(encoding="utf-8")
    models = {entry["path"]: entry for entry in inventory["models"]}
    weapons = []

    # Loader block deliberately enumerates every model at boot, even ones that may not
    # be present in a player’s immediate loadout.
    for name in WEAPON_NOTES:
        model_path = f"models/weapons/{name}.glb"
        item = models[model_path]
        inspection = item["inspection"]
        category, provenance_note, provenance_visibility = WEAPON_NOTES[name]
        loader_line = source_line(source, f'"{model_path}"')
        weapon = {
            "runtime_key": name,
            "category": category,
            "reference_path": model_path,
            "bytes": item["bytes"],
            "glb_structure": {
                key: inspection.get(key)
                for key in ("nodes", "meshes", "materials", "textures", "skins", "animations", "indexed_triangles")
            },
            "animation_clip_names": inspection.get("animation_names", []),
            "runtime_usage": {
                "loaded_by_startup_loader": True,
                "loader_evidence": f"src.html:{loader_line}",
                "default_loadout": name in {"Assault_Rifle", "Desert_Eagle"},
                "slayer_pickup": name in {"Rocket_Launcher", "P90_SMG", "Grenade_Launcher", "Remington_Shotgun"},
                "oddball_pickup": name == "Odd_Ball",
                "fiesta_candidate": name != "Nuke_Launcher",
            },
            "production_reuse": {
                "status": "BLOCKED",
                "why": "Reference repository MIT applies to its code, not automatically to embedded third-party model/media rights.",
                "provenance_visibility": provenance_visibility,
                "readme_provenance_note": provenance_note,
                "required_before_any_reuse": [
                    "Verify the original asset page and exact license version/terms.",
                    "Verify that the packaged GLB is the credited asset and that its animations/textures are covered.",
                    "Record attribution, modification, and redistribution obligations.",
                    "Confirm visual fit, performance budget, and Kenney-ban compliance.",
                ],
            },
        }
        weapons.append(weapon)

    map_entries = []
    for key, display in [
        ("CARGO", "Cargo Port"), ("CITY", "Abandoned City"),
        ("GHOST", "Ghost City"), ("VERTEX", "Vertex"),
    ]:
        path = f"models/maps/{key}/scene.gltf"
        item = models[path]
        data = item["inspection"]
        map_entries.append({
            "runtime_query_key": key,
            "readme_display_name": display,
            "reference_path": path,
            "bytes": item["bytes"],
            "gltf_structure": {k: data.get(k) for k in ("nodes", "meshes", "materials", "textures", "indexed_triangles")},
            "external_uris": data.get("external_uris", []),
            "runtime_usage": "One selected scene.gltf is loaded from the URL map parameter at startup; no runtime map replacement implementation was found.",
            "production_reuse": "BLOCKED pending upstream asset provenance, exact licensing, visual review, and performance review.",
        })

    support_paths = [
        "models/muzzle_flash.glb", "models/bullet_shell.glb", "models/gun_clip.glb",
        "models/weapons/grenades/frag.glb", "models/weapon_box.glb", "models/odd_ball.glb",
        "models/vehicles/humvee.glb", "models/characters/steve/scene.gltf", "models/characters/max/scene.gltf",
    ]
    support_entries = []
    for path in support_paths:
        item = models[path]
        info = item["inspection"]
        support_entries.append({
            "reference_path": path,
            "bytes": item["bytes"],
            "structure": {k: info.get(k) for k in ("nodes", "meshes", "materials", "textures", "skins", "animations", "indexed_triangles")},
            "production_reuse": "BLOCKED: not individually cleared.",
        })

    forge_props = []
    forge_source = (args.reference / 'forge.html').read_text(encoding='utf-8')
    for path in ('forge/props/Rock.glb', 'forge/props/Tree.glb'):
        item = models[path]
        info = item['inspection']
        stem = Path(path).stem
        forge_props.append({
            'reference_path': path,
            'bytes': item['bytes'],
            'structure': {k: info.get(k) for k in ('nodes', 'meshes', 'materials', 'textures', 'skins', 'animations', 'indexed_triangles')},
            'reference_usage': {
                'context': 'Available in the separate Forge editor prop picker; the picker derives the GLB path from Rock.png or Tree.png, then loads chosenProp on user action.',
                'picker_evidence': f"forge.html:{source_line(forge_source, f'forge/props/{stem}.png')}",
                'load_evidence': f"forge.html:{source_line(forge_source, 'new THREE.GLTFLoader().load(chosenProp')}",
            },
            'production_reuse': 'BLOCKED: no exact upstream provenance/license clearance and no visual/performance approval.',
        })

    report = {
        "schema": "fps2-runtime-registry/v1",
        "generated_by": "tools/repo_research/build_fps2_registry.py",
        "reference": {
            "repository": "Parking-Master/FPS2",
            "revision": COMMIT,
            "license_file": "MIT (repository code license; does not itself clear bundled third-party assets)",
            "source_file": "src.html",
            "source_url": f"{BASE_URL}/src.html",
        },
        "method": [
            "Parsed local inventory GLB/glTF structural metadata.",
            "Matched the source startup loader's literal weapon model paths.",
            "Classified gameplay usage from explicit default-loadout and pickup branches.",
            "Did not run or redistribute reference code/assets; no production asset is approved here.",
        ],
        "weapons_loaded_by_startup": weapons,
        "separate_support_and_character_models": support_entries,
        "forge_editor_prop_models": forge_props,
        "maps_loaded_by_startup_selector": map_entries,
        "totals": {
            "weapon_glbs_loaded_by_startup": len(weapons),
            "weapon_glb_bytes": sum(item["bytes"] for item in weapons),
            "forge_editor_prop_models": len(forge_props),
            "all_model_format_entries_accounted_for": len(weapons) + len(support_entries) + len(map_entries) + len(forge_props),
            "all_entries_are_production_blocked": True,
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"{args.output}: {len(weapons)} startup weapon GLBs, {report['totals']['weapon_glb_bytes']} bytes")


if __name__ == "__main__":
    main()
