#!/usr/bin/env python3
"""One-shot allowlisted Morkahja content worker, transmitted through pinned SSH.

No listener, persistent state, arbitrary path, shell command or database access.
Its production root is fixed to the operator-verified deployed game catalog.
"""
import base64
import fcntl
import hashlib
import json
import os
import re
import stat
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

# The running API loads this directory (PM2 cwd is the server package).
# /var/www/morkahja/game is an older static copy and is not what players receive.
GAME_ROOT = Path("/home/morkahja/arcanitebrothers/server/game")
ENV_FILE = Path("/home/morkahja/arcanitebrothers/.env")
LIVE_API = "http://127.0.0.1:3000"
FILES = {
    "encounters": "encountersdata.json",
    "solutions": "solutiondata.json",
    "expansions": "expansiondata.json",
    "frames": "frames.json",
    "portraits": "portraits.json",
}
MAX_FILE = 8 * 1024 * 1024
MAX_RECORD = 64 * 1024
KEY = re.compile(r"^[A-Za-z0-9_-]{1,100}$")
SHA = re.compile(r"^[0-9a-f]{64}$")
# Encounter and solution ids in the live catalog are above 10000 (encounters reach 20193).
MAX_ID = 99999


class ContentError(Exception):
    pass


def fail(code):
    raise ContentError(code)


def no_duplicates(pairs):
    obj = {}
    for key, value in pairs:
        if key in obj:
            fail("CONTENT_INVALID_JSON")
        obj[key] = value
    return obj


def read_file(root, kind):
    target = root / FILES[kind]
    if root.is_symlink() or not root.is_dir():
        fail("CONTENT_ROOT_UNAVAILABLE")
    try:
        fd = os.open(target, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    except FileNotFoundError:
        fail("CONTENT_NOT_FOUND")
    except OSError:
        fail("CONTENT_SOURCE_UNAVAILABLE")
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_FILE:
            fail("CONTENT_SOURCE_UNAVAILABLE")
        with os.fdopen(fd, "rb", closefd=False) as handle:
            raw = handle.read(MAX_FILE + 1)
        if len(raw) > MAX_FILE:
            fail("CONTENT_TOO_LARGE")
    finally:
        os.close(fd)
    try:
        data = json.loads(raw.decode("utf-8"), object_pairs_hook=no_duplicates,
                          parse_constant=lambda _: fail("CONTENT_INVALID_JSON"))
    except (UnicodeError, json.JSONDecodeError):
        fail("CONTENT_INVALID_JSON")
    if not isinstance(data, dict):
        fail("CONTENT_INVALID_SCHEMA")
    parent = "expansions" if kind == "expansions" else (
        "Frames" if kind == "frames" else "Avatar" if kind == "portraits" else None
    )
    if parent and not isinstance(data.get(parent), list if kind in ("frames", "portraits") else dict):
        fail("CONTENT_INVALID_SCHEMA")
    return target, info, raw, data


def validate_record(kind, record):
    if not isinstance(record, dict) or len(json.dumps(record)) > MAX_RECORD:
        fail("CONTENT_INVALID_RECORD")
    numeric = {
        "encounters": "mEncounterID", "solutions": "mSolutionID",
        "expansions": "mExtensioID", "frames": "frameID", "portraits": "avatarID",
    }
    id_value = record.get(numeric[kind])
    if not isinstance(id_value, int) or isinstance(id_value, bool) or not 0 <= id_value <= MAX_ID:
        fail("CONTENT_INVALID_RECORD")
    name_field = {
        "encounters": "mEncounterTitle", "solutions": "mSolutionName",
        "expansions": "mExtensioName", "portraits": "avatarName",
    }.get(kind)
    if name_field:
        name = record.get(name_field)
        if not isinstance(name, str) or not (1 <= len(name) <= 240):
            fail("CONTENT_INVALID_RECORD")
    if kind == "expansions" and not isinstance(record.get("mExtensioActive"), bool):
        fail("CONTENT_INVALID_RECORD")
    return id_value


def lock_root(root):
    # Lock is fixed by the worker, not browser input. Refuse linked or
    # non-regular lock files, then serialize the revision check and replacement.
    path = root / ".babuni-content-write.lock"
    flags = os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW | os.O_CLOEXEC
    fd = os.open(path, flags, 0o600)
    info = os.fstat(fd)
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid():
        os.close(fd)
        fail("CONTENT_LOCK_UNSAFE")
    fcntl.flock(fd, fcntl.LOCK_EX)
    return fd


def replace_with_backup(root, target, source_info, old_raw, new_raw):
    if source_info.st_uid != os.getuid():
        fail("CONTENT_PERMISSION_DENIED")
    if len(new_raw) > MAX_FILE:
        fail("CONTENT_TOO_LARGE")
    backup = root / (target.name + ".bak." + str(time.time_ns()))
    backup_fd = None
    temp_path = None
    replaced = False
    try:
        backup_fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                             os.O_NOFOLLOW | os.O_CLOEXEC, 0o600)
        with os.fdopen(backup_fd, "wb", closefd=False) as handle:
            handle.write(old_raw)
            handle.flush()
            os.fsync(backup_fd)
        os.close(backup_fd)
        backup_fd = None
        fd, temp_path = tempfile.mkstemp(prefix=".babuni-content-", dir=root)
        try:
            os.fchmod(fd, stat.S_IMODE(source_info.st_mode))
            if os.fstat(fd).st_gid != source_info.st_gid:
                os.fchown(fd, -1, source_info.st_gid)
            with os.fdopen(fd, "wb", closefd=False) as handle:
                handle.write(new_raw)
                handle.flush()
                os.fsync(fd)
        finally:
            os.close(fd)
        os.replace(temp_path, target)
        temp_path = None
        replaced = True
        dir_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(dir_fd)
        finally:
            os.close(dir_fd)
        _, _, actual, _ = read_file(root, next(k for k, v in FILES.items() if v == target.name))
        if actual != new_raw:
            fail("CONTENT_WRITE_VERIFY_FAILED")
    except Exception:
        if replaced:
            try:
                os.replace(backup, target)
            except OSError:
                pass
        raise
    finally:
        if backup_fd is not None:
            os.close(backup_fd)
        if temp_path:
            try:
                os.unlink(temp_path)
            except OSError:
                pass


