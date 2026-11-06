# Babuni Admin — Development Roadmap

## Morkahja remote image delivery — 2026-11-06

- [x] Implement an authenticated image read through the existing administrator SSH configuration, no domain/DNS setup.
- [x] Restrict requests to five mapped game asset directories and bounded WebP basenames.
- [x] Wire lazy images to encounters, solutions, expansions, frames, portraits and detail views.
- [ ] Verify actual image display on Nobara using the live server; fix any naming/path discrepancies found.
- [ ] Implement remote image upload, revision checks, backup and atomic replacement separately.


## Connection consolidation — 2026-11-06

- [x] One **Connection** page and navigation entry for the owner-managed server configuration.
- [x] Automatic sharing of the existing Morkahja administrator profile in Overview, Moderation and Content; no repeated dropdowns.
- [x] View stored credential availability, SSH host check, one-shot database read check, server address and last successful connection in Connection.
- [x] Preserve older profiles without automatically deleting credentials or changing PostgreSQL roles.
- [x] Verify actual Moderation account list on the operator's desktop: 62 players displayed using the administrator account.
- [ ] Verify automatic Overview and Content live loads on Nobara after updating.
- [ ] Verify a disposable test content edit and its backup and game-side reload.
- [ ] Wire babuni.dev website administration and deployment to the same operator's server setup; this is not yet implemented.
- [ ] Complete remote image management.
- [ ] Remove unused legacy APIs and profile kinds after live workflows are confirmed.

## 2026-11-06 — One owner-managed administrator connection (revised direction)

**Creative decision:** Reject separate read-only, Moderation and Content user accounts. Babuni Admin is a single-operator tool; one administrator profile must run Overview, player management and the five content catalogs with one stored database password and the already approved SSH identity. This replaces the earlier multi-profile proposal below without erasing its development history.

- [x] Share the `postgres-ssh-moderation` administrator profile and browser selection across Overview, Moderation and Content.
- [x] Replace the proposed extra read-only moderator login with `scripts/morkahja-admin-role.sql`, granting only the existing tool's needed player and Overview view operations; no PostgreSQL superuser or arbitrary SQL API.
- [x] Remove the separate moderation write opt-in; the administrator credential itself permits fixed timeout, ban and unban transactions.
- [x] Reuse administrator SSH identity for fixed deployed content JSON operations, with revision checks and backups.
- [ ] Operator-run the admin role setup, store its password once in the Linux keyring, activate the one profile and verify real Overview, Moderation and Content on Nobara.
- [ ] Finish remote image uploads and actual game-visible editing; verify backup/rollback and connection cleanup.
- [ ] Pass full CI for this revision and merge only after live acceptance.

## 2026-11-06 — Restore existing live Moderation and Content workflows

**Creative direction:** Reconnect existing player details, timeout/ban/unban and the five content collections (encounters, solutions, expansions, frames, portraits) to the live Morkahja backend. Improve the existing workflows; no extra statistics or new panels.

- [x] Audit old Moderation and Content routing against the working read-only Overview. The legacy moderation adapter uses a separate Vite/PostgreSQL connection; Content uses local game files or an older remote API. Neither inherits authority from the restricted Overview SSH probe.
- [x] Remove the legacy PostgreSQL failure fallback to sample players or mock player details; show each page's actual configured source and its unverified privileged-connection status. Content read failures now show an explicit error instead of appearing to be an empty catalog.
- [x] Implement a separate source-level `postgres-ssh-moderation` profile and fixed player list, detail, timeout, ban and unban requests through the private local service. The moderator has a separate config/credential; the reader remains unchanged. Synthetic operation and rollback fixtures are added. **Not yet activated or tested against the live server.**
- [x] Separate read-only player listing/details from mutation authority: the moderator profile can now use a distinct SELECT-only role, with a second environment gate for all writes. Prepare operator-review SQL `scripts/morkahja-moderation-read-role.sql` (not applied).
- [x] Correct player/detail source isolation, missing-player/error states, sample-data labeling, current progression levels and session-based presence wording; add synthetic account/detail coverage.
- [x] Prepare a metadata-only deployed-schema preflight (`scripts/morkahja-moderation-schema-preflight.sql`) and a local config helper (`scripts/prepare-morkahja-moderation-config.py`) that reuses verified Overview metadata without copying secrets, with regression tests.
- [ ] Operator-run the schema preflight, approve and provision the SELECT-only role, configure the independent keyring credential and verify the real list/side panel on Nobara. No production credentials or roles were created in this branch.
- [ ] Later, separately review narrow UPDATE/DELETE grants and enable `BABUNI_MORKAHJA_MODERATION_WRITES=enabled` for timeout/ban/unban.
- [x] Implement a separately gated `ssh-content` profile and source-level read/write transport for the five JSON catalogs in the deployed `/var/www/morkahja/game` tree; content editor tabs can select the profile. Remote images and live visual verification remain pending.
- [x] Implement revision-checked, serialized, backed-up atomic JSON writes for encounters, solutions, expansions, frames and portraits through a fixed-path one-shot SSH worker. **Not enabled or executed on the live server.**
- [ ] Implement secured live image reads and uploads for encounter/solution imagery, frame artwork and portraits; existing local upload paths must not be mistaken for remote publication.
- [ ] Verify failure recovery, transaction rollback, tunnel cleanup and source/permission gating in isolated fixtures and on designated development data.
- [ ] Complete CI, controlled live acceptance tests and merge through a reviewed pull request.

