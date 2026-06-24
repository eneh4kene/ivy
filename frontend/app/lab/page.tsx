'use client'

/**
 * /lab — DESIGN PROTOTYPE (not wired to anything).
 *
 * "Arcade HUD" direction: pure-black canvas, neon edges, glass panels, segmented
 * LED numerals, crisp grid. The daily stake loop reframed as an arcade game —
 * stake = credits on the line, streak = combo, the week = a level track, arming
 * = the action button. Tap ARM to see it react. Fully self-contained: mock data,
 * scoped styles, zero imports from the real design system.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const TOTAL_DAYS = 7
const COMPLETED = 3

export default function Lab() {
  const [armed, setArmed] = useState(false)
  const [combo, setCombo] = useState(3)

  const secured = COMPLETED + (armed ? 1 : 0)
  const progress = secured / TOTAL_DAYS

  const R = 78
  const C = 2 * Math.PI * R

  const arm = () => {
    if (armed) return
    setArmed(true)
    setCombo((c) => c + 1)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([8, 30, 14])
  }

  return (
    <div className="lab-root">
      <div className="lab-grid" />
      <div className="lab-scan" />
      <div className="lab-vignette" />

      <main className="lab-shell">
        {/* ── HUD top bar ── */}
        <header className="hud-bar">
          <span className="hud-brand">IVY</span>
          <span className="hud-mid neon-dim">DAY 04 · WK 1</span>
          <span className="hud-credits glass">
            <span className="neon-mag">●</span> £7&nbsp;<i>STAKED</i>
          </span>
        </header>

        {/* ── Central gauge ── */}
        <section className="gauge-wrap">
          <svg viewBox="0 0 200 200" className="gauge">
            {/* track */}
            <circle cx="100" cy="100" r={R} className="ring-track" />
            {/* progress */}
            <motion.circle
              cx="100" cy="100" r={R}
              className={armed ? 'ring-fill lime' : 'ring-fill mag'}
              strokeDasharray={C}
              strokeLinecap="round"
              initial={false}
              animate={{ strokeDashoffset: C * (1 - progress) }}
              transition={{ type: 'spring', stiffness: 90, damping: 18 }}
              transform="rotate(-90 100 100)"
            />
            {/* tick marks */}
            {Array.from({ length: TOTAL_DAYS }).map((_, i) => {
              const a = (i / TOTAL_DAYS) * 2 * Math.PI - Math.PI / 2
              const x1 = 100 + Math.cos(a) * (R + 10)
              const y1 = 100 + Math.sin(a) * (R + 10)
              const x2 = 100 + Math.cos(a) * (R + 15)
              const y2 = 100 + Math.sin(a) * (R + 15)
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={i < secured ? 'tick on' : 'tick'} />
            })}
          </svg>

          <div className="gauge-center">
            <div className="led-amount">
              <span className="led-cur">£</span>7
            </div>
            <div className="led-label neon-dim">{armed ? 'SECURED TODAY' : 'ON THE LINE'}</div>
            <AnimatePresence mode="wait">
              <motion.div
                key={armed ? 'a' : 'u'}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className={armed ? 'state-chip armed' : 'state-chip unarmed'}
              >
                {armed ? '◉ ARMED' : '○ UNARMED'}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* ── Combo ── */}
        <div className="combo">
          <span className="combo-label neon-dim">COMBO</span>
          <motion.span
            key={combo}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="combo-val neon-lime"
          >
            ×{combo}
          </motion.span>
          <span className="combo-flames">{'▮'.repeat(Math.min(combo, 6))}</span>
        </div>

        {/* ── Level track (the week) ── */}
        <div className="track glass">
          <div className="track-head">
            <span className="neon-dim">LEVEL 1 · THE WEEK</span>
            <span className="neon-dim">{secured}/{TOTAL_DAYS}</span>
          </div>
          <div className="track-cells">
            {Array.from({ length: TOTAL_DAYS }).map((_, i) => {
              const cls =
                i < COMPLETED ? 'cell done' :
                i === COMPLETED ? (armed ? 'cell done' : 'cell now') :
                'cell'
              return <span key={i} className={cls} />
            })}
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="stats">
          {[['STREAK', `${combo}d`], ['BEST', '9d'], ['LEFT', `${TOTAL_DAYS - secured}d`]].map(([k, v]) => (
            <div key={k} className="stat glass">
              <div className="stat-k neon-dim">{k}</div>
              <div className="stat-v">{v}</div>
            </div>
          ))}
        </div>

        {/* ── Action button ── */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={arm}
          disabled={armed}
          className={armed ? 'action done' : 'action'}
        >
          <span className="action-glow" />
          {armed ? '✓  LOCKED IN — SEE YOU TOMORROW' : '▸  ARM TODAY · SEND VOICE NOTE'}
        </motion.button>

        <p className="hint">prototype · tap ARM to play it</p>
      </main>

      {/* ── scoped styles ── */}
      <style jsx>{`
        .lab-root {
          position: fixed; inset: 0; overflow-y: auto;
          background: #04050a; color: #eaf2ff;
          font-family: 'DM Mono', ui-monospace, monospace;
          -webkit-font-smoothing: antialiased;
        }
        .lab-grid {
          position: fixed; inset: 0; pointer-events: none; opacity: .5;
          background-image:
            linear-gradient(rgba(39,232,255,.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(39,232,255,.05) 1px, transparent 1px);
          background-size: 36px 36px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 35%, #000 30%, transparent 80%);
        }
        .lab-scan {
          position: fixed; inset: 0; pointer-events: none; opacity: .35; mix-blend-mode: overlay;
          background: repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0 1px, transparent 1px 3px);
          animation: scan 7s linear infinite;
        }
        @keyframes scan { from { background-position: 0 0; } to { background-position: 0 120px; } }
        .lab-vignette {
          position: fixed; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse 70% 70% at 50% 30%, transparent 40%, rgba(0,0,0,.7) 100%);
        }

        .lab-shell {
          position: relative; z-index: 1;
          max-width: 24rem; margin: 0 auto;
          padding: 1.5rem 1.25rem 3rem;
          display: flex; flex-direction: column; gap: 1.5rem;
        }

        /* HUD bar */
        .hud-bar { display: flex; align-items: center; justify-content: space-between; }
        .hud-brand {
          font-weight: 700; letter-spacing: .35em; font-size: .9rem;
          color: #27e8ff; text-shadow: 0 0 10px rgba(39,232,255,.7);
        }
        .hud-mid { font-size: .62rem; letter-spacing: .2em; }
        .hud-credits {
          font-size: .62rem; letter-spacing: .12em; padding: .35rem .6rem; border-radius: .6rem;
          display: inline-flex; align-items: center;
        }
        .hud-credits i { font-style: normal; opacity: .55; }

        /* glass */
        .glass {
          background: rgba(255,255,255,.035);
          backdrop-filter: blur(14px) saturate(140%);
          -webkit-backdrop-filter: blur(14px) saturate(140%);
          border: 1px solid rgba(255,255,255,.09);
        }

        /* neon helpers */
        .neon-dim { color: rgba(180,200,225,.5); }
        .neon-lime { color: #c6ff44; text-shadow: 0 0 10px rgba(198,255,68,.65); }
        .neon-mag  { color: #ff3b78; text-shadow: 0 0 10px rgba(255,59,120,.7); }

        /* gauge */
        .gauge-wrap { position: relative; width: 100%; aspect-ratio: 1; max-width: 19rem; margin: .25rem auto 0; }
        .gauge { width: 100%; height: 100%; }
        .ring-track { fill: none; stroke: rgba(255,255,255,.06); stroke-width: 6; }
        .ring-fill { fill: none; stroke-width: 7; }
        .ring-fill.mag  { stroke: #ff3b78; filter: drop-shadow(0 0 8px rgba(255,59,120,.8)); }
        .ring-fill.lime { stroke: #c6ff44; filter: drop-shadow(0 0 9px rgba(198,255,68,.85)); }
        .tick { stroke: rgba(255,255,255,.18); stroke-width: 2; }
        .tick.on { stroke: #c6ff44; stroke-width: 3; filter: drop-shadow(0 0 5px rgba(198,255,68,.9)); }

        .gauge-center {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: .35rem;
        }
        .led-amount {
          font-size: 4rem; font-weight: 700; line-height: 1; letter-spacing: .02em;
          color: #fff; text-shadow: 0 0 18px rgba(39,232,255,.45); font-variant-numeric: tabular-nums;
        }
        .led-cur { font-size: 2rem; vertical-align: super; opacity: .8; }
        .led-label { font-size: .62rem; letter-spacing: .28em; }
        .state-chip {
          margin-top: .15rem; font-size: .6rem; letter-spacing: .2em; padding: .25rem .7rem;
          border-radius: 999px; border: 1px solid;
        }
        .state-chip.unarmed { color: #ff3b78; border-color: rgba(255,59,120,.4); text-shadow: 0 0 8px rgba(255,59,120,.5); }
        .state-chip.armed   { color: #c6ff44; border-color: rgba(198,255,68,.45); text-shadow: 0 0 8px rgba(198,255,68,.6); }

        /* combo */
        .combo { display: flex; align-items: baseline; justify-content: center; gap: .6rem; }
        .combo-label { font-size: .6rem; letter-spacing: .3em; }
        .combo-val { font-size: 1.6rem; font-weight: 700; }
        .combo-flames { color: #ff8a3b; letter-spacing: -2px; text-shadow: 0 0 8px rgba(255,138,59,.6); font-size: .8rem; }

        /* level track */
        .track { border-radius: 1rem; padding: .85rem 1rem; }
        .track-head { display: flex; justify-content: space-between; font-size: .56rem; letter-spacing: .22em; margin-bottom: .6rem; }
        .track-cells { display: grid; grid-template-columns: repeat(7, 1fr); gap: .35rem; }
        .cell { height: .7rem; border-radius: .25rem; background: rgba(255,255,255,.08); }
        .cell.done { background: #c6ff44; box-shadow: 0 0 10px rgba(198,255,68,.7); }
        .cell.now {
          background: #27e8ff; box-shadow: 0 0 12px rgba(39,232,255,.9);
          animation: blink 1.1s steps(2, jump-none) infinite;
        }
        @keyframes blink { 50% { opacity: .35; } }

        /* stats */
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: .6rem; }
        .stat { border-radius: .8rem; padding: .6rem; text-align: center; }
        .stat-k { font-size: .52rem; letter-spacing: .22em; margin-bottom: .25rem; }
        .stat-v { font-size: 1.05rem; font-weight: 700; color: #eaf2ff; }

        /* action */
        .action {
          position: relative; overflow: hidden; width: 100%;
          padding: 1.05rem; border-radius: 1rem; font-weight: 700;
          font-size: .8rem; letter-spacing: .12em; cursor: pointer;
          color: #04050a; background: #27e8ff; border: none;
          box-shadow: 0 0 24px rgba(39,232,255,.55), inset 0 0 0 1px rgba(255,255,255,.3);
        }
        .action-glow {
          position: absolute; inset: 0;
          background: linear-gradient(110deg, transparent 20%, rgba(255,255,255,.55) 50%, transparent 80%);
          transform: translateX(-120%); animation: sheen 3.2s ease-in-out infinite;
        }
        @keyframes sheen { 0%,60% { transform: translateX(-120%); } 100% { transform: translateX(120%); } }
        .action.done {
          color: #c6ff44; background: rgba(198,255,68,.07);
          border: 1px solid rgba(198,255,68,.45); box-shadow: 0 0 18px rgba(198,255,68,.25);
          cursor: default;
        }
        .action.done .action-glow { display: none; }

        .hint { align-self: center; display: inline-flex; align-items: center; gap: .4rem;
          font-size: .56rem; letter-spacing: .22em; color: rgba(200,216,238,.55);
          padding: .3rem .7rem; border-radius: 999px; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.025); }
        .hint::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: #27e8ff; box-shadow: 0 0 6px rgba(39,232,255,.7); }
      `}</style>
    </div>
  )
}
