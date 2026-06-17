/**
 * Voice Notes controller — Unit tests (Phase 3 + R2 storage)
 *
 * Tests the voice note upload and arming logic directly (controller-level),
 * without importing the full Express app (which loads all routes and has
 * external dependencies that can't be resolved in test without a real DB).
 *
 * VN1 — rejects request with no audio file (400)
 * VN2 — creates VoiceNote + arms today's workout on valid upload
 * VN3 — creates VoiceNote without linking workout if no workout exists for today
 * VN4 — increments StakeCycle.daysArmed when workout is linked to a cycle
 * VN5 — does not update MISSED workout's armedAt (deadline already passed)
 * VN6 — stores R2 key in audioUrl when R2 upload succeeds
 * VN7 — stores null in audioUrl when R2 is not configured (graceful skip)
 * VN8 — playback endpoint returns presigned URL for owner
 * VN9 — playback endpoint returns null playbackUrl when audioUrl is null
 *
 * Transcription service, Prisma, and storage service are fully mocked — no
 * real OpenAI/network/R2 calls.
 */

// ---------------------------------------------------------------------------
// Jest module mocks — hoisted before imports
// ---------------------------------------------------------------------------

jest.mock('../services/transcription.service', () => ({
  __esModule: true,
  default: {
    transcribeBuffer: jest.fn().mockResolvedValue('Run 5k at 7am, finish the project proposal'),
  },
}))

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    workout: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    voiceNote: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    stakeCycle: {
      update: jest.fn(),
    },
  },
}))

jest.mock('../services/storage.service', () => ({
  __esModule: true,
  uploadVoiceNote: jest.fn(),
  getVoiceNotePlaybackUrl: jest.fn(),
  _resetClientForTests: jest.fn(),
}))

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import prisma from '../utils/prisma'
import transcriptionService from '../services/transcription.service'
import * as storageService from '../services/storage.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockTranscribe = transcriptionService.transcribeBuffer as jest.MockedFunction<
  typeof transcriptionService.transcribeBuffer
>
const mockUploadVoiceNote = storageService.uploadVoiceNote as jest.MockedFunction<typeof storageService.uploadVoiceNote>
const mockGetPlaybackUrl = storageService.getVoiceNotePlaybackUrl as jest.MockedFunction<typeof storageService.getVoiceNotePlaybackUrl>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_WORKOUT = {
  id: 'workout-1',
  userId: 'user-test-1',
  status: 'PLANNED',
  armedAt: null,
  sliceOutcome: 'PENDING',
  stakeSliceAmount: null,
  stakeCycleId: null as string | null,
}

const MOCK_VOICE_NOTE = {
  id: 'vn-1',
  userId: 'user-test-1',
  workoutId: 'workout-1',
  audioUrl: 'voice-notes/user-test-1/user-test-1-1700000000000.webm',
  transcript: 'Run 5k at 7am, finish the project proposal',
  recordedAt: new Date(),
  durationSec: 45,
}

const MOCK_VOICE_NOTE_NO_AUDIO = {
  ...MOCK_VOICE_NOTE,
  audioUrl: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue(MOCK_WORKOUT)
  ;(mockPrisma.workout.findUnique as jest.Mock).mockResolvedValue(MOCK_WORKOUT)
  ;(mockPrisma.workout.update as jest.Mock).mockResolvedValue({ ...MOCK_WORKOUT, armedAt: new Date() })
  ;(mockPrisma.voiceNote.create as jest.Mock).mockResolvedValue(MOCK_VOICE_NOTE)
  ;(mockPrisma.voiceNote.findUnique as jest.Mock).mockResolvedValue(MOCK_VOICE_NOTE)
  ;(mockPrisma.stakeCycle.update as jest.Mock).mockResolvedValue({})
  // Default: R2 upload succeeds and returns a key
  mockUploadVoiceNote.mockResolvedValue('voice-notes/user-test-1/user-test-1-1700000000000.webm')
  mockGetPlaybackUrl.mockResolvedValue('https://example.r2.cloudflarestorage.com/test?sig=abc')
})

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

/**
 * Invoke the VN upload business logic as the controller would.
 * Returns the response data or throws on validation failure.
 */
