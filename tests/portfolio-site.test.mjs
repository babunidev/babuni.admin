import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  SNAPSHOT, listSources, parsePullOutput, parseSiteOutput, runPull, runSitePublish,
  commitAndPushSnapshot, checkoutState, resetSiteState,
  parseReleaseName, setStatusReaders, siteStatus, repositoryChanges, publishAll,
} from '../local-service/portfolioSite.mjs'
import { withPublishLock } from '../local-service/publishLock.mjs'

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const CONNECTIONS = {
  'babuni-dev': { status: 'connected', repository: 'babunidev/babuni.dev', branch: 'main' },
  game: { status: 'connected', repository: 'babunidev/Game', branch: 'main' },
  alias: { status: 'connected', repository: 'babunidev/Game', branch: 'main' },
  addon: { status: 'connected', repository: 'babunidev/Addon', branch: 'main' },
  later: { status: 'planned', repository: 'babunidev/Later', branch: 'main' },
}

/** A babuni.dev-shaped checkout with a bare origin and fake scripts. */
function fakeCheckout({ pull = '', site = '' } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'babuni-site-'))
  const origin = join(base, 'origin.git'), root = join(base, 'checkout')
  git(base, 'init', '-q', '--bare', '-b', 'main', origin)
  git(base, 'clone', '-q', origin, root)
  git(root, 'config', 'user.email', 'test@example.invalid')
  git(root, 'config', 'user.name', 'Test')
  mkdirSync(join(root, 'scripts'))
  mkdirSync(join(root, 'src/content'), { recursive: true })
  writeFileSync(join(root, 'src/content/project-repositories.json'), JSON.stringify(CONNECTIONS, null, 2))
  writeFileSync(join(root, SNAPSHOT), JSON.stringify({ 'babunidev/Game': { commit: 'a' }, 'babunidev/Addon': { commit: 'b' } }, null, 2))
  writeFileSync(join(root, 'scripts/pull-repository.mjs'), pull)
  writeFileSync(join(root, 'scripts/publish-site.sh'), site, { mode: 0o755 })
  writeFileSync(join(root, 'other.txt'), 'one\n')
  git(root, 'add', '-A')
  git(root, 'commit', '-q', '-m', 'init')
  git(root, 'push', '-q', 'origin', 'main')
  return { base, root, origin, cleanup: () => rmSync(base, { recursive: true, force: true }) }
}

const PULL_SAMPLE = [
  'same      babunidev/Addon                   ',
  'same      babunidev/Other                   (head moved 11111111 -> 22222222, documents identical)',
  'CHANGED   babunidev/Game                    aaaaaaaa -> bbbbbbbb',
  '            CHANGED README.md',
  '            NEW     docs/Chapter Two.md',
  '            REMOVED docs/OLD.md',
  '1 repository(ies) have document changes. Add --write to update the snapshot.',
].join('\n')

test('pull output is parsed with changes, removals and the summary', () => {
  const parsed = parsePullOutput(PULL_SAMPLE)
  assert.equal(parsed.repositories.length, 3)
  assert.equal(parsed.repositories[1].headMoved, true)
  assert.equal(parsed.changedCount, 1)
  assert.equal(parsed.removedCount, 1)
  assert.deepEqual(parsed.repositories[2].changes[1], { kind: 'NEW', path: 'docs/Chapter Two.md' })
  assert.match(parsed.summary, /^1 repository/)
})

test('site output is parsed into counts, a bounded list and the release', () => {
  const lines = ['Building origin/main abc1234; live release: releases/old-site', 'Build finished: 900 files', '--- changes ---']
  for (let i = 0; i < 450; i++) lines.push(`CHANGED  page${i}.html`)
  lines.push('ADDED    new/file.json', 'REMOVED  gone.md', 'Creating release new-site',
    'Published and verified: new-site', "Rollback: ssh ... 'cd /var/www && ln -s releases/old-site .rb && mv -Tf .rb current'")
  const parsed = parseSiteOutput(lines.join('\n'))
  assert.deepEqual([parsed.commit, parsed.liveRelease, parsed.buildFiles], ['abc1234', 'old-site', 900])
  assert.deepEqual(parsed.counts, { CHANGED: 450, ADDED: 1, REMOVED: 1 })
  assert.equal(parsed.total, 452)
  assert.equal(parsed.changes.length, 400)
  assert.equal(parsed.truncated, true)
  assert.equal(parsed.published, true)
  assert.equal(parsed.newRelease, 'new-site')
  assert.match(parsed.rollback, /old-site/)
  assert.equal(parseSiteOutput('Nothing to publish.').nothing, true)
})

