import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isAllowedDocumentPath, parsePublishOutput, runPublish } from '../local-service/portfolioDocuments.mjs'

function fakeCheckout(script) {
  const root = mkdtempSync(join(tmpdir(), 'babuni-portfolio-'))
  mkdirSync(join(root, 'scripts'))
  writeFileSync(join(root, 'scripts/publish-document.sh'), script, { mode: 0o755 })
  return root
}

test('only standard babuni.dev document paths are allowed', () => {
  for (const ok of ['README.md', 'CONCEPT.md', 'CHANGELOG.md', 'ROADMAP.md', 'docs/DEVLOG.md', 'docs/AI_COLLABORATION.md'])
    assert.equal(isAllowedDocumentPath(ok), true, ok)
  for (const bad of ['', '../README.md', 'docs/../README.md', '/etc/passwd', 'src/lib/x.md', 'docs/devlog.md',
    'docs/DEVLOG.md; rm -rf /', 'docs/DEVLOG.md\n', 'scripts/publish-document.sh', null, undefined, 5])
    assert.equal(isAllowedDocumentPath(bad), false, String(bad))
})

test('publish output is parsed into files, releases and state', () => {
  const parsed = parsePublishOutput([
    'Live release: releases/old', '--- files this document feeds ---',
    'CHANGED    a.md', 'unchanged  b.json', 'Published and verified: new', '',
  ].join('\n'))
  assert.deepEqual(parsed.files, [{ file: 'a.md', changed: true }, { file: 'b.json', changed: false }])
  assert.equal(parsed.liveRelease, 'old')
  assert.equal(parsed.newRelease, 'new')
  assert.equal(parsed.published, true)
  assert.equal(parsePublishOutput('Nothing to publish.').nothing, true)
})

test('dry run and apply run the script with a fixed argument list', async () => {
  const root = fakeCheckout(`#!/usr/bin/env bash
echo "Live release: releases/old"
echo "CHANGED    a.md"
echo "unchanged  b.json"
if [ "$2" = "--apply" ]; then echo "Published and verified: new"; else echo "Dry run: 1 file(s) would change."; fi
`)
  try {
    const dry = await runPublish('docs/DEVLOG.md', false, root)
    assert.equal(dry.ok, true)
    assert.equal(dry.published, false)
    assert.equal(dry.files.filter(f => f.changed).length, 1)
    const applied = await runPublish('docs/DEVLOG.md', true, root)
    assert.equal(applied.published, true)
    assert.equal(applied.newRelease, 'new')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('an unloaded key, other failures, bad paths and missing checkouts fail safely', async () => {
  const locked = fakeCheckout('#!/usr/bin/env bash\necho "SSH_KEY_NOT_LOADED" >&2\nexit 3\n')
  const broken = fakeCheckout('#!/usr/bin/env bash\necho "secret detail" >&2\nexit 1\n')
  try {
    const a = await runPublish('README.md', true, locked)
    assert.deepEqual([a.ok, a.error], [false, 'SSH_KEY_NOT_LOADED'])
    const b = await runPublish('README.md', true, broken)
    assert.deepEqual([b.ok, b.error], [false, 'PUBLISH_FAILED'])
    assert.equal(JSON.stringify(b).includes('secret'), false)
    await assert.rejects(runPublish('../README.md', false, broken), /DOCUMENT_PATH_DENIED/)
    await assert.rejects(runPublish('README.md', false, join(tmpdir(), 'does-not-exist-babuni')), /CHECKOUT_UNAVAILABLE/)
  } finally {
    rmSync(locked, { recursive: true, force: true })
    rmSync(broken, { recursive: true, force: true })
  }
})