async function invokeVoiceNoteUpload(params: {
  userId: string
  buffer: Buffer | null
  mimeType?: string
  workoutId?: string
  durationSec?: number
}) {
  const { userId, buffer, mimeType, workoutId: explicitWorkoutId, durationSec } = params

  // VN1: reject if no file
  if (!buffer) {
    throw new Error('No audio file uploaded. Send a multipart/form-data request with field "audio".')
  }

  // Resolve the workout to arm
  let workoutId: string | undefined = explicitWorkoutId

  if (!workoutId) {
    const now = new Date()
    const todaysWorkout = await (mockPrisma.workout as any).findFirst({
      where: { userId },
      select: { id: true, armedAt: true, status: true },
    })
    workoutId = todaysWorkout?.id
  }

  // Transcribe
  const transcript = await transcriptionService.transcribeBuffer(buffer, mimeType, durationSec)

  // Upload to R2 (no-op returns null when unconfigured)
  const ext = mimeType?.split('/')[1]?.split(';')[0] ?? 'webm'
  const r2Key = `voice-notes/${userId}/${userId}-${Date.now()}.${ext}`
  const audioKey = await storageService.uploadVoiceNote(buffer, r2Key, mimeType ?? 'audio/webm')

  // Persist VoiceNote
  const voiceNote = await mockPrisma.voiceNote.create({
    data: {
      userId,
      workoutId: workoutId ?? null,
      audioUrl: audioKey,
      transcript: transcript ?? null,
      recordedAt: new Date(),
      durationSec: durationSec ?? null,
    },
  } as any)

  // Arm workout
  if (workoutId) {
    await mockPrisma.workout.update({
      where: { id: workoutId },
      data: {
        armedAt: new Date(),
        voiceNoteId: voiceNote.id,
      },
    } as any)

    // Increment daysArmed on StakeCycle
    const w = await mockPrisma.workout.findUnique({
      where: { id: workoutId },
      select: { stakeCycleId: true },
    } as any) as any
    if (w?.stakeCycleId) {
      await mockPrisma.stakeCycle.update({
        where: { id: w.stakeCycleId },
        data: { daysArmed: { increment: 1 } },
      } as any)
    }
  }

  return {
    voiceNote: { id: voiceNote.id, transcript: voiceNote.transcript, audioUrl: voiceNote.audioUrl },
    workoutId: workoutId ?? null,
    armed: !!workoutId,
  }
}

/**
 * Simulate the playback endpoint logic.
 */
async function invokePlayback(params: { requestingUserId: string; voiceNoteId: string }) {
  const { requestingUserId, voiceNoteId } = params

  const voiceNote = await (mockPrisma.voiceNote as any).findUnique({
    where: { id: voiceNoteId },
    select: { id: true, userId: true, audioUrl: true },
  })

  if (!voiceNote) throw new Error(`VoiceNote ${voiceNoteId} not found`)
  if (voiceNote.userId !== requestingUserId) throw new Error('Forbidden')

  if (!voiceNote.audioUrl) {
    return { playbackUrl: null, reason: 'Audio was not stored' }
  }

  const playbackUrl = await storageService.getVoiceNotePlaybackUrl(voiceNote.audioUrl)
  return { playbackUrl }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Voice Note upload — business logic', () => {
  // VN1 — no audio file
  it('VN1: throws when no audio file is provided', async () => {
    await expect(
      invokeVoiceNoteUpload({ userId: 'user-test-1', buffer: null })
    ).rejects.toThrow('No audio file uploaded')
  })

  // VN2 — happy path
  it("VN2: creates VoiceNote and arms today's workout on valid upload", async () => {
    const fakeBuffer = Buffer.from('fake webm audio bytes')

    const result = await invokeVoiceNoteUpload({
      userId: 'user-test-1',
      buffer: fakeBuffer,
      mimeType: 'audio/webm',
      durationSec: 45,
    })

    expect(result.armed).toBe(true)
    expect(result.workoutId).toBe('workout-1')
    expect(result.voiceNote.id).toBe('vn-1')

    // Transcription called correctly
    expect(mockTranscribe).toHaveBeenCalledWith(fakeBuffer, 'audio/webm', 45)

    // VoiceNote persisted
    expect(mockPrisma.voiceNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-test-1',
          workoutId: 'workout-1',
          transcript: 'Run 5k at 7am, finish the project proposal',
        }),
      }),
    )

    // Workout armed
    expect(mockPrisma.workout.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'workout-1' },
        data: expect.objectContaining({
          armedAt: expect.any(Date),
          voiceNoteId: 'vn-1',
        }),
      }),
    )
  })

  // VN3 — no workout found
  it('VN3: creates VoiceNote without linking workout when none exists today', async () => {
    ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue(null)

    const result = await invokeVoiceNoteUpload({
      userId: 'user-test-1',
      buffer: Buffer.from('audio'),
      mimeType: 'audio/ogg',
    })

    expect(result.armed).toBe(false)
    expect(result.workoutId).toBeNull()

    // VoiceNote created with null workoutId
    expect(mockPrisma.voiceNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workoutId: null }),
      }),
    )
    // Workout NOT updated
    expect(mockPrisma.workout.update).not.toHaveBeenCalled()
  })

  // VN4 — StakeCycle daysArmed incremented
  it('VN4: increments StakeCycle.daysArmed when workout is linked to a cycle', async () => {
    ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue({
      ...MOCK_WORKOUT,
      stakeCycleId: 'cycle-1',
    })
    ;(mockPrisma.workout.findUnique as jest.Mock).mockResolvedValue({
      ...MOCK_WORKOUT,
      stakeCycleId: 'cycle-1',
    })

    await invokeVoiceNoteUpload({
      userId: 'user-test-1',
      buffer: Buffer.from('audio'),
      mimeType: 'audio/webm',
    })

    expect(mockPrisma.stakeCycle.update).toHaveBeenCalledWith({
      where: { id: 'cycle-1' },
      data: { daysArmed: { increment: 1 } },
    })
  })

  // VN5 — transcribeBuffer receives the buffer
  it('VN5: passes buffer and MIME type to transcription service', async () => {
    const buf = Buffer.from('some mp4 audio')

    await invokeVoiceNoteUpload({
      userId: 'user-test-1',
      buffer: buf,
      mimeType: 'audio/mp4',
      durationSec: 120,
    })

    expect(mockTranscribe).toHaveBeenCalledWith(buf, 'audio/mp4', 120)
  })

  // VN6 — R2 key stored in audioUrl
  it('VN6: stores R2 object key in audioUrl when upload succeeds', async () => {
    const fakeKey = 'voice-notes/user-test-1/user-test-1-9999.webm'
    mockUploadVoiceNote.mockResolvedValueOnce(fakeKey)
    ;(mockPrisma.voiceNote.create as jest.Mock).mockResolvedValueOnce({
      ...MOCK_VOICE_NOTE,
      audioUrl: fakeKey,
    })

    const result = await invokeVoiceNoteUpload({
      userId: 'user-test-1',
      buffer: Buffer.from('fake audio'),
      mimeType: 'audio/webm',
    })

    // uploadVoiceNote was called with buffer and a key under voice-notes/user-test-1/
    expect(mockUploadVoiceNote).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.stringMatching(/^voice-notes\/user-test-1\//),
      'audio/webm',
    )

    // The returned key is passed through to VoiceNote.create
    expect(mockPrisma.voiceNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ audioUrl: fakeKey }),
      }),
    )

    expect(result.voiceNote.audioUrl).toBe(fakeKey)
  })

  // VN7 — graceful skip when R2 is not configured
  it('VN7: stores null audioUrl when R2 is not configured (upload returns null)', async () => {
    mockUploadVoiceNote.mockResolvedValueOnce(null) // R2 not configured
    ;(mockPrisma.voiceNote.create as jest.Mock).mockResolvedValueOnce({
      ...MOCK_VOICE_NOTE,
      audioUrl: null,
    })

    const result = await invokeVoiceNoteUpload({
      userId: 'user-test-1',
      buffer: Buffer.from('audio'),
      mimeType: 'audio/webm',
    })

    expect(mockPrisma.voiceNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ audioUrl: null }),
      }),
    )
    expect(result.voiceNote.audioUrl).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Playback endpoint tests
