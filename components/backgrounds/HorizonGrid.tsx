'use client'

import React, { useEffect, useRef, useMemo } from 'react'

/**
 * HorizonGrid (`/17 Horizon Grid` inspired by getdesign.md/backgrounds)
 * 
 * An endless architectural floor grid receding toward a luminous horizon line.
 * Ideal for structured industrial compliance and enterprise systems.
 * 
 * Engineered with pure HTML5 Canvas 2D:
 * - Exponential perspective distortion `pow(v, 2.4)`.
 * - Soft horizon gradient glow and subtle transverse strokes.
 * - Auto-detects devicePixelRatio and respects `prefers-reduced-motion`.
 * - Zero external WebGL dependencies.
 */

export interface HorizonGridProps {
  color?: string
  background?: string
  speed?: number
  horizonRatio?: number
  opacity?: number
  className?: string
}

function resolveColor(canvas: HTMLCanvasElement, colorStr: string): string {
  if (!colorStr.startsWith('var(')) return colorStr
  const varName = colorStr.slice(4, -1).trim()
  return getComputedStyle(canvas).getPropertyValue(varName).trim() || '#38bdf8'
}

export function HorizonGrid({
  color = '#38bdf8',
  background = 'transparent',
  speed = 0.5,
  horizonRatio = 0.42,
  opacity = 0.5,
  className = '',
}: HorizonGridProps) {
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

      const t = timeSeconds * speed
      const horizonY = height * horizonRatio
      const centerX = width / 2

      ctx.strokeStyle = activeColor
      ctx.lineWidth = 1

      // 1. Horizon Soft Glow
      const glowHeight = Math.min(60, horizonY * 0.7)
      const grad = ctx.createLinearGradient(0, horizonY - glowHeight, 0, horizonY)
      grad.addColorStop(0, 'transparent')
      grad.addColorStop(1, activeColor)

      ctx.save()
      ctx.globalAlpha = 0.22 * opacity
      ctx.fillStyle = grad
      ctx.fillRect(0, horizonY - glowHeight, width, glowHeight)
      ctx.restore()

      // 2. Horizon Line
      ctx.globalAlpha = 0.75 * opacity
      ctx.beginPath()
      ctx.moveTo(0, horizonY)
      ctx.lineTo(width, horizonY)
      ctx.stroke()

      // 3. Perspective Perspective Fan Lines radiating from vanishing point
      const fanCount = 12
      for (let s = -fanCount; s <= fanCount; s++) {
        const spreadFactor = 1 - Math.abs(s) / (fanCount + 1)
        ctx.globalAlpha = (0.08 + 0.35 * spreadFactor) * opacity
        ctx.beginPath()
        ctx.moveTo(centerX, horizonY)
        // Project outward toward bottom
        ctx.lineTo(centerX + (s * width * 0.12), height + 10)
        ctx.stroke()
      }

      // 4. Moving Transverse Grid Lines scrolling forward
      const numLines = 14
      const scrollOffset = (t * 0.45) % 1

      for (let i = 1; i <= numLines; i++) {
        const progress = (i - 1 + scrollOffset) / numLines
        const lineY = horizonY + (height - horizonY) * Math.pow(progress, 2.3)
        ctx.globalAlpha = (0.08 + 0.8 * progress) * opacity
        ctx.beginPath()
        ctx.moveTo(0, lineY)
        ctx.lineTo(width, lineY)
        ctx.stroke()
      }

      ctx.globalAlpha = 1
    }
  }, [color, background, speed, horizonRatio, opacity])

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
