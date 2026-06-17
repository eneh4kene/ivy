/**
 * Storage Service — Cloudflare R2 object storage for voice-note audio.
 *
 * R2 is S3-compatible, so we use the standard @aws-sdk/client-s3 library
 * pointing at Cloudflare's S3-compatible endpoint instead of AWS.
 *
 * Required env vars (all optional — service no-ops gracefully when absent):
 *   R2_ACCOUNT_ID        — Cloudflare account ID (from R2 dashboard)
 *   R2_ACCESS_KEY_ID     — R2 API token Access Key ID
 *   R2_SECRET_ACCESS_KEY — R2 API token Secret Access Key
 *   R2_BUCKET            — bucket name (e.g. "ivy-voice-notes")
 *
 * When any of those vars are unset the service logs a one-time warning and
 * returns null from every function, so the rest of the app keeps running.
 *
 * Presigned URLs expire after PRESIGN_TTL_SECONDS (default: 3 600 s / 1 hour).
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import logger from '../utils/logger'

// ── Config ────────────────────────────────────────────────────────────────────

const PRESIGN_TTL_SECONDS = 3_600 // 1 hour

function isConfigured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
  )
}

// Lazy singleton — only created when env vars are present.
let _client: S3Client | null = null

function getClient(): S3Client {
  if (!_client) {
    const accountId = process.env.R2_ACCOUNT_ID!
    _client = new S3Client({
      region: 'auto', // R2 ignores region but the SDK requires a value
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  }
  return _client
}

// ── Exported functions ────────────────────────────────────────────────────────

/**
 * Upload a voice-note audio buffer to R2.
 *
 * @param buffer      Raw audio bytes (from multer memoryStorage)
 * @param key         Object key, e.g. "voice-notes/<userId>/<vnId>.webm"
 * @param contentType MIME type, e.g. "audio/webm"
 * @returns The stored object key on success, or null if R2 is not configured.
 */
export async function uploadVoiceNote(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string | null> {
  if (!isConfigured()) {
    logger.warn('[StorageService] R2 env vars not set — skipping audio upload. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET to enable.')
    return null
  }

  const bucket = process.env.R2_BUCKET!
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  })

  await getClient().send(cmd)
  logger.info(`[StorageService] Uploaded voice note to R2: ${key} (${buffer.byteLength} bytes)`)
  return key
}

/**
 * Generate a short-lived presigned GET URL so the owner can replay their VN.
 *
 * @param key  Object key returned by uploadVoiceNote()
 * @returns    A presigned URL string valid for PRESIGN_TTL_SECONDS, or null
 *             if R2 is not configured or the key is falsy.
 */
export async function getVoiceNotePlaybackUrl(key: string | null | undefined): Promise<string | null> {
  if (!key) return null
  if (!isConfigured()) {
    logger.warn('[StorageService] R2 env vars not set — cannot generate presigned URL.')
    return null
  }

  const bucket = process.env.R2_BUCKET!
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key })
  const url = await getSignedUrl(getClient(), cmd, { expiresIn: PRESIGN_TTL_SECONDS })
  logger.info(`[StorageService] Presigned URL generated for key: ${key}`)
  return url
}

// Exported for tests that need to reset the singleton between cases
export function _resetClientForTests(): void {
  _client = null
}
