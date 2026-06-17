/**
 * Transcription Service — generalised Whisper wrapper.
 *
 * Supports two ingestion paths (§1e, §1c):
 *   1. PWA / uploaded blob  → transcribeBuffer(buffer, mimeType?, durationSec?)
 *      Primary path: MediaRecorder audio from the in-app VN recorder.
 *   2. Telegram file_id     → transcribeTelegramVoice(fileId, durationSec?)
 *      Stopgap path for the earliest beta only — kept working per §1e.
 *
 * Both paths call the shared _transcribeFile() helper so cost logging,
 * Whisper model selection, and empty-silence handling live in one place.
 */

import OpenAI, { toFile } from 'openai'
import axios from 'axios'
import logger from '../utils/logger'
import { logUsage } from './usage.service'

// Whisper accepts a broad set of MIME types.  Map common browser MediaRecorder
// outputs to the file extension Whisper expects when we wrap the buffer.
const MIME_TO_EXT: Record<string, string> = {
  'audio/webm':       'webm',
  'audio/webm;codecs=opus': 'webm',
  'audio/ogg':        'ogg',
  'audio/ogg;codecs=opus': 'ogg',
  'audio/mp4':        'mp4',
  'audio/mpeg':       'mp3',
  'audio/wav':        'wav',
  'audio/x-wav':      'wav',
  'audio/aac':        'm4a',
}

function extForMime(mimeType: string | undefined): string {
  if (!mimeType) return 'webm'
  const base = mimeType.split(';')[0].trim().toLowerCase()
  return MIME_TO_EXT[mimeType.toLowerCase()] ?? MIME_TO_EXT[base] ?? 'webm'
}

class TranscriptionService {
  private client: OpenAI | null = null

  private get openai(): OpenAI {
    if (!this.client) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not set')
      }
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    }
    return this.client
  }

  // ---------------------------------------------------------------------------
  // Core transcription helper (shared by both paths)
  // ---------------------------------------------------------------------------

  /**
   * Transcribe an audio buffer via Whisper.
   *
   * @param buffer      Raw audio bytes
   * @param filename    Filename with extension (e.g. "voice.ogg"); Whisper uses this
   *                    to detect the codec — choose carefully.
   * @param mimeType    MIME type string for the OpenAI File wrapper.
   * @param durationSec Duration in seconds used for cost logging; estimated from
   *                    buffer size if not provided (~16 KB/min for OGG).
   * @returns Transcribed text, or null if the audio is empty/silent.
   */
  private async _transcribeFile(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    durationSec?: number,
  ): Promise<string | null> {
    logger.info(`Transcribing audio: ${filename} (${buffer.byteLength} bytes, ${mimeType})`)

    const file = await toFile(buffer, filename, { type: mimeType })
    const result = await this.openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    })

    // Cost logging — £0.006/min; use provided duration or estimate from size
    const durationMins =
      durationSec != null
        ? durationSec / 60
        : buffer.byteLength / (16 * 1024 * 60)
    logUsage('openai', 'whisper', durationMins).catch(() => {})

    const text = result.text?.trim()
    return text || null
  }

  // ---------------------------------------------------------------------------
  // Public: PWA / uploaded blob path (primary, per §1e)
  // ---------------------------------------------------------------------------

  /**
   * Transcribe an audio buffer that was uploaded directly (PWA MediaRecorder path).
   *
   * @param buffer      Buffer from the uploaded file (e.g. req.file.buffer from multer)
   * @param mimeType    MIME type reported by the browser or multipart Content-Type
   * @param durationSec Optional known duration in seconds
   * @returns Transcribed text or null
   */
  async transcribeBuffer(
    buffer: Buffer,
    mimeType?: string,
    durationSec?: number,
  ): Promise<string | null> {
    const ext = extForMime(mimeType)
    const resolvedMime = mimeType ?? `audio/${ext}`
    return this._transcribeFile(buffer, `voice.${ext}`, resolvedMime, durationSec)
  }

  // ---------------------------------------------------------------------------
  // Public: Telegram stopgap path (kept working per §1e — beta only)
  // ---------------------------------------------------------------------------

  /**
   * Download a Telegram voice note by file_id and transcribe it via Whisper.
   * Returns the transcribed text, or null if the file is empty/silent.
   * durationSeconds: from message.voice.duration — used for cost logging.
   *
   * @deprecated  Primary path is transcribeBuffer() (PWA upload).
   *              This method is kept for the earliest beta stopgap only (§1e).
   */
  async transcribeTelegramVoice(fileId: string, durationSeconds?: number): Promise<string | null> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN is not set')

    // Resolve the file path from Telegram
    const fileInfoRes = await axios.get<{ result: { file_path: string } }>(
      `https://api.telegram.org/bot${botToken}/getFile`,
      { params: { file_id: fileId } },
    )
    const filePath = fileInfoRes.data.result.file_path

    // Download the OGG/Opus audio buffer
    const audioRes = await axios.get<ArrayBuffer>(
      `https://api.telegram.org/file/bot${botToken}/${filePath}`,
      { responseType: 'arraybuffer' },
    )
    const buffer = Buffer.from(audioRes.data)

    logger.info(`Transcribing Telegram voice note: ${filePath} (${buffer.byteLength} bytes)`)

    return this._transcribeFile(buffer, 'voice.ogg', 'audio/ogg', durationSeconds)
  }
}

export default new TranscriptionService()
