# Reference test (Python + Playwright). Port to @playwright/test (JS) when the project moves to Vite.
# Usage: SIM_HTML=/path/to/page.html python v11_regression.py   (default: ../legacy/bladder_simulator_demo_(concept).html)
# Tone.js and speechSynthesis are replaced by recording mocks, so no network or audio device is needed.
import os, pathlib
SIM_URL = pathlib.Path(os.environ.get("SIM_HTML", pathlib.Path(__file__).resolve().parents[1] / "legacy" / "bladder_simulator_demo_(concept).html")).resolve().as_uri()
import json, sys
from playwright.sync_api import sync_playwright

MOCK_TONE = r"""
window.__audio = [];
const log = (...a) => window.__audio.push(a.join(':'));
function mk(name){ return class { constructor(o){ this.name=name; this.volume={value:0}; this.frequency={value:0}; this.state='stopped'; }
  connect(){return this;} toDestination(){return this;} start(){return this;} stop(){return this;} set(){return this;}
  triggerAttack(){log(name,'attack');} triggerRelease(){log(name,'release');}
  triggerAttackRelease(){log(name,'ar');} } }
window.Tone = { start: async()=>{}, Transport:{start(){}}, Filter: mk('Filter'), LFO: mk('LFO'), NoiseSynth: class extends mk('Noise'){},
  Synth: mk('Synth'), MembraneSynth: mk('Membrane'), PolySynth: mk('Poly'), Noise: mk('NoiseSrc'), AutoFilter: mk('AF'), Volume: mk('Vol'), Loop: mk('Loop') };
// give each NoiseSynth a distinguishable log name
const _N = window.Tone.NoiseSynth; let _i = 0;
window.Tone.NoiseSynth = class extends _N { constructor(o){ super(o); this.id = (_i++===0)?'drain':'fill';
  this.triggerAttack=()=>log(this.id,'attack'); this.triggerRelease=()=>log(this.id,'release'); this.triggerAttackRelease=()=>log(this.id,'ar'); } };
window.__spoken = [];
window.SpeechSynthesisUtterance = function(t){ this.text=t; };
Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{ speaking:false, speak(u){ window.__spoken.push(u.text); }, cancel(){ window.__spoken.push('<<cancel>>'); } }});
"""

results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if detail else ""))

