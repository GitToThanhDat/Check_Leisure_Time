/* store.js - lớp lưu trữ có 2 chế độ cùng một giao diện:
 *   - 'firebase': Firebase Realtime Database (đồng bộ thật giữa mọi người)
 *   - 'local'   : localStorage (chỉ để dùng thử; đồng bộ giữa các tab cùng máy)
 * API: init(cfg), get(path), set(path,v), update({path:value|null,...}), newKey(path), remove(path),
 *      listen(path, cb, {limitLast, onError}) -> hàm huỷ, now(), mode, onConn(cb)
 *   auth: { onChange(cb(user|null)), signUp(name,pass), signIn(name,pass), signOut(), changePassword(old,new), user(),
 *           setRemember(bool), signInGoogle(hint), linkGoogle(hint), unlinkGoogle(), linkPassword(name,pass), setDisplayName(name), deleteSelf() }
 *        user = { uid, name, providers:['password','google.com'], email } ; tên đăng nhập chuyển thành email giả slug@ranhchua.app (Firebase) hoặc lưu cục bộ (chế độ thử).
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

    /* ---- Tài khoản giả lập trong localStorage (chỉ để dùng thử) ----
     * AU.acc: { khoá: {uid, name, h?(băm mật khẩu), g?(email Google giả lập)} } ; khoá = slug tên (có mật khẩu) hoặc 'g:'+uid (chỉ Google)
     * AU.goo: { emailGoogle: uid } ; AU.cur: uid đang đăng nhập (ghi nhớ) ; sessionStorage SK: đăng nhập chỉ trong phiên này */
    var AK = 'rc_local_auth_v1', SK = 'rc_local_cur', remember = true, acbs = [];
    function aload() { var o; try { o = JSON.parse(localStorage.getItem(AK) || 'null'); } catch (e) { o = null; } o = o || {}; o.acc = o.acc || {}; o.goo = o.goo || {}; if (o.cur === undefined) o.cur = null; return o; }
    var AU = aload();
    function asave() { try { localStorage.setItem(AK, JSON.stringify(AU)); } catch (e) { } }
    function curUid() { var s = null; try { s = sessionStorage.getItem(SK); } catch (e) { } return s || AU.cur; }
    function keyOf(uid) { return Object.keys(AU.acc).filter(function (k) { return AU.acc[k].uid === uid; })[0]; }
    function acur() {
      var uid = curUid(), k = uid && keyOf(uid); if (!k) return null; var a = AU.acc[k];
      return { uid: a.uid, name: a.name || '', providers: [a.h ? 'password' : null, a.g ? 'google.com' : null].filter(Boolean), email: a.g || null };
    }
    function anotify() { var u = acur(); acbs.forEach(function (f) { f(u); }); }
    function setCur(uid) {
      try { sessionStorage.removeItem(SK); } catch (e) { }
      if (uid && !remember) { AU.cur = null; try { sessionStorage.setItem(SK, uid); } catch (e) { } } else AU.cur = uid;
      asave(); anotify();
    }
    root.addEventListener('storage', function (e) { if (e.key === AK) { AU = aload(); anotify(); } });
    function sha(x) {
      if (root.crypto && crypto.subtle) return crypto.subtle.digest('SHA-256', new TextEncoder().encode(x)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); });
      return Promise.resolve(btoa(unescape(encodeURIComponent(x))));
    }
    function newUid() { return 'u' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
    function me() { var u = curUid(), k = u && keyOf(u); if (!k) throw mkErr('auth/no-user'); return { k: k, a: AU.acc[k] }; }
    function gEmail(h) { var e = String(h || '').trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+$/.test(e)) throw mkErr('auth/invalid-email'); return e; }
    var auth = {
      user: acur,
      onChange: function (cb) { acbs.push(cb); setTimeout(function () { cb(acur()); }, 0); },
      setRemember: function (on) { remember = !!on; return Promise.resolve(); },
      signUp: function (name, pass) {
        var k = Store.slug(name); if (!k) return Promise.reject(mkErr('auth/invalid-email'));
        if (String(pass).length < 6) return Promise.reject(mkErr('auth/weak-password'));
        if (AU.acc[k]) return Promise.reject(mkErr('auth/email-already-in-use'));
        return sha('rc:' + k + ':' + pass).then(function (h) {
          var uid = newUid(); AU.acc[k] = { uid: uid, name: name, h: h }; setCur(uid); return acur();
        });
      },
      signIn: function (name, pass) {
        var k = Store.slug(name), a = AU.acc[k];
        return sha('rc:' + k + ':' + pass).then(function (h) {
          if (!a || a.h !== h) throw mkErr('auth/invalid-credential');
          setCur(a.uid); return acur();
        });
      },
      /** Google giả lập: hint = email Google tự nhập (chế độ thử không có Google thật) */
      signInGoogle: function (hint) {
        try { var e = gEmail(hint), uid = AU.goo[e];
          if (!uid) { uid = newUid(); AU.acc['g:' + uid] = { uid: uid, name: e.split('@')[0], g: e }; AU.goo[e] = uid; }
          setCur(uid); return Promise.resolve(acur());
        } catch (er) { return Promise.reject(er); }
      },
      linkGoogle: function (hint) {
        try { var e = gEmail(hint), m = me();
          if (m.a.g) throw mkErr('auth/provider-already-linked');
          if (AU.goo[e] && AU.goo[e] !== m.a.uid) throw mkErr('auth/credential-already-in-use');
          m.a.g = e; AU.goo[e] = m.a.uid; asave(); anotify(); return Promise.resolve(acur());
        } catch (er) { return Promise.reject(er); }
      },
      unlinkGoogle: function () {
        try { var m = me(); if (!m.a.g) throw mkErr('auth/no-such-provider'); if (!m.a.h) throw mkErr('auth/no-other-method');
          delete AU.goo[m.a.g]; delete m.a.g; asave(); return Promise.resolve(acur());
        } catch (er) { return Promise.reject(er); }
      },
      linkPassword: function (name, pass) {
        try { var m = me(), k = Store.slug(name);
          if (m.a.h) throw mkErr('auth/provider-already-linked'); if (!k) throw mkErr('auth/invalid-email');
          if (String(pass).length < 6) throw mkErr('auth/weak-password');
          if (AU.acc[k] && AU.acc[k].uid !== m.a.uid) throw mkErr('auth/email-already-in-use');
        } catch (er) { return Promise.reject(er); }
        var mm = me(), k2 = Store.slug(name);
        return sha('rc:' + k2 + ':' + pass).then(function (h) { delete AU.acc[mm.k]; mm.a.h = h; AU.acc[k2] = mm.a; asave(); anotify(); return acur(); });
      },
      setDisplayName: function (name) { try { me().a.name = name; asave(); anotify(); return Promise.resolve(acur()); } catch (e) { return Promise.reject(e); } },
      deleteSelf: function () {
        try { var m = me(); if (m.a.g) delete AU.goo[m.a.g]; delete AU.acc[m.k]; setCur(null); return Promise.resolve(); } catch (e) { return Promise.reject(e); }
      },
      signOut: function () { setCur(null); return Promise.resolve(); },
      changePassword: function (oldP, newP) {
        var m; try { m = me(); } catch (e) { return Promise.reject(e); }
        if (!m.a.h) return Promise.reject(mkErr('auth/no-password'));
        if (String(newP).length < 6) return Promise.reject(mkErr('auth/weak-password'));
        var k = m.k;
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
    var redirErr = null;
    function pub(u) {
      return u ? { uid: u.uid, name: u.displayName || '', email: u.email || null, providers: (u.providerData || []).map(function (p) { return p.providerId; }) } : null;
    }
    function gprov() { var p = new am.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); return p; }
    function need() { var u = au.currentUser; return u ? Promise.resolve(u) : Promise.reject(mkErr('auth/no-user')); }
    function wrap(p) { return p.then(function (r) { return pub(r.user); }); }
    return {
      mode: 'firebase',
      auth: {
        user: function () { return au && au.currentUser ? pub(au.currentUser) : cur; },
        onChange: function (cb) { cbs.push(cb); if (ready) cb(cur); },
        /** on=true: nhớ đăng nhập trên máy này (mặc định của Firebase); false: chỉ trong phiên tab hiện tại */
        setRemember: function (on) { return am.setPersistence(au, on ? am.browserLocalPersistence : am.browserSessionPersistence).catch(function () { }); },
        signUp: function (name, pass) {
          return am.createUserWithEmailAndPassword(au, Store.slug(name) + DOMAIN, pass).then(function (r) {
            return am.updateProfile(r.user, { displayName: name }).then(function () { cur = pub(r.user); return cur; });
          });
        },
        signIn: function (name, pass) { return wrap(am.signInWithEmailAndPassword(au, Store.slug(name) + DOMAIN, pass)); },
        /** Mở cửa sổ Google; nếu bị chặn popup thì chuyển hướng cả trang (khi quay lại, onChange tự chạy) */
        signInGoogle: function () {
          return am.signInWithPopup(au, gprov()).then(function (r) { return pub(r.user); }, function (e) {
            if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) return am.signInWithRedirect(au, gprov()).then(function () { return new Promise(function () { }); });
            throw e;
          });
        },
        linkGoogle: function () { return need().then(function (u) { return am.linkWithPopup(u, gprov()); }).then(function (r) { cur = pub(r.user); return cur; }); },
        unlinkGoogle: function () { return need().then(function (u) { if (u.providerData.length < 2) throw mkErr('auth/no-other-method'); return am.unlink(u, 'google.com'); }).then(function (u) { cur = pub(u); return cur; }); },
        linkPassword: function (name, pass) {
          return need().then(function (u) { return am.linkWithCredential(u, am.EmailAuthProvider.credential(Store.slug(name) + DOMAIN, pass)); }).then(function (r) { cur = pub(r.user); return cur; });
        },
        setDisplayName: function (name) { return need().then(function (u) { return am.updateProfile(u, { displayName: name }).then(function () { cur = pub(u); return cur; }); }); },
        deleteSelf: function () { return need().then(function (u) { return am.deleteUser(u); }); },
        takeRedirectError: function () { var e = redirErr; redirErr = null; return e; },
        signOut: function () { return am.signOut(au); },
        changePassword: function (oldP, newP) {
          return need().then(function (u) {
            var pe = (u.providerData.filter(function (p) { return p.providerId === 'password'; })[0] || {}).email;
            if (!pe) throw mkErr('auth/no-password');
            return am.reauthenticateWithCredential(u, am.EmailAuthProvider.credential(pe, oldP)).then(function () { return am.updatePassword(u, newP); });
          });
        }
      },
      init: function (cfg) {
        var base = 'https://www.gstatic.com/firebasejs/' + FB_VER + '/';
        return Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-database.js'), import(base + 'firebase-auth.js')]).then(function (r) {
          var app = r[0].initializeApp(cfg); m = r[1]; am = r[2]; d = m.getDatabase(app); au = am.getAuth(app);
          am.getRedirectResult(au).catch(function (e) { redirErr = e; });
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
      'auth/operation-not-allowed': 'Chủ web chưa bật kiểu đăng nhập này (Email/Password hoặc Google) trong Firebase Console (xem HUONG-DAN.md).',
      'auth/popup-closed-by-user': 'Bạn đã đóng cửa sổ Google trước khi hoàn tất.', 'auth/cancelled-popup-request': 'Bạn đã đóng cửa sổ Google trước khi hoàn tất.',
      'auth/popup-blocked': 'Trình duyệt đã chặn cửa sổ Google. Hãy cho phép cửa sổ bật lên (popup) cho trang này rồi thử lại.',
      'auth/unauthorized-domain': 'Địa chỉ web này chưa được thêm vào Authorized domains trong Firebase Console (Authentication → Settings).',
      'auth/credential-already-in-use': 'Tài khoản Google này đã được dùng cho một tài khoản khác trên web. Hãy dùng tài khoản Google khác, hoặc đăng nhập thẳng bằng Google đó.',
      'auth/provider-already-linked': 'Tài khoản của bạn đã liên kết kiểu đăng nhập này rồi.', 'auth/no-other-method': 'Bạn cần còn một cách đăng nhập khác (mật khẩu hoặc Google) trước khi huỷ liên kết.',
      'auth/no-password': 'Tài khoản này chưa đặt mật khẩu.', 'auth/no-such-provider': 'Tài khoản chưa liên kết Google.', 'name/taken': 'Tên này đã có người dùng rồi. Hãy chọn tên khác (không phân biệt hoa/thường, dấu và khoảng trắng).',
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
