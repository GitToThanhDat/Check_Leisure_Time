from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import *
import json, sys
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width':1100,'height':800})
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://localhost') else r.abort())
    pg = ctx.new_page()
    errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console:'+m.text) if m.type=='error' and 'ERR_FAILED' not in m.text else None)
    start(pg)
    pg.screenshot(path='/tmp/s1_me_empty.png')
    # preset giờ ngủ
    pg.click('button.preset >> text=Giờ ngủ'); pg.wait_for_selector('.modal'); pg.click('.modal-foot .primary'); pg.wait_for_timeout(300)
    # drag paint trên cột 2 (ngày thứ 2) từ ô 40 -> 44 với brush free
    col = pg.locator('.col').nth(1)
    cells = col.locator('.cell')
    cells.nth(38).scroll_into_view_if_needed()
    b1 = cells.nth(38).bounding_box(); b2 = cells.nth(42).bounding_box()
    pg.mouse.move(b1['x']+10, b1['y']+10); pg.mouse.down(); pg.mouse.move(b2['x']+10, b2['y']+10, steps=6); pg.mouse.up()
    pg.wait_for_timeout(300)
    # chọn brush busy và tô cột 3
    pg.click('.brush.b-busy')
    col3 = pg.locator('.col').nth(2).locator('.cell'); col3.nth(20).scroll_into_view_if_needed()
    c1 = col3.nth(20).bounding_box(); c2 = col3.nth(23).bounding_box()
    pg.mouse.move(c1['x']+10,c1['y']+10); pg.mouse.down(); pg.mouse.move(c2['x']+10,c2['y']+10,steps=5); pg.mouse.up()
    pg.wait_for_timeout(300)
    # click đơn vào ô trống mở editor
    c = pg.locator('.col').nth(4).locator('.cell').nth(30); c.click()
    pg.wait_for_selector('.modal'); pg.screenshot(path='/tmp/s1_editor.png')
    pg.fill('.modal input[placeholder^="Tên"]','Cà phê'); pg.click('.modal-foot .primary'); pg.wait_for_timeout(300)
    pg.locator('.wk-scroll').evaluate('e=>e.scrollTop=500')
    pg.screenshot(path='/tmp/s1_me.png')
    db = pg.evaluate("localStorage.getItem('rc_local_db_v1')")
    d = json.loads(db); room = list(d['rooms'].values())[0]
    print(json.dumps(room['sched'], ensure_ascii=False)[:900])
    print('free cells', pg.locator('.cell.st-free').count(), 'busy', pg.locator('.cell.st-busy').count())
    print('ERRORS', errs)
    b.close()
