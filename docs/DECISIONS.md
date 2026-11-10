# Babuni Admin — Decisions and Alternatives
## 2026-11-10 — Open, see what changed, publish with one click

**Creative direction:** Checking each document or repository by hand is too much for a tool only I use (with AI). Opening the Babuni Dev workspace should show at once whether anything is waiting, from the website itself and from every connected repository, and one Publish click should put it live without a second confirmation. All repositories are meant to be on the website.

**Decision:** The Overview runs the checks automatically on open and offers **Publish everything**, which pulls, commits and pushes the snapshot, and publishes the site in one call. This replaces the dry-run-then-confirm rule of the morning's design for this path; the step-by-step Repositories page keeps it. Kept safeguards, because they cost no clicks: the publish only commits a snapshot it wrote itself, so unfinished work in the babuni.dev checkout is never pushed; the publish needs a check from the last hour, removed documents are shown in red before the click, a write that removes more than the check showed is undone, and the checkout must be on a current `main`. GitHub repositories not on the website are listed; adding them is babuni.dev catalog work.

**Alternative not taken:** GitHub webhooks or notifications. The app runs only on the PC and has no public endpoint to receive them; asking GitHub when the page opens gives the same answer.

## 2026-11-10 — Documents from other repositories go through the site build

**Creative direction:** Next on the roadmap is publishing documents from the other 36 connected repositories, following the briefing the babuni.dev repository provided for this admin tool.

**Decision:** Follow the briefing's path: pull into the pinned snapshot, commit and push that one file, then build and publish committed `origin/main` with `publish-site.sh`. `publish-document.sh` stays limited to babuni.dev's own documents. Each step is a dry run first and a confirmed apply second, enforced by the local service rather than the page alone: a write without a matching recent check is refused, removed documents need explicit acceptance, and a site publish is refused if `origin/main` moved since the dry run. The page commits and pushes the snapshot itself instead of handing that step to the terminal, but only that file and only from a clean, current `main`; anything else stops with a reason. One lock covers every publishing operation because both scripts switch the live `current` link.

**Open:** First real write, push and site publish through the page; pruning old releases is a separate roadmap item.

## 2026-11-07 — Avoid secondary setup for the same owner and server

**Creative decision:** The administration tool belongs to one operator and should show a stable project-specific Babuni Dev administrator alongside Morkahja, while being ready for more project workspaces. Entering the portfolio workspace must not require manually creating two separate GitHub and website profiles. The older Morkahja server fallback profile can be retired because the owner administrator now serves the game workspace.

**Implementation:** AI replaced the Babuni Dev setup cards with one derived administrator panel. The site check reuses the already approved pinned SSH identity, while source-control access continues to use the desktop GitHub CLI. Each connection check remains explicitly read-only. A dedicated local maintenance action removes only the superseded Morkahja read-only profile and its keyring credential when invoked; the active administrator connection is never changed.

**Open boundary:** Same VPS does not prove that the SSH account has write permissions to babuni.dev's release directories. Deployment identity, staging, verification, rollback and GitHub writes are still separate engineering work. Neither a new server password nor extra host profiles are assumed necessary for the current read-only checks.


## 2026-11-07 — One continuous Babuni Admin codebase and shared connections

**Creative decision:** Continue developing the existing administration console with two project workspaces, Morkahja and Babuni Dev, while keeping one operator and room for further projects. Pausing game-specific publishing must not roll the application back to an older design or disable established Morkahja tools. Do not create additional feature branches by default when merely changing the active workspace.

**Correction:** The first AI implementation of the Babuni Dev checks was placed on a new branch based on older `main`. Switching the running application to that branch restored a previous Connections UI and hid work already completed for Morkahja, even though the newer code remained available on its original branch. That was an unsuitable development workflow.

**Implementation:** AI integrated the narrowly scoped GitHub and website read-only checks into the existing Morkahja development branch and its one **Connection** page, preserving the advanced application components and capabilities. Real local verification and the eventual content-editor/publishing contracts remain open. The second branch is superseded for active development.


## 2026-11-06 — Store Morkahja images on the operator's computer

**Creative direction:** Loading artwork again when changing tabs makes the Content workspace unusable. All five image categories should be present locally after an initial workspace sync and reused through navigation and restarts. Changed or added files must be refreshed without re-downloading unchanged files.

**Decision:** Use the existing pinned administrator SSH connection for one incremental, read-only scan of fixed WebP directories, with a profile/host-scoped cache in the standard user cache directory. Recheck while the workspace remains open; continue showing cached artwork if the server is offline. The frontend reads those local files, backed by a larger bounded memory layer. Do not require a public domain, a separate SSH connection, extra database rights or a general-purpose filesystem explorer.

