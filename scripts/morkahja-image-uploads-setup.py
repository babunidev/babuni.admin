#!/usr/bin/env python3
"""One-time server setup for Babuni Admin image uploads. Run by Babuni with sudo.

    B64=$(base64 -w0 scripts/morkahja-image-uploads-setup.py)
    ssh -t -i ~/.ssh/id_ed25519_babuni_server babuni@89.167.120.88 \
      "echo $B64 | base64 -d > /tmp/morkahja-image-uploads-setup.py && sudo python3 /tmp/morkahja-image-uploads-setup.py"

1. Creates /var/www/morkahja-subpath/uploads/Morkahja/<five image folders>,
   owned by the login that ran sudo, readable by Nginx.
2. Changes only the `/Morkahja/(UI|game)/` location so Nginx serves an
   uploaded file first and the current release otherwise.
3. Backs up the Nginx file, runs `nginx -t`, reloads only if it passes and
   restores the backup if it fails. Running it twice changes nothing.
"""
import glob
import os
import pwd
import re
import shutil
import subprocess
import sys
import time
import urllib.request

BASE = "/var/www/morkahja-subpath"
UPLOADS = BASE + "/uploads/Morkahja"
FOLDERS = ["game/encounterimages", "game/solutionimages", "UI/03_DASHBOARD/expansions",
           "UI/02_AvatarCreation/Frames", "UI/02_AvatarCreation/Avatare"]
OLD = re.compile(r"(location ~ \^/Morkahja/\(UI\|game\)/ \{\s*)try_files \$uri =404;(\s*\})")
NEW = (r"\1# Babuni Admin uploads first, then the current release.\n"
       r"        root " + BASE + ";\n"
       r"        try_files /uploads$uri /web$uri =404;\2")


def stop(message):
    print("STOPPED:", message)
    sys.exit(1)


if os.geteuid() != 0:
    stop("run with sudo")
owner = os.environ.get("SUDO_USER")
if not owner or owner == "root":
    stop("run with sudo from the administrator login, not as root directly")
account = pwd.getpwnam(owner)

files = sorted({os.path.realpath(p) for p in glob.glob("/etc/nginx/**/*", recursive=True)
                if os.path.isfile(p) and "location ^~ /Morkahja/" in open(p, errors="ignore").read()})
if len(files) != 1:
    stop("expected one Nginx file with the /Morkahja/ location, found %r" % files)
site = files[0]
text = open(site).read()

print("== Upload folders under", UPLOADS)
for path in [BASE + "/uploads", UPLOADS] + [os.path.join(UPLOADS, f) for f in FOLDERS]:
    os.makedirs(path, exist_ok=True)
    os.chown(path, account.pw_uid, account.pw_gid)
    os.chmod(path, 0o755)
    print("  ok", path)

print("== Nginx", site)
if "try_files /uploads$uri /web$uri =404;" in text:
    print("  already serves uploads first; nothing to change")
else:
    patched, count = OLD.subn(NEW, text)
    if count != 1:
        print(re.search(r"location ~ \^/Morkahja/\(UI\|game\)/[^}]*\}", text) or "  (block not found)")
        stop("the /Morkahja/(UI|game)/ block is not the expected `try_files $uri =404;`; nothing was changed")
    backup = "%s.bak-%s" % (site, time.strftime("%Y%m%d-%H%M%S"))
    shutil.copy2(site, backup)
    with open(site, "w") as handle:
        handle.write(patched)
    test = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
    if test.returncode != 0:
        shutil.copy2(backup, site)
        print(test.stderr)
        stop("nginx -t failed; the original file was restored from " + backup)
    subprocess.run(["systemctl", "reload", "nginx"], check=True)
    print("  backup", backup)
    print("  nginx -t passed and Nginx was reloaded")

print("== Public check")
sample = sorted(n for n in os.listdir(BASE + "/web/Morkahja/game/encounterimages") if n.endswith(".webp"))[0]
url = "https://www.babuni.dev/Morkahja/game/encounterimages/" + sample
try:
    with urllib.request.urlopen(url, timeout=10) as response:
        print("  %s -> %d (an existing release image still loads)" % (url, response.status))
except Exception as error:  # noqa: BLE001
    print("  %s -> %s  CHECK THIS: release images may not load" % (url, error))
