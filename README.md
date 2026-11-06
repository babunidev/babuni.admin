# Babuni Admin

**Morkahja statistics expansion:** The operator deployed and verified the Batch A aggregate view. The local Overview supports achievement and non-default dice/expansion ownership cards with explicit field approval and unavailable states. Enable the separate metric list in the existing private configuration; no repeat database migration is needed. [Setup and verification](docs/MORKAHJA_READ_ONLY_DASHBOARD.md) · [Metric definitions](docs/MORKAHJA_OVERVIEW_METRICS.md). Nobara verification of the new cards remains pending.


**Browser and visual identity:**
**SSH login setup (opt-in):** To load the approved Morkahja SSH identity into the **existing** KDE/Nobara agent at graphical login, an optional helper is available. It does not store passphrases, start another agent, change server permissions or install itself automatically. Explicit installation: `python3 scripts/ssh-agent-login.py install`; verification: `python3 scripts/ssh-agent-login.py status`; removal: `python3 scripts/ssh-agent-login.py uninstall`. [Setup and limitations](docs/SSH_AGENT_DESKTOP_LOGIN.md).

 The tab title and shared sidebar say **Babuni Admin**, with the same 64×64 WebP favicon used by the Babuni Dev website (`public/favicon.webp`). Morkahja remains one workspace inside the application. The icon is reused without modification; the app remains local-only.


**Creative direction:** Babuni  
**Repository:** `babunidev/babuni.admin`  
**Current focus:** Structural transition from a local Morkahja administration console into a multi-project administration platform.

**Deployment boundary:** Babuni Admin is a single-user application that runs on Babuni's own PC. Its UI remains on loopback (`127.0.0.1`), not on a hosted website or VPS. It initiates protected outbound connections from the PC to remote project services; those services independently authenticate and authorize access. The connection manager has a **non-secret profile registry and Connections screen**, backed by a separate loopback-only local Node service during development. Read-only local directory and content checks are available. Non-local profiles may store credentials in the Linux OS keyring using a terminal-only command, and a separately configured Morkahja-only SSH/PostgreSQL **health probe** is now implemented but disabled by default. A real SSH/database health probe was subsequently observed on the operator's Nobara PC. A separately authorized, manual read-only Morkahja data dashboard has now been added. Operator screenshots on 2026-11-04 confirmed successful live overview and player-preview reads through the restricted PostgreSQL views. GitHub and remote editing/publishing remain unimplemented.

Babuni Admin is planned as one private workbench for maintaining multiple projects. **Morkahja** is the existing functional domain: its dashboard, player moderation, activity views and game-content editors remain in source. **Babuni Dev** is the next proposed workspace, intended to manage GitHub-backed portfolio documents and publish individual content updates without rebuilding the whole website. Additional project workspaces may be introduced later.

The current frontend uses React 19, TypeScript, Vite 8, React Router, TanStack Query, Zustand and Tailwind CSS 4. Morkahja-specific code now lives in `src/features/morkahja/`, shared controls in `src/shared/`, and the application shell in `src/app/`. The transitional re-export files have been removed and direct imports verified in CI. The Babuni Dev workspace has a navigable overview but no editor or publishing capability. There is **no deployed unified backend or working Babuni Dev content manager yet**.

## Local development
### Restricted Morkahja database views

After the operator verified the first live data request failed with missing table SELECT privileges, the PostgreSQL database was updated **by the operator** to expose two owner-controlled views under `babuni_admin_ro`. The `babuni_admin_probe` account can SELECT those views but cannot SELECT the underlying players or sessions tables. The new `/read-only` adapter queries `babuni_admin_ro.overview` and `babuni_admin_ro.player_preview` only, with bounded pagination and strict privilege checks. No database credentials or raw player documents enter the browser. [View contract](docs/MORKAHJA_READ_ONLY_DASHBOARD.md).

**Observed:** The operator verified view creation, a nonempty preview count, and restricted role privileges on the Ubuntu server. **Live verification:** Operator screenshots now confirm successful overview and player preview results on Nobara: 62 players, 90 avatars, 0 active sessions, and 0 recent events at the observed check. Pagination navigation, activity-count reconciliation and failure recovery remain to be tested.



### Morkahja Overview — saved read-only connection

