// Top toolbar: brand, view modes, AI fill, plan & export actions.

import { selectActiveRoom, useStore } from '../store';
import { ROOM_KIND_ORDER, ROOM_LABEL, roomTitle } from '../logic/placement';
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
  const rooms = useStore((s) => s.rooms);
  const room = useStore(selectActiveRoom);
  const draft = useStore((s) => s.draft);
  const roomKind = room?.kind ?? 'living';
  const setRoomKind = useStore((s) => s.setRoomKind);
  const setActiveRoom = useStore((s) => s.setActiveRoom);
  const aiFill = useStore((s) => s.aiFill);
  const clearItems = useStore((s) => s.clearItems);
  const clearRoom = useStore((s) => s.clearRoom);
  const edgeEdit = useStore((s) => s.edgeEdit);
  const setEdgeEdit = useStore((s) => s.setEdgeEdit);
  const wallBuild = useStore((s) => s.wallBuild);
  const roomCreate = useStore((s) => s.roomCreate);
  const setRoomCreate = useStore((s) => s.setRoomCreate);
  const setWallBuild = useStore((s) => s.setWallBuild);
  const wallSnap = useStore((s) => s.wallSnap);
  const setWallSnap = useStore((s) => s.setWallSnap);
  const wallDraft = useStore((s) => s.wallDraft);
  const wallGrab = useStore((s) => s.wallGrab);
  const grabWallPoint = useStore((s) => s.grabWallPoint);
  const finishWallGrab = useStore((s) => s.finishWallGrab);
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
          <>
            <button
              className={`btn ghost ${wallBuild ? 'active' : ''}`}
              onClick={() => setWallBuild(!wallBuild)}
              title="Draw free walls anywhere on the ground"
            >
              🧱 Build walls
            </button>
            {/* Free mode is the escape hatch when align keeps pulling walls off
                the angle you wanted: no 45° lattice, no 0.25 m length steps. */}
            {wallBuild && (
              <button
                className={`btn ghost ${wallSnap === 'free' ? 'active' : ''}`}
                onClick={() => setWallSnap(wallSnap === 'free' ? 'align' : 'free')}
                title={
                  wallSnap === 'free'
                    ? 'Free drawing: walls follow the cursor exactly. Click to snap to 45° again.'
                    : 'Aligned: walls snap square and to 45°. Click to draw at any angle.'
                }
              >
                {wallSnap === 'free' ? '✏️ Free' : '📐 Align'}
              </button>
            )}
            {/* ✊ Grab / ✓ Done — the one control that has to work for every
                input. With a point held it turns into the commit button, so a
                touch user needs nothing else: tap the point itself also lets
                go, and Esc still puts it back. */}
            {wallBuild && !!wallDraft?.length && (
              <button
                className={`btn ${wallGrab ? 'primary' : 'ghost'}`}
                onClick={() => (wallGrab ? finishWallGrab() : grabWallPoint())}
                disabled={!wallGrab && !!wallDraft && wallDraft.length < 2}
                title={
                  wallGrab
                    ? 'Keep this point (also Enter or right-click)'
                    : wallDraft && wallDraft.length < 2
                      ? 'Lay a second point first — there is no wall to correct yet'
                      : 'Move the last wall point (Enter or right-click to keep it, Esc to undo)'
                }
              >
                {wallGrab ? '✓ Done' : '✊ Grab'}
              </button>
            )}
          </>
        )}
        {/* Which room, and what it is for.
            Shown in every 2D mode, not just furnish: saying "this one is a
            kitchen" is something you want to do while you are still drawing its
            walls, and the type is what AI Fill later reads to pick furniture —
            so leaving it until after furnishing meant guessing. */}
        {mode !== '3d' && room && (
          <>
            {rooms.length > 1 && (
              <select
                className="kind-select"
                value={room.id}
                onChange={(e) => setActiveRoom(e.target.value)}
                title="Which room"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {roomTitle(r)}
                  </option>
                ))}
              </select>
            )}
            <select
              className="kind-select"
              value={roomKind}
              onChange={(e) => setRoomKind(e.target.value as RoomKind)}
              title="Room type — this is what AI Fill furnishes"
            >
              {ROOM_KIND_ORDER.map((k) => (
                <option key={k} value={k}>
                  {ROOM_LABEL[k]}
                </option>
              ))}
            </select>
          </>
        )}
        {mode === 'furnish' && room && (
          <>
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

        {mode === 'draw' && (
          <button
            className={`btn ${roomCreate ? 'primary' : 'ghost'}`}
            onClick={() => setRoomCreate(!roomCreate)}
            title="Drag out a rectangle on the ground to make a room — no walls needed"
          >
            {roomCreate ? '✕ Cancel' : '＋ Create room'}
          </button>
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
