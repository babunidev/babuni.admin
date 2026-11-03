# Babuni Admin — Development Roadmap

**Creative direction:** Babuni  
**Purpose:** One private administration application with separate workspaces for Morkahja, Babuni Dev, and future projects.  
**Status (2026-11-03):** Phase 1 is partially implemented; remaining phases are planned, not deployed or accepted as complete.

## Completed in source (not runtime-verified)

- [x] Preserve the Morkahja Dashboard, Players, Content and Settings routes during the initial restructuring.
- [x] Create `src/features/morkahja/`, `src/features/babuni-dev/`, `src/app/`, and `src/shared/` boundaries.
- [x] Move Morkahja pages, domain components, services, types and utilities under its feature folder.
- [x] Maintain transitional re-export files at original component/service/type/utility paths.
- [x] Perform targeted relative-import checks for the migrated files.
- [x] Record the migration and known limits in `docs/MULTI_PROJECT_ARCHITECTURE.md`.

These checks do **not** establish a successful TypeScript build, lint pass, browser regression or safe moderation/content writes.

## Phase 1 — Finish modular architecture and verify existing behavior

- [ ] Run `npm ci`, `npm run build` and `npm run lint` against the current `main` revision; fix issues without altering existing functionality.
- [ ] Add automated route/component/service tests; verify existing Morkahja workflows against fixtures and isolated game data.
- [ ] Establish explicit shared application shell and navigation boundaries.
- [ ] Introduce project workspaces and project-specific navigation, retaining old Morkahja URLs through a compatibility plan.
- [ ] Replace transitional re-export imports with direct feature imports, then remove unused shims.
- [ ] Keep the Babuni Dev workspace inactive until its content operations are designed and authorized.
- [ ] Update architecture/decisions/changelog/journal alongside actual verified changes.

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

- [ ] Confirm player inspection and moderation using an isolated test backend.
- [ ] Verify encounter, solution, expansion, portrait, frame and image editors against isolated fixtures.
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
