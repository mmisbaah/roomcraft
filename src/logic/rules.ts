// 📐 The 149 design rules behind AI Fill.
//
// This is RoomCraft's interior-design knowledge base: every rule the product
// ships with, grouped by room type. `RULES` is surfaced verbatim in the
// in-app "📐 Rules" modal; the subset marked `applied` is actively enforced
// by the placement engine (`placement.ts` → refineLayout + findFloorSpot)
// and by the door-clearance cells in `store.ts` → makeGrid.
//
// The numeric values the engine needs live in `CLEARANCE` so the code and
// the rule text can never drift apart.

export type RuleGroupId =
  | 'general'
  | 'living'
  | 'bedroom'
  | 'kitchen'
  | 'bath'
  | 'dining'
  | 'office'
  | 'entry'
  | 'finishing';

export interface RuleGroup {
  id: RuleGroupId;
  icon: string;
  name: string;
  blurb: string;
}

export const RULE_GROUPS: RuleGroup[] = [
  {
    id: 'general',
    icon: '📏',
    name: 'General rules for any room',
    blurb: 'Foundational rules that apply across all spaces, considered before arranging anything.',
  },
  {
    id: 'living',
    icon: '🛋️',
    name: 'Living room / sitting room',
    blurb: 'A multifunctional space balancing conversation, entertainment and relaxation zones.',
  },
  {
    id: 'bedroom',
    icon: '🛏️',
    name: 'Bedroom',
    blurb: 'A private retreat — the layout should prioritise rest, ease of movement and calm.',
  },
  {
    id: 'kitchen',
    icon: '🍳',
    name: 'Kitchen',
    blurb: 'A workspace where layout prioritises efficiency, safety and workflow.',
  },
  {
    id: 'bath',
    icon: '🚿',
    name: 'Bathroom / toilet',
    blurb: 'Compact rooms where precise clearances are critical for safety, comfort and code.',
  },
  {
    id: 'dining',
    icon: '🍽️',
    name: 'Dining room',
    blurb: 'Layouts that facilitate easy movement, comfortable seating and good conversation.',
  },
  {
    id: 'office',
    icon: '💻',
    name: 'Home office',
    blurb: 'An ergonomic workspace essential for comfort, health and productivity.',
  },
  {
    id: 'entry',
    icon: '🚪',
    name: 'Entryway',
    blurb: 'Balancing function, storage and a welcoming first impression.',
  },
  {
    id: 'finishing',
    icon: '💡',
    name: 'Lighting, rugs & artwork',
    blurb: 'The finishing touches critical to a well-designed room.',
  },
];

export interface DesignRule {
  id: number;
  group: RuleGroupId;
  /** Short bold name, e.g. "Plan traffic flow first". */
  title: string;
  /** The rule itself, shown after the title. */
  text: string;
  /** True when AI Fill's layout engine actively enforces this rule. */
  applied?: boolean;
}

