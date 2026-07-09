'use client'

/**
 * /coach/chat — the coach's text line to Ivy, same thread UI as the consumer
 * app. Server-side the reply is coach-aware (roster brief + programme-change
 * extraction), so "move Tom to 3x a week" gets applied and confirmed, and
 * slip alerts / ponder summaries land in this same thread.
 */

import { ChatScreen } from '@/components/chat/ChatScreen'

export default function CoachChatPage() {
  return <ChatScreen />
}
