# Babuni Admin — Development Journal

## 2026-11-06 — Connecting the missing pictures

Content records finally loaded from my server, but their images were absent. Local checks confirmed that the files exist under `/var/www/morkahja` and can be read using the already configured SSH account; the earlier proposed public hostname did not resolve. Rather than introducing another connection, AI added a small image reader to the existing administrator SSH workflow and updated the image views to request only visible pictures. The change is committed and covered by automated tests, but real-server image display still needs checking before I call it finished.


## 2026-11-06 — Content connection error

After the Overview loaded real statistics through the single administrator profile, the Content page instead returned `REMOTE_CONTENT_FAILED`. Inspection revealed an AI implementation mistake: the unified Content configuration called a helper without importing it. AI corrected the import and added a regression check. The actual remote catalog has not been verified yet.


## 2026-11-06 — Simplifying the way I connect

The real Moderation table finally loaded 62 accounts from my Morkahja database. That confirmed the administrator path works, but I still had to choose the same connection on every page. For a tool used by one person, that was needless repetition. After I asked for a single **Connection** tab, AI changed the interface so Overview, Moderation and Content automatically use the administrator configuration. The older read-only profile stays available as an archived migration detail, while the connection page now contains the relevant settings and diagnostic checks. Live content edits and Babuni Dev publishing still need separate verification.

## 2026-11-06 — Returning to one administrator connection

The first connection migration split my administration tool into separate accounts for reading, moderating and editing content. That was more complex than the project needed: this is my own workbench, and one authenticated administrator should reach all existing features. After I rejected the multi-user setup, AI revised the implementation so Overview, Moderation and Content share one administrator profile, pinned SSH identity and stored database password. Fixed operations, rollback and content backups remain; the old read-only Overview path survives only for migration. No new credentials were installed or live data changed, and remote image handling still needs work.

## 2026-11-06 — Returning to Moderation and Content

With the restricted Overview working, the more useful goal is getting my existing player management and game-content editors back onto the live server. Source review exposed that they still follow older connection paths, separate from the new read-only tunnel. AI removed the misleading mock fallback, labeled the old sources and added visible content-read errors. The next implementation created a separate moderation SSH profile and connected the existing list, detail, timeout, ban and unban actions to a narrowly scoped local service adapter. Its role and transaction safeguards have synthetic tests, but no privileged live role has been deployed or exercised. AI also prepared a separate SSH content path for my five existing catalog editors, keeping a version check and backup before remote JSON replacement. Images remain outside that initial transport, and nothing was changed on the game server.

The next read-side pass focused on what the player list and side panel actually reveal. AI corrected the list to use current avatar progression, separated each connection's cached details, distinguished connection errors from missing players, and added fixture coverage for achievements, currency, unlocks and encounter history. Player inspection can now be authorized with a distinct SELECT-only role; write permissions remain a later, separate decision. The proposed role setup is committed as a reviewable SQL file, not applied. To make testing practical, AI added a metadata-only deployed-schema check, a private configuration helper that copies the working Overview settings without credentials, and executable Nobara/server instructions. Actual live account inspection still depends on the separate operator-managed database login.

## 2026-11-06 — Seeing the new totals in my local Overview

After the feature branch was synchronized and the private metric approval enabled, my Nobara screenshot showed all four new Overview totals: 75 earned achievements, 52 players with achievements, 10 dice unlocks and 6 expansion unlocks. The original activity counters and player preview were still present, and the interface reported a successful refresh with SSH disconnected. AI reviewed the screenshot and recorded this success-path observation; unavailable states and interrupted connections still need separate live exercises.

## 2026-11-05 — Verifying the new cards against regressions

The new Overview fields initially broke an older PostgreSQL fixture that expected only the four original counts. After the CI failure identified that mismatch, AI updated the test to preserve the four new nullable fields and check their unavailable state without separate authorization. The next CI run passed its five jobs, including disposable PostgreSQL tests, browser checks, build and lint; my live Nobara display still needs its own confirmation.

## 2026-11-05 — Bringing the verified totals into the Overview

