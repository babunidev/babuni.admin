# Testing Babuni Admin

## Verified CI checks

GitHub Actions runs the TypeScript/Vite build, ESLint and nine source-level regression checks on every push to `main` and pull request. A separate Ubuntu 24.04 job builds a mock-only preview and runs five Chromium browser scenarios. The first passing browser run is [41639215405](https://github.com/babunidev/babuni.admin/actions/runs/41639215405).

The browser suite covers:
- Babuni Dev overview and project-specific header/navigation
- Workspace switching and browser back/forward history
- Existing Morkahja pages at `/`, `/players`, `/content`, `/settings`
- Mobile navigation opening and closing, including hidden controls
- Mock player table and shared page-header rendering

This is **not** a test of real moderation, game-file mutations, authentication, production APIs or remote content publication.

## Local source-level checks

```bash
cd /home/babuni/Projects/babuni.admin
npm ci
npm run build
npm run lint
npm test
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
