# Babuni Admin — Phase 1 Verification Report

## 2026-11-03 — Phase 1 verification review

**Scope:** The latest `main` revision (`66c99c3`) passed `npm ci`, TypeScript/Vite build, ESLint, nine source regression tests, nine isolated HTTP integration tests and five headless Chromium browser tests. [GitHub Actions run 41645348546](https://github.com/babunidev/babuni.admin/actions/runs/41645348546).

**Functionality supported by evidence:** Existing Morkahja route declarations and direct page rendering; project-specific sidebar and header; URL-derived workspace switching, back/forward and mobile sidebar; mock player table; source-level player sorting and encounter helpers; isolated fixture-based player inspection, timeout, ban, unban, five game JSON writes, image upload and error-path handling. Babuni Dev remains an inert overview, not a content editor. No production deployment or live-data operation was performed during this review.

**Verification gaps:** Actual PostgreSQL queries and session revocation, failure atomicity when a moderation write succeeds but session deletion fails, real game-content editor interactions and legacy schema compatibility, production filesystem writes/rollback, authentication and authorization are not proven by the existing suites.

**Architecture and safety risks:**
1. **P0 — Privileged service boundary:** `vite/localAdminPlugin.ts` and `vite/localContentPlugin.ts` expose write-capable development middleware without application-level authentication/authorization. `vite.config.ts` registers local-content middleware even when the UI disables local content. A loopback bind reduces reachability, but is not an access-control policy. Do not expose the development server or proxy it as a production admin API.
2. **P0 — Browser-exposed configuration:** `VITE_DATABASE_URL` and `VITE_API_TOKEN` remain frontend-visible configuration paths. The database URL must be moved to server-only configuration before inserting real secrets; never rely on a `VITE_` prefix for confidentiality.
3. **P0 — Persistence integrity:** `vite/postgresAdmin.ts` updates player JSON and revokes sessions in separate queries, without an explicit transaction. `vite/localContentPlugin.ts` directly overwrites JSON and image files, without an atomic replace, versioned backup or rollback. Input validation is improved but is not full game-schema validation.
4. **P1 — Compatibility and tests:** Actual PostgreSQL SQL, full form-driven editor workflows, legacy content keys/shapes and real WebP image decoding need fixture-backed validation. The current WebP check examines the container signature/length rather than decoding its image payload.
5. **P1 — Dependencies and maintainability:** Latest `npm ci` reported **23 advisories (8 high, 14 moderate, 1 low)**. The advisory list, exploitability and safe upgrade path are not yet audited. `src/pages/SettingsPage.tsx` remains outside `features/morkahja`; shared `src/types/index.ts` still includes Morkahja-oriented contracts; these boundaries can be revisited without blocking the existing UI.

**Disposition:** Phase 1's initial modular restructuring and automated source/mock verification are complete. **Phase 1 is not certified for production, and the legacy application has not been comprehensively regression-tested against live-like infrastructure.** Keep the outstanding PostgreSQL, editor, security, filesystem recovery and dependency work open. This is a review of documented repository state and CI evidence, not a new runtime test.

## Subsequent Phase 1 hardening — 2026-11-03

This report is a historical baseline, recorded before the later hardening implementation. The updated [Phase 1 hardening report](PHASE1_HARDENING_2026-11-03.md) and [CI run 41659550592](https://github.com/babunidev/babuni.admin/actions/runs/41659550592) supersede its *unverified PostgreSQL transaction, editor-form and file-backup* findings for the **isolated fixture scope**. Production authentication, live-system compatibility, recovery policy and remaining tooling advisories are still outstanding.