test('sources come from the connection map, without babuni.dev, duplicates or planned entries', async () => {
  const f = fakeCheckout()
  try {
    assert.deepEqual(await listSources(f.root), ['babunidev/Addon', 'babunidev/Game'])
    await assert.rejects(listSources(join(f.base, 'missing')), /CHECKOUT_UNAVAILABLE/)
  } finally { f.cleanup() }
})

test('pull runs the fixed script, refuses free targets and requires a check before writing', async () => {
  resetSiteState()
  const f = fakeCheckout({ pull: `
const args = process.argv.slice(2)
console.log('ARGS ' + JSON.stringify(args) + ' ' + process.env.NODE_OPTIONS)
console.log(${JSON.stringify(PULL_SAMPLE)})
if (args.includes('--write')) console.log('Snapshot updated for 1 repository(ies). Review with git diff, then commit and publish.')
` })
  try {
    await assert.rejects(runPull('babunidev/Unknown', false, false, f.root), /SOURCE_DENIED/)
    await assert.rejects(runPull('--all', false, false, f.root), /SOURCE_DENIED/)
    await assert.rejects(runPull('babunidev/Game', true, true, f.root), /CHECK_REQUIRED/)
    const check = await runPull('babunidev/Game', false, false, f.root)
    assert.equal(check.ok, true)
    assert.equal(check.removedCount, 1)
    await assert.rejects(runPull('all', true, true, f.root), /CHECK_REQUIRED/)
    await assert.rejects(runPull('babunidev/Game', true, false, f.root), /REMOVALS_NOT_ACCEPTED/)
    const write = await runPull('babunidev/Game', true, true, f.root)
    assert.equal(write.written, true)
    await assert.rejects(runPull('babunidev/Game', true, true, f.root), /CHECK_REQUIRED/)
    const all = await runPull('all', false, false, f.root)
    assert.equal(all.ok, true)
  } finally { f.cleanup() }
})

test('pull failures are classified without returning stderr', async () => {
  resetSiteState()
  const f = fakeCheckout({ pull: "console.error('No GitHub login: run gh auth login first; token=secret'); process.exit(1)" })
  try {
    const result = await runPull('all', false, false, f.root)
    assert.deepEqual([result.ok, result.error], [false, 'GITHUB_LOGIN_MISSING'])
    assert.equal(JSON.stringify(result).includes('secret'), false)
  } finally { f.cleanup() }
})

test('commit and push carries only the snapshot file to origin/main', async () => {
  const f = fakeCheckout()
  try {
    await assert.rejects(commitAndPushSnapshot(f.root), /NOTHING_TO_COMMIT/)
    writeFileSync(join(f.root, SNAPSHOT), JSON.stringify({ 'babunidev/Game': { commit: 'c' }, 'babunidev/Addon': { commit: 'b' } }, null, 2))
    writeFileSync(join(f.root, 'other.txt'), 'local edit\n')
    git(f.root, 'add', 'other.txt')
    const result = await commitAndPushSnapshot(f.root)
    assert.equal(result.ok, true)
    assert.equal(result.repositories, 1)
    assert.equal(git(f.origin, 'log', '-1', '--format=%s', 'main'), 'content: pull document changes from 1 source repository')
    assert.deepEqual(git(f.origin, 'show', '--name-only', '--format=', 'main').split('\n'), [SNAPSHOT])
    assert.equal(readFileSync(join(f.root, 'other.txt'), 'utf8'), 'local edit\n')
    assert.equal(git(f.root, 'diff', '--cached', '--name-only'), 'other.txt')
    const state = await checkoutState(f.root)
    assert.deepEqual([state.snapshotDirty, state.ahead, state.behind], [false, 0, 0])
  } finally { f.cleanup() }
})

test('commit and push refuses other unpushed commits, a stale checkout and other branches', async () => {
  const f = fakeCheckout()
  try {
    writeFileSync(join(f.root, 'other.txt'), 'two\n')
    git(f.root, 'commit', '-q', '-am', 'local work')
    writeFileSync(join(f.root, SNAPSHOT), '{}')
    await assert.rejects(commitAndPushSnapshot(f.root), /UNPUSHED_OTHER_COMMITS/)
    git(f.root, 'reset', '-q', '--hard', 'origin/main')

    const other = join(f.base, 'other')
    git(f.base, 'clone', '-q', f.origin, other)
    git(other, 'config', 'user.email', 'test@example.invalid')
    git(other, 'config', 'user.name', 'Test')
    writeFileSync(join(other, 'other.txt'), 'upstream\n')
    git(other, 'commit', '-q', '-am', 'upstream')
    git(other, 'push', '-q', 'origin', 'main')
    writeFileSync(join(f.root, SNAPSHOT), '{}')
    await assert.rejects(commitAndPushSnapshot(f.root), /BEHIND_ORIGIN/)
    git(f.root, 'checkout', '-q', '.')
    git(f.root, 'pull', '-q', '--ff-only')

    git(f.root, 'checkout', '-q', '-b', 'feature')
    writeFileSync(join(f.root, SNAPSHOT), '{}')
    await assert.rejects(commitAndPushSnapshot(f.root), /NOT_ON_MAIN/)
  } finally { f.cleanup() }
})