**Alternative rejected:** A small per-tab browser-memory cache, because it evicts images during normal navigation and never persists across app restarts. Per-image SSH reads remain insufficient for initial workspace-wide preloading.

**Verification:** Source implemented and synthetic test suite added. Live first-fill duration, volume and update detection remain operator acceptance items.


## 2026-11-06 — One Connection page and automatic administration routing

**Creative decision:** Connection management belongs in one page named **Connection**, not a collection of dropdowns inside the workspaces. With only one operator, the configured server connection must be reused automatically by Overview, Moderation and Content. Multiple independent profiles and repeated selection are unnecessary for the current workflow.

**Implementation:** A shared browser-side resolver uses the unique local Morkahja administrator profile, retaining the already stored keyring password and SSH configuration. The navigation says **Connection**. The page shows the server, database login, credential availability, SSH host check, a deliberately triggered database read check, last successful operation and editable server metadata. Previous profiles are retained for migration in collapsed details rather than deleted. Per-page profile selectors are removed. The top bar no longer represents the old mock status as live when the administrator profile exists. The server's actual PostgreSQL and SSH permissions are unchanged. Babuni Dev publishing still requires implementation and is explicitly not represented as connected.

## 2026-11-06 — One administrator instead of separate read-only and writer accounts

**Decision from the creative:** Babuni Admin is operated by one person. One login/profile should cover Overview, Moderation, and Content. Separate read-only, moderator and content users were explicitly rejected as unnecessary complexity. The earlier split was an AI-proposed safety design, not an approved requirement.

**Implementation:** The `postgres-ssh-moderation` internal adapter remains as a compatibility name but serves as the single Morkahja administrator profile. It shares one profile UUID and database credential with Overview/Content, reuses the approved SSH identity, and permits only fixed moderation and catalog operations. No general SQL command endpoint or unbounded remote filesystem access was introduced. Transactions, backups, host-key pinning and error handling remain protections against accidental errors without additional passwords. The `babuni_admin` PostgreSQL role is prepared but not deployed; server-side tests and remote images remain outstanding.

## 2026-11-06 — Prioritize existing live administration over more dashboard features

**Creative direction:** Restore live Moderation (player details, timeout, ban and unban) and all existing Content browsing/editing (encounters, solutions, expansions, frames and portraits), without feature expansion.

**Architecture decision:** The successful read-only Overview tunnel must remain separate from privileged write operations. The existing Vite/PostgreSQL moderation path and local-file/legacy API content path require explicit connection migration and operator-scoped authorization; their behavior cannot be inferred from the Overview's green status. While this migration is incomplete, read failures must not show fabricated mock accounts or imply a live connection. Privileged production changes require independently verified credentials, resource scope and rollback; development status alone is not authorization to change arbitrary player accounts. The new moderator profile is therefore a distinct connection kind with its own SSH-validated private file, OS-keyring credential, explicit opt-in and a checked minimum database role. Player lists and details can be approved with SELECT-only grants; writes require a separate environment opt-in and specific UPDATE/DELETE grants. This avoids making ban authority a prerequisite for inspecting a player. It is not enabled by configuring the Overview, and server-side grants plus live tests remain pending. Content publishing similarly receives a separate `ssh-content` profile, an operator-owned file and its own opt-in; only five fixed deployed JSON filenames are accessible. One-record updates require the exact catalog revision from the preceding read, a backup, and atomic replacement. Image publishing is deferred until its deployed paths and safety model can be verified independently.

## 2026-11-05 — Approve Batch A deployment and local display

The creative explicitly approved applying the reviewed Batch A SQL after the deployed catalog matched, executed it and supplied successful aggregate and permission checks. The subsequent instruction authorizes the local service/UI integration and documentation.

AI retained the player-preview field contract and added a separate exact `readOnlyMetricFields` list for the four counters, so an existing private configuration does not silently gain another data read. The new query shares the existing read-only transaction, SSH tunnel and manual/initial snapshot triggers. Expected optional-view failures recover via a savepoint; connection failures still fail the request. Missing values and invalid quality signals remain unavailable. Purchases, gems and presence/room definitions remain outside this batch.


## 2026-11-05 — Separate deployed catalog verification from SQL migration

**Creative direction:** Continue the Morkahja Overview statistics milestone step by step, preserving the established read-only and operator-approval boundaries.

