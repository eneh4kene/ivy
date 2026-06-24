'use client'

/**
 * /lab/vn — DESIGN PROTOTYPE (not wired to anything).
 *
 * Arcade chat / voice-note check-in. Ivy is the neon "system" voice; you record
 * a VN to arm the day. Same arcade-HUD language as /lab + /lab/circle, made to
 * feel alive: breathing Ivy orb, typewriter messages, typing dots, a reactive
 * recording waveform + LED timer, and a "SECURED" payoff when you send.
 * Interactive: tap the mic → records → SEND & ARM. Mock data, scoped styles.
 */

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type Phase = 'idle' | 'recording' | 'review' | 'sent'

function Typewriter({ text, speed = 22 }: { text: string; speed?: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    const id = setInterval(() => setN((p) => (p >= text.length ? (clearInterval(id), p) : p + 1)), speed)
    return () => clearInterval(id)
  }, [text, speed])
  return <>{text.slice(0, n)}{n < text.length && <span className="caret">▋</span>}</>
}

function Wave({ live }: { live: boolean }) {
  const bars = Array.from({ length: 30 })
  return (
    <div className="wave">
      {bars.map((_, i) => (
        <span
          key={i}
          className={live ? 'wb live' : 'wb'}
          style={
            live
              ? { animationDelay: `${(i % 9) * 0.05}s`, animationDuration: `${0.5 + (i % 5) * 0.09}s` }
              : { height: `${22 + (Math.sin(i * 1.7) * 0.5 + 0.5) * 70}%` }
          }
        />
      ))}
    </div>
  )
}