const SITE_SCRIPT = `#!/usr/bin/env bash
c="$(git rev-parse --short origin/main)"
echo "Building origin/main $c; live release: releases/old"
echo "Build finished: 3 files"
echo "--- changes ---"
echo "CHANGED  index.html"
if [ "$1" = "--apply" ]; then echo "Creating release new"; echo "Published and verified: new"; echo "Rollback: ssh ... 'x'";
else echo "Dry run: 1 path(s) differ. Add --apply to publish."; fi
`

test('site publish needs a dry run of the same origin/main commit', async () => {
  resetSiteState()
  const f = fakeCheckout({ site: SITE_SCRIPT })
  try {
    await assert.rejects(runSitePublish(true, f.root), /CHECK_REQUIRED/)
    const dry = await runSitePublish(false, f.root)
    assert.deepEqual([dry.ok, dry.published, dry.differCount, dry.total], [true, false, 1, 1])

    const other = join(f.base, 'other')
    git(f.base, 'clone', '-q', f.origin, other)
    git(other, 'config', 'user.email', 'test@example.invalid')
    git(other, 'config', 'user.name', 'Test')
    writeFileSync(join(other, 'other.txt'), 'moved\n')
    git(other, 'commit', '-q', '-am', 'moved')
    git(other, 'push', '-q', 'origin', 'main')
    await assert.rejects(runSitePublish(true, f.root), /ORIGIN_MOVED/)

    await runSitePublish(false, f.root)
    const applied = await runSitePublish(true, f.root)
    assert.deepEqual([applied.ok, applied.published, applied.newRelease], [true, true, 'new'])
    await assert.rejects(runSitePublish(true, f.root), /CHECK_REQUIRED/)
  } finally { f.cleanup() }
})

test('site publish failures map exit codes and an unverified switch', async () => {
  for (const [script, code] of [
    ['echo "SSH_KEY_NOT_LOADED" >&2; exit 3', 'SSH_KEY_NOT_LOADED'],
    ['echo "BUILD_FAILED secret" >&2; exit 4', 'BUILD_FAILED'],
    ['echo "Creating release new"; echo "VERIFY_FAILED" >&2; exit 5', 'VERIFY_FAILED'],
    ['echo "Creating release new"; exit 1', 'PUBLISH_UNVERIFIED'],
    ['exit 9', 'PUBLISH_FAILED'],
  ]) {
    resetSiteState()
    const f = fakeCheckout({ site: '#!/usr/bin/env bash\n' + script + '\n' })
    try {
      const result = await runSitePublish(false, f.root)
      assert.deepEqual([result.ok, result.error], [false, code])
      assert.equal(JSON.stringify(result).includes('secret'), false)
    } finally { f.cleanup() }
  }
})

test('one lock covers document publishing, pulls and site publishing', async () => {
  const f = fakeCheckout({ site: SITE_SCRIPT })
  try {
    let release
    const held = withPublishLock('document', () => new Promise(resolve => { release = resolve }))
    await assert.rejects(runSitePublish(false, f.root), /PUBLISH_BUSY/)
    await assert.rejects(runPull('all', false, false, f.root), /PUBLISH_BUSY/)
    await assert.rejects(commitAndPushSnapshot(f.root), /PUBLISH_BUSY/)
    release()
    await held
    assert.equal((await runSitePublish(false, f.root)).ok, true)
  } finally { f.cleanup() }
})

// ---- One-page status and one-click publish ----