The private **Overview** is now the Morkahja landing page (`/`). Once an approved Morkahja PostgreSQL/SSH profile has been selected, the browser remembers only its local UUID and reloads the overview and player preview together when the page opens. A single manual **Refresh overview and players** also reloads both, and next/previous player pages retain independent bounded reads. The connection selector sits below the overview and player list. Existing `/read-only` remains available; the previous dashboard is preserved at `/dashboard` but is no longer the primary navigation destination. The existing `/players` page is labeled **Moderation** to distinguish legacy privileged controls from the view-only overview.

The counts now include **Players online*** as a clearly labeled **session-based estimate**, derived from the existing active-session count; a valid session is not proof of a live websocket or multiplayer room. More accurate presence, rooms, achievements, gems, and expansion/dice unlock or purchase counts require separately approved, narrowly scoped aggregate database views. No new server-side grants were performed in this UI update. See [view contract](docs/MORKAHJA_READ_ONLY_DASHBOARD.md).

### New Morkahja read-only dashboard

The **Read-only** item in the Morkahja workspace opens `/read-only`, separate from the original dashboard and player administration. It displays a manually requested overview (players, avatars, active sessions and 24-hour event count) and paginated player previews containing only display name, avatar count and last-played timestamp. These views use fixed SELECT-only SQL, bounded results and a temporary SSH tunnel; no automatic polling, arbitrary SQL or content writes are enabled. Even with a successful SSH health probe, actual data reads require an **additional operator-owned config opt-in** and exact approved fields. [Read-only dashboard specification and activation](docs/MORKAHJA_READ_ONLY_DASHBOARD.md).


Use `npm run dev` on your PC. It launches Vite on `127.0.0.1:5180` and the separate profile service on `127.0.0.1:5191`. The service requires a randomized per-run key attached by the server-side Vite proxy. The browser does not receive that key. Stop both with Ctrl+C. Profiles remain in the local XDG config directory. `npm run dev:ui` starts only Vite and cannot manage the profiles.

### Local credentials and health (Linux)

Credentials for future remote profile types can be stored via Linux Secret Service (`secret-tool`) from a **hidden terminal prompt**, without sending credentials through the browser. The PC needs the `secret-tool` utility (typically provided by `libsecret`) and an accessible, unlocked user keyring. Missing or locked keyrings fail without plaintext fallback.

```bash
npm run credentials -- list
npm run credentials -- set <profile-uuid>
npm run credentials -- status <profile-uuid>
npm run credentials -- clear <profile-uuid>
```

Local-file profiles do not require credentials. Storing a credential for a remote-type profile does **not** connect to SSH, GitHub, PostgreSQL or any live server; no connection by itself. A separate Morkahja read-only health probe is implemented but requires private operator approval and is disabled by default; GitHub and publishing transports remain unimplemented. Existing SSH private keys should normally stay managed by an SSH agent, not be pasted into this command. The credential is sent only through stdin to `secret-tool`, never in command arguments, browser state or the non-secret connection JSON file. Removing a remote profile attempts keyring cleanup before deleting the profile; if the keyring cannot be reached, removal fails safely.

The Connections screen reports loopback service and keyring availability, checked timestamps, last complete success, file-specific errors and degraded/available/error local inspection states. Profiles can now be edited without changing their project or adapter identity, and local-file profiles support manual read-only Connect, Disconnect and Reconnect. A service restart clears ephemeral check history; no background remote connection is attempted.

`npm run test:connections` exercises synthetic keyring and file fixtures. These tests do not verify a real unlocked Nobara keyring, SSH tunneling or remote project access.

A safe operator-triggered desktop check is available:

```bash
npm run keyring:verify
```

It generates a temporary synthetic secret, stores it in the Linux Secret Service, privately compares the retrieved value, and attempts cleanup. It does not access existing project secrets. Run it only from the unlocked Nobara desktop session; a locked or unavailable keyring should fail without plaintext fallback. A cleanup warning means the test item could not be confirmed removed.

The Vite proxy additionally requires an ephemeral in-memory browser session capability and checks the local Host, Origin and Fetch Metadata before forwarding to the service. Its independent service key remains server-side. This reduces browser cross-site risk but does not authenticate arbitrary programs running as the same OS user.

### Morkahja SSH — offline trust check and disabled-by-default read-only health probe

The `postgres-ssh` profile's **Test** button now checks the presence of an exact public server host-key entry in a dedicated trust file. It **does not connect to the VPS or PostgreSQL**, compare a live server key, unlock credentials or permit edits.

```bash
# These commands only prepare an empty local trust file.
mkdir -p -m 700 ~/.config/babuni-admin
touch ~/.config/babuni-admin/ssh_known_hosts
chmod 600 ~/.config/babuni-admin/ssh_known_hosts
```

