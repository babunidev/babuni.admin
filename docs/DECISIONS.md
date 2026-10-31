# Morkahja Admin — implemented choices and unresolved design decisions

**Decision authority:** Babuni.dev. This is an **evidence register**, not an invented design meeting.

## Choices visible in code and Git

| Subject | Implementation evidence | Boundary |
| --- | --- | --- |
| React/TypeScript/Vite workbench | Initial scaffold `097a7be`, `package.json` | An implemented frontend, not a demonstrated deployment |
| Dark, minimal atmospheric UI | `.cursor/rules/morkahja-admin.mdc`, CSS tokens | Original repo instruction, not an AI-origin proposal |
| Focused routes | `src/App.tsx`, May 24 `25c5604` | Dashboard/Players/Content/Settings now; former scaffold sections removed |
| Player moderation / live data adapter | `src/services/adminApi.ts`, `vite/postgresAdmin.ts` | Real DB mutation paths exist; security not certified |
| Mock-first UI development | `mockState.ts`, early README | Sample data separated in UI, with fallback on dev failures |
| Local external game editing | `vite/localContentPlugin.ts`, content service | Writes to another repository/directory, not this repo |
| Proxy support | `vite.config.ts`, `src/services/http.ts` | Server-injected credentials possible; no proof of remote backend role checks |
| Image conversion and encounter relationships | Content editors and `vite/encounterImageNaming.ts` | Implementation observed; no integration tests |
| Player-detail and activity polling | React Query and status panels | Periodic browser refresh, not a server push subscription |

## The May development shift

**May 23** introduced a dark dashboard scaffold with mock data and several generic placeholder sections. **May 24** moved to game-specific content editing and connection paths. The current commit tree supports this shift, and the README calls the app a local administration console. We have **no recovered conversation** detailing which alternatives Babuni.dev approved, so avoid attributing undocumented deliberation.

## Source-identified technical risks (not proven incidents)

- Browser-exposure risk of `VITE_DATABASE_URL` / `VITE_API_TOKEN`.
- Dev middleware can write PostgreSQL moderation state and files without its own independent operator-auth layer.
- Local content upload filenames and request size/path controls need hardening.
- `VITE_USE_LOCAL_CONTENT=false` changes UI mode, not middleware registration.
- Mock player-list fallback can provide sample records during live DB errors.
- Nonlocal portrait/content fetch paths may not align with configured URLs.
- Moderation session revocation and database writes are not visibly wrapped in an all-or-nothing transaction.
- Separate game content modifications are not revisioned by this repository.
- Repo has no visible standalone automated test command.

These are static-review concerns and must not be described as confirmed breaches or resolved defects.

## Open creator decisions (no approval in this pass)

1. Local-only operator console permanently, or remote operation after a dedicated secured backend?
2. Default read-only mode and an explicit enable-action step for real moderation/content writes?
3. Moderation rationale logging, staff accountability, appeal and audit retention?
4. Should content management save drafts in Git before writing directly to game data?
5. When backend is unavailable, explicit offline screen or labeled automatic mock fallback?
6. Which first security and deployment changes should be prioritized for an actual production workflow?

Record human accept/reject/postpone decisions, implementation commits and test proof when they happen.

## 2026-10-31 — Canonical repository publication direction

Babuni.dev chose the actual project repository as the intended public source, replacing the earlier documentation-only edition once review and anonymous access succeed. Retain the current public edition during the transition. License and third-party redistribution decisions remain explicit author decisions.

## 2026-10-31 — Author decision — open project development

**Babuni.dev direction and decision:** Babuni.dev decided to make the actual project repository publicly accessible, with the intention of developing it openly rather than maintaining a separate public documentation edition. GitHub visibility was verified as public on 31 October 2026.

Public source availability does not authorize public deployment of privileged development endpoints, production credentials or live player records.

**AI contribution:** Recorded the author’s decision and clarification, separately from observed GitHub visibility. Earlier documentation-only publication was considered and is superseded as the intended long-term source. No root license was selected by this update; public visibility, open-source reuse permissions, media rights and production readiness are separate matters. No runtime testing or behavior change is claimed.
