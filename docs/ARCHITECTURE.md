# Babuni Admin — Architecture

## Batch A restricted metrics (2026-11-05)

The operator deployed `babuni_admin_ro.progression_ownership_totals` after explicit approval and a matching deployed catalog check. The owner-rights security-barrier view remains owned by `morkahjadbadmin`; the probe has SELECT on the aggregate view and no raw player/achievement table access.

`morkahjaReadOnly.mjs` reads the optional aggregates through `progressionMetrics.mjs` inside its existing repeatable-read READ ONLY snapshot. An exact private `readOnlyMetricFields` list independently enables the four counters; existing configurations preserve their old access. Fixed columns, a two-row cap to detect a broken one-row contract, integer/quality validation and savepoint recovery keep unavailable metrics separate from genuine zero. Connection failures still fail the request. Runtime raw-table denial includes `player_achievements`. The UI reuses StatCard and the existing refresh/timestamp behavior; no new endpoint or polling is added.

See [authorization and desktop verification](MORKAHJA_READ_ONLY_DASHBOARD.md). Deployment evidence is operator-reported; this change's CI and Nobara validation are pending.

## Opt-in desktop SSH identity loader (2026-11-05)

`scripts/ssh-agent-login.py` is independent of the HTTP service and SSH tunnel lifecycle. Its operator-run installer copies the loader into the user's local share folder and registers a removable XDG Autostart entry. At graphical login it reads only the owner-private Morkahja configuration and companion public key, compares the configured key's fingerprint against the existing `SSH_AUTH_SOCK`, and invokes `ssh-add` with GUI askpass if necessary. It does not start a second SSH agent or store passphrases, keys, credentials, or game data. Installation is never triggered by `npm run dev`, and successful fixture tests do not establish live login readiness. [Instructions](SSH_AGENT_DESKTOP_LOGIN.md).


## Morkahja Overview: restored profile and one bounded combined snapshot (2026-11-04)

The Morkahja landing route `/` now renders the restricted read-only **Overview**; `/read-only` remains compatible. The older read/write-capable-style Dashboard route is preserved separately at `/dashboard`. The old `/players` administration route remains, but is explicitly labeled **Moderation** in the workspace navigation. No moderation implementation was changed by the route labels.

A selected local Morkahja SSH profile ID (UUID only) is remembered in the browser's origin-local storage after an explicit selection. On later page loads, the UI first queries current server-owned profiles, checks that the remembered ID still identifies an eligible Morkahja `postgres-ssh` profile, and only then issues an approved snapshot request. It never persists returned game data, credentials or the ephemeral local-service session token. No profile selection means no data request. There is no periodic remote polling.

`POST /local-connections-api/:id/read-dashboard` accepts only `{ "page": 1 }` with the existing 1–1000 page bound. Through `ssh:read` and all original operator-private approvals, it executes the fixed overview and position-paginated player-preview SELECTs inside **one repeatable-read READ ONLY transaction** through the existing temporary private SSH tunnel, then rolls back and closes the tunnel. Existing `read-overview` and `read-players` endpoints remain available; independent Next/Previous navigation continues through `read-players`. A single manual refresh reloads both panels. This uses exactly the existing restricted database views; no new raw-table grants or schema changes.

The fifth display counter, **Players online***, is explicitly a session-based approximation derived from `activeSessions`: a player account may have a valid session without an actual presence heartbeat. PostgreSQL sessions are **not** multiplayer rooms. Achievements, gems, game rooms, unlock ownership and purchases require confirmed meanings and separately approved aggregate-only database views before showing real counts.


## Phase 2 — Morkahja read-only dashboard, separately authorized (2026-11-04)
## Phase 2 — Owner-controlled Morkahja PostgreSQL views (2026-11-04)