Before adding any line, independently confirm the **actual Morkahja server's SSH host-key fingerprint** through a trusted administrative channel. Add the exact `hostname keytype base64-public-key` known-hosts entry manually; never treat the output of an unauthenticated `ssh-keyscan` as verified identity. The profile's `target` is the hostname only, not a URL, port, command, user or password. Current offline preflight assumes a single exact hostname entry and does not configure a custom SSH port.

The status `SSH_HOST_KEY_PINNED_OFFLINE` means a local candidate trust entry exists and OpenSSH recognizes it; **it does not mean the fingerprint is independently verified or a tunnel is established**. The regular Connect and Inspect operations remain denied. A separate manually invoked, operator-gated SSH + DB health probe can execute one fixed metadata-only, read-only PostgreSQL transaction; it does not allow arbitrary SQL, player inspection or writes. See [operator configuration and release gates](docs/MORKAHJA_SSH_READONLY_PROBE.md). See [local connection manager](docs/LOCAL_CONNECTION_MANAGER.md).

### Keyring failure diagnostics and security release boundary

The application now inspects the Linux Secret Service default collection's lock property **without unlocking or reading existing credentials**. A confirmed lock prevents credential operations. Providers without a readable lock property remain `unknown`; this is not proof of an unlocked keyring. The inspection command skips credential lookup in that case to avoid an unlock prompt.

```bash
npm run keyring:inspect
npm run keyring:verify-unavailable
```

The first command reports the real collection state using read-only checks. The second checks fail-closed behavior with a deliberately unreachable D-Bus address **only in a child process**, leaving the existing desktop keyring and session unchanged. A real locked-state verification still requires an operator to temporarily lock the default collection through their desktop's keyring manager; no script performs that action. Locking the regular keyring can interrupt other applications.

The legacy opt-in Morkahja static asset middleware has additional canonical path/symlink and cross-site controls. This does **not** authorize legacy admin or content writes against live projects. See the [Phase 2 security review](docs/PHASE2_SECURITY_REVIEW_2026-11-04.md) for tested boundaries and outstanding release blockers.

## Project documentation

- [Concept](CONCEPT.md)
- [Roadmap and verification status](ROADMAP.md)
- [Development journal](docs/DEVLOG.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Local connection manager — design](docs/LOCAL_CONNECTION_MANAGER.md)
- [Morkahja SSH/PostgreSQL read-only health probe](docs/MORKAHJA_SSH_READONLY_PROBE.md)
- [Morkahja read-only data dashboard](docs/MORKAHJA_READ_ONLY_DASHBOARD.md)
- [Decisions](docs/DECISIONS.md)
- [Multi-project migration record](docs/MULTI_PROJECT_ARCHITECTURE.md)
- [Changelog](CHANGELOG.md)
- [Testing guide](docs/TESTING.md)
- [Phase 1 verification and risks](docs/PHASE1_VERIFICATION.md)
- [Dependency vulnerability audit](docs/DEPENDENCY_AUDIT_2026-11-03.md)
- [Phase 1 hardening report](docs/PHASE1_HARDENING_2026-11-03.md)

## Safety and verification

