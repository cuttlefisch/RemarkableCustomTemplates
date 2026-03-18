#!/usr/bin/env python3
"""Extract sorted UUIDs from an rm_methods manifest file.

Handles both JSON (new) and plain-text UUID-per-line (legacy) formats.

Usage:
    manifest-uuids.py <path>                  # print sorted UUIDs, one per line
    manifest-uuids.py --count <path>          # print template count
    manifest-uuids.py --diff <old> <new>      # print UUIDs in old but not in new
"""

import json
import sys


def read_uuids(path: str) -> list[str]:
    with open(path) as f:
        txt = f.read().strip()
    if not txt:
        return []
    try:
        m = json.loads(txt)
        return sorted(m.get("templates", {}).keys())
    except (json.JSONDecodeError, AttributeError):
        return sorted(line.strip() for line in txt.splitlines() if line.strip())


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print("Usage: manifest-uuids.py [--count|--diff] <path> [<path2>]", file=sys.stderr)
        sys.exit(1)

    if args[0] == "--count":
        uuids = read_uuids(args[1])
        print(len(uuids))
    elif args[0] == "--diff":
        # Print UUIDs present in old (args[1]) but absent from new (args[2])
        old = set(read_uuids(args[1]))
        new = set(read_uuids(args[2]))
        removed = sorted(old - new)
        if removed:
            print("\n".join(removed))
    else:
        uuids = read_uuids(args[0])
        print("\n".join(uuids))


if __name__ == "__main__":
    main()
