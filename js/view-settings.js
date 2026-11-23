/* view-settings.js - Hồ sơ, giao diện & nền, thông báo, quản lý phòng */
(function (root) {
  'use strict';
  var h = U.h, S = { el: null };

  function saveMember(patch) { return A.store.update(Object.keys(patch).reduce(function (o, k) { o[A.path('members/' + A.me.id + '/' + k)] = patch[k]; return o; }, {})); }
  function sec(title, desc, body) { return h('section.card.glass.st-sec', h('h3', title), desc ? h('p.muted.sm', desc) : null, body); }
  function apply() { A.savePf(); A.applyTheme(); }

  S.q = '';
  S.render = function (el) {
    S.el = el; S.draw();
  };
  S.update = function (k) { if ((k.members || k.meta) && !S.busy) S.draw(); };
  S.draw = function () {
    var el = U.clear(S.el), me = A.me;
    el.appendChild(h('div.settings', profile(me), look(), notif(), importCard(), room()));
  };

  /* ---- Hồ sơ ---- */
  function profile(me) {
    return sec('Tài khoản của tôi', null, h('div',
      h('div.row.prof', U.avatar(me, 56), h('div', h('b', me.name), h('div.muted.sm', A.isOwner() ? 'Chủ phòng này' : 'Thành viên')),
        h('button.btn.sm', { onclick: A.accountModal }, U.icon('edit', 16), 'Biểu tượng, màu, mật khẩu')),
      h('label.chk.mt', h('input', { type: 'checkbox', checked: me.showLb !== false, onchange: function (e) { saveMember({ showLb: e.target.checked }); } }), h('span', 'Cho bạn bè trong phòng này xem tên việc/thói quen của tôi (nếu tắt, họ chỉ thấy Rảnh/Bận)')),
      h('div.row', h('button.btn', { onclick: A.exitRoom }, U.icon('home', 16), 'Danh sách phòng của tôi'),
        h('button.btn.ghost', { onclick: function () { U.confirm('Đăng xuất?', 'Bạn sẽ cần nhập lại tên và mật khẩu để vào lại. Dữ liệu của bạn vẫn được giữ.', 'Đăng xuất').then(function (ok) { if (ok) A.logout(); }); } }, U.icon('logout', 16), 'Đăng xuất'))));
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
    var link = A.inviteLink(), owner = A.isOwner(), meta = A.room.meta, all = A.memberList();
    var q = h('input.inp.sm', { placeholder: 'Tìm thành viên…', value: S.q, oninput: function (e) { S.q = U.norm(e.target.value); drawList(); } });
    var listEl = h('div.mlist.scroll-box');
    function drawList() {
      U.clear(listEl);
      var v = all.filter(function (m) { return !S.q || U.norm(m.name).indexOf(S.q) >= 0; });
      v.forEach(function (m) {
        listEl.appendChild(h('div.mrow', U.avatar(m, 34), h('div.mi-n', h('b', m.name), m.id === meta.owner ? h('span.tag', 'chủ phòng') : null, m.id === A.me.id ? h('span.muted.sm', ' (bạn)') : null),
          owner && m.id !== A.me.id ? h('div.row', h('button.btn.sm.ghost', { title: 'Giao quyền chủ phòng cho người này', onclick: function () { A.setOwner(m); } }, U.icon('crown', 16)),
            h('button.btn.sm.ghost.dng', { onclick: function () { A.kickMember(m); } }, U.icon('trash', 16), 'Xoá')) : null));
      });
      if (!v.length) listEl.appendChild(h('p.muted.sm', 'Không có ai khớp.'));
    }
    drawList();
    var ownerTools = owner ? h('div.fld', h('span', 'Đặc quyền chủ phòng'),
      h('div.row.wrap',
        h('button.btn.sm', { onclick: renameRoom }, U.icon('edit', 16), 'Đổi tên phòng'),
        h('button.btn.sm', { onclick: function () { A.store.set(A.path('meta/locked'), meta.locked ? null : true).then(function () { U.toast(meta.locked ? 'Đã mở lại phòng' : 'Đã khoá phòng: không nhận thêm người'); }, function (e) { U.toast('Lỗi: ' + (e.message || e), { kind: 'err' }); }); } }, U.icon('lock', 16), meta.locked ? 'Mở khoá phòng' : 'Khoá phòng (ngừng nhận người mới)'))) : null;
    return sec('Phòng "' + meta.name + '"', null, h('div',
      h('div.fld', h('span', 'Link mời bạn bè'), h('div.row', h('input.inp', { value: link, readOnly: true, onfocus: function (e) { e.target.select(); } }), h('button.btn', { onclick: function () { U.copy(link).then(function () { U.toast('Đã copy link mời'); }); } }, U.icon('copy', 16), 'Copy'))),
      h('p.muted.sm', 'Mã phòng: ', h('b', A.room.id), '. Người có link phải đăng nhập (tên không trùng) mới vào được.', meta.locked ? ' Phòng đang khoá.' : ''),
      ownerTools,
      h('h4.mt', 'Thành viên (' + all.length + ')'), all.length > 6 ? q : null, listEl,
      h('div.row.mt.wrap',
        owner ? h('button.btn', { onclick: A.leaveRoom }, U.icon('logout', 16), 'Giao quyền & rời phòng') : h('button.btn', { onclick: A.leaveRoom }, U.icon('logout', 16), 'Rời phòng'),
        owner ? h('button.btn.danger', { onclick: A.deleteRoom }, U.icon('trash', 16), 'Xoá phòng') : null)));
  }
  function renameRoom() {
    U.prompt('Đổi tên phòng', 'Tên phòng mới', A.room.meta.name, { max: 40 }).then(function (v) {
      if (!v || v === A.room.meta.name) return;
      A.store.set(A.path('meta/name'), v).then(function () { U.toast('Đã đổi tên phòng'); }, function (e) { U.toast('Lỗi: ' + (e.message || e), { kind: 'err' }); });
    });
  }

  Views.settings = S;
})(window);
