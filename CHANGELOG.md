# Babuni Admin — Changelog
## 2026-11-10 — One-click publishing on the Babuni Dev Overview

- The Babuni Dev Overview now opens with a publish panel (`src/features/babuni-dev/components/PublishPanel.tsx`). It checks automatically: the live release from `https://www.babuni.dev/release.txt`, commits on babuni.dev `origin/main` that are not live, a waiting snapshot, uncommitted files in the checkout, document changes in all connected repositories (cached for ten minutes; **Check again** refreshes), and GitHub repositories that are not on the website.
- **Publish everything** runs pull, snapshot commit and push, and site publish in one call, with no second confirmation. Removed documents are listed in red before the click.
- New local-service routes: `GET /portfolio/site-status`, `POST /portfolio/changes`, `POST /portfolio/publish-all`. Publish-all still needs the page's all-repository check from the last hour, stops before writing on a wrong branch or stale checkout, and restores the snapshot if the write would remove more documents than the check showed (`CHANGED_SINCE_CHECK`).
- Mapped `publish-site.sh` exit code 5 (`VERIFY_FAILED`, automatic switch back to the previous release), which the babuni.dev checkout is adding.
- Eight new tests (17 in `tests/portfolio-site.test.mjs`); suite 103/103, build and lint pass.
- Verified read-only on Nobara: live release `20261110-004601-fd89891-site` read and matched to `origin/main`; 37 repositories checked (babuni.admin had document changes); six GitHub repositories listed as not on the website. No publish was run.

## 2026-11-10 — Agent instructions brought up to date

- `AGENTS.md`: replaced the outdated `BABUNI_MORKAHJA_MODERATION_WRITES` requirement with the current single-administrator behavior (the switch was removed on 2026-11-06; the per-operation role check remains) and named `scripts/morkahja-admin-role.sql` in place of the removed read-role script.
- `AGENTS.md`: recorded the decision that finished work is documented, committed and pushed to `main` without asking; live server and website changes still need confirmation.

## 2026-11-10 — Babuni Dev Repositories page

- Added `local-service/portfolioSite.mjs` and six session-protected routes for documents from the other connected repositories: list sources and checkout state, pull check, pull write, commit-and-push of the snapshot file, site dry run and site publish. They run babuni.dev's `scripts/pull-repository.mjs` and `scripts/publish-site.sh` with fixed arguments; targets are limited to the connected repositories in the babuni.dev connection map.
- Writes require a preceding check: a snapshot write needs a check of the same target and explicit acceptance when documents would be removed; a site publish needs a dry run of the same `origin/main` commit. The commit step stages nothing else, refuses other branches, a stale checkout and unpushed commits that touch other files.
- Added `local-service/publishLock.mjs`; single-document publishing now shares this lock with the new operations.
- Added the Repositories page and navigation entry under Babuni Dev, with three confirmed steps (pull, commit and push, publish).
- Added `tests/portfolio-site.test.mjs` (10 tests: parsers, allowlist, check-before-write gates, commit isolation against a local bare remote, exit-code mapping, shared lock). Suite 96/96; `npm run build` and `npm run lint` pass.
- Replaced the Babuni Dev Overview placeholder ("content manager is planned") with links to Connection, Documents and Repositories and a short list of what is not available yet; the top bar no longer says "Planned features". Browser smoke tests updated for three navigation links (not run locally; Playwright is not installed here).
- Consolidated `ROADMAP.md`: one current open-work list at the top; items found done or superseded in the dated sections are marked with their evidence.
- Ignored Python `__pycache__/` directories.
- Verified read-only against the real checkout on Nobara (AI-run, through the module): source listing (37 repositories), checkout state, pull checks (`--all` and one repository; no document changes at the time) and one site dry run (built `fd89891`, 1045 files, live release `20261110-004601-fd89891-site`, nothing to publish). No snapshot write, push or site publish has been run through the page yet.

## 2026-11-09 — Babuni Dev Documents page

- Added `local-service/portfolioDocuments.mjs` and three session-protected routes (`GET /portfolio/documents`, `POST /portfolio/document-check`, `POST /portfolio/document-publish`). Requests accept only the standard babuni.dev document names; the browser cannot supply a command, a path outside that list or a shell string. One run at a time, bounded output, timeouts, and failure categories that expose no raw error text.
- Added the Documents page and navigation entry under Babuni Dev. A document is checked against the live site first, and publishing needs an explicit confirmation.
- Publishing uses the babuni.dev repository's `scripts/publish-document.sh`, which needs the deployment key loaded in the desktop SSH agent and stops with a clear message otherwise.
- Added four tests for the route module; relaxed one outdated regression assertion that pinned the Babuni Dev navigation to a single link. Suite: 86/86.
- Verified: dry-run checks through the routes, and one real publication through the page (release `20261109-123701-c67d005-doc`). Only babuni.dev documents are supported; editing and other repositories are not implemented.

## 2026-11-08 — Repository consolidation and login-script fix

- Merged pull requests #28 and #29 into `main` (merge commits `af597ab` and `18ce036`, 2026-11-07). Closed #8, #9 and #30 as superseded and deleted 31 remote branches after checking each against its pull request.
- Fixed `scripts/ssh-agent-login.py`: the session's `SSH_ASKPASS` helper is now tried before the KDE default. The login test no longer depends on the desktop it runs on.
- Babuni Dev connection check verified on the Nobara desktop (GitHub, HTTPS, SSH release staging).

