# Hướng dẫn sử dụng trong Cài đặt: mở modal, đủ mục, mục lục nhảy tới đúng phần, không chữ in hoa, dùng được trên điện thoại
import sys; sys.path.insert(0,'tests')
from playwright.sync_api import sync_playwright
import helpers as H
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':900,'height':800})
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://localhost') else r.abort())
    pg=ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    H.start(pg,'Người Mới')
    pg.click('.tab >> text=Cài đặt'); pg.wait_for_selector('.settings')
    assert pg.locator('.st-sec h3').first.inner_text()=='Hướng dẫn sử dụng'
    pg.click('button >> text=Mở hướng dẫn'); pg.wait_for_selector('.guide .gd-sec')
    n=pg.locator('.guide .gd-sec').count(); assert n==12,n
    assert pg.locator('.gd-tocb').count()==12
    txt=pg.locator('.guide').inner_text()
    for k in ['Tạo phòng mới','Giờ chung gợi ý','Cùng giờ','Liền mạch','Copy câu lệnh','Chủ phòng','Phó phòng','Đổi link mời','Đặt làm phòng mặc định','Tiếp tục với Google','Ghi nhớ đăng nhập','@all','Nhập vào lịch của tôi']:
        assert k in txt,k
    # không dùng chữ in hoa
    tt=pg.evaluate("[...document.querySelectorAll('.guide *')].filter(e=>getComputedStyle(e).textTransform==='uppercase').length"); assert tt==0
    # mục lục nhảy tới phần cuối
    before=pg.evaluate("document.querySelector('.modal-body').scrollTop")
    pg.click('.gd-tocb >> nth=10'); pg.wait_for_timeout(900)
    after=pg.evaluate("document.querySelector('.modal-body').scrollTop"); assert after>before+300,(before,after)
    top=pg.evaluate("document.querySelector('#gd-quan-ly').getBoundingClientRect().top - document.querySelector('.modal-body').getBoundingClientRect().top"); assert -5<top<120,top
    # Esc đóng
    pg.keyboard.press('Escape'); pg.wait_for_timeout(400); assert pg.locator('.guide').count()==0
    # điện thoại: không tràn ngang
    pg.set_viewport_size({'width':390,'height':760}); pg.click('button >> text=Mở hướng dẫn'); pg.wait_for_selector('.guide .gd-sec')
    ov=pg.evaluate("(()=>{const b=document.querySelector('.modal-body');return b.scrollWidth-b.clientWidth})()"); assert ov<=1,ov
    pg.screenshot(path='/tmp/guide-m.png')
    b.close()
print('ERR',errs); assert not errs; print('OK e2e14')
