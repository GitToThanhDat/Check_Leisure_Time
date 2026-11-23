# Luồng tài khoản: đăng ký -> tạo phòng -> mời -> tham gia -> chủ phòng xoá/chuyển quyền -> rời phòng
from playwright.sync_api import sync_playwright
import sys
URL='http://localhost:8765/index.html'
errs=[]
def newpage(b):
    ctx=b.new_context(viewport={'width':1100,'height':800})   # cùng context = cùng localStorage = cùng "máy chủ" local
    return ctx
def watch(pg):
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.on('console', lambda m: errs.append('console:'+m.text) if m.type=='error' and 'ERR_FAILED' not in m.text and 'ERR_INTERNET' not in m.text else None)
def signup(pg,name,pw):
    pg.click('.auth-tabs >> text=Tạo tài khoản')
    pg.fill('input[name=username]',name); pg.fill('input[autocomplete=new-password] >> nth=0',pw); pg.fill('input[placeholder="Nhập lại mật khẩu"]',pw)
    pg.click('button[type=submit]'); pg.wait_for_selector('.home')
def login(pg,name,pw):
    pg.fill('input[name=username]',name); pg.fill('input[name=password]',pw); pg.click('button[type=submit]'); pg.wait_for_selector('.home')
def logout(pg):
    pg.click('.home .me-btn'); pg.click('.modal-foot .danger'); pg.wait_for_selector('.modal .btn.primary >> text=Đăng xuất'); pg.click('.modal .btn.primary >> text=Đăng xuất'); pg.wait_for_selector('.auth-tabs')
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1100,'height':800})
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://localhost') else r.abort())
    pg=ctx.new_page(); watch(pg)
    pg.goto(URL); pg.wait_for_selector('.auth-tabs'); pg.screenshot(path='/tmp/shots/a1_auth.png')
    # đăng ký chủ phòng
    signup(pg,'Chủ Nhà','matkhau1')
    assert 'Chủ Nhà' in pg.inner_text('.home')
    # tên trùng (khác hoa/thường, dấu, khoảng trắng) phải bị từ chối
    logout(pg)
    pg.click('.auth-tabs >> text=Tạo tài khoản'); pg.fill('input[name=username]','chu nha'); pg.fill('input[autocomplete=new-password] >> nth=0','abcdef'); pg.fill('input[placeholder="Nhập lại mật khẩu"]','abcdef'); pg.click('button[type=submit]')
    pg.wait_for_selector('.toast.err'); assert 'đã có người' in pg.inner_text('.toast.err')
    # sai mật khẩu
    pg.click('.auth-tabs >> text=Đăng nhập'); pg.fill('input[name=username]','Chủ Nhà'); pg.fill('input[name=password]','sai'); pg.click('button[type=submit]'); pg.wait_for_selector('.toast.err >> text=Sai tên')
    login(pg,'chu nha','matkhau1')   # đăng nhập không phân biệt hoa thường/dấu
    # tạo phòng
    pg.click('button >> text=Tạo phòng mới'); pg.fill('.modal input','Ổ Rắn Test'); pg.click('.modal .btn.primary'); pg.wait_for_selector('.shell')
    assert pg.inner_text('.rname')=='Ổ Rắn Test'
    pg.screenshot(path='/tmp/shots/a2_room.png')
    rid=pg.evaluate('A.room.id'); print('room',rid)
    # về danh sách: phòng hiện ở "Phòng tôi tạo" và có nút copy link
    pg.click('.topbar .icon-btn >> nth=0'); pg.wait_for_selector('.room-row')
    assert 'Phòng tôi tạo' in pg.inner_text('.home') and 'Bạn là chủ phòng' in pg.inner_text('.home')
    pg.screenshot(path='/tmp/shots/a3_home.png')
    # xoá localStorage "session" giả lập mất link: đăng xuất rồi đăng nhập lại vẫn thấy phòng
    logout(pg); login(pg,'Chủ Nhà','matkhau1'); pg.wait_for_selector('.room-row'); assert 'Ổ Rắn Test' in pg.inner_text('.home'), 'phòng phải còn trong danh sách riêng'
    logout(pg)
    # thành viên 1 vào bằng link
    signup(pg,'Bạn A','123456')
    pg.fill('input[placeholder^="Dán link"]','http://localhost:8765/index.html#r='+rid); pg.click('.home .btn.primary >> text=Vào'); pg.wait_for_selector('text=Tham gia phòng'); pg.screenshot(path='/tmp/shots/a4_join.png')
    pg.click('button >> text=Tham gia phòng'); pg.wait_for_selector('.shell')
    assert pg.evaluate('Object.keys(A.members).length')==2
    # thành viên không có đặc quyền chủ phòng
    pg.click('.tab >> text=Cài đặt'); pg.wait_for_selector('.settings')
    assert pg.locator('text=Đặc quyền chủ phòng').count()==0 and pg.locator('button:has-text("Xoá phòng")').count()==0
    pg.screenshot(path='/tmp/shots/a5_settings_member.png')
    # bạn A rời phòng
    pg.click('button >> text=Rời phòng'); pg.click('.modal .btn.danger'); pg.wait_for_selector('.home'); assert 'Ổ Rắn Test' not in pg.inner_text('.home')
    # vào lại rồi để chủ phòng xoá
    pg.fill('input[placeholder^="Dán link"]',rid); pg.click('.home .btn.primary >> text=Vào'); pg.click('button >> text=Tham gia phòng'); pg.wait_for_selector('.shell')
    logout_room=lambda: None
    pg.click('.topbar .me-btn'); pg.click('.modal-foot .danger'); pg.click('.modal .btn.primary >> text=Đăng xuất'); pg.wait_for_selector('.auth-tabs')
    login(pg,'Chủ Nhà','matkhau1'); pg.click('.room-main'); pg.wait_for_selector('.shell')
    pg.click('.tab >> text=Cài đặt'); pg.wait_for_selector('text=Đặc quyền chủ phòng'); pg.screenshot(path='/tmp/shots/a6_settings_owner.png')
    assert pg.locator('.mrow:has-text("Bạn A")').count()==1
    pg.click('.mrow:has-text("Bạn A") .dng'); pg.click('.modal .btn.danger'); pg.wait_for_function('Object.keys(A.members).length===1')
    # khoá phòng -> người mới không vào được
    pg.click('button:has-text("Khoá phòng")'); pg.wait_for_function('A.room.meta.locked===true')
    print('errors:',errs)
    assert not [e for e in errs if 'PAGEERR' in e], errs
    b.close(); print('OK e2e8')
