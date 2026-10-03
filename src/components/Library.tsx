// Left sidebar: the item library (3 free / 8 pro / 20 max per category, 25 categories).

import { useState } from 'react';
import { itemsOf } from '../data/items';
import { useStore } from '../store';
import { TYPE_LABEL, TYPE_ORDER, tierUnlocked, type FurnType } from '../types';
import ItemThumb from './ItemThumb';

const TIER_LABEL = { free: 'Free', pro: 'Pro', max: 'Max' } as const;

export default function Library() {
  const tier = useStore((s) => s.tier);
  const addItem = useStore((s) => s.addItem);
  const setUpgradeOpen = useStore((s) => s.setUpgradeOpen);
  const toastMsg = useStore((s) => s.toastMsg);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);

  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({ seating: true });

  const query = q.trim().toLowerCase();

  const counts = (t: FurnType) => {
    const all = itemsOf(t);
    const unlocked = all.filter((i) => tierUnlocked(i.tier, tier)).length;
    return { unlocked, total: all.length };
  };

  return (
    <aside className="library">
      <div className="library-head">
        <h2>Item library</h2>
        <input
          className="search"
          placeholder="Search styles…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <p className="library-sub">
          <b>{counts('seating').unlocked}</b> of 20 unlocked per category · {TYPE_ORDER.length} categories ·{' '}
          <button className="link" onClick={() => setUpgradeOpen(true)}>
            compare plans
          </button>
        </p>
      </div>

      <div className="library-body">
        {TYPE_ORDER.map((type) => {
          const all = itemsOf(type).filter(
            (i) =>
              !query ||
              i.name.toLowerCase().includes(query) ||
              i.style.toLowerCase().includes(query) ||
              i.kind.includes(query),
          );
          if (!all.length) return null;
          const c = counts(type);
          const isOpen = query ? true : open[type] ?? false;
          return (
            <section key={type} className="lib-section">
              <button
                className="lib-section-head"
                onClick={() => setOpen((o) => ({ ...o, [type]: !isOpen }))}
              >
                <span>
                  {isOpen ? '▾' : '▸'} {TYPE_LABEL[type]}
                </span>
                <span className="count">
                  {c.unlocked}/{c.total}
                </span>
              </button>
              {isOpen && (
                <div className="item-grid">
                  {all.map((item) => {
                    const unlocked = tierUnlocked(item.tier, tier);
                    return (
                      <button
                        key={item.id}
                        className={`item-card ${unlocked ? '' : 'locked'} ${
                          selected && useStore.getState().items.some((i) => i.itemId === item.id && i.uid === selected)
                            ? 'current'
                            : ''
                        }`}
                        onClick={() => (unlocked ? addItem(item.id) : setUpgradeOpen(true))}
                        title={
                          unlocked
                            ? `${item.name} — click to place`
                            : `${item.name} — ${TIER_LABEL[item.tier]} plan`
                        }
                      >
                        <span className="swatch">
                          <ItemThumb item={item} locked={!unlocked} />
                          {!unlocked && <span className="lock">🔒</span>}
                        </span>
                        <span className="item-name">{item.name}</span>
                        <span className="item-meta">
                          <i className={`pill pill-${item.tier}`}>{TIER_LABEL[item.tier]}</i>
                          <span className="dims">
                            {item.w}×{item.d}m
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        <div className="library-foot">
          <button
            className="btn ghost wide"
            onClick={() => {
              select(null);
              toastMsg('Tip: click to place, then drag to fine-tune. Right-click an item for Rotate/Duplicate/Delete, or press R / Del.');
            }}
          >
            💡 How to place items
          </button>
        </div>
      </div>
    </aside>
  );
}
