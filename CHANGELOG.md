# Babuni Admin — Changelog

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
