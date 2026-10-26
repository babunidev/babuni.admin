# Morkahja Admin — visual and interaction design

**Creative director:** Babuni.dev.  
**Implementation evidence:** `.cursor/rules/morkahja-admin.mdc`, `src/index.css`, React components and page structure.

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

## Accessibility and design questions still open

- Are modal dialogs keyboard-trapped and focus restored after closing?
- Is the muted gold/fog text contrast sufficient under WCAG tests?
- Do data tables and right-side editors work on small viewports with zoom?
- Are upload, save and moderation errors prominent and understandable without relying on color?
- Should destructive moderation operations require stronger confirmation or a read-only mode?
- Are players visibly marked mock/real on every relevant view, not just the listing banner?

These questions are *not* an approved redesign or a completed usability test. Preserve the original style unless Babuni.dev explicitly decides otherwise.
