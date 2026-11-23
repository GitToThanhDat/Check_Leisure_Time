# Thả cảm xúc + trả lời tin nhắn (2 người trong cùng phòng, chế độ thử)
import sys; sys.path.insert(0,'tests')
from playwright.sync_api import sync_playwright
import helpers as H
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1000,'height':800})
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://localhost') else r.abort())
    pg=ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    H.start(pg,'Chủ Chat'); rid=pg.evaluate('A.room.id'); link=pg.evaluate('A.inviteLink()')
    pg.click('.tab >> text=Chat'); pg.wait_for_selector('.composer textarea')
    # gửi tin
    pg.fill('.composer textarea','Tối nay đi ăn nhé'); pg.keyboard.press('Enter'); pg.wait_for_selector('.msg .tx >> text=Tối nay đi ăn nhé')
    # thêm thành viên thứ hai bằng code (cùng phòng) rồi tin của người đó
    pg.evaluate("""(async()=>{const id='u2';await A.store.set(A.path('members/'+id),{name:'Bạn Hai',emoji:'🐱',color:'#4cc9f0',joinedAt:Date.now()});
      const k=A.store.newKey(A.path('chats/general'));await A.store.set(A.path('chats/general/'+k),{by:id,txt:'Mình rảnh 7h',ts:Date.now()+1000,mn:[]});})()""")
    pg.wait_for_selector('.msg .tx >> text=Mình rảnh 7h')
    # 1) menu bằng nút hover -> thả 😂 vào tin của người khác
    other=pg.locator('.msg').filter(has=pg.locator('.tx', has_text='Mình rảnh 7h'))
    other.hover(); other.locator('.macts button >> nth=0').click(); pg.wait_for_selector('.rx-menu')
    assert pg.locator('.rx-e').count()==6
    pg.click('.rx-e >> text=😂'); pg.wait_for_selector('.msg .rxs')
    assert '😂' in other.locator('.rxs').inner_text() and '1' in other.locator('.rxs').inner_text()
    assert pg.locator('.rx-menu').count()==0
    # 2) đổi sang ❤️ (mỗi người chỉ một cảm xúc), qua chuột phải
    other.locator('.bub').click(button='right'); pg.wait_for_selector('.rx-menu')
    assert pg.locator('.rx-e.on').inner_text()=='😂'
    pg.click('.rx-e >> text=❤️'); pg.wait_for_timeout(300)
    t=other.locator('.rxs').inner_text(); assert '❤️' in t and '😂' not in t and '1' in t,t
    # 3) bấm chip -> danh sách người thả; bấm dòng của mình để gỡ
    other.locator('.rxs').click(); pg.wait_for_selector('.rx-list'); assert 'Chủ Chat' in pg.locator('.rx-list').inner_text()
    pg.click('.rx-row2.me'); pg.wait_for_timeout(500); assert other.locator('.rxs').count()==0
    # 4) thả cảm xúc rồi bấm lại cùng icon = gỡ
    other.locator('.bub').click(button='right'); pg.click('.rx-e >> text=👍'); pg.wait_for_selector('.msg .rxs')
    other.locator('.bub').click(button='right'); pg.click('.rx-e >> text=👍'); pg.wait_for_timeout(400); assert other.locator('.rxs').count()==0
    # 5) menu đóng bằng Esc / bấm ra ngoài
    other.locator('.bub').click(button='right'); pg.wait_for_selector('.rx-menu'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200); assert pg.locator('.rx-menu').count()==0
    # 6) trả lời tin của người khác
    other.locator('.bub').click(button='right'); pg.click('.rx-acts button >> text=Trả lời')
    pg.wait_for_selector('.reply-bar'); assert 'Bạn Hai' in pg.locator('.reply-bar').inner_text() and 'Mình rảnh 7h' in pg.locator('.reply-bar').inner_text()
    pg.fill('.composer textarea','Ok 7h nhé'); pg.keyboard.press('Enter')
    pg.wait_for_selector('.msg .quote'); q=pg.locator('.msg .quote').first.inner_text(); assert 'Bạn Hai' in q and 'Mình rảnh 7h' in q,q
    assert pg.locator('.reply-bar').is_visible()==False
    # lưu trong dữ liệu + thông báo cho người được trả lời
    has=pg.evaluate("Object.values(Views.chat.msgs).some(m=>m.re&&m.re.by==='u2'&&m.re.txt==='Mình rảnh 7h')"); assert has
    # 7) Esc huỷ trả lời; bấm trích dẫn cuộn tới tin gốc
    pg.locator('.msg').filter(has=pg.locator('.tx', has_text='Tối nay đi ăn nhé')).locator('.bub').click(button='right'); pg.click('.rx-acts button >> text=Trả lời'); pg.wait_for_selector('.reply-bar')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200); assert pg.locator('.reply-bar').is_visible()==False
    pg.locator('.msg .quote').first.click(); pg.wait_for_selector('.msg.flash')
    # 8) sao chép
    other.locator('.bub').click(button='right'); assert pg.locator('.rx-acts button >> text=Sao chép').count()==1; pg.keyboard.press('Escape')
    # 9) chạm giữ trên điện thoại
    pg.set_viewport_size({'width':390,'height':760}); pg.wait_for_timeout(300)
    pg.evaluate("""(()=>{const b=[...document.querySelectorAll('.msg')].find(m=>m.textContent.includes('Tối nay')&&m.querySelector('.tx')&&m.querySelector('.tx').textContent.includes('Tối nay')).querySelector('.bub');
      const t=new Touch({identifier:1,target:b,clientX:100,clientY:100});b.dispatchEvent(new TouchEvent('touchstart',{touches:[t],bubbles:true}));})()""")
    pg.wait_for_selector('.rx-menu',timeout=3000); box=pg.locator('.rx-menu').bounding_box(); assert box['x']>=0 and box['x']+box['width']<=390,box
    pg.keyboard.press('Escape')
    # thông báo 'reply' đã được ghi cho người được trả lời
    assert pg.evaluate("Object.keys(localStorage).some(k=>localStorage.getItem(k).includes('\"t\":\"reply\"'))")
    b.close()
print('ERR',errs); assert not [e for e in errs if 'name/taken' not in e and 'ERR_FAILED' not in e]; print('OK e2e15')
