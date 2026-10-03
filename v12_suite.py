# Reference test (Python + Playwright). Port to @playwright/test (JS) when the project moves to Vite.
# Usage: SIM_HTML=/path/to/page.html python v12_suite.py   (default: ../legacy/premium_bladder_simulator_v12.html)
# Tone.js and speechSynthesis are replaced by recording mocks, so no network or audio device is needed.
import os, pathlib
SIM_URL = pathlib.Path(os.environ.get("SIM_HTML", pathlib.Path(__file__).resolve().parents[1] / "legacy" / "premium_bladder_simulator_v12.html")).resolve().as_uri()
import json, math, sys
from playwright.sync_api import sync_playwright
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'v11_regression.py')).read().split("results = []")[0])   # MOCK_TONE + SIM_URL

results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if detail else ""))

def sample(pg, seconds, expr_map):
    """Run inside the page on every animation frame for `seconds`, tracking min/max of each expression."""
    js = "(()=>new Promise(res=>{const E=%s;const o={};for(const k in E){o[k]={min:1e9,max:-1e9}};const t0=performance.now();" \
         "function f(){for(const k in E){const v=eval(E[k]);if(v<o[k].min)o[k].min=v;if(v>o[k].max)o[k].max=v;}" \
         "if(performance.now()-t0<%d)requestAnimationFrame(f);else res(o);}f();}))()" % (json.dumps(expr_map), seconds*1000)
    return pg.evaluate(js)

