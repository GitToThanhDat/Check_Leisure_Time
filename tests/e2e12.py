# Biệt danh theo phòng, kéo tô nhiều ngày, phó phòng, đổi link mời (vô hiệu link cũ), tên không xuống dòng
from playwright.sync_api import sync_playwright
URL='http://localhost:8765/index.html'
errs=[]
def watch(pg):
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.on('console', lambda m: errs.append('console:'+m.text) if m.type=='error' and 'ERR_FAILED' not in m.text and 'ERR_INTERNET' not in m.text and 'name/taken' not in m.text else None)
def signup(pg,name,pw='123456'):
    pg.click('.auth-tabs >> text=Tạo tài khoản'); pg.fill('input[name=username]',name)
    pg.fill('input[autocomplete=new-password] >> nth=0',pw); pg.fill('input[placeholder="Nhập lại mật khẩu"]',pw)
    vals=pg.evaluate('[...document.querySelectorAll(".auth-card input")].map(i=>i.name+":"+i.value).join("|")')
    pg.click('button[type=submit]')
    try: pg.wait_for_selector('.home',timeout=8000)
    except Exception:
        print('SIGNUPFAIL',name,vals,'|',pg.evaluate('[...document.querySelectorAll(".toast")].map(i=>i.textContent).join("/")'),'|',pg.evaluate('document.body.innerText.slice(-200)'),errs); raise
def login(pg,name,pw='123456'):
    pg.fill('input[name=username]',name); pg.fill('input[name=password]',pw); pg.click('button[type=submit]'); pg.wait_for_selector('.home')
def logout(pg):
    pg.click('.home .me-btn'); pg.click('.modal-foot .danger'); pg.click('.modal .btn.primary >> text=Đăng xuất'); pg.wait_for_selector('.auth-tabs')
def join(pg,link):
    pg.evaluate("l=>{location.hash='';}",link); pg.fill('input[placeholder^="Dán link"]',link); pg.click('.home .btn.primary >> text=Vào'); pg.wait_for_selector('text=Tham gia phòng')
