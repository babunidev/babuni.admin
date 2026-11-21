# Babuni Admin — Changelog
## 2026-11-21 — The save popup fades out, and Close answers the click

- **Babuni's direction:** the popup should fade out on close as it fades in, and the Close button should give feedback when clicked. Close, Escape or a click beside the popup now fade it out and let it sink slightly over 0.26 s before it is gone. Reduced motion gives a plain fade. The Close button presses in (scales to 95 % and darkens) while clicked and stays pressed while the popup fades. On hover it glows faintly gold, and keyboard focus shows a soft gold ring instead of the browser's white outline. Claude Code (Claude Opus 5.5).
- `SaveResultDialog` fades out on its own and only then calls `onClose`, keeping the latest `onClose` in a ref, so a parent re-render cannot restart the fade.
- Verification: `tests/browser-save-progress.spec.mjs` now checks that the popup is still there and fading right after Close and is gone after the fade. It passes against Vite with synthetic data. Unit suite 144/144, lint and build pass. Screenshot at the moment of the click: `~/Pictures/Development Screenshots/babuni.admin/2026-11-21-babuni-admin-save-progress-closing.png`.

## 2026-11-21 — The save popup fades in and checks steps off one by one

- **Babuni's direction:** no popping. The popup should fade in, the checks should arrive softly, and steps that finish together should still be checked off in order, top first. The popup and its card now fade and rise in, with its steps following one after another. A finished step's mark grows in with a small overshoot and a fading green ring. Finished steps are checked off one at a time, 380 ms apart and 450 ms after the popup opens, so a group finishing together reads as done, done, done. Until its check comes, a finished step shows its text faintly and only one hourglass shows, on the first unchecked step. The heading stays "Saving …" and Close stays disabled until the last check; then the final heading, subtitle and notes fade in. With reduced motion set in the system, everything fades and nothing moves. Claude Code (Claude Opus 5.5).
- `SaveResultDialog` keeps a count of steps checked off and shows the save's real state only up to it; the animations are classes in `src/index.css` (`save-card-in`, `save-step-in`, `save-mark-in`, `save-ring`, `save-text-in`).
- Verification: `tests/browser-save-progress.spec.mjs` now also checks that the record's three steps, finishing together, are checked off from the top with one at a time in between (5, then 6, then 7), and that the heading changes only after the last. It passes against Vite with synthetic data. Unit suite 144/144, lint and build pass. Not yet seen against the live game. Screenshots: `~/Pictures/Development Screenshots/babuni.admin/2026-11-21-babuni-admin-save-progress-started-4.png`, `…-halfway-4.png`, `…-checking-off-3.png`, `…-done-3.png`.

## 2026-11-21 — The save popup ticks off each step as it happens

- **Babuni's direction:** after pressing Save, see every step of the save at once and watch each one turn green as it finishes, then close the popup when it is done. With the live game connected, the popup now opens the moment Save is pressed and lists every step it will run: for each chosen image Live server, Visible to players, Local game and GitHub, then the record's Live game, Local game and GitHub. The running step has a pulsing hourglass, the ones after it are empty circles, and each becomes its check mark (or ✕) as the local service reports it. The Close button reads "Working…" and Escape or clicking beside the popup do nothing until the save ends; then the popup shows the same final result as before. Local-file mode (no connection) is unchanged. Claude Code (Claude Opus 5.5).
- `content-write` and `content-image-upload` in `local-service/server.mjs` answer `application/x-ndjson` when the UI asks for it: one `step` line when the live write is done, one when the commit in MorkahjaWebApp is done (`commitFile` calls `onCommitted` between the commit and the push), and a final `done` line carrying the same status and body as the plain JSON answer. A failure before the first step still answers as plain JSON, and a request without that `Accept` header gets the old response. `localConnectionStream` in `localConnectionClient.ts` reads it; `utils/saveProgress.ts` turns the events into popup steps; `SaveResultDialog` gained the `pending` and `working` states.
- Verification: new `tests/browser-save-progress.spec.mjs` (`npm run test:browser:save-progress`) runs against Vite alone with every local-service request answered by the test with synthetic data, holds each request and checks the popup at each stage: seven steps with the hourglass on the first, Escape ignored and Close disabled; after the image, four checks and the hourglass on Live game; then all seven checks and "All done". It passes, and a new unit test checks the commit is reported before the push and not on an unchanged save. Unit suite 144/144 (not counting the browser spec), lint and build pass. The content browser suite was not run. Not yet tried against the live game. Screenshots from the mock: `~/Pictures/Development Screenshots/babuni.admin/2026-11-21-babuni-admin-save-progress-started.png`, `…-halfway.png`, `…-done.png`.
## 2026-11-21 — Images save with the record, not when chosen

- Choosing an image in a Content editor used to upload it straight away: live server, MorkahjaWebApp commit and GitHub push, before Save. Now choosing only keeps it in the editor with a preview, "Not uploaded yet", and a **Keep the current image** button to drop it. **Save** uploads the chosen images first, then saves the record, and shows one popup with the image steps (prefixed with the image's name) above the record's. Applies to all five editors: encounter image, solution icon, the three expansion images, frame and portrait. Claude Code (Claude Opus 5.5).
- `ImageUploadField` is replaced by `ImagePickField`; `utils/pendingImages.ts` runs the uploads one after another. An encounter's new image is still named after its title, and the record points at that name before it is saved. If an image upload fails, the record is not saved and the editor stays open with your edit and image. If the image is saved but the record then fails, the popup says exactly that. Nothing changed in the local service or on the server.
- Verification: the content browser suite, run with Vite alone against a temporary copy of `tests/fixtures/legacy/` (no connection service, so no live access), passes 7/7. The solution test now checks that a chosen PNG is not written before Save and decodes as WebP after it. The Connection test in that file needs the connection service and was not run. Unit suite 143/143, lint and build pass. Not yet tried against the live game. Screenshot from the fixture: `~/Pictures/Development Screenshots/babuni-admin/2026-11-21-image-chosen-not-yet-saved.png`.

## 2026-11-21 — A new solution picture is marked frameless

- **Babuni's direction:** remade solution pictures should show whole in the game without a code change per picture. The solution editor now ticks `mSolutionIconFrameless` when a new icon is picked, and shows it as a checkbox ("Remade picture without a painted frame") to change by hand. The flag is part of the solution record, so Save writes it live, to MorkahjaWebApp and to GitHub with the rest; the game reads it (MorkahjaWebApp CHANGELOG). `SolutionData` has the optional field; the editor already kept fields it does not show.
- Verification: `tsc -b`, lint of the touched files and the suite (143/143) pass. The content browser test was not run (it needs a fixture server not set up here); the editor was not clicked through in a browser. Claude Code (Claude Opus 5.5).

## 2026-11-21 — Saves land in the local game on main, then GitHub; no side checkout

- **Babuni's direction:** one MorkahjaWebApp project, everything in it, no branches; a save in the admin tool updates the local game, GitHub and the live game. Until now a content save or image upload was committed in a separate checkout, `~/Projects/Morkahja-content-commits` on branch `morkahja-content-edits`, and pushed to GitHub main from there, so the local game never got it (Open Lock's new picture did not show locally).
- `local-service/morkahjaContentGit.mjs` now commits in `~/Projects/MorkahjaWebApp` itself (`MORKAHJA_CONTENT_REPO`, else `MORKAHJA_GAME_REPO`, overrides it), only on `main`, only the saved file (`--only`), leaving Babuni's other edits as they are, then pushes main. Before writing it fast-forwards local main when GitHub is ahead; it never rebases or resets the checkout, and writes nothing locally when main is not on `main` (`CONTENT_GIT_NOT_MAIN`), has diverged (`CONTENT_GIT_DIVERGED`) or cannot catch up without touching uncommitted edits (`CONTENT_GIT_BEHIND`). If local main has its own commits not yet on GitHub, it commits but does not push, so unpublished work is never sent along (`CONTENT_GIT_UNPUBLISHED`). The worktree setup, `morkahja-content-edits` and `MORKAHJA_CONTENT_WORKTREE` are gone.
- The save popup shows a **Local game** step (the commit in MorkahjaWebApp) and a **GitHub** step (pushed or why not), after the live step.
- Verification: `tests/morkahja-content-git.test.mjs` rewritten with fixtures for each case (6/6); suite 143/143, `tsc -b` and lint of the touched files pass. Not yet tried from the running admin tool, which needs a restart to load the change. Claude Code (Claude Opus 5.5).

## 2026-11-21 — Start or restart the local game from Morkahja's Overview

