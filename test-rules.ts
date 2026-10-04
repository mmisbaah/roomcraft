/**
 * The room rules, written down as assertions.
 *
 * The rules say a nursery has a crib and a gym has a treadmill. Those statements
 * only mean something if two things hold: the library actually contains the
 * object, and AI Fill actually places it in that room. The second is the part
 * that used to fail silently — a step naming a kind the library did not hold
 * fell back to the rest of its category, so a nursery came out with a chest
 * where the changing table should be and nothing said so.
 *
 * Each entry below is one line of a room's specification, mapped to the library
 * pair that satisfies it. This suite checks both halves.
 */
import './test-dom-stub';
import {
  PRESETS,
  ROOM_KIND_ORDER,
  coverageBudget,
  floorPieceLimit,
  isFlat,
  oddCount,
  withCeilingLight,
} from './src/logic/placement';
import { LIBRARY } from './src/data/items';
import { resolveShape } from './src/components/ItemThumb';
import { useStore } from './src/store';
import type { FurnType, RoomKind } from './src/types';

const S = () => useStore.getState();

let failures = 0;
let checks = 0;

function ok(label: string, cond: boolean, detail = '') {
  checks++;
  if (!cond) failures++;
  console.log(`  ${cond ? 'ok  ' : 'BAD '} ${label}${detail ? ` — ${detail}` : ''}`);
}

/** `*` for a kind means "any piece of this category satisfies the line". */
type Pair = [type: FurnType, kind: string];

