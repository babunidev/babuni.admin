#!/usr/bin/env python3
"""Read-only check of the live Morkahja server, run by the operator over SSH.

    ssh -i ~/.ssh/id_ed25519_babuni_server babuni@89.167.120.88 'python3 -' \
        < scripts/morkahja-live-check.py

It changes nothing. It prints which backend and frontend are deployed, whether
the game answers the admin content routes Babuni Admin saves through, where
Nginx serves the game images from, and who may write each folder involved.
The ADMIN_API_KEY value is never printed, only whether it is set.
"""
import glob
import json
import os
import pwd
import re
import subprocess
import urllib.error
import urllib.request

APP = "/home/morkahja/arcanitebrothers"
OLD_STATIC = "/var/www/morkahja"
IMAGE_FOLDERS = [
    "game/encounterimages", "game/solutionimages", "UI/03_DASHBOARD/expansions",
    "UI/02_AvatarCreation/Frames", "UI/02_AvatarCreation/Avatare",
]


def section(title):
    print("\n== " + title)


def run(args, cwd=None):
    try:
        out = subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=15)
        return (out.stdout or out.stderr).strip()
    except Exception as error:  # noqa: BLE001 - report, never fail the check
        return "unavailable (%s)" % type(error).__name__


def owner(path):
    try:
        info = os.stat(path)
        return "%s:%s %o" % (pwd.getpwuid(info.st_uid).pw_name, info.st_gid, info.st_mode & 0o7777)
    except OSError as error:
        return "unavailable (%s)" % error.strerror


def describe_folder(path):
    count = len(glob.glob(os.path.join(path, "*.webp")))
    print("  %-62s files=%-5d owner=%s writable=%s" % (
        path, count, owner(path), os.access(path, os.W_OK)))


section("Login")
print(run(["id"]))

section("Backend checkout " + APP)
print("branch:", run(["git", "rev-parse", "--abbrev-ref", "HEAD"], APP))
print("commit:", run(["git", "log", "-1", "--format=%h %cd %s", "--date=iso"], APP))
print("uncommitted:", run(["git", "status", "--porcelain", "--", "server/game"], APP) or "none")
for name in ("encountersdata.json", "solutiondata.json", "expansiondata.json", "frames.json", "portraits.json"):
    path = os.path.join(APP, "server/game", name)
    print("  %-22s owner=%s writable-by-me=%s" % (name, owner(path), os.access(path, os.W_OK)))

section("Admin content routes in the deployed backend source")
routes = os.path.join(APP, "server/src/routes/adminRoutes.ts")
try:
    text = open(routes, encoding="utf-8").read()
    for kind in ("encounters", "solutions", "expansions", "frames", "portraits", "images"):
        print("  POST /content/%-11s %s" % (kind, "present" if "post('/content/" + kind in text else "missing"))
except OSError as error:
    print("  cannot read adminRoutes.ts:", error.strerror)

section("ADMIN_API_KEY in " + APP + "/.env")
token = None
try:
    for line in open(os.path.join(APP, ".env"), encoding="utf-8"):
        if line.startswith("ADMIN_API_KEY="):
            token = line.split("=", 1)[1].strip().strip("\"'")
    print("  set" if token else "  missing or empty", "(length %d)" % len(token or ""))
except OSError as error:
    print("  cannot read .env:", error.strerror)

section("Running game on 127.0.0.1:3000 (GET only)")
for path, auth in (("/health", False), ("/game-data/admin/content/encounters", False),
                   ("/game-data/admin/content/encounters", True)):
    headers = {"Authorization": "Bearer " + token} if auth and token else {}
    try:
        with urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:3000" + path, headers=headers), timeout=8) as r:
            body = r.read()
            extra = ""
            if auth:
                try:
                    extra = " encounters=%d" % len(json.loads(body))
                except Exception:  # noqa: BLE001
                    extra = " (not JSON)"
            print("  %-45s %s %d%s" % (path, "with key" if auth else "no key  ", r.status, extra))
    except urllib.error.HTTPError as error:
        print("  %-45s %s %d" % (path, "with key" if auth else "no key  ", error.code))
    except OSError as error:
        print("  %-45s unreachable (%s)" % (path, error))

section("Where Nginx serves /Morkahja/ from")
config = run(["sh", "-c", "grep -rhn -A3 'location \\^~ /Morkahja/ ' /etc/nginx 2>/dev/null"])
print(config or "  no readable Nginx config")
roots = set(re.findall(r"^\s*\d*[-:]?\s*root\s+([^;]+);", config, re.M))
for root in sorted(roots):
    live = os.path.join(root.strip(), "Morkahja")
    print("  %s -> %s" % (live, os.path.realpath(live)))
    for folder in IMAGE_FOLDERS:
        describe_folder(os.path.join(os.path.realpath(live), folder))

section("Older static copy " + OLD_STATIC + " (what the admin image reader uses today)")
print("  realpath:", os.path.realpath(OLD_STATIC))
for folder in IMAGE_FOLDERS:
    describe_folder(os.path.join(OLD_STATIC, folder))

section("Deploy tool")
print(run(["sudo", "-n", "morkahja-deploy", "status"]))