**AI implementation:** Add a small standalone Python helper to inspect the game server's deployed `expansiondata.json` in place. Compare its IDs against the candidate aggregate SQL and report only a fixed, non-sensitive summary. Reject duplicate keys, symlink targets, invalid entries and unexpected identifiers. Add disposable tests.

**Decision boundary:** The user's request to proceed with development does not imply that a production PostgreSQL view or new permissions are approved. The migration stays manual and unapplied. The actual deployed JSON path and contents can only be confirmed by the operator on the game host.


## 2026-11-05 — Prepare Batch A without auto-deploying database changes

**Creative direction:** Proceed step by step after defining additional Morkahja Overview statistics.

**AI design and implementation:** Prepare a single owner-controlled, security-barrier PostgreSQL aggregate view as a source artifact with tests for achievement ranks and non-default dice/expansion ownership. Keep the original raw-table restrictions and expose only scalar aggregate counts, with null/unavailable for malformed data. Build the operator-required SQL separately from Babuni Admin's runtime; no production migration executes as a side effect of development.

**Catalog limitation:** The candidate expansion IDs come from the game's client catalog, not from an independent check of the deployed server's `game/expansiondata.json`. The prepared view must not be run in production until the deployed catalog is checked and the creative/operator approves the database change.

**Status:** Source implementation and fixture tests prepared; no production SQL executed, no UI counters enabled. Server-side audit and aggregate verification remain pending.



## 2026-11-05 — Proposed statistics contract, not yet approved for production

**Creative direction:** Define meaningful Morkahja Overview numbers before implementing additional read-only counters.

**AI source review:** The client sends a heartbeat every 45 seconds; the server persists presence timestamps, while sessions may remain valid for eight hours. Automatic room inactivity disengagement is disabled. Achievement ranks, current gem balance, and expansion/dice ownership are stored independently. The expected purchase tables were absent from the operator's audited live public schema.

**Proposal:** Use a 120-second recent-heartbeat window with explicit labels; distinguish recently active room participants, open rooms and active rooms; count achievements with rank at least one, unique players with earned achievements, non-default expansion/dice ownership, and current gem balances. Defer purchases until their actual storage is verified. Compute only scalar aggregates in owner-controlled database views, and display missing or invalid data as unavailable rather than inventing zeroes.

**Status:** The human creative requested metric definitions but has not separately accepted the proposed threshold, labels or detailed inclusion rules. No SQL view, DB grant, app card or live query was implemented. The full source-backed draft and validation gates are in [Morkahja Overview metrics](MORKAHJA_OVERVIEW_METRICS.md).


## 2026-11-05 — Review game statistics before expanding database permissions

**Creative direction:** Expand the useful read-only Morkahja Overview with rooms, achievements, gems, unlocks, transactions and a more accurate online-player count.

**Research by AI:** Inspected Morkahja's PostgreSQL document store, room/presence types, achievement persistence, player-currency fields, dice/expansion unlocks and commerce ledger. These have different meanings: account sessions are not live presence; nonclosed rooms may be stale; gem balances are not purchase revenue; and unlock ownership does not prove a transaction.

**Decision at this stage:** Prepare only a metadata-level read-only audit and candidate metric definitions. Do not grant direct raw-table SELECT rights, create production views or display guessed counts. The actual server schema and final definitions still require operator verification. The existing restricted Overview remains unchanged.


## 2026-11-05 — Reuse the desktop SSH agent, not a new one

**Creative direction:** Avoid manually loading the SSH key each time Babuni Admin is used after desktop login.

**Evidence:** The operator identified an empty agent, loaded the configured key and observed the real read-only Overview recover.

**AI implementation:** Provide a reversible, opt-in XDG Autostart helper that checks the exact approved key fingerprint and delegates a single-key load to the existing SSH agent and graphical askpass. Do not change any server rights, cache the key's passphrase in Babuni Admin, or run a second SSH agent.

**Verification:** Synthetic tests verify configuration and key checks. A real Nobara graphical login test is pending.


## 2026-11-05 — Safe categories for SSH failures

The saved Morkahja profile appeared correctly in my Overview, but the SSH process stopped before opening the temporary database tunnel. With only `SSH_SESSION_FAILED` visible, the cause could not yet be established. AI added fixed categories for common SSH failures and synthetic tests that prevent raw diagnostic text from reaching the browser. The strict connection rules and database permissions remain unchanged; the actual Nobara failure still needs confirmation.


## 2026-11-05 — Shared Babuni brand, separate Morkahja workspace

**Creative direction:** The admin app should identify as **Babuni Admin** in the browser tab and have the same favicon as Babuni Dev, rather than appearing as a standalone Morkahja Admin product.