## 2026-11-07 — Fix portfolio SSH check blocked by Morkahja switch

- Corrected the Babuni Dev administrator check after a real Nobara screenshot showed GitHub and HTTPS passing but server SSH returning `REMOTE_MODERATION_DISABLED`.
- Babuni Dev now validates the approved VPS SSH host pin directly, then uses the pre-existing `babunideploy` key on standard SSH port 22. It no longer requires Morkahja moderation to be enabled and does not alter the game's moderation authorization.
- Improved the UI to explain connection results in readable language, while retaining detailed codes in the local service response.
- Added isolated regression coverage; the real website SSH check still requires operator verification.

## 2026-11-07 — Consolidate Babuni Dev into one administrator connection

- Replaced the two per-target Babuni Dev setup cards with one preconfigured Babuni Dev administrator view on the existing **Connection** screen.
- Added a manual read-only check of the canonical website's deployed directory using the existing approved VPS host pin and pre-existing `babunideploy` SSH key with a fixed remote Python inspector. The probe also checks whether the deployment release directory is writable, without writing anything. No arbitrary remote filesystem access or upload is exposed.
- Kept GitHub CLI and public HTTPS checks as separate observable statuses; successful checks never claim write or publishing permission.
- Added a one-time, capability-restricted retirement path for the superseded Morkahja Overview profile, removing its saved keyring entry only on the user's explicit action.
- Added targeted tests for the integrated portfolio check. No production file, service, GitHub document or SSH credential was changed.


## 2026-11-07 — Babuni Dev checks in the existing administrator console

- Added two manual Babuni Dev connection cards to the previously established single **Connection** screen, leaving Morkahja's own connection and workspace UI in place.
- Added fixed outbound read-only probes through the existing local service: authenticated GitHub CLI repository metadata and canonical HTTPS website response.
- Preserved Morkahja connection kinds, SSH/content/moderation capabilities and all existing game-side routes.
- Added narrow scope/denial regression coverage and adjusted existing service capability checks. Website publishing, new admin accounts, production file writes and actual desktop verification are not included.


## 2026-11-06 — Persistent workspace artwork cache

- Replaced the 48-item, memory-only gallery cache with profile-scoped local disk storage in `~/.cache/babuni-admin/morkahja-images` (or `$XDG_CACHE_HOME/babuni-admin/morkahja-images`).
- A single outbound, host-pinned SSH session checks the five approved WebP asset directories and streams new or changed files to the cache. Unchanged files are not transferred; removed filenames are pruned after a complete sync.
- Every Morkahja workspace entry starts a cache check; changes are checked again every ten minutes while that workspace is open. Existing local art remains available when the SSH server cannot be reached.
- Content previews now read files from the local service instead of opening SSH per image. A separate bounded browser memory layer makes repeated tab switches immediate, with visible sync progress and automatic refresh of changed images.
- Added cache integrity/bounds, offline and persistence fixtures. Initial real-server bulk sync and performance require operator verification.


## 2026-11-06 — Read live Morkahja images through existing administrator SSH

- Added an authenticated, bounded `content-image` request to the local service. It uses the same configured and pinned SSH identity as Content catalogs, not a new public domain or another password.
- Whitelisted only WebP filenames in five fixed deployed game image folders; no arbitrary browser paths, writes or shell arguments. Remote files are checked for size, type and symlinks before returning bounded image bytes.
- Integrated lazy image loading into encounters, solutions, expansions, frames, portraits and content detail views with two concurrent transfers and a bounded in-memory image cache.
- Added tests covering request validation, worker invocation, fixed paths and the session-protected endpoint. Live asset delivery is pending Nobara acceptance.


## 2026-11-06 — Fix unified Content config import

- Corrected missing `readMorkahjaModerationConfig` import in `local-service/morkahjaContentConfig.mjs`. Before this fix, a real Content request using the administrator profile threw a reference error that the runner reported as `REMOTE_CONTENT_FAILED`; Overview and Moderation were unaffected.
- Added a regression assertion for the import. This is a source fix; live remote Content access needs a new operator test.


## 2026-11-06 — One Connection interface

- Renamed the global navigation entry and page from Connections to **Connection**.
- Reused the configured owner administrator identity automatically in Morkahja Overview, Moderation and Content; removed their separate profile dropdowns.
- Displayed live-server metadata, keyring credential status, last activity, SSH host checking, database read checking and server metadata editing in Connection.
- Kept older profiles in collapsed migration details without deleting credentials or server configuration.
- Prevented the legacy mock API indicator from appearing as a live connection status when an administrator profile is configured.
- Stopped Content queries from loading the local/static source before connection lookup resolves.
- Live Moderation player listing was verified by the creative (62 accounts). Other live writes and website publishing remain unverified.

## 2026-11-06 — Unify Morkahja administration under one operator identity

