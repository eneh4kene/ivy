'use client'

/**
 * LivingForm — the signature of the Ivy "Living Streak" language.
 *
 * A generative, luminous organism drawn on a single <canvas>. It is not
 * decoration: its geometry is grown from the user's real follow-through.
 *
 *   • daysKept     → height of the stalk + number of living leaves it carries
 *   • daysForfeited→ the lowest leaves brown and droop (visible scars)
 *   • state        → the crown bloom is closed when asleep, half-open when
 *                    armed, and flares fully open while you speak / on bloom
 *   • intensity    → live microphone level (0..1) sways the form and makes the
 *                    bloom flare + cast rising motes, so your VOICE visibly
 *                    grows the thing you don't want to lose
 *   • seed         → deterministic per user, so everyone's form is unique but
 *                    stable across sessions
 *
 * Respects prefers-reduced-motion (renders a calm static frame) and pauses
 * when the tab is hidden.
 */

import { useEffect, useRef } from 'react'

export type LivingState = 'asleep' | 'armed' | 'speaking' | 'bloom'

export interface LivingFormProps {
  daysKept: number
  daysForfeited?: number
  state?: LivingState
  /** Live voice level 0..1 (only meaningful while state === 'speaking'). */
  intensity?: number
  /** Deterministic per-user seed. */
  seed?: number
  palette?: 'dawn' | 'dusk'
  /** Overall complexity/scale, 0..1. Use ~0.7 for compact placements. */
  detail?: number
  className?: string
  style?: React.CSSProperties
}

/* ── Deterministic PRNG ───────────────────────────────────────────────────── */
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Hash an arbitrary string (e.g. user id) into a stable 32-bit seed. */
export function hashSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

interface Leaf {
  t: number        // 0..1 position along the stalk
  side: 1 | -1
  len: number      // leaf length (normalized)
  droop: number    // 0 healthy .. 1 fully wilted
  forfeit: boolean
  phase: number    // animation phase offset
}

interface Skeleton {
  stalk: { x: number; y: number }[]   // normalized: x[-1..1], y[0..1] (0 = base)
  leaves: Leaf[]
  crown: { x: number; y: number }     // top of stalk
  petals: number
  curve: number
}

function buildSkeleton(seed: number, kept: number, forfeits: number): Skeleton {
  const rnd = mulberry32(seed)
  const growth = Math.max(0, kept)
  // Height grows quickly at first, then gently — a young plant shoots up,
  // a mature one mostly thickens. Caps so it always fits the frame.
  const height = 0.40 + Math.min(0.5, Math.log2(growth + 1) * 0.11)
  const curve = (rnd() - 0.5) * 0.5            // overall lean
  const sCurve = (rnd() - 0.5) * 0.34          // gentle S

  const segs = 22
  const stalk: { x: number; y: number }[] = []
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    // quadratic-ish bend + a soft S
    const x = curve * t * t + sCurve * Math.sin(t * Math.PI)
    const y = t * height
    stalk.push({ x, y })
  }
  const crown = stalk[stalk.length - 1]

  // Leaves: one per kept day, alternating, capped for legibility. Earliest
  // (lowest t) are the oldest; the lowest `forfeits` of them are scarred.
  const leafCount = Math.min(Math.max(growth, 0), 16)
  const leaves: Leaf[] = []
  for (let i = 0; i < leafCount; i++) {
    const t = 0.16 + (i / Math.max(1, leafCount)) * 0.78 + (rnd() - 0.5) * 0.03
    const side: 1 | -1 = i % 2 === 0 ? 1 : -1
    const len = 0.16 + rnd() * 0.12 + t * 0.05
    leaves.push({
      t: Math.min(0.97, t),
      side,
      len,
      droop: 0,
      forfeit: i < forfeits,
      phase: rnd() * Math.PI * 2,
    })
  }
  // Scarred leaves droop hard.
  for (const lf of leaves) if (lf.forfeit) lf.droop = 0.7 + rnd() * 0.25

  const petals = 5 + Math.floor(rnd() * 3)   // 5..7
  return { stalk, leaves, crown, petals, curve }
}

