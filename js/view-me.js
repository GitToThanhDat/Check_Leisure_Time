/* view-me.js - Lịch của tôi: lưới tuần kéo để tô, sửa block, thói quen lặp lại */
(function (root) {
  'use strict';
  var h = U.h, $ = U.$, SLOT = Sched.SLOT, ROW = 28;
  var ST = { free: 'Rảnh', busy: 'Bận', maybe: 'Có thể' };
  var Me = {
    anchor: null, span: null, drag: null, grid: null, rulesEl: null, headEl: null,
    presets: [
      { ic: '😴', name: 'Giờ ngủ', r: { d: 127, s: 23 * 60, e: 7 * 60, st: 'busy', lb: 'Ngủ' } },
      { ic: '🎓', name: 'Giờ học', r: { d: 31, s: 7 * 60, e: 11 * 60 + 45, st: 'busy', lb: 'Đi học' } },
      { ic: '💼', name: 'Đi làm', r: { d: 31, s: 9 * 60, e: 17 * 60, st: 'busy', lb: 'Đi làm' } },
      { ic: '🍜', name: 'Ăn trưa', r: { d: 127, s: 11 * 60 + 30, e: 13 * 60, st: 'busy', lb: 'Ăn trưa' } },
      { ic: '🌙', name: 'Tối rảnh', r: { d: 127, s: 19 * 60, e: 22 * 60, st: 'free', lb: '' } },
      { ic: '🛋️', name: 'Cuối tuần rảnh', r: { d: 96, s: 8 * 60, e: 22 * 60, st: 'free', lb: '' } }
    ]
  };

  function span() { return Me.span || (Me.span = U.lsGet('rc_span', innerWidth < 640 ? 3 : 7)); }
  function days() {
    var s = span(), a = Me.anchor || (Me.anchor = s === 7 ? Sched.startOfWeek(U.today()) : U.today());
    if (s === 7) a = Me.anchor = Sched.startOfWeek(a);
    var out = []; for (var i = 0; i < s; i++) out.push(Sched.addDays(a, i)); return out;
  }
  function daysText(mask) {
    if (mask === 127) return 'Hàng ngày'; if (mask === 31) return 'T2–T6'; if (mask === 96) return 'Cuối tuần';
    return Sched.daysFromMask(mask).map(function (i) { return U.DN[i]; }).join(' ');
  }

  /* ---------- Ghi dữ liệu ---------- */
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  /** Áp nhiều thao tác tô lên bản sao rồi ghi các ngày bị đổi. ops: [{date,s,e,st,lb}] ; remove:[{date,id}] */
  function applyOps(ops, remove) {
    var work = { rec: clone(A.sc(A.me.id).rec), one: clone(A.sc(A.me.id).one) || {} }, touched = {};
    (remove || []).forEach(function (r) { if (work.one[r.date]) { delete work.one[r.date][r.id]; touched[r.date] = 1; } });
    ops.forEach(function (o) {
      work.one[o.date] = Sched.paintDay(work, o.date, o.s, o.e, o.st, o.lb); touched[o.date] = 1;
      if (work.one[o.date] == null) delete work.one[o.date];
    });
    var up = {}; Object.keys(touched).forEach(function (d) { var v = work.one[d]; up['one/' + d] = v && Object.keys(v).length ? v : null; });
    return A.writeSched(up);
  }
  function splitOvernight(date, s, e, st, lb) {
    if (e > s) return [{ date: date, s: s, e: e, st: st, lb: lb }];
    var o = [{ date: date, s: s, e: 1440, st: st, lb: lb }]; if (e > 0) o.push({ date: Sched.addDays(date, 1), s: 0, e: e, st: st, lb: lb }); return o;
  }
  Me.paint = function (date, s, e, brush, label) {
    return applyOps([{ date: date, s: s, e: e, st: brush, lb: label || '' }]);
  };

  /* ---------- Render ---------- */
  Me.render = function (el) {
    var ds = days();
    Me.headEl = h('div.me-head'); Me.grid = h('div.wk-wrap'); Me.rulesEl = h('div.card.glass.rules');
    el.appendChild(h('div.me',
      h('div.card.glass.me-card', Me.headEl, Me.grid),
      Me.rulesEl));
    Me.drawHead(); Me.drawGrid(); Me.drawRules();
    var sc = $('.wk-scroll', Me.grid); if (sc) sc.scrollTop = Math.max(0, 7 * 2 * ROW - 8);
  };
  Me.update = function (kinds) {
    if (Me.drag && Me.drag.started) return;
    if (kinds.sched || kinds.members) { var st = $('.wk-scroll', Me.grid), top = st ? st.scrollTop : 0; Me.drawGrid(); Me.drawRules(); st = $('.wk-scroll', Me.grid); if (st) st.scrollTop = top; }
  };

  Me.drawHead = function () {
    var ds = days(), s = span(), el = U.clear(Me.headEl);
    function nav(dir) { Me.anchor = Sched.addDays(Me.anchor, dir * s); Me.drawHead(); Me.drawGrid(); }
    var brushes = ['free', 'busy', 'maybe', 'erase'].map(function (b) {
      return h('button.brush.b-' + b + (A.pf.brush === b ? '.on' : ''), { onclick: function () { A.pf.brush = b; A.savePf(); Me.drawHead(); } },
        h('i'), b === 'erase' ? 'Xoá' : ST[b]);
    });
    el.appendChild(h('div.me-nav',
      h('div.row', h('button.icon-btn', { onclick: function () { nav(-1); }, title: 'Trước' }, U.icon('left')),
        h('button.btn.sm', { onclick: function () { Me.anchor = null; Me.drawHead(); Me.drawGrid(); } }, 'Hôm nay'),
        h('button.icon-btn', { onclick: function () { nav(1); }, title: 'Sau' }, U.icon('right')),
        h('b.range', U.fmtDay(ds[0]) + ' – ' + U.fmtDay(ds[ds.length - 1]))),
      h('div.seg.sm', [3, 7].map(function (n) {
        return h('button' + (s === n ? '.on' : ''), { onclick: function () { Me.span = n; U.lsSet('rc_span', n); Me.anchor = null; Me.drawHead(); Me.drawGrid(); } }, n + ' ngày');
      }))));
    el.appendChild(h('div.brushes', h('span.muted.sm', 'Kéo để tô:'), brushes));
    el.appendChild(h('p.hint', 'Kéo trên lịch để tô bằng màu đã chọn. Chạm một lần để sửa chi tiết hoặc đặt tên. Trên điện thoại: giữ ngón tay một chút rồi kéo.'));
  };

  Me.drawGrid = function () {
    var ds = days(), sc = A.sc(A.me.id), today = U.today(), wrap = U.clear(Me.grid);
    var cols = '44px repeat(' + ds.length + ', minmax(0,1fr))';
    var head = h('div.wk-row.wk-head', { style: { gridTemplateColumns: cols } }, h('div.corner'),
      ds.map(function (d) { var w = Sched.dow(d); return h('div.dh' + (d === today ? '.today' : '') + (w > 4 ? '.we' : ''), h('span', U.DN[w]), h('b', Sched.parseDate(d).getDate())); }));
    var gut = h('div.gut'); for (var i = 0; i < 48; i++) gut.appendChild(h('div.gl', i % 2 === 0 ? (i / 2) + 'h' : ''));
    var body = h('div.wk-row.wk-body', { style: { gridTemplateColumns: cols } }, gut);
    ds.forEach(function (d, ci) {
      var res = Sched.resolveDay(sc, d), col = h('div.col' + (d === today ? '.today' : ''), { dataset: { d: d, c: ci } }), keyOf = function (c) { return c ? c.st + '|' + c.src + '|' + c.id : ''; };
      for (var i = 0; i < 48; i++) {
        var c = res[i], k = keyOf(c), cls = 'cell';
        if (c) { cls += ' st-' + c.st + (c.src === 'rec' ? ' rec' : ''); if (keyOf(res[i - 1]) !== k) cls += ' rs'; if (keyOf(res[i + 1]) !== k) cls += ' re'; }
        var cell = h('div', { class: cls, dataset: { i: i } });
        if (c && keyOf(res[i - 1]) !== k && c.lb) cell.appendChild(h('span.cl', c.lb));
        col.appendChild(cell);
      }
      if (d === today) { var n = new Date(), nm = n.getHours() * 60 + n.getMinutes(); col.appendChild(h('div.nowline', { style: { top: (nm / SLOT * ROW) + 'px' } })); }
      body.appendChild(col);
    });
    wrap.appendChild(h('div.wk-scroll', head, body));
    var bodyEl = body;
    bodyEl.addEventListener('pointerdown', onDown);
    bodyEl.addEventListener('touchmove', function (e) { if (Me.drag && Me.drag.started) e.preventDefault(); }, { passive: false });
    bodyEl.addEventListener('contextmenu', function (e) { if (Me.drag) e.preventDefault(); });
  };

  /* ---------- Kéo để tô ---------- */
  function cellAt(x, y) { var el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('.cell') : null; }
  function onDown(e) {
    if (e.button > 0) return; var cell = e.target.closest('.cell'); if (!cell) return;
    var col = cell.parentNode, touch = e.pointerType === 'touch';
    var d = Me.drag = { col: col, date: col.dataset.d, i0: +cell.dataset.i, i1: +cell.dataset.i, moved: false, started: !touch, x: e.clientX, y: e.clientY, touch: touch };
    if (touch) d.timer = setTimeout(function () { d.started = true; if (navigator.vibrate) navigator.vibrate(12); preview(); }, 230);
    else { preview(); e.preventDefault(); }
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onCancel);
  }
  function onMove(e) {
    var d = Me.drag; if (!d) return;
    if (!d.started) { if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 9) onCancel(); return; }
    var c = cellAt(e.clientX, e.clientY);
    if (c && c.parentNode === d.col) { var i = +c.dataset.i; if (i !== d.i1) { d.i1 = i; d.moved = true; preview(); } }
  }
  function preview() {
    var d = Me.drag; if (!d) return; var a = Math.min(d.i0, d.i1), b = Math.max(d.i0, d.i1);
    U.$$('.cell', d.col).forEach(function (c) { var i = +c.dataset.i; c.classList.toggle('pv', i >= a && i <= b); });
    d.col.dataset.brush = A.pf.brush;
  }
  function end() {
    var d = Me.drag; if (d && d.timer) clearTimeout(d.timer);
    window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onCancel);
    if (d) U.$$('.pv', d.col).forEach(function (c) { c.classList.remove('pv'); });
    Me.drag = null; return d;
  }
  function onCancel() { end(); }
  function onUp() {
    var d = end(); if (!d) return;
    if (d.started && d.moved) {
      var a = Math.min(d.i0, d.i1), b = Math.max(d.i0, d.i1);
      Me.paint(d.date, a * SLOT, (b + 1) * SLOT, A.pf.brush);
    } else if (d.started || d.touch) Me.clickCell(d.date, d.i0);
  }

  Me.clickCell = function (date, i) {
    var c = Sched.resolveDay(A.sc(A.me.id), date)[i];
    if (c && c.src === 'one') {
      var b = A.sc(A.me.id).one[date][c.id]; Me.blockEditor({ date: date, id: c.id, block: b });
    } else if (c && c.src === 'rec') {
      Me.ruleEditor({ id: c.id, rule: A.sc(A.me.id).rec[c.id], date: date, slot: i });
    } else {
      var s = i * SLOT; Me.blockEditor({ date: date, block: { s: s, e: Math.min(1440, s + 60), st: A.pf.brush === 'erase' ? 'free' : A.pf.brush, lb: '' } });
    }
  };

  /* ---------- Trình sửa block / thói quen ---------- */
  function timeInput(min) { return h('input.inp.tm', { type: 'time', step: 900, value: Sched.minToStr(min === 1440 ? 0 : min) }); }
  function readTime(inp, fallback) { var m = Sched.strToMin(inp.value); return isNaN(m) ? fallback : m; }
  function statusSeg(cur, onchg) {
    var wrap = h('div.seg'), st = cur;
    function draw() { U.clear(wrap); ['free', 'busy', 'maybe'].forEach(function (k) { wrap.appendChild(h('button.s-' + k + (st === k ? '.on' : ''), { type: 'button', onclick: function () { st = k; draw(); if (onchg) onchg(k); } }, ST[k])); }); }
    draw(); return { el: wrap, get: function () { return st; } };
  }
  function dayChips(mask) {
    var m = mask, wrap = h('div.chips');
    function draw() {
      U.clear(wrap);
      U.DN.forEach(function (n, i) { wrap.appendChild(h('button.chip' + (Sched.maskHas(m, i) ? '.on' : ''), { type: 'button', onclick: function () { m ^= 1 << i; draw(); } }, n)); });
      [['Hàng ngày', 127], ['T2–T6', 31], ['Cuối tuần', 96]].forEach(function (q) { wrap.appendChild(h('button.chip.ghost' + (m === q[1] ? '.on' : ''), { type: 'button', onclick: function () { m = q[1]; draw(); } }, q[0])); });
    }
    draw(); return { el: wrap, get: function () { return m; } };
  }

  /** Sửa/tạo một block đơn (một ngày) — có thể chuyển thành lặp lại */
  Me.blockEditor = function (o) {
    var b = o.block, isNew = !o.id, seg = statusSeg(b.st), lb = h('input.inp', { placeholder: 'Tên (không bắt buộc), vd: Họp nhóm', maxLength: 50, value: b.lb || '' });
    var dt = h('input.inp', { type: 'date', value: o.date }), t1 = timeInput(b.s), t2 = timeInput(b.e);
    var rep = false, repBox = h('div.repbox'), chips = dayChips(1 << Sched.dow(o.date));
    var from = h('input.inp', { type: 'date' }), to = h('input.inp', { type: 'date' });
    var tog = h('label.chk', h('input', { type: 'checkbox', onchange: function (e) { rep = e.target.checked; repBox.style.display = rep ? '' : 'none'; } }), h('span', 'Lặp lại hàng tuần'));
    repBox.style.display = 'none';
    repBox.appendChild(h('div.fld', h('span', 'Các thứ trong tuần'), chips.el));
    repBox.appendChild(h('div.grid2', h('label.fld', h('span', 'Từ ngày (tuỳ chọn)'), from), h('label.fld', h('span', 'Đến ngày (tuỳ chọn)'), to)));
    var actions = [];
    if (!isNew) actions.push(h('button.btn.danger', { onclick: function () { applyOps([], [{ date: o.date, id: o.id }]); m.close(); } }, U.icon('trash', 16), 'Xoá'));
    actions.push(h('button.btn.ghost', { onclick: function () { m.close(); } }, 'Huỷ'));
    actions.push(h('button.btn.primary', { onclick: save }, 'Lưu'));
    var m = U.modal({
      title: isNew ? 'Thêm khung giờ' : 'Sửa khung giờ',
      body: h('div.form', seg.el, h('label.fld', h('span', 'Tên'), lb),
        h('div.grid3', h('label.fld', h('span', 'Ngày'), dt), h('label.fld', h('span', 'Từ'), t1), h('label.fld', h('span', 'Đến'), t2)),
        h('p.muted.sm', 'Nếu giờ kết thúc nhỏ hơn giờ bắt đầu (vd 22:00 → 02:00) thì tính là qua đêm.'),
        isNew || true ? tog : null, repBox),
      actions: actions
    });
    function save() {
      var s = readTime(t1, b.s), e = readTime(t2, b.e), date = dt.value || o.date;
      if (s === e) { U.toast('Giờ bắt đầu và kết thúc đang trùng nhau', { kind: 'err' }); return; }
      if (rep) {
        var mask = chips.get(); if (!mask) { U.toast('Chọn ít nhất một thứ trong tuần', { kind: 'err' }); return; }
        var rule = { d: mask, s: s, e: e, st: seg.get(), lb: lb.value.trim() }; if (from.value) rule.from = from.value; if (to.value) rule.to = to.value;
        var up = {}; up['rec/' + A.store.newKey(A.path('sched/' + A.me.id + '/rec'))] = rule; A.writeSched(up);
        if (!isNew) applyOps([], [{ date: o.date, id: o.id }]);
      } else {
        applyOps(splitOvernight(date, s, e, seg.get(), lb.value.trim()), isNew ? [] : [{ date: o.date, id: o.id }]);
      }
      m.close();
    }
  };

  /** Sửa/tạo thói quen lặp lại. o: {id?, rule, date?, slot?} */
  Me.ruleEditor = function (o) {
    var r = o.rule, isNew = !o.id, seg = statusSeg(r.st), lb = h('input.inp', { placeholder: 'Tên (vd: Ngủ, Đi học)', maxLength: 50, value: r.lb || '' });
    var chips = dayChips(r.d), t1 = timeInput(r.s), t2 = timeInput(r.e);
    var from = h('input.inp', { type: 'date', value: r.from || '' }), to = h('input.inp', { type: 'date', value: r.to || '' });
    var actions = [];
    if (!isNew) actions.push(h('button.btn.danger', { onclick: function () { U.confirm('Xoá thói quen này?', 'Thói quen "' + (r.lb || ST[r.st]) + '" sẽ bị xoá khỏi mọi tuần.', 'Xoá', true).then(function (ok) { if (ok) { A.writeSched({ ['rec/' + o.id]: null }); m.close(); } }); } }, U.icon('trash', 16), 'Xoá'));
    actions.push(h('button.btn.ghost', { onclick: function () { m.close(); } }, 'Huỷ'));
    actions.push(h('button.btn.primary', { onclick: save }, 'Lưu'));
    var only = null;
    if (o.date && !isNew) {
      var over = r.e <= r.s, dateIsStart = Sched.maskHas(r.d, Sched.dow(o.date));
      var s = dateIsStart ? r.s : 0, e = dateIsStart ? (over ? 1440 : r.e) : r.e;
      if (o.slot != null && !(o.slot * SLOT >= s && o.slot * SLOT < e)) { s = 0; e = r.e; }
      only = h('div.fld.only', h('span', 'Chỉ riêng ' + U.fmtDate(o.date, true) + ' (' + U.range(s, e) + ') đổi thành:'),
        h('div.chips', ['free', 'busy', 'maybe', 'erase'].map(function (k) {
          return h('button.chip.s-' + k, { type: 'button', onclick: function () { applyOps([{ date: o.date, s: s, e: e, st: k, lb: '' }]); m.close(); } }, k === 'erase' ? 'Bỏ trống' : ST[k]);
        })));
    }
    var m = U.modal({
      title: isNew ? 'Thói quen lặp lại hàng tuần' : 'Sửa thói quen',
      body: h('div.form', seg.el, h('label.fld', h('span', 'Tên'), lb),
        h('div.fld', h('span', 'Các thứ trong tuần'), chips.el),
        h('div.grid2', h('label.fld', h('span', 'Từ giờ'), t1), h('label.fld', h('span', 'Đến giờ'), t2)),
        h('p.muted.sm', 'Qua đêm được: ví dụ ngủ 23:00 → 07:00 hôm sau.'),
        h('div.grid2', h('label.fld', h('span', 'Áp dụng từ ngày (tuỳ chọn)'), from), h('label.fld', h('span', 'Đến ngày (tuỳ chọn)'), to)),
        only),
      actions: actions
    });
    function save() {
      var mask = chips.get(), s = readTime(t1, r.s), e = readTime(t2, r.e);
      if (!mask) { U.toast('Chọn ít nhất một thứ trong tuần', { kind: 'err' }); return; }
      if (s === e) { U.toast('Giờ bắt đầu và kết thúc đang trùng nhau', { kind: 'err' }); return; }
      var rule = { d: mask, s: s, e: e, st: seg.get(), lb: lb.value.trim() }; if (from.value) rule.from = from.value; if (to.value) rule.to = to.value;
      if (r.src) rule.src = r.src;
      var id = o.id || A.store.newKey(A.path('sched/' + A.me.id + '/rec'));
      A.writeSched({ ['rec/' + id]: rule }); m.close();
    }
  };

  /* ---------- Danh sách thói quen ---------- */
  Me.drawRules = function () {
    var el = U.clear(Me.rulesEl), sc = A.sc(A.me.id), list = Sched.objVals(sc.rec).sort(function (a, b) { return a.v.s - b.v.s; });
    el.appendChild(h('div.rules-head', h('h3', 'Thói quen lặp lại'),
      h('div.row', h('button.btn.sm', { onclick: function () { Imp.open(); } }, U.icon('upload', 16), 'Nhập từ ảnh lịch (AI)'),
        h('button.btn.sm.primary', { onclick: function () { Me.ruleEditor({ rule: { d: 127, s: 9 * 60, e: 10 * 60, st: 'busy', lb: '' } }); } }, U.icon('plus', 16), 'Thêm'))));
    el.appendChild(h('p.muted.sm', 'Đặt một lần là lặp lại mỗi tuần, ví dụ giờ ngủ hay giờ học. Việc cụ thể từng ngày sẽ đè lên thói quen.'));
    el.appendChild(h('div.presets', Me.presets.map(function (p) {
      return h('button.preset', { onclick: function () { Me.ruleEditor({ rule: Object.assign({}, p.r) }); } }, h('span', p.ic), p.name);
    })));
    if (!list.length) el.appendChild(h('p.empty', 'Bạn chưa có thói quen nào. Chọn nhanh một mẫu ở trên, ví dụ "Giờ ngủ".'));
    el.appendChild(h('div.rule-list', list.map(function (x) {
      var r = x.v;
      return h('button.rule.s-' + r.st, { onclick: function () { Me.ruleEditor({ id: x.id, rule: r }); } },
        h('i'), h('div.rt', h('b', r.lb || ST[r.st]), h('span.muted', daysText(r.d) + ' · ' + U.range(r.s, r.e) + (r.from || r.to ? ' · ' + (r.from ? U.fmtDay(r.from) : '…') + '→' + (r.to ? U.fmtDay(r.to) : '…') : ''))),
        h('span.tagst', ST[r.st]));
    })));
  };

  Views.me = Me;
})(window);
