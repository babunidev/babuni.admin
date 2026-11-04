# Testing Babuni Admin

## First live read failure — sanitized diagnosis (2026-11-04)
## Morkahja restricted-view integration — 2026-11-04

The operator's Ubuntu PostgreSQL output confirmed both `babuni_admin_ro` views were created and committed, that `babuni_admin_probe` can SELECT each view, cannot CREATE objects in the schema, and cannot SELECT `public.players` or `public.sessions`. A count of rows in the preview view succeeded. This is **server-side verification**, not yet evidence of an end-to-end browser read.

The disposable `npm run test:postgres` test now creates corresponding `security_barrier` views owned by the fixture database owner, grants the test reader ONLY view SELECT privileges, and verifies that the read adapter succeeds without raw-table grants. Negative cases cover missing view grants and unexpected direct SELECT on sensitive base tables. Existing fixture checks retain count, pagination, restricted returned fields, unchanged sessions, and rejection of a write-capable role. The SQL is fixed; no test is directed at live Morkahja.



The creative's first attempted `/read-only` snapshot returned `REMOTE_READ_FAILED`. This confirms a request was unsuccessful but not whether the cause is insufficient SELECT permission, schema incompatibility, a network issue or something else. `classifyReadOnlyError()` now converts PostgreSQL SQLSTATE values into safe codes: `DB_READ_PERMISSION_DENIED`, `DB_READ_TABLE_MISSING`, `DB_READ_COLUMN_MISSING`, `DB_READ_SCHEMA_MISMATCH`, `DB_READ_INVALID_DATA`, `DB_READ_TIMEOUT`, `DB_READ_AUTH_FAILED` and `DB_READ_CONNECTION_FAILED`. Unknown errors retain the generic code. Raw database diagnostics are deliberately not returned to the browser or logged.

The disposable PostgreSQL test now checks **before** SELECT grants that a non-write-capable role may pass the metadata health check but fail actual table reads with `42501`; this must produce `DB_READ_PERMISSION_DENIED` rather than the unhelpful generic failure. All PostgreSQL fixture modifications remain restricted to disposable CI databases. The actual live failure category has not yet been verified.

## Morkahja read-only data dashboard — 2026-11-04

`npm test` covers strict 1–1000 page bounds, exactly 20 results per page, fixed approved response fields, disabled-by-default private data permissions, shared SSH single-flight handling and cleanup, and denied cross-project/local-service requests. The isolated local service also rejects unwanted JSON keys and forged Origins before attempting SSH.

`npm run test:postgres` exercises the adapter with a disposable PostgreSQL 16 database and a dedicated fixture reader. It verifies database counts, two pages of non-sensitive player preview results, omission of identity and session credentials, unchanged session rows, and rejection of a write-capable database role. **This is not safe to point at a live database**: the existing CI fixture suite creates and removes test data.

The new UI is linked from Morkahja navigation as `/read-only`. Data is not fetched merely by visiting the page; an operator must select the approved SSH profile and manually request each snapshot. The existing Dashboard and Players routes remain separate. The real SSH/database **health probe** succeeded on the operator's Nobara PC, but live player-data access and schema compatibility are pending independent verification. [Contract](MORKAHJA_READ_ONLY_DASHBOARD.md).


## 2026-11-04 — OpenSSH client parser regression

OpenSSH rejected the production arguments with `Bad configuration option: permittty`. Terminal allocation remains disabled through `-T` after removing that server-only option from the client command.

`node --test --test-name-pattern='production tunnel' tests/ssh-tunnel.test.mjs` runs real OpenSSH with `-G` against the production argument builder, without contacting the synthetic host. In the AI workspace, this test failed with the reported invalid-option error before removal and passed afterward, including `requesttty false`. The existing socket fixture cannot detect invalid OpenSSH options on its own. Its local execution was blocked by the workspace's Unix-socket `listen EPERM` restriction; CI must verify the lifecycle fixture. Build and lint passed. Target-desktop verification remains pending.

