import { Inngest } from 'inngest';
import { config } from '../config';

/**
 * Inngest client — the durable-execution backbone.
 *
 * Keys are read from the environment (INNGEST_EVENT_KEY for sending events,
 * INNGEST_SIGNING_KEY for verifying inbound calls from Inngest Cloud). In dev,
 * with no keys set, the SDK runs against the local Inngest dev server.
 *
 * The serve handler is mounted in src/app.ts at /api/inngest, so Inngest Cloud
 * invokes functions over HTTP against the API process (the publicly-reachable
 * Fly app) — no separate always-on worker required.
 */
export const inngest = new Inngest({
  id: config.inngest.appId,
  isDev: config.server.env !== 'production',
});
