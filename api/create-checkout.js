// Vercel serverless function: creates a Paddle Billing checkout.
//
// Requires env:
//   PADDLE_API_KEY      — Paddle API key (server-side only)
//   PADDLE_PRICE_PRO    — Paddle price ID for the Pro tier
//   PADDLE_PRICE_MAX    — Paddle price ID for the Max tier
//   PADDLE_SANDBOX      — "true" (default) or "false" for live mode
//
//   curl -X POST /api/create-checkout \
//        -H 'Content-Type: application/json' \
//        -d '{"tier":"pro","deviceId":"..."}'

const PADDLE_BASE =
  process.env.PADDLE_SANDBOX === 'false'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { tier, deviceId } = req.body ?? {};
    const priceId =
      tier === 'pro' ? process.env.PADDLE_PRICE_PRO : process.env.PADDLE_PRICE_MAX;
    const apiKey = process.env.PADDLE_API_KEY;

    if (!priceId || !apiKey) {
      res.status(500).json({ error: 'Paddle not configured on the server' });
      return;
    }
    if (!deviceId) {
      res.status(400).json({ error: 'deviceId required' });
      return;
    }

    const resp = await fetch(`${PADDLE_BASE}/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ priceId, quantity: 1 }],
        custom_data: { deviceId, tier },
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      res.status(502).json({ error: data?.message || 'Paddle checkout failed' });
      return;
    }

    const checkout = data?.data;
    res.status(200).json({
      checkoutId: checkout?.id,
      checkoutUrl: checkout?.checkout_url,
    });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'checkout failed' });
  }
}
