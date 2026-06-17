'use client'

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { Send, Phone } from 'lucide-react'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import type { ChatMessage, VoiceNote } from '@/lib/mock/daily-loop'

/* ── Message bubble ───────────────────────────────────────────────────────── */
function MessageBubble({ message }: { message: ChatMessage }) {
  const isIvy = message.role === 'ivy'
  const time  = message.timestamp.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  })

  if (message.isTyping) {
    return (
      <div className="flex items-end gap-2.5 animate-fade-in">
        <IvyAvatar />
        <div className="bg-ink-700 border border-ink-600 rounded-2xl rounded-bl-sm px-4 py-3">
          <TypingDots />
        </div>
      </div>
    )
  }

  if (isIvy) {
    return (
      <div className="flex items-end gap-2.5 animate-slide-in-bottom">
        <IvyAvatar />
        <div className="max-w-[78%]">
          <div className="bg-ink-700 border border-ink-600/80 rounded-2xl rounded-bl-sm px-4 py-3">
            <p className="text-sm text-ink-50 leading-relaxed">{message.content}</p>
          </div>
          <span className="text-2xs text-ink-400 mt-1 ml-1 block">{time}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2.5 justify-end animate-slide-in-bottom">
      <div className="max-w-[78%]">
        <div className="glass-gold rounded-2xl rounded-br-sm px-4 py-3">
          <p className="text-sm text-ink-50 leading-relaxed">{message.content}</p>
        </div>
        <div className="flex items-center justify-end gap-1.5 mt-1 mr-1">
          <span className="text-2xs text-ink-400">{time}</span>
          {message.status === 'sending' && (
            <span className="w-3 h-3 rounded-full border border-ink-400 border-t-transparent animate-spin" />
          )}
          {message.status === 'sent' && (
            <span className="text-2xs text-sage-400">✓</span>
          )}
        </div>
      </div>
    </div>
  )
}

function IvyAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center shrink-0 mb-1">
      <span className="text-ink-900 font-display font-semibold text-xs">I</span>
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 h-4">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-ink-400 inline-block"
          style={{ animation: `waveform-bar 0.8s ease-in-out ${i * 0.18}s infinite` }}
        />
      ))}
    </div>
  )
}

