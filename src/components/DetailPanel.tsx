// Right panel: selection details, room stats & quick actions.

import { ITEM_INDEX } from '../data/items';
import { selectArea, useStore } from '../store';
import { ROOM_LABEL } from '../logic/placement';
import { MOUNT_LABEL, TYPE_LABEL } from '../types';
import ItemThumb from './ItemThumb';

export default function DetailPanel() {
  const selected = useStore((s) => s.selected);
  const items = useStore((s) => s.items);
  const tier = useStore((s) => s.tier);
  const area = useStore(selectArea);
  const roomKind = useStore((s) => s.roomKind);
  const room = useStore((s) => s.room);
  const openings = useStore((s) => s.openings);
  const edgeEdit = useStore((s) => s.edgeEdit);

  const rotateSelected = useStore((s) => s.rotateSelected);
  const removeSelected = useStore((s) => s.removeSelected);
  const duplicateSelected = useStore((s) => s.duplicateSelected);
  const setColorIdx = useStore((s) => s.setColorIdx);
  const aiFill = useStore((s) => s.aiFill);
  const select = useStore((s) => s.select);
  const tryMoveFine = useStore((s) => s.tryMoveFine);

  const placed = items.find((i) => i.uid === selected);
  const item = placed ? ITEM_INDEX.get(placed.itemId) : null;

  /** Precise touch/pointer nudge — 0.1 m snap for fine control. */
  const nudge = (dx: number, dy: number) => {
    if (placed) tryMoveFine(placed.uid, placed.x + dx, placed.y + dy);
  };

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
              ⟳ {item.mount === 'wall' ? 'Next wall' : 'Rotate 90°'} <kbd>R</kbd>
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
          <h3>{room ? ROOM_LABEL[roomKind] : 'No room yet'}</h3>
          {room ? (
            <>
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
