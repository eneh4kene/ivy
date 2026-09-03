'use client'

/**
 * PartnerNote — the send affordance for pair-to-pair notes.
 *
 * Lives inside the Two by Two game card because that is where the RIGHT to
 * write comes from: you may write to this person because the two of you share
 * one outcome this sprint. Detached from the game it would just be a DM box in
 * an accountability app.
 *
 * Design language: docs/design-constitution.md. Lumen for the act of sending;
 * AMBER (the constitution's "attention / awaiting action" role) for reporting
 * and refusals. Coral is not used at all here — the constitution reserves it
 * for money leaving, and nothing on this surface is money. Mono for the
 * machinery (counters, states); serif italic is left to Ivy's voice, and this
 * is the member's own, so it is body text.
 */

import { useState } from 'react'
import { Send, Shield, Flag, X, Check } from 'lucide-react'
import { peerApi, type PeerPartner, type PeerSendRefusal } from '@/lib/api'

const MAX = 500
/** The constitution's attention role. No token — used inline, as console states do. */
const AMBER = '#ffb03a'

/** What each refusal should say out loud. A silent failure is worse than a no. */
const REFUSAL_COPY: Record<PeerSendRefusal, string> = {
  rate_limited: 'That’s your three for today — the rest will keep until tomorrow.',
  blocked: 'Notes between you two are off.',
  no_partner: 'You’re not paired right now.',
  too_long: 'That’s longer than a note — trim it a little.',
  empty: 'Nothing to send yet.',
}

