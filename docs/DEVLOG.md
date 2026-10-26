# arcanitebrothers — development journal

**Author:** Babuni.dev

## Retrospective reconstruction — 2026-10-26

A local browser admin console for the Morkahja game, bringing player moderation, server activity and game-content administration into one dashboard. The tool intentionally runs locally and uses a proxy for admin endpoints and separately hosted game data. Sensitive API keys belong in ignored local environment files, not public documentation. The available work is structured as follows: React, TypeScript, Vite and TanStack Query (package.json); src/App.tsx and components for ActivityFeed, PlayerModerationActions, encounter/solution editors, connection status and content imagery. README records local dev port and a VPS/admin proxy configuration.

The source records substantive choices but not necessarily a full sequence of debate and approvals. Babuni.dev is the original author; AI organized existing material into a development record. No implementation or content was altered beyond these documentation files. Verification remains open: Test production/mock modes, moderation permissions, API failures and handling of admin keys locally. Do not claim access control is sufficient from the UI alone.
