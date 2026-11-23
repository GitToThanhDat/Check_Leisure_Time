/* view-settings.js - Hồ sơ, giao diện & nền, thông báo, quản lý phòng */
(function (root) {
  'use strict';
  var h = U.h, S = { el: null };

  function saveMember(patch) { return A.store.update(Object.keys(patch).reduce(function (o, k) { o[A.path('members/' + A.me.id + '/' + k)] = patch[k]; return o; }, {})); }
  function sec(title, desc, body) { return h('section.card.glass.st-sec', h('h3', title), desc ? h('p.muted.sm', desc) : null, body); }
  function apply() { A.savePf(); A.applyTheme(); }

  S.render = function (el) {
    S.el = el; S.draw();
  };
  S.update = function (k) { if (k.members && !S.busy) S.draw(); };
  S.draw = function () {
    var el = U.clear(S.el), me = A.me;
    el.appendChild(h('div.settings', profile(me), look(), notif(), importCard(), room()));
  };

  /* ---- Hồ sơ ---- */
  function profile(me) {
    var emo = h('div.pick'), col = h('div.pick');
    function draw() {
      U.clear(emo); U.clear(col);
      U.EMOJIS.forEach(function (e) { emo.appendChild(h('button.pk' + (A.me.emoji === e ? '.on' : ''), { onclick: function () { saveMember({ emoji: e }); } }, e)); });
      U.COLORS.forEach(function (c) { col.appendChild(h('button.pk.sw' + (A.me.color === c ? '.on' : ''), { style: { background: c }, onclick: function () { saveMember({ color: c }); } })); });
    }
    draw();
    return sec('Hồ sơ của tôi', null, h('div',
      h('div.row.prof', U.avatar(me, 56), h('div', h('b', me.name), h('div.muted.sm', A.isOwner() ? 'Chủ phòng' : 'Thành viên')),
        h('button.btn.sm', { onclick: rename }, U.icon('edit', 16), 'Đổi tên')),
      h('div.fld.mt', h('span', 'Biểu tượng'), emo), h('div.fld', h('span', 'Màu'), col),
      h('label.chk', h('input', { type: 'checkbox', checked: me.showLb !== false, onchange: function (e) { saveMember({ showLb: e.target.checked }); } }), h('span', 'Cho bạn bè xem tên việc/thói quen của tôi (nếu tắt, họ chỉ thấy Rảnh/Bận)')),
      h('div.row', h('button.btn.sm', { onclick: changePin }, 'Đổi mã PIN'))));
  }
  function rename() {
    U.prompt('Đổi tên', 'Tên hiển thị mới', A.me.name, { max: 24 }).then(function (v) {
      if (!v || v === A.me.name) return;
      if (A.memberList().some(function (m) { return m.id !== A.me.id && U.norm(m.name) === U.norm(v); })) { U.toast('Đã có người dùng tên này trong phòng', { kind: 'err' }); return; }
      saveMember({ name: v });
    });
  }
  function changePin() {
    var cur = h('input.inp', { type: 'password', inputMode: 'numeric', maxLength: 6, placeholder: 'PIN hiện tại' }), n1 = h('input.inp', { type: 'password', inputMode: 'numeric', maxLength: 6, placeholder: 'PIN mới (4–6 số)' });
    var m = U.modal({
      title: 'Đổi mã PIN', body: h('div.form', h('div.fld', cur), h('div.fld', n1)),
      actions: [h('button.btn.ghost', { onclick: function () { m.close(); } }, 'Huỷ'), h('button.btn.primary', { onclick: go }, 'Đổi PIN')]
    });
    async function go() {
      if (!/^\d{4,6}$/.test(n1.value)) { U.toast('PIN mới phải gồm 4–6 chữ số', { kind: 'err' }); return; }
      if ((await U.pinHash(A.room.id, A.me.id, cur.value)) !== A.me.ph) { U.toast('PIN hiện tại chưa đúng', { kind: 'err' }); return; }
      var ph = await U.pinHash(A.room.id, A.me.id, n1.value); await saveMember({ ph: ph });
      A.sess.rooms.forEach(function (r) { if (r.id === A.room.id) r.ph = ph; }); A.saveSess(); m.close(); U.toast('Đã đổi PIN');
    }
  }

  /* ---- Giao diện ---- */
  function look() {
    var pf = A.pf;
    var sw = h('div.bg-grid', Bg.PRESETS.map(function (p) {
      return h('button.bg-sw' + (pf.bg === p.id ? '.on' : ''), { onclick: function () { pf.bg = p.id; apply(); S.draw(); } }, h('span.bgc', { style: { background: p.sw } }, p.id === 'image' ? U.icon('image', 22) : null), h('span', p.name));
    }));
    var imgBox = null;
    if (pf.bg === 'image') {
      var file = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' }, onchange: function (e) { var f = e.target.files[0]; if (!f) return; Bg.setImageFile(f).then(function () { pf.bgUrl = ''; apply(); U.toast('Đã đặt ảnh nền'); }, function (er) { U.toast(er.message, { kind: 'err' }); }); } });
      var url = h('input.inp', { placeholder: 'hoặc dán link ảnh (https://...)', value: pf.bgUrl || '' });
      imgBox = h('div.fld.mt', h('div.row', h('button.btn.sm', { onclick: function () { file.click(); } }, U.icon('upload', 16), 'Chọn ảnh từ máy'), file,
        h('button.btn.sm.ghost', { onclick: function () { pf.bgUrl = url.value.trim(); apply(); } }, 'Dùng link')), url,
        h('p.hint', 'Ảnh chỉ lưu trên thiết bị của bạn, không gửi cho ai. Nên chọn ảnh tối hoặc làm mờ để chữ dễ đọc.'));
    }
    function slider(label, key, min, max, step, fmt) {
      var v = h('b', fmt(pf[key] || 0)), r = h('input', { type: 'range', min: min, max: max, step: step, value: pf[key] || 0, oninput: function (e) { pf[key] = +e.target.value; v.textContent = fmt(pf[key]); apply(); } });
      return h('label.fld.sl', h('span', label, ' ', v), r);
    }
    return sec('Giao diện & hình nền', 'Cài đặt này chỉ áp dụng cho máy của bạn.', h('div',
      h('div.seg', [['auto', 'Theo nền'], ['dark', 'Tối'], ['light', 'Sáng']].map(function (x) { return h('button' + (pf.theme === x[0] ? '.on' : ''), { onclick: function () { pf.theme = x[0]; apply(); S.draw(); } }, x[0] === 'dark' ? U.icon('moon', 16) : x[0] === 'light' ? U.icon('sun', 16) : null, ' ', x[1]); })),
      sw, imgBox,
      slider('Độ tối/sáng lớp phủ', 'bgDim', 0, 0.8, 0.05, function (v) { return Math.round(v * 100) + '%'; }),
      slider('Làm mờ nền', 'bgBlur', 0, 20, 1, function (v) { return v + 'px'; }),
      h('label.chk', h('input', { type: 'checkbox', checked: pf.motion !== false, onchange: function (e) { pf.motion = e.target.checked; apply(); } }), h('span', 'Nền chuyển động (tắt để tiết kiệm pin)')),
      h('label.chk', h('input', { type: 'checkbox', checked: pf.sound !== false, onchange: function (e) { pf.sound = e.target.checked; A.savePf(); if (pf.sound) U.ding(); } }), h('span', 'Phát âm báo khi có thông báo mới'))));
  }

  /* ---- Thông báo ---- */
  function notif() {
    var sup = !!root.Notification, perm = sup ? Notification.permission : 'unsupported';
    var txt = { granted: 'Đã bật popup khi bạn bị tag lúc tab ở dưới nền.', denied: 'Trình duyệt đang chặn thông báo. Hãy mở cài đặt trang web để cho phép.', default: 'Chưa bật. Bật để có popup khi ai đó tag/rủ bạn.', unsupported: 'Trình duyệt này không hỗ trợ popup thông báo.' }[perm];
    return sec('Thông báo', 'Khi ai đó tag @bạn hoặc rủ bạn đi chơi, bạn sẽ nhận chuông + chấm đỏ trong web, và popup nếu bạn bật. Lưu ý: bản miễn phí chỉ báo được khi web đang mở (kể cả ở tab nền).',
      h('div', h('p.sm', txt), perm === 'default' ? h('button.btn.sm.primary', { onclick: function () { Notification.requestPermission().then(function () { S.draw(); }); } }, U.icon('bell', 16), 'Bật popup thông báo') : null));
  }

  function importCard() {
    return sec('Nhập lịch nhanh bằng ảnh', 'Chụp lịch/thời khoá biểu, nhờ AI chuyển thành file rồi nhập vào đây.',
      h('div.row', h('button.btn.primary', { onclick: function () { Imp.open(); } }, U.icon('spark', 16), 'Nhập từ ảnh lịch (AI)')));
  }

  /* ---- Phòng ---- */
  function room() {
    var link = A.inviteLink(), owner = A.isOwner();
    var list = A.memberList().map(function (m) {
      return h('div.mrow', U.avatar(m, 34), h('div.mi-n', h('b', m.name), m.id === A.room.meta.owner ? h('span.tag', 'chủ phòng') : null, m.id === A.me.id ? h('span.muted.sm', ' (bạn)') : null),
        owner && m.id !== A.me.id ? h('div.row', h('button.btn.sm.ghost', { onclick: function () { resetPin(m); } }, 'Đặt lại PIN'), h('button.btn.sm.ghost.dng', { onclick: function () { kick(m); } }, 'Xoá')) : null);
    });
    return sec('Phòng "' + A.room.meta.name + '"', null, h('div',
      h('div.fld', h('span', 'Link mời bạn bè'), h('div.row', h('input.inp', { value: link, readOnly: true, onfocus: function (e) { e.target.select(); } }), h('button.btn', { onclick: function () { U.copy(link).then(function () { U.toast('Đã copy link mời'); }); } }, U.icon('copy', 16), 'Copy'))),
      h('p.muted.sm', 'Mã phòng: ', h('b', A.room.id), '. Ai có link/mã đều vào được phòng, chỉ gửi cho người bạn tin.'),
      h('h4.mt', 'Thành viên (' + list.length + ')'), h('div.mlist', list),
      h('div.row.mt', h('button.btn', { onclick: function () { U.confirm('Đăng xuất khỏi phòng này?', 'Bạn sẽ cần chọn lại tên và nhập PIN để vào lại. Lịch của bạn vẫn được giữ.', 'Đăng xuất').then(function (ok) { if (ok) A.logout(); }); } }, U.icon('logout', 16), 'Đăng xuất'),
        owner ? h('button.btn.danger', { onclick: delRoom }, U.icon('trash', 16), 'Xoá phòng') : null)));
  }
  function resetPin(m) {
    U.prompt('Đặt lại PIN cho ' + m.name, 'PIN mới (4–6 số) — hãy nhắn cho bạn ấy', '', { inputMode: 'numeric', max: 6, ok: 'Đặt lại' }).then(async function (v) {
      if (v == null) return; if (!/^\d{4,6}$/.test(v)) { U.toast('PIN phải gồm 4–6 chữ số', { kind: 'err' }); return; }
      await A.store.set(A.path('members/' + m.id + '/ph'), await U.pinHash(A.room.id, m.id, v)); U.toast('Đã đặt lại PIN cho ' + m.name);
    });
  }
  function kick(m) {
    U.confirm('Xoá ' + m.name + ' khỏi phòng?', 'Lịch và thông báo của bạn ấy sẽ bị xoá.', 'Xoá', true).then(function (ok) {
      if (!ok) return; var o = {}; o[A.path('members/' + m.id)] = null; o[A.path('sched/' + m.id)] = null; o[A.path('notifs/' + m.id)] = null; A.store.update(o);
    });
  }
  function delRoom() {
    U.confirm('Xoá cả phòng?', 'Toàn bộ lịch, tin nhắn và thành viên sẽ bị xoá vĩnh viễn, không khôi phục được.', 'Xoá phòng', true).then(function (ok) {
      if (!ok) return; var id = A.room.id; A.store.set('rooms/' + id, null).then(function () { A.logout(); });
    });
  }

  Views.settings = S;
})(window);
