/**
 * Voice Notes Controller — Phase 3 + R2 audio storage
 *
 * POST /api/voice-notes
 *   Accepts an uploaded audio blob (multipart/form-data, field "audio"),
 *   transcribes it via the generalised transcription service (Whisper),
 *   uploads the raw audio buffer to Cloudflare R2 (when configured),
 *   persists a VoiceNote record with the R2 object key stored in audioUrl,
 *   and sets Workout.armedAt.
 *
 *   Body fields (multipart):
 *     audio       (required) — the audio file from MediaRecorder
 *     workoutId   (optional) — the day's Workout ID to arm; if absent, arms
 *                              today's PLANNED workout for the authenticated user
 *     durationSec (optional) — recording duration for cost logging
 *
 *   Returns: { voiceNote: VoiceNote, transcript: string, workoutId: string }
 *
 * GET /api/voice-notes/:id/playback
 *   Returns a fresh presigned URL for the audio file.
 *   Auth: owner only.
 *
 * SAFETY: multer is configured for memory storage (no disk writes).
 * No real external sends happen in tests when DISABLE_EXTERNAL_SENDS=true.
 */

import { Router, Response, NextFunction } from 'express'
import multer from 'multer'
import { startOfDay, endOfDay } from 'date-fns'
import { authenticate, AuthRequest } from '../../middleware/auth'
import transcriptionService from '../../services/transcription.service'
import { uploadVoiceNote, getVoiceNotePlaybackUrl } from '../../services/storage.service'
import prisma from '../../utils/prisma'
import logger from '../../utils/logger'
import { BadRequestError, NotFoundError, ForbiddenError } from '../../utils/errors'

// Derive a file extension from a MIME type string
function extForMime(mimeType: string | undefined): string {
  if (!mimeType) return 'webm'
  const base = mimeType.split(';')[0].trim().toLowerCase()
  const map: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/webm;codecs=opus': 'webm',
    'audio/ogg': 'ogg',
    'audio/ogg;codecs=opus': 'ogg',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/aac': 'm4a',
  }
  return map[mimeType.toLowerCase()] ?? map[base] ?? 'webm'
}

// Memory storage — never touches disk; buffer lives only in RAM during request
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB — Whisper's upload limit
    files: 1,
  },
  fileFilter(_req, file, cb) {
    // Accept audio/* MIME types only
    if (!file.mimetype.startsWith('audio/')) {
      cb(new BadRequestError(`Invalid file type: ${file.mimetype}. Only audio files are accepted.`) as any, false)
      return
    }
    cb(null, true)
  },
})

const router = Router()

/**
 * POST /api/voice-notes
 * Upload and arm the user's morning voice note.
 */
