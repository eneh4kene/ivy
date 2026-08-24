/**
 * Launch preflight — "is every paid dependency actually funded and authed?"
 *
 * The app being UP proves nothing about whether a call can be placed: a call
 * needs Anthropic (prompt) → Retell (voice agent) → Twilio (telephony), and any
 * one of those can sit at a zero balance while /health still returns 200. This
 * script asks each provider directly.
 *
 * Designed to run INSIDE the prod machine, because Fly secrets are write-only —
 * they can never be read back out, but they ARE env vars on the running host:
 *
 *   fly ssh console -a ivykeeps-api -C "node dist/scripts/preflight.js"
 *
 * It prints statuses and balances only. It never prints a secret value.
 */
import prisma from '../utils/prisma';

type Status = 'OK' | 'WARN' | 'FAIL' | 'SKIP';

interface Check {
  name: string;
  status: Status;
  detail: string;
}

const checks: Check[] = [];
const add = (name: string, status: Status, detail: string) =>
  checks.push({ name, status, detail });

/** Never let a probe hang the whole preflight. */
async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function checkDatabase() {
  try {
    const [users, charities, houseDefault] = await Promise.all([
      prisma.user.count(),
      prisma.charity.count({ where: { isActive: true } }),
      prisma.charity.count({ where: { isHouseDefault: true, isActive: true } }),
    ]);
    // No house-default charity means a MIDDLE-tier forfeit has nowhere to land.
    if (houseDefault === 0) {
      add('Database', 'FAIL', `connected, ${users} users, ${charities} active charities — but NO house-default charity (forfeits cannot settle)`);
    } else {
      add('Database', 'OK', `connected · ${users} users · ${charities} active charities · house-default set`);
    }
  } catch (err: any) {
    add('Database', 'FAIL', `cannot connect: ${err?.message ?? err}`);
  }
}

async function checkAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { add('Anthropic', 'FAIL', 'ANTHROPIC_API_KEY not set — every prompt will fail'); return; }
  try {
    // /v1/models is the cheapest authenticated GET; no tokens billed.
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/models?limit=1', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    });
    if (res.status === 200) add('Anthropic', 'OK', 'key valid');
    else if (res.status === 401) add('Anthropic', 'FAIL', '401 — key invalid or revoked');
    else if (res.status === 400 || res.status === 402) {
      const body = await res.text();
      add('Anthropic', 'FAIL', `${res.status} — likely out of credit: ${body.slice(0, 160)}`);
    } else if (res.status === 429) add('Anthropic', 'WARN', '429 — rate limited right now');
    else add('Anthropic', 'WARN', `unexpected HTTP ${res.status}`);
  } catch (err: any) {
    add('Anthropic', 'FAIL', `probe failed: ${err?.message ?? err}`);
  }
}

async function checkRetell() {
  const key = process.env.RETELL_API_KEY;
  if (!key) { add('Retell', 'FAIL', 'RETELL_API_KEY not set — no voice agent, no calls'); return; }
  try {
    // Agent endpoints live at the API root, not /v2 (see retell.service.ts).
    const res = await fetchWithTimeout('https://api.retellai.com/list-agents', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 200) {
      const agents = (await res.json()) as unknown[];
      add('Retell', 'OK', `key valid · ${Array.isArray(agents) ? agents.length : '?'} agents`);
    } else if (res.status === 401 || res.status === 403) {
      add('Retell', 'FAIL', `${res.status} — key invalid`);
    } else if (res.status === 402) {
      add('Retell', 'FAIL', '402 — account unfunded, calls will not connect');
    } else {
      add('Retell', 'WARN', `unexpected HTTP ${res.status}`);
    }
  } catch (err: any) {
    add('Retell', 'FAIL', `probe failed: ${err?.message ?? err}`);
  }
}

async function checkTwilio() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) { add('Twilio', 'FAIL', 'SID/auth token not set — no calls, no SMS OTP'); return; }

  const auth = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
  try {
    const acct = await fetchWithTimeout(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}.json`,
      { headers: { Authorization: auth } }
    );
    if (acct.status === 401) { add('Twilio', 'FAIL', '401 — auth token invalid (this was the old launch blocker)'); return; }
    if (acct.status !== 200) { add('Twilio', 'WARN', `account probe HTTP ${acct.status}`); return; }

    const acctJson = (await acct.json()) as { status?: string; type?: string };
    const state = acctJson.status ?? 'unknown';

    const bal = await fetchWithTimeout(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`,
      { headers: { Authorization: auth } }
    );
    let balanceStr = 'balance unavailable';
    let low = false;
    if (bal.status === 200) {
      const b = (await bal.json()) as { balance?: string; currency?: string };
      const amount = parseFloat(b.balance ?? '0');
      balanceStr = `${b.currency ?? ''} ${amount.toFixed(2)}`;
      low = amount < 20;
    }

    if (state !== 'active') add('Twilio', 'FAIL', `account status "${state}" (suspended/closed) · ${balanceStr}`);
    else if (low) add('Twilio', 'WARN', `active but LOW balance: ${balanceStr} — top up before launch`);
    else add('Twilio', 'OK', `active · ${balanceStr} · type ${acctJson.type ?? '?'}`);
  } catch (err: any) {
    add('Twilio', 'FAIL', `probe failed: ${err?.message ?? err}`);
  }
}

