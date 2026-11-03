# Babuni Admin — npm dependency security audit (2026-11-03)

**Scope:** Repository `babunidev/babuni.admin`, audited lockfile on GitHub Actions run [41654264717](https://github.com/babunidev/babuni.admin/actions/runs/41654264717), before package upgrades. `npm audit --json` and `npm audit --omit=dev --json` were executed separately. This report distinguishes affected package records from individual security advisories; a single package may contain multiple advisories, and a parent may be marked affected through a vulnerable dependency.

## Findings

| Dependency scope | High | Moderate | Low | Total |
|---|---:|---:|---:|---:|
| All locked dependencies | 8 | 14 | 1 | **23** |
| npm production classification (`--omit=dev`) | 5 | 1 | 0 | **6** |

The six packages included in the npm production-scoped result are **vite, react-router, react-router-dom, postcss, nanoid, source-map-js**. The remaining 17 reports are associated with development/lint/build dependencies by npm's classification. **Production classification does not by itself establish browser bundle exposure or exploitability.** Vite is installed via both direct dev dependencies and `@tailwindcss/vite` in dependencies, and its dev-server advisories matter because this project uses sensitive local write middleware.

## Affected package inventory

| Package | Locked version | Severity | npm production scope | npm fix indication | Notes |
|---|---|---|---|---|---|
| `vite` | 8.0.14 | High | Yes | Yes | Upgrade on current 8.x line; essential for dev server |
| `react-router` | 7.15.1 | High | Yes | Yes | Upgrade alongside react-router-dom within compatible 7.x range |
| `react-router-dom` | 7.15.1 | Moderate | Yes | Yes | Affected through react-router |
| `postcss` | 8.5.15 | High | Yes | Yes | Transitive CSS/parser dependency |
| `nanoid` | 3.3.12 | High | Yes | Yes | Transitive ID generation dependency |
| `source-map-js` | 1.2.1 | High | Yes | Yes | Transitive source-map parser |
| `brace-expansion` | 5.0.6 | High | No | Yes | Build/lint dependency; potential DoS |
| `browserslist` | 4.28.2 | High | No | Yes | Build tool data processing |
| `zod` | 4.4.3 | High | No | Yes | Dev tooling schema validation |
| `@babel/core` | 7.29.0 | Low | No | Yes | Babel source map parsing |
| `baseline-browser-mapping` | 2.10.32 | Moderate | No | Yes | Dev tooling; invalid-input DoS |
| `eslint` | 10.4.0 | Moderate | No | Manual | Downgrade/compatibility changes proposed |
| `@eslint/js` | 10.0.1 | Moderate | No | Manual | npm suggests 9.39.5, breaking major change |
| `typescript-eslint` | 8.59.4 | Moderate | No | Manual | npm suggests 8.14.0 due to dependency constraints |
| `minimatch` | 10.2.5 | Moderate | No | Manual | Inherited ESLint ecosystem advisory |
| `@eslint-community/eslint-utils` | transitive | Moderate | No | Manual | Affected via ESLint |
| `@eslint/config-array` | transitive | Moderate | No | Manual | Affected via minimatch |
| `@typescript-eslint/eslint-plugin` | transitive | Moderate | No | Yes | Affected via parser/ESLint |
| `@typescript-eslint/parser` | transitive | Moderate | No | Manual | Affected via TypeScript-ESLint/ESLint |
| `@typescript-eslint/type-utils` | transitive | Moderate | No | Yes | Affected via TypeScript-ESLint/ESLint |
| `@typescript-eslint/typescript-estree` | transitive | Moderate | No | Manual | Affected via minimatch |
| `@typescript-eslint/utils` | transitive | Moderate | No | Manual | Affected via parser/ESLint |
| `eslint-plugin-react-refresh` | 0.5.2 | Moderate | No | No auto-fix | Affected via ESLint (not necessarily a package's own advisory) |

The installed versions were read from `package-lock.json`. Versions marked *transitive* are not direct dependencies. npm fix indications are advisory hints, not tested fixes.

**Fix availability:** 13 of 23 package records have an in-range fix indication from npm; nine suggest a dependency version change with major/compatibility implications, and one (`eslint-plugin-react-refresh`) has no automated fix indication. All six packages in the `--omit=dev` result have available fixes according to npm.

## Priority assessment

1. **P0 — Vite / local admin boundary:** Locked `vite@8.0.14` is affected by multiple development server advisories. The cross-origin custom-middleware advisory ([GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw)) has a patched 8.1.6 release, but additional reported Vite advisories must also be rechecked after upgrade. This matters more than ordinary static-site toolchain risks because the local middleware writes game files and modifies player moderation state. Do not expose Vite dev server to untrusted clients.
2. **P1 — React Router:** `react-router@7.15.1` / `react-router-dom@7.15.1` have multiple advisories. Some apply to **RSC/server features not implemented here**; for example [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2) explicitly applies only to unstable RSC APIs. Upgrade both packages together to a patched compatible 7.x version and run browser route/history checks.
3. **P1 — CSS/source-map pipeline:** `postcss@8.5.15`, `nanoid@3.3.12` and `source-map-js@1.2.1` can be affected by crafted build/source-map input or invalid options. Upgrade transitive locks and validate the build. Their presence in `--omit=dev` does not mean these paths are necessarily reachable in shipped browser code.
4. **P1 — ESLint ecosystem:** `eslint@10.4.0`, `@eslint/js@10.0.1` and `typescript-eslint@8.59.4` are part of an interconnected moderate-severity cluster; npm's suggestions include changing `@eslint/js` to 9.39.5 and `typescript-eslint` to 8.14.0. Treat these as **possible breaking toolchain changes**, not automatic production fixes. Review `eslint.config.js` and plugin peer requirements before selecting a compatible set.
5. **P2 — Other transitive tooling:** `brace-expansion`, `browserslist`, `zod`, `baseline-browser-mapping`, `@babel/core` and dependent parser/utility packages need targeted lockfile updates and CI validation.

## Remediation sequence (proposed; not applied)

1. Create a reviewable dependency branch. Run `npm audit fix --dry-run` and inspect the proposed lockfile diff before applying nonbreaking updates. Avoid `npm audit fix --force`.
2. Prioritize patched Vite, React Router and the production-scoped transitive packages. Update Vite and `@tailwindcss/vite` compatibly; confirm all seven Vite advisories in the detailed audit, rather than assuming one patch fixes the set.
3. Review and align ESLint/TypeScript-ESLint/plugins in a separate change; avoid blindly following npm's downgrade suggestions.
4. Run `npm ci`, `npm run build`, `npm run lint`, `npm test`, `npm run test:integration`, `npm run test:browser`, `npm audit`, and `npm audit --omit=dev` on the changed lockfile. Record residual reports and deliberate exceptions.
5. Independently address server-side authentication, secret handling and filesystem/database safety. Dependency updates **cannot** secure unauthenticated write endpoints.

## What was and was not verified

**Verified:** A clean CI audit against the current GitHub lockfile, precise affected package names, severity grouping, direct/transitive information, fix availability and npm dev/production classification.

**Not performed:** `npm audit fix`, lockfile upgrades, exploitation tests, real deployment verification, direct assessment of every vulnerable code path, or validation that the latest patched releases work with this project. Advisory output can change as new vulnerabilities are published.

**Disposition:** **Dependency audit complete; vulnerability remediation outstanding.** These reports do not independently authorize a production release.

## Remediation result — compatible lockfile updates, 2026-11-03

The original inventory above records **the baseline before fixes** and is preserved for historical accuracy. On the hardening review branch, `npm audit fix --package-lock-only --ignore-scripts` updated compatible locked versions, followed by a successful build, lint and integration verification before committing the new lockfile.

| Scope | Baseline | After compatible fixes |
|---|---:|---:|
| High | 8 | **0** |
| Moderate | 14 | **12** |
| Low | 1 | **0** |
| All npm affected package records | 23 | **12** |
| `npm audit --omit=dev` affected packages | 6 | **0** |

Examples: Vite `8.0.14 → 8.3.5`, React Router and React Router DOM `7.15.1 → 7.18.5`, PostCSS `8.5.15 → 8.5.32`, nanoid `3.3.12 → 3.3.20`, source-map-js `1.2.1 → 1.2.2`. All changes were resolved within the existing declared dependency ranges, with no force-upgrade. The remaining twelve moderate findings are in the linting/tooling tree and are **not considered resolved**. [Verified audit and tests](https://github.com/babunidev/babuni.admin/actions/runs/41659550592).

This does not eliminate the need to secure the development endpoints and future production backend independently.
