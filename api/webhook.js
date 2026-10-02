// Vercel serverless function: receives Paddle webhook events.
//
// Verifies the Paddle-Signature header so we know the event really came
// from Paddle, then logs it. For a local-first app without a database,
// the signed license issued by /api/activate is what gates access — the
// webhook is the source of truth for cancellations/renewals. Wire it to a
// KV or D1 store later if you need to deactivate a specific device.
//
// Requires env:
//   PADDLE_WEBHOOK_SECRET — from Paddle dashboard (Developer → Webhooks)
//
// Paddle sends:  header "Paddle-Signature: ts=<ts>;h1=<hmac>"
// where h1 = HMAC_SHA256(secret, "<ts>.<raw_body>")

import { createHmac, timingSafeEqual } from 'crypto';

function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const ts = signatureHeader.split(';').map((p) => p.trim())
    .find((p) => p.startsWith('ts='))?.slice(3);
  const h1 = signatureHeader.split(';').map((p) => p.trim())
    .find((p) => p.startsWith('h1='))?.slice(3);
  if (!ts || !h1) return false;

  const expected = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(h1);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Read the raw body — signature verification needs the unparsed bytes.
  const rawBody = await new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });

  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  const signature = req.headers['paddle-signature'];

  if (!verifySignature(rawBody, signature, secret)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  try {
    const event = JSON.parse(rawBody);
    // eslint-disable-next-line no-console
    console.log(`[paddle] ${event.event_type}`, event.data?.id ?? '');
    res.status(200).json({ received: true });
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
  }
}
