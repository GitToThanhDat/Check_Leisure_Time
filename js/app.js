/* app.js - khung ứng dụng: tài khoản, danh sách phòng riêng, vào/rời phòng, đồng bộ, điều hướng, thông báo.
 *
 * Mô hình v2 (tài khoản):
 *   - Mỗi người có 1 tài khoản (tên không trùng + mật khẩu) -> uid.
 *   - users/$uid               : hồ sơ {name, emoji, color}; users/$uid/rooms/$room = {name, ts}  (danh sách phòng RIÊNG của người đó)
 *   - rooms/$room/meta         : {name, owner:uid, createdAt, locked?}
 *   - rooms/$room/members/$uid : {name, emoji, color, joinedAt, showLb}
 *   - rooms/$room/sched|channels|chats|notifs/... như cũ, khoá bằng uid.
 */
(function (root) {
  'use strict';
  var h = U.h, $ = U.$;
  var APP_NAME = 'Rảnh Chưa?';
  var Views = root.Views = {};

  var A = root.A = {
    store: null, user: null, idx: {}, room: null, me: null, members: {}, sched: {}, channels: {}, notifs: [],
    view: 'group', unsubs: [], chatSel: null, pendingCode: null, authBusy: false,
    pf: Object.assign({ theme: 'auto', bg: 'aurora', bgDim: 0.2, bgBlur: 0, bgUrl: '', motion: true, brush: 'free', view: 'group', sound: true }, U.lsGet('rc_prefs', {}))
  };
  A.savePf = function () { U.lsSet('rc_prefs', A.pf); };

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
  A.isOwner = function () { return !!(A.room && A.room.meta && A.me && A.room.meta.owner === A.me.id); };
  /** Biệt danh (kiểu Messenger) của uid trong kênh chat cid ('' nếu chưa đặt) */
  A.nick = function (uid, cid) { var c = A.channels[cid || A.chatSel]; return (c && c.nick && c.nick[uid]) || ''; };
  /** Tên hiển thị: biệt danh trong kênh nếu có, không thì tên thật */
  A.dn = function (uid, cid) { var n = A.nick(uid, cid); if (n) return n; var m = A.members[uid]; return m ? m.name : 'Người đã rời phòng'; };
  A.dirty = function (kind) {
    if (A._raf) { A._kinds[kind] = 1; return; }
    A._kinds = {}; A._kinds[kind] = 1;
    A._raf = requestAnimationFrame(function () {
      A._raf = 0; var ks = A._kinds; A._kinds = {};
      var v = Views[A.view];
      if (ks.channels || ks.notifs) updateBadges();
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

  /* ---------- Thành phần chung ---------- */
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
  function errMsg(e) { return Store.authMsg ? Store.authMsg(e) : (e && e.message) || 'Có lỗi xảy ra'; }
  A.linkOf = function (id) { return location.href.split('#')[0].split('?')[0] + '#r=' + id; };
  A.inviteLink = function () { return A.linkOf(A.room.id); };
  function copyLink(id, label) { U.copy(A.linkOf(id)).then(function () { U.toast('Đã copy link' + (label ? ' phòng "' + label + '"' : '')); }); }
  A.copyLink = copyLink;

  /* ================= ĐĂNG NHẬP / TẠO TÀI KHOẢN ================= */
  function showAuth(o) {
    o = o || {}; var mode = o.mode || 'in', app = appRoot();
    var st = { emoji: U.EMOJIS[Math.floor(Math.random() * U.EMOJIS.length)], color: U.COLORS[Math.floor(Math.random() * U.COLORS.length)] };
    var name = h('input.inp', { placeholder: 'Tên của bạn (vd: Minh)', maxLength: 24, autocomplete: 'username', autocapitalize: 'off', spellcheck: false, name: 'username' });
    var pass = h('input.inp', { type: 'password', placeholder: 'Mật khẩu', autocomplete: mode === 'up' ? 'new-password' : 'current-password', name: 'password' });
    var pass2 = h('input.inp', { type: 'password', placeholder: 'Nhập lại mật khẩu', autocomplete: 'new-password' });
    var emo = h('div.pick'), col = h('div.pick');
    function drawPk() {
      U.clear(emo); U.clear(col);
      U.EMOJIS.forEach(function (e) { emo.appendChild(h('button.pk' + (st.emoji === e ? '.on' : ''), { type: 'button', onclick: function () { st.emoji = e; drawPk(); } }, e)); });
      U.COLORS.forEach(function (c) { col.appendChild(h('button.pk.sw' + (st.color === c ? '.on' : ''), { type: 'button', style: { background: c }, onclick: function () { st.color = c; drawPk(); } })); });
    }
    drawPk();
    var btn = h('button.btn.primary.block', { type: 'submit' }, mode === 'up' ? 'Tạo tài khoản' : 'Đăng nhập');
    var form = h('form.form', { onsubmit: function (e) { e.preventDefault(); submit(); }, autocomplete: 'on' },
      h('label.fld', h('span', mode === 'up' ? 'Tên của bạn (không được trùng với người khác)' : 'Tên của bạn'), name),
      h('label.fld', h('span', mode === 'up' ? 'Mật khẩu (từ 6 ký tự)' : 'Mật khẩu'), pass),
      mode === 'up' ? h('label.fld', h('span', 'Nhập lại mật khẩu'), pass2) : null,
      mode === 'up' ? h('div.fld', h('span', 'Biểu tượng'), emo) : null,
      mode === 'up' ? h('div.fld', h('span', 'Màu'), col) : null,
      mode === 'up' ? h('p.hint', 'Tên không phân biệt hoa/thường, dấu và khoảng trắng: "Đạt", "dat" và "ĐẠT" là cùng một tên. Muốn gọi nhau khác đi trong từng nhóm chat, dùng "Biệt danh".') : null,
      mode === 'up' ? h('p.hint', 'Hãy nhớ mật khẩu hoặc để trình duyệt lưu giúp: web miễn phí không có chức năng gửi email lấy lại mật khẩu.') : null,
      btn);
    async function submit() {
      var nm = name.value.trim().replace(/\s+/g, ' '), pw = pass.value;
      if (!nm) { U.toast('Bạn chưa nhập tên', { kind: 'err' }); return; }
      if (!U.slug(nm)) { U.toast('Tên cần có ít nhất một chữ hoặc số', { kind: 'err' }); return; }
      if (mode === 'up') {
        if (nm.length < 2) { U.toast('Tên cần ít nhất 2 ký tự', { kind: 'err' }); return; }
        if (pw.length < 6) { U.toast('Mật khẩu cần ít nhất 6 ký tự', { kind: 'err' }); return; }
        if (pw !== pass2.value) { U.toast('Hai lần nhập mật khẩu chưa giống nhau', { kind: 'err' }); return; }
      } else if (!pw) { U.toast('Bạn chưa nhập mật khẩu', { kind: 'err' }); return; }
      btn.disabled = true; A.authBusy = true;
      try {
        var u;
        if (mode === 'up') {
          u = await A.store.auth.signUp(nm, pw);
          await A.store.set('users/' + u.uid, { name: nm, emoji: st.emoji, color: st.color, createdAt: A.store.now() });
        } else u = await A.store.auth.signIn(nm, pw);
        A.authBusy = false; await startSession(u, { isNew: mode === 'up' });
      } catch (e) { A.authBusy = false; btn.disabled = false; console.error(e); U.toast(errMsg(e), { kind: 'err' }); }
    }
    app.appendChild(h('div.auth', h('div.card.glass.auth-card', brand(),
      h('p.lead', 'Báo cho nhau biết khi nào rảnh, khi nào bận, để chốt kèo đi chơi nhanh hơn.'),
      o.msg ? h('div.note.warn', o.msg) : null,
      A.pendingCode ? h('div.note', U.icon('link', 16), ' Bạn được mời vào một phòng. Đăng nhập hoặc tạo tài khoản để vào.') : null,
      h('div.seg.auth-tabs', [['in', 'Đăng nhập'], ['up', 'Tạo tài khoản']].map(function (x) {
        return h('button' + (mode === x[0] ? '.on' : ''), { type: 'button', onclick: function () { if (mode !== x[0]) showAuth({ mode: x[0] }); } }, x[1]);
      })),
      form, modeBanner())));
    setTimeout(function () { name.focus(); }, 60);
  }

  /** Bảo đảm có hồ sơ users/$uid (phòng khi lần tạo tài khoản trước bị đứt giữa chừng) */
  async function ensureProfile(u) {
    var p = await A.store.get('users/' + u.uid);
    if (p && p.name) return { id: u.uid, name: p.name, emoji: p.emoji, color: p.color };
    var nm = u.name || 'Người dùng', pr = { name: nm, emoji: U.EMOJIS[Math.floor(Math.random() * U.EMOJIS.length)], color: U.COLORS[Math.floor(Math.random() * U.COLORS.length)], createdAt: A.store.now() };
    await A.store.set('users/' + u.uid, pr);
    return Object.assign({ id: u.uid }, pr);
  }

  async function startSession(u, opt) {
    opt = opt || {};
    try {
      A.user = await ensureProfile(u);
      A.ord = U.lsGet('rc_ord_' + A.user.id, {});
      if (A.idxUnsub) A.idxUnsub();
      A.idx = {}; A.idxReady = false;
      A.idxUnsub = A.store.listen('users/' + A.user.id + '/rooms', function (v) { A.idx = v || {}; A.idxReady = true; if (A.onIdx) A.onIdx(); });
      var code = A.pendingCode; A.pendingCode = null;
      if (code) { openByCode(code); return; }
      showHome(opt.isNew ? 'Chào mừng ' + A.user.name + '! Tạo phòng đầu tiên hoặc dán link bạn bè gửi.' : null);
    } catch (e) {
      console.error(e); A.user = null;
      showAuth({ msg: 'Đăng nhập được nhưng không đọc được dữ liệu: ' + (e.message || e) + '. Nếu bạn vừa cập nhật web, hãy kiểm tra lại Rules trong Firebase (xem HUONG-DAN.md).' });
    }
  }

  A.logout = async function () {
    stopRoom(); A.room = null;
    if (A.idxUnsub) { A.idxUnsub(); A.idxUnsub = null; }
    A.user = null; A.idx = {}; A.onIdx = null;
    await A.store.auth.signOut();   // onChange(null) sẽ hiện màn đăng nhập
  };

  /* ---- hồ sơ & mật khẩu ---- */
  A.updateProfile = async function (patch) {
    var uid = A.user.id, o = {};
    Object.keys(patch).forEach(function (k) { o['users/' + uid + '/' + k] = patch[k]; });
    await A.store.update(o); Object.assign(A.user, patch);
    // đồng bộ sang từng phòng (mỗi phòng một lệnh riêng để một phòng lỗi không làm hỏng các phòng khác)
    await Promise.all(Object.keys(A.idx).map(function (rid) {
      var oo = {}; Object.keys(patch).forEach(function (k) { oo['rooms/' + rid + '/members/' + uid + '/' + k] = patch[k]; });
      return A.store.update(oo).catch(function () { });
    }));
  };
  A.accountModal = function () {
    var emo = h('div.pick'), col = h('div.pick'), head = h('div.row.prof');
    function draw() {
      U.clear(emo); U.clear(col); U.clear(head);
      head.appendChild(U.avatar(A.user, 56)); head.appendChild(h('div', h('b', A.user.name), h('div.muted.sm', 'Tên đăng nhập không đổi được. Muốn gọi khác đi trong từng nhóm: dùng Biệt danh trong Chat.')));
      U.EMOJIS.forEach(function (e) { emo.appendChild(h('button.pk' + (A.user.emoji === e ? '.on' : ''), { onclick: function () { A.updateProfile({ emoji: e }).then(draw, function (er) { U.toast(errMsg(er), { kind: 'err' }); }); } }, e)); });
      U.COLORS.forEach(function (c) { col.appendChild(h('button.pk.sw' + (A.user.color === c ? '.on' : ''), { style: { background: c }, onclick: function () { A.updateProfile({ color: c }).then(draw, function (er) { U.toast(errMsg(er), { kind: 'err' }); }); } })); });
    }
    draw();
    var m = U.modal({
      title: 'Tài khoản của tôi',
      body: h('div.form', head, h('div.fld.mt', h('span', 'Biểu tượng'), emo), h('div.fld', h('span', 'Màu'), col),
        h('div.row', h('button.btn.sm', { onclick: changePassword }, U.icon('key', 16), 'Đổi mật khẩu'))),
      actions: [h('button.btn.danger', { onclick: function () { m.close(); U.confirm('Đăng xuất?', 'Bạn sẽ cần nhập lại tên và mật khẩu để vào lại. Dữ liệu của bạn vẫn được giữ.', 'Đăng xuất').then(function (ok) { if (ok) A.logout(); }); } }, U.icon('logout', 16), 'Đăng xuất'),
        h('button.btn.primary', { onclick: function () { m.close(); } }, 'Xong')]
    });
  };
  function changePassword() {
    var cur = h('input.inp', { type: 'password', placeholder: 'Mật khẩu hiện tại', autocomplete: 'current-password' }), n1 = h('input.inp', { type: 'password', placeholder: 'Mật khẩu mới (từ 6 ký tự)', autocomplete: 'new-password' }), n2 = h('input.inp', { type: 'password', placeholder: 'Nhập lại mật khẩu mới', autocomplete: 'new-password' });
    var m = U.modal({
      title: 'Đổi mật khẩu', body: h('div.form', h('div.fld', cur), h('div.fld', n1), h('div.fld', n2)),
      actions: [h('button.btn.ghost', { onclick: function () { m.close(); } }, 'Huỷ'), h('button.btn.primary', { onclick: go }, 'Đổi mật khẩu')]
    });
    async function go() {
      if (n1.value.length < 6) { U.toast('Mật khẩu mới cần ít nhất 6 ký tự', { kind: 'err' }); return; }
      if (n1.value !== n2.value) { U.toast('Hai lần nhập mật khẩu mới chưa giống nhau', { kind: 'err' }); return; }
      try { await A.store.auth.changePassword(cur.value, n1.value); m.close(); U.toast('Đã đổi mật khẩu'); } catch (e) { U.toast(errMsg(e), { kind: 'err' }); }
    }
  }

  /* ================= DANH SÁCH PHÒNG CỦA TÔI (màn hình chính) ================= */
  function showHome(msg) {
    stopRoom(); A.room = null; document.title = APP_NAME;
    var app = appRoot(), codeInp = h('input.inp', { placeholder: 'Dán link mời hoặc mã phòng', autocapitalize: 'none', spellcheck: false });
    var listEl = h('div.rooms'), q = '', info = {}, searchEl = null;
    function go() { var c = extractCode(codeInp.value); if (c) openByCode(c); }
    codeInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    function sorted(ids) { return ids.sort(function (a, b) { return (A.ord[b] || 0) - (A.ord[a] || 0) || String((A.idx[a] || {}).name).localeCompare(String((A.idx[b] || {}).name)); }); }
    function row(id) {
      var ix = A.idx[id] || {}, inf = info[id] || {}, owner = inf.meta && inf.meta.owner === A.user.id, nm = (inf.meta && inf.meta.name) || ix.name || id;
      return h('div.room-row',
        h('button.room-main', { onclick: function () { enterRoom(id); } },
          h('span.r-ic' + (owner ? '.own' : ''), U.icon(owner ? 'crown' : 'users', 20)),
          h('div.r-t', h('b', nm), h('small.muted', (owner ? 'Bạn là chủ phòng · ' : '') + 'mã ' + id + (inf.meta && inf.meta.locked ? ' · đã khoá' : ''))), U.icon('right', 18)),
        h('button.icon-btn', { title: 'Copy link mời của phòng này', onclick: function () { copyLink(id, nm); } }, U.icon('link')));
    }
    function draw() {
      U.clear(listEl);
      var ids = Object.keys(A.idx).filter(function (id) { var n = U.norm(((info[id] && info[id].meta && info[id].meta.name) || A.idx[id].name || '') + ' ' + id); return !q || n.indexOf(q) >= 0; });
      var mine = sorted(ids.filter(function (id) { return info[id] && info[id].meta && info[id].meta.owner === A.user.id; }));
      var other = sorted(ids.filter(function (id) { return mine.indexOf(id) < 0; }));
      if (searchEl) searchEl.style.display = Object.keys(A.idx).length > 5 ? '' : 'none';
      if (!A.idxReady) listEl.appendChild(h('p.empty', 'Đang tải danh sách phòng…'));
      else if (!Object.keys(A.idx).length) listEl.appendChild(h('p.empty', 'Bạn chưa ở phòng nào. Tạo phòng mới ở dưới, hoặc dán link bạn bè gửi.'));
      else if (!ids.length) listEl.appendChild(h('p.empty', 'Không có phòng nào khớp.'));
      if (mine.length) listEl.appendChild(h('div.sect', h('h4', 'Phòng tôi tạo (' + mine.length + ')'), h('div.room-list', mine.map(row))));
      if (other.length) listEl.appendChild(h('div.sect', h('h4', 'Phòng tôi tham gia (' + other.length + ')'), h('div.room-list', other.map(row))));
    }
    /** Kiểm tra từng phòng còn tồn tại và mình còn là thành viên; phòng đã mất thì dọn khỏi danh sách riêng */
    function verify() {
      Object.keys(A.idx).forEach(function (id) {
        if (info[id] && info[id].done) return; info[id] = { done: true };
        Promise.all([A.store.get('rooms/' + id + '/meta'), A.store.get('rooms/' + id + '/members/' + A.user.id)]).then(function (r) {
          if (!r[0] || !r[1]) { A.store.set('users/' + A.user.id + '/rooms/' + id, null).catch(function () { }); delete info[id]; return; }
          info[id] = { done: true, meta: r[0] };
          if (A.idx[id] && A.idx[id].name !== r[0].name) A.store.set('users/' + A.user.id + '/rooms/' + id + '/name', r[0].name).catch(function () { });
          draw();
        }, function () { A.store.set('users/' + A.user.id + '/rooms/' + id, null).catch(function () { }); delete info[id]; draw(); });
      });
    }
    A.onIdx = function () { draw(); verify(); };
    searchEl = h('input.inp.sm', { placeholder: 'Tìm phòng theo tên hoặc mã…', oninput: function (e) { q = U.norm(e.target.value); draw(); } });
    app.appendChild(h('div.auth.top', h('div.card.glass.auth-card.home',
      h('div.home-top', brand(), h('button.me-btn', { title: 'Tài khoản', onclick: A.accountModal }, U.avatar(A.user, 38))),
      h('p.lead', 'Xin chào ', h('b', A.user.name), '! Đây là các phòng của bạn.'),
      msg ? h('div.note', msg) : null, searchEl, listEl,
      h('div.sect', h('h4', 'Vào phòng bằng link / mã'), h('div.row', codeInp, h('button.btn.primary', { onclick: go }, 'Vào'))),
      h('div.sect.center', h('button.btn.primary', { onclick: createRoom }, U.icon('plus', 16), 'Tạo phòng mới')),
      modeBanner())));
    draw(); verify();
  }
  A.showHome = showHome;

  function createRoom() {
    U.prompt('Tạo phòng mới', 'Tên phòng (vd: Hội bạn thân)', '', { max: 40, ok: 'Tạo phòng' }).then(async function (name) {
      if (!name) return;
      try {
        var id, tries = 0; do { id = U.rid(8); tries++; } while ((await A.store.get('rooms/' + id + '/meta')) && tries < 5);
        var now = A.store.now(), uid = A.user.id;
        await A.store.set('rooms/' + id + '/meta', { name: name, createdAt: now, owner: uid });   // bước 1: tạo phòng (Rules cần meta có trước)
        var up = {};
        up['rooms/' + id + '/members/' + uid] = { name: A.user.name, emoji: A.user.emoji, color: A.user.color, joinedAt: now, showLb: true };
        up['rooms/' + id + '/channels/general'] = { title: 'Cả phòng', kind: 'room', ts: now, by: uid };
        up['users/' + uid + '/rooms/' + id] = { name: name, ts: now };
        await A.store.update(up);                                                                  // bước 2: thêm mình vào phòng
        enterRoom(id, { isNew: true });
      } catch (e) { console.error(e); U.toast('Không tạo được phòng: ' + (e.message || e), { kind: 'err' }); }
    });
  }

  /* ================= VÀO PHÒNG BẰNG LINK / MÃ ================= */
  async function openByCode(code) {
    try {
      var meta = await A.store.get('rooms/' + code + '/meta');
      if (!meta) { U.toast('Không tìm thấy phòng có mã "' + code + '"', { kind: 'err' }); if (!A.room) showHome(); return; }
      var mem = await A.store.get('rooms/' + code + '/members/' + A.user.id).catch(function () { return null; });
      if (mem) { enterRoom(code); return; }
      showJoin(code, meta);
    } catch (e) { U.toast('Lỗi kết nối: ' + (e.message || e), { kind: 'err' }); if (!A.room) showHome(); }
  }

  async function showJoin(id, meta) {
    var app = appRoot(), owner = await A.store.get('users/' + meta.owner + '/name').catch(function () { return null; });
    var btn = h('button.btn.primary.block', { disabled: !!meta.locked, onclick: join }, U.icon('plus', 16), 'Tham gia phòng');
    async function join() {
      btn.disabled = true;
      try {
        var now = A.store.now(), up = {};
        up['rooms/' + id + '/members/' + A.user.id] = { name: A.user.name, emoji: A.user.emoji, color: A.user.color, joinedAt: now, showLb: true };
        up['users/' + A.user.id + '/rooms/' + id] = { name: meta.name, ts: now };
        await A.store.update(up); enterRoom(id, { isNew: true });
      } catch (e) { btn.disabled = false; console.error(e); U.toast('Không vào được: ' + (e.code === 'PERMISSION_DENIED' || /permission/i.test(e.message || '') ? 'phòng đã khoá hoặc bạn không có quyền.' : e.message), { kind: 'err' }); }
    }
    app.appendChild(h('div.auth', h('div.card.glass.auth-card', brand(),
      h('h3', 'Phòng "' + meta.name + '"'),
      h('p.muted', owner ? 'Chủ phòng: ' + owner : null),
      meta.locked ? h('div.note.warn', U.icon('lock', 16), ' Chủ phòng đã khoá phòng, hiện không nhận thêm người. Hãy nhờ chủ phòng mở lại.') : h('p', 'Bạn đang đăng nhập là ', h('b', A.user.name), '. Tham gia phòng này?'),
      btn, h('button.btn.ghost.block', { onclick: function () { showHome(); } }, 'Về danh sách phòng'))));
  }

  /* ================= VÀO PHÒNG & ĐỒNG BỘ ================= */
  function stopRoom() { A.unsubs.forEach(function (u) { try { u(); } catch (e) { } }); A.unsubs = []; }
  async function enterRoom(id, opt) {
    opt = opt || {}; stopRoom();
    try {
      var r = await Promise.all([A.store.get('rooms/' + id + '/meta'), A.store.get('rooms/' + id + '/members/' + A.user.id).catch(function () { return null; })]);
      var meta = r[0], me = r[1];
      if (!meta || !me) {
        A.store.set('users/' + A.user.id + '/rooms/' + id, null).catch(function () { });
        showHome(!meta ? 'Phòng này không còn tồn tại.' : 'Bạn không còn là thành viên của phòng này.'); return;
      }
      A.room = { id: id, meta: meta }; A.ord[id] = Date.now(); U.lsSet('rc_ord_' + A.user.id, A.ord);
      if (!A.idx[id] || A.idx[id].name !== meta.name) A.store.set('users/' + A.user.id + '/rooms/' + id, { name: meta.name, ts: (A.idx[id] && A.idx[id].ts) || A.store.now() }).catch(function () { });
      A.me = Object.assign({ id: A.user.id }, me);
      A.members = {}; A.sched = {}; A.channels = {}; A.notifs = []; A.chatSel = null; A.notifReady = false; A.notifSeen = {}; A.onIdx = null;
      var pending = 4, resolveReady, ready = new Promise(function (rs) { resolveReady = rs; }), got = {};
      function once(k) { return function () { if (!got[k]) { got[k] = 1; if (--pending === 0) resolveReady(); } }; }
      var d1 = once('m'), d2 = once('s'), d3 = once('c'), d4 = once('n');
      function kicked() { if (A.room && A.room.id === id) { stopRoom(); A.store.set('users/' + A.user.id + '/rooms/' + id, null).catch(function () { }); showHome('Bạn không còn là thành viên của phòng "' + meta.name + '".'); } }
      A.unsubs.push(A.store.listen('rooms/' + id + '/meta', function (v) {
        if (!A.room || A.room.id !== id) return;
        if (!v) { stopRoom(); A.store.set('users/' + A.user.id + '/rooms/' + id, null).catch(function () { }); showHome('Phòng "' + meta.name + '" đã bị chủ phòng xoá.'); return; }
        var chg = JSON.stringify(v) !== JSON.stringify(A.room.meta); A.room.meta = v;
        if (chg) { var rn = $('.rname'); if (rn) rn.textContent = v.name; A.dirty('meta'); }
      }, { onError: kicked }));
      A.unsubs.push(A.store.listen(A.path('members'), function (v) {
        A.members = v || {};
        if (A.shellReady && !A.members[A.me.id]) { kicked(); return; }
        if (A.members[A.me.id]) A.me = Object.assign({ id: A.me.id }, A.members[A.me.id]);
        d1(); A.dirty('members');
      }, { onError: kicked }));
      A.unsubs.push(A.store.listen(A.path('sched'), function (v) { A.sched = v || {}; d2(); A.dirty('sched'); }, { onError: kicked }));
      A.unsubs.push(A.store.listen(A.path('channels'), function (v) { A.channels = v || {}; d3(); A.dirty('channels'); }, { onError: kicked }));
      A.unsubs.push(A.store.listen(A.path('notifs/' + A.me.id), onNotifs, { limitLast: 60, onError: function () { d4(); } }));
      A._nFirst = d4;
      A.shellReady = false;
      await ready;
      if (!A.channels.general) A.store.set(A.path('channels/general'), { title: 'Cả phòng', kind: 'room', ts: A.store.now(), by: A.me.id }).catch(function () { });
      renderShell(); A.shellReady = true;
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      if (opt.isNew) { A.go('me'); U.toast('Chào mừng! Bắt đầu bằng việc thêm thói quen (giờ ngủ, giờ học) cho nhanh.', { ms: 5000 }); }
      else A.go(Views[A.pf.view] ? A.pf.view : 'group');
    } catch (e) { console.error(e); showHome('Không vào được phòng: ' + (e.message || e)); }
  }
  A.enterRoom = enterRoom;
  A.exitRoom = function () { stopRoom(); A.room = null; A.shellReady = false; showHome(); };

  /* ---- Rời phòng / xoá người / chuyển quyền / xoá phòng ---- */
  function wipeMember(uid) {
    var o = {}; o[A.path('members/' + uid)] = null; o[A.path('sched/' + uid)] = null; o[A.path('notifs/' + uid)] = null; return o;
  }
  A.kickMember = function (m) {
    return U.confirm('Xoá ' + m.name + ' khỏi phòng?', 'Lịch của bạn ấy trong phòng này sẽ bị xoá. Bạn ấy vẫn có thể vào lại bằng link nếu phòng chưa khoá.', 'Xoá khỏi phòng', true).then(function (ok) {
      if (!ok) return; return A.store.update(wipeMember(m.id)).then(function () { U.toast('Đã xoá ' + m.name + ' khỏi phòng'); }, function (e) { U.toast('Không xoá được: ' + (e.message || e), { kind: 'err' }); });
    });
  };
  A.setOwner = function (m) {
    return U.confirm('Chuyển quyền chủ phòng cho ' + m.name + '?', 'Bạn sẽ trở thành thành viên thường. Chỉ chủ phòng mới xoá được người khác hoặc xoá phòng.', 'Chuyển quyền').then(function (ok) {
      if (!ok) return; return A.store.set(A.path('meta/owner'), m.id).then(function () { U.toast(m.name + ' là chủ phòng mới'); }, function (e) { U.toast('Không chuyển được: ' + (e.message || e), { kind: 'err' }); });
    });
  };
  function doLeave() {
    var rid = A.room.id, o = wipeMember(A.me.id); o['users/' + A.user.id + '/rooms/' + rid] = null;
    stopRoom(); A.shellReady = false;
    return A.store.update(o).then(function () { A.room = null; showHome('Bạn đã rời phòng.'); }, function (e) { U.toast('Không rời được: ' + (e.message || e), { kind: 'err' }); });
  }
  A.leaveRoom = function () {
    if (!A.isOwner()) {
      return U.confirm('Rời phòng "' + A.room.meta.name + '"?', 'Lịch của bạn trong phòng này sẽ bị xoá. Muốn quay lại, bạn cần link mời.', 'Rời phòng', true).then(function (ok) { if (ok) doLeave(); });
    }
    var others = A.memberList().filter(function (m) { return m.id !== A.me.id; });
    if (!others.length) return U.toast('Bạn là người duy nhất trong phòng. Hãy dùng "Xoá phòng" nếu không cần nữa.', { kind: 'err' });
    var sel = null, pk = h('div.mrows');
    function draw() {
      U.clear(pk); others.forEach(function (m) { pk.appendChild(h('button.mem-row' + (sel === m.id ? '.on' : ''), { onclick: function () { sel = m.id; draw(); } }, U.avatar(m, 30), h('b', m.name))); });
    }
    draw();
    var mm = U.modal({
      title: 'Chọn chủ phòng mới', body: h('div', h('p', 'Chủ phòng không thể rời đi khi chưa giao lại quyền. Chọn người sẽ thay bạn:'), h('div.scroll-box', pk)),
      actions: [h('button.btn.ghost', { onclick: function () { mm.close(); } }, 'Huỷ'), h('button.btn.danger', { onclick: async function () { if (!sel) { U.toast('Hãy chọn một người', { kind: 'err' }); return; } try { await A.store.set(A.path('meta/owner'), sel); mm.close(); doLeave(); } catch (e) { U.toast('Không chuyển được quyền: ' + (e.message || e), { kind: 'err' }); } } }, 'Giao quyền và rời phòng')]
    });
  };
  A.deleteRoom = function () {
    return U.confirm('Xoá cả phòng?', 'Toàn bộ lịch, tin nhắn và thành viên sẽ bị xoá vĩnh viễn, không khôi phục được.', 'Xoá phòng', true).then(function (ok) {
      if (!ok) return; var rid = A.room.id; stopRoom(); A.shellReady = false;
      return A.store.set('rooms/' + rid, null).then(function () { return A.store.set('users/' + A.user.id + '/rooms/' + rid, null); }).then(function () { A.room = null; showHome('Đã xoá phòng.'); }, function (e) { U.toast('Không xoá được: ' + (e.message || e), { kind: 'err' }); });
    });
  };

  /* ================= KHUNG GIAO DIỆN CHÍNH ================= */
  var TABS = [['group', 'Nhóm', 'users'], ['me', 'Lịch của tôi', 'cal'], ['chat', 'Chat', 'chat'], ['settings', 'Cài đặt', 'sliders']];
  function renderShell() {
    var app = appRoot(); A._shell = true;
    var bell = h('button.icon-btn.bell#bell', { title: 'Thông báo', onclick: openBell }, U.icon('bell'), h('span.dot#bell-dot'));
    app.appendChild(h('div.shell',
      h('header.topbar.glass',
        h('button.icon-btn', { title: 'Danh sách phòng của tôi', onclick: A.exitRoom }, U.icon('home')),
        h('button.room-btn', { onclick: openRoomMenu }, h('span.logo.sm', U.icon('spark', 16)), h('span.rname', A.room.meta.name), U.icon('chevd', 16)),
        h('div.spacer'),
        h('span.conn#conn', { title: 'Trạng thái kết nối' }),
        bell, h('button.me-btn', { title: 'Tài khoản', onclick: A.accountModal }, U.avatar(A.me, 34))),
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
    if (!A.room || !A.me) return;
    var cb = $('#chat-badge'), n = chatUnread(), un = unreadNotifs().length, bd = $('#bell-dot');
    if (cb) { cb.textContent = n > 9 ? '9+' : n; cb.style.display = n ? 'inline-flex' : 'none'; }
    if (bd) { bd.textContent = un > 9 ? '9+' : un; bd.style.display = un ? 'inline-flex' : 'none'; }
    document.title = (un ? '(' + un + ') ' : '') + APP_NAME;
  }
  A.updateBadges = updateBadges;

  /* ---------- Thông báo ---------- */
  function onNotifs(v) {
    var list = Sched.objVals(v).sort(function (a, b) { return b.v.ts - a.v.ts; });
    var fresh = list.filter(function (n) { return !A.notifSeen[n.id]; });
    list.forEach(function (n) { A.notifSeen[n.id] = 1; });
    A.notifs = list;
    if (A.notifReady) fresh.forEach(function (n) { if (!n.v.read) alertNotif(n); });
    A.notifReady = true; if (A._nFirst) { A._nFirst(); A._nFirst = null; }
    A.dirty('notifs');
  }
  function notifText(n) {
    var who = A.dn(n.v.by, n.v.ch), ch = A.channels[n.v.ch], cn = ch ? ch.title : 'một nhóm';
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
  function openRoomMenu() {
    var link = A.inviteLink(), others = Object.keys(A.idx).filter(function (id) { return id !== A.room.id; }).sort(function (a, b) { return (A.ord[b] || 0) - (A.ord[a] || 0); });
    var rooms = others.slice(0, 6).map(function (id) {
      return h('button.room-item', { onclick: function () { m.close(); enterRoom(id); } }, h('b', A.idx[id].name || id), h('span.muted', 'mã ' + id), U.icon('right', 18));
    });
    var m = U.modal({
      title: A.room.meta.name,
      body: h('div.form',
        h('div.fld', h('span', 'Mời bạn bè: gửi link này (hoặc mã phòng)'),
          h('div.row', h('input.inp', { value: link, readOnly: true, onfocus: function (e) { e.target.select(); } }),
            h('button.btn', { onclick: function () { U.copy(link).then(function () { U.toast('Đã copy link mời'); }); } }, U.icon('copy', 16), 'Copy'))),
        h('p.muted', 'Mã phòng: ', h('b', A.room.id), '. Người có link phải đăng nhập (tên không trùng) mới vào được. ', A.isOwner() ? 'Bạn có thể khoá phòng trong Cài đặt.' : ''),
        rooms.length ? h('div.sect', h('h4', 'Chuyển nhanh sang phòng khác'), h('div.room-list', rooms)) : null),
      actions: [h('button.btn.ghost', { onclick: function () { m.close(); A.exitRoom(); } }, U.icon('home', 16), 'Tất cả phòng của tôi'), h('button.btn.primary', { onclick: function () { m.close(); } }, 'Xong')]
    });
  }

  /* ---------- Khởi động ---------- */
  async function boot() {
    A.applyTheme();
    try { A.store = await Store.create(root.FIREBASE_CONFIG); }
    catch (e) { console.error(e); appRoot().appendChild(h('div.auth', h('div.card.glass.auth-card', brand(), h('div.note.warn', 'Không kết nối được Firebase: ' + e.message + '. Kiểm tra lại js/config.js.')))); return; }
    var hm = /[#&]r=([a-z0-9]+)/i.exec(location.hash);
    if (hm) A.pendingCode = hm[1].toLowerCase();
    var first = true;
    A.store.auth.onChange(function (u) {
      if (A.authBusy) return;
      if (!u) { stopRoom(); A.room = null; A.user = null; first = false; showAuth(); return; }
      if (A.user && A.user.id === u.uid) return;
      first = false; startSession(u);
    });
  }
  root.addEventListener('hashchange', function () {
    var hm = /[#&]r=([a-z0-9]+)/i.exec(location.hash); if (!hm) return;
    var code = hm[1].toLowerCase();
    if (!A.user) { A.pendingCode = code; return; }
    if (!A.room || A.room.id !== code) openByCode(code);
  });
  document.addEventListener('DOMContentLoaded', boot);
})(window);