The live database owner `morkahjadbadmin` owns two views in the `babuni_admin_ro` schema: `overview` (a single row containing four aggregate counts) and `player_preview` (position, truncated display name, avatar count and last-played timestamp). The operator granted `babuni_admin_probe` USAGE on that schema and SELECT on those views only; the operator separately verified no direct SELECT on the sensitive public players/sessions tables. No role memberships, superuser permission or schema CREATE rights were added.

`local-service/morkahjaReadOnly.mjs` now performs fixed SELECT queries **exclusively** against these views, with server-side page bounds and a private check that the reader possesses the view privileges yet has no SELECT on the underlying four game tables. It still independently runs the existing database-role write-privilege health gate, a repeatable-read READ ONLY transaction and the short-lived SSH/Secret Service boundary. A view-defined `position` provides stable within-snapshot pagination without returning internal player IDs. No arbitrary SQL, moderation or new write authority is exposed. [View contract](MORKAHJA_READ_ONLY_DASHBOARD.md).

The operator's live SQL commands verified creation, access and privilege boundaries. Subsequent Nobara dashboard screenshots confirmed successful live overview and first player-preview reads through the views (62 players, 90 avatars, zero active sessions, zero events in the prior 24 hours).



A new Morkahja navigation route `/read-only` is deliberately separate from legacy Dashboard/Players. The UI shares the protected local session client but has no automatic remote polling or mutation controls. `local-service/morkahjaReadOnly.mjs` handles four aggregate counts and paginated, fixed-field player previews using only SELECT statements and read-only transactions. No internal player IDs, identity keys, session records or moderation data are returned. Page size is 20, with strict server-side validation.

The service exposes `POST /:id/read-overview` and `POST /:id/read-players`, requiring Morkahja-only `ssh:read`, the existing private SSH trust/keyring checks, and additional owner-only `readOnlyDataEnabled` plus an exact approved field allowlist. `sshPostgresProbe.mjs` shares one in-flight lock across health and data operations. Every read opens a temporary private Unix-socket SSH forward and closes it after fixed SQL. Legacy `vite/postgresAdmin.ts` is not called: that code contains session maintenance that would violate the new read-only requirement.

The operator reported a successful real SSH/database **health probe** at 20:59 on 2026-11-04. The operator subsequently verified the new read-only data snapshot against the live game database; CI tests continue to use disposable PostgreSQL. [Data contract](MORKAHJA_READ_ONLY_DASHBOARD.md).


## Phase 2 — Operator-gated SSH/PostgreSQL read-only health probe (2026-11-04)

The local service now has a separate `ssh:probe` capability for Morkahja `postgres-ssh` profiles. It rejects all requests by default until an explicit process environment opt-in **and** owner-private configuration authorize an exact host, independently approved pinned host-key fingerprint, SSH identity and database role. It retrieves the per-profile DB password from an unlocked Linux Secret Service only inside the local service. `sshTunnel.mjs` spawns noninteractive OpenSSH with strict known-host checking, isolated child environment, owner-private temporary Unix-socket `-L` forwarding to remote loopback, no remote shell, and bounded cleanup. `sshPostgresProbe.mjs` executes only a fixed PostgreSQL metadata/privilege query in a READ ONLY transaction, then closes the tunnel; no general SQL, player data, persistent remote Connect or writes are exposed. A successful probe is `disconnected` with a last-health-check timestamp, not connected.

This code is verified against non-network SSH fixtures and disposable PostgreSQL 16. **No live Morkahja host, SSH credential, remote DB or role has been inspected.** The fixed privilege query does not replace a separate role-membership and default-privilege audit. [Probe contract](MORKAHJA_SSH_READONLY_PROBE.md).

## Phase 2 — Fail-closed keyring diagnostics and legacy static containment (2026-11-04)

`local-service/keyring.mjs` performs a read-only `busctl --user` Secret Service `ReadAlias(default)` and `Collection.Locked` query. A positively identified lock yields `locked` and prevents credential stores or clears without asking the provider to unlock. The `unknown` introspection result is not treated as proof of an unlocked collection; providers without busctl support fall back to the original `secret-tool` status logic. The existing unlocked Nobara round-trip was operator-verified, but the locked desktop case has not been reported.

