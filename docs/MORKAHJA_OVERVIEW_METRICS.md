# Morkahja Overview — Candidate statistics and database discovery

**Status (2026-11-05): Source-code review and operator-reported live schema/role audits complete; a proposed metric definition contract is documented.** Thresholds, names and counting rules remain subject to the creative's approval and live validation. New owner-controlled aggregate views and dashboard counters remain unimplemented. No live database definitions or privileges were changed.

## Proposed metric contract — research-backed, awaiting creative approval

**Status:** Definitions below are an AI proposal derived from Morkahja source and the operator's read-only metadata inspection. The human creative has asked to define the statistics, but has not separately approved these exact thresholds, labels, filters or production implementation. No view, SQL API, UI card or permission change is included here. Every candidate must be validated using disposable data and controlled, aggregate-only observations before production use.

### Sampling and publication rules

- Each counter is a snapshot at the time of the existing manual or initial read-only dashboard request; **no background polling** is introduced. Report `checkedAt` and the 120-second freshness window where relevant.
- Use database-server time consistently for time-window evaluation. Stored Morkahja timestamps are Unix **milliseconds**, not SQL seconds.
- Restrict inputs to known game tables and only expose scalar aggregates from separately owner-controlled `babuni_admin_ro` views. The `babuni_admin_probe` role must not gain direct read access to any game table or see player IDs, room IDs, JSON content, payment identifiers or session tokens.
- Treat a missing view, unknown schema or invalid aggregate as **unavailable**, not zero. Only a verified query returning zero rows or zero matching records may yield zero. Record invalid JSON shapes or amounts in private, aggregate-level validation diagnostics without leaking records to the UI.
- Bound query time, use one READ ONLY transaction and the existing temporary SSH tunnel, and keep the current dashboard authorization, fixed field allowlist, paging, and no-persisted-player-data rules unchanged.

### Recommended definitions

| UI label | Proposed calculation | Exclusions / interpretation |
| --- | --- | --- |
| **Recently online (2 min)** | Count distinct `player_presence.player_id` whose `data.state` is `online`, `in_room` or `idle`, and whose numeric `data.lastSeenAt` is between snapshot time minus **120,000 ms** and snapshot time. | `offline`, future or invalid timestamps and older records. This is a **recent-heartbeat estimate**, not a permanent open connection or an eight-hour valid login session. |
| **Players in rooms (2 min)** | Count distinct recent players satisfying the online definition, with `state = 'in_room'` and `activeRoomId` referencing a known nonclosed room in which their `playerId` occurs as a participant and their participant state is not `disengaged`. | Stale presence, orphaned room links, disengaged participants and inconsistent room references. Do not count a player twice. |
| **Open rooms** | Count `encounter_rooms` whose valid JSON `roomState` is one of `active_encounter`, `resolving`, `advancing`, `system_event`, `waiting_continue`, or the legacy `active` alias normalized by `roomPersistence.ts`. | `closed` and unknown or malformed states. An open room may be abandoned because automatic idle disengagement is disabled. |
| **Active rooms (2 min)** | Count distinct open rooms that contain at least one qualifying recent player from **Players in rooms**. | An open room with no verifiably recent participants remains open but is not active. |
| **Achievements unlocked** | Count player-achievement records with `rank >= 1` once per `(player_id, achievement_id)`. The source's table primary key already enforces uniqueness. | Progress-only records with rank zero. Do not sum ranks; ranking reflects progression of an individual achievement, not additional unlocked achievements. |
| **Players with achievements** | Count distinct `player_id` among the qualifying unlocked-achievement records. | Progress-only players. |
| **Gems held** | Sum current `players.data.currencies.yellow_red_gem` as a nonnegative, floored integer, matching the game's `readYellowRedGemBalance` normalization for numeric values and parseable numeric strings. Missing balances default to zero. | This is **held balance**, not lifetime gems earned, spent, donated, or sold. Flag malformed present values and out-of-range totals rather than silently hiding them. |
| **Expansion unlocks** | For each player, deduplicate valid integer entries in `data.unlockedExpansions` and count only IDs greater than zero that exist in the approved expansion catalog; sum the resulting **player-unlock pairs**. | Default `0`, invalid/unknown IDs, repeated entries. Ownership is not proof of a purchase. |
| **Dice unlocks** | For each player, deduplicate catalog-valid IDs in `data.unlockedDiceIds` and count only IDs `b` through `f`; sum the resulting **player-unlock pairs**. | Default `a`, invalid/unknown IDs and duplicates. Ownership is not proof of a purchase. |
| **Purchases** | **Unavailable/deferred.** When a verified source exists, count confirmed, deduplicated recorded purchases separately from processed payment-event IDs, with monetary values grouped by currency and accounting status. | The live metadata audit found no `public.purchases` or `public.processed_stripe_events`. Do not display purchase counts as zero or derive revenue from gems or unlock ownership. |

