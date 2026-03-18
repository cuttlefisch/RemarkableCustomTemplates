#!/usr/bin/env python3
"""Build a methods-registry.json from pulled rm_methods UUID files.

Processes {uuid}.template + {uuid}.metadata pairs from a temp directory
into the methods/ output directory with a registry file.

Usage:
    build-methods-registry.py <temp-dir> <output-dir> [--manifest <path>] [--deployed-manifest <path>]

The --manifest and --deployed-manifest flags point to the build manifest and
deployed manifest respectively. UUIDs found in either are tagged as
"custom-methods"; others are tagged as "official-methods".
"""

import json
import os
import shutil
import sys


def read_manifest_uuids(path: str) -> set[str]:
    """Read UUIDs from a manifest file (JSON or plain text)."""
    if not path or not os.path.isfile(path):
        return set()
    try:
        with open(path) as f:
            txt = f.read().strip()
        if not txt:
            return set()
        try:
            m = json.loads(txt)
            return set(m.get("templates", {}).keys())
        except (json.JSONDecodeError, AttributeError):
            return set(line.strip() for line in txt.splitlines() if line.strip())
    except OSError:
        return set()


def infer_orientation(template_body: dict) -> str:
    """Infer orientation from a template body."""
    orient = template_body.get("orientation")
    if orient in ("portrait", "landscape"):
        return orient
    return "portrait"


def main() -> None:
    args = sys.argv[1:]
    if len(args) < 2:
        print(
            "Usage: build-methods-registry.py <temp-dir> <output-dir> "
            "[--manifest <path>] [--deployed-manifest <path>]",
            file=sys.stderr,
        )
        sys.exit(1)

    temp_dir = args[0]
    output_dir = args[1]

    # Parse optional flags
    manifest_path = ""
    deployed_manifest_path = ""
    i = 2
    while i < len(args):
        if args[i] == "--manifest" and i + 1 < len(args):
            manifest_path = args[i + 1]
            i += 2
        elif args[i] == "--deployed-manifest" and i + 1 < len(args):
            deployed_manifest_path = args[i + 1]
            i += 2
        else:
            i += 1

    # Collect known custom UUIDs from manifests
    custom_uuids = read_manifest_uuids(manifest_path) | read_manifest_uuids(
        deployed_manifest_path
    )

    # Find all UUID pairs
    metadata_files = [f for f in os.listdir(temp_dir) if f.endswith(".metadata")]

    os.makedirs(output_dir, exist_ok=True)
    entries = []
    count = 0

    for meta_file in sorted(metadata_files):
        uuid = meta_file.replace(".metadata", "")
        template_file = f"{uuid}.template"
        meta_path = os.path.join(temp_dir, meta_file)
        tpl_path = os.path.join(temp_dir, template_file)

        # Read and validate metadata
        try:
            with open(meta_path) as f:
                metadata = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            print(f"  Skipping {uuid}: bad metadata ({e})", file=sys.stderr)
            continue

        if metadata.get("type") != "TemplateType":
            continue

        visible_name = metadata.get("visibleName", uuid)

        # Read template body for orientation and labels
        orientation = "portrait"
        labels = []
        if os.path.isfile(tpl_path):
            try:
                with open(tpl_path) as f:
                    tpl_body = json.load(f)
                orientation = infer_orientation(tpl_body)
                raw_labels = tpl_body.get("labels", [])
                if isinstance(raw_labels, list):
                    labels = [l for l in raw_labels if isinstance(l, str) and l]
            except (json.JSONDecodeError, OSError):
                pass

        # Determine origin
        origin = "custom-methods" if uuid in custom_uuids else "official-methods"

        # Copy template file to output
        if os.path.isfile(tpl_path):
            shutil.copy2(tpl_path, os.path.join(output_dir, template_file))
        else:
            print(f"  Warning: {uuid} has metadata but no .template file", file=sys.stderr)
            continue

        # Build registry entry
        entry = {
            "name": visible_name,
            "filename": f"methods/{uuid}",
            "iconCode": "\ue9d8",
            "landscape": orientation == "landscape",
            "categories": labels if labels else ["Uncategorized"],
            "rmMethodsId": uuid,
            "origin": origin,
        }
        entries.append(entry)
        count += 1

    # Write registry
    registry = {"templates": entries}
    registry_path = os.path.join(output_dir, "methods-registry.json")
    with open(registry_path, "w") as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Built methods registry: {count} templates in {output_dir}/")


if __name__ == "__main__":
    main()
