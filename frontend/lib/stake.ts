/**
 * Stake helpers — the "default-on + one-tap" policy.
 *
 * Paid (non-FREE, non-COACH) users are expected to have a stake. The app-entry
 * gate (see HomeScreen) nudges a paid user with no stake into /stake-setup. They
 * are never forced: the wizard offers a one-tap activate, a £7 minimum valve, and
 * a "not now" escape that defers the gate for the rest of the session and surfaces
 * a persistent re-nudge on home instead.
 */

import { paymentsApi, stakeApi } from './api'
import type { StakeSetupState } from './mock/stake-setup'
import type { User } from './types'

// Tiers that participate in the stake mechanic. FREE has no stake; COACH bills a
// flat fee and never stakes. ELITE/CONCIERGE are retired but kept for old rows.
const STAKING_TIERS: ReadonlySet<string> = new Set(['PRO', 'ELITE', 'CONCIERGE', 'B2B'])

/**
 * True when a paid, onboarded user has not yet set a weekly stake. Prisma
 * serialises the Decimal as a string, so we treat presence (not exact value) —
 * any null/empty/≤0 amount counts as "no stake set".
 */
export function needsStakeSetup(user: User | null | undefined): boolean {
  if (!user) return false
  if (!user.isOnboarded) return false
  if (!STAKING_TIERS.has(user.subscriptionTier)) return false
  const amt = user.stakeWeeklyAmount
  return amt == null || amt === '' || Number(amt) <= 0
}

// ─── Session-scoped gate defer ──────────────────────────────────────────────
// If a user backs out of the gated setup, we don't want to trap them in a
// redirect loop. We remember the defer for the browser session only — next
// session (or after they actually set a stake) the gate fires again.

const STAKE_GATE_DEFERRED_KEY = 'ivy_stake_gate_deferred'

export function hasDeferredStakeGate(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(STAKE_GATE_DEFERRED_KEY) === '1'
}

export function deferStakeGate(): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(STAKE_GATE_DEFERRED_KEY, '1')
}

export function clearDeferredStakeGate(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(STAKE_GATE_DEFERRED_KEY)
}

/**
 * Persist the stake config and ensure a reusable card is on file.
 *
 *  1. stakeApi.saveConfig(...) — makes the user eligible for the weekly
 *     openStakeCycle cron. Validation errors propagate to the caller.
 *  2. paymentsApi.createCheckoutSession('PRO') — subscription checkout, which
 *     saves a reusable card. The backend returns `alreadySubscribed: true` when a
 *     card is already on file (re-configuring a stake), or a Checkout `url` for a
 *     new card.
 *
 * Returns `{ redirected: true }` when the browser is being sent to Stripe
 * Checkout (the caller should stop and let navigation happen).
 *
 * IMPORTANT: this NEVER fakes success. If checkout can't be started and the user
 * has no card on file, it throws — the caller must surface the error rather than
 * march the user onto the home screen with no subscription (the old silent-catch
 * bug that left new users with a dead app and no stake).
 */
/**
 * Complete stake setup with NO money on the line.
 *
 * This route is the only writer of armingWindowStart/End, and the arming loop
 * selects purely on that window — so "Not now" (which just set a session flag
 * and redirected) left the user with no window at all: no morning VN prompt, no
 * reminders, no daily loop. Skipping the stake meant skipping the product, which
 * made a stake mandatory in practice however optional the copy said it was.
 *
 * Saves the window and forfeit destination with a null stake, and deliberately
 * does NOT open checkout — the whole point is that no card is required. Money
 * stays a lever they can add later, offered when they're actually struggling.
 */
export async function startWithoutStake(state: StakeSetupState): Promise<{ redirected: boolean }> {
  await stakeApi.saveConfig({
    stakeWeeklyAmount: null,
    // Required by the API and harmless with no stake: it only decides where a
    // forfeit would go, and with nothing at risk nothing is ever forfeited.
    forfeitMode: 'MIDDLE',
    dislikedCharityId: null,
    preferredCharityId: state.successCharityId,
    armingWindowStart: state.armingWindowStart,
    armingWindowEnd: state.armingWindowEnd,
  })

  // The stake is optional; the SUBSCRIPTION is not. Saving a window without
  // subscribing leaves the member on FREE, and FREE is excluded from the arming
  // loop and the evening call — so they would finish setup with a configured
  // ritual and still get nothing. That is the exact dead end this path was
  // written to remove, one layer up.
  //
  // Checkout collects no card when the total is zero (payment_method_collection:
  // 'if_required'), so a beta member on a 100%-off code passes straight through.
  const res = await paymentsApi.createCheckoutSession('PRO')
  if (res?.alreadySubscribed) return { redirected: false }
  if (res?.url && typeof window !== 'undefined') {
    window.location.href = res.url
    return { redirected: true }
  }
  throw new Error("We couldn't finish setting you up. Please try again.")
}

export async function activateStake(state: StakeSetupState): Promise<{ redirected: boolean }> {
  await stakeApi.saveConfig({
    stakeWeeklyAmount: state.weeklyAmount,
    forfeitMode: state.forfeitMode,
    dislikedCharityId: state.forfeitMode === 'SAVAGE' ? state.dislikedCharityId : null,
    preferredCharityId: state.successCharityId,
    armingWindowStart: state.armingWindowStart,
    armingWindowEnd: state.armingWindowEnd,
  })

  // A thrown error here propagates to the caller (no silent swallow).
  const res = await paymentsApi.createCheckoutSession('PRO')

  // Card already on file — nothing to redirect to; the stake arms off-session.
  if (res?.alreadySubscribed) return { redirected: false }

  if (res?.url && typeof window !== 'undefined') {
    window.location.href = res.url
    return { redirected: true }
  }

  // No URL and not already subscribed → checkout genuinely failed.
  throw new Error("We couldn't start checkout, so your stake isn't active yet. Please try again.")
}
