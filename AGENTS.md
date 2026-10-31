# Morkahja Admin — instructions for future human and AI developers

**Creative authority and project creator:** Babuni.dev. The current repository is `babunidev/babuni.admin`, publicly named **Babuni Admin**. `arcanitebrothers` is the historical package/repository name; existing application UI may still say `Morkahja Admin`.

## Start with the actual architecture

Review `README.md`, `CONCEPT.md`, `ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/DEVLOG.md`, `.cursor/rules/morkahja-admin.mdc`, Vite plugins and current `src/` components before coding.

Preserve the original constraints recorded in editor rules: **strict TypeScript, functional React, readable modularity, dark minimal atmospheric design, backend as authority, API/UI separation, reusable panels, no overengineering, sensitive data out of the browser**. Do not substitute a generic dashboard aesthetic for the author's choices.

## This is privileged software

- **No credentials in Git, frontend bundles, README examples or public logs.** Vite `VITE_` env vars are browser-facing. Existing `VITE_DATABASE_URL` and `VITE_API_TOKEN` references need security review before real credentials are used.
- **Localhost is not authorization.** The two Vite middleware modules provide mutation endpoints; review authentication, access restriction, CSRF, body-size limits, path confinement and error disclosure.
- UI labels/mocks are not proof of backend health or correctness. Confirm actual source selection and observed server responses.
- Moderation handlers can change DB moderation status and revoke player sessions. Never test with live accounts without explicit operator authorization and safe recovery plans.
- Content editing writes to a **separate external game-data directory**. Record those paths/revisions separately; back up before any mutation, and don't claim this repository contains the game database.
- Keep live player records, chat, session tokens and identity keys out of public portfolio material; use synthetic examples.

## Engineering and review procedure

1. Identify the creator's concrete requirement. Record assumptions, alternatives and changes of direction before implementation.
2. Make narrowly scoped, reviewable edits; avoid automatic broad rewrites of routes or JSON schemas.
3. Keep service/HTTP operations separate from components. Test actual DB/API behavior with fixtures and enforce authorization server-side.
4. For every content write, verify schema, ownership, file safety and rollback.
5. Distinguish `mock`, `local DB`, `VPS API` and `local file` modes clearly in UI and documentation.
6. Run `npm run build` and `npm run lint` when tools/environment permit; add focused tests around security and mutations. Do not say they passed unless logs are available.
7. Update README, CHANGELOG, ROADMAP, DEVLOG, DECISIONS, ARCHITECTURE, DESIGN, CONTENT, AI_COLLABORATION alongside significant code changes with commit/test evidence.

## Portfolio provenance

Credit original product direction to Babuni.dev; credit AI only for assistance it demonstrably supplied. Preserve narrative development history, revisions, technical debt and verification gaps. Never publish credentials or raw private user data.

The 2026-10-26 audit made **documentation changes only**, with no code or live-data operations.
