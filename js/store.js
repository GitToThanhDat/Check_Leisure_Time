/* store.js - lớp lưu trữ có 2 chế độ cùng một giao diện:
 *   - 'firebase': Firebase Realtime Database (đồng bộ thật giữa mọi người)
 *   - 'local'   : localStorage (chỉ để dùng thử; đồng bộ giữa các tab cùng máy)
 * API: init(cfg), get(path), set(path,v), update({path:value|null,...}), newKey(path), remove(path),
 *      listen(path, cb, {limitLast}) -> hàm huỷ, now(), mode, onConn(cb)
 */
(function (root) {
  'use strict';
  var FB_VER = '10.14.1';

  function Local() {
    var KEY = 'rc_local_db_v1', T = {}, ls = [], seq = 0;
    function load() { try { T = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { T = {}; } }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(T)); } catch (e) { console.warn('localStorage đầy', e); } }
    function parts(p) { return String(p).split('/').filter(Boolean); }
    function read(p) { var n = T, a = parts(p); for (var i = 0; i < a.length; i++) { if (n == null || typeof n !== 'object') return null; n = n[a[i]]; } return n === undefined ? null : n; }
    function write(p, v) {
      var a = parts(p), n = T, i, stack = [];
      if (!a.length) { T = v == null ? {} : v; return; }
      for (i = 0; i < a.length - 1; i++) {
        if (n[a[i]] == null || typeof n[a[i]] !== 'object') { if (v == null) return; n[a[i]] = {}; }
        stack.push([n, a[i]]); n = n[a[i]];
      }
      if (v == null) delete n[a[a.length - 1]]; else n[a[a.length - 1]] = clone(v);
      for (i = stack.length - 1; i >= 0; i--) { var o = stack[i][0][stack[i][1]]; if (o && typeof o === 'object' && !Object.keys(o).length) delete stack[i][0][stack[i][1]]; else break; }
    }
    function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
    function limit(v, n) {
      if (!n || !v || typeof v !== 'object') return v;
      var k = Object.keys(v).sort(); if (k.length <= n) return v;
      var o = {}; k.slice(-n).forEach(function (x) { o[x] = v[x]; }); return o;
    }
    function fire() {
      ls.forEach(function (l) {
        var v = limit(clone(read(l.path)), l.limitLast), s = JSON.stringify(v === undefined ? null : v);
        if (s !== l.last) { l.last = s; try { l.cb(v); } catch (e) { console.error(e); } }
      });
    }
    load();
    root.addEventListener('storage', function (e) { if (e.key === KEY) { load(); fire(); } });
    return {
      mode: 'local',
      init: function () { return Promise.resolve(); },
      get: function (p) { return Promise.resolve(clone(read(p))); },
      set: function (p, v) { write(p, v); save(); fire(); return Promise.resolve(); },
      update: function (o) { Object.keys(o).forEach(function (p) { write(p, o[p]); }); save(); fire(); return Promise.resolve(); },
      remove: function (p) { return this.set(p, null); },
      newKey: function () { seq++; return Date.now().toString(36) + ('0' + seq.toString(36)).slice(-2) + Math.random().toString(36).slice(2, 5); },
      listen: function (p, cb, opt) {
        var l = { path: p, cb: cb, limitLast: opt && opt.limitLast, last: undefined }; ls.push(l);
        setTimeout(function () { var v = limit(clone(read(p)), l.limitLast); l.last = JSON.stringify(v === undefined ? null : v); cb(v); }, 0);
        return function () { var i = ls.indexOf(l); if (i >= 0) ls.splice(i, 1); };
      },
      now: function () { return Date.now(); },
      onConn: function (cb) { cb(true); },
      _reset: function () { T = {}; save(); fire(); }
    };
  }

  function Firebase() {
    var d, m, off = 0, connCbs = [], connected = false;
    return {
      mode: 'firebase',
      init: function (cfg) {
        var base = 'https://www.gstatic.com/firebasejs/' + FB_VER + '/';
        return Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-database.js')]).then(function (r) {
          m = r[1]; d = m.getDatabase(r[0].initializeApp(cfg));
          m.onValue(m.ref(d, '.info/serverTimeOffset'), function (s) { off = s.val() || 0; });
          m.onValue(m.ref(d, '.info/connected'), function (s) { connected = !!s.val(); connCbs.forEach(function (f) { f(connected); }); });
        });
      },
      get: function (p) { return m.get(m.ref(d, p)).then(function (s) { return s.val(); }); },
      set: function (p, v) { return m.set(m.ref(d, p), v == null ? null : v); },
      update: function (o) { return m.update(m.ref(d), o); },
      remove: function (p) { return m.remove(m.ref(d, p)); },
      newKey: function (p) { return m.push(m.ref(d, p)).key; },
      listen: function (p, cb, opt) {
        var q = m.ref(d, p);
        if (opt && opt.limitLast) q = m.query(q, m.limitToLast(opt.limitLast));
        return m.onValue(q, function (s) { cb(s.val()); }, function (err) { console.error('Firebase listen lỗi', p, err); });
      },
      now: function () { return Date.now() + off; },
      onConn: function (cb) { connCbs.push(cb); cb(connected); }
    };
  }

  root.Store = {
    /** Trả về backend đã init */
    create: function (cfg) {
      var s = cfg && cfg.databaseURL ? Firebase() : Local();
      return s.init(cfg).then(function () { return s; });
    }
  };
})(window);
