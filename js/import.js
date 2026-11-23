/* import.js - nhập lịch từ JSON (do AI khác đọc ảnh tạo ra) + prompt copy sẵn + xuất sao lưu */
(function (root) {
  'use strict';
  var h = U.h;
  var DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], ST = { free: 'Rảnh', busy: 'Bận', maybe: 'Có thể' };

  function buildPrompt(slotTable) {
    var t = new Date(), today = U.fmtDate(U.today(), true) + '/' + t.getFullYear();
    var slot = slotTable && slotTable.trim()
      ? 'Lịch của tôi ghi theo tiết/slot. Hãy đổi sang giờ thật bằng bảng sau:\n' + slotTable.trim()
      : 'Nếu lịch ghi theo "tiết/slot" mà tôi không đưa bảng giờ, hãy hỏi lại tôi bảng giờ trước khi trả JSON.';
    return [
      'Bạn là trợ lý chuyển ảnh lịch thành dữ liệu. Tôi gửi kèm ảnh chụp lịch của tôi (thời khoá biểu, lịch làm việc, lịch Google/Outlook...). Hãy đọc kỹ ảnh và trả về DUY NHẤT một khối JSON (đặt trong ```json) theo đúng cấu trúc dưới đây.',
      '',
      'Hôm nay là ' + today + '. Dùng ngày này để suy ra ngày và năm khi ảnh chỉ ghi "Thứ 3", "tuần này", "ngày mai"...',
      '',
      'Cấu trúc:',
      '```json',
      '{',
      '  "schema": "ranhchua/v1",',
      '  "recurring": [',
      '    {"days": ["mon", "wed"], "start": "07:00", "end": "09:15", "status": "busy", "label": "Mạng máy tính", "from": "2026-09-07", "to": "2026-12-20"}',
      '  ],',
      '  "events": [',
      '    {"date": "2026-11-25", "start": "14:00", "end": "16:00", "status": "busy", "label": "Họp nhóm"}',
      '  ]',
      '}',
      '```',
      '',
      'Quy tắc:',
      '- "recurring" = việc lặp lại mỗi tuần (thời khoá biểu học kỳ, ca làm cố định). "days" chỉ dùng: mon, tue, wed, thu, fri, sat, sun. "from"/"to" (định dạng YYYY-MM-DD) là ngày bắt đầu/kết thúc kỳ nếu ảnh có ghi; nếu không có thì bỏ hai trường này.',
      '- "events" = việc chỉ xảy ra vào một ngày cụ thể ("date" dạng YYYY-MM-DD). Việc kéo dài nhiều ngày thì thêm "endDate".',
      '- "status": "busy" cho lịch học/làm/hẹn (mặc định); "free" chỉ khi ảnh nói rõ đó là thời gian rảnh; "maybe" nếu chưa chắc.',
      '- Giờ theo định dạng 24 giờ "HH:MM". Việc qua đêm thì để end nhỏ hơn start (ví dụ 22:00 → 02:00).',
      '- "label" ngắn gọn (tối đa 5 từ), không ghi thông tin nhạy cảm như số điện thoại, mật khẩu, địa chỉ nhà.',
      '- Không bịa dữ liệu. Mục nào không đọc rõ ngày hoặc giờ thì bỏ qua và nói ngắn gọn bên ngoài khối JSON.',
      '- ' + slot,
      '- Chỉ trả đúng một khối JSON hợp lệ (không chú thích bên trong).'
    ].join('\n');
  }

  function exportData() {
    var sc = A.sc(A.me.id), out = { schema: 'ranhchua/v1', recurring: [], events: [] };
    Sched.objVals(sc.rec).forEach(function (x) {
      var r = x.v, it = { days: Sched.daysFromMask(r.d).map(function (i) { return DAYS[i]; }), start: Sched.minToStr(r.s), end: Sched.minToStr(r.e), status: r.st, label: r.lb || '' };
      if (r.from) it.from = r.from; if (r.to) it.to = r.to; out.recurring.push(it);
    });
    Object.keys(sc.one || {}).sort().forEach(function (d) {
      Sched.objVals(sc.one[d]).forEach(function (x) { if (x.v.st === 'none') return; out.events.push({ date: d, start: Sched.minToStr(x.v.s), end: Sched.minToStr(x.v.e), status: x.v.st, label: x.v.lb || '' }); });
    });
    return out;
  }
  function download(name, text) {
    var a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name }); document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /** Áp dụng kết quả parseImport vào lịch của tôi */
  function apply(parsed, mode) {
    var sc = A.sc(A.me.id), up = {}, rec = {}, one = {};
    Sched.objVals(sc.rec).forEach(function (x) { rec[x.id] = x.v; });
    Object.keys(sc.one || {}).forEach(function (d) { one[d] = JSON.parse(JSON.stringify(sc.one[d])); });
    var touched = {};
    if (mode === 'replace') {
      Object.keys(rec).forEach(function (id) { if (rec[id].src === 'import') { up['rec/' + id] = null; delete rec[id]; } });
      Object.keys(one).forEach(function (d) {
        var changed = false; Object.keys(one[d]).forEach(function (id) { if (one[d][id].src === 'import') { delete one[d][id]; changed = true; } });
        if (changed) touched[d] = 1;
      });
    }
    parsed.rec.forEach(function (r) { up['rec/' + A.store.newKey(A.path('sched/' + A.me.id + '/rec'))] = Object.assign({}, r, { src: 'import' }); });
    Object.keys(parsed.one).forEach(function (d) {
      var m = one[d] || {}; parsed.one[d].forEach(function (b) { m[Sched.newId()] = Object.assign({}, b, { src: 'import' }); });
      one[d] = m; touched[d] = 1;
    });
    Object.keys(touched).forEach(function (d) { var v = Sched.normalizeDay(one[d]); up['one/' + d] = v; });
    return A.writeSched(up);
  }

  var Imp = {
    open: function () {
      var slotInp = h('textarea.inp', { rows: 3, placeholder: 'Ví dụ:\nSlot 1: 07:00–09:15\nSlot 2: 09:30–11:45\n(chỉ cần nếu lịch của bạn ghi theo tiết/slot)', value: U.lsGet('rc_slots', '') });
      var promptBox = h('textarea.inp.mono', { rows: 8, readOnly: true });
      function refreshPrompt() { U.lsSet('rc_slots', slotInp.value); promptBox.value = buildPrompt(slotInp.value); }
      slotInp.addEventListener('input', U.debounce(refreshPrompt, 250)); refreshPrompt();
      var paste = h('textarea.inp.mono', { rows: 6, placeholder: 'Dán kết quả JSON của AI vào đây (hoặc chọn file .json bên dưới)' });
      var file = h('input', { type: 'file', accept: '.json,.txt,application/json,text/plain', style: { display: 'none' }, onchange: function (e) { var f = e.target.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { paste.value = r.result; check(); }; r.readAsText(f); } });
      var result = h('div.imp-result'), parsed = null, modeV = 'replace';
      var hasPrev = Sched.objVals(A.sc(A.me.id).rec).some(function (x) { return x.v.src === 'import'; }) || Object.keys(A.sc(A.me.id).one || {}).some(function (d) { return Sched.objVals(A.sc(A.me.id).one[d]).some(function (x) { return x.v.src === 'import'; }); });
      if (!hasPrev) modeV = 'add';
      var okBtn = h('button.btn.primary', { disabled: true, onclick: doApply }, 'Nhập vào lịch của tôi');
      function check() {
        U.clear(result); parsed = Sched.parseImport(paste.value); okBtn.disabled = !parsed.ok;
        if (!paste.value.trim()) return;
        if (parsed.errors.length) result.appendChild(h('div.note.warn', parsed.errors.map(function (e) { return h('div', e); })));
        if (parsed.ok) {
          result.appendChild(h('div.note', h('b', 'Đọc được: '), parsed.counts.rec + ' thói quen lặp lại, ' + parsed.counts.one + ' khung giờ theo ngày.'));
          var items = parsed.rec.slice(0, 8).map(function (r) {
            return h('li', h('i.dotst.s-' + r.st), (r.lb || ST[r.st]) + ' · ' + Sched.daysFromMask(r.d).map(function (i) { return U.DN[i]; }).join(' ') + ' · ' + U.range(r.s, r.e));
          });
          var dates = Object.keys(parsed.one).sort(); dates.slice(0, Math.max(0, 12 - items.length)).forEach(function (d) {
            parsed.one[d].slice(0, 2).forEach(function (b) { items.push(h('li', h('i.dotst.s-' + b.st), (b.lb || ST[b.st]) + ' · ' + U.fmtDate(d) + ' · ' + U.range(b.s, b.e))); });
          });
          result.appendChild(h('ul.imp-list', items, parsed.counts.rec + parsed.counts.one > items.length ? h('li.muted', '… và các mục khác') : null));
          if (hasPrev) result.appendChild(h('div.seg.sm', [['replace', 'Thay các mục đã nhập trước đó'], ['add', 'Thêm vào lịch hiện có']].map(function (x) {
            return h('button' + (modeV === x[0] ? '.on' : ''), { onclick: function (e) { modeV = x[0]; U.$$('.seg button', result).forEach(function (b) { b.classList.remove('on'); }); e.target.classList.add('on'); } }, x[1]);
          })));
        }
        if (parsed.warnings.length) result.appendChild(h('details.warns', h('summary', parsed.warnings.length + ' mục bị bỏ qua / cần xem lại'), h('ul', parsed.warnings.slice(0, 30).map(function (w) { return h('li', w); }))));
      }
      paste.addEventListener('input', U.debounce(check, 250));
      function doApply() {
        if (!parsed || !parsed.ok) return; okBtn.disabled = true;
        apply(parsed, modeV).then(function () { m.close(); U.toast('Đã nhập ' + (parsed.counts.rec + parsed.counts.one) + ' mục vào lịch của bạn'); }, function (e) { okBtn.disabled = false; U.toast('Lỗi: ' + e.message, { kind: 'err' }); });
      }
      var body = h('div.form.imp',
        h('div.imp-step', h('b.n', '1'), h('div', h('b', 'Copy câu lệnh này'), h('p.muted.sm', 'Mở một AI có đọc được ảnh (ChatGPT, Gemini, Claude...), dán câu lệnh và đính kèm ảnh chụp lịch của bạn.'),
          promptBox, h('div.row.mt', h('button.btn.primary.sm', { onclick: function () { U.copy(promptBox.value).then(function () { U.toast('Đã copy câu lệnh. Giờ dán vào AI kèm ảnh lịch nhé'); }); } }, U.icon('copy', 16), 'Copy câu lệnh'),
            h('details.slotbox', h('summary', 'Lịch ghi theo tiết/slot? Thêm bảng giờ'), slotInp)))),
        h('div.imp-step', h('b.n', '2'), h('div', h('b', 'Dán kết quả AI trả về'), paste,
          h('div.row.mt', h('button.btn.sm', { onclick: function () { file.click(); } }, U.icon('upload', 16), 'Chọn file .json'), file), result)),
        h('div.imp-step', h('b.n', '3'), h('div', h('b', 'Xem lại rồi nhập'), h('p.muted.sm', 'Các mục nhập từ ảnh sẽ nằm chung với lịch bạn tự tô; bạn vẫn sửa hoặc xoá được từng mục. Nhập lại lần sau có thể thay thế đợt cũ.'))));
      var m = U.modal({
        title: 'Nhập lịch từ ảnh bằng AI', wide: true, body: body,
        actions: [h('button.btn.ghost', { onclick: function () { download('lich-cua-toi.json', JSON.stringify(exportData(), null, 2)); } }, U.icon('upload', 16), 'Tải lịch của tôi (JSON)'), h('button.btn.ghost', { onclick: function () { m.close(); } }, 'Đóng'), okBtn]
      });
    },
    buildPrompt: buildPrompt, exportData: exportData
  };
  root.Imp = Imp;
})(window);