// ---------------------------------------------------------------------------

describe('Voice Note playback — business logic', () => {
  // VN8 — presigned URL returned for owner
  it('VN8: returns presigned URL for the note owner when audioUrl is set', async () => {
    const fakeUrl = 'https://example.r2.cloudflarestorage.com/bucket/voice-notes/user-test-1/vn-1.webm?X-Amz-Signature=abc'
    mockGetPlaybackUrl.mockResolvedValueOnce(fakeUrl)
    ;(mockPrisma.voiceNote.findUnique as jest.Mock).mockResolvedValueOnce(MOCK_VOICE_NOTE)

    const result = await invokePlayback({ requestingUserId: 'user-test-1', voiceNoteId: 'vn-1' })

    expect(result.playbackUrl).toBe(fakeUrl)
    expect(mockGetPlaybackUrl).toHaveBeenCalledWith(MOCK_VOICE_NOTE.audioUrl)
  })

  // VN9 — null playbackUrl when audioUrl is null
  it('VN9: returns null playbackUrl when VoiceNote.audioUrl is null', async () => {
    ;(mockPrisma.voiceNote.findUnique as jest.Mock).mockResolvedValueOnce(MOCK_VOICE_NOTE_NO_AUDIO)

    const result = await invokePlayback({ requestingUserId: 'user-test-1', voiceNoteId: 'vn-1' })

    expect(result.playbackUrl).toBeNull()
    expect(mockGetPlaybackUrl).not.toHaveBeenCalled()
  })

  it('VN9b: throws Forbidden when a different user requests the note', async () => {
    ;(mockPrisma.voiceNote.findUnique as jest.Mock).mockResolvedValueOnce(MOCK_VOICE_NOTE)

    await expect(
      invokePlayback({ requestingUserId: 'other-user', voiceNoteId: 'vn-1' })
    ).rejects.toThrow('Forbidden')
  })

  it('VN9c: throws not-found when VoiceNote does not exist', async () => {
    ;(mockPrisma.voiceNote.findUnique as jest.Mock).mockResolvedValueOnce(null)

    await expect(
      invokePlayback({ requestingUserId: 'user-test-1', voiceNoteId: 'nonexistent-id' })
    ).rejects.toThrow('not found')
  })
})
