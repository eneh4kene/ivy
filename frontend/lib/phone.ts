/**
 * Phone-number validation/normalisation shared by onboarding and settings.
 *
 * Mirrors the backend rule (phone-verify.service.ts): E.164 — a leading "+",
 * a country code starting 1-9, then 7-15 total digits. Keeping this in sync
 * with the server means the user gets the same verdict instantly, before any
 * round-trip, instead of a generic "invalid" after submit.
 */

// Strip spaces, dashes, parens and dots; keep a single leading "+".
export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-().]/g, '')
  return cleaned.startsWith('+') ? cleaned : cleaned ? `+${cleaned}` : ''
}

// Matches backend: "+" then country code 1-9 then 6-14 more digits (7-15 total).
const E164 = /^\+[1-9]\d{6,14}$/

export interface PhoneCheck {
  valid: boolean
  /** A user-facing reason, only when the field is non-empty and invalid. */
  error: string | null
}

export function checkPhone(raw: string): PhoneCheck {
  const trimmed = raw.trim()
  if (!trimmed) return { valid: false, error: null }

  const normalized = normalizePhone(trimmed)

  // Anything other than digits after an optional leading "+"
  if (/[^\d+]/.test(trimmed.replace(/[\s\-().]/g, '')) || /\+/.test(normalized.slice(1))) {
    return { valid: false, error: 'Use only numbers and a single leading +' }
  }
  if (!trimmed.replace(/[\s\-().]/g, '').startsWith('+')) {
    return { valid: false, error: 'Start with your country code, e.g. +44 or +1' }
  }
  if (/^\+0/.test(normalized)) {
    return { valid: false, error: 'Drop the leading 0 — use your country code, e.g. +44' }
  }

  const digits = normalized.replace(/\D/g, '')
  if (digits.length < 7) return { valid: false, error: 'That number looks too short' }
  if (digits.length > 15) return { valid: false, error: 'That number looks too long' }

  if (!E164.test(normalized)) {
    return { valid: false, error: 'Enter a valid phone number with country code' }
  }
  return { valid: true, error: null }
}

export function isValidPhone(raw: string): boolean {
  return checkPhone(raw).valid
}
