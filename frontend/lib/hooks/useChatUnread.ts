'use client'

/**
 * Unread Ivy-chat message count, surfaced as the badge on the Ivy bottom-nav tab.
 *
 * Polls chatApi.getUnreadCount on a light interval and refetches on window focus
 * and the custom 'ivy-chat-read' event (dispatched when the thread is opened so
 * the badge clears immediately). Returns 0 for signed-out users / on error so the
 * nav never breaks.
 */

import { useEffect, useState } from 'react'
import { chatApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth.store'

const POLL_MS = 60_000

export function useChatUnread(): number {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isAuthenticated) {
      setCount(0)
      return
    }

    let active = true
    const refresh = () => {
      chatApi
        .getUnreadCount()
        .then((c) => active && setCount(c))
        .catch(() => active && setCount(0))
    }

    refresh()
    const interval = setInterval(refresh, POLL_MS)
    window.addEventListener('focus', refresh)
    window.addEventListener('ivy-chat-read', refresh)

    return () => {
      active = false
      clearInterval(interval)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('ivy-chat-read', refresh)
    }
  }, [isAuthenticated])

  return count
}
