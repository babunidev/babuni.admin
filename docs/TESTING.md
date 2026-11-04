# Testing Babuni Admin

## Nobara desktop keyring verification — 2026-11-04

The human creative ran `npm run keyring:verify` on the Nobara desktop and supplied the following successful terminal results: `Linux Secret Service round-trip verified: ephemeral store and retrieve.` and `Ephemeral test secret removed from the keyring.` This is operator-reported verification on the actual machine, separate from CI's fake-keyring tests. The synthetic test did not access real project credentials. Locked or unavailable desktop keyring behavior and remote service authentication remain unverified.

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


## Linux keyring and local health — 2026-11-04

Run `npm run test:connections`. It exercises the loopback service, credential status and storage via a disposable fake `secret-tool` binary, and inspection of temporary Morkahja JSON files including the capitalized `Avatar` key. The synthetic keyring fixture is not evidence that a real Nobara Secret Service collection is available or unlocked.

Run `npm run dev` to inspect the Connections UI. Test performs a manual read-only local directory check; Inspect reports content availability, degradation and structured errors. The health endpoint remains authenticated through the existing loopback proxy. Remote SSH, PostgreSQL, GitHub and publishing checks are not part of these tests.

## Browser Connections workflow and desktop keyring verification (2026-11-04)

`npm run test:connections` exercises immutable profile edits, project/adapter validation, read-only local Connect/Disconnect/Reconnect and rejection of unimplemented remote operations. Synthetic keyring tests cover success, missing utility and locked/unavailable error paths.

The `browser-connections` GitHub Actions job launches an isolated local service and Vite process with a disposable profile registry, then runs `npm run test:browser:connections` against the rendered Connections page. It tests create, test, connect, disconnect, reconnect, inspect, edit and remove, plus absent-session and forged-origin/host denial.

`npm run keyring:verify` is a manual on-PC check: it generates a random synthetic secret, verifies store and private retrieval, then attempts to delete it from Linux Secret Service. This test does not run in CI and should be observed on the actual Nobara desktop before marking credential storage fully verified.

## Protected Morkahja SSH reader and scoped content tests (2026-11-04)

`npm run test:connections` now runs injected SSH/client tests alongside the original service/keyring fixtures. The tests deny unknown host keys and privileged database roles, exercise read-only health/preview and connection failure cleanup, and verify that no legacy session-mutation query executes. The `postgres-fixtures` CI job creates a disposable PostgreSQL user with SELECT access only and verifies the reader queries and denied UPDATE.

`npm run test:content:scoped` (Node with type stripping) exercises a temporary game folder: missing and expired grants, dataset boundaries, revision conflicts, symlink denial, atomic write backups, restore and audit metadata without live game files. The authenticated local-service tests also cover denied and granted content writes plus rollback.

Protected JSON saves are enabled only when `VITE_USE_PROTECTED_CONTENT=true`, `VITE_USE_LOCAL_CONTENT=true`, `MORKAHJA_PUBLIC` points to the local game public root, and `VITE_MORKAHJA_PROFILE_ID` identifies a local-files profile. A separate CLI-issued 15-minute dataset grant is still required. The old Vite write plugins are disabled in regular use and require explicit isolated fixture opt-ins in CI.

Remaining verification on Nobara: confirm the SSH fingerprint independently, configure a least-privileged Morkahja DB role, observe a real read-only connection/preview/disconnect, then test the protected editor and rollback against disposable copies of the current real game datasets. Neither the actual VPS nor production files were contacted by these CI tests.