def settings(pg): pg.click('.tab >> text=Cài đặt'); pg.wait_for_selector('.settings')
def toast(pg,txt):
    pg.wait_for_selector('.toast:has-text("%s")'%txt); pg.evaluate("document.querySelectorAll('.toast').forEach(e=>e.remove())")
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':420,'height':900})
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://localhost') else r.abort())
    pg=ctx.new_page(); watch(pg); pg.goto(URL); pg.wait_for_selector('.auth-tabs')
    # ---- chủ phòng tạo phòng
    signup(pg,'Tô Thanh Đạt'); pg.click('button >> text=Tạo phòng mới'); pg.fill('.modal input','Hội Rắn'); pg.click('.modal .btn.primary'); pg.wait_for_selector('.shell')
    link=pg.evaluate('A.inviteLink()'); assert '#r=' in link and '-' in link.split('#r=')[1]
    # ---- tên hiển thị không bị bẻ dòng ở thẻ tài khoản (màn hình hẹp)
    settings(pg); h=pg.evaluate("document.querySelector('.prof-i b').getBoundingClientRect().height"); print('name height',h); assert h<26, h
    pg.screenshot(path='/tmp/shots/h1_settings.png')
    # ---- kéo tô sang nhiều ngày (Lịch của tôi): "Cùng giờ" và "Liền mạch"
    pg.set_viewport_size({'width':420,'height':2800})   # đủ cao để thấy cả 24 giờ, tránh tự cuộn khi kéo
    pg.click('.tab >> text=Lịch của tôi'); pg.wait_for_selector('.wk-scroll'); pg.click('.me-nav .seg button >> text=3 ngày')
    def drag(c0,i0,c1,i1):
        cs=pg.locator('.col'); a=cs.nth(c0).locator('.cell').nth(i0); a.scroll_into_view_if_needed()
        ba=a.bounding_box(); bb=cs.nth(c1).locator('.cell').nth(i1).bounding_box()
        pg.mouse.move(ba['x']+ba['width']/2,ba['y']+ba['height']/2); pg.mouse.down(); pg.mouse.move((ba['x']+bb['x'])/2+3,(ba['y']+bb['y'])/2,steps=4); pg.mouse.move(bb['x']+bb['width']/2,bb['y']+bb['height']/2,steps=4); pg.wait_for_timeout(120); return
    pg.click('.brush.b-free'); 
    pg.click('.dragmode button >> text=Cùng giờ'); drag(0,16,2,19); pg.screenshot(path='/tmp/shots/h2_drag_preview.png'); pg.mouse.up(); pg.wait_for_timeout(300)
    ds=pg.evaluate("Object.keys(A.sc(A.me.id).one||{})"); print('days painted (same)',ds, pg.evaluate('JSON.stringify(A.sc(A.me.id).one)')); assert len(ds)==3
    ok=pg.evaluate("(()=>{const o=A.sc(A.me.id).one;return Object.values(o).every(v=>Object.values(v).some(x=>x.s===480&&x.e===600&&x.st==='free'))})()"); assert ok
    pg.evaluate("A.writeSched(Object.fromEntries(Object.keys(A.sc(A.me.id).one).map(d=>['one/'+d,null])))"); pg.wait_for_timeout(300)
    pg.click('.brush.b-busy'); pg.click('.dragmode button >> text=Liền mạch'); drag(0,46,1,13); pg.mouse.up(); pg.wait_for_timeout(300)
    one=pg.evaluate("A.sc(A.me.id).one"); print('seq',one); k=sorted(one.keys()); assert len(k)==2
    d1=list(one[k[0]].values())[0]; d2=list(one[k[1]].values())[0]; assert d1['s']==1380 and d1['e']==1440 and d2['s']==0 and d2['e']==420 and d1['st']=='busy'
    # kéo ngược chiều (từ phải sang trái, dưới lên trên) cũng được
    pg.evaluate("A.writeSched(Object.fromEntries(Object.keys(A.sc(A.me.id).one).map(d=>['one/'+d,null])))"); pg.wait_for_timeout(300)
    pg.click('.dragmode button >> text=Cùng giờ'); pg.click('.brush.b-maybe'); drag(2,30,1,26); pg.mouse.up(); pg.wait_for_timeout(300)
    assert len(pg.evaluate("Object.keys(A.sc(A.me.id).one||{})"))==2
    pg.evaluate("A.writeSched(Object.fromEntries(Object.keys(A.sc(A.me.id).one).map(d=>['one/'+d,null])))")
    pg.set_viewport_size({'width':420,'height':900})
    # ---- thành viên B, C, D vào phòng
    pg.click('.topbar .icon-btn >> nth=0'); pg.wait_for_selector('.room-row'); logout(pg)
    for n in ['Bạn B','Bạn C']:
        signup(pg,n); join(pg,link); pg.click('button >> text=Tham gia phòng'); pg.wait_for_selector('.shell')
        if n=='Bạn B':
            # biệt danh theo phòng
            settings(pg); pg.fill('input[placeholder^="Để trống"]','Bé Bê'); pg.click('.fld .btn.primary >> text=Lưu'); toast(pg,'Bé Bê')
            pg.click('.tab >> text=Chat'); pg.evaluate("A.openChannel('general')"); pg.wait_for_selector('.composer textarea'); ta=pg.locator('.composer textarea'); ta.click(); ta.type('xin chào cả nhà'); ta.press('Enter'); pg.wait_for_timeout(400)
            who=pg.inner_text('.bub .who') if pg.locator('.bub .who').count() else ''
            # tin của mình không hiện "who"; kiểm tra bằng hàm hiển thị
            assert pg.evaluate("A.dn(A.me.id,'general')")=='Bé Bê' and pg.evaluate("A.me.name")=='Bạn B'
        pg.click('.topbar .icon-btn >> nth=0'); pg.wait_for_selector('.room-row'); logout(pg)
    # chủ phòng thấy biệt danh trong chat nhưng danh sách thành viên vẫn có tên thật
    login(pg,'Tô Thanh Đạt'); pg.click('.room-main'); pg.wait_for_selector('.shell'); pg.click('.tab >> text=Chat'); pg.evaluate("A.openChannel('general')"); pg.wait_for_selector('.bub')
    assert 'Bé Bê' in pg.inner_text('.bub .who') or 'Bé Bê' in pg.inner_text('.msgs'), pg.inner_text('.view')[:200]
    pg.screenshot(path='/tmp/shots/h3_chat_nick.png')
    # ---- bổ nhiệm phó phòng
    settings(pg); assert 'Đặc quyền chủ phòng' in pg.inner_text('.settings')
    pg.click('.mrow:has-text("Bạn B") button:has-text("Phó phòng")'); pg.wait_for_function('A.isDeputy(Object.keys(A.members).filter(k=>A.members[k].name==="Bạn B")[0])'); pg.screenshot(path='/tmp/shots/h4_deputy.png')
    old=pg.evaluate('A.inviteLink()'); pg.click('.mrow:has-text("Bạn B") >> text=phó phòng'); 
    pg.click('.topbar .icon-btn >> nth=0'); pg.wait_for_selector('.room-row'); logout(pg)
    # ---- phó phòng: có đặc quyền, xoá được thành viên thường, không xoá được chủ/phó, không xoá phòng/giao quyền
    login(pg,'Bạn B'); pg.click('.room-main'); pg.wait_for_selector('.shell'); settings(pg)
    assert 'Đặc quyền phó phòng' in pg.inner_text('.settings')
    assert pg.locator('button:has-text("Xoá phòng")').count()==0 and pg.locator('button[title^="Giao quyền"]').count()==0 and pg.locator('button:has-text("Phó phòng")').count()==0
    assert pg.locator('.mrow:has-text("Tô Thanh Đạt") button:has-text("Xoá")').count()==0
    assert pg.locator('.mrow:has-text("Bạn C") button:has-text("Xoá")').count()==1
    pg.screenshot(path='/tmp/shots/h5_deputy_settings.png')
    # đổi link mời
    pg.click('button >> text=Đổi link mời'); pg.click('.modal .btn.primary >> text=Đổi link'); toast(pg,'vô hiệu')
    new=pg.evaluate('A.inviteLink()'); assert new!=old and new.split('-')[0]==old.split('-')[0]; print('link changed',old.split('#r=')[1],'->',new.split('#r=')[1])
    # khoá/mở khoá và đổi tên phòng bởi phó phòng
    pg.click('button >> text=Khoá phòng'); toast(pg,'Đã khoá'); pg.click('button >> text=Mở khoá phòng'); toast(pg,'mở lại')
    pg.click('button >> text=Đổi tên phòng'); pg.fill('.modal input','Hội Rắn 2'); pg.click('.modal .btn.primary'); toast(pg,'Đã đổi tên')
    # xoá Bạn C
    pg.click('.mrow:has-text("Bạn C") button:has-text("Xoá")'); pg.click('.modal .btn.danger'); pg.wait_for_function('Object.keys(A.members).length===2')
    pg.click('.topbar .icon-btn >> nth=0'); pg.wait_for_selector('.room-row'); logout(pg)
    # ---- người mới: link cũ bị vô hiệu, link mới vào được
    signup(pg,'Bạn D'); join(pg,old); pg.click('button >> text=Tham gia phòng'); toast(pg,'vô hiệu hoá')
    pg.click('button >> text=Về danh sách phòng'); pg.wait_for_selector('.home'); assert 'Hội Rắn' not in pg.inner_text('.home')
    join(pg,new.split('#r=')[1]); pg.click('button >> text=Tham gia phòng'); pg.wait_for_selector('.shell'); assert pg.inner_text('.rname')=='Hội Rắn 2'
    # liên kết trần (không có mã mời) cũng bị chặn; thành viên cũ mở link cũ vẫn vào thẳng phòng
    pg.click('.topbar .icon-btn >> nth=0'); pg.wait_for_selector('.room-row'); logout(pg)
    signup(pg,'Bạn E'); join(pg,old.split('#r=')[1].split('-')[0]); pg.click('button >> text=Tham gia phòng'); toast(pg,'vô hiệu hoá'); pg.click('button >> text=Về danh sách phòng'); logout(pg)
    login(pg,'Bạn B'); pg.fill('input[placeholder^="Dán link"]',old); pg.click('.home .btn.primary >> text=Vào'); pg.wait_for_selector('.shell')
    # ---- phó phòng rời phòng thì mất quyền (meta.deputies dọn sạch)
    settings(pg); pg.click('button >> text=Rời phòng'); pg.click('.modal .btn.danger'); pg.wait_for_selector('.home')
    login_ok=pg.evaluate("window.A.store.get('rooms/'+Object.keys(JSON.parse(localStorage.getItem('rc_local_db_v1')).rooms)[0]+'/meta')")
    login_ok=login_ok or {}; print('deputies after leave', login_ok.get('deputies'))
    assert not login_ok.get('deputies')
    assert not errs, errs
    print('e2e12 OK'); b.close()
