# Morkahja — operator-gated SSH/PostgreSQL health probe

**Implementation:** Local service code and disposable tests. **Live server verification:** the operator reported a successful Morkahja SSH/database health check on 2026-11-04 at 20:59, following the OpenSSH compatibility fix. **Default:** disabled until explicitly enabled by the operator. **Scope:** a metadata-only health probe, not player-data access or writes.

## What this does

The Connections page retains its **Check pinned key (offline)** action, which never contacts a server. A separate **Probe SSH + DB (opt-in)** action is present for Morkahja `postgres-ssh` profiles; unless the operator explicitly enables the probe through both private local configuration and the service environment, the action reports `REMOTE_PROBE_DISABLED` without reading a password or opening a connection.

When explicitly enabled, the service:

1. Requires the selected profile's exact host to match a privately maintained, project-specific configuration. The UI cannot configure the SSH username, identity, port, database, fingerprint or activation flag.
2. Requires one exact public host key in the private `ssh_known_hosts` file and verifies its SHA-256 fingerprint against an **independently approved** fingerprint in the private configuration. OpenSSH separately enforces strict live host-key checking; neither the application nor `ssh-keyscan` auto-accepts keys.
3. Requires an unlocked, introspectable Secret Service keyring and a per-profile PostgreSQL password stored using `npm run credentials -- set <profile-id>`. The SSH identity stays in the user's normal file/agent setup; never store private SSH keys in the generic credential field.
4. Starts `ssh` using a fixed, noninteractive argv with `-F /dev/null`, strict host-key verification, one explicitly configured SSH identity, no agent forwarding, no remote shell command, and a **user-private Unix-domain socket** on the PC forwarded through SSH to `127.0.0.1:<database-port>` as seen from the SSH server.
5. Opens PostgreSQL through the private temporary Unix socket with a fixed read-only transaction. It examines only the current database/role and effective schema/table write privileges, not user or game records. A role with detected write privileges fails the check.
6. Terminates the SSH child after the probe, on failure, and on local-service shutdown. Successful results are labelled **health checked, disconnected**, not `connected`.

The check is **not a general SQL interface** and does not grant moderation, content editing, publication or other remote operations.

## Operator-only configuration

Configuration is not supplied by the browser or committed to the repository. The default private location is:

- `~/.config/babuni-admin/ssh_known_hosts` — a single verified exact host-key entry, permission `0600`.
- `~/.config/babuni-admin/morkahja-probe.json` — operator-only, owner-readable configuration, permission `0600`.
- The SSH private identity path specified in the configuration — an existing private file owned by the desktop user, without symlinks, permission `0600`.

Illustrative **disabled** configuration, using deliberately nonfunctional values:

~~~json
{
  "enabled": false,
  "host": "morkahja.example.invalid",
  "sshUser": "read_only",
  "sshPort": 22,
  "sshIdentityFile": "/home/operator/.ssh/morkahja_read_only",
  "dbUser": "morkahja_reader",
  "dbName": "morkahja",
  "dbPort": 5432,
  "approvedHostKeyFingerprint": "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
}
~~~

All nine fields are required; extra fields, URLs, credentials or unapproved destination overrides are rejected. The operator must independently verify the real host key, server endpoint and SSH identity and provision a dedicated least-privilege PostgreSQL role **before** setting `enabled` to `true`. A bogus or copied fingerprint is not trustworthy merely because it is in this file.

**Second independent opt-in:** start the local service with `BABUNI_MORKAHJA_REMOTE_PROBE=enabled` in its private process environment. The optional `BABUNI_MORKAHJA_PROBE_CONFIG` points to an absolute alternative private JSON file. Without both the process opt-in and file approval, `POST /local-connections-api/:id/probe` remains inert. The normal `npm run dev` path does not set this flag.

The browser receives no DB password or SSH private-key bytes. The password is retrieved only within the local service for this single check, and no query credentials are written to a URL, argument list, frontend storage or application log.

## Separate read-only data permission

The new Morkahja `/read-only` dashboard is **not enabled by the health probe alone**. It additionally requires `readOnlyDataEnabled: true` and the exact field list `['displayName','avatarCount','lastPlayedAt']` in the same operator-private configuration. It uses a separate scoped `ssh:read` capability and fixed SELECT-only queries. See [read-only dashboard contract](MORKAHJA_READ_ONLY_DASHBOARD.md).

## Private SSH failure classifications
## Approved SSH identity at desktop login

The operator confirmed `SSH_AUTH_REJECTED` with an empty desktop SSH agent and restored the live Overview by adding the approved key manually. A new [opt-in desktop login helper](SSH_AGENT_DESKTOP_LOGIN.md) can load just that identity through the existing KDE/Nobara agent and a graphical askpass, without storing its passphrase or changing SSH/server permissions. The helper has passed isolated tests, but its actual startup behavior on Nobara has not yet been verified.



Following the operator-observed `SSH_SESSION_FAILED` on a remembered Overview reload, the local service can now classify a bounded fragment of child SSH stderr into fixed codes without exposing the raw text. Recognized categories cover rejected host keys, inaccessible identities, authentication rejection, denied forwards, unsupported client options and unreachable hosts. An unrecognized early exit remains `SSH_SESSION_FAILED`. No SSH argument, host-key policy, database privilege or tunnel cleanup behavior was relaxed.

The real reason for the operator's failed attempt is **not yet verified**. Tests use synthetic SSH failures only; never treat the classified code as approval to disable host verification or broaden database access.

## Verification and boundaries

- Unit tests check missing configuration, wrong host/fingerprint, unsafe file permissions, invalid profile scope, concurrency, cleanup and sanitized error responses.
- A fake SSH child checks strict argv construction and private Unix forwarding without contacting any VPS.
- CI uses a **disposable PostgreSQL 16 database** to verify that a limited fixture role passes and a privileged role is rejected; a fake SSH process forwards the database protocol over a private local Unix socket for one combined integration test.
- The production SSH daemon, live host-key handshake, user key or real Morkahja database have **not** been contacted or verified by these tests.

The role check is deliberately conservative, but it cannot replace server-side role provisioning and a full independent privilege audit (including role membership/SET ROLE, default privileges and future schema changes). The local loopback UI is also not an authentication boundary against malicious programs running as the same OS user. No live Morkahja administrative or content operation is authorized by a successful health check. 