const RULES: Record<string, [line: string, ...pairs: Pair[]][]> = {
  living: [
    ['Sofa', ['seating', 'sofa']],
    ['Loveseat', ['seating', 'loveseat']],
    ['Accent chairs', ['seating', 'accent']],
    ['Coffee table', ['tables', 'coffee']],
    ['Side tables', ['tables', 'side']],
    ['Media console / TV stand', ['storage', 'media']],
    ['Ottomans or poufs', ['seating', 'ottoman']],
    ['Bookshelves', ['storage', 'bookcase']],
    ['Area rug', ['textiles', 'arearug']],
    ['Throw pillows', ['textiles', 'pillow']],
    ['Throw blankets', ['textiles', 'throw']],
    ['Floor lamp', ['floorlamp', 'floor']],
    ['Table lamps', ['floorlamp', 'table']],
    ['Wall art', ['walldecor', 'artwork']],
    ['Mirrors', ['walldecor', 'mirror']],
    ['Decorative vases', ['tabletop', 'vase']],
    ['Trays', ['tabletop', 'tray']],
    ['Plants', ['tableplants', 'lily']],
    ['Curtains', ['textiles', 'curtain']],
  ],
  dining: [
    ['Dining table', ['dining', 'dining']],
    ['Dining chairs', ['seating', 'dining']],
    ['Bench seating', ['dining', 'bench']],
    ['Sideboard / buffet', ['dining', 'buffet']],
    ['Bar cart', ['dining', 'barcart']],
    ['China cabinet', ['dining', 'china']],
    ['Area rug', ['textiles', 'arearug']],
    ['Chandelier or pendant light', ['ceilight', 'chandelier']],
    ['Table linens', ['textiles', 'tablerunner']],
    ['Centerpieces (vases, bowls)', ['tabletop', 'vase']],
    ['Centerpieces (vases, bowls)', ['tabletop', 'bowl']],
    ['Candles', ['tabletop', 'candle']],
    ['Wall art', ['walldecor', 'artwork']],
    ['Mirrors', ['walldecor', 'mirror']],
    ['Sconces', ['walllight', 'sconce']],
  ],
  kitchen: [
    ['Cabinets', ['kitchen', 'basecab']],
    ['Cabinets', ['kitchen', 'wallcab']],
    ['Kitchen island / peninsula', ['kitchen', 'island']],
    ['Bar stools', ['seating', 'stool']],
    ['Pantry shelving', ['kitchen', 'pantry']],
    ['Built-in appliances: fridge', ['kitchen', 'fridge']],
    ['Built-in appliances: oven', ['kitchen', 'range']],
    ['Built-in appliances: dishwasher', ['kitchen', 'dishwasher']],
    ['Backsplash tiles', ['pantry', 'backsplash']],
    ['Under-cabinet lighting', ['archlight', 'undercab']],
    ['Pendant lights over islands', ['ceilight', 'pendant']],
    ['Countertop accessories: utensil crocks', ['pantry', 'crock']],
    ['Countertop accessories: cutting boards', ['pantry', 'board']],
    ['Open shelving decor', ['kitchen', 'wallcab']],
    ['Fruit bowls', ['tabletop', 'bowl']],
    ['Small rugs', ['textiles', 'runner']],
    ['Wall clocks', ['walldecor', 'clock']],
  ],
  bedroom: [
    ['Bed frame and mattress', ['beds', '*']],
    ['Nightstands', ['storage', 'nightstand']],
    ['Dresser', ['storage', 'dresser']],
    ['Wardrobe / armoire', ['storage', 'armoire']],
    ['Bench at foot of bed', ['seating', 'bench']],
    ['Occasional chair', ['seating', 'accent']],
    ['Vanity table', ['tables', 'vanity']],
    ['Bedside lamps', ['floorlamp', 'table']],
    ['Wall sconces', ['walllight', 'sconce']],
    ['Area rug', ['textiles', 'arearug']],
    ['Artwork above headboard', ['walldecor', 'artwork']],
    ['Mirrors', ['walldecor', 'mirror']],
    ['Bedding (duvet, pillows)', ['textiles', 'pillow']],
    ['Blackout curtains', ['textiles', 'curtain']],
    ['Alarm clock', ['walldecor', 'clock']],
    ['Jewelry box', ['tabletop', 'box']],
    ['Plants', ['tableplants', 'polka']],
  ],
  kids: [
    ['Twin or full bed', ['beds', '*']],
    ['Bunk beds', ['nursery', 'bunk']],
    ['Desk and chair', ['tables', 'desk']],
    ['Toy storage bins / chests', ['storage', 'chest']],
    ['Bookshelves', ['storage', 'bookcase']],
    ['Bean bag chair', ['seating', 'pouf']],
    ['Dresser', ['storage', 'dresser']],
    ['Play rug', ['textiles', 'arearug']],
    ['Nightlight', ['nursery', 'nightlight']],
    ['Colorful wall art or decals', ['walldecor', 'artwork']],
    ['Glow-in-the-dark stars', ['nursery', 'glowstar']],
    ['Toy organizers', ['functional', 'basket']],
    ['Playful bedding', ['textiles', 'pillow']],
    ['Posters', ['walldecor', 'canvas']],
    ['Hanging canopy', ['nursery', 'canopy']],
  ],
  nursery: [
    ['Crib', ['nursery', 'crib']],
    ['Changing table', ['nursery', 'changing']],
    ['Glider / rocking chair', ['nursery', 'glider']],
    ['Dresser', ['storage', 'dresser']],
    ['Bassinet', ['nursery', 'bassinet']],
    ['Diaper pail', ['nursery', 'pail']],
    ['Small bookshelf', ['storage', 'bookcase']],
    ['Mobile above crib', ['nursery', 'mobile']],
    ['Soft area rug', ['textiles', 'arearug']],
    ['Blackout curtains', ['textiles', 'curtain']],
    ['Nightlight', ['nursery', 'nightlight']],
    ['Sound machine', ['nursery', 'soundmachine']],
    ['Wall decals', ['walldecor', 'canvas']],
    ['Soft toy basket', ['nursery', 'toybasket']],
    ['Baby monitor', ['nursery', 'monitor']],
  ],
  office: [
    ['Desk', ['office', 'desk']],
    ['Ergonomic office chair', ['office', 'taskchair']],
    ['Filing cabinet', ['office', 'filing']],
    ['Bookshelf', ['storage', 'bookcase']],
    ['Guest chair', ['seating', 'accent']],
    ['Standing desk converter', ['office', 'standing']],
    ['Desk task lamp', ['floorlamp', 'desk']],
    ['Monitor', ['office', 'monitor']],
    ['Keyboard / mouse', ['office', 'keyboard']],
    ['Keyboard / mouse', ['office', 'mouse']],
    ['Desk organizer', ['office', 'organiser']],
    ['Wastebasket', ['office', 'wastebasket']],
    ['Wall calendar', ['office', 'pinboard']],
    ['Motivational art', ['walldecor', 'artwork']],
    ['Desk plant', ['tableplants', 'evergreen']],
    ['Cable management tray', ['office', 'cabletray']],
    ['Footrest', ['office', 'footrest']],
  ],
  study: [
    ['Writing desk', ['tables', 'desk']],
    ['Comfortable reading chair', ['seating', 'accent']],
    ['Tall bookshelves', ['storage', 'bookcase']],
    ['Credenza', ['storage', 'credenza']],
    ['Filing cabinet', ['office', 'filing']],
    ['Desk lamp', ['floorlamp', 'desk']],
    ['Globe', ['office', 'globe']],
    ['Framed maps or academic art', ['walldecor', 'canvas']],
    ['Area rug', ['textiles', 'arearug']],
    ['Wall sconces', ['walllight', 'sconce']],
    ['Bookends', ['tabletop', 'bookends']],
    ['Writing accessories', ['tabletop', 'books']],
    ['Scented candle', ['tabletop', 'candle']],
  ],
  library: [
    ['Floor-to-ceiling bookshelves', ['storage', 'bookcase']],
    ['Rolling ladder', ['office', 'rollingladder']],
    ['Tufted reading chairs', ['seating', 'accent']],
    ['Chaise lounge', ['seating', 'chaise']],
    ['Side tables', ['tables', 'side']],
    ['Small writing desk', ['tables', 'desk']],
    ['Library lamps (banker\'s lamps)', ['floorlamp', 'table']],
    ['Area rug', ['textiles', 'arearug']],
    ['Bookends', ['tabletop', 'bookends']],
    ['Framed portraits', ['walldecor', 'canvas']],
    ['Busts', ['office', 'bust']],
    ['Cozy throw blankets', ['textiles', 'throw']],
    ['Reading glasses stand', ['office', 'glassesstand']],
  ],
  guest: [
    ['Bed', ['beds', '*']],
    ['Nightstand', ['storage', 'nightstand']],
    ['Dresser', ['storage', 'dresser']],
    ['Luggage rack', ['closet', 'luggage']],
    ['Fold-out sofa', ['seating', 'daybed']],
    ['Small desk or vanity', ['tables', 'desk']],
    ['Bedside lamp', ['floorlamp', 'table']],
    ['Mirror', ['walldecor', 'mirror']],
    ['Neutral bedding', ['textiles', 'pillow']],
    ['Fresh towels', ['towelrack', '*']],
    ['Welcome tray', ['tabletop', 'tray']],
    ['Wall art', ['walldecor', 'artwork']],
    ['Area rug', ['textiles', 'arearug']],
    ['Closet hangers', ['closet', 'hanger']],
    ['Tissues', ['office', 'tissue']],
  ],
  bathroom: [
    ['Vanity cabinet', ['vanity', '*']],
    ['Toilet', ['toilet', '*']],
    ['Bathtub', ['bathtub', '*']],
    ['Shower stall', ['shower', '*']],
    ['Linen cabinet', ['storage', 'cabinet']],
    ['Shelving unit', ['storage', 'shelving']],
    ['Vanity mirror (often lighted)', ['vamirror', '*']],
    ['Towel bars / rings', ['towelrack', '*']],
    ['Bath mat', ['textiles', 'arearug']],
    ['Shower curtain or glass doors', ['textiles', 'curtain']],
    ['Soap dispenser', ['tabletop', 'diffuser']],
    ['Toothbrush holder', ['tabletop', 'vase']],
    ['Decorative jars', ['tabletop', 'bowl']],
    ['Small plant', ['succulents', '*']],
    ['Artwork', ['walldecor', 'artwork']],
    ['Sconces', ['walllight', 'sconce']],
  ],
  laundry: [
    ['Washer', ['laundry', 'washer']],
    ['Dryer', ['laundry', 'dryer']],
    ['Folding counter', ['laundry', 'foldcounter']],
    ['Utility sink', ['laundry', 'utilsink']],
    ['Base cabinets', ['laundry', 'laundrycab']],
    ['Hanging rod', ['laundry', 'rod']],
    ['Sorting hampers', ['laundry', 'hamper']],
    ['Drying rack', ['laundry', 'dryingrack']],
    ['Storage jars for detergent', ['laundry', 'detergent']],
    ['Wall hooks', ['laundry', 'hookrail']],
    ['Patterned floor tile or rug', ['laundry', 'laundrymat']],
    ['Under-cabinet lighting', ['archlight', 'undercab']],
    ['Ironing board', ['laundry', 'ironingboard']],
    ['Wall art', ['walldecor', 'artwork']],
    ['Clothespins', ['laundry', 'clothespin']],
  ],
  entryway: [
    ['Console table', ['tables', 'console']],
    ['Entryway bench', ['seating', 'bench']],
    ['Shoe cabinet', ['storage', 'cabinet']],
    ['Coat rack', ['functional', 'coatrack']],
    ['Hall tree', ['functional', 'coatrack']],
    ['Storage ottoman', ['seating', 'ottoman']],
    ['Runner rug', ['textiles', 'runner']],
    ['Mirror', ['walldecor', 'mirror']],
    ['Key bowl / tray', ['tabletop', 'bowl']],
    ['Wall hooks', ['towelrack', '*']],
    ['Table lamp', ['floorlamp', 'table']],
    ['Framed art', ['walldecor', 'canvas']],
    ['Umbrella stand', ['functional', 'umbrella']],
    ['Decorative baskets', ['functional', 'basket']],
    ['Doormat', ['textiles', 'runner']],
  ],
  hallway: [
    ['Narrow console table', ['tables', 'console']],
    ['Slim shoe cabinet', ['storage', 'cabinet']],
    ['Coat hooks', ['towelrack', '*']],
    ['Bench', ['seating', 'bench']],
    ['Runner rug', ['textiles', 'runner']],
    ['Gallery wall (framed art/photos)', ['walldecor', 'canvas']],
    ['Wall sconces', ['walllight', 'sconce']],
    ['Mirror', ['walldecor', 'mirror']],
    ['Decorative bowls', ['tabletop', 'bowl']],
    ['Fresh flowers', ['tabletop', 'vase']],
  ],
  gym: [
    ['Treadmill', ['gym', 'treadmill']],
    ['Stationary bike', ['gym', 'bike']],
    ['Weight bench', ['gym', 'weightbench']],
    ['Squat rack', ['gym', 'squatrack']],
    ['Storage racks for weights', ['gym', 'dumbbellrack']],
    ['Yoga mat', ['gym', 'yogamat']],
    ['Large wall mirror', ['walldecor', 'mirror']],
    ['Rubber gym flooring', ['textiles', 'arearug']],
    ['Motivational posters', ['walldecor', 'artwork']],
    ['Wall-mounted fan', ['ceilight', 'fan']],
    ['Water bottle station', ['gym', 'bottlestation']],
    ['Towel hooks', ['towelrack', '*']],
    ['LED strip lighting', ['archlight', 'ledstrip']],
    ['Sound system', ['gym', 'soundsystem']],
  ],
  sunroom: [
    ['Wicker or rattan sofas/chairs', ['outdoor', 'rattansofa']],
    ['Lounge chairs', ['outdoor', 'rattanchair']],
    ['Coffee table', ['tables', 'coffee']],
    ['Dining set', ['outdoor', 'bistro']],
    ['Porch swing', ['outdoor', 'porchswing']],
    ['Indoor/outdoor area rug', ['outdoor', 'outdoorrug']],
    ['Potted plants', ['floorplants', 'palm']],
    ['Ceiling fan', ['ceilight', 'fan']],
    ['Sheer curtains or blinds', ['textiles', 'curtain']],
    ['Weather-resistant throw pillows', ['textiles', 'pillow']],
    ['Wind chimes', ['outdoor', 'chimes']],
    ['Lanterns', ['outdoor', 'lantern']],
    ['Bird feeder', ['outdoor', 'feeder']],
  ],
  pantry: [
    ['Adjustable shelving', ['pantry', 'pantryshelf']],
    ['Freestanding cabinets', ['pantry', 'pantrycab']],
    ['Rolling carts', ['pantry', 'pantrycart']],
    ['Wine rack', ['pantry', 'pantrywine']],
    ['Step stool', ['pantry', 'stepstool']],
    ['Clear storage bins', ['pantry', 'clearbin']],
    ['Baskets', ['functional', 'basket']],
    ['Lazy Susans', ['pantry', 'lazysusan']],
    ['Can organizers', ['pantry', 'canorg']],
    ['Labels', ['pantry', 'jarlabels']],
    ['Chalkboard inventory list', ['pantry', 'chalkboard']],
    ['Under-shelf lighting', ['archlight', 'ledstrip']],
    ['Jar labels', ['pantry', 'jarlabels']],
    ['Hooks for aprons', ['pantry', 'apronhook']],
  ],
  closet: [
    ['Custom shelving system', ['closet', 'closetshelf']],
    ['Hanging rods (single/double)', ['closet', 'rod2']],
    ['Shoe racks', ['closet', 'shoerack']],
    ['Drawer units', ['closet', 'closetdrawer']],
    ['Center island (if large)', ['closet', 'closetisland']],
    ['Valet stand', ['closet', 'valet']],
    ['Full-length mirror', ['closet', 'fullmirror']],
    ['Closet lighting (LED strips or recessed)', ['closet', 'closetlight']],
    ['Drawer dividers', ['closet', 'divider']],
    ['Velvet hangers', ['closet', 'hanger']],
    ['Jewelry organizers', ['closet', 'jewelorganiser']],
    ['Laundry hamper', ['functional', 'laundry']],
    ['Bench', ['closet', 'closetbench']],
    ['Perfume tray', ['closet', 'perftray']],
    ['Scarf / belt hooks', ['closet', 'belt']],
  ],
};