After checking the running backend's expansion catalog, I approved and applied the prepared database view. Its first restricted read returned 75 achievement unlocks across 52 players, with 10 dice and 6 expansion unlocks; every quality counter was zero. With that boundary verified, I asked AI to connect the four totals to my local Overview. AI added the fixed aggregate query, explicit field approval, unavailable states and fixtures; the live Nobara display still needs verification.


## 2026-11-05 — Checking the real expansion list before installing new counters

The prepared achievements and unlock totals were ready in source, but they still depended on expansion identifiers from the game repository rather than a verified deployed catalog. To avoid introducing incorrect counts into my live Overview, AI prepared a narrowly scoped read-only JSON audit helper and synthetic tests. It reports only the IDs and their active states, refusing malformed or unexpected entries. The next step still needs to happen on my game server: verify its actual catalog and explicitly review the proposed SQL before any database view is created.


## 2026-11-05 — Preparing the first additional Overview counters

After defining what the new statistics should mean, the first implementation step focused on achievements and permanent unlock ownership. My requirement remains that Babuni Admin must only receive aggregate figures, not underlying player records. AI prepared a separate owner-controlled PostgreSQL view and synthetic tests, designed to count earned achievements and non-default dice and expansion unlocks while treating malformed stored data as unavailable instead of zero. The client catalog provided candidate expansion IDs, but the server's deployed catalog still needs checking. Nothing has been changed on the live database and no new UI statistic is displayed yet.



## 2026-11-05 — Defining the numbers before displaying them

The real database and its restricted read-only role were now checked, so the remaining work in this first milestone was deciding what each new Overview number should actually mean. Rather than count an eight-hour session as a person currently online or assume an open room still has players in it, AI compared the game’s heartbeat, room, achievement and unlock code and drafted precise counting rules. A two-minute activity window was proposed from the game's 45-second heartbeat, alongside separate counts for unlocked achievements, current gems and non-default ownership. The definitions remain proposals for my approval and further verification; no database view or dashboard card was added.


## 2026-11-05 — Confirming the dashboard's restricted database role

After inspecting the live schema, the remaining question was whether the dashboard login could inherit wider rights or create objects. From my Ubuntu server, I ran another read-only PostgreSQL check and supplied its results for AI to review. The probe account had no additional role memberships, elevated role attributes or CREATE permission in the tested database and schemas. AI added this verification to the development records while leaving the permissions themselves untouched. Choosing reliable definitions for online players, rooms, achievements and other statistics is still ahead.


## 2026-11-05 — Checking the database before adding statistics

The first read-only dashboard was working, but new figures would require understanding what actually exists in the live database. After copying the prepared metadata script to my Ubuntu server, I ran its read-only PostgreSQL audit and shared the output with AI for interpretation. Six game tables and the two restricted views were present; the dashboard's database role could select the views but not the underlying game tables. The expected purchase tables were absent from the audited public schema, so purchase statistics cannot be assumed. AI recorded the findings without touching game data or permissions, leaving role-membership checks and precise metric definitions for the next step.


## 2026-11-05 — Bringing the roadmap up to date

The requested SSH-agent check on my Nobara desktop returned `SSH_LOGIN_IDENTITY_READY` and the expected public-key fingerprint. Earlier live tests had also shown all four player-preview pages working, game activity changing the session/event totals, and a recovered Overview populated under my remembered connection after the service was restarted. AI reconciled those observations with older unchecked roadmap items instead of treating the same tasks as unfinished. The post-login output is operator-reported evidence, not an independently observed logout sequence; controlled connection failure tests and the live schema audit remain open.


## 2026-11-05 — Finding the source of future Overview counters

With the secure dashboard now reading real player information, more interesting figures could be added: actual online presence, open rooms, achievements, gems, dice, expansions and purchases. A review of Morkahja's code showed that these are separate kinds of information, not interchangeable counts. AI traced their storage models and prepared a metadata-only SQL audit to compare the source definitions with the real database. The new counters remain unimplemented until the live schema is confirmed and restricted aggregate views are approved.


