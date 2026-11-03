# Babuni Admin — Architecture

## Current state (2026-11-03)

Babuni Admin remains a React 19, TypeScript and Vite 8 frontend with React Router, TanStack Query, Zustand and Tailwind CSS 4. The Morkahja domain has been partly isolated under `src/features/morkahja/`. The active layout, sidebar, UI state and navigation composition now live in `src/app/`. Reusable controls and formatting live in `src/shared/`, while Morkahja navigation and server-status display remain owned by `src/features/morkahja/`. App routing and configuration remain at their existing entry paths; transitional re-export files retain old imports during the migration.

```text
src/
  App.tsx                     # legacy Morkahja routes + Babuni Dev overview
  layouts/                    # transitional compatibility export
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
  components/, services/,
  types/, utils/              # existing shared files and transition exports
vite/                         # development-only privileged middleware
```

Morkahja's historical pages and adapters are implemented in source, but the build, lint and six source-level tests passed in GitHub Actions for the shell extraction; browser and database verification are still missing. Frontend-only workspace switching and separate navigation now exist; a secure production API, workspace authorization and live content publisher do not.

## Workspace routing and current behavior

The sidebar reads `useLocation().pathname` and selects the active workspace from `src/app/navigation.ts`; switching navigates to its canonical home. `/babuni-dev` renders the non-editable Babuni Dev overview with a separate non-querying header. The original `/`, `/players`, `/players/:playerId`, `/content`, `/content/:kind/:itemKey` and `/settings` still render Morkahja. The Morkahja header retains its existing server and database status queries; Babuni Dev does not mount that header. Current navigation is **not** an authorization mechanism.

The eight source-level regression tests, TypeScript/Vite build and ESLint passed in [CI run 41563642755](https://github.com/babunidev/babuni.admin/actions/runs/41563642755) on commit `4f9b2ed`. No browser-driven end-to-end navigation, authenticated remote access, player mutation, or publishing was tested.

## Proposed platform design (not implemented)

```text
Authenticated Babuni Admin UI
  |-- Morkahja workspace      -> scoped game operations service
  |-- Babuni Dev workspace    -> scoped GitHub/content publishing service
  |-- Future workspaces       -> isolated project capabilities
  |
Protected administration API
  |-- identity / sessions / project authorization
  |-- validation / audit / revision comparisons
  |-- GitHub connector / publication jobs
  |-- isolated game DB and file adapters
```

For Babuni Dev, a targeted document publish would fetch an allowlisted GitHub path, compare revisions, validate and prepare affected Markdown and preview/index assets, regenerate any dependent readable HTML/search artifacts, and publish the coherent set atomically. Server-side publication status and rollback must be visible to the operator. Editing through the admin must commit back to GitHub under an authorized identity rather than silently diverging from the repository.

## Security boundary

The currently present Vite plugins `vite/localAdminPlugin.ts` and `vite/localContentPlugin.ts` are local-development facilities, **not** authenticated production services. `VITE_DATABASE_URL` and `VITE_API_TOKEN` appear in browser-side configuration and are unsafe for secret credentials. Morkahja moderation/database permissions must never be inherited by a portfolio-content capability. External filesystem writes, file uploads and moderation operations need validation, audit and safe recovery before deployment.

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
