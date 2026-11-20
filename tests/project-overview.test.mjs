import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  latestChangelogEntry, parseTiles, projectDocument, projectDocuments, projectOverview, projectsQuery,
  resetProjectOverview, websiteProjects,
} from '../local-service/projectOverview.mjs'

function checkout() {
  const dir = mkdtempSync(join(tmpdir(), 'babuni-projects-'))
  mkdirSync(join(dir, 'src/content'), { recursive: true })
  mkdirSync(join(dir, 'src/lib'), { recursive: true })
  writeFileSync(join(dir, 'src/content/project-repositories.json'), JSON.stringify({
    alpha: { status: 'connected', repository: 'babunidev/Alpha', branch: 'main' },
    beta: { status: 'connected', repository: 'babunidev/Beta', branch: 'master' },
    gamma: { status: 'needs-repository' },
    evil: { status: 'connected', repository: 'babunidev/x"){ y', branch: 'main' },
  }))
  writeFileSync(join(dir, 'src/lib/demo-projects.ts'), `export const demoProjects=[
  { "id": "alpha", "name": "Alpha \\"A\\"", "shortSummary": "First.", "tint": "#112233" },
  { "id": "beta", "name": "Beta", "shortSummary": "Second.", "tint": "#445566" },
  { "id": "gamma", "name": "Gamma", "shortSummary": "Third.", "tint": "#778899" }
];`)
  return dir
}

const commit = (oid, date) => ({ abbreviatedOid: oid, messageHeadline: `work ${oid}`, committedDate: date, url: `https://github.com/x/${oid}` })
function fakeGithub(calls = []) {
  return {
    graphql: async query => {
      calls.push(query)
      return {
        data: {
          p0: { url: 'https://github.com/babunidev/Alpha', isPrivate: false,
            ref: { target: { history: { nodes: [commit('a1', '2026-11-18T10:00:00Z')] } } },
            changelog: { text: '# Alpha\n## 2026-11-02 — Older\n- old\n## 2026-11-10 — Newest\n- the new thing\n' } },
          p1: { url: 'https://github.com/babunidev/Beta', isPrivate: false,
            ref: { target: { history: { nodes: [commit('b1', '2026-11-18T10:00:00Z'), commit('b0', '2026-10-01T00:00:00Z')] } } },
            changelog: null },
        },
      }
    },
    tree: async () => ({ tree: [
      { type: 'blob', path: 'README.md', size: 10 },
      { type: 'blob', path: 'docs/ROADMAP.md', size: 10 },
      { type: 'blob', path: 'docs/HUGE.md', size: 5 * 1024 * 1024 },
      { type: 'blob', path: '.github/NOTES.md', size: 10 },
      { type: 'blob', path: 'src/index.ts', size: 10 },
      { type: 'tree', path: 'docs' },
    ] }),
    file: async (repository, path) => `# ${repository} ${path}\n`,
  }
}

test('website projects keep the tile order and connect only valid repositories', async () => {
  const projects = await websiteProjects(checkout())
  assert.deepEqual(projects.map(p => p.id), ['alpha', 'beta', 'gamma', 'evil'])
  assert.equal(projects[0].name, 'Alpha "A"')
  assert.equal(projects[1].branch, 'master')
  assert.equal(projects[2].repository, null)
  assert.equal(projects[3].repository, null, 'a repository name that could break the query is not connected')
  assert.equal(parseTiles('nothing here').size, 0)
})

