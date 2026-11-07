# Babuni Admin — instructions for future human and AI developers

## One app, multiple workspaces, one continuous development line (creative decision, 2026-11-07)

Babuni Admin is one local administration application for one human operator. Morkahja and Babuni Dev are two current workspaces of that same application, with further project workspaces added when needed. Changing focus between workspaces must **not** switch to an older application version, drop existing features, create a separate application, or treat each workspace as an independent Git branch. Continue from the most advanced current codebase and integrate changes there. Do not create a new branch for a workspace change unless the creative explicitly asks or a genuinely necessary isolation reason is explained. Preserve existing Morkahja administrator, moderation, content and image cache operations when adding portfolio management.

The shared **Connection** page manages project-specific connection targets without creating multiple administrators. Babuni Dev can have its own scoped GitHub and website targets; these are not separate admin accounts and must not inherit Morkahja database or file permissions. For now, game-side live content publishing is deferred pending a game architecture update, while portfolio content editing and publishing become the active development priority. Preserve existing verified functionality and never mistake a read-only connection check for an operational publisher.


## Single Connection interface (creative decision, 2026-11-06)

Babuni Admin is a private workbench for one operator. Maintain one clearly named **Connection** page with all relevant server/credential health details; workspace pages must reuse the owner administrator connection without asking the user to choose profiles repeatedly. Never reintroduce per-page connection dropdowns or unnecessary multi-account provisioning. Preserve working credentials and legacy profiles during migration; remove obsolete infrastructure only after proven replacement. Keep fixed operations, transactions, SSH host pinning, backups and clear failures. Do not claim website publishing or live writes are connected until verified. The read-only remote image reader has a persistent local disk cache; real-server cache synchronization is still awaiting operator acceptance.

## One Morkahja operator profile (creative decision, 2026-11-06)

Babuni Admin is a single-operator tool. Do not reintroduce separate read-only moderator accounts, different Content logins, or multiple password prompts for the same server. The `postgres-ssh-moderation` internal profile is the current administrator identity shared across Overview, Moderation and Content. Preserve the existing restricted Overview as a migration fallback only. All actions must remain fixed and validated, with SSH trust, transaction rollback, content backups, and clear errors. Database role setup remains operator-controlled; do not claim production activation from CI or source work alone. Remote image reads are implemented and were observed loading live on Nobara; persistent disk preloading and change checks are implemented but not yet live-verified. Image uploads and remote asset writes remain unfinished.

## Privileged Morkahja connection separation (2026-11-06)

The `postgres-ssh-moderation` profile is separate from the restricted `postgres-ssh` Overview. Its private config, OS-keyring credential, enabled environment gate, database privileges and per-operation role check must be independently authorized. Never grant `babuni_admin_probe` raw game tables or write privileges to make moderation work. The moderator adapter permits only fixed player list/detail and timeout/ban/unban operations. Account listing and detail require independently approved SELECT-only rights; a separate `BABUNI_MORKAHJA_MODERATION_WRITES=enabled` gate and narrowly scoped UPDATE/DELETE privileges are required for mutations. The operator-reviewed read-role SQL is never auto-applied. Preserve row locks, rollback, session revocation, statement limits and SSH cleanup.

The `ssh-content` profile is a separate, opt-in, no-forwarding SSH content transport. Its Python worker may access only the five fixed deployed game JSON catalog files; preserve readback SHA-256 revision requirements, exclusive backups, atomic replacement, schema validation and failure-safe behavior. Scoped remote WebP image reads exist through the administrator profile, with a local disk cache and fixed folder allowlist; do not add arbitrary server file browsing or public hosting. Do not confuse developer files or static artwork with the deployed server catalog. Never claim user-triggered remote writes succeeded without an observed server response and readback. Both adapters remain disabled by default and require live operator verification before use on actual accounts or published assets.

**Human creative and project authority:** Babuni. The current repository is `babunidev/babuni.admin`, publicly named **Babuni Admin**. `arcanitebrothers` is the historical package/repository name. Browser-tab identity and shared sidebar branding use **Babuni Admin**; **Morkahja** is the game workspace, not the whole admin application.

## Start with the actual architecture

Review `README.md`, `CONCEPT.md`, `ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/DEVLOG.md`, `.cursor/rules/morkahja-admin.mdc`, Vite plugins and current `src/` components before coding.

Preserve the original constraints recorded in editor rules: **strict TypeScript, functional React, readable modularity, dark minimal atmospheric design, backend as authority, API/UI separation, reusable panels, no overengineering, sensitive data out of the browser**. Do not substitute a generic dashboard aesthetic for the author's choices.

## Permanent local-only deployment requirement

Babuni Admin is operated on the human creative's **own PC only**. Do not propose hosting the UI, a generalized admin API or an admin dashboard on the VPS or under a public URL. Its intended future local privileged service must bind to loopback, and the PC must initiate authenticated **outbound** connections to project-owned services over SSH or HTTPS. Preserve independent remote service authorization, project scopes, local origin protections and keyring-backed secret handling. See [connection-manager design](docs/LOCAL_CONNECTION_MANAGER.md). Local profile, keyring, local health and Morkahja SSH-host offline preflight are implemented. An **operator-gated, disabled-by-default** Morkahja SSH/PostgreSQL read-only health probe is now in source; it requires a private server-only allowlist/fingerprint configuration and does not authorize general live access or editing. An operator-provided Nobara screenshot subsequently confirmed the real Morkahja SSH/database health probe. Separate read-only player-data retrieval has been live-verified behind an additional private opt-in; no general read, editing, moderation or publishing permission follows from the health probe. The Nobara unlocked, locked, recovery and isolated unavailable-bus scenarios have operator-reported verification; independent live connection authorization remains pending. A read-only lock-state probe, isolated bus-outage checker and a security release-gate audit are available; these do not authorize live writes. The local profile editor, scoped adapter registry, read-only lifecycle and browser session boundary have automated fixtures and browser tests.

## Morkahja read-only data boundary

The dedicated `/read-only` dashboard must use only `local-service/morkahjaReadOnly.mjs` and its bounded SELECT-only SQL. Never reuse `vite/postgresAdmin.ts` for this view: legacy list flows can mutate session records. Data access requires `ssh:read`, exact operator-approved field settings and the same private SSH/keyring trust gates as the health probe. Do not expose player IDs, public keys, session data, moderation state or arbitrary SQL to the browser. An explicit operator selection may persist the non-secret profile ID locally; subsequent page reloads may automatically request a new snapshot only for that previously selected profile, subject to all server-side read approvals. Do not persist credentials, tokens or player data, or enable background polling. Keep each read bounded, temporary, one at a time, and close tunnels after every request. See `docs/MORKAHJA_READ_ONLY_DASHBOARD.md`.

## This is privileged software
## Desktop SSH startup boundary

The operator confirmed the earlier `SSH_AUTH_REJECTED` was caused by an empty desktop agent; manually loading the approved key restored live data access. The optional `scripts/ssh-agent-login.py` must be installed **only by an explicit desktop operator command**, not from `npm run dev` or an AI agent. It may use only the existing agent and private config, must not persist passphrases, copy SSH keys, relax host pinning or claim real login behavior verified from synthetic tests. See `docs/SSH_AGENT_DESKTOP_LOGIN.md`.



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
