'use client'

/**
 * Ivy chat — the in-app text channel. The thread, composer, replies and
 * onboarding action cards all live in ChatScreen; the consumer shell (bottom
 * nav, theme) is applied by app/ivy/layout.tsx.
 */

import { ChatScreen } from '@/components/chat/ChatScreen'

export default function IvyPage() {
  return <ChatScreen />
}
