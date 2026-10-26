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
