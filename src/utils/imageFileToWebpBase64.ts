function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) throw new Error('Invalid image data')
  return dataUrl.slice(comma + 1)
}

/** Encodes an image file as base64 WebP (re-encodes non-webp in the browser). */
export async function imageFileToWebpBase64(file: File): Promise<string> {
  if (file.type === 'image/webp') {
    return dataUrlToBase64(await readFileAsDataUrl(file))
  }

  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not prepare image canvas')

    ctx.drawImage(bitmap, 0, 0)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error('Could not convert image to WebP')),
        'image/webp',
        0.92,
      )
    })

    return dataUrlToBase64(await readFileAsDataUrl(new File([blob], 'encounter.webp', { type: 'image/webp' })))
  } finally {
    bitmap.close()
  }
}
