'use client'

/**
 * /lab/circle — DESIGN PROTOTYPE (not wired to anything).
 *
 * Arcade leaderboard for a Circle. Same "arcade HUD" language as /lab, pushed
 * further + made to feel alive: live event ticker, count-up pot, podium bars
 * that rise on entry, score bars that fill, a blinking LIVE badge, and a roaming
 * "activity" pulse that hops between players. Mock data, scoped styles, zero
 * imports from the real design system.
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const POT_TARGET = 462

const PODIUM = [
  { rank: 2, name: 'KENE', tag: 'YOU', combo: 7, kept: 84, h: 116, color: 'cyan', av: 'K', you: true },
  { rank: 1, name: 'MAYA', combo: 11, kept: 132, h: 152, color: 'gold', av: 'M', crown: true },
  { rank: 3, name: 'DARA', combo: 6, kept: 96, h: 96, color: 'lime', av: 'D' },
]

const LIST = [
  { rank: 4, name: 'SAM',   combo: 5, kept: 70, score: 64, delta: 1,  av: 'S' },
  { rank: 5, name: 'PRIYA', combo: 3, kept: 48, score: 49, delta: -1, av: 'P' },
  { rank: 6, name: 'LEO',   combo: 2, kept: 28, score: 33, delta: 2,  av: 'L' },
  { rank: 7, name: 'NINA',  combo: 0, kept: 0,  score: 14, delta: -2, av: 'N', risk: true },
]

const EVENTS = [
  'MAYA kept day 11 — combo ×11', 'KENE armed today', 'DARA forfeited £14 → charity',
  'LEO climbed to #6 ▲2', 'SAM kept day 5', 'NINA at risk — unarmed', 'PRIYA armed today',
]

const ALL_NAMES = [...PODIUM, ...LIST].map((m) => m.name)

export default function CircleLab() {
  const [pot, setPot] = useState(0)
  const [pulse, setPulse] = useState('')

  // pot count-up
  useEffect(() => {
    let v = 0
    const id = setInterval(() => {
      v += Math.ceil((POT_TARGET - v) / 8)
      setPot(v)
      if (v >= POT_TARGET) { setPot(POT_TARGET); clearInterval(id) }
    }, 40)
    return () => clearInterval(id)
  }, [])

  // roaming "activity" pulse — makes the board feel live
  useEffect(() => {
    const id = setInterval(() => {
      setPulse(ALL_NAMES[Math.floor(Math.random() * ALL_NAMES.length)])
    }, 2000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="lab-root">
      <div className="lab-grid" />
      <div className="lab-scan" />
      <div className="lab-vignette" />

      <main className="lab-shell">
        {/* HUD */}
        <header className="hud-bar">
          <div className="hud-left">
            <span className="hud-brand">SQUAD&nbsp;7</span>
            <span className="hud-mid neon-dim">WK 1 · DAY 4</span>
          </div>
          <span className="live glass"><i className="dot" /> LIVE</span>
        </header>

        {/* ticker */}
        <div className="ticker glass">
          <div className="ticker-rail">
            {[...EVENTS, ...EVENTS].map((e, i) => (
              <span key={i} className="tick-item">
                <b className="neon-lime">▮</b> {e}
              </span>
            ))}
          </div>
        </div>

        {/* pot */}
        <div className="pot">
          <span className="pot-label neon-dim">POT ON THE LINE</span>
          <span className="pot-val">£{pot}</span>
          <span className="pot-sub neon-dim">7 players · winner-keeps-streak</span>
        </div>

        {/* podium */}
        <section className="podium">
          {PODIUM.map((p, i) => (
            <div key={p.name} className={`col ${p.color}`}>
              {p.crown && <div className="crown">♛</div>}
              <div className={`av ${p.color} ${pulse === p.name ? 'ping' : ''}`}>
                {p.av}
                {p.you && <span className="you-tag">YOU</span>}
              </div>
              <div className="p-name">{p.name}</div>
              <div className="p-combo">×{p.combo}</div>
              <motion.div
                className={`bar ${p.color}`}
                initial={{ height: 0 }}
                animate={{ height: p.h }}
                transition={{ type: 'spring', stiffness: 70, damping: 14, delay: 0.15 + i * 0.1 }}
              >
                <span className="bar-rank">{p.rank}</span>
                <span className="bar-kept">£{p.kept}</span>
              </motion.div>
            </div>
          ))}
        </section>

        {/* ranked list */}
        <section className="rows">
          {LIST.map((m, i) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.07 }}
              className={`row glass ${m.risk ? 'risk' : ''} ${pulse === m.name ? 'ping-row' : ''}`}
            >
              <span className="r-rank">{m.rank}</span>
              <span className={`r-delta ${m.delta > 0 ? 'up' : 'down'}`}>
                {m.delta > 0 ? '▲' : '▼'}{Math.abs(m.delta)}
              </span>
              <span className={`r-av ${m.risk ? 'mag' : ''}`}>{m.av}</span>
              <div className="r-mid">
                <div className="r-name">{m.name}</div>
                <div className="r-bar-track">
                  <motion.div
                    className={`r-bar ${m.risk ? 'mag' : 'lime'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${m.score}%` }}
                    transition={{ delay: 0.5 + i * 0.07, type: 'spring', stiffness: 80, damping: 18 }}
                  />
                </div>
              </div>
              <div className="r-stats">
                <div className={m.risk ? 'r-combo mag' : 'r-combo'}>×{m.combo}</div>
                <div className="r-kept neon-dim">£{m.kept}</div>
              </div>
            </motion.div>
          ))}
        </section>

        <p className="hint">prototype · this board is faking live updates</p>
      </main>

      <style jsx>{`
        .lab-root {
          position: fixed; inset: 0; overflow-y: auto;
          background: #04050a; color: #eaf2ff;
          font-family: 'DM Mono', ui-monospace, monospace; -webkit-font-smoothing: antialiased;
        }
        .lab-grid {
          position: fixed; inset: 0; pointer-events: none; opacity: .5;
          background-image:
            linear-gradient(rgba(39,232,255,.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(39,232,255,.05) 1px, transparent 1px);
          background-size: 36px 36px;
          mask-image: radial-gradient(ellipse 80% 70% at 50% 30%, #000 30%, transparent 85%);
        }
        .lab-scan {
          position: fixed; inset: 0; pointer-events: none; opacity: .3; mix-blend-mode: overlay;
          background: repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0 1px, transparent 1px 3px);
          animation: scan 7s linear infinite;
        }
        @keyframes scan { from { background-position: 0 0; } to { background-position: 0 120px; } }
        .lab-vignette {
          position: fixed; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse 75% 75% at 50% 25%, transparent 42%, rgba(0,0,0,.72) 100%);
        }
        .lab-shell {
          position: relative; z-index: 1; max-width: 24rem; margin: 0 auto;
          padding: 1.25rem 1rem 3rem; display: flex; flex-direction: column; gap: 1.1rem;
        }
        .glass {
          background: rgba(255,255,255,.035);
          backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%);
          border: 1px solid rgba(255,255,255,.09);
        }
        .neon-dim { color: rgba(180,200,225,.5); }
        .neon-lime { color: #c6ff44; text-shadow: 0 0 8px rgba(198,255,68,.6); }

        /* HUD */
        .hud-bar { display: flex; align-items: center; justify-content: space-between; }
        .hud-left { display: flex; flex-direction: column; gap: .15rem; }
        .hud-brand { font-weight: 700; letter-spacing: .3em; font-size: .95rem; color: #27e8ff; text-shadow: 0 0 10px rgba(39,232,255,.7); }
        .hud-mid { font-size: .58rem; letter-spacing: .2em; }
        .live { display: inline-flex; align-items: center; gap: .4rem; font-size: .58rem; letter-spacing: .2em; padding: .35rem .6rem; border-radius: .6rem; color: #ff3b78; }
        .live .dot { width: 7px; height: 7px; border-radius: 50%; background: #ff3b78; box-shadow: 0 0 8px #ff3b78; animation: blink 1s steps(2) infinite; }
        @keyframes blink { 50% { opacity: .25; } }

        /* ticker */
        .ticker { border-radius: .7rem; overflow: hidden; padding: .45rem 0; }
        .ticker-rail { display: inline-flex; white-space: nowrap; gap: 2.2rem; animation: marquee 22s linear infinite; }
        .tick-item { font-size: .6rem; letter-spacing: .08em; color: rgba(220,232,255,.78); }
        .tick-item b { margin-right: .35rem; }
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }

        /* pot */
        .pot { display: flex; flex-direction: column; align-items: center; gap: .15rem; padding: .25rem 0; }
        .pot-label { font-size: .56rem; letter-spacing: .3em; }
        .pot-val { font-size: 2.6rem; font-weight: 700; color: #fff; text-shadow: 0 0 22px rgba(255,59,120,.55); font-variant-numeric: tabular-nums; }
        .pot-sub { font-size: .54rem; letter-spacing: .18em; }

        /* podium */
        .podium { display: grid; grid-template-columns: repeat(3, 1fr); align-items: end; gap: .6rem; margin-top: .25rem; }
        .col { display: flex; flex-direction: column; align-items: center; gap: .3rem; }
        .crown { font-size: 1.1rem; color: #ffd64a; text-shadow: 0 0 12px rgba(255,214,74,.9); margin-bottom: -.1rem; animation: float 2.4s ease-in-out infinite; }
        @keyframes float { 50% { transform: translateY(-4px); } }
        .av {
          position: relative; width: 2.7rem; height: 2.7rem; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem;
          border: 1.5px solid; background: rgba(255,255,255,.04);
        }
        .av.gold { color: #ffd64a; border-color: rgba(255,214,74,.6); box-shadow: 0 0 16px rgba(255,214,74,.5); }
        .av.cyan { color: #27e8ff; border-color: rgba(39,232,255,.6); box-shadow: 0 0 14px rgba(39,232,255,.45); }
        .av.lime { color: #c6ff44; border-color: rgba(198,255,68,.6); box-shadow: 0 0 14px rgba(198,255,68,.45); }
        .av.ping { animation: ping 1.4s ease-out; }
        @keyframes ping { 0% { transform: scale(1); } 30% { transform: scale(1.12); } 100% { transform: scale(1); } }
        .you-tag {
          position: absolute; bottom: -.55rem; font-size: .42rem; letter-spacing: .12em; padding: .08rem .3rem;
          border-radius: .3rem; background: #27e8ff; color: #04050a; font-weight: 700;
        }
        .p-name { font-size: .62rem; letter-spacing: .12em; font-weight: 700; margin-top: .25rem; }
        .p-combo { font-size: .56rem; color: #ff8a3b; text-shadow: 0 0 6px rgba(255,138,59,.6); }
        .bar {
          width: 100%; border-radius: .5rem .5rem 0 0; position: relative; min-height: 8px;
          display: flex; flex-direction: column; align-items: center; justify-content: space-between;
          padding: .4rem 0 .5rem; border: 1px solid; border-bottom: none;
        }
        .bar.gold { background: linear-gradient(180deg, rgba(255,214,74,.28), rgba(255,214,74,.04)); border-color: rgba(255,214,74,.5); }
        .bar.cyan { background: linear-gradient(180deg, rgba(39,232,255,.24), rgba(39,232,255,.03)); border-color: rgba(39,232,255,.45); }
        .bar.lime { background: linear-gradient(180deg, rgba(198,255,68,.24), rgba(198,255,68,.03)); border-color: rgba(198,255,68,.45); }
        .bar-rank { font-size: 1.5rem; font-weight: 700; color: #fff; }
        .bar-kept { font-size: .55rem; color: rgba(220,232,255,.7); }

        /* rows */
        .rows { display: flex; flex-direction: column; gap: .45rem; margin-top: .35rem; }
        .row { display: flex; align-items: center; gap: .55rem; padding: .55rem .6rem; border-radius: .7rem; }
        .row.risk { border-color: rgba(255,59,120,.35); }
        .row.ping-row { box-shadow: 0 0 0 1px rgba(39,232,255,.4), 0 0 14px rgba(39,232,255,.25); transition: box-shadow .4s; }
        .r-rank { font-size: .85rem; font-weight: 700; width: 1rem; text-align: center; color: rgba(220,232,255,.85); }
        .r-delta { font-size: .5rem; width: 1.2rem; }
        .r-delta.up { color: #c6ff44; } .r-delta.down { color: #ff3b78; }
        .r-av {
          width: 2rem; height: 2rem; border-radius: 50%; display: flex; align-items: center; justify-content: center;
          font-size: .8rem; font-weight: 700; color: #eaf2ff; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.03);
        }
        .r-av.mag { color: #ff3b78; border-color: rgba(255,59,120,.45); }
        .r-mid { flex: 1; min-width: 0; }
        .r-name { font-size: .66rem; letter-spacing: .1em; font-weight: 700; margin-bottom: .3rem; }
        .r-bar-track { height: .35rem; border-radius: 999px; background: rgba(255,255,255,.07); overflow: hidden; }
        .r-bar { height: 100%; border-radius: 999px; }
        .r-bar.lime { background: #c6ff44; box-shadow: 0 0 8px rgba(198,255,68,.7); }
        .r-bar.mag { background: #ff3b78; box-shadow: 0 0 8px rgba(255,59,120,.7); }
        .r-stats { text-align: right; }
        .r-combo { font-size: .8rem; font-weight: 700; color: #ff8a3b; text-shadow: 0 0 6px rgba(255,138,59,.55); }
        .r-combo.mag { color: #ff3b78; text-shadow: 0 0 6px rgba(255,59,120,.6); }
        .r-kept { font-size: .52rem; }

        .hint { align-self: center; display: inline-flex; align-items: center; gap: .4rem; margin-top: .4rem;
          font-size: .56rem; letter-spacing: .22em; color: rgba(200,216,238,.55);
          padding: .3rem .7rem; border-radius: 999px; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.025); }
        .hint::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: #27e8ff; box-shadow: 0 0 6px rgba(39,232,255,.7); }
      `}</style>
    </div>
  )
}
