#!/usr/bin/env python3
"""Prepare a separate, operator-owned read-only Morkahja Moderation config.

Copies only approved transport/database metadata from the working Overview
configuration. Never reads, stores, or prints a database password.
"""
import argparse
import json
import os
import stat
import sys
from pathlib import Path

REQUIRED = (
    "enabled", "host", "sshUser", "sshPort", "sshIdentityFile",
    "dbUser", "dbName", "dbPort", "approvedHostKeyFingerprint",
)


def safe_read(path):
    if not path.is_absolute():
        raise ValueError("CONFIG_PATH_UNSAFE")
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        st = os.fstat(fd)
        if (not stat.S_ISREG(st.st_mode) or st.st_size > 4096 or
                st.st_uid != os.getuid() or st.st_mode & 0o077):
            raise ValueError("SOURCE_CONFIG_UNSAFE")
        with os.fdopen(fd, "r", encoding="utf-8", closefd=False) as stream:
            value = json.load(stream)
    finally:
        os.close(fd)
    if not isinstance(value, dict) or any(key not in value for key in REQUIRED):
        raise ValueError("SOURCE_CONFIG_INVALID")
    return value


def prepare(source, destination, create=False):
    data = safe_read(source)
    if data["enabled"] is not True or data["dbUser"] == "babuni_admin_moderation":
        raise ValueError("SOURCE_CONFIG_INVALID")
    output = {key: data[key] for key in REQUIRED}
    output["dbUser"] = "babuni_admin_moderation"
    # No reader field approvals are transferred to the new role.
    if create:
        if not destination.is_absolute() or destination.parent.is_symlink():
            raise ValueError("TARGET_CONFIG_UNSAFE")
        directory = destination.parent.stat()
        if (not stat.S_ISDIR(directory.st_mode) or
                directory.st_uid != os.getuid() or directory.st_mode & 0o077):
            raise ValueError("TARGET_DIRECTORY_UNSAFE")
        fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                     os.O_NOFOLLOW | os.O_CLOEXEC, 0o600)
        try:
            with os.fdopen(fd, "w", encoding="utf-8", closefd=False) as stream:
                json.dump(output, stream, indent=2)
                stream.write("\n")
                stream.flush()
                os.fsync(fd)
        finally:
            os.close(fd)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--create", action="store_true",
                        help="Create a new private config, refuse any overwrite.")
    parser.add_argument("--source", type=Path, default=Path.home() /
                        ".config/babuni-admin/morkahja-probe.json")
    parser.add_argument("--destination", type=Path, default=Path.home() /
                        ".config/babuni-admin/morkahja-moderation.json")
    args = parser.parse_args()
    try:
        config = prepare(args.source, args.destination, args.create)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        code = str(exc) if isinstance(exc, ValueError) else "CONFIG_UNAVAILABLE"
        print(code, file=sys.stderr)
        return 1
    print("MODERATION_CONFIG_CREATED" if args.create else
          "MODERATION_CONFIG_SOURCE_VALID")
    print("DB_NAME=" + config["dbName"])
    print("DB_USER=" + config["dbUser"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
