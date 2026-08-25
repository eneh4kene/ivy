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
    // Must hit a BILLED endpoint. GET /v1/models answers 200 on an org with no
    // credit, so it cannot tell "funded" from "will fail on the first prompt" —
    // the same false-green that let a suspended Retell account read as healthy.
    // A 16-token completion costs a fraction of a cent and is unambiguous.
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-5',
        max_tokens: 16,
        thinking: { type: 'disabled' },
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
      }),
    });
    if (res.status === 200) add('Anthropic', 'OK', 'key valid · completion billed successfully');
    else if (res.status === 401) add('Anthropic', 'FAIL', '401 — key invalid or revoked');
    else if (res.status === 429) add('Anthropic', 'WARN', '429 — rate limited right now');
    else {
      const body = await res.text();
      const outOfCredit = /credit balance|too low|billing/i.test(body);
      add('Anthropic', 'FAIL', `${res.status}${outOfCredit ? ' — OUT OF CREDIT' : ''}: ${body.slice(0, 160)}`);
    }
  } catch (err: any) {
    add('Anthropic', 'FAIL', `probe failed: ${err?.message ?? err}`);
  }
}

async function checkRetell() {
  const key = process.env.RETELL_API_KEY;
  if (!key) { add('Retell', 'FAIL', 'RETELL_API_KEY not set — no voice agent, no calls'); return; }

  // 1) Auth — agent endpoints live at the API root, not /v2 (see retell.service.ts).
  let agentCount = '?';
  try {
    const res = await fetchWithTimeout('https://api.retellai.com/list-agents', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 401 || res.status === 403) {
      add('Retell', 'FAIL', `${res.status} — key invalid`);
      return;
    }
    if (res.status === 200) {
      const agents = (await res.json()) as unknown[];
      agentCount = Array.isArray(agents) ? String(agents.length) : '?';
    }
  } catch (err: any) {
    add('Retell', 'FAIL', `auth probe failed: ${err?.message ?? err}`);
    return;
  }

  // 2) Billing — list-agents returns 200 on a SUSPENDED account, so reading
  // agents proves nothing about whether a call can be placed. The billing gate
  // only fires on the endpoint that costs money. Register with a deliberately
  // bogus agent_id: an unfunded account 402s before validating the agent, a
  // funded one rejects the agent (4xx). Nothing is dialled either way —
  // registration alone never rings a phone; the Twilio leg is a separate step.
  try {
    const res = await fetchWithTimeout('https://api.retellai.com/v2/register-phone-call', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: 'agent_preflight_probe_does_not_exist',
        from_number: '+10000000000',
        to_number: '+10000000000',
        direction: 'outbound',
      }),
    });
    if (res.status === 402) {
      const body = await res.text();
      add('Retell', 'FAIL', `402 PAYMENT OVERDUE — calls will not connect: ${body.slice(0, 120)}`);
    } else {
      // Any non-402 means the billing gate let us through to agent validation.
      add('Retell', 'OK', `key valid · ${agentCount} agents · billing active`);
    }
  } catch (err: any) {
    add('Retell', 'WARN', `billing probe failed: ${err?.message ?? err}`);
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
    return;
  }

  // Actually open the connection and authenticate, rather than trusting that a
  // host string means working email. Magic links are the ONLY login path, so a
  // dead sender is a total outage, and it reads as healthy from the outside:
  // the app awaits sendMail, gets no error, and logs success.
  //
  // Honest limit: verify() proves credentials and reachability, NOT delivery.
  // Postmark's free tier ran out on 26 Jul and every send after that returned
  // "250 Ok: queued" and was then dropped — verify() would still have passed.
  // Provider quota is the one failure this cannot see.
  try {
    const nodemailer = await import('nodemailer');
    const t = nodemailer.default.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: String(process.env.SMTP_SECURE) === 'true',
      auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
    await t.verify();
    add('Email', 'OK', `${host} auth ok · sender ${from} (verify != delivery — check provider quota)`);
  } catch (err: any) {
    add('Email', 'FAIL', `${host} rejected the connection: ${err?.message ?? err}`);
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
