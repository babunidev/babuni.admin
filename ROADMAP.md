# Babuni Admin — Development Roadmap

**Creative direction:** Babuni  
**Purpose:** One private administration application with separate workspaces for Morkahja, Babuni Dev, and future projects.  
**Status (2026-11-04):** Phase 1 code and fixture verification is complete; the local-only Phase 2 architecture and shared connection-manager design are documented. Read-only profile checks, structured local connection status and terminal-only Linux keyring storage are implemented slices. Live outbound adapters remain planned. The creative has verified the unlocked Nobara desktop keyring with a synthetic credential round trip; a deliberately unreachable D-Bus session bus was verified in an isolated child process on Nobara; the real locked default keyring and subsequent unlock recovery were also verified by operator-reported inspection output on Nobara.

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
- [ ] Implement **online** SSH host-key verification, outbound tunnel lifecycle, PostgreSQL role authorization and GitHub transport (all remain disabled).
- [ ] Connect Morkahja PostgreSQL through a protected outbound tunnel with least privilege.
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