def admin_api_key(env_file=ENV_FILE):
    try:
        lines = env_file.read_text(encoding="utf-8").splitlines()
    except OSError:
        fail("CONTENT_SOURCE_UNAVAILABLE")
    for line in lines:
        if not line.startswith("ADMIN_API_KEY="):
            continue
        value = line.split("=", 1)[1].strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        if value:
            return value
    fail("CONTENT_SOURCE_UNAVAILABLE")


def publish_through_game(kind, key, record, env_file=ENV_FILE, opener=None):
    """Ask the game process to write. It owns the catalog and drops its cache."""
    token = admin_api_key(env_file)
    if kind in ("frames", "portraits"):
        payload = record
    else:
        payload = {"key": key, "data": record}
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        LIVE_API + "/game-data/admin/content/" + kind,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token,
        },
    )
    open_url = opener or urllib.request.urlopen
    try:
        with open_url(request, timeout=8) as response:
            status = getattr(response, "status", None) or response.getcode()
            response.read(4096)
    except urllib.error.HTTPError as error:
        if error.code in (401, 403, 503):
            fail("CONTENT_PERMISSION_DENIED")
        fail("CONTENT_OPERATION_FAILED")
    except OSError:
        fail("CONTENT_OPERATION_FAILED")
    if status not in (200, 201):
        fail("CONTENT_OPERATION_FAILED")


def stored_record(kind, key, data):
    if kind in ("encounters", "solutions"):
        return data.get(key)
    if kind == "expansions":
        return data["expansions"].get(key)
    field = "Frames" if kind == "frames" else "Avatar"
    number = key if isinstance(key, int) else None
    entries = data[field]
    if number is None or number >= len(entries):
        return None
    return entries[number]


