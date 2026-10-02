# RoomCraft AI — draw a floorplan, AI fills it with furniture

A DIY-interior-design app for homeowners: sketch your room, hit **AI Fill**, and watch it
populate with best-fit furniture — then explore the result in **2D and 3D**, swap items
from a 460-piece library (23 categories, four mount types: floor / wall / ceiling /
surface), and export **PNG** floorplans or **GLB** 3D models.

```
Free plan   →  3 items per category   (51 total = 3 × 17, selectable)
Pro  $4.99  →  8 items per category   (136 total = 3 free + 5 paid per category)
Max  $9.99  → 20 items per category   (460 total, full library + colourways)
```

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run typecheck  # tsc --noEmit
npm run build      # production build to dist/
npm run preview    # serve the production build
```

**Try it instantly:** launch → *Load the demo room* on the welcome card → the AI furnishes
an L-shaped living room → switch to the **🧊 3D** tab → drag pieces around → export a GLB.

---

## How it works

| Step | What happens |
|---|---|
| **1. Draw** | Click corners of your room on the canvas; click the first point (or press `Enter`) to close. Walls, floor and a 0.5 m placement grid are generated from the polygon. |
| **2. Openings** | One edge auto-becomes a window (longest) and one a door (shortest). Toggle **Edit openings** and click any wall to cycle wall → window → door. |
| **2b. Build walls** | Toggle **🧱 Build walls** and click anywhere on the ground to lay free partitions — room dividers, closets, new rooms. A chain **aligns to the wall it is drawn from**: the first point snaps onto that wall (or a corner), every segment then follows its line — parallel, square or 45° — with 0.25 m length steps, and lands exactly on any wall the aligned ray meets (clean T-junctions). Chains started on bare ground use the classic global 45° grid instead. The rubber-band preview shows exactly where each click will land. Click the first point to close a loop; `Esc` or right-click ends the chain; click a built wall (away from its ends) to remove it. Partitions block furniture and AI Fill, render in 3D, and are saved with the project. The ground itself fills the whole viewport in both 2D and 3D — there is no empty void around your plan. |
| **3. AI Fill** | Pick a room type (living / bedroom / office). A rule-based placement engine scores every free cell — wall affinity, centre affinity, door clearance — and places the best-fit unlocked items, then a refinement pass applies the relational design rules (see below). Built partitions are excluded. |
| **4. Fine-tune** | Click an item to select it: drag to move (grid-snapped, overlap-checked), `R` to rotate (wall pieces hop to the next wall), `Del` to remove, right-click for a Rotate / Duplicate / Delete menu, or replace it from the library. |
| **5. 3D** | The same room rendered with three.js: extruded walls with glazed windows and door openings, procedural low-poly furniture, shadows and an orbit camera. Drag items directly on the floor. |
| **6. Export** | 🖼 PNG (2D floorplan or 3D screenshot) · ⬇ GLB (floor + walls + furniture, opens in Sketchfab/Blender). |

### Item library

All 460 items (23 leaf categories × 20) live in `src/data/items.ts` as compact spec rows — footprint,
colours, style label and a variant spec that drives **both** the 2D footprint and the
procedural 3D mesh. No external art assets are required; every mesh is generated in code
(`src/three/Furniture.tsx`).

Tiers are assigned by row index: rows 0-2 = free, 3-7 = pro, 8-19 = max.

### 📐 149 design rules

AI Fill follows a built-in interior-design knowledge base — **149 rules** in 9 groups
(general, living, bedroom, kitchen, bathroom, dining, office, entryway, finishing),
transcribed in `src/logic/rules.ts` and browsable in-app via the **📐 Rules** button.
Rules marked **✓ AI** are enforced automatically by the layout engine:

- **Door & entry clearance** — a 36 in (0.91 m) zone in front of every door is blocked in
  the placement grid (swing + entry path), so neither AI Fill nor manual drops can block it.
- **Floating seating** — in rooms ≥ 16 m², seating is scored to sit 5–50 cm off the walls
  instead of being pushed flush against them.
- **Window clearance** — beds and tall pieces (≥ 1.2 m) are kept away from window walls.
- **Orientation** — sofa and bed backs are turned to the nearest wall (headboard on a solid
  wall, never a window); chairs face the sofa (or the desk) and stay within the 3 m
  conversation range.
- **Coffee table** — placed 35–45 cm in front of the sofa, centred on its axis, and its
  length is chosen as 1/2–2/3 of the sofa's.
- **Nightstands** — flank the bed head with a 5–15 cm gap, one per side.
- **Artwork** — hangs on the wall behind the sofa at gallery height (centre 1.45 m).
- **Rugs** — centred under the seating group (front legs on it) or beside the bed.
- **Lighting** — presets layer ambient + task + accent lights (pendant over the table at
  dining height, task lamp on the desk, wall sconces for the accent layer).

The remaining rules (kitchen work triangle, bathroom code clearances, dining clearances,
entryway console depths, …) are domain guidance for room types the planner doesn't model
yet — they ship in the knowledge base and the modal so the rule set is complete.

---

## Project structure

```
roomcraft/
├── api/create-checkout.js     # Vercel serverless: Stripe Checkout session
├── src/
│   ├── main.tsx / App.tsx     # layout: TopBar, Library, viewport, DetailPanel, StatusBar
│   ├── store.ts               # zustand store — all state & actions
│   ├── types.ts               # domain types, tier helpers, labels
│   ├── data/items.ts          # 460-item library (20 per category, 23 categories)
│   ├── logic/
│   │   ├── geometry.ts        # point-in-polygon, segments, centroid, area
│   │   ├── grid.ts            # 0.5 m placement grid from the polygon
│   │   └── placement.ts       # best-fit scoring + AI Fill presets
│   ├── components/
│   │   ├── Canvas2D.tsx       # draw / place / pan / zoom canvas
│   │   ├── Library.tsx        # left sidebar with tier gating
│   │   ├── DetailPanel.tsx    # selection details, colours, shortcuts
│   │   ├── TopBar.tsx         # modes, AI fill, export, plan badge
│   │   ├── UpgradeModal.tsx   # 3-plan pricing
│   │   └── Welcome.tsx        # onboarding
│   ├── three/
│   │   ├── Scene3D.tsx        # floor, walls, lights, orbit camera
│   │   └── Furniture.tsx      # procedural low-poly mesh builders
│   └── lib/
│       ├── checkout.ts        # Stripe / demo checkout flow
│       └── exporters.ts       # PNG + GLB download
└── vite.config.ts
```

---

## Monetisation (Stripe)

The app ships in **demo mode**: clicking *Choose Pro/Max* unlocks the tier instantly
(no payment) so you can test the full funnel. To bill for real:

1. Create two recurring Prices in Stripe (Pro $4.99/mo, Max $9.99/mo).
2. Copy `.env.example` → `.env` and fill in:

   ```
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
   VITE_STRIPE_PRICE_PRO=price_...
   VITE_STRIPE_PRICE_MAX=price_...
   ```

3. Deploy to **Vercel** with `STRIPE_SECRET_KEY` set — `api/create-checkout.js` creates the
   Checkout session and redirects the browser. Success URL returns to `/?tier=pro&status=success`.

> Production note: after Stripe redirects back you can verify the session in a serverless
> function and flip the account tier server-side (the current build trusts the client tier
> for demo purposes).

---

## Deploy

**Vercel** (recommended — serves the SPA and the `/api` function together):

```bash
npm i -g vercel
vercel          # framework: Vite, build: npm run build, output: dist
```

Any static host works for the frontend (`dist/`); point `/api/create-checkout` at a small
serverless function if you use Netlify/Cloudflare instead.

---

## Roadmap (from the product plan)

- [x] Floorplan drawing + wall/window/door openings
- [x] Rule-based AI placement (wall / centre / door scoring)
- [x] 460-item tiered library (3 / 8 / 20 per category × 23)
- [x] Mount-aware items: floor / wall / ceiling / surface placement
- [x] Right-click context menu + selection toolbar (rotate / duplicate / delete)
- [x] 2D canvas with drag, rotate, snap, overlap validation
- [x] Ground fills the viewport (2D) + fog-blended horizon (3D) — no empty void
- [x] Free wall-drawing tool: grid/vertex snap, 45° assist, loop close, click to delete
- [x] 3D mode (procedural meshes, orbit, drag-on-floor)
- [x] 3-tier pricing + Stripe checkout hook
- [x] PNG & GLB export, save/load projects
- [ ] Style filters (Scandinavian / Industrial / …) in AI Fill
- [ ] AI *render* preview (Replicate SDXL inpaint) — “see it photoreal”
- [ ] Affiliate product links per item (Wayfair / Amazon)
- [ ] AR view (WebXR) for room-scale preview
- [ ] Accounts + server-side entitlements (Supabase)

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Enter` | Close the room while drawing |
| `R` | Rotate the selected item 90° (wall items: next wall) |
| `Del` / `Backspace` | Remove the selected item |
| Right-click item | Context menu: Rotate / Duplicate / Delete |
| `Esc` | End wall chain / exit wall tool / cancel drawing / deselect / close modal |
| Mouse wheel | Zoom (2D) |
| Drag empty space | Pan (2D) |
| Right-drag / drag empty (3D) | Orbit the camera |