`scripts/verify-keyring-conditions.mjs` provides `inspect` (read-only default collection status and random nonexistent profile) and `unavailable` (an unreachable D-Bus address injected only into a child process). Neither operation locks, unlocks, stores nor clears existing secrets. The unavailable check must still be run on the real PC.

The opt-in legacy `vite/localContentPlugin.ts` static route now verifies real path containment and disallows file symlinks, malformed paths and cross-site requests. The static route hardening does not grant live write authority to the old Vite middleware. Full release findings: [Phase 2 security review](PHASE2_SECURITY_REVIEW_2026-11-04.md).


Legacy local admin/content mutation requests now require an explicit exact HTTP loopback Origin and reject `same-site` cross-origin Fetch Metadata requests; this is still not authorization against local same-user processes.

## Phase 2 — Offline Morkahja SSH trust preflight (2026-11-04)

`local-service/sshHostPreflight.mjs` performs a local-only OpenSSH known-host check for a Morkahja `postgres-ssh` profile. It requires an exact hostname entry in a dedicated user-owned, non-symlink, non-group/world-writable trust file, and verifies the entry is discoverable by `ssh-keygen -F`. No network request is made and no credentials are retrieved. The service routes this under existing authenticated `POST /local-connections-api/:id/test`; `vite/connectionAdapters.ts` grants offline `ssh:preflight` and separately operator-gated `ssh:probe`, but not persistent SSH Connect or general database reads. The profile remains `not-configured` even when a local entry is found. The separately approved probe now implements strict SSH host-key matching, a temporary tunnel and a fixed database health query; these are **not** enabled by default or verified against real Morkahja.

## Phase 2 — Profile editing, local lifecycle and browser session (2026-11-04)

`vite/connectionAdapters.ts` contains a static server-side project/adapter capability allowlist. Only Morkahja `local-files` has ungated read-only permissions; SSH health checks require private operator authorization. GitHub and publishing transports remain unavailable. Profile edits can change the name or target, not the project, adapter or credential UUID. A target change invalidates previous checks.

`local-service/connectionLifecycle.mjs` adds manual local Connect, Disconnect and Reconnect. A successful Connect only establishes an ephemeral in-process read-only status after a directory probe: it holds no file handles, opens no tunnel and grants no write permission. Remote connection operations return `ADAPTER_NOT_IMPLEMENTED`.

`vite/localSessionGuard.ts` validates the peer, Host, Origin, Fetch Metadata and an ephemeral, in-memory browser session token. The Vite proxy keeps its independent server-to-service key out of the browser and strips the UI session header. These checks reduce cross-site request risk but are not full authentication against arbitrary programs running as the same local OS user.

The operator-triggered `scripts/verify-keyring.mjs` checks a disposable synthetic credential round trip through Linux Secret Service. Automated keyring tests use a fake binary; the real Nobara keyring remains unverified.


## Phase 2 — Credential storage and health checks (2026-11-04)

The loopback service (`local-service/server.mjs`) now provides `GET /local-connections-api/health`, manual local-directory tests, and JSON inspection reports. Responses include a stable error code, timestamp and last complete success when applicable. Partial local inspection reports `degraded`. The actual Morkahja portraits file uses the case-sensitive `Avatar` property.

For future remote-profile credentials, `local-service/keyring.mjs` calls Linux Secret Service using the `secret-tool` executable. `scripts/credentials.mjs` collects credentials through a no-echo terminal prompt and sends them only via child-process stdin. The browser and non-secret XDG profile JSON receive no passwords, tokens or keyring values. The browser receives only `stored`, `missing` or `unavailable`. Keyring failure has no plaintext fallback. Remote profile removal clears the keyring entry before removing metadata.