- The description under Morkahja's Overview heading is replaced by one button: **Start backend and frontend** when the game isn't running locally, **Restart backend and frontend** when it is (or when only one half is). A short line next to it shows the game server (port 3000) and client (port 5173) as running or stopped. Claude Code (Claude Opus 5.5).
- `local-service/morkahjaDevStack.mjs` behind two session-protected routes, `GET /morkahja/dev-stack` and `POST /morkahja/dev-stack/restart`. It runs the same commands as a terminal, `npm run dev:backend` and `npm run dev:client` in `~/Projects/MorkahjaWebApp` (`MORKAHJA_GAME_REPO` overrides the path). It only stops processes listening on those two ports whose working directory is inside that checkout, walking up through their `npm`/`sh`/node launchers but never into a shell or terminal; a port held by anything else is reported and left alone. The game starts detached, so it survives an admin restart, with a clean environment (no Babuni Admin tokens, `VITE_`/`BABUNI_`/`MORKAHJA_` variables, `PORT` or `DATABASE_URL`, so the server reads `Key.js` as it does from a terminal). Output goes to `~/.local/state/babuni-admin/morkahja-dev/backend.log` and `frontend.log`.
- Tried on this PC against the running game: the restart stopped the old processes, started new ones and saw both ports up in about 1.2 s; the server log shows it connected to the local database, `/health` answered 200 and the client served the game. The two routes answered through a separate local-service instance, and a POST from another origin or without an origin was refused. Three new unit tests; suite 140/140, lint and build pass. The button itself was not clicked in a browser.

## 2026-11-21 — No Vite config warning at startup

- Vite 8 warned on every `npm run dev` that `vite.config.ts` and the `vite/` plugins import local files without a file extension, which its upcoming native config loader won't support. The eight runtime imports now name their `.ts` file (`vite.config.ts`, `vite/localAdminPlugin.ts`, `vite/localContentPlugin.ts`, plus the same two in the unused `vite/localConnectionProfilesPlugin.ts`); `tsconfig.node.json` already allowed `.ts` imports. Type-only imports were left as they are, since they disappear before loading. Claude Code (Claude Opus 5.5).
- Vite now starts without the warning. Build, lint and the unit suite (137/137) pass.
- Outside this repository: the desktop launcher `~/.local/bin/babuni-admin` printed `curl: (7) Failed to connect` while it waited for the server to come up. Those lines were its own readiness checks, not errors; it now checks silently and still opens the browser once the server answers.

## 2026-11-21 — Quieter Content page header

- Removed three lines of explanation from the top of Morkahja's Content page: the description under the heading, "Using your administrator connection…" and "Live game catalog and images via your administrator connection…". Babuni knows what the page does. The page still says when the administrator connection or connection service is unavailable, and when content is coming from local files or another source instead of the live game. Claude Code (Claude Opus 5.5).
- Typecheck, lint and the unit suite (137/137) pass.

## 2026-11-21 — Edit button for solutions, expansions, frames and portraits

- Only encounters had an Edit button. The other four tabs had an "Add or edit" form at the bottom of the page, and its "Edit “…”" button appeared only there, not in the detail panel you open by clicking an item. Every detail panel now has an **Edit** button in its header, and every tab has an **Add …** button. Both open the same right-side editor the encounters use (`src/features/morkahja/components/ContentEditorPanel.tsx`), and the bottom forms are gone. Claude Code (Claude Opus 5.5).
- When editing, the ID is fixed, so an edit cannot accidentally create a copy under a new key; when adding, the editor warns if the ID already belongs to an entry, because saving would replace it. A failed save shows its error in the editor and keeps it open; a successful save closes it and the detail panel shows the new values.
- The solution editor now covers every field: type, inventory type and reward type were missing (with type and reward labels from `gameDataReference.ts`). The editors show the current image from the live server next to its upload field.
- Saving still goes through the same `create*` functions and the same live-write and GitHub path as before; nothing changed on the server side. Checked against a temporary copy of `tests/fixtures/legacy/` with Vite alone (no connection service, so no live access): the content browser suite passes 7/7, including two new tests that open each detail panel, click Edit and save. The eighth test in that file, the Connection screen, needs the connection service and was not run. Unit suite 137/137, lint and build pass. Not yet tried against the live game.

## 2026-11-20 — Project Manager reads dated `###` changelog entries

- babuni.dev keeps its newest entries as `### Changed — … (2026-11-19)` headings under `## [Unreleased]`. Only `##` headings were read, so the Project Manager took the newest dated release heading (2026-11-13), showed "7 days ago" and asked for revision although the project had been worked on that day. Dated `###` headings now count too; an entry's text ends at the next heading of the same or a higher level. Claude Code (Claude Opus 5.5).
- Checked against babuni.dev's real changelog from GitHub: the newest entry is now 2026-11-19, "Changed — human–AI collaboration record". Two new test cases; suite 137/137, lint and build pass.

## 2026-11-19 — human–AI collaboration record

- Added a rule to `AGENTS.md` and `docs/DOCUMENTATION.md`: `docs/AI_COLLABORATION.md` takes no dated entries; contributions are recorded in the journal and changelog. Claude Code (Claude Opus 5.5).
- Rewrote `docs/AI_COLLABORATION.md` to the shared text used in all of Babuni's repositories: how Babuni works with AI, who did what (the tools and recorded models named in this project's records) and where the details are. The earlier, longer version stays in the Git history. Claude Code (Claude Opus 5.5).

## 2026-11-19 — Project Manager reads changelog dates at the end of a heading

- The "last worked on" date only recognised headings that start with a date or a version and a date. FlourishForever writes `## 0.6.1-beta — spellbook button (2026-11-19)`, so its newest entries were skipped, and an older date from further down the file made it ask for revision although it had been worked on that day. Any `##` heading with a date anywhere in it now counts. The title is the heading without the date.
- Checked against the running app, in a read through the real local service: 44 projects, 41 repositories read, no read errors. A document list and a roadmap read worked, and a path outside the listed documents was refused (`DOCUMENT_NOT_LISTED`). After the fix, all 41 dates come from changelogs. Two new test cases; suite 137/137, lint passes.

## 2026-11-19 — Project Manager detail follows the scroll

- On wide screens, the project detail panel (with its Documents column) now stays at the top of the view while the project list scrolls, and has its own scrolling for long documents. Clicking a project far down the list shows it right away, without scrolling back up. On a phone, where the panel sits below the list, clicking a project scrolls down to it.
- Checked in a browser with 40 sample projects at 1440×900 and 390×844: after scrolling down and clicking the 38th project, its heading was in view (y=101 and y=307). Suite 137/137, lint and `tsc -b` pass.

## 2026-11-19 — Workspace pages as tabs, workspaces in the sidebar

- The sidebar no longer has a workspace dropdown and a page menu. It now lists three places: **Project Manager** (`/projects`, renamed from Projects), **babuni.dev** and **Morkahja**, with **Connection** at the bottom. The current workspace is marked, and so is a Morkahja subpage such as `/players`.
- Each workspace's pages are tabs in its top bar (`src/app/WorkspaceTabs.tsx`): Overview, Moderation, Content and Settings for Morkahja, and Overview, Documents and Repositories for babuni.dev. On a phone the tabs scroll sideways.
- The Morkahja top bar loses the "Realm Console" heading and server name, which the tabs replace. Its connection badges, version and clock stay on the right from tablet width up. The babuni.dev top bar shows `www.babuni.dev` on the right.
- Project Manager and Connection share a top bar for pages above the workspaces (`src/app/MetaTopBar.tsx`, which replaces `ProjectsTopBar.tsx`). Connection no longer shows Morkahja's top bar.
- The workspace label "Babuni Dev" is now "babuni.dev".
- Tests: regression and browser tests updated from the dropdown to the sidebar buttons and tabs. Suite 137/137, browser suite 6/6 against a mock-data preview, lint and `tsc -b` pass. Screenshots were taken from sample data.

## 2026-11-19 — Projects overview above the workspaces

- New **◇ Projects** link at the bottom of the sidebar, above **Connection**, opening `/projects`. It belongs to no workspace and has its own top bar (`src/app/ProjectsTopBar.tsx`).
- The page lists every project on www.babuni.dev in one column, read from the babuni.dev checkout (`src/content/project-repositories.json` for repositories and branches, `src/lib/demo-projects.ts` for names, summaries and tints). Projects with a connected repository are sorted by when they were last worked on, and the others are listed under **No repository connected**.
- The project that has waited longest is pinned above the list under **Asks for revision**, in ember, and opens by default. "Last worked on" is the date of the newest dated `##` entry in the project's `CHANGELOG.md`, or its last commit if it has no dated changelog entry. Bulk commits, such as the 2026-11-18 documentation commit across many repositories, therefore do not hide a quiet project.
- Clicking a project shows its latest changelog entry, its last five commits (linked to GitHub), and a Documents column. The column has cards for Changelog, Devlog, Roadmap, Readme and Concept, whether at the root or in `docs/`, and an expandable list of every other Markdown file. A document opens inside the page.
- New `local-service/projectOverview.mjs` with three read-only routes: `POST /projects/list`, `/projects/documents` and `/projects/document`. The list is one GitHub GraphQL query for all repositories through the existing `gh` login, cached for ten minutes (**Refresh** reads again). The browser can name only a project id from the website's list and a path that project's own tree listing returned. Hidden folders, non-Markdown files and files over 1 MB are refused, and repository names that are not plain names are treated as unconnected.
- New `src/shared/components/Markdown.tsx`, a small reader that builds React elements only (no HTML from documents) and links only `http(s)` addresses.
- Tests: `tests/project-overview.test.mjs` (5 tests: project order and name validation, changelog dates, query quoting, the revision choice and cache, document allowlist). Suite 137/137, lint and `tsc -b` pass. A run against the real repositories listed all 44 website projects, with 41 connected repositories read. Screenshots were taken from sample data.