test('latest changelog entry takes the newest date, with a version as title fallback', () => {
  const entry = latestChangelogEntry('# Log\n## 2026-11-01 — A\nx\n## 2026-11-05 — B\n- b\n## 2026-10-01 — C\n')
  assert.equal(entry.date, '2026-11-05')
  assert.equal(entry.title, 'B')
  assert.equal(entry.body, '- b')
  assert.equal(latestChangelogEntry('## 0.4.11-beta — 2026-11-13\n- fix\n').title, '0.4.11-beta')
  assert.equal(latestChangelogEntry('## Unreleased\n'), null)
  const trailing = latestChangelogEntry('## 0.6.1-beta — spellbook button (2026-11-19)\n- new\n## 0.6.0-beta — older (2026-11-10)\n')
  assert.equal(trailing.date, '2026-11-19')
  assert.equal(trailing.title, '0.6.1-beta — spellbook button')
  assert.equal(latestChangelogEntry('## [1.2.0] - 2026-11-03\n').title, '1.2.0')
  assert.equal(latestChangelogEntry(undefined), null)
  const unreleased = latestChangelogEntry('## [Unreleased]\n\n### Changed — newest (2026-11-19)\n- a\n\n### Added — older (2026-11-13)\n- b\n## 0.1.0 — 2026-11-13\n- c\n')
  assert.equal(unreleased.date, '2026-11-19')
  assert.equal(unreleased.title, 'Changed — newest')
  assert.equal(unreleased.body, '- a')
  const nested = latestChangelogEntry('## 2026-11-19 — Release\n### Added\n- x\n## 2026-11-01 — Old\n')
  assert.equal(nested.body, '### Added\n- x')
})

test('the project query quotes every name and branch', () => {
  const query = projectsQuery([{ repository: 'babunidev/Alpha', branch: 'main' }])
  assert.match(query, /repository\(owner:"babunidev",name:"Alpha"\)/)
  assert.match(query, /object\(expression:"main:CHANGELOG.md"\)/)
})

test('the project waiting longest by its changelog asks for revision', async () => {
  resetProjectOverview()
  const calls = []
  const dir = checkout()
  const result = await projectOverview(true, { checkout: dir, github: fakeGithub(calls), now: Date.parse('2026-11-19T12:00:00Z') })
  const byId = Object.fromEntries(result.projects.map(p => [p.id, p]))
  assert.equal(byId.alpha.lastWorkedOn, '2026-11-10', 'changelog date, not the bulk commit')
  assert.equal(byId.alpha.lastWorkedFrom, 'changelog')
  assert.equal(byId.alpha.changelog.title, 'Newest')
  assert.equal(byId.beta.lastWorkedOn, '2026-11-18', 'falls back to the last commit')
  assert.equal(byId.alpha.daysSince, 9)
  assert.equal(result.revision, 'alpha')
  assert.equal(byId.alpha.needsRevision, true)
  assert.equal(byId.beta.needsRevision, false)
  assert.equal(byId.gamma.commits, undefined)
  assert.equal(calls.length, 1)
  const cached = await projectOverview(false, { checkout: dir, github: fakeGithub(calls) })
  assert.equal(cached.cached, true)
  assert.equal(calls.length, 1, 'a second open within ten minutes does not ask GitHub again')
})

test('documents: Markdown only, no hidden folders, and only listed paths can be read', async () => {
  resetProjectOverview()
  const deps = { checkout: checkout(), github: fakeGithub() }
  const list = await projectDocuments('alpha', deps)
  assert.deepEqual(list.documents.map(d => d.path), ['README.md', 'docs/HUGE.md', 'docs/ROADMAP.md'])
  const doc = await projectDocument('alpha', 'docs/ROADMAP.md', deps)
  assert.equal(doc.body, '# babunidev/Alpha docs/ROADMAP.md\n')
  for (const path of ['../secret.md', '.github/NOTES.md', 'src/index.ts', '/etc/passwd'])
    await assert.rejects(projectDocument('alpha', path, deps), /DOCUMENT_NOT_LISTED/)
  await assert.rejects(projectDocument('alpha', 'docs/HUGE.md', deps), /DOCUMENT_TOO_LARGE/)
  await assert.rejects(projectDocuments('nope', deps), /PROJECT_UNKNOWN/)
  await assert.rejects(projectDocuments('gamma', deps), /PROJECT_NOT_CONNECTED/)
})
