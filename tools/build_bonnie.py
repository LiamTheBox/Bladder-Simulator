#!/usr/bin/env python3
"""Writes stories/bonnies_journey.json. The story is long, so it is kept here in a compact form and
generated; edit this file and run `python3 tools/build_bonnie.py`. The game only ever reads the JSON."""
import json, pathlib

N = 'narrator'
def L(speaker, text, bladder=None, mood=None, when=None):
    d = {"speaker": speaker, "text": text}
    if mood: d["mood"] = mood
    if bladder: d["bladder"] = bladder
    if when: d["if"] = when
    return d
def S(stat, add): return {"stat": stat, "add": add}
def SET(stat, v): return {"stat": stat, "set": v}
def M(n): return {"minutes": n}
def D(n): return {"drink": n}
def F(name, value=True): return {"flag": name, "value": value} if value is not True else {"flag": name}
def C(text, effects=None, next=None, minigame=None, when=None):
    d = {"text": text}
    if when: d["if"] = when
    if effects: d["effects"] = effects
    if minigame: d["minigame"] = minigame
    if next: d["next"] = next
    return d
def G(id, difficulty, prompt, win=None, lose=None, win_next=None, lose_next=None):
    g = {"id": id, "difficulty": difficulty, "prompt": prompt}
    s = {}; f = {}
    if win: s["effects"] = win
    if win_next: s["next"] = win_next
    if lose: f["effects"] = lose
    if lose_next: f["next"] = lose_next
    if s: g["success"] = s
    if f: g["fail"] = f
    return g
def OFFER(refuse, hover, busy, next):
    return {"set": "bathroom_offer", "texts": {"refuse": refuse, "hover": hover, "busy": busy}, "next": next}
def scene(id, title, chapter, lines, choices=None, next=None, enter=None, triggers=None):
    d = {"id": id, "title": title, "chapter": chapter}
    if enter: d["onEnter"] = enter
    d["lines"] = lines
    if triggers: d["triggers"] = triggers
    if choices: d["choices"] = choices
    if next: d["next"] = next
    return d

DAY = [{"flag": "day_started"}]
NIGHT1 = [{"flag": "day_started", "is": False}]
CH = ["Chapter 1", "Chapter 2", "Chapter 3", "Chapter 4", "Chapter 5", "Chapter 6", "Chapter 7"]

