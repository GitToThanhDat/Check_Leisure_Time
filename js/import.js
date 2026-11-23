/* import.js - nhập lịch từ JSON (do AI khác đọc ảnh tạo ra) + prompt copy sẵn + xuất sao lưu */
(function (root) {
  'use strict';
  var h = U.h;
  var DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], ST = { free: 'Rảnh', busy: 'Bận', maybe: 'Có thể' };

  var KINDS = [
    ['auto', 'Tự nhận biết', ''],
    ['tkb', 'Thời khoá biểu học kỳ', 'Ảnh là thời khoá biểu: các môn lặp lại hằng tuần nên ưu tiên đưa vào "recurring" (kèm from/to nếu ảnh có ghi kỳ học).'],
    ['work', 'Ca làm / lịch làm việc', 'Ảnh là lịch ca làm việc: ca cố định lặp lại hằng tuần thì vào "recurring", ca ngày cụ thể thì vào "events".'],
    ['cal', 'Lịch tháng / tuần (Google, Outlook…)', 'Ảnh là lịch theo ngày: mỗi ô là một sự kiện cụ thể nên đưa vào "events" với ngày đầy đủ; chỉ dùng "recurring" cho việc ghi rõ là lặp lại.'],
    ['note', 'Tin nhắn / ghi chú / danh sách', 'Ảnh là tin nhắn hoặc ghi chú viết tay: hãy suy ra các mốc ngày giờ được nhắc tới.']
  ];
  var WD = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

  /** o: {ref:'YYYY-MM-DD', kind, free:bool, extra, slots} -- "hôm nay" lấy theo ngày tham chiếu (mặc định đồng hồ máy), không cố định */
  function buildPrompt(o) {
    o = o || {}; var ref = o.ref || U.today(), d = Sched.parseDate(ref), kind = KINDS.filter(function (k) { return k[0] === o.kind; })[0] || KINDS[0];
    var refTxt = WD[d.getDay()] + ', ' + d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() + ' (' + ref + ')';
    var ex1 = Sched.addDays(ref, 2), ex2 = Sched.addDays(ref, 84);
    var slot = o.slots && o.slots.trim()
      ? 'Lịch của tôi ghi theo tiết/slot. Đổi sang giờ thật bằng bảng sau:\n' + o.slots.trim()
      : 'Nếu lịch ghi theo "tiết/slot" mà tôi không đưa bảng giờ, hãy hỏi lại tôi bảng giờ trước khi trả JSON.';
    var L = [
      'Bạn là trợ lý chuyển ảnh lịch thành dữ liệu. Tôi gửi kèm một hoặc nhiều ảnh chụp lịch của tôi (thời khoá biểu, lịch làm việc, lịch Google/Outlook, tin nhắn hẹn…). Hãy đọc kỹ ảnh và trả về một khối JSON (đặt trong ```json) theo đúng cấu trúc dưới đây.',
      '',
      'Mốc thời gian: hôm nay là ' + refTxt + '. Dùng ngày này để suy ra ngày và năm khi ảnh chỉ ghi "Thứ 3", "tuần này", "ngày mai", hoặc ngày dạng dd/mm không có năm (lấy năm hợp lý nhất so với mốc này; Việt Nam viết ngày trước, tháng sau).'
    ];
    if (kind[2]) L.push('', 'Loại ảnh: ' + kind[2]);
    L.push('', 'Trạng thái mặc định của các mục: ' + (o.free ? '"free" (ảnh cho biết những lúc tôi RẢNH)' : '"busy" (ảnh cho biết những lúc tôi BẬN)') + ', trừ khi ảnh ghi rõ khác đi.');
    if (o.extra && o.extra.trim()) L.push('', 'Yêu cầu riêng của tôi (ưu tiên hơn quy tắc mặc định bên dưới, nhưng KHÔNG được đổi cấu trúc JSON):', o.extra.trim());
    L.push('',
      'Cấu trúc:', '```json', '{', '  "schema": "ranhchua/v1",', '  "recurring": [',
      '    {"days": ["mon", "wed"], "start": "07:00", "end": "09:15", "status": "busy", "label": "Mạng máy tính", "from": "' + ref + '", "to": "' + ex2 + '"}',
      '  ],', '  "events": [',
      '    {"date": "' + ex1 + '", "start": "14:00", "end": "16:00", "status": "busy", "label": "Họp nhóm"}',
      '  ]', '}', '```', '',
      'Quy tắc:',
      '- "recurring" = việc lặp lại mỗi tuần (thời khoá biểu học kỳ, ca làm cố định). "days" chỉ dùng: mon, tue, wed, thu, fri, sat, sun. "from"/"to" (YYYY-MM-DD) là ngày bắt đầu/kết thúc kỳ nếu ảnh có ghi; nếu không có thì bỏ hai trường này.',
      '- "events" = việc chỉ xảy ra vào một ngày cụ thể ("date" dạng YYYY-MM-DD). Việc kéo dài nhiều ngày thì thêm "endDate".',
      '- "status": "busy" (bận), "free" (rảnh) hoặc "maybe" (chưa chắc).',
      '- Giờ theo định dạng 24 giờ "HH:MM". Việc qua đêm thì để end nhỏ hơn start (ví dụ 22:00 → 02:00).',
      '- "label" ngắn gọn (tối đa 5 từ), không ghi thông tin nhạy cảm như số điện thoại, mật khẩu, địa chỉ nhà.',
      '- Không bịa dữ liệu. Mục nào không đọc rõ ngày hoặc giờ thì bỏ qua và nói ngắn gọn bên ngoài khối JSON.',
      '- ' + slot,
      '- Tôi có thể gửi thêm ảnh hoặc nhắn thêm chỉ dẫn sau câu lệnh này (ví dụ "bỏ môn X", "thêm giờ ngủ 23:00–07:00 mỗi ngày"). Hãy gộp tất cả và mỗi lần luôn trả lại TOÀN BỘ JSON mới nhất, hợp lệ, không chú thích bên trong.'
    );
    return L.join('\n');
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
      var saved = U.lsGet('rc_imp_opts', {}), opt = { ref: U.today(), kind: saved.kind || 'auto', free: !!saved.free, extra: saved.extra || '', slots: saved.slots || '' };
      var slotInp = h('textarea.inp', { rows: 3, placeholder: 'Ví dụ:\nSlot 1: 07:00–09:15\nSlot 2: 09:30–11:45\n(chỉ cần nếu lịch của bạn ghi theo tiết/slot)', value: opt.slots });
      var extraInp = h('textarea.inp', { rows: 2, placeholder: 'Tuỳ chọn. Ví dụ: "bỏ môn Thể dục", "chỉ lấy từ tuần 12", "thêm giờ ngủ 23:00–07:00 mỗi ngày", "các tối thứ 6 tôi rảnh"…', value: opt.extra });
      var refInp = h('input.inp.sm', { type: 'date', value: opt.ref });
      var kindBox = h('div.chips'), stBox = h('div.seg.sm');
      var promptBox = h('textarea.inp.mono', { rows: 8, readOnly: true });
      function refreshPrompt() {
        opt.ref = refInp.value || U.today(); opt.extra = extraInp.value; opt.slots = slotInp.value;
        U.lsSet('rc_imp_opts', { kind: opt.kind, free: opt.free, extra: opt.extra, slots: opt.slots });
        U.clear(kindBox); KINDS.forEach(function (k) { kindBox.appendChild(h('button.chip' + (opt.kind === k[0] ? '.on' : ''), { type: 'button', onclick: function () { opt.kind = k[0]; refreshPrompt(); } }, k[1])); });
        U.clear(stBox); [[false, 'Bận'], [true, 'Rảnh']].forEach(function (x) { stBox.appendChild(h('button' + (opt.free === x[0] ? '.on' : ''), { type: 'button', onclick: function () { opt.free = x[0]; refreshPrompt(); } }, x[1])); });
        promptBox.value = buildPrompt(opt);
      }
      var deb = U.debounce(refreshPrompt, 250);
      slotInp.addEventListener('input', deb); extraInp.addEventListener('input', deb); refInp.addEventListener('input', refreshPrompt); refreshPrompt();
      var paste = h('textarea.inp.mono', { rows: 6, placeholder: 'Dán kết quả JSON của AI vào đây (hoặc chọn file .json bên dưới)' });
      var file = h('input', { type: 'file', accept: '.json,.txt,application/json,text/plain', style: { display: 'none' }, onchange: function (e) { var f = e.target.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { paste.value = r.result; check(); }; r.readAsText(f); } });
      var result = h('div.imp-result'), parsed = null, modeV = 'replace';
      var hasPrev = Sched.objVals(A.sc(A.me.id).rec).some(function (x) { return x.v.src === 'import'; }) || Object.keys(A.sc(A.me.id).one || {}).some(function (d) { return Sched.objVals(A.sc(A.me.id).one[d]).some(function (x) { return x.v.src === 'import'; }); });
      if (!hasPrev) modeV = 'add';
      var okBtn = h('button.btn.primary', { disabled: true, onclick: doApply }, 'Nhập vào lịch của tôi');
      function check() {
        U.clear(result); parsed = Sched.parseImport(paste.value, { ref: refInp.value || U.today() }); okBtn.disabled = !parsed.ok;
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
        h('div.imp-step', h('b.n', '1'), h('div', h('b', 'Tuỳ chỉnh rồi copy câu lệnh'), h('p.muted.sm', 'Mở một AI có đọc được ảnh (ChatGPT, Gemini, Claude...), dán câu lệnh và đính kèm ảnh chụp lịch của bạn. Bạn vẫn có thể gõ thêm yêu cầu cho AI sau khi dán.'),
          h('div.fld', h('span', 'Loại ảnh'), kindBox),
          h('div.grid2', h('div.fld', h('span', 'Ảnh này cho biết lúc bạn…'), stBox), h('label.fld', h('span', 'Hôm nay là (mốc cho AI hiểu "tuần này", "mai")'), refInp)),
          h('label.fld', h('span', 'Yêu cầu riêng của bạn (tuỳ chọn)'), extraInp),
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
