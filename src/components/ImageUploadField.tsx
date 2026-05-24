import { useState } from 'react'

interface ImageUploadFieldProps {
  label: string
  fileName: string
  onUpload: (file: File) => Promise<string | void>
}

export function ImageUploadField({
  label,
  fileName,
  onUpload,
}: ImageUploadFieldProps) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  return (
    <label className="block text-sm text-fog">
      {label}
      <input
        type="file"
        accept="image/webp,image/png,image/jpeg"
        className="mt-1 block w-full text-xs text-parchment file:mr-3 file:rounded file:border file:border-gold/25 file:bg-ash file:px-2 file:py-1 file:text-gold-bright"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (!file) return

          void (async () => {
            setBusy(true)
            setMessage(null)
            try {
              const savedName = await onUpload(file)
              setMessage(
                `Saved as ${(savedName ?? fileName).replace(/\.webp$/i, '')}.webp`,
              )
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'Upload failed')
            } finally {
              setBusy(false)
              event.target.value = ''
            }
          })()
        }}
      />
      {message && <span className="mt-1 block text-xs text-fog">{message}</span>}
    </label>
  )
}
