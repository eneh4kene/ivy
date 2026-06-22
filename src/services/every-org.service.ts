/**
 * Every.org integration — charity payment layer
 *
 * Every.org is a nonprofit giving platform that supports 1M+ US and UK charities.
 * Ivy uses it to dispatch accumulated wallet donations monthly in batches.
 *
 * Setup required:
 * - Create an account at every.org/charity-api
 * - Create an API Key (pk_live_...) and API Secret (sk_live_...) in the dashboard
 * - Set EVERY_ORG_API_KEY and EVERY_ORG_API_SECRET in environment
 *
 * Donation flow:
 * 1. User completes workout → Donation record created in DB (status: PENDING)
 * 2. Monthly cron → dispatchPendingDonations() batches all PENDING records
 * 3. Grouped by charity → single Every.org API call per charity per user
 * 4. Donation records updated to DISPATCHED with Every.org reference
 */

import axios from 'axios'
import prisma from '../utils/prisma'
import logger from '../utils/logger'
import { GBP_TO_USD } from '../config/pricing'

const EVERY_ORG_BASE = 'https://api.every.org/v1'
const EVERY_ORG_DONATE_BASE = 'https://www.every.org/api/v0.2'

function getHeaders() {
  const token = Buffer.from(
    `${process.env.EVERY_ORG_API_KEY}:${process.env.EVERY_ORG_API_SECRET}`
  ).toString('base64')
  return {
    Authorization: `Basic ${token}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Beta guard: while Stripe runs in TEST mode no real money is collected from
 * users (holds/captures are simulated with the 4242 card), so we must NOT push
 * real donations to Every.org. Gating on the Stripe key means dispatch resumes
 * automatically the moment we flip to live keys at conversion — no code change.
 */
function isStripeTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test')
}

export async function searchNonprofit(query: string): Promise<EveryOrgNonprofit[]> {
  if (!process.env.EVERY_ORG_API_KEY || !process.env.EVERY_ORG_API_SECRET) return []
  try {
    const res = await axios.get(`${EVERY_ORG_BASE}/search`, {
      params: { q: query, causes: 'any' },
      headers: getHeaders(),
    })
    return res.data?.nonprofits ?? []
  } catch (err) {
    logger.error('Every.org search failed:', err)
    return []
  }
}

export async function getNonprofit(slug: string): Promise<EveryOrgNonprofit | null> {
  if (!process.env.EVERY_ORG_API_KEY || !process.env.EVERY_ORG_API_SECRET) return null
  try {
    const res = await axios.get(`${EVERY_ORG_BASE}/nonprofits/${slug}`, {
      headers: getHeaders(),
    })
    return res.data?.nonprofit ?? null
  } catch (err) {
    logger.error(`Every.org nonprofit lookup failed for ${slug}:`, err)
    return null
  }
}

/**
 * Dispatch a single donation to Every.org.
 * Called by the monthly batch — not called per-workout.
 */
export async function dispatchDonation(params: {
  everyOrgSlug: string
  amountUsd: number
  donorFirstName: string
  donorLastName: string
  donorEmail: string
  description: string
}): Promise<{ success: boolean; chargeId?: string; error?: string }> {
  if (!process.env.EVERY_ORG_API_KEY || !process.env.EVERY_ORG_API_SECRET) {
    logger.warn('Every.org not configured — donation dispatch skipped')
    return { success: false, error: 'Every.org not configured' }
  }

  // Beta: Stripe in test mode → no real money was collected → never dispatch.
  // The donation row becomes terminal (FAILED with this reason) so it is not
  // re-attempted after we convert to live keys; only post-conversion (live)
  // forfeits will dispatch for real.
  if (isStripeTestMode()) {
    logger.info(
      `Beta (Stripe test mode): skipping real Every.org dispatch to ${params.everyOrgSlug} for ${params.amountUsd} USD`
    )
    return { success: false, error: 'Skipped: Stripe in test mode (beta) — no real money moved' }
  }

  try {
    const res = await axios.post(
      `${EVERY_ORG_DONATE_BASE}/nonprofits/${params.everyOrgSlug}/donate`,
      {
        amount: params.amountUsd,
        currency: 'usd',
        firstName: params.donorFirstName,
        lastName: params.donorLastName,
        email: params.donorEmail,
        description: params.description,
        partnerDonationId: `ivy-${Date.now()}`,
      },
      { headers: getHeaders() }
    )
    return { success: true, chargeId: res.data?.chargeId }
  } catch (err: any) {
    logger.error(`Every.org dispatch failed for ${params.everyOrgSlug}:`, err?.response?.data ?? err)
    return { success: false, error: err?.message }
  }
}

/**
 * Monthly batch: dispatch all PENDING donations grouped by user + charity.
 * Called by cron on the 1st of each month.
 */
type DonationWithRelations = Awaited<ReturnType<typeof prisma.donation.findMany<{
  include: { user: { select: { firstName: true; lastName: true; email: true; currency: true } }; charity: { select: { name: true; everyOrgSlug: true } } }
}>>>[number]

async function _dispatchDonationList(pending: DonationWithRelations[]): Promise<void> {
  const groups = new Map<string, DonationWithRelations[]>()
  for (const d of pending) {
    const key = `${d.userId}:${d.charityId}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(d)
  }

  for (const [, donations] of groups) {
    const first = donations[0]
    if (!first.charity.everyOrgSlug) {
      logger.warn(`Charity ${first.charityId} has no everyOrgSlug — skipping`)
      continue
    }

    const totalInCurrency = donations.reduce((sum, d) => sum + Number(d.amount), 0)
    // Every.org accepts USD; convert from the user's stored currency
    const totalUsd = first.user.currency === 'USD'
      ? totalInCurrency
      : totalInCurrency * GBP_TO_USD

    const result = await dispatchDonation({
      everyOrgSlug: first.charity.everyOrgSlug,
      amountUsd: Math.round(totalUsd * 100) / 100,
      donorFirstName: first.user.firstName,
      donorLastName: first.user.lastName ?? '',
      donorEmail: first.user.email,
      description: `Ivy accountability wallet — ${donations.length} completions`,
    })

    const ids = donations.map((d) => d.id)

    if (result.success) {
      await prisma.donation.updateMany({
        where: { id: { in: ids } },
        data: { dispatchStatus: 'DISPATCHED', everyOrgChargeId: result.chargeId },
      })
      logger.info(`Dispatched ${totalInCurrency.toFixed(2)} ${first.user.currency} (${totalUsd.toFixed(2)} USD) to ${first.charity.name} (${result.chargeId})`)
    } else {
      await prisma.donation.updateMany({
        where: { id: { in: ids } },
        data: { dispatchStatus: 'FAILED', dispatchError: result.error },
      })
      logger.error(`Dispatch failed for ${first.charity.name}: ${result.error}`)
    }
  }
}

