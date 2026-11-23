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
    var role = A.roleOf(me.id);
    var nick = h('input.inp.sm', { value: me.nick || '', maxLength: 24, placeholder: 'Để trống = dùng tên "' + me.name + '"', onfocus: function () { S.busy = true; }, onblur: function () { S.busy = false; }, onkeydown: function (e) { if (e.key === 'Enter') { e.preventDefault(); saveNick(); } } });
    function saveNick() {
      var v = nick.value.trim().replace(/\s+/g, ' '); if (v === (me.nick || '')) return;
      saveMember({ nick: v || null }).then(function () { U.toast(v ? 'Đã đặt biệt danh "' + v + '" cho phòng này' : 'Đã bỏ biệt danh, dùng lại tên thật'); }, function (e) { U.toast('Lỗi: ' + (e.message || e), { kind: 'err' }); });
    }
    return sec('Tài khoản của tôi', null, h('div',
      h('div.row.prof', U.avatar(me, 56), h('div.prof-i', h('b', me.name), h('div.muted.sm', role === 'owner' ? 'Chủ phòng này' : role === 'deputy' ? 'Phó phòng' : 'Thành viên')),
        h('button.btn.sm', { onclick: A.accountModal }, U.icon('edit', 16), 'Chỉnh sửa tài khoản')),
      h('div.fld.mt', h('span', 'Biệt danh trong phòng này'),
        h('div.row', nick, h('button.btn.sm.primary', { onclick: saveNick }, 'Lưu')),
        h('p.hint', 'Tên đăng nhập của bạn không đổi. Biệt danh này hiện thay tên của bạn trong mọi đoạn chat của phòng này (người khác vẫn có thể đặt biệt danh riêng cho bạn trong từng nhóm chat).')),
      h('label.chk.mt', h('input', { type: 'checkbox', checked: me.showLb !== false, onchange: function (e) { saveMember({ showLb: e.target.checked }); } }), h('span', 'Cho bạn bè trong phòng này xem tên việc/thói quen của tôi (nếu tắt, họ chỉ thấy Rảnh/Bận)')),
      h('div.row.wrap', h('button.btn', { onclick: A.exitRoom }, U.icon('home', 16), 'Danh sách phòng của tôi'),
        h('button.btn.ghost', { onclick: function () { U.confirm('Đăng xuất?', 'Bạn sẽ cần đăng nhập lại để vào lại. Dữ liệu của bạn vẫn được giữ.', 'Đăng xuất').then(function (ok) { if (ok) A.logout(); }); } }, U.icon('logout', 16), 'Đăng xuất'))));
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
    var link = A.inviteLink(), owner = A.isOwner(), mod = A.isMod(), meta = A.room.meta, all = A.memberList();
    var q = h('input.inp.sm', { placeholder: 'Tìm thành viên…', value: S.q, oninput: function (e) { S.q = U.norm(e.target.value); drawList(); } });
    var listEl = h('div.mlist.scroll-box');
    var ROLE = { owner: 'chủ phòng', deputy: 'phó phòng' };
    function drawList() {
      U.clear(listEl);
      var rank = { owner: 0, deputy: 1, member: 2 };
      var v = all.filter(function (m) { return !S.q || U.norm(m.name + ' ' + (m.nick || '')).indexOf(S.q) >= 0; }).sort(function (a, b) { return rank[A.roleOf(a.id)] - rank[A.roleOf(b.id)]; });
      v.forEach(function (m) {
        var role = A.roleOf(m.id), acts = [];
        if (owner && m.id !== A.me.id) {
          acts.push(h('button.btn.sm.ghost', { title: role === 'deputy' ? 'Bỏ quyền phó phòng' : 'Bổ nhiệm làm phó phòng', onclick: function () { A.setDeputy(m, role !== 'deputy'); } }, U.icon('shield', 16), role === 'deputy' ? 'Bỏ phó' : 'Phó phòng'));
          acts.push(h('button.btn.sm.ghost', { title: 'Giao quyền chủ phòng cho người này', onclick: function () { A.setOwner(m); } }, U.icon('crown', 16)));
        }
        if (A.canKick(m)) acts.push(h('button.btn.sm.ghost.dng', { onclick: function () { A.kickMember(m); } }, U.icon('trash', 16), 'Xoá'));
        listEl.appendChild(h('div.mrow', U.avatar(m, 34), h('div.mi-n', h('b', m.name), m.nick ? h('span.muted.sm', ' · ' + m.nick) : null, ROLE[role] ? h('span.tag' + (role === 'deputy' ? '.dep' : ''), ROLE[role]) : null, m.id === A.me.id ? h('span.muted.sm', ' (bạn)') : null),
          acts.length ? h('div.row.wrap', acts) : null));
      });
      if (!v.length) listEl.appendChild(h('p.muted.sm', 'Không có ai khớp.'));
    }
    drawList();
    var tools = mod ? h('div.fld', h('span', owner ? 'Đặc quyền chủ phòng' : 'Đặc quyền phó phòng'),
      h('div.row.wrap',
        h('button.btn.sm', { onclick: renameRoom }, U.icon('edit', 16), 'Đổi tên phòng'),
        h('button.btn.sm', { onclick: A.changeInvite }, U.icon('link', 16), 'Đổi link mời'),
        h('button.btn.sm', { onclick: function () { A.store.set(A.path('meta/locked'), meta.locked ? null : true).then(function () { U.toast(meta.locked ? 'Đã mở lại phòng' : 'Đã khoá phòng: không nhận thêm người'); }, function (e) { U.toast('Lỗi: ' + (e.message || e), { kind: 'err' }); }); } }, U.icon('lock', 16), meta.locked ? 'Mở khoá phòng' : 'Khoá phòng (ngừng nhận người mới)')),
      h('label.chk.mt', h('input', { type: 'checkbox', checked: !!meta.modRename, onchange: function (e) { A.store.set(A.path('meta/modRename'), e.target.checked ? true : null).then(function () { U.toast(e.target.checked ? 'Từ giờ chỉ chủ phòng và phó phòng được đổi tên phòng và nhóm chat' : 'Mọi thành viên đều được đổi tên phòng và nhóm chat'); }, function (er) { e.target.checked = !e.target.checked; U.toast('Lỗi: ' + (er.message || er), { kind: 'err' }); }); } }), h('span', 'Chỉ chủ phòng và phó phòng được đổi tên phòng và nhóm chat')),
      h('p.hint', owner ? 'Chủ phòng: mọi quyền, gồm bổ nhiệm phó phòng, chuyển quyền chủ và xoá phòng. Phó phòng: đổi tên, đổi link, khoá phòng, xoá thành viên thường (không xoá được chủ phòng hay phó phòng khác).' : 'Bạn là phó phòng: có thể đổi tên, đổi link, khoá phòng và xoá thành viên thường. Không xoá được chủ phòng hay phó phòng khác.')) : null;
    var card = sec('Phòng "' + meta.name + '"', null, h('div.rm-grid', h('div.rm-l',
      h('div.fld', h('span', 'Link mời bạn bè'), h('div.row', h('input.inp', { value: link, readOnly: true, onfocus: function (e) { e.target.select(); } }), h('button.btn', { onclick: function () { U.copy(link).then(function () { U.toast('Đã copy link mời'); }); } }, U.icon('copy', 16), 'Copy'))),
      h('p.muted.sm', 'Người có link phải đăng nhập mới vào được.', meta.locked ? ' Phòng đang khoá.' : ''),
      h('label.chk', h('input', { type: 'checkbox', checked: A.user.defaultRoom === A.room.id, onchange: function (e) { var on = e.target.checked; A.setDefaultRoom(on ? A.room.id : null).then(function () { U.toast(on ? 'Đã đặt làm phòng mặc định: đăng nhập sẽ vào thẳng phòng này' : 'Đã bỏ phòng mặc định: đăng nhập sẽ hiện danh sách phòng'); }, function () { e.target.checked = !on; }); } }), h('span', 'Đặt làm phòng mặc định (tự vào phòng này mỗi khi đăng nhập; bỏ tích để luôn hiện danh sách phòng)')),
      tools,
      !mod ? h('div.fld', h('span', 'Tên phòng'), A.canRename() ? h('div.row', h('button.btn.sm', { onclick: renameRoom }, U.icon('edit', 16), 'Đổi tên phòng'), h('span.muted.sm', 'Mọi thành viên đều thấy tên mới.')) : h('p.muted.sm', 'Chủ phòng đã bật chế độ chỉ chủ phòng và phó phòng được đổi tên.')) : null,
      h('div.row.mt.wrap',
        owner ? h('button.btn', { onclick: A.leaveRoom }, U.icon('logout', 16), 'Giao quyền & rời phòng') : h('button.btn', { onclick: A.leaveRoom }, U.icon('logout', 16), 'Rời phòng'),
        owner ? h('button.btn.danger', { onclick: A.deleteRoom }, U.icon('trash', 16), 'Xoá phòng') : null)),
      h('div.rm-r', h('h4', 'Thành viên (' + all.length + ')'), all.length > 6 ? q : null, listEl)));
    card.classList.add('st-room');   // thẻ phòng chiếm cả hàng, chia hai cột: cài đặt | thành viên
    return card;
  }
  function renameRoom() {
    U.prompt('Đổi tên phòng', 'Tên phòng mới', A.room.meta.name, { max: 40 }).then(function (v) {
      if (!v || v === A.room.meta.name) return;
      A.store.set(A.path('meta/name'), v).then(function () { U.toast('Đã đổi tên phòng'); }, function (e) { U.toast('Lỗi: ' + (e.message || e), { kind: 'err' }); });
    });
  }

  Views.settings = S;
})(window);
