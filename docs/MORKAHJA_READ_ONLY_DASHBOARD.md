# Morkahja — Read-only dashboard

**Implementation:** Dedicated local-service read adapter and Morkahja-only React view. **Live player-data verification:** operator observed successful overview, all four pages of player previews and matching activity changes during gameplay on 2026-11-04. New automatic reload and combined-read behavior requires a separate local test. **Default:** data reads disabled, even where the SSH/database health probe works.

## Restricted PostgreSQL views — live server configuration

The database-side permissions have been configured and verified by the operator on the Morkahja Ubuntu server. `morkahjadbadmin` owns `babuni_admin_ro.overview` and `babuni_admin_ro.player_preview`; the distinct login role `babuni_admin_probe` receives schema USAGE and view SELECT only. It has no CREATE permission on that schema and no raw SELECT on `public.players` or `public.sessions`. The view definitions access the underlying data with the owner's rights, so the probe role does not need permission to read the sensitive base tables.

- `overview`: exactly one row with `players`, `avatars`, `active_sessions`, `events_last_24h` aggregate counts.
- `player_preview`: `position` (internal page ordering), `display_name` (truncated), `avatar_count` and `last_played_at`. Only the latter three display fields are returned by the service.
- Both views use `security_barrier = true`. Their owner and schema are fixed by the operator's live database transaction, not inferred from application credentials.
- The adapter explicitly rejects a probe role that gains direct SELECT on any of `public.players`, `public.avatars`, `public.sessions`, `public.game_events` or `public.player_achievements`. The database write-privilege test remains separate.

**Verification:** The operator confirmed committed views, usable SELECT grants, a nonempty preview count, and raw player/session SELECT denial. The operator subsequently verified the dashboard's live data requests after updating the adapter. No repeat database migration is necessary for this step.

## Operator authorization

The existing private `~/.config/babuni-admin/morkahja-probe.json` continues to control the exact SSH destination, approved host-key fingerprint, private SSH identity and dedicated PostgreSQL login. This document adds a **second explicit permission**. To authorize the fixed data view, the operator must review its response fields and manually add these two properties to the existing private JSON configuration:

```json
{
  "readOnlyDataEnabled": true,
  "readOnlyDataFields": ["displayName", "avatarCount", "lastPlayedAt"]
}
```

This excerpt is **not** a complete configuration file; retain all existing required settings. The file remains owned by the local operator, mode `0600`. The local service must also be started with `BABUNI_MORKAHJA_REMOTE_PROBE=enabled`. Without both flags and this **exact** field list, no database overview or player page can be retrieved. The browser can select an existing saved Morkahja `postgres-ssh` profile but cannot edit the server allowlist, permissions, keyring password or approved fields.

## Batch A activation and desktop verification

The operator has already deployed and verified `babuni_admin_ro.progression_ownership_totals`; no repeat migration is required. The local Overview now supports achievements unlocked, players with achievements, dice unlocks and expansion unlocks. These are aggregate counts, not purchase records.

To enable the fixed additional read, retain all existing private configuration and add this property on the operator's Nobara PC:

```json
"readOnlyMetricFields": ["achievementsUnlocked", "playersWithAchievements", "diceUnlocks", "expansionUnlocks"]
```

This is a property excerpt, not a complete JSON document. Keep valid JSON syntax, existing `readOnlyDataEnabled` and exact `readOnlyDataFields`, ownership and mode 0600. No browser endpoint can enable it. Configurations without this property continue loading the original Overview and players; the new cards show Unavailable. The config is read on each request, but new application code requires restarting the local development process.

After updating the application, enable the property, restart the local app with the existing approved environment and select the remembered connection or use Refresh. Confirm four cards, checked-at time, existing pagination and unavailable/error behavior. The operator's earlier database-only totals were 75/52/10/6; current totals may change with gameplay. Do not publish player-preview screenshots.

**Desktop verification remains pending.** Unit, PostgreSQL and browser fixtures do not establish successful execution on Nobara. All new counters follow the existing manual/initial request lifecycle with no background polling.

## Additional counters and interpretation

**Players online*** in the new UI is an estimate based on non-expired matching active-account sessions. This measures an authorized session, **not** a confirmed live player heartbeat or a game room. Sessions and rooms are different concepts; no room count has been verified from the game's database.

The legacy Morkahja adapter references `player_achievements`, player currency JSON, `unlockedExpansions` and player encounter records. Those establish possible data sources, **not** validated aggregate definitions or purchases. A gem balance is different from a gem earned/spent transaction; owned expansions/dice are not proof of a paid purchase. Before adding new cards with numbers, confirm the actual live schema and agree on the meaning of each metric. Then create owner-controlled **aggregate-only** views and extend the fixed data-read contract, never grant the reader SELECT on raw tables.