export const RULES: DesignRule[] = [
  // 📏 General rules for any room (1–20)
  {
    id: 1,
    group: 'general',
    title: 'Plan traffic flow first',
    text: 'Identify natural paths between doorways and allow 30–36 inches (76–91 cm) for major routes and a minimum of 24 inches (61 cm) for minor ones.',
    applied: true,
  },
  {
    id: 2,
    group: 'general',
    title: 'Never block door swings',
    text: 'Ensure no furniture obstructs the full arc of any door, including closet and entry doors.',
    applied: true,
  },
  {
    id: 3,
    group: 'general',
    title: 'Anchor to architecture',
    text: "Place furniture relative to windows, fireplaces, and structural columns, using them as focal points rather than fighting the room's geometry.",
  },
  {
    id: 4,
    group: 'general',
    title: 'Establish a focal point',
    text: 'Every room needs a visual anchor (fireplace, view, artwork, or TV), and seating should be arranged around it.',
  },
  {
    id: 5,
    group: 'general',
    title: 'Scale furniture to the room',
    text: 'Choose pieces that fit the space; oversized furniture makes a room feel cramped, while too-small pieces can feel lost.',
  },
  {
    id: 6,
    group: 'general',
    title: 'Float furniture where possible',
    text: 'Pulling seating away from walls creates a more intimate, conversational grouping.',
    applied: true,
  },
  {
    id: 7,
    group: 'general',
    title: 'Create balance',
    text: 'Use symmetrical arrangements (matching pieces) for formal rooms and asymmetrical arrangements (different sizes and shapes balanced visually) for casual spaces.',
  },
  {
    id: 8,
    group: 'general',
    title: 'Use the 2:1 ratio',
    text: 'A common rule is to balance one large piece (like a sofa) with two smaller pieces (like chairs) to create symmetry with variety.',
  },
  {
    id: 9,
    group: 'general',
    title: 'Maintain conversation distance',
    text: 'For comfortable conversation without raising voices, keep seating within 8 to 10 feet (2.4–3 m) of each other.',
    applied: true,
  },
  {
    id: 10,
    group: 'general',
    title: 'Respect the "four-inch seating rule"',
    text: 'The seat height difference between sofas and chairs in the same room should not exceed 4 inches (10 cm) to facilitate natural eye contact and conversation.',
  },
  {
    id: 11,
    group: 'general',
    title: 'Leave room to move',
    text: 'In high-traffic areas, leave 3 to 4 feet (91–122 cm) of space; in lower-traffic areas, 2 to 3 feet (61–91 cm) is sufficient.',
  },
  {
    id: 12,
    group: 'general',
    title: 'Hang art at gallery height',
    text: 'The center of artwork should hang about 57 inches (145 cm) from the floor, or 10 inches (25 cm) above the top of a sofa back.',
    applied: true,
  },
  {
    id: 13,
    group: 'general',
    title: 'Use rugs to define zones',
    text: 'A rug should be large enough to allow at least the front legs of furniture to rest on it, but not so large that it leaves more than 2 feet (61 cm) of empty rug beyond the furniture.',
    applied: true,
  },
  {
    id: 14,
    group: 'general',
    title: 'Layer lighting',
    text: 'Combine ambient (overhead), task (reading lamps), and accent lighting to create a functional and inviting atmosphere.',
    applied: true,
  },
  {
    id: 15,
    group: 'general',
    title: "Don't ignore outlets",
    text: 'Plan furniture placement around electrical outlets, cable jacks, and lighting fixtures to avoid extension cords.',
  },
  {
    id: 16,
    group: 'general',
    title: 'Consider the golden ratio',
    text: 'Apply the 2:3 rule (or golden ratio) to divide a room into zones or to determine proportions, such as a sofa being roughly two-thirds the length of the wall it sits against.',
  },
  {
    id: 17,
    group: 'general',
    title: 'Ensure clear pathways at entries',
    text: 'Never place furniture in the main pathway of an entryway; leave at least 36 inches (91 cm) of clear walkway.',
    applied: true,
  },
  {
    id: 18,
    group: 'general',
    title: 'Use vertical space',
    text: 'Draw the eye upward with tall bookshelves, artwork, or curtains hung near the ceiling to make rooms feel larger.',
  },
  {
    id: 19,
    group: 'general',
    title: 'Group accessories in odd numbers',
    text: 'Arranging decorative items in groups of three or five is visually more pleasing than even numbers.',
  },
  {
    id: 20,
    group: 'general',
    title: 'Test with tape',
    text: 'Before moving heavy furniture, use painter’s tape on the floor to map out proposed furniture footprints and walkways.',
  },

  // 🛋️ Living room / sitting room (21–40)
  {
    id: 21,
    group: 'living',
    title: 'Sofa to coffee table distance',
    text: 'Leave 14–18 inches (35–45 cm) between the sofa and coffee table for easy reach and legroom.',
    applied: true,
  },
  {
    id: 22,
    group: 'living',
    title: 'Coffee table length',
    text: 'The coffee table should be about 1/2 to 2/3 the length of the sofa.',
    applied: true,
  },
  {
    id: 23,
    group: 'living',
    title: 'Coffee table height',
    text: 'Keep the coffee table 1–4 inches (2.5–10 cm) lower than the sofa seat cushions.',
  },
  {
    id: 24,
    group: 'living',
    title: 'Seating to TV distance',
    text: 'The ideal viewing distance is about 1.5 times the diagonal measurement of the TV screen.',
  },
  {
    id: 25,
    group: 'living',
    title: 'Distance between seats',
    text: 'Leave at least 30–36 inches (76–91 cm) between seating pieces to allow for comfortable conversation and walking.',
  },
  {
    id: 26,
    group: 'living',
    title: 'Maximum conversation distance',
    text: 'Seating should be no more than 8 to 10 feet (2.4–3 m) apart for comfortable conversation.',
    applied: true,
  },
  {
    id: 27,
    group: 'living',
    title: 'Side table reach',
    text: 'Place side tables close enough to seating that you can set down a drink without getting up.',
  },
  {
    id: 28,
    group: 'living',
    title: 'Rug placement',
    text: 'In a large room, leave at least 2 feet (61 cm) of bare floor around a room-sized rug; in a smaller room, at least 12 inches (30 cm).',
  },
  {
    id: 29,
    group: 'living',
    title: 'Pull seating away from walls',
    text: 'Floating the main seating area and anchoring it with a rug creates a cozier, more intentional space.',
    applied: true,
  },
  {
    id: 30,
    group: 'living',
    title: 'Maintain clear walkways',
    text: 'Ensure main walking paths are 30–36 inches (76–91 cm) wide.',
  },
  {
    id: 31,
    group: 'living',
    title: 'Symmetrical layout for formal rooms',
    text: 'Use matching chairs, paired lamps, and a centered sofa for a balanced, formal look.',
  },
  {
    id: 32,
    group: 'living',
    title: 'Asymmetrical layout for casual rooms',
    text: 'Use different sizes, weights, and shapes balanced visually for a more relaxed feel.',
  },
  {
    id: 33,
    group: 'living',
    title: 'Anchor the seating group',
    text: 'The sofa is usually the largest piece; place it first, then build the rest of the arrangement around it.',
    applied: true,
  },
  {
    id: 34,
    group: 'living',
    title: "Don't push all furniture against walls",
    text: 'Unless the room is very small, this makes the space feel disconnected and awkward.',
  },
  {
    id: 35,
    group: 'living',
    title: 'Define a conversation circle',
    text: 'Angle chairs slightly toward each other to encourage conversation.',
    applied: true,
  },
  {
    id: 36,
    group: 'living',
    title: 'Avoid blocking windows',
    text: "Don't place tall furniture in front of windows unless privacy is needed; let natural light flow through the room.",
    applied: true,
  },
  {
    id: 37,
    group: 'living',
    title: 'Use an L-shaped layout',
    text: 'This arrangement opens up the middle of the room and works well for both conversation and TV viewing.',
  },
  {
    id: 38,
    group: 'living',
    title: 'Balance visual weight',
    text: 'Counter a heavy sofa with a large piece of art or a tall plant on the opposite side of the room.',
  },
  {
    id: 39,
    group: 'living',
    title: 'Keep the path to the door clear',
    text: 'Never place furniture in a direct line between the main entry and the seating area.',
    applied: true,
  },
  {
    id: 40,
    group: 'living',
    title: 'Consider the "four-inch rule"',
    text: 'Ensure the seat height difference between sofas and chairs is no more than 4 inches (10 cm) to avoid awkward conversation dynamics.',
  },

  // 🛏️ Bedroom (41–60)
  {
    id: 41,
    group: 'bedroom',
    title: 'Clearance on each side of bed',
    text: 'Ideally, leave at least 60–75 cm (24–30 inches) of clear walking space on each occupied side of the bed.',
  },
  {
    id: 42,
    group: 'bedroom',
    title: 'Clearance at the foot of bed',
    text: 'If the foot of the bed is a walkway, leave at least 70 cm (28 inches) of clearance.',
  },
  {
    id: 43,
    group: 'bedroom',
    title: 'Clearance in front of wardrobe',
    text: 'Allow 90 cm (36 inches) in front of a wardrobe with hinged doors (measured with doors open); sliding doors require about 60 cm (24 inches).',
  },
  {
    id: 44,
    group: 'bedroom',
    title: 'Clearance in front of dresser',
    text: 'Leave 75–90 cm (30–36 inches) in front of a chest of drawers so a fully open drawer leaves standing room.',
  },
  {
    id: 45,
    group: 'bedroom',
    title: 'Nightstand spacing',
    text: 'Leave a small gap of 2–6 inches (5–15 cm) between the bed and each nightstand to keep them visually connected without crowding.',
    applied: true,
  },
  {
    id: 46,
    group: 'bedroom',
    title: 'Nightstand height',
    text: 'Nightstands should be approximately level with the top of the mattress, or within 2–3 inches (5–7.5 cm) higher or lower.',
  },
  {
    id: 47,
    group: 'bedroom',
    title: 'Bed placement (Feng Shui)',
    text: 'Position the bed in a "commanding position"—as far from the door as possible but with a clear diagonal view of it, without the foot directly in line with the door.',
  },
  {
    id: 48,
    group: 'bedroom',
    title: 'Solid wall behind headboard',
    text: 'Always place the head of the bed against a solid wall for a sense of security and stability.',
    applied: true,
  },
  {
    id: 49,
    group: 'bedroom',
    title: 'Avoid under-window placement',
    text: 'Avoid placing the bed directly under a window, as this can disrupt sleep with drafts and light.',
    applied: true,
  },
  {
    id: 50,
    group: 'bedroom',
    title: 'Avoid under beams',
    text: 'Do not place the bed under a structural beam or sloped ceiling, as this can create a feeling of pressure.',
  },
  {
    id: 51,
    group: 'bedroom',
    title: 'Bed placement for couples',
    text: 'Both sides of the bed need access for couples, which is the single biggest constraint on bed size in a modest room.',
  },
  {
    id: 52,
    group: 'bedroom',
    title: 'Allow space for making the bed',
    text: 'If one side of the bed is against a wall, ensure there is still enough room to comfortably make the bed.',
  },
  {
    id: 53,
    group: 'bedroom',
    title: 'Keep the path to the bathroom clear',
    text: 'Ensure a clear, unobstructed path from the bed to the bathroom door.',
  },
  {
    id: 54,
    group: 'bedroom',
    title: 'Place a bench or stool at the foot',
    text: 'If space allows, a bench or stool at the foot of the bed provides a place to sit and put on shoes.',
  },
  {
    id: 55,
    group: 'bedroom',
    title: 'Use rugs for comfort',
    text: 'Place a rug beside the bed so your feet land on a soft surface when getting up.',
    applied: true,
  },
  {
    id: 56,
    group: 'bedroom',
    title: 'Consider bed size carefully',
    text: 'Standard bed footprints: Single (90x190cm), Double (135x190cm), King (150x200cm), Super King (180x200cm). Add 5–10cm for the frame.',
  },
  {
    id: 57,
    group: 'bedroom',
    title: "Don't block closet doors",
    text: 'Ensure no furniture obstructs the full swing of closet doors.',
    applied: true,
  },
  {
    id: 58,
    group: 'bedroom',
    title: 'Keep the room clutter-free',
    text: 'A tidy, uncluttered bedroom promotes better sleep and a calmer atmosphere.',
  },
  {
    id: 59,
    group: 'bedroom',
    title: 'Balance the room',
    text: 'If the bed is centered on one wall, balance the opposite side of the room with a dresser or a seating area.',
  },
  {
    id: 60,
    group: 'bedroom',
    title: 'Nightstands should be reachable',
    text: 'Place nightstands close enough to the bed that you can reach items without getting up.',
    applied: true,
  },

  // 🍳 Kitchen (61–82)
  {
    id: 61,
    group: 'kitchen',
    title: 'The work triangle',
    text: 'The distance between the sink, refrigerator, and cooking surface should form a triangle with no leg less than 4 ft (1.2 m) or greater than 9 ft (2.7 m); the total distance should be between 12 and 26 ft (3.7–7.9 m).',
  },
  {
    id: 62,
    group: 'kitchen',
    title: 'Do not obstruct the work triangle',
    text: 'Traffic patterns and cabinets should not intersect any leg of the triangle by more than 12 inches (30 cm).',
  },
  {
    id: 63,
    group: 'kitchen',
    title: 'Single cook walkway',
    text: 'Allow at least 42 inches (107 cm) for a main work aisle.',
  },
  {
    id: 64,
    group: 'kitchen',
    title: 'Multiple cook walkway',
    text: 'Allow at least 48 inches (122 cm) for a work aisle in a kitchen with multiple cooks.',
  },
  {
    id: 65,
    group: 'kitchen',
    title: 'Kitchen island clearance',
    text: 'Maintain at least 36–48 inches (91–122 cm) of space around a kitchen island.',
  },
  {
    id: 66,
    group: 'kitchen',
    title: 'Island seating clearance',
    text: 'Behind island seating, allow at least 1.2 m (48 inches) to ensure ease of movement.',
  },
  {
    id: 67,
    group: 'kitchen',
    title: 'Landing space beside fridge',
    text: 'Provide at least 15 inches (38 cm) of counter space on one or both sides of the refrigerator.',
  },
  {
    id: 68,
    group: 'kitchen',
    title: 'Landing space beside cooktop',
    text: 'Provide at least 15 inches (38 cm) of clear counter space on either side of the cooktop.',
  },
  {
    id: 69,
    group: 'kitchen',
    title: 'Landing space beside sink',
    text: 'Provide at least 24 inches (61 cm) of counter area on one side and 18 inches (46 cm) on the other side of the sink.',
  },
  {
    id: 70,
    group: 'kitchen',
    title: 'Landing space above under-counter fridge',
    text: 'If no side landing is possible, provide 15 inches (38 cm) of landing space no more than 48 inches (122 cm) in front of the fridge.',
  },
  {
    id: 71,
    group: 'kitchen',
    title: 'Minimum walkway between cabinets',
    text: 'The minimum clearance between cabinets for one person is 40 inches (102 cm); 42 inches (107 cm) is more generous.',
  },
  {
    id: 72,
    group: 'kitchen',
    title: 'Two-person walkway between cabinets',
    text: 'Allow 48 inches (122 cm) for two people to pass comfortably.',
  },
  {
    id: 73,
    group: 'kitchen',
    title: 'Entrances to kitchen',
    text: 'Make entrances at least 28 inches (71 cm) wide for a tight kitchen; 32 inches (81 cm) is better.',
  },
  {
    id: 74,
    group: 'kitchen',
    title: 'Walkways in kitchen',
    text: 'Make walkways at least 36 inches (91 cm) wide; 42 inches (107 cm) is a better target.',
  },
  {
    id: 75,
    group: 'kitchen',
    title: 'Cabinet access clearance',
    text: 'Allow at least 36 inches (91 cm) of clearance from the cabinet front to a wall or obstacle.',
  },
  {
    id: 76,
    group: 'kitchen',
    title: 'Do not separate primary work centers',
    text: 'Never place a refrigerator, wall oven, or pantry cabinet between the main sink and cooktop.',
  },
  {
    id: 77,
    group: 'kitchen',
    title: 'Daylighting',
    text: 'The combined area of windows and skylights should equal at least 10% of the kitchen floor area.',
  },
  {
    id: 78,
    group: 'kitchen',
    title: 'Oven door clearance',
    text: 'In front of an oven door, the minimum clearance is 42 inches (107 cm) for code compliance.',
  },
  {
    id: 79,
    group: 'kitchen',
    title: 'Prep zone',
    text: 'The prep zone should be adjacent to the sink and have at least 36 inches (91 cm) of workspace (42–48 inches is ideal).',
  },
  {
    id: 80,
    group: 'kitchen',
    title: 'Cooking zone',
    text: 'The cooking zone should be adjacent to or directly across from the prep zone.',
  },
  {
    id: 81,
    group: 'kitchen',
    title: 'Cleanup zone',
    text: 'The cleanup zone typically works best when it is centered on the sink.',
  },
  {
    id: 82,
    group: 'kitchen',
    title: 'Store items where they are used',
    text: 'Keep dishes near the dishwasher, pots and pans near the cooktop, and food near the refrigerator.',
  },

  // 🚿 Bathroom / toilet (83–99)
  {
    id: 83,
    group: 'bath',
    title: 'Toilet centerline',
    text: 'The centerline of the toilet must be at least 15 inches (38 cm) from any side wall or obstruction, and ideally 16–18 inches (41–46 cm).',
  },
  {
    id: 84,
    group: 'bath',
    title: 'Toilet side clearance',
    text: 'There should be a clear 40 cm (15.7 inches) from each side of the toilet, centralizing it in an 80 cm (31.5 inch) clearance area.',
    applied: true,
  },
  {
    id: 85,
    group: 'bath',
    title: 'Toilet front clearance',
    text: 'Leave at least 21 inches (53 cm) of clear space in front of the toilet, measured from the front edge of the bowl to the opposite wall, vanity, tub, or door swing.',
    applied: true,
  },
  {
    id: 86,
    group: 'bath',
    title: 'Toilet paper holder placement',
    text: 'Install the holder 20–30 cm (8–12 inches) from the front of the toilet and about 65 cm (26 inches) high.',
  },
  {
    id: 87,
    group: 'bath',
    title: 'Vanity front clearance',
    text: 'Allow at least 21 inches (53 cm) of clear space in front of the vanity as a minimum working zone; 30 inches (76 cm) feels much better.',
  },
  {
    id: 88,
    group: 'bath',
    title: 'Vanity centerline',
    text: 'The centerline of the lavatory should be a minimum of 15 inches (38 cm) from an adjoining wall or fixture.',
  },
  {
    id: 89,
    group: 'bath',
    title: 'Vanity height',
    text: 'The top of the fixture rim should be a maximum of 2 feet 10 inches (86 cm) above the finished floor.',
    applied: true,
  },
  {
    id: 90,
    group: 'bath',
    title: 'Kneespace below vanity',
    text: 'If kneespace is provided, the bottom of the apron shall be at least 27 inches (69 cm) above the floor.',
  },
  {
    id: 91,
    group: 'bath',
    title: 'Shower clearance',
    text: 'A clear floor space of at least 30 inches (76 cm) wide by 48 inches (122 cm) long should be available outside the shower stall.',
  },
  {
    id: 92,
    group: 'bath',
    title: 'Shower interior size',
    text: 'Shower compartments must have at least 900 square inches of finished interior area and be capable of encompassing a 30-inch (76 cm) circle.',
    applied: true,
  },
  {
    id: 93,
    group: 'bath',
    title: 'Bathtub clearance',
    text: 'Clearance in front of bathtubs shall be 30 inches (76 cm) wide minimum by 48 inches (122 cm) long minimum, measured from the foot end of the bathtub.',
  },
  {
    id: 94,
    group: 'bath',
    title: 'Door clearance',
    text: 'Avoid placing a door directly in front of a toilet in large bathrooms; use sliding doors in compact bathrooms to save space.',
  },
  {
    id: 95,
    group: 'bath',
    title: 'Window clearance',
    text: 'Ensure windows are accessible and do not clash with sanitary items; determine window height and glass type to ensure privacy.',
  },
  {
    id: 96,
    group: 'bath',
    title: 'Ventilation',
    text: 'Have at least one window for ventilation, or install mechanical ventilation if a window is not possible.',
  },
  {
    id: 97,
    group: 'bath',
    title: 'Maneuvering clearance for accessibility',
    text: 'For accessible bathrooms, maneuvering clearance around a water closet shall be 60 inches (1525 mm) minimum in width and 56 inches (1420 mm) minimum in depth.',
  },
  {
    id: 98,
    group: 'bath',
    title: 'Lavatory clearance for accessibility',
    text: 'Provide at least 29 inches (735 mm) above the finish floor to the bottom of the apron.',
  },
  {
    id: 99,
    group: 'bath',
    title: 'Shower maneuvering clearance for accessibility',
    text: 'Maneuvering clearance at the shower compartment of 60 inches (1525 mm) minimum in length adjacent to the open face of the shower compartment, and 30 inches (762 mm) minimum in depth.',
  },

  // 🍽️ Dining room (100–112)
  {
    id: 100,
    group: 'dining',
    title: 'Clearance around table',
    text: 'Leave at least 36 inches (91 cm) of clearance around all sides of the table to allow people to move in and out comfortably.',
  },
  {
    id: 101,
    group: 'dining',
    title: 'Clearance for pulling out chairs',
    text: 'Allow 24 inches (61 cm) behind each chair for pulling it out, and 36 inches (91 cm) if someone needs to walk behind a seated diner.',
  },
  {
    id: 102,
    group: 'dining',
    title: 'Space per person at table',
    text: 'Allow 24 inches (61 cm) of seating room per person at the table.',
  },
  {
    id: 103,
    group: 'dining',
    title: 'Rug size',
    text: 'The area rug should extend at least 24 inches (61 cm) beyond the edge of the table on all sides, so chairs can slide back without catching.',
  },
  {
    id: 104,
    group: 'dining',
    title: 'Rug size (metric)',
    text: 'Extend the rug at least 60 cm beyond each side of the table; 70–80 cm is ideal.',
  },
  {
    id: 105,
    group: 'dining',
    title: 'Chandelier height',
    text: 'Hang a chandelier or pendant 30–36 inches (76–91 cm) above the table surface for balanced light and easy conversation.',
    applied: true,
  },
  {
    id: 106,
    group: 'dining',
    title: 'Chandelier height with higher ceilings',
    text: 'For each additional foot of ceiling height above 8 feet, raise the chandelier 3 inches (7.5 cm).',
  },
  {
    id: 107,
    group: 'dining',
    title: "Don't line walls with furniture",
    text: 'Avoid placing too many pieces of furniture along the walls; it makes the room feel cramped.',
  },
  {
    id: 108,
    group: 'dining',
    title: 'Choose the right scale',
    text: 'Select a dining table, chandelier, and window treatments that are the right scale for the room.',
  },
  {
    id: 109,
    group: 'dining',
    title: 'Avoid visual clutter',
    text: "Don't over-style the table with too many candles, vases, and knickknacks; use a single striking focal point.",
  },
  {
    id: 110,
    group: 'dining',
    title: 'Table depth',
    text: 'The general recommended depth for a dining table is 30 to 36 inches (76–91 cm).',
  },
  {
    id: 111,
    group: 'dining',
    title: 'Clearance in front of dressers',
    text: 'Allow 80 to 120 cm (31–47 inches) in front of drawers and dressers so they can open comfortably.',
  },
  {
    id: 112,
    group: 'dining',
    title: 'Round table for small spaces',
    text: 'A round dining table can soften a small room and improve flow.',
  },

  // 💻 Home office (113–125)
  {
    id: 113,
    group: 'office',
    title: 'Desk and chair alignment',
    text: 'Maintain 90° angles at elbows, hips, and knees, with feet flat on the floor or on a footrest.',
  },
  {
    id: 114,
    group: 'office',
    title: 'Monitor height',
    text: 'The top of the monitor should sit at eyebrow height (or 2–3 inches below eye level) to keep your head and neck in a neutral position.',
  },
  {
    id: 115,
    group: 'office',
    title: 'Monitor distance',
    text: 'Place the monitor at least 20 inches (51 cm) away, or approximately an arm’s length; 20–40 inches (51–102 cm) is the preferred viewing distance.',
  },
  {
    id: 116,
    group: 'office',
    title: 'Dual monitor setup',
    text: 'Center the meeting point of two screens in front of your face and try to look equally at each screen.',
  },
  {
    id: 117,
    group: 'office',
    title: 'Keyboard and mouse position',
    text: 'Keep elbows at a 90° angle while typing; keep the keyboard flat to allow a neutral wrist position.',
  },
  {
    id: 118,
    group: 'office',
    title: 'Lighting',
    text: 'Achieve a balance of natural and artificial lighting; avoid placing monitors where the sun shines on them, causing glare.',
    applied: true,
  },
  {
    id: 119,
    group: 'office',
    title: 'Desk placement',
    text: 'Position your desk so you have a clear view of the door, but avoid placing it directly in front of the door where your chair might get knocked.',
  },
  {
    id: 120,
    group: 'office',
    title: 'Window placement',
    text: 'Position the desk perpendicular to the window, neither facing it (screen glare) nor with your back to it (shadows on documents).',
  },
  {
    id: 121,
    group: 'office',
    title: 'Avoid high-traffic paths',
    text: 'Avoid placing your desk in high-traffic paths to minimize distractions.',
  },
  {
    id: 122,
    group: 'office',
    title: 'Lumbar support',
    text: 'Use a chair with dynamic lumbar support to maintain the natural curve of your lower back.',
  },
  {
    id: 123,
    group: 'office',
    title: 'Seat depth',
    text: 'Adjust the seat pan depth so there are 2–3 fingers of space between the back of your knee and the seat edge.',
  },
  {
    id: 124,
    group: 'office',
    title: 'Standing desk',
    text: 'If using a standing desk, adjust the height so your elbows rest at a 90° angle while typing.',
  },
  {
    id: 125,
    group: 'office',
    title: 'Clutter-free space',
    text: 'Reduce distractions by keeping your workspace organized and free of stacked papers and scattered notes.',
  },

  // 🚪 Entryway (126–138)
  {
    id: 126,
    group: 'entry',
    title: 'Clear walkway',
    text: 'The primary walkway should be at least 36 inches (91 cm) wide; 42 inches is more comfortable.',
    applied: true,
  },
  {
    id: 127,
    group: 'entry',
    title: 'Console table depth',
    text: 'Keep the console 12 to 14 inches (30–36 cm) deep so the walkway stays clear.',
  },
  {
    id: 128,
    group: 'entry',
    title: 'Console table clearance',
    text: 'Ensure at least 36 inches (91 cm) of clear walking path after placing the console.',
  },
  {
    id: 129,
    group: 'entry',
    title: 'Door swing clearance',
    text: 'Leave 4 to 6 inches (10–15 cm) beyond the full arc of the door to the front edge of the console.',
  },
  {
    id: 130,
    group: 'entry',
    title: 'Bench placement',
    text: 'Place a settee or bench just outside the main pathway, giving someone a comfortable place to remove shoes without obstructing movement.',
  },
  {
    id: 131,
    group: 'entry',
    title: 'Bench height',
    text: 'A standard entryway bench is 17–19 inches (43–48 cm) high, similar to a dining chair.',
  },
  {
    id: 132,
    group: 'entry',
    title: 'Bench depth',
    text: 'A comfortable bench depth is 14–18 inches (36–46 cm).',
  },
  {
    id: 133,
    group: 'entry',
    title: 'Bench clearance',
    text: 'Leave around 36 inches (91 cm) of clearance in front of the bench.',
  },
  {
    id: 134,
    group: 'entry',
    title: 'Rug size',
    text: 'Choose a rug that anchors the entry and relates to the furniture around it without getting in the way; ensure the door can open and close over it.',
  },
  {
    id: 135,
    group: 'entry',
    title: 'Limit furniture',
    text: 'Avoid trying to fit too many pieces (console, bench, cabinet, coat rack) into the entryway; a single strategic piece often works better.',
  },
  {
    id: 136,
    group: 'entry',
    title: 'Create zones',
    text: 'Group items that go together (keys, mail, bags) and zone them off to support your daily routine.',
  },
  {
    id: 137,
    group: 'entry',
    title: 'Use closed storage',
    text: 'Incorporate closed storage for out-of-season coats and clutter to keep the space visually calm.',
  },
  {
    id: 138,
    group: 'entry',
    title: 'Choose light furniture',
    text: 'Heavy or dark furniture can make a small entryway feel cramped; opt for streamlined, lighter pieces.',
  },

  // 💡 Lighting, rugs & artwork (139–149)
  {
    id: 139,
    group: 'finishing',
    title: 'Layer lighting',
    text: 'Combine ambient (overhead), task (reading lamps), and accent lighting for a functional and inviting space.',
    applied: true,
  },
  {
    id: 140,
    group: 'finishing',
    title: 'Dining chandelier height',
    text: 'Hang 30–36 inches (76–91 cm) above the table.',
    applied: true,
  },
  {
    id: 141,
    group: 'finishing',
    title: 'Rug in living room',
    text: 'Allow at least the front legs of seating to rest on the rug.',
    applied: true,
  },
  {
    id: 142,
    group: 'finishing',
    title: 'Rug in dining room',
    text: 'Extend at least 24 inches (61 cm) beyond the table edge on all sides.',
  },
  {
    id: 143,
    group: 'finishing',
    title: 'Rug in bedroom',
    text: 'Place a rug beside the bed so your feet land on a soft surface.',
    applied: true,
  },
  {
    id: 144,
    group: 'finishing',
    title: 'Artwork height',
    text: 'Hang art at gallery height, about 57 inches (145 cm) from the floor to the center of the piece.',
    applied: true,
  },
  {
    id: 145,
    group: 'finishing',
    title: 'Artwork above sofa',
    text: 'The bottom of the artwork should be 10 inches (25 cm) above the top of the sofa back.',
    applied: true,
  },
  {
    id: 146,
    group: 'finishing',
    title: 'Use mirrors to brighten',
    text: 'Mirrors can reflect light and make dark rooms feel brighter and larger.',
  },
  {
    id: 147,
    group: 'finishing',
    title: "Don't block windows",
    text: 'Keep tall furniture away from windows to let natural light flow.',
    applied: true,
  },
  {
    id: 148,
    group: 'finishing',
    title: 'Use task lighting',
    text: 'Place reading lamps near chairs and beds for focused light.',
    applied: true,
  },
  {
    id: 149,
    group: 'finishing',
    title: 'Repeat materials',
    text: 'Repeat shapes, colors, or materials throughout the room to create rhythm and unity.',
  },
];