### Game-source grounds and limits

- `client/src/App.tsx` runs `heartbeatSession()` every **45,000 ms** on authenticated game screens. `server/src/services/sessionService.ts` refreshes the session for **8 hours** and calls `touchPlayerPresence`; `server/src/services/roomService.ts` stores `lastSeenAt`, `activeRoomId` and `state`. **120 seconds is a proposed tolerance for missed heartbeats**, not a game constant, and must be reviewed against actual activity.
- `server/src/domain/rooms/EncounterRoom.ts` enumerates the valid room states; `roomPersistence.ts` normalizes legacy `active`. `server/src/domain/rooms/roomConstants.ts` explicitly sets `ROOM_INACTIVITY_ENABLED = false`. `RoomParticipant.ts` contains `choiceState: 'disengaged'`.
- `server/src/domain/achievements/achievementPersistence.ts` stores one row per player and achievement. `achievementEngine.ts` records `unlockedAt` when rank first reaches 1. When `rank >= 1` disagrees with `unlocked_at`, surface an aggregate quality warning for investigation rather than interpreting timestamps as additional achievements.
- `server/src/services/playerService.ts` uses expansion `0` as default and normalizes gem balances. `shared/src/diceCatalog.ts` defines the default dice ID `a` and valid IDs `a`–`f`. Expansion IDs should be validated against the deployed game catalog before the metric is enabled.
- `server/src/db/commerceStore.ts` defines a purchase ledger, but its two expected relations are **absent from the audited live `public` schema**. The script did not check every schema or external payment service, so their physical storage remains unknown.
- The audit verified top-level `data jsonb` column types, **not the documents' internal shapes**, numeric validity, stale-value frequency, catalog-version compatibility, or any aggregate result. These remain explicit implementation gates.

### Proposed first implementation batch (not approved or implemented)

1. **Batch A — simple and low ambiguity:** unlocked achievement records, players with unlocked achievements, and non-default dice/expansion ownership, after confirming deployed catalog identifiers and aggregate results.
2. **Batch B — presence and room semantics:** recent-heartbeat players, occupied players, open rooms and active rooms; reconcile a 120-second window against controlled login/logout and room-join/leave tests.
3. **Batch C — currency:** current gem balances only after private aggregate validation of malformed and unexpectedly large balances.
4. **Deferred — commerce:** locate and verify actual paid-purchase storage and completion semantics. No purchase or revenue card before then.

For every batch, first define and review the owner-controlled view SQL, test boundary denial and query timeouts in disposable PostgreSQL fixtures, then have the operator verify aggregate counts on the real server **before** enabling the UI cards. Final thresholds, labels, display order and scope require the creative's approval.

## Established from the Morkahja game source

This review is based on `babunidev/Morkahja`'s `main` source, not an inspection of live game records. The observed game code and its PostgreSQL definitions distinguish several concepts:

| Metric | Game source | Tentative meaning / limits |
| --- | --- | --- |
| Rooms | `server/src/db/postgresDocumentStore.ts`, `server/src/domain/rooms/EncounterRoom.ts` | `encounter_rooms` stores a JSONB `roomState` with active encounter, resolving, advancing, waiting, system event and closed states. Non-closed rooms **are not necessarily currently occupied**, because automatic inactivity disengagement is disabled (`ROOM_INACTIVITY_ENABLED = false`). Count open rooms only after checking how abandoned rooms are cleaned up. |
| Players online | `server/src/domain/rooms/PlayerPresence.ts`, `server/src/services/roomService.ts` | `player_presence.data` stores `state` (`online`, `in_room`, `idle`, `offline`) and `lastSeenAt` (epoch milliseconds). A fresh heartbeat threshold and whether it includes active sessions must be defined before the count can mean actual presence. The current Overview's session-based estimate is **not** this metric. |
| Achievements | `server/src/domain/achievements/achievementPersistence.ts` | `player_achievements` includes `player_id`, `achievement_id`, `rank`, `progress`, `unlocked_at` and `updated_at`. Potential useful figures: total earned unlock records and distinct players with an unlocked achievement. Decide whether rank progression is a separate metric. |
| Gems | `server/src/types/player.ts`, `server/src/services/playerService.ts` | Player JSON contains `currencies.yellow_red_gem`. This is a **current balance**, not gems earned, spent, donated, or purchased. A total of balances could be aggregated in a privileged view with numeric type/overflow checks. |
| Expansions | `server/src/types/player.ts`, `server/src/services/playerService.ts` | `unlockedExpansions` stores account-wide expansion IDs and includes a default ID `0`. Count non-default unlock ownership separately from real-money purchases or gem unlock events. |
| Dice | `server/src/types/player.ts`, `server/src/services/diceService.ts` | `unlockedDiceIds` stores cosmetic dice ownership, with defaults supplied by `shared/src/diceCatalog.ts`. Total extra dice ownership requires excluding default skins and checking normalization behavior. |
| Transactions / purchases | `server/src/db/commerceStore.ts` | `purchases` stores a purchase record with SKU, amount, currency, timestamp, player and event identifiers. This is a different source from unlock ownership; aggregate by transaction count, SKU, and currency without exposing purchaser or payment-event IDs. `processed_stripe_events` is a deduplication table, not a purchase ledger. |

The game source defines additional tables and JSONB fields; the operator's subsequent audit verified the named public relations and top-level columns listed below, **not** all JSONB shapes or the missing commerce relations. Do not claim live presence or payments from sessions, balances or unlock ownership.

## Operator-reported live metadata audit — 2026-11-05

The operator copied the reviewed SQL script to the Ubuntu Morkahja server and executed it through `sudo -u postgres psql -X -v ON_ERROR_STOP=1 -P pager=off -d morkahja`. The output showed `BEGIN`, two bounded metadata queries, and `ROLLBACK`. A first sudo password attempt failed; the command subsequently succeeded. No data writes or new grants occurred.

| Audited relation | Live object | Owner | `babuni_admin_probe` SELECT |
| --- | --- | --- | --- |
| `babuni_admin_ro.overview` | View | `morkahjadbadmin` | Allowed |
| `babuni_admin_ro.player_preview` | View | `morkahjadbadmin` | Allowed |
| `public.encounter_rooms` | Table | `morkahjadbadmin` | Denied |
| `public.game_events` | Table | `morkahjadbadmin` | Denied |
| `public.player_achievements` | Table | `morkahjadbadmin` | Denied |
| `public.player_presence` | Table | `morkahjadbadmin` | Denied |
| `public.players` | Table | `morkahjadbadmin` | Denied |
| `public.sessions` | Table | `morkahjadbadmin` | Denied |

Both `probe_can_select` and `probe_can_select_any_column` returned true for the two restricted views, and false for all six source tables. The script listed 28 columns across the two views and five game tables. Relevant audited shapes:

- `encounter_rooms(id text, data jsonb)`; `player_presence(player_id text, data jsonb)`; `players(id text, data jsonb)`.
- `player_achievements(player_id text, achievement_id text, rank integer, progress integer, unlocked_at bigint, updated_at bigint)`.
- `game_events(event_id text, timestamp bigint, player_id text, avatar_id text, type text, visibility text, importance text, payload jsonb)`.
- `babuni_admin_ro.overview(players bigint, avatars bigint, active_sessions bigint, events_last_24h bigint)`.
- `babuni_admin_ro.player_preview(position bigint, display_name text, avatar_count bigint, last_played_at bigint)`.