export default function PartnerNote({ partner, onChange }: {
  partner: PeerPartner
  onChange: (next: PeerPartner) => void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reportText, setReportText] = useState('')

  const left = partner.dailyLimit - partner.sentToday
  const spent = left <= 0
  const over = text.length > MAX

  async function send() {
    if (!text.trim() || busy || over) return
    setBusy(true)
    setError(null)
    try {
      const res = await peerApi.send(text.trim())
      if (res.ok) {
        setText('')
        setSent(true)
        onChange({ ...partner, sentToday: partner.sentToday + 1 })
        setTimeout(() => setSent(false), 2600)
      } else {
        setError(REFUSAL_COPY[res.reason])
      }
    } catch {
      setError('That didn’t send. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleBlock() {
    setBusy(true)
    try {
      if (partner.blockedByMe) {
        await peerApi.unblock(partner.partnerId)
        onChange({ ...partner, contactBlocked: false, blockedByMe: false })
      } else {
        await peerApi.block(partner.partnerId)
        onChange({ ...partner, contactBlocked: true, blockedByMe: true })
      }
      setMenu(false)
    } catch {
      setError('That didn’t save. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  async function submitReport() {
    if (!reportText.trim() || busy) return
    setBusy(true)
    try {
      await peerApi.report(partner.partnerId, reportText.trim())
      // Reporting blocks too — nobody should need a second action to stop
      // hearing from someone they have just reported.
      onChange({ ...partner, contactBlocked: true, blockedByMe: true })
      setReporting(false)
      setMenu(false)
      setReportText('')
    } catch {
      setError('That didn’t send. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  // ── Blocked: the game carries on, the contact does not ────────────────────
  if (partner.contactBlocked) {
    return (
      <div className="mt-3 rounded-xl border border-ink-700 bg-ink-900/60 p-3">
        <p className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-ink-400">Notes off</p>
        <p className="text-xs text-ink-300 mt-1.5 leading-relaxed">
          {partner.blockedByMe
            ? 'You’ve turned off notes between you. Your days still count together — that part needs nothing from either of you.'
            : 'Notes are off between you two. Your days still count together.'}
        </p>
        {partner.blockedByMe && (
          <button
            onClick={toggleBlock}
            disabled={busy}
            className="mt-2.5 font-mono text-[8.5px] uppercase tracking-[0.18em] text-gold-400 hover:text-gold-300 disabled:opacity-50 transition-colors"
          >
            Turn notes back on
          </button>
        )}
      </div>
    )
  }

  // ── Report form ───────────────────────────────────────────────────────────
  if (reporting) {
    return (
      <div className="mt-3 rounded-xl border border-ink-700 bg-ink-900/60 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-ink-400">Report {partner.firstName}</p>
          <button onClick={() => setReporting(false)} aria-label="Cancel report" className="text-ink-400 hover:text-ink-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-xs text-ink-400 leading-relaxed mb-2">
          A person reads every report. Nothing happens to {partner.firstName} automatically — but notes between
          you stop straight away.
        </p>
        <textarea
          value={reportText}
          onChange={(e) => setReportText(e.target.value)}
          rows={3}
          placeholder="What happened?"
          className="w-full resize-none rounded-lg bg-ink-900 border border-ink-700 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none focus:border-gold-400/40"
        />
        <button
          onClick={submitReport}
          disabled={busy || !reportText.trim()}
          style={{ color: AMBER, borderColor: `${AMBER}40`, backgroundColor: `${AMBER}14` }}
          className="mt-2 w-full rounded-lg border py-2 font-mono text-[8.5px] uppercase tracking-[0.18em] disabled:opacity-40 hover:opacity-80 transition-opacity"
        >
          {busy ? 'Sending…' : 'Send report'}
        </button>
      </div>
    )
  }

  // ── The composer ──────────────────────────────────────────────────────────
  return (
    <div className="mt-3 rounded-xl border border-ink-700 bg-ink-900/60 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-ink-400">
          Note to {partner.firstName}
        </p>
        <div className="relative">
          <button
            onClick={() => setMenu((m) => !m)}
            aria-label={`Options for ${partner.firstName}`}
            aria-expanded={menu}
            className="text-ink-500 hover:text-ink-300 transition-colors p-0.5"
          >
            <Shield className="w-3.5 h-3.5" />
          </button>
          {menu && (
            <div className="absolute right-0 top-6 z-10 w-40 rounded-lg border border-ink-700 bg-ink-800 shadow-xl overflow-hidden">
              <button
                onClick={toggleBlock}
                disabled={busy}
                className="w-full text-left px-3 py-2 text-xs text-ink-200 hover:bg-ink-700/60 disabled:opacity-50 transition-colors"
              >
                Turn off notes
              </button>
              <button
                onClick={() => { setReporting(true); setMenu(false) }}
                style={{ color: AMBER }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-ink-700/60 flex items-center gap-1.5 transition-colors"
              >
                <Flag className="w-3 h-3" /> Report
              </button>
            </div>
          )}
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setError(null) }}
        rows={2}
        maxLength={MAX + 40}
        disabled={spent}
        placeholder={spent ? 'Back tomorrow.' : `Something worth saying to ${partner.firstName}…`}
        className="w-full resize-none rounded-lg bg-ink-900 border border-ink-700 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none focus:border-gold-400/40 disabled:opacity-50 transition-colors"
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <p
          style={over ? { color: AMBER } : undefined}
          className={`font-mono text-[8.5px] uppercase tracking-[0.18em] ${over ? '' : 'text-ink-500'}`}
        >
          {over ? `${text.length - MAX} over` : `${left} of ${partner.dailyLimit} left today`}
        </p>
        <button
          onClick={send}
          disabled={busy || spent || over || !text.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-gold-400/10 border border-gold-400/25 px-3 py-1.5 font-mono text-[8.5px] uppercase tracking-[0.18em] text-gold-300 disabled:opacity-40 hover:bg-gold-400/15 transition-colors"
        >
          {sent ? <><Check className="w-3 h-3" /> Sent</> : <><Send className="w-3 h-3" /> {busy ? 'Sending…' : 'Send'}</>}
        </button>
      </div>

      {error && <p className="mt-1.5 text-xs" style={{ color: AMBER }}>{error}</p>}

      {/* The sprint is over and the channel is winding down. Said out loud,
          because a send button that silently disappears reads as a bug. */}
      {partner.closingInDays != null && (
        <p className="mt-2 text-xs text-ink-400 leading-relaxed">
          Your sprint together is done — notes close in{' '}
          <span className="text-ink-200">{partner.closingInDays} day{partner.closingInDays === 1 ? '' : 's'}</span>.
        </p>
      )}
    </div>
  )
}
