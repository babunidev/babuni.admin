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
