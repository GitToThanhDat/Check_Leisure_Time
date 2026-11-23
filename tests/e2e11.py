# Google (giả lập ở chế độ thử): đăng nhập lần đầu -> đặt tên duy nhất; liên kết Google/mật khẩu; ghi nhớ đăng nhập
from playwright.sync_api import sync_playwright
URL='http://localhost:8765/index.html'
errs=[]
def watch(pg):
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.on('console', lambda m: errs.append('console:'+m.text) if m.type=='error' and 'ERR_FAILED' not in m.text and 'ERR_INTERNET' not in m.text and 'name/taken' not in m.text else None)
def signup(pg,name,pw):
    pg.click('.auth-tabs >> text=Tạo tài khoản'); pg.fill('input[name=username]',name)
    pg.fill('input[autocomplete=new-password] >> nth=0',pw); pg.fill('input[placeholder="Nhập lại mật khẩu"]',pw)
    pg.click('button[type=submit]'); pg.wait_for_selector('.home')
def google(pg,email):
    pg.click('.gbtn'); pg.wait_for_selector('.modal input'); pg.fill('.modal input',email); pg.click('.modal .btn.primary')
def logout(pg):
    pg.click('.home .me-btn'); pg.click('.modal-foot .danger'); pg.click('.modal .btn.primary >> text=Đăng xuất'); pg.wait_for_selector('.auth-tabs')