**Implementation by AI:** Copy the exact existing 64×64 WebP favicon from `babunidev/babuni.dev` into `public/favicon.webp`, reference it in the HTML browser icon and the shared sidebar, and set the HTML title/application name to Babuni Admin. Keep Morkahja's realm-specific labels and workspace identity intact.

**Verification:** The uploaded favicon and Babuni Dev source asset have matching Git blob hashes. Browser tests cover the tab title, accessible shared brand presentation and favicon resource; live desktop appearance should be checked after pulling the change. No privilege or data-access changes.


## 2026-11-04 — Prioritize an automatic view-only Overview without widening database access

**Creative direction:** After the operator verified all preview pages and confirmed the activity counters increase while playing, the next requirement was to restore the selected SSH profile across reloads and load overview/player information together. The read-only overview should be the first Morkahja page, connection configuration should sit below the results, and the existing player-administration screen should be labeled **Moderation**.

**AI implementation:** Preserve only the non-secret local profile UUID across reloads. Automatically request one combined view-only snapshot after a valid previously chosen profile is restored or a new profile is explicitly selected, still enforcing all server-side operator approval on every request and closing the temporary SSH tunnel afterward. Retain a manual refresh and independent pagination. Move the legacy Dashboard to `/dashboard` without deleting it; keep `/read-only` as a compatible URL.

**Data boundary:** Display a session-based online-player estimate, clearly identified as distinct from a realtime presence heartbeat or game room. Achievements, gems, room occupancy, expansion unlocks, dice ownership and transactions remain **proposed**, pending confirmed definitions, schema inspection and separately approved owner-controlled aggregate views. No broader player-data access or server modification was approved as part of the UI convenience work.

**Verification:** The operator already observed all four live preview pages and activity counters changing during gameplay. The new automatic page-load flow and one-request combined snapshots have fixture/browser tests but still require the operator's live Nobara verification.


## 2026-11-04 — Live restricted-view read confirmed

**Operator verification:** Two screenshots of the local Morkahja `/read-only` dashboard show a successful live overview (62 players, 90 avatars, zero active sessions and zero events in the previous 24 hours) and a player preview with the three approved visible fields. The interface reports that the temporary SSH tunnel disconnected after the snapshot. No identity keys or session tokens are visible in these results.

**Boundary:** This establishes real data retrieval through the operator-created restricted views, not independent validation of the zero counts, complete pagination navigation, interruption recovery or authorization to write to the database. The observed personal player details are intentionally excluded from the public record. No code or server permissions were changed as part of this verification checkpoint.


## 2026-11-04 — Restrict dashboard access at the database boundary

**Creative direction:** Continue the live read-only Morkahja dashboard after identifying a missing SELECT permission, without giving the dashboard unrestricted access to player and session tables.

**Database action by the creative:** Executed the proposed transactional creation of two owner-controlled views in `babuni_admin_ro` on the live Ubuntu PostgreSQL server, granted the probe role only view SELECT/USAGE rights, and verified the grants and direct raw-table denial. The first check of the preview view returned a count, not a player-data export.

**AI implementation:** Updated the dedicated read adapter from direct queries on four public tables to fixed SELECTs against `overview` and `player_preview`. Added an explicit denial when the reader unexpectedly has SELECT on underlying sensitive tables and changed the disposable fixture to reflect view-only access. The existing SSH/keyring/private opt-in, pagination and read-only transaction were preserved.

**Verification boundary:** Server-side view creation and role permissions are operator-observed. Automated fixture verification is separate from, and does not replace, end-to-end live dashboard testing. The new adapter does not authorize moderation, direct SQL or publishing.


## 2026-11-04 — Prefer safe error categories over speculative database changes

**Observed behavior:** The newly added read-only dashboard returned `REMOTE_READ_FAILED` during its first real Morkahja request, even though an earlier metadata-only SSH/database health probe had succeeded. The underlying cause is unknown; no live database error code was available in the screenshot.

**AI implementation:** Preserve the fixed SELECT-only adapter and access gates, and map PostgreSQL SQLSTATE errors into narrow, non-sensitive failure codes. A disposable PostgreSQL regression test now checks that a healthy non-write role with insufficient SELECT grants reports a permission problem. No automatic grants, database schema changes, remote debug logs or broader privileges are introduced.

**Verification status:** Only fixture/test evidence is available for the new classifications. A fresh operator test is needed to determine the real server's error category.

## 2026-11-04 — Separate real data reads from the legacy admin adapter