## 2026-11-05 — Preparing SSH access for the next login

The automatic Overview failure was traced to the desktop SSH agent having no identities loaded. After adding the approved key and restarting the old application process, my live Morkahja figures returned. To avoid manually repeating that step after each computer login, AI prepared an optional per-user loader that relies on the existing agent and graphical passphrase prompt. Isolated tests passed, but its first real Nobara login is not yet verified.


## 2026-11-05 — A remembered connection that could not reconnect

After switching to a remembered overview, my next local screenshot showed `SSH_SESSION_FAILED` where the live figures should have appeared. The stored profile had been restored, but the SSH process exited before its temporary database tunnel became ready. Since the code discarded SSH's diagnostic output, there was no reliable way to know whether the server, key, authentication or forward caused the exit. AI added tightly limited error classification and a fake-SSH regression test, keeping the raw output private and all existing trust checks unchanged. Identifying the actual failure on my PC remains the next verification step.


## 2026-11-05 — Making the admin look like one Babuni project

Although the application had grown beyond Morkahja, its browser tab still called it Morkahja Admin and the shared interface had no matching icon. For consistency with the Babuni Dev website, I chose its existing favicon as the mark for Babuni Admin too. AI reused the original WebP asset without changing its artwork, corrected the browser title and added the icon beside the shared sidebar name, with a browser regression test for both workspaces. Morkahja remains the name of its game workspace; no game data or connection behavior changed.


## 2026-11-04 — Turning the working data check into a proper overview

With the player list now navigating through every page and back, the real game test confirmed that active-session and recent-event counts respond to play. Returning to the site still required choosing the connection and clicking two separate buttons, which made the otherwise useful overview unnecessarily awkward. My direction was to remember the selection, load both panels together on opening the page, put connection controls below the information, and distinguish **Overview** from **Moderation**. AI changed the UI and combined the two fixed database reads into one temporary read-only SSH request. Extra counters remain a separate data-definition decision, since a session is not a room and the game exposes no approved aggregate view yet for gems, achievements or unlock transactions. The new remembered-selection behavior still needs a real desktop check.


## 2026-11-04 — Seeing Morkahja data through the finished read-only path

After the restricted views and adapter were in place, the first successful snapshots appeared in my local Morkahja dashboard. The overview showed 62 players, 90 avatars, no active sessions and no events in the preceding 24 hours; the separate player preview displayed names, avatar counts and last-played dates. The interface also reported that SSH disconnected after each request. With the requested overview and preview now working against the live database, the remaining checks are page navigation, reconciling the zero activity counts with gameplay and testing failures without leaving a connection open.


## 2026-11-04 — Reading through restricted views instead of sensitive tables

The first live dashboard query exposed an important permission boundary: the database role could connect safely but had no reason to read entire player or session tables. On my Ubuntu server, I followed the proposed restricted-view approach and verified that the new views could be read while the underlying sensitive tables stayed inaccessible. AI then changed the dashboard adapter to query only those views, reinforced the role checks and added disposable PostgreSQL tests. The database-side permission checks succeeded; the browser's first successful live snapshot still needs verification.


## 2026-11-04 — Diagnosing the first read-only database failure

The first attempt to load real Morkahja dashboard information returned only `REMOTE_READ_FAILED`. My earlier SSH/database health probe had worked, so this could be a table-permission or schema problem rather than a failed login, but the screenshot alone could not establish which. AI revised the read adapter to translate PostgreSQL error codes into safe categories and added a disposable test for a reader lacking SELECT grants. No new permissions were granted or live data modified; identifying the actual error remains the next verification step.

## 2026-11-04 — Making the first database information useful without changing anything

With the Morkahja SSH/database health probe finally succeeding on my PC, the next step was to see actual information safely. My requirement was a small database overview and a paginated player list, with no secrets, session cleanup or administrative writes. AI built a separate, manually loaded dashboard and fixed read-only SQL behind an additional owner-controlled permission; the original admin screens were left untouched because their older data path includes maintenance actions. Disposable PostgreSQL and service fixtures exercised the new boundary, while live player-data verification remains separate from the successful SSH health check.