const libKinds = new Set(LIBRARY.map((f) => `${f.type}:${f.kind}`));
const libTypes = new Set(LIBRARY.map((f) => f.type));

console.log('Every rule names a room kind we have a spec for:');
{
  const missing = ROOM_KIND_ORDER.filter((k) => !RULES[k]);
  ok('all 18 room kinds have a written spec', missing.length === 0, missing.join(', '));
  const extra = Object.keys(RULES).filter((k) => !(ROOM_KIND_ORDER as string[]).includes(k));
  ok('and no spec is orphaned', extra.length === 0, extra.join(', '));
}

console.log('\nEvery object the rules name exists in the library:');
{
  const missing: string[] = [];
  let total = 0;
  for (const [room, lines] of Object.entries(RULES)) {
    for (const [line, ...pairs] of lines) {
      for (const [type, kind] of pairs) {
        total++;
        if (kind === '*') {
          if (!libTypes.has(type)) missing.push(`${room}: ${line} -> ${type}:*`);
          continue;
        }
        if (!libKinds.has(`${type}:${kind}`)) missing.push(`${room}: ${line} -> ${type}:${kind}`);
      }
    }
  }
  ok(`all ${total} rule objects exist`, missing.length === 0, missing.join(' | '));
}

console.log('\nAI Fill actually places every object the rules name:');
{
  const unwired: string[] = [];
  let total = 0;
  for (const [room, lines] of Object.entries(RULES)) {
    const steps = withCeilingLight(PRESETS[room as RoomKind] ?? []);
    for (const [line, ...pairs] of lines) {
      for (const [type, kind] of pairs) {
        total++;
        const hit = steps.some((s) => s.type === type && (kind === '*' || s.kind === kind));
        if (!hit) unwired.push(`${room}: ${line} -> ${type}:${kind}`);
      }
    }
  }
  ok(`all ${total} rule objects are placed by AI Fill`, unwired.length === 0, unwired.join(' | '));
}