This application can interact with sensitive Morkahja player data and game files when configured. Its existing Vite-local APIs are **not** a secure public administration backend; browser-visible `VITE_` configuration must not contain secrets. Do not deploy privileged Vite middleware publicly. The current source passed TypeScript/Vite build, ESLint, nine source tests, nine isolated middleware integration tests and five Chromium browser tests in [CI run 41645348546](https://github.com/babunidev/babuni.admin/actions/runs/41645348546). Disposable PostgreSQL and isolated game-content fixture tests now pass on the hardening branch; real production systems and authenticated backend security remain unverified. See [hardening report](docs/PHASE1_HARDENING_2026-11-03.md). No live database operation, game-file mutation or deployment was performed by the latest documentation work.

## Historical note

The following earlier Morkahja documentation is retained as a historical account of the previous implementation. References to `VITE_DATABASE_URL`, `VITE_API_TOKEN`, unconditional content middleware registration and the old test count describe **past source**, not the current hardened branch. The source of truth for current setup is [the hardening report](docs/PHASE1_HARDENING_2026-11-03.md).

## Earlier Morkahja-specific documentation

# Babuni Admin — local game operations console

**Creator / creative director:** Babuni.dev  
**Repository:** `babunidev/babuni.admin`
**Historical npm package name:** `arcanitebrothers`
**Current project name:** **Babuni Admin**
**Existing application UI title:** **Morkahja Admin**
**Stack:** React 19, TypeScript, Vite 8, React Router, TanStack Query, Zustand, Tailwind CSS 4  
**Status:** Source-backed development tool; not independently executed or security-audited during the 2026-10-26 documentation review.

Morkahja Admin is a **local-browser control surface** for operating and developing the separate Morkahja game. It brings player inspection and moderation, online/activity reporting, and editing of game JSON and artwork into one dark, compact interface. The creative direction is an **atmospheric tool that stays readable and practical**, not a conventional SaaS dashboard.

**Important: this is an administrator's application, not a public player portal.** With live connections it can change player moderation state and rewrite game content files. Treat access to the development server, backend credentials, database, and the game-data directory as privileged.

## What exists in the current code

| Screen | Implementation |
| --- | --- |
| **Dashboard** (`/`) | Online, timed-out and banned counts, recent-event count, activity feed; React Query refreshes every **5 seconds** for dashboard/online/activity queries. |
| **Players** (`/players`) | All player records, online-first sorting, profiles/details (avatars, achievements, recent encounters), moderation actions: timeout, ban, unban. |
| **Content** (`/content`) | Browse/edit or add encounters, solutions, expansions, avatar frames and portraits; link encounters to solution and expansion data; image upload/edit workflows in local-content mode. |
| **Settings** (`/settings`) | Shows connection source, content source and theme information; 10-second PostgreSQL health poll when local DB mode is configured. Most configuration values come from environment variables, **not editable settings controls**. |

This repo initially had a broader placeholder admin scaffold for logs, reports and world state. Those are **not current navigation routes**; the May 24 revision refocused the shell on the four screens above. Do not describe removed prototype pages as present functionality.

## Start safely with sample data

```bash
npm install
npm run dev
```

The Vite development server binds **127.0.0.1** and normally serves **http://127.0.0.1:5180** (`DEV_PORT` can override). Use the browser on the same trusted machine. The preview also binds loopback, default port **4180**.

For UI exploration without a real backend, place nonsecret settings in a gitignored `.env.local`:

```dotenv
VITE_USE_MOCK_DATA=true
VITE_API_BASE_URL=
VITE_USE_LOCAL_CONTENT=false
```

**Note:** `VITE_USE_LOCAL_CONTENT=false` changes the browser's content API choice but **does not unregister** the local-content Vite middleware. Its file endpoints are mounted in development regardless; do not treat that flag as a security boundary. Content tabs may require a separately provided game-data source even when player mock mode works.

To build or lint, the package defines `npm run build` and `npm run lint`. **Neither was run during this documentation audit**; no test command or automated test suite was found in the inspected tree.

## Three distinct data paths

### 1. Mock records for UI design

When `VITE_USE_MOCK_DATA=true`, the player/server/activity service can return sample values from `src/services/mockState.ts` and `mockPlayerDetail.ts`. In development, player-list database failures may also show **labeled sample data** so the screen remains viewable. Sample records are **not proof of a live player connection**, and the fallback should not be confused with a successful moderation write.

### 2. Privileged player and activity data

Two server-backed approaches exist in source:

- **Local PostgreSQL through Vite middleware:** `vite/localAdminPlugin.ts` mounts `/local-admin-api` when a database connection variable is supplied, using `vite/postgresAdmin.ts` for actual queries and moderation writes.
- **VPS admin API:** `src/services/http.ts` talks to a configured backend. A **server-side Vite proxy**, when configured, can inject `Authorization: Bearer ...` using a private `ADMIN_API_KEY` environment variable; a browser-direct alternative exists but requires correct backend authorization.

**Credential safety warning:** The present PostgreSQL mode is wired to `VITE_DATABASE_URL`, and the frontend explicitly reads that `VITE_`-prefixed variable. In Vite, `VITE_` variables can be exposed to browser code. **Do not enter real database credentials in that variable or rely on this mode with sensitive data until the server-only configuration boundary has been corrected and the output inspected.** Prefer properly authenticated server-side access and keep tokens outside browser-bundled environment values. Similarly, `VITE_API_TOKEN` is read in browser HTTP code, so it is **not a secret-safe place** for an administrator key.

The source's PostgreSQL moderation paths **update player records and revoke active sessions** on timeout and ban. That is real behavior, not a visual-only placeholder, when connected to a live DB. Authorization, audit logging, transaction safety, operator identity and server-side role checks require independent review before production use.

### 3. Game JSON and images

In development, the local content plugin exposes the **separate MorkahjaWebApp** public game/UI directories through `/game`, `/UI` and `/local-content-api`. A configured `VITE_MORKAHJA_PUBLIC` points to the external `client/public` directory. It reads/writes:

```text
MorkahjaWebApp/client/public/
├── game/
│   ├── encountersdata.json
│   ├── solutiondata.json
│   ├── expansiondata.json
│   ├── frames.json
│   ├── portraits.json
│   ├── encounterimages/
│   └── solutionimages/
└── UI/
    └── ...  (expansion, portrait and frame images)
```

These **game assets are not committed in this admin repository**. Saving through the local plugin modifies files **outside this Git repository**. Back them up or use version control in the *game* repository before editing. The plugin's write routes do not contain an independent authentication check or a complete upload-path allowlist; use only in a trusted local development environment. **Do not expose the Vite development server, proxy, database tunnel or local-content API to untrusted networks.**

The source also contains nonlocal content API functions. Their external server implementations are not contained here; the README's earlier endpoint table is a desired contract, **not proof those VPS routes are deployed**.

## Key commands and source layout

```text
src/
  App.tsx                     # dashboard / players / content / settings routes
  pages/                      # page flows, queries and mutations
  components/                 # tables, modals, detail panels and editors
  services/                   # admin data, mock sources, HTTP and content API
  config/                     # mode and URL decisions
  types/                      # player and game-data shapes
  utils/                      # labels, content relationships, image conversion
vite/
  localAdminPlugin.ts         # DEV middleware exposing PostgreSQL admin API
  postgresAdmin.ts            # DB queries and moderation writes
  localContentPlugin.ts       # DEV file reads/writes and asset serving
  encounterImageNaming.ts     # encounter-image slug/collision handling
vite.config.ts                # server binding, proxies and plugins
```

Morkahja Admin stores navigation/sidebar state in Zustand and uses TanStack Query for caching, polling and invalidation after writes. Its visual language is nearly black, slate, subdued gold/bronze, parchment and an unobtrusive grain layer. See [the design record](docs/DESIGN.md).

## Known limits that matter

- **Development environment is not an authorization system.** Localhost binding reduces exposure but does not prove localhost endpoints are safe against other local clients or cross-origin browser requests.
- The local-content plugin is registered in dev even when the UI's local-content toggle is off; its upload filenames and request-body limits need review.
- Server-proxy credentials are safer than `VITE_` client-visible credentials, but backend permission checks are still mandatory.
- Database connectivity can fail while some screens show sample data; a separate “server status” label is not a successful write test.
- The nonlocal `fetchPortraits` code requests `/game/portraits` instead of `/game/portraits.json`, and the fallback game JSON fetch helper uses fixed `/game/` paths. Confirm remote content mode behavior before claiming it works.
- Only source/commit evidence was examined here. No live players were accessed, no database queried, no real moderation executed and no game files edited.

## Documentation and attribution

- [Concept](CONCEPT.md) · [Design system](docs/DESIGN.md) · [Content schemas](docs/CONTENT.md)
- [Architecture and security boundaries](docs/ARCHITECTURE.md) · [Decisions / options](docs/DECISIONS.md) · [Development journal](docs/DEVLOG.md)
- [Roadmap and testing](ROADMAP.md) · [Changelog](CHANGELOG.md)
- [AI collaboration and provenance](docs/AI_COLLABORATION.md) · [Developer instructions](AGENTS.md)

The creator's vision and the project's code history are documented separately from this AI-assisted analysis. Source features are marked **implemented**, not **tested** or **production approved**.

## Documentation continuity check — audit #38 (2026-10-28)

This repository already received a detailed eleven-file documentation audit on October 26. The present follow-up **does not replace that history**. It verifies the key project boundary against current source: the application is **Morkahja Admin**, while `arcanitebrothers` is the package/repository name; the interface is a privileged local development tool, not a public player portal. The package presently declares version `0.0.0` and exposes `dev`, `build`, `lint` and `preview` scripts, but no standalone automated test script.

**Security remains open:** `vite.config.ts` unconditionally registers the local-content middleware; the local PostgreSQL admin middleware is registered when `VITE_DATABASE_URL` is configured. Neither browser-visible `VITE_` secrets nor the localhost binding should be treated as an access-control policy. No live service, content directory or database was accessed during audit #38.

## Public repository preparation — 31 October 2026

The standard documentation is maintained in this actual project repository. See [publication preparation](docs/PUBLISHING.md) for the current review, remaining permissions and migration order. Visibility has not changed.
