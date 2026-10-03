// Pricing / upgrade modal with the three plans.

import { useStore } from '../store';

const PLANS = [
  {
    id: 'free' as const,
    name: 'Free',
    price: '$0',
    tag: 'Try it out',
    features: [
      '3 items per category (51 total)',
      'Draw & edit floorplans',
      '2D view + PNG export',
      'Low-poly 3D preview',
    ],
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: '$4.99',
    tag: 'For DIY homeowners',
    features: [
      '8 items per category (136 total)',
      'Full 3D mode + drag to arrange',
      'AI Fill unlimited',
      'GLB export for your 3D tools',
      'Save / load projects',
    ],
  },
  {
    id: 'max' as const,
    name: 'Max',
    price: '$9.99',
    tag: 'Complete library',
    features: [
      'All 20 items per category (500 total)',
      'Every style & colourway',
      'Colour swaps on any item',
      'Commercial-use GLB exports',
      'Priority AI placement',
    ],
  },
];

export default function UpgradeModal() {
  const open = useStore((s) => s.upgradeOpen);
  const tier = useStore((s) => s.tier);
  const setOpen = useStore((s) => s.setUpgradeOpen);
  const checkout = useStore((s) => s.checkout);
  const checkingOut = useStore((s) => s.checkingOut);
  const toastMsg = useStore((s) => s.toastMsg);

  if (!open) return null;

  const choose = async (id: 'pro' | 'max') => {
    if (id === tier) {
      setOpen(false);
      return;
    }
    await checkout(id);
    toastMsg('Larger library unlocked — enjoy!');
  };

  return (
    <div className="overlay" onClick={() => setOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setOpen(false)}>
          ✕
        </button>
        <h2>Unlock the full RoomCraft library</h2>
        <p className="muted center">
          3 free items across each of the 25 categories gets you started — Pro adds 5 more per
          category, Max opens all 20 (500 pieces in total, including a full kitchen and
          dining-room range).
        </p>

        <div className="plans">
          {PLANS.map((p) => (
            <div key={p.id} className={`plan ${tier === p.id ? 'current' : ''} ${p.id === 'max' ? 'highlight' : ''}`}>
              {p.id === 'max' && <span className="ribbon">BEST VALUE</span>}
              <h3>{p.name}</h3>
              <div className="price">
                {p.price}
                <small>/mo</small>
              </div>
              <span className="muted tiny">{p.tag}</span>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              {p.id === 'free' ? (
                <button className="btn ghost wide" disabled>
                  {tier === 'free' ? 'Your current plan' : 'Downgrade'}
                </button>
              ) : (
                <button
                  className={`btn ${p.id === 'max' ? 'upgrade' : 'primary'} wide`}
                  disabled={checkingOut || tier === p.id}
                  onClick={() => choose(p.id)}
                >
                  {checkingOut
                    ? 'Redirecting…'
                    : tier === p.id
                      ? 'Your current plan'
                      : `Choose ${p.name}`}
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="muted tiny center">
          Demo checkout: plans unlock instantly without payment. Add your Paddle keys
          (<code>.env</code>) for live billing — see README.
        </p>
      </div>
    </div>
  );
}