async function checkTwilioNumbers() {
  const uk = process.env.TWILIO_PHONE_NUMBER;
  const us = process.env.TWILIO_PHONE_NUMBER_US;
  const missing: string[] = [];
  if (!uk || /x{4,}/i.test(uk)) missing.push('UK (+44)');
  if (!us || /x{4,}/i.test(us)) missing.push('US (+1)');
  if (missing.length === 2) add('Caller IDs', 'FAIL', 'no real numbers configured (placeholders or unset)');
  else if (missing.length === 1) add('Caller IDs', 'WARN', `${missing[0]} missing — that region gets the wrong caller ID`);
  else add('Caller IDs', 'OK', 'UK + US numbers set');
}

async function checkStripeKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) { add('Stripe', 'FAIL', 'STRIPE_SECRET_KEY not set — no subscriptions, no stakes'); return; }

  const mode = key.startsWith('sk_live') ? 'LIVE' : key.startsWith('sk_test') ? 'TEST' : 'UNKNOWN';
  try {
    const res = await fetchWithTimeout('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 401) { add('Stripe', 'FAIL', '401 — secret key invalid'); return; }
    if (res.status !== 200) { add('Stripe', 'WARN', `HTTP ${res.status} (mode ${mode})`); return; }
    const b = (await res.json()) as { livemode?: boolean };
    const live = b.livemode ? 'LIVE' : 'TEST';
    add('Stripe', 'OK', `key valid · mode ${live}${mode !== 'UNKNOWN' && mode !== live ? ` (key prefix says ${mode} — mismatch!)` : ''}`);
  } catch (err: any) {
    add('Stripe', 'FAIL', `probe failed: ${err?.message ?? err}`);
  }
}

/** Independent of key validity — a dead webhook silently breaks activation. */
function checkStripeWebhook() {
  const wh = process.env.STRIPE_WEBHOOK_SECRET;
  if (!wh) add('Stripe webhook', 'FAIL', 'STRIPE_WEBHOOK_SECRET not set — subscriptions never activate, stake gate never fires');
  else add('Stripe webhook', 'OK', 'signing secret present');
}

async function checkScheduler() {
  const enabled = process.env.INNGEST_ENABLED === 'true';
  const hasKeys = !!process.env.INNGEST_EVENT_KEY && !!process.env.INNGEST_SIGNING_KEY;
  if (!enabled) {
    add('Scheduler', 'WARN', 'INNGEST_ENABLED is not "true" — legacy node-cron owns the schedule');
  } else if (!hasKeys) {
    add('Scheduler', 'FAIL', 'INNGEST_ENABLED=true but event/signing key missing — NOTHING is scheduled');
  } else {
    add('Scheduler', 'OK', 'Inngest enabled with both keys');
  }

  // Heartbeats prove the schedule is actually firing, not merely configured.
  try {
    const beats = await prisma.jobHeartbeat.findMany();
    if (beats.length === 0) {
      add('Job heartbeats', 'WARN', 'no heartbeat rows yet — no scheduled job has ever run');
    } else {
      const now = Date.now();
      const freshest = Math.min(
        ...beats.map((b) => Math.round((now - b.lastStartedAt.getTime()) / 60000))
      );
      add(
        'Job heartbeats',
        freshest < 120 ? 'OK' : 'WARN',
        `${beats.length} jobs tracked · most recent ran ${freshest} min ago`
      );
    }
  } catch (err: any) {
    add('Job heartbeats', 'WARN', `could not read heartbeats: ${err?.message ?? err}`);
  }
}

async function checkEmail() {
  const from = process.env.EMAIL_FROM ?? '';
  const host = process.env.SMTP_HOST;
  if (!host) { add('Email', 'FAIL', 'SMTP_HOST not set — magic links cannot send (this is the login path)'); return; }
  // The June outage: a From on an unverified domain silently bounced everything.
  if (!from || /ivy\.com|ai4e1\.net/i.test(from)) {
    add('Email', 'FAIL', `EMAIL_FROM="${from}" is an unverified sender — mail will silently bounce`);
  } else {
    add('Email', 'OK', `sender ${from}`);
  }
}

async function main() {
  console.log('\n=== IVY LAUNCH PREFLIGHT ===\n');

  await checkDatabase();
  await checkAnthropic();
  await checkRetell();
  await checkTwilio();
  await checkTwilioNumbers();
  await checkStripeKey();
  checkStripeWebhook();
  await checkScheduler();
  await checkEmail();

  const icon: Record<Status, string> = { OK: '  OK  ', WARN: ' WARN ', FAIL: ' FAIL ', SKIP: ' SKIP ' };
  for (const c of checks) {
    console.log(`[${icon[c.status]}] ${c.name.padEnd(16)} ${c.detail}`);
  }

  const fails = checks.filter((c) => c.status === 'FAIL');
  const warns = checks.filter((c) => c.status === 'WARN');
  console.log(`\n${fails.length} blocking · ${warns.length} warnings\n`);
  if (fails.length) {
    console.log('BLOCKING — launch will fail on:');
    for (const f of fails) console.log(`  · ${f.name}: ${f.detail}`);
    console.log('');
  }

  await prisma.$disconnect();
  process.exit(fails.length ? 1 : 0);
}

main().catch(async (err) => {
  console.error('preflight crashed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
