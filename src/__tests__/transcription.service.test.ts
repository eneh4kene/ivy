/**
 * Transcription Service — Unit Tests (Phase 3)
 *
 * Tests cover the generalised transcription service refactor:
 *   T1 — transcribeBuffer: calls Whisper with correct file extension for WebM
 *   T2 — transcribeBuffer: resolves correct extension for OGG codec variant
 *   T3 — transcribeBuffer: falls back to .webm for unknown MIME types
 *   T4 — transcribeBuffer: returns null for empty/silent transcriptions
 *   T5 — transcribeBuffer: logs usage after transcription
 *   T6 — transcribeTelegramVoice: downloads from Telegram and calls Whisper
 *   T7 — transcribeTelegramVoice: throws if TELEGRAM_BOT_TOKEN is not set
 *
 * OpenAI SDK and Axios are fully mocked — no real network calls.
 */

// ---------------------------------------------------------------------------
// Jest module mocks — hoisted before imports
// ---------------------------------------------------------------------------

const mockCreate = jest.fn()
const mockToFile = jest.fn()

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      audio: { transcriptions: { create: mockCreate } },
    })),
    toFile: mockToFile,
  }
})

jest.mock('axios', () => ({
  get: jest.fn(),
}))

jest.mock('../services/usage.service', () => ({
  logUsage: jest.fn().mockResolvedValue(undefined),
}))

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import axios from 'axios'
import transcriptionService from '../services/transcription.service'
import { logUsage } from '../services/usage.service'

const mockAxios = axios as jest.Mocked<typeof axios>
const mockLogUsage = logUsage as jest.MockedFunction<typeof logUsage>

beforeEach(() => {
  jest.clearAllMocks()
  process.env.OPENAI_API_KEY = 'test-key'
  process.env.TELEGRAM_BOT_TOKEN = 'test-telegram-token'

  // Default Whisper response
  mockCreate.mockResolvedValue({ text: 'I will go to the gym at 7am' })
  mockToFile.mockImplementation((buf: Buffer, filename: string, opts: any) =>
    Promise.resolve({ name: filename, type: opts?.type })
  )
})

// ---------------------------------------------------------------------------
// T1 — transcribeBuffer: WebM MIME
// ---------------------------------------------------------------------------
describe('transcribeBuffer', () => {
  it('T1: calls Whisper with webm extension for audio/webm', async () => {
    const buffer = Buffer.from('fake audio data')

    const result = await transcriptionService.transcribeBuffer(buffer, 'audio/webm', 30)

    expect(result).toBe('I will go to the gym at 7am')
    expect(mockToFile).toHaveBeenCalledWith(
      buffer,
      'voice.webm',
      expect.objectContaining({ type: 'audio/webm' }),
    )
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'whisper-1' }),
    )
  })

  // T2 — OGG codec variant
  it('T2: resolves ogg extension for audio/ogg;codecs=opus', async () => {
    const buffer = Buffer.from('ogg data')

    await transcriptionService.transcribeBuffer(buffer, 'audio/ogg;codecs=opus')

    expect(mockToFile).toHaveBeenCalledWith(
      buffer,
      'voice.ogg',
      expect.anything(),
    )
  })

  // T3 — Unknown MIME fallback
  it('T3: falls back to .webm for unknown MIME type', async () => {
    const buffer = Buffer.from('unknown codec data')

    await transcriptionService.transcribeBuffer(buffer, 'application/octet-stream')

    expect(mockToFile).toHaveBeenCalledWith(
      buffer,
      'voice.webm',
      expect.anything(),
    )
  })

  // T4 — Empty/silent returns null
  it('T4: returns null for empty transcription text', async () => {
    mockCreate.mockResolvedValue({ text: '' })

    const result = await transcriptionService.transcribeBuffer(Buffer.from('silence'), 'audio/webm')

    expect(result).toBeNull()
  })

  // T5 — Usage logged
  it('T5: logs usage after transcription', async () => {
    await transcriptionService.transcribeBuffer(Buffer.from('audio'), 'audio/webm', 60)

    // Wait a tick for the non-blocking logUsage call
    await new Promise((resolve) => setImmediate(resolve))
    expect(mockLogUsage).toHaveBeenCalledWith('openai', 'whisper', 1) // 60s = 1 min
  })
})

// ---------------------------------------------------------------------------
// T6-T7 — transcribeTelegramVoice (stopgap path)
// ---------------------------------------------------------------------------
describe('transcribeTelegramVoice', () => {
  it('T6: downloads from Telegram API and transcribes via Whisper', async () => {
    const fakeAudio = Buffer.from('ogg audio bytes')

    mockAxios.get
      .mockResolvedValueOnce({ data: { result: { file_path: 'voice/file.oga' } } })
      .mockResolvedValueOnce({ data: fakeAudio.buffer })

    const result = await transcriptionService.transcribeTelegramVoice('file-id-123', 45)

    expect(result).toBe('I will go to the gym at 7am')
    // First call: getFile
    expect(mockAxios.get).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/getFile'),
      expect.objectContaining({ params: { file_id: 'file-id-123' } }),
    )
    // Second call: download audio
    expect(mockAxios.get).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('voice/file.oga'),
      expect.objectContaining({ responseType: 'arraybuffer' }),
    )
    // Whisper called with .ogg file
    expect(mockToFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      'voice.ogg',
      expect.objectContaining({ type: 'audio/ogg' }),
    )
  })

  it('T7: throws when TELEGRAM_BOT_TOKEN is not set', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN

    await expect(
      transcriptionService.transcribeTelegramVoice('file-id')
    ).rejects.toThrow('TELEGRAM_BOT_TOKEN is not set')
  })
})
