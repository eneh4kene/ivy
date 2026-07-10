'use client'

/**
 * HeroVideoBackdrop — ambient video behind a marketing hero, fading into the
 * dark theme so the copy stays the star.
 *
 * Multiple sources crossfade on a slow cycle (the consumer hero rotates all
 * four tracks: fitness → focus → sleep → balance); a single source just loops.
 * Non-active videos are paused to keep CPU/battery sane. Users with
 * prefers-reduced-motion or Data Saver get no video at all — the existing
 * radial-glow hero background remains underneath.
 *
 * Footage: Pexels (free for commercial use, no attribution required).
 * fitness 34997644 · focus 6931296 · balance 10631941 · sleep 11533575 ·
 * coach 35585619 — self-hosted in /public/videos at 720p.
 */

import { useEffect, useRef, useState } from 'react'

const FADE_MS = 1800
const CYCLE_MS = 9000

export function HeroVideoBackdrop({ sources }: { sources: string[] }) {
  const [enabled, setEnabled] = useState(false)
  const [active, setActive] = useState(0)
  const refs = useRef<(HTMLVideoElement | null)[]>([])

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const saveData = (navigator as any).connection?.saveData === true
    if (!reduced && !saveData) setEnabled(true)
  }, [])

  // Play the active video, pause the rest once their fade-out has finished.
  useEffect(() => {
    if (!enabled) return
    refs.current[active]?.play().catch(() => {})
    const t = setTimeout(() => {
      refs.current.forEach((v, i) => { if (v && i !== active) v.pause() })
    }, FADE_MS)
    return () => clearTimeout(t)
  }, [enabled, active])

  // Slow rotation — only when there's something to rotate to.
  useEffect(() => {
    if (!enabled || sources.length < 2) return
    const id = setInterval(() => setActive((a) => (a + 1) % sources.length), CYCLE_MS)
    return () => clearInterval(id)
  }, [enabled, sources.length])

  if (!enabled) return null

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {sources.map((src, i) => (
        <video
          key={src}
          ref={(el) => { refs.current[i] = el }}
          src={src}
          muted
          loop
          playsInline
          preload={i === 0 ? 'auto' : 'metadata'}
          className="absolute inset-0 h-full w-full object-cover transition-opacity ease-in-out"
          style={{ opacity: i === active ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
        />
      ))}
      {/* Fade the footage into the theme: a steady dark wash for copy
          contrast, then dissolve to the page background at the edges. */}
      <div className="absolute inset-0 bg-ink-900/70" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink-900 via-transparent to-ink-900" />
    </div>
  )
}
