// All spoken text and drink data. Edit freely: nothing here affects the simulation rules.

// feel: how the drink sounds going down (audio/engine.js): "plain", "fizzy" (a fizz after the gulps),
// "thick" (lower, slower gulps) or "hot" (a slurp first). A bigger amt means more gulps.
// speed: how fast it reaches the bladder (1 = water, higher = sooner; sim/actions.js queueDrink). effect: "diuretic"
// (an extra share arrives over the following minute) or "relaxing" (holding costs more stamina for a while).
// hint: the few words the drink menu shows about it.
export const drinks = [
  { name: "Water", icon: "💧", amt: 15, feel: "plain", speed: 1, hint: "Steady", reaction: "Refreshing and clear." },
  { name: "Coffee", icon: "☕", amt: 20, feel: "hot", speed: 1.4, effect: "diuretic", hint: "Fast, keeps coming", reaction: "Whoa, caffeine makes me process so fast!" },
  { name: "Soda", icon: "🥤", amt: 25, feel: "fizzy", speed: 1.1, hint: "Fizzy", reaction: "Fizzy! I feel bubbly inside." },
  { name: "Beer", icon: "🍺", amt: 35, feel: "fizzy", speed: 1.3, effect: "relaxing", hint: "Harder to hold", reaction: "Oh no, alcohol goes straight through!" },
  { name: "Tea", icon: "🍵", amt: 15, feel: "hot", speed: 1.2, effect: "diuretic", hint: "Keeps coming", reaction: "Warm and herbal. Very relaxing." },
  { name: "Energy Drink", icon: "⚡", amt: 25, feel: "fizzy", speed: 1.4, effect: "diuretic", hint: "Fast, keeps coming", reaction: "So much sugar and energy! It's intense!" },
  { name: "Milk", icon: "🥛", amt: 20, feel: "thick", speed: 0.6, hint: "Slow", reaction: "Coating and smooth, a bit heavy." },
  { name: "Lemonade", icon: "🍋", amt: 20, feel: "plain", speed: 1, hint: "Steady", reaction: "Sour! Makes me pucker up!" },
  { name: "Sports Drink", icon: "🧪", amt: 30, feel: "plain", speed: 0.8, hint: "Slow, steady", reaction: "Electrolytes! So salty and sweet." },
  { name: "Boba Tea", icon: "🧋", amt: 25, feel: "thick", speed: 0.6, hint: "Slow", reaction: "Wait, are those tapioca pearls? Feels weird." },
  { name: "Hot Cocoa", icon: "🍫", amt: 20, feel: "thick", speed: 0.7, hint: "Slow", reaction: "Warm, thick, and chocolatey. Cozy." },
  { name: "Apple Juice", icon: "🧃", amt: 15, feel: "plain", speed: 1, hint: "Steady", reaction: "Sweet and tart, very refreshing." }
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
  fail: ["Ahh, I slipped a little!", "I can't focus!", "Ow, I lost my grip!"],
  gave_in: ["...Don't look at me like that.", "We agreed never to speak of this.", "That was not my finest hour.", "I'm blushing. Can bladders blush? I'm blushing."]
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
  sneak_a_pee: ["Quick, while nobody is listening! Hold to go!", "Now! Go! But stop when they call!"],
  pressure_valve: ["Pressure building! Hold, and let go in the green!", "Vent it slowly! Release in the green!"],
  clench_slider: ["I'm coming apart at the seam! Drag it back to the middle!", "Zip me up! Keep the slider centred!"],
  brace: ["Jolts coming! Brace the way the arrow points!", "Here comes a lurch! Brace, brace!"],
  volley: ["Small talk! Answer normally, don't let me talk!", "Act natural! Pick the sensible answer!"],
  on_the_spot: ["Decide! Any answer, just decide fast!", "No time to think! Pick one, quick!"]
};

// Names shown in Settings, where each minigame can be switched off
export const minigameNames = {
  mash: 'Clench (rapid tapping)', leaks: 'Leaks (tap the cracks)', breathe: 'Breathe (hold and release)',
  swipe_away: 'Swipe away (flick the card)', distraction_popups: 'Distractions (tap the popups)', tremor_lock: 'Steady (tap on the beat)',
  tiptoe: 'Tiptoe (drag slowly)', steady_the_slosh: 'Steady the slosh (keep the wave centred)',
  think_of_something_else: 'Think of something else (tap the numbers in order)',
  sneak_a_pee: 'Sneak a pee (hold to go, stop when they listen)',
  pressure_valve: 'Pressure valve (hold, release in the green)', clench_slider: 'Clench slider (keep the seam centred)',
  brace: 'Brace (tap the way the arrow points)', volley: 'Volley (quick small talk)', on_the_spot: 'On the spot (decide fast)',
};

// What someone outside the door says during sneak_a_pee, unless a story gives its own lines
export const outsideLines = ["Hello? Anyone in there?", "Everything all right in there?", "Are you nearly done?"];
// Volley: a question, the sensible answer, and what the bladder would blurt out instead (a story may bring its own)
export const volleyQuestions = [
  { q: "How was the trip?", good: "Long, but fine!", odd: "WET. I mean, fine." },
  { q: "Want some more tea?", good: "I'm good, thanks.", odd: "Pour it straight in, why not." },
  { q: "You look flushed. Okay?", good: "Just warm in here.", odd: "Flushed? Who said flush?" },
  { q: "Shall we take the scenic route?", good: "Sounds lovely.", odd: "Is there a toilet on it?" },
  { q: "What do you do for fun?", good: "Reading, mostly.", odd: "Hold it. Professionally." },
  { q: "Did you hear the rain last night?", good: "Yes, very cosy.", odd: "Please don't mention rain." },
  { q: "Sit down, relax!", good: "Thanks, I'll stand a bit.", odd: "Relax?! Are you mad?" },
];
// On the spot: two awkward options, neither wrong; only hesitating costs
export const spotDilemmas = [
  { q: "They offer a second coffee.", a: "Accept politely", b: "Decline, risk offending" },
  { q: "The queue is long. A friend waves you over.", a: "Cut in with them", b: "Stay and wait" },
  { q: "Asked to help carry boxes upstairs.", a: "Help, carefully", b: "Invent a sore back" },
  { q: "Someone is in the only bathroom.", a: "Knock and ask", b: "Wait and squirm" },
  { q: "A photo! Everyone squeezes together.", a: "Squeeze in", b: "Offer to take it" },
];
// Placeholder wording for the UI-intrusion minigames
export const swipeCardTexts = ["JUST LET GO", "Nobody would know", "Open up, it's fine", "Give in already"];
export const popupWords = ["Spasm!", "Ache!", "Twinge!", "Cramp!", "Throb!"];
// What the bladder shouts during think_of_something_else; {n} becomes a number that is NOT the next one
export const countHeckles = ["{n}! Tap {n}!", "It's {n} next, trust me!", "{n}, {n}, {n}!", "Skip to {n}, hurry!", "Forget counting. {n}!"];