**Creative direction:** After the SSH and PostgreSQL health probe worked on the actual Nobara desktop, the next useful milestone was to display database counts and a paginated player preview, without exposing secrets or changing live records.

**Decision implemented by AI:** Create `/read-only` with dedicated fixed SELECT queries, a bounded three-field player response, manual loading, a separate server-side `ssh:read` capability and a second operator-only configuration approval. Reuse the existing host-key verification, keyring login and short-lived private Unix-socket SSH tunnel. The older `vite/postgresAdmin.ts` query path was deliberately not reused because it can alter expired sessions during player listing. A browser profile selection alone grants no data permissions.

**Verification:** Source, service and disposable PostgreSQL fixtures validate the data-shaping and no-session-mutation behavior. The operator separately observed a successful live SSH/database health check; no live player-data pages were requested by AI. Read-role membership and actual schema compatibility must still be checked before enabling live data reads. [Read contract](MORKAHJA_READ_ONLY_DASHBOARD.md).


## 2026-11-04 — Keep the first remote connection transient and opt-in

**Creative direction:** Continue from the completed local SSH trust check toward Morkahja connectivity, while keeping Babuni Admin local and avoiding unverified live writes.

**AI implementation choice:** Instead of making remote Connect or general SQL available, add a distinct, disabled-by-default `ssh:probe` operation. It needs both process-level and owner-private file approval of the exact host, SSH identity, approved host-key fingerprint and database role. PostgreSQL is queried only through a user-private Unix-domain SSH forward, inside a fixed read-only transaction; effective write privileges cause rejection. The tunnel is closed immediately afterward, with no background reconnect or browser-side credentials.

**Verification:** Disposable OpenSSH command and PostgreSQL 16 fixtures can verify the structure and failure paths, but cannot validate the real Morkahja server's identity, role memberships or network. Live authorization and the full remote read/write lifecycle are still pending. See [probe contract](MORKAHJA_SSH_READONLY_PROBE.md).

## 2026-11-04 — Keep keyring failure tests non-disruptive

**Creative direction:** Verify locked and unavailable Nobara keyring conditions, then review security before allowing live operations.

**AI implementation:** Inspect the default Secret Service collection's `Locked` property through read-only D-Bus calls, and test an unreachable bus address in an isolated child process rather than stopping the user's session bus. A confirmed lock blocks credential writes; providers that cannot expose lock state report `unknown` rather than being assumed unlocked. The review also found and tightened legacy static asset path containment.

**Verification boundary:** Fixture tests and CI can validate denial paths, but do not prove the real login keyring was locked or that live project actions are authorized. The choice to lock the ordinary desktop collection, if needed, remains with the operator because it may interrupt other applications. Live writes remain blocked pending independent authorization and recovery checks.


## 2026-11-04 — Verify SSH trust locally before attempting a tunnel

**Creative direction:** Move from completed Nobara keyring verification into secure, read-only Morkahja connectivity while keeping Babuni Admin on the PC and live editing disabled.

**AI implementation choice:** Add a deliberately narrow, offline `ssh:preflight` capability before enabling SSH sessions. Only a separately maintained, exact known-host entry in a privately owned file is accepted; no new fingerprint is trusted from an unauthenticated network scan. A local OpenSSH lookup is a preliminary configuration check, **not** verified remote identity. Browser-supplied SSH usernames, extra ports, arbitrary command arguments and DB credentials are deferred until a typed per-project transport schema and service-side authorization are implemented.

**Outcome:** A profile can now distinguish an absent/unsafe local host trust record from a candidate pinned record. It still cannot connect or query a server. Disposable tests, not live Morkahja, supply verification evidence.

## 2026-11-04 — Connection control without premature remote authority

**Creative direction:** Complete the local connection-manager workflow, strengthen its security boundary and test it in the browser before enabling access to actual projects.

**AI implementation:** A validated adapter registry denies unimplemented remote operations, and the profile editor cannot reassign credentials to another project. Manual local Connect, Disconnect and Reconnect keep the distinction between a successfully checked folder and a real remote session. A per-run browser session capability and stricter Host/Origin checks protect the development proxy.

**Limits:** A browser session token helps against cross-site requests but does not authenticate arbitrary processes running under the same local account. A real Linux keyring round trip on my Nobara desktop cannot be called verified until its opt-in test is performed. Remote transport permissions remain future work.


## 2026-11-04 — Browser-free credential entry and explicit health states

**Creative direction:** Keep credentials out of browser configuration and improve project connection diagnostics.