/** Fake pull: reports one changed repository; --write rewrites the snapshot. */
const pullScript = (removed = 0, writeRemoved = removed) => `
const { writeFileSync } = require('node:fs')
const write = process.argv.includes('--write')
const n = write ? ${writeRemoved} : ${removed}
console.log('same      babunidev/Addon')
console.log('CHANGED   babunidev/Game                    aaaaaaaa -> bbbbbbbb')
console.log('            CHANGED README.md')
for (let i = 0; i < n; i++) console.log('            REMOVED docs/OLD' + i + '.md')
if (write) {
  writeFileSync(${JSON.stringify(SNAPSHOT)}, JSON.stringify({ 'babunidev/Game': { commit: 'b' }, 'babunidev/Addon': { commit: 'b' } }, null, 2))
  console.log('Snapshot updated for 1 repository(ies). Review with git diff, then commit and publish.')
} else console.log('1 repository(ies) have document changes. Add --write to update the snapshot.')
`.replace("const { writeFileSync } = require('node:fs')", "import { writeFileSync } from 'node:fs'")

test('release names are parsed and anything else is rejected', () => {
  assert.deepEqual(parseReleaseName('20261110-004601-fd89891-site\n'), { name: '20261110-004601-fd89891-site', commit: 'fd89891', kind: 'site' })
  assert.equal(parseReleaseName('20261109-123701-c67d005-doc').kind, 'doc')
  for (const bad of ['', 'fd89891', '<html>', '20261110-004601-fd89891-site; rm -rf /']) assert.equal(parseReleaseName(bad), null)
})

test('site status lists commits not yet live and the uncommitted snapshot', async () => {
  const f = fakeCheckout()
  try {
    const first = git(f.root, 'rev-parse', '--short', 'HEAD')
    setStatusReaders({ release: async () => `20261110-000000-${first}-site` })
    let status = await siteStatus(f.root)
    assert.deepEqual([status.upToDate, status.pendingCommits.length, status.snapshotWaiting], [true, 0, false])

    writeFileSync(join(f.root, 'other.txt'), 'new\n')
    git(f.root, 'commit', '-q', '-am', 'docs: new journal entry')
    git(f.root, 'push', '-q', 'origin', 'main')
    writeFileSync(join(f.root, SNAPSHOT), '{}')
    status = await siteStatus(f.root)
    assert.equal(status.upToDate, false)
    assert.deepEqual(status.pendingCommits.map(c => c.subject), ['docs: new journal entry'])
    assert.equal(status.snapshotWaiting, true)

    setStatusReaders({ release: async () => `20261110-000000-${first}-doc` })
    git(f.root, 'checkout', '-q', '--', SNAPSHOT)
    git(f.root, 'reset', '-q', '--hard', 'origin/main')
    const head = git(f.root, 'rev-parse', '--short', 'HEAD')
    setStatusReaders({ release: async () => `20261110-000000-${head}-doc` })
    assert.equal((await siteStatus(f.root)).upToDate, false, 'a single-document release is never a full match')
    setStatusReaders({ release: async () => { throw new Error('offline') } })
    status = await siteStatus(f.root)
    assert.deepEqual([status.live, status.upToDate], [null, false])
  } finally { f.cleanup() }
})

test('repository changes are cached and list GitHub repositories missing from the website', async () => {
  resetSiteState()
  const f = fakeCheckout({ pull: pullScript() })
  try {
    setStatusReaders({ repositories: async () => [
      { nameWithOwner: 'babunidev/Game', isPrivate: false, isArchived: false },
      { nameWithOwner: 'babunidev/NewTool', isPrivate: false, isArchived: false },
      { nameWithOwner: 'babunidev/Secret', isPrivate: true, isArchived: false },
      { nameWithOwner: 'babunidev/Old', isPrivate: false, isArchived: true },
      { nameWithOwner: 'babunidev/Later', isPrivate: false, isArchived: false },
    ] })
    const first = await repositoryChanges(false, f.root)
    assert.deepEqual([first.ok, first.cached, first.changedCount], [true, false, 1])
    assert.deepEqual(first.notOnWebsite, [
      { repository: 'babunidev/Later', private: false },
      { repository: 'babunidev/NewTool', private: false },
      { repository: 'babunidev/Secret', private: true },
    ])
    assert.equal((await repositoryChanges(false, f.root)).cached, true)
    assert.equal((await repositoryChanges(true, f.root)).cached, false)
    setStatusReaders({ repositories: async () => { throw new Error('no gh') } })
    assert.equal((await repositoryChanges(false, f.root)).notOnWebsite, null)
  } finally { f.cleanup() }
})

test('two all-repository checks at once share one run instead of failing as busy', async () => {
  resetSiteState()
  const f = fakeCheckout({ pull: pullScript() })
  try {
    setStatusReaders({ repositories: async () => [] })
    const [a, b] = await Promise.all([repositoryChanges(true, f.root), repositoryChanges(false, f.root)])
    assert.deepEqual([a.ok, b.ok], [true, true])
    assert.equal(a.checkedAt, b.checkedAt, 'same run')
    await assert.rejects(withPublishLock('site', () => repositoryChanges(true, f.root)), /PUBLISH_BUSY/,
      'a real publish still blocks a new check')
  } finally { f.cleanup() }
})

