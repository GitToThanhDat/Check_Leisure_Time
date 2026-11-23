/* app.js - khung ứng dụng: phiên đăng nhập, phòng, đồng bộ, điều hướng, thông báo */
(function (root) {
  'use strict';
  var h = U.h, $ = U.$;
  var APP_NAME = 'Rảnh Chưa?';
  var Views = root.Views = {};

  var A = root.A = {
    store: null, room: null, me: null, members: {}, sched: {}, channels: {}, notifs: [],
    view: 'group', unsubs: [], chatSel: null,
    pf: Object.assign({ theme: 'auto', bg: 'aurora', bgDim: 0.2, bgBlur: 0, bgUrl: '', motion: true, brush: 'free', view: 'group', sound: true }, U.lsGet('rc_prefs', {})),
    sess: U.lsGet('rc_sess', { rooms: [], cur: null })
  };
  A.savePf = function () { U.lsSet('rc_prefs', A.pf); };
  A.saveSess = function () { U.lsSet('rc_sess', A.sess); };

  /* ---------- Giao diện: theme + nền ---------- */
  A.applyTheme = function () {
    var t = A.pf.theme, tone = Bg.tone(A.pf.bg), dark;
    if (t === 'dark') dark = true; else if (t === 'light') dark = false;
    else dark = tone === 'dark' ? true : tone === 'light' ? false : !(root.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    Bg.apply(A.pf, dark);
  };

  /* ---------- Truy cập dữ liệu ---------- */
  A.sc = function (mid) { return A.sched[mid] || {}; };
  A.memberList = function () {
    return Object.keys(A.members).map(function (id) { return Object.assign({ id: id }, A.members[id]); })
      .sort(function (a, b) { return (a.joinedAt || 0) - (b.joinedAt || 0); });
  };
  A.path = function (rest) { return 'rooms/' + A.room.id + (rest ? '/' + rest : ''); };
  A.isOwner = function () { return A.room && A.room.meta && A.room.meta.owner === A.me.id; };
  A.dirty = function (kind) {
    if (A._raf) { A._kinds[kind] = 1; return; }
    A._kinds = {}; A._kinds[kind] = 1;
    A._raf = requestAnimationFrame(function () {
      A._raf = 0; var ks = A._kinds; A._kinds = {};
      var v = Views[A.view];
      if (kind === 'channels' || kind === 'notifs') updateBadges();
      if (v && v.update) v.update(ks); else if (v && v.render) A.renderView();
    });
  };
  A.writeSched = function (updates) {   // updates: { 'one/2026-11-23': map|null, 'rec/id': obj|null }
    var o = {}; Object.keys(updates).forEach(function (k) { o[A.path('sched/' + A.me.id + '/' + k)] = updates[k] == null ? null : updates[k]; });
    return A.store.update(o);
  };

  /* ---------- Điều hướng ---------- */
  A.go = function (v) {
    if (!Views[v]) return;
    if (Views[A.view] && Views[A.view].leave) Views[A.view].leave();
    A.view = v; A.pf.view = v; A.savePf();
    U.$$('.tab').forEach(function (t) { t.classList.toggle('on', t.dataset.v === v); });
    A.renderView();
  };
  A.renderView = function () {
    var el = U.clear($('#view')); el.className = 'view v-' + A.view;
    Views[A.view].render(el);
  };
  A.openChannel = function (id) { A.chatSel = id; A.go('chat'); };

  /* ---------- Màn hình chào / vào phòng ---------- */
  function appRoot() { return U.clear($('#app')); }
  function brand() { return h('div.brand', h('span.logo', U.icon('spark', 22)), h('span.brand-name', APP_NAME)); }
  function modeBanner() {
    return A.store && A.store.mode === 'local'
      ? h('div.banner', 'Đang ở chế độ thử: dữ liệu chỉ lưu trên trình duyệt này. Nối Firebase để đồng bộ với bạn bè (xem HUONG-DAN.md).') : null;
  }
  function extractCode(s) {
    s = String(s || '').trim(); var m = /[#?&]r=([a-z0-9]+)/i.exec(s);
    return (m ? m[1] : s.replace(/[^a-z0-9]/gi, '')).toLowerCase();
  }

  function showLanding(msg) {
    var app = appRoot(), inp = h('input.inp', { placeholder: 'Dán link mời hoặc mã phòng', autocapitalize: 'none', spellcheck: false });
    var rooms = A.sess.rooms.map(function (r) {
      return h('button.room-item', { onclick: function () { enterRoom(r); } }, h('b', r.name), h('span.muted', 'mã ' + r.id), U.icon('right', 18));
    });
    function go() { var c = extractCode(inp.value); if (c) openByCode(c); }
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    app.appendChild(h('div.auth', h('div.card.glass.auth-card', brand(),
      h('p.lead', 'Báo cho nhau biết khi nào rảnh, khi nào bận, để chốt kèo đi chơi nhanh hơn.'),
      msg ? h('div.note.warn', msg) : null,
      rooms.length ? h('div.sect', h('h4', 'Phòng của bạn'), h('div.room-list', rooms)) : null,
      h('div.sect', h('h4', 'Vào phòng của bạn bè'), h('div.row', inp, h('button.btn.primary', { onclick: go }, 'Vào'))),
      h('div.sect.center', h('span.muted', 'Chưa có phòng? '), h('button.btn.ghost', { onclick: showCreate }, U.icon('plus', 16), 'Tạo phòng mới')),
      modeBanner())));
  }

  async function openByCode(code) {
    try {
      var meta = await A.store.get('rooms/' + code + '/meta');
      if (!meta) { U.toast('Không tìm thấy phòng có mã "' + code + '"', { kind: 'err' }); return; }
      var existing = A.sess.rooms.filter(function (r) { return r.id === code; })[0];
      if (existing) { enterRoom(existing, true); return; }
      showJoin(code, meta);
    } catch (e) { U.toast('Lỗi kết nối: ' + e.message, { kind: 'err' }); }
  }

  /* form thông tin thành viên (tên, emoji, màu, pin) */
  function profileForm(o) {
    var st = { emoji: o.emoji || U.EMOJIS[Math.floor(Math.random() * U.EMOJIS.length)], color: o.color || U.COLORS[Math.floor(Math.random() * U.COLORS.length)] };
    var name = h('input.inp', { placeholder: 'Tên hiển thị (vd: Minh)', maxLength: 24, value: o.name || '' });
    var pin = h('input.inp', { type: 'password', inputMode: 'numeric', maxLength: 6, placeholder: 'PIN 4–6 số', autocomplete: 'off' });
    var emo = h('div.pick'), col = h('div.pick');
    function draw() {
      U.clear(emo); U.clear(col);
      U.EMOJIS.forEach(function (e) { emo.appendChild(h('button.pk' + (st.emoji === e ? '.on' : ''), { type: 'button', onclick: function () { st.emoji = e; draw(); } }, e)); });
      U.COLORS.forEach(function (c) { col.appendChild(h('button.pk.sw' + (st.color === c ? '.on' : ''), { type: 'button', style: { background: c }, onclick: function () { st.color = c; draw(); } })); });
    }
    draw();
    var el = h('div.form',
      h('label.fld', h('span', 'Tên của bạn'), name),
      h('div.fld', h('span', 'Biểu tượng'), emo), h('div.fld', h('span', 'Màu'), col),
      o.noPin ? null : h('label.fld', h('span', 'Mã PIN (để lần sau vào lại và không ai sửa lịch của bạn)'), pin));
    return {
      el: el, name: name, pin: pin,
      get: function () { return { name: name.value.trim(), pin: pin.value.trim(), emoji: st.emoji, color: st.color }; }
    };
  }
  function validProfile(p, needPin) {
    if (!p.name) return 'Bạn chưa nhập tên';
    if (needPin !== false && !/^\d{4,6}$/.test(p.pin)) return 'PIN phải gồm 4–6 chữ số';
    return null;
  }

  function showCreate() {
    var app = appRoot(), rn = h('input.inp', { placeholder: 'Tên phòng (vd: Hội bạn thân)', maxLength: 40 }), pf = profileForm({});
    var btn = h('button.btn.primary.block', { onclick: go }, 'Tạo phòng');
    async function go() {
      var p = pf.get(), name = rn.value.trim(), err = !name ? 'Bạn chưa đặt tên phòng' : validProfile(p);
      if (err) { U.toast(err, { kind: 'err' }); return; }
      btn.disabled = true;
      try {
        var id, tries = 0; do { id = U.rid(8); tries++; } while ((await A.store.get('rooms/' + id + '/meta')) && tries < 5);
        var mid = 'm' + U.rid(6), now = A.store.now(), ph = await U.pinHash(id, mid, p.pin), up = {};
        up['rooms/' + id + '/meta'] = { name: name, createdAt: now, owner: mid };
        up['rooms/' + id + '/members/' + mid] = { name: p.name, emoji: p.emoji, color: p.color, ph: ph, joinedAt: now, showLb: true };
        up['rooms/' + id + '/channels/general'] = { title: 'Cả phòng', kind: 'room', ts: now, by: mid };
        await A.store.update(up);
        var entry = { id: id, name: name, mid: mid, ph: ph };
        A.sess.rooms.push(entry); A.saveSess();
        enterRoom(entry, false, true);
      } catch (e) { btn.disabled = false; U.toast('Không tạo được phòng: ' + e.message, { kind: 'err' }); }
    }
    app.appendChild(h('div.auth', h('div.card.glass.auth-card', brand(), h('h3', 'Tạo phòng mới'),
      h('label.fld', h('span', 'Tên phòng'), rn), h('h4', 'Bạn là chủ phòng'), pf.el, btn,
      h('button.btn.ghost.block', { onclick: function () { showLanding(); } }, 'Quay lại'))));
  }

  async function showJoin(id, meta) {
    var app = appRoot(), members = (await A.store.get('rooms/' + id + '/members')) || {};
    var list = Object.keys(members).map(function (mid) { return Object.assign({ id: mid }, members[mid]); }).sort(function (a, b) { return (a.joinedAt || 0) - (b.joinedAt || 0); });
    var wrap = h('div.auth-card.card.glass', brand(), h('h3', 'Phòng "' + meta.name + '"'));
    app.appendChild(h('div.auth', wrap));
    function pickStep() {
      U.clear(wrap); wrap.appendChild(brand()); wrap.appendChild(h('h3', 'Phòng "' + meta.name + '"'));
      if (list.length) {
        wrap.appendChild(h('h4', 'Bạn đã có trong phòng này? Chọn tên của bạn'));
        wrap.appendChild(h('div.mem-grid', list.map(function (m) {
          return h('button.mem', { onclick: function () { pinStep(m); } }, U.avatar(m, 40), h('span', m.name));
        })));
      }
      wrap.appendChild(h('button.btn.primary.block', { onclick: newStep }, U.icon('plus', 16), 'Tôi là người mới'));
      wrap.appendChild(h('button.btn.ghost.block', { onclick: function () { showLanding(); } }, 'Quay lại'));
    }
    function pinStep(m) {
      U.clear(wrap); wrap.appendChild(brand());
      var pin = h('input.inp.big', { type: 'password', inputMode: 'numeric', maxLength: 6, placeholder: '• • • •', autocomplete: 'off' });
      async function go() {
        var ph = await U.pinHash(id, m.id, pin.value.trim());
        if (ph !== m.ph) { U.toast('Sai PIN rồi, thử lại nhé', { kind: 'err' }); pin.select(); return; }
        var entry = { id: id, name: meta.name, mid: m.id, ph: ph };
        A.sess.rooms = A.sess.rooms.filter(function (r) { return r.id !== id; }); A.sess.rooms.push(entry); A.saveSess();
        enterRoom(entry);
      }
      pin.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      wrap.appendChild(h('div.center', U.avatar(m, 64), h('h3', 'Chào ' + m.name), h('p.muted', 'Nhập PIN của bạn')));
      wrap.appendChild(pin); wrap.appendChild(h('button.btn.primary.block', { onclick: go }, 'Vào phòng'));
      wrap.appendChild(h('button.btn.ghost.block', { onclick: pickStep }, 'Chọn người khác'));
      setTimeout(function () { pin.focus(); }, 50);
    }
    function newStep() {
      U.clear(wrap); wrap.appendChild(brand()); wrap.appendChild(h('h3', 'Tạo hồ sơ của bạn'));
      var pf = profileForm({}), btn = h('button.btn.primary.block', { onclick: go }, 'Vào phòng');
      async function go() {
        var p = pf.get(), err = validProfile(p);
        var dup = list.some(function (m) { return U.norm(m.name) === U.norm(p.name); });
        if (!err && dup) err = 'Trong phòng đã có người tên "' + p.name + '". Hãy chọn tên của bạn ở bước trước hoặc đổi tên khác.';
        if (err) { U.toast(err, { kind: 'err' }); return; }
        btn.disabled = true;
        try {
          var mid = 'm' + U.rid(6), ph = await U.pinHash(id, mid, p.pin);
          await A.store.set('rooms/' + id + '/members/' + mid, { name: p.name, emoji: p.emoji, color: p.color, ph: ph, joinedAt: A.store.now(), showLb: true });
          var entry = { id: id, name: meta.name, mid: mid, ph: ph };
          A.sess.rooms.push(entry); A.saveSess(); enterRoom(entry, false, true);
        } catch (e) { btn.disabled = false; U.toast('Lỗi: ' + e.message, { kind: 'err' }); }
      }
      wrap.appendChild(pf.el); wrap.appendChild(btn); wrap.appendChild(h('button.btn.ghost.block', { onclick: pickStep }, 'Quay lại'));
    }
    pickStep();
  }

  /* ---------- Vào phòng & đồng bộ ---------- */
  function stopRoom() { A.unsubs.forEach(function (u) { try { u(); } catch (e) { } }); A.unsubs = []; }
  async function enterRoom(entry, silent, isNew) {
    stopRoom();
    try {
      var meta = await A.store.get('rooms/' + entry.id + '/meta'), me = await A.store.get('rooms/' + entry.id + '/members/' + entry.mid);
      if (!meta || !me || me.ph !== entry.ph) {
        A.sess.rooms = A.sess.rooms.filter(function (r) { return r.id !== entry.id; }); A.saveSess();
        if (!meta) { showLanding('Phòng này không còn tồn tại.'); return; }
        showJoin(entry.id, meta); return;
      }
      A.room = { id: entry.id, meta: meta }; A.sess.cur = entry.id; A.saveSess();
      A.me = Object.assign({ id: entry.mid }, me);
      A.members = {}; A.sched = {}; A.channels = {}; A.notifs = []; A.chatSel = null; A.notifReady = false; A.notifSeen = {};
      var pending = 4, resolveReady;
      var ready = new Promise(function (r) { resolveReady = r; });
      function first() { if (--pending === 0) resolveReady(); }
      var got = {};
      function once(k) { return function () { if (!got[k]) { got[k] = 1; first(); } }; }
      var d1 = once('m'), d2 = once('s'), d3 = once('c'), d4 = once('n');
      A.unsubs.push(A.store.listen(A.path('members'), function (v) {
        A.members = v || {}; if (A.members[A.me.id]) A.me = Object.assign({ id: A.me.id }, A.members[A.me.id]); d1(); A.dirty('members');
      }));
      A.unsubs.push(A.store.listen(A.path('sched'), function (v) { A.sched = v || {}; d2(); A.dirty('sched'); }));
      A.unsubs.push(A.store.listen(A.path('channels'), function (v) { A.channels = v || {}; d3(); A.dirty('channels'); }));
      A.unsubs.push(A.store.listen(A.path('notifs/' + A.me.id), onNotifs, { limitLast: 60 }));
      A._nFirst = d4;
      await ready;
      if (!A.channels.general) A.store.set(A.path('channels/general'), { title: 'Cả phòng', kind: 'room', ts: A.store.now(), by: A.me.id });
      renderShell();
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      if (isNew) { A.go('me'); U.toast('Chào mừng! Bắt đầu bằng việc thêm thói quen (giờ ngủ, giờ học) cho nhanh.', { ms: 5000 }); }
      else A.go(Views[A.pf.view] ? A.pf.view : 'group');
    } catch (e) { console.error(e); showLanding('Không vào được phòng: ' + e.message); }
  }
  A.leaveRoom = function () { stopRoom(); A.room = null; showLanding(); };
  A.logout = function () {
    A.sess.rooms = A.sess.rooms.filter(function (r) { return r.id !== A.room.id; }); A.sess.cur = null; A.saveSess(); A.leaveRoom();
  };

  /* ---------- Khung giao diện chính ---------- */
  var TABS = [['group', 'Nhóm', 'users'], ['me', 'Lịch của tôi', 'cal'], ['chat', 'Chat', 'chat'], ['settings', 'Cài đặt', 'sliders']];
  function renderShell() {
    var app = appRoot();
    var bell = h('button.icon-btn.bell#bell', { title: 'Thông báo', onclick: openBell }, U.icon('bell'), h('span.dot#bell-dot'));
    app.appendChild(h('div.shell',
      h('header.topbar.glass',
        h('button.room-btn', { onclick: openRoomMenu }, h('span.logo.sm', U.icon('spark', 16)), h('span.rname', A.room.meta.name), U.icon('chevd', 16)),
        h('div.spacer'),
        h('span.conn#conn', { title: 'Trạng thái kết nối' }),
        bell, h('button.me-btn', { title: 'Cài đặt', onclick: function () { A.go('settings'); } }, U.avatar(A.me, 34))),
      modeBanner(),
      h('main#view.view'),
      h('nav.tabbar.glass', TABS.map(function (t) {
        return h('button.tab', { dataset: { v: t[0] }, onclick: function () { A.go(t[0]); } }, U.icon(t[2], 22), h('span', t[1]), t[0] === 'chat' ? h('span.badge#chat-badge') : null);
      }))));
    A.store.onConn(function (c) { var el = $('#conn'); if (el) { el.className = 'conn ' + (c ? 'ok' : 'off'); el.title = c ? 'Đã kết nối' : 'Mất kết nối, đang thử lại...'; } });
    updateBadges();
  }

  function chatUnread() {
    var seen = U.lsGet('rc_seen_' + A.room.id, {}), n = 0;
    Object.keys(A.channels).forEach(function (id) {
      var c = A.channels[id]; if (!A.canSee(c)) return;
      if (c.last && c.last.by !== A.me.id && c.last.ts > (seen[id] || 0)) n++;
    });
    return n;
  }
  A.canSee = function (c) { return c && (c.kind === 'room' || (c.members && c.members[A.me.id])); };
  A.markSeen = function (cid) {
    var s = U.lsGet('rc_seen_' + A.room.id, {}); s[cid] = A.store.now() + 1; U.lsSet('rc_seen_' + A.room.id, s); updateBadges();
  };
  function unreadNotifs() { return A.notifs.filter(function (n) { return !n.v.read; }); }
  function updateBadges() {
    if (!A.room) return;
    var cb = $('#chat-badge'), n = chatUnread(), un = unreadNotifs().length, bd = $('#bell-dot');
    if (cb) { cb.textContent = n > 9 ? '9+' : n; cb.style.display = n ? 'inline-flex' : 'none'; }
    if (bd) { bd.textContent = un > 9 ? '9+' : un; bd.style.display = un ? 'inline-flex' : 'none'; }
    document.title = (un ? '(' + un + ') ' : '') + APP_NAME;
  }
  A.updateBadges = updateBadges;

  /* ---------- Thông báo ---------- */
  function onNotifs(v) {
    var list = U.$ && Sched.objVals(v).sort(function (a, b) { return b.v.ts - a.v.ts; });
    var fresh = list.filter(function (n) { return !A.notifSeen[n.id]; });
    list.forEach(function (n) { A.notifSeen[n.id] = 1; });
    A.notifs = list;
    if (A.notifReady) fresh.forEach(function (n) { if (!n.v.read) alertNotif(n); });
    A.notifReady = true; if (A._nFirst) { A._nFirst(); A._nFirst = null; }
    A.dirty('notifs');
  }
  function notifText(n) {
    var by = A.members[n.v.by], who = by ? by.name : 'Ai đó', ch = A.channels[n.v.ch], cn = ch ? ch.title : 'một nhóm';
    if (n.v.t === 'invite') return { title: who + ' rủ bạn: ' + cn, body: n.v.txt || '' };
    if (n.v.t === 'all') return { title: who + ' gọi mọi người trong ' + cn, body: n.v.txt || '' };
    return { title: who + ' nhắc bạn trong ' + cn, body: n.v.txt || '' };
  }
  function alertNotif(n) {
    var t = notifText(n);
    U.toast(h('div.tt', h('b', t.title), h('span', t.body)), { ms: 5500, onclick: function () { openNotif(n); } });
    if (A.pf.sound) U.ding();
    if (document.hidden && root.Notification && Notification.permission === 'granted') {
      try { var nt = new Notification(t.title, { body: t.body, tag: n.id }); nt.onclick = function () { root.focus(); openNotif(n); nt.close(); }; } catch (e) { }
    }
  }
  function openNotif(n) {
    A.store.set(A.path('notifs/' + A.me.id + '/' + n.id + '/read'), true);
    if (n.v.ch && A.channels[n.v.ch]) A.openChannel(n.v.ch);
  }
  /** Gửi thông báo tới nhiều người; trả về object update để gộp vào 1 lệnh ghi */
  A.notifyUpdates = function (toIds, data) {
    var o = {}, ts = A.store.now();
    toIds.forEach(function (id) {
      if (id === A.me.id) return;
      o[A.path('notifs/' + id + '/' + A.store.newKey(A.path('notifs/' + id)))] = Object.assign({ by: A.me.id, ts: ts }, data);
    });
    return o;
  };
  function openBell() {
    var body = h('div.notif-list');
    function draw() {
      U.clear(body);
      if (!A.notifs.length) body.appendChild(h('p.muted.center', 'Chưa có thông báo nào. Khi ai đó tag hoặc rủ bạn, nó sẽ hiện ở đây.'));
      A.notifs.forEach(function (n) {
        var t = notifText(n), by = A.members[n.v.by];
        body.appendChild(h('button.notif' + (n.v.read ? '' : '.unread'), { onclick: function () { m.close(); openNotif(n); } },
          U.avatar(by, 36), h('div.nt', h('b', t.title), h('span.muted', t.body), h('small.muted', U.fmtTime(n.v.ts)))));
      });
    }
    var perm = root.Notification && Notification.permission !== 'granted' && Notification.permission !== 'denied'
      ? h('button.btn.sm', { onclick: function () { Notification.requestPermission().then(function (p) { U.toast(p === 'granted' ? 'Đã bật popup thông báo' : 'Bạn chưa cho phép thông báo'); }); } }, 'Bật popup của trình duyệt') : null;
    var m = U.modal({
      title: 'Thông báo', body: h('div', perm, body),
      actions: [h('button.btn.ghost', { onclick: function () { markAllRead(); draw(); } }, 'Đánh dấu đã đọc hết'), h('button.btn.primary', { onclick: function () { m.close(); } }, 'Đóng')]
    });
    draw();
  }
  function markAllRead() {
    var o = {}; unreadNotifs().forEach(function (n) { o[A.path('notifs/' + A.me.id + '/' + n.id + '/read')] = true; });
    if (Object.keys(o).length) A.store.update(o);
  }
  A.markChannelNotifsRead = function (cid) {
    var o = {}; unreadNotifs().forEach(function (n) { if (n.v.ch === cid) o[A.path('notifs/' + A.me.id + '/' + n.id + '/read')] = true; });
    if (Object.keys(o).length) A.store.update(o);
  };

  /* ---------- Menu phòng ---------- */
  A.inviteLink = function () { return location.href.split('#')[0] + '#r=' + A.room.id; };
  function openRoomMenu() {
    var link = A.inviteLink();
    var rooms = A.sess.rooms.filter(function (r) { return r.id !== A.room.id; }).map(function (r) {
      return h('button.room-item', { onclick: function () { m.close(); enterRoom(r); } }, h('b', r.name), h('span.muted', 'mã ' + r.id), U.icon('right', 18));
    });
    var m = U.modal({
      title: A.room.meta.name,
      body: h('div.form',
        h('div.fld', h('span', 'Mời bạn bè: gửi link này (hoặc mã phòng)'),
          h('div.row', h('input.inp', { value: link, readOnly: true, onfocus: function (e) { e.target.select(); } }),
            h('button.btn', { onclick: function () { U.copy(link).then(function () { U.toast('Đã copy link mời'); }); } }, U.icon('copy', 16), 'Copy'))),
        h('p.muted', 'Mã phòng: ', h('b', A.room.id), '. Ai có link/mã đều vào được phòng này nên chỉ gửi cho người bạn tin.'),
        rooms.length ? h('div.sect', h('h4', 'Chuyển phòng'), h('div.room-list', rooms)) : null),
      actions: [h('button.btn.ghost', { onclick: function () { m.close(); A.leaveRoom(); } }, 'Vào / tạo phòng khác'), h('button.btn.primary', { onclick: function () { m.close(); } }, 'Xong')]
    });
  }

  /* ---------- Khởi động ---------- */
  async function boot() {
    A.applyTheme();
    try { A.store = await Store.create(root.FIREBASE_CONFIG); }
    catch (e) { console.error(e); appRoot().appendChild(h('div.auth', h('div.card.glass.auth-card', brand(), h('div.note.warn', 'Không kết nối được Firebase: ' + e.message + '. Kiểm tra lại js/config.js.')))); return; }
    var hm = /[#&]r=([a-z0-9]+)/i.exec(location.hash);
    if (hm) { openByCode(hm[1].toLowerCase()); return; }
    var cur = A.sess.rooms.filter(function (r) { return r.id === A.sess.cur; })[0];
    if (cur) enterRoom(cur); else showLanding();
  }
  root.addEventListener('hashchange', function () {
    var hm = /[#&]r=([a-z0-9]+)/i.exec(location.hash);
    if (hm && A.store && (!A.room || A.room.id !== hm[1].toLowerCase())) openByCode(hm[1].toLowerCase());
  });
  A.enterRoom = enterRoom;
  document.addEventListener('DOMContentLoaded', boot);
})(window);
