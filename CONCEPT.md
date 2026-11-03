# Babuni Admin — Concept

**Creative:** Babuni  
**Application:** Babuni Admin  
**Repository:** `babunidev/babuni.admin`  
**Origin:** The Morkahja administration workbench; its existing interface remains Morkahja-specific while the larger platform evolves.

## One administration workbench

A separate administration application for every project would scatter my work across unrelated tools. Babuni Admin should instead provide one place to manage the projects that actually require administration, with each project retaining its own workspace, data boundaries, permissions and operating vocabulary.

Morkahja is the first workspace because the tool originally grew from its player moderation, activity inspection, encounters, solutions, expansions and artwork management. Babuni Dev is the next intended workspace, concerned with the portfolio's modules, GitHub documentation and publication. Additional workspaces can be introduced later when a real project requires them; their functionality is not assumed in advance.

The interface should stay dark, atmospheric, restrained and practical. Its character matters, but consequential actions need clear explanations, previews, permissions and recovery rather than decoration.

## Babuni Dev content workbench — planned

The immediate content problem is that the current static website prepares imported Markdown, module previews and readable pages during a build. A documentation correction should not require regenerating and deploying the entire website. A document or module should be independently refreshable where its dependent assets can be prepared safely.

The planned workspace would let me browse projects/modules, pull one source document from GitHub, compare revisions, edit Markdown, preview changes, save drafts and publish verified revisions. An edit made through Babuni Admin should be committed back to its authoritative GitHub repository rather than creating an undocumented second source of truth.

Publication must update dependent views together: module bodies, previews, indexes and the site's readable/searchable pages. A successful GitHub commit alone must not be presented as proof that the VPS serves the new revision.

## Human and AI participation

The creative direction, requirements, corrections and publication choices remain mine. AI may research, draft, refactor, test or prepare changes, but its execution and any unverified claims must be attributed accurately. Agent access, if developed, must use the same narrowly scoped backend permissions and revision safeguards as the human interface. It is a proposal, not a currently deployed capability.

## Non-negotiable boundaries

- One interface does not mean one shared database permission or unrestricted backend.
- Public portfolio data must not grant access to player moderation or game files.
- GitHub is the source of truth for repository-backed documentation.
- Sensitive credentials stay server-side; Vite development middleware is not the production administration API.
- Morkahja's existing functionality remains available while the code is progressively organized.
- No production publishing or privileged remote access is implied by frontend folder restructuring.

## Current state

React/TypeScript/Vite, existing Morkahja pages and domain operations are implemented in source. Morkahja pages, components, services, types and utilities have been grouped under `src/features/morkahja/` with transitional imports. The Babuni Dev feature folder exists but has no editor, GitHub publishing or live synchronization functionality. The new shared shell, secure production API and cross-project navigation remain future work.
# Morkahja Admin — project concept

**Human creator and creative director:** Babuni.dev  
**Code repository:** `arcanitebrothers`  
**Artifact:** Local administration interface for the separate Morkahja game.

## A control surface for a living game

Morkahja Admin is the backstage workbench for the Morkahja game. Its purpose is not simply to display numbers but to let the game's creator maintain the world and the player experience from one place: seeing active players, understanding activity, responsibly moderating accounts, and composing encounters, solutions, expansions and visual avatar assets.

The source has a consistent design rule: **dark, minimal and atmospheric**, while remaining readable and useful. It borrows the game's fantasy vocabulary but avoids making routine administrative work unnecessarily theatrical. The repository's editor rules explicitly prioritize moderation, logs, metrics and player inspection while keeping the architecture straightforward.

## Bringing content and operations together

The initial May 23, 2026 dashboard was a recognizable generic administration scaffold, with mock records and placeholder sections. A May 24 commit substantially developed a domain-specific content workspace: encounter fields and relationships, solution choices, expansion records, portrait/frame data and images, alongside player inspection and database access.

That was a meaningful project shift visible in Git: from a dashboard *about* the game toward a tool capable of changing game content. As the work became more powerful, the need to treat it as a privileged local tool became correspondingly greater. The creator's exact original private conversation and motivation are not present in the inspected repository; this is a source-grounded reading of the change.

## Guiding experience

- **The backend remains authoritative:** player status and sanctions must come from validated game/server data, not arbitrary browser presentation.
- **Consequential changes are legible:** details and confirmation dialogs contextualize timeout and ban actions, and content editors expose the game fields being saved.
- **The local workbench is differentiated from public game UI:** the admin app is for controlled operator use, with mock mode for safe UI exploration.
- **Content retains game-world identity:** encounters reference solution choices and expansion records, while portraits and frames get game-specific assets.
- **Distinctive but maintainable:** an atmospheric dark-and-gold shell, reusable tables and panels, strict TypeScript and simple component boundaries.

These are principles shown in the existing repo and its original editor rules, not invented approval of future features.

## Long-term portfolio meaning

The project demonstrates a creative director not only inventing a game, but also building tools to maintain its world and support its community. It belongs in Babuni.dev's portfolio as a **development/operations tool for Morkahja**, not as the public game itself. Document the human decisions, how AI or other tools helped implement them, and the technical limits that were actually resolved or remain.

Do not publish real player details, hidden admin credentials, database contents, production hosts or private operator logs as portfolio artifacts.
