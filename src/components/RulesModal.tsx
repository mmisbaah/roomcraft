// 📐 Design-rules modal — the 149 interior-design rules AI Fill follows.

import { useState } from 'react';
import { RULES, RULE_GROUPS } from '../logic/rules';

export default function RulesModal() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="btn ghost"
        onClick={() => setOpen(true)}
        title="The 149 design rules AI Fill follows"
      >
        📐 Rules
      </button>
      {open && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal rules-modal">
            <button className="modal-close" onClick={() => setOpen(false)} aria-label="Close">
              ✕
            </button>
            <h2>📐 Design rules for AI Fill</h2>
            <p className="rules-sub">
              RoomCraft's AI Fill follows these {RULES.length} interior-design rules. A{' '}
              <span className="rule-badge">✓ AI</span> badge marks the rules the layout engine
              applies automatically; the rest guide the arrangement and your manual tweaks.
            </p>
            {RULE_GROUPS.map((g) => {
              const list = RULES.filter((r) => r.group === g.id);
              return (
                <section key={g.id} className="rule-group">
                  <h3>
                    {g.icon} {g.name}
                    <span className="rule-count">{list.length}</span>
                  </h3>
                  <p className="rule-blurb">{g.blurb}</p>
                  <ol className="rule-list">
                    {list.map((r) => (
                      <li key={r.id} className={r.applied ? 'applied' : ''}>
                        <b>
                          {r.id}. {r.title}.
                        </b>{' '}
                        {r.text}
                        {r.applied && (
                          <span className="rule-badge" title="Applied automatically by AI Fill">
                            ✓ AI
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
