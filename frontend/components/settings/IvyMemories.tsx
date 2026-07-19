'use client'

/**
 * IvyMemories — "What Ivy remembers about you".
 *
 * The long-term memory store made VISIBLE: proof-of-being-known is the
 * product's emotional core, and a wrong memory repeated on a call destroys
 * trust faster than no memory at all — so correction ("Forget this") is one
 * tap, no questions asked, permanent.
 */

import { useEffect, useState } from 'react'
import { usersApi, type IvyMemory } from '@/lib/api'
import { Sparkles, X, Loader2 } from 'lucide-react'

const CATEGORY_LABEL: Record<string, string> = {
  motivation: 'Why you do this',
  life_event: 'Life events',
  personal_detail: 'About you',
  struggle: 'The hard parts',
  breakthrough: 'Breakthroughs',
}

const CATEGORY_ORDER = ['motivation', 'breakthrough', 'struggle', 'life_event', 'personal_detail']

export function IvyMemoriesCard() {
  const [memories, setMemories] = useState<IvyMemory[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [forgetting, setForgetting] = useState<string | null>(null)

  useEffect(() => {
    usersApi
      .getMemories()
      .then(setMemories)
      .catch(() => setFailed(true))
  }, [])

  const forget = async (id: string) => {
    setForgetting(id)
    try {
      await usersApi.forgetMemory(id)
      setMemories((prev) => (prev ? prev.filter((m) => m.id !== id) : prev))
    } catch {
      // leave the memory in place; the user can retry
    } finally {
      setForgetting(null)
    }
  }

  // Hide the section entirely on fetch failure — a broken "what I know about
  // you" panel is worse than none.
  if (failed) return null

  const grouped = new Map<string, IvyMemory[]>()
  for (const m of memories ?? []) {
    const key = CATEGORY_LABEL[m.category] ? m.category : 'personal_detail'
    grouped.set(key, [...(grouped.get(key) ?? []), m])
  }
  const orderedCategories = CATEGORY_ORDER.filter((c) => grouped.has(c))

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-5 border-b border-border flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
          <Sparkles className="w-4.5 h-4.5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="font-semibold">What Ivy remembers</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            What she&apos;s learned from your calls and chats. Anything wrong? Forget it — one tap, gone for good.
          </p>
        </div>
      </div>
      <div className="p-5">
        {memories === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : memories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing yet — Ivy remembers what matters as you talk. After a few calls, what she&apos;s learned about you
            shows up here.
          </p>
        ) : (
          <div className="space-y-5">
            {orderedCategories.map((cat) => (
              <div key={cat}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {CATEGORY_LABEL[cat]}
                </p>
                <ul className="space-y-2">
                  {grouped.get(cat)!.map((m) => (
                    <li
                      key={m.id}
                      className="group flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5"
                    >
                      <p className="flex-1 text-sm text-foreground leading-snug">{m.content}</p>
                      <button
                        onClick={() => forget(m.id)}
                        disabled={forgetting === m.id}
                        aria-label="Forget this memory"
                        title="Forget this"
                        className="shrink-0 mt-0.5 rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                      >
                        {forgetting === m.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
