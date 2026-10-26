# Morkahja Admin — verification roadmap and open engineering work

**Creator:** Babuni.dev  
**Status:** Implementation baseline observed; priorities are **proposals pending creator approval**, not accomplished changes.

## As committed

- React / TypeScript / Vite interface with **Dashboard**, **Players**, **Content** and **Settings**.
- Polling of online/activity data at approximately 5-second intervals.
- Mock mode, VPS admin API clients, dev proxy, local PostgreSQL middleware and local game-JSON/image middleware.
- Player detail panels, timeout/ban/unban actions, content CRUD-like upsert flows and image upload support.
- Dev server bound to 127.0.0.1 by default, port 5180.
- Source files and lockfile committed. No tests or running service verified by this review.

## P0 — credential safety and access boundaries (not implemented)

1. **Move database URL out of `VITE_`-prefixed client-visible variables.** Present code references `VITE_DATABASE_URL` in frontend imports and dev configuration. Test a dev bundle/browser network state to ensure credentials **cannot** be read by a browser; replace with genuinely server-only config if approved.
2. Verify no administrator secret is stored in `VITE_API_TOKEN` or any other browser-exposed variable; use authenticated server-side proxy/auth with least privileges.
3. Add explicit authentication/authorization to any development or deployed moderation endpoint and enforce it on the server. Confirm the actual DB account cannot perform unrelated privileged operations.
4. Review the **always-registered local-content middleware**; `VITE_USE_LOCAL_CONTENT=false` hides UI usage, not the endpoints. Define a privileged local-only access policy before trusting the toggle.
5. Review file upload filename/path handling, file type, size, base64 decoding, request-body limits, and directory confinement; require safe filename validation and consistent error handling before exposing any write routes.
6. Verify the Vite server and tunnels remain bound to loopback, and review CSRF/cross-origin exposure even on local hosts.
7. Add an audited confirmation/authorization flow and server-side actor logging for timeout, ban and unban; validate duration/reason constraints. DB writes and session revocation are currently real when a live DB is selected.
8. Test data recovery and integrity: run content editing only against versioned backups/fixtures until write atomicity, schema validation and rollback are confirmed.

## P1 — functional/integration checks

9. Run `npm install`, `npm run build`, `npm run lint` in a controlled environment and capture actual results. No test command is present; add focused tests before relying on it.
10. Test mock-only startup, mock/player-detail presentation, and clear connection-state differences.
11. Test local DB mode with **non-sensitive fixtures**; session freshness, online state, moderation records, revoked sessions and malformed data.
12. Test VPS API via configured server-side proxy with a non-production test account; verify route availability, authentication, errors and authorization.
13. Test the content routes for all five JSON types, image upload/update, missing files, duplicate keys, invalid IDs, unexpected schema changes and failure recovery.
14. Address **nonlocal content route consistency:** `fetchPortraits` requests `/game/portraits` without `.json`, and the JSON helper does not incorporate the configured `VITE_GAME_DATA_URL`. Distinguish confirmed bug from current source-risk until reproduced.
15. Confirm Content edits propagate to the intended MorkahjaWebApp content, not merely this admin repo; record which separate repository and file revision changed.
16. Confirm 5-second polling does not overload the backend and retries/error banners cannot silently imply real data when mocks are active.

## P2 — usability and accessibility

17. Test responsive layout, keyboard navigation, focus management in editor/ban dialogs, screen-reader labels, high-contrast text, and large player/content lists.
18. Validate encounter/solution relationships and required schema fields against game runtime, not just TypeScript structural types.
19. Create permission-safe examples/screenshots with **synthetic players and sanitized content** for portfolio documentation.

## Creator decisions still open

- Should the application remain **strictly local**, or support a remote browser session after a full security redesign?
- Should a connected test mode be read-only by default, with explicit unlock for irreversible mutations?
- What moderation audit/appeal process does Babuni.dev want?
- How should content changes be versioned, reviewed and reverted across the admin tool and MorkahjaWebApp?
- Should mock fallback automatically substitute for database failures, or require an explicit mode switch?
- Which current P0 issues should be handled before any production connection?

No code changes, infrastructure changes or tests were made during the Oct 26 documentation-only pass.