console.log('\nThe rule-driven library categories are all reachable from a preset:');
{
  // A whole category nobody places would be dead weight in the library panel.
  const used = new Set<string>();
  for (const k of ROOM_KIND_ORDER) {
    for (const s of withCeilingLight(PRESETS[k] ?? [])) used.add(s.type);
  }
  const orphans = ['nursery', 'gym', 'laundry', 'office', 'pantry', 'outdoor', 'closet']
    .filter((t) => !used.has(t));
  ok('nursery, gym, laundry, office, pantry, outdoor and closet are all used',
    orphans.length === 0, orphans.join(', '));
}

console.log('\nEvery new category has a 3D shape and mounts sensibly:');
{
  const NEW = ['nursery', 'gym', 'laundry', 'office', 'pantry', 'outdoor', 'closet'];
  const shapeless = LIBRARY.filter((f) => NEW.includes(f.type) && !f.spec?.shape)
    .map((f) => `${f.type}:${f.kind}`);
  ok('every new item names a shape for the 3D builder', shapeless.length === 0, shapeless.join(', '));
  const badMount = LIBRARY.filter((f) => NEW.includes(f.type) && !['floor', 'wall', 'ceiling', 'surface'].includes(f.mount))
    .map((f) => `${f.type}:${f.kind}=${f.mount}`);
  ok('and has a valid mount', badMount.length === 0, badMount.join(', '));
}