The implementation is verified with a fake Secret Service process and disposable Morkahja JSON fixtures. An unlocked Nobara keyring, real SSH tunnel, GitHub authorization and live server connection have not been tested. A stored credential does not imply an active remote adapter or any permission to operate on a project.

## Current state (2026-11-03)

**Hardening update:** [Phase 1 hardening review](PHASE1_HARDENING_2026-11-03.md), validated by [CI run 41659550592](https://github.com/babunidev/babuni.admin/actions/runs/41659550592), adds server-only database configuration, locally guarded opt-in development endpoints, transactional moderation and session revocation, atomic file replacement/backups, representative legacy fixtures and browser-form verification. It does not provide authenticated production administration.

The [Phase 1 verification report](PHASE1_VERIFICATION.md) records the current architecture review and its production-release blockers; [CI run 41645348546](https://github.com/babunidev/babuni.admin/actions/runs/41645348546) verifies build, lint, nine source tests, nine isolated integrations and five browser tests. Source/mock verification does **not** establish safe production operations.

Babuni Admin remains a React 19, TypeScript and Vite 8 frontend with React Router, TanStack Query, Zustand and Tailwind CSS 4. The Morkahja domain has been partly isolated under `src/features/morkahja/`. The active layout, sidebar, UI state and navigation composition now live in `src/app/`. Reusable controls and formatting live in `src/shared/`, while Morkahja navigation and server-status display remain owned by `src/features/morkahja/`. App routing and configuration retain their established entry points. The temporary re-export files have been deleted, with imports now targeting feature and shared modules directly.

```text
src/
  App.tsx                     # legacy Morkahja routes + Babuni Dev overview
  features/
    morkahja/
      navigation.ts            # current Morkahja routes and labels
      pages/                  # dashboard, players, content
      components/             # domain UI and MorkahjaTopBar
      services/               # Morkahja domain data adapters
      types/                  # game and player types
      utils/                  # domain utilities
    babuni-dev/
      navigation.ts            # overview-only navigation
      pages/OverviewPage.tsx  # static placeholder; no content API
  app/                        # layout, URL-derived workspace switcher,
                              # sidebar, project-aware header, uiStore
  shared/
    components/               # PageHeader, Table, StatusBadge, ConnectionBanner
    utils/                    # generic formatting
  services/http.ts            # generic HTTP client
  types/index.ts              # foundational app data contracts
  config/                     # existing environment configuration
vite/                         # development-only privileged middleware
```

Morkahja's historical pages and adapters are implemented in source, but the build, lint and nine regression tests (including import resolution) passed after compatibility cleanup in [CI run 41565792784](https://github.com/babunidev/babuni.admin/actions/runs/41565792784); five Chromium rendered-browser smoke tests now pass in [CI run 41639215405](https://github.com/babunidev/babuni.admin/actions/runs/41639215405). Database and game-file integration verification remain missing. Frontend-only workspace switching and separate navigation now exist; a secure production API, workspace authorization and live content publisher do not.

## Workspace routing and current behavior

The sidebar reads `useLocation().pathname` and selects the active workspace from `src/app/navigation.ts`; switching navigates to its canonical home. `/babuni-dev` renders the non-editable Babuni Dev overview with a separate non-querying header. The original `/`, `/players`, `/players/:playerId`, `/content`, `/content/:kind/:itemKey` and `/settings` still render Morkahja. The Morkahja header retains its existing server and database status queries; Babuni Dev does not mount that header. Current navigation is **not** an authorization mechanism.

The eight source-level regression tests, TypeScript/Vite build and ESLint passed in [CI run 41563642755](https://github.com/babunidev/babuni.admin/actions/runs/41563642755) on commit `4f9b2ed`. No browser-driven end-to-end navigation, authenticated remote access, player mutation, or publishing was tested.

## Isolated Morkahja integration boundary

`tests/integration.spec.mjs` creates a unique directory under the operating system's temporary path, writes isolated copies of the five game-data JSON shapes, and exposes the actual Vite content/admin middleware through a localhost-only HTTP harness. The admin plugin's optional `AdminOperations` parameter injects in-memory fixture operations for tests; the default production-path behavior still uses `vite/postgresAdmin.ts`. No real PostgreSQL connection or project game directory is accessed.

The nine tests cover content reads/writes, player inspection/moderation responses, malformed bodies, WebP upload paths, missing data files, simulated read-only files, injected database faults, and explicit unsuccessful client acknowledgements. The content middleware now validates IDs, filenames, encoded WebP container shape and payload size (5 MiB limit). The administrative HTTP middleware maps `ok: false` to a non-success HTTP response. The client adapters reject explicit failure acknowledgements, and the moderation dialog shows mutation errors. [CI run 41644848938](https://github.com/babunidev/babuni.admin/actions/runs/41644848938) verified these changes.

**Not verified:** Actual PostgreSQL SQL queries, session invalidation consistency, complete transactional integrity, user-driven editor forms, safe rollback of disk writes, authentication, authorization or production deployment. The local Vite middleware must not be exposed as an authenticated production backend.

## Browser regression boundary

`tests/browser.spec.mjs` uses Playwright/Chromium against a `vite preview` build with `VITE_USE_MOCK_DATA=true`, `VITE_USE_LOCAL_CONTENT=false`, no remote API base, and no database URL. The five tests cover rendered navigation and headers, switching between project workspaces, direct Morkahja routes, browser back/forward, mobile sidebar visibility, and mock player table rendering. `tests/regression.test.mjs` remains the separate nine-test source and mock-data suite. GitHub Actions executes both. The UI visibility defect found by Chromium was fixed in `src/app/AdminLayout.tsx`.

These are not permission, backend, data-write, or real-world deployment tests. The Vite dev-only content middleware is not exercised by the production preview.

## Permanent deployment and trust boundary — clarified 2026-11-04

**Babuni Admin runs on the creative's own Nobara Linux PC.** The UI is an on-device browser page, currently at `127.0.0.1:5180`; the proposed privileged connection service is also a local-only process. Neither should be served through the VPS, a public hostname, a LAN-bound Vite server or a remote browser session.

The PC initiates **outbound** connections to remote project authorities: SSH-tunneled Morkahja PostgreSQL, GitHub HTTPS API, and scoped project/site publication endpoints where needed. The VPS and GitHub still enforce their own remote authentication. A local UI does not remove the need to protect credentials, local endpoints, file paths, origin checks and action permissions.

```text
Babuni's PC only
  React UI (loopback browser)
      ↓ local API (planned)
  Local connection manager / privileged service (planned)
      ├── OS keyring secret references
      ├── project-owned profiles and adapters
      ├── local Morkahja files
      └── authenticated outbound SSH / HTTPS
               ↓
       Morkahja VPS / GitHub / babuni.dev project services
```

The first independent local service now lives in `local-service/server.mjs`, started by `scripts/dev-local.mjs` with an ephemeral per-run key and bound to `127.0.0.1:5191`. Vite is its same-PC UI proxy, not the profile service itself. It currently provides only profile CRUD and local directory read-only checks; it is not a credential vault, SSH tunnel manager or production-grade multi-user authorization service.

The [shared connection-manager design](LOCAL_CONNECTION_MANAGER.md) specifies profile metadata, status lifecycle, candidate adapters, credential handling, UI states, and acceptance criteria. That document is **a design**, not a claim that the manager or new local service has been implemented.

### Existing code versus planned work

The existing React/Vite interface, Morkahja routes, local development middleware and browser fixtures are implemented and tested. `vite/localAdminPlugin.ts` and `vite/localContentPlugin.ts` remain local-development adapters; they are not the future reusable credential store or permanent connection manager. `DATABASE_URL` is read server-side in development and local game-file writes require opt-in. No general-purpose profile registry, keyring integration, SSH lifecycle manager or GitHub content/publishing connection has been implemented.

The planned local service must validate the browser origin and local session, enforce project-specific and operation-specific capabilities and connect to remote services with credentials inaccessible to the frontend. Loopback alone is not an authorization or CSRF defense. A connected endpoint, successful GitHub commit or started SSH tunnel must not be reported as a completed privileged operation without the remote result being verified.

### Publication semantics

For Babuni Dev, a future targeted document publish would fetch an allowlisted GitHub path, compare source revisions, validate and prepare the affected Markdown, preview/index and readable HTML/search assets, and publish those dependencies consistently. The local manager would initiate the process; remote publication permissions remain scoped. Actual website state must be checked rather than assuming a GitHub commit equals deployment.

### Historical security notes

The architecture material below is retained as a record of the earlier Morkahja console. Earlier suggestions to host a unified administration backend are **not** the selected Babuni Admin deployment model, and mentions of `VITE_DATABASE_URL` or `VITE_API_TOKEN` refer to superseded source. The permanent requirement is a private on-PC interface with outbound authenticated project connections.

## Historical architecture audit

# Morkahja Admin — system architecture and trust boundaries

**Source:** Actual `src/`, `vite/`, `vite.config.ts`, `package.json` inspected on 2026-10-26. **Static inspection, not deployment verification.**

## A local UI with several independent data adapters

```text
Browser on localhost:5180
  |
  +-- React Router -> AdminLayout / Dashboard / Players / Content / Settings
  |      TanStack Query (polling/caching + mutation invalidation)
  |      Zustand (sidebar state)
  |      src/services/adminApi.ts + contentApi.ts
  |
Vite dev server bound 127.0.0.1 (vite.config.ts)
  |
  +-- /local-admin-api -> vite/localAdminPlugin.ts
  |      -> vite/postgresAdmin.ts -> PostgreSQL (optionally via SSH tunnel)
  |
  +-- /local-content-api -> vite/localContentPlugin.ts
  |      -> MorkahjaWebApp/client/public/game/*.json and image folders
  |
  +-- /game and /UI -> local asset-serving middleware
  |
  +-- /api or configured path -> API_PROXY_TARGET remote VPS admin service
       -> server-side Authorization header only when ADMIN_API_KEY configured
```

The app can run in a **mock** mode, **local Postgres** dev mode or **remote admin API** mode, while content may independently use a local file adapter or external content API/static assets. Do not imply that “connected” means every subsystem is connected.

## Routes and components

Current `src/App.tsx` routes: `/`, `/players`, `/players/:playerId`, `/content`, `/content/:kind/:itemKey`, `/settings`. The sidebar mirrors four major areas: Dashboard, Players, Content, Settings. Earlier `logs`, `reports`, `world-state` scaffold routes were replaced during May 24 development and are not currently available.

- `DashboardPage.tsx` fetches live-style stats, online count and `ActivityFeed`, with approximately 5-second refresh.
- `PlayersPage.tsx` fetches player details, sorts online first and renders `PlayerModerationActions`. Modal confirmation is implemented for timeout/ban; unban has direct button activation.
- `ContentPage.tsx` uses tabs and detail/editor components for encounter, solution, expansion, frame and portrait records. Relations are resolved using utilities and game-specific types.
- `SettingsPage.tsx` displays configuration and PostgreSQL health but does not store/edit actual secrets from the browser.
- `src/services/mockState.ts`, `mockPlayerDetail.ts` make UI inspection possible without backend records.

## Admin data flow and authority

`src/config/api.ts` chooses mock mode based on flags/API URL. `src/config/constants.ts` chooses local Postgres when `import.meta.env.DEV` and a database URL is nonempty. `src/services/adminApi.ts` selects local SQL middleware, mock arrays, or `src/services/http.ts` backend requests.

**Important mode nuance:** If dev/Postgres player listing fails, `fetchPlayersWithMeta` may return labeled **sample** player rows with `isSample=true` and a DB error. Its moderation mutations are **not switched to mock merely because the list is showing samples**; in local Postgres mode they still call local middleware and may fail. This is a reason to keep connection-state labeling prominent.

The local PostgreSQL adapter can read players/sessions/avatars/achievements/events and apply timeout/ban/unban changes. Timeout/ban update `players.data` moderation fields, null active session references and delete all that player's sessions. Unban clears ban flag. Database query parameterization appears in selected SQL paths, but **that does not establish complete authorization, safe input validation, or transaction guarantees**.

The VPS endpoint list in README is a **client/API contract**, not evidence that the external backend routes exist or are authorized. The implementation of an external VPS admin server is **not in this repository**.

## Game content and files

`src/types/gameContent.ts` defines typed shapes for `encountersdata.json`, `solutiondata.json`, `expansiondata.json`, `frames.json`, `portraits.json`. Local plugin maps `/local-content-api/encounters`, `solutions`, `expansions`, `frames`, `portraits` and image-upload routes onto files in the external MorkahjaWebApp tree.

- Encounters / solutions: key-addressed objects, set through read/modify/rewrite.
- Expansions: entries in `expansions` object.
- Frames: `Frames[frameID]` array positions.
- Portraits: `Avatar[avatarID]` array positions.
- Images: base64 WebP for selected upload flows; encounter names can be derived from title + collision handling.

**These are direct filesystem writes** outside the admin repo, with no transactional multi-file save/rollback shown. The plugin is registered in Vite `plugins` regardless of `VITE_USE_LOCAL_CONTENT`; that flag controls front-end adapter selection, **not** server route availability.

In remote mode, content API behavior is not fully reconciled: `fetchPortraits` asks `/game/portraits` while the declared filename is `portraits.json`, and `fetchGameJson` uses fixed `/game/<file>` rather than the configured game-data URL. Treat as source-level inconsistencies until reproduced.

## Trust-boundary findings for follow-up

**Risk / test item, not a demonstrated external exploit:**

1. `VITE_DATABASE_URL` is referenced in frontend `import.meta.env`. By Vite convention, prefixed variables are browser-exposed. Any real DB credentials entered there require immediate reassessment; move secret config server-side.
2. `VITE_API_TOKEN` is used to construct browser `Authorization` headers; an admin key belongs in a protected server environment, not frontend code.
3. Local SQL and content middleware contain no independent operator-authentication layer, relying on development-server isolation. They should not be network-published.
4. Upload routes accept client-supplied filenames/base64 data with insufficient visible path/size/type confinement. The file-serving helper also deserves a dedicated boundary review; do not expose until hardened.
5. Local middleware returns some raw error messages that may contain operational details.
6. No server-side moderation audit actor, rate limit or role check is demonstrated in this repo.
7. Mock fallback can conceal an unavailable database if operators ignore the sample-data banner.
8. Server status labels and 5-second refreshes are not substitutes for successful connection/write tests.

The actual environment, network binding beyond the checked Vite config, and backend authorization were not tested in the current audit.

## Configuration recheck — audit #38 (2026-10-28)

`vite.config.ts` currently binds development and preview hosts to `127.0.0.1`, with respective default ports 5180 and 4180. The local-content middleware is registered unconditionally, while `morkahjaLocalAdminPlugin` is added only if `VITE_DATABASE_URL` has a value. The remote proxy can inject `ADMIN_API_KEY` on server-side forwarded requests. These configurations **do not themselves establish operator authorization** for local content or database mutation endpoints.

`package.json` exposes `dev`, `build`, `lint` and `preview` scripts with version `0.0.0`; no `test` script is defined. This review did not run any command or inspect actual environment values. Previously listed credential-exposure and file-write concerns remain open, rather than being newly discovered incidents.
