# Safe, fixed-scope read-only image sync for Morkahja's deployed artwork.
# CACHED_JSON is embedded by the already-approved local service; it is metadata,
# never a shell argument or a file path.
import base64
import json
import os
import re
import stat
import sys

ROOT = "/var/www/morkahja"
FOLDERS = {
    "encounter": "game/encounterimages",
    "solution": "game/solutionimages",
    "expansion": "UI/03_DASHBOARD/expansions",
    "frame": "UI/02_AvatarCreation/Frames",
    "portrait": "UI/02_AvatarCreation/Avatare",
}
NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,119}\.webp$")
MAX_IMAGE = 2 * 1024 * 1024
MAX_FILES = 50000
MAX_TOTAL = 8 * 1024 * 1024 * 1024


def send(record):
    sys.stdout.write(json.dumps(record, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def main():
    cached = json.loads(CACHED_JSON)
    if not isinstance(cached, dict) or len(cached) > MAX_FILES:
        raise ValueError("CACHE_METADATA_INVALID")
    count, total = 0, 0
    for kind, folder in FOLDERS.items():
        directory = os.path.join(ROOT, folder)
        try:
            dfd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        except OSError:
            send({"type": "folder-unavailable", "kind": kind})
            continue
        try:
            for name in sorted(os.listdir(dfd)):
                if not NAME.fullmatch(name):
                    continue
                try:
                    fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=dfd)
                except OSError:
                    continue
                try:
                    info = os.fstat(fd)
                    if not stat.S_ISREG(info.st_mode) or not 0 < info.st_size <= MAX_IMAGE:
                        continue
                    if count >= MAX_FILES or total + info.st_size > MAX_TOTAL:
                        raise ValueError("CACHE_LIMIT_REACHED")
                    count += 1
                    total += info.st_size
                    entry = {
                        "size": info.st_size,
                        "mtimeNs": str(info.st_mtime_ns),
                    }
                    key = kind + "/" + name
                    if cached.get(key) == entry:
                        send({"type": "keep", "kind": kind, "name": name, "meta": entry})
                        continue
                    data = os.read(fd, MAX_IMAGE + 1)
                    if len(data) != info.st_size or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
                        send({"type": "unavailable", "kind": kind, "name": name})
                        continue
                    send({
                        "type": "file",
                        "kind": kind,
                        "name": name,
                        "meta": entry,
                        "base64": base64.b64encode(data).decode("ascii"),
                    })
                finally:
                    os.close(fd)
        finally:
            os.close(dfd)
    send({"type": "complete", "count": count, "totalBytes": total})


try:
    main()
except Exception:
    send({"type": "error", "code": "IMAGE_SYNC_FAILED"})
