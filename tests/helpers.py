BASE = 'http://localhost:8765/index.html'
def start(pg, name='Minh', pw='123456', room='Hội'):
    """Đăng ký tài khoản mới (chế độ thử) -> tạo phòng -> vào phòng (đang ở tab Lịch của tôi)."""
    pg.goto(BASE); pg.wait_for_selector('.auth-tabs')
    pg.click('.auth-tabs >> text=Tạo tài khoản'); pg.fill('input[name=username]', name)
    pg.fill('input[autocomplete=new-password] >> nth=0', pw); pg.fill('input[placeholder="Nhập lại mật khẩu"]', pw)
    pg.click('button[type=submit]'); pg.wait_for_selector('.home')
    pg.click('button >> text=Tạo phòng mới'); pg.fill('.modal input', room); pg.click('.modal .btn.primary')
    pg.wait_for_selector('.me')
def enter_first_room(pg):
    pg.wait_for_selector('.room-main'); pg.click('.room-main'); pg.wait_for_selector('.shell')