/* ── Palettes (arcade-neon) ───────────────────────────────────────────────────
   Re-tuned from the original warm "Dawn" palette to the shipped arcade system:
   cyan structure, lime chlorophyll (days kept), magenta scars (days forfeited),
   cyan/amber bloom (your live commitment), cyan/amber motes. */
const PALETTES = {
  // Daytime ritual — cyan bloom, the primary/action accent.
  dawn: {
    stalkA: 'rgba(34, 96, 122, 0.9)',     // deep cyan-steel base
    stalkB: 'rgba(39, 232, 255, 0.92)',   // neon cyan toward the crown
    leaf:   '198, 255, 68',               // lime chlorophyll = a day kept
    leafGlow: 'rgba(198, 255, 68, 0.55)',
    bloom:  '39, 232, 255',               // neon cyan commitment
    bloomLight: '186, 250, 255',
    scar:   '255, 59, 120',               // magenta = a day forfeited
    mote:   '150, 240, 255',
  },
  // Evening reflection — amber bloom to warm the close of the day.
  dusk: {
    stalkA: 'rgba(40, 90, 110, 0.9)',
    stalkB: 'rgba(39, 200, 232, 0.92)',
    leaf:   '198, 255, 68',
    leafGlow: 'rgba(198, 255, 68, 0.5)',
    bloom:  '255, 138, 59',               // arcade amber
    bloomLight: '255, 210, 150',
    scar:   '255, 59, 120',
    mote:   '255, 188, 120',
  },
}

const STATE_OPENNESS: Record<LivingState, number> = {
  asleep: 0.12,
  armed: 0.62,
  speaking: 1,
  bloom: 1,
}