## 2026-11-04 — Finding the first real SSH startup fault

While testing the connection, I encountered a tunnel startup error. AI traced it to `PermitTTY`, a server setting incorrectly passed to the SSH client, and removed it while preserving `-T`. A new offline test using real OpenSSH fails before the correction and passes afterward; build and lint also passed. Verification on my desktop remains pending.

## 2026-11-04 — Building a connection that stays closed by default

After confirming the local host-key check, the next problem was verifying a real SSH/PostgreSQL path without turning the admin into a permanently connected or write-capable service. AI added a separate, operator-controlled health probe: my PC must explicitly approve the host and fingerprint, an SSH identity and a dedicated database role before it can run. The probe opens a temporary, private Unix-socket tunnel for a fixed read-only privilege check and then closes it. Disposable SSH and PostgreSQL fixtures exercise the implementation; my live Morkahja server remains untouched, and none of the editing tools gains remote authority.

## 2026-11-04 — Checking a host key without reaching the server

After verifying the local credential store on Nobara, my next priority was Morkahja's SSH connection. Rather than opening a tunnel immediately, I asked AI to build a local trust check that rejects missing or unsafe host-key entries while keeping network access disabled. The result allows a profile to report whether a privately maintained known-host record exists, but it deliberately cannot claim the actual remote server was verified or that live game data is accessible. An initial integration-test attempt to delete the disposable SSH profile without an available keyring was correctly refused; the test was corrected without weakening that fail-closed behavior.


## 2026-11-04 — Confirming the lock and recovery cycle

After the isolated unavailable-bus check, the last desktop test was to lock KDE Wallet itself. Using the read-only diagnostic, I observed the default collection, keyring health and unused credential all report `locked`; following an unlock, those statuses returned to `unlocked`, `available` and `missing`. AI recorded the terminal evidence and closed the keyring verification checklist. This establishes desktop lock detection and status recovery, not authorization for live Morkahja operations.

## 2026-11-04 — Verifying the unavailable-bus case on Nobara

With the earlier unlocked keyring test working, I ran the new diagnostics on my actual desktop. The default collection reported unlocked and available, with the synthetic unused profile correctly missing; an isolated child process then confirmed that an unreachable D-Bus address fails closed without changing existing credentials. AI documented the observed output separately from the fixture tests. The real locked-collection case remains untested, and live Morkahja operations are still blocked.

## 2026-11-04 — Checking failure without touching existing keys

After a successful credential round trip on my Nobara desktop, the remaining keyring question concerned what happens when access is locked or unavailable. AI added a read-only collection-status check and a separate process-isolated bus-failure test, along with stricter path checks for the older Morkahja asset server. The automated fixtures can exercise denied operations, but my actual locked-keyring behavior still needs observation on the PC. Live project editing remains outside the tested security boundary.


## 2026-11-04 — The desktop keyring works

With the synthetic keyring checks already passing in CI, the remaining question was whether the same storage flow worked in my actual Nobara session. After pulling the latest code, I ran `npm run keyring:verify` locally and received successful confirmation of temporary credential storage, retrieval and cleanup. The report establishes an unlocked desktop keyring round trip, not locked-keyring behavior or any working remote connection; no existing SSH keys were used.

## 2026-11-04 — Making connections deliberate

Once the local Morkahja file checks worked, I wanted profile editing, explicit connection controls and stronger permissions before anything reached a remote project. AI added project-scoped adapter rules, guarded profile edits and manual read-only local Connect, Disconnect and Reconnect actions. New session checks protect the development UI's connection proxy, while disposable service and browser tests examine the workflow. Remote adapters remain disabled, and my actual desktop keyring still needs a synthetic round-trip verification.


## 2026-11-04 — Checking credentials and connection status without exposing either

