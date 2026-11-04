# Morkahja Admin — instructions for future human and AI developers

**Human creative and project authority:** Babuni. The current repository is `babunidev/babuni.admin`, publicly named **Babuni Admin**. `arcanitebrothers` is the historical package/repository name; existing application UI may still say `Morkahja Admin`.

## Start with the actual architecture

Review `README.md`, `CONCEPT.md`, `ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/DEVLOG.md`, `.cursor/rules/morkahja-admin.mdc`, Vite plugins and current `src/` components before coding.

Preserve the original constraints recorded in editor rules: **strict TypeScript, functional React, readable modularity, dark minimal atmospheric design, backend as authority, API/UI separation, reusable panels, no overengineering, sensitive data out of the browser**. Do not substitute a generic dashboard aesthetic for the author's choices.

## Permanent local-only deployment requirement

Babuni Admin is operated on the human creative's **own PC only**. Do not propose hosting the UI, a generalized admin API or an admin dashboard on the VPS or under a public URL. Its intended future local privileged service must bind to loopback, and the PC must initiate authenticated **outbound** connections to project-owned services over SSH or HTTPS. Preserve independent remote service authorization, project scopes, local origin protections and keyring-backed secret handling. See [connection-manager design](docs/LOCAL_CONNECTION_MANAGER.md). Local profile, keyring, local health and Morkahja SSH-host offline preflight are implemented. An **operator-gated, disabled-by-default** Morkahja SSH/PostgreSQL read-only health probe is now in source; it requires a private server-only allowlist/fingerprint configuration and does not authorize general live access or editing. No real Morkahja remote server has been contacted or authenticated in this work. The Nobara unlocked, locked, recovery and isolated unavailable-bus scenarios have operator-reported verification; independent live connection authorization remains pending. A read-only lock-state probe, isolated bus-outage checker and a security release-gate audit are available; these do not authorize live writes. The local profile editor, scoped adapter registry, read-only lifecycle and browser session boundary have automated fixtures and browser tests.

## This is privileged software

- **No credentials in Git, frontend bundles, README examples or public logs.** Vite `VITE_` env vars are browser-facing. Existing `VITE_DATABASE_URL` and `VITE_API_TOKEN` references need security review before real credentials are used.
- **Localhost is not authorization.** The two Vite middleware modules provide mutation endpoints; review authentication, access restriction, CSRF, body-size limits, path confinement and error disclosure.
- UI labels/mocks are not proof of backend health or correctness. Confirm actual source selection and observed server responses.
- Moderation handlers can change DB moderation status and revoke player sessions. Never test with live accounts without explicit operator authorization and safe recovery plans.
- Content editing writes to a **separate external game-data directory**. Record those paths/revisions separately; back up before any mutation, and don't claim this repository contains the game database.
- Keep live player records, chat, session tokens and identity keys out of public portfolio material; use synthetic examples.

## Engineering and review procedure

1. Identify the creative's concrete requirement. Record assumptions, alternatives and changes of direction before implementation.
2. Make narrowly scoped, reviewable edits; avoid automatic broad rewrites of routes or JSON schemas.
3. Keep service/HTTP operations separate from components. Test actual DB/API behavior with fixtures and enforce authorization server-side.
4. For every content write, verify schema, ownership, file safety and rollback.
5. Distinguish `mock`, `local DB`, `VPS API` and `local file` modes clearly in UI and documentation.
6. Run `npm run build` and `npm run lint` when tools/environment permit; add focused tests around security and mutations. Do not say they passed unless logs are available.
7. Update README, CHANGELOG, ROADMAP, DEVLOG, DECISIONS, ARCHITECTURE, DESIGN, CONTENT, AI_COLLABORATION alongside significant code changes with commit/test evidence.

## Portfolio provenance

Credit original product direction to Babuni; credit AI only for assistance it demonstrably supplied. Preserve narrative development history, revisions, technical debt and verification gaps. Never publish credentials or raw private user data.

The 2026-10-26 audit made **documentation changes only**, with no code or live-data operations.

## Repository-local documentation standard

Before writing or changing project documentation, read [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md). These rules travel with this repository and do not depend on the babuni.dev ChatGPT Project. Preserve all project-specific technical, creative, canon, safety, licensing, and historical rules in this file; follow the linked standard for public first-person narrative, human–AI attribution, concise development journals, decision records, and evidence-based verification. **Babuni** is the human creative; **babuni.dev** is the website/portfolio, not the person. Preserve third-party credits and historical legal notices. References above to a dated “documentation-only audit” describe that past task, not a permanent ban on later authorized implementation.
