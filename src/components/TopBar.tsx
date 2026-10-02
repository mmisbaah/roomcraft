// Top toolbar: brand, view modes, AI fill, plan & export actions.

import { useStore } from '../store';
import { ROOM_LABEL } from '../logic/placement';
import { exportGLB, exportPNG } from '../lib/exporters';
import RulesModal from './RulesModal';
import type { RoomKind, ViewMode } from '../types';

const MODES: { id: ViewMode; label: string }[] = [
  { id: 'draw', label: '✏️ Draw' },
  { id: 'furnish', label: '🪑 Furnish' },
  { id: '3d', label: '🧊 3D' },
];

export default function TopBar() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const tier = useStore((s) => s.tier);
  const room = useStore((s) => s.room);
  const draft = useStore((s) => s.draft);
  const roomKind = useStore((s) => s.roomKind);
  const setRoomKind = useStore((s) => s.setRoomKind);
  const aiFill = useStore((s) => s.aiFill);
  const clearItems = useStore((s) => s.clearItems);
  const clearRoom = useStore((s) => s.clearRoom);
  const edgeEdit = useStore((s) => s.edgeEdit);
  const setEdgeEdit = useStore((s) => s.setEdgeEdit);
  const wallBuild = useStore((s) => s.wallBuild);
  const setWallBuild = useStore((s) => s.setWallBuild);
  const setUpgradeOpen = useStore((s) => s.setUpgradeOpen);
  const toastMsg = useStore((s) => s.toastMsg);
  const saveProject = useStore((s) => s.saveProject);
  const loadProject = useStore((s) => s.loadProject);
  const items = useStore((s) => s.items);

  const doExportPng = () => {
    const err = exportPNG(mode);
    if (err) toastMsg(err);
    else toastMsg('PNG downloaded ✓');
  };
  const doExportGlb = () => {
    if (mode !== '3d') {
      setMode('3d');
      setTimeout(() => {
        const e = exportGLB();
        if (e) toastMsg(e);
      }, 700);
      return;
    }
    const e = exportGLB();
    if (e) toastMsg(e);
    else toastMsg('GLB model downloaded ✓');
  };

  return (
    <header className="topbar">
      <div className="brand" onClick={() => useStore.setState({ welcomeOpen: true })} title="About RoomCraft">
        <span className="brand-mark">⌂</span>
        <span className="brand-name">
          RoomCraft<em>AI</em>
        </span>
      </div>

      <nav className="modes">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`mode-btn ${mode === m.id ? 'active' : ''}`}
            onClick={() => setMode(m.id)}
            disabled={m.id !== 'draw' && !room}
          >
            {m.label}
          </button>
        ))}
      </nav>

      <div className="topbar-actions">
        {mode !== '3d' && (
          <button
            className={`btn ghost ${wallBuild ? 'active' : ''}`}
            onClick={() => setWallBuild(!wallBuild)}
            title="Draw free walls anywhere on the ground"
          >
            🧱 Build walls
          </button>
        )}
        {mode === 'furnish' && room && (
          <>
            <select
              className="kind-select"
              value={roomKind}
              onChange={(e) => setRoomKind(e.target.value as RoomKind)}
              title="Room type for AI Fill"
            >
              {(Object.keys(ROOM_LABEL) as RoomKind[]).map((k) => (
                <option key={k} value={k}>
                  {ROOM_LABEL[k]}
                </option>
              ))}
            </select>
            <button className="btn primary" onClick={aiFill}>
              ✨ AI Fill
            </button>
            <button
              className={`btn ghost ${edgeEdit ? 'active' : ''}`}
              onClick={() => setEdgeEdit(!edgeEdit)}
              title="Click walls to cycle wall / window / door"
            >
              🚪 Edit openings
            </button>
            {items.length > 0 && (
              <button className="btn ghost" onClick={clearItems}>
                Clear
              </button>
            )}
          </>
        )}

        {mode === 'draw' && room && (
          <button className="btn ghost" onClick={clearRoom}>
            ↺ New room
          </button>
        )}

        <span className="sep" />

        <RulesModal />
        <button className="btn ghost" onClick={saveProject} title="Save to this browser">
          💾 Save
        </button>
        <button className="btn ghost" onClick={loadProject} title="Load saved project">
          📂 Load
        </button>
        <button className="btn ghost" onClick={doExportPng} disabled={!room && !draft}>
          🖼 PNG
        </button>
        <button className="btn ghost" onClick={doExportGlb} disabled={!room} title="Export 3D model (GLB)">
          ⬇ GLB
        </button>

        <span className="sep" />

        <span className={`plan-badge plan-${tier}`}>
          {tier === 'free' ? 'Free' : tier === 'pro' ? 'Pro' : 'Max'}
        </span>
        {tier !== 'max' && (
          <button className="btn upgrade" onClick={() => setUpgradeOpen(true)}>
            ⭐ Upgrade
          </button>
        )}
      </div>
    </header>
  );
}
