# Babuni Admin — Development Roadmap

**Creative direction:** Babuni  
**Purpose:** One private administration application with separate workspaces for Morkahja, Babuni Dev, and future projects.  
**Status (2026-11-03):** Phase 1 modular restructuring and the initial automated verification milestone are complete. Production readiness and full Morkahja workflow verification remain open; later phases are planned.

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
- [ ] Test real PostgreSQL query, session-revocation and moderation transactions against a disposable database; exercise full rendered content-editor workflows against isolated game assets.
- [x] Separate the active application layout, sidebar, UI store, and navigation composition into `src/app/`; move generic controls and formatting to `src/shared/`, and Morkahja navigation/status to its feature folder. [CI verification](https://github.com/babunidev/babuni.admin/actions/runs/41563231632).
- [x] Add URL-driven workspace selection, separate Morkahja/Babuni Dev navigation, and a non-operational Babuni Dev overview. Keep existing Morkahja URLs and status bar intact. [CI: 8 tests, build, lint passed](https://github.com/babunidev/babuni.admin/actions/runs/41563642755).
- [ ] Add real workspace authorization/permissions and Babuni Dev content operations after the secure backend is implemented.
- [x] Replace historical shim imports with direct feature/shared paths and remove all 33 obsolete re-export files. CI verified TypeScript/Vite build, lint and nine tests, including an import-integrity regression. [Run 41565792784](https://github.com/babunidev/babuni.admin/actions/runs/41565792784).
- [x] Keep Babuni Dev content operations inactive: the new overview is explicitly a placeholder and cannot edit or publish.
- [x] Complete the final Phase 1 source/CI verification review and record residual risks in the roadmap, changelog, development journal and architecture. See [Phase 1 verification report](docs/PHASE1_VERIFICATION.md) and [latest passing CI](https://github.com/babunidev/babuni.admin/actions/runs/41645348546).

- [ ] Audit and remediate dependency advisories (23 reported by latest `npm ci`: 8 high, 14 moderate, 1 low), then rerun all checks.

### Final Phase 1 review — verified versus outstanding

- [x] Confirm retained routes, workspace navigation, mock views, service error handling and isolated content saves via the automated test suites; **not** a blanket guarantee that all legacy functions remain intact.
- [x] Review architecture and document specific security, data-integrity, dependency and test-coverage risks.
- [x] Update roadmap, changelog and development journal with an evidence-linked review.
- [ ] Verify real PostgreSQL queries, atomic moderation/session changes and the rendered content editors against disposable fixtures.
- [ ] Close security and dependency release blockers before any remote/admin production access.

Full findings: [docs/PHASE1_VERIFICATION.md](docs/PHASE1_VERIFICATION.md).

## Phase 2 — Secure administration backend

- [ ] Separate privileged operations from Vite development plugins into a production backend, with server-only secrets.
- [ ] Remove dependence on `VITE_DATABASE_URL` and `VITE_API_TOKEN` for confidential credentials.
- [ ] Add authenticated sessions, server-enforced project permissions, CSRF protections where applicable, request validation and limits.
- [ ] Add action attribution, audit logging, backup/rollback controls, and safe file path/type/size constraints.
- [ ] Keep game moderation and portfolio publication privileges isolated.
- [ ] Build security and API regression tests before any remote exposure.
- [ ] Plan private remote access and independent deployment; no public Vite development server.

**Technology candidate:** A separate TypeScript API (Fastify was discussed) is a proposal, not an approved dependency or implemented service.

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
- [ ] Verify the actual PostgreSQL adapter against a disposable database, including session revocation and partially failed writes.
- [x] Verify server-side create/update routes for encounters, solutions, expansions, portraits and frames, plus WebP upload paths, using temporary filesystem fixtures. [CI](https://github.com/babunidev/babuni.admin/actions/runs/41644848938).
- [ ] Exercise the actual rendered editor forms and image conversion against an isolated content fixture.
- [ ] Resolve local and remote content API inconsistencies before remote use.
- [ ] Ensure mock fallbacks cannot be mistaken for successful live writes.
- [ ] Audit file uploads, database transactions, authorization and recovery procedures.

## Release gate

No production admin rollout before successful build, lint, meaningful regression tests, authenticated backend review and non-production end-to-end verification. No production database operation or website deployment was performed as part of the 2026-11-03 documentation planning.

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
