# Morkahja Admin — creative and technical development journal

**Creator and creative director:** Babuni.dev  
**Retrospective recorded:** 2026-10-26, based on the GitHub tree, source files, initial README and historical commit diffs. This is not a raw personal chat transcript.

## Why build the backstage of a game?

Morkahja Admin is not the world that players explore. It is the creator's backstage instrument for keeping that world running and changing it. It aims to make administrative tasks—seeing active players, following activity, handling moderation and shaping encounters—possible from one deliberate interface.

The repository's original editor rules describe the aesthetic and coding discipline: **dark, minimal, atmospheric**, use strict TypeScript, favor simple reusable React components, separate APIs from UI and let the backend be authoritative. That document is valuable creative evidence. It gives an admin tool an identity without turning everyday operator work into spectacle.

This description is grounded in public source and instructions; the current audit has not recovered every private planning discussion about Morkahja, the Arcanite Brothers name, or the intended long-term hosting.

## May 23, 2026 — from blank repository to recognizable admin shell

On **2026-05-23**, the initial substantive commit `097a7be` (“initial admin dashboard scaffold”) established a React/TypeScript/Vite application with dark styling, navigation, reusable tables, metric cards and mock state. Its README clearly said that the tool still used **mock data only** and the backend connection remained to be made.

The initial route structure included typical administration placeholders such as logs, reports and world state. That is a normal scaffold shape but not, by itself, a fully operational game-control system. The code offered a visual direction and component boundaries before the true domain flows were connected.

The choice to use a local browser rather than a public-facing game page matters. The creator's project was not trying to create another destination for players; it was trying to create a tool for running and developing the existing game. Source evidence supports that product distinction, even without a recorded meeting where the idea was first articulated.

## May 24 — the content pipeline becomes a real editor

The next dated substantial commit, **`25c5604` on 2026-05-24**, had the message “Add content management, encounter editing, and dev port 5180.” The diff was broad: game-specific TypeScript types, content APIs, edit/detail panels, external asset paths, Vite middleware and PostgreSQL access replaced the earlier generic placeholder-heavy structure.

Now a creator could browse and compose **encounters**, relate them to **solutions**, inspect **expansion** contexts, and manage **avatar frames and portraits**. An editor displays real data identifiers such as encounter ID and solution choices instead of only synthetic cards. The JSON files remain in the separate MorkahjaWebApp game directory, so the admin project reads and changes assets **outside its own repository**. That external dependency is a major architectural fact to preserve in a future portfolio entry.

The same development phase introduced an operational layer: online players, player details, recent activity and moderation actions. The local PostgreSQL code can change ban/timeout flags, revoke sessions and clear sanctions. That is more than a mock UI. It is also more responsibility than a theme or prototype. Real use needs explicit operator security controls and an audit trail, which were not demonstrated by the Git history inspected here.

Several decisions are visible in implementation but not in recovered dialogue: Vite's dev server binds loopback; a proxy can attach a server-side admin key to requests; a local-content middleware reads/writes game JSON and images; and a local PostgreSQL route supports inspection and moderation. These are practical development choices. The exact motivation for each, and whether alternative architectures were debated, should not be invented.

## Where simplicity meets a hard trust boundary

The concept of an easily operated local workbench is useful, but a privileged administration tool has risks that an ordinary portfolio site does not. The code's current database connection setting is called `VITE_DATABASE_URL`, and the frontend checks it through `import.meta.env`. The same Vite naming convention makes `VITE_` values browser-accessible, which is inappropriate for a real database connection string containing credentials.

Similarly, the local Vite middleware can accept write requests for player moderation and game files. The source has no independent operator-auth check at those route handlers. The server currently binds to loopback, but “local” is a network topology choice, **not authorization**, and the content middleware mounts independently of the UI's `VITE_USE_LOCAL_CONTENT` toggle. Upload filenames and byte limits need hardening.

This audit does **not** establish a security exploit, leaked credential, or actual player harm. It records the observed boundary and the work needed before trusting a live deployment. That is part of the project history rather than an embarrassment to hide: as an experiment acquires real administrative power, responsible development has to change.

The original mock scaffold still matters, too. The live-data adapters may return sample players during development database errors, and the UI displays an explicit sample-data banner. That helps continue interface work while disconnected, but it also means the operator needs an unmistakable understanding of when records are fiction.

## The visual result

The current shell retains a muted-fantasy aesthetic. Black/slate surfaces carry fog and parchment text with bronze/gold actions; a subtle grain gives the interface texture. Reusable tables, dialogs and right-hand detail/editor panels keep the tool organized. The UI is not simply decorative: showing player status, errors and explicit confirmation before a timeout/ban is part of making serious actions readable.

Some old prototype routes did not survive the May 24 refocus. The current four screens—Dashboard, Players, Content, Settings—tell a truer story than presenting the first scaffold's imagined logs/reports/world-state sections as finished work.

## October 26 — making the work legible and attributable

On **2026-10-26**, commits `169a1af` and `99cdd36` added Babuni.dev credit in docs/package metadata, followed by `93d0360` and `c9fc2b7` establishing a minimal documentation structure and README links. The present session expands that foundation into a detailed record of product purpose, actual source paths, modes, editor behavior, trust boundaries and open verification.

**Human contribution:** the creator's project purpose, original design/coding constraints and authority over changes. **AI contribution in this documentation session:** inspection of Git/source, synthesis, analysis of modes and risks, Markdown writing and commit/verification. The available Git record does not establish who authored each May line or which AI suggestions were accepted then; this record does not invent those discussions.

**What happened in this session:** docs were rewritten and committed. **What did not happen:** no `npm install`, build, lint, browser execution, live database query, moderation action, content write, server deployment or access-control change.

## What the next development chapter should answer

Before Morkahja Admin is connected to sensitive live data as a trusted production console, how will secrets be isolated from the browser? Which backend enforces authorization? How will moderation decisions be audited and rolled back? How will content changes be reviewed and versioned across repositories? These are design and engineering questions for Babuni.dev to decide, not silent decisions made by the assistant.

The portfolio can eventually show that the creation of a game includes its production tools, the experiments that got them working, the risks recognized along the way and the collaboration methods that made later changes reviewable.

## 2026-10-28 — Audit #38: review without rewriting the past

This checkpoint encountered a project whose documentation had already been meaningfully reconstructed two days earlier. The original audit had recorded the May 23 mock-dashboard scaffold, the May 24 expansion into player and content operations, and the uncomfortable boundary between a visually useful local workbench and a truly secure administrative interface. Repeating that narrative as if it were newly discovered would obscure rather than enrich the development record.

Instead, the follow-up read the current package and Vite configuration. The app still declares a `0.0.0` package version and scripts for development, build, lint and preview, but no dedicated test command. Its local-content middleware is registered in the Vite plugins regardless of a UI-level content toggle; the database middleware is conditionally registered when a database URL exists. That is relevant source evidence, not a demonstrated security breach or proof of current deployment.

**Babuni.dev direction:** Continue the numbered documentation audits while preserving creative decisions and Git evidence. **AI contribution:** Verify the existing narrative against selected configuration and append a limited checkpoint rather than manufacture fresh history. **Verification:** Static GitHub file inspection only. **Unchanged:** Code, external game content, credentials and all live player records.
