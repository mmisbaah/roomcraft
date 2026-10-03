/**
 * Tests for the room-description terms that feed AI Fill.
 *
 * A description is free text written by hand, so the parsing has to cope with
 * negation ("no dining table") and with descriptions that merely restate the
 * room's purpose, which must not change the layout.
 *
 * Run with: npm run test:rooms
 */
import { PRESETS, stepsFromNote } from './src/logic/placement';
import { ROOM_KIND_ORDER, ROOM_LABEL } from './src/logic/placement';
import { LIBRARY } from './src/data/items';
import type { FurnType, RoomKind } from './src/types';

let failures = 0;
let checks = 0;

function ok(label: string, cond: boolean, detail = '') {
  checks++;
  if (!cond) failures++;
  console.log(`  ${cond ? 'ok  ' : 'BAD '} ${label}${detail ? ` — ${detail}` : ''}`);
}

/** Compact form of the steps a note produces, e.g. `kitchen:fridge`. */
const keys = (steps: { type: FurnType; kind?: string }[]) =>
  steps.map((s) => `${s.type}:${s.kind ?? ''}`);

console.log('An explicit request in the description is honoured:');
{
  ok('"small double bed" adds a bed', keys(stepsFromNote('small double bed')).includes('beds:'),
    keys(stepsFromNote('small double bed')).join(', '));
  ok('"needs a desk" adds a desk', keys(stepsFromNote('needs a desk')).includes('tables:desk'));
  ok('"island in the middle" adds an island', keys(stepsFromNote('island in the middle')).includes('kitchen:island'));
  ok('"shelving for books" adds a bookcase', keys(stepsFromNote('shelving for books')).includes('storage:bookcase'));
  ok('"sofa facing the TV" adds both',
    keys(stepsFromNote('sofa facing the TV')).includes('seating:sofa') &&
    keys(stepsFromNote('sofa facing the TV')).includes('functional:media'));
  ok('an empty description adds nothing', stepsFromNote('').length === 0);
  ok('an unrecognised description adds nothing', stepsFromNote('some words with no furniture in them').length === 0);
}

console.log('\nNegation is respected:');
{
  const noDining = keys(stepsFromNote('galley kitchen for two, no dining table'));
  ok('"no dining table" places no dining table', !noDining.includes('dining:dining'), noDining.join(', '));
  ok('"without a sofa" places no sofa', !keys(stepsFromNote('lounge without a sofa')).includes('seating:sofa'));
  ok('"avoid the dining table" places none',
    !keys(stepsFromNote('avoid the dining table anything')).includes('dining:dining'));
  // The rest of the sentence still counts.
  ok('other terms in the same sentence survive',
    keys(stepsFromNote('kitchen for two, no dining table, but needs an island')).includes('kitchen:island'));
}

console.log('\nRestating the room purpose changes nothing:');
{
  // A kitchen that says "kitchen" should not gain a second, redundant set.
  const kitchenBaseline = keys(PRESETS.kitchen);
  ok('kitchen baseline is non-empty', kitchenBaseline.length > 0, `${kitchenBaseline.length} steps`);
  const withWord = keys(stepsFromNote('this is a kitchen', 'kitchen'));
  const allCovered = withWord.every((k) => kitchenBaseline.includes(k));
  ok('"this is a kitchen" adds nothing new to a kitchen', withWord.length === 0 || allCovered, withWord.join(', '));

  const living = keys(stepsFromNote('living room with a big sofa', 'living'));
  ok('"living room with a big sofa" adds only what the preset lacks',
    living.every((k) => !PRESETS.living.some((s) => `${s.type}:${s.kind ?? ''}` === k)) || living.length === 0,
    living.join(', '));
}

console.log('\nA description that contradicts the purpose still wins:');
{
  // A bedroom that explicitly wants a desk should get one, even though the
  // bedroom preset has no desk step.
  const steps = keys(stepsFromNote('bedroom but it also needs a desk', 'bedroom'));
  ok('a desk asked for in a bedroom is added', steps.includes('tables:desk'), steps.join(', '));
}

console.log('\nEvery step the parser can emit must name real library items:');
{
  const notes = [
    'sofa, tv, plant, lamp, rug, bookshelf, fireplace, mirror, curtains',
    'bed, nightstand, wardrobe, art, shower, bathtub, toilet, vanity, towels',
    'fridge, sink, island, range, dishwasher, dining table, sideboard, wine rack',
    'desk, chair, dresser, hamper, bench, bar cart',
  ];
  const byKind = new Map<string, { type: FurnType }[]>();
  for (const f of LIBRARY) {
    if (!byKind.has(f.kind)) byKind.set(f.kind, []);
    byKind.get(f.kind)!.push(f);
  }
  let missing: string[] = [];
  let checked = 0;
  for (const n of notes) {
    for (const s of stepsFromNote(n)) {
      checked++;
      const kind = s.kind;
      // A step with no kind (e.g. 'beds') just needs its category to exist.
      const types = kind ? undefined : undefined;
      if (kind && !byKind.has(kind)) missing.push(`${n} -> ${s.type}:${kind}`);
      if (!kind && !LIBRARY.some((f) => f.type === s.type)) missing.push(`${n} -> ${s.type}`);
      void types;
    }
  }
  ok(`all ${checked} parsed steps match real kinds`, missing.length === 0, missing.join(' | '));
}

console.log('\nEvery room kind has a preset, a label and an entry in the picker order:');
{
  const missingPreset = ROOM_KIND_ORDER.filter((k: RoomKind) => !PRESETS[k]?.length);
  ok('every kind has objects to place', missingPreset.length === 0, missingPreset.join(', '));
  const missingLabel = ROOM_KIND_ORDER.filter((k: RoomKind) => !ROOM_LABEL[k]);
  ok('every kind has a label', missingLabel.length === 0, missingLabel.join(', '));
  ok('kinds, labels and picker order agree',
    ROOM_KIND_ORDER.length === Object.keys(ROOM_LABEL).length &&
    ROOM_KIND_ORDER.every((k) => Object.keys(ROOM_LABEL).includes(k)));
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} (${checks} total)`);
process.exit(failures === 0 ? 0 : 1);