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

Before enabling, audit the actual PostgreSQL role on the live server. The adapter requires a login without elevated roles or memberships, no database or schema CREATE rights, SELECT on the player, avatar, session, event, achievement, progression, inventory and active-encounter data needed for the side panel, UPDATE on `public.players.data`, and DELETE on `public.sessions`. Unexpected INSERT, TRUNCATE, TRIGGER, REFERENCES, updates to other tables or deletions elsewhere fail the runtime privilege gate. Grants must be reviewed by the server operator; the application never creates roles or grants permissions.

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

## Acceptance checks before activation

1. Keep the existing read-only Overview working and verify it cannot invoke moderation or content operations.
2. In a disposable PostgreSQL fixture, verify the moderator role with precisely its required privileges, and confirm rollback when session revocation fails.
3. Operator-configure the separate private moderation profile, test player listing and detail on a designated development account, then timeout, ban, unban, and read back the resulting state.
4. Confirm the five JSON catalogs in the actual deployed game directory, the SSH account's ownership and the game's handling of file updates.
5. Using a disposable content item, test read, write, readback, backup, stale-revision conflict, and game-visible result. Do not overwrite an established encounter.
6. Interrupt SSH deliberately and verify no session remains open, no partial database mutation remains and no sample data is silently displayed.
7. Run the repository's unit, PostgreSQL, browser, build and lint checks before merging.

This document records the code contract and outstanding gates. It does not authorize or perform live mutations.
