import { useEffect, useState } from 'react'

interface ImagePickFieldProps {
  label: string
  /** The image chosen but not yet saved; `null` when none is waiting. */
  file: File | null
  onChange: (file: File | null) => void
}

/**
 * Choosing an image only keeps it in the editor and shows a preview. It is
 * uploaded, committed and pushed together with the record when Save is pressed
 * (Babuni's direction, 2026-11-21).
 */
export function ImagePickField({ label, file, onChange }: ImagePickFieldProps) {
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    // The object URL exists only once the file does; set it after creating it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview(url)
    return () => {
      URL.revokeObjectURL(url)
      setPreview(null)
    }
  }, [file])

  return (
    <div className="space-y-2">
      <label className="block text-sm text-fog">
        {label}
        <input
          type="file"
          accept="image/webp,image/png,image/jpeg"
          className="mt-1 block w-full text-xs text-parchment file:mr-3 file:rounded file:border file:border-gold/25 file:bg-ash file:px-2 file:py-1 file:text-gold-bright"
          onChange={(event) => {
            const chosen = event.target.files?.[0]
            if (chosen) onChange(chosen)
            event.target.value = ''
          }}
        />
      </label>
      {file && (
        <div className="flex items-start gap-3 rounded border border-gold/20 bg-void/30 p-2">
          {preview && (
            <img src={preview} alt="" className="h-20 w-20 shrink-0 rounded border border-gold/15 object-contain" />
          )}
          <div className="min-w-0 text-xs text-fog">
            <p className="break-all text-parchment">New image: {file.name}</p>
            <p className="mt-0.5">Not uploaded yet. It is saved everywhere when you press Save.</p>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="mt-1 rounded border border-gold/20 px-2 py-0.5 text-fog hover:bg-ash/60 hover:text-parchment"
            >
              Keep the current image
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