## 2026-11-05 — Reconcile operator-verified desktop and Overview behavior

- [x] Record operator-reported post-login `SSH_LOGIN_IDENTITY_READY` and matching ED25519 agent fingerprint; do not treat terminal output as independent observation of the logout sequence.
- [x] Reconcile the already verified player list pagination (20/20/20/2) and gameplay-responsive active-session/event counters with previously stale roadmap tasks.
- [x] Record the recovered remembered-profile combined Overview and player preview shown in the user's Nobara screenshot.
- [ ] Verify controlled SSH read interruptions/cleanup and future login or browser-reload edge cases independently.


## 2026-11-05 — Batch A aggregate-view preparation (achievements and ownership)

- [x] Prepare an **operator-gated, not automatically applied** `babuni_admin_ro.progression_ownership_totals` SQL view definition for achievement unlocks, unique earning players, non-default dice ownership, and catalog-qualified expansion ownership.
- [x] Add disposable PostgreSQL fixture tests for counts, duplicate IDs, progress-only achievements, invalid ownership data, owner-only base-table access, and the probe role's view-only access. All five CI jobs passed on implementation run [42047478095](https://github.com/babunidev/babuni.admin/actions/runs/42047478095).
- [x] Add an operator-run, read-only deployed-catalog verifier with a pinned ID list and synthetic tests for mismatched IDs, malformed catalog documents and symbolic links. This only prepares the live check.
- [x] Operator verified the running backend catalog: IDs 1001–1004, inactive 1002, CATALOG_MATCH.
- [x] Operator explicitly approved and applied the reviewed SQL from 8d42562; COMMIT confirmed.
- [x] Operator verified totals 75/52/10/6, five zero quality counters, expected owner/view SELECT and raw player/achievement table and column denial.
- [x] Implement the fixed aggregate adapter, independent metric-field approval and four Overview cards with unavailable handling.
- [x] Verify current-change unit, PostgreSQL recovery, browser, build and lint checks in CI. The first run exposed an outdated four-field legacy test expectation; commit `6e479a8` updated it to require all eight fields and null optional metrics without approval. All five jobs passed in [CI run 42079244053](https://github.com/babunidev/babuni.admin/actions/runs/42079244053).
- [x] Operator-provided Nobara screenshot (2026-11-06) verifies the four live cards (75 achievements, 52 earning players, 10 dice unlocks, 6 expansion unlocks), original overview counters, player preview, and a successful refresh status indicating SSH disconnected after snapshot. Unavailable/error branches and connection cleanup under failure are covered by fixtures but not separately exercised live.

[Prepared SQL](scripts/morkahja-batch-a-aggregate-views.sql) · [Candidate contract](docs/MORKAHJA_OVERVIEW_METRICS.md).

## 2026-11-05 — Discover new Morkahja Overview metrics safely

- [x] Inspect the actual Morkahja game source for room, player-presence, achievement, gem, expansion/dice and commerce data definitions.
- [x] Distinguish online presence from valid login sessions, nonclosed encounter rooms from current activity, gem balances from transactions, and unlock ownership from recorded purchases.
- [x] Prepare a fixed, read-only PostgreSQL metadata audit for the relevant live tables and existing restricted views; do not fetch player or payment records.
- [x] Operator ran `scripts/morkahja-overview-metadata.sql` on the Ubuntu Morkahja PostgreSQL database as `postgres`. The read-only transaction returned six audited `public` tables and two restricted `babuni_admin_ro` views, with the expected view-only SELECT privileges for `babuni_admin_probe`; `purchases` and `processed_stripe_events` were not present in the audited `public` schema. Column types for the returned views and selected game tables were confirmed. Direct and inherited role membership, privileges beyond SELECT, and the columns of `sessions` were **not** established by this audit.
- [x] Operator completed an additional live, read-only role check: `babuni_admin_probe` can log in but has no superuser, CREATEDB, CREATEROLE, replication or BYPASSRLS attributes; `pg_has_role(..., 'MEMBER')` returned no memberships; CREATE privileges are false for database `morkahja` and schemas `public` and `babuni_admin_ro`. This verifies the audited role attributes and membership only, not every possible permission.
- [x] Prepare a precise, source-backed proposal for new statistics: recently online (proposed 120-second heartbeat window), open versus active rooms, unlocked achievements, current gems, non-default expansion/dice ownership and deferred purchases. Record unverified JSONB and commerce assumptions; creative approval is still pending.
- [ ] Approve final aggregate definitions and implement new owner-controlled `babuni_admin_ro` views with SELECT-only rights for the existing probe role.
- [ ] Test disposable fixtures and operator-observed live counters before adding UI cards. No new counter or production view is created in this discovery step.

[Candidate metric definitions and safe audit](docs/MORKAHJA_OVERVIEW_METRICS.md).


## 2026-11-05 — Opt-in SSH identity at desktop login

- [x] Confirm the failed live read was caused by an empty desktop SSH agent. The operator loaded the approved key and recovered the Overview.
- [x] Implement a removable per-user XDG login helper that recognizes only the approved public-key fingerprint, uses the existing agent and graphical askpass, and stores no passphrases.
- [x] Add synthetic tests for installation, idempotence, key reuse, no GUI, unsafe private config and uninstall.
- [x] Operator-reported post-login readiness check on Nobara: `SSH_LOGIN_IDENTITY_READY` and `ssh-add -l` showed the expected ED25519 fingerprint `SHA256:2Anm1mb+Uyn2mFh84KYpCENDjGW0PnSkwG2joBOLaes`. This followed the requested fresh-login procedure; the terminal output alone cannot independently prove a logout occurred or that no manual `ssh-add` ran beforehand.
- [x] Inspect Morkahja game source and prepare candidate definitions plus a metadata-only SQL audit for future aggregate statistics. Live schema confirmation and view implementation remain pending in the discovery milestone above.

[Desktop login setup](docs/SSH_AGENT_DESKTOP_LOGIN.md).


## 2026-11-05 — Diagnose automatic Morkahja SSH failures safely

- [x] Record operator screenshot: remembered Morkahja connection is selected but the initial combined read shows `SSH_SESSION_FAILED`; the SSH child exited before a temporary PostgreSQL forward was available. The cause is not yet identified.
- [x] Capture only a bounded amount of SSH child stderr in service memory, classify familiar errors into fixed categories, and never log or send raw stderr, identity paths, usernames or SSH host details to the browser.
- [x] Preserve strict host-key checking, pinned identity, the temporary Unix socket, the read-only SQL boundary and tunnel cleanup; add regression tests with a synthetic failing SSH child.
- [x] Operator confirmed `SSH_AUTH_REJECTED` with an empty agent, loaded the key manually and recovered the live Overview.


## 2026-11-04 — Remembered Morkahja Overview and combined refresh

- [x] Record operator verification of all four live player-preview pages and successful return to page one.
- [x] Record operator-observed active-session and recent-event counts increasing while playing the game; this verifies the counters respond to gameplay without equating sessions with rooms.
- [x] Make view-only Overview the Morkahja landing route and navigation label, preserve the old dashboard at `/dashboard`, and label the existing `/players` administration screen **Moderation**.
- [x] Remember the selected Morkahja profile UUID locally, validate it against current saved profiles on reload and automatically request a new authorized snapshot; store no credentials, session tokens or player data.
- [x] Combine overview and player preview into one fixed, bounded request and one temporary SSH/READ ONLY transaction; keep a manual refresh button and independent player-page navigation.
- [x] Move connection controls below the two data panels; add **Players online*** as a session-based estimate explicitly distinct from actual room or live-presence data.
- [x] Operator screenshot on Nobara after restarting the updated local service showed the previously selected connection and both Overview and player-preview data populated together. The snapshot displayed 62 players, 90 avatars, 1 active session and 5 recent events. This confirms the recovered combined view with remembered selection; it does not prove every future browser reload or failure mode.
- [ ] Design additional restricted aggregates only after confirming schemas and metric meanings: multiplayer rooms, achievements, currency/gems, unlocks/dice and economic transactions. Do not infer purchases from ownership or treat sessions as rooms.


## 2026-11-04 — First successful live read-only Morkahja snapshots

- [x] Verify the updated `/read-only` overview through the actual configured SSH/PostgreSQL connection on Nobara. Operator screenshots report 62 players, 90 avatars, 0 active sessions and 0 game events in the prior 24 hours.
- [x] Verify a real player preview displays approved fields (display name, avatar count and last-played time) without internal IDs, identity keys or session tokens in the visible UI.
- [x] Observe success states and UI confirmation that the temporary SSH tunnel closes after each snapshot.
- [x] Operator navigated the live player-preview list across all four pages (20/20/20/2 rows) and back to page one.
- [x] Operator played Morkahja and observed active-session and recent-event counts increase, confirming that the reported statistics respond to gameplay (not that a session equals an occupied room).
- [ ] Exercise controlled read interruption/error recovery and confirm a failed request never leaves an SSH tunnel or stale success state.


## 2026-11-04 — Align application reads with restricted live PostgreSQL views

- [x] Operator created `babuni_admin_ro.overview` and `babuni_admin_ro.player_preview` on the live Morkahja database, committed the transaction, and verified SELECT access for `babuni_admin_probe` with raw `public.players` and `public.sessions` SELECT denied.
- [x] Change the dashboard read adapter to use only these fixed views. Preserve 20-row bounded pagination, the approved three-field output, read-only transactions and SSH tunnel teardown.
- [x] Reject unexpected direct SELECT privileges on the four underlying tables, independently of the existing write-privilege health gate.
- [x] Extend disposable PostgreSQL fixture tests to mirror view access and verify denial without view grants, raw-table privilege rejection, pagination and no session mutation.
- [x] Verify dashboard overview and first player preview end-to-end on the real Morkahja server using the operator's Nobara screenshots; see successful live snapshot checkpoint above.

[View and access contract](docs/MORKAHJA_READ_ONLY_DASHBOARD.md).

## 2026-11-04 — Diagnose first live Morkahja dashboard read failure

- [x] Record operator screenshot: `/read-only` shows `REMOTE_READ_FAILED` when requesting data after successful SSH/database health checking. The actual PostgreSQL error is **not yet known**.
- [x] Classify trusted PostgreSQL SQLSTATE errors without exposing raw error messages, internal schema details or credentials. UI distinguishes missing SELECT grants, missing tables/columns, invalid data, timeouts, login and connection failures.
- [x] Extend the disposable PostgreSQL fixture to reproduce a metadata-health-passing reader that lacks SELECT permission on game tables.
- [x] Re-run the live dashboard and identify `DB_READ_PERMISSION_DENIED`; the operator subsequently created narrowly scoped owner-controlled views and verified the read role's access without granting raw table access.

## 2026-11-04 — Morkahja read-only dashboard

- [x] Implement a separate, manual Morkahja dashboard for database counts and 20-row player preview pages.
- [x] Add fixed SELECT-only queries, repeated role verification, limited response fields and a shared single-flight SSH tunnel lifecycle.
- [x] Require a second operator-only data-read opt-in and exact `displayName`, `avatarCount`, `lastPlayedAt` field list; browser requests cannot select arbitrary data or queries.
- [x] Verify the new read-only snapshot and visible approved fields on the actual Morkahja server after fixture tests and the restricted-view adapter update. No live player data was read during AI implementation; the operator subsequently verified successful reads. [Data contract](docs/MORKAHJA_READ_ONLY_DASHBOARD.md).

**Observed on the operator's Nobara PC:** The Morkahja SSH/database health probe returned `REMOTE_DB_HEALTHY_READ_ONLY` at 20:59 on 2026-11-04. This validates the configured health path, not general data-reading or write authority.

## 2026-11-04 — SSH client compatibility fix

- [x] Remove unsupported client option `PermitTTY` while retaining `-T`.
- [x] Validate the production argument builder with real OpenSSH in offline `-G` mode.
- [x] Verify the corrected SSH/database health probe on the target Nobara desktop; the operator reported `REMOTE_DB_HEALTHY_READ_ONLY` after the OpenSSH correction.

**Creative direction:** Babuni  
**Purpose:** One private administration application with separate workspaces for Morkahja, Babuni Dev, and future projects.  
**Status (updated 2026-11-05):** Phase 1 code and fixture verification is complete; the local-only Phase 2 architecture and shared connection manager are documented. Local profiles, keyring, and the Morkahja-only SSH/PostgreSQL health and restricted-view read adapter are implemented, with operator-reported live verification. Other outbound adapters, live writes, GitHub and publishing remain planned. The creative has verified the unlocked Nobara desktop keyring with a synthetic credential round trip; a deliberately unreachable D-Bus session bus was verified in an isolated child process on Nobara; the real locked default keyring and subsequent unlock recovery were also verified by operator-reported inspection output on Nobara.

## Initial restructuring completed (verification scope detailed below)

- [x] Preserve the Morkahja Dashboard, Players, Content and Settings routes during the initial restructuring.
- [x] Create `src/features/morkahja/`, `src/features/babuni-dev/`, `src/app/`, and `src/shared/` boundaries.
- [x] Move Morkahja pages, domain components, services, types and utilities under its feature folder.
- [x] Initially maintain transitional re-export files during feature extraction; these were retired after all imports were migrated.
- [x] Perform targeted relative-import checks for the migrated files.
- [x] Record the migration and known limits in `docs/MULTI_PROJECT_ARCHITECTURE.md`.

GitHub Actions has verified `npm ci`, TypeScript/Vite build, ESLint and nine regression tests following shim removal. [Run 41565792784](https://github.com/babunidev/babuni.admin/actions/runs/41565792784). Five rendered-browser smoke scenarios now pass on Chromium, in addition to nine source-level tests. [CI run 41639215405](https://github.com/babunidev/babuni.admin/actions/runs/41639215405). Nine isolated HTTP/fixture integration tests now cover mock-admin operations, record writes, image uploads and negative cases. [CI run 41644848938](https://github.com/babunidev/babuni.admin/actions/runs/41644848938). Real PostgreSQL SQL, full content-editor interactions and production writes remain unverified.

## Phase 1 — Finish modular architecture and verify existing behavior

- [x] Run `npm ci` and `npm run build` against the corrected `main` revision in GitHub Actions; fix four TypeScript imports caused by the folder migration. [Successful run](https://github.com/babunidev/babuni.admin/actions/runs/41551602985).
- [x] Run `npm run lint` and resolve reported lint errors. GitHub Actions [run 41552146789](https://github.com/babunidev/babuni.admin/actions/runs/41552146789) passed `npm ci`, `npm run build` and `npm run lint` on commit `72a3169`.
- [x] Add initial automated regression tests for player ordering, encounter drafts/details, in-memory moderation and route declarations. Five tests passed in [CI run 41552579859](https://github.com/babunidev/babuni.admin/actions/runs/41552579859).
- [x] Add an initial Chromium browser smoke suite for rendered UI, workspace selection/history, legacy Morkahja routes, mock player table and mobile sidebar. [5/5 passed in CI](https://github.com/babunidev/babuni.admin/actions/runs/41639215405).
- [x] Add isolated Morkahja HTTP tests: player inspection, timeout/ban/unban with injected database operations; encounter/solution/expansion/frame/portrait saves on temporary game JSON; WebP upload validation; simulated database read/write failures, missing files and rejected acknowledgements. [9/9 integration tests passed](https://github.com/babunidev/babuni.admin/actions/runs/41644848938).
- [x] Verify PostgreSQL queries, session-revocation and moderation rollback against a disposable PostgreSQL 16 CI service; exercise all five rendered content editor forms and image conversion against isolated assets. [CI](https://github.com/babunidev/babuni.admin/actions/runs/41659550592).
- [x] Separate the active application layout, sidebar, UI store, and navigation composition into `src/app/`; move generic controls and formatting to `src/shared/`, and Morkahja navigation/status to its feature folder. [CI verification](https://github.com/babunidev/babuni.admin/actions/runs/41563231632).
- [x] Add URL-driven workspace selection, separate Morkahja/Babuni Dev navigation, and a non-operational Babuni Dev overview. Keep existing Morkahja URLs and status bar intact. [CI: 8 tests, build, lint passed](https://github.com/babunidev/babuni.admin/actions/runs/41563642755).
- [ ] Add real workspace authorization/permissions and Babuni Dev content operations after the secure backend is implemented.
- [x] Replace historical shim imports with direct feature/shared paths and remove all 33 obsolete re-export files. CI verified TypeScript/Vite build, lint and nine tests, including an import-integrity regression. [Run 41565792784](https://github.com/babunidev/babuni.admin/actions/runs/41565792784).
- [x] Keep Babuni Dev content operations inactive: the new overview is explicitly a placeholder and cannot edit or publish.
- [x] Complete the final Phase 1 source/CI verification review and record residual risks in the roadmap, changelog, development journal and architecture. See [Phase 1 verification report](docs/PHASE1_VERIFICATION.md) and [latest passing CI](https://github.com/babunidev/babuni.admin/actions/runs/41645348546).

- [x] Audit the 23 npm affected package records, compare full and production-scoped results, and document prioritized remediation. [Audit report](docs/DEPENDENCY_AUDIT_2026-11-03.md), [CI evidence](https://github.com/babunidev/babuni.admin/actions/runs/41654264717).
- [x] Apply semver-compatible lockfile security fixes and rerun the full suite: 23 → 12 affected packages (all 12 moderate), zero under `--omit=dev`. [CI](https://github.com/babunidev/babuni.admin/actions/runs/41659550592).
- [ ] Resolve the 12 remaining moderate lint/tooling advisories in a separate compatibility review; audit report linked below.

### Final Phase 1 review — verified versus outstanding

- [x] Confirm retained routes, workspace navigation, mock views, service error handling and isolated content saves via the automated test suites; **not** a blanket guarantee that all legacy functions remain intact.
- [x] Review architecture and document specific security, data-integrity, dependency and test-coverage risks.
- [x] Update roadmap, changelog and development journal with an evidence-linked review.
- [x] Verify actual PostgreSQL queries, atomic moderation/session changes and all five rendered content-editor forms against disposable fixtures. [CI](https://github.com/babunidev/babuni.admin/actions/runs/41659550592).
- [ ] Close security and dependency release blockers before any remote/admin production access.

Full findings: [docs/PHASE1_VERIFICATION.md](docs/PHASE1_VERIFICATION.md).

Additional scope and remaining production blockers: [Phase 1 hardening report](docs/PHASE1_HARDENING_2026-11-03.md).

## Phase 2 — Local connection infrastructure (permanent local-only architecture)

- [x] Document Babuni Admin as a single-user application running only on the creative's own PC, with secure **outbound** project connections and no hosted/public administration interface. [Concept](CONCEPT.md) · [Architecture](docs/ARCHITECTURE.md).
- [x] Design a shared local connection manager: profile contracts, non-browser credential references, status lifecycle, scoped adapter boundaries, UI and test acceptance criteria. **Design only, not implementation.** [Design](docs/LOCAL_CONNECTION_MANAGER.md).
- [x] Introduce a standalone loopback-only local Node service with an ephemeral service token; use Vite as the developer UI/proxy rather than as the connection-profile authority. This is the first local process boundary, not a full privilege/isolation review.
- [x] Add local, non-secret connection profile creation/listing/removal with disabled-by-default status and isolated persistence tests.
- [x] Add rendered Chromium Connections tests with disposable profiles, local lifecycle and forged-origin/session denial. Verified only when CI passes.
- [x] Remove browser-side reads of `VITE_DATABASE_URL` and `VITE_API_TOKEN`; use server-only `DATABASE_URL` in the current development adapter. This does not implement a credential vault.
- [x] Add profile editing for name/target, immutable project/adapter/credential identity, and invalidation of previous checks when the target changes.
- [x] Add a validated server-owned adapter/capability registry. Only local-file read-only operations are active; remote permissions remain denied.
- [x] Add Linux Secret Service credential storage through a hidden terminal prompt, outside browser config, logs and Git. Verified with a disposable fake keyring and a separately reported successful real Nobara desktop round trip.
- [x] Add a read-only local directory test with verified available/error status; non-local adapters explicitly remain unconfigured.
- [x] Add manual local-file Connect, Disconnect and Reconnect through read-only probes without background retries.
- [x] Strengthen local Vite proxy Host/Origin/Fetch Metadata checks and add a per-run browser session capability while keeping the service key server-side.
- [x] Add Morkahja-only offline SSH host-key trust preflight: dedicated operator-managed known_hosts file, exact host matching, OpenSSH parser check, invalid/unsafe store denial and no outbound connection; verified only by fixture CI tests. [Design](docs/LOCAL_CONNECTION_MANAGER.md).
- [x] Implement a **disabled-by-default**, operator-gated Morkahja SSH/PostgreSQL health probe: exact host and approved fingerprint, private identity file, keyring password, hardened OpenSSH invocation, temporary loopback tunnel, fixed read-only PostgreSQL metadata/privilege query and tunnel cleanup. Fixture tests verify code paths; **no live Morkahja host has been contacted**. [Configuration and safety](docs/MORKAHJA_SSH_READONLY_PROBE.md).
- [x] Operator configured the approved SSH host identity and dedicated database read-only role and demonstrated a successful live health check followed by view-only data retrieval on Nobara. Independent hardening of future write-capable adapters remains open.
- [ ] Implement GitHub remote transport and future authenticated project-scoped content workflows; neither is enabled.
- [x] Operator verified the live protected SSH/PostgreSQL health probe and subsequently the restricted-view dashboard using the dedicated `babuni_admin_probe` role. The observed real Morkahja data access remained SELECT-only; this does not authorize moderation, arbitrary SQL or remote writes.
- [x] Add read-only inspection of five known Morkahja JSON datasets through the local service; file counts and status only, using isolated fixtures.
- [x] Add local service/keyring health, per-profile timestamps and structured error codes; distinguish complete, degraded and failed content inspection without claiming remote connectivity.
- [x] Correct the portrait JSON key to `Avatar` and add regression coverage for its real-shape fixture.
- [x] Add `npm run keyring:verify`, an opt-in synthetic real-keyring store/compare/delete check.
- [x] Verify the actual Nobara desktop's unlocked keyring: the creative ran `npm run keyring:verify` and reported successful synthetic store, retrieve and cleanup on 2026-11-04.
- [x] Add read-only D-Bus default-collection lock detection, explicit `locked` status and fail-closed credential operations, with disposable busctl/secret-tool tests.
- [x] Add `npm run keyring:inspect` and an isolated unavailable-bus check, `npm run keyring:verify-unavailable`, without locking or modifying the desktop's existing credentials.
- [x] Verify default-collection inspection on the actual Nobara desktop: `unlocked`, keyring `available`, nonexistent profile `missing`; operator-reported output on 2026-11-04.
- [x] Verify unavailable Secret Service bus on Nobara using `npm run keyring:verify-unavailable` with an unreachable D-Bus address isolated to a child process; operator-reported success on 2026-11-04. This is **not** a test of locking the normal login keyring or stopping the desktop's actual bus.
- [x] Verify real locked default-collection behavior on Nobara: `npm run keyring:inspect` returned `locked` for the collection, keyring health and nonexistent test-profile credential (operator-reported, 2026-11-04).
- [x] Verify unlock recovery: after unlocking KDE Wallet, inspection returned `unlocked`, `available` and `missing` again (operator-reported, 2026-11-04). This verifies status recovery, not a post-unlock credential store/retrieve test.
- [ ] Authorize and connect live content editing to project-scoped files or scoped remote transport.
- [ ] Connect Babuni Dev to approved GitHub repositories and later a controlled publishing transport.
- [x] Audit current connection and legacy static middleware boundaries; add project-scope/denied-operation tests and prevent local asset symlink escapes. [Review](docs/PHASE2_SECURITY_REVIEW_2026-11-04.md).
- [ ] Complete operator authentication/authorization, project-scoped live operations, action attribution, recoverable writes and remaining security release gates. Browser origin/session guards alone are insufficient.
- [ ] Verify loopback-only binding, outbound endpoint restrictions and failure cases with fixtures.
- [ ] Fix Vite config import-extension warnings as an independent maintenance task.

**Scope:** Remote project servers may require authentication or limited APIs, but **Babuni Admin itself remains on the PC**. A separate lightweight local TypeScript/Node service is a proposed design, not a chosen framework or implemented service.

## Phase 3 — Babuni Dev content manager

- [ ] Browse project tiles and their modules in an administration workspace.
- [ ] Map every editable document to an allowed public GitHub repository and file path.
- [ ] Provide Markdown editing, preview, drafts, images, galleries and metadata management.
- [ ] Pull one document/module from GitHub; display source, deployed and proposed revisions.
- [ ] Compare edits, detect conflicts and commit reviewed changes back to GitHub.
- [ ] Build targeted publishing for a changed document and associated module index/preview.
- [ ] Keep separately generated readable HTML pages, metadata, search outputs and caches synchronized.
- [ ] Support publication history, rollback and atomic updates to avoid mixed revisions.
- [ ] Extend to module creation, reordering and additional media only after source/schema contracts are validated.

**First content-publishing milestone:** Update `docs/DEVLOG.md` in GitHub and publish just its dependent assets/pages to the running site, without a full Astro rebuild. This is a target, not existing functionality.

## Phase 4 — AI access, automation and operations

- [ ] Provide narrowly scoped agent actions to read, propose, validate and (when authorized) publish changes.
- [ ] Enforce the same source-of-truth and access rules for agents and human operators.
- [ ] Detect relevant GitHub revisions without silently overwriting a draft or live revision.
- [ ] Provide project-level status, history, connections and error feedback.
- [ ] Add new administration workspaces without coupling their data permissions.

## Existing Morkahja work to preserve and harden

- [x] Verify player inspection, timeout, ban, unban and HTTP error responses with an injected in-memory database fixture (not PostgreSQL). [CI](https://github.com/babunidev/babuni.admin/actions/runs/41644848938).
- [x] Verify actual PostgreSQL adapter against disposable PostgreSQL, including session revocation and trigger-injected rollback. [CI](https://github.com/babunidev/babuni.admin/actions/runs/41659550592).
- [x] Verify server-side create/update routes for encounters, solutions, expansions, portraits and frames, plus WebP upload paths, using temporary filesystem fixtures. [CI](https://github.com/babunidev/babuni.admin/actions/runs/41644848938).
- [x] Exercise all five rendered editor forms and browser WebP conversion/decoding against isolated legacy fixtures. [CI](https://github.com/babunidev/babuni.admin/actions/runs/41659550592).
- [ ] Resolve local and remote content API inconsistencies before remote use.
- [ ] Ensure mock fallbacks cannot be mistaken for successful live writes.
- [ ] Audit file uploads, database transactions, authorization and recovery procedures.

## Release gate

No live project writes through the planned connection manager before successful build, lint, fixture regression tests, local-service security review and non-production end-to-end verification. The application is permanently local-only; there is no hosted administration rollout. No production database operation or website deployment was performed as part of the 2026-11-03 documentation planning.

## Historical roadmap

The original Morkahja-specific safety, backend and publishing audit remains in Git history. Its outstanding security findings are carried forward above; earlier observations must not be treated as implemented fixes.
# Morkahja Admin — verification roadmap and open engineering work

**Creator:** Babuni.dev  
**Status:** Implementation baseline observed; priorities are **proposals pending creator approval**, not accomplished changes.

## As committed

- React / TypeScript / Vite interface with **Dashboard**, **Players**, **Content** and **Settings**.
- Polling of online/activity data at approximately 5-second intervals.
- Mock mode, VPS admin API clients, dev proxy, local PostgreSQL middleware and local game-JSON/image middleware.
- Player detail panels, timeout/ban/unban actions, content CRUD-like upsert flows and image upload support.
- Dev server bound to 127.0.0.1 by default, port 5180.
- Source files and lockfile committed. No tests or running service verified by this review.

## P0 — credential safety and access boundaries (not implemented)

1. **Move database URL out of `VITE_`-prefixed client-visible variables.** Present code references `VITE_DATABASE_URL` in frontend imports and dev configuration. Test a dev bundle/browser network state to ensure credentials **cannot** be read by a browser; replace with genuinely server-only config if approved.
2. Verify no administrator secret is stored in `VITE_API_TOKEN` or any other browser-exposed variable; use authenticated server-side proxy/auth with least privileges.
3. Add explicit authentication/authorization to any development or deployed moderation endpoint and enforce it on the server. Confirm the actual DB account cannot perform unrelated privileged operations.
4. Review the **always-registered local-content middleware**; `VITE_USE_LOCAL_CONTENT=false` hides UI usage, not the endpoints. Define a privileged local-only access policy before trusting the toggle.
5. Review file upload filename/path handling, file type, size, base64 decoding, request-body limits, and directory confinement; require safe filename validation and consistent error handling before exposing any write routes.
6. Verify the Vite server and tunnels remain bound to loopback, and review CSRF/cross-origin exposure even on local hosts.
7. Add an audited confirmation/authorization flow and server-side actor logging for timeout, ban and unban; validate duration/reason constraints. DB writes and session revocation are currently real when a live DB is selected.
8. Test data recovery and integrity: run content editing only against versioned backups/fixtures until write atomicity, schema validation and rollback are confirmed.

## P1 — functional/integration checks

9. Run `npm install`, `npm run build`, `npm run lint` in a controlled environment and capture actual results. No test command is present; add focused tests before relying on it.
10. Test mock-only startup, mock/player-detail presentation, and clear connection-state differences.
11. Test local DB mode with **non-sensitive fixtures**; session freshness, online state, moderation records, revoked sessions and malformed data.
12. Test VPS API via configured server-side proxy with a non-production test account; verify route availability, authentication, errors and authorization.
13. Test the content routes for all five JSON types, image upload/update, missing files, duplicate keys, invalid IDs, unexpected schema changes and failure recovery.
14. Address **nonlocal content route consistency:** `fetchPortraits` requests `/game/portraits` without `.json`, and the JSON helper does not incorporate the configured `VITE_GAME_DATA_URL`. Distinguish confirmed bug from current source-risk until reproduced.
15. Confirm Content edits propagate to the intended MorkahjaWebApp content, not merely this admin repo; record which separate repository and file revision changed.
16. Confirm 5-second polling does not overload the backend and retries/error banners cannot silently imply real data when mocks are active.

## P2 — usability and accessibility

17. Test responsive layout, keyboard navigation, focus management in editor/ban dialogs, screen-reader labels, high-contrast text, and large player/content lists.
18. Validate encounter/solution relationships and required schema fields against game runtime, not just TypeScript structural types.
19. Create permission-safe examples/screenshots with **synthetic players and sanitized content** for portfolio documentation.

## Creator decisions still open

- Should the application remain **strictly local**, or support a remote browser session after a full security redesign?
- Should a connected test mode be read-only by default, with explicit unlock for irreversible mutations?
- What moderation audit/appeal process does Babuni.dev want?
- How should content changes be versioned, reviewed and reverted across the admin tool and MorkahjaWebApp?
- Should mock fallback automatically substitute for database failures, or require an explicit mode switch?
- Which current P0 issues should be handled before any production connection?

No code changes, infrastructure changes or tests were made during the Oct 26 documentation-only pass.

## Audit #38 — documentation-only checkpoint (2026-10-28)

- [x] Recheck core documentation against the current package and Vite configuration.
- [x] Retain the comprehensive October 26 security and design audit instead of rewriting it.
- [ ] Execute `npm run build` and `npm run lint` in a safe development checkout; record actual output, dependency versions and commit.
- [ ] Test privileged middleware boundaries, browser-exposed settings and authentication with fixtures only, before any trusted connection.
- [ ] Verify local game-data edits against an isolated copy, then decide on backup/versioning and rollback rules before production use.
- [ ] Resolve the creator's still-open decisions on local-only operation, mock fallback, permissions and operator audit trails.

The current `package.json` does not define a dedicated `test` script. Nothing in this checkpoint is an approval to connect to or modify real player data.