## Separate dashboard

The Morkahja navigation now names the read-only landing page **Overview** at `/`; the historical `/read-only` URL still renders the same view. The previous legacy Dashboard remains accessible at `/dashboard`, and the write-capable `/players` route is labeled **Moderation** without changing its authority. The Overview remembers only the selected **local profile UUID** in browser storage. An initial profile selection immediately retrieves the overview and first player page, and reloading a page with a previously selected valid profile retrieves a fresh snapshot. There is no remote request if no profile has been selected; expired/missing local profile identifiers are discarded. All server-side private host, keyring, permission and operator approvals are rechecked on every read. No remote credentials or player data are persisted in the browser.

**Original database overview** contains four counts: players, avatars, active sessions matching a player's active-session reference and not expired, and game events during the previous 24 hours. No player or session records are returned.

**Player preview** returns a fixed, limited response of `displayName` (at most 80 characters), `avatarCount` and `lastPlayedAt` (a validated timestamp or null). It does not include internal player IDs, identity keys, session information, friend lists, moderation information, account credentials, or raw JSON. The fixed SQL orders players by last activity and an internal ID tie-breaker without exposing that ID. The page size is exactly 20; page numbers must be integers from 1 through 1000. There is no browser-controlled query, field selection, sorting or unlimited export.

## Backend boundary

The local service's loopback/session/Origin-checked endpoints are:

- `POST /local-connections-api/:id/read-dashboard` — JSON body `{"page":1}`; returns overview and the specified 20-row player page from **one** read-only transaction and private SSH tunnel. Requires the existing `ssh:read` capability and strict page validation.
- `POST /local-connections-api/:id/read-overview` — no body; retained for compatibility and requires the `ssh:read` capability.
- `POST /local-connections-api/:id/read-players` — JSON body `{"page":1}` only; the same capability and strict page validation.

Every read repeats private configuration and host-key validation, obtains the per-profile database password from an unlocked Linux Secret Service, starts a short-lived SSH tunnel over an owner-private Unix socket, validates the PostgreSQL role's effective read-only privileges, and executes **fixed SELECT-only queries** in a `REPEATABLE READ READ ONLY` transaction. The transaction is rolled back and the tunnel is closed in all success/failure cases. One remote operation at a time may run; there is **no periodic background polling** or persistent database connection. Page reloads after a remembered selection, explicit profile changes and the refresh button trigger short-lived requests.

The adapter is `local-service/morkahjaReadOnly.mjs`, independent of `vite/postgresAdmin.ts`. The older admin data path may perform maintenance changes while listing players, so it is not used here. Data authorization remains server-side, with no fallback to mock or legacy write-capable APIs.

## First live read attempt and safe diagnostics

The operator's first live Morkahja data request displayed `REMOTE_READ_FAILED` after the previously successful metadata-only health probe. The cause was subsequently confirmed as missing SELECT access to the original tables. A role may pass read-only-role checks while lacking permission to SELECT from one or more dashboard tables. The adapter now maps known PostgreSQL SQLSTATE codes to safe, non-sensitive statuses rather than exposing raw database exceptions. For example, `DB_READ_PERMISSION_DENIED` means a database role needs a separately reviewed table-SELECT permission; it does **not** justify granting write privileges, changing roles automatically or exposing a raw SQL error to the browser. The operator created owner-controlled views with view-only grants after the missing permissions were confirmed; no direct SELECT on the original sensitive tables was granted.

## Verification and limitations

**Observed live result, 2026-11-04:** The local dashboard loaded counts of 62 players, 90 avatars, 0 active sessions and 0 game events over the previous 24 hours. Its preview showed real players using only the approved three visible fields. The interface reported SSH disconnected after snapshot, consistent with the coded tunnel cleanup. The operator subsequently navigated through all four pages and back, and observed active-session and recent-event counts increasing during game activity. These live checks are complete; testing the newly added remembered-selection flow and interrupted-connection recovery remains open. No individual player names or screenshot images are retained in repository documentation.


Source tests check page bounds and allowlists. Local-service tests reject unauthorized profiles, malformed page inputs and cross-origin requests. Disposable PostgreSQL fixture tests verify bounded overview/player results, exclude sensitive fields and ensure a read does not remove sessions. The SSH/data wrapper is tested for denied activation, secret-safe errors, shared single-flight behavior and tunnel cleanup.

**No live Morkahja player database was queried during AI implementation.** After the view-only change, the operator verified successful live overview and preview requests. A separate read-role membership/default-privilege audit, the new remembered-selection flow and repeatable failure/recovery checks remain outstanding. A successful read-only snapshot authorizes neither account moderation, content editing, website publishing nor automatic access by AI agents.

Do not use `npm run test:postgres` against the actual Morkahja database; that suite performs fixture-only mutations.