def reject_id_change(kind, key, number, data):
    if kind in ("encounters", "solutions"):
        id_field = "mEncounterID" if kind == "encounters" else "mSolutionID"
        if key in data and data[key].get(id_field) != number:
            fail("CONTENT_INVALID_RECORD")
    elif kind == "expansions":
        current = data["expansions"].get(key)
        if current is not None and current.get("mExtensioID") != number:
            fail("CONTENT_INVALID_RECORD")
    elif number > 10000:
        fail("CONTENT_INVALID_RECORD")


def assign_record(kind, key, number, record, data):
    if kind in ("encounters", "solutions"):
        data[key] = record
        return
    if kind == "expansions":
        data["expansions"][key] = record
        return
    field = "Frames" if kind == "frames" else "Avatar"
    entries = data[field]
    while len(entries) <= number:
        entries.append(None)
    entries[number] = record


def can_write_catalog(root, target):
    try:
        info = os.stat(target)
    except OSError:
        return False
    return os.access(root, os.W_OK) and info.st_uid == os.geteuid()


def process(request, root=GAME_ROOT):
    if not isinstance(request, dict) or set(request) - {
        "action", "kind", "key", "data", "expectedRevision"
    }:
        fail("CONTENT_INVALID_REQUEST")
    action = request.get("action")
    kind = request.get("kind")
    if action not in ("read", "write") or kind not in FILES:
        fail("CONTENT_INVALID_REQUEST")
    if action == "read" and set(request) != {"action", "kind"}:
        fail("CONTENT_INVALID_REQUEST")
    if action == "write" and set(request) != {
        "action", "kind", "key", "data", "expectedRevision"
    }:
        fail("CONTENT_INVALID_REQUEST")
    if action == "read":
        _, _, raw, data = read_file(root, kind)
        return {"ok": True, "data": data,
                "revision": hashlib.sha256(raw).hexdigest()}
    expected = request.get("expectedRevision")
    if not isinstance(expected, str) or not SHA.fullmatch(expected):
        fail("CONTENT_REVISION_REQUIRED")
    key = request.get("key")
    record = request.get("data")
    number = validate_record(kind, record)
    if kind in ("frames", "portraits"):
        if type(key) is not int or key != number:
            fail("CONTENT_INVALID_REQUEST")
    elif not isinstance(key, str) or not KEY.fullmatch(key):
        fail("CONTENT_INVALID_REQUEST")
    target, info, raw, data = read_file(root, kind)
    if hashlib.sha256(raw).hexdigest() != expected:
        fail("CONTENT_CONFLICT")
    reject_id_change(kind, key, number, data)
    if not can_write_catalog(root, target):
        # The SSH login can read the live catalog but the game user owns it.
        # The game process writes the file and drops its in-memory copy.
        publish_through_game(kind, key, record)
        _, _, written, updated = read_file(root, kind)
        if stored_record(kind, key, updated) != record:
            fail("CONTENT_WRITE_VERIFY_FAILED")
        return {"ok": True, "revision": hashlib.sha256(written).hexdigest()}
    lock = lock_root(root)
    try:
        target, info, raw, data = read_file(root, kind)
        if hashlib.sha256(raw).hexdigest() != expected:
            fail("CONTENT_CONFLICT")
        reject_id_change(kind, key, number, data)
        assign_record(kind, key, number, record, data)
        output = (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        replace_with_backup(root, target, info, raw, output)
        return {"ok": True, "revision": hashlib.sha256(output).hexdigest()}
    finally:
        fcntl.flock(lock, fcntl.LOCK_UN)
        os.close(lock)


def main():
    try:
        raw = base64.b64decode(REQUEST_BASE64, validate=True)
        if len(raw) > MAX_FILE:
            fail("CONTENT_TOO_LARGE")
        request = json.loads(raw.decode("utf-8"), object_pairs_hook=no_duplicates)
        result = process(request)
    except ContentError as exc:
        result = {"ok": False, "code": str(exc)}
    except PermissionError:
        result = {"ok": False, "code": "CONTENT_PERMISSION_DENIED"}
    except Exception:
        result = {"ok": False, "code": "CONTENT_OPERATION_FAILED"}
    print(json.dumps(result, separators=(",", ":"), ensure_ascii=False))


if __name__ == "__main__":
    main()
