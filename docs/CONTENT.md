# Morkahja Admin — managed content and data contract

**Creative owner:** Babuni.dev.  
**Scope:** Data schema and content-management interface, **not an export of actual player/game records**.

## What belongs to this repository

This repo contains the **editor and TypeScript schema expectations**, not the live game database or the underlying content JSON and image assets. The source of game data is separately hosted or stored in the external MorkahjaWebApp public tree. Content edits through local middleware can change that separate directory.

| Content kind | External file | Source schema / management |
| --- | --- | --- |
| Encounters | `encountersdata.json` | `EncounterMap`, keys mapping to `EncounterData`; ID, title, type, difficulty, text, image, expansion, follow-up and solution slots. |
| Solutions | `solutiondata.json` | `SolutionMap`; ID, name, text, image icon, inventory type, reward type, solution type and use count. |
| Expansions | `expansiondata.json` | `expansions` object keyed by identifier; cost, reward, active flag, names, summary/text and UI image keys. |
| Frames | `frames.json` | `Frames` array keyed by `frameID`; race, role, frame type and gem cost. |
| Portraits | `portraits.json` | `Avatar` array keyed by `avatarID`; name, type, race, role, gender and gem cost. |

The original game field spellings matter. In `EncounterData`, the actual code uses `mEncounterSolutiuonA` and similar identifiers with that spelling. Correcting these in documentation as though they were typos could break the contract; any schema migration needs game-side coordination.

## Editing and relationships

An encounter editor can change its title, category, difficulty, reward and linked solution choices A–D. The detail panel resolves those references from the solution map and uses expansion data to display context. New encounter keys are zero-padded to five digits; the editor keeps an existing encounter's storage key when updating.

Image workflows include WebP conversion in browser-side utilities, optional title-derived encounter slugs, duplicate-name collision suffixes and file upload through the local plugin. Those are **local file operations**, not proof of a remote content-management backend. Any future art/gallery attribution must distinguish original game images from admin UI thumbnails.

## Player information is privileged, not portfolio material

The player data types include online/offline/banned/timed-out status; avatar detail, achievements, currencies, unlocked expansions, friend references, inventory counts and encounter events. Even when these fields are visible to an authorized operator, they are **not public portfolio content**.

The repository ships mock player objects and activity examples for interface development. Use **synthetic/fictional data only** when making portfolio screenshots or describing UX; don't copy real account identifiers, identity keys, moderation reasons or private player history.

## Content integrity checklist

Before merging future changes, verify ID ranges, encounter-solution cross-references, required fields, external filenames and image types, duplicate key behavior, schema compatibility with MorkahjaWebApp, backup/rollback, and actual save tests. A TypeScript interface alone is not runtime schema validation.

The 2026-10-26 documentation pass did not read or modify game content files, actual player data, or media assets.

## 2026-10-31 — Publication boundaries

The existing standard documentation is the project source for the future portfolio connection. See [publication preparation](PUBLISHING.md). Preserve contributor credits, canonical-source boundaries and original journals. No private findings, live records or secret values are copied into the portfolio.