## Operator-gated Morkahja SSH/PostgreSQL probe — 2026-11-04

The opt-in health probe is **disabled by default**. `tests/ssh-online-probe.test.mjs` checks private configuration, exact host and independently approved SHA256 fingerprint, unlocked-keyring requirements, denial, concurrency, cleanup and sanitized failures. `tests/ssh-tunnel.test.mjs` replaces `ssh` with a local-only test binary and checks strict host-key options, a private local Unix-domain forward, token-isolated child environment and cleanup without contacting any server. The updated local-service test covers endpoint scoping and disabled-state refusal. `npm run test:postgres` additionally exercises `inspectReadOnlyDatabase` against a disposable PostgreSQL 16 fixture, asserting that a limited role passes and the fixture's privileged role fails. It also runs an actual PostgreSQL read-only query over a private Unix socket forwarded by a *simulated* local SSH process, never a real SSH server.

**Never aim `TEST_DATABASE_URL` at a live database.** The existing PostgreSQL suite performs destructive fixture setup. No CI test contacts Morkahja, opens a real SSH session or performs live player-data reads. See [SSH probe configuration](MORKAHJA_SSH_READONLY_PROBE.md).

## Morkahja SSH offline trust tests — 2026-11-04

`tests/ssh-preflight.test.mjs` generates an ephemeral fixture key locally with `ssh-keygen` and verifies absence of a trust file, absent/incorrect/wildcard entries, explicitly pinned exact entries, unsafe permissions, symlink rejection, disallowed target values and cross-project denial. `tests/local-service.test.mjs` covers the service's `POST /test` path with a disposable trust file and verifies that Connect and Inspect remain unavailable for PostgreSQL-via-SSH profiles. No live host or database is contacted.

Run `npm run test:connections` for the service tests; `npm test` includes the dedicated SSH preflight test. An observed `SSH_HOST_KEY_PINNED_OFFLINE` does not establish the real server's identity, SSH connectivity or database availability.

## Failure-mode checks and security regression suite — 2026-11-04

The synthetic keyring test now uses a disposable mock D-Bus tool to verify `locked`, `unlocked`, `unknown`, unavailable and denied credential operations, without touching the machine's default collection. The regression suite tests server-owned adapter permissions and the legacy local HTTP request guard, including denial of cross-project and remote capabilities. The local-content middleware additionally has fixture tests for rejecting symlinked files outside the game asset root and cross-site reads.

On the user's Nobara desktop, with the keyring initially unlocked:

```bash
cd ~/Projects/babuni.admin
npm run keyring:inspect
npm run keyring:verify-unavailable
```

The creative ran these commands on Nobara on 2026-11-04 and reported: `Default Secret Service collection: unlocked`, `Keyring health: available`, `Nonexistent test-profile credential: missing`, followed by `Real Secret Service unavailable-bus behavior verified in isolated process` and confirmation that existing desktop credentials were unchanged. The isolated unavailable-bus command makes no changes to desktop bus settings. For a real locked test, the operator must intentionally lock the default collection using their desktop keyring manager, run `npm run keyring:inspect`, and unlock the collection afterward. The operation may temporarily interrupt other applications. If lock introspection reports `unknown`, the inspection command skips credential lookup to avoid an unlock prompt. On 2026-11-04, the operator instead obtained verified real locked-state output: `locked` for collection, health and unused credential. After unlocking KDE Wallet, a second output confirmed recovery to `unlocked`, `available`, `missing`. No real secret was accessed or modified in those read-only inspections; credential operation denial while locked remains supported by fixture tests. Neither command prints or changes project credentials.

See [Phase 2 security review](PHASE2_SECURITY_REVIEW_2026-11-04.md) for the distinction between CI fixtures, operator-reported results and remaining live-operation gates.


The regression suite also checks that legacy HTTP mutation requests without an Origin, with an HTTPS origin against the HTTP local server, or with `Sec-Fetch-Site: same-site` are denied. Legitimate fixture mutations use an explicit local HTTP Origin. Browser form regression tests must continue to pass.

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
