# Shared local connection manager — Phase 2 design

**Status:** Architecture design with a local profile registry, terminal-only Linux keyring storage and read-only health/inspection slices implemented. No outbound SSH, PostgreSQL, GitHub or publishing adapter is implemented.

## Purpose and deployment boundary

Babuni Admin is a **single-user application installed and operated on Babuni's own PC (Nobara Linux)**. Its browser UI and privileged local service bind to the loopback interface (`127.0.0.1` and/or `::1`), not to a LAN/public interface. The UI is not published at babuni.dev, Morkahja or the VPS; there is no separately hosted Babuni Admin login page. The administrator's PC initiates protected outbound connections to project services when necessary.

Remote servers still authenticate these connections independently. Localhost alone does not authenticate the operator, stop another local process, or prevent CSRF. A future local service must enforce origin and request validation, a private per-start session or equivalent local capability, and strong process/user boundaries. Tunnels, tokens and project write permissions must not be accessible to a remote browser.

## Conceptual data flow

```text
Nobara PC, private user session
  Browser (Babuni Admin React UI, http://127.0.0.1:5180)
            │ local, origin-checked API; no stored secrets
            ▼
  Local connection manager / privileged service (PLANNED)
    ├─ encrypted OS-user credential storage / system keyring
    ├─ profile registry (non-secret metadata)
    ├─ connection adapters + SSH tunnel lifecycle
    ├─ action validation, operation log, backup/rollback
    └─ scoped project capabilities
         ├─ Morkahja PostgreSQL via SSH-forwarded loopback port
         ├─ Morkahja project content through local files OR scoped remote service
         ├─ Babuni Dev GitHub API over HTTPS
         └─ Babuni Dev website publishing through scoped SSH/API transport
                   │ outbound from PC only
                   ▼
         VPS / databases / GitHub / project systems
```

A separate **local service** is the proposed durable boundary. It is not an additional hosted administration platform. Vite development plugins are temporary local developer adapters and should not become the deployed privileged service. A lightweight Node/TypeScript service or other Linux-local daemon is a design option; the precise runtime/IPC has not been approved or implemented.

## Profile model (proposed)

Each connection profile belongs to exactly one project and one adapter. Its persistent *non-secret* record contains:

| Field | Role |
|---|---|
| `id`, `projectId`, `displayName` | Stable identity and workspace ownership |
| `kind` | Explicit adapter: `postgres-ssh`, `local-files`, `github`, `remote-publish` |
| `endpoint` / `repository` / `rootPath` | Allowlisted destination metadata, not a credential |
| `capabilities` | Explicit allowed operations, initially read-only where practical |
| `credentialRef` | Opaque keyring reference; never a password or token |
| `enabled`, `lastCheckedAt` | Local user configuration and observation metadata |
| `state`, `lastErrorCode` | Ephemeral connection status; don't persist secrets in errors |

Profile IDs must not determine authority on their own. The local service maps every operation to an adapter-specific allowlist and authenticated remote identity. Cross-project credentials and capabilities must not be inherited from the selected UI tab.

### Connection lifecycle

1. **Create:** choose project and adapter, name the profile, enter non-secret endpoint data; add credentials via OS keyring-backed flow. Keep secrets out of `localStorage`, `VITE_*`, URL parameters, files committed to Git, UI diagnostic logs and normal response bodies.
2. **Test:** validate destination, establish connection with least privilege, perform a harmless health/read check, report verified endpoint and timestamp. This does not authorize writes.
3. **Connect:** start outbound transport on demand (e.g. SSH tunnel) and mark `connected` only after an actual successful probe; idle and failed states remain visible.
4. **Operate:** check profile ownership, capability, target and optional confirmation on every mutation; never treat a successful HTTP connection as a successful project mutation.
5. **Disconnect:** close tunnels and handles, clear temporary credentials where applicable; leave only non-secret profile metadata.
6. **Recover:** retry with bounded backoff when the user reconnects, never replay irreversible actions automatically; provide explicit, inspectable failure/partial-success state.

### UI design

A **Connections** area belongs to the shared shell, with cards or rows grouped by project. Each row shows name, adapter, target label, read/write capability, source (local or remote), last successful check, and connection state: `not configured`, `disconnected`, `connecting`, `connected`, `degraded`, `error`. Controls: Add, Test, Connect/Disconnect, Edit and Remove. A project workspace displays a compact connection status badge that opens the relevant profile details; changing workspaces does not silently switch credentials or reconnect in the background.

The interface uses existing dark, restrained Babuni Admin styling and clear labels rather than replacing the project's visual design. A live connection must be visually distinct from mock/sample data; a disconnected workspace must not show a stale successful state. Sensitive errors are summarized for the user and recorded locally with redaction.

## Adapters and initial order

1. **Local files:** allowlist the Morkahja game asset root; ensure canonical path containment, schema preservation and backup/restore. Read-only test before permitting mutations.
2. **Morkahja PostgreSQL over SSH:** use server-host verification, user-controlled SSH key/agent, loopback-only forwarding and least-privileged DB role. No database password in the renderer; transaction and revoke actions remain server-side. Do not reuse the fixture database test against live data.
3. **GitHub:** user-owned scoped token or another appropriate supported authentication method; list approved repositories and fetch Markdown metadata over HTTPS. Distinguish read and commit rights.
4. **Site publishing:** scoped remote SSH/API destination for deployment, with revision preconditions and explicit publish confirmation. Publication is confirmed only after the website's target revision is actually served.

