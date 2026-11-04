# Phase 2 security verification and live-operation release gates — 2026-11-04

**Scope:** Babuni Admin's local service, connection profiles and Linux Secret Service integration, plus a targeted review of the legacy Vite-local Morkahja administration and static-file routes. No live project, VPS, SSH tunnel, PostgreSQL account or existing OS credential was used during code changes.

## Implemented in this review

- **Read-only keyring lock detection.** The keyring adapter queries the Secret Service default collection's `Locked` property using the system `busctl --user` tool. A positively identified lock yields `locked` status and rejects credential stores and clears before touching the secret store. Providers lacking the property, alias or tool yield `unknown` for lock introspection, **not an assertion that the keyring is unlocked**; the original `secret-tool` fallback still applies. No attempt is made to lock or unlock a collection automatically.
- **Desktop diagnostics implemented and operator-tested on Nobara (unlocked, locked, recovered and isolated bus outage).** `npm run keyring:inspect` queries only collection lock state and a random nonexistent profile ID. `npm run keyring:verify-unavailable` first checks an accessible baseline, then creates a child process with a deliberately invalid D-Bus session-bus address; it confirms unavailable status without mutating the real desktop session or stored credentials. When collection introspection is unsupported, the inspection command skips the credential lookup entirely to avoid a possible provider unlock prompt. The operator subsequently inspected a genuinely locked KDE Wallet and received `locked` for collection, keyring health and nonexistent-profile credential; a later inspection after unlocking returned `unlocked`, `available` and `missing` again. This does not simulate a full desktop logout.
- **Privilege checks and test coverage.** A new source/integration suite asserts remote adapters deny operations and project identity cannot broaden scope; legacy local HTTP guards reject wrong peers/origins, including cross-site access.
- **Legacy static-file containment.** The opt-in local Morkahja static server now resolves targets canonically, rejects symlinked files and escapes outside its allowed asset root, and disallows cross-site requests. Isolated tests attempt a synthetic secret-file symlink escape; no real project files were read.

These checks add to the already verified local-only listener, independent server token, ephemeral browser session and disabled-by-default remote adapters. A passing CI run verifies implementation **against fixtures**, not the operating system's locked keyring or production authorization.

The legacy opt-in admin/content guards now also require an exact HTTP Origin for mutations (not merely a matching Host) and reject `same-site` requests. These guards reduce CSRF exposure but are still not administrator authentication.

## Follow-on Phase 2 SSH health probe — implemented later on 2026-11-04

After the original review, a separate `ssh:probe` capability was added for **Morkahja only**. This is inert unless both the local process environment and owner-private configuration explicitly enable it. It requires an exact, independently approved host-key fingerprint, privately owned SSH identity, unlocked keyring and stored database credential; opens a temporary SSH forward through a **private Unix-domain socket**; performs one fixed PostgreSQL role/privilege check in a read-only transaction; and closes the SSH child. No player data or project mutations are exposed by this endpoint. Fixture CI checks configuration and role denial, not the real Morkahja server.

The original security table below describes the earlier review; it is **not** evidence that all remote capabilities remain structurally absent. The new opt-in health probe is implemented but disabled by default, while general SSH Connect, arbitrary SQL, moderation, content writes, GitHub and publishing remain unavailable. Before an actual Morkahja probe, the operator must independently validate endpoint ownership and host fingerprint, provision and audit the remote read-only DB role (including role membership and future grants), and review same-user local-process access. A successful metadata probe cannot authorize live administration or writes.

See [operator-only health probe contract](MORKAHJA_SSH_READONLY_PROBE.md).

## Follow-on — Morkahja read-only dashboard (2026-11-04)

Following an operator-observed successful real SSH/database **health check** at 20:59, a separate `ssh:read` data capability was implemented for the Morkahja-only `/read-only` page. It requires an additional owner-private `readOnlyDataEnabled` flag and **exact** approved fields, and routes through the loopback-session guard with fixed SELECT-only SQL, read-only transactions, strict page bounds, private Unix-socket SSH forwarding and cleanup. The overview returns only counts; the 20-row player preview returns only display name, avatar count and last played. This is not a general SQL, moderation, content-editing or publishing interface.

Disposable fixtures and browser denial tests provide implementation evidence. **Live Morkahja player-data reads have not been verified.** Independent remote-role membership/privilege auditing and production-schema verification still apply before real data access. See [read-only dashboard specification](MORKAHJA_READ_ONLY_DASHBOARD.md).

## Security status and remaining blockers

| Area | Verified or observed | Remaining live-operation gate |
| --- | --- | --- |
| Unlocked Nobara keyring | Operator reported temporary store/retrieve/delete and read-only inspection confirming `unlocked`, `available`, `missing` on 2026-11-04 | No further initial unlocked-keyring checks pending |
| Unavailable D-Bus | Operator ran the isolated unavailable-bus command on Nobara; the child process reported correctly unavailable, without changes to the desktop bus or credentials | This is not equivalent to losing the desktop's active bus or a locked collection |
| Locked-keyring logic | Operator observed real `locked`, `locked`, `locked` states on Nobara; fixture tests separately verify that credential stores and clears are rejected while locked | No real credential store/clear was attempted during the locked observation; backend authorization remains a separate gate |
| Unlock recovery | After KDE Wallet was unlocked, the operator observed `unlocked`, `available`, `missing` again | This verifies diagnostic recovery, not fresh post-unlock credential round-trip storage |
| Browser-to-service boundary | Loopback binding, Host/Origin/Fetch Metadata validation and per-run token covered by fixtures and Chromium | Review same-user process access, browser XSS/CSP protections, privilege isolation and service lifecycle before sensitive live access |
| Connection adapter permissions | Static per-project allowlist; SSH, GitHub and publishing operations denied | Independently authorize actual server identities, verified SSH host keys and allowed endpoints |
| PostgreSQL reads | Disposable PostgreSQL query/rollback fixtures from Phase 1 | Dedicated read-only role, scoped transport, query limits, schema compatibility and live read-only validation |
| Legacy admin/content mutation routes | Opt-in Vite routes have origin checks and disposable write/rollback tests | **Not authorized for live use**: implement authenticated server-enforced roles/scopes, explicit confirmations and bounded operations outside Vite |
| Game-file write safety | Atomic replacement and fixture backups; new static symlink containment | Validate real schema, concurrent writers, backup retention/restore, write ownership and rollback after interrupted writes |
| Dependencies | Last documented npm audit: 12 moderate tooling advisories, zero npm production-scope findings | Recheck against the current lockfile; audit job is informational, not a release approval |

## Desktop verification sequence

With the desktop keyring **unlocked**, from a second terminal:

```bash
cd ~/Projects/babuni.admin
npm run keyring:inspect
npm run keyring:verify-unavailable
```

For an actual locked-state test, do **not** let a script lock the ordinary login keyring. If the operator elects to lock that collection through the desktop's keyring manager, run `npm run keyring:inspect` while it is locked and confirm `locked` appears in all relevant statuses, then unlock it again through the same manager. Locking may interrupt other desktop applications. If the provider reports `unknown`, do **not** mark locked verification complete or attempt to bypass the provider's unlock prompt.

## Release decision

**Live Morkahja administration remains blocked.** Keyring failure tests and local access controls alone do not establish safe authorization for live database writes, content editing, SSH connections or deployments. Release requires documented endpoint identity, least-privilege remote credentials, tests for malicious input and denied operations, explicit write authority and successful backup/rollback verification in a non-production environment.
