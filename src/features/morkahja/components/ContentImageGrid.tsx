export interface ContentGridItem {
  id: string
  imageSrc: string
  title?: string
}

interface ContentImageGridProps {
  items: ContentGridItem[]
  selectedId?: string
  onSelect: (id: string) => void
  emptyMessage?: string
  columns?: 'compact' | 'wide'
}

export function ContentImageGrid({
  items,
  selectedId,
  onSelect,
  emptyMessage = 'No items to display.',
  columns = 'compact',
}: ContentImageGridProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-gold/10 bg-ash/50 px-4 py-8 text-center text-sm text-fog">
        {emptyMessage}
      </p>
    )
  }

  const gridClass =
    columns === 'wide'
      ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
      : 'grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8'

  return (
    <div className={gridClass}>
      {items.map((item) => {
        const isSelected = selectedId === item.id
        return (
          <button
            key={item.id}
            type="button"
            title={item.title ?? item.id}
            onClick={() => onSelect(item.id)}
            className={`group relative aspect-square overflow-hidden rounded-lg border transition ${
              isSelected
                ? 'border-gold/50 ring-2 ring-gold/30'
                : 'border-gold/15 hover:border-gold/35 hover:bg-ash/40'
            }`}
          >
            {item.imageSrc ? (
              <img
                src={item.imageSrc}
                alt={item.title ?? ''}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-void/50 p-2 text-center text-[10px] text-fog">
                {item.title ?? item.id}
              </div>
            )}
            {item.title && (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-void/90 to-transparent px-1 py-1 text-[10px] leading-tight text-parchment/90 opacity-0 transition group-hover:opacity-100">
                {item.title}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