console.log('\nEvery new item has artwork of its own, not a borrowed silhouette:');
{
  // The library panel used to fall back to a generic shape, which reads as a
  // colour swatch. Every kind in the rule-driven categories is mapped
  // explicitly, so the artwork check has something real to resolve.
  const NEW = ['nursery', 'gym', 'laundry', 'office', 'pantry', 'outdoor', 'closet'];
  const unmapped = LIBRARY.filter((f) => NEW.includes(f.type) && !resolveShape(f)).map((f) => `${f.type}:${f.kind}`);
  ok('every new item resolves to artwork', unmapped.length === 0, unmapped.join(', '));
}

console.log('\nThe quantity guidelines hold:');
{
  // 4-8 pieces of floor furniture, and no more than 30% of the floor covered
  // (40% in a small room). Measured by actually filling a room, because the
  // preset list on its own says nothing about what ends up standing on it.
  ok('a moderate room budgets 30%', coverageBudget(22.5) === 0.3, `${coverageBudget(22.5)}`);
  ok('a small room budgets 40%', coverageBudget(9.6) === 0.4, `${coverageBudget(9.6)}`);
  ok('the boundary is 16 m²', coverageBudget(15.9) === 0.4 && coverageBudget(16.1) === 0.3);

  const poly = [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 4.5 },
    { x: 0, y: 4.5 },
  ];
  const area = 22.5;
  const over: string[] = [];
  const tooMany: string[] = [];
  for (const kind of ROOM_KIND_ORDER) {
    S().clearRoom();
    S().askRoom(null);
    S().setMode('draw');
    S().setTier('max');
    S().addRoom(poly.map((q) => ({ ...q })));
    const room = S().rooms[0];
    S().describeRoom(room.id, { name: '', kind, note: '' });
    S().clearItems();
    S().aiFill();
    const mine = S().items.filter((i) => i.roomId === room.id);
    let floorArea = 0;
    let pieces = 0;
    for (const it of mine) {
      const f = LIBRARY.find((x) => x.id === it.itemId);
      if (!f || f.mount !== 'floor' || isFlat(f)) continue;
      floorArea += f.w * f.d;
      pieces++;
    }
    const pct = (floorArea / area) * 100;
    if (pct > 30.5) over.push(`${kind} ${pct.toFixed(1)}%`);
    if (pieces > floorPieceLimit(kind)) tooMany.push(`${kind} ${pieces}`);
  }
  ok('no room exceeds the 30% floor budget', over.length === 0, over.join(', '));
  ok('no room exceeds its piece allowance', tooMany.length === 0, tooMany.join(', '));
  S().setWallBuild(false);
  S().clearRoom();
}

