# Nhảy ngày, prompt import, biệt danh, @tag màu xanh + mirror, chủ phòng xoá người, filter nhiều người
from playwright.sync_api import sync_playwright
errs=[]
def seed(pg):
    pg.goto('http://localhost:8765/tools/seed-demo.html'); pg.wait_for_function('document.getElementById("go").onclick')
    pg.fill('#pw','DemoPass123'); pg.click('#go'); pg.wait_for_selector('#res a', timeout=20000)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1200,'height':850})
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://localhost') else r.abort())
    pg=ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    seed(pg)
    link=pg.get_attribute('#res a','href'); print('seed link',link); assert '#r=phongthunghiem-' in link
    pg.goto(link); pg.wait_for_selector('.auth-tabs')
    assert 'mời' in pg.inner_text('.auth-card')     # hiện ghi chú được mời vào phòng
    pg.fill('input[name=username]','AI Test 2'); pg.fill('input[name=password]','DemoPass123'); pg.click('button[type=submit]'); pg.wait_for_selector('.shell')
    assert pg.inner_text('.rname')=='Phòng thử nghiệm'
    # ---- nhảy ngày ở Lịch của tôi
    pg.click('.tab >> text=Lịch của tôi'); pg.wait_for_selector('.wk-scroll')
    pg.click('.me-nav .datepick'); pg.wait_for_selector('.dp-grid'); pg.screenshot(path='/tmp/shots/b1_datepicker.png')
    pg.click('.dp-quick >> text=Tháng 1 năm sau'); pg.wait_for_function('document.querySelector(".me-nav .range").textContent.includes("/1")')
    print('me range', pg.inner_text('.me-nav .range'))
    pg.click('.me-nav .datepick'); pg.select_option('.dp select >> nth=0','5'); pg.wait_for_timeout(100)
    pg.locator('.dp-d:not(.out)').nth(14).click(); pg.wait_for_timeout(200); print('after pick', pg.inner_text('.me-nav .range'))
    # ---- nhảy ngày ở Nhóm
    pg.click('.tab >> text=Nhóm'); pg.wait_for_selector('.tl'); pg.click('.g-head .datepick'); pg.wait_for_selector('.dp-grid'); pg.click('.dp-quick >> text=6 tháng nữa'); pg.wait_for_timeout(200)
    print('group date', pg.inner_text('.g-head .range'))
    # ---- mở lọc: picker người, khung giờ đêm khuya
    pg.click('.g-head button:has-text("Lọc")'); pg.wait_for_selector('.mp'); pg.screenshot(path='/tmp/shots/b2_filters.png')
    pg.click('.mp-tools >> text=Bỏ chọn'); pg.wait_for_timeout(200); assert 'Chưa chọn ai' in pg.inner_text('.g-main'), pg.inner_text('.g-main')[:80]
    pg.click('.mp-tools >> text=Chọn tất cả'); pg.click('.chip >> text=Đêm khuya'); pg.wait_for_timeout(200)
    assert pg.evaluate('G=Views.group; G.f.fromH===0 && G.f.toH===6')
    # ---- prompt import
    pg.click('.tab >> text=Lịch của tôi'); pg.click('button:has-text("Nhập từ ảnh lịch")'); pg.wait_for_selector('.imp')
    pr=lambda: pg.input_value('textarea.mono >> nth=0')
    t0=pr(); assert 'Mốc thời gian: hôm nay là' in t0
    pg.fill('.imp input[type=date]','2026-12-12'); pg.wait_for_timeout(150); t1=pr(); assert 'Thứ bảy, 12/12/2026' in t1, t1[:400]
    pg.click('.imp .chip >> text=Thời khoá biểu'); pg.click('.imp .seg button >> text=Rảnh'); pg.fill('.imp textarea >> nth=0','bỏ môn Thể dục, thêm giờ ngủ 23:00-07:00'); pg.wait_for_timeout(400)
    t2=pr(); assert 'thời khoá biểu' in t2.lower() and 'RẢNH' in t2 and 'bỏ môn Thể dục' in t2 and 'Yêu cầu riêng của tôi' in t2
    pg.screenshot(path='/tmp/shots/b3_import.png')
    # dán JSON có ngày dd/mm không năm -> đọc theo mốc 12/12/2026
    pg.fill('.imp textarea.mono >> nth=1','{"events":[{"date":"05/01","start":"09:00","end":"10:00","label":"Thi"}]}'); pg.wait_for_timeout(500)
    assert '1 khung giờ' in pg.inner_text('.imp-result'); print(pg.inner_text('.imp-result')[:120])
    pg.click('.modal-foot >> text=Đóng')
    # ---- chat: biệt danh + @tag + mirror
    pg.click('.tab >> text=Chat'); pg.wait_for_selector('.chat')
    pg.click('.ch-item >> nth=0'); pg.click('.th-head .icon-btn:last-child'); pg.wait_for_selector('.nick-row')
    pg.click('.nick-row >> nth=0'); pg.fill('.modal input >> nth=-1','Cậu Út'); pg.click('.modal .btn.primary >> nth=-1'); pg.wait_for_timeout(300)
    assert 'Cậu Út' in pg.inner_text('.nick-row >> nth=0'); pg.screenshot(path='/tmp/shots/b4_nick.png'); pg.click('.modal-foot >> text=Đóng')
    ta=pg.locator('.composer textarea'); ta.click(); ta.type('Chào @Rắn Hổ M'); pg.wait_for_selector('.mpop .mi'); pg.screenshot(path='/tmp/shots/b5_mention_popup.png')
    ta.press('Enter'); ta.type('chốt kèo nhé @Demo và @all'); pg.wait_for_timeout(200)
    n=pg.locator('.ta-mirror .mention.live').count(); print('mirror mentions',n); assert n>=2
    pg.screenshot(path='/tmp/shots/b6_composer.png')
    ta.type(' ok'); ta.press('Enter'); pg.wait_for_timeout(500)
    col=pg.evaluate('getComputedStyle(document.querySelector(".msg.mine .mention")).color'); print('mention color',col)
    pg.screenshot(path='/tmp/shots/b7_sent.png')
    # đổi sang Demo (chủ phòng) xem thông báo + xoá người
    pg.evaluate('A.logout()'); pg.wait_for_selector('.auth-tabs'); pg.fill('input[name=username]','Demo'); pg.fill('input[name=password]','DemoPass123'); pg.click('button[type=submit]'); pg.wait_for_selector('.room-row'); pg.click('.room-main'); pg.wait_for_selector('.shell')
    assert pg.evaluate('A.notifs.some(n=>n.v.t==="mention" || n.v.t==="all")')
    pg.click('.tab >> text=Cài đặt'); pg.click('.mrow:has-text("AI Test 3") .dng'); pg.click('.modal .btn.danger'); pg.wait_for_function('Object.keys(A.members).length===3')
    pg.click('.mrow:has-text("AI Test 2") button[title^="Giao quyền"]'); pg.click('.modal .btn.primary >> nth=-1'); pg.wait_for_function('A.room.meta.owner!==A.me.id'); print('owner transferred')
    print('errors',errs); assert not errs; b.close(); print('OK e2e10')
