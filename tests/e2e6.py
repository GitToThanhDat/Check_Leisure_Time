from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import *
import json, time
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width':390,'height':800}, has_touch=True, is_mobile=True)
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://localhost') else r.abort())
    pg = ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    start(pg); pg.wait_for_timeout(600)
    cells = pg.locator('.col').nth(1).locator('.cell'); cells.nth(24).evaluate('e=>e.scrollIntoView({block:"center"})'); pg.wait_for_timeout(300)
    a = cells.nth(24).bounding_box(); z = cells.nth(27).bounding_box()
    cdp = ctx.new_cdp_session(pg)
    x = a['x']+a['width']/2
    cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':a['y']+10}]})
    time.sleep(0.4)
    for i in range(1,9):
        y = a['y']+10 + (z['y']-a['y'])*i/8
        cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x,'y':y}]}); time.sleep(0.03)
    cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]}); time.sleep(0.4)
    d = json.loads(pg.evaluate("localStorage.getItem('rc_local_db_v1')")); room = list(d['rooms'].values())[0]
    print('long-press paint ->', json.dumps(list(room.get('sched',{}).values())[0] if room.get('sched') else None))
    # quick swipe (should scroll, not paint)
    pg.evaluate("document.querySelector('.wk-scroll').scrollTop=0")
    cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':400}]})
    for i in range(1,8): cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x,'y':400-i*25}]}); time.sleep(0.02)
    cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]}); time.sleep(0.3)
    print('scrollTop after swipe', pg.evaluate("document.querySelector('.wk-scroll').scrollTop"), 'modals', pg.locator('.modal').count())
    # tap -> editor
    pg.locator('.col').nth(0).locator('.cell').nth(40).tap(); pg.wait_for_timeout(500); print('tap opens editor:', pg.locator('.modal').count())
    print('ERR', errs); b.close()