**AI implementation choice:** On Nobara Linux, use the user's Secret Service/keyring through `secret-tool`, with a hidden terminal prompt instead of a browser password field. The profile registry remains non-secret. No plaintext fallback or browser retrieval route is provided. This is an implementation approach, not approval of a future remote connection protocol.

**Status semantics:** A directory and its files can be checked without a remote login. A partial read-only inspection is `degraded`, not a connected project session. Unimplemented SSH, GitHub and publishing adapters continue to report `not-configured` even when a credential has been stored. Actual keyring and remote authorization verification remain outstanding.


**Creative decision authority:** Babuni. This document distinguishes agreed direction, implementation and unresolved proposals.

## 2026-11-04 — Babuni Admin remains local, by design

**Creative decision:** Babuni Admin is a personal tool on my own PC. It is not intended to run as a public website, a VPS-hosted console or a remotely exposed administration UI. The PC instead makes protected outbound connections to the separate project authorities.

**Clarification:** Previous Phase 2 language about deploying a production administration backend could imply the wrong architecture. It now means a possible *local privileged service* on the PC, distinct from remote project APIs. A remote project may still need its own scoped endpoint or SSH access, but Babuni Admin itself must not move onto that server.

**Design recorded, not implementation:** AI documented a shared connection manager with project-owned profiles, local credential references, connection states, adapter contracts, error behavior and verification requirements. The precise implementation technologies and credential workflow remain engineering proposals, not accepted implementation details. [Design](LOCAL_CONNECTION_MANAGER.md).

## 2026-11-03 — Safe, local-first hardening

**Direction:** Verify all seven remaining Phase 1 hardening areas with disposable data and reviewable changes rather than interacting with live player records, game files or the VPS.

**AI implementation:** Compatible npm lockfile fixes; PostgreSQL player/session transactions and rollback tests; real browser-form tests against five representative legacy JSON files and a pinned WebP image; same-directory atomic file replacement with backups; loopback/origin checks, request limits and server-only database configuration.

**Why the limits matter:** The new local request guards are defense in depth, not administrator authentication. The legacy samples do not establish compatibility with every game record, and the backup mechanism needs a retention/recovery policy. Twelve moderate tooling advisories remain.

