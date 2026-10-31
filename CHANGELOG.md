# Morkahja Admin — Git-based changelog

**Creator:** Babuni.dev. Dates are repository commit dates, not assertions of deployment or test success.

## 2026-10-26 — expanded documentation audit

- Rebuilt eleven Markdown files: README, concept, roadmap, changelog, agent rules, architecture, design, content, decisions, narrative journal and AI collaboration.
- Distinguished **Morkahja Admin** application name from `arcanitebrothers` repo/package name and from the external **MorkahjaWebApp** game data.
- Recorded the initial mock dashboard and the next-day content/moderation development, with security-sensitive boundaries clearly marked unverified.
- Flagged `VITE_DATABASE_URL` browser exposure concerns, file-write middleware trust boundaries, mock fallback, content route mismatches and the absence of automated test evidence.
- **Markdown-only:** no frontend/server code, assets, package dependencies, environment templates or game data were changed. No backend or running app tested.

## 2026-05-23 — first dashboard scaffold

Commit `097a7be` — **“initial admin dashboard scaffold”** — introduced React/TypeScript/Vite, dark styling, generic route structure, shared tables/cards, mock services and editor rules. The initial README explicitly described mock data and pending backend connection. No legitimate claim of live moderation or a finished content pipeline can be assigned to this commit alone.

## 2026-05-24 — content management and local connections

Commit `25c5604` — **“Add content management, encounter editing, and dev port 5180.”** — reworked the route set around Dashboard, Players, Content and Settings, and added substantial content editing, local development APIs, PostgreSQL querying/moderation support and image handling. The source now has real write paths in development conditions. This is source evidence of implementation, **not** a proof of production readiness or verified permissions.

## 2026-10-26 — attribution and initial docs

Commits `169a1af`, `99cdd36`, `93d0360`, `c9fc2b7` added author credit and short documentation links/scaffolds. The new audit expands that record rather than inventing earlier conversations or changing application behavior.

## Verification convention

Record client/server environment, fixture data, test commands, observed output, modified files and commit SHA for every later implementation. The current Git history establishes code and textual milestones, not that the app was deployed, tested with live accounts or approved for general access.

## 2026-10-28 — Audit #38 documentation checkpoint

- Revisited existing eleven-file documentation and rechecked package metadata and Vite middleware configuration against the October 26 assessment.
- Preserved the original May implementation chronology, authorial direction and unresolved privileged-tool risks.
- Added targeted clarifications only; no code, assets, credentials, external game files or databases changed. No build or live test executed.

## 2026-10-31 — Publication preparation

Recorded Babuni.dev’s direction to publish the actual project after review and retire its separate documentation edition afterwards. Confirmed the existing standard document structure; added `docs/PUBLISHING.md`. No runtime or visibility changes.

## 2026-10-31 — Changed: publication decision record

- Recorded Babuni.dev’s open-development decision and verified current visibility in Decisions and Development journal; retained licensing, media-rights and deployment distinctions.
