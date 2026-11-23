/* schedule.js - logic lịch rảnh/bận thuần (không đụng DOM), chạy được cả trình duyệt lẫn Node.
 *
 * Mô hình dữ liệu của MỘT người (sched):
 *   rec: { id: { d:bitmask(bit0=T2..bit6=CN), s:phút bắt đầu, e:phút kết thúc (e<=s = qua đêm),
 *                st:'free'|'busy'|'maybe', lb:'nhãn', from:'YYYY-MM-DD'?, to:'YYYY-MM-DD'?, src?:'import' } }
 *   one: { 'YYYY-MM-DD': { id: { s, e, st:'free'|'busy'|'maybe'|'none', lb, src? } } }   (0<=s<e<=1440)
 *   'none' = che (xoá) phần thói quen lặp lại trong khoảng đó.
 * Ưu tiên: one-off > rec. Trong cùng lớp: busy > maybe > free.
 */
(function (root) {
  'use strict';
  var SLOT = 30, SLOTS = 48;
  var PRI = { busy: 3, maybe: 2, free: 1 };

  /* ---------- Ngày giờ ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toDateStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDate(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parseDate(s); d.setDate(d.getDate() + n); return toDateStr(d); }
  /** 0=Thứ 2 ... 6=Chủ nhật */
  function dow(s) { return (parseDate(s).getDay() + 6) % 7; }
  function startOfWeek(s) { return addDays(s, -dow(s)); }
  function minToStr(m) { if (m >= 1440) return '24:00'; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function strToMin(t) {
    if (typeof t === 'number') return t;
    var x = String(t).trim().toLowerCase();
    var ap = /(am|pm|sa|ch)$/.exec(x), off = 0;
    if (ap) { x = x.slice(0, -ap[1].length).trim(); if (ap[1] === 'pm' || ap[1] === 'ch') off = 12; else off = -1; }
    var m = /^(\d{1,2})\s*(?:[:h]\s*(\d{1,2})?)?$/.exec(x);
    if (!m) return NaN;
    var h = +m[1], mi = m[2] ? +m[2] : 0;
    if (off === 12 && h < 12) h += 12;
    if (off === -1 && h === 12) h = 0;
    if (h > 24 || mi > 59 || (h === 24 && mi > 0)) return NaN;
    return h * 60 + mi;
  }
  var DOW_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  function maskHas(mask, i) { return (mask >> i & 1) === 1; }
  function maskFromDays(arr) { var m = 0; for (var i = 0; i < arr.length; i++) m |= 1 << arr[i]; return m; }
  function daysFromMask(mask) { var a = []; for (var i = 0; i < 7; i++) if (maskHas(mask, i)) a.push(i); return a; }

  function objVals(o) {
    var out = [];
    if (!o) return out;
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k) && o[k]) out.push({ id: k, v: o[k] });
    return out;
  }

  /* ---------- Tính trạng thái từng khung 30 phút ---------- */
  function recSegments(sched, date) {
    var segs = [], recs = objVals(sched && sched.rec), prev = addDays(date, -1);
    function valid(r, ds) {
      if (!maskHas(r.d, dow(ds))) return false;
      if (r.from && ds < r.from) return false;
      if (r.to && ds > r.to) return false;
      return true;
    }
    recs.forEach(function (x) {
      var r = x.v, over = r.e <= r.s;
      if (valid(r, date)) segs.push({ s: r.s, e: over ? 1440 : r.e, st: r.st, lb: r.lb, id: x.id });
      if (over && r.e > 0 && valid(r, prev)) segs.push({ s: 0, e: r.e, st: r.st, lb: r.lb, id: x.id });
    });
    return segs;
  }
  function oneSegments(sched, date) {
    var day = sched && sched.one && sched.one[date];
    return objVals(day).map(function (x) { return { s: x.v.s, e: x.v.e, st: x.v.st, lb: x.v.lb, id: x.id }; });
  }
  function layer(segs) {
    var out = new Array(SLOTS), i, j;
    for (i = 0; i < SLOTS; i++) {
      var a = i * SLOT, b = a + SLOT, best = null;
      for (j = 0; j < segs.length; j++) {
        var g = segs[j], ov = Math.min(b, g.e) - Math.max(a, g.s);
        if (ov <= 0) continue;
        if (g.st === 'none') { if (!best) best = g; continue; }
        // busy: chỉ cần chạm; free/maybe: phủ >= 15 phút
        if (g.st !== 'busy' && ov < SLOT / 2) continue;
        if (!best || best.st === 'none' || PRI[g.st] > PRI[best.st]) best = g;
      }
      out[i] = best;
    }
    return out;
  }
  /** Trả mảng 48 phần tử {st,src,lb,id} hoặc null (chưa đánh dấu) */
  function resolveDay(sched, date) {
    var r = layer(recSegments(sched, date)), o = layer(oneSegments(sched, date)), out = new Array(SLOTS);
    for (var i = 0; i < SLOTS; i++) {
      if (o[i]) {
        out[i] = o[i].st === 'none' ? null : { st: o[i].st, src: 'one', lb: o[i].lb || '', id: o[i].id };
      } else if (r[i]) {
        out[i] = { st: r[i].st, src: 'rec', lb: r[i].lb || '', id: r[i].id };
      } else out[i] = null;
    }
    return out;
  }
  function recLayerOnly(sched, date) { return layer(recSegments(sched, date)); }

  /* ---------- Tô / xoá khoảng thời gian trong 1 ngày ---------- */
  var seq = 0;
  function newId() {
    seq++;
    return Date.now().toString(36) + seq.toString(36) + Math.floor(Math.random() * 1296).toString(36);
  }
  /** Trả về bản đồ {id:block} mới của ngày đó sau khi tô [s,e) bằng st ('erase' = xoá). */
  function paintDay(sched, date, s, e, st, label, extra) {
    var cur = (sched && sched.one && sched.one[date]) || {}, res = {}, id;
    for (id in cur) {
      var b = cur[id]; if (!b) continue;
      if (b.e <= s || b.s >= e) { res[id] = b; continue; }
      if (b.s < s) res[id] = Object.assign({}, b, { e: s });
      if (b.e > e) res[newId()] = Object.assign({}, b, { s: e });
    }
    if (st === 'erase') {
      var rl = recLayerOnly(sched, date), run = null;
      for (var i = Math.floor(s / SLOT); i < Math.ceil(e / SLOT); i++) {
        if (rl[i]) { if (run === null) run = i; }
        else if (run !== null) { res[newId()] = { s: Math.max(s, run * SLOT), e: i * SLOT, st: 'none', lb: '' }; run = null; }
      }
      if (run !== null) res[newId()] = { s: Math.max(s, run * SLOT), e: Math.min(e, Math.ceil(e / SLOT) * SLOT), st: 'none', lb: '' };
    } else {
      var nb = Object.assign({ s: s, e: e, st: st, lb: label || '' }, extra || {});
      res[newId()] = nb;
    }
    return normalizeDay(res);
  }
  /** Gộp các block liền kề cùng loại; trả null nếu rỗng */
  function normalizeDay(map) {
    var arr = objVals(map).map(function (x) { return Object.assign({ _id: x.id }, x.v); })
      .filter(function (b) { return b.e > b.s; })
      .sort(function (a, b) { return a.s - b.s || a.e - b.e; });
    var out = [];
    arr.forEach(function (b) {
      var p = out[out.length - 1];
      if (p && p.e >= b.s && p.st === b.st && (p.lb || '') === (b.lb || '') && (p.src || '') === (b.src || '')) p.e = Math.max(p.e, b.e);
      else out.push(b);
    });
    var res = {}, n = 0;
    out.forEach(function (b) { var id = b._id; delete b._id; res[id] = b; n++; });
    return n ? res : null;
  }

  /* ---------- Tìm khung giờ chung ---------- */
  var MODES = {
    strict: { free: 1 },
    flex: { free: 1, maybe: 1 },
    loose: { free: 1, maybe: 1, none: 1 }   // không bận (kể cả chưa đánh dấu)
  };
  /**
   * opts: { members:[ids], schedOf:(id)=>sched, from:'YYYY-MM-DD', days:n, mode:'strict'|'flex'|'loose',
   *         fromMin, toMin, weekdays:[0..6], minDur:phút, minPeople:n }
   * Trả [{date,s,e,who:[ids]}]
   */
  function findWindows(o) {
    var ids = o.members, ok = MODES[o.mode || 'flex'], need = Math.min(o.minPeople || ids.length, ids.length);
    var out = [], wd = o.weekdays && o.weekdays.length ? o.weekdays : [0, 1, 2, 3, 4, 5, 6];
    var fm = o.fromMin == null ? 0 : o.fromMin, tm = o.toMin == null ? 1440 : o.toMin;
    var minDur = o.minDur || 60;
    if (!ids.length) return out;
    for (var d = 0; d < o.days; d++) {
      var date = addDays(o.from, d);
      if (wd.indexOf(dow(date)) < 0) continue;
      var days = ids.map(function (id) { return { id: id, r: resolveDay(o.schedOf(id), date) }; });
      var run = null;
      var flush = function (endSlot) {
        if (run && (endSlot - run.i) * SLOT >= minDur) out.push({ date: date, s: run.i * SLOT, e: endSlot * SLOT, who: run.who });
        run = null;
      };
      for (var i = 0; i < SLOTS; i++) {
        var a = i * SLOT, who = [];
        if (a >= fm && a + SLOT <= tm) {
          days.forEach(function (x) { var c = x.r[i], k = c ? c.st : 'none'; if (ok[k]) who.push(x.id); });
        }
        var key = who.length >= need ? who.join(',') : null;
        if (key === null) { flush(i); continue; }
        if (run && run.key === key) continue;
        flush(i); run = { i: i, key: key, who: who };
      }
      flush(SLOTS);
    }
    return out;
  }

  /* ---------- Nhập dữ liệu (JSON từ AI) ---------- */
  var DAY_ALIAS = {
    mon: 0, monday: 0, t2: 0, 't.2': 0, 'thu2': 0, 'thứ 2': 0, 'thứ hai': 0, '2': 0, '0': 0,
    tue: 1, tuesday: 1, t3: 1, 'thứ 3': 1, 'thứ ba': 1, '3': 1,
    wed: 2, wednesday: 2, t4: 2, 'thứ 4': 2, 'thứ tư': 2, '4': 2,
    thu: 3, thursday: 3, t5: 3, 'thứ 5': 3, 'thứ năm': 3, '5': 3,
    fri: 4, friday: 4, t6: 4, 'thứ 6': 4, 'thứ sáu': 4, '6': 4,
    sat: 5, saturday: 5, t7: 5, 'thứ 7': 5, 'thứ bảy': 5, '7': 5,
    sun: 6, sunday: 6, cn: 6, 'chủ nhật': 6, 'chu nhat': 6, '8': 6
  };
  var ST_ALIAS = {
    busy: 'busy', bận: 'busy', ban: 'busy', 'b': 'busy',
    free: 'free', rảnh: 'free', ranh: 'free', 'r': 'free',
    maybe: 'maybe', 'có thể': 'maybe', 'co the': 'maybe', tentative: 'maybe', 'linh hoạt': 'maybe'
  };
  /** Chuẩn hoá ngày về YYYY-MM-DD. Nhận: 2026-11-25, 25/11/2026, 25/11/26, và 25/11 (không năm -> chọn năm gần nhất với ref). */
  function normDate(v, ref) {
    if (!v) return null; var s = String(v).trim(), m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) return m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]);
    if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(s))) return m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]);
    if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2})$/.exec(s))) return (2000 + +m[3]) + '-' + pad(+m[2]) + '-' + pad(+m[1]);
    if ((m = /^(\d{1,2})[\/.-](\d{1,2})$/.exec(s)) && ref && +m[1] >= 1 && +m[1] <= 31 && +m[2] >= 1 && +m[2] <= 12) {
      var ry = +ref.slice(0, 4), best = null, bd = 1e9;
      [ry - 1, ry, ry + 1].forEach(function (y) {
        var c = y + '-' + pad(+m[2]) + '-' + pad(+m[1]), dd = Math.abs((parseDate(c) - parseDate(ref)) / 86400000);
        if (dd < bd) { bd = dd; best = c; }
      });
      return best;
    }
    return null;
  }
  function extractJson(text) {
    var t = String(text || '').trim();
    var fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
    if (fence) t = fence[1].trim();
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    return t.slice(a, b + 1);
  }
  /** Trả {ok, rec:[...], one:{date:[...]}, errors:[], warnings:[], counts} */
  function parseImport(text, opt) {
    var ref = opt && opt.ref;
    var res = { ok: false, rec: [], one: {}, errors: [], warnings: [], counts: { rec: 0, one: 0 } };
    var js = extractJson(text), data;
    if (!js) { res.errors.push('Không tìm thấy JSON. Hãy dán nguyên đoạn AI trả về (bắt đầu bằng { và kết thúc bằng }).'); return res; }
    try { data = JSON.parse(js); } catch (e) { res.errors.push('JSON bị lỗi cú pháp: ' + e.message); return res; }
    var recs = data.recurring || data.rec || data.weekly || [], evs = data.events || data.one || data.oneoff || [];
    if (!Array.isArray(recs)) recs = []; if (!Array.isArray(evs)) evs = [];
    if (!recs.length && !evs.length) { res.errors.push('JSON không có mục "recurring" hoặc "events" nào.'); return res; }

    function parseStatus(v, where) {
      var k = String(v == null ? 'busy' : v).trim().toLowerCase(), st = ST_ALIAS[k];
      if (!st) { res.warnings.push(where + ': trạng thái "' + v + '" lạ, tạm coi là Bận'); st = 'busy'; }
      return st;
    }
    recs.forEach(function (r, idx) {
      var w = 'Thói quen #' + (idx + 1), days = r.days || r.day, mask = 0;
      if (!Array.isArray(days)) days = days == null ? [] : [days];
      days.forEach(function (d) {
        var k = String(d).trim().toLowerCase();
        if (k === 'daily' || k === 'hàng ngày' || k === 'mỗi ngày') mask = 127;
        else if (k === 'weekdays' || k === 't2-t6') mask |= 31;
        else if (k === 'weekend' || k === 'cuối tuần') mask |= 96;
        else if (DAY_ALIAS[k] != null) mask |= 1 << DAY_ALIAS[k];
        else res.warnings.push(w + ': bỏ qua thứ "' + d + '"');
      });
      var s = strToMin(r.start), e = strToMin(r.end);
      if (!mask) { res.warnings.push(w + ': thiếu ngày trong tuần, bỏ qua'); return; }
      if (isNaN(s) || isNaN(e)) { res.warnings.push(w + ': giờ không đọc được (' + r.start + ' - ' + r.end + '), bỏ qua'); return; }
      if (s === e) { res.warnings.push(w + ': giờ bắt đầu = kết thúc, bỏ qua'); return; }
      var item = { d: mask, s: s, e: e, st: parseStatus(r.status, w), lb: String(r.label || r.title || '').slice(0, 60) };
      var f = normDate(r.from, ref), t = normDate(r.to, ref);
      if (r.from && !f) res.warnings.push(w + ': ngày "from" sai định dạng, bỏ qua giới hạn');
      if (r.to && !t) res.warnings.push(w + ': ngày "to" sai định dạng, bỏ qua giới hạn');
      if (f) item.from = f; if (t) item.to = t;
      res.rec.push(item);
    });
    evs.forEach(function (x, idx) {
      var w = 'Sự kiện #' + (idx + 1), d1 = normDate(x.date, ref), d2 = normDate(x.endDate || x.date, ref);
      var s = strToMin(x.start), e = strToMin(x.end);
      if (!d1) { res.warnings.push(w + ': ngày không hợp lệ (' + x.date + '), bỏ qua'); return; }
      if (isNaN(s) || isNaN(e)) { res.warnings.push(w + ': giờ không đọc được, bỏ qua'); return; }
      if (s === e) { res.warnings.push(w + ': giờ bắt đầu = kết thúc, bỏ qua'); return; }
      var st = parseStatus(x.status, w), lb = String(x.label || x.title || '').slice(0, 60);
      var add = function (date, a, b) { (res.one[date] = res.one[date] || []).push({ s: a, e: b, st: st, lb: lb }); };
      if (d2 && d2 !== d1 && d2 > d1) {
        // nhiều ngày: áp dụng cùng khung giờ mỗi ngày (giới hạn 62 ngày)
        for (var k = 0, d = d1; d <= d2 && k < 62; k++, d = addDays(d1, k)) {
          if (e > s) add(d, s, e); else { add(d, s, 1440); add(addDays(d, 1), 0, e); }
        }
      } else if (e > s) add(d1, s, e);
      else { add(d1, s, 1440); if (e > 0) add(addDays(d1, 1), 0, e); }   // qua đêm
    });
    Object.keys(res.one).forEach(function (k) { res.counts.one += res.one[k].length; });
    res.counts.rec = res.rec.length;
    res.ok = res.counts.rec + res.counts.one > 0;
    if (!res.ok) res.errors.push('Không có mục hợp lệ nào để nhập.');
    return res;
  }

  var api = {
    SLOT: SLOT, SLOTS: SLOTS, PRI: PRI, MODES: MODES, DOW_NAMES: DOW_NAMES,
    pad: pad, toDateStr: toDateStr, parseDate: parseDate, addDays: addDays, dow: dow, startOfWeek: startOfWeek,
    minToStr: minToStr, strToMin: strToMin, maskHas: maskHas, maskFromDays: maskFromDays, daysFromMask: daysFromMask,
    resolveDay: resolveDay, recSegments: recSegments, paintDay: paintDay, normalizeDay: normalizeDay, newId: newId,
    findWindows: findWindows, parseImport: parseImport, objVals: objVals
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Sched = api;
})(typeof window !== 'undefined' ? window : globalThis);