## 2026-11-19 — documentation moved into `docs/`

- Moved `CONCEPT.md` and `ROADMAP.md` into `docs/`. The root keeps only `README.md`, `AGENTS.md`, `LICENSE` and `CHANGELOG.md`; links to the moved files and the documentation rules in `AGENTS.md` were updated. No code changed. Claude Code (Claude Opus 5.5).

## 2026-11-19 — Offline banner when the local server stops

- When the terminal running `npm run dev` is closed, every page now shows a red strip across the top: **Babuni Admin is offline**, with a line saying the page cannot reach the local server and to start Babuni Admin again. It disappears by itself once the server answers again.
- New `src/app/LocalServiceBanner.tsx` and `src/app/localServicePresence.ts`. The banner asks `/local-connections-api/session` when the page opens, every 5 seconds, and when the window regains focus or becomes visible. No answer, or a 5xx answer from the Vite proxy, counts as offline; a 4xx answer still counts as online. `localConnectionClient.ts` reports the same result after every local service request, so a failed save shows the banner immediately. The check sends no credentials and reads no data.
- `AdminLayout.tsx` places the banner above the sidebar and the page; `index.css` adds the `--color-alarm` red.
- Babuni confirmed the banner works in the running app. One assertion added to `tests/regression.test.mjs`. Suite 132/132, lint and build pass.

## 2026-11-16 — Every encounter in the Content list

- Content → Encounters showed only the first 100 encounters, without a way to see the rest, although the live catalog has more than 200. The list now shows every encounter on one page; the images in it still load only when their row scrolls into view. A line above the table says how many encounters are listed, or how many match the search. Asked for by Babuni; change made with Claude Code (Claude Opus 5.5). Suite 132/132, lint and `tsc -b` pass.

## 2026-11-16 — Image uploads go where players get images

- The server check (`scripts/morkahja-live-check.py`, run by Babuni on the server) showed: the backend has all five admin content routes, `ADMIN_API_KEY` is set, and the game answers 401 without it and 200 with it (203 encounters). Nginx serves `/Morkahja/` from `/var/www/morkahja-subpath/web/Morkahja`, a link to the root-owned release `20261115-060951`, which the `babuni` login cannot write. `/var/www/morkahja` is an older copy that players never receive.
- Uploads now go to `/var/www/morkahja-subpath/uploads/Morkahja/<folder>`, owned by the administrator login. Nginx will serve `/Morkahja/game/` and `/Morkahja/UI/` from that folder first and from the current release otherwise, so an upload survives a release. Each upload is also committed to the game repository, so the following release carries it as well. A new encounter image name avoids names the release already uses.
- The image reader and the image cache sync read the same two folders in the same order, instead of `/var/www/morkahja`.
- New `scripts/morkahja-image-uploads-setup.py`, which Babuni runs once with sudo. It creates the upload folders, changes only the `/Morkahja/(UI|game)/` Nginx block to `try_files /uploads$uri /web$uri =404;`, backs the file up, and reloads only when `nginx -t` passes (otherwise it restores the backup). It stops without changes if the block on the server is not the expected one. Babuni ran it on the server the same day: the five upload folders were created, `/etc/nginx/snippets/morkahja-locations.conf` was changed (backup `morkahja-locations.conf.bak-20261116-183617`), `nginx -t` passed and Nginx was reloaded, and `https://www.babuni.dev/Morkahja/game/encounterimages/20115_lianipred.webp` still answered 200. No image has been uploaded through the admin yet.
- The server check now reads the backend Git state despite the folder owner (`safe.directory`) and lists the upload folders.
- Tests: two new cases (an upload overrides a release image; a new name skips release names), and the single-image reader was run against temporary folders. Suite 132/132, lint and build pass.

## 2026-11-16 — Save results, live image uploads, full content editors

- Every save from Content (encounter, solution, expansion, frame, portrait) now opens a popup in the middle of the screen with each step on its own line. **Live game** says whether the running game wrote the catalog and the record read back unchanged. **GitHub** gives the pushed commit, its message and a link, or says why it was not committed. Clicking beside the popup, Escape or **Close** dismisses it. A failed save opens the same popup with a plain explanation of the error code (`src/features/morkahja/components/SaveResultDialog.tsx`, `src/features/morkahja/utils/saveResults.ts`).
- A failed GitHub commit no longer turns the whole save into an HTTP 422. The live write has already happened, so `content-write` now answers 200 with `git.ok: false` and the code, and the popup shows the live step done and the GitHub step failed. The content worker also reports whether it wrote through the game (`via: "game"`) or directly to the file (`via: "file"`).
- Images can be uploaded to the live server with the one administrator connection: encounter images, solution icons, the three expansion images, frames (`frame_<id>.webp`) and portraits (`avatar_<id>.webp`). New route `POST /<profile>/content-image-upload`, new `local-service/morkahjaImageWrite.mjs` and `scripts/morkahja-image-write-worker.py`. The worker writes one WebP into one of five fixed folders, with no path from the browser. It refuses links and non-WebP data, writes through a temporary file and a rename, and reads the file back. The local service then downloads the image from `https://www.babuni.dev/Morkahja/…`, the address players use, and compares the bytes. The image goes into the local image cache, and is committed and pushed to `client/public/<folder>/` in `babunidev/Morkahja`, so the next game release keeps it. The popup shows **Live server**, **Visible to players** and **GitHub** separately.
- Encounter images get a new file name from the title (`2_title`, `3_title`… when taken), and the editor switches to it; saving the encounter makes the game use it. The other kinds replace the file of that name.
- Solutions, expansions, frames and portraits can be loaded into their editor with **Edit “…”** and saved back under the same id. Expansions, frames and portraits now show every field instead of only name and id.
- The Content page no longer says backups protect edits. Saves through the game make no server-side backup; GitHub history is the record (see DECISIONS, 2026-11-16).
- New `scripts/morkahja-live-check.py`, a read-only check the operator runs over SSH. It prints the deployed backend commit, the admin content routes, whether `ADMIN_API_KEY` is set (never its value), where Nginx serves `/Morkahja/` from, and who may write each image folder.
- Tests: `tests/morkahja-image-write.test.mjs` (4 tests: the real worker against temporary folders, request validation, the separate server and public steps, the byte comparison) and one image case in `tests/morkahja-content-git.test.mjs`. Suite 130/130, lint, `tsc -b` and build pass. Popup screenshots taken from sample data. **Not yet live:** no image has been uploaded to the server. The writer uses `/var/www/morkahja`, the folder the image reader already uses. The server check still has to confirm that Nginx serves players from that folder and that the SSH login may write to it.

## 2026-11-14 — Morkahja content saves commit to GitHub

- Saving an encounter, solution, expansion, frame, or portrait still updates the live game catalog. After that write succeeds, the same record is committed and pushed to `babunidev/Morkahja` `main`, with the message form `Admin: update encounter <id> (<title>)` (and the matching form for the other catalog kinds).
- The commit is made from a checkout of that repository kept on main (`/home/babuni/Projects/Morkahja-content-commits` by default), so the open working branch is left alone. An unchanged record does not create an empty commit. If the GitHub step fails, the live revision is kept and the editor says the commit failed.
- The content worker now publishes through the running game at `127.0.0.1:3000` into `/home/morkahja/arcanitebrothers/server/game`, and accepts catalog ids up to 99999. A failed save is shown inside the encounter editor.
- Checked with `tests/morkahja-content-git.test.mjs` against a temporary repository, and with the content SSH fixture for an id above 10000. Lint and `tsc -b` passed. No live encounter was edited, and no content commit was pushed to GitHub during that check.

## 2026-11-14 — Morkahja moderation always on

- `npm run dev` now sets `BABUNI_MORKAHJA_REMOTE_MODERATION=enabled` itself. Before, it had to be typed on every start, and a plain `npm run dev` left Moderation refusing every request with `REMOTE_MODERATION_DISABLED`. The launcher environment moved into `scripts/devEnv.mjs`. A value already set in the shell (for example `disabled`) still wins. The service keeps its own gate check, so starting it any other way leaves moderation off, and the content gate is unchanged.
- Added `tests/dev-launcher.test.mjs` (4 tests). Suite 123/123; lint and build pass. Not yet seen in the real app started this way: the instance running on Nobara was already started with the variable by hand.

## 2026-11-12 — A fixed place for development screenshots

