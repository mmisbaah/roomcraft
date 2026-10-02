import { useEffect } from 'react';
import { useStore } from './store';
import TopBar from './components/TopBar';
import Library from './components/Library';
import DetailPanel from './components/DetailPanel';
import Canvas2D from './components/Canvas2D';
import Scene3D from './three/Scene3D';
import UpgradeModal from './components/UpgradeModal';
import Welcome from './components/Welcome';
import { selectArea } from './store';
import { TIER_RANK } from './types';

function StatusBar() {
  const mode = useStore((s) => s.mode);
  const items = useStore((s) => s.items);
  const area = useStore(selectArea);
  const tier = useStore((s) => s.tier);
  const toast = useStore((s) => s.toast);
  const wallBuild = useStore((s) => s.wallBuild);

  return (
    <footer className="statusbar">
      <span>
        {mode === '3d' ? '🧊 3D view — drag orbits · scroll or pinch zoom · drag items to move · ↑↓←→ nudges' : mode === 'draw' ? '✏️ Draw mode — click corners, Enter closes' : wallBuild ? '🧱 Wall tool — walls align to the wall you start from · click a wall to remove · Esc ends the chain' : '🪑 Furnish mode — drag items · ↑↓←→ nudges · R rotates · right-click / long-press for menu'}
      </span>
      <span className="status-right">
        {area > 0 && <span>{area.toFixed(1)} m²</span>}
        <span>{items.length} items</span>
        <span className={`plan-${tier}`}>{tier.toUpperCase()} plan</span>
      </span>
      {toast && <div className="toast">{toast}</div>}
    </footer>
  );
}

export default function App() {
  const mode = useStore((s) => s.mode);
  const tier = useStore((s) => s.tier);
  const handleCheckoutReturn = useStore((s) => s.handleCheckoutReturn);

  // If we just returned from Paddle (?checkoutId=...), activate the license.
  useEffect(() => {
    handleCheckoutReturn();
  }, [handleCheckoutReturn]);

  return (
    <div className="app">
      <TopBar />
      <div className="workspace">
        <Library />
        <main className="viewport">
          {mode === '3d' ? <Scene3D /> : <Canvas2D />}
        </main>
        <DetailPanel />
      </div>
      <StatusBar />
      <UpgradeModal />
      <Welcome />
      {/* tier is read by Library / DetailPanel via store; keep reference to avoid lint noise */}
      <span hidden data-tier={TIER_RANK[tier]} />
    </div>
  );
}
