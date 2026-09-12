// lib/crop-image.ts
//
// Canvas-based crop: takes the pixel crop rectangle react-easy-crop reports
// and rasterizes just that region of the source image into a new file, so
// the schedule image can be reframed to fill a full-screen view cleanly.

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', reject)
    image.crossOrigin = 'anonymous'
    image.src = src
  })
}

export type PixelCrop = { x: number; y: number; width: number; height: number }

export async function getCroppedImageFile(imageSrc: string, crop: PixelCrop, fileName: string, mimeType: string): Promise<File> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = crop.width
  canvas.height = crop.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas tidak didukung di browser ini.')

  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)

  const outputType = mimeType === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, 0.92))
  if (!blob) throw new Error('Gagal memproses gambar.')

  return new File([blob], fileName, { type: outputType })
}
