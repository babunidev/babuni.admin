#!/usr/bin/env python3
"""Opt-in desktop-login loader for Babuni Admin's approved SSH identity.

Never starts an agent, stores a passphrase, contacts a server or writes a key.
Only the operator can enable the XDG autostart entry using 'install'.
"""
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time

MARKER = "X-BabuniAdmin-Managed=true"
NAME = "babuni-admin-ssh-agent.desktop"
ALLOWED = {"run", "status", "install", "uninstall"}


def home():
    return Path.home()


def config_file():
    return Path(os.environ.get("XDG_CONFIG_HOME", str(home() / ".config"))) / "babuni-admin" / "morkahja-probe.json"


def safe_regular(path, private=False):
    try:
        info = path.lstat()
        return (stat.S_ISREG(info.st_mode) and info.st_uid == os.getuid()
                and (not private or not info.st_mode & 0o077))
    except OSError:
        return False


def identity():
    config = config_file()
    if not safe_regular(config, private=True):
        return None, "SSH_LOGIN_PRIVATE_CONFIG_UNAVAILABLE"
    try:
        data = json.loads(config.read_text(encoding="utf-8"))
        value = data.get("sshIdentityFile")
        if data.get("enabled") is not True or not isinstance(value, str):
            return None, "SSH_LOGIN_CONFIG_DISABLED"
        key = Path(value)
        if (not key.is_absolute() or not safe_regular(key, private=True)
                or not safe_regular(Path(str(key) + ".pub"))):
            return None, "SSH_LOGIN_IDENTITY_UNAVAILABLE"
        return key, None
    except (OSError, ValueError, TypeError):
        return None, "SSH_LOGIN_PRIVATE_CONFIG_UNAVAILABLE"


def run_quiet(args, **kwargs):
    try:
        return subprocess.run(args, stdin=subprocess.DEVNULL,
                              stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                              timeout=kwargs.pop("timeout", 8), check=False,
                              **kwargs)
    except (OSError, subprocess.TimeoutExpired):
        return None


def public_fingerprint(key):
    result = run_quiet(["ssh-keygen", "-lf", str(key) + ".pub", "-E", "sha256"])
    if result is None or result.returncode != 0:
        return None
    match = re.search(r"\bSHA256:[A-Za-z0-9+/]+\b", result.stdout.decode("ascii", "replace"))
    return match.group(0) if match else None


def agent_state(fingerprint):
    if not os.environ.get("SSH_AUTH_SOCK"):
        return "SSH_LOGIN_AGENT_UNAVAILABLE"
    result = run_quiet(["ssh-add", "-l", "-E", "sha256"])
    if result is None or result.returncode not in (0, 1):
        return "SSH_LOGIN_AGENT_UNAVAILABLE"
    lines = result.stdout.decode("utf-8", "replace").splitlines()
    if any(fingerprint in line.split() for line in lines):
        return "SSH_LOGIN_IDENTITY_READY"
    return "SSH_LOGIN_IDENTITY_NOT_LOADED"


def askpass_program():
    # Prefer KDE's wallet-integrated GUI rather than caching a passphrase here.
    candidates = ["/usr/bin/ksshaskpass", shutil.which("ksshaskpass"),
                  os.environ.get("SSH_ASKPASS")]
    for name in candidates:
        if name and os.path.isabs(name) and os.access(name, os.X_OK):
            return name
    return None


def status():
    key, error = identity()
    if error:
        return error
    fingerprint = public_fingerprint(key)
    return agent_state(fingerprint) if fingerprint else "SSH_LOGIN_IDENTITY_UNAVAILABLE"


