# Morkahja Admin — local game operations console

**Creator / creative director:** Babuni.dev  
**Repository / npm package:** `arcanitebrothers`  
**App title:** **Morkahja Admin**  
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