test('publish everything pulls, commits only the snapshot, pushes and publishes in one call', async () => {
  resetSiteState()
  const f = fakeCheckout({ pull: pullScript(), site: SITE_SCRIPT })
  try {
    await assert.rejects(publishAll(false, f.root), /CHECK_REQUIRED/)
    await repositoryChanges(true, f.root)
    writeFileSync(join(f.root, 'other.txt'), 'unrelated local edit\n')
    const result = await publishAll(false, f.root)
    assert.equal(result.ok, true)
    assert.equal(result.steps.pull.written, true)
    assert.equal(result.steps.push.repositories, 1)
    assert.deepEqual([result.steps.site.published, result.steps.site.newRelease], [true, 'new'])
    assert.equal(git(f.origin, 'log', '-1', '--format=%s', 'main'), 'content: pull document changes from 1 source repository')
    assert.deepEqual(git(f.origin, 'show', '--name-only', '--format=', 'main').split('\n'), [SNAPSHOT])
    assert.equal(readFileSync(join(f.root, 'other.txt'), 'utf8'), 'unrelated local edit\n')
    await assert.rejects(publishAll(false, f.root), /CHECK_REQUIRED/, 'a publish uses up its check')
  } finally { f.cleanup() }
})

test('publish everything never commits a snapshot that other work already modified', async () => {
  resetSiteState()
  const f = fakeCheckout({ pull: "console.log('same      babunidev/Game'); console.log('No document changes.')", site: SITE_SCRIPT })
  try {
    await repositoryChanges(true, f.root)
    writeFileSync(join(f.root, SNAPSHOT), '{"half-finished": true}')
    await assert.rejects(publishAll(false, f.root), /SNAPSHOT_DIRTY/)
    assert.equal(readFileSync(join(f.root, SNAPSHOT), 'utf8'), '{"half-finished": true}', 'left untouched')
    assert.equal(git(f.origin, 'log', '-1', '--format=%s', 'main'), 'init', 'nothing pushed')
  } finally { f.cleanup() }
})

test('publish everything without repository changes publishes the website repository only', async () => {
  resetSiteState()
  const f = fakeCheckout({ pull: "console.log('same      babunidev/Game'); console.log('No document changes.')", site: SITE_SCRIPT })
  try {
    await repositoryChanges(true, f.root)
    const result = await publishAll(false, f.root)
    assert.deepEqual([result.ok, result.steps.pull, result.steps.push, result.steps.site.published], [true, null, null, true])
  } finally { f.cleanup() }
})

test('publish everything guards removals and undoes a write that removes more than the check showed', async () => {
  resetSiteState()
  const f = fakeCheckout({ pull: pullScript(1, 2), site: SITE_SCRIPT })
  try {
    await repositoryChanges(true, f.root)
    await assert.rejects(publishAll(false, f.root), /REMOVALS_NOT_ACCEPTED/)
    const result = await publishAll(true, f.root)
    assert.deepEqual([result.ok, result.step, result.error], [false, 'pull', 'CHANGED_SINCE_CHECK'])
    assert.equal(git(f.root, 'status', '--porcelain', '--', SNAPSHOT), '', 'snapshot restored')
    assert.equal(git(f.origin, 'log', '-1', '--format=%s', 'main'), 'init', 'nothing pushed')
  } finally { f.cleanup() }
})

test('publish everything stops before writing on a stale checkout or a failed build', async () => {
  resetSiteState()
  const f = fakeCheckout({ pull: pullScript(), site: '#!/usr/bin/env bash\necho "BUILD_FAILED" >&2\nexit 4\n' })
  try {
    await repositoryChanges(true, f.root)
    git(f.root, 'checkout', '-q', '-b', 'feature')
    await assert.rejects(publishAll(false, f.root), /NOT_ON_MAIN/)
    assert.equal(git(f.root, 'status', '--porcelain', '--', SNAPSHOT), '')
    git(f.root, 'checkout', '-q', 'main')
    const result = await publishAll(false, f.root)
    assert.deepEqual([result.ok, result.step, result.error], [false, 'site', 'BUILD_FAILED'])
    assert.equal(result.steps.push.ok, true, 'the snapshot commit was pushed before the build failed')
  } finally { f.cleanup() }
})
