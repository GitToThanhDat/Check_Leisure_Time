/* bg.js - nền động bằng canvas + nền ảnh tuỳ chọn (ảnh lưu trong IndexedDB của trình duyệt) */
(function (root) {
  'use strict';
  var PRESETS = [
    { id: 'aurora', name: 'Cực quang', tone: 'any', sw: 'linear-gradient(135deg,#5b4bff,#00c2ff 55%,#ff4d9d)' },
    { id: 'stars', name: 'Sao đêm', tone: 'dark', sw: 'linear-gradient(180deg,#070b1f,#3a1f5c)' },
    { id: 'petals', name: 'Cánh hoa', tone: 'light', sw: 'linear-gradient(135deg,#ffe9f1,#ffc6da)' },
    { id: 'waves', name: 'Sóng biển', tone: 'any', sw: 'linear-gradient(180deg,#0b3d63,#14b8c4)' },
    { id: 'calm', name: 'Êm dịu', tone: 'any', sw: 'linear-gradient(135deg,#2a2f55,#6d5bd0)' },
    { id: 'image', name: 'Ảnh của tôi', tone: 'any', sw: 'linear-gradient(135deg,#444,#888)' }
  ];
  var cv, ctx, imgEl, shadeEl, cur = null, raf = 0, last = 0, dark = true, W = 0, H = 0, scale = 1, state = {}, pf = {}, t0 = performance.now();
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ---------- Renderers ---------- */
  var R = {};
  R.aurora = {
    scale: 0.25,
    init: function () { state.blobs = []; for (var i = 0; i < 5; i++) state.blobs.push({ x: rnd(0, 1), y: rnd(0, 1), r: rnd(0.35, 0.6), sp: rnd(0.04, 0.1), ph: rnd(0, 6.28), k: i }); },
    frame: function (t) {
      var pal = dark ? ['#5b4bff', '#00b3ff', '#ff3d9a', '#1fe0a0', '#8b5cff'] : ['#b9acff', '#8fdcff', '#ffb6d3', '#a9f1d4', '#d2b8ff'];
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = dark ? '#0a0e1f' : '#f1f4ff'; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      state.blobs.forEach(function (b, i) {
        var x = (0.5 + 0.42 * Math.sin(t * b.sp + b.ph)) * W, y = (0.5 + 0.42 * Math.cos(t * b.sp * 0.8 + b.ph * 1.7)) * H, r = b.r * Math.max(W, H);
        var g = ctx.createRadialGradient(x, y, 0, x, y, r), c = pal[i % pal.length];
        g.addColorStop(0, c + (dark ? '99' : 'cc')); g.addColorStop(1, c + '00');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      });
    }
  };
  R.stars = {
    scale: 1,
    init: function () {
      var n = Math.min(260, Math.round(W * H / 5500)); state.st = [];
      for (var i = 0; i < n; i++) state.st.push({ x: Math.random(), y: Math.random(), r: rnd(0.4, 1.6), ph: rnd(0, 6.28), sp: rnd(0.6, 2.2) });
      state.shoot = null; state.nextShoot = 3;
    },
    frame: function (t, dt) {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      if (dark) { g.addColorStop(0, '#060919'); g.addColorStop(0.6, '#171442'); g.addColorStop(1, '#3a1f5c'); }
      else { g.addColorStop(0, '#bfe0ff'); g.addColorStop(0.7, '#e8dcff'); g.addColorStop(1, '#ffe3ef'); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      state.st.forEach(function (s) {
        var a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
        ctx.fillStyle = dark ? 'rgba(255,255,255,' + a.toFixed(2) + ')' : 'rgba(255,255,255,' + (a * 0.9).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r * (dark ? 1 : 1.6), 0, 6.283); ctx.fill();
      });
      if (dark) {
        state.nextShoot -= dt;
        if (state.nextShoot <= 0 && !state.shoot) { state.shoot = { x: rnd(0.2, 1) * W, y: rnd(0, 0.4) * H, v: 0, life: 0 }; state.nextShoot = rnd(4, 10); }
        var s = state.shoot;
        if (s) {
          s.life += dt; var p = s.life / 0.9, x = s.x - p * W * 0.35, y = s.y + p * H * 0.25;
          var gr = ctx.createLinearGradient(x, y, x + 120, y - 80); gr.addColorStop(0, 'rgba(255,255,255,' + (1 - p).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.strokeStyle = gr; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 120, y - 80); ctx.stroke();
          if (p >= 1) state.shoot = null;
        }
      }
    }
  };
  R.petals = {
    scale: 1,
    init: function () {
      var n = Math.round(Math.min(40, Math.max(16, W / 38))); state.p = [];
      for (var i = 0; i < n; i++) state.p.push(mkPetal(true));
    },
    frame: function (t, dt) {
      var g = ctx.createLinearGradient(0, 0, W, H);
      if (dark) { g.addColorStop(0, '#1b1030'); g.addColorStop(1, '#3a1a45'); } else { g.addColorStop(0, '#fff0f5'); g.addColorStop(0.6, '#ffe4ee'); g.addColorStop(1, '#fff3e6'); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      state.p.forEach(function (p, i) {
        p.y += p.vy * dt; p.x += (p.vx + Math.sin(t * p.sw + p.ph) * 18) * dt; p.rot += p.vr * dt;
        if (p.y > H + 30 || p.x < -40 || p.x > W + 40) state.p[i] = Object.assign(mkPetal(false), {});
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(t * p.fl + p.ph)));
        ctx.fillStyle = dark ? 'rgba(255,170,205,' + (p.a * 0.7).toFixed(2) + ')' : 'rgba(255,160,195,' + p.a.toFixed(2) + ')';
        ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-p.s * 0.2, -p.s * 0.1, p.s * 0.45, p.s * 0.2, 0, 0, 6.283); ctx.fill();
        ctx.restore();
      });
    }
  };
  function mkPetal(init) { return { x: rnd(0, W), y: init ? rnd(0, H) : rnd(-60, -10), s: rnd(6, 13), vy: rnd(22, 48), vx: rnd(-8, 14), sw: rnd(0.5, 1.4), ph: rnd(0, 6.28), rot: rnd(0, 6.28), vr: rnd(-1, 1), fl: rnd(0.8, 2), a: rnd(0.45, 0.85) }; }
  R.waves = {
    scale: 0.5,
    init: function () { },
    frame: function (t) {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      if (dark) { g.addColorStop(0, '#04132b'); g.addColorStop(1, '#0a4b6e'); } else { g.addColorStop(0, '#d6f1ff'); g.addColorStop(1, '#a7e3ee'); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      var cols = dark ? ['rgba(30,140,190,0.35)', 'rgba(20,184,196,0.3)', 'rgba(110,231,255,0.2)', 'rgba(255,255,255,0.1)'] : ['rgba(80,170,220,0.28)', 'rgba(60,200,210,0.26)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0.4)'];
      for (var k = 0; k < 4; k++) {
        ctx.fillStyle = cols[k]; ctx.beginPath(); ctx.moveTo(0, H);
        var base = H * (0.55 + k * 0.1), amp = H * (0.03 + k * 0.008), f = 0.006 + k * 0.002, sp = 0.5 + k * 0.25;
        for (var x = 0; x <= W; x += 6) ctx.lineTo(x, base + Math.sin(x * f + t * sp + k) * amp + Math.sin(x * f * 2.3 - t * sp * 0.7) * amp * 0.4);
        ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      }
    }
  };
  R.calm = {
    scale: 0.25, still: true, init: function () { },
    frame: function () {
      var g = ctx.createLinearGradient(0, 0, W, H);
      if (dark) { g.addColorStop(0, '#171a38'); g.addColorStop(1, '#3a2f7a'); } else { g.addColorStop(0, '#eef1ff'); g.addColorStop(1, '#dcd4ff'); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  };

  /* ---------- Điều khiển ---------- */
  function size() {
    var r = R[cur]; if (!r) return;
    scale = r.scale * Math.min(window.devicePixelRatio || 1, 1.5) / (r.scale === 1 ? 1 : 1);
    var s = r.scale === 1 ? Math.min(window.devicePixelRatio || 1, 1.5) : r.scale;
    W = Math.max(2, Math.round(innerWidth * s)); H = Math.max(2, Math.round(innerHeight * s));
    cv.width = W; cv.height = H; r.init();
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    var r = R[cur]; if (!r || document.hidden) return;
    var fps = pf.motion === false ? 0 : 1000 / 40;
    if (now - last < fps) return;
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    r.frame((now - t0) / 1000, dt);
  }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function drawStill() { var r = R[cur]; if (r) { r.frame(5, 0.016); } }

  /* ---------- Ảnh nền (IndexedDB) ---------- */
  function idb() {
    return new Promise(function (res, rej) {
      var q = indexedDB.open('rc_kv', 1);
      q.onupgradeneeded = function () { q.result.createObjectStore('kv'); };
      q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); };
    });
  }
  function idbGet(k) { return idb().then(function (db) { return new Promise(function (res) { var r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = function () { res(r.result || null); }; r.onerror = function () { res(null); }; }); }).catch(function () { return null; }); }
  function idbSet(k, v) { return idb().then(function (db) { return new Promise(function (res, rej) { var tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = function () { rej(tx.error); }; }); }); }

  var Bg = {
    PRESETS: PRESETS,
    tone: function (id) { var p = PRESETS.filter(function (x) { return x.id === id; })[0]; return p ? p.tone : 'any'; },
    /** Lưu ảnh người dùng chọn (thu nhỏ còn tối đa 1920px) */
    setImageFile: function (file) {
      return new Promise(function (res, rej) {
        var img = new Image(), url = URL.createObjectURL(file);
        img.onload = function () {
          var k = Math.min(1, 1920 / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url); var data = c.toDataURL('image/jpeg', 0.85);
          idbSet('bgimg', data).then(function () { res(data); }, rej);
        };
        img.onerror = function () { rej(new Error('Không đọc được ảnh này')); }; img.src = url;
      });
    },
    apply: function (p, isDark) {
      pf = p; dark = isDark;
      if (!cv) { cv = document.getElementById('bgc'); ctx = cv.getContext('2d'); imgEl = document.getElementById('bgimg'); shadeEl = document.getElementById('bgshade'); }
      var id = R[p.bg] ? p.bg : (p.bg === 'image' ? 'image' : 'aurora');
      var isImg = id === 'image';
      imgEl.style.display = isImg ? 'block' : 'none'; cv.style.display = isImg ? 'none' : '';
      shadeEl.style.background = (isDark ? 'rgba(6,8,20,' : 'rgba(255,255,255,') + (p.bgDim || 0) + ')';
      shadeEl.style.backdropFilter = shadeEl.style.webkitBackdropFilter = p.bgBlur ? 'blur(' + p.bgBlur + 'px)' : 'none';
      if (isImg) {
        stopLoop(); cur = null;
        (p.bgUrl ? Promise.resolve(p.bgUrl) : idbGet('bgimg')).then(function (src) {
          if (src) imgEl.style.backgroundImage = 'url("' + src + '")';
          else { imgEl.style.backgroundImage = 'none'; imgEl.style.background = isDark ? 'linear-gradient(135deg,#171a38,#3a2f7a)' : 'linear-gradient(135deg,#eef1ff,#dcd4ff)'; }
        });
        return;
      }
      var changed = cur !== id; cur = id; stopLoop();
      size();
      var still = p.motion === false || R[id].still || (root.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && p.motion !== true);
      if (still) drawStill(); else { last = 0; raf = requestAnimationFrame(loop); }
    },
    resize: function () { if (cur) { size(); if (pf.motion === false || R[cur].still) drawStill(); } }
  };
  window.addEventListener('resize', (function () { var t; return function () { clearTimeout(t); t = setTimeout(Bg.resize, 200); }; })());
  root.Bg = Bg;
})(window);
