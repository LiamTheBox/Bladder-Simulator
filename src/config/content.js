// All spoken text and drink data. Edit freely: nothing here affects the simulation rules.

export const drinks = [
  { name: "Water", icon: "💧", amt: 15, reaction: "Refreshing and clear." },
  { name: "Coffee", icon: "☕", amt: 20, reaction: "Whoa, caffeine makes me process so fast!" },
  { name: "Soda", icon: "🥤", amt: 25, reaction: "Fizzy! I feel bubbly inside." },
  { name: "Beer", icon: "🍺", amt: 35, reaction: "Oh no, alcohol goes straight through!" },
  { name: "Tea", icon: "🍵", amt: 15, reaction: "Warm and herbal. Very relaxing." },
  { name: "Energy Drink", icon: "⚡", amt: 25, reaction: "So much sugar and energy! It's intense!" },
  { name: "Milk", icon: "🥛", amt: 20, reaction: "Coating and smooth, a bit heavy." },
  { name: "Lemonade", icon: "🍋", amt: 20, reaction: "Sour! Makes me pucker up!" },
  { name: "Sports Drink", icon: "🧪", amt: 30, reaction: "Electrolytes! So salty and sweet." },
  { name: "Boba Tea", icon: "🧋", amt: 25, reaction: "Wait, are those tapioca pearls? Feels weird." },
  { name: "Hot Cocoa", icon: "🍫", amt: 20, reaction: "Warm, thick, and chocolatey. Cozy." },
  { name: "Apple Juice", icon: "🧃", amt: 15, reaction: "Sweet and tart, very refreshing." }
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
  leaks:   ["I'm springing leaks! Tap the cracks!", "Cracks! Patch them fast!"]
};