The first inspection of my Morkahja files found a case-sensitive mismatch: the real portrait dataset used `Avatar`, but the inspector expected `Portraits`. Once the local correction showed the correct portrait count, the next concern was making connection status and credential handling more dependable. AI added a terminal-only Linux keyring adapter, specific directory and JSON error codes, and timestamps that distinguish full, partial and failed read-only checks. Synthetic keyring and filesystem tests exercise the new paths; my real desktop keyring, SSH connections and live remote services have not yet been verified.


## 2026-11-04 — Checking the first connection without opening a remote one

After confirming the Connections screen could save and remove a profile on my PC, the next task was to give it a proper local service instead of keeping profile operations inside Vite. AI added a second loopback-bound process with a temporary per-run service key and a small proxy from the development UI. Its first check only confirms that a selected local directory exists, without writing to it or reaching Morkahja's server. Remote connections and credential storage remain future work; they were deliberately not introduced as part of this first transport boundary.

## 2026-11-04 — The first local connections screen

With the local-only architecture settled, I wanted the administration tool to begin recognizing distinct projects without prematurely reaching the actual servers. AI implemented a shared Connections screen and a small registry that saves non-secret connection descriptions on my PC. A profile can be created or removed, but stays explicitly disconnected; no SSH, GitHub or database access is attempted yet. Fixture tests cover persistence and rejection of credential-like configuration. This first slice still uses the Vite development server and needs a separate local service before real privileged connections can be enabled.

## 2026-11-04 — Keeping the administration tool at home

The earlier roadmap could be read as a plan to host an administration backend somewhere on the internet. That was not what I wanted: Babuni Admin belongs on my own PC, with connections going *out* to the projects that need maintaining. After confirming that the updated application built, passed its local tests and opened in the browser, I clarified this boundary before moving into Phase 2.

AI revised the concept, architecture and roadmap around permanent local-only operation, and prepared a shared connection-manager design covering profiles, credentials, connection states and project-specific adapters. This work is documentation and design; no remote service, credential manager or connection interface was built or tested in this step.

## 2026-11-03 — Hardening the old tools without touching the live game

The next set of concerns came from what the earlier tests could not prove: PostgreSQL really deleting sessions safely, the editors really saving through their forms, and game files surviving interrupted writes. To tackle them without risking anyone's account or content, I asked AI to work with a disposable database and isolated copies of the Morkahja assets, while also addressing the npm audit findings.

AI put the changes on a review branch, added real PostgreSQL integration tests and changed moderation to use transactions. The tests deliberately made session deletion fail and verified that the player's previous state was preserved. Temporary files and retained backups replaced direct content overwrites. For the editors, small snapshots from the Morkahja repository let Chromium exercise all five forms, PNG-to-WebP conversion and a real legacy WebP image. The first runs exposed test setup and selector issues, which AI corrected before the full suite passed.

