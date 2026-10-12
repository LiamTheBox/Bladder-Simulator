// All spoken text and drink data. Edit freely: nothing here affects the simulation rules.

// feel: how the drink sounds going down (audio/engine.js): "plain", "fizzy" (a fizz after the gulps),
// "thick" (lower, slower gulps) or "hot" (a slurp first). A bigger amt means more gulps.
export const drinks = [
  { name: "Water", icon: "💧", amt: 15, feel: "plain", reaction: "Refreshing and clear." },
  { name: "Coffee", icon: "☕", amt: 20, feel: "hot", reaction: "Whoa, caffeine makes me process so fast!" },
  { name: "Soda", icon: "🥤", amt: 25, feel: "fizzy", reaction: "Fizzy! I feel bubbly inside." },
  { name: "Beer", icon: "🍺", amt: 35, feel: "fizzy", reaction: "Oh no, alcohol goes straight through!" },
  { name: "Tea", icon: "🍵", amt: 15, feel: "hot", reaction: "Warm and herbal. Very relaxing." },
  { name: "Energy Drink", icon: "⚡", amt: 25, feel: "fizzy", reaction: "So much sugar and energy! It's intense!" },
  { name: "Milk", icon: "🥛", amt: 20, feel: "thick", reaction: "Coating and smooth, a bit heavy." },
  { name: "Lemonade", icon: "🍋", amt: 20, feel: "plain", reaction: "Sour! Makes me pucker up!" },
  { name: "Sports Drink", icon: "🧪", amt: 30, feel: "plain", reaction: "Electrolytes! So salty and sweet." },
  { name: "Boba Tea", icon: "🧋", amt: 25, feel: "thick", reaction: "Wait, are those tapioca pearls? Feels weird." },
  { name: "Hot Cocoa", icon: "🍫", amt: 20, feel: "thick", reaction: "Warm, thick, and chocolatey. Cozy." },
  { name: "Apple Juice", icon: "🧃", amt: 15, feel: "plain", reaction: "Sweet and tart, very refreshing." }
];

export const voiceLines = {
  filling: ["Getting fuller.", "Digesting nicely.", "I can feel it expanding."],
  desperate: ["I can't hold it much longer!", "Too full!", "I'm going to burst!", "The pressure is immense!"],
  begging: ["Please... I'll do anything!", "Why are you making me hold this?", "Have a heart, let me drain!"],
  voiding: ["Ahhh, sweet relief.", "Emptying the tank.", "Whoosh... feels so much better."],
  poke: ["Hey, careful!", "Don't poke me!", "That tickles."],
  stretch: ["Whoa! You're pulling too hard!", "Yikes! Watch the elasticity!"],
  casual: ["Just hanging out, holding fluid.", "Nice and squishy."],
  soothe: ["Mmm, that feels nice.", "Oh, that's soothing."],
  squeeze: ["Agh! Don't squeeze!", "Too much pressure!"],
  accident: ["Oh no! I lost control!", "I couldn't hold it!", "I'm having an accident!", "No no no, it's leaking!"],
  success_hold: ["Phew, fought that urge off.", "I can keep holding it.", "Stay strong, seal!"],
  fail: ["Ahh, I slipped a little!", "I can't focus!", "Ow, I lost my grip!"]
};

// What the bladder says to announce each urge-spike minigame (shown in the bubble and spoken).
export const minigameLines = {
  mash:    ["Urge spike! Mash CLENCH!", "It's coming! Clench, clench, clench!"],
  breathe: ["Breathe with me! Hold as I grow, let go as I shrink.", "Slow breaths! Hold the circle while it grows."],
  leaks:   ["I'm springing leaks! Tap the cracks!", "Cracks! Patch them fast!"],
  swipe_away: ["Don't listen to that! Flick it away!", "No, no, no! Swipe that thought away!"],
  distraction_popups: ["Too many feelings! Tap them away!", "Ignore the twinges! Tap, tap, tap!"],
  tremor_lock: ["I'm shaking! Tap with my heartbeat to steady me!", "Steady... tap on the beat!"],
  tiptoe: ["Slowly! Every bump sloshes me!", "Tiptoe... don't you dare rush."],
  steady_the_slosh: ["I'm sloshing! Keep me level!", "It's running to one side! Pull it back!"],
  think_of_something_else: ["Think of anything else! Count: one, two...", "Distract yourself! Tap the numbers in order."],
  sneak_a_pee: ["Quick, while nobody is listening! Hold to go!", "Now! Go! But stop when they call!"]
};

// Names shown in Settings, where each minigame can be switched off
export const minigameNames = {
  mash: 'Clench (rapid tapping)', leaks: 'Leaks (tap the cracks)', breathe: 'Breathe (hold and release)',
  swipe_away: 'Swipe away (flick the card)', distraction_popups: 'Distractions (tap the popups)', tremor_lock: 'Steady (tap on the beat)',
  tiptoe: 'Tiptoe (drag slowly)', steady_the_slosh: 'Steady the slosh (keep the wave centred)',
  think_of_something_else: 'Think of something else (tap the numbers in order)',
  sneak_a_pee: 'Sneak a pee (hold to go, stop when they listen)',
};

// What someone outside the door says during sneak_a_pee, unless a story gives its own lines
export const outsideLines = ["Hello? Anyone in there?", "Everything all right in there?", "Are you nearly done?"];
// Placeholder wording for the UI-intrusion minigames
export const swipeCardTexts = ["JUST LET GO", "Nobody would know", "Open up, it's fine", "Give in already"];
export const popupWords = ["Spasm!", "Ache!", "Twinge!", "Cramp!", "Throb!"];
// What the bladder shouts during think_of_something_else; {n} becomes a number that is NOT the next one
export const countHeckles = ["{n}! Tap {n}!", "It's {n} next, trust me!", "{n}, {n}, {n}!", "Skip to {n}, hurry!", "Forget counting. {n}!"];
