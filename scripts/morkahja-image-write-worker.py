#!/usr/bin/env python3
"""One-shot Morkahja image writer, sent through the pinned administrator SSH login.

It writes a single WebP into one of five fixed image folders of the live game
frontend. The request names a folder kind and a base file name, never a path.
"""
import base64
import hashlib
import json
import os
import re

# Nginx serves /Morkahja/game/ and /Morkahja/UI/ from UPLOADS first, then from
# the current release (RELEASE, a root-owned folder replaced on every release).
# Uploads land in UPLOADS, which the administrator login owns; the same file is
# committed to the game repository so later releases carry it themselves.
# Keep both in step with morkahja-image-cache-sync.py and morkahjaImages.mjs.
UPLOADS = "/var/www/morkahja-subpath/uploads/Morkahja"
RELEASE = "/var/www/morkahja-subpath/web/Morkahja"
FOLDERS = {
    "encounter": "game/encounterimages",
    "solution": "game/solutionimages",
    "expansion": "UI/03_DASHBOARD/expansions",
    "frame": "UI/02_AvatarCreation/Frames",
    "portrait": "UI/02_AvatarCreation/Avatare",
}
BASE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,109}$")
MAX_IMAGE = 2 * 1024 * 1024


class ImageError(Exception):
    pass


def exists(name, dir_fd):
    try:
        os.stat(name, dir_fd=dir_fd, follow_symlinks=False)
        return True
    except FileNotFoundError:
        return False


def in_release(name, release_dir):
    try:
        os.stat(os.path.join(release_dir, name), follow_symlinks=False)
        return True
    except OSError:
        return False


def pick_name(base, mode, dir_fd, release_dir):
    name = base + ".webp"
    taken = lambda n: exists(n, dir_fd) or in_release(n, release_dir)  # noqa: E731
    if mode == "exact" or not taken(name):
        return name
    for prefix in range(2, 10000):
        candidate = "%d_%s.webp" % (prefix, base)
        if not taken(candidate):
            return candidate
    raise ImageError("IMAGE_NAME_EXHAUSTED")


def write(request, root=UPLOADS, release=RELEASE):
    kind, mode, base = request.get("kind"), request.get("mode"), request.get("base")
    if kind not in FOLDERS or mode not in ("exact", "unique") or not isinstance(base, str) \
            or not BASE.fullmatch(base):
        raise ImageError("IMAGE_INVALID_REQUEST")
    data = base64.b64decode(request.get("data", ""), validate=True)
    if not (12 <= len(data) <= MAX_IMAGE) or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise ImageError("IMAGE_NOT_WEBP")
    try:
        dir_fd = os.open(os.path.join(root, FOLDERS[kind]),
                         os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    except OSError:
        raise ImageError("IMAGE_FOLDER_UNAVAILABLE")
    temp = None
    try:
        release_dir = os.path.join(release, FOLDERS[kind])
        name = pick_name(base, mode, dir_fd, release_dir)
        try:
            info = os.stat(name, dir_fd=dir_fd, follow_symlinks=False)
            if not (info.st_mode & 0o170000 == 0o100000):
                raise ImageError("IMAGE_TARGET_UNSAFE")
            replaced = True
        except FileNotFoundError:
            replaced = in_release(name, release_dir)
        temp = ".babuni-image-%d.tmp" % os.getpid()
        try:
            fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644, dir_fd=dir_fd)
        except PermissionError:
            temp = None
            raise ImageError("IMAGE_PERMISSION_DENIED")
        try:
            os.fchmod(fd, 0o644)
            os.write(fd, data)
            os.fsync(fd)
        finally:
            os.close(fd)
        os.rename(temp, name, src_dir_fd=dir_fd, dst_dir_fd=dir_fd)
        temp = None
        os.fsync(dir_fd)
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=dir_fd)
        try:
            actual = os.read(fd, MAX_IMAGE + 1)
        finally:
            os.close(fd)
        if actual != data:
            raise ImageError("IMAGE_WRITE_VERIFY_FAILED")
        return {"ok": True, "name": name, "replaced": replaced,
                "sha256": hashlib.sha256(actual).hexdigest()}
    finally:
        if temp:
            try:
                os.unlink(temp, dir_fd=dir_fd)
            except OSError:
                pass
        os.close(dir_fd)


def main():
    try:
        request = json.loads(base64.b64decode(REQUEST_BASE64, validate=True).decode("utf-8"))  # noqa: F821
        result = write(request)
    except ImageError as error:
        result = {"ok": False, "code": str(error)}
    except PermissionError:
        result = {"ok": False, "code": "IMAGE_PERMISSION_DENIED"}
    except Exception:
        result = {"ok": False, "code": "IMAGE_WRITE_FAILED"}
    print(json.dumps(result, separators=(",", ":")))


if __name__ == "__main__":
    main()