/* ── Morning VN callback card ─────────────────────────────────────────────── */
function VoiceNoteCard({ vn }: { vn: VoiceNote }) {
  const dur = `${Math.floor(vn.duration / 60)}:${String(vn.duration % 60).padStart(2, '0')}`
  return (
    <div className="glass-gold rounded-2xl p-3.5 mx-auto max-w-xs animate-fade-in">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-gold-400" stroke="currentColor" strokeWidth={1.5}>
            <rect x="5" y="1" width="6" height="9" rx="3" />
            <path d="M2 8c0 3.3 2.7 6 6 6s6-2.7 6-6" strokeLinecap="round" />
            <path d="M8 14v2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-2xs font-semibold uppercase tracking-widest text-gold-400">
              This morning you said
            </span>
            <span className="text-2xs text-ink-400 font-mono">{dur}</span>
          </div>
          <p className="text-xs text-ink-200 leading-relaxed line-clamp-3">
            &ldquo;{vn.transcript}&rdquo;
          </p>
          <p className="text-2xs text-ink-400 mt-1.5">
            {vn.recordedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Mock Ivy response engine ─────────────────────────────────────────────── */
const IVY_MOCK_REPLIES: Record<string, string> = {
  default:  "That's useful to know. What's the one thing that would make tomorrow different?",
  done:     "Good. That's what matters — you did the thing. How did it feel?",
  partial:  "Partial is honest. What got in the way, and is that pattern going to repeat?",
  no:       "Okay. No judgment — but your stake counts the day. What happened?",
}

function getIvyReply(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes('done') || lower.includes('yes') || lower.includes('completed') || lower.includes('finished')) {
    return IVY_MOCK_REPLIES.done
  }
  if (lower.includes('partial') || lower.includes('mostly') || lower.includes('half')) {
    return IVY_MOCK_REPLIES.partial
  }
  if (lower.includes('no') || lower.includes("didn") || lower.includes('failed') || lower.includes('missed')) {
    return IVY_MOCK_REPLIES.no
  }
  return IVY_MOCK_REPLIES.default
}

/* ── Main EveningChat ─────────────────────────────────────────────────────── */
interface EveningChatProps {
  initialMessages: ChatMessage[]
  voiceNote:       VoiceNote
  onCallIvy:       () => void
}

export function EveningChat({ initialMessages, voiceNote, onCallIvy }: EveningChatProps) {
  const [messages,      setMessages]     = useState<ChatMessage[]>(initialMessages)
  const [inputText,     setInputText]    = useState('')
  const [isSending,     setIsSending]    = useState(false)
  const [showCallHint,  setShowCallHint] = useState(false)
  const [exchangeCount, setExchangeCount]= useState(0)

  const scrollRef     = useRef<HTMLDivElement>(null)
  const inputRef      = useRef<HTMLTextAreaElement>(null)

  const { isKeyboardOpen } = useVisualViewport()

  /* ── scroll helpers ── */
  const scrollToBottom = useCallback((smooth = true) => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: smooth ? 'smooth' : 'instant',
    })
  }, [])

  useEffect(() => { scrollToBottom(false) }, [messages, scrollToBottom])

  useEffect(() => {
    if (isKeyboardOpen) {
      const t = setTimeout(() => scrollToBottom(true), 80)
      return () => clearTimeout(t)
    }
  }, [isKeyboardOpen, scrollToBottom])

  /* ── Auto-resize textarea ── */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [])

  /* ── Optimistic send ── */
  const handleSend = useCallback(() => {
    const text = inputText.trim()
    if (!text || isSending) return

    const userMsg: ChatMessage = {
      id:        `msg-${Date.now()}`,
      role:      'user',
      content:   text,
      timestamp: new Date(),
      status:    'sending',
    }

    setMessages((prev) => [...prev, userMsg])
    setInputText('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setIsSending(true)

    // Optimistic: mark sent after 300ms
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => m.id === userMsg.id ? { ...m, status: 'sent' } : m)
      )
    }, 300)

    // Typing indicator
    const typingMsg: ChatMessage = {
      id: 'typing', role: 'ivy', content: '', timestamp: new Date(), isTyping: true,
    }
    setTimeout(() => {
      setMessages((prev) => [...prev, typingMsg])
    }, 500)

    // Ivy reply
    setTimeout(() => {
      const ivyReply: ChatMessage = {
        id:        `msg-ivy-${Date.now()}`,
        role:      'ivy',
        content:   getIvyReply(text),
        timestamp: new Date(),
      }
      setMessages((prev) => prev.filter((m) => m.id !== 'typing').concat(ivyReply))
      setIsSending(false)
      setExchangeCount((c) => {
        const next = c + 1
        if (next >= 3) setShowCallHint(true)
        return next
      })
    }, 1600)
  }, [inputText, isSending])

  /* ── Enter key submit ── */
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div className="flex flex-col h-full">
      {/* Scroll area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 space-y-4"
        style={{ scrollbarWidth: 'none' }}
      >
        <VoiceNoteCard vn={voiceNote} />

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {showCallHint && (
          <div className="flex justify-center animate-fade-in">
            <button
              onClick={onCallIvy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-ink-600
                text-xs text-ink-400 hover:border-sage-400/30 hover:text-sage-400 transition-all"
            >
              <Phone className="w-3.5 h-3.5" />
              Rather talk? Ivy can call you
            </button>
          </div>
        )}
      </div>

      {/* Input bar — border-t pins it; pb uses safe-area-inset */}
      <div className="shrink-0 border-t border-ink-600 bg-ink-900/95 backdrop-blur-sm px-4 pt-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Reply to Ivy…"
            rows={1}
            className="flex-1 resize-none bg-ink-700 border border-ink-600 rounded-2xl
              px-4 py-3 text-sm text-ink-50 placeholder:text-ink-400
              focus:outline-none focus:border-gold-400/40 transition-colors duration-150
              leading-relaxed max-h-[120px] overflow-y-auto"
            style={{ scrollbarWidth: 'none' }}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isSending}
            className="w-11 h-11 shrink-0 rounded-full bg-gold-400 flex items-center justify-center
              transition-all duration-150 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed
              hover:bg-gold-300 glow-sm-gold"
          >
            <Send className="w-4 h-4 text-ink-900" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  )
}
