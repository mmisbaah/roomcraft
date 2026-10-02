// Vercel serverless function: verifies a Paddle checkout and issues a
// signed license for the requesting device.
//
// Called by the client after it returns from Paddle (the success redirect
// carries ?checkoutId=...). The server fetches the checkout from Paddle's
// API — so the client cannot forge an activation — confirms it is paid,
// checks the device matches, and returns an HMAC-signed license.
//
// Requires env:
//   PADDLE_API_KEY        — Paddle API key
//   PADDLE_LICENSE_SECRET — secret for signing licenses (any long random string)
//   PADDLE_SANDBOX        — "true" (default) or "false"
//
//   curl -X POST /api/activate \
//        -H 'Content-Type: application/json' \
//        -d '{"checkoutId":"ctm_...","deviceId":"..."}'

import { createHmac } from 'crypto';

const PADDLE_BASE =
  process.env.PADDLE_SANDBOX === 'false'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { checkoutId, deviceId } = req.body ?? {};
    const apiKey = process.env.PADDLE_API_KEY;
    const secret = process.env.PADDLE_LICENSE_SECRET;

    if (!checkoutId || !deviceId || !apiKey || !secret) {
      res.status(400).json({ error: 'Missing parameters or server not configured' });
      return;
    }

    // Fetch the checkout from Paddle — this is the trust boundary.
    const resp = await fetch(`${PADDLE_BASE}/checkouts/${encodeURIComponent(checkoutId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await resp.json();
    const checkout = data?.data;

    if (!resp.ok || !checkout) {
      res.status(404).json({ error: 'Checkout not found' });
      return;
    }
    if (checkout.status !== 'completed') {
      res.status(400).json({ error: `Checkout not completed (${checkout.status})` });
      return;
    }
    if (checkout.custom_data?.deviceId !== deviceId) {
      res.status(403).json({ error: 'Device mismatch' });
      return;
    }

    const tier = checkout.custom_data?.tier;
    if (tier !== 'pro' && tier !== 'max') {
      res.status(400).json({ error: 'Unknown tier' });
      return;
    }

    // Expiry: Paddle's next billing date, or 30 days out as a fallback.
    const expiresAt =
      checkout.billing_details?.next_billing_date ||
      checkout.billing_details?.renewal_at ||
      new Date(Date.now() + 30 * 86400000).toISOString();

    const payload = `${deviceId}|${tier}|${expiresAt}`;
    const signature = sign(payload, secret);

    res.status(200).json({ tier, expiresAt, signature });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'activation failed' });
  }
}