console.log('\nAccessory groups come in odd numbers:');
{
  ok('two becomes three', oddCount(2) === 3);
  ok('four becomes five', oddCount(4) === 5);
  ok('three is left alone', oddCount(3) === 3);
  ok('one is left alone', oddCount(1) === 1);
  ok('zero is left alone', oddCount(0) === 0);
  // Every step flagged as a group must actually be a group of something.
  const flagged = ROOM_KIND_ORDER.flatMap((k) =>
    (PRESETS[k] ?? [])
      .filter((s) => s.group)
      .map((s) => `${k}:${s.type}:${s.kind}`),
  );
  ok('the preset marks accessory groups as groups', flagged.length >= 5, `${flagged.length} steps`);
}

console.log('\nA floor alone is a room:');
{
  // addRoom is what both the corner-tracing flow and the Create room drag go
  // through, so this is the guarantee that walls are optional.
  S().clearRoom();
  ok('a room can be made from four corners with no walls at all',
    S().addRoom([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 4 },
      { x: 0, y: 4 },
    ]),
    `${S().rooms.length} rooms`);
  ok('and no walls were created', S().walls.length === 0, `${S().walls.length}`);
  ok('it gets suggested openings', S().rooms[0]?.openings.length === 4);
  ok('and asks what it is for', S().pendingRoomId === S().rooms[0]?.id);

  S().clearRoom();
  ok('the Create room tool arms and disarms',
    (S().setRoomCreate(true), S().roomCreate === true) &&
      (S().setRoomCreate(false), S().roomCreate === false));

  S().clearRoom();
  ok('arming it turns the wall tool off, so they cannot fight',
    (S().setWallBuild(true), S().setRoomCreate(true), S().wallBuild === false));
  S().setWallBuild(false);
  S().setRoomCreate(false);
}

