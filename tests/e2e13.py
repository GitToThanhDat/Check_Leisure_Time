# Đổi tên phòng/nhóm chat (mọi thành viên, hoặc chỉ chủ/phó khi bật chế độ hạn chế) + phòng mặc định
from playwright.sync_api import sync_playwright
URL='http://localhost:8765/index.html'
errs=[]
def signup(pg,name,pw='123456'):
    pg.click('.auth-tabs >> text=Tạo tài khoản'); pg.fill('input[name=username]',name)
    pg.fill('input[autocomplete=new-password] >> nth=0',pw); pg.fill('input[placeholder="Nhập lại mật khẩu"]',pw)
    pg.click('button[type=submit]'); pg.wait_for_selector('.home')
def login(pg,name,pw='123456'):
    pg.fill('input[name=username]',name); pg.fill('input[name=password]',pw); pg.click('button[type=submit]')
def logout(pg):
    pg.click('.home .me-btn'); pg.click('.modal-foot .danger'); pg.click('.modal .btn.primary >> text=Đăng xuất'); pg.wait_for_selector('.auth-tabs')
def toast(pg,txt):
    pg.wait_for_selector('.toast'); t=' '.join(pg.locator('.toast').all_inner_texts()); assert txt in t,(txt,t); pg.evaluate("document.querySelectorAll('.toast').forEach(e=>e.remove())")
def settings(pg): pg.click('.tab >> text=Cài đặt'); pg.wait_for_selector('.settings')
def home(pg): pg.click('.topbar .icon-btn >> nth=0'); pg.wait_for_selector('.room-row')
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':900,'height':900})
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://localhost') else r.abort())
    pg=ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('.auth-tabs')
    signup(pg,'Chủ A'); pg.click('button >> text=Tạo phòng mới'); pg.fill('.modal input','Phòng Một'); pg.click('.modal .btn.primary'); pg.wait_for_selector('.shell')
    link=pg.evaluate('A.inviteLink()'); rid=pg.evaluate('A.room.id')
    # nhóm chat do chủ phòng tạo (tạo thẳng bằng code)
    pg.evaluate("A.store.set(A.path('channels/g1'),{title:'Nhóm Ăn Vặt',kind:'group',ts:Date.now(),by:A.me.id,members:{[A.me.id]:true}})")
    home(pg); logout(pg)
    signup(pg,'Bạn B'); pg.fill('input[placeholder^="Dán link"]',link); pg.click('.home .btn.primary >> text=Vào'); pg.click('button >> text=Tham gia phòng'); pg.wait_for_selector('.shell')
    # mặc định: mọi thành viên đổi được tên phòng
    settings(pg); pg.click('.st-sec:has-text("Tên phòng") button:has-text("Đổi tên phòng")'); pg.fill('.modal input','Phòng Hai'); pg.click('.modal .btn.primary'); toast(pg,'Đã đổi tên')
    pg.wait_for_function("document.querySelector('.rname').textContent==='Phòng Hai'")
    # thêm B vào nhóm g1 (do chủ tạo) rồi B đổi tên nhóm
    pg.evaluate("A.store.set(A.path('channels/g1/members/'+A.me.id),true)"); pg.click('.tab >> text=Chat'); pg.wait_for_selector('.ch-list, .chat'); pg.evaluate("A.openChannel('g1')"); pg.wait_for_selector('button[title="Thông tin nhóm"]')
    pg.click('button[title="Thông tin nhóm"]'); pg.wait_for_selector('.modal'); assert not pg.is_disabled('.modal input.inp >> nth=0'); pg.fill('.modal input.inp >> nth=0','Nhóm Mới'); pg.click('.modal .btn.primary >> text=Lưu'); pg.wait_for_function("A.channels.g1.title==='Nhóm Mới'")
    # phòng mặc định: bật ở Cài đặt, đăng xuất rồi đăng nhập lại -> vào thẳng phòng
    settings(pg); pg.check('label:has-text("phòng mặc định") input'); toast(pg,'mặc định')
    home(pg); logout(pg); login(pg,'Bạn B'); pg.wait_for_selector('.shell'); assert pg.inner_text('.rname')=='Phòng Hai'
    pg.reload(); pg.wait_for_selector('.shell'); assert pg.inner_text('.rname')=='Phòng Hai'      # mở lại web cũng tự vào
    # về danh sách: vẫn hiện được, có đánh dấu mặc định; bỏ mặc định thì lần sau hiện danh sách
    home(pg); assert 'phòng mặc định' in pg.inner_text('.home'); pg.click('.room-row .icon-btn.starred'); toast(pg,'Đã bỏ'); pg.wait_for_function("!A.user.defaultRoom")
    logout(pg); login(pg,'Bạn B'); pg.wait_for_selector('.room-row'); assert pg.locator('.shell').count()==0
    pg.click('.room-row .icon-btn >> nth=0'); toast(pg,'mặc định'); logout(pg)
    # chủ phòng bật chế độ hạn chế
    login(pg,'Chủ A'); pg.wait_for_selector('.room-row'); pg.click('.room-main'); pg.wait_for_selector('.shell'); settings(pg)
    pg.check('label:has-text("Chỉ chủ phòng và phó phòng được đổi tên") input'); toast(pg,'chỉ chủ phòng')
    assert pg.evaluate('A.room.meta.modRename')==True
    home(pg); logout(pg)
    # B: không còn nút đổi tên phòng, không sửa được tên nhóm (không phải người lập nhóm)
    login(pg,'Bạn B'); pg.wait_for_selector('.shell'); settings(pg)
    assert pg.locator('button:has-text("Đổi tên phòng")').count()==0 and 'đã bật chế độ' in pg.inner_text('.settings')
    pg.click('.tab >> text=Chat'); pg.evaluate("A.openChannel('g1')"); pg.wait_for_selector('button[title="Thông tin nhóm"]'); pg.click('button[title="Thông tin nhóm"]'); pg.wait_for_selector('.modal'); assert pg.is_disabled('.modal input.inp >> nth=0')
    pg.click('.modal .btn.ghost >> nth=-1'); home(pg); logout(pg)
    # chủ phòng vẫn đổi được và tắt chế độ thì B đổi lại được
    login(pg,'Chủ A'); pg.wait_for_selector('.room-row'); pg.click('.room-main'); pg.wait_for_selector('.shell'); settings(pg)
    pg.click('.st-sec:has-text("Đặc quyền") button:has-text("Đổi tên phòng")'); pg.fill('.modal input','Phòng Ba'); pg.click('.modal .btn.primary'); toast(pg,'Đã đổi tên')
    pg.uncheck('label:has-text("Chỉ chủ phòng và phó phòng được đổi tên") input'); toast(pg,'Mọi thành viên')
    assert not pg.evaluate('A.room.meta.modRename')
    assert not errs, errs
    print('e2e13 OK'); b.close()