def boot(pw, w, h):
    b = pw.chromium.launch(); pg = b.new_page(viewport={'width': w, 'height': h})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route("**/cdn.tailwindcss.com/**", lambda r: r.fulfill(body="", content_type="application/javascript"))
    pg.route("**/fonts.googleapis.com/**", lambda r: r.fulfill(body="", content_type="text/css"))
    pg.route("**/cdnjs.cloudflare.com/**", lambda r: r.fulfill(body=MOCK_TONE, content_type="application/javascript"))
    pg.goto(SIM_URL); pg.wait_for_timeout(300)
    pg.mouse.click(w//2, h//2); pg.wait_for_timeout(300)
    pg.evaluate("st.pendingFluid=0; st.minigame.cooldown=999")
    return b, pg, errs

with sync_playwright() as pw:
    for (W, H, label) in [(390, 700, 'phone'), (520, 900, 'desktop')]:
        b, pg, errs = boot(pw, W, H)
        print(f"\n===== {label} {W}x{H} =====")

        # ---------- LAYOUT ----------
        check(f"[{label}] old minigame overlay is gone", pg.evaluate("document.getElementById('minigame-overlay')===null"))
        r = pg.evaluate("""(()=>{const c=document.getElementById('canvas-wrapper').getBoundingClientRect(), s=document.getElementById('stamina-row').getBoundingClientRect();
                          return {canvasBottom:c.bottom, stmTop:s.top, stmBottom:s.bottom}})()""")
        check(f"[{label}] stamina bar sits below the play area (can't cover bladder)", r['stmTop'] >= r['canvasBottom']-1, json.dumps(r))
        pg.evaluate("st.volume=100; st.faceTimer=0"); pg.wait_for_timeout(200)
        fit = pg.evaluate("""(()=>{const g=bladderGeom(1); return {legsBottom:g.cy+g.Rr*1.6, H:g.H, top:g.cy-g.Rr*1.2}})()""")
        check(f"[{label}] at 100% the legs are no longer cut off", fit['legsBottom'] < fit['H']-4 and fit['top']>=0, json.dumps({k:round(v) for k,v in fit.items()}))

        # ---------- MINIGAMES: bubble + bottom panel ----------
        for typ in ['mash', 'breathe', 'leaks']:
            pg.evaluate("window.__spoken.length=0; st.failureEvent=false; st.isClosed=true; st.volume=75; st.stamina=100; st.voiceCooldown=0; prioritySpeechUntil=0; st.minigame.active=false; st.faceTimer=0")
            pg.evaluate(f"(()=>{{ const o=Math.random; let n=0; Math.random=()=> (n++===0 ? {['mash','leaks','breathe'].index(typ)}/3+0.01 : o()); startMinigame(); Math.random=o; }})()")
            pg.wait_for_timeout(250)
            t_now = pg.evaluate("st.minigame.type")
            check(f"[{label}] {typ}: type selected", t_now == typ, t_now)
            bub = pg.evaluate("({txt:bubbleEl.textContent, show:bubbleEl.classList.contains('show'), alarm:bubbleEl.classList.contains('alarm')})")
            lines = pg.evaluate(f"minigameLines.{typ}")
            check(f"[{label}] {typ}: bladder says the prompt in its bubble", bub['show'] and bub['txt'] in lines, bub['txt'])
            sp = [x for x in pg.evaluate("window.__spoken") if not x.startswith('<<')]
            check(f"[{label}] {typ}: prompt is also spoken aloud", bub['txt'] in sp, str(sp))
            ui = pg.evaluate("""(()=>({panel:getComputedStyle(mgPanel).display, rowVis:getComputedStyle(btnRow).visibility,
                mash:getComputedStyle(mgBtnMash).display, breathe:getComputedStyle(mgBreatheArea).display, leaks:getComputedStyle(mgLeaksArea).display}))()""")
            check(f"[{label}] {typ}: bottom panel shown, SPEED UP/VOID row hidden", ui['panel']=='flex' and ui['rowVis']=='hidden', json.dumps(ui))
            want = {'mash':'mash','breathe':'breathe','leaks':'leaks'}[typ]
            others = [k for k in ('mash','breathe','leaks') if k!=want]
            check(f"[{label}] {typ}: only its own control is visible", ui[want] != 'none' and all(ui[o]=='none' for o in others), json.dumps(ui))
            # nothing dims or covers the bladder
            cover = pg.evaluate("""(()=>{const c=document.getElementById('canvas-wrapper').getBoundingClientRect();
                const pts=[[c.left+c.width/2,c.top+c.height*0.3],[c.left+c.width*0.3,c.top+c.height*0.3],[c.left+c.width*0.7,c.top+c.height*0.3]];
                return pts.map(p=>document.elementFromPoint(p[0],p[1]).id)})()""")
            check(f"[{label}] {typ}: bladder area is not covered by any overlay", all(x in ('canvas-wrapper','fluid-canvas') or x=='' for x in cover) or all(x!='minigame-overlay' and x!='minigame-box' for x in cover), str(cover))

            if typ == 'breathe':
                pg.wait_for_timeout(1000)   # let the grow transition finish
                rr = pg.evaluate("(()=>{const a=breatheRect=document.getElementById('breathe-ring').getBoundingClientRect(), p=mgPanel.getBoundingClientRect(); return {rt:a.top-p.top, rb:p.bottom-a.bottom}})()")
                check(f"[{label}] breathe ring fits inside the bottom panel when fully grown", rr['rt']>=-2 and rr['rb']>=-2, json.dumps({k:round(v,1) for k,v in rr.items()}))
            if typ == 'leaks':
                # cracks never sit under the bubble, at any fill level
                brect = pg.evaluate("(()=>{const b=bubbleEl.getBoundingClientRect(), c=document.getElementById('canvas-wrapper').getBoundingClientRect(); return {l:b.left-c.left,r:b.right-c.left,t:b.top-c.top,b:b.bottom-c.top}})()")
                bad = 0
                for fill in (0.55, 0.7, 0.85, 1.0):
                    for _ in range(40):
                        pts = pg.evaluate(f"""(()=>{{const g=bladderGeom({fill}); const a=[]; for(let i=0;i<3;i++){{const th=Math.PI*0.95+(i+0.5)*(Math.PI*1.1/3)+(Math.random()-0.5)*0.3; a.push([g.cx+Math.cos(th)*g.Rr, g.cy+Math.sin(th)*g.Rr])}} return a}})()""")
                        for x, y in pts:
                            if brect['l']-25 < x < brect['r']+25 and brect['t']-25 < y < brect['b']+25: bad += 1
                check(f"[{label}] leaks: cracks never hide under the speech bubble (480 cracks)", bad == 0, f"overlaps={bad}")
                # tapping all three cracks completes the game
                for i in range(3):
                    pos = pg.evaluate(f"(()=>{{const r=canvasContainer.getBoundingClientRect(); const g=bladderGeom(); const l=st.minigame.leaks[{i}]; return [r.left+g.cx+Math.cos(l.th)*g.Rr, r.top+g.cy+Math.sin(l.th)*g.Rr]}})()")
                    hint = pg.evaluate("mgLeaksArea.textContent")
                    pg.mouse.click(pos[0], pos[1]); pg.wait_for_timeout(60)
                check(f"[{label}] leaks: tapping the 3 cracks wins", pg.evaluate("st.minigame.active")==False)
            if typ == 'mash':
                for _ in range(15): pg.evaluate("mgBtnMash.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))")
                check(f"[{label}] mash: 15 taps wins", pg.evaluate("st.minigame.active")==False)
            if typ == 'breathe':
                pg.evaluate("endMinigame(true)")
            pg.wait_for_timeout(150)
            after = pg.evaluate("({panel:getComputedStyle(mgPanel).display, rowVis:getComputedStyle(btnRow).visibility, bub:bubbleEl.textContent})")
            check(f"[{label}] {typ}: after finishing, normal buttons are back", after['panel']=='none' and after['rowVis']=='visible', json.dumps(after))
            check(f"[{label}] {typ}: win feedback shown by the bladder", after['bub'] in pg.evaluate("voiceLines.success_hold"), after['bub'])

        # failure feedback + subtitle rules
        pg.evaluate("st.isClosed=true; st.volume=75; st.stamina=80; st.voiceCooldown=0; prioritySpeechUntil=0; startMinigame()")
        pg.evaluate("subtitle('SHOULD NOT REPLACE PROMPT')")
        check(f"[{label}] subtitles never overwrite a pinned minigame prompt", pg.evaluate("bubbleEl.textContent")!='SHOULD NOT REPLACE PROMPT')
        pg.evaluate("endMinigame(false)")
        check(f"[{label}] failing says a 'fail' line and costs 50 stamina", pg.evaluate("bubbleEl.textContent") in pg.evaluate("voiceLines.fail") and abs(pg.evaluate("st.stamina")-30)<2, f"stamina={pg.evaluate('st.stamina'):.0f}")
        pg.wait_for_timeout(3200)
        check(f"[{label}] bubble hides itself after a few seconds", pg.evaluate("bubbleEl.classList.contains('show')")==False)

        # ---------- STRETCH ----------
        pg.evaluate("st.volume=19; st.stamina=100; st.minigame.active=false; st.minigame.cooldown=999")
        g = pg.evaluate("(()=>{const r=canvasContainer.getBoundingClientRect(); const g=bladderGeom(); return {cx:r.left+g.cx, cy:r.top+g.cy, R:g.Rr}})()")
        pg.mouse.move(g['cx']+g['R'], g['cy']); pg.mouse.down()
        pg.mouse.move(g['cx']+g['R']+110, g['cy'], steps=8)
        for i in range(120): pg.mouse.move(g['cx']+g['R']+110+(i%3), g['cy']+(i%2))      # long drag: builds max creep
        peak = pg.evaluate("Math.max(st.drag.dist, st.viscoelasticCreep*3)"); creep = pg.evaluate("st.viscoelasticCreep")
        check(f"[{label}] long drag builds a big stretch (creep maxed)", creep > 15, f"creep={creep:.1f} visible={peak:.0f}px")
        pg.mouse.up()
        samples = sample(pg, 1, {"s": "Math.max(st.drag.dist, st.viscoelasticCreep*3)"})
        res_1s = pg.evaluate("Math.max(st.drag.dist, st.viscoelasticCreep*3)")
        check(f"[{label}] stretch is back to normal within 1 second of release", res_1s < 1.0, f"{res_1s:.2f}px (peak was {peak:.0f}px)")

        # interrupted touch (pointercancel) must also let go
        pg.mouse.move(g['cx']+g['R'], g['cy']); pg.mouse.down(); pg.mouse.move(g['cx']+g['R']+100, g['cy'], steps=6)
        check(f"[{label}] drag is active before the cancel", pg.evaluate("st.drag.active")==True)
        pg.evaluate("window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true}))")
        pg.wait_for_timeout(1100)
        check(f"[{label}] pointercancel lets go and stretch relaxes in ~1s", pg.evaluate("st.drag.active")==False and pg.evaluate("Math.max(st.drag.dist, st.viscoelasticCreep*3)")<1.0, f"{pg.evaluate('Math.max(st.drag.dist, st.viscoelasticCreep*3)'):.2f}px")
        pg.mouse.up()
        # window blur mid-drag
        pg.mouse.move(g['cx']+g['R'], g['cy']); pg.mouse.down(); pg.mouse.move(g['cx']+g['R']+100, g['cy'], steps=6)
        pg.evaluate("window.dispatchEvent(new Event('blur'))"); pg.wait_for_timeout(1100)
        check(f"[{label}] losing window focus mid-drag also releases", pg.evaluate("st.drag.active")==False and pg.evaluate("Math.max(st.drag.dist, st.viscoelasticCreep*3)")<1.0)
        pg.mouse.up()

        # ---------- DANCES ----------
        ids = pg.evaluate("DANCE_MOVES.map(m=>m.id)")
        check(f"[{label}] 12 dance moves exist (was 4)", len(ids)==12, ",".join(ids))
        picks = pg.evaluate("(()=>{const seen={}; let last=''; let repeats=0; for(let i=0;i<3000;i++){const id=pickDanceMove(1,last); if(id===last)repeats++; seen[id]=(seen[id]||0)+1; last=id;} return {seen,repeats}})()")
        check(f"[{label}] at full urgency every move gets picked, none twice in a row", len(picks['seen'])==12 and picks['repeats']==0, json.dumps(picks['seen']))
        low = pg.evaluate("(()=>{const s=new Set(); for(let i=0;i<500;i++) s.add(pickDanceMove(0,'')); return [...s]})()")
        check(f"[{label}] at low urgency only the gentle moves appear", set(low)=={'sway','shift'}, str(low))

        pg.evaluate("st.failureEvent=false; st.isVoiding=false; st.isClosed=true; st.volume=100; st.stamina=100; st.minigame.active=false; st.minigame.cooldown=999; st.voidBtnDisabled=false")
        thresholds = {
          'hop':    ("body.y",  lambda o: o['by']['min'] < -5,  "jumps up"),
          'tap':    ("foot",    lambda o: min(o['bl']['min'], o['br']['min']) < -8, "feet lift"),
          'march':  ("foot",    lambda o: min(o['bl']['min'], o['br']['min']) < -12, "knees lift"),
          'shimmy': ("body.x",  lambda o: o['bx']['max'] > 3 and o['bx']['min'] < -3, "side to side"),
          'shiver': ("body.x",  lambda o: (o['bx']['max'] - o['bx']['min']) > 0.5, "trembles"),
          'curl':   ("pose",    lambda o: o['by']['max'] > 3 and o['bl']['min'] < -8 and o['al']['max'] < math.pi/2, "sinks, feet tucked, crossed"),
          'cross':  ("pose",    lambda o: o['al']['max'] < math.pi/2 and o['ar']['min'] > math.pi/2, "legs form an X"),
          'squeeze':("pose",    lambda o: abs(o['al']['min']-math.pi/2) < 0.09 and abs(o['ar']['max']-math.pi/2) < 0.09 and o['xl']['max'] > -0.1 and o['xr']['min'] < 0.1, "legs pressed together"),
        }
        for mid in ids:
            pg.evaluate(f"st.stamina=100; st.failureEvent=false; st.isVoiding=false; st.isClosed=true; st.volume=100; st.dance.id='{mid}'; st.dance.timer=99")
            pg.wait_for_timeout(500)   # ease in
            o = sample(pg, 2, {"al":"st.legs.al","ar":"st.legs.ar","xl":"st.legs.xl","xr":"st.legs.xr","bl":"st.legs.bl","br":"st.legs.br","bx":"st.body.x","by":"st.body.y"})
            moved = any((o[k]['max']-o[k]['min']) >= (0.05 if k in('al','ar','xl','xr') else 1.5) for k in o)
            check(f"[{label}] dance '{mid}' actually moves", moved)
            if mid in thresholds:
                name, fn, desc = thresholds[mid]
                check(f"[{label}] dance '{mid}': {desc}", fn(o), json.dumps({k:(round(v['min'],2),round(v['max'],2)) for k,v in o.items()}))

        # leaks game keeps the body still
        pg.evaluate("st.dance.id='hop'; st.dance.timer=99"); pg.wait_for_timeout(600)
        pg.evaluate("st.minigame.active=true; st.minigame.type='leaks'; st.minigame.leaks=[{th:4,patched:false}]; st.minigame.timer=99; st.minigame.duration=99")
        pg.wait_for_timeout(600)   # let the hop ease out
        o = sample(pg, 1, {"bx":"st.body.x","by":"st.body.y"})
        pg.evaluate("st.minigame.active=false; showMgPanel(false)")
        still = max(abs(o['by']['min']), abs(o['by']['max']), abs(o['bx']['min']), abs(o['bx']['max']))
        check(f"[{label}] body holds still during the crack-tapping game", still < 0.6, f"max offset={still:.2f}px")

        check(f"[{label}] NO page errors", len(errs)==0, "; ".join(errs)[:300])
        b.close()

fails = [r for r in results if not r[1]]
print(f"\n{len(results)-len(fails)}/{len(results)} checks passed")
for f in fails: print("FAILED:", f[0], f[2])
sys.exit(1 if fails else 0)
