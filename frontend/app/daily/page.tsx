'use client'

import { Suspense } from 'react'
import { DailyLoopScreen } from '@/components/daily/DailyLoopScreen'

export default function DailyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh mesh-bg flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-gold-400/30 border-t-gold-400 animate-spin" />
      </div>
    }>
      <DailyLoopScreen />
    </Suspense>
  )
}