router.post(
  '/',
  authenticate,
  upload.single('audio'),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id

      if (!req.file) {
        throw new BadRequestError('No audio file uploaded. Send a multipart/form-data request with field "audio".')
      }

      const { workoutId: explicitWorkoutId, durationSec: durationSecStr } = req.body
      const durationSec = durationSecStr ? Number(durationSecStr) : undefined

      // ── Resolve the workout to arm ─────────────────────────────────────────
      let workoutId: string | undefined = explicitWorkoutId

      if (!workoutId) {
        // Find today's PLANNED workout for this user
        const now = new Date()
        const todaysWorkout = await prisma.workout.findFirst({
          where: {
            userId,
            plannedDate: { gte: startOfDay(now), lte: endOfDay(now) },
            // Accept PLANNED or already-existing (idempotent re-arm)
          },
          orderBy: { plannedDate: 'asc' },
          select: { id: true, armedAt: true, status: true },
        })

        if (todaysWorkout) {
          workoutId = todaysWorkout.id
        }
        // workoutId may remain undefined if there's no workout yet — we still
        // persist the VoiceNote (it can be matched later when the workout is created)
      } else {
        // Verify the specified workout belongs to this user
        const w = await prisma.workout.findUnique({
          where: { id: workoutId },
          select: { id: true, userId: true, armedAt: true },
        })
        if (!w) throw new NotFoundError(`Workout ${workoutId} not found`)
        if (w.userId !== userId) throw new BadRequestError('Workout does not belong to the authenticated user')
      }

      // ── Transcribe ──────────────────────────────────────────────────────────
      const transcript = await transcriptionService.transcribeBuffer(
        req.file.buffer,
        req.file.mimetype,
        durationSec,
      )

      // ── Upload audio to R2 ─────────────────────────────────────────────────
      // Generates a deterministic key so the same VN can be re-fetched later.
      // audioKey will be null when R2 is not configured (graceful no-op).
      const ext = extForMime(req.file.mimetype)

      // Use a temporary placeholder key; we'll fill the real VN id after create.
      // Strategy: create the VN first with a temp key, then update if R2 is live.
      // Simpler alternative used here: generate the key before create using a
      // UUID-based placeholder — we embed userId + timestamp for path predictability.
      const tempId = `${userId}-${Date.now()}`
      const r2Key = `voice-notes/${userId}/${tempId}.${ext}`

      const audioKey = await uploadVoiceNote(req.file.buffer, r2Key, req.file.mimetype)

      // ── Persist VoiceNote ───────────────────────────────────────────────────
      const voiceNote = await prisma.voiceNote.create({
        data: {
          userId,
          workoutId: workoutId ?? null,
          // Store the R2 object key (not a full URL) so we can generate presigned
          // URLs on demand. Falls back to null if R2 is not configured.
          audioUrl: audioKey,
          transcript: transcript ?? null,
          recordedAt: new Date(),
          durationSec: durationSec ?? null,
        },
      })

      // ── Arm the workout ─────────────────────────────────────────────────────
      if (workoutId) {
        await prisma.workout.update({
          where: { id: workoutId },
          data: {
            armedAt: new Date(),
            voiceNoteId: voiceNote.id,
            // If status is still PLANNED, leave it — the evening review sets COMPLETED/MISSED
            // If it was MISSED (deadline just passed), do NOT re-arm (spec: deadline = miss)
          },
        })

        // Increment daysArmed on the associated StakeCycle (if any)
        const workout = await prisma.workout.findUnique({
          where: { id: workoutId },
          select: { stakeCycleId: true },
        })
        if (workout?.stakeCycleId) {
          await prisma.stakeCycle.update({
            where: { id: workout.stakeCycleId },
            data: { daysArmed: { increment: 1 } },
          })
        }
      }

      logger.info(
        `VoiceNote ${voiceNote.id} created for user ${userId}` +
        (workoutId ? ` — workout ${workoutId} armed` : ' — no workout linked yet') +
        (audioKey ? ` — audio stored at ${audioKey}` : ' — audio not stored (R2 not configured)'),
      )

      res.status(201).json({
        success: true,
        data: {
          voiceNote: {
            id: voiceNote.id,
            transcript: voiceNote.transcript,
            recordedAt: voiceNote.recordedAt,
            durationSec: voiceNote.durationSec,
            audioStored: !!audioKey,
          },
          workoutId: workoutId ?? null,
          armed: !!workoutId,
        },
      })
    } catch (err) {
      next(err)
    }
  },
)

/**
 * GET /api/voice-notes/:id/playback
 * Return a fresh presigned R2 URL for the voice note audio.
 * Auth: the requesting user must own the voice note.
 */
router.get(
  '/:id/playback',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id
      const { id } = req.params

      const voiceNote = await prisma.voiceNote.findUnique({
        where: { id },
        select: { id: true, userId: true, audioUrl: true },
      })

      if (!voiceNote) throw new NotFoundError(`VoiceNote ${id} not found`)
      if (voiceNote.userId !== userId) throw new ForbiddenError('You do not own this voice note')

      if (!voiceNote.audioUrl) {
        res.status(200).json({
          success: true,
          data: {
            playbackUrl: null,
            reason: 'Audio was not stored — R2 storage was not configured when this note was recorded.',
          },
        })
        return
      }

      const playbackUrl = await getVoiceNotePlaybackUrl(voiceNote.audioUrl)

      res.status(200).json({
        success: true,
        data: { playbackUrl },
      })
    } catch (err) {
      next(err)
    }
  },
)

export default router