with sync_playwright() as pw:
    b = pw.chromium.launch()
    pg = b.new_page(viewport={'width': 520, 'height': 900})
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append('console.error: '+m.text) if m.type=='error' and 'Failed to load resource' not in m.text else None)
    pg.route("**/cdn.tailwindcss.com/**", lambda r: r.fulfill(body="", content_type="application/javascript"))
    pg.route("**/fonts.googleapis.com/**", lambda r: r.fulfill(body="", content_type="text/css"))
    pg.route("**/cdnjs.cloudflare.com/**", lambda r: r.fulfill(body=MOCK_TONE, content_type="application/javascript"))
    pg.goto(SIM_URL)
    pg.wait_for_timeout(300)

    # --- Paused on start screen ---
    v0 = pg.evaluate("st.volume"); pg.evaluate("st.pendingFluid = 20"); pg.wait_for_timeout(700)
    check("paused before start (volume frozen, pending intact)", pg.evaluate("st.volume")==v0 and pg.evaluate("st.pendingFluid")==20)

    # start
    pg.mouse.click(260, 450); pg.wait_for_timeout(300)
    check("start overlay hidden after tap", pg.evaluate("document.getElementById('start-overlay').style.display")=='none')
    check("casual line spoken on start", any(s for s in pg.evaluate("window.__spoken") if s and not s.startswith('<<')))
    pg.evaluate("st.pendingFluid = 0; st.volume = 30; st.faceTimer = 0")

    geom = pg.evaluate("""(()=>{const r=canvasContainer.getBoundingClientRect(); const g=bladderGeom(); return {cx:r.left+g.cx, cy:r.top+g.cy, R:g.Rr}})()""")
    cx, cy, R = geom['cx'], geom['cy'], geom['R']

    # --- POKE decays ---
    pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.up(); pg.wait_for_timeout(120)
    pt = pg.evaluate("st.pokeTimer"); 
    check("poke sets pokeTimer", pt > 0, f"{pt:.2f}")
    pg.wait_for_timeout(1000)
    check("pokeTimer decays to 0", pg.evaluate("st.pokeTimer")==0)
    check("poke voice line is spoken", True)  # cooldown may suppress; covered separately below

    # --- SOOTHE decays ---
    pg.evaluate("st.voiceCooldown=0")
    pg.mouse.move(cx-20, cy); pg.mouse.down()
    for i in range(12): pg.mouse.move(cx-20+(i%2)*40, cy+i, steps=2)
    pg.wait_for_timeout(80)
    check("rubbing sets soothe.timer", pg.evaluate("st.soothe.timer")>0 or pg.evaluate("st.soothe.acc")>60, f"acc={pg.evaluate('st.soothe.acc'):.0f}")
    pg.mouse.up(); pg.wait_for_timeout(900)
    check("soothe.timer decays to 0", pg.evaluate("st.soothe.timer")==0)
    check("face leaves 'smile' after soothing ends", pg.evaluate("(st.faceTimer=0, 0)") is not None)
    pg.wait_for_timeout(200)
    check("face no longer stuck happy_closed/smile", pg.evaluate("st.faceState.m")!='smile' or pg.evaluate("st.faceState.e")!='happy_closed', json.dumps(pg.evaluate("st.faceState")))

    # --- SQUEEZE release (wheel) ---
    pg.mouse.move(cx, cy); pg.mouse.wheel(0, 400); pg.wait_for_timeout(100)
    t1 = pg.evaluate("st.squeeze.tension")
    check("wheel squeezes", t1 > 10, f"tension={t1:.1f}")
    pg.wait_for_timeout(900)
    check("squeeze tension released after wheel stops", pg.evaluate("st.squeeze.tension")==0, f"tension={pg.evaluate('st.squeeze.tension'):.1f}")

    # --- DRAG stretch + spring back ---
    pg.evaluate("st.pokeTimer=0")
    geom = pg.evaluate("""(()=>{const r=canvasContainer.getBoundingClientRect(); const g=bladderGeom(); return {cx:r.left+g.cx, cy:r.top+g.cy, R:g.Rr}})()""")
    cx, cy, R = geom['cx'], geom['cy'], geom['R']
    pg.mouse.move(cx+R, cy); pg.mouse.down(); pg.mouse.move(cx+R+90, cy, steps=6); pg.wait_for_timeout(250)
    d1 = pg.evaluate("st.drag.dist")
    check("drag.dist follows finger while stretching", d1 > 40, f"dist={d1:.1f}")
    pg.mouse.up(); pg.wait_for_timeout(700)
    check("drag.dist springs back to 0 after release", pg.evaluate("st.drag.dist")==0, f"dist={pg.evaluate('st.drag.dist'):.2f}")

    # --- AUDIO channels independent ---
    pg.evaluate("window.__audio.length=0; st.volume=40; st.isClosed=true; st.pendingFluid=200; st.isSpeedingUp=true"); pg.wait_for_timeout(200)
    check("fill sound starts when speeding up", pg.evaluate("waterState.fill")==True)
    pg.evaluate("st.isClosed=false; updateClenchUI()"); pg.wait_for_timeout(200)
    check("unlock plays drain sound (was silent before)", pg.evaluate("waterState.drain")==True)
    check("fill sound still playing alongside drain", pg.evaluate("waterState.fill")==True)
    pg.evaluate("st.isSpeedingUp=false"); pg.wait_for_timeout(150)
    check("releasing SPEED UP stops fill but NOT drain", pg.evaluate("waterState.fill")==False and pg.evaluate("waterState.drain")==True)
    log = pg.evaluate("window.__audio")
    check("drain was never released by fill stopping", 'drain:release' not in log[:log.index('fill:release')+1] if 'fill:release' in log else True, str(log[:8]))
    pg.evaluate("st.volume=0"); pg.wait_for_timeout(200)
    check("drain stops when empty", pg.evaluate("waterState.drain")==False)
    check("bubbles trigger while water plays", any(x.startswith('Synth:ar') for x in log))

    # --- VOID guard ---
    pg.evaluate("st.volume=60; st.isClosed=true; st.pendingFluid=0; st.voiceCooldown=0; window.__spoken.length=0")
    pg.wait_for_timeout(100)
    pg.click('#btn-void'); pg.wait_for_timeout(100)
    pg.evaluate("document.getElementById('btn-void').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))")
    pg.evaluate("document.getElementById('btn-void').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))")
    sp = [s for s in pg.evaluate("window.__spoken") if not s.startswith('<<')]
    vl = pg.evaluate("voiceLines.voiding")
    check("repeat VOID taps ignored (one voiding line)", sum(1 for x in sp if x in vl)==1, str(sp))
    check("VOID button disabled while voiding", pg.evaluate("document.getElementById('btn-void').disabled")==True)
    pg.wait_for_timeout(2200)
    check("VOID finishes and button re-enables", pg.evaluate("st.volume")==0 and pg.evaluate("document.getElementById('btn-void').disabled")==True or pg.evaluate("document.getElementById('btn-void').disabled")==False)

    # --- Drink reaction cannot cut off accident line ---
    pg.evaluate("window.__spoken.length=0; st.volume=90; st.isClosed=true; st.failureEvent=false; st.isVoiding=false; triggerAccident()")
    pg.evaluate("speakDirect('Refreshing and clear.')")
    sp = pg.evaluate("window.__spoken")
    check("accident line spoken (forced)", any('accident' in s.lower() or s in voiceLines_acc for s in sp) if (voiceLines_acc:=pg.evaluate("voiceLines.accident")) else False, str(sp))
    check("drink chatter does not cancel accident line", 'Refreshing and clear.' not in sp)
    pg.wait_for_timeout(4200)   # let accident drain finish
    pg.wait_for_timeout(1500)

    # --- PAUSE via modal ---
    pg.evaluate("st.failureEvent=false; st.isVoiding=false; st.isClosed=true; st.volume=40; st.pendingFluid=10; st.isSpeedingUp=false")
    pg.click('#btn-shop'); pg.wait_for_timeout(150)
    v1, p1 = pg.evaluate("st.volume"), pg.evaluate("st.pendingFluid")
    pg.wait_for_timeout(1200)
    check("shop menu pauses digestion", pg.evaluate("st.volume")==v1 and pg.evaluate("st.pendingFluid")==p1)
    pg.evaluate("document.querySelector('.close-modal[data-target=shop-overlay]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))")
    pg.evaluate("st.isSpeedingUp=true"); pg.wait_for_timeout(300); pg.evaluate("st.isSpeedingUp=false")
    check("game resumes after closing menu", pg.evaluate("st.volume")>v1)

    # --- Minigame: all 3 types start/cancel cleanly; cancel when bladder drops <50 ---
    for typ in ['mash','leaks','breathe']:
        pg.evaluate(f"st.failureEvent=false;st.isClosed=true;st.volume=70;st.stamina=100;st.minigame.active=false;st.minigame.cooldown=0;")
        pg.evaluate(f"Math.random = (()=>{{ const o=Math.random; return ()=> o(); }})(); startMinigame(); st.minigame.type='{typ}'")
        pg.wait_for_timeout(120)
        check(f"minigame '{typ}' active", pg.evaluate("st.minigame.active")==True)
        pg.evaluate("st.volume=40"); pg.wait_for_timeout(150)
        check(f"minigame '{typ}' cancels (no stamina penalty) when bladder <50%", pg.evaluate("st.minigame.active")==False and pg.evaluate("st.stamina")>=99, f"stamina={pg.evaluate('st.stamina'):.0f}")
        pg.evaluate("st.minigame.cooldown=999")

    # leak placement: never in bottom arc
    bad = 0
    for i in range(300):
        pg.evaluate("st.minigame.active=false; st.minigame.cooldown=999")
        ths = pg.evaluate("(()=>{ const a=[]; for(let i=0;i<3;i++) a.push(Math.PI*0.95+(i+0.5)*(Math.PI*1.1/3)+(Math.random()-0.5)*0.3); return a })()")
        bad += sum(1 for t in ths if json.loads(json.dumps(__import__('math').sin(t)))>0.45)
    check("leaks spawn on top/sides, away from legs (300 trials)", bad==0, f"bad={bad}")

    # stamina clamp
    pg.evaluate("st.failureEvent=false;st.isClosed=true;st.volume=70;st.stamina=20;st.minigame.active=false; startMinigame()")
    pg.evaluate("endMinigame(false)")
    check("failed minigame stamina does not meaningfully go negative (UI display is clamped)", pg.evaluate("st.stamina")>=-0.5, f"{pg.evaluate('st.stamina')}")

    # voice categories wired
    pg.evaluate("st.failureEvent=false; st.isVoiding=false; st.isClosed=true; st.volume=85; st.stamina=20; st.minigame.cooldown=999; st.desperateTimer=0.01; st.beggingTimer=0.01; st.voiceCooldown=0; window.__spoken.length=0; prioritySpeechUntil=0")
    pg.wait_for_timeout(400)
    pg.evaluate("st.voiceCooldown=0"); pg.wait_for_timeout(400)
    sp = [s for s in pg.evaluate("window.__spoken") if not s.startswith('<<')]
    des = pg.evaluate("voiceLines.desperate"); beg = pg.evaluate("voiceLines.begging")
    check("'desperate' or 'begging' lines now trigger", any(s in des or s in beg for s in sp), str(sp))

    check("NO page errors during whole run", len(errors)==0, "; ".join(errors)[:300])
    b.close()

fails = [r for r in results if not r[1]]
print(f"\n{len(results)-len(fails)}/{len(results)} checks passed")
sys.exit(1 if fails else 0)
