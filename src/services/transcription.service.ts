import OpenAI, { toFile } from 'openai';
import axios from 'axios';
import logger from '../utils/logger';
import { logUsage } from './usage.service';

class TranscriptionService {
  private client: OpenAI | null = null;

  private get openai(): OpenAI {
    if (!this.client) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not set');
      }
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return this.client;
  }

  /**
   * Download a Telegram voice note by file_id and transcribe it via Whisper.
   * Returns the transcribed text, or null if the file is empty/silent.
   * durationSeconds: from message.voice.duration — used for cost logging.
   */
  async transcribeTelegramVoice(fileId: string, durationSeconds?: number): Promise<string | null> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN is not set');

    // Resolve the file path from Telegram
    const fileInfoRes = await axios.get<{ result: { file_path: string } }>(
      `https://api.telegram.org/bot${botToken}/getFile`,
      { params: { file_id: fileId } }
    );
    const filePath = fileInfoRes.data.result.file_path;

    // Download the OGG/Opus audio buffer
    const audioRes = await axios.get<ArrayBuffer>(
      `https://api.telegram.org/file/bot${botToken}/${filePath}`,
      { responseType: 'arraybuffer' }
    );
    const buffer = Buffer.from(audioRes.data);

    logger.info(`Transcribing Telegram voice note: ${filePath} (${buffer.byteLength} bytes)`);

    const file = await toFile(buffer, 'voice.ogg', { type: 'audio/ogg' });
    const result = await this.openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    });

    // Log cost — use provided duration; fall back to estimating from buffer size (~16KB/min for OGG)
    const durationMins = durationSeconds != null
      ? durationSeconds / 60
      : buffer.byteLength / (16 * 1024 * 60);
    logUsage('openai', 'whisper', durationMins).catch(() => {});

    const text = result.text?.trim();
    return text || null;
  }
}

export default new TranscriptionService();