scenes = [
 # ---------------- Chapter 1: 4:10 AM, the silent house ----------------
 scene("bed", "4:10 AM — The Silent House", CH[0], [
   L(N, "The red digits on the nightstand click over to 4:10. Under the blanket, Bonnie curls her toes and bites her lip."),
   L(N, "She has not been since yesterday afternoon. That was the challenge she set herself: flawless manners, total composure, and nobody inconvenienced. It is going badly.", "I filed a complaint at midnight. Nobody answered."),
   L(N, "Through the wall, Dad's snoring is slow and even. Chloe's room next door is quiet. The taxi comes at eight. If she is ever going to go, it is now. Silently.", "There is a bathroom downstairs. Fourteen steps. I counted.")],
  choices=[
   C("Slide out of bed slowly. Every spring of this mattress is a tattletale.", [M(4), S("control", -6)], "hallway"),
   C("Just get UP. Speed over silence. Not one more minute.", [M(1), S("suspicion", 30), S("control", 3)], "hallway"),
   C("Lie still one more minute and listen to the house. Be sure.", [M(3), S("control", -4), F("listened")], "hallway")]),
 scene("hallway", "4:14 AM — The Hallway", CH[0], [
   L(N, "The landing is cold under her feet. Chloe's door is open a hand's width."),
   L(N, "She already knows which board outside Chloe's door complains. She steps over it.", when=[{"flag": "listened"}]),
   L("chloe", "Mmh... Bonnie...?", "She's awake. We are DONE. Abort, or run for it?", mood="sleepy")],
  choices=[
   C("Slip back to my room and KEEP HOLDING. The record is not over.", [F("hard_mode"), S("halo", 10), M(2)], "back_in_bed"),
   {"set": "noise_response", "texts": {
      "freeze": "Freeze. Wait. Let her settle back into sleep, then carry on.",
      "push_on": "Whisper \"just getting water\" and keep walking."}, "next": "stairs"}]),
 scene("back_in_bed", "4:17 AM — Back Under the Blanket", CH[0], [
   L(N, "Bonnie eases the door shut and climbs back into bed like someone defusing it. Hard mode. Nobody asked her to. That is rather the point."),
   L(N, "The wave arrives on schedule.", "You had ONE chance. You were RIGHT THERE.")],
  choices=[
   C("Face it. Ride out the wave.", [M(20)], minigame=G("mash", 2, "Hold the line! Hold it!", win=[S("control", 10)], win_next="hard_morning", lose=[S("control", -15)], lose_next="second_thoughts")),
   C("This is absurd. Go. Now. Properly this time.", [S("halo", -10)], "second_thoughts")]),
 scene("hard_morning", "4:40 AM — The Record Stands", CH[0], [
   L(N, "The wave passes. The record stands, and so does the problem. Bonnie stares at the ceiling until the alarm goes. Everything from here will be harder. She is, somehow, pleased.", "I want it noted that I objected.")],
  next="breakfast_suit"),
 scene("second_thoughts", "4:38 AM — Second Thoughts", CH[0], [
   L(N, "The record can stand some other night. Bonnie is out of bed and past Chloe's door before she can talk herself out of it.", "Finally. FINALLY. Left at the banister.")],
  next="stairs"),
 scene("stairs", "The Stairs", CH[0], [
   L(N, "Fourteen stairs. The fourth and the seventh creak; she mapped them years ago, coming home late."),
   L(N, "Every step down is a small negotiation.", "Faster. No. Slower. No. FASTER.")],
  choices=[
   C("One stair at a time, weight on the banister, slow as syrup.", [M(5), S("control", -9)], "bathroom_door"),
   C("Skip the fourth and the seventh. Muscle memory.", [M(1)], "bathroom_door", minigame=G("tremor_lock", 2, "Steady. Step on my count.", win=[S("control", 4)], lose=[S("suspicion", 30)])),
   C("Sit down and go step by step on my hands. Undignified. Silent.", [M(6), S("halo", -15), S("control", -4)], "bathroom_door")]),
 scene("house_stirs", "The House Stirs", CH[0], [
   L(N, "Somewhere above, bedsprings shift. A floorboard answers the one she just stepped on.", "They heard that. Everyone heard that.")],
  choices=[{"set": "noise_response", "texts": {
      "freeze": "FREEZE. Become furniture. Wait for the silence to heal.",
      "push_on": "Push on. So close. Fortune favors the desperate."}, "next": "return"}]),
 scene("bathroom_door", "The Downstairs Bathroom", CH[0], [
   L(N, "The door closes with a click she feels in her teeth. The lock turns. Nobody is coming."),
   L(N, "The pipes in this house carry sound like a telephone.", "I do not care about the pipes. I have never cared less about anything.")],
  choices=[
   C("Now. Speed over silence. Not one more breath.", [{"void": True}, S("suspicion", 25), SET("control", 100), M(2)], "flush"),
   C("Ease down and let go as slowly, as silently, as humanly possible.", [M(1)], "flush",
     minigame=G("breathe", 2, "Slowly. Breathe. Slow-ly.", win=[{"void": True}, SET("control", 100), S("halo", 5), M(4)], lose=[{"void": True}, SET("control", 100), S("suspicion", 20), M(2)]))]),
 scene("flush", "The Flush", CH[0], [
   L(N, "Relief. Complete, ridiculous, hard-earned relief. Bonnie leans on the sink and grins at nobody.", "Thank you. I take back most of what I said."),
   L(N, "One problem left: the cistern in this house fills like a jet engine.")],
  choices=[
   C("Don't flush. Lid down, leave silently, flush 'casually' once everyone is up.", [S("halo", -20), M(2)], "clock_reset"),
   C("Flush and sprint. Beat the pipes back up the stairs.", [S("suspicion", 25)], "clock_reset",
     minigame=G("mash", 2, "Run! Run run run!", win=[S("suspicion", -25), M(1)], lose=[S("suspicion", 30), M(1)]))]),
 scene("clock_reset", "4:31 AM — The Clock Is Reset", CH[0], [
   L(N, "Back under the blanket, nobody the wiser. The clock is reset. The real journey starts at eight, and it is twenty hours long.", "Enjoy it. You will not hear from me for at least an hour.")],
  next="breakfast_suit"),

 # ---------------- Chapter 2: breakfast and the suit ----------------
 scene("breakfast_suit", "8:00 AM — Breakfast & the Suit", CH[1], [
   L(N, "By eight the house is loud with a family seeing someone off. Chloe, full of espresso, is fastening the back of Bonnie's travel jumpsuit: one long row of tiny, stubborn buttons."),
   L("chloe", "Hold STILL! You'll look amazing. Like a superhero.", "Superheroes can't get out of these either, you know.")],
  enter=[F("day_started"), {"clock": "08:00"}, SET("suspicion", 0)],
  choices=[
   C("\"Chloe, gently! Go easy.\"", [S("halo", -5), S("suspicion", 5)], "breakfast_drink"),
   C("Endure it. Smile. Say nothing.", [S("control", -6), S("halo", 5)], "breakfast_drink")]),
 scene("breakfast_drink", "8:10 AM — Departure Breakfast", CH[1], [
   L(N, "Downstairs Mom has laid out everything the kitchen owns."),
   L("mom", "Drink up, sweetheart, you have such a long flight. Hydration is everything!", "She means well. She always means well. That is the problem.")],
  choices=[
   C("The small juice. Modest, quick, defensible.", [D(6), M(10)], "dad_offer"),
   C("The green tea. Mom's pride. Warm, generous, and it runs straight through.", [D(10), S("halo", 5), M(10)], "dad_offer"),
   C("The big smoothie. Heavy, slow, an anchor in the stomach.", [D(12), M(15)], "dad_offer"),
   C("All of it. Every glass. Make Mom glow on departure day.", [D(22), S("halo", 15), M(20)], "dad_offer")]),
 scene("dad_offer", "8:30 AM — Wheels Up", CH[1], [
   L("dad", "Wheels up in ten! Everyone use the bathroom, it's a long drive.", "He said EVERYONE. That includes us. That is practically an order.")],
  choices=[OFFER("\"I'm fine!\" Bright, instant, fatal.", "Hover on the edge of yes... then wave them on. Almost. ALMOST.", "Make myself useful instead: carry the bags, check the passport, busy hands.", "car_route")]),
 scene("car_route", "8:45 AM — The Drive", CH[1], [
   L("dad", "Right: interstate or the bypass? One's longer, one's bumpier, and I can never remember which is worse at this hour.", "Whichever has fewer bumps. Please. I am begging you.")],
  choices=[
   C("\"The interstate, Dad.\"", [M(50), S("control", -3)], "checkin"),
   C("\"Take the bypass.\"", [M(35), S("control", -7)], "checkin"),
   C("\"You choose!\"", [M(45), S("halo", 5), S("control", -5)], "checkin")]),

 # ---------------- Chapter 3: check-in and security ----------------
 scene("checkin", "10:00 AM — Check-in", CH[2], [
   L("mom", "That coffee went right through me! Bonnie, come on, last chance before the queue!", "LAST CHANCE. She said last chance. Did you hear the words?")],
  enter=[{"clock": "10:00"}],
  choices=[OFFER("\"I'm fine, go ahead!\" and a little wave.", "Take one step after her... and stop to check the departure board instead.", "Offer to watch everyone's bags. Somebody has to.", "queue")]),
 scene("queue", "10:20 AM — The Security Queue", CH[2], [
   L(N, "The queue snakes through six lanes of tape. Forty minutes, the sign says. The sign is an optimist.", "Forty minutes. Standing. On tile.")],
  choices=[
   C("Stand perfectly still, like a mannequin of a polite young woman.", [M(40)], "scanner", minigame=G("breathe", 2, "Perfect stillness. Breathe.", win=[S("control", 6)], lose=[S("control", -6), S("suspicion", 15)])),
   C("The subtle shuffle-clamp. Shuffle, clamp. Shuffle, clamp.", [M(40)], "scanner", minigame=G("tremor_lock", 2, "Shuffle. Clamp. On the beat.", win=[S("control", 9)], lose=[S("control", -8), S("suspicion", 10)])),
   C("Lean a hip against the luggage cart. It looks casual. It is load-bearing.", [M(40), S("control", -4)], "scanner")]),
 scene("scanner", "11:00 AM — The Scanner", CH[2], [
   L("tsa", "Step through. Arms up.", "Arms UP? Does he know what he is asking?")],
  choices=[
   C("Smile at the officer. Comply crisply. Be forgettable.", [S("control", -6), S("halo", 5)], "confiscated"),
   C("Move a touch too fast through the scanner. Get it OVER with.", [S("suspicion", 15), S("control", 3)], "confiscated"),
   C("Ask for the seated pat-down instead. Sitting is... strategic.", [S("halo", -10), M(10), S("control", 5)], "confiscated")]),
 scene("confiscated", "11:10 AM — No Liquids", CH[2], [
   L(N, "In her bag: one oversized iced tea, bought ten minutes ago, eight dollars, untouched."),
   L("tsa", "No liquids past this point, miss. Drink it or bin it. Your call.", "Bin it. BIN IT. It was only eight dollars.")],
  choices=[
   C("Chug it. All of it. Right here at the barrier, like a legend.", [D(14), S("halo", 10), M(3)], "seat_34a"),
   C("Tip it into the bin, and feel the waste of it stain the halo.", [S("halo", -15)], "seat_34a")]),

 # ---------------- Chapter 4: fourteen hours in 34A ----------------
 scene("seat_34a", "1:00 PM — Fourteen Hours in 34A", CH[3], [
   L(N, "Seat 34A. A window, a tray table, and between Bonnie and the aisle a large businessman who is asleep before the doors close."),
   L("businessman", "Long flight, eh.", "Fourteen hours. Behind a wall. A wall that snores.", mood="already half asleep")],
  enter=[{"clock": "13:00"}, M(20)],
  choices=[
   C("Perfect. A wall of businessman means nobody can see me squirm.", [S("control", 4)], "drink_service"),
   C("Do the math again. Properly this time. Know exactly where I stand.", [S("control", -3), F("did_math")], "drink_service"),
   C("Sleep NOW while it's quiet. Sleep is time travel for the desperate.", [M(120), S("control", 6)], "drink_service")]),
 scene("drink_service", "3:00 PM — Drink Service", CH[3], [
   L(N, "The numbers were not comforting.", when=[{"flag": "did_math"}]),
   L("attendant", "And to drink? We have tea, coffee, juice... or I can do the large water.", "Say \"nothing, thank you.\" It is three words. You know all three.")],
  enter=[M(60)],
  triggers=[{"when": [{"stat": "halo", "gte": 95}], "bladder": "Your hand is ALREADY reaching for it. Stop being so nice!",
             "minigame": G("mash", 2, "Put. The cup. Down.", win=[S("control", 5), S("halo", -5)], lose=[D(10), S("halo", 5)])}],
  choices=[
   C("\"Tea, please.\" Warm, modest... and a deceptively large pot.", [D(10), S("halo", 3)], "turbulence"),
   C("\"Coffee.\" Small cup. Sharp price: it goes straight through.", [D(7), {"fullness": 3}], "turbulence"),
   C("\"Juice, thank you.\" Sweet, heavy, and somehow 400 ml.", [D(12)], "turbulence"),
   C("\"Just the water.\" The LARGE water. The only size they carry.", [D(14), S("halo", 5)], "turbulence")]),
 scene("turbulence", "6:00 PM — Turbulence", CH[3], [
   L(N, "Hour five. The seatbelt sign chimes and the cabin drops a foot. The belt sits exactly where she wishes it did not.", "WHO APPROVED THIS? Who is flying this thing?")],
  enter=[M(180)],
  choices=[
   C("Grip both armrests and ride it like a rodeo of pure regret.", None, "aisle_opens", minigame=G("mash", 2, "Brace! Brace! Brace!", win=[S("control", 6)], lose=[S("control", -14)])),
   C("Press the blanket down over my lap. Pressure against pressure.", [S("control", -5)], "aisle_opens"),
   C("Hum the safety video jingle. Panic, but organized.", [S("suspicion", 10), S("control", 3)], "aisle_opens")]),
 scene("aisle_opens", "9:00 PM — The Aisle Opens", CH[3], [
   L(N, "The businessman wakes, stretches, and shuffles off toward the lavatory. For the first time in eight hours, the aisle is open.", "The wall is GONE. Go. GO. This is not a drill.")],
  enter=[M(180)],
  choices=[OFFER("Stay put. \"I'm fine!\" she tells nobody at all.", "Unbuckle... half stand... and sit back down as he returns.", "Tidy the seat pocket instead. Fold the blanket. Very busy.", "descent")]),
 scene("descent", "2:20 AM — The Descent", CH[3], [
   L(N, "Forty minutes of descent. The pilot points out landmarks. The plane leans, slowly, onto every one of them.", "Every. Single. Landmark.")],
  enter=[M(320)],
  choices=[
   C("Nod at every landmark. Smile. Be a lovely window companion.", [S("halo", 5), S("control", -8)], "immigration"),
   C("Fake sleep. Rude-adjacent, but faces can't leak secrets while unconscious.", [S("halo", -8), S("control", -3)], "immigration"),
   C("Count the seconds between waves. Knowledge is power?", None, "immigration", minigame=G("tremor_lock", 3, "Ride the descent. On the beat.", win=[S("control", 8)], lose=[S("control", -12)]))]),

 # ---------------- Chapter 5: immigration ----------------
 scene("immigration", "8:30 PM (local) — Immigration", CH[4], [
   L(N, "Landed. A new clock on the wall says 8:30 in the evening. Her body has stopped believing in clocks."),
   L("officer", "Purpose of visit?", "Tell him the truth. \"To find a bathroom.\"")],
  enter=[{"clock": "20:30"}],
  choices=[
   C("\"Exchange program!\" Bright. Crisp. Rehearsed in the mirror weeks ago.", [S("halo", 5)], "arrivals_text"),
   C("Answer in the fewest possible syllables. Words shake things loose.", [S("suspicion", 8), S("control", 3)], "arrivals_text"),
   C("Compliment his stamp technique. Charm is a pressure valve.", [S("halo", 5), M(3), S("control", -3)], "arrivals_text")]),
 scene("arrivals_text", "8:45 PM — The Sign and the Text", CH[4], [
   L(N, "Past the desk, a restroom sign glows like a lighthouse. Her phone buzzes: \"We're outside, love!! 🎉\"", "Lighthouse. LIGHTHOUSE. Steer toward the lighthouse.")],
  choices=[OFFER("Type \"Coming!!\" and walk straight past the sign.", "Drift toward the sign... and let the crowd carry her on.", "Find a trolley first. Then the right carousel. Then it is too late.", "carousel")]),
 scene("carousel", "8:55 PM — Baggage Claim", CH[4], [
   L(N, "Her suitcase comes round the carousel: fifty pounds, packed by someone who feared for her survival abroad.", "Do NOT lift that. Lifting is pushing. Pushing is my department.")],
  choices=[
   C("One clean deadlift, exhale like a powerlifter, DONE.", None, "higgins_hug", minigame=G("mash", 2, "Lift! Clench! Lift!", win=[S("control", 4)], lose=[S("control", -14)])),
   C("Let it go around again and catch it at a better angle next lap.", [M(8), S("control", -5)], "higgins_hug"),
   C("Ask the kind man beside me for help, with my best exhausted smile.", [S("halo", -5), S("suspicion", 5)], "higgins_hug")]),

 # ---------------- Chapter 6: the Higgins family ----------------
 scene("higgins_hug", "9:30 PM — The Higgins Family", CH[5], [
   L(N, "Arrivals. A sprinting figure and a slower, wider one behind her."),
   L("irina", "BONNIE! BONNIE!"),
   L(N, "Mrs. Higgins arrives second and hugs first: a fierce, two-armed squeeze, right around the middle.", "ABORT HUG. ABORT HUG."),
   L("bonnie", "Hnnng... HI!", mood="half an octave too high")],
  enter=[{"clock": "21:30"}],
  choices=[
   C("Hug back. Breathe out. Smile. Be delighted.", None, "airport_offer", minigame=G("breathe", 2, "Perfect stillness. Do NOT flinch.", win=[S("halo", 5), S("control", 3)], lose=[S("control", -14), S("suspicion", 10)])),
   C("Get a hand out first and turn it into a handshake. Then a wave.", [S("halo", -10), S("control", 2)], "airport_offer")]),
 scene("airport_offer", "9:35 PM — Before the Drive", CH[5], [
   L("irina", "How do you even go to the bathroom in that suit?"),
   L("bonnie", "I didn't.", "At LAST. Someone is asking the right questions.", mood="brightly"),
   L("mrs_higgins", "Want to go before we drive, love? It's forty minutes.")],
  choices=[OFFER("\"I'm perfectly fine!\" Voice up half an octave.", "\"Oh, maybe I... no. No, let's go, you've waited long enough.\"", "Insist on wheeling the suitcase to the car herself.", "host_car")]),
 scene("host_car", "9:45 PM — The Car", CH[5], [
   L("mrs_higgins", "Coastal road or the tunnel, love? One's ever so pretty, the other's quick... though with the roadworks lately, honestly, who knows.", "Quick. QUICK. Nobody has ever needed pretty less.")],
  choices=[
   C("\"The coastal road sounds lovely.\"", [M(45), S("halo", 5), S("control", -8)], "welcome_tea"),
   C("\"The tunnel, maybe? Quickest is best.\"", [M(30), S("control", -4)], "welcome_tea"),
   C("\"Surprise me!\"", [M(40), S("halo", 5), S("control", -6)], "welcome_tea")]),
 scene("welcome_tea", "10:30 PM — Welcome Tea", CH[5], [
   L("mrs_higgins", "Sit, sit! You must be PARCHED after that flight."),
   L("irina", "I'm bursting!", "SHE gets to say it. Out loud. Just like that."),
   L(N, "Irina thunders upstairs. A pot of tea the size of a lighthouse lands on the table."),
   L("mrs_higgins", "Milk? Sugar? Drink up, love.")],
  choices=[
   C("Down it: graceful, grateful, gone.", [D(12), S("halo", 10), M(10)], "first_night"),
   C("Sip it slowly: polite, and stalling for dear life.", [D(6), M(20), S("control", -5)], "first_night"),
   C("Nurse this one forever. Tiny sips, long stories, buy every possible second.", [D(3), M(35), S("control", -8), S("halo", -3)], "first_night"),
   C("\"I'm so sorry, the journey has absolutely wrecked me. Could I possibly just... go up to bed?\"", [S("halo", -10), S("suspicion", 8)], "first_night", when=[{"stat": "fullness", "gte": 85}])]),

 # ---------------- Chapter 7: the first night ----------------
 scene("first_night", "11:30 PM — The First Night", CH[6], [
   L(N, "The guest room is lovely. The catch arrives with the towels: the only working bathroom upstairs is the en-suite off Irina's room."),
   L("irina", "Just come through whenever! I sleep like the dead.", "Through HER ROOM. Past her BED. In the DARK.")],
  enter=[{"clock": "23:30"}],
  choices=[
   C("\"No problem at all!\" A sentence so false it should be arrested.", [S("halo", 5)], "midnight"),
   C("Stay up a while getting to know her. Friendship is politeness too.", [F("friends"), M(45), S("control", -8), S("suspicion", -10)], "midnight"),
   C("Scout the hallway quietly first. Know the terrain. Count the creaks.", [F("scouted"), M(10)], "midnight")]),
 scene("midnight", "12:30 AM — Music Through the Wall", CH[6], [
   L(N, "Irina does not sleep like the dead. Irina plays music and talks through the wall, cheerfully, at length.", "She is AWAKE. The door is right there and she is AWAKE.")],
  enter=[{"clock": "00:30"}, M(30)],
  choices=[
   C("Wait her out. The record grows with every minute.", [M(90), S("control", -10), S("halo", 5)], "two_am"),
   C("Pace the room in tiny circles. Movement is management.", [M(60)], "two_am", minigame=G("tremor_lock", 2, "Small steps. On the beat.", win=[S("control", 7)], lose=[S("control", -8)])),
   C("Lie perfectly still and go somewhere else in my head. A beach. A DRY beach.", [M(60)], "two_am", minigame=G("breathe", 2, "Dry beach. Dry. Beach.", win=[S("control", 9)], lose=[S("control", -10)]))]),
 scene("two_am", "2:00 AM — The Final Threshold", CH[6], [
   L(N, "Two in the morning. The music has stopped. Twenty-two hours. She is a marvel of human engineering, and the dam is creaking."),
   L(N, "Three ways through this. None of them dignified.", "Pick one. ANY one. I vote for all three at once.")],
  enter=[{"clock": "02:00"}],
  choices=[
   C("Go. Now. Through her room, silent as a guilty thought.", None, "sneak"),
   C("Hold until her morning run. Four more hours. The PERFECT record.", [S("halo", 5)], "dawn_wait"),
   C("The window. The garden. The dark. ...I am not a garden person. Am I?", None, "garden_ledge")]),
 scene("sneak", "The Dark Room", CH[6], [
   L(N, "Irina's door opens without a sound. The room is all shapes: a bed, a chair, a strip of light under the far door."),
   L(N, "She counted the creaks earlier. That helps. A little.", when=[{"flag": "scouted"}]),
   L(N, "Somewhere in the dark, breathing. Slow. Probably asleep.", "Probably. PROBABLY is good enough. Walk.")],
  choices=[
   C("Step. Pause. Step. Read the breathing like sonar.", None, "sneak_mid", minigame=G("tremor_lock", 3, "Step. Pause. Step.", win=[S("control", 4)], lose=[S("suspicion", 30), S("control", -8)])),
   C("...no. Back out. The dawn plan.", [S("control", -5)], "dawn_wait")]),
 scene("sneak_mid", "Three Steps Left", CH[6], [
   L(N, "Halfway. The strip of light is three steps away. The bed creaks behind her.", "THREE STEPS. I can see the door. I can SEE it.")],
  choices=[
   C("The last three steps. Slow as continental drift.", None, None, minigame=G("breathe", 3, "Slow. Slower. Slow-est.", win=[{"void": True}], win_next="ending_sneak", lose=[{"void": True}], lose_next="ending_woke_irina")),
   C("Just GO. Two quick steps and in.", None, None, minigame=G("mash", 3, "GO GO GO!", win=[{"void": True}], win_next="ending_sneak", lose=[{"void": True}], lose_next="ending_woke_irina"))]),
 scene("dawn_wait", "The Deep Night Hours", CH[6], [
   L(N, "Bonnie sits on the edge of the bed, breathes slowly, and waits. The waves come on the hour, each one taller.", "This is not a plan. This is a hostage situation.")],
  enter=[M(120)],
  choices=[
   C("Face it. Fight the wave through this whole hour.", [M(120)], "dawn", minigame=G("mash", 3, "The wave! Hold! HOLD!", win=[S("control", 10)], lose=[S("control", -35)])),
   C("This is insane. Go NOW, through her room, before I shatter.", [S("halo", -5)], "sneak")]),
 scene("dawn", "6:58 AM — Dawn", CH[6], [
   L(N, "At exactly 6:58 the front door downstairs clicks shut. Footsteps crunch on gravel and fade.", "The house is EMPTY. The house is empty!", when=[{"flag": "friends", "is": False}]),
   L(N, "6:58, and no footsteps on the gravel. Irina has skipped her run. She is downstairs cracking eggs for her new friend.", "She stayed in. For YOU. This is what being nice gets us.", when=[{"flag": "friends"}])],
  enter=[{"clock": "06:58"}],
  choices=[
   C("Walk to it. Slowly. Regally. This porcelain has been earned.", [{"void": True}], "ending_perfect", when=[{"flag": "friends", "is": False}]),
   C("Through her room NOW, while she's downstairs. Last chance.", [{"void": True}, S("halo", -5)], "ending_perfect", when=[{"flag": "friends"}]),
   C("Go down to breakfast. Endure. Wait for the house to empty.", None, None, when=[{"flag": "friends"}],
     minigame=G("breathe", 4, "One. More. Hour.", win=[{"void": True}], win_next="ending_perfect", lose=[S("control", -100)], lose_next="ending_lost")),
   C("Ask. Just... ask. Out loud. Like a person.", [{"void": True}, S("halo", -20)], "ending_asked")]),
 scene("garden_ledge", "The Window", CH[6], [
   L(N, "The sash lifts without a sound. Below: a trellis, a hedge, a great deal of dark.", "I have no objections. None. I have NEVER been less picky.")],
  choices=[
   C("Down the trellis. Behind the hedge. May the rosebush forgive me.", [{"void": True}, S("halo", -40)], "ending_garden"),
   C("...I am not a garden person. The bedroom route. Final answer.", None, "sneak")]),

 # ---------------- interruptions: somebody notices ----------------
 scene("noticed_mild", "Somebody Notices", None, [
   L(N, "A sideways look. \"You keep shifting about. Everything alright?\"", "Tell them. They ASKED. It would be rude not to answer honestly.")],
  choices=[{"set": "noticed", "texts": {
      "admit": "Admit to 'a little travel fatigue.' Vague. Deniable.",
      "double_down": "\"Me? I'm WONDERFUL. Actually, is there a drink? I'd LOVE one.\""}, "next": "return"}]),
 scene("noticed_strong", "Somebody Really Notices", None, [
   L(N, "\"You've gone pale, and you're trembling. What is going on?\"", "This is it. Say the word. It is one word.")],
  choices=[{"set": "noticed", "texts": {
      "admit": "Admit it, barely a whisper: \"...I could use a stop. Soon. Please.\"",
      "double_down": "\"Just the air conditioning!\" and a laugh that fools nobody."}, "next": "return"}]),
]

story = {
 "schemaVersion": 1,
 "meta": {"id": "bonnies_journey", "title": "Bonnie's Long Journey", "author": "LiamBox", "rating": "18+",
   "tags": ["desperation", "travel", "family home", "politeness"],
   "description": "Departure day. Bonnie, 23, has one stubborn rule for travel: flawless manners, total composure, and nobody inconvenienced. Twenty-two hours, seven chapters, and a great many drinks she is too polite to refuse. Placeholder wording."},
 "characters": [
   {"id": "bonnie", "name": "Bonnie", "age": 23, "notes": "Twenty-three, leaving for a university exchange semester. Lives with her parents. A committed people-pleaser with a stubborn streak."},
   {"id": "chloe", "name": "Chloe", "age": 26, "notes": "Bonnie's older sister. Light sleeper."},
   {"id": "mom", "name": "Mom", "age": 52}, {"id": "dad", "name": "Dad", "age": 55},
   {"id": "tsa", "name": "Security officer", "age": 41}, {"id": "businessman", "name": "Businessman", "age": 47},
   {"id": "attendant", "name": "Flight attendant", "age": 34}, {"id": "officer", "name": "Immigration officer", "age": 50},
   {"id": "irina", "name": "Irina", "age": 23, "notes": "The Higgins' daughter, a student Bonnie's age. Loud, warm, awake."},
   {"id": "mrs_higgins", "name": "Mrs. Higgins", "age": 51, "notes": "Host. Hugs first, asks later."},
   {"id": "bladder", "name": "Bladder", "kind": "bladder"}],
 "stats": [
   {"id": "control", "label": "Control", "start": 48, "thresholds": [{"atOrBelow": 0, "goto": "ending_lost"}]},
   {"id": "halo", "label": "Halo", "icon": "😇", "start": 100},
   {"id": "suspicion", "label": "Suspicion", "icon": "👀", "start": 0, "thresholds": [{"atOrAbove": 100, "goto": "ending_found_out"}]}],
 "bladder": {"startFullness": 86, "fillPerMinute": 0.03, "absorbPerMinute": 0.5, "capacityMl": 2400},
 "clock": {"start": "04:10"},
 "modes": [{"flag": "hard_mode", "label": "Hard mode", "minigameDifficulty": 1, "fillMultiplier": 1.5}],
 "choiceSets": [
   {"id": "noise_response", "options": [
     {"key": "freeze", "effects": [M(3), S("suspicion", -20), S("control", -8)]},
     {"key": "push_on", "effects": [S("suspicion", 15), S("control", 4)]}]},
   {"id": "bathroom_offer", "options": [
     {"key": "refuse", "effects": [S("halo", 5), S("control", -7)]},
     {"key": "hover", "effects": [S("control", -10), S("suspicion", 10)]},
     {"key": "busy", "effects": [S("halo", 3), S("control", -5), M(5)]}]},
   {"id": "noticed", "options": [
     {"key": "admit", "effects": [S("suspicion", -30), S("halo", -10), S("control", 5)]},
     {"key": "double_down", "effects": [S("suspicion", -15), D(8), S("halo", 5)]}]}],
 "triggers": [
   {"when": [{"stat": "suspicion", "gte": 50}] + NIGHT1, "scene": "house_stirs"},
   {"when": [{"stat": "suspicion", "gte": 40}] + DAY, "scene": "noticed_mild"},
   {"when": [{"stat": "suspicion", "gte": 70}] + DAY, "scene": "noticed_strong"},
   {"when": [{"stat": "fullness", "gte": 60}] + DAY, "bladder": "Hello again. Remember me? I have news.",
    "minigame": G("tremor_lock", 2, "The first real wave. Steady...", win=[S("control", 4)], lose=[S("control", -14)])},
   {"when": [{"stat": "fullness", "gte": 80}] + DAY, "bladder": "This is no longer a request.",
    "minigame": G("breathe", 2, "Breathe through it. In. Out.", win=[S("control", 5)], lose=[S("control", -18)])},
   {"when": [{"stat": "fullness", "gte": 93}], "bladder": "Just let go. Right here. Who would ever know?",
    "minigame": G("swipe_away", 2, None, win=[S("control", 4)], lose=[S("control", -20)])}],
 "start": "bed",
 "scenes": scenes,
 "endings": [
  {"id": "ending_perfect", "kind": "good", "title": "The Perfect Record", "text": "She walks down the hallway on shaking legs, locks the door, leans on the vanity, and finally lets go. It is the most colossal, silent and hard-earned relief of her life. She washes her hands, looks at her tired, victorious reflection, and smiles. The perfect record stands."},
  {"id": "ending_sneak", "kind": "good", "title": "Silent as a Guilty Thought", "text": "The en-suite door closes behind her without a click. Irina never stirs. Twenty-two hours end in the dark, in someone else's bathroom, in absolute silence. Nobody will ever know. She almost wishes somebody could."},
  {"id": "ending_asked", "kind": "good", "title": "Like a Person", "text": "\"Could I use your bathroom?\" Six words. Nobody gasps. Somebody says \"of course, love, second door.\" It turns out that was allowed the entire time. The record is over, and Bonnie cannot remember why it mattered."},
  {"id": "ending_garden", "kind": "neutral", "title": "A Garden Person After All", "text": "Behind the hedge, under the stars, in a country she has known for six hours. The rosebush keeps her secret. The halo does not survive the trellis, but the record, technically, does."},
  {"id": "ending_woke_irina", "kind": "neutral", "title": "\"Oh! It's You\"", "text": "The lamp clicks on. Irina blinks at her from the pillow, entirely unbothered. \"Bathroom's through there. I TOLD you to just come through.\" Bonnie makes it, with a witness and without her dignity. Irina is asleep again before the door closes."},
  {"id": "ending_found_out", "kind": "bad", "title": "\"Just Go, Love\"", "text": "Somebody finally says it out loud, kindly and firmly, and steers her toward the nearest door. It is mortifying for about four seconds and then it is the best thing that has ever happened to her. The record ends early, by popular demand."},
  {"id": "ending_lost", "kind": "bad", "accident": True, "title": "Not Quite", "text": "Control gives out before the journey does. Nothing a change of clothes and a very long shower cannot fix, but the perfect record is over. She will tell this story at parties in about ten years."}],
 "scorecard": [
  {"label": "Control", "stat": "control"}, {"label": "Halo", "stat": "halo"}, {"label": "Suspicion", "stat": "suspicion"},
  {"label": "How full at the end", "stat": "fullness"}, {"label": "Hard mode", "flag": "hard_mode"}, {"label": "Made a friend", "flag": "friends"}]}

def clean(o):
    if isinstance(o, dict): return {k: clean(v) for k, v in o.items() if v is not None}
    if isinstance(o, list): return [clean(x) for x in o]
    return o
out = pathlib.Path(__file__).resolve().parents[1] / 'stories' / 'bonnies_journey.json'
out.write_text(json.dumps(clean(story), indent=2, ensure_ascii=False) + '\n')
print('wrote', out.name, len(scenes), 'scenes')