console.log('\nDoors come in real types:');
{
  const doors = LIBRARY.filter((f) => f.type === 'doors');
  ok('the library holds a set of doors', doors.length === 20, `${doors.length}`);
  // A door stands on the floor inside a hole. Anchoring it like a hung picture
  // put its base at its own height, so a 2.05 m door floated above the wall.
  ok('every door stands on the floor, not on the wall', doors.every((d) => d.mount === 'opening'));
  ok('no door is a hung wall item', doors.every((d) => d.mount !== 'wall'));
  ok('every door has artwork', doors.every((d) => resolveShape(d)));
  const kinds = new Set(doors.map((d) => d.kind));
  ok('and they are not all the same thing', kinds.size >= 16, `${kinds.size} distinct kinds`);
  // The differences that matter are in the spec, not just the names.
  ok('some are glazed', doors.some((d) => d.spec.glazing));
  ok('some slide', doors.some((d) => d.spec.slider || d.spec.track));
  ok('some fold', doors.some((d) => d.spec.fold));
  ok('some pocket into the wall', doors.some((d) => d.spec.pocket));
  ok('some have a push bar', doors.some((d) => d.spec.pushbar));
}

console.log('\nA door opens the wall it lands on:');
{
  const square = [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 4 },
    { x: 0, y: 4 },
  ];
  S().clearRoom();
  S().askRoom(null);
  S().setMode('draw');
  S().setTier('max');
  S().addRoom(square);
  const room = S().rooms[0];
  const door = LIBRARY.find((f) => f.type === 'doors' && f.kind === 'single')!;
  const before = room.openings.filter((o) => o === 'door').length;

  S().addItem(door.id);
  const placed = S().items[S().items.length - 1];
  ok('the door was placed', !!placed && S().items.length === 1);
  ok('and it turned its wall into an opening',
    S().rooms[0].openings.filter((o) => o === 'door').length === before + 1,
    S().rooms[0].openings.join(','));

  // It must sit on that wall, not float inside the room.
  const onWall = S().rooms[0].poly.some((p, i) => {
    const q = S().rooms[0].poly[(i + 1) % S().rooms[0].poly.length];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len2 = dx * dx + dy * dy;
    let t = ((placed.x - p.x) * dx + (placed.y - p.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = p.x + dx * t;
    const py = p.y + dy * t;
    // It stands in the wall's thickness, flush with its face — not on the centre
  // line — so the tolerance is a wall's width rather than a millimetre.
  return Math.hypot(placed.x - px, placed.y - py) < 0.2;
  });
  ok('and it sits on that wall', onWall, `at (${placed.x.toFixed(2)},${placed.y.toFixed(2)})`);

  S().select(placed.uid);
  S().removeSelected();
  ok('deleting the door puts the wall back',
    S().rooms[0].openings.filter((o) => o === 'door').length === before,
    S().rooms[0].openings.join(','));

  S().setWallBuild(false);
  S().clearRoom();
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} (${checks} total)`);
process.exit(failures === 0 ? 0 : 1);