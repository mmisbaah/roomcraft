// First-visit welcome / onboarding card.

import { useStore } from '../store';

export default function Welcome() {
  const open = useStore((s) => s.welcomeOpen);
  const setOpen = useStore((s) => s.setWelcomeOpen);
  const loadDemo = useStore((s) => s.loadDemo);

  if (!open) return null;

  return (
    <div className="overlay" onClick={() => setOpen(false)}>
      <div className="modal welcome" onClick={(e) => e.stopPropagation()}>
        <h2>
          Draw your room. <em>AI furnishes it.</em>
        </h2>
        <p className="muted center">
          RoomCraft turns a hand-drawn floorplan into a styled room — in 2D and 3D — using an
          item library built for DIY homeowners.
        </p>
        <ol className="steps">
          <li>
            <b>1. Draw the floorplan</b>
            <span>Click each corner of your room, then click the first point to close it.</span>
          </li>
          <li>
            <b>2. Let AI fill it</b>
            <span>One click places the best-fit furniture for a living room, bedroom or office.</span>
          </li>
          <li>
            <b>3. Swap &amp; style</b>
            <span>Tap any piece to move, rotate or replace it — then explore it in 3D.</span>
          </li>
        </ol>
        <div className="welcome-actions">
          <button className="btn ghost" onClick={() => setOpen(false)}>
            ✏️ Draw my room
          </button>
          <button
            className="btn primary"
            onClick={() => {
              loadDemo();
            }}
          >
            🚀 Load the demo room
          </button>
        </div>
        <p className="muted tiny center">
          3 items per category are free (51) · Pro adds 5 more per category (136) · Max unlocks
          all 20 (460 pieces across 23 categories).
        </p>
      </div>
    </div>
  );
}