`public.purchases` and `public.processed_stripe_events` **were not returned**. This establishes that the named relations were not present among the audited `public` objects; it does not establish whether commerce data lives under a different schema or service. The audit deliberately did **not** include `sessions` in its column metadata query, so its internal structure has not been verified here. The contents and shapes *inside* JSONB values were not read, and commerce totals, real-time player presence, room activity, and unlock counts have not been computed.

### Role and creation-privilege audit — 2026-11-05

After the metadata check, the operator ran a second transaction on the live `morkahja` database with `BEGIN READ ONLY`, a 5-second statement timeout, and `ROLLBACK`. The result for `babuni_admin_probe` was:

| Check | Observed result |
| --- | --- |
| `rolcanlogin` | `true` |
| `rolsuper`, `rolcreatedb`, `rolcreaterole` | All `false` |
| `rolreplication`, `rolbypassrls` | Both `false` |
| Other role memberships via `pg_has_role(..., 'MEMBER')` | 0 rows |
| `has_database_privilege(..., 'CREATE')` on `morkahja` | `false` |
| `has_schema_privilege(..., 'CREATE')` on `public` | `false` |
| `has_schema_privilege(..., 'CREATE')` on `babuni_admin_ro` | `false` |

Combined with the prior metadata audit, this supports the intended restricted-view model: the role is not privileged through PostgreSQL role membership or the checked CREATE privileges, and has effective SELECT only on the two designated views among the audited relations.

**Limits:** These checks do not enumerate every function, schema, sequence, table, database or grant via `PUBLIC`, nor do they audit permissions outside the checked object set. They are not a blanket production write-access certification. No grants, role attributes, game records or views were changed.

**Next gate — metric definitions:** Choose a presence heartbeat threshold and included states; distinguish open from occupied rooms; decide whether achievements represent unlocked records or rank progress; count only non-default dice/expansion ownership; treat gem totals as balances; and defer purchase figures until the actual commerce storage is located. The previously verified column types do not prove the contents or consistency of JSONB documents. No new read access, SQL endpoint, or dashboard counter is authorized by these observations.

## Operator-only, metadata-only live audit

A file named `scripts/morkahja-overview-metadata.sql` is provided for the operator. It issues **fixed PostgreSQL metadata SELECT queries only**, inside `BEGIN READ ONLY` with a short statement timeout, and ends in `ROLLBACK`. It displays table/view names, owners, types, column names and the existing read-only role's SELECT permissions. It **does not return** player records, purchase rows, JSON values, room identifiers, tokens, keys or raw event payloads.

On the Ubuntu server (using the existing `babuni` SSH login), inspect the script contents locally or copy the SQL text from the repository, and execute under the PostgreSQL administrator with `psql -X -v ON_ERROR_STOP=1 -d morkahja -P pager=off`. Do not redirect scripts from a public URL into an interactive administrative shell. Run only after reviewing the fixed SQL. The script is **not** part of the browser or its privileged local service.

## Gate before implementation

1. **Completed for existing relations:** Confirm top-level columns of `encounter_rooms`, `player_presence`, `player_achievements` and restricted views via the operator's metadata audit. The two expected commerce tables were not found in audited `public`; their actual location is unknown.
2. Define exact statistics and aggregation windows, including what counts as a fresh heartbeat, an open room, an earned achievement, non-default unlock, and completed paid transaction. Distinguish `purchases` monetary amounts by currency and never sum different currencies into one total.
3. Design owner-controlled **aggregate-only** views under `babuni_admin_ro`. Apply `GRANT SELECT` only on approved views to `babuni_admin_probe`; **never** grant that role access to the raw public game tables.
4. Extend the fixed `local-service/morkahjaReadOnly.mjs` responses only after reviewing the view definitions and allowed field list. Keep one bounded read-only transaction per temporary SSH tunnel; no arbitrary SQL endpoint or auto-granted permissions.
5. Validate the new aggregates using disposable PostgreSQL fixtures, then separately verify against live operator-observed counts. Document any gaps rather than manufacturing zero counts for unavailable tables.

**No production DDL or data changes are approved by this discovery document.**
