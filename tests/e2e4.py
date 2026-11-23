from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import *
import json
JSON = '''Đây là kết quả:
```json
{"schema":"ranhchua/v1","recurring":[{"days":["mon","wed"],"start":"07:00","end":"09:15","status":"busy","label":"Mạng máy tính","from":"2026-09-07","to":"2026-12-20"},{"days":["fri"],"start":"13:00","end":"15:15","status":"Bận","label":"Cơ sở dữ liệu"}],
"events":[{"date":"2026-11-25","start":"19:00","end":"21:00","status":"busy","label":"Sinh nhật Lan"},{"date":"28/11/2026","start":"22:00","end":"02:00","status":"free","label":"Cày game"}, {"date":"zz","start":"1","end":"2"}]}
```'''
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width':1100,'height':860})
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://localhost') else r.abort())
    pg = ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    start(pg)
    pg.click('button:has-text("Nhập từ ảnh lịch")'); pg.wait_for_selector('.imp')
    prompt = pg.locator('textarea[readonly]').input_value(); print('PROMPT OK', 'Hôm nay là' in prompt, len(prompt))
    pg.fill('.imp textarea:not([readonly]) >> nth=1', JSON) if False else pg.fill('textarea[placeholder^="Dán kết quả"]', JSON)
    pg.wait_for_selector('.imp-list'); pg.wait_for_timeout(200); pg.screenshot(path='/tmp/s4_import.png')
    print('preview', pg.locator('.imp-result').inner_text()[:300])
    pg.click('.modal-foot .primary'); pg.wait_for_timeout(500)
    d = json.loads(pg.evaluate("localStorage.getItem('rc_local_db_v1')")); room = list(d['rooms'].values())[0]; sc = list(room['sched'].values())[0]
    print('rec', len(sc['rec']), 'one dates', list(sc['one'].keys()), 'src', [v['src'] for v in sc['rec'].values()])
    pg.screenshot(path='/tmp/s4_me.png')
    # nhập lại -> thay thế
    pg.click('button:has-text("Nhập từ ảnh lịch")'); pg.wait_for_selector('.imp'); pg.fill('textarea[placeholder^="Dán kết quả"]', JSON); pg.wait_for_selector('.imp-list'); 
    print('modes', pg.locator('.imp-result .seg button').all_inner_texts()); pg.click('.modal-foot .primary'); pg.wait_for_timeout(400)
    sc = list(json.loads(pg.evaluate("localStorage.getItem('rc_local_db_v1')"))['rooms'].values())[0]['sched']; sc = list(sc.values())[0]; print('after replace rec', len(sc['rec']))
    # settings + nền
    pg.click('.tab[data-v=settings]'); pg.wait_for_selector('.settings'); pg.wait_for_timeout(300); pg.screenshot(path='/tmp/s4_settings.png')
    for bg in ['Sao đêm','Cánh hoa','Sóng biển','Êm dịu']:
        pg.click(f'.bg-sw:has-text("{bg}")'); pg.wait_for_timeout(900); pg.screenshot(path=f'/tmp/s5_{bg.replace(" ","_")}.png')
    pg.click('.bg-sw:has-text("Ảnh của tôi")'); pg.wait_for_timeout(300)
    pg.set_input_files('input[type=file][accept="image/*"]', '/tmp/bg.png'); pg.wait_for_timeout(1000)
    pg.screenshot(path='/tmp/s5_image.png')
    pg.click('.tab[data-v=me]'); pg.wait_for_timeout(400); pg.screenshot(path='/tmp/s5_me_img.png')
    print('ERR', errs); b.close()
