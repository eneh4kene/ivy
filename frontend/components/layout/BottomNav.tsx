'use client'

/**
 * Persistent bottom tab bar for the consumer PWA — the app's primary
 * navigation. Four destinations: Home, Ivy (chat), Circle, Impact.
 *
 * Rendered once via ConsumerShell so every consumer surface shares the same
 * chrome (previously each route was a standalone full-screen with no nav, which
 * is why actions ended up dumped mid-page). Uses theme-arcade tokens and respects
 * the iOS home-indicator safe area.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MessageCircle, Users, Heart } from 'lucide-react'
import { useChatUnread } from '@/lib/hooks/useChatUnread'

type Tab = {
  href: string
  label: string
  icon: typeof Home
  /** highlight when the path starts with any of these */
  match: string[]
}

const TABS: Tab[] = [
  { href: '/home', label: 'Home', icon: Home, match: ['/home'] },
  { href: '/ivy', label: 'Ivy', icon: MessageCircle, match: ['/ivy'] },
  { href: '/circles', label: 'Circle', icon: Users, match: ['/circles'] },
  { href: '/donations', label: 'Impact', icon: Heart, match: ['/donations'] },
]

export function BottomNav() {
  const pathname = usePathname()
  const unread = useChatUnread()

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-ink-700/60 bg-ink-900/85 backdrop-blur-xl safe-bottom"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {TABS.map((tab) => {
          const active = tab.match.some((m) => pathname === m || pathname.startsWith(`${m}/`))
          const Icon = tab.icon
          const showBadge = tab.href === '/ivy' && unread > 0
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
