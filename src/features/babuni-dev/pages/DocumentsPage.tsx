import { useEffect, useState } from 'react'
import { PageHeader } from '../../../shared/components/PageHeader'
import {
  checkDocument, describeError, listDocuments, publishDocument, type PublishResult,
} from '../services/portfolioDocuments'

type Row = { busy?: boolean; result?: PublishResult; message?: string; confirm?: boolean }

export function DocumentsPage() {
  const [documents, setDocuments] = useState<string[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rows, setRows] = useState<Record<string, Row>>({})

  useEffect(() => {
    let active = true
    listDocuments()
      .then(value => { if (active) setDocuments(value.documents) })
      .catch((error: Error) => { if (active) setLoadError(describeError(error.message)) })
    return () => { active = false }
  }, [])

  const patch = (path: string, row: Row) => setRows(current => ({ ...current, [path]: row }))

  async function run(path: string, action: 'check' | 'publish') {
    patch(path, { busy: true })
    try {
      const result = action === 'check' ? await checkDocument(path) : await publishDocument(path)
      patch(path, { result })
    } catch (error) {
      patch(path, { message: describeError((error as Error).message) })
    }
  }

  const status = (row: Row | undefined) => {
    if (!row) return 'Not checked'
    if (row.busy) return 'Working…'
    if (row.message) return row.message
    const result = row.result
    if (!result) return 'Not checked'
    if (result.published) return 'Published as ' + result.newRelease
    if (result.nothing) return 'Live site is current'
    const changed = result.files.filter(file => file.changed).length
    return changed + ' file(s) differ from the live site'
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Compare committed babuni.dev documents with the live site and publish one without a rebuild"
      />
      <p className="mb-4 max-w-2xl text-sm text-fog">
        Documents are read from the committed main branch. Edit and commit in your checkout, then publish here.
        Only the files that document feeds are replaced, and the previous release stays on the server.
      </p>
      {loadError && <p className="mb-4 text-sm text-fog">{loadError}</p>}
      <ul className="max-w-3xl divide-y divide-gold/15 rounded-lg border border-gold/15 bg-slate/50">
        {documents.map(path => {
          const row = rows[path]
          const changed = row?.result?.files.some(file => file.changed) && !row.result?.published
          return (
            <li key={path} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="w-72 truncate font-mono text-sm text-gold-bright">{path}</span>
              <span className="flex-1 text-sm text-fog">{status(row)}</span>
              <button type="button" disabled={row?.busy}
                onClick={() => run(path, 'check')}
                className="rounded border border-gold/30 px-3 py-1 text-sm text-fog disabled:opacity-50">
                Check
              </button>
              {changed && !row?.confirm && (
                <button type="button" onClick={() => patch(path, { ...row, confirm: true })}
                  className="rounded border border-gold/60 px-3 py-1 text-sm text-gold-bright">
                  Publish…
                </button>
              )}
              {changed && row?.confirm && (
                <button type="button" onClick={() => run(path, 'publish')}
                  className="rounded border border-gold bg-gold/10 px-3 py-1 text-sm text-gold-bright">
                  Confirm publish to www.babuni.dev
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
