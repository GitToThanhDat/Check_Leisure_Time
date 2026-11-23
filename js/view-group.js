/* view-group.js - Nhóm: timeline ngày, heatmap tuần, bộ lọc, tìm giờ chung */
(function (root) {
  'use strict';
  var h = U.h, $ = U.$, SLOT = Sched.SLOT;
  var ST = { free: 'Rảnh', busy: 'Bận', maybe: 'Có thể', none: 'Chưa đánh dấu' };
  var MODE_NAMES = { strict: 'Chỉ Rảnh', flex: 'Rảnh + Có thể', loose: 'Không bận' };
  var TOD = [['Cả ngày', 0, 24], ['Sáng', 6, 11], ['Trưa', 11, 14], ['Chiều', 14, 18], ['Tối', 18, 23], ['Khuya', 22, 24], ['Đêm khuya', 0, 6]];
  var DEF = { v: 2, mode: 'day', off: [], fromH: 0, toH: 24, weekdays: [], minDur: 60, calc: 'flex', need: 0, finderDays: 14, open: false };

  var G = { date: null, f: null, el: null, cache: null };
  function saveF() { U.lsSet('rc_gf_' + A.room.id, G.f); }
  function loadF() {
    var f = Object.assign({}, DEF, U.lsGet('rc_gf_' + A.room.id, {}));
    if (!f.v || f.v < 2) { f.v = 2; if (f.fromH === 6 && f.toH === 24) f.fromH = 0; }   // bản cũ mặc định 6h–24h: mở rộng cả ngày
    G.f = f;
  }

  function selected() { return A.memberList().filter(function (m) { return G.f.off.indexOf(m.id) < 0; }); }
  function dayOf(mid, date) {
    var k = mid + '|' + date; if (!G.cache) G.cache = {};
    return G.cache[k] || (G.cache[k] = Sched.resolveDay(A.sc(mid), date));
  }
  function isOk(c) { var ok = Sched.MODES[G.f.calc]; return !!ok[c ? c.st : 'none']; }
  function needN(n) { return G.f.need > 0 && G.f.need < n ? G.f.need : n; }
  function showLb(m) { return m.id === A.me.id || m.showLb !== false; }

  /* ---------- Render ---------- */
  G.render = function (el) {
    if (!G.f) loadF();
    if (!G.date) G.date = U.today();
    G.el = el; G.cache = null;
    G.head = h('div.card.glass.g-head'); G.filters = h('div.card.glass.g-filters'); G.main = h('div.card.glass.g-main'); G.finder = h('div.card.glass.g-finder');
    el.appendChild(h('div.group', G.head, G.filters, G.main, G.finder));
    G.drawAll();
  };
  G.update = function (kinds) { if (kinds.sched || kinds.members) { G.cache = null; G.drawAll(); } };
  G.drawAll = function () { G.cache = null; drawHead(); drawFilters(); drawMain(); drawFinder(); };

  function openJump() {
    U.pickDate({
      value: G.date, title: 'Xem nhóm vào ngày…',
      mark: function (ds) { return selected().some(function (m) { var o = A.sc(m.id).one; return o && o[ds]; }); },
      onPick: function (ds) { G.date = ds; drawHead(); drawMain(); }
    });
  }
  function nav(dir) { G.date = Sched.addDays(G.date, dir * (G.f.mode === 'week' ? 7 : 1)); drawHead(); drawMain(); }
  function drawHead() {
    var el = U.clear(G.head), d = G.date, w = Sched.dow(d), mem = A.memberList().length, sel = selected().length;
    var label = G.f.mode === 'week'
      ? U.fmtDay(Sched.startOfWeek(d)) + ' – ' + U.fmtDay(Sched.addDays(Sched.startOfWeek(d), 6))
      : U.fmtDate(d, true);
    el.appendChild(h('div.me-nav',
      h('div.row', h('button.icon-btn', { onclick: function () { nav(-1); } }, U.icon('left')),
        h('button.btn.sm', { onclick: function () { G.date = U.today(); drawHead(); drawMain(); } }, 'Hôm nay'),
        h('button.icon-btn', { onclick: function () { nav(1); } }, U.icon('right')),
        h('button.datepick', { title: 'Nhảy tới ngày bất kỳ', onclick: openJump }, h('b.range', label), U.icon('cal', 16))),
      h('div.row',
        h('div.seg.sm', [['day', 'Ngày'], ['week', 'Tuần']].map(function (x) {
          return h('button' + (G.f.mode === x[0] ? '.on' : ''), { onclick: function () { G.f.mode = x[0]; saveF(); drawHead(); drawMain(); } }, x[1]);
        })),
        h('button.btn.sm' + (G.f.open ? '.primary' : ''), { onclick: function () { G.f.open = !G.f.open; saveF(); drawFilters(); drawHead(); } }, U.icon('filter', 16), 'Lọc'))));
    el.appendChild(h('div.legend', ['free', 'maybe', 'busy', 'none'].map(function (k) { return h('span.lg', h('i.st-' + k), ST[k]); }), h('span.muted.sm', 'Đang xem ' + sel + '/' + mem + ' người')));
  }

  /* ---------- Bộ lọc ---------- */
  function drawFilters() {
    var el = U.clear(G.filters), f = G.f;
    if (!f.open) { el.style.display = 'none'; return; } el.style.display = '';
    var ml = A.memberList(), pSel = {}; ml.forEach(function (m) { if (f.off.indexOf(m.id) < 0) pSel[m.id] = 1; });
    var picker = U.memberPicker({ list: ml, sel: pSel, onChange: function (sl) { f.off = ml.filter(function (m) { return !sl[m.id]; }).map(function (m) { return m.id; }); saveF(); G.cache = null; drawHead(); drawMain(); drawFinder(); } });
    el.appendChild(h('div.fl-sec', h('div.fl-title', h('b', 'Người'),
      h('span.row', h('button.btn.sm.ghost', { onclick: function () { f.off = ml.filter(function (m) { return m.id !== A.me.id; }).map(function (m) { return m.id; }); chg(); } }, 'Chỉ mình tôi'))),
      picker.el));
    var from = h('select.inp.sm', { onchange: function (e) { f.fromH = +e.target.value; if (f.toH <= f.fromH) f.toH = Math.min(24, f.fromH + 1); chg(); } }),
      to = h('select.inp.sm', { onchange: function (e) { f.toH = +e.target.value; if (f.fromH >= f.toH) f.fromH = Math.max(0, f.toH - 1); chg(); } });
    for (var i = 0; i <= 24; i++) { if (i < 24) from.appendChild(h('option', { value: i, selected: f.fromH === i }, i + ':00')); if (i > 0) to.appendChild(h('option', { value: i, selected: f.toH === i }, i + ':00')); }
    el.appendChild(h('div.fl-sec', h('div.fl-title', h('b', 'Khung giờ trong ngày')),
      h('div.chips', TOD.map(function (t) { return h('button.chip' + (f.fromH === t[1] && f.toH === t[2] ? '.on' : ''), { onclick: function () { f.fromH = t[1]; f.toH = t[2]; chg(); } }, t[0]); })),
      h('div.row.mt', from, h('span.muted', 'đến'), to)));
    el.appendChild(h('div.fl-sec', h('div.fl-title', h('b', 'Chỉ xét các thứ'), h('span.muted.sm', 'áp dụng cho "Giờ chung"')),
      h('div.chips', U.DN.map(function (n, i) { var on = f.weekdays.indexOf(i) >= 0; return h('button.chip' + (on ? '.on' : ''), { onclick: function () { var j = f.weekdays.indexOf(i); if (j < 0) f.weekdays.push(i); else f.weekdays.splice(j, 1); chg(); } }, n); }),
        h('button.chip.ghost' + (!f.weekdays.length ? '.on' : ''), { onclick: function () { f.weekdays = []; chg(); } }, 'Mọi ngày'))));
    el.appendChild(h('div.fl-sec', h('div.fl-title', h('b', 'Tính là "đi được" khi')),
      h('div.seg', Object.keys(MODE_NAMES).map(function (k) { return h('button' + (f.calc === k ? '.on' : ''), { onclick: function () { f.calc = k; chg(); } }, MODE_NAMES[k]); })),
      h('p.hint', f.calc === 'loose' ? 'Ai chưa đánh dấu cũng được tính là đi được (chỉ loại người đang Bận).' : f.calc === 'flex' ? 'Tính cả người đánh dấu "Có thể".' : 'Chỉ tính người đã đánh dấu Rảnh.')));
    var n = selected().length, needSel = h('select.inp.sm', { onchange: function (e) { f.need = +e.target.value; chg(); } });
    needSel.appendChild(h('option', { value: 0, selected: !f.need }, 'Tất cả (' + n + ' người)'));
    for (var k = n - 1; k >= 2; k--) needSel.appendChild(h('option', { value: k, selected: f.need === k }, 'Ít nhất ' + k + ' người'));
    el.appendChild(h('div.fl-sec', h('div.fl-title', h('b', 'Kéo dài tối thiểu')),
      h('div.chips', [30, 60, 120, 180, 240].map(function (m) { return h('button.chip' + (f.minDur === m ? '.on' : ''), { onclick: function () { f.minDur = m; chg(); } }, m < 60 ? m + ' phút' : (m / 60) + ' giờ'); })),
      h('div.row.mt', h('span.muted', 'Cần có mặt:'), needSel)));
  }
  function chg() { saveF(); G.cache = null; drawFilters(); drawHead(); drawMain(); drawFinder(); }

  /* ---------- Phần chính ---------- */
  function drawMain() {
    var el = U.clear(G.main), sel = selected();
    if (!sel.length) { el.appendChild(h('p.empty', 'Chưa chọn ai để xem. Bấm "Lọc" rồi chọn người.')); return; }
    var scrollW = G.f.mode === 'week' ? weekView(sel) : dayView(sel);
    el.appendChild(scrollW);
    var anyData = sel.some(function (m) { return Object.keys(A.sc(m.id)).length; });
    if (!anyData) el.appendChild(h('p.hint', 'Chưa ai đánh dấu lịch. Vào "Lịch của tôi" để bắt đầu nhé.'));
  }
  function slotRange() { return [Math.floor(G.f.fromH * 60 / SLOT), Math.ceil(G.f.toH * 60 / SLOT)]; }

  function dayView(sel) {
    var date = G.date, r = slotRange(), n = r[1] - r[0], today = U.today();
    var grid = h('div.tl', { style: { gridTemplateColumns: '120px repeat(' + n + ', 26px)' } });
    grid.appendChild(h('div.tn.corner'));
    for (var i = r[0]; i < r[1]; i++) {
      if (i % 2 === 0) grid.appendChild(h('div.th', { style: { gridColumn: 'span ' + Math.min(2, r[1] - i) } }, (i / 2) + 'h'));
      else if (i === r[0]) grid.appendChild(h('div.th'));
    }
    // dòng "chung"
    var need = needN(sel.length);
    grid.appendChild(h('div.tn.sum', h('b', 'Giờ chung'), h('small.muted', need + '/' + sel.length + ' người')));
    for (i = r[0]; i < r[1]; i++) {
      var cnt = 0; sel.forEach(function (m) { if (isOk(dayOf(m.id, date)[i])) cnt++; });
      var frac = cnt / sel.length, hit = cnt >= need && cnt > 0;
      grid.appendChild(h('div.tc.sumc' + (hit ? '.hit' : ''), { dataset: { i: i, date: date }, style: { background: 'rgba(52,211,153,' + (cnt ? (0.12 + 0.7 * frac).toFixed(2) : 0.04) + ')' } }, cnt ? String(cnt) : ''));
    }
    sel.forEach(function (m) {
      grid.appendChild(h('div.tn' + (m.id === A.me.id ? '.self' : ''), U.avatar(m, 24), h('span.nm', m.name)));
      var res = dayOf(m.id, date);
      for (var i = r[0]; i < r[1]; i++) {
        var c = res[i], k = c ? c.st : 'none', tip = ST[k] + (c && c.lb && showLb(m) ? ': ' + c.lb : '') + ' · ' + Sched.minToStr(i * SLOT);
        grid.appendChild(h('div.tc.st-' + k + (c && c.src === 'rec' ? '.rec' : ''), { dataset: { i: i, date: date }, title: tip }));
      }
    });
    if (date === today) {
      var now = new Date(), nm = now.getHours() * 60 + now.getMinutes();
      if (nm >= r[0] * SLOT && nm < r[1] * SLOT) {
        var x = 120 + (nm - r[0] * SLOT) / SLOT * 26;
        grid.appendChild(h('div.tl-now', { style: { left: x + 'px' } }));
      }
    }
    grid.addEventListener('click', function (e) { var c = e.target.closest('[data-i]'); if (c) openCell(c.dataset.date, +c.dataset.i); });
    var sc = h('div.tl-scroll', grid);
    setTimeout(function () { var s = Math.max(0, (7 * 2 - r[0]) * 26 - 10); if (G.f.fromH < 7) sc.scrollLeft = s; }, 0);
    return sc;
  }

  function weekView(sel) {
    var start = Sched.startOfWeek(G.date), r = slotRange(), n = r[1] - r[0], today = U.today(), need = needN(sel.length), f = G.f;
    var cols = []; for (var d = 0; d < 7; d++) cols.push(Sched.addDays(start, d));
    var grid = h('div.hm', { style: { gridTemplateColumns: '40px repeat(7, minmax(0,1fr))' } });
    grid.appendChild(h('div.hm-corner'));
    cols.forEach(function (ds, di) {
      grid.appendChild(h('div.hm-dh' + (ds === today ? '.today' : '') + (f.weekdays.length && f.weekdays.indexOf(di) < 0 ? '.dim' : ''), h('span', U.DN[di]), h('b', Sched.parseDate(ds).getDate())));
    });
    for (var i = r[0]; i < r[1]; i++) {
      grid.appendChild(h('div.hm-gl', i % 2 === 0 ? (i / 2) + 'h' : ''));
      cols.forEach(function (ds, di) {
        var cnt = 0, mine = null; sel.forEach(function (m) { var c = dayOf(m.id, ds)[i]; if (isOk(c)) cnt++; });
        var frac = cnt / sel.length, hit = cnt >= need && cnt > 0, dim = f.weekdays.length && f.weekdays.indexOf(di) < 0;
        grid.appendChild(h('div.hm-c' + (hit ? '.hit' : '') + (dim ? '.dim' : ''), { dataset: { i: i, date: ds }, style: { background: cnt ? 'rgba(52,211,153,' + (0.1 + 0.75 * frac).toFixed(2) + ')' : '' } }, cnt ? String(cnt) : ''));
      });
    }
    grid.addEventListener('click', function (e) { var c = e.target.closest('[data-i]'); if (c) openCell(c.dataset.date, +c.dataset.i); });
    var sc = h('div.hm-scroll', grid);
    setTimeout(function () { var hit = sc.querySelector('.hm-c.hit'), top = Math.max(0, (7 * 2 - r[0]) * 24 - 6); if (hit) top = Math.max(0, hit.offsetTop - 160); sc.scrollTop = top; }, 0);
    return h('div', sc, h('p.hint', 'Số trong ô = số người đi được. Ô viền sáng = đủ số người bạn cần. Chạm vào ô để xem chi tiết và rủ đi chơi.'));
  }

  /* ---------- Chi tiết một ô ---------- */
  function openCell(date, i) {
    var sel = selected(), groups = { free: [], maybe: [], busy: [], none: [] };
    sel.forEach(function (m) { var c = dayOf(m.id, date)[i]; groups[c ? c.st : 'none'].push({ m: m, c: c }); });
    var ok = sel.filter(function (m) { return isOk(dayOf(m.id, date)[i]); });
    var body = h('div.cell-detail');
    ['free', 'maybe', 'busy', 'none'].forEach(function (k) {
      if (!groups[k].length) return;
      body.appendChild(h('div.cd-sec', h('div.cd-t.s-' + k, h('i'), ST[k], h('span.muted', ' (' + groups[k].length + ')')),
        h('div.cd-list', groups[k].map(function (x) {
          return h('span.cd-p', U.avatar(x.m, 22), x.m.name, x.c && x.c.lb && showLb(x.m) ? h('em', x.c.lb) : null);
        }))));
    });
    var s = i * SLOT, m = U.modal({
      title: U.fmtDate(date, true) + ' · ' + Sched.minToStr(s),
      body: body,
      actions: [h('button.btn.ghost', { onclick: function () { m.close(); } }, 'Đóng'),
        h('button.btn.primary', { disabled: !ok.length, onclick: function () { m.close(); A.newPlan({ date: date, s: s, e: Math.min(1440, s + 120), members: ok.map(function (x) { return x.id; }) }); } }, U.icon('chat', 16), 'Rủ ' + ok.length + ' người đang đi được')]
    });
  }

  /* ---------- Giờ chung ---------- */
  function drawFinder() {
    var el = U.clear(G.finder), sel = selected(), f = G.f;
    el.appendChild(h('div.rules-head', h('h3', 'Giờ chung gợi ý'),
      h('div.seg.sm', [7, 14, 30].map(function (n) { return h('button' + (f.finderDays === n ? '.on' : ''), { onclick: function () { f.finderDays = n; saveF(); drawFinder(); } }, n + ' ngày tới'); }))));
    if (sel.length < 1) { el.appendChild(h('p.empty', 'Hãy chọn người ở phần "Lọc".')); return; }
    var need = needN(sel.length), now = new Date(), today = U.today(), nowMin = now.getHours() * 60 + now.getMinutes();
    el.appendChild(h('p.muted.sm', 'Khung giờ mà ' + (need === sel.length ? 'cả ' + sel.length + ' người' : 'ít nhất ' + need + '/' + sel.length + ' người') + ' đi được (' + MODE_NAMES[f.calc].toLowerCase() + '), kéo dài từ ' + (f.minDur < 60 ? f.minDur + ' phút' : f.minDur / 60 + ' giờ') + ', trong ' + f.fromH + 'h–' + f.toH + 'h.'));
    var wins = Sched.findWindows({
      members: sel.map(function (m) { return m.id; }), schedOf: function (id) { return A.sc(id); }, from: today, days: f.finderDays, mode: f.calc,
      fromMin: f.fromH * 60, toMin: f.toH * 60, weekdays: f.weekdays, minDur: f.minDur, minPeople: need
    }).map(function (w) { if (w.date === today && w.s < nowMin) { w.s = Math.ceil(nowMin / 15) * 15; } return w; })
      .filter(function (w) { return w.e - w.s >= f.minDur; });
    if (!wins.length) {
      var empty = sel.filter(function (m) { return !Object.keys(A.sc(m.id)).length; });
      el.appendChild(h('p.empty', 'Chưa tìm thấy khung giờ nào hợp.' + (empty.length ? ' Chưa đánh dấu lịch: ' + empty.map(function (m) { return m.name; }).join(', ') + '.' : ' Thử nới "Tính là đi được khi" hoặc giảm số người cần có mặt.')));
      return;
    }
    var byDate = {}; wins.forEach(function (w) { (byDate[w.date] = byDate[w.date] || []).push(w); });
    var shown = 0, list = h('div.win-days');
    Object.keys(byDate).sort().forEach(function (d) {
      if (shown >= 40) return;
      var rows = byDate[d].map(function (w) {
        shown++;
        var miss = sel.filter(function (m) { return w.who.indexOf(m.id) < 0; });
        return h('div.win',
          h('div.wt', h('b', U.range(w.s, w.e)), h('span.muted.sm', Math.round((w.e - w.s) / 6) / 10 + ' giờ')),
          h('div.wp', w.who.map(function (id) { return U.avatar(A.members[id] && Object.assign({ id: id }, A.members[id]), 24); }), miss.length ? h('span.muted.sm', 'vắng: ' + miss.map(function (m) { return m.name; }).join(', ')) : null),
          h('button.btn.sm.primary', { onclick: function () { A.newPlan({ date: w.date, s: w.s, e: Math.min(w.e, w.s + 180), members: w.who.slice(), win: w }); } }, 'Rủ'));
      });
      list.appendChild(h('div.win-day', h('div.wd', h('b', U.fmtDate(d, true)), d === today ? h('span.tag', 'hôm nay') : null, h('button.link', { onclick: function () { G.date = d; f.mode = 'day'; saveF(); drawHead(); drawMain(); G.el.scrollTo({ top: 0, behavior: 'smooth' }); } }, 'xem ngày này')), rows));
    });
    el.appendChild(list);
  }

  Views.group = G;
})(window);
