/* util.js - tiện ích DOM, icon, modal, toast, hash... */
(function (root) {
  'use strict';
  var U = {};

  /* ---------- DOM ---------- */
  U.$ = function (s, el) { return (el || document).querySelector(s); };
  U.$$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  /** h('div.cls#id', {onclick, style:{}, dataset:{}}, ...children) */
  U.h = function (tag, attrs) {
    var m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(tag) || [], el = document.createElement(m[1] || 'div');
    (m[2] || '').replace(/([.#])([\w-]+)/g, function (_, t, n) { if (t === '.') el.classList.add(n); else el.id = n; });
    var i = 1;
    if (attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs)) {
      i = 2;
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k]; if (v == null || v === false) return;
        if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'class') v.split(' ').forEach(function (c) { if (c) el.classList.add(c); });
        else if (k === 'html') el.innerHTML = v;
        else if (k in el && k !== 'list' && k !== 'type') { try { el[k] = v; } catch (e) { el.setAttribute(k, v); } }
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var j = i; j < arguments.length; j++) U.add(el, arguments[j]);
    return el;
  };
  U.add = function (el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { U.add(el, x); });
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  U.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  /* ---------- Icon (SVG nét mảnh) ---------- */
  var IC = {
    left: '<path d="M15 18l-6-6 6-6"/>', right: '<path d="M9 18l6-6-6-6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>', check: '<path d="M20 6L9 17l-5-5"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    bell: '<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>',
    chat: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',
    upload: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    moon: '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>',
    sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',
    filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
    link: '<path d="M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1.5 1.5M14 11a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1.5-1.5"/>',
    pin: '<path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    repeat: '<path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/>',
    logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
    chevd: '<path d="M6 9l6 6 6-6"/>', back: '<path d="M19 12H5M12 19l-7-7 7-7"/>', eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
  };
  U.icon = function (name, size) {
    var s = document.createElement('span'); s.className = 'ic';
    s.innerHTML = '<svg viewBox="0 0 24 24" width="' + (size || 20) + '" height="' + (size || 20) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[name] || '') + '</svg>';
    return s;
  };

  /* ---------- Toast ---------- */
  U.toast = function (msg, opt) {
    opt = opt || {};
    var root = document.getElementById('toast-root'), t = U.h('div.toast' + (opt.kind ? '.' + opt.kind : ''), opt.onclick ? { onclick: function () { opt.onclick(); t.remove(); } } : null, msg);
    root.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('in'); });
    setTimeout(function () { t.classList.remove('in'); setTimeout(function () { t.remove(); }, 300); }, opt.ms || 3200);
    return t;
  };

  /* ---------- Modal / sheet ---------- */
  /** U.modal({title, body:Node, actions:[Node], wide, onclose}) -> {close, el} */
  U.modal = function (o) {
    var rootEl = document.getElementById('modal-root'), closed = false;
    var box = U.h('div.modal' + (o.wide ? '.wide' : ''), { role: 'dialog', 'aria-modal': 'true' },
      U.h('div.modal-head', U.h('h3', o.title || ''), U.h('button.icon-btn', { title: 'Đóng', onclick: function () { close(); } }, U.icon('x'))),
      U.h('div.modal-body', o.body),
      o.actions && o.actions.length ? U.h('div.modal-foot', o.actions) : null);
    var back = U.h('div.backdrop', { onmousedown: function (e) { if (e.target === back) close(); } }, box);
    rootEl.appendChild(back);
    requestAnimationFrame(function () { back.classList.add('in'); });
    function close() {
      if (closed) return; closed = true; back.classList.remove('in');
      setTimeout(function () { back.remove(); }, 200); document.removeEventListener('keydown', esc);
      if (o.onclose) o.onclose();
    }
    function esc(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', esc);
    return { close: close, el: box };
  };
  U.confirm = function (title, text, okLabel, danger) {
    return new Promise(function (res) {
      var m = U.modal({
        title: title, body: U.h('p', text), onclose: function () { res(false); },
        actions: [U.h('button.btn.ghost', { onclick: function () { m.close(); } }, 'Huỷ'),
          U.h('button.btn.' + (danger ? 'danger' : 'primary'), { onclick: function () { res(true); res = function () { }; m.close(); } }, okLabel || 'Đồng ý')]
      });
    });
  };
  U.prompt = function (title, label, val, opt) {
    opt = opt || {};
    return new Promise(function (res) {
      var inp = U.h('input.inp', { type: opt.type || 'text', value: val || '', placeholder: opt.placeholder || '', maxLength: opt.max || 60, inputMode: opt.inputMode });
      var m = U.modal({
        title: title, body: U.h('label.fld', U.h('span', label), inp), onclose: function () { res(null); },
        actions: [U.h('button.btn.ghost', { onclick: function () { m.close(); } }, 'Huỷ'),
          U.h('button.btn.primary', { onclick: ok }, opt.ok || 'Lưu')]
      });
      function ok() { var v = inp.value.trim(); res(v); res = function () { }; m.close(); }
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') ok(); });
      setTimeout(function () { inp.focus(); inp.select(); }, 60);
    });
  };

  /* ---------- Hash PIN ---------- */
  U.sha = function (str) {
    if (root.crypto && crypto.subtle) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (b) {
        return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      });
    }
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) { var c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return Promise.resolve('f' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16));
  };
  U.pinHash = function (room, mid, pin) { return U.sha('rc1:' + room + ':' + mid + ':' + pin); };

  /* ---------- Chuỗi ---------- */
  U.norm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim(); };
  U.esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  U.debounce = function (f, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { f.apply(s, a); }, ms); }; };
  U.rid = function (n, alphabet) {
    var A = alphabet || 'abcdefghjkmnpqrstuvwxyz23456789', o = '', r = new Uint8Array(n);
    (root.crypto || {}).getRandomValues ? crypto.getRandomValues(r) : r.forEach(function (_, i) { r[i] = Math.random() * 256; });
    for (var i = 0; i < n; i++) o += A[r[i] % A.length];
    return o;
  };

  /* ---------- Ngày giờ hiển thị ---------- */
  var DN = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'], DNF = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];
  U.DN = DN; U.DNF = DNF;
  U.fmtDate = function (ds, full) {
    var d = Sched.parseDate(ds), w = Sched.dow(ds);
    return (full ? DNF[w] : DN[w]) + ', ' + d.getDate() + '/' + (d.getMonth() + 1);
  };
  U.fmtDay = function (ds) { var d = Sched.parseDate(ds); return d.getDate() + '/' + (d.getMonth() + 1); };
  U.fmtTime = function (ts) {
    var d = new Date(ts), t = Sched.pad(d.getHours()) + ':' + Sched.pad(d.getMinutes()), today = Sched.toDateStr(new Date());
    var ds = Sched.toDateStr(d);
    return ds === today ? t : d.getDate() + '/' + (d.getMonth() + 1) + ' ' + t;
  };
  U.today = function () { return Sched.toDateStr(new Date()); };
  U.range = function (s, e) { return Sched.minToStr(s) + '–' + Sched.minToStr(e); };

  /* ---------- Avatar ---------- */
  U.COLORS = ['#ff7a90', '#ffa45c', '#ffd25e', '#7be08a', '#4fd6c4', '#5ab8ff', '#8b7cff', '#d27cff', '#ff7ccf'];
  U.EMOJIS = ['😀', '😎', '🥳', '🐱', '🐶', '🦊', '🐼', '🐸', '🐧', '🦄', '🌸', '🍀', '⭐', '🔥', '🍜', '🎮', '🎧', '📚', '⚽', '🚀'];
  U.avatar = function (m, size) {
    var el = U.h('span.av', { title: m ? m.name : '', style: { background: m ? m.color : '#888', width: (size || 32) + 'px', height: (size || 32) + 'px', fontSize: Math.round((size || 32) * 0.55) + 'px' } }, m ? (m.emoji || m.name.charAt(0).toUpperCase()) : '?');
    return el;
  };

  /* ---------- Âm thanh / copy ---------- */
  var actx;
  U.ding = function () {
    try {
      actx = actx || new (root.AudioContext || root.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(1320, t + 0.12);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.4);
    } catch (e) { }
  };
  U.copy = function (text) {
    if (navigator.clipboard && root.isSecureContext) return navigator.clipboard.writeText(text).then(function () { return true; }, fallback);
    return Promise.resolve(fallback());
    function fallback() {
      var ta = U.h('textarea', { value: text, style: { position: 'fixed', opacity: 0 } }); document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { } ta.remove(); return ok;
    }
  };

  /* ---------- Lưu cài đặt cục bộ ---------- */
  U.lsGet = function (k, def) { try { var v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } };
  U.lsSet = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };

  root.U = U;
})(window);
