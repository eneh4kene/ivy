'use client'

/**
 * Ivy chat — the text channel that complements the evening voice ritual.
 *
 * Renders the IN_APP thread (Ivy left with avatar, the user right), a sticky
 * composer pinned above the bottom nav, a typing indicator while Ivy thinks, and
 * action-card buttons for the onboarding handoff (call now / pick a time / just
 * text). Sends are optimistic so the thread feels instant.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { chatApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth.store'
import type { ChatMessage, ChatActionKind } from '@/lib/types'

const ACTION_LABELS: Record<ChatActionKind, string> = {
  call_now: 'Call me now',
  schedule: 'Pick a time',
  just_text: 'Just text',
}

function IvyAvatar() {
  return (
    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-400/15 text-[11px] font-semibold text-gold-300 ring-1 ring-gold-400/30">
      I
    </span>
  )
}

function TypingDots() {
  return (
    <div className="flex items-end gap-2">
      <IvyAvatar />
      <div className="surface flex items-center gap-1 rounded-2xl rounded-bl-md px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

export function ChatScreen() {
  const firstName = useAuthStore((s) => s.user?.firstName)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' })
  }, [])

  useEffect(() => {
    let active = true
    chatApi
      .getThread()
      .then((thread) => {
        if (!active) return
        setMessages(thread)
        // GET /api/chat marks Ivy messages read server-side; clear the nav badge now.
        window.dispatchEvent(new Event('ivy-chat-read'))
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    scrollToBottom(loading ? 'auto' : 'smooth')
  }, [messages, sending, loading, scrollToBottom])

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }

  const send = async () => {
    const text = draft.trim()
    if (!text || sending) return

    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      direction: 'INBOUND',
      content: text,
    }
    setMessages((prev) => [...prev, optimistic])
    setDraft('')
    if (composerRef.current) composerRef.current.style.height = 'auto'
    setSending(true)
    try {
      const reply = await chatApi.send(text)
      setMessages((prev) => [...prev, reply])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          createdAt: new Date().toISOString(),
          direction: 'OUTBOUND',
          content: "I didn't catch that — mind sending it again?",
        },
      ])
    } finally {
      setSending(false)
    }
  }

  const onAction = async (action: ChatActionKind) => {
    if (actionBusy) return
    setActionBusy(true)
    try {
      const reply = await chatApi.action(action)
      setMessages((prev) => [...prev, reply])
    } catch {
      // surfaced via the thread on retry; keep silent
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col mesh-bg-subtle">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-ink-700/50 bg-ink-900/85 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <IvyAvatar />
          <div className="leading-tight">
            <h1 className="font-display text-base tracking-tight text-ink-50">Ivy</h1>
            <p className="text-[11px] text-ink-400">Your coach — here any time</p>
          </div>
        </div>
      </header>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-4 pb-40 pt-4">
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          {loading ? (
            <ThreadSkeleton />
          ) : messages.length === 0 ? (
            <EmptyState firstName={firstName} />
          ) : (
            messages.map((m) => <Bubble key={m.id} msg={m} onAction={onAction} actionBusy={actionBusy} />)
          )}
          {sending && <TypingDots />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer — sits above the bottom nav */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-700/50 bg-ink-900/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-end gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+72px)] pt-3">
          <textarea
            ref={composerRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              autoGrow(e.target)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={1}
            placeholder="Message Ivy…"
            className="max-h-[140px] flex-1 resize-none rounded-2xl border border-ink-700/60 bg-ink-800/60 px-4 py-2.5 text-sm text-ink-50 placeholder:text-ink-500 focus:border-gold-400/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim() || sending}
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-400 text-ink-900 transition-opacity disabled:opacity-40"
          >
            <Send className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  )
}

function Bubble({
  msg,
  onAction,
  actionBusy,
}: {
  msg: ChatMessage
  onAction: (a: ChatActionKind) => void
  actionBusy: boolean
}) {
  const isIvy = msg.direction === 'OUTBOUND'
  const actions = msg.metadata?.actions ?? []

  if (isIvy) {
    return (
      <div className="flex items-end gap-2">
        <IvyAvatar />
        <div className="flex max-w-[78%] flex-col gap-2">
          <div className="surface whitespace-pre-wrap rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed text-ink-100">
            {msg.content}
          </div>
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <button
                  key={a}
                  type="button"
                  disabled={actionBusy}
                  onClick={() => onAction(a)}
                  className="rounded-full border border-gold-400/40 bg-gold-400/10 px-3.5 py-1.5 text-xs font-medium text-gold-200 transition-colors hover:bg-gold-400/20 disabled:opacity-50"
                >
                  {ACTION_LABELS[a]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-end">
      <div className="max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gold-400 px-4 py-2.5 text-sm leading-relaxed text-ink-900">
        {msg.content}
      </div>
    </div>
  )
}

function EmptyState({ firstName }: { firstName?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 pt-16 text-center">
      <IvyAvatar />
      <p className="mt-2 text-sm leading-relaxed text-ink-400">
        {firstName ? `Hey ${firstName}.` : 'Hey.'} This is your line to me — plan your day, log a win, or
        ask for a push, any time. Your evening check-in stays the main event.
      </p>
    </div>
  )
}

function ThreadSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <span className="h-7 w-7 shrink-0 rounded-full bg-ink-800/70" />
        <span className="h-10 w-2/3 rounded-2xl rounded-bl-md bg-ink-800/70" />
      </div>
      <div className="flex justify-end">
        <span className="h-9 w-1/2 rounded-2xl rounded-br-md bg-ink-800/70" />
      </div>
      <div className="flex items-end gap-2">
        <span className="h-7 w-7 shrink-0 rounded-full bg-ink-800/70" />
        <span className="h-16 w-3/4 rounded-2xl rounded-bl-md bg-ink-800/70" />
      </div>
    </div>
  )
}
