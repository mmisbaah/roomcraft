import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { ROOM_KIND_ORDER, ROOM_LABEL } from '../logic/placement';
import { TYPE_ORDER } from '../types';
import type { RoomKind } from '../types';

/**
 * Asks what a freshly created room is for, before anything is placed in it.
 *
 * This is the one prompt worth interrupting for: the answer decides every
 * object AI Fill chooses, and picking a purpose blind ("living room") then
 * editing it later means furnishing the room twice. The description is free
 * text and is read alongside the purpose, so a room can be as specific as the
 * person describing it wants ("small galley for two, opens to the lounge").
 *
 * It can be skipped — the room keeps a sensible default and stays editable in
 * the detail panel.
 */
export default function RoomPromptModal() {
  const pendingRoomId = useStore((s) => s.pendingRoomId);
  const room = useStore((s) => s.rooms.find((r) => r.id === s.pendingRoomId) ?? null);
  const describeRoom = useStore((s) => s.describeRoom);
  const askRoom = useStore((s) => s.askRoom);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<RoomKind>('living');
  const [note, setNote] = useState('');
  const [area, setArea] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);

  const open = !!pendingRoomId && !!room;

  // Reset each time a new room is created, and measure it for context.
  useEffect(() => {
    if (!room) return;
    setName(room.name);
    setKind(room.kind);
    setNote(room.note);
    const a = room.poly.reduce((s, p, i, arr) => {
      const q = arr[(i + 1) % arr.length];
      return s + (p.x * q.y - q.x * p.y);
    }, 0);
    setArea(Math.abs(a) / 2);
    // Focus the name field so the first thing typed is the room's name.
    const t = window.setTimeout(() => nameRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [room?.id]);

  // Enter saves, Escape skips — both without touching the mouse.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        askRoom(null);
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (room) describeRoom(room.id, { name, kind, note });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, room, name, kind, note, describeRoom, askRoom]);

  if (!open || !room) return null;

  const save = () => describeRoom(room.id, { name, kind, note });

  return (
    <div className="overlay" onClick={() => askRoom(null)}>
      <div className="modal room-prompt" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={() => askRoom(null)} aria-label="Skip">
          ✕
        </button>

        <h2>What is this room for?</h2>
        <p className="muted center">
          {area > 0 && <>{area.toFixed(1)} m² · </>}
          Pick a purpose and AI Fill will choose the right objects for it. Add a
          description if you want something more specific than the category.
        </p>

        <label className="room-field">
          <span>Name</span>
          <input
            ref={nameRef}
            type="text"
            value={name}
            maxLength={40}
            placeholder={ROOM_LABEL[kind]}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="room-field">
          <span>Used for</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as RoomKind)}>
            {ROOM_KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {ROOM_LABEL[k]}
              </option>
            ))}
          </select>
        </label>

        <label className="room-field">
          <span>Describe it (optional)</span>
          <textarea
            value={note}
            maxLength={400}
            rows={3}
            placeholder={
              kind === 'kitchen'
                ? 'e.g. galley kitchen for two, opens to the lounge, no dining table'
                : kind === 'bedroom'
                  ? 'e.g. small double bed, needs a desk, lots of storage'
                  : 'e.g. sofa facing the TV, armchair in the corner, plant by the window'
            }
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {note.trim() && (
          <p className="muted tiny center">
            Mentions like “sofa”, “desk” or “island” are picked out of your
            description and added to the layout.
          </p>
        )}

        <div className="modal-actions">
          <button className="btn ghost" onClick={() => askRoom(null)}>
            Skip for now
          </button>
          <button className="btn primary" onClick={save}>
            Save room <kbd>Ctrl</kbd>
          </button>
        </div>

        <p className="muted tiny center">
          You can change all of this later in the detail panel —{' '}
          {TYPE_ORDER.length} categories, {useStore.getState().items.length} items placed so far.
        </p>
      </div>
    </div>
  );
}