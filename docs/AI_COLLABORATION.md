# Morkahja Admin — human–AI collaboration and provenance

**Human project creator / creative director:** Babuni.dev.

## Evidence and creative ownership

This repository records an original dark-atmospheric admin-console direction, a Morkahja-specific content model, and a series of Git commits. The creator's authorship of the project is respected. The code itself and dated commits do **not** provide a complete private design transcript attributing every TypeScript function, API shape, text string or layout decision to an individual human or AI agent.

The `.cursor/rules/morkahja-admin.mdc` rules demonstrate the project's working constraints and should remain part of the history. They do not prove an AI originated those goals.

## Documented AI work — October 26, 2026

An assistant:
- Inspected the current repository structure, source, README and selected May/October Git diffs.
- Identified the initial mock admin scaffold, May 24 content/editor/data integration, current routed screens and data source modes.
- Separated Morkahja Admin's React/browser layer from the VPS/DB and the separate MorkahjaWebApp content files.
- Documented the risks of browser-visible `VITE_` credentials, unprotected development middleware, content writes, sample-data fallback, and unverified deployment.
- Replaced/created eleven Markdown files with a narrative journal and evidence-based roadmap.

That is an **editorial and technical analysis contribution**. It does not establish that the assistant conceived the original admin console, implemented the May features, gained access to the VPS, ran security tests, or approved a production connection.

## Future collaboration record format

For every consequential decision or implementation, record:

1. **Creator direction:** Desired player/operator experience and rationale.
2. **AI interpretation/proposal:** Suggested technical choices, assumptions and tradeoffs.
3. **Iteration:** Alternatives, mistakes, objections, discoveries and rejected experiments.
4. **Creator decision:** Explicitly accepted, rejected or deferred.
5. **Implementation:** Exact code/doc/game-content paths, linked commit or PR.
6. **Verification:** Commands/tests actually run, environment, output and remaining uncertainty.

Distinguish documentation-only commits from frontend, backend, database and external game-data changes. Avoid publishing raw private conversations, real players' account information, database connection strings, API keys, operational hosts, or screenshots containing confidential moderation data.

No code, secrets or real account data were changed or retrieved in the October 26 documentation pass.