**Verification:** [CI run 41659550592](https://github.com/babunidev/babuni.admin/actions/runs/41659550592) passed all 37 tests, TypeScript/Vite and lint. [Hardening report](PHASE1_HARDENING_2026-11-03.md).

## 2026-11-03 — Audit before dependency upgrades

**Implemented:** A nonmutating npm security audit runs in CI, comparing all locked dependencies with `--omit=dev`, and summarizes affected packages and fix availability. The review is documented in [the dependency audit](DEPENDENCY_AUDIT_2026-11-03.md).

**Reasoning:** npm's 23 affected-package records combine real advisories, inherited parent warnings, development tooling and potentially incompatible automatic upgrades. Vite and React Router warrant priority. Replacing the ESLint/TypeScript-ESLint toolchain with npm-suggested major-version changes without a separate compatibility check was not approved.

**Status:** Audit complete; remediation not attempted. No assumption of production safety follows from the audit. [Evidence](https://github.com/babunidev/babuni.admin/actions/runs/41654264717).

## 2026-11-03 — Phase 1 completion boundary

**Review outcome:** The initial modular restructuring and source/mock verification milestone can be recorded as complete, as evidenced by [CI run 41645348546](https://github.com/babunidev/babuni.admin/actions/runs/41645348546). It is not an authorization to expose the administrator to remote access or real sensitive data.

**Unresolved engineering decisions:** A secure authentication/permission boundary, server-only credentials, transaction and rollback strategy, compatibility with legacy game schemas, and a dependency remediation plan require implementation and verification. The proposed Phase 2 backend architecture is not yet an approved production design.

**Documentation:** [Phase 1 verification report](PHASE1_VERIFICATION.md) separates the tested interface from the still-unverified administrative behaviors.

## 2026-11-03 — Isolated administration fixtures

**Direction:** Verify existing Morkahja operations without touching live accounts, game files or the VPS. AI implemented a localhost HTTP harness around actual development middleware, injected in-memory player services, and temporary JSON/image files.

**Corrections found by tests:** Invalid portrait indices and path-bearing upload filenames were accepted. Explicit `ok: false` results could also be mistaken for successful client mutations. AI added input/payload checks, non-success HTTP statuses for rejected moderation operations, and surfaced mutation errors in the confirmation interface.

**Provisional technical constraints:** Record keys accept alphanumeric, underscore and hyphen characters; numeric frame/portrait indices are bounded; images must be validly framed WebP data under a 5 MiB limit. These are implementation safeguards introduced by AI, not a separate creative approval of a final content schema. Compatibility with actual legacy game files remains unverified.

**Verification:** [CI run 41644848938](https://github.com/babunidev/babuni.admin/actions/runs/41644848938) passed nine integration, nine source and five browser tests, build and lint. Actual SQL transactions, session revocation and rendered content-editor interaction remain outstanding.

## 2026-11-03 — Browser verification in mock mode

**Implemented:** Add a separate Playwright/Chromium browser suite in CI to exercise the rendered application after a production build, with mock data and no database/API configuration. Keep it separate from source-level tests and run on Ubuntu 24.04 for the pinned browser tooling.

**Correction:** The first complete browser run showed the mobile sidebar was merely translated offscreen, leaving its controls exposed as visible to accessibility checks. AI changed the closed state to be hidden at mobile widths while remaining visible on desktop. The assertion was retained.

**Verification:** [CI run 41639215405](https://github.com/babunidev/babuni.admin/actions/runs/41639215405) passed five browser scenarios and all existing checks. Tests do not authorize live moderation, database access, content writes or production deployment.

## 2026-11-03 — Retiring compatibility imports

**Implemented:** Once feature boundaries and navigation were established, AI replaced imports through transitional root re-export files with direct references to `src/features/morkahja/`, `src/shared/` and `src/app/`. The 33 redundant shims were removed, while real shared contracts and the HTTP client remained in place.

**Reason:** A single import path per implementation makes ownership clearer and reduces ambiguity before adding more project workspaces. No product features or permissions changed.

**Verification:** [CI run 41565792784](https://github.com/babunidev/babuni.admin/actions/runs/41565792784) passed build, lint and nine source-level tests, including module resolution checks. Browser rendering and privileged operations remain unverified.

## 2026-11-03 — Workspace switching without premature backend access

**Decided and implemented:** Use URL-derived frontend workspace selection rather than independent persisted selection state. Morkahja keeps its historical paths; Babuni Dev is available at `/babuni-dev` with an informational overview. Separate navigation sets and headers prevent Morkahja's game-server status panel from showing in Babuni Dev.

**Deliberately excluded:** No GitHub editor, publishing button, portfolio data request or new privileged endpoint exists in Babuni Dev yet. Workspace selection is a user-interface concern, not server-enforced authorization. Future project permissions must be implemented and tested independently.

**Verification:** [CI run 41563642755](https://github.com/babunidev/babuni.admin/actions/runs/41563642755) passed build, lint and eight automated tests for commit `4f9b2ed`; browser interaction and live administrative behavior remain unverified.

## 2026-11-03 — Shared shell, project-owned information

**Implemented:** The layout, sidebar, navigation composition and sidebar state are application concerns. Generic tables, notices, badges, headings and formatting are shared resources. Morkahja-specific link definitions and server-health status display remain in its workspace. This avoids making the shared shell import game data directly, except for the explicit current-workspace top-bar composition, and does not pretend project switching exists.

**Migration choice:** Keep transitional re-exports until remaining consumers can be updated and tested. The previous URLs are intentionally unchanged. [Build, lint and six tests passed](https://github.com/babunidev/babuni.admin/actions/runs/41563231632); rendered UI and privileged operations remain unverified.

## 2026-11-03 — Shared administration platform

**Decided:** Expand the existing Morkahja administration tool into Babuni Admin, with project-specific workspaces for Morkahja, Babuni Dev and future needs. Keep the existing React/TypeScript/Vite frontend instead of replacing it with another web framework.

**Alternative considered:** Make a separate admin tool for every project or rewrite the application. Neither is the preferred architectural direction at this stage.

**Implemented in source:** Morkahja-specific pages, components, services, types and utilities are being grouped in `src/features/morkahja/`; Babuni Dev and shared workspace folders exist. The existing Morkahja routes remain in source. Runtime preservation is not yet verified by build or browser tests.

## 2026-11-03 — Portfolio source and publishing model

**Direction established:** GitHub should remain authoritative for repository-backed documentation. The admin should be able to pull, compare, edit and publish individual documents/modules, not force a full website rebuild for ordinary content changes.

**Proposed implementation:** Separate protected content API, server-side GitHub integration, targeted static-asset/page regeneration, atomic publication, history and rollback. Neither the exact API framework nor publishing strategy is a final implementation decision. A successful source commit and a successfully published live revision are distinct events.

## 2026-11-03 — Security and AI boundaries

**Requirement:** Privileged operations must be authenticated, project-scoped and auditable before any remote administration. Secrets cannot be kept in browser-exposed `VITE_` values. An AI agent must use restricted content operations and publication authorization rather than arbitrary shell/file access.

**Open choices:** Backend framework (Fastify was suggested), login/remote-access mechanism, draft approval rules, update triggers, publication storage and content rollback implementation. None is currently production-deployed by this work.

## Verification boundary

The structural GitHub commits and targeted relative-import inspection are evidence of source changes only. Build/lint, regression testing, isolated moderation/content tests and full deployment security review remain outstanding.

## Earlier Morkahja decisions

# Morkahja Admin — implemented choices and unresolved design decisions

**Decision authority:** Babuni.dev. This is an **evidence register**, not an invented design meeting.

## Choices visible in code and Git

| Subject | Implementation evidence | Boundary |
| --- | --- | --- |
| React/TypeScript/Vite workbench | Initial scaffold `097a7be`, `package.json` | An implemented frontend, not a demonstrated deployment |
| Dark, minimal atmospheric UI | `.cursor/rules/morkahja-admin.mdc`, CSS tokens | Original repo instruction, not an AI-origin proposal |
| Focused routes | `src/App.tsx`, May 24 `25c5604` | Dashboard/Players/Content/Settings now; former scaffold sections removed |
| Player moderation / live data adapter | `src/services/adminApi.ts`, `vite/postgresAdmin.ts` | Real DB mutation paths exist; security not certified |
| Mock-first UI development | `mockState.ts`, early README | Sample data separated in UI, with fallback on dev failures |
| Local external game editing | `vite/localContentPlugin.ts`, content service | Writes to another repository/directory, not this repo |
| Proxy support | `vite.config.ts`, `src/services/http.ts` | Server-injected credentials possible; no proof of remote backend role checks |
| Image conversion and encounter relationships | Content editors and `vite/encounterImageNaming.ts` | Implementation observed; no integration tests |
| Player-detail and activity polling | React Query and status panels | Periodic browser refresh, not a server push subscription |

## The May development shift

**May 23** introduced a dark dashboard scaffold with mock data and several generic placeholder sections. **May 24** moved to game-specific content editing and connection paths. The current commit tree supports this shift, and the README calls the app a local administration console. We have **no recovered conversation** detailing which alternatives Babuni.dev approved, so avoid attributing undocumented deliberation.

## Source-identified technical risks (not proven incidents)

- Browser-exposure risk of `VITE_DATABASE_URL` / `VITE_API_TOKEN`.
- Dev middleware can write PostgreSQL moderation state and files without its own independent operator-auth layer.
- Local content upload filenames and request size/path controls need hardening.
- `VITE_USE_LOCAL_CONTENT=false` changes UI mode, not middleware registration.
- Mock player-list fallback can provide sample records during live DB errors.
- Nonlocal portrait/content fetch paths may not align with configured URLs.
- Moderation session revocation and database writes are not visibly wrapped in an all-or-nothing transaction.
- Separate game content modifications are not revisioned by this repository.
- Repo has no visible standalone automated test command.

These are static-review concerns and must not be described as confirmed breaches or resolved defects.

## Open creator decisions (no approval in this pass)

1. Local-only operator console permanently, or remote operation after a dedicated secured backend?
2. Default read-only mode and an explicit enable-action step for real moderation/content writes?
3. Moderation rationale logging, staff accountability, appeal and audit retention?
4. Should content management save drafts in Git before writing directly to game data?
5. When backend is unavailable, explicit offline screen or labeled automatic mock fallback?
6. Which first security and deployment changes should be prioritized for an actual production workflow?

Record human accept/reject/postpone decisions, implementation commits and test proof when they happen.

## 2026-10-31 — Canonical repository publication direction

Babuni.dev chose the actual project repository as the intended public source, replacing the earlier documentation-only edition once review and anonymous access succeed. Retain the current public edition during the transition. License and third-party redistribution decisions remain explicit author decisions.

## 2026-10-31 — Author decision — open project development

**Babuni.dev direction and decision:** Babuni.dev decided to make the actual project repository publicly accessible, with the intention of developing it openly rather than maintaining a separate public documentation edition. GitHub visibility was verified as public on 31 October 2026.

Public source availability does not authorize public deployment of privileged development endpoints, production credentials or live player records.

**AI contribution:** Recorded the author’s decision and clarification, separately from observed GitHub visibility. Earlier documentation-only publication was considered and is superseded as the intended long-term source. No root license was selected by this update; public visibility, open-source reuse permissions, media rights and production readiness are separate matters. No runtime testing or behavior change is claimed.
