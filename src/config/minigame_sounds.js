// One short signature per minigame, played just after the spike alarm, so the game can be told apart by ear.
// tone:  notes [pitch, start (s), length (s)] on a soft triangle synth
// noise: bursts [start (s), length (s), filter frequency (Hz)] of filtered noise (hiss, whoosh, clicks)
// Placeholders made by code (audio/engine.js playMinigameSignature); edit a row to change a game's sound.
export const MINIGAME_SOUNDS = {
  mash: { tone: [["C3", 0, 0.05], ["C3", 0.08, 0.05], ["C3", 0.16, 0.05]] },                     // thump-thump-thump
  leaks: { tone: [["A6", 0, 0.03], ["E6", 0.12, 0.03], ["C6", 0.24, 0.03]] },                    // drip, drip, drip
  breathe: { noise: [[0, 0.5, 900]] },                                                            // a long breath in
  swipe_away: { noise: [[0, 0.22, 2500]] },                                                       // whoosh
  distraction_popups: { tone: [["G5", 0, 0.03], ["D6", 0.07, 0.03], ["B5", 0.14, 0.03], ["F6", 0.21, 0.03]] }, // pop-pop-pop
  tremor_lock: { tone: [["A2", 0, 0.08], ["A2", 0.16, 0.1]] },                                   // lub-dub
  tiptoe: { tone: [["E5", 0, 0.04], ["G5", 0.25, 0.04], ["E5", 0.5, 0.04]] },                    // pizzicato steps
  steady_the_slosh: { noise: [[0, 0.28, 500], [0.33, 0.28, 400]] },                               // slosh, slosh
  think_of_something_else: { tone: [["C5", 0, 0.05], ["D5", 0.1, 0.05], ["E5", 0.2, 0.05]] },    // one, two, three
  sneak_a_pee: { noise: [[0, 0.05, 300], [0.15, 0.05, 300]] },                                    // knock knock
  pressure_valve: { noise: [[0, 0.6, 5000]] },                                                    // hiss
  clench_slider: { noise: [[0, 0.02, 3000], [0.05, 0.02, 3000], [0.1, 0.02, 3000], [0.15, 0.02, 3000], [0.2, 0.02, 3000]] }, // zip ratchet
  brace: { tone: [["C3", 0, 0.12], ["G5", 0.14, 0.06]] },                                        // thud, ping
  volley: { tone: [["A5", 0, 0.04], ["C6", 0.06, 0.04], ["G5", 0.12, 0.04], ["B5", 0.18, 0.04]] }, // chatter
  on_the_spot: { tone: [["E4", 0, 0.12], ["F4", 0.14, 0.12], ["F#4", 0.28, 0.2]] },              // rising tension
};
