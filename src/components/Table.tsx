import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField: keyof T & string
  emptyMessage?: string
  onRowClick?: (row: T) => void
  onRowDoubleClick?: (row: T) => void
  selectedKey?: string
}

export function Table<T extends object>({
  columns,
  data,
  keyField,
  emptyMessage = 'No records found.',
  onRowClick,
  onRowDoubleClick,
  selectedKey,
}: TableProps<T>) {
  if (data.length === 0) {
    return (
      <p className="rounded-lg border border-gold/10 bg-ash/50 px-4 py-8 text-center text-sm text-fog">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gold/15 bg-slate/40">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-gold/10 bg-ash/60">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-fog ${col.className ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const rowKey = String(row[keyField])
            const isSelected = selectedKey === rowKey
            return (
            <tr
              key={rowKey}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onDoubleClick={
                onRowDoubleClick ? () => onRowDoubleClick(row) : undefined
              }
              className={`border-b border-gold/5 transition-colors last:border-0 ${
                onRowClick ? 'cursor-pointer hover:bg-ash/40' : 'hover:bg-ash/40'
              } ${isSelected ? 'bg-gold/10' : ''}`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-3 text-parchment/90 ${col.className ?? ''}`}
                >
                  {col.render
                    ? col.render(row)
                    : String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  )
}
