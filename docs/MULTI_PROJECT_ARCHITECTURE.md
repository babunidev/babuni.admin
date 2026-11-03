# Multi-project administration — first migration

**Creative direction.** Babuni Admin is to become a common administration application for Morkahja, Babuni Dev and future projects, rather than remain exclusively a Morkahja tool. The existing Morkahja functions must be preserved.

**AI implementation.** Relocated the three Morkahja page components to `src/features/morkahja/pages/`, updated their relative imports and the central router, and reserved `src/features/babuni-dev/`, `src/app/` and `src/shared/`. The existing route URLs, service adapters, Vite middleware, credentials and data files were not changed. This is the first structural migration, not the completion of the larger feature-boundary refactor.

**Unresolved security boundaries.** Vite `VITE_` secrets and local content/PostgreSQL write endpoints must not be treated as safe remote administrative APIs. Production operation needs independent authentication, authorization, validation, audit trails and separation between project permissions before exposing any privileged service.

**Verification.** GitHub commit and import-path review only. No npm build/lint, database operation or browser regression test was run here. Testing must precede deployment.

## Incremental domain extraction — 2026-11-03

AI moved the Morkahja-specific `EncounterEditorPanel` and `StatCard` components, all three dedicated domain type files (`gameContent`, `encounterDetail`, `playerDetail`), and the domain utilities `contentLabels`, `encounterDetail`, `gameDataReference`, `achievementLabels`, `imageFileToWebpBase64`, and `players` under `src/features/morkahja/`.

The original import paths currently contain thin re-export compatibility shims so other screens and adapters retain their imports during staged migration. Those shims are intentional transitional code, not duplicate sources of truth. A repository check resolved the relative imports in all 14 migrated TypeScript/TSX files; no unresolved relative paths were found in that targeted check. This is **not** a TypeScript build, lint pass, runtime verification or security review.

**Remaining Phase 1 work:** relocate the other Morkahja-specific components and services; update consumers to import from the feature workspace; retire compatibility shims; distinguish shared controls and app shell; and validate build, lint, UI and privileged operations before production use. The Babuni Dev workspace remains a placeholder.

## Domain components and services — 2026-11-03

With the creative's approval to continue directly on `main`, AI moved eight more Morkahja-specific components (`ActivityFeed`, `ContentDetailPanel`, `ContentImageGrid`, `EncounterDetailPanel`, `ImageUploadField`, `PlayerDetailPanel`, `PlayerModerationActions` and `SolutionDetailPanel`) and four Morkahja data services (`adminApi`, `contentApi`, `mockPlayerDetail`, `mockState`) under the feature workspace. The previously moved `EncounterEditorPanel`, `StatCard`, types and utilities remain there. The shared `PageHeader`, `Table`, `StatusBadge`, `ConnectionBanner`, app layout, and generic HTTP client remain in their original locations.

Compatibility re-export files remain at the previous component and service paths; existing routes and consumers therefore need no immediate imports rewrite. A targeted check of the new relative imports in all 14 Morkahja domain components and services found no unresolved local paths. This is source-level inspection, **not** a successful TypeScript build, lint pass or runtime test. Production credentials, moderation behavior, game files, routes and hosting were not changed.

**Still to verify:** TypeScript build, lint, functional browser flows and any live admin write paths in an authorized test environment. Follow-up cleanup can migrate consumers to direct workspace imports and remove compatibility shims after tests are established. The security findings about Vite middleware remain open.

## Shared application shell extraction — 2026-11-03

AI moved the active layout, sidebar and UI state into `src/app/`, and placed generic heading, table, badge, connection-banner and formatting controls in `src/shared/`. Current Morkahja route definitions and server-status top bar were separated into `src/features/morkahja/`. Legacy module exports remain temporarily; page URLs and the visible game-specific header are intentionally unchanged. A sixth source-level regression check verifies the route/navigation composition and shared-component locations.

The initial refactor produced a broken sidebar compatibility export. After correcting it, [run 41563231632](https://github.com/babunidev/babuni.admin/actions/runs/41563231632) passed `npm ci`, `npm run build`, `npm run lint` and six regression tests for source commit `3fd29b1`. Actual browser navigation, live backend and remote administration remain outside the current test evidence.