Compatible dependency updates removed all high-severity findings and all npm production-scope findings; twelve moderate tooling reports still remain. Browser-visible database credentials and client API-token handling were removed, and local development endpoints gained explicit opt-ins and request guards. The [passing CI run](https://github.com/babunidev/babuni.admin/actions/runs/41659550592) verifies 37 tests, but none of this is a substitute for production authentication or a full recovery policy. Those limits remain visible in [the hardening report](PHASE1_HARDENING_2026-11-03.md).

## 2026-11-03 — Looking beyond the green tests

With the structural milestone verified, the dependency installer was still reporting 23 vulnerabilities. A passing build could not answer how serious they were or which ones mattered for this administration tool, so I wanted the packages audited before changing versions. AI added a nonmutating audit to GitHub Actions and compared the full dependency tree against npm's production classification. Six affected packages appeared in the latter, including Vite and React Router.

The distinction matters: the tool is not a public web application yet, but Vite currently hosts local administrative endpoints capable of changing game data. That makes its development-server advisories more relevant than many conventional build-tool warnings. AI documented the package inventory, available fixes and the complicated ESLint compatibility cluster. No packages were updated during this audit; the next work remains the careful remediation and regression testing of those changes. [Audit evidence](https://github.com/babunidev/babuni.admin/actions/runs/41654264717) · [Findings](DEPENDENCY_AUDIT_2026-11-03.md).

## 2026-11-03 — Closing the first structural milestone

With the workspace migration, direct-import cleanup and isolated tests in place, I wanted a final check of what could actually be considered finished. AI reviewed the current repository, the latest successful build and test logs, and the remaining administrative boundaries. All 23 automated tests passed, alongside the build and lint checks, so the initial modular restructuring and mock-based verification can be recorded as complete.

That result does not make the old Morkahja tools production-safe. The review found that development middleware can still write without an application-level authorization layer, PostgreSQL moderation and session revocation are not transactional, and game files are overwritten without recovery guarantees. Real database workflows, the full editor interface and dependency advisories remain open. Rather than calling Phase 1 fully verified, I am retaining those limitations as explicit work before a secure administration backend can be deployed. The findings are recorded in [the Phase 1 review](PHASE1_VERIFICATION.md), supported by [CI run 41645348546](https://github.com/babunidev/babuni.admin/actions/runs/41645348546).

## 2026-11-03 — Testing the work behind the buttons

After the browser checks confirmed that navigation and the mock player table rendered, I wanted evidence that Morkahja's administrative actions also handled failures sensibly. AI built an isolated HTTP test harness around the existing local middleware, using temporary game files and injected player records instead of touching the actual database or game installation. The checks exercise moderation, the five content record types, WebP uploads and simulated failures.

Early attempts revealed that the testing router was returning HTML instead of API responses; switching to a dedicated fixture server corrected that. The first meaningful failures then exposed unsafe image filenames and acceptance of a negative portrait ID. AI tightened validation and changed client mutation handling so explicit failures cannot be shown as successes. [CI run 41644848938](https://github.com/babunidev/babuni.admin/actions/runs/41644848938) passed nine integration tests alongside the previous nine source checks, five browser checks, build and lint. The actual PostgreSQL queries, session revocation, and interactive editor forms still need separate verification before production use.

## 2026-11-03 — Testing what the browser actually displays

The earlier checks had covered the TypeScript code and mock-data functions, but not whether the workspace selector really behaved as intended on screen. With that interface now available locally, I asked AI to add automated browser checks for the actual pages and navigation. AI created a Chromium test suite against a production preview forced into mock mode, covering Babuni Dev, the original Morkahja routes, workspace switching, browser history and the mobile sidebar.

The first attempt needed adjustments to the test setup and Ubuntu runner. When Chromium finally exercised the interface, four tests passed but the mobile sidebar failed: its close button shifted the menu offscreen without making it truly hidden to accessibility checks. AI corrected the responsive visibility classes rather than weakening that assertion. [CI run 41639215405](https://github.com/babunidev/babuni.admin/actions/runs/41639215405) then passed all five browser scenarios, all nine existing tests, the build and lint. The work verifies rendered navigation and mock data only; it does not validate player moderation, game-file writes or production authentication.

## 2026-11-03 — Retiring the temporary bridges

Moving the components into their own workspaces had left temporary exports behind so existing imports would continue working. With the layout and workspace switcher now in place, I wanted to finish that transitional work instead of carrying two paths to every feature. AI traced the old imports through the Morkahja pages, components, services and PostgreSQL adapter, redirected them to their real locations, and removed 33 redundant compatibility files. The underlying shared type definitions and HTTP service stayed where they belonged.

A new regression check now guards against importing missing modules or restoring the retired shim directories. [GitHub Actions run 41565792784](https://github.com/babunidev/babuni.admin/actions/runs/41565792784) passed the build, lint and all nine tests for source commit `3786028`. The cleanup is complete at source level; full browser navigation, privileged Morkahja operations and production access remain unverified.

## 2026-11-03 — First local view of Babuni Dev

After pulling the updated repository to my computer, I launched the development server and opened the new Babuni Dev workspace in the browser. The workspace selector, dedicated header, overview navigation and informational placeholder all appeared as expected. The screenshot below records that first visible check; it was provided by me and added to the repository by AI as a reduced, cropped WebP for documentation.

![Babuni Dev workspace open in the local administration interface](screenshots/babuni-dev-workspace-2026-11-03.webp)

This verifies the appearance of one local page, not successful navigation back to Morkahja, full browser interaction tests, access controls or content publishing.

## 2026-11-03 — Moving between workspaces

With the shared shell in place, the next step was to make the two project areas navigable without disturbing the Morkahja tools. At my direction, AI added a workspace selector to the sidebar, separated the navigation links by project, and gave Babuni Dev an overview page. The selection follows the URL, so direct links and browser history can identify the same workspace. Morkahja retains its established routes and server-status header; the Babuni Dev view explicitly says its content editor and publishing features are not available yet.

AI also added two regression checks for the workspace resolution and routing structure. [GitHub Actions run 41563642755](https://github.com/babunidev/babuni.admin/actions/runs/41563642755) passed TypeScript/Vite, ESLint and all eight tests for source commit `4f9b2ed`. These results verify the code and source contracts, not user-driven browser navigation, server authorization or production publishing. No live website or game data was changed.

## 2026-11-03 — Separating the interface from the game

A shared administration application needs boundaries that reflect what belongs to one project and what can be used by all of them. With Morkahja's domain already grouped together, I directed the next change toward the layout, reusable controls and navigation. AI moved the active layout, sidebar and UI state into `src/app/`, placed common tables, badges, headers, connection notices and formatting into `src/shared/`, and kept Morkahja's navigation entries and server-status display with the game workspace. Its existing routes and visible labels were deliberately preserved rather than presenting unfinished multi-project switching as available.

The first GitHub Actions build identified an incorrect transitional sidebar export. AI corrected that path and added a regression check for the separation. [CI run 41563231632](https://github.com/babunidev/babuni.admin/actions/runs/41563231632) passed TypeScript/Vite, ESLint and all six tests at commit `3fd29b1`. Compatibility exports still connect older imports, and the new structure has not been verified through rendered-screen, live moderation or filesystem integration tests.

## 2026-11-03 — Protecting the existing Morkahja behavior

With the TypeScript build and lint checks working, I wanted some protection against changing the existing Morkahja features while Babuni Admin grows into a multi-project tool. AI introduced a small regression suite for player ordering, encounter drafts and relationships, in-memory moderation and the established routes. The tests deliberately use local fixtures rather than connecting to player accounts or changing game files.

The first CI runs revealed test-loader issues rather than application failures. AI corrected the loader to use the project's declared TypeScript dependency and fixed its relative-import handling. [Run 41552579859](https://github.com/babunidev/babuni.admin/actions/runs/41552579859) then passed all five tests, the build and lint for commit `ba014ea`. This is the first automated regression baseline; full rendered-screen interaction, remote services and privileged writes remain outside its coverage.

## 2026-11-03 — Checking the code rules after the move

After confirming TypeScript could build the reorganized application, I wanted its lint checks addressed as well. AI added ESLint to the GitHub Actions workflow and the first run identified twelve errors. Ten came from the temporary re-export files kept for compatibility, while two concerned content-tab state and a mock-data variable. Rather than disable linting across the project, AI marked the specific compatibility exports, adjusted the tab selection to derive its active value from the route without synchronously setting state in an effect, and corrected the declaration. A newly unused effect import also had to be removed after the first retest.

[GitHub Actions run 41552146789](https://github.com/babunidev/babuni.admin/actions/runs/41552146789) passed dependency installation, the TypeScript/Vite build and ESLint for commit `72a3169`. This confirms the source checks, not the actual behavior of the Morkahja screens or privileged operations. The compatibility files and separate browser regression work remain.

The administration workbench began with Morkahja, but the growing collection of projects has made a wider structure useful. These entries tell the story from my perspective: what I wanted, what I decided, what AI implemented, and what evidence exists. Earlier source-only history is retained below rather than silently presented as a personal recollection.

## 2026-11-03 — Checking that the reorganized project still builds

After the Morkahja files had been moved into their workspace, the next important question was whether the application could still compile. At my request, AI added a GitHub Actions build workflow because the isolated local environment could not reach GitHub or the npm registry. The first CI run installed dependencies but TypeScript rejected four `../types` imports in moved Morkahja components and services. Those paths still assumed their old directories.

AI corrected the four imports on `main` and checked the resulting workflow. [GitHub Actions run 41551602985](https://github.com/babunidev/babuni.admin/actions/runs/41551602985) completed successfully: `npm ci`, `tsc -b` and `vite build` all passed. This verifies compilation and production bundling for commit `b2062fe`, not browser behavior, moderation operations, deployment or lint quality. The dependency installer also reported 23 security advisories (1 low, 14 moderate, 8 high); those require a separate dependency audit rather than an automatic breaking upgrade.

## 2026-11-03 — A shared home for administration

Managing Morkahja gave the admin tool its original purpose: player activity, moderation and game content in one interface. With babuni.dev now needing a simpler way to maintain its project documentation, I wanted to expand that tool instead of creating another separate administrator. Morkahja would become one workspace, Babuni Dev another, and future projects could have their own spaces when needed.

The assistant reviewed the existing React and Vite code and recommended keeping the frontend while separating project-specific features from the application shell. It identified a more serious boundary beneath the interface: privileged database and filesystem operations still depend on local development middleware, and browser-visible environment variables are unsuitable for credentials. A separate authenticated production API was proposed, not implemented or approved as a particular framework.

## 2026-11-03 — Giving Morkahja its own workspace

Once the direction was clear, I authorized changes to the existing repository and explained that a local backup was available. The assistant first moved the Morkahja pages, then their domain types, helpers, editor components and services into `src/features/morkahja/`. Empty areas for Babuni Dev, the shared application layer and future shell organization were also established.

Temporary re-export files preserve older import paths while the migration continues. This is useful transitional architecture rather than a second copy of the original logic. GitHub commits confirm the refactor was written, and targeted import-path checks found no missing local references in the files examined. A complete build, lint pass, browser regression, player-database test or live content-editing test was **not** run, so the reorganization cannot yet be called runtime-verified.

## 2026-11-03 — Planning editing without rebuilding the portfolio

The development journal on the public portfolio illustrated why content publishing deserves its own workbench: GitHub text could be corrected while the VPS still served an older build. The approach I want is to select a particular project module, pull its latest document, edit or review it, and publish only the content that changed. That should work for AI-assisted revisions as well, without giving agents unrestricted file or production access.

The assistant proposed keeping GitHub as the authoritative record and adding a content-publishing service that updates module metadata and search-readable pages together. The first proposed milestone is refreshing one Development Journal source file without rebuilding the entire Astro website. No editor, publishing API, automation or live-site change was implemented in this planning session.

## Earlier development history

The previous journal recorded the Morkahja-specific origin, early dashboard work, content editing, repository publication and October audits. Those historical entries follow below as originally documented; their older third-person voice and labels are archival material, not the standard for new Babuni Admin entries.


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

## 2026-10-31 — Review before public visibility

Babuni.dev requested review of the actual private repository and its documentation before publication. AI inspected fetched Git history, documentation coverage and publication boundaries. The publication record separates source visibility from deployment, licensing and media redistribution; detailed private findings remain outside the portfolio. No build, gameplay, live account or database test was performed.

## 2026-10-31 — Publication direction and author clarification

**Babuni.dev direction and decision:** Babuni.dev decided to make the actual project repository publicly accessible, with the intention of developing it openly rather than maintaining a separate public documentation edition. GitHub visibility was verified as public on 31 October 2026.

Public source availability does not authorize public deployment of privileged development endpoints, production credentials or live player records.

**AI contribution:** Recorded the author’s decision and clarification, separately from observed GitHub visibility. Earlier documentation-only publication was considered and is superseded as the intended long-term source. No root license was selected by this update; public visibility, open-source reuse permissions, media rights and production readiness are separate matters. No runtime testing or behavior change is claimed.
