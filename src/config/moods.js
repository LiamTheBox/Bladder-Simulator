// Moods: how the bladder feels about what just happened, for a while. A mood picks its faces from its own list
// (sim/step.js) until it fades. Faces are { e: eyes, m: mouth, x: [extras] }; the shapes are drawn in
// render/face.js. The newer shapes borrow from Kaomoji: >_< chevron, ^^ arch, T_T tearful, ° shock, ¬ flat
// (side-eye), ✧ sparkle, -_- heavy; ω cat, □ square, ▽ grin, 3 pout, ﹏ wobble; extras sweat, hatch (blush), vein.
export const MOOD_RULES = {
  grumpyAfter: 3.5,        // about four pokes / stretches within a few seconds make it grumpy
  annoyDecayPerSec: 0.25,  // ...because the count forgets one every 4 seconds
  yieldAbove: 0.9,         // above this fullness, while held shut, straining wins over any mood but frazzled
  frazzledUrge: 0.6,       // an urge wave this high on a bladder this full (%) frazzles it
  frazzledFill: 85,
};

export const MOODS = {
  grumpy: { sec: 20, faces: [{ e: 'flat', m: 'pout', x: ['vein'] }, { e: 'chevron', m: 'square', x: ['vein'] }, { e: 'flat', m: 'neutral', x: ['vein'] }],
    poked: { e: 'chevron', m: 'square', x: ['vein'] } },
  grateful: { sec: 25, faces: [{ e: 'arch', m: 'cat', x: ['hatch'] }, { e: 'happy_closed', m: 'cat', x: ['hatch'] }, { e: 'sparkle', m: 'grin' }] },
  smug: { sec: 15, faces: [{ e: 'flat', m: 'cat' }, { e: 'arch', m: 'grin' }, { e: 'sparkle', m: 'smile' }] },
  sulky: { sec: 15, faces: [{ e: 'heavy', m: 'pout' }, { e: 'tearful', m: 'wobble' }, { e: 'heavy', m: 'wobble', x: ['sweat'] }] },
  sheepish: { sec: 30, faces: [{ e: 'arch', m: 'wobble', x: ['hatch', 'sweat'] }, { e: 'heavy', m: 'wobble', x: ['hatch'] }, { e: 'happy_closed', m: 'nervous', x: ['hatch', 'sweat'] }] },
  mortified: { sec: 30, faces: [{ e: 'tearful', m: 'wobble', x: ['hatch'] }, { e: 'tearful', m: 'square' }, { e: 'shock', m: 'wobble', x: ['sweat', 'hatch'] }] },
  frazzled: { sec: 8, faces: [{ e: 'chevron', m: 'wobble', x: ['sweat'] }, { e: 'shock', m: 'square', x: ['sweat'] }, { e: 'chevron', m: 'zigzag', x: ['sweat'] }] },
};

// Without a mood, the newer faces join the old ones by fullness, so they show up in ordinary play too
export const EXTRA_FACES = {
  strained: [{ e: 'chevron', m: 'wobble', x: ['sweat'] }],
  uneasy: [{ e: 'heavy', m: 'wobble' }],
  calm: [{ e: 'arch', m: 'cat' }],
};
