'use client'

/**
 * useVisualViewport
 *
 * Tracks the iOS/Android visual viewport — the part of the screen that remains
 * visible when the software keyboard slides up. Use this to pin the chat input
 * bar above the keyboard instead of letting it scroll off-screen.
 *
 * Usage:
 *   const { height, offsetTop, isKeyboardOpen } = useVisualViewport()
 *
 *   Apply `paddingBottom` = window.innerHeight - height to the scroll container
 *   so the last message is never hidden behind the keyboard.
 *
 * Strategy (aligns with §1e of product-pricing-rework.md):
 *   - Subscribe to `visualViewport` resize + scroll events (fires on iOS 13+).
 *   - Fall back gracefully on browsers that don't support the API.
 *   - The input bar is absolutely positioned: bottom = window.innerHeight - height.
 *     This means it "hugs" the top of the keyboard at all times.
 */

import { useState, useEffect, useCallback, useRef } from 'react'

interface ViewportState {
  /** Height of the visible viewport (shrinks when keyboard opens) */
  height: number
  /** Pixels the viewport has scrolled from the top (usually 0) */
  offsetTop: number
  /** Width of visible viewport */
  width: number
  /** True when height is notably smaller than window.innerHeight */
  isKeyboardOpen: boolean
  /**
   * The bottom inset to apply to a sticky input bar.
   * = max(window.innerHeight - height, safeAreaBottom)
   */
  keyboardOffset: number
}

function getSafeAreaBottom(): number {
  if (typeof window === 'undefined') return 0
  // CSS env(safe-area-inset-bottom) in pixels — available after first paint
  try {
    const el = document.createElement('div')
    el.style.height = 'env(safe-area-inset-bottom, 0px)'
    el.style.position = 'absolute'
    el.style.visibility = 'hidden'
    document.body.appendChild(el)
    const h = el.getBoundingClientRect().height
    document.body.removeChild(el)
    return h
  } catch {
    return 0
  }
}

const KEYBOARD_THRESHOLD = 120 // px difference that implies keyboard is open

export function useVisualViewport(): ViewportState {
  const safeAreaBottom = useRef<number>(0)

  const getState = useCallback((): ViewportState => {
    if (typeof window === 'undefined') {
      return { height: 0, offsetTop: 0, width: 0, isKeyboardOpen: false, keyboardOffset: 0 }
    }

    const vv = window.visualViewport
    const winH = window.innerHeight

    const height    = vv ? vv.height    : winH
    const offsetTop = vv ? vv.offsetTop : 0
    const width     = vv ? vv.width     : window.innerWidth

    const diff = winH - height
    const isKeyboardOpen = diff > KEYBOARD_THRESHOLD

    // keyboard offset = how much to push the input bar up
    const keyboardOffset = isKeyboardOpen
      ? Math.max(diff - safeAreaBottom.current, 0)
      : safeAreaBottom.current

    return { height, offsetTop, width, isKeyboardOpen, keyboardOffset }
  }, [])

  const [state, setState] = useState<ViewportState>(() => {
    if (typeof window === 'undefined') {
      return { height: 0, offsetTop: 0, width: 0, isKeyboardOpen: false, keyboardOffset: 0 }
    }
    return getState()
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Measure safe area once DOM is ready
    safeAreaBottom.current = getSafeAreaBottom()

    const update = () => setState(getState())

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', update, { passive: true })
      window.visualViewport.addEventListener('scroll', update, { passive: true })
    } else {
      // Fallback: listen to window resize (less accurate but covers most cases)
      window.addEventListener('resize', update, { passive: true })
    }

    // Initial measurement
    update()

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', update)
        window.visualViewport.removeEventListener('scroll', update)
      } else {
        window.removeEventListener('resize', update)
      }
    }
  }, [getState])

  return state
}
