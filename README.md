# Babuni Admin

Babuni Admin is a **private, local control room** for Babuni's projects. One application brings separate workspaces together without turning administration into a public web service. The existing Morkahja tools are the most developed; Babuni Dev is growing beside them.

**Creative direction:** Babuni · **Environment:** the operator's Linux desktop · **Stack:** React 19, TypeScript, Vite 8 and Tailwind CSS 4

> **Security boundary:** This is privileged desktop software, not a hosted dashboard. Its interface and local services bind to loopback. Read-only connection checks do not authorize publishing, live-content writes or changes to server permissions.

## The workspaces

### Morkahja

The established workspace covers server overview, player inspection and moderation, content browsing and local artwork previews. A restricted, operator-approved PostgreSQL view supports read-only player and activity summaries. The Content workspace also includes a persistent local WebP image cache and incremental synchronization.

Different operations have different trust levels. A successful connection or read-only query must **never** be mistaken for permission to mutate live player data or game files. Game-side live-content writes remain deferred pending the separately developed game's content architecture.

### Babuni Dev

The portfolio workspace is no longer only a connection prototype. Its **Overview**, **Documents**, **Repositories** and **Connection** pages support distinct publishing and checking jobs:

- **Connection** checks the approved GitHub identity, public HTTPS site and fixed deployed-file access. These tests are read-only.
- **Documents** checks and publishes supported `babuni.dev` documents through a fixed, guarded publishing workflow. It is not a general-purpose Markdown editor.
- **Repositories** checks connected projects for updated documents, pulls their reviewed snapshots into the portfolio checkout, and provides separate guarded commit/push and site-publish steps.
- **Overview** includes **Publish everything** for the combined check, snapshot, push and deployment process, along with a separate checked cleanup of old website releases.

The creative verified the first complete **Publish everything** flow on Nobara on **10 November 2026**, including an updated live release. The old-release cleanup was also exercised with a later verification of the live site. This is evidence for those specific executions, not unrestricted publishing authority or proof that all future deployments will succeed.

**Still missing:** editing arbitrary source-repository documents through this UI, broader content management and some browser/device acceptance checks. Live changes require the workflow's own permissions, reviews and safety checks; a read-only connection result alone never grants write access.

For implementation and verification details, see [architecture](docs/ARCHITECTURE.md), [roadmap](ROADMAP.md), [publishing](docs/PUBLISHING.md), and the [local connection manager](docs/LOCAL_CONNECTION_MANAGER.md).

## Run it locally

From the repository root:

```sh
npm install
npm run dev
```

The development command starts Vite at `127.0.0.1:5180` and the profile service at `127.0.0.1:5191`. Both are local to the operator's machine; stop them with Ctrl+C. `npm run dev:ui` runs only Vite and cannot manage connection profiles.

For test or demonstration data, use a gitignored `.env.local` with non-secret settings:

```dotenv
VITE_USE_MOCK_DATA=true
VITE_API_BASE_URL=
VITE_USE_LOCAL_CONTENT=false
```

Mock results are **not** proof of a live connection. The local-content feature flag is not, by itself, an authorization boundary; do not expose development endpoints to an untrusted network.

Other commands and verified test boundaries are documented in [testing](docs/TESTING.md) and [the current security reviews](docs/PHASE2_SECURITY_REVIEW_2026-11-04.md).

## Connections and credentials

Connection profiles are stored locally. The application separates non-secret configuration from credentials managed through Linux Secret Service, and uses explicitly approved connections for remote data. The existing KDE/Nobara SSH agent can provide the necessary private-key access without copying keys into the repository.

Useful operator commands:

```sh
npm run credentials -- list
npm run credentials -- set <profile-uuid>
npm run credentials -- status <profile-uuid>
npm run credentials -- clear <profile-uuid>
npm run keyring:verify
npm run keyring:inspect
```

The credential prompt runs in the terminal, not the browser. An unavailable or locked keyring should fail without storing a plaintext fallback. `keyring:verify` performs a reversible test using a temporary synthetic secret; it requires an accessible unlocked desktop keyring.

The optional desktop SSH helper is separately installed and removable:

```sh
python3 scripts/ssh-agent-login.py install
python3 scripts/ssh-agent-login.py status
python3 scripts/ssh-agent-login.py uninstall
```

It does not automatically install itself or store passphrases. See [SSH agent desktop setup](docs/SSH_AGENT_DESKTOP_LOGIN.md), [SSH/PostgreSQL probe](docs/MORKAHJA_SSH_READONLY_PROBE.md) and [connection manager](docs/LOCAL_CONNECTION_MANAGER.md) before changing these paths.

## What remains separate

| Area | Current boundary |
| --- | --- |
| **Local UI and profile service** | Runs on loopback; not a publicly hosted admin backend |
| **Morkahja overview** | Restricted read-only views and manually approved fields; a session count is not proof of real-time presence |
| **Moderation and content mutation** | Privileged operations; retain independent authorization, auditing and rollback requirements |
| **Babuni Dev publishing** | Fixed, guarded document and snapshot publishing workflows are implemented; original-repository editing is still absent |
| **Production systems** | External to this repository; do not edit them as a side effect of a documentation or UI change |

The code and its history include older Morkahja-specific paths, temporary development adapters and security findings. Their dated descriptions are evidence of earlier states—not necessarily accurate setup advice for the current branch. Consult the linked engineering documents before running privileged features.

## Documentation guide

| What you want to know | Document |
| --- | --- |
| Why the tool exists | [Concept](CONCEPT.md) · [Design](docs/DESIGN.md) |
| What's planned or already changed | [Roadmap](ROADMAP.md) · [Changelog](CHANGELOG.md) |
| How it is built | [Architecture](docs/ARCHITECTURE.md) · [Multi-project structure](docs/MULTI_PROJECT_ARCHITECTURE.md) |
| Connections and permissions | [Connection manager](docs/LOCAL_CONNECTION_MANAGER.md) · [Read-only dashboard](docs/MORKAHJA_READ_ONLY_DASHBOARD.md) |
| Tests, risks and validation | [Testing](docs/TESTING.md) · [Phase 1 verification](docs/PHASE1_VERIFICATION.md) · [Phase 2 security review](docs/PHASE2_SECURITY_REVIEW_2026-11-04.md) |
| How the project developed | [Development journal](docs/DEVLOG.md) · [Decisions](docs/DECISIONS.md) |
| How to write and attribute changes | [Documentation standard](docs/DOCUMENTATION.md) · [AI collaboration](docs/AI_COLLABORATION.md) · [AGENTS.md](AGENTS.md) |

Read [AGENTS.md](AGENTS.md) before changing the code or project record. The human creative sets direction and approves decisions; the documentation distinguishes that direction from AI-assisted implementation and from verification that has actually taken place.
