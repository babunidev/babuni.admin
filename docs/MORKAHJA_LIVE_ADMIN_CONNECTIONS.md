# Morkahja — privileged live administration connections

**State:** Development-branch source implementation only. The existing Overview is verified read-only. Neither Moderation nor Content is live-activated by this document or by adding a profile. No production database grants, server file permissions, player records, or game files have been changed.

## Distinct connections

| Feature | Profile kind | Server-side private gate | Rights |
| --- | --- | --- | --- |
| Overview | `postgres-ssh` | `BABUNI_MORKAHJA_REMOTE_PROBE=enabled` | Fixed restricted views only |
| Moderation reads | `postgres-ssh-moderation` | `BABUNI_MORKAHJA_REMOTE_MODERATION=enabled` | Distinct SELECT-only PostgreSQL role |
| Moderation mutations | same separate profile | additional `BABUNI_MORKAHJA_MODERATION_WRITES=enabled` | Explicitly authorized UPDATE of player data and DELETE of sessions |
| Content | `ssh-content` | `BABUNI_MORKAHJA_REMOTE_CONTENT=enabled` | One-shot SSH worker, five fixed JSON catalogs |

Keep each profile's authorization and configuration separate. The existing `babuni_admin_probe` role must never gain UPDATE, DELETE, or direct SELECT on raw game tables. The localhost connection service validates browser session and origin, and every remote request repeats the authorized private host and identity check.

### Moderation private configuration

A separate owner-private file `~/.config/babuni-admin/morkahja-moderation.json` (0600) uses the same required fields as the existing read-only Morkahja probe configuration: `enabled`, `host`, `sshUser`, `sshPort`, `sshIdentityFile`, `dbUser`, `dbName`, `dbPort`, and `approvedHostKeyFingerprint`. Its `dbUser` must be a distinct operator-approved moderation role, never `babuni_admin_probe`. Do not copy reader-only data field approvals into this config. The moderator password is a separate credential stored under the moderation profile ID in the desktop Secret Service, not in the JSON file.

Before enabling player inspection, review the operator-only, not-applied `scripts/morkahja-moderation-read-role.sql`. The adapter requires a separate account without elevated roles or memberships, no database/schema CREATE rights, and SELECT on the eight named player/related tables. This is enough for player lists and the side panel without any write rights. Timeout/ban/unban require both separately reviewed UPDATE permission on `public.players.data`, DELETE on `public.sessions`, and the additional `BABUNI_MORKAHJA_MODERATION_WRITES=enabled` gate. Unexpected INSERT, TRUNCATE, TRIGGER, REFERENCES, updates to other tables or deletions elsewhere fail the runtime privilege gate. Grants must be operator-reviewed; the application never creates roles or grants permissions.

The selected profile enables the existing player list and detail panel, timeout, ban and unban. Each operation uses a fresh pinned SSH tunnel and a single database transaction; timeout and ban lock the selected player row, change moderation state, and revoke matching sessions together. If the session deletion fails, the transaction rolls back. No periodic SSH polling is added.

### Content private configuration

A separate owner-private file `~/.config/babuni-admin/morkahja-content.json` (0600) contains exactly these fields:

```json
{
  "enabled": true,
  "host": "YOUR_APPROVED_HOST",
  "sshUser": "YOUR_APPROVED_SSH_USER",
  "sshPort": 22,
  "sshIdentityFile": "/absolute/path/to/approved/private/key",
  "approvedHostKeyFingerprint": "SHA256:YOUR_ALREADY_VERIFIED_FINGERPRINT"
}
```

The displayed values are placeholders, not usable credentials or the current server's verified configuration. Keep existing host-key trust checks. A separate SSH content profile does not need a database password. Its SSH account must be able to read the deployed JSON files and, before write activation, must legitimately own the specific target files and have narrowly scoped directory-write access. Do not globally loosen permissions.

The trusted one-shot worker `scripts/morkahja-content-ssh-worker.py` is delivered over SSH stdin. It does not install a public server, expose remote shell commands from the browser, or accept arbitrary file paths. Its fixed production root is `/var/www/morkahja/game`, the location where the running expansion catalog was verified. It reads and updates only `encountersdata.json`, `solutiondata.json`, `expansiondata.json`, `frames.json`, and `portraits.json`. A save requires a fresh SHA-256 revision from the preceding read; it creates a backup, atomically replaces one JSON file, and verifies the bytes. Conflicting revisions are rejected rather than overwritten.