export function LivingForm({
  daysKept,
  daysForfeited = 0,
  state = 'asleep',
  intensity = 0,
  seed = 1,
  palette = 'dawn',
  detail = 1,
  className = '',
  style,
}: LivingFormProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Live props mirror so the RAF loop never restarts on prop change.
  const props = useRef({ daysKept, daysForfeited, state, intensity, seed, palette, detail })
  props.current = { daysKept, daysForfeited, state, intensity, seed, palette, detail }

  // Rebuild geometry only when the structural inputs change.
  const skeleton = useRef<Skeleton>(buildSkeleton(seed, daysKept, daysForfeited))
  useEffect(() => {
    skeleton.current = buildSkeleton(seed, daysKept, daysForfeited)
  }, [seed, daysKept, daysForfeited])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    let W = 0, H = 0, dpr = 1
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = rect.width; H = rect.height
      canvas.width = Math.max(1, Math.floor(W * dpr))
      canvas.height = Math.max(1, Math.floor(H * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // Eased animated values
    let openEased = STATE_OPENNESS[props.current.state]
    let levelEased = 0
    const motes: { x: number; y: number; vy: number; vx: number; life: number; max: number; r: number }[] = []

    let raf = 0
    let last = performance.now()

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = now / 1000
      const p = props.current
      const pal = PALETTES[p.palette]
      const sk = skeleton.current
      const d = p.detail

      // Ease state + level
      const openTarget = STATE_OPENNESS[p.state]
      openEased += (openTarget - openEased) * Math.min(1, dt * 4)
      const levelTarget = p.state === 'speaking' ? Math.max(0, Math.min(1, p.intensity)) : 0
      levelEased += (levelTarget - levelEased) * Math.min(1, dt * 6)

      ctx.clearRect(0, 0, W, H)

      // Geometry transform
      const baseX = W * 0.5
      const baseY = H * 0.95
      const scale = Math.min(W, H) * 0.5 * d
      const reach = scale * 1.36
      const vReach = H * 0.86 // vertical space the plant climbs through
      const swayAmp = (reduce ? 0 : 1) * (0.018 + levelEased * 0.05) * W
      const breathe = reduce ? 1 : 1 + Math.sin(t * 1.1) * 0.012 + levelEased * 0.02

      // map normalized (nx, ny) -> screen, with sway increasing toward the top
      const map = (nx: number, ny: number) => {
        const sway = Math.sin(t * 0.7 + ny * 2.2) * swayAmp * Math.pow(ny, 1.25)
        return {
          x: baseX + nx * reach * 0.62 * breathe + sway,
          y: baseY - ny * vReach * breathe,
        }
      }

      // ── Ground glow / roots ──
      const groundGlow = ctx.createRadialGradient(baseX, baseY, 0, baseX, baseY, scale * 0.9)
      groundGlow.addColorStop(0, `rgba(${pal.bloom}, ${0.16 + levelEased * 0.18})`)
      groundGlow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = groundGlow
      ctx.beginPath()
      ctx.ellipse(baseX, baseY, scale * 0.82, scale * 0.18, 0, 0, Math.PI * 2)
      ctx.fill()

      // ── Stalk ──
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      const grad = ctx.createLinearGradient(baseX, baseY, baseX, baseY - H * 0.7)
      grad.addColorStop(0, pal.stalkA)
      grad.addColorStop(1, pal.stalkB)
      ctx.strokeStyle = grad
      ctx.shadowBlur = 14
      ctx.shadowColor = `rgba(${pal.bloom}, 0.35)`
      // taper: draw a few passes from thick base to thin crown
      const passes = 5
      for (let pi = passes; pi >= 1; pi--) {
        ctx.beginPath()
        for (let i = 0; i < sk.stalk.length; i++) {
          const tt = i / (sk.stalk.length - 1)
          const wMul = (1 - tt) // thicker near base
          const pt = map(sk.stalk[i].x, sk.stalk[i].y)
          if (i === 0) ctx.moveTo(pt.x, pt.y)
          else ctx.lineTo(pt.x, pt.y)
          ctx.lineWidth = (2 + wMul * 7) * d * (pi / passes)
        }
        ctx.globalAlpha = pi === passes ? 0.9 : 0.18
        ctx.lineWidth = (1.5 + 6 * 1) * d * (pi / passes)
        ctx.stroke()
      }
      ctx.restore()

      // ── Leaves ──
      const stalkAt = (tt: number) => {
        const idx = Math.min(sk.stalk.length - 1, Math.max(0, tt * (sk.stalk.length - 1)))
        const i0 = Math.floor(idx), i1 = Math.min(sk.stalk.length - 1, i0 + 1)
        const f = idx - i0
        const a = sk.stalk[i0], b = sk.stalk[i1]
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
      }

      for (const lf of sk.leaves) {
        const root = stalkAt(lf.t)
        const r = map(root.x, root.y)
        const wind = reduce ? 0 : Math.sin(t * 1.3 + lf.phase) * (0.05 + levelEased * 0.12)
        // healthy leaves lift toward the light; scarred leaves droop down
        const baseAngle = lf.side === 1 ? -0.5 : -Math.PI + 0.5
        const droopAngle = lf.droop * 1.5 * lf.side
        const ang = baseAngle - 0.5 + wind + droopAngle + (lf.side === -1 ? 0.0 : 0.0)
        const len = lf.len * reach * 0.6 * (lf.forfeit ? 0.8 : 1)
        const tipX = r.x + Math.cos(ang) * len * lf.side * -1 // direction
        // Simpler: compute tip from side explicitly
        const dir = lf.side
        const lift = lf.forfeit ? -0.9 : 0.5 + wind  // up vs down
        const tx = r.x + dir * len * 0.85
        const ty = r.y - len * lift
        const cx1 = r.x + dir * len * 0.3
        const cy1 = r.y - len * (lift + 0.5)
        const cx2 = r.x + dir * len * 0.95
        const cy2 = r.y - len * (lift - 0.1)

        const col = lf.forfeit ? pal.scar : pal.leaf
        const alpha = lf.forfeit ? 0.5 : 0.85
        ctx.save()
        ctx.shadowBlur = lf.forfeit ? 4 : 12
        ctx.shadowColor = lf.forfeit ? `rgba(${pal.scar},0.4)` : pal.leafGlow
        // teardrop via two quads
        ctx.beginPath()
        ctx.moveTo(r.x, r.y)
        ctx.quadraticCurveTo(cx1, cy1, tx, ty)
        ctx.quadraticCurveTo(cx2, cy2, r.x, r.y)
        const lg = ctx.createLinearGradient(r.x, r.y, tx, ty)
        lg.addColorStop(0, `rgba(${col}, ${alpha})`)
        lg.addColorStop(1, `rgba(${col}, ${alpha * 0.25})`)
        ctx.fillStyle = lg
        ctx.fill()
        // glowing node at the leaf's attachment (a "day kept")
        if (!lf.forfeit) {
          ctx.shadowBlur = 10
          ctx.shadowColor = `rgba(${pal.bloom}, 0.7)`
          ctx.fillStyle = `rgba(${pal.bloomLight}, 0.95)`
          ctx.beginPath()
          ctx.arc(r.x, r.y, 1.8 * d, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
        // silence unused warning for the alt tip computation
        void tipX
      }

      // ── Crown bloom ──
      const c = map(sk.crown.x, sk.crown.y)
      const open = openEased
      const flare = 1 + levelEased * 0.45 + (p.state === 'bloom' ? 0.2 : 0)
      const petalLen = (0.10 + open * 0.16) * reach * 0.7 * flare
      ctx.save()
      ctx.translate(c.x, c.y)
      ctx.shadowBlur = 18 + levelEased * 26
      ctx.shadowColor = `rgba(${pal.bloom}, ${0.5 + levelEased * 0.4})`
      const spin = reduce ? 0 : t * 0.12
      for (let i = 0; i < sk.petals; i++) {
        const a = (i / sk.petals) * Math.PI * 2 + spin
        const px = Math.cos(a) * petalLen
        const py = Math.sin(a) * petalLen - open * 4
        const c1x = Math.cos(a - 0.3) * petalLen * 0.5
        const c1y = Math.sin(a - 0.3) * petalLen * 0.5
        const c2x = Math.cos(a + 0.3) * petalLen * 0.5
        const c2y = Math.sin(a + 0.3) * petalLen * 0.5
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.quadraticCurveTo(c1x, c1y, px, py)
        ctx.quadraticCurveTo(c2x, c2y, 0, 0)
        const pg = ctx.createRadialGradient(0, 0, 0, px, py, petalLen)
        pg.addColorStop(0, `rgba(${pal.bloomLight}, ${0.5 + open * 0.4})`)
        pg.addColorStop(1, `rgba(${pal.bloom}, ${0.08})`)
        ctx.fillStyle = pg
        ctx.fill()
      }
      // bright core
      const coreR = (3 + open * 5 + levelEased * 4) * d
      const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 3)
      cg.addColorStop(0, `rgba(${pal.bloomLight}, ${0.95})`)
      cg.addColorStop(0.4, `rgba(${pal.bloom}, 0.8)`)
      cg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = cg
      ctx.beginPath()
      ctx.arc(0, 0, coreR * 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      // ── Motes (rise from the bloom while alive/speaking) ──
      const spawn = p.state === 'speaking' ? 2 + Math.floor(levelEased * 4) : p.state === 'bloom' ? 1 : 0
      if (!reduce) {
        for (let s = 0; s < spawn && motes.length < 46; s++) {
          motes.push({
            x: c.x + (Math.random() - 0.5) * petalLen,
            y: c.y + (Math.random() - 0.5) * petalLen,
            vx: (Math.random() - 0.5) * 8,
            vy: -18 - Math.random() * 30 - levelEased * 30,
            life: 0, max: 1.4 + Math.random() * 1.4,
            r: (0.8 + Math.random() * 1.8) * d,
          })
        }
      }
      for (let i = motes.length - 1; i >= 0; i--) {
        const m = motes[i]
        m.life += dt
        if (m.life >= m.max) { motes.splice(i, 1); continue }
        m.x += m.vx * dt
        m.y += m.vy * dt
        m.vy += 6 * dt // slight deceleration upward
        const lifeP = m.life / m.max
        const a = Math.sin(lifeP * Math.PI) * 0.85
        ctx.save()
        ctx.shadowBlur = 8
        ctx.shadowColor = `rgba(${pal.mote}, ${a})`
        ctx.fillStyle = `rgba(${pal.mote}, ${a})`
        ctx.beginPath()
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      raf = requestAnimationFrame(draw)
    }

    let visible = true
    const onVis = () => {
      visible = !document.hidden
      if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(draw) }
      else if (!visible && raf) { cancelAnimationFrame(raf); raf = 0 }
    }
    document.addEventListener('visibilitychange', onVis)
    raf = requestAnimationFrame(draw)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', ...style }}
      aria-hidden="true"
    />
  )
}
