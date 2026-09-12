'use client'

import { useCallback, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { Check, X, ZoomIn } from 'lucide-react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { getCroppedImageFile, type PixelCrop } from '@/lib/crop-image'

export function ImageCropModal({
  open,
  imageSrc,
  fileName,
  mimeType,
  onCancel,
  onConfirm,
}: {
  open: boolean
  imageSrc: string
  fileName: string
  mimeType: string
  onCancel: () => void
  onConfirm: (file: File) => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [processing, setProcessing] = useState(false)

  useEscapeClose(open, onCancel)

  const onCropComplete = useCallback((_: Area, pixels: Area) => setCroppedAreaPixels(pixels), [])

  if (!open) return null

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return
    setProcessing(true)
    try {
      const file = await getCroppedImageFile(imageSrc, croppedAreaPixels as PixelCrop, fileName, mimeType)
      onConfirm(file)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-white">Atur Tampilan Gambar</p>
          <p className="text-xs text-white/60">Geser dan perbesar agar pas memenuhi layar (16:9) saat ditampilkan fullscreen.</p>
        </div>
        <button type="button" onClick={onCancel} aria-label="Batal" className="grid size-9 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white">
          <X className="size-5" />
        </button>
      </div>

      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={16 / 9}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <ZoomIn className="size-4 text-white/70" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="w-full sm:w-56"
            aria-label="Perbesar"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={processing || !croppedAreaPixels}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Check className="size-4" />{processing ? 'Memproses...' : 'Gunakan Gambar Ini'}
          </button>
        </div>
      </div>
    </div>
  )
}
