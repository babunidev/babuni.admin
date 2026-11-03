# Phase 1 hardening — verification and outstanding boundaries (2026-11-03)

**Work:** [Draft pull request #1](https://github.com/babunidev/babuni.admin/pull/1) on `hardening/phase1-security-and-fixtures-2026-11-03`. Tested at commit `3175804` in [GitHub Actions run 41659550592](https://github.com/babunidev/babuni.admin/actions/runs/41659550592). These changes are not proof of production safety.

## Implementation and evidence

| Workstream | Verified result | Main files |
|---|---|---|
| Compatible dependency fixes | `npm audit`: 23 → 12 affected packages; 8 → 0 high; `--omit=dev`: 6 → 0. Remaining 12 are moderate tooling advisories. Build/lint/tests passed without forced major upgrades. | `package-lock.json` |
| Disposable PostgreSQL queries | Four tests against PostgreSQL 16 CI service: player listing, online session, detail, avatar, dashboard, events, timeout, ban, unban, missing account. | `tests/postgres.spec.mjs` |
| Moderation atomicity | The player data update and all-session deletion now use one `BEGIN/COMMIT` transaction and row lock; a deliberately failing session-delete trigger proves rollback leaves prior player and session rows intact. | `vite/postgresAdmin.ts` |
| Rendered editors | Five Chromium tests (new fixture suite) exercise encounter, solution, expansion, frame and portrait saves; a rejected save stays rejected in the UI; PNG upload converts to decodable WebP. | `tests/browser-content.spec.mjs` |
| Legacy game-data compatibility | Five compact JSON snapshots from [Morkahja source commit](https://github.com/babunidev/Morkahja/commit/239cf21ed759cf12137e68ae41a85a0a26382fb9), preserving original field names and metadata, are used for HTTP and browser edit scenarios; a pinned original WebP asset is decoded by Chromium. | `tests/fixtures/legacy/`, browser fixture CI |
| File write recovery | Same-directory temp writes and fsync, versioned backups before replacement, atomic rename, explicit restore helper; tests cover backup/restore, directory permission errors and symlink targets. | `vite/atomicGameWrites.ts` |
| Local endpoint hardening | Vite admin/content endpoints reject nonloopback peers and cross-origin requests; an 8 MiB body limit rejects oversized requests. Content middleware, game filesystem access and dev proxy are opt-in, and DB URL is server-only. | `vite/localRequestGuard.ts`, `vite.config.ts`, `src/config/constants.ts` |

The complete CI run passes the TypeScript/Vite build, ESLint, **9 source**, **14 isolated middleware**, **4 real disposable PostgreSQL**, **5 original browser**, and **5 content-editor/browser-image** tests — **37 automated tests in total**. The audit job reports vulnerabilities but is nonblocking; a successful audit job means it ran, not that the dependency tree has zero findings.

## Local configuration migration

The following opt-ins are intentionally required for privileged development behavior:

```dotenv
# Local PostgreSQL: server-only password and explicit browser mode indicator
DATABASE_URL=postgresql://operator:REPLACE_ME@127.0.0.1:5433/morkahja
VITE_USE_LOCAL_POSTGRES=true

# Local game files: both server and UI must be enabled
MORKAHJA_PUBLIC=/absolute/path/to/MorkahjaWebApp/client/public
VITE_USE_LOCAL_CONTENT=true
LOCAL_CONTENT_WRITES=true

# Optional development proxy, not safe for public exposure
# LOCAL_ADMIN_PROXY_ENABLED=true
```

Do not set `VITE_DATABASE_URL`, `VITE_API_TOKEN` or `VITE_MORKAHJA_PUBLIC` for new setups; those browser-visible data/secret paths are no longer used in the current source. A client-side API token forwarding helper was removed. The application and preview remain loopback-only by default.

## Remaining limitations

- **No production authentication or permission enforcement.** Loopback/same-origin guards mitigate some accidental exposure; they do not authenticate a local operator or make the Vite server safe to publish.
- The disposable PostgreSQL schema covers specific adapter queries, not the exact full live schema, production credentials, real account data, concurrency at production scale or a deployed service.
- The legacy JSON fixtures are a **representative sample**, not an exhaustive schema validation of all records. A pinned original WebP and newly generated WebP both decode in Chromium; other legacy image variants are not exhaustively checked.
- The atomic writer protects against many interrupted writes and retains uniquely named backups. Backup retention/space controls, automatic recovery, migration strategy, directory fsync portability and concurrent writers remain open.
- The npm production-scope audit has zero findings, but **12 moderate lint/tooling advisories remain**. Their applicability and compatible resolution need a separate toolchain change; do not use `npm audit fix --force`.
- Actual user authorization, action audit logs, backup policy, secure standalone backend and remote deployment remain Phase 2 work. No live player database, VPS or game directory was modified for these tests.

**Disposition:** The requested Phase 1 hardening checks are implemented and verified within the scope above. This is a reviewable development change, not a release approval.
