// Right panel: selection details, room stats & quick actions.

import { useMemo } from 'react';
import { ITEM_INDEX } from '../data/items';
import { selectActiveRoom, useStore } from '../store';
import { polyArea } from '../logic/geometry';
import { ROOM_KIND_ORDER, ROOM_LABEL, roomTitle } from '../logic/placement';
import { MOUNT_LABEL, TYPE_LABEL } from '../types';
import type { RoomKind } from '../types';
import ItemThumb from './ItemThumb';

/**
 * Name the active room and pick what it is used for. The type is not just a
 * label — it selects the object list AI Fill places, so this is the control
 * that makes the fill match the space.
 */
function RoomEditor() {
  const room = useStore(selectActiveRoom);
  const setRoomKind = useStore((s) => s.setRoomKind);
  const setRoomName = useStore((s) => s.setRoomName);
  if (!room) return null;
  return (
    <div className="room-editor">
      <label className="room-field">
        <span>Name</span>
        <input
          type="text"
          value={room.name}
          maxLength={40}
          placeholder={ROOM_LABEL[room.kind]}
          onChange={(e) => setRoomName(e.target.value)}
        />
      </label>
      <label className="room-field">
        <span>Used for</span>
        <select value={room.kind} onChange={(e) => setRoomKind(e.target.value as RoomKind)}>
          {ROOM_KIND_ORDER.map((k) => (
            <option key={k} value={k}>
              {ROOM_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <p className="muted tiny">
        AI Fill uses this to choose the objects — it furnishes a {ROOM_LABEL[room.kind].toLowerCase()}{' '}
        differently from any other room type.
      </p>
    </div>
  );
}

export default function DetailPanel() {
  const selected = useStore((s) => s.selected);
  const allItems = useStore((s) => s.items);
  const tier = useStore((s) => s.tier);
  const room = useStore(selectActiveRoom);
  const rooms = useStore((s) => s.rooms);
  const setActiveRoom = useStore((s) => s.setActiveRoom);
  const removeRoom = useStore((s) => s.removeRoom);
  const edgeEdit = useStore((s) => s.edgeEdit);

  const rotateSelected = useStore((s) => s.rotateSelected);
  const removeSelected = useStore((s) => s.removeSelected);
  const duplicateSelected = useStore((s) => s.duplicateSelected);
  const setColorIdx = useStore((s) => s.setColorIdx);
  const aiFill = useStore((s) => s.aiFill);
  const select = useStore((s) => s.select);
  const tryMoveFine = useStore((s) => s.tryMoveFine);

  // Only the active room's items are counted and "select first" navigates
  // within it, so the stats describe the room you're actually looking at.
  const items = useMemo(
    () => (room ? allItems.filter((i) => i.roomId === room.id) : []),
    [allItems, room],
  );
  const area = useMemo(() => (room ? polyArea(room.poly) : 0), [room]);

  const placed = items.find((i) => i.uid === selected);
  const item = placed ? ITEM_INDEX.get(placed.itemId) : null;

  /** Precise touch/pointer nudge — 0.1 m snap for fine control. */
  const nudge = (dx: number, dy: number) => {
    if (placed) tryMoveFine(placed.uid, placed.x + dx, placed.y + dy);
  };

  const openings = room?.openings ?? [];
  const windowCount = openings.filter((o) => o === 'window').length;
  const doorCount = openings.filter((o) => o === 'door').length;

  return (
    <aside className="detail">
      {item && placed ? (
        <div className="detail-card">
          <div className="detail-title">
            <span className="swatch lg">
              <ItemThumb item={{ ...item, color: item.colors[placed.colorIdx] ?? item.color }} />
            </span>
            <div>
              <h3>{item.name}</h3>
              <span className="muted">
                {item.style} · {TYPE_LABEL[item.type].replace(/s$/, '')}
              </span>
            </div>
          </div>
          <dl className="specs">
            <div>
              <dt>Footprint</dt>
              <dd>
                {item.w} × {item.d} m
              </dd>
            </div>
            <div>
              <dt>Rotation</dt>
              <dd>{Math.round(placed.rot)}°</dd>
            </div>
            <div>
              <dt>Mounts</dt>
              <dd>{MOUNT_LABEL[item.mount]}</dd>
            </div>
            <div>
              <dt>Plan</dt>
              <dd>
                <i className={`pill pill-${item.tier}`}>{item.tier}</i>
              </dd>
            </div>
          </dl>

          <div className="color-row">
            <span className="muted">Colourway</span>
            <div className="swatches">
              {item.colors.map((c, idx) => {
                const locked = idx > 0 && tier !== 'max';
                return (
                  <button
                    key={c + idx}
                    className={`color-dot ${placed.colorIdx === idx ? 'active' : ''} ${locked ? 'locked' : ''}`}
                    style={{ background: c }}
                    onClick={() => setColorIdx(placed.uid, idx)}
                    title={locked ? 'Colour swaps are a Max feature' : `Colour ${idx + 1}`}
                  >
                    {locked ? '🔒' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="nudge-pad" role="group" aria-label="Move selected item">
            <button
              className="btn ghost"
              style={{ gridColumn: 2, gridRow: 1 }}
              title="Move up (↑)"
              onClick={() => nudge(0, 0.25)}
            >
              ↑
            </button>
            <button
              className="btn ghost"
              style={{ gridColumn: 1, gridRow: 2 }}
              title="Move left (←)"
              onClick={() => nudge(-0.25, 0)}
            >
              ←
            </button>
            <button
              className="btn ghost"
              style={{ gridColumn: 2, gridRow: 2 }}
              title="Move down (↓)"
              onClick={() => nudge(0, -0.25)}
            >
              ↓
            </button>
            <button
              className="btn ghost"
              style={{ gridColumn: 3, gridRow: 2 }}
              title="Move right (→)"
              onClick={() => nudge(0.25, 0)}
            >
              →
            </button>
          </div>

          <div className="detail-actions">
            <button className="btn ghost" onClick={rotateSelected}>
              ⟳ {item.mount === 'wall' || item.mount === 'opening' ? 'Next wall' : 'Rotate 90°'} <kbd>R</kbd>
            </button>
            <button className="btn ghost" onClick={duplicateSelected}>
              ⧉ Duplicate
            </button>
            <button className="btn danger" onClick={removeSelected}>
              🗑 Remove <kbd>Del</kbd>
            </button>
          </div>
        </div>
      ) : (
        <div className="detail-card">
          <h3>{room ? roomTitle(room) : 'No room yet'}</h3>
          {room ? (
            <>
              {/* Room list + rename. Labelling the room is what tells AI Fill
                  which objects the space needs. */}
              {rooms.length > 1 && (
                <div className="room-switch" role="tablist" aria-label="Rooms">
                  {rooms.map((r) => (
                    <button
                      key={r.id}
                      role="tab"
                      aria-selected={r.id === room.id}
                      className={`room-chip ${r.id === room.id ? 'active' : ''}`}
                      onClick={() => setActiveRoom(r.id)}
                      title={`${ROOM_LABEL[r.kind]} — ${polyArea(r.poly).toFixed(1)} m²`}
                    >
                      {r.name.trim() || ROOM_LABEL[r.kind]}
                    </button>
                  ))}
                </div>
              )}
              <RoomEditor />
              <dl className="specs">
                <div>
                  <dt>Area</dt>
                  <dd>{area.toFixed(1)} m²</dd>
                </div>
                <div>
                  <dt>Items</dt>
                  <dd>{items.length}</dd>
                </div>
                <div>
                  <dt>Openings</dt>
                  <dd>
                    {windowCount} 🪟 · {doorCount} 🚪
                  </dd>
                </div>
              </dl>
              <button className="btn primary wide" onClick={aiFill}>
                ✨ Re-run AI Fill
              </button>
              <button className="btn ghost wide" onClick={() => select(items[0]?.uid ?? null)}>
                {items.length ? `Select first item (${items.length} placed)` : 'Nothing placed yet'}
              </button>
              {rooms.length > 1 && (
                <button className="btn danger wide" onClick={() => removeRoom(room.id)}>
                  🗑 Delete this room
                </button>
              )}
            </>
          ) : (
            <p className="muted">
              Draw your room in the <b>Draw</b> tab — click each corner of the space, then click the
              first point to close it. Try the <b>demo room</b> to see it in action.
            </p>
          )}
          <div className="legend">
            <h4>Wall legend</h4>
            <div className="legend-row">
              <span className="lg-line wall" /> Solid wall
            </div>
            <div className="legend-row">
              <span className="lg-line window" /> Window
            </div>
            <div className="legend-row">
              <span className="lg-line door" /> Door
            </div>
            <p className="muted tiny">
              {edgeEdit ? 'Click any wall to cycle its type.' : 'Use “Edit openings” to change walls.'}
            </p>
          </div>
          <div className="legend">
            <h4>Shortcuts</h4>
            <p className="muted tiny">
              <kbd>↑↓←→</kbd> move (hold <kbd>Shift</kbd> for 1 m) · <kbd>R</kbd> rotate ·{' '}
              <kbd>Del</kbd> remove · right-click or long-press item for menu · <kbd>Esc</kbd>{' '}
              deselect · <kbd>Enter</kbd> close room · wheel or pinch zoom · drag empty space to pan
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
