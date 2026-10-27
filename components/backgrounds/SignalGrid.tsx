'use client'

import React, { useEffect, useRef, useMemo } from 'react'

/**
 * SignalGrid (`/05 Signal Grid` inspired by getdesign.md/backgrounds)
 * 
 * Matrix of micro-square cells that gently twinkle under a traveling wave,
 * dense at one side and gracefully fading outward.
 * 
 * Engineered with pure HTML5 Canvas 2D:
 * - Zero heavy dependencies or external WebGL bundles.
 * - Auto-detects devicePixelRatio (retina displays).
 * - Pauses automatically when out of viewport or when tab is hidden (battery friendly).
 * - Respects `prefers-reduced-motion`.
 */

export interface SignalGridProps {
  color?: string
  background?: string
  speed?: number
  anchor?: 'left' | 'right' | 'center'
  density?: number
  squareSize?: number
  gridStep?: number
  opacity?: number
  className?: string
}

function pseudoHash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function resolveColor(canvas: HTMLCanvasElement, colorStr: string): string {
  if (!colorStr.startsWith('var(')) return colorStr
  const varName = colorStr.slice(4, -1).trim()
  return getComputedStyle(canvas).getPropertyValue(varName).trim() || '#38bdf8'
}

export function SignalGrid({
  color = '#38bdf8',
  background = 'transparent',
  speed = 0.6,
  anchor = 'left',
  gridStep = 18,
  squareSize = 8,
  opacity = 0.5,
  className = '',
}: SignalGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const draw = useMemo(() => {
    let resolvedColor = ''
    let resolvedBg = ''

    return (ctx: CanvasRenderingContext2D, width: number, height: number, timeSeconds: number) => {
      if (!resolvedColor && canvasRef.current) {
        resolvedColor = resolveColor(canvasRef.current, color)
        resolvedBg = background === 'transparent' ? 'transparent' : resolveColor(canvasRef.current, background)
      }

      const activeColor = resolvedColor || color

      if (resolvedBg && resolvedBg !== 'transparent') {
        ctx.fillStyle = resolvedBg
        ctx.fillRect(0, 0, width, height)
      } else {
        ctx.clearRect(0, 0, width, height)
      }

      ctx.fillStyle = activeColor
      const t = timeSeconds * speed
      const u = gridStep
      const d = squareSize
      const cols = Math.ceil(width / u)
      const rows = Math.ceil(height / u)

      for (let s = 0; s < rows; s++) {
        for (let v = 0; v < cols; v++) {
          const w = pseudoHash(v, s)
          const posX = v * u + u / 2

          let fadeFactor: number
          if (anchor === 'left') {
            fadeFactor = 1 - posX / width
          } else if (anchor === 'right') {
            fadeFactor = posX / width
          } else {
            // center
            fadeFactor = 1 - Math.abs(posX - width / 2) / (width / 2)
          }

          // Cutoff threshold based on anchor density
          if (w > Math.max(0.08, fadeFactor * 0.94)) continue

          const period = 1.6 + pseudoHash(s, v) * 3
          const wave = 0.5 + 0.5 * Math.sin((t * Math.PI * 2) / period + w * Math.PI * 2)
          const pulse = Math.pow(wave, 3)

          const cellAlpha = (0.05 + 0.95 * pulse * (0.3 + 0.7 * fadeFactor)) * opacity
          ctx.globalAlpha = Math.min(1, Math.max(0, cellAlpha))
          ctx.fillRect(posX - d / 2, s * u + (u - d) / 2, d, d)
        }
      }

      ctx.globalAlpha = 1
    }
  }, [color, background, speed, anchor, gridStep, squareSize, opacity])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    let clientW = 0
    let clientH = 0
    let rafId = 0
    let isVisible = true
    const startTime = performance.now()

    const render = () => {
      const elapsed = (performance.now() - startTime) / 1000
      draw(ctx, clientW, clientH, elapsed)
      rafId = requestAnimationFrame(render)
    }

    const startLoop = () => {
      if (reducedMotion || rafId || !isVisible || document.hidden) return
      rafId = requestAnimationFrame(render)
    }

    const stopLoop = () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
    }

    const resize = () => {
      clientW = canvas.clientWidth
      clientH = canvas.clientHeight
      if (clientW === 0 || clientH === 0) return
      canvas.width = Math.round(clientW * dpr)
      canvas.height = Math.round(clientH * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(ctx, clientW, clientH, reducedMotion ? 2.5 : (performance.now() - startTime) / 1000)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const io = new IntersectionObserver(([entry]) => {
      isVisible = entry?.isIntersecting ?? true
      if (isVisible) startLoop()
      else stopLoop()
    })
    io.observe(canvas)

    const onVisibility = () => {
      if (document.hidden) stopLoop()
      else startLoop()
    }
    document.addEventListener('visibilitychange', onVisibility)
    startLoop()

    return () => {
      stopLoop()
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 size-full ${className}`}
    />
  )
}
