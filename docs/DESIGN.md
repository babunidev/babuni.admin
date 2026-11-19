# Babuni Admin — visual and interaction design

## Batch A Overview cards

Four existing-style StatCards appear below the original overview: Achievements unlocked, Players with achievements, Dice unlocks and Expansion unlocks. The grid uses one column on small screens, two at the small breakpoint and four on wide screens. Valid zero is shown as 0; absent, unsafe or invalid values show Unavailable. Ownership hints distinguish unlocks from purchases and include inactive expansion ownership. The existing checked-at timestamp and explicit refresh flow apply to all cards.


**Creative director:** Babuni.dev.  
**Implementation evidence:** `.cursor/rules/morkahja-admin.mdc`, `src/index.css`, React components and page structure.

## Shared Babuni Admin identity

The app-wide browser title and sidebar brand use **Babuni Admin**. Its favicon and small sidebar mark reuse the exact 64×64 `public/favicon.webp` asset from Babuni Dev; no separate artwork, color adjustment or icon generation is needed. This is a shared brand above the workspaces, not a rename of the Morkahja game. Realm-specific top-bar labels remain dedicated to the Morkahja workspace.

## Keep the game's atmosphere backstage

This is an admin system, but it belongs to the creative world of **Morkahja**. The visual language takes the game's mood into a focused operations UI. The repo's explicit original editor rules call for a **dark, minimal, atmospheric** design and reusable components, rather than unnecessary complexity.

The current CSS establishes:
- Almost-black **void** and dark **slate/ash** layers for low-glare work.
- Muted **bronze/gold** for focus, active navigation and primary actions.
- Light **parchment** text, fog-gray supporting text and restrained ember/red/green status states.
- Small uppercase labels, comfortable content density, borders instead of heavy surfaces, and a subtle static grain.
- Standard system fonts with no bundled custom font requirements.

This is a real design system expressed by CSS tokens, not proposed visual redesign.

## A narrow navigation, deep detail

The shell has four areas: Dashboard, Players, Content and Settings. Dashboard surfaces concise counts and activity. Players offers a sortable overview with one selected-player detail panel; details can show avatar progress, achievements and recent encounter data. Content uses tabs with category-specific lists/image grids and right-side detail/editor panels.

The shell's compact sidebar becomes an overlay on narrower screens. Content panels use inset right-side dialogs to preserve context while editing; Player moderation uses a centralized confirm modal to make serious actions obvious.

## Interaction ethics for admin tools

Timeout and ban are consequential. The current UI displays a confirmation state with reason and duration options (15 minutes, 1 hour, 24 hours, 7 days); unban is currently a direct action without the same confirmation step. UI confirmation is useful but **not** a server authorization policy, audit trail, appeal system or transactional guarantee.

Connection banners and sample-data hints are essential in a hybrid console. A screen that looks “live” because of a polling animation can still be showing mock records. The design must disclose its data source and actual state, especially before operator action.

Game content editors expose underlying schema IDs and keys, image previews, encounter–solution relationships and export-like raw JSON details. This is appropriate for a creator/developer tool, but care is needed with invalid IDs and accidental overwrites.

## Showing that something is working

Some operations take minutes: asking GitHub about every connected repository, building and publishing the website, checking releases on the server. While one runs, its panel shows a thin gold light sweeping along the top edge, a small turning gold ring beside the text that says what is happening, and button labels that change to **Checking…**, **Publishing…** or **Removing…**. Both pieces live in `src/shared/components/Working.tsx` (`Spinner`, `WorkingBar`) for any workspace to reuse. They only animate while a request is actually waiting for an answer, never as decoration. With reduced motion turned on in the system, they glow softly instead of moving.

## Places on the left, pages on top

The sidebar answers *where am I working*: Project Manager, babuni.dev and Morkahja as buttons, with Connection kept apart at the bottom. The top bar answers *which page*: the current workspace's pages as tabs, with a gold underline on the open one. Pages above the workspaces (Project Manager, Connection) have a plain top bar without tabs. This replaced a workspace dropdown with a page list underneath, which took two clicks to change workspace and hid the other workspaces.

## The Projects overview

The Project Manager page sits above the workspaces, so it has its own top bar (**Babuni Admin · All projects**) and a link at the bottom of the sidebar instead of an entry in a workspace menu. Projects are listed on the left, each with its website tint as a small dot and how long ago it was last worked on. The one asking for revision is pinned above the list in ember with a soft glow, the only warm accent on the page, and its detail card carries the same border. The detail sits in the middle (latest changelog entry, last commits, and the document reader once a document is opened), with the Documents column on the right on wide screens. On wide screens the detail stays in view while the list scrolls, so whatever I click is visible at once; long documents scroll inside it. On a phone the three stack, and choosing a project scrolls down to it.

## Saying when the admin is offline

If the local server stops, usually because its terminal was closed, a full-width strip in the alarm red (`--color-alarm`) appears above the sidebar and the page. It says **Babuni Admin is offline** and, in a smaller line, what to do: start Babuni Admin again. Error text elsewhere stays a quiet red; this is the only full red background. It disappears without a click once the server answers again (`src/app/LocalServiceBanner.tsx`).

## Accessibility and design questions still open

- Are modal dialogs keyboard-trapped and focus restored after closing?
- Is the muted gold/fog text contrast sufficient under WCAG tests?
- Do data tables and right-side editors work on small viewports with zoom?
- Are upload, save and moderation errors prominent and understandable without relying on color?
- Should destructive moderation operations require stronger confirmation or a read-only mode?
- Are players visibly marked mock/real on every relevant view, not just the listing banner?

These questions are *not* an approved redesign or a completed usability test. Preserve the original style unless Babuni.dev explicitly decides otherwise.
