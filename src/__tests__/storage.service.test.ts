/**
 * Storage Service — Unit tests
 *
 * S1 — uploadVoiceNote: returns object key and calls PutObjectCommand when R2 configured
 * S2 — uploadVoiceNote: returns null (no-op) when R2 env vars are unset
 * S3 — getVoiceNotePlaybackUrl: returns a presigned URL string when R2 configured
 * S4 — getVoiceNotePlaybackUrl: returns null when R2 env vars are unset
 * S5 — getVoiceNotePlaybackUrl: returns null for falsy key even when R2 is configured
 *
 * The @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner packages are fully
 * mocked — no real network calls are made.
 */

// ---------------------------------------------------------------------------
// Mock AWS SDK before imports
// ---------------------------------------------------------------------------

const mockSend = jest.fn()
const mockGetSignedUrl = jest.fn()

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ _input: input, _type: 'PutObjectCommand' })),
    GetObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ _input: input, _type: 'GetObjectCommand' })),
  }
})

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}))

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { uploadVoiceNote, getVoiceNotePlaybackUrl, _resetClientForTests } from '../services/storage.service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const R2_VARS = {
  R2_ACCOUNT_ID: 'test-account-id',
  R2_ACCESS_KEY_ID: 'test-access-key',
  R2_SECRET_ACCESS_KEY: 'test-secret-key',
  R2_BUCKET: 'test-bucket',
}

function setR2Env(vars: Partial<typeof R2_VARS> = R2_VARS): void {
  Object.assign(process.env, vars)
}

function clearR2Env(): void {
  delete process.env.R2_ACCOUNT_ID
  delete process.env.R2_ACCESS_KEY_ID
  delete process.env.R2_SECRET_ACCESS_KEY
  delete process.env.R2_BUCKET
}

const FAKE_BUFFER = Buffer.from('fake audio bytes for testing')
const FAKE_KEY = 'voice-notes/user-1/vn-1.webm'
const FAKE_CONTENT_TYPE = 'audio/webm'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    _resetClientForTests()
    clearR2Env()
  })

  // ── uploadVoiceNote ────────────────────────────────────────────────────────

  describe('uploadVoiceNote', () => {
    it('S1: returns the object key and calls PutObjectCommand when R2 is configured', async () => {
      setR2Env()
      mockSend.mockResolvedValueOnce({}) // PutObject success

      const result = await uploadVoiceNote(FAKE_BUFFER, FAKE_KEY, FAKE_CONTENT_TYPE)

      expect(result).toBe(FAKE_KEY)

      // PutObjectCommand was constructed with correct params
      const { PutObjectCommand } = jest.requireMock('@aws-sdk/client-s3')
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: FAKE_KEY,
        Body: FAKE_BUFFER,
        ContentType: FAKE_CONTENT_TYPE,
      })

      // S3Client.send was called once
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('S2: returns null and does NOT call send when R2 env vars are unset', async () => {
      // R2 env vars not set (clearR2Env called in beforeEach)
      const result = await uploadVoiceNote(FAKE_BUFFER, FAKE_KEY, FAKE_CONTENT_TYPE)

      expect(result).toBeNull()
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('S2b: returns null even when only some R2 env vars are set', async () => {
      // Partial config — missing R2_BUCKET
      setR2Env({ R2_ACCOUNT_ID: 'id', R2_ACCESS_KEY_ID: 'key', R2_SECRET_ACCESS_KEY: 'secret' })

      const result = await uploadVoiceNote(FAKE_BUFFER, FAKE_KEY, FAKE_CONTENT_TYPE)

      expect(result).toBeNull()
      expect(mockSend).not.toHaveBeenCalled()
    })
  })

  // ── getVoiceNotePlaybackUrl ────────────────────────────────────────────────

  describe('getVoiceNotePlaybackUrl', () => {
    it('S3: returns a presigned URL string when R2 is configured', async () => {
      setR2Env()
      const fakeUrl = 'https://test-account-id.r2.cloudflarestorage.com/test-bucket/voice-notes/user-1/vn-1.webm?X-Amz-Signature=abc'
      mockGetSignedUrl.mockResolvedValueOnce(fakeUrl)

      const result = await getVoiceNotePlaybackUrl(FAKE_KEY)

      expect(result).toBe(fakeUrl)

      // GetObjectCommand was constructed with the correct params
      const { GetObjectCommand } = jest.requireMock('@aws-sdk/client-s3')
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: FAKE_KEY,
      })

      // getSignedUrl was called with TTL
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(), // the S3Client instance
        expect.anything(), // GetObjectCommand instance
        { expiresIn: 3_600 },
      )
    })

    it('S4: returns null when R2 env vars are unset', async () => {
      // R2 env vars not set
      const result = await getVoiceNotePlaybackUrl(FAKE_KEY)

      expect(result).toBeNull()
      expect(mockGetSignedUrl).not.toHaveBeenCalled()
    })

    it('S5: returns null for a null key even when R2 is configured', async () => {
      setR2Env()

      const result = await getVoiceNotePlaybackUrl(null)

      expect(result).toBeNull()
      expect(mockGetSignedUrl).not.toHaveBeenCalled()
    })

    it('S5b: returns null for an empty string key', async () => {
      setR2Env()

      const result = await getVoiceNotePlaybackUrl('')

      expect(result).toBeNull()
      expect(mockGetSignedUrl).not.toHaveBeenCalled()
    })
  })
})
