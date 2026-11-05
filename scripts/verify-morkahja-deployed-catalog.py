#!/usr/bin/env python3
"""Read-only operator check of the expansion catalog deployed on Morkahja.

The expected ID allowlist mirrors the candidate Batch A aggregate SQL. This
script does not change files, run SQL, open a network connection or report
expansion content beyond catalog IDs and active state.
"""
import json
import os
from pathlib import Path
import re
import stat
import sys

EXPECTED_IDS = frozenset(("1001", "1002", "1003", "1004"))
MAX_BYTES = 8 * 1024 * 1024


class CatalogError(Exception):
    pass


def unique_pairs(pairs):
    data = {}
    for key, value in pairs:
        if key in data:
            raise CatalogError("CATALOG_DUPLICATE_KEY")
        data[key] = value
    return data


def fail_constant(_value):
    raise CatalogError("CATALOG_INVALID_JSON")


def audit(path):
    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
    try:
        fd = os.open(path, flags)
        with os.fdopen(fd, "rb") as handle:
            info = os.fstat(handle.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_BYTES:
                raise CatalogError("CATALOG_UNSAFE_FILE")
            raw = handle.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES:
                raise CatalogError("CATALOG_UNSAFE_FILE")
    except OSError:
        raise CatalogError("CATALOG_UNREADABLE") from None
    try:
        data = json.loads(raw.decode("utf-8"), object_pairs_hook=unique_pairs,
                          parse_constant=fail_constant)
    except (UnicodeError, ValueError):
        raise CatalogError("CATALOG_INVALID_JSON") from None
    if not isinstance(data, dict) or not isinstance(data.get("expansions"), dict):
        raise CatalogError("CATALOG_INVALID_STRUCTURE")
    expansions = data["expansions"]
    inactive = []
    for key, entry in expansions.items():
        if not isinstance(key, str) or not re.fullmatch(r"[1-9][0-9]{0,8}", key):
            raise CatalogError("CATALOG_INVALID_ID")
        if not isinstance(entry, dict):
            raise CatalogError("CATALOG_INVALID_STRUCTURE")
        item_id = entry.get("mExtensioID")
        if type(item_id) is not int or str(item_id) != key:
            raise CatalogError("CATALOG_ID_DISAGREEMENT")
        enabled = entry.get("mExtensioActive")
        if type(enabled) is not bool:
            raise CatalogError("CATALOG_INVALID_ACTIVE_STATE")
        if not enabled:
            inactive.append(key)
    found = set(expansions)
    print("CATALOG_IDS", ",".join(sorted(found, key=int)) or "none")
    print("CATALOG_INACTIVE_IDS", ",".join(sorted(inactive, key=int)) or "none")
    if found != EXPECTED_IDS:
        print("CATALOG_MISSING_IDS", ",".join(sorted(EXPECTED_IDS - found, key=int)) or "none")
        print("CATALOG_EXTRA_IDS", ",".join(sorted(found - EXPECTED_IDS, key=int)) or "none")
        raise CatalogError("CATALOG_MISMATCH")
    print("CATALOG_MATCH")


def main():
    if len(sys.argv) != 2 or sys.argv[1].startswith("-"):
        print("USAGE: python3 verify-morkahja-deployed-catalog.py /absolute/path/to/expansiondata.json")
        return 2
    path = Path(sys.argv[1])
    if not path.is_absolute():
        print("CATALOG_PATH_NOT_ABSOLUTE")
        return 2
    try:
        audit(path)
        return 0
    except CatalogError as exc:
        print(str(exc))
        return 1


if __name__ == "__main__":
    sys.exit(main())