- Consolidated Overview, Moderation and Content onto one selectable administrator profile and one stored database credential, sharing the existing pinned SSH identity.
- Replaced the proposed additional read-only moderator login with a reviewable `babuni_admin` role for the tool's existing player reads, moderation changes and Overview views.
- Removed the extra ban/timeout write-enable environment switch. Fixed SQL operations, moderation transactions, session revocation, source errors and content-file backup/revision checks remain.
- The original Overview reader remains supported as a migration fallback. Remote images and live write verification remain unfinished. No server role, account or file change was performed by the AI.

## 2026-11-06 — Make legacy moderation/content connections explicit

- Removed silent sample-player and mock-player-detail fallbacks after direct PostgreSQL read failures; errors now remain errors.
- Displayed the configured source and live-authorization limitation on existing Moderation and Content pages; content fetch failures now show an explicit error instead of an apparently empty catalog.
- Added regression checks for legacy source fallback and source disclosure.
- Added a separately opted-in SSH/PostgreSQL moderation connection profile, fixed list/detail and atomic timeout/ban/unban service operations, a profile selector, and failure/cleanup tests. No existing restricted Overview privilege is widened.
- Separated SELECT-only player inspection from separately gated moderation writes; prepared unapplied SQL for a dedicated read-role. Fixed player list progression levels, source-qualified player details cache, error versus missing-player handling and sample/online-estimate labeling; added full detail and privacy fixtures.
- Added deployed-schema metadata preflight and a Nobara helper for creating a separate private moderation config from the already verified Overview metadata without copying database secrets; documented the operator-run role setup and live test commands.
- Added a separately gated SSH content profile, fixed remote JSON catalog reads, per-profile revision checks and atomic backed-up catalog writes for the five existing Content editors. Image upload through this profile remains unavailable.
- No production moderation/content credentials, remote filesystem permissions, database migration or game-data mutation were applied in this change; activation and live verification are pending.

## 2026-11-05 — Connect Batch A aggregates to the local Overview

