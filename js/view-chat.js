/* view-chat.js - Chat nhóm, tag @, kèo hẹn (nhóm có giờ giấc + RSVP), thông báo khi bị tag */
(function (root) {
  'use strict';
  var h = U.h, $ = U.$;
  var C = { unsub: null, msgs: {}, cid: null, root: null, stick: true };
  var ST = { free: 'Rảnh', busy: 'Bận', maybe: 'Có thể', none: 'Chưa đánh dấu' };

  function visible() {
    return Object.keys(A.channels).filter(function (id) { return A.canSee(A.channels[id]); }).map(function (id) { return Object.assign({ id: id }, A.channels[id]); })
      .sort(function (a, b) { if (a.id === 'general') return -1; if (b.id === 'general') return 1; return ((b.last && b.last.ts) || b.ts || 0) - ((a.last && a.last.ts) || a.ts || 0); });
  }
  function chMembers(c) { return c.kind === 'room' ? A.memberList() : A.memberList().filter(function (m) { return c.members && c.members[m.id]; }); }
  function cur() { return C.cid && A.channels[C.cid] ? Object.assign({ id: C.cid }, A.channels[C.cid]) : null; }
  function planText(p) { return U.fmtDate(p.date) + ' · ' + U.range(p.s, p.e) + (p.place ? ' · ' + p.place : ''); }
  function snip(t, n, cid) { t = String(t || '').replace(/@\{([^}]+)\}/g, function (_, id) { return '@' + A.dn(id, cid); }); return t.length > (n || 60) ? t.slice(0, n || 60) + '…' : t; }

  /* ---------- Khung ---------- */
  C.render = function (el) {
    var vis = visible();
    if (A.chatSel && !vis.some(function (c) { return c.id === A.chatSel; })) A.chatSel = null;
    if (!A.chatSel && innerWidth >= 900 && vis.length) A.chatSel = vis[0].id;
    C.root = h('div.chat' + (A.chatSel ? '.has-sel' : ''));
    C.listEl = h('div.ch-list.card.glass'); C.threadEl = h('div.ch-thread.card.glass');
    C.root.appendChild(C.listEl); C.root.appendChild(C.threadEl); el.appendChild(C.root);
    drawList(); C.open(A.chatSel, true);
  };
  C.leave = function () { stopMsgs(); };
  C.update = function (kinds) {
    if (!C.root) return;
    if (kinds.channels || kinds.members) { drawList(); if (C.cid) { if (!cur()) { C.cid = null; A.chatSel = null; stopMsgs(); C.root.classList.remove('has-sel'); drawThreadEmpty(); } else { drawHead(); drawPlan(); var sig = JSON.stringify(cur().nick || {}); if (kinds.members || sig !== C._sig) { C._sig = sig; drawMsgs(); } } } }
  };
  function stopMsgs() { if (C.unsub) { C.unsub(); C.unsub = null; } C.msgs = {}; }

  function drawList() {
    var el = U.clear(C.listEl), vis = visible(), seen = U.lsGet('rc_seen_' + A.room.id, {});
    el.appendChild(h('div.ch-top', h('h3', 'Chat & kèo hẹn'), h('button.btn.sm.primary', { onclick: function () { C.newModal({}); } }, U.icon('plus', 16), 'Tạo nhóm')));
    var list = h('div.ch-items');
    vis.forEach(function (c) {
      var un = c.last && c.last.by !== A.me.id && c.last.ts > (seen[c.id] || 0) && C.cid !== c.id;
      var mem = chMembers(c), by = c.last && c.last.by;
      list.appendChild(h('button.ch-item' + (C.cid === c.id ? '.on' : '') + (un ? '.unread' : ''), { onclick: function () { C.open(c.id); } },
        h('div.ch-ic' + (c.kind === 'plan' ? '.plan' : ''), c.kind === 'room' ? U.icon('users', 20) : c.kind === 'plan' ? U.icon('cal', 20) : U.icon('chat', 20)),
        h('div.ch-tx', h('div.ch-t', h('b', c.title), c.last ? h('small.muted', U.fmtTime(c.last.ts)) : null),
          c.plan ? h('div.ch-plan', planText(c.plan)) : null,
          h('div.ch-last.muted', c.last ? (by ? A.dn(by, c.id) + ': ' : '') + snip(c.last.txt, 48, c.id) : (c.kind === 'room' ? mem.length + ' thành viên' : 'Chưa có tin nhắn'))),
        un ? h('i.udot') : null));
    });
    el.appendChild(list);
  }
  function drawThreadEmpty() { U.clear(C.threadEl).appendChild(h('div.empty.big', U.icon('chat', 40), h('p', 'Chọn một cuộc trò chuyện hoặc tạo nhóm mới.'))); }

  C.open = function (cid, silent) {
    stopMsgs(); C.cid = cid; A.chatSel = cid;
    if (!C.root) return;
    C.root.classList.toggle('has-sel', !!cid);
    if (!cid || !cur()) { drawThreadEmpty(); return; }
    U.clear(C.threadEl);
    C.headEl = h('div.th-head'); C.planEl = h('div.th-plan'); C.msgEl = h('div.msgs'); C.compEl = h('div.composer');
    C.threadEl.appendChild(C.headEl); C.threadEl.appendChild(C.planEl); C.threadEl.appendChild(C.msgEl); C.threadEl.appendChild(C.compEl);
    drawHead(); drawPlan(); drawComposer(); C.stick = true; C._sig = JSON.stringify(cur().nick || {});
    C.unsub = A.store.listen(A.path('chats/' + cid), function (v) {
      C.msgs = v || {}; drawMsgs(); A.markSeen(cid); A.markChannelNotifsRead(cid);
    }, { limitLast: 200 });
    A.markSeen(cid); A.markChannelNotifsRead(cid); drawList();
  };

  function drawHead() {
    var c = cur(), el = U.clear(C.headEl); if (!c) return; var mem = chMembers(c);
    el.appendChild(h('button.icon-btn.back', { onclick: function () { stopMsgs(); C.cid = null; A.chatSel = null; C.root.classList.remove('has-sel'); drawList(); } }, U.icon('back')));
    el.appendChild(h('div.th-title', h('b', c.title), h('span.muted.sm', c.kind === 'room' ? 'Cả phòng · ' + mem.length + ' người' : mem.length + ' người')));
    el.appendChild(h('div.th-av', mem.slice(0, 5).map(function (m) { return U.avatar(m, 26); }), mem.length > 5 ? h('span.muted.sm', '+' + (mem.length - 5)) : null));
    el.appendChild(h('button.icon-btn', { title: 'Thông tin nhóm', onclick: function () { C.info(); } }, U.icon('edit')));
  }

  /* ---------- Thẻ kèo hẹn + RSVP ---------- */
  function drawPlan() {
    var c = cur(), el = U.clear(C.planEl); if (!c || !c.plan) { C.planEl.style.display = 'none'; return; } C.planEl.style.display = '';
    var p = c.plan, rs = c.rsvp || {}, mine = rs[A.me.id], mem = chMembers(c);
    var opts = [['yes', 'Tham gia', 's-free'], ['maybe', 'Chưa chắc', 's-maybe'], ['no', 'Không đi', 's-busy']];
    function names(k) { return mem.filter(function (m) { return rs[m.id] === k; }); }
    el.appendChild(h('div.plan-card',
      h('div.pc-top', h('span.pc-ic', U.icon('cal', 20)), h('div', h('b', U.fmtDate(p.date, true) + ' · ' + U.range(p.s, p.e)), p.place ? h('div.muted.sm', U.icon('pin', 14), ' ' + p.place) : null, p.note ? h('div.muted.sm', p.note) : null)),
      h('div.seg.sm.rsvp', opts.map(function (o) {
        return h('button.' + o[2] + (mine === o[0] ? '.on' : ''), { onclick: function () { A.store.set(A.path('channels/' + c.id + '/rsvp/' + A.me.id), mine === o[0] ? null : o[0]); } }, o[1] + ' (' + names(o[0]).length + ')');
      })),
      h('div.rs-list', opts.map(function (o) { var n = names(o[0]); return n.length ? h('span.rs-g', h('i.' + o[2]), n.map(function (m) { return A.dn(m.id, c.id); }).join(', ')) : null; })),
      mine === 'yes' ? h('button.btn.sm', { onclick: function () { Views.me.paint(p.date, p.s, p.e, 'busy', c.title).then(function () { U.toast('Đã đánh dấu Bận trong lịch của bạn'); }); } }, U.icon('check', 16), 'Đánh dấu Bận trong lịch của tôi') : null));
  }

  /* ---------- Tin nhắn ---------- */
  function renderText(t, cid) {
    var out = [], re = /@\{([^}]+)\}|@all\b/g, last = 0, m;
    while ((m = re.exec(t))) {
      if (m.index > last) out.push(t.slice(last, m.index));
      if (m[0] === '@all') out.push(h('span.mention.all', '@mọi người'));
      else out.push(h('span.mention' + (m[1] === A.me.id ? '.tome' : ''), '@' + A.dn(m[1], cid)));
      last = m.index + m[0].length;
    }
    if (last < t.length) out.push(t.slice(last));
    return out;
  }
  function drawMsgs() {
    var el = C.msgEl; if (!el) return;
    var near = el.scrollHeight - el.scrollTop - el.clientHeight < 80 || C.stick; U.clear(el);
    var arr = Sched.objVals(C.msgs).sort(function (a, b) { return a.v.ts - b.v.ts || (a.id < b.id ? -1 : 1); }), prev = null, prevDay = '';
    if (!arr.length) el.appendChild(h('p.empty', 'Chưa có tin nhắn. Gõ @ để tag bạn bè, họ sẽ nhận được thông báo.'));
    arr.forEach(function (x) {
      var m = x.v, u = A.members[m.by], cid = C.cid, mine = m.by === A.me.id, day = Sched.toDateStr(new Date(m.ts));
      if (day !== prevDay) { el.appendChild(h('div.daysep', day === U.today() ? 'Hôm nay' : U.fmtDate(day, true))); prevDay = day; prev = null; }
      var cont = prev && prev.by === m.by && m.ts - prev.ts < 180000;
      var tagged = (m.mn || []).indexOf(A.me.id) >= 0 || (m.mn || []).indexOf('all') >= 0;
      el.appendChild(h('div.msg' + (mine ? '.mine' : '') + (cont ? '.cont' : '') + (tagged && !mine ? '.tagged' : ''),
        mine ? null : (cont ? h('span.av-sp') : U.avatar(u, 30)),
        h('div.bub', !mine && !cont ? h('div.who', A.dn(m.by, cid)) : null, h('div.tx', renderText(m.txt || '', cid)), h('small.ts', Sched.minToStr(new Date(m.ts).getHours() * 60 + new Date(m.ts).getMinutes())))));
      prev = m;
    });
    if (near) el.scrollTop = el.scrollHeight; C.stick = false;
  }

  /* ---------- Soạn tin + @ ---------- */
  function esc(x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  /** Regex khớp @all và @tên/@biệt danh của những người trong kênh (tên dài trước) */
  function mentionRe(mem, cid, flags) {
    var names = ['all'];
    mem.forEach(function (m) { names.push(A.dn(m.id, cid)); if (m.name !== A.dn(m.id, cid)) names.push(m.name); });
    names = names.filter(function (x, i, a) { return x && a.indexOf(x) === i; }).sort(function (a, b) { return b.length - a.length; });
    return new RegExp('@(' + names.map(esc).join('|') + ')(?![\\p{L}\\p{N}_])', flags || 'giu');
  }
  function drawComposer() {
    var c = cur(), el = U.clear(C.compEl), ta = h('textarea', { rows: 1, placeholder: 'Nhắn gì đó… gõ @ để tag bạn bè', maxLength: 1000 }), pop = h('div.mpop'); pop.style.display = 'none';
    var mir = h('div.ta-mirror', { 'aria-hidden': 'true' }), wrap = h('div.ta-wrap', mir, ta);
    var coarse = root.matchMedia && matchMedia('(pointer: coarse)').matches, sel = 0, cands = [];
    function paintMirror() {
      var t = ta.value, mem = chMembers(c), re = mentionRe(mem, c.id), out = [], last = 0, m;
      while ((m = re.exec(t))) { if (m.index > last) out.push(t.slice(last, m.index)); out.push(h('span.mention.live', m[0])); last = m.index + m[0].length; }
      out.push(t.slice(last) + '​');   // ký tự rộng 0 giữ dòng cuối khi kết thúc bằng xuống dòng
      U.clear(mir); out.forEach(function (x) { mir.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); }); mir.scrollTop = ta.scrollTop;
    }
    function grow() { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; paintMirror(); }
    function token() { var pos = ta.selectionStart, m = /(^|\s)@([^\s@][^@\n]{0,23})?$/.exec(ta.value.slice(0, pos)); if (!m) return null; var q = m[2] || ''; return { q: q, start: pos - q.length - 1, pos: pos }; }   // cho phép tên/biệt danh có khoảng trắng
    function showPop() {
      var t = token(); if (!t) { pop.style.display = 'none'; return; }
      var q = U.norm(t.q), mem = chMembers(c).filter(function (m) { return m.id !== A.me.id; });
      cands = [{ all: true, name: 'all', label: 'Mọi người trong nhóm' }].concat(mem.map(function (m) { return { id: m.id, name: A.dn(m.id, c.id), real: m.name, m: m }; }))
        .filter(function (x) { return !q || U.norm(x.name).indexOf(q) >= 0 || (x.real && U.norm(x.real).indexOf(q) >= 0) || (x.all && 'moi nguoi'.indexOf(q) === 0); }).slice(0, 30);
      if (!cands.length) { pop.style.display = 'none'; return; }
      sel = Math.min(sel, cands.length - 1); U.clear(pop); pop.style.display = '';
      cands.forEach(function (x, i) {
        pop.appendChild(h('button.mi' + (i === sel ? '.on' : ''), { onmousedown: function (e) { e.preventDefault(); pick(x); } }, x.all ? h('span.av.allav', '@') : U.avatar(x.m, 26),
          x.all ? '@all · ' + x.label : h('span', x.name, x.real && x.real !== x.name ? h('small.muted', ' · ' + x.real) : null)));
      });
    }
    function pick(x) {
      var t = token(); if (!t) return; var ins = '@' + (x.all ? 'all' : x.name) + ' ';
      ta.value = ta.value.slice(0, t.start) + ins + ta.value.slice(t.pos); var p = t.start + ins.length; ta.setSelectionRange(p, p); pop.style.display = 'none'; ta.focus(); grow();
    }
    ta.addEventListener('input', function () { grow(); sel = 0; showPop(); });
    ta.addEventListener('scroll', function () { mir.scrollTop = ta.scrollTop; });
    ta.addEventListener('keyup', function (e) { if (['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].indexOf(e.key) < 0) showPop(); });
    ta.addEventListener('keydown', function (e) {
      if (pop.style.display !== 'none') {
        if (e.key === 'ArrowDown') { sel = (sel + 1) % cands.length; showPop(); e.preventDefault(); return; }
        if (e.key === 'ArrowUp') { sel = (sel - 1 + cands.length) % cands.length; showPop(); e.preventDefault(); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { pick(cands[sel]); e.preventDefault(); return; }
        if (e.key === 'Escape') { pop.style.display = 'none'; return; }
      }
      if (e.key === 'Enter' && !e.shiftKey && !coarse) { e.preventDefault(); send(); }
    });
    ta.addEventListener('blur', function () { setTimeout(function () { pop.style.display = 'none'; }, 150); });
    function send() { var t = ta.value.trim(); if (!t) return; ta.value = ''; grow(); pop.style.display = 'none'; C.send(c.id, t); }
    el.appendChild(pop);
    el.appendChild(h('div.comp-row', wrap, h('button.btn.primary.sendbtn', { onclick: send, title: 'Gửi' }, U.icon('send', 18))));
    paintMirror();
    if (!coarse) setTimeout(function () { ta.focus(); }, 80);
  }

  /** Chuyển @Tên / @Biệt danh thành @{id}; trả {text, ids} */
  C.parseMentions = function (text, mem, cid) {
    var ids = {}, byName = {};
    mem.forEach(function (m) { [A.dn(m.id, cid), m.name].forEach(function (n) { if (n && !byName[n.toLowerCase()]) byName[n.toLowerCase()] = m.id; }); });
    var out = text.replace(mentionRe(mem, cid), function (all, nm) {
      if (nm.toLowerCase() === 'all' && !byName.all) { ids.all = 1; return '@all'; }
      var id = byName[nm.toLowerCase()]; if (!id) return all; ids[id] = 1; return '@{' + id + '}';
    });
    return { text: out, ids: Object.keys(ids) };
  };
  C.send = function (cid, raw) {
    var c = A.channels[cid]; if (!c) return;
    var mem = chMembers(Object.assign({ id: cid }, c)), p = C.parseMentions(raw, mem, cid), id = A.store.newKey(A.path('chats/' + cid)), ts = A.store.now();
    var up = {}, memberIds = mem.map(function (m) { return m.id; });
    up[A.path('chats/' + cid + '/' + id)] = { by: A.me.id, txt: p.text, ts: ts, mn: p.ids };
    up[A.path('channels/' + cid + '/last')] = { by: A.me.id, txt: p.text.slice(0, 160), ts: ts };
    var targets = p.ids.indexOf('all') >= 0 ? memberIds : p.ids.filter(function (x) { return memberIds.indexOf(x) >= 0; });
    var all = p.ids.indexOf('all') >= 0;
    Object.assign(up, A.notifyUpdates(targets, { t: all ? 'all' : 'mention', ch: cid, txt: snip(p.text, 100, cid) }));
    C.stick = true;
    return A.store.update(up);
  };

  /* ---------- Thông tin nhóm + biệt danh ---------- */
  C.setNick = function (cid, m) {
    var ch = A.channels[cid], cur = (ch && ch.nick && ch.nick[m.id]) || '';
    return U.prompt('Biệt danh cho ' + m.name, 'Biệt danh trong cuộc trò chuyện này (để trống = dùng tên thật)', cur, { max: 24, ok: 'Lưu' }).then(function (v) {
      if (v == null) return;
      return A.store.set(A.path('channels/' + cid + '/nick/' + m.id), v || null).then(function () { U.toast(v ? 'Đã đặt biệt danh "' + v + '"' : 'Đã bỏ biệt danh'); }, function (e) { U.toast('Lỗi: ' + (e.message || e), { kind: 'err' }); });
    });
  };
  C.info = function () {
    var c = cur(); if (!c) return; var isRoom = c.kind === 'room', mine = c.by === A.me.id || A.isMod();
    var canTitle = !isRoom && (A.canRename() || mine);   // đổi tên nhóm: mọi thành viên, hoặc chỉ chủ/phó/người lập nhóm khi bật chế độ hạn chế
    var title = h('input.inp', { value: c.title, maxLength: 40, disabled: !canTitle });
    var sel = {}; chMembers(c).forEach(function (m) { sel[m.id] = 1; });
    var lock = {}; lock[A.me.id] = 1; if (isRoom || !mine) A.memberList().forEach(function (m) { lock[m.id] = 1; });
    var picker = U.memberPicker({ list: A.memberList(), sel: sel, lock: lock });
    var nq = '', nickList = h('div.scroll-box.mlist');
    function drawNicks() {
      U.clear(nickList); var cc = cur() || c;
      chMembers(cc).filter(function (m) { return !nq || U.norm(m.name + ' ' + A.dn(m.id, c.id)).indexOf(nq) >= 0; }).forEach(function (m) {
        var nk = A.dn(m.id, c.id); if (nk === m.name) nk = '';
        nickList.appendChild(h('button.mrow.nick-row', { onclick: function () { C.setNick(c.id, m).then(drawNicks); } }, U.avatar(m, 30),
          h('div.mi-n', h('b', nk || m.name), nk ? h('span.muted.sm', ' · ' + m.name) : null, m.id === A.me.id ? h('span.muted.sm', ' (bạn)') : null), U.icon('edit', 16)));
      });
    }
    drawNicks();
    var nickBox = h('div.fld', h('span', 'Biệt danh (chạm một người để đặt hoặc xoá)'), chMembers(c).length > 8 ? h('input.inp.sm', { placeholder: 'Tìm người…', oninput: function (e) { nq = U.norm(e.target.value); drawNicks(); } }) : null, nickList);
    var actions = [];
    if (!isRoom && mine) actions.push(h('button.btn.danger', { onclick: function () { U.confirm('Xoá nhóm này?', 'Toàn bộ tin nhắn trong "' + c.title + '" sẽ bị xoá.', 'Xoá', true).then(function (ok) { if (!ok) return; var o = {}; o[A.path('channels/' + c.id)] = null; o[A.path('chats/' + c.id)] = null; stopMsgs(); C.cid = null; A.chatSel = null; A.store.update(o); m.close(); C.root.classList.remove('has-sel'); drawThreadEmpty(); }); } }, U.icon('trash', 16), 'Xoá nhóm'));
    if (!isRoom && !mine) actions.push(h('button.btn.danger', { onclick: function () { A.store.set(A.path('channels/' + c.id + '/members/' + A.me.id), null); m.close(); } }, 'Rời nhóm'));
    actions.push(h('button.btn.ghost', { onclick: function () { m.close(); } }, isRoom ? 'Đóng' : 'Huỷ'));
    if (canTitle) actions.push(h('button.btn.primary', { onclick: save }, 'Lưu'));
    var m = U.modal({ title: 'Thông tin nhóm', wide: false, body: h('div.form', h('label.fld', h('span', 'Tên nhóm'), title), nickBox, isRoom ? null : h('div.fld', h('span', 'Thành viên'), picker.el)), actions: actions });
    function save() {
      var up = {}, old = c.members || {}, added = [];
      if (mine) {   // chỉ người lập nhóm / chủ / phó phòng mới sửa danh sách thành viên
        Object.keys(sel).forEach(function (id) { if (!old[id]) added.push(id); up[A.path('channels/' + c.id + '/members/' + id)] = true; });
        Object.keys(old).forEach(function (id) { if (!sel[id]) up[A.path('channels/' + c.id + '/members/' + id)] = null; });
      }
      if (title.value.trim() && title.value.trim() !== c.title) up[A.path('channels/' + c.id + '/title')] = title.value.trim();
      Object.assign(up, A.notifyUpdates(added, { t: 'invite', ch: c.id, txt: 'Bạn được thêm vào nhóm' }));
      A.store.update(up); m.close();
    }
  };

  /* ---------- Tạo nhóm / kèo ---------- */
  A.newPlan = function (pf) { A.go('chat'); C.newModal(pf || {}); };
  function worst(mid, date, s, e) {
    var res = Sched.resolveDay(A.sc(mid), date), rank = { free: 0, maybe: 1, none: 2, busy: 3 }, w = 'free', det = '';
    for (var i = Math.floor(s / 30); i < Math.ceil(e / 30) && i < 48; i++) { var c = res[i], k = c ? c.st : 'none'; if (rank[k] > rank[w]) { w = k; det = c && c.lb ? c.lb : ''; } }
    return { st: w, lb: det };
  }
  C.newModal = function (pf) {
    var hasPlan = !!pf.date, sel = {}; sel[A.me.id] = 1; (pf.members || []).forEach(function (id) { sel[id] = 1; });
    var title = h('input.inp', { placeholder: hasPlan ? 'Tên kèo, vd: Đi cà phê' : 'Tên nhóm, vd: Team đi Đà Lạt', maxLength: 40, value: pf.title || '' });
    var date = h('input.inp', { type: 'date', value: pf.date || U.today() }), t1 = h('input.inp', { type: 'time', step: 900, value: Sched.minToStr(pf.s != null ? pf.s : 19 * 60) }), t2 = h('input.inp', { type: 'time', step: 900, value: Sched.minToStr(pf.e != null ? pf.e : 21 * 60) });
    var place = h('input.inp', { placeholder: 'Địa điểm (tuỳ chọn)', maxLength: 60 }), note = h('input.inp', { placeholder: 'Ghi chú (tuỳ chọn)', maxLength: 100 });
    var planBox = h('div.planbox'), check = h('div.chk-list');
    var picker = U.memberPicker({ list: A.memberList(), sel: sel, lock: (function () { var l = {}; l[A.me.id] = 1; return l; })(), onChange: function () { drawCheck(); } });
    var tog = h('label.chk', h('input', { type: 'checkbox', checked: hasPlan, onchange: function (e) { hasPlan = e.target.checked; planBox.style.display = hasPlan ? '' : 'none'; title.placeholder = hasPlan ? 'Tên kèo, vd: Đi cà phê' : 'Tên nhóm'; drawCheck(); } }), h('span', 'Đây là kèo hẹn có ngày giờ'));
    planBox.appendChild(h('div.grid3', h('label.fld', h('span', 'Ngày'), date), h('label.fld', h('span', 'Từ'), t1), h('label.fld', h('span', 'Đến'), t2)));
    planBox.appendChild(h('div.grid2', h('label.fld', h('span', 'Ở đâu'), place), h('label.fld', h('span', 'Ghi chú'), note)));
    planBox.style.display = hasPlan ? '' : 'none';
    [date, t1, t2].forEach(function (i) { i.addEventListener('input', drawCheck); });
    function times() { var s = Sched.strToMin(t1.value), e = Sched.strToMin(t2.value); if (isNaN(s)) s = 19 * 60; if (isNaN(e) || e <= s) e = Math.min(1440, s + 60); return [s, e]; }
    function drawCheck() {
      U.clear(check); if (!hasPlan) return; var tm = times(), d = date.value || U.today();
      check.appendChild(h('div.muted.sm', 'Lịch của mọi người vào lúc này:'));
      check.appendChild(h('div.chips.scroll-box', A.memberList().filter(function (m) { return sel[m.id]; }).map(function (m) {
        var w = worst(m.id, d, tm[0], tm[1]);
        return h('span.cd-p.w-' + w.st, U.avatar(m, 20), m.name, h('em', ST[w.st] + (w.lb && (m.showLb !== false || m.id === A.me.id) ? ' · ' + w.lb : '')));
      })));
    }
    drawCheck();
    var m = U.modal({
      title: hasPlan ? 'Rủ đi chơi' : 'Tạo nhóm chat', wide: false,
      body: h('div.form', h('label.fld', h('span', 'Tên'), title), tog, planBox, h('div.fld', h('span', 'Mời ai?'), picker.el), check),
      actions: [h('button.btn.ghost', { onclick: function () { m.close(); } }, 'Huỷ'), h('button.btn.primary', { onclick: create }, 'Tạo')]
    });
    setTimeout(function () { title.focus(); }, 80);
    function create() {
      var ids = Object.keys(sel), name = title.value.trim(); if (ids.length < 2) { U.toast('Chọn ít nhất một người bạn để mời', { kind: 'err' }); return; }
      var ch = { title: '', kind: hasPlan ? 'plan' : 'group', members: {}, by: A.me.id, ts: A.store.now() }, tm = times();
      ids.forEach(function (id) { ch.members[id] = true; });
      if (hasPlan) {
        var d = date.value; if (!d) { U.toast('Chọn ngày cho kèo', { kind: 'err' }); return; }
        ch.plan = { date: d, s: tm[0], e: tm[1] }; if (place.value.trim()) ch.plan.place = place.value.trim(); if (note.value.trim()) ch.plan.note = note.value.trim();
        ch.rsvp = {}; ch.rsvp[A.me.id] = 'yes'; ch.title = name || 'Kèo ' + U.fmtDate(d);
      } else ch.title = name || 'Nhóm mới';
      var cid = A.store.newKey(A.path('channels')), mid = A.store.newKey(A.path('chats/' + cid)), ts = A.store.now(), up = {};
      var first = hasPlan ? 'Mình rủ mọi người "' + ch.title + '" nha, ' + planText(ch.plan) + '. Ai đi được bấm Tham gia ở trên giúp mình!' : 'Mình lập nhóm "' + ch.title + '" cho tiện trao đổi nhé.';
      ch.last = { by: A.me.id, txt: first, ts: ts };
      up[A.path('channels/' + cid)] = ch; up[A.path('chats/' + cid + '/' + mid)] = { by: A.me.id, txt: first, ts: ts, mn: [] };
      Object.assign(up, A.notifyUpdates(ids, { t: 'invite', ch: cid, txt: hasPlan ? planText(ch.plan) : 'Bạn được thêm vào nhóm' }));
      A.store.update(up).then(function () { m.close(); C.open(cid); U.toast('Đã tạo và gửi thông báo cho ' + (ids.length - 1) + ' người'); });
    }
  };

  Views.chat = C;
})(window);
