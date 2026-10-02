// Paddle Billing checkout flow.
//
// Without VITE_PADDLE_PRICE_* env vars the app runs in DEMO mode: the tier is
// unlocked instantly without payment (perfect for local development).
//
// Real flow:
//   1. startCheckout(tier)  → POST /api/create-checkout → redirect to Paddle
//   2. Paddle redirects back with ?checkoutId=...
//   3. activateLicense(id)  → POST /api/activate → signed license stored locally

export type CheckoutResult = 'demo' | 'redirect' | 'error';

const DEVICE_KEY = 'roomcraft:deviceId';
const LICENSE_KEY = 'roomcraft:license';

/** Stable per-device id, generated once and reused. */
function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ??
      `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export async function startCheckout(tier: 'pro' | 'max'): Promise<CheckoutResult> {
  const priceId =
    tier === 'pro' ? import.meta.env.VITE_PADDLE_PRICE_PRO : import.meta.env.VITE_PADDLE_PRICE_MAX;

  if (!priceId) {
    // Demo mode — simulate a short checkout round-trip.
    await new Promise((r) => setTimeout(r, 450));
    return 'demo';
  }

  try {
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, deviceId: getDeviceId() }),
    });
    const data = await res.json();
    if (data && data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return 'redirect';
    }
    return 'error';
  } catch {
    return 'error';
  }
}

/**
 * Called after returning from Paddle. Verifies the checkout server-side and
 * stores a signed license in localStorage. Returns 'ok' on success.
 */
export async function activateLicense(checkoutId: string): Promise<'ok' | 'error'> {
  try {
    const res = await fetch('/api/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkoutId, deviceId: getDeviceId() }),
    });
    const data = await res.json();
    if (data && data.tier && data.signature) {
      localStorage.setItem(
        LICENSE_KEY,
        JSON.stringify({ tier: data.tier, expiresAt: data.expiresAt, signature: data.signature }),
      );
      return 'ok';
    }
    return 'error';
  } catch {
    return 'error';
  }
}

/** Read the stored license, if any. */
export function getLicense(): { tier: 'pro' | 'max'; expiresAt: string; signature: string } | null {
  try {
    const raw = localStorage.getItem(LICENSE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
