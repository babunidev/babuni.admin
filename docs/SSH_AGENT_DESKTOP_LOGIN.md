# Babuni Admin — SSH identity at desktop login

## Purpose

The Morkahja Overview uses an operator-approved SSH identity to open an ephemeral, read-only database tunnel. The SSH client runs with `BatchMode=yes`, `-F /dev/null`, and an explicitly pinned identity, so it cannot prompt for a passphrase when the application tries to connect. On 2026-11-05, the operator observed `SSH_AUTH_REJECTED` while the existing desktop SSH agent had no identities. After manually loading the approved key with `ssh-add` and restarting the old Babuni Admin process, the live Overview worked.

A desktop login may start an SSH agent without loading the private identities into it. KDE Plasma offers a per-user Autostart manager, and KDE's `ksshaskpass` integrates SSH passphrase prompting with a wallet. This repository includes a **manual, opt-in** loader to use those existing facilities. The app does not create another agent, remember passphrases, or weaken the noninteractive SSH tunnel.

## Setup on the user's Nobara KDE desktop

All commands run **as the desktop user**, not root. They do not contact a server.

Check that the existing agent and graphical askpass are present:

```bash
printf 'Agent socket available: '
test -n "${SSH_AUTH_SOCK:-}" && echo yes || echo no
command -v ksshaskpass || echo 'ksshaskpass not available'
```

The app's approved key path must remain in the existing private `~/.config/babuni-admin/morkahja-probe.json`, which is owner-readable only. The public companion `<sshIdentityFile>.pub` must exist. Do not place the private key or its passphrase in the repository, the .desktop entry, or any systemd environment file.

**Explicitly opt in** to autoloading only the existing approved identity:

```bash
cd ~/Projects/babuni.admin
python3 scripts/ssh-agent-login.py install
python3 scripts/ssh-agent-login.py status
```

The installer copies its helper to `~/.local/share/babuni-admin/ssh-agent-login.py` and creates `~/.config/autostart/babuni-admin-ssh-agent.desktop`. These local files contain neither credentials nor the chosen key path. The private key path is read from the restricted configuration each login. Only files with the installer marker are ever replaced or removed. Installation is **not** triggered by `npm run dev`, repository updates or opening a page.

At the next graphical login, the helper waits briefly for the **existing** `SSH_AUTH_SOCK`, checks whether the specific approved public-key fingerprint is already represented in the agent, and otherwise runs `ssh-add` for that single key. If KDE's `ksshaskpass` is available, it may ask for a passphrase or use an unlocked KWallet entry that the user previously approved. Babuni Admin itself neither reads nor stores the passphrase; an initial unlock dialog may still be necessary. If no usable agent, GUI, graphical askpass, or private config exists, the helper fails closed. It does not start its own agent or open a network connection.

To verify after signing out and back in:

```bash
cd ~/Projects/babuni.admin
python3 scripts/ssh-agent-login.py status
ssh-add -l
```

Expected helper status: `SSH_LOGIN_IDENTITY_READY`. Then launch Babuni Admin normally with the existing operator-controlled `BABUNI_MORKAHJA_REMOTE_PROBE=enabled` setting and check that the remembered Morkahja Overview loads.

To disable the startup helper without removing SSH keys or disturbing the active agent:

```bash
python3 scripts/ssh-agent-login.py uninstall
```

## Status codes

- `SSH_LOGIN_IDENTITY_READY`: the configured public key's fingerprint is already loaded in the current agent.
- `SSH_LOGIN_IDENTITY_NOT_LOADED`: the agent is reachable but the approved key is absent.
- `SSH_LOGIN_AGENT_UNAVAILABLE`: the session has no usable agent socket.
- `SSH_LOGIN_IDENTITY_UNAVAILABLE`: the configured private key or public companion is missing or unsafe.
- `SSH_LOGIN_PRIVATE_CONFIG_UNAVAILABLE`: the owner-only private configuration is missing or unsafe.
- `SSH_LOGIN_GUI_UNAVAILABLE`: no graphical session is available; the helper will not request passphrases headlessly.
- `SSH_LOGIN_ASKPASS_UNAVAILABLE`: no executable GUI askpass program is available.
- `SSH_LOGIN_ADD_FAILED`: the key could not be added; the operator may inspect agent/KWallet state without disclosing the passphrase.

The login-time `run` mode prints no diagnostics and does not log paths, agent contents, SSH arguments, credentials or passphrases.

## Operator-reported acceptance status — 2026-11-05

The operator installed the XDG helper on Nobara (reporting `SSH_LOGIN_AUTOSTART_INSTALLED`) and confirmed `ksshaskpass` was already available. Following the instructed fresh-login check, `status` returned `SSH_LOGIN_IDENTITY_READY` and `ssh-add -l` displayed the expected approved ED25519 key fingerprint. This supports the desktop readiness milestone; the terminal transcript alone is not independent proof that logout/login occurred or that no manual key addition happened. No private passphrase or key material is included in these records.

## Security and verification boundaries

The helper is **not a service autostart for Babuni Admin** and does **not** enable database reading or moderation. It only makes the approved SSH identity available to the already running desktop agent, with user consent during setup. The existing SSH host key pin, keyring database password, server-side read permission and per-request tunnel teardown are unchanged.

Disposable tests mock `ssh-add` and `ssh-keygen` with an isolated home directory. They check idempotent installation/removal, owner-only files, no key material in the .desktop entry, skipped duplicate loads and failures without a GUI or safe private config. No live key, SSH server or Morkahja database is accessed by these tests. The actual next-login experience on Nobara remains **operator verification pending**.