/**
 * Dispatch all pending donations for a single user.
 * Called when a user makes their first real payment.
 */
export async function dispatchPendingDonationsForUser(userId: string): Promise<void> {
  const pending = await prisma.donation.findMany({
    where: { userId, dispatchStatus: 'PENDING' },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, currency: true } },
      charity: { select: { name: true, everyOrgSlug: true } },
    },
  })
  if (pending.length > 0) {
    await _dispatchDonationList(pending)
    logger.info(`Dispatched ${pending.length} accumulated donations for user ${userId} on first payment`)
  }
}

/**
 * Monthly batch: dispatch all PENDING donations for paying users only.
 * Pilot/free users (hasPaid = false) are skipped — their donations accumulate
 * and are dispatched via dispatchPendingDonationsForUser on first real payment.
 */
export async function dispatchPendingDonations(): Promise<void> {
  const pending = await prisma.donation.findMany({
    where: { dispatchStatus: 'PENDING', user: { hasPaid: true } },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, currency: true } },
      charity: { select: { name: true, everyOrgSlug: true } },
    },
  })

  if (pending.length === 0) {
    logger.info('Every.org dispatch: no pending donations')
    return
  }

  logger.info(`Every.org dispatch: ${pending.length} donations for paying users`)
  await _dispatchDonationList(pending)
}

export interface EveryOrgNonprofit {
  ein: string
  slug: string
  name: string
  description: string
  websiteUrl?: string
  logoUrl?: string
  location?: string
  nteeCode?: string
}