export default function VnLab() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [secs, setSecs] = useState(0)
  const [ivyTyping, setIvyTyping] = useState(false)
  const [ivyReply, setIvyReply] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const secured = phase === 'sent'
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`

  const start = () => {
    setPhase('recording'); setSecs(0)
    if (typeof navigator !== 'undefined') navigator.vibrate?.(10)
    timer.current = setInterval(() => setSecs((s) => s + 1), 1000)
  }
  const stop = () => {
    if (timer.current) clearInterval(timer.current)
    setPhase('review')
    if (typeof navigator !== 'undefined') navigator.vibrate?.(6)
  }
  const send = () => {
    setPhase('sent')
    if (typeof navigator !== 'undefined') navigator.vibrate?.([8, 30, 14])
    setIvyTyping(true)
    setTimeout(() => { setIvyTyping(false); setIvyReply(true) }, 1500)
  }
  const reset = () => { setPhase('idle'); setSecs(0); setIvyReply(false) }

  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  return (
    <div className="lab-root">
      <div className="lab-grid" />
      <div className="lab-scan" />
      <div className="lab-vignette" />

      <main className="lab-shell">
        {/* HUD */}
        <header className="hud-bar">
          <div className="hud-left">
            <span className="hud-brand">IVY</span>
            <span className="hud-mid neon-dim">MORNING CHECK-IN · DAY 04</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.span
              key={secured ? 's' : 'u'}
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
              className={secured ? 'chip lime' : 'chip mag'}
            >
              {secured ? '£7 SECURED ✓' : '£7 ON THE LINE'}
            </motion.span>
          </AnimatePresence>
        </header>

        {/* Thread */}
        <section className="thread">
          {/* Ivy prompt */}
          <div className="msg ivy">
            <div className="orb"><span className="orb-core" /></div>
            <div className="bubble glass ivy-b">
              <span className="who neon-cyan">IVY</span>
              <p><Typewriter text="Morning. Day 4, £7 on the line. Tell me the one thing you're locking in today — say it out loud." /></p>
            </div>
          </div>

          {/* User VN (after send) */}
          <AnimatePresence>
            {secured && (
              <motion.div
                className="msg me"
                initial={{ opacity: 0, y: 14, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 120, damping: 16 }}
              >
                <div className="bubble vn-b">
                  <button className="play">▸</button>
                  <Wave live={false} />
                  <span className="vn-dur">0:{String(Math.max(secs, 7)).padStart(2, '0')}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ivy typing */}
          <AnimatePresence>
            {ivyTyping && (
              <motion.div className="msg ivy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="orb"><span className="orb-core" /></div>
                <div className="bubble glass ivy-b typing">
                  <span className="td" /><span className="td" /><span className="td" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ivy reply + payoff */}
          <AnimatePresence>
            {ivyReply && (
              <motion.div className="msg ivy" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <div className="orb on"><span className="orb-core" /></div>
                <div className="bubble glass ivy-b">
                  <span className="who neon-cyan">IVY</span>
                  <p><Typewriter text="Locked in. £7 secured for today — combo ×4. Don't break the chain. I'll check in tonight." /></p>
                  <div className="secured-tag neon-lime">◉ DAY 4 ARMED · COMBO ×4 🔥</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ── Recorder dock ── */}
        <div className="dock glass">
          {phase === 'idle' && (
            <div className="dock-inner">
              <span className="dock-hint neon-dim">HOLD TO ARM · SAY YOUR COMMITMENT</span>
              <button className="mic" onClick={start}><span className="mic-glyph">●</span></button>
            </div>
          )}

          {phase === 'recording' && (
            <div className="dock-inner rec">
              <div className="rec-top">
                <span className="rec-led">{mmss}</span>
                <span className="rec-flag mag"><i className="rdot" /> REC</span>
              </div>
              <Wave live />
              <button className="mic recording" onClick={stop}><span className="stop-glyph" /></button>
            </div>
          )}

          {phase === 'review' && (
            <div className="dock-inner">
              <div className="clip">
                <button className="play">▸</button>
                <Wave live={false} />
                <span className="vn-dur">{mmss}</span>
              </div>
              <div className="review-actions">
                <button className="ghost" onClick={reset}>↺ RETAKE</button>
                <button className="send" onClick={send}><span className="action-glow" />▸ SEND & ARM</button>
              </div>
            </div>
          )}

          {phase === 'sent' && (
            <div className="dock-inner">
              <button className="ghost wide" onClick={reset}>↺ RUN IT AGAIN</button>
            </div>
          )}
        </div>

        <p className="hint">prototype · tap the mic to play it</p>
      </main>

      <style jsx>{`
        .lab-root {
          position: fixed; inset: 0; overflow-y: auto; background: #04050a; color: #eaf2ff;
          font-family: 'DM Mono', ui-monospace, monospace; -webkit-font-smoothing: antialiased;
        }
        .lab-grid {
          position: fixed; inset: 0; pointer-events: none; opacity: .5;
          background-image: linear-gradient(rgba(39,232,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(39,232,255,.05) 1px, transparent 1px);
          background-size: 36px 36px; mask-image: radial-gradient(ellipse 80% 70% at 50% 30%, #000 30%, transparent 85%);
        }
        .lab-scan { position: fixed; inset: 0; pointer-events: none; opacity: .3; mix-blend-mode: overlay;
          background: repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0 1px, transparent 1px 3px); animation: scan 7s linear infinite; }
        @keyframes scan { from { background-position: 0 0; } to { background-position: 0 120px; } }
        .lab-vignette { position: fixed; inset: 0; pointer-events: none; background: radial-gradient(ellipse 75% 75% at 50% 25%, transparent 42%, rgba(0,0,0,.72) 100%); }

        .lab-shell { position: relative; z-index: 1; max-width: 24rem; margin: 0 auto; min-height: 100%;
          padding: 1.25rem 1rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
        .glass { background: rgba(255,255,255,.035); backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%); border: 1px solid rgba(255,255,255,.09); }
        .neon-dim { color: rgba(180,200,225,.5); }
        .neon-cyan { color: #27e8ff; text-shadow: 0 0 8px rgba(39,232,255,.6); }
        .neon-lime { color: #c6ff44; text-shadow: 0 0 8px rgba(198,255,68,.6); }

        /* HUD */
        .hud-bar { display: flex; align-items: center; justify-content: space-between; }
        .hud-left { display: flex; flex-direction: column; gap: .15rem; }
        .hud-brand { font-weight: 700; letter-spacing: .35em; font-size: .95rem; color: #27e8ff; text-shadow: 0 0 10px rgba(39,232,255,.7); }
        .hud-mid { font-size: .56rem; letter-spacing: .18em; }
        .chip { font-size: .58rem; letter-spacing: .14em; padding: .35rem .6rem; border-radius: .6rem; border: 1px solid; }
        .chip.mag { color: #ff3b78; border-color: rgba(255,59,120,.4); text-shadow: 0 0 8px rgba(255,59,120,.5); }
        .chip.lime { color: #c6ff44; border-color: rgba(198,255,68,.45); text-shadow: 0 0 8px rgba(198,255,68,.6); }

        /* thread */
        .thread { flex: 1; display: flex; flex-direction: column; gap: .85rem; padding: .5rem 0; }
        .msg { display: flex; gap: .5rem; align-items: flex-end; }
        .msg.me { justify-content: flex-end; }
        .orb { width: 2rem; height: 2rem; border-radius: 50%; flex-shrink: 0; border: 1.5px solid rgba(39,232,255,.5);
          display: flex; align-items: center; justify-content: center; box-shadow: 0 0 14px rgba(39,232,255,.35); animation: breathe 3s ease-in-out infinite; }
        .orb.on { animation: breathe 1.4s ease-in-out infinite; }
        .orb-core { width: .7rem; height: .7rem; border-radius: 50%; background: #27e8ff; box-shadow: 0 0 12px #27e8ff; }
        @keyframes breathe { 50% { transform: scale(1.12); box-shadow: 0 0 22px rgba(39,232,255,.6); } }

        .bubble { max-width: 80%; padding: .65rem .8rem; border-radius: 1rem; font-size: .72rem; line-height: 1.5; }
        .ivy-b { border-bottom-left-radius: .3rem; }
        .who { display: block; font-size: .5rem; letter-spacing: .25em; margin-bottom: .3rem; }
        .caret { color: #27e8ff; animation: blink 1s steps(2) infinite; }
        @keyframes blink { 50% { opacity: 0; } }
        .secured-tag { margin-top: .5rem; font-size: .56rem; letter-spacing: .12em; }

        .typing { display: flex; gap: .3rem; padding: .8rem; }
        .td { width: .4rem; height: .4rem; border-radius: 50%; background: #27e8ff; box-shadow: 0 0 6px #27e8ff; animation: bounce 1.1s infinite; }
        .td:nth-child(2) { animation-delay: .15s; } .td:nth-child(3) { animation-delay: .3s; }
        @keyframes bounce { 0%,60%,100% { transform: translateY(0); opacity: .5; } 30% { transform: translateY(-5px); opacity: 1; } }

        /* user VN bubble */
        .vn-b { display: flex; align-items: center; gap: .55rem; padding: .55rem .7rem; border-radius: 1rem; border-bottom-right-radius: .3rem;
          background: linear-gradient(180deg, rgba(198,255,68,.18), rgba(198,255,68,.04)); border: 1px solid rgba(198,255,68,.4); }
        .play { width: 1.5rem; height: 1.5rem; border-radius: 50%; border: 1px solid rgba(198,255,68,.5); background: rgba(198,255,68,.12);
          color: #c6ff44; font-size: .7rem; cursor: pointer; flex-shrink: 0; }
        .vn-dur { font-size: .56rem; color: rgba(220,232,255,.7); flex-shrink: 0; }

        /* waveform */
        .wave { display: flex; align-items: center; gap: 2px; height: 1.6rem; flex: 1; }
        .wb { flex: 1; min-width: 2px; border-radius: 2px; background: #c6ff44; box-shadow: 0 0 5px rgba(198,255,68,.6); height: 30%; transform-origin: center; }
        .wb.live { background: #ff3b78; box-shadow: 0 0 6px rgba(255,59,120,.7); height: 100%; animation: vu .55s ease-in-out infinite; }
        @keyframes vu { 0%,100% { transform: scaleY(.2); } 50% { transform: scaleY(1); } }

        /* dock */
        .dock { border-radius: 1.1rem; padding: .9rem; position: sticky; bottom: .5rem; }
        .dock-inner { display: flex; flex-direction: column; align-items: center; gap: .7rem; }
        .dock-hint { font-size: .55rem; letter-spacing: .2em; }
        .mic { width: 3.6rem; height: 3.6rem; border-radius: 50%; border: none; cursor: pointer;
          background: #27e8ff; color: #04050a; font-size: 1rem; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 24px rgba(39,232,255,.55), inset 0 0 0 1px rgba(255,255,255,.3); }
        .mic-glyph { font-size: 1.1rem; }
        .mic.recording { background: #ff3b78; box-shadow: 0 0 26px rgba(255,59,120,.7); animation: pulseRec 1s ease-in-out infinite; }
        @keyframes pulseRec { 50% { transform: scale(1.07); box-shadow: 0 0 36px rgba(255,59,120,.9); } }
        .stop-glyph { width: 1rem; height: 1rem; border-radius: .2rem; background: #04050a; }

        .rec { width: 100%; }
        .rec-top { display: flex; align-items: center; justify-content: space-between; width: 100%; }
        .rec-led { font-size: 1.6rem; font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; text-shadow: 0 0 12px rgba(255,59,120,.5); }
        .rec-flag { font-size: .58rem; letter-spacing: .2em; color: #ff3b78; display: inline-flex; align-items: center; gap: .35rem; }
        .rdot { width: 7px; height: 7px; border-radius: 50%; background: #ff3b78; box-shadow: 0 0 8px #ff3b78; animation: blink 1s steps(2) infinite; }

        .clip { display: flex; align-items: center; gap: .6rem; width: 100%; padding: .55rem .7rem; border-radius: .8rem;
          background: rgba(198,255,68,.06); border: 1px solid rgba(198,255,68,.3); }
        .review-actions { display: flex; gap: .6rem; width: 100%; }
        .ghost { flex: 1; padding: .8rem; border-radius: .8rem; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12);
          color: rgba(220,232,255,.8); font-size: .62rem; letter-spacing: .12em; font-weight: 700; cursor: pointer; font-family: inherit; }
        .ghost.wide { width: 100%; }
        .send { flex: 2; position: relative; overflow: hidden; padding: .8rem; border-radius: .8rem; border: none; cursor: pointer;
          background: #c6ff44; color: #04050a; font-size: .66rem; letter-spacing: .12em; font-weight: 700; font-family: inherit;
          box-shadow: 0 0 22px rgba(198,255,68,.5); }
        .action-glow { position: absolute; inset: 0; background: linear-gradient(110deg, transparent 20%, rgba(255,255,255,.6) 50%, transparent 80%);
          transform: translateX(-120%); animation: sheen 2.8s ease-in-out infinite; }
        @keyframes sheen { 0%,55% { transform: translateX(-120%); } 100% { transform: translateX(120%); } }

        .hint { align-self: center; display: inline-flex; align-items: center; gap: .4rem;
          font-size: .56rem; letter-spacing: .22em; color: rgba(200,216,238,.55);
          padding: .3rem .7rem; border-radius: 999px; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.025); }
        .hint::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: #27e8ff; box-shadow: 0 0 6px rgba(39,232,255,.7); }
      `}</style>
    </div>
  )
}