**Limitations:** Image uploads, remote image delivery, and game-process cache/reload behavior have not yet been implemented or verified for the SSH content profile. Artwork displayed through separately configured static URLs is not proof that images belong to the deployed catalog revision.

## Reach the live player list — operator workflow

### A. On Nobara: update and identify the actual game database

```bash
cd /home/babuni/Projects/babuni.admin
git fetch origin
git switch feat/morkahja-write-connection-foundation
git pull --ff-only origin feat/morkahja-write-connection-foundation
python3 scripts/prepare-morkahja-moderation-config.py
```

The helper reads the existing private, working Overview connection metadata and prints only its database name and the new login name, not passwords or SSH fingerprints. Keep the database name for the server commands.

### B. On Nobara: review deployed schema and the SELECT-only role SQL

```bash
SSH_TARGET=$(python3 - <<'PY'
import json
from pathlib import Path
cfg=json.loads((Path.home()/'.config/babuni-admin/morkahja-probe.json').read_text())
print(cfg['sshUser']+'@'+cfg['host'])
PY
)
scp scripts/morkahja-moderation-schema-preflight.sql \
  scripts/morkahja-moderation-read-role.sql "$SSH_TARGET:~/"
ssh "$SSH_TARGET"
```

On the game server, set the database name printed by step A; verify it exists before continuing:

```bash
DB_NAME='REPLACE_WITH_DB_NAME_FROM_STEP_A'
sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  < "$HOME/morkahja-moderation-schema-preflight.sql"
```

The preflight reads schema metadata only. **Stop if any required column is MISSING** or if the database is wrong. After independent review and operator approval, apply the new SELECT-only role; the script contains a CREATE ROLE and grants but no UPDATE or DELETE:

```bash
sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  < "$HOME/morkahja-moderation-read-role.sql"
sudo -u postgres psql -d "$DB_NAME"
```

In the interactive `psql` prompt, issue `\password babuni_admin_moderation`, enter a new strong password when prompted, then `\q`. Never paste the password into chat, shell arguments, the JSON profile, or a repository file. If PostgreSQL is not locally administered by the `postgres` system user, the operator must use the verified database owner login instead; the commands above make no assumption about that user's password.

### C. On Nobara: create private moderator config

```bash
cd /home/babuni/Projects/babuni.admin
python3 scripts/prepare-morkahja-moderation-config.py --create
```

The file `~/.config/babuni-admin/morkahja-moderation.json` is created with mode `0600` and contains the same pinned SSH host, SSH identity and actual database name as Overview, with the separate `babuni_admin_moderation` database login. It does not copy the Overview database password or enable write access. The helper refuses overwriting an existing moderator config.

### D. On Nobara: run and select the new profile

```bash
cd /home/babuni/Projects/babuni.admin
npm ci
npm test
npm run build
npm run lint
BABUNI_MORKAHJA_REMOTE_PROBE=enabled \
BABUNI_MORKAHJA_REMOTE_MODERATION=enabled \
npm run dev
```

Use the local Connections page to create a Morkahja profile of kind **PostgreSQL via SSH (separate moderation profile)**, target the exact same pinned SSH host as Overview, and store the new moderation database password through the UI's OS-keyring credential control. Then open Moderation and select the new profile. Compare the player total with the verified Overview; click one account to inspect avatar details, achievements, unlocks, currencies and encounters. The tool opens an outbound SSH tunnel only for the request and closes it after the snapshot.

Do **not** set `BABUNI_MORKAHJA_MODERATION_WRITES` at this stage. This phase explicitly tests player inspection; timeout/ban/unban are a separately authorized milestone.

## Acceptance checks before activation

1. Keep the existing read-only Overview working and verify it cannot invoke moderation or content operations.
2. In a disposable PostgreSQL fixture, verify the moderator role with precisely its required privileges, and confirm rollback when session revocation fails.
3. Operator-configure the separate private moderation profile, test player listing and detail on a designated development account, then timeout, ban, unban, and read back the resulting state.
4. Confirm the five JSON catalogs in the actual deployed game directory, the SSH account's ownership and the game's handling of file updates.
5. Using a disposable content item, test read, write, readback, backup, stale-revision conflict, and game-visible result. Do not overwrite an established encounter.
6. Interrupt SSH deliberately and verify no session remains open, no partial database mutation remains and no sample data is silently displayed.
7. Run the repository's unit, PostgreSQL, browser, build and lint checks before merging.

This document records the code contract and outstanding gates. It does not authorize or perform live mutations.