def login():
    key, error = identity()
    if error:
        return error
    fingerprint = public_fingerprint(key)
    if fingerprint is None:
        return "SSH_LOGIN_IDENTITY_UNAVAILABLE"
    state = "SSH_LOGIN_AGENT_UNAVAILABLE"
    for _ in range(12):
        state = agent_state(fingerprint)
        if state != "SSH_LOGIN_AGENT_UNAVAILABLE":
            break
        time.sleep(1)
    if state == "SSH_LOGIN_IDENTITY_READY":
        return state
    if state != "SSH_LOGIN_IDENTITY_NOT_LOADED":
        return state
    if not (os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")):
        return "SSH_LOGIN_GUI_UNAVAILABLE"
    askpass = askpass_program()
    if askpass is None:
        return "SSH_LOGIN_ASKPASS_UNAVAILABLE"
    environment = dict(os.environ)
    environment["SSH_ASKPASS"] = askpass
    environment["SSH_ASKPASS_REQUIRE"] = "force"
    # No shell, no terminal, no passphrase handling in Babuni Admin.
    try:
        result = subprocess.run(["ssh-add", str(key)], stdin=subprocess.DEVNULL,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                env=environment, timeout=180, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return "SSH_LOGIN_ADD_FAILED"
    if result.returncode != 0:
        return "SSH_LOGIN_ADD_FAILED"
    return agent_state(fingerprint)


def safe_destination(path):
    if path.is_symlink() or (path.exists() and not path.is_file()):
        raise ValueError("Existing autostart path is not a regular file")


def write_atomically(path, content, mode):
    path.parent.mkdir(parents=True, exist_ok=True)
    safe_destination(path)
    handle, temp_name = tempfile.mkstemp(prefix=".babuni-ssh-", dir=path.parent)
    try:
        with os.fdopen(handle, "wb") as target:
            target.write(content)
        os.chmod(temp_name, mode)
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def installed_paths():
    script = home() / ".local" / "share" / "babuni-admin" / "ssh-agent-login.py"
    startup = Path(os.environ.get("XDG_CONFIG_HOME", str(home() / ".config"))) / "autostart" / NAME
    return script, startup


def install():
    if sys.platform != "linux" or os.geteuid() == 0:
        return "SSH_LOGIN_UNSUPPORTED_CONTEXT"
    key, error = identity()
    if error:
        return error
    if public_fingerprint(key) is None:
        return "SSH_LOGIN_IDENTITY_UNAVAILABLE"
    script, startup = installed_paths()
    safe_destination(script)
    safe_destination(startup)
    if startup.exists() and MARKER not in startup.read_text(encoding="utf-8"):
        return "SSH_LOGIN_EXISTING_AUTOSTART_UNMANAGED"
    if script.exists() and "Opt-in desktop-login loader for Babuni Admin" not in script.read_text(encoding="utf-8"):
        return "SSH_LOGIN_EXISTING_SCRIPT_UNMANAGED"
    # Installation copies a stable local helper; the Git checkout may move.
    write_atomically(script, Path(__file__).read_bytes(), 0o600)
    # The .desktop Exec key is not a shell command. Quote paths and escape
    # freedesktop field-code '%' characters.
    program = str(script).replace("\\", "\\\\").replace('"', '\\"').replace("%", "%%")
    py = str(Path(sys.executable)).replace("\\", "\\\\").replace('"', '\\"').replace("%", "%%")
    content = ("\n".join([
        "[Desktop Entry]",
        "Type=Application",
        "Name=Babuni Admin SSH identity",
        "Comment=Load only the approved Babuni Admin identity into the existing desktop SSH agent",
        f'Exec="{py}" "{program}" run',
        "Terminal=false",
        MARKER,
        "",
    ])).encode("utf-8")
    write_atomically(startup, content, 0o600)
    return "SSH_LOGIN_AUTOSTART_INSTALLED"


def uninstall():
    script, startup = installed_paths()
    if not startup.exists():
        return "SSH_LOGIN_AUTOSTART_NOT_INSTALLED"
    safe_destination(startup)
    if MARKER not in startup.read_text(encoding="utf-8"):
        return "SSH_LOGIN_EXISTING_AUTOSTART_UNMANAGED"
    startup.unlink()
    if script.exists() and not script.is_symlink() and script.is_file():
        if "Opt-in desktop-login loader for Babuni Admin" in script.read_text(encoding="utf-8"):
            script.unlink()
    # Uninstall deliberately leaves the current SSH agent and keys alone.
    return "SSH_LOGIN_AUTOSTART_UNINSTALLED"


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ALLOWED:
        print("Usage: python3 scripts/ssh-agent-login.py {status|install|uninstall|run}")
        sys.exit(2)
    try:
        command = sys.argv[1]
        result = {"status": status, "run": login,
                  "install": install, "uninstall": uninstall}[command]()
        if command != "run":
            print(result)
        sys.exit(0 if result in {"SSH_LOGIN_IDENTITY_READY",
                                  "SSH_LOGIN_AUTOSTART_INSTALLED",
                                  "SSH_LOGIN_AUTOSTART_UNINSTALLED",
                                  "SSH_LOGIN_AUTOSTART_NOT_INSTALLED"} else 1)
    except (OSError, ValueError, UnicodeError):
        if sys.argv[1] != "run":
            print("SSH_LOGIN_SETUP_FAILED")
        sys.exit(1)
