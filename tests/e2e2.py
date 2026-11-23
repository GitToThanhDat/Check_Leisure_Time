from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import *
import json
SEED = """
(() => {
 const d = JSON.parse(localStorage.getItem('rc_local_db_v1')); const rid = Object.keys(d.rooms)[0]; const r = d.rooms[rid];
 const today = new Date(); const pad=n=>String(n).padStart(2,'0');
 const ds = o => { const x=new Date(today); x.setDate(x.getDate()+o); return x.getFullYear()+'-'+pad(x.getMonth()+1)+'-'+pad(x.getDate()); };
 r.members.mLan = {name:'Lan', emoji:'🌸', color:'#ff7ccf', joinedAt: 2, showLb:true};
 r.members.mHung = {name:'Hùng', emoji:'🎮', color:'#5ab8ff', joinedAt: 3, showLb:false};
 r.sched = r.sched || {};
 const meId = Object.keys(r.members)[0];
 r.sched.mLan = { rec:{a:{d:127,s:1380,e:420,st:'busy',lb:'Ngủ'}, b:{d:31,s:450,e:705,st:'busy',lb:'Đi học'}}, one:{} };
 r.sched.mHung = { rec:{a:{d:127,s:0,e:540,st:'busy',lb:'Ngủ'}, c:{d:127,s:1140,e:1320,st:'free',lb:''}}, one:{} };
 r.sched[meId] = r.sched[meId] || {};
 r.sched[meId].rec = Object.assign({}, r.sched[meId].rec, {z:{d:127,s:1080,e:1380,st:'free',lb:''}});
 for (let i=0;i<5;i++){ r.sched.mLan.one[ds(i)] = {x:{s:1080,e:1260,st:'free',lb:''}}; }
 localStorage.setItem('rc_local_db_v1', JSON.stringify(d));
})()
"""
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width':1100,'height':900})
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://localhost') else r.abort())
    pg = ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    start(pg)
    pg.evaluate(SEED); pg.reload(); enter_first_room(pg)
    pg.click('.tab[data-v=group]'); pg.wait_for_selector('.tl'); pg.wait_for_timeout(400)
    pg.screenshot(path='/tmp/s2_day.png', full_page=False)
    print('members rows', pg.locator('.tn .nm').all_inner_texts())
    pg.click('.seg.sm button:has-text("Tuần")'); pg.wait_for_selector('.hm'); pg.wait_for_timeout(300)
    pg.screenshot(path='/tmp/s2_week.png')
    pg.click('button:has-text("Lọc")'); pg.wait_for_timeout(300); pg.screenshot(path='/tmp/s2_filter.png')
    print('wins', pg.locator('.win').count())
    pg.click('.hm-c.hit >> nth=0'); pg.wait_for_selector('.cell-detail'); pg.screenshot(path='/tmp/s2_cell.png')
    pg.click('.modal-foot .primary'); pg.wait_for_timeout(200)
    print('ERR', errs); b.close()
