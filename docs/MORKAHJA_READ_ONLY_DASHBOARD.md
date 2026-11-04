# Morkahja — Read-only dashboard

**Implementation:** Dedicated local-service read adapter and Morkahja-only React view. **Live player-data verification:** pending. **Default:** data reads disabled, even where the SSH/database health probe works.

## Operator authorization

The existing private `~/.config/babuni-admin/morkahja-probe.json` continues to control the exact SSH destination, approved host-key fingerprint, private SSH identity and dedicated PostgreSQL login. This document adds a **second explicit permission**. To authorize the fixed data view, the operator must review its response fields and manually add these two properties to the existing private JSON configuration:

```json
{
  "readOnlyDataEnabled": true,
  "readOnlyDataFields": ["displayName", "avatarCount", "lastPlayedAt"]
}
```

This excerpt is **not** a complete configuration file; retain all existing required settings. The file remains owned by the local operator, mode `0600`. The local service must also be started with `BABUNI_MORKAHJA_REMOTE_PROBE=enabled`. Without both flags and this **exact** field list, no database overview or player page can be retrieved. The browser can select an existing saved Morkahja `postgres-ssh` profile but cannot edit the server allowlist, permissions, keyring password or approved fields.

## Separate dashboard

The Morkahja navigation adds **Read-only** at `/read-only`. It is intentionally separate from the original Dashboard and Players routes; those legacy paths use different data services and must not be used for this read-only connection. Loading this page performs only a local profile lookup. A remote read starts only after the operator selects a profile and presses **Load database overview** or **Load player preview**.

**Database overview** contains only four counts: players, avatars, active sessions matching a player's active-session reference and not expired, and game events during the previous 24 hours. No player or session records are returned.

**Player preview** returns a fixed, limited response of `displayName` (at most 80 characters), `avatarCount` and `lastPlayedAt` (a validated timestamp or null). It does not include internal player IDs, identity keys, session information, friend lists, moderation information, account credentials, or raw JSON. The fixed SQL orders players by last activity and an internal ID tie-breaker without exposing that ID. The page size is exactly 20; page numbers must be integers from 1 through 1000. There is no browser-controlled query, field selection, sorting or unlimited export.

## Backend boundary

The local service's loopback/session/Origin-checked endpoints are:

- `POST /local-connections-api/:id/read-overview` — no body; requires the `ssh:read` capability.
- `POST /local-connections-api/:id/read-players` — JSON body `{"page":1}` only; the same capability and strict page validation.

Every read repeats private configuration and host-key validation, obtains the per-profile database password from an unlocked Linux Secret Service, starts a short-lived SSH tunnel over an owner-private Unix socket, validates the PostgreSQL role's effective read-only privileges, and executes **fixed SELECT-only queries** in a `REPEATABLE READ READ ONLY` transaction. The transaction is rolled back and the tunnel is closed in all success/failure cases. One remote operation at a time may run; no background polling or persistent database connection is authorized.

The adapter is `local-service/morkahjaReadOnly.mjs`, independent of `vite/postgresAdmin.ts`. The older admin data path may perform maintenance changes while listing players, so it is not used here. Data authorization remains server-side, with no fallback to mock or legacy write-capable APIs.

## Verification and limitations

Source tests check page bounds and allowlists. Local-service tests reject unauthorized profiles, malformed page inputs and cross-origin requests. Disposable PostgreSQL fixture tests verify bounded overview/player results, exclude sensitive fields and ensure a read does not remove sessions. The SSH/data wrapper is tested for denied activation, secret-safe errors, shared single-flight behavior and tunnel cleanup.

**No live Morkahja player database was queried during this implementation.** An approved live check, read-role membership/default-privilege audit, schema compatibility review, and repeatable failure/recovery checks remain outstanding. A successful read-only snapshot authorizes neither account moderation, content editing, website publishing nor automatic access by AI agents.

Do not use `npm run test:postgres` against the actual Morkahja database; that suite performs fixture-only mutations.
