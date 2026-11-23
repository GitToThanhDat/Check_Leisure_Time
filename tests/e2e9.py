# Chạy trang seed (chế độ thử) rồi đăng nhập Demo xem phòng mẫu
from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1200,'height':850})
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://localhost') else r.abort())
    pg=ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/tools/seed-demo.html'); pg.wait_for_function('document.getElementById("go").onclick')
    pg.fill('#pw','DemoPass123'); pg.click('#go'); pg.wait_for_selector('#res a', timeout=20000)
    print(pg.inner_text('#log')); link=pg.get_attribute('#res a','href'); print(link)
    pg.click('#go'); pg.wait_for_function('document.querySelectorAll("#log span").length>17', timeout=20000)   # chạy lại được
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_selector('.auth-tabs')
    pg.fill('input[name=username]','demo'); pg.fill('input[name=password]','DemoPass123'); pg.click('button[type=submit]'); pg.wait_for_selector('.room-row')
    pg.screenshot(path='/tmp/shots/s1_home.png')
    pg.click('.room-main'); pg.wait_for_selector('.shell'); pg.wait_for_selector('.tl')
    pg.wait_for_timeout(500); pg.screenshot(path='/tmp/shots/s2_group_day_today.png')
    # nhảy sang thứ 6 tuần này bằng chế độ tuần
    pg.click('.seg.sm >> text=Tuần'); pg.wait_for_selector('.hm'); pg.wait_for_timeout(300); pg.screenshot(path='/tmp/shots/s3_group_week.png')
    pg.click('.tab >> text=Chat'); pg.wait_for_selector('.chat'); pg.wait_for_timeout(300); pg.screenshot(path='/tmp/shots/s4_chat.png')
    print('members',pg.evaluate('Object.keys(A.members).length'),'channels',pg.evaluate('Object.keys(A.channels).join()'))
    assert pg.evaluate('Object.keys(A.members).length')==4
    print('errors',errs); assert not errs; b.close(); print('OK e2e9')