/** Number of rules the layout engine actively enforces. */
export const APPLIED_COUNT = RULES.filter((r) => r.applied).length;

/**
 * Numeric clearances extracted from the rules above — the single source of
 * truth for the placement engine, so code and rule text never drift apart.
 */
export const CLEARANCE = {
  /** R1/R2/R17/R126 —36 in kept clear in front of every door (swing + entry path). */
  doorApproach: 0.91,
  /** R6/R29 — seating floats off the walls when the room allows it. */
  floatMin: 0.05,
  floatMax: 0.5,
  /** Rooms smaller than this keep furniture against the walls (R34). */
  floatMinArea: 16,
  /** R9/R26 — seats stay within conversation distance. */
  conversationMax: 3.0,
  /** R21 — sofa ↔ coffee table reach gap. */
  sofaCoffeeMin: 0.35,
  sofaCoffeeMax: 0.45,
  /** R22 — coffee table length as a fraction of the sofa length. */
  coffeeLenMin: 0.5,
  coffeeLenMax: 0.667,
  /** R45/R60 — gap between bed and nightstand. */
  nightstandMin: 0.05,
  nightstandMax: 0.15,
  /** R12/R144 — gallery-height centre for wall art. */
  artCenterH: 1.45,
  /** R105 — pendant shade hangs this far above the table it lights. */
  chandelierAbove: 0.85,
  /** R36/R49/R147 — beds and tall pieces keep this far from window walls. */
  windowClear: 0.5,
  /** Height at which floor items count as "tall" for the window rule. */
  tallItemH: 1.2,
  /** R55/R143 — the bedside rug slides this far under the bed. */
  rugUnderBed: 0.4,
  /** R84 — clear space each side of the toilet bowl (80 cm zone). */
  toiletSide: 0.4,
  /** R85 — clear space in front of the toilet bowl. */
  toiletFront: 0.53,
};
