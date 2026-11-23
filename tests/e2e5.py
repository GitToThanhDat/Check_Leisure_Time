from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import *
import json
exec(open('tests/e2e2.py').read().split('with sync_playwright')[0])
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width':390,'height':800}, has_touch=True, is_mobile=True, device_scale_factor=2, color_scheme='dark')
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://localhost') else r.abort())
    pg = ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    start(pg)
    pg.evaluate(SEED); pg.reload(); enter_first_room(pg); pg.wait_for_timeout(500)
    pg.screenshot(path='/tmp/m_me.png')
    pg.click('.tab[data-v=group]'); pg.wait_for_selector('.tl'); pg.wait_for_timeout(500); pg.screenshot(path='/tmp/m_group.png')
    pg.click('.tab[data-v=chat]'); pg.wait_for_selector('.ch-list'); pg.screenshot(path='/tmp/m_chatlist.png')
    pg.click('.ch-item >> nth=0'); pg.wait_for_selector('.composer'); pg.screenshot(path='/tmp/m_thread.png')
    print('ERR', errs); b.close()
