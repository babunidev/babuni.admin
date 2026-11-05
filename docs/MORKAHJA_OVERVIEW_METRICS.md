# Morkahja Overview — Candidate statistics and database discovery

**Status (2026-11-05): Source-code review, operator-reported live metadata audit and restricted role checks complete.** Metric definitions, new owner-controlled aggregate views and dashboard counters remain pending. No live database definitions or privileges were changed.

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

The game source defines tables, but their **presence and exact columns on the running database are not yet confirmed**. Avoid treating a table from source as an observed production table. Do not claim online presence or a payment total based on account-session counts or expansion/dice ownership.

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

1. Confirm real columns and existence of `encounter_rooms`, `player_presence`, `player_achievements`, `purchases` and the current restricted views via the metadata audit.
2. Define exact statistics and aggregation windows, including what counts as a fresh heartbeat, an open room, an earned achievement, non-default unlock, and completed paid transaction. Distinguish `purchases` monetary amounts by currency and never sum different currencies into one total.
3. Design owner-controlled **aggregate-only** views under `babuni_admin_ro`. Apply `GRANT SELECT` only on approved views to `babuni_admin_probe`; **never** grant that role access to the raw public game tables.
4. Extend the fixed `local-service/morkahjaReadOnly.mjs` responses only after reviewing the view definitions and allowed field list. Keep one bounded read-only transaction per temporary SSH tunnel; no arbitrary SQL endpoint or auto-granted permissions.
5. Validate the new aggregates using disposable PostgreSQL fixtures, then separately verify against live operator-observed counts. Document any gaps rather than manufacturing zero counts for unavailable tables.

**No production DDL or data changes are approved by this discovery document.**