- Added four fixed aggregate fields and Overview cards for achievements and non-default dice/expansion ownership.
- Added separate exact `readOnlyMetricFields` approval while preserving existing player-field authorization, SSH lifecycle and no polling.
- Validate nonnegative safe-integer counts and quality signals; missing or invalid aggregates remain unavailable. Recover expected optional-view SQL failures inside the same read-only snapshot.
- Extended raw-table boundary rejection to `player_achievements`.
- Added unit, PostgreSQL recovery and browser display fixtures. Updated a legacy PostgreSQL Overview assertion for four additional nullable fields; all five CI jobs passed in [run 42079244053](https://github.com/babunidev/babuni.admin/actions/runs/42079244053). Operator-provided Nobara screenshot on 2026-11-06 confirms live rendering of all four new cards at 75/52/10/6 alongside original counters and player preview; live error-state exercises remain pending.
- Recorded the operator's separately approved and committed live view, catalog match, aggregate results and permission checks.


## 2026-11-05 — Prepare the deployed expansion catalog audit

- Added a standalone, operator-run read-only verifier for the live game-server `expansiondata.json`, comparing canonical IDs to the previously prepared Batch A SQL allowlist.
- Added synthetic tests for expected and unexpected IDs, invalid catalog contents, duplicate JSON keys and symbolic-link rejection.
- Documented an operator-only live verification procedure and the separate production SQL approval gate.
- No remote access, production schema change, grant, game-data modification or new Overview counter was performed.


## 2026-11-05 — Prepare Batch A owner-controlled aggregate SQL

- Added an operator-gated SQL view definition for earned achievements, unique players with achievements, non-default dice skins and expansion ownership.
- Added a database-owner boundary with view-only SELECT grant to `babuni_admin_probe`, leaving the six audited raw game tables inaccessible.
- Added invalid ownership diagnostics so malformed JSON or unknown catalog values produce unavailable aggregates rather than plausible but incorrect zeros.
- Added offline SQL-contract and isolated PostgreSQL fixture tests; included the new PostgreSQL test in `npm run test:postgres`.
- The initial implementation CI passed all five jobs, including disposable PostgreSQL fixture and browser regression checks ([run 42047478095](https://github.com/babunidev/babuni.admin/actions/runs/42047478095)); deployed expansion catalog confirmation and separate explicit authorization remain required before any production DDL. No live database operation, dashboard change or new runtime adapter was performed.



## 2026-11-05 — Propose source-backed Overview statistics

- Documented an exact candidate contract for presence, rooms, achievements, gems, expansion/dice unlock ownership and deferred purchase reporting.
- Cross-checked the proposed two-minute presence window against the game's 45-second client heartbeat and eight-hour session duration; separated open rooms from verifiably active rooms.
- Added data-validation requirements, explicit unavailable states, and a staged implementation/test sequence with protected aggregate-only database views.
- Preserved creative approval and live JSONB/aggregate validation as pending gates. Documentation-only; no runtime code, new SQL views, database access or counters were changed.


## 2026-11-05 — Record live restricted-role verification

- Recorded the operator's second read-only PostgreSQL audit: the dedicated `babuni_admin_probe` login has no elevated PostgreSQL role attributes, no role memberships and no CREATE privileges on the checked database or schemas.
- Updated the statistics discovery document and roadmap with the evidence and clearly limited verification scope.
- Kept metric definitions, aggregate-only views and dashboard counters unimplemented.
- Documentation-only change; no production database configuration, application code or privileges changed.


## 2026-11-05 — Record the live Morkahja metadata audit

- Documented the operator's successful, read-only metadata audit of live Morkahja PostgreSQL objects.
- Confirmed six audited `public` tables and two restricted `babuni_admin_ro` views, all owned by `morkahjadbadmin`, with `babuni_admin_probe` SELECT confined to the views for the checked objects.
- Recorded verified column types and that `purchases` and `processed_stripe_events` were not found in the audited `public` schema.
- Kept role memberships, additional privileges, JSONB content shape, commerce location and metric semantics unverified; updated the roadmap only for the completed metadata-audit checkpoint.
- Documentation-only change; no project code, live database, grants, game records or new counters were modified.


## 2026-11-05 — Roadmap and operator-verification reconciliation

- Updated previously stale roadmap tasks for live player-preview pagination, gameplay-responsive session/event counters and the recovered remembered-profile combined Overview.
- Recorded operator-reported SSH-agent readiness with the approved public-key fingerprint after the requested fresh-login check, preserving the distinction between command output and independently observed login behavior.
- Clarified that controlled SSH read interruption, live database metadata auditing and new aggregate metrics remain pending.
- Documentation only; no runtime code, database, server configuration or test suite was changed.


## 2026-11-05 — Read-only Morkahja metrics discovery

- Reviewed the actual Morkahja game data sources for rooms, player presence, achievements, gem balances, dice/expansion unlocks and purchase records.
- Added a source-backed candidate-metric contract and a fixed, metadata-only PostgreSQL audit script to validate the live schema before implementing counters.
- Added a regression test checking that the audit contains only read-only catalog inspection and no raw game-data retrieval or mutations.
- No live database tables, permissions, views, remote connections or dashboard counters were changed.


## 2026-11-05 — Optional SSH identity loading at desktop login

- Added operator-installable `scripts/ssh-agent-login.py` with install, run, status and uninstall modes.
- The helper reads the existing secure identity configuration, detects the approved fingerprint in the current desktop agent, and uses graphical SSH askpass if loading is needed.
- Added isolated home-directory tests; no key or passphrase is copied, no second agent or server connection is created, and no autostart is enabled by default.
- Next-login verification on the real Nobara desktop remains pending.


## 2026-11-05 — Safe diagnostics for early SSH tunnel exits

- Replaced the opaque `SSH_SESSION_FAILED` where possible with fixed failure categories for host-key verification, SSH identity availability, public-key authentication, forwarding policy, unsupported SSH options and network reachability. Unknown failures retain the generic code.
- Captured at most 4096 characters of child SSH stderr in the local-service process only; never return, persist or print the raw diagnostic, key paths or credentials.
- Added UI explanations and synthetic SSH failure tests, without changing the SSH trust model, actual connection arguments, read-only database queries, or server configuration.
- The operator's live root cause remains unverified; no live server was contacted in this change.


## 2026-11-05 — Consistent Babuni Admin branding

- Replaced the outdated `Morkahja Admin` browser-tab title with **Babuni Admin** and set the HTML application name accordingly.
- Reused the exact `public/favicon.webp` asset from the Babuni Dev website for the browser-tab icon and the shared sidebar brand.
- Added browser regression checks for the title, favicon file and shared logo across Morkahja and Babuni Dev workspaces. No database or permissions changes.


## 2026-11-04 — Remembered Morkahja Overview and one-request refresh

- Moved the read-only Overview to the Morkahja home route and navigation label; renamed the existing Players administration navigation/header to Moderation. The older dashboard remains available at `/dashboard`, and `/read-only` is retained.
- Saved only the chosen local SSH profile ID; automatically load fresh overview and player-preview data on profile selection and subsequent page reload. No player information, secrets or credentials are stored in browser storage.
- Added `read-dashboard`: a fixed, bounded combined view-only read inside a single PostgreSQL READ ONLY transaction and a short-lived approved SSH tunnel. The manual Refresh button reloads both panels; player pagination remains independent.
- Put connection settings below overview and player list; added a clearly marked session-based online-player estimate without claiming that sessions are game rooms.
- Extended disposable database, single-flight SSH and browser denial/persistence tests. Additional counters (rooms, achievements, gems and unlock transactions) remain unimplemented until an owner-controlled aggregate-view contract is approved.


## 2026-11-04 — Live Morkahja read-only verification recorded

- Recorded operator screenshot evidence of successful live `/read-only` overview and player-preview requests through the restricted PostgreSQL views: 62 players, 90 avatars, 0 active sessions and 0 events in the preceding 24 hours.
- Confirmed that the UI displays only the approved player-preview fields and reports that its temporary SSH tunnel is disconnected after the snapshot.
- Marked pagination navigation, activity-count reconciliation and failure-recovery scenarios as still requiring real-system verification. This is a documentation-only checkpoint; no application code, live schema, database privileges or game records were changed.


## 2026-11-04 — Read Morkahja through restricted database views

- Updated `local-service/morkahjaReadOnly.mjs` to SELECT from `babuni_admin_ro.overview` and `babuni_admin_ro.player_preview`, matching the operator-created live PostgreSQL views.
- Preserved fixed 20-player pagination, limited response fields, read-only transaction and private short-lived SSH tunnel.
- Enforced the required view privileges and rejected unexpected direct SELECT on underlying player, avatar, session or event tables.
- Reworked disposable PostgreSQL tests to verify view-only access, missing grants, rejected raw-table access and no player/session mutations.
- No database DDL was executed through GitHub or by AI. The operator reported successful live view creation; end-to-end application verification remains pending.


## 2026-11-04 — Safer Morkahja read-only failure diagnostics

- Classified PostgreSQL read failures by SQLSTATE without returning server messages or query details to the browser.
- Added helpful status text for missing SELECT grants, schema mismatches, malformed data, timeouts, login and connection failures; unknown causes remain generic.
- Extended disposable PostgreSQL tests to reproduce a role that passes metadata health checks yet lacks SELECT grants.
- No changes to remote database permissions, query scope, write capabilities or SSH lifecycle.

## 2026-11-04 — Morkahja read-only dashboard

- Added a separate `/read-only` Morkahja page with manually requested database totals, 24-hour activity count and 20-row paginated player preview.
- Implemented fixed SELECT-only PostgreSQL queries in a separate adapter, strictly limited to display name, avatar count and last-played time; no player IDs, session secrets, identity keys, arbitrary SQL or mutation actions are returned.
- Added Morkahja-only `ssh:read` endpoints, guarded by a second operator-owned opt-in and exact field allowlist; each read reuses the keyring and private temporary SSH tunnel, closing it afterward.
- Added service, configuration, pagination, field-redaction and disposable PostgreSQL regression tests. The operator-reported SSH/database **health probe** worked on Nobara; live player-data reads remain unverified.


## 2026-11-04 — Fix OpenSSH tunnel startup

- Removed the server-only `PermitTTY=no` option from the SSH client command; existing `-T` continues to disable terminal allocation.
- Extracted the argument builder and added an offline real-OpenSSH `ssh -G` regression test for the exact production arguments. The test reproduces the original parser failure and passes after correction.
- The corrected application health probe remains unverified on the target desktop.

## 2026-11-04 — Operator-gated SSH/PostgreSQL read-only health probe

- Added a separate Morkahja-only `ssh:probe` endpoint, inert unless both a private on-disk operator configuration and service environment explicitly enable it.
- Required exact approved server host-key SHA256 fingerprint, private SSH identity and unlocked Linux Secret Service credentials, with no SSH private-key or database-password exposure in the browser.
- Added strict noninteractive SSH startup, a short-lived user-private Unix socket forwarding to the server's loopback PostgreSQL port, fixed read-only role/privilege inspection and cleanup after every probe.
- Added disposable SSH and PostgreSQL tests; no live Morkahja connection, general SQL, persistent SSH Connect or write capability was enabled.

## 2026-11-04 — Offline Morkahja SSH host-key preflight

- Added a read-only, **offline-only** `ssh:preflight` capability for Morkahja PostgreSQL/SSH profiles.
- Require a dedicated operator-managed known-hosts file, exact hostname match, OpenSSH lookup and non-symlink/private file checks before showing a candidate pinned-key status.
- Added tests with disposable generated SSH keys and protected local service routes. No SSH transport, tunnel, PostgreSQL access or write permission was enabled.


## 2026-11-04 — Keyring lock diagnostics and local asset containment

- Added read-only default Secret Service collection lock detection; a confirmed locked state blocks storing, clearing and verifying credentials.
- Added CLI commands to inspect real keyring state without reading credentials and to simulate D-Bus unavailability in a disposable child process.
- Added project-capability denial tests and regression coverage for legacy local request guards.
- Hardened opt-in legacy Morkahja static file routes against symlink/realpath escapes and cross-site requests, with disposable asset tests.
- Documented unresolved authentication, remote permission, live write and recovery gates; **no production access authorized**.


- Tightened opt-in legacy content/moderation HTTP guards to require an exact HTTP origin for mutations and reject same-site cross-origin requests; fixture requests now supply an explicit origin.

## 2026-11-04 — Local connection lifecycle and UI session hardening

- Added non-secret profile editing with immutable project, adapter and credential identity.
- Introduced a server-owned, project-scoped adapter allowlist: only Morkahja local files have active read-only operations.
- Added manual Connect, Disconnect and Reconnect for local folders without open write handles, remote tunnels or background retries.
- Added an ephemeral in-memory UI session capability and Host/Origin/Fetch Metadata checks for the Vite proxy; service key stays server-side.
- Added an opt-in synthetic Linux keyring verification command, expanded fixture tests and a Chromium Connections workflow.
- No real desktop keyring, remote adapter or live Morkahja mutation was exercised during implementation.


## 2026-11-04 — Keyring credential boundary and local connection diagnostics

- Added terminal-only Linux Secret Service (`secret-tool`) profile credential storage, status and clearing without exposing secrets in browser configuration, command arguments or connection JSON.
- Added authenticated loopback service/keyring health, per-profile timestamps and stable directory error codes.
- Added complete/degraded/failed JSON inspection states and specific missing/unsafe/invalid file reasons; corrected portrait inspection to use the `Avatar` property.
- Added isolated keyring command and local-service fixture tests. No real keyring, remote adapter or live project connection was exercised.


## 2026-11-04 — Read-only Morkahja content inspection

- Added fixed-file metadata inspection for the five legacy Morkahja JSON datasets in the local connection service.
- Added an Inspect control and counts/status display in the Connections screen.
- Added disposable file-fixture tests, including missing-file and symlink rejection.
- No live Morkahja files, remote systems or write operations were used in verification.

## 2026-11-04 — Standalone local profile service

- Added separate loopback Node process and per-run service key, launched with Vite through `npm run dev`.
- Moved live connection-profile CRUD to that service through a server-side authenticated Vite proxy.
- Added read-only local-directory checks; other adapters remain explicitly unavailable.
- Added isolated process/API tests for authentication, origin denial, local-directory success/failure and non-operational remote adapters.
- No actual remote credentials, remote project connections or game changes.

## 2026-11-04 — Local connection profile foundation

- Implemented a reusable local registry for non-secret, disabled-by-default per-project connection profiles.
- Added a shared Connections page and local-only Vite development adapter to add/list/remove profiles.
- Stored non-secret profiles under the PC user's private XDG configuration directory with restricted file permissions; rejected credential-like targets and unexpected fields.
- Added isolated persistence/validation tests. No SSH tunnel, remote API, live credential management or project connection was implemented.

## 2026-11-04 — Local-only architecture and connection manager design

- Recorded the confirmed permanent deployment model: Babuni Admin runs on the operator's PC; it is not published or hosted on the VPS.
- Revised the Phase 2 roadmap and architecture to define a planned local privileged connection service with outbound project connections.
- Added [shared local connection manager design](docs/LOCAL_CONNECTION_MANAGER.md): profile metadata, credential boundary, adapters, status lifecycle, interaction model and acceptance tests.
- Updated concept, decisions, development journal, README and agent rules to keep this requirement consistent.
- Documentation and architecture only; no live credentials, connections, runtime components or project data were changed.

## 2026-11-03 — Phase 1 security and data-integrity hardening

- Updated the lockfile with compatible npm security fixes on a review branch; audit findings dropped from 23 to 12 moderate-only, with zero under `--omit=dev`. No forced major-version downgrade/upgrade was applied; 12 tooling advisories remain.
- Moved PostgreSQL connection string to server-only `DATABASE_URL`; removed browser API-token forwarding; required explicit opt-ins for local DB, game content middleware and development proxy. Local endpoints reject cross-origin/nonloopback requests and oversized bodies.
- Wrapped timeout/ban moderation and session deletion in transactions with account row locking. Added four real disposable PostgreSQL tests, including a deliberate session-delete failure to verify rollback.
- Replaced direct game file overwrites with same-directory temporary writes, fsync, versioned backups and an explicit restoration helper. Expanded middleware tests to cover recovery, rejection and permissions.
- Added five rendered content-editor tests and compact legacy game JSON snapshots based on the Morkahja repository. Chromium validated PNG-to-WebP upload and decoding of an original pinned Morkahja WebP file.
- [CI run 41659550592](https://github.com/babunidev/babuni.admin/actions/runs/41659550592) passed build, lint, nine source tests, fourteen integration tests, four PostgreSQL tests and ten browser tests (37 tests total).
- The work remains a development hardening change, not production authentication or a complete backup/rollback policy. [Details](docs/PHASE1_HARDENING_2026-11-03.md).

## 2026-11-03 — Dependency security audit (no upgrades)

- Added a GitHub Actions audit job for `npm audit --json` and `npm audit --omit=dev --json`, with a nonmutating package-level summary for review.
- Reproduced 23 affected packages (8 high, 14 moderate, 1 low), including six classified under `--omit=dev` (5 high, 1 moderate). Identified affected direct dependencies, transitive packages, fix indications and applicability limits.
- Prioritized Vite's development-server exposure and React Router upgrades, with separate handling for the interconnected ESLint/TypeScript-ESLint toolchain.
- Added [full dependency audit](docs/DEPENDENCY_AUDIT_2026-11-03.md). **No package upgrade or lockfile change** was made; remediation remains open.
- Evidence: [GitHub Actions run 41654264717](https://github.com/babunidev/babuni.admin/actions/runs/41654264717).

## 2026-11-03 — Final Phase 1 verification review

- Reviewed the existing application boundaries, Morkahja routes, service integrations, mock/fixture tests, browser navigation and CI evidence; no application code changed in this documentation review.
- Confirmed [CI run 41645348546](https://github.com/babunidev/babuni.admin/actions/runs/41645348546) passed `npm ci`, TypeScript/Vite build, ESLint, 9 source tests, 9 isolated integration tests and 5 Chromium tests at commit `66c99c3`.
- Documented open release blockers: unauthenticated write-capable development middleware, browser-visible configuration, nontransactional database/session changes, unversioned filesystem overwrites, incomplete editor and PostgreSQL verification, and 23 reported dependency security advisories.
- Classified Phase 1's initial modularization and automated source/mock verification as complete, **without** declaring production readiness or full legacy function parity.
- Added [Phase 1 verification report](docs/PHASE1_VERIFICATION.md) and updated roadmap, architecture, testing guidance and decisions to preserve the review findings.

## 2026-11-03 — Isolated Morkahja integration tests and failure handling

- Added nine integration tests under `tests/integration.spec.mjs`, run via `npm run test:integration` in CI. They execute the real Vite-local middleware over a dedicated localhost HTTP harness, with temporary game JSON/image directories and injected in-memory administrative operations; no external database, production assets or live service is contacted.
- Verified player lookup, timeout/ban/unban results, unknown IDs, invalid bodies and injected database exceptions; tested writes and reads for encounters, solutions, expansions, frames and portraits.
- Tested WebP image saving, generated title-based names, filename/path rejection, malformed data, missing game files, read-only file errors and client-side rejection of explicit unsuccessful responses.
- Corrected local admin routes to return non-2xx for `ok: false`, and client moderation actions to reject failed acknowledgements and display errors inside confirmation dialogs.
- Added bounded record ID and image name validation, WebP signature/length and size checks, and browser-side WebP conversion before upload. These bounds require later compatibility review against real game content.
- [CI run 41644848938](https://github.com/babunidev/babuni.admin/actions/runs/41644848938) passed build, lint, 9 source-level tests, 9 isolated integration tests and 5 Chromium tests at commit `5370391`.
- This does not test real PostgreSQL SQL, session-revocation transactions, actual editor-form interactions or production filesystem operations.

## 2026-11-03 — Rendered browser regression coverage

- Added five headless Chromium browser tests exercising Babuni Dev overview, two-way workspace switching and browser history, direct Morkahja routes, mobile sidebar controls, and a mock player table.
- Added a separate `test:browser` CI job against a mock-only production Vite preview; kept the existing nine source-level tests independent of Playwright. Browser tooling is installed temporarily in the CI job, without changing `package-lock.json`.
- The first real browser run identified a mobile sidebar visibility issue. Added hidden/visible responsive classes so closing the sidebar also hides its controls from keyboard and accessibility visibility checks.
- Pinned the CI browser runner to Ubuntu 24.04 after an unsupported-runner Playwright installation failure.
- [CI run 41639215405](https://github.com/babunidev/babuni.admin/actions/runs/41639215405) passed TypeScript/Vite build, ESLint, 9 source-level tests and 5 Chromium browser tests at source commit `3a94ff9`.
- No live database, external game files, remote administrator API or production website was accessed by the browser tests.

## 2026-11-03 — Retire temporary import compatibility files

- Replaced old component, service, utility and domain-type re-export imports with direct `src/features/morkahja/` and `src/shared/` imports. The active shared shell continues to live under `src/app/`.
- Updated the PostgreSQL adapter to import its Morkahja-specific player detail type directly.
- Deleted 33 unused compatibility files from the old `components/`, `layouts/`, `stores/`, `utils/`, domain-service and domain-type locations. Retained actual implementations such as `src/types/index.ts`, `src/services/http.ts` and application configuration.
- Added an import-integrity test verifying retired shims are absent and relative imports resolve.
- [CI run 41565792784](https://github.com/babunidev/babuni.admin/actions/runs/41565792784) passed `npm ci`, `npm run build`, `npm run lint` and all nine tests at source commit `3786028`.
- No frontend behavior, remote service, live database, game content or deployment was exercised by this refactor.

## 2026-11-03 — Workspace selector and project navigation

- Added a sidebar workspace selector driven by the browser URL with Morkahja and Babuni Dev options.
- Added `/babuni-dev` as a non-editable overview and its own navigation definition.
- Preserved original Morkahja route URLs, navigation links, and server-status header.
- Gave Babuni Dev a separate header without Morkahja player/server queries.
- Extended the test suite from six to eight tests covering workspace selection, route boundaries and placeholder isolation.
- [CI run 41563642755](https://github.com/babunidev/babuni.admin/actions/runs/41563642755) passed `npm ci`, TypeScript/Vite build, ESLint and all eight regression tests for `4f9b2ed`.
- No authenticated backend, GitHub editing, content publication, real browser test or deployment was performed.

## 2026-11-03 — Shared application boundaries

- Relocated the layout, sidebar, Zustand UI store and app navigation composition to `src/app/`.
- Moved reusable `PageHeader`, `Table`, `StatusBadge`, `ConnectionBanner` and generic formatting into `src/shared/`.
- Placed current Morkahja navigation entries and the server-status top bar in its feature workspace; existing route paths and labels remain unchanged.
- Preserved old import paths with transitional re-exports and added a sixth regression test covering the shell-to-workspace connections.
- Fixed a sidebar compatibility-export path discovered by the first CI build; [run 41563231632](https://github.com/babunidev/babuni.admin/actions/runs/41563231632) passed build, lint and all six tests at commit `3fd29b1`.
- No project switching, authentication, live database operation or website deployment was implemented or tested.

## 2026-11-03 — Initial automated regression coverage

- Added five Node test-runner regressions covering player ordering/counts, encounter draft defaults, encounter solution/expansion/follow-up lookups, in-memory mock moderation, and Morkahja route declarations.
- Added `npm test` and a required test step after build/lint in GitHub Actions. Tests compile TypeScript fixtures using the existing TypeScript package and do not connect to real services.
- Corrected the test loader after initial CI failures; all five regressions, build and ESLint passed in [CI run 41552579859](https://github.com/babunidev/babuni.admin/actions/runs/41552579859) at commit `ba014ea`.
- UI rendering, real database writes, remote authorization and file-upload integration remain untested.

## 2026-11-03 — ESLint and migration cleanup

- Added `npm run lint` to the GitHub Actions build workflow.
- Resolved twelve reported lint errors: ten transitional React component re-export shims, one synchronous state update in the Morkahja content tab effect, and one mutable declaration in mock state.
- Removed the now-unused React `useEffect` import after the tab-state correction.
- Verified installation, TypeScript/Vite build and ESLint all passed in [run 41552146789](https://github.com/babunidev/babuni.admin/actions/runs/41552146789) for source commit `72a3169`.
- No browser regression, moderation/database test or production deployment was performed.

## 2026-11-03 — CI build verification and import fixes

- Added a GitHub Actions workflow to install dependencies and run the production TypeScript/Vite build on pushes.
- Corrected four broken type-import paths introduced when moving Morkahja components/services.
- Verified `npm ci`, `tsc -b`, and `vite build` passed in [run 41551602985](https://github.com/babunidev/babuni.admin/actions/runs/41551602985) for commit `b2062fe`.
- The dependency install reported 23 security advisories. Lint, browser regression, live admin operations and deployment were not performed.

## 2026-11-03 — Multi-project workspace migration (source only)

- Established `src/features/morkahja/`, `src/features/babuni-dev/`, `src/app/` and `src/shared/` as initial project boundaries.
- Relocated Morkahja's Dashboard/Players/Content pages, domain components, service adapters, types and utilities under its workspace.
- Updated the central router/imports; retained transitional re-export files for older paths and existing route URLs.
- Added `docs/MULTI_PROJECT_ARCHITECTURE.md`; documented the phased migration.
- Targeted relative-import checks were reported. A full TypeScript build, lint, functional regression test and production deployment were **not** performed or verified as part of these changes.

## 2026-11-03 — Platform and content-management planning (documentation only)

- Recorded Babuni's decision to expand the Morkahja workbench into one multi-project Babuni Admin.
- Defined the proposed Babuni Dev workspace: GitHub document synchronization, Markdown editing/previews, revision comparison and targeted publication.
- Documented proposed backend authentication, project isolation, auditing, AI operation boundaries and rollback.
- Updated concept, roadmap, architecture, decisions and development history. No new editor, API, publishing operation or game-data change implemented by this documentation update.

## Earlier source history

# Morkahja Admin — Git-based changelog

**Creator:** Babuni.dev. Dates are repository commit dates, not assertions of deployment or test success.

## 2026-10-26 — expanded documentation audit

- Rebuilt eleven Markdown files: README, concept, roadmap, changelog, agent rules, architecture, design, content, decisions, narrative journal and AI collaboration.
- Distinguished **Morkahja Admin** application name from `arcanitebrothers` repo/package name and from the external **MorkahjaWebApp** game data.
- Recorded the initial mock dashboard and the next-day content/moderation development, with security-sensitive boundaries clearly marked unverified.
- Flagged `VITE_DATABASE_URL` browser exposure concerns, file-write middleware trust boundaries, mock fallback, content route mismatches and the absence of automated test evidence.
- **Markdown-only:** no frontend/server code, assets, package dependencies, environment templates or game data were changed. No backend or running app tested.

## 2026-05-23 — first dashboard scaffold

Commit `097a7be` — **“initial admin dashboard scaffold”** — introduced React/TypeScript/Vite, dark styling, generic route structure, shared tables/cards, mock services and editor rules. The initial README explicitly described mock data and pending backend connection. No legitimate claim of live moderation or a finished content pipeline can be assigned to this commit alone.

## 2026-05-24 — content management and local connections

Commit `25c5604` — **“Add content management, encounter editing, and dev port 5180.”** — reworked the route set around Dashboard, Players, Content and Settings, and added substantial content editing, local development APIs, PostgreSQL querying/moderation support and image handling. The source now has real write paths in development conditions. This is source evidence of implementation, **not** a proof of production readiness or verified permissions.

## 2026-10-26 — attribution and initial docs

Commits `169a1af`, `99cdd36`, `93d0360`, `c9fc2b7` added author credit and short documentation links/scaffolds. The new audit expands that record rather than inventing earlier conversations or changing application behavior.

## Verification convention

Record client/server environment, fixture data, test commands, observed output, modified files and commit SHA for every later implementation. The current Git history establishes code and textual milestones, not that the app was deployed, tested with live accounts or approved for general access.

## 2026-10-28 — Audit #38 documentation checkpoint

- Revisited existing eleven-file documentation and rechecked package metadata and Vite middleware configuration against the October 26 assessment.
- Preserved the original May implementation chronology, authorial direction and unresolved privileged-tool risks.
- Added targeted clarifications only; no code, assets, credentials, external game files or databases changed. No build or live test executed.

## 2026-10-31 — Publication preparation

Recorded Babuni.dev’s direction to publish the actual project after review and retire its separate documentation edition afterwards. Confirmed the existing standard document structure; added `docs/PUBLISHING.md`. No runtime or visibility changes.

## 2026-10-31 — Changed: publication decision record

- Recorded Babuni.dev’s open-development decision and verified current visibility in Decisions and Development journal; retained licensing, media-rights and deployment distinctions.
