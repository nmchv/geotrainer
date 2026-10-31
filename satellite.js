/* Спутниковый слой для index.html.
 *
 * Карты в maps*.js — это SVG в разных проекциях. Параметры проекции каждой карты подобраны
 * по сетке меридианов/параллелей (точность около 0,1 px), поэтому любую точку SVG можно
 * перевести в широту/долготу. Под SVG рисуется <canvas id="sat">: сетка из ячеек, у каждой
 * вершины считаются координаты, по ним берутся плитки снимков (Web Mercator), которые WebGL
 * накладывает на ячейки. Контуры SVG остаются поверх снимка и кликабельны, как обычно.
 *
 * Настройки (необязательно, в config.js):
 *   GT_CONFIG.satelliteTiles   — шаблон URL плиток, {z} {x} {y}; по умолчанию Esri World Imagery
 *   GT_CONFIG.satelliteMaxZoom — самый детальный уровень плиток (по умолчанию 17)
 *   GT_CONFIG.satelliteAttr    — подпись источника снимков
 */
(function (root) {
  'use strict';

  // ---------- параметры проекций (подобраны скриптом по maps*.js) ----------
  // id: [семейство, поворот λ, φ, γ, масштаб, сдвиг x, сдвиг y, (параллель 1, параллель 2)]
  var PROJ = {
    "europe": ["conConf",-11.997182,-0.003133,-0.00503,1286.926797,489.814579,1510.75292,79.328711,16.746243],
    "world": ["natEarth",-0.00542,0.0,0.0,178.575371,500.013653,259.999937],
    "russia": ["conEA",-100.003923,-0.0,-0.003068,709.82647,584.459922,1077.247332,52.008219,67.98986],
    "asia": ["conEA",-87.996956,-0.001577,-0.001666,536.232958,431.406298,570.787681,9.999662,51.998338],
    "africa": ["azEA",-20.001512,-1.998866,0.000662,698.657263,542.373314,450.06025],
    "namerica": ["azEA",100.087674,-50.000662,-0.062494,566.508729,580.340896,356.705311],
    "samerica": ["azEA",60.00569,15.021743,0.001742,1171.130427,468.087558,592.775432],
    "oceania": ["merc",-98.659966,0.000203,0.000456,591.980514,-123.325861,176.637597],
    "fo": ["conEA",-104.500351,0.000311,0.000387,720.944354,594.435011,1037.885795,47.833535,75.169839],
    "cfo": ["conEA",-38.706642,-1.200222,0.077497,6090.450395,505.425641,5787.799468,56.935293,490.134988],
    "szfo": ["conEA",-43.491477,-0.021364,-0.017536,2393.328354,632.874453,2867.436223,57.103553,70.449387],
    "yufo": ["conEA",-41.018288,0.033869,0.019133,4543.89271,534.003004,3812.065426,44.666477,50.245294],
    "skfo": ["azEQ",-45.218,-43.041,0.496,9600.387,564.714,551.789],
    "pfo": ["conEA",-51.729392,0.326946,-0.029595,4672.538236,478.660944,4696.578518,-231.856358,119.601604],
    "urfo": ["conEA",-70.76184,-0.024498,0.023022,3730.412038,522.319524,4436.0564,55.441944,70.111262],
    "sfo": ["conEA",-95.243047,-0.013588,-0.012508,2141.848792,530.22057,2717.391824,73.040284,53.632872],
    "dfo": ["conEA",-144.248185,0.001307,-0.002347,1297.977951,592.841991,1664.87143,71.667346,47.137615],
    "szyu": ["conEA",-43.495016,-0.014938,-0.007999,2411.621941,629.564377,2941.555078,48.2862,68.684698],
    "skpu": ["conEA",-63.005089,-0.026421,0.007683,2092.621181,599.808718,2553.551496,111.694051,46.438991],
    "sibdv": ["conEA",-130.999966,0.003375,0.000178,1080.060685,584.375311,1443.207071,47.154387,71.752567]
  };

  var D2R = Math.PI / 180, R2D = 180 / Math.PI, PI = Math.PI, TAU = 2 * Math.PI, HP = Math.PI / 2;
  function sign(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; }

  // ---------- обратные проекции (SVG → широта/долгота), формулы как в d3-geo ----------
  function rotInv(p) {
    var dl = (p[0] * D2R) % TAU, dp = p[1] * D2R, dg = p[2] * D2R;
    var cp = Math.cos(dp), sp = Math.sin(dp), cg = Math.cos(dg), sg = Math.sin(dg), pg = !!(dp || dg);
    return function (l, f) {
      if (pg) {
        var cf = Math.cos(f), X = Math.cos(l) * cf, Y = Math.sin(l) * cf, Z = Math.sin(f), k = Z * cg - Y * sg;
        l = Math.atan2(Y * cg + Z * sg, X * cp + k * sp);
        f = Math.asin(Math.max(-1, Math.min(1, k * cp - X * sp)));
      }
      if (dl) l -= dl;
      if (Math.abs(l) > PI) l -= Math.round(l / TAU) * TAU;
      return [l, f];
    };
  }

  function rawInv(fam, p) {
    var n, c, r0, f, y0, y1, sy0;
    switch (fam) {
      case 'conEA':
        y0 = p[6] * D2R; y1 = p[7] * D2R; sy0 = Math.sin(y0);
        n = (sy0 + Math.sin(y1)) / 2; c = 1 + sy0 * (2 * n - sy0); r0 = Math.sqrt(c) / n;
        return function (x, y) {
          var r0y = r0 - y, l = Math.atan2(x, Math.abs(r0y)) * sign(r0y);
          if (r0y * n < 0) l -= PI * sign(x) * sign(r0y);
          var s = (c - (x * x + r0y * r0y) * n * n) / (2 * n);
          return s > 1 || s < -1 ? null : [l / n, Math.asin(s)];
        };
      case 'conConf':
        y0 = p[6] * D2R; y1 = p[7] * D2R;
        var tany = function (y) { return Math.tan((HP + y) / 2); };
        n = y0 === y1 ? Math.sin(y0) : Math.log(Math.cos(y0) / Math.cos(y1)) / Math.log(tany(y1) / tany(y0));
        f = Math.cos(y0) * Math.pow(tany(y0), n) / n;
        return function (x, y) {
          var fy = f - y, r = sign(n) * Math.sqrt(x * x + fy * fy), l = Math.atan2(x, Math.abs(fy)) * sign(fy);
          if (fy * n < 0) l -= PI * sign(x) * sign(fy);
          return [l / n, 2 * Math.atan(Math.pow(f / r, 1 / n)) - HP];
        };
      case 'azEA':
      case 'azEQ':
        var eq = fam === 'azEA';
        return function (x, y) {
          var z = Math.sqrt(x * x + y * y), cc;
          if (eq) { if (z > 2) return null; cc = 2 * Math.asin(z / 2); } else cc = z;
          var sc = Math.sin(cc), co = Math.cos(cc), s = z && y * sc / z;
          return s > 1 || s < -1 ? null : [Math.atan2(x * sc, z * co), Math.asin(s)];
        };
      case 'natEarth':
        return function (x, y) {
          var phi = y, i = 25, delta, phi2, phi4;
          do {
            phi2 = phi * phi; phi4 = phi2 * phi2;
            phi -= delta = (phi * (1.007226 + phi2 * (0.015085 + phi4 * (-0.044475 + 0.028874 * phi2 - 0.005916 * phi4))) - y) /
              (1.007226 + phi2 * (0.015085 * 3 + phi4 * (-0.044475 * 7 + 0.028874 * 9 * phi2 - 0.005916 * 11 * phi4)));
          } while (Math.abs(delta) > 1e-6 && --i > 0);
          phi2 = phi * phi;
          var lam = x / (0.8707 + phi2 * (-0.131979 + phi2 * (-0.013791 + phi2 * phi2 * phi2 * (0.003971 - 0.001529 * phi2))));
          // за контуром планеты (углы и края мировой карты) точек нет
          return Math.abs(phi) > HP || Math.abs(lam) > PI ? null : [lam, phi];
        };
      case 'merc':
        return function (x, y) { return [x, 2 * Math.atan(Math.exp(y)) - HP]; };
    }
    return null;
  }

  /** Возвращает функцию (x, y в единицах SVG) → [долгота, широта] в градусах или null. */
  function makeInv(def) {
    if (!def) return null;
    var fam = def[0], p = def.slice(1), k = p[3], tx = p[4], ty = p[5];
    var raw = rawInv(fam, p), rot = rotInv(p);
    if (!raw) return null;
    return function (x, y) {
      var r = raw((x - tx) / k, (ty - y) / k);
      if (!r || !isFinite(r[0]) || !isFinite(r[1])) return null;
      var g = rot(r[0], r[1]);
      return [g[0] * R2D, g[1] * R2D];
    };
  }

  function haversine(a, b) {
    var dφ = (b[1] - a[1]) * D2R, dλ = (b[0] - a[0]) * D2R;
    var s = Math.sin(dφ / 2) * Math.sin(dφ / 2) + Math.cos(a[1] * D2R) * Math.cos(b[1] * D2R) * Math.sin(dλ / 2) * Math.sin(dλ / 2);
    return 12742000 * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  var LATMAX = 85.05112878;
  function mercY(lat) {            // 0 — север, 1 — юг
    var f = Math.max(-LATMAX, Math.min(LATMAX, lat)) * D2R;
    return (1 - Math.log(Math.tan(PI / 4 + f / 2)) / PI) / 2;
  }

  // ---------- слой ----------
  var cfg = root.GT_CONFIG || {};
  var TILE_URL = cfg.satelliteTiles || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  var MAXZ = cfg.satelliteMaxZoom || 17;
  var ATTR = cfg.satelliteAttr || 'Снимки: Esri, Maxar, Earthstar Geographics, сообщество GIS';
  var CELL = 16;                    // размер ячейки сетки, css-пиксели

  var S = {
    active: false, id: null, def: null, inv: null, vb: null, raf: 0, failed: false,
    cv: null, gl: null, prog: null, tex: null, bufPos: null, bufUv: null, bufIdx: null, aPos: -1, aUv: -1,
    mc: null, mctx: null, mo: null,                         // мозаика: холст и её описание
    cache: new Map(), queue: [], inflight: 0, maxTiles: 14, attrEl: null
  };

  function initGL() {
    if (S.gl || S.failed) return !S.failed;
    S.cv = document.getElementById('sat');
    if (!S.cv) { S.failed = true; return false; }
    var gl = null;
    try { gl = S.cv.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false }); } catch (e) {}
    if (!gl) { S.failed = true; return false; }
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var vs = sh(gl.VERTEX_SHADER, 'attribute vec2 a_pos;attribute vec2 a_uv;varying vec2 v_uv;void main(){gl_Position=vec4(a_pos,0.,1.);v_uv=a_uv;}');
    var fs = sh(gl.FRAGMENT_SHADER, 'precision highp float;uniform sampler2D u_tex;varying vec2 v_uv;void main(){gl_FragColor=texture2D(u_tex,v_uv);}');
    var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { S.failed = true; return false; }
    S.gl = gl; S.prog = pr;
    S.aPos = gl.getAttribLocation(pr, 'a_pos'); S.aUv = gl.getAttribLocation(pr, 'a_uv');
    S.bufPos = gl.createBuffer(); S.bufUv = gl.createBuffer(); S.bufIdx = gl.createBuffer();
    S.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, S.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    S.maxTiles = Math.max(2, Math.min(14, Math.floor((gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096) / 256)));
    S.mc = document.createElement('canvas'); S.mctx = S.mc.getContext('2d');
    S.cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); S.gl = null; S.mo = null; });
    S.cv.addEventListener('webglcontextrestored', function () { S.gl = null; S.mo = null; if (S.active) { initGL(); schedule(); } });
    return true;
  }

  // ---------- плитки ----------
  function tileUrl(z, x, y) { return TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y); }
  function key(z, x, y) { return z + '/' + x + '/' + y; }

  function pump() {
    while (S.inflight < 10 && S.queue.length) {
      var t = S.queue.pop();                      // самые свежие запросы — первыми
      if (t.state !== 'wait') continue;
      t.state = 'load'; S.inflight++;
      (function (t) {
        var done = function (ok) {
          S.inflight--; t.state = ok ? 'ok' : 'fail';
          if (ok) tileReady(t);
          pump();
        };
        var fn = root.GT_SAT_TILE;                // отладочный хук: функция (z,x,y) → холст/картинка
        if (fn) { Promise.resolve(fn(t.z, t.x, t.y)).then(function (im) { t.img = im; done(true); }, function () { done(false); }); return; }
        var img = new Image(); img.crossOrigin = 'anonymous';
        img.onload = function () { t.img = img; done(true); };
        img.onerror = function () { done(false); };
        img.src = tileUrl(t.z, t.x, t.y);
      })(t);
    }
  }

  function getTile(z, x, y, wantLoad) {
    var k = key(z, x, y), t = S.cache.get(k);
    if (!t) {
      t = { z: z, x: x, y: y, state: 'idle', img: null };
      S.cache.set(k, t);
      if (S.cache.size > 900) { var it = S.cache.keys(); for (var i = 0; i < 200; i++) S.cache.delete(it.next().value); }
    }
    if (wantLoad && t.state === 'idle') { t.state = 'wait'; S.queue.push(t); }
    return t;
  }

  function paintTile(ctx, t, dx, dy) {
    if (t.state === 'ok' && t.img) { ctx.drawImage(t.img, dx, dy, 256, 256); return; }
    for (var d = 1; d <= 8 && t.z - d >= 0; d++) {         // пока плитка грузится — растянутая плитка уровнем ниже
      var a = S.cache.get(key(t.z - d, t.x >> d, t.y >> d));
      if (a && a.state === 'ok' && a.img) {
        var sz = 256 / (1 << d);
        ctx.drawImage(a.img, (t.x - ((t.x >> d) << d)) * sz, (t.y - ((t.y >> d) << d)) * sz, sz, sz, dx, dy, 256, 256);
        return;
      }
    }
  }

  function tileReady(t) {
    var m = S.mo;
    if (!m || !S.gl || m.z !== t.z) return;
    var j = t.y - m.ty0;
    // x с учётом обёртки по долготе: плитка могла попасть в мозаику несколько раз
    var n = 1 << t.z;
    for (var i = 0; i < m.ntx; i++) {
      if ((((m.tx0 + i) % n) + n) % n !== t.x) continue;
      if (j < 0 || j >= m.nty) continue;
      S.mctx.drawImage(t.img, i * 256, j * 256, 256, 256);
      try {
        S.gl.bindTexture(S.gl.TEXTURE_2D, S.tex);
        S.gl.texSubImage2D(S.gl.TEXTURE_2D, 0, i * 256, j * 256, S.gl.RGBA, S.gl.UNSIGNED_BYTE, t.img);
      } catch (e) { m.dirty = true; }
    }
    schedule();
  }

  function buildMosaic(z, tx0, ty0, ntx, nty) {
    var gl = S.gl, n = 1 << z;
    S.mc.width = ntx * 256; S.mc.height = nty * 256;
    var ctx = S.mctx; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#0a1727'; ctx.fillRect(0, 0, S.mc.width, S.mc.height);
    S.queue.length = 0;
    var need = [];
    for (var j = 0; j < nty; j++) for (var i = 0; i < ntx; i++) {
      var y = ty0 + j; if (y < 0 || y >= n) continue;
      var x = (((tx0 + i) % n) + n) % n;
      var t = getTile(z, x, y, true);
      paintTile(ctx, t, i * 256, j * 256);
      need.push(t);
    }
    // ближе к центру — раньше (очередь берёт с конца)
    var cx = tx0 + ntx / 2, cy = ty0 + nty / 2;
    S.queue.sort(function (a, b) {
      var da = Math.abs(a.x - cx % n) + Math.abs(a.y - cy), db = Math.abs(b.x - cx % n) + Math.abs(b.y - cy);
      return db - da;
    });
    gl.bindTexture(gl.TEXTURE_2D, S.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, S.mc);
    S.mo = { z: z, tx0: tx0, ty0: ty0, ntx: ntx, nty: nty, dirty: false };
    pump();
  }

  // ---------- отрисовка ----------
  function schedule() { if (!S.raf && S.active) S.raf = requestAnimationFrame(draw); }

  function draw() {
    S.raf = 0; var T0 = performance.now(), T1 = 0, T2 = 0;
    if (!S.active || !S.vb || !S.inv || !initGL()) return;
    var svg = document.getElementById('svg'), r = svg.getBoundingClientRect(), W = r.width, H = r.height;
    if (!W || !H) return;
    var gl = S.gl, vb = S.vb, inv = S.inv;
    var dpr = Math.min(root.devicePixelRatio || 1, 2);
    var cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (S.cv.width !== cw || S.cv.height !== ch) { S.cv.width = cw; S.cv.height = ch; }
    var s = Math.max(vb.w / W, vb.h / H), ox = (W - vb.w / s) / 2, oy = (H - vb.h / s) / 2;

    // у мировой карты есть край проекции — там ячейки мельче, чтобы кромка не была ступенчатой
    var CELL = S.def && S.def[0] === 'natEarth' ? 8 : 16;
    if ((Math.ceil(W / CELL) + 1) * (Math.ceil(H / CELL) + 1) > 60000) CELL = 16;
    var nx =Math.ceil(W / CELL), ny = Math.ceil(H / CELL), gx = nx + 1, gy = ny + 1, N = gx * gy;
    var lon = new Float64Array(N), lat = new Float64Array(N), ok = new Uint8Array(N);
    var ref = null, ci = nx >> 1, cj = ny >> 1;
    function vert(i, j) {
      var px = Math.min(i * CELL, W), py = Math.min(j * CELL, H);
      return inv(vb.x + (px - ox) * s, vb.y + (py - oy) * s);
    }
    var c0 = vert(ci, cj);
    if (!c0) { // центр экрана вне проекции — ищем любую допустимую вершину
      for (var q = 0; q < N && !c0; q += 7) c0 = vert(q % gx, (q / gx) | 0);
    }
    if (!c0) { gl.clearColor(0.04, 0.09, 0.15, 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
    ref = c0[0];
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (var j = 0; j < gy; j++) for (var i = 0; i < gx; i++) {
      var g = vert(i, j), k = j * gx + i;
      if (!g) continue;
      var d = g[0] - ref; d -= 360 * Math.round(d / 360);
      lon[k] = ref + d; lat[k] = Math.max(-LATMAX, Math.min(LATMAX, g[1])); ok[k] = 1;
      var X = (lon[k] + 180) / 360, Y = mercY(lat[k]);
      if (X < minX) minX = X; if (X > maxX) maxX = X; if (Y < minY) minY = Y; if (Y > maxY) maxY = Y;
    }
    if (minX > maxX) return;

    T1 = performance.now();
    // метров на экранный пиксель → уровень плиток
    var a = vert(ci, cj), b = vert(Math.min(ci + 1, nx), cj);
    var mpp = a && b ? haversine(a, b) / CELL / dpr : 0;
    var z = 3;
    if (mpp > 0) z = Math.round(Math.log(156543.03 * Math.cos(Math.max(-80, Math.min(80, a[1])) * D2R) / mpp) / Math.LN2 + 0.3);
    z = Math.max(1, Math.min(MAXZ, z));

    var MT = S.maxTiles, m = S.mo, cover = false, n, tx0, ty0, ntx, nty;
    for (; z >= 1; z--) {
      n = 1 << z;
      // нужные плитки, затем с запасом — чтобы при сдвиге мозаику не пересобирать
      var fits = false;
      for (var pad = 0.2; pad >= -0.01; pad -= 0.1) {
        var pw = (maxX - minX) * Math.max(pad, 0), ph = (maxY - minY) * Math.max(pad, 0);
        var ax = Math.floor((minX - pw) * n), bx = Math.floor((maxX + pw) * n);
        var ay = Math.max(0, Math.floor((minY - ph) * n)), by = Math.min(n - 1, Math.floor((maxY + ph) * n));
        if (bx - ax + 1 <= MT && by - ay + 1 <= MT) { tx0 = ax; ntx = bx - ax + 1; ty0 = ay; nty = by - ay + 1; fits = true; break; }
      }
      if (fits) break;
    }
    if (z < 1) return;
    n = 1 << z;
    // старая мозаика годится, если тот же уровень и она покрывает нужный участок
    if (m && m.z === z && !m.dirty &&
        Math.floor(minX * n) >= m.tx0 && Math.floor(maxX * n) <= m.tx0 + m.ntx - 1 &&
        Math.floor(minY * n) >= m.ty0 && Math.floor(maxY * n) <= m.ty0 + m.nty - 1) cover = true;
    if (!cover) { buildMosaic(z, tx0, ty0, ntx, nty); m = S.mo; S.rebuilds = (S.rebuilds || 0) + 1; }
    else if (m.dirty) { buildMosaic(m.z, m.tx0, m.ty0, m.ntx, m.nty); m = S.mo; }

    T2 = performance.now();
    // вершины: позиция на экране и координата в мозаике
    var pos = new Float32Array(N * 2), uv = new Float32Array(N * 2);
    var mw = m.ntx, mh = m.nty;
    for (var j2 = 0; j2 < gy; j2++) for (var i2 = 0; i2 < gx; i2++) {
      var k2 = j2 * gx + i2, px2 = Math.min(i2 * CELL, W), py2 = Math.min(j2 * CELL, H);
      pos[k2 * 2] = px2 / W * 2 - 1; pos[k2 * 2 + 1] = 1 - py2 / H * 2;
      if (ok[k2]) {
        uv[k2 * 2] = ((lon[k2] + 180) / 360 * n - m.tx0) / mw;
        uv[k2 * 2 + 1] = (mercY(lat[k2]) * n - m.ty0) / mh;
      }
    }
    var idx = new Uint16Array(nx * ny * 6), ni = 0;
    for (var cj2 = 0; cj2 < ny; cj2++) for (var ci2 = 0; ci2 < nx; ci2++) {
      var k00 = cj2 * gx + ci2, k10 = k00 + 1, k01 = k00 + gx, k11 = k01 + 1;
      if (!(ok[k00] && ok[k10] && ok[k01] && ok[k11])) continue;
      if (Math.abs(lon[k00] - lon[k11]) > 60 || Math.abs(lon[k10] - lon[k01]) > 60) continue;
      idx[ni++] = k00; idx[ni++] = k10; idx[ni++] = k01; idx[ni++] = k10; idx[ni++] = k11; idx[ni++] = k01;
    }

    gl.viewport(0, 0, cw, ch);
    gl.clearColor(0.04, 0.09, 0.15, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(S.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, S.bufPos); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(S.aPos); gl.vertexAttribPointer(S.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, S.bufUv); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(S.aUv); gl.vertexAttribPointer(S.aUv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, S.bufIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx.subarray(0, ni), gl.DYNAMIC_DRAW);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, S.tex);
    gl.uniform1i(gl.getUniformLocation(S.prog, 'u_tex'), 0);
    gl.drawElements(gl.TRIANGLES, ni, gl.UNSIGNED_SHORT, 0);
    S.last = { z: z, tiles: m.ntx * m.nty, mpp: mpp, rebuilds: S.rebuilds || 0, ms: { verts: T1 - T0, mosaic: T2 - T1, gl: performance.now() - T2 } };
  }

  // ---------- внешний интерфейс ----------
  function attr(show) {
    if (!S.attrEl) {
      S.attrEl = document.getElementById('satattr');
    }
    if (S.attrEl) { S.attrEl.textContent = S.failed ? 'Спутниковый слой недоступен: в браузере нет WebGL' : ATTR; S.attrEl.style.display = show ? 'block' : 'none'; }
  }

  root.SAT = {
    projections: PROJ,
    makeInv: makeInv,
    setMap: function (id) {
      S.id = id; S.def = PROJ[id] || null; S.inv = makeInv(S.def); S.mo = null; S.queue.length = 0;
      schedule();
    },
    setActive: function (on) {
      on = !!on;
      S.active = on;
      var cv = document.getElementById('sat');
      if (on) initGL();
      if (cv) cv.style.display = on && !S.failed ? 'block' : 'none';
      attr(on);
      if (on) schedule();
    },
    render: function (vb) { S.vb = { x: vb.x, y: vb.y, w: vb.w, h: vb.h }; schedule(); },
    /** Самая узкая допустимая ширина видимой области (в единицах SVG): около 600 м на экран. */
    minW: function (mapW) {
      if (!S.inv) return mapW / 40;
      var cx = mapW / 2, cy = (S.vb ? S.vb.y + S.vb.h / 2 : mapW / 2);
      var a = S.inv(S.vb ? S.vb.x + S.vb.w / 2 : cx, cy), b = S.inv((S.vb ? S.vb.x + S.vb.w / 2 : cx) + 1, cy);
      if (!a || !b) return mapW / 40;
      var mpu = haversine(a, b);
      return mpu > 0 ? Math.min(mapW / 40, 600 / mpu) : mapW / 40;
    },
    ok: function () { return !S.failed; },
    info: function () { return S.last || null; }
  };

  root.addEventListener('resize', function () { if (S.active) schedule(); });
})(typeof window !== 'undefined' ? window : globalThis);
