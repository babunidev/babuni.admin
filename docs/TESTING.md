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