- `docs/TESTING.md` now says where screenshots taken while developing or testing go: `~/Pictures/Development Screenshots/babuni-admin/`, named `YYYY-MM-DD-<what-it-shows>.png`. The working-animation screenshot was moved there. Documentation only.

## 2026-11-12 — Visible working state in Babuni Dev

- New shared `src/shared/components/Working.tsx`: `Spinner` (a small turning gold ring) and `WorkingBar` (a thin light sweeping along a panel's top edge). The sweep keyframes are in `src/index.css`. With reduced motion on, both glow instead of moving.
- Publish panel: the bar and a spinner in the headline while it checks or publishes, plus the buttons now read **Checking…** / **Publishing…** and *Connected repositories* shows a spinner (also for **Check again**). Old releases panel: the bar and a spinner in the **Checking…** / **Removing…** buttons. Repositories page, document rows and the document diff also show a spinner while they wait. Status text has `role="status"` and panels have `aria-busy`.
- Lint, build and the suite (119/119) pass. Seen in Chromium (Playwright 1.56.1, installed locally as `docs/TESTING.md` describes) against a mock-mode preview, with the repository check held open: the sweeping light, both spinners and the **Checking…** button showed as intended. Not yet seen against the real local service.

## 2026-11-12 — No false "Another publish is running" on opening the Overview

- Opening the Babuni Dev Overview could show **Another publish is running** under *Connected repositories*, and the headline **The check did not finish**, even though nothing was publishing. In development, React StrictMode mounts the publish panel twice. Both mounts asked for a fresh all-repository check, the first took the publish lock, and the second (the one the page keeps) got `PUBLISH_BUSY`. It only showed once the ten-minute check cache had expired.
- `repositoryChanges` in `local-service/portfolioSite.mjs` now hands a second request the result of the check that is already running, instead of starting a new one. A real publish, pull or release operation still blocks a new check with `PUBLISH_BUSY`.
- Added a test to `tests/portfolio-site.test.mjs`; it fails without the fix. Suite 119/119; build and lint pass. The fix still needs to be seen working in the real app on Nobara.

## 2026-11-10 — See what changed in a document before publishing

- In the publish panel, each changed document is now clickable and opens a line diff: the version on the website (the babuni.dev snapshot) against the current version in its repository, with added lines in gold, removed lines in red and three lines of context. It warns when the repository has new commits since the check. Images are listed without a diff.
- New read-only route `POST /portfolio/document-diff` (`local-service/portfolioDiff.mjs`). It only compares documents the last all-repository check listed, reads GitHub through `gh api` at the branch's current head, and diffs with `git diff --no-index`.
- Added `tests/portfolio-diff.test.mjs` (5 tests). Suite 118/118; build and lint pass.
- Verified read-only against the real repositories: a fresh check listed babuni.admin (3 documents) and eldgrim (8 documents). The diffs showed babuni.admin's one changed DEVLOG paragraph and eldgrim's 14 new DEVLOG lines.

## 2026-11-10 — Documentation readability

- Replaced a long sequence of dated status notes with a clear guide to the Morkahja and Babuni Dev workspaces, local setup, permissions and security. This editorial change did not run privileged operations or deploy anything.

## 2026-11-10 — Remove old website releases

- New **Old releases on the server** panel on the Babuni Dev Overview: **Check** lists the releases that would be removed and the space they free, and **Remove N old releases** removes exactly that list. The live release, the one before it, anything newer than the live one and the newest five always stay. Folders with other names are listed and never removed.
- New `local-service/portfolioReleases.mjs` and routes `POST /portfolio/releases-check` (read-only) and `POST /portfolio/releases-cleanup`. One fixed Python program goes over the pinned website deployment login. The cleanup needs a check from the last ten minutes, and the server rechecks the live release before removing anything (`PLAN_STALE`). Shares the publish lock.
- `babuniDevConnections.mjs`: the website SSH target (pinned host, deployment key check) is now `portfolioDeployTarget`, shared by the connection check and the cleanup. Behavior unchanged.
- Added `tests/portfolio-releases.test.mjs` (9 tests; the real Python program runs against fake release folders with hard links). Suite 113/113; build and lint pass.
- Read-only check against the live server: live `20261110-054329-8c8b747-site`, 5 releases kept, 10 removable (about 156 MB), 8 older folders with other names listed.
- First real cleanup on Nobara (operator): 11 releases removed, about 174.9 MB (one more than the earlier check, because a new publish had happened since). Verified afterwards: live site 200, `release.txt` unchanged at `20261110-092822-6b3b443-site`, 5 releases kept, nothing left to remove, the 8 older folders untouched.

## 2026-11-10 — Old Morkahja Overview profile retired

- The operator ran **Remove unused Morkahja server profile** on the Connection page. The local profile list (`~/.config/babuni-admin/connections.json`) now holds only the Morkahja administrator, the Babuni Dev GitHub profile and the website publish profile. The retirement action also cleared the old profile's keyring credential. The private `~/.config/babuni-admin/morkahja-probe.json` server config was left on disk by design. No profile reads it any more: the administrator uses `morkahja-moderation.json`. It can be deleted by the operator, or kept as a record.
- No code changes.

## 2026-11-10 — First real one-click publish

- Verified on Nobara through the Overview's **Publish everything** (operator screenshots): document changes from babuni.admin and eldgrim pulled, snapshot commit `6f4f44a` pushed to babuni.dev, release `20261110-052014-6f4f44a-site` published and verified with 46 changed files. The previous release `20261110-051242-a215af6-site` stays for rollback. The follow-up check reported everything live; `https://www.babuni.dev/release.txt` was confirmed independently.
- No code changes.

## 2026-11-10 — One-click publishing on the Babuni Dev Overview

- The Babuni Dev Overview now opens with a publish panel (`src/features/babuni-dev/components/PublishPanel.tsx`). It checks automatically: the live release from `https://www.babuni.dev/release.txt`, commits on babuni.dev `origin/main` that are not live, a waiting snapshot, uncommitted files in the checkout, document changes in all connected repositories (cached for ten minutes; **Check again** refreshes), and GitHub repositories that are not on the website.
- **Publish everything** runs pull, snapshot commit and push, and site publish in one call, with no second confirmation. Removed documents are listed in red before the click.
- New local-service routes: `GET /portfolio/site-status`, `POST /portfolio/changes`, `POST /portfolio/publish-all`. Publish-all still needs the page's all-repository check from the last hour, stops before writing on a wrong branch or stale checkout, and restores the snapshot if the write would remove more documents than the check showed (`CHANGED_SINCE_CHECK`).
- Fix (same day, before any real publish): **Publish everything** now refuses when the document snapshot already has uncommitted changes (`SNAPSHOT_DIRTY`) and the panel pauses with an explanation. It previously would have committed and pushed such a snapshot alone. Found when another session's unfinished babuni.dev work (new repositories added to the connection map and snapshot) left the snapshot modified. Test added; suite 104/104.
- Mapped `publish-site.sh` exit code 5 (`VERIFY_FAILED`, automatic switch back to the previous release), which the babuni.dev checkout is adding.
- Eight new tests (17 in `tests/portfolio-site.test.mjs`); suite 103/103, build and lint pass.
- Verified read-only on Nobara: live release `20261110-004601-fd89891-site` read and matched to `origin/main`; 37 repositories checked (babuni.admin had document changes); six GitHub repositories listed as not on the website. No publish was run.

## 2026-11-10 — Agent instructions brought up to date

- `AGENTS.md`: replaced the outdated `BABUNI_MORKAHJA_MODERATION_WRITES` requirement with the current single-administrator behavior (the switch was removed on 2026-11-06; the per-operation role check remains) and named `scripts/morkahja-admin-role.sql` in place of the removed read-role script.
- `AGENTS.md`: recorded the decision that finished work is documented, committed and pushed to `main` without asking; live server and website changes still need confirmation.

## 2026-11-10 — Babuni Dev Repositories page

- Added `local-service/portfolioSite.mjs` and six session-protected routes for documents from the other connected repositories: list sources and checkout state, pull check, pull write, commit-and-push of the snapshot file, site dry run and site publish. They run babuni.dev's `scripts/pull-repository.mjs` and `scripts/publish-site.sh` with fixed arguments; targets are limited to the connected repositories in the babuni.dev connection map.
- Writes require a preceding check: a snapshot write needs a check of the same target and explicit acceptance when documents would be removed; a site publish needs a dry run of the same `origin/main` commit. The commit step stages nothing else, refuses other branches, a stale checkout and unpushed commits that touch other files.
- Added `local-service/publishLock.mjs`; single-document publishing now shares this lock with the new operations.
- Added the Repositories page and navigation entry under Babuni Dev, with three confirmed steps (pull, commit and push, publish).
- Added `tests/portfolio-site.test.mjs` (10 tests: parsers, allowlist, check-before-write gates, commit isolation against a local bare remote, exit-code mapping, shared lock). Suite 96/96; `npm run build` and `npm run lint` pass.
- Replaced the Babuni Dev Overview placeholder ("content manager is planned") with links to Connection, Documents and Repositories and a short list of what is not available yet; the top bar no longer says "Planned features". Browser smoke tests updated for three navigation links (not run locally; Playwright is not installed here).
- Consolidated `ROADMAP.md`: one current open-work list at the top; items found done or superseded in the dated sections are marked with their evidence.
- Ignored Python `__pycache__/` directories.
- Verified read-only against the real checkout on Nobara (AI-run, through the module): source listing (37 repositories), checkout state, pull checks (`--all` and one repository; no document changes at the time) and one site dry run (built `fd89891`, 1045 files, live release `20261110-004601-fd89891-site`, nothing to publish). No snapshot write, push or site publish has been run through the page yet.

## 2026-11-09 — Babuni Dev Documents page

- Added `local-service/portfolioDocuments.mjs` and three session-protected routes (`GET /portfolio/documents`, `POST /portfolio/document-check`, `POST /portfolio/document-publish`). Requests accept only the standard babuni.dev document names; the browser cannot supply a command, a path outside that list or a shell string. One run at a time, bounded output, timeouts, and failure categories that expose no raw error text.
- Added the Documents page and navigation entry under Babuni Dev. A document is checked against the live site first, and publishing needs an explicit confirmation.
- Publishing uses the babuni.dev repository's `scripts/publish-document.sh`, which needs the deployment key loaded in the desktop SSH agent and stops with a clear message otherwise.
- Added four tests for the route module; relaxed one outdated regression assertion that pinned the Babuni Dev navigation to a single link. Suite: 86/86.
- Verified: dry-run checks through the routes, and one real publication through the page (release `20261109-123701-c67d005-doc`). Only babuni.dev documents are supported; editing and other repositories are not implemented.

## 2026-11-08 — Repository consolidation and login-script fix

- Merged pull requests #28 and #29 into `main` (merge commits `af597ab` and `18ce036`, 2026-11-07). Closed #8, #9 and #30 as superseded and deleted 31 remote branches after checking each against its pull request.
- Fixed `scripts/ssh-agent-login.py`: the session's `SSH_ASKPASS` helper is now tried before the KDE default. The login test no longer depends on the desktop it runs on.
- Babuni Dev connection check verified on the Nobara desktop (GitHub, HTTPS, SSH release staging).

## 2026-11-07 — Fix portfolio SSH check blocked by Morkahja switch

- Corrected the Babuni Dev administrator check after a real Nobara screenshot showed GitHub and HTTPS passing but server SSH returning `REMOTE_MODERATION_DISABLED`.
- Babuni Dev now validates the approved VPS SSH host pin directly, then uses the pre-existing `babunideploy` key on standard SSH port 22. It no longer requires Morkahja moderation to be enabled and does not alter the game's moderation authorization.
- Improved the UI to explain connection results in readable language, while retaining detailed codes in the local service response.
- Added isolated regression coverage; the real website SSH check still requires operator verification.

## 2026-11-07 — Consolidate Babuni Dev into one administrator connection

- Replaced the two per-target Babuni Dev setup cards with one preconfigured Babuni Dev administrator view on the existing **Connection** screen.
- Added a manual read-only check of the canonical website's deployed directory using the existing approved VPS host pin and pre-existing `babunideploy` SSH key with a fixed remote Python inspector. The probe also checks whether the deployment release directory is writable, without writing anything. No arbitrary remote filesystem access or upload is exposed.
- Kept GitHub CLI and public HTTPS checks as separate observable statuses; successful checks never claim write or publishing permission.
- Added a one-time, capability-restricted retirement path for the superseded Morkahja Overview profile, removing its saved keyring entry only on the user's explicit action.
- Added targeted tests for the integrated portfolio check. No production file, service, GitHub document or SSH credential was changed.

## 2026-11-07 — Babuni Dev checks in the existing administrator console

- Added two manual Babuni Dev connection cards to the previously established single **Connection** screen, leaving Morkahja's own connection and workspace UI in place.
- Added fixed outbound read-only probes through the existing local service: authenticated GitHub CLI repository metadata and canonical HTTPS website response.
- Preserved Morkahja connection kinds, SSH/content/moderation capabilities and all existing game-side routes.
- Added narrow scope/denial regression coverage and adjusted existing service capability checks. Website publishing, new admin accounts, production file writes and actual desktop verification are not included.

## 2026-11-06 — Persistent workspace artwork cache

- Replaced the 48-item, memory-only gallery cache with profile-scoped local disk storage in `~/.cache/babuni-admin/morkahja-images` (or `$XDG_CACHE_HOME/babuni-admin/morkahja-images`).
- A single outbound, host-pinned SSH session checks the five approved WebP asset directories and streams new or changed files to the cache. Unchanged files are not transferred; removed filenames are pruned after a complete sync.
- Every Morkahja workspace entry starts a cache check; changes are checked again every ten minutes while that workspace is open. Existing local art remains available when the SSH server cannot be reached.
- Content previews now read files from the local service instead of opening SSH per image. A separate bounded browser memory layer makes repeated tab switches immediate, with visible sync progress and automatic refresh of changed images.
- Added cache integrity/bounds, offline and persistence fixtures. Initial real-server bulk sync and performance require operator verification.

## 2026-11-06 — Read live Morkahja images through existing administrator SSH

- Added an authenticated, bounded `content-image` request to the local service. It uses the same configured and pinned SSH identity as Content catalogs, not a new public domain or another password.
- Whitelisted only WebP filenames in five fixed deployed game image folders; no arbitrary browser paths, writes or shell arguments. Remote files are checked for size, type and symlinks before returning bounded image bytes.
- Integrated lazy image loading into encounters, solutions, expansions, frames, portraits and content detail views with two concurrent transfers and a bounded in-memory image cache.
- Added tests covering request validation, worker invocation, fixed paths and the session-protected endpoint. Live asset delivery is pending Nobara acceptance.

## 2026-11-06 — Fix unified Content config import

- Corrected missing `readMorkahjaModerationConfig` import in `local-service/morkahjaContentConfig.mjs`. Before this fix, a real Content request using the administrator profile threw a reference error that the runner reported as `REMOTE_CONTENT_FAILED`; Overview and Moderation were unaffected.
- Added a regression assertion for the import. This is a source fix; live remote Content access needs a new operator test.

## 2026-11-06 — One Connection interface

- Renamed the global navigation entry and page from Connections to **Connection**.
- Reused the configured owner administrator identity automatically in Morkahja Overview, Moderation and Content; removed their separate profile dropdowns.
- Displayed live-server metadata, keyring credential status, last activity, SSH host checking, database read checking and server metadata editing in Connection.
- Kept older profiles in collapsed migration details without deleting credentials or server configuration.
- Prevented the legacy mock API indicator from appearing as a live connection status when an administrator profile is configured.
- Stopped Content queries from loading the local/static source before connection lookup resolves.
- Live Moderation player listing was verified by the creative (62 accounts). Other live writes and website publishing remain unverified.

## 2026-11-06 — Unify Morkahja administration under one operator identity

- Consolidated Overview, Moderation and Content onto one selectable administrator profile and one stored database credential, sharing the existing pinned SSH identity.
- Replaced the proposed additional read-only moderator login with a reviewable `babuni_admin` role for the tool's existing player reads, moderation changes and Overview views.
- Removed the extra ban/timeout write-enable environment switch. Fixed SQL operations, moderation transactions, session revocation, source errors and content-file backup/revision checks remain.
- The original Overview reader remains supported as a migration fallback. Remote images and live write verification remain unfinished. No server role, account or file change was performed by the AI.

## 2026-11-06 — Make legacy moderation/content connections explicit

- Removed silent sample-player and mock-player-detail fallbacks after direct PostgreSQL read failures; errors now remain errors.
- Displayed the configured source and live-authorization limitation on existing Moderation and Content pages; content fetch failures now show an explicit error instead of an apparently empty catalog.
- Added regression checks for legacy source fallback and source disclosure.
- Added a separately opted-in SSH/PostgreSQL moderation connection profile, fixed list/detail and atomic timeout/ban/unban service operations, a profile selector, and failure/cleanup tests. No existing restricted Overview privilege is widened.
- Separated SELECT-only player inspection from separately gated moderation writes; prepared unapplied SQL for a dedicated read-role. Fixed player list progression levels, source-qualified player details cache, error versus missing-player handling and sample/online-estimate labeling; added full detail and privacy fixtures.
- Added deployed-schema metadata preflight and a Nobara helper for creating a separate private moderation config from the already verified Overview metadata without copying database secrets; documented the operator-run role setup and live test commands.
- Added a separately gated SSH content profile, fixed remote JSON catalog reads, per-profile revision checks and atomic backed-up catalog writes for the five existing Content editors. Image upload through this profile remains unavailable.
- No production moderation/content credentials, remote filesystem permissions, database migration or game-data mutation were applied in this change; activation and live verification are pending.

## 2026-11-05 — Connect Batch A aggregates to the local Overview

- Added four fixed aggregate fields and Overview cards for achievements and non-default dice/expansion ownership.
- Added separate exact `readOnlyMetricFields` approval while preserving existing player-field authorization, SSH lifecycle and no polling.
- Validate nonnegative safe-integer counts and quality signals; missing or invalid aggregates remain unavailable. Recover expected optional-view SQL failures inside the same read-only snapshot.
- Extended raw-table boundary rejection to `player_achievements`.
- Added unit, PostgreSQL recovery and browser display fixtures. Updated a legacy PostgreSQL Overview assertion for four additional nullable fields; all five CI jobs passed in [run 42079244053](https://github.com/babunidev/babuni.admin/actions/runs/42079244053). Operator-provided Nobara screenshot on 2026-11-06 confirms live rendering of all four new cards at 75/52/10/6 alongside original counters and player preview; live error-state exercises remain pending.
- Recorded the operator's separately approved and committed live view, catalog match, aggregate results and permission checks.

## 2026-11-05 — Prepare the deployed expansion catalog audit

- Added a standalone, operator-run read-only verifier for the live game-server `expansiondata.json`, comparing canonical IDs to the previously prepared Batch A SQL allowlist.
- Added synthetic tests for expected and unexpected IDs, invalid catalog contents, duplicate JSON keys and symbolic-link rejection.
- Documented an operator-only live verification procedure and the separate production SQL approval gate.
- No remote access, production schema change, grant, game-data modification or new Overview counter was performed.

## 2026-11-05 — Prepare Batch A owner-controlled aggregate SQL

- Added an operator-gated SQL view definition for earned achievements, unique players with achievements, non-default dice skins and expansion ownership.
- Added a database-owner boundary with view-only SELECT grant to `babuni_admin_probe`, leaving the six audited raw game tables inaccessible.
- Added invalid ownership diagnostics so malformed JSON or unknown catalog values produce unavailable aggregates rather than plausible but incorrect zeros.
- Added offline SQL-contract and isolated PostgreSQL fixture tests; included the new PostgreSQL test in `npm run test:postgres`.
- The initial implementation CI passed all five jobs, including disposable PostgreSQL fixture and browser regression checks ([run 42047478095](https://github.com/babunidev/babuni.admin/actions/runs/42047478095)); deployed expansion catalog confirmation and separate explicit authorization remain required before any production DDL. No live database operation, dashboard change or new runtime adapter was performed.

## 2026-11-05 — Propose source-backed Overview statistics

- Documented an exact candidate contract for presence, rooms, achievements, gems, expansion/dice unlock ownership and deferred purchase reporting.
- Cross-checked the proposed two-minute presence window against the game's 45-second client heartbeat and eight-hour session duration; separated open rooms from verifiably active rooms.
- Added data-validation requirements, explicit unavailable states, and a staged implementation/test sequence with protected aggregate-only database views.
- Preserved creative approval and live JSONB/aggregate validation as pending gates. Documentation-only; no runtime code, new SQL views, database access or counters were changed.

## 2026-11-05 — Record live restricted-role verification

- Recorded the operator's second read-only PostgreSQL audit: the dedicated `babuni_admin_probe` login has no elevated PostgreSQL role attributes, no role memberships and no CREATE privileges on the checked database or schemas.
- Updated the statistics discovery document and roadmap with the evidence and clearly limited verification scope.
- Kept metric definitions, aggregate-only views and dashboard counters unimplemented.
- Documentation-only change; no production database configuration, application code or privileges changed.

## 2026-11-05 — Record the live Morkahja metadata audit

- Documented the operator's successful, read-only metadata audit of live Morkahja PostgreSQL objects.
- Confirmed six audited `public` tables and two restricted `babuni_admin_ro` views, all owned by `morkahjadbadmin`, with `babuni_admin_probe` SELECT confined to the views for the checked objects.
- Recorded verified column types and that `purchases` and `processed_stripe_events` were not found in the audited `public` schema.
- Kept role memberships, additional privileges, JSONB content shape, commerce location and metric semantics unverified; updated the roadmap only for the completed metadata-audit checkpoint.
- Documentation-only change; no project code, live database, grants, game records or new counters were modified.

## 2026-11-05 — Roadmap and operator-verification reconciliation

- Updated previously stale roadmap tasks for live player-preview pagination, gameplay-responsive session/event counters and the recovered remembered-profile combined Overview.
- Recorded operator-reported SSH-agent readiness with the approved public-key fingerprint after the requested fresh-login check, preserving the distinction between command output and independently observed login behavior.
- Clarified that controlled SSH read interruption, live database metadata auditing and new aggregate metrics remain pending.
- Documentation only; no runtime code, database, server configuration or test suite was changed.

## 2026-11-05 — Read-only Morkahja metrics discovery

- Reviewed the actual Morkahja game data sources for rooms, player presence, achievements, gem balances, dice/expansion unlocks and purchase records.
- Added a source-backed candidate-metric contract and a fixed, metadata-only PostgreSQL audit script to validate the live schema before implementing counters.
- Added a regression test checking that the audit contains only read-only catalog inspection and no raw game-data retrieval or mutations.
- No live database tables, permissions, views, remote connections or dashboard counters were changed.

## 2026-11-05 — Optional SSH identity loading at desktop login

- Added operator-installable `scripts/ssh-agent-login.py` with install, run, status and uninstall modes.
- The helper reads the existing secure identity configuration, detects the approved fingerprint in the current desktop agent, and uses graphical SSH askpass if loading is needed.
- Added isolated home-directory tests; no key or passphrase is copied, no second agent or server connection is created, and no autostart is enabled by default.
- Next-login verification on the real Nobara desktop remains pending.

## 2026-11-05 — Safe diagnostics for early SSH tunnel exits

- Replaced the opaque `SSH_SESSION_FAILED` where possible with fixed failure categories for host-key verification, SSH identity availability, public-key authentication, forwarding policy, unsupported SSH options and network reachability. Unknown failures retain the generic code.
- Captured at most 4096 characters of child SSH stderr in the local-service process only; never return, persist or print the raw diagnostic, key paths or credentials.
- Added UI explanations and synthetic SSH failure tests, without changing the SSH trust model, actual connection arguments, read-only database queries, or server configuration.
- The operator's live root cause remains unverified; no live server was contacted in this change.

## 2026-11-05 — Consistent Babuni Admin branding

- Replaced the outdated `Morkahja Admin` browser-tab title with **Babuni Admin** and set the HTML application name accordingly.
- Reused the exact `public/favicon.webp` asset from the Babuni Dev website for the browser-tab icon and the shared sidebar brand.
- Added browser regression checks for the title, favicon file and shared logo across Morkahja and Babuni Dev workspaces. No database or permissions changes.

## 2026-11-04 — Remembered Morkahja Overview and one-request refresh

- Moved the read-only Overview to the Morkahja home route and navigation label; renamed the existing Players administration navigation/header to Moderation. The older dashboard remains available at `/dashboard`, and `/read-only` is retained.
- Saved only the chosen local SSH profile ID; automatically load fresh overview and player-preview data on profile selection and subsequent page reload. No player information, secrets or credentials are stored in browser storage.
- Added `read-dashboard`: a fixed, bounded combined view-only read inside a single PostgreSQL READ ONLY transaction and a short-lived approved SSH tunnel. The manual Refresh button reloads both panels; player pagination remains independent.
- Put connection settings below overview and player list; added a clearly marked session-based online-player estimate without claiming that sessions are game rooms.
- Extended disposable database, single-flight SSH and browser denial/persistence tests. Additional counters (rooms, achievements, gems and unlock transactions) remain unimplemented until an owner-controlled aggregate-view contract is approved.

## 2026-11-04 — Live Morkahja read-only verification recorded

- Recorded operator screenshot evidence of successful live `/read-only` overview and player-preview requests through the restricted PostgreSQL views: 62 players, 90 avatars, 0 active sessions and 0 events in the preceding 24 hours.
- Confirmed that the UI displays only the approved player-preview fields and reports that its temporary SSH tunnel is disconnected after the snapshot.
- Marked pagination navigation, activity-count reconciliation and failure-recovery scenarios as still requiring real-system verification. This is a documentation-only checkpoint; no application code, live schema, database privileges or game records were changed.

## 2026-11-04 — Read Morkahja through restricted database views

- Updated `local-service/morkahjaReadOnly.mjs` to SELECT from `babuni_admin_ro.overview` and `babuni_admin_ro.player_preview`, matching the operator-created live PostgreSQL views.
- Preserved fixed 20-player pagination, limited response fields, read-only transaction and private short-lived SSH tunnel.
- Enforced the required view privileges and rejected unexpected direct SELECT on underlying player, avatar, session or event tables.
- Reworked disposable PostgreSQL tests to verify view-only access, missing grants, rejected raw-table access and no player/session mutations.
- No database DDL was executed through GitHub or by AI. The operator reported successful live view creation; end-to-end application verification remains pending.

## 2026-11-04 — Safer Morkahja read-only failure diagnostics

- Classified PostgreSQL read failures by SQLSTATE without returning server messages or query details to the browser.
- Added helpful status text for missing SELECT grants, schema mismatches, malformed data, timeouts, login and connection failures; unknown causes remain generic.
- Extended disposable PostgreSQL tests to reproduce a role that passes metadata health checks yet lacks SELECT grants.
- No changes to remote database permissions, query scope, write capabilities or SSH lifecycle.

## 2026-11-04 — Morkahja read-only dashboard

- Added a separate `/read-only` Morkahja page with manually requested database totals, 24-hour activity count and 20-row paginated player preview.
- Implemented fixed SELECT-only PostgreSQL queries in a separate adapter, strictly limited to display name, avatar count and last-played time; no player IDs, session secrets, identity keys, arbitrary SQL or mutation actions are returned.
- Added Morkahja-only `ssh:read` endpoints, guarded by a second operator-owned opt-in and exact field allowlist; each read reuses the keyring and private temporary SSH tunnel, closing it afterward.
- Added service, configuration, pagination, field-redaction and disposable PostgreSQL regression tests. The operator-reported SSH/database **health probe** worked on Nobara; live player-data reads remain unverified.

## 2026-11-04 — Fix OpenSSH tunnel startup

- Removed the server-only `PermitTTY=no` option from the SSH client command; existing `-T` continues to disable terminal allocation.
- Extracted the argument builder and added an offline real-OpenSSH `ssh -G` regression test for the exact production arguments. The test reproduces the original parser failure and passes after correction.
- The corrected application health probe remains unverified on the target desktop.

## 2026-11-04 — Operator-gated SSH/PostgreSQL read-only health probe

- Added a separate Morkahja-only `ssh:probe` endpoint, inert unless both a private on-disk operator configuration and service environment explicitly enable it.
- Required exact approved server host-key SHA256 fingerprint, private SSH identity and unlocked Linux Secret Service credentials, with no SSH private-key or database-password exposure in the browser.
- Added strict noninteractive SSH startup, a short-lived user-private Unix socket forwarding to the server's loopback PostgreSQL port, fixed read-only role/privilege inspection and cleanup after every probe.
- Added disposable SSH and PostgreSQL tests; no live Morkahja connection, general SQL, persistent SSH Connect or write capability was enabled.

## 2026-11-04 — Offline Morkahja SSH host-key preflight

- Added a read-only, **offline-only** `ssh:preflight` capability for Morkahja PostgreSQL/SSH profiles.
- Require a dedicated operator-managed known-hosts file, exact hostname match, OpenSSH lookup and non-symlink/private file checks before showing a candidate pinned-key status.
- Added tests with disposable generated SSH keys and protected local service routes. No SSH transport, tunnel, PostgreSQL access or write permission was enabled.

## 2026-11-04 — Keyring lock diagnostics and local asset containment

- Added read-only default Secret Service collection lock detection; a confirmed locked state blocks storing, clearing and verifying credentials.
- Added CLI commands to inspect real keyring state without reading credentials and to simulate D-Bus unavailability in a disposable child process.
- Added project-capability denial tests and regression coverage for legacy local request guards.
- Hardened opt-in legacy Morkahja static file routes against symlink/realpath escapes and cross-site requests, with disposable asset tests.
- Documented unresolved authentication, remote permission, live write and recovery gates; **no production access authorized**.

- Tightened opt-in legacy content/moderation HTTP guards to require an exact HTTP origin for mutations and reject same-site cross-origin requests; fixture requests now supply an explicit origin.

## 2026-11-04 — Local connection lifecycle and UI session hardening

- Added non-secret profile editing with immutable project, adapter and credential identity.
- Introduced a server-owned, project-scoped adapter allowlist: only Morkahja local files have active read-only operations.
- Added manual Connect, Disconnect and Reconnect for local folders without open write handles, remote tunnels or background retries.
- Added an ephemeral in-memory UI session capability and Host/Origin/Fetch Metadata checks for the Vite proxy; service key stays server-side.
- Added an opt-in synthetic Linux keyring verification command, expanded fixture tests and a Chromium Connections workflow.
- No real desktop keyring, remote adapter or live Morkahja mutation was exercised during implementation.

## 2026-11-04 — Keyring credential boundary and local connection diagnostics

- Added terminal-only Linux Secret Service (`secret-tool`) profile credential storage, status and clearing without exposing secrets in browser configuration, command arguments or connection JSON.
- Added authenticated loopback service/keyring health, per-profile timestamps and stable directory error codes.
- Added complete/degraded/failed JSON inspection states and specific missing/unsafe/invalid file reasons; corrected portrait inspection to use the `Avatar` property.
- Added isolated keyring command and local-service fixture tests. No real keyring, remote adapter or live project connection was exercised.

## 2026-11-04 — Read-only Morkahja content inspection

- Added fixed-file metadata inspection for the five legacy Morkahja JSON datasets in the local connection service.
- Added an Inspect control and counts/status display in the Connections screen.
- Added disposable file-fixture tests, including missing-file and symlink rejection.
- No live Morkahja files, remote systems or write operations were used in verification.

## 2026-11-04 — Standalone local profile service

- Added separate loopback Node process and per-run service key, launched with Vite through `npm run dev`.
- Moved live connection-profile CRUD to that service through a server-side authenticated Vite proxy.
- Added read-only local-directory checks; other adapters remain explicitly unavailable.
- Added isolated process/API tests for authentication, origin denial, local-directory success/failure and non-operational remote adapters.
- No actual remote credentials, remote project connections or game changes.

## 2026-11-04 — Local connection profile foundation

- Implemented a reusable local registry for non-secret, disabled-by-default per-project connection profiles.
- Added a shared Connections page and local-only Vite development adapter to add/list/remove profiles.
- Stored non-secret profiles under the PC user's private XDG configuration directory with restricted file permissions; rejected credential-like targets and unexpected fields.
- Added isolated persistence/validation tests. No SSH tunnel, remote API, live credential management or project connection was implemented.

## 2026-11-04 — Local-only architecture and connection manager design

- Recorded the confirmed permanent deployment model: Babuni Admin runs on the operator's PC; it is not published or hosted on the VPS.
- Revised the Phase 2 roadmap and architecture to define a planned local privileged connection service with outbound project connections.
- Added [shared local connection manager design](docs/LOCAL_CONNECTION_MANAGER.md): profile metadata, credential boundary, adapters, status lifecycle, interaction model and acceptance tests.
- Updated concept, decisions, development journal, README and agent rules to keep this requirement consistent.
- Documentation and architecture only; no live credentials, connections, runtime components or project data were changed.

## 2026-11-03 — Phase 1 security and data-integrity hardening

- Updated the lockfile with compatible npm security fixes on a review branch; audit findings dropped from 23 to 12 moderate-only, with zero under `--omit=dev`. No forced major-version downgrade/upgrade was applied; 12 tooling advisories remain.
- Moved PostgreSQL connection string to server-only `DATABASE_URL`; removed browser API-token forwarding; required explicit opt-ins for local DB, game content middleware and development proxy. Local endpoints reject cross-origin/nonloopback requests and oversized bodies.
- Wrapped timeout/ban moderation and session deletion in transactions with account row locking. Added four real disposable PostgreSQL tests, including a deliberate session-delete failure to verify rollback.
- Replaced direct game file overwrites with same-directory temporary writes, fsync, versioned backups and an explicit restoration helper. Expanded middleware tests to cover recovery, rejection and permissions.
- Added five rendered content-editor tests and compact legacy game JSON snapshots based on the Morkahja repository. Chromium validated PNG-to-WebP upload and decoding of an original pinned Morkahja WebP file.
- [CI run 41659550592](https://github.com/babunidev/babuni.admin/actions/runs/41659550592) passed build, lint, nine source tests, fourteen integration tests, four PostgreSQL tests and ten browser tests (37 tests total).
- The work remains a development hardening change, not production authentication or a complete backup/rollback policy. [Details](docs/PHASE1_HARDENING_2026-11-03.md).

## 2026-11-03 — Dependency security audit (no upgrades)

- Added a GitHub Actions audit job for `npm audit --json` and `npm audit --omit=dev --json`, with a nonmutating package-level summary for review.
- Reproduced 23 affected packages (8 high, 14 moderate, 1 low), including six classified under `--omit=dev` (5 high, 1 moderate). Identified affected direct dependencies, transitive packages, fix indications and applicability limits.
- Prioritized Vite's development-server exposure and React Router upgrades, with separate handling for the interconnected ESLint/TypeScript-ESLint toolchain.
- Added [full dependency audit](docs/DEPENDENCY_AUDIT_2026-11-03.md). **No package upgrade or lockfile change** was made; remediation remains open.
- Evidence: [GitHub Actions run 41654264717](https://github.com/babunidev/babuni.admin/actions/runs/41654264717).

## 2026-11-03 — Final Phase 1 verification review

- Reviewed the existing application boundaries, Morkahja routes, service integrations, mock/fixture tests, browser navigation and CI evidence; no application code changed in this documentation review.
- Confirmed [CI run 41645348546](https://github.com/babunidev/babuni.admin/actions/runs/41645348546) passed `npm ci`, TypeScript/Vite build, ESLint, 9 source tests, 9 isolated integration tests and 5 Chromium tests at commit `66c99c3`.
- Documented open release blockers: unauthenticated write-capable development middleware, browser-visible configuration, nontransactional database/session changes, unversioned filesystem overwrites, incomplete editor and PostgreSQL verification, and 23 reported dependency security advisories.
- Classified Phase 1's initial modularization and automated source/mock verification as complete, **without** declaring production readiness or full legacy function parity.
- Added [Phase 1 verification report](docs/PHASE1_VERIFICATION.md) and updated roadmap, architecture, testing guidance and decisions to preserve the review findings.

## 2026-11-03 — Isolated Morkahja integration tests and failure handling

- Added nine integration tests under `tests/integration.spec.mjs`, run via `npm run test:integration` in CI. They execute the real Vite-local middleware over a dedicated localhost HTTP harness, with temporary game JSON/image directories and injected in-memory administrative operations; no external database, production assets or live service is contacted.
- Verified player lookup, timeout/ban/unban results, unknown IDs, invalid bodies and injected database exceptions; tested writes and reads for encounters, solutions, expansions, frames and portraits.
- Tested WebP image saving, generated title-based names, filename/path rejection, malformed data, missing game files, read-only file errors and client-side rejection of explicit unsuccessful responses.
- Corrected local admin routes to return non-2xx for `ok: false`, and client moderation actions to reject failed acknowledgements and display errors inside confirmation dialogs.
- Added bounded record ID and image name validation, WebP signature/length and size checks, and browser-side WebP conversion before upload. These bounds require later compatibility review against real game content.
- [CI run 41644848938](https://github.com/babunidev/babuni.admin/actions/runs/41644848938) passed build, lint, 9 source-level tests, 9 isolated integration tests and 5 Chromium tests at commit `5370391`.
- This does not test real PostgreSQL SQL, session-revocation transactions, actual editor-form interactions or production filesystem operations.

## 2026-11-03 — Rendered browser regression coverage

- Added five headless Chromium browser tests exercising Babuni Dev overview, two-way workspace switching and browser history, direct Morkahja routes, mobile sidebar controls, and a mock player table.
- Added a separate `test:browser` CI job against a mock-only production Vite preview; kept the existing nine source-level tests independent of Playwright. Browser tooling is installed temporarily in the CI job, without changing `package-lock.json`.
- The first real browser run identified a mobile sidebar visibility issue. Added hidden/visible responsive classes so closing the sidebar also hides its controls from keyboard and accessibility visibility checks.
- Pinned the CI browser runner to Ubuntu 24.04 after an unsupported-runner Playwright installation failure.
- [CI run 41639215405](https://github.com/babunidev/babuni.admin/actions/runs/41639215405) passed TypeScript/Vite build, ESLint, 9 source-level tests and 5 Chromium browser tests at source commit `3a94ff9`.
- No live database, external game files, remote administrator API or production website was accessed by the browser tests.

## 2026-11-03 — Retire temporary import compatibility files

- Replaced old component, service, utility and domain-type re-export imports with direct `src/features/morkahja/` and `src/shared/` imports. The active shared shell continues to live under `src/app/`.
- Updated the PostgreSQL adapter to import its Morkahja-specific player detail type directly.
- Deleted 33 unused compatibility files from the old `components/`, `layouts/`, `stores/`, `utils/`, domain-service and domain-type locations. Retained actual implementations such as `src/types/index.ts`, `src/services/http.ts` and application configuration.
- Added an import-integrity test verifying retired shims are absent and relative imports resolve.
- [CI run 41565792784](https://github.com/babunidev/babuni.admin/actions/runs/41565792784) passed `npm ci`, `npm run build`, `npm run lint` and all nine tests at source commit `3786028`.
- No frontend behavior, remote service, live database, game content or deployment was exercised by this refactor.

## 2026-11-03 — Workspace selector and project navigation

- Added a sidebar workspace selector driven by the browser URL with Morkahja and Babuni Dev options.
- Added `/babuni-dev` as a non-editable overview and its own navigation definition.
- Preserved original Morkahja route URLs, navigation links, and server-status header.
- Gave Babuni Dev a separate header without Morkahja player/server queries.
- Extended the test suite from six to eight tests covering workspace selection, route boundaries and placeholder isolation.
- [CI run 41563642755](https://github.com/babunidev/babuni.admin/actions/runs/41563642755) passed `npm ci`, TypeScript/Vite build, ESLint and all eight regression tests for `4f9b2ed`.
- No authenticated backend, GitHub editing, content publication, real browser test or deployment was performed.

## 2026-11-03 — Shared application boundaries

- Relocated the layout, sidebar, Zustand UI store and app navigation composition to `src/app/`.
- Moved reusable `PageHeader`, `Table`, `StatusBadge`, `ConnectionBanner` and generic formatting into `src/shared/`.
- Placed current Morkahja navigation entries and the server-status top bar in its feature workspace; existing route paths and labels remain unchanged.
- Preserved old import paths with transitional re-exports and added a sixth regression test covering the shell-to-workspace connections.
- Fixed a sidebar compatibility-export path discovered by the first CI build; [run 41563231632](https://github.com/babunidev/babuni.admin/actions/runs/41563231632) passed build, lint and all six tests at commit `3fd29b1`.
- No project switching, authentication, live database operation or website deployment was implemented or tested.

## 2026-11-03 — Initial automated regression coverage

- Added five Node test-runner regressions covering player ordering/counts, encounter draft defaults, encounter solution/expansion/follow-up lookups, in-memory mock moderation, and Morkahja route declarations.
- Added `npm test` and a required test step after build/lint in GitHub Actions. Tests compile TypeScript fixtures using the existing TypeScript package and do not connect to real services.
- Corrected the test loader after initial CI failures; all five regressions, build and ESLint passed in [CI run 41552579859](https://github.com/babunidev/babuni.admin/actions/runs/41552579859) at commit `ba014ea`.
- UI rendering, real database writes, remote authorization and file-upload integration remain untested.

## 2026-11-03 — ESLint and migration cleanup

- Added `npm run lint` to the GitHub Actions build workflow.
- Resolved twelve reported lint errors: ten transitional React component re-export shims, one synchronous state update in the Morkahja content tab effect, and one mutable declaration in mock state.
- Removed the now-unused React `useEffect` import after the tab-state correction.
- Verified installation, TypeScript/Vite build and ESLint all passed in [run 41552146789](https://github.com/babunidev/babuni.admin/actions/runs/41552146789) for source commit `72a3169`.
- No browser regression, moderation/database test or production deployment was performed.

## 2026-11-03 — CI build verification and import fixes

- Added a GitHub Actions workflow to install dependencies and run the production TypeScript/Vite build on pushes.
- Corrected four broken type-import paths introduced when moving Morkahja components/services.
- Verified `npm ci`, `tsc -b`, and `vite build` passed in [run 41551602985](https://github.com/babunidev/babuni.admin/actions/runs/41551602985) for commit `b2062fe`.
- The dependency install reported 23 security advisories. Lint, browser regression, live admin operations and deployment were not performed.

## 2026-11-03 — Multi-project workspace migration (source only)

- Established `src/features/morkahja/`, `src/features/babuni-dev/`, `src/app/` and `src/shared/` as initial project boundaries.
- Relocated Morkahja's Dashboard/Players/Content pages, domain components, service adapters, types and utilities under its workspace.
- Updated the central router/imports; retained transitional re-export files for older paths and existing route URLs.
- Added `docs/MULTI_PROJECT_ARCHITECTURE.md`; documented the phased migration.
- Targeted relative-import checks were reported. A full TypeScript build, lint, functional regression test and production deployment were **not** performed or verified as part of these changes.

## 2026-11-03 — Platform and content-management planning (documentation only)

- Recorded Babuni's decision to expand the Morkahja workbench into one multi-project Babuni Admin.
- Defined the proposed Babuni Dev workspace: GitHub document synchronization, Markdown editing/previews, revision comparison and targeted publication.
- Documented proposed backend authentication, project isolation, auditing, AI operation boundaries and rollback.
- Updated concept, roadmap, architecture, decisions and development history. No new editor, API, publishing operation or game-data change implemented by this documentation update.

## Earlier source history

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

## 2026-11-13 — License and rights

- Established MIT for original administration software and updated repository documentation to explain the permission boundary.
- Preserved third-party authorship and external assets' separate terms. No application behavior or runtime verification is claimed.
