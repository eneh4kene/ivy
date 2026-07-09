'use client'

/**
 * Persistent bottom tab bar for the coach console — mirrors the consumer
 * BottomNav so the coach PWA feels like the same product, not an admin panel.
 * Four destinations: Console, Clients, Chat (Ivy), Settings.
 *
 * Rendered once via the (console) layout so every coach surface shares the
 * chrome. The Chat tab carries the same unread badge as the consumer app —
 * ponder summaries and slip alerts land there.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Users, MessageCircle, Settings } from 'lucide-react'
import { useChatUnread } from '@/lib/hooks/useChatUnread'

type Tab = {
  href: string
  label: string
  icon: typeof LayoutGrid
  match: string[]
}

const TABS: Tab[] = [
  { href: '/coach', label: 'Console', icon: LayoutGrid, match: ['/coach'] },
  { href: '/coach/clients', label: 'Clients', icon: Users, match: ['/coach/clients'] },
  { href: '/coach/chat', label: 'Ivy', icon: MessageCircle, match: ['/coach/chat'] },
  { href: '/coach/settings', label: 'Settings', icon: Settings, match: ['/coach/settings'] },
]

export function CoachNav() {
  const pathname = usePathname()
  const unread = useChatUnread()

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-ink-700/60 bg-ink-900/85 backdrop-blur-xl safe-bottom"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {TABS.map((tab) => {
          // /coach is a prefix of every coach route — exact-match it so it
          // doesn't light up on /coach/clients etc.
          const active = tab.href === '/coach'
            ? pathname === '/coach'
            : tab.match.some((m) => pathname === m || pathname.startsWith(`${m}/`))
          const Icon = tab.icon
          const showBadge = tab.href === '/coach/chat' && unread > 0
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-1 py-2.5 transition-colors ${
                  active ? 'text-gold-400' : 'text-ink-400 hover:text-ink-200'
                }`}
              >
                <span className="relative">
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
                  {showBadge && (
                    <span className="absolute -right-1.5 -top-1 min-w-[15px] rounded-full bg-ember-400 px-1 text-center text-[9px] font-bold leading-[15px] text-ink-900">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
                {active && (
                  <span className="absolute -top-px h-0.5 w-7 rounded-full bg-gold-400" />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
