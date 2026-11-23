from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import *
import json
exec(open('tests/e2e2.py').read().split('with sync_playwright')[0])   # reuse SEED
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width':1100,'height':800})
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://localhost') else r.abort())
    pg = ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    start(pg)
    pg.evaluate(SEED); pg.reload(); enter_first_room(pg)
    pg.click('.tab[data-v=chat]'); pg.wait_for_selector('.composer textarea')
    ta = pg.locator('.composer textarea'); ta.click(); ta.type('Chiều nay đi cà phê không @La')
    pg.wait_for_selector('.mpop .mi'); pg.screenshot(path='/tmp/s3_pop.png')
    pg.keyboard.press('Enter'); ta.type('nhé, và @all cũng vậy'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    d = json.loads(pg.evaluate("localStorage.getItem('rc_local_db_v1')")); room = list(d['rooms'].values())[0]
    print('chats', json.dumps(room['chats'], ensure_ascii=False)[:400])
    print('notif keys', {k: [v['t'] for v in n.values()] for k, n in room['notifs'].items()})
    # tạo kèo từ giờ chung
    pg.click('.tab[data-v=group]'); pg.wait_for_selector('.win'); pg.click('.win .btn.primary >> nth=0'); pg.wait_for_selector('.modal')
    pg.wait_for_timeout(300); pg.screenshot(path='/tmp/s3_plan_modal.png')
    pg.fill('.modal input[placeholder^="Tên kèo"]','Cà phê chiều'); pg.fill('.modal input[placeholder^="Địa điểm"]','The Coffee House'); pg.click('.modal-foot .primary'); pg.wait_for_selector('.plan-card')
    pg.wait_for_timeout(500); pg.screenshot(path='/tmp/s3_plan.png')
    pg.click('.rsvp button:has-text("Tham gia")'); pg.wait_for_timeout(300)
    # giả lập người khác tag mình: ghi qua trang 2
    pg2 = ctx.new_page(); pg2.goto('http://localhost:8765/index.html'); enter_first_room(pg2)
    pg2.evaluate("""(() => { const d=JSON.parse(localStorage.getItem('rc_local_db_v1')); const r=Object.values(d.rooms)[0]; const me=Object.keys(r.members).find(k=>r.members[k].name==='Minh');
      r.notifs=r.notifs||{}; r.notifs[me]=r.notifs[me]||{}; r.notifs[me].zz1={t:'mention',by:'mLan',ch:'general',txt:'@Minh ơi rảnh không?',ts:Date.now()+5}; localStorage.setItem('rc_local_db_v1',JSON.stringify(d)); })()""")
    pg.bring_to_front(); pg.wait_for_timeout(600)
    pg.screenshot(path='/tmp/s3_toast.png'); print('toast', pg.locator('.toast').all_inner_texts(), 'bell', pg.locator('#bell-dot').inner_text())
    pg.click('#bell'); pg.wait_for_selector('.notif'); pg.screenshot(path='/tmp/s3_bell.png')
    print('ERR', errs); b.close()
