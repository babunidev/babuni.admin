# Testing Babuni Admin

## Verified CI checks

GitHub Actions runs the TypeScript/Vite build, ESLint, nine source-level regression checks and nine isolated Morkahja integration tests on every push to `main` and pull request. A separate Ubuntu 24.04 job builds a mock-only preview and runs five Chromium browser scenarios. The complete latest verified run is [41645348546](https://github.com/babunidev/babuni.admin/actions/runs/41645348546); see also [Phase 1 verification scope and gaps](PHASE1_VERIFICATION.md).

The browser suite covers:
- Babuni Dev overview and project-specific header/navigation
- Workspace switching and browser back/forward history
- Existing Morkahja pages at `/`, `/players`, `/content`, `/settings`
- Mobile navigation opening and closing, including hidden controls
- Mock player table and shared page-header rendering

The isolated integration suite verifies simulated moderation and HTTP writes only. This is **not** a test of real PostgreSQL operations, production game files, authentication, production APIs or remote content publication.

## Local source-level checks

```bash
cd /home/babuni/Projects/babuni.admin
npm ci
npm run build
npm run lint
npm test
npm run test:integration
```

## Local Chromium browser tests

The browser package is installed only for the browser suite, not added to the application lockfile. On Nobara Linux the Chromium system dependencies may need to be installed separately if they are missing.

```bash
cd /home/babuni/Projects/babuni.admin
npm ci
npm install --no-save --package-lock=false playwright@1.56.1
npx playwright install chromium
VITE_USE_MOCK_DATA=true VITE_USE_LOCAL_CONTENT=false VITE_DATABASE_URL='' VITE_API_BASE_URL='' npm run build
npm run preview -- --host 127.0.0.1 --port 4180
```

With that preview running, use a second terminal:

```bash
cd /home/babuni/Projects/babuni.admin
npm run test:browser
```

Browser tests default to `http://127.0.0.1:4180`. Override with `BROWSER_TEST_BASE_URL` only when pointing to a controlled **mock-only** preview. Do not run this test suite against a live administration backend or an instance with privileged development middleware enabled.

The source-level `npm test` command does not require Chromium and remains independent of the browser suite.

## Isolated game-content and moderation integration tests

Run `npm run test:integration` after `npm ci`. This test needs no browser installation, SSH tunnel, remote API, real game folder or database. It uses a temporary directory under the OS temp location and removes it afterwards; fake player operations are injected into the same local admin middleware handlers used by the Vite workbench.

It checks player lookup and timeout/ban/unban, invalid inputs and database exceptions, create/read of encounter/solution/expansion/frame/portrait fixtures, WebP uploads and unsafe filenames, missing files and write permission failures. It also checks client rejection of HTTP 200 responses that explicitly report `ok: false`.

**Limits:** The injected database service does not execute PostgreSQL SQL or revoke real sessions. These tests do not click the rendered game-content editor or verify production authentication, rollback or atomic transaction guarantees. Never point this suite at real player/game data.

## Dependency vulnerability audit

GitHub Actions includes a separate nonmutating `audit` job, which runs `npm audit --json` and `npm audit --omit=dev --json` against the committed lockfile. The audit job reports findings without automatically altering dependencies or blocking existing build/test workflows while remediation is planned. See [the 2026-11-03 findings](DEPENDENCY_AUDIT_2026-11-03.md) and [audit run 41654264717](https://github.com/babunidev/babuni.admin/actions/runs/41654264717). A green audit job means the assessment command ran successfully, **not that dependencies are free of advisories**.

## Expanded Phase 1 hardening suite (2026-11-03)

The hardening review branch adds `npm run test:postgres` (requires an explicit localhost `TEST_DATABASE_URL` pointing to a **disposable database named `babuni_fixture`**) and `npm run test:browser:content` (requires an explicitly configured local-only, temporary Morkahja game-content fixture server). **Never run the PostgreSQL test against a real database**: it creates and drops tables within that dedicated test database.

The CI `postgres-fixtures` job uses an ephemeral PostgreSQL 16 service; its four tests cover real SQL and transaction rollback. The browser job creates a temporary game folder from `tests/fixtures/legacy/`, explicitly enables local content middleware there, and runs five browser editor/image tests. A pinned public Morkahja WebP file is downloaded into the temporary fixture and decoded in Chromium.

Run `npm ci`, `npm run build`, `npm run lint`, `npm test`, `npm run test:integration` as usual. The special database/browser fixture commands belong only in their isolated environments. [Verified CI run 41659550592](https://github.com/babunidev/babuni.admin/actions/runs/41659550592) · [Hardening report](PHASE1_HARDENING_2026-11-03.md).