def err(pg,txt):
    pg.wait_for_selector('.toast.err'); t=pg.inner_text('.toast.err'); assert txt in t,(txt,t)
    pg.evaluate("document.querySelectorAll('.toast').forEach(e=>e.remove())")
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1100,'height':800})
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://localhost') else r.abort())
    pg=ctx.new_page(); watch(pg); pg.goto(URL); pg.wait_for_selector('.auth-tabs')
    assert pg.is_visible('.gbtn') and pg.is_checked('.auth-card .chk input')   # nút Google + ô ghi nhớ mặc định bật
    pg.screenshot(path='/tmp/shots/g1_auth.png')
    signup(pg,'Chủ Nhà','matkhau1'); logout(pg)

    # --- Google lần đầu: phải đặt tên; tên trùng bị từ chối
    google(pg,'an.google@gmail.com'); pg.wait_for_selector('text=Đặt tên hiển thị'); pg.screenshot(path='/tmp/shots/g2_pick.png')
    name=pg.locator('.auth-card form input.inp').first
    name.fill('chu nha'); pg.click('button[type=submit]'); err(pg,'đã có người')
    name.fill('A'); pg.click('button[type=submit]'); err(pg,'ít nhất 2')
    name.fill('An Google'); pg.click('button[type=submit]'); pg.wait_for_selector('.home'); assert 'An Google' in pg.inner_text('.home')
    logout(pg)
    # --- Google lần sau: vào thẳng Home, không hỏi tên
    google(pg,'AN.google@gmail.com'); pg.wait_for_selector('.home'); assert 'An Google' in pg.inner_text('.home')
    # --- tên đã thuộc người dùng Google: đăng ký mật khẩu bị từ chối
    logout(pg)
    pg.click('.auth-tabs >> text=Tạo tài khoản'); pg.fill('input[name=username]','an  GOOGLE'); pg.fill('input[autocomplete=new-password] >> nth=0','abcdef'); pg.fill('input[placeholder="Nhập lại mật khẩu"]','abcdef'); pg.click('button[type=submit]'); err(pg,'đã có người')

    # --- Tài khoản Google-only: đặt mật khẩu -> đăng nhập bằng tên + mật khẩu
    google(pg,'an.google@gmail.com'); pg.wait_for_selector('.home')
    pg.click('.home .me-btn'); pg.wait_for_selector('.ways'); assert 'Đã liên kết' in pg.inner_text('.ways') and 'Đặt mật khẩu' in pg.inner_text('.ways')
    assert not pg.locator('.ways button >> text=Huỷ liên kết').count()          # chưa có cách khác -> không cho huỷ liên kết
    pg.click('.ways button >> text=Đặt mật khẩu'); pg.fill('#modal-root .backdrop:last-child input >> nth=0','pass1234'); pg.fill('#modal-root .backdrop:last-child input >> nth=1','pass1234'); pg.click('#modal-root .backdrop:last-child .btn.primary'); pg.wait_for_selector('.ways >> text=Đổi mật khẩu')
    pg.screenshot(path='/tmp/shots/g3_ways.png'); pg.click('.modal-foot .btn.primary >> text=Xong'); logout(pg)
    pg.fill('input[name=username]','an google'); pg.fill('input[name=password]','pass1234'); pg.click('button[type=submit]'); pg.wait_for_selector('.home'); assert 'An Google' in pg.inner_text('.home')
    # huỷ liên kết Google rồi Google không còn vào được tài khoản này
    pg.click('.home .me-btn'); pg.click('.ways button >> text=Huỷ liên kết'); pg.click('.modal .btn.danger >> text=Huỷ liên kết'); pg.wait_for_selector('.ways >> text=Chưa liên kết'); pg.click('.modal-foot .btn.primary >> text=Xong'); logout(pg)
    google(pg,'an.google@gmail.com'); pg.wait_for_selector('text=Đặt tên hiển thị'); pg.click('text=Dùng tài khoản khác'); pg.wait_for_selector('.auth-tabs')

    # --- Liên kết Google vào tài khoản mật khẩu có sẵn
    pg.fill('input[name=username]','Chủ Nhà'); pg.fill('input[name=password]','matkhau1'); pg.click('button[type=submit]'); pg.wait_for_selector('.home')
    pg.click('.home .me-btn'); pg.click('.ways button >> text=Liên kết Google'); pg.fill('#modal-root .backdrop:last-child input','chunha@gmail.com'); pg.click('#modal-root .backdrop:last-child .btn.primary'); pg.wait_for_selector('.ways >> text=chunha@gmail.com')
    pg.click('.modal-foot .btn.primary >> text=Xong'); logout(pg)
    google(pg,'chunha@gmail.com'); pg.wait_for_selector('.home'); assert 'Chủ Nhà' in pg.inner_text('.home')   # cùng tài khoản cũ, không hỏi tên
    # liên kết email Google đã thuộc tài khoản khác -> báo lỗi
    logout(pg)
    signup(pg,'Bạn Ba','matkhau3'); pg.click('.home .me-btn'); pg.click('.ways button >> text=Liên kết Google'); pg.fill('#modal-root .backdrop:last-child input','chunha@gmail.com'); pg.click('#modal-root .backdrop:last-child .btn.primary'); err(pg,'đã được dùng cho một tài khoản khác')
    pg.click('.modal-foot .btn.primary >> text=Xong')

    # --- Ghi nhớ đăng nhập: bật -> tab mới cùng trình duyệt tự vào; tải lại cũng vậy
    pg.reload(); pg.wait_for_selector('.home'); assert 'Bạn Ba' in pg.inner_text('.home')
    pg2=ctx.new_page(); watch(pg2); pg2.goto(URL); pg2.wait_for_selector('.home'); assert 'Bạn Ba' in pg2.inner_text('.home'); pg2.close()
    logout(pg)
    # --- tắt ghi nhớ: tải lại cùng tab vẫn vào (cùng phiên) nhưng tab mới thì phải đăng nhập lại
    pg.uncheck('.auth-card .chk input'); pg.fill('input[name=username]','Bạn Ba'); pg.fill('input[name=password]','matkhau3'); pg.click('button[type=submit]'); pg.wait_for_selector('.home')
    pg.reload(); pg.wait_for_selector('.home')
    pg3=ctx.new_page(); watch(pg3); pg3.goto(URL); pg3.wait_for_selector('.auth-tabs'); assert not pg3.is_checked('.auth-card .chk input')   # nhớ lựa chọn của lần trước
    pg3.close()
    assert not errs, errs
    print('e2e11 OK'); b.close()
