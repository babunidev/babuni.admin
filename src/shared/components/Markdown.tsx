import { Fragment, type ReactNode } from 'react'

// A small Markdown reader for project documents. It builds React elements only,
// never HTML, so a document cannot inject markup or scripts. Links open only
// http(s) addresses, in a new tab. Unsupported syntax stays readable as text.

const SAFE_URL = /^https?:\/\//i

function inline(text: string, key = 'i'): ReactNode[] {
  const out: ReactNode[] = []
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g
  let last = 0, n = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > last) out.push(text.slice(last, index))
    const token = match[0]
    const k = `${key}-${n++}`
    if (match[1]) out.push(<code key={k} className="rounded bg-ash px-1 py-0.5 text-[0.85em] text-gold-bright">{token.slice(1, -1)}</code>)
    else if (match[2]) out.push(<strong key={k} className="font-semibold text-parchment">{inline(token.slice(2, -2), k)}</strong>)
    else if (match[3]) {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)!
      out.push(SAFE_URL.test(m[2])
        ? <a key={k} href={m[2]} target="_blank" rel="noreferrer noopener" className="text-gold-bright underline decoration-gold/40 hover:decoration-gold-bright">{inline(m[1], k)}</a>
        : <span key={k} className="text-gold-bright">{inline(m[1], k)}</span>)
    } else out.push(<em key={k}>{inline(token.slice(1, -1), k)}</em>)
    last = index + token.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const headingClass = [
  'mt-6 text-lg font-medium text-parchment first:mt-0',
  'mt-6 border-b border-gold/10 pb-1 text-base font-medium text-gold-bright first:mt-0',
  'mt-5 text-sm font-semibold text-parchment first:mt-0',
  'mt-4 text-sm font-medium text-fog first:mt-0',
]

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const key = `b${i}`
    if (/^```/.test(line)) {
      const body: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++])
      i++
      blocks.push(<pre key={key} className="scrollbar-thin mt-3 overflow-x-auto rounded border border-gold/10 bg-void/60 p-3 text-xs leading-relaxed text-parchment/90">{body.join('\n')}</pre>)
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const level = Math.min(heading[1].length, 4)
      const Tag = `h${level + 1}` as 'h2'
      blocks.push(<Tag key={key} className={headingClass[level - 1]}>{inline(heading[2], key)}</Tag>)
      i++
      continue
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d/.test(line)
      const items: string[] = []
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        let item = lines[i++].replace(/^\s*([-*+]|\d+[.)])\s+/, '')
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) item += ' ' + lines[i++].trim()
        items.push(item)
      }
      const List = ordered ? 'ol' : 'ul'
      blocks.push(<List key={key} className={`mt-2 space-y-1 pl-5 text-sm leading-relaxed text-parchment/85 ${ordered ? 'list-decimal' : 'list-disc'}`}>
        {items.map((item, n) => <li key={n}>{inline(item.replace(/^\[[ x]\]\s*/i, m => (m.includes('x') || m.includes('X') ? '✓ ' : '○ ')), `${key}-${n}`)}</li>)}
      </List>)
      continue
    }
    if (/^\|.*\|\s*$/.test(line)) {
      const rows: string[][] = []
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) {
        const row = lines[i++].trim().slice(1, -1).split('|').map(c => c.trim())
        if (!row.every(c => /^:?-{2,}:?$/.test(c))) rows.push(row)
      }
      blocks.push(<div key={key} className="scrollbar-thin mt-3 overflow-x-auto"><table className="text-left text-xs text-parchment/85">
        <tbody>{rows.map((row, r) => <tr key={r} className="border-b border-gold/10">
          {row.map((cell, c) => r === 0
            ? <th key={c} className="px-2 py-1.5 font-medium text-gold-bright">{inline(cell, `${key}-${r}-${c}`)}</th>
            : <td key={c} className="px-2 py-1.5 align-top">{inline(cell, `${key}-${r}-${c}`)}</td>)}
        </tr>)}</tbody></table></div>)
      continue
    }
    if (/^>\s?/.test(line)) {
      const body: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''))
      blocks.push(<blockquote key={key} className="mt-3 border-l-2 border-gold/30 pl-3 text-sm italic text-fog">{inline(body.join(' '), key)}</blockquote>)
      continue
    }
    if (/^\s*(?:-\s*){3,}$|^\s*(?:\*\s*){3,}$|^\s*(?:_\s*){3,}$/.test(line)) { blocks.push(<hr key={key} className="mt-4 border-gold/10" />); i++; continue }
    if (!line.trim()) { i++; continue }
    const body: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\s*([-*+]|\d+[.)])\s+|\||>)/.test(lines[i])) body.push(lines[i++].trim())
    blocks.push(<p key={key} className="mt-3 text-sm leading-relaxed text-parchment/85 first:mt-0">{inline(body.join(' '), key)}</p>)
  }
  return <Fragment>{blocks}</Fragment>
}