These adapter implementations are milestones, not functionality present today. Other projects can register an adapter only after their data contracts and trust boundaries are documented.

## Design acceptance criteria

- UI and privileged service are bound only to loopback; no inbound port or public admin hostname is required.
- A connection profile contains no raw credentials in client/browser storage or committed configuration.
- Starting the app with no profiles is safe; mock/fixture modes cannot be mistaken for connected real data.
- A wrong endpoint, expired token, failed SSH host verification, missing local file or lost connection is shown as **not connected**, with no false success.
- Read-only operations cannot mutate project state. Every privileged action is scoped to a profile's project, resource and allowed operation.
- Session/tunnel shutdown, switching profiles and partial failures leave no automatic replay of moderation or publishing actions.
- Tests use synthetic profiles and disposable services; never silently reach live VPS, databases or GitHub write endpoints.
- Connection tests, browser behavior and security properties are verified before marking the manager implemented.

## Decisions versus proposals

**Established direction:** Local-only, single-user installation; outbound secure access to multiple projects; separate project workspaces and permissions; no hosted Babuni Admin UI. **Proposed implementation:** Local service, keyring integration, profile schema, connection states, adapter contracts, UI details and connection lifecycle. These design choices need verification during implementation, not retroactive claims of approval.

## Related records

- [Architecture](ARCHITECTURE.md)
- [Roadmap](../ROADMAP.md)
- [Decisions](DECISIONS.md)
- [Phase 1 hardening](PHASE1_HARDENING_2026-11-03.md)

## 2026-11-04 — First connection-profile implementation

A **local-only development slice** of the shared connection manager now exists. The `/connections` page can add, list and remove non-secret project profiles using `/local-connections-api`, implemented by a localhost-only Vite middleware adapter backed by `LocalConnectionRegistry`. Profiles are stored at `$XDG_CONFIG_HOME/babuni-admin/connections.json` (or `~/.config/babuni-admin/connections.json`) with private file permissions. They are disabled by default and always reported as **not connected**.

This does **not** implement outbound SSH, PostgreSQL, GitHub, publishing, live health probes, keyring-based credentials or a standalone service. The code makes no connections to project servers. A reusable registry is separated from the Vite transport so it can be reused by a future dedicated local service. The local middleware retains the existing loopback/origin guard and requires an additional request header for mutations; these guards are not equivalent to per-user authentication.

The test `tests/connections.test.mjs` verifies persistence, deletion and rejection of mismatched adapters and credential-like or extraneous fields with a temporary config directory. Actual GUI/browser interaction remains to be verified. No live project data was changed.


## 2026-11-04 — Standalone local service and read-only first adapter

The next implementation introduces `local-service/server.mjs`, a separate Node process launched alongside Vite by `scripts/dev-local.mjs` when `npm run dev` is used. It listens only on `127.0.0.1:5191`. The launcher generates a new random service token for that run and passes it via environment variables, without exposing it to the browser. Vite proxies only `/local-connections-api` requests to the local service and attaches that token server-side. The service rejects requests without the token and the expected local request header; it validates browser-origin metadata and limits JSON request size.

The profile registry retains its existing XDG location and format. The first actual **read-only connection test** checks whether an allowlisted local-files profile points to a readable directory using `realpath`/`stat`. The UI displays `available` or `error`, not a false claim of a connected remote service. SSH, PostgreSQL tunnels, GitHub, publishing, credentials and remote connections remain unimplemented. Other profile types return `not-configured` when tested.

Run `npm run dev` to start both components on the PC. Tests use a temporary profile file, disposable local directories, and an ephemeral port; no live Morkahja data or remote services are contacted. This is a first process boundary, **not** a credential vault, desktop packaging or hardened OS-user isolation. The old development-only Vite profile plugin remains in source for compatibility tests but is no longer registered by the main Vite config.



## 2026-11-04 — Credential storage and local health implementation

The `local-service/keyring.mjs` adapter uses Linux Secret Service through `secret-tool`, with credentials entered only using the hidden terminal prompt in `npm run credentials -- set <id>`. Profiles still persist only non-secret metadata. The browser can see whether a profile's secret is present, missing or inaccessible; it cannot enter or retrieve credential bytes. Keyring errors do not silently fall back to plaintext files.

The loopback health endpoint reports service/keyring status. Manual profile tests record timestamps, last complete success and directory-specific errors. JSON inspection additionally distinguishes `available`, `degraded` and `error`, and preserves individual reasons such as missing files, invalid structure and bad JSON. The correct legacy portrait schema uses `Avatar` with a capital A. Future remote adapters remain `not-configured` even if credentials are present.

Fixture tests verify the subprocess boundary with a disposable fake `secret-tool`, plus isolated directory and JSON checks. No real desktop keyring, database, SSH connection, project file mutation or remote GitHub access has been tested. The root README describes operator commands and keyring requirements.
