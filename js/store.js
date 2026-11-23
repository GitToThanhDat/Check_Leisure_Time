/* store.js - lớp lưu trữ có 2 chế độ cùng một giao diện:
 *   - 'firebase': Firebase Realtime Database (đồng bộ thật giữa mọi người)
 *   - 'local'   : localStorage (chỉ để dùng thử; đồng bộ giữa các tab cùng máy)
 * API: init(cfg), get(path), set(path,v), update({path:value|null,...}), newKey(path), remove(path),
 *      listen(path, cb, {limitLast, onError}) -> hàm huỷ, now(), mode, onConn(cb)
 *   auth: { onChange(cb(user|null)), signUp(name,pass), signIn(name,pass), signOut(), changePassword(old,new), user() }
 *        user = { uid, name } ; tên đăng nhập chuyển thành email giả slug@ranhchua.app (Firebase) hoặc lưu cục bộ (chế độ thử).
 */
(function (root) {
  'use strict';
  var FB_VER = '10.14.1', DOMAIN = '@ranhchua.app';
  function mkErr(code, msg) { var e = new Error(msg || code); e.code = code; return e; }

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

    /* ---- Tài khoản giả lập trong localStorage (chỉ để dùng thử) ---- */
    var AK = 'rc_local_auth_v1', AU = JSON.parse(localStorage.getItem(AK) || '{"acc":{},"cur":null}'), acbs = [];
    function asave() { try { localStorage.setItem(AK, JSON.stringify(AU)); } catch (e) { } }
    function acur() { var a = AU.cur && Object.keys(AU.acc).map(function (k) { return AU.acc[k]; }).filter(function (x) { return x.uid === AU.cur; })[0]; return a ? { uid: a.uid, name: a.name } : null; }
    function anotify() { var u = acur(); acbs.forEach(function (f) { f(u); }); }
    root.addEventListener('storage', function (e) { if (e.key === AK) { AU = JSON.parse(e.newValue || '{"acc":{},"cur":null}'); anotify(); } });
    function sha(x) {
      if (root.crypto && crypto.subtle) return crypto.subtle.digest('SHA-256', new TextEncoder().encode(x)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); });
      return Promise.resolve(btoa(unescape(encodeURIComponent(x))));
    }
    var auth = {
      user: acur,
      onChange: function (cb) { acbs.push(cb); setTimeout(function () { cb(acur()); }, 0); },
      signUp: function (name, pass) {
        var k = Store.slug(name); if (!k) return Promise.reject(mkErr('auth/invalid-email'));
        if (String(pass).length < 6) return Promise.reject(mkErr('auth/weak-password'));
        if (AU.acc[k]) return Promise.reject(mkErr('auth/email-already-in-use'));
        return sha('rc:' + k + ':' + pass).then(function (h) {
          var uid = 'u' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
          AU.acc[k] = { uid: uid, name: name, h: h }; AU.cur = uid; asave(); anotify(); return acur();
        });
      },
      signIn: function (name, pass) {
        var k = Store.slug(name), a = AU.acc[k];
        return sha('rc:' + k + ':' + pass).then(function (h) {
          if (!a || a.h !== h) throw mkErr('auth/invalid-credential');
          AU.cur = a.uid; asave(); anotify(); return acur();
        });
      },
      signOut: function () { AU.cur = null; asave(); anotify(); return Promise.resolve(); },
      changePassword: function (oldP, newP) {
        var u = acur(); if (!u) return Promise.reject(mkErr('auth/no-user'));
        if (String(newP).length < 6) return Promise.reject(mkErr('auth/weak-password'));
        var k = Store.slug(u.name);
        return sha('rc:' + k + ':' + oldP).then(function (h) {
          if (AU.acc[k].h !== h) throw mkErr('auth/invalid-credential');
          return sha('rc:' + k + ':' + newP).then(function (h2) { AU.acc[k].h = h2; asave(); });
        });
      }
    };
    load();
    root.addEventListener('storage', function (e) { if (e.key === KEY) { load(); fire(); } });
    return {
      mode: 'local', auth: auth,
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
    var d, m, am, au, off = 0, connCbs = [], connected = false, cbs = [], cur = null, ready = false;
    function pub(u) { return u ? { uid: u.uid, name: u.displayName || '' } : null; }
    function wrap(p) { return p.then(function (r) { return pub(r.user); }); }
    return {
      mode: 'firebase',
      auth: {
        user: function () { return cur; },
        onChange: function (cb) { cbs.push(cb); if (ready) cb(cur); },
        signUp: function (name, pass) {
          return am.createUserWithEmailAndPassword(au, Store.slug(name) + DOMAIN, pass).then(function (r) {
            return am.updateProfile(r.user, { displayName: name }).then(function () { cur = { uid: r.user.uid, name: name }; return cur; });
          });
        },
        signIn: function (name, pass) { return wrap(am.signInWithEmailAndPassword(au, Store.slug(name) + DOMAIN, pass)); },
        signOut: function () { return am.signOut(au); },
        changePassword: function (oldP, newP) {
          var u = au.currentUser; if (!u) return Promise.reject(mkErr('auth/no-user'));
          return am.reauthenticateWithCredential(u, am.EmailAuthProvider.credential(u.email, oldP)).then(function () { return am.updatePassword(u, newP); });
        }
      },
      init: function (cfg) {
        var base = 'https://www.gstatic.com/firebasejs/' + FB_VER + '/';
        return Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-database.js'), import(base + 'firebase-auth.js')]).then(function (r) {
          var app = r[0].initializeApp(cfg); m = r[1]; am = r[2]; d = m.getDatabase(app); au = am.getAuth(app);
          am.onAuthStateChanged(au, function (u) { cur = pub(u); ready = true; cbs.forEach(function (f) { f(cur); }); });
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
        return m.onValue(q, function (s) { cb(s.val()); }, function (err) { console.warn('Firebase listen lỗi', p, err.code || err); if (opt && opt.onError) opt.onError(err); });
      },
      now: function () { return Date.now() + off; },
      onConn: function (cb) { connCbs.push(cb); cb(connected); }
    };
  }

  /** Khoá duy nhất của tên (giống U.slug nhưng store.js nạp trước util.js) */
  function slugOf(name) { return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  /** Chuyển mã lỗi Firebase Auth thành câu tiếng Việt dễ hiểu */
  function authMsg(e) {
    var c = (e && e.code) || '';
    var map = {
      'auth/email-already-in-use': 'Tên này đã có người dùng rồi. Hãy chọn tên khác (không phân biệt hoa/thường, dấu và khoảng trắng).',
      'auth/invalid-credential': 'Sai tên hoặc mật khẩu.', 'auth/wrong-password': 'Sai tên hoặc mật khẩu.', 'auth/user-not-found': 'Sai tên hoặc mật khẩu.', 'auth/invalid-login-credentials': 'Sai tên hoặc mật khẩu.',
      'auth/weak-password': 'Mật khẩu cần ít nhất 6 ký tự.', 'auth/invalid-email': 'Tên không hợp lệ: cần có ít nhất một chữ hoặc số.',
      'auth/network-request-failed': 'Không kết nối được mạng, thử lại nhé.', 'auth/too-many-requests': 'Thử quá nhiều lần, đợi một lát rồi thử lại.',
      'auth/operation-not-allowed': 'Chủ web chưa bật đăng nhập Email/Password trong Firebase Console (xem HUONG-DAN.md).',
      'auth/requires-recent-login': 'Hãy đăng nhập lại rồi thử tiếp.', 'auth/no-user': 'Bạn chưa đăng nhập.'
    };
    return map[c] || (e && e.message) || 'Có lỗi xảy ra';
  }
  root.Store = {
    slug: slugOf, authMsg: authMsg,
    /** Trả về backend đã init */
    create: function (cfg) {
      var s = cfg && cfg.databaseURL ? Firebase() : Local();
      return s.init(cfg).then(function () { return s; });
    }
  };
})(window);
