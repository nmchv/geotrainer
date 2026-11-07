/*!
 * GeoTrainer — личный кабинет, бейджи и таблица лидеров.
 *
 * Подключается в index.html ПОСЛЕ основного inline-скрипта (см. INSTRUCTIONS.md).
 * Файл ничего не требует, кроме того, что уже есть на странице: функции и переменные
 * основного скрипта (h, $, TT, USER, STORE, rpc, statsView, home, recordAttempt …)
 * доступны по имени, а нужные функции этот файл «оборачивает» поверх оригинальных.
 *
 * Что делает:
 *   1. statsView  → заменяет «Мою статистику» на личный кабинет (вкладки, графики, бейджи).
 *   2. home       → вставляет на главную блок «Таблица лидеров» (топ-3 крупно + топ-10).
 *   3. recordAttempt / syncUser → отправляют свои очки в рейтинг и показывают новые бейджи.
 *   4. rpc        → при удалении логина администратором убирает его и из рейтинга.
 */
(function () {
  'use strict';

  if (typeof h !== 'function' || typeof statsView !== 'function' || typeof home !== 'function' ||
      typeof recordAttempt !== 'function' || typeof syncUser !== 'function' || typeof rpc !== 'function') {
    console.warn('cabinet.js: не найден основной скрипт index.html — модуль не запущен');
    return;
  }

  // ---------------------------------------------------------------- перевод
  // tr('русский текст', 'English') — регистрирует перевод и возвращает строку на нужном языке
  const tr = (ru, en) => { if (en && !Object.prototype.hasOwnProperty.call(DICT, ru)) DICT[ru] = en; return TT(ru); };
  const isEn = () => LANG === 'en';

  // ---------------------------------------------------------------- стили
  const css = `
.gtc-svg{display:block;width:100%;height:auto;overflow:visible}
.gtc-svg text{fill:var(--color-text-secondary);font-size:10px;font-family:inherit}
.gtc-grid{stroke:var(--color-border);stroke-width:1}
.gtc-thr{stroke-width:1;stroke-dasharray:3 4;opacity:.7}
.gtc-line{fill:none;stroke:var(--color-accent);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.gtc-avg{fill:none;stroke:var(--color-text-secondary);stroke-width:1.5;stroke-dasharray:4 4;opacity:.85}
.gtc-pt{stroke:var(--color-surface);stroke-width:1.5}
.gtc-c5{fill:var(--color-ok);stroke:var(--color-ok)} .gtc-c4{fill:#8ccf5e;stroke:#8ccf5e}
.gtc-c3{fill:var(--color-warn);stroke:var(--color-warn)} .gtc-c2{fill:var(--color-bad);stroke:var(--color-bad)}
.gtc-pt.gtc-c5,.gtc-pt.gtc-c4,.gtc-pt.gtc-c3,.gtc-pt.gtc-c2{stroke:var(--color-surface)}
.gtc-thr.gtc-c5,.gtc-thr.gtc-c4,.gtc-thr.gtc-c3,.gtc-thr.gtc-c2{fill:none}
.gtc-svg text.gtc-c5,.gtc-svg text.gtc-c4,.gtc-svg text.gtc-c3,.gtc-svg text.gtc-c2{stroke:none;font-weight:700}
.gtc-cell{fill:var(--color-border);opacity:.55}
.gtc-cell.lv1{fill:var(--color-accent);opacity:.3} .gtc-cell.lv2{fill:var(--color-accent);opacity:.5}
.gtc-cell.lv3{fill:var(--color-accent);opacity:.75} .gtc-cell.lv4{fill:var(--color-accent);opacity:1}
.gtc-card{border:1px solid var(--color-border);border-radius:12px;background:var(--color-surface);padding:16px 18px;margin:12px 0}
.gtc-card h3{font-size:1rem;font-weight:600;margin:0 0 4px}
.gtc-card .sub{margin:0 0 12px;font-size:.875rem}
.gtc-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.gtc-grid2 .gtc-card{margin:0}
.gtc-heat{max-width:560px}
.gtc-bars{display:grid;gap:8px}
.gtc-bar{display:grid;grid-template-columns:minmax(64px,auto) 1fr auto;gap:10px;align-items:center;font-size:.9rem}
.gtc-track{height:10px;border-radius:99px;background:var(--color-surface-elevated);overflow:hidden}
.gtc-fill{display:block;height:100%;border-radius:99px;background:var(--color-accent);min-width:2px}
.gtc-fill.f5{background:var(--color-ok)} .gtc-fill.f4{background:#8ccf5e} .gtc-fill.f3{background:var(--color-warn)} .gtc-fill.f2{background:var(--color-bad)}
.gtc-val{font-variant-numeric:tabular-nums;color:var(--color-text-secondary);min-width:2.5em;text-align:right}
.gtc-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:26px 0 6px}
.gtc-rank{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin-top:18px;padding:14px 18px;border:1px solid var(--color-border);border-radius:12px;background:var(--color-surface)}
.gtc-rank b.n{font-size:1.7rem;letter-spacing:-.03em;color:var(--color-accent-hover);line-height:1}
.gtc-rank .grow{flex:1 1 220px;color:var(--color-text-secondary);font-size:.9rem}
.gtc-opt{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:.9rem;color:var(--color-text-secondary)}
.gtc-progress{height:8px;border-radius:99px;background:var(--color-surface-elevated);overflow:hidden;margin:6px 0 20px;max-width:420px}
.gtc-progress i{display:block;height:100%;background:var(--color-accent)}
.gtc-bgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin-top:14px}
.gtc-badge{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;align-items:center;border:1px solid var(--color-border);border-radius:12px;background:var(--color-surface);padding:14px 16px}
.gtc-badge.locked{opacity:.55}
.gtc-badge.locked .gtc-ico{filter:grayscale(1)}
.gtc-badge > div{min-width:0}
.gtc-badge b{display:block;font-size:.98rem;line-height:1.25;overflow-wrap:anywhere}
.gtc-badge small{display:block;color:var(--color-text-secondary);font-size:.8rem;line-height:1.35;margin-top:2px}
.gtc-badge .gtc-bp{grid-column:1 / -1;margin-top:6px}
.gtc-badge .gtc-bp .gtc-track{height:6px}
.gtc-badge .gtc-bp span{font-size:.75rem;color:var(--color-text-secondary)}
.gtc-ico{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;border:2px solid var(--gtc-tier);color:var(--gtc-tier);background:color-mix(in srgb,var(--gtc-tier) 14%,transparent);flex:none}
.gtc-ico svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.gtc-ico.sm{width:36px;height:36px;border-width:1.5px}.gtc-ico.sm svg{width:18px;height:18px}
.t-bronze{--gtc-tier:#c98a52}.t-silver{--gtc-tier:#8e9bb0}.t-gold{--gtc-tier:#e0a916}
.gtc-tier{display:block;margin-bottom:2px;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gtc-tier);font-weight:700}
.gtc-new{border:1px solid var(--color-accent);border-radius:12px;background:var(--color-surface);padding:16px 18px;margin:20px 0;display:grid;gap:10px}
.gtc-new h3{margin:0;font-size:1.05rem}
.gtc-new .gtc-it{display:flex;align-items:center;gap:12px}
.gtc-podium{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin-bottom:18px}
.gtc-pcard{position:relative;border:1px solid var(--color-border);border-top:3px solid var(--gtc-medal);border-radius:12px;background:var(--color-surface);padding:18px 20px 16px;display:grid;gap:6px;min-width:0}
.gtc-pcard.me{box-shadow:0 0 0 2px var(--color-accent)}
.gtc-pcard .gtc-hd{display:flex;align-items:center;gap:12px}
.gtc-medal{flex:none;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-weight:800;background:var(--gtc-medal);color:#1a1405}
.gtc-pcard .gtc-nm{font-size:clamp(1.15rem,1rem + .6vw,1.5rem);font-weight:700;letter-spacing:-.015em;overflow-wrap:anywhere;line-height:1.2}
.gtc-pcard .gtc-pt2{color:var(--color-accent-hover);font-weight:700;font-size:1.05rem;font-variant-numeric:tabular-nums}
.gtc-pcard .gtc-mt{color:var(--color-text-secondary);font-size:.85rem}
.gtc-m1{--gtc-medal:#e0a916}.gtc-m2{--gtc-medal:#a9b4c4}.gtc-m3{--gtc-medal:#c98a52}
.gtc-lbnote{color:var(--color-text-secondary);font-size:.875rem;margin:6px 0 0}
.gtc-lbtable tr.me td{background:var(--color-surface-elevated);font-weight:600}
.gtc-lbtable td.num,.gtc-lbtable th.num{text-align:right;font-variant-numeric:tabular-nums}
@media (max-width:520px){.gtc-bar{grid-template-columns:minmax(56px,auto) 1fr auto}.gtc-card{padding:14px}}
`;
  const style = document.createElement('style');
  style.id = 'gtc-css';
  style.textContent = css;
  document.head.appendChild(style);

  // ---------------------------------------------------------------- svg-помощник
  const SVGNS = 'http://www.w3.org/2000/svg';
  const S = (tag, attrs, ...kids) => {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in (attrs || {})) e.setAttribute(k, attrs[k]);
    kids.flat().forEach(c => e.append(c));
    return e;
  };

  // ---------------------------------------------------------------- иконки бейджей (viewBox 24)
  const IC = {
    flag:    '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    bolt:    '<path d="M13 2 5 14h6l-1 8 8-12h-6z"/>',
    flame:   '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.2 1 2 2 2 0-3-1-5 1-8z"/>',
    trophy:  '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a3 3 0 0 0 4 3M16 6h4v1a3 3 0 0 1-4 3M12 13v4M8 20h8M10 17h4"/>',
    star:    '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    target:  '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    globe:   '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
    layers:  '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    cal:     '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/><path d="m9 15 2 2 4-4"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5"/>',
    trend:   '<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>',
    pin:     '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    moon:    '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    sun:     '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>'
  };
  const icon = (name, cls) => {
    const w = h('span', { className: 'gtc-ico ' + (cls || '') });
    w.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (IC[name] || IC.star) + '</svg>'; // статичные константы, не пользовательский ввод
    return w;
  };

  // ---------------------------------------------------------------- бейджи
  // k — какой показатель из computeStats() считаем, g — нужное значение
  const BADGES = [
    { id: 'first', ic: 'flag',    tier: 'bronze', k: 'n',        g: 1,  n: ['Первые шаги', 'First steps'],            d: ['Пройти первый тест', 'Finish your first test'] },
    { id: 'n10',   ic: 'bolt',    tier: 'bronze', k: 'n',        g: 10, n: ['Разогрев', 'Warm-up'],                   d: ['Пройти 10 тестов', 'Finish 10 tests'] },
    { id: 'n50',   ic: 'flame',   tier: 'silver', k: 'n',        g: 50, n: ['Упорство', 'Perseverance'],              d: ['Пройти 50 тестов', 'Finish 50 tests'] },
    { id: 'n100',  ic: 'trophy',  tier: 'gold',   k: 'n',        g: 100, n: ['Марафонец', 'Marathoner'],              d: ['Пройти 100 тестов', 'Finish 100 tests'] },
    { id: 'f1',    ic: 'star',    tier: 'bronze', k: 'fives',    g: 1,  n: ['Отличник', 'Straight-A'],                d: ['Получить первую «5»', 'Get your first mark 5'] },
    { id: 'f10',   ic: 'star',    tier: 'silver', k: 'fives',    g: 10, n: ['Пятёрочник', 'Fives collector'],         d: ['Получить 10 оценок «5»', 'Get ten marks 5'] },
    { id: 'f30',   ic: 'star',    tier: 'gold',   k: 'fives',    g: 30, n: ['Круглый отличник', 'Top student'],       d: ['Получить 30 оценок «5»', 'Get thirty marks 5'] },
    { id: 'p1',    ic: 'target',  tier: 'silver', k: 'flawless', g: 1,  n: ['Без единой ошибки', 'Flawless'],         d: ['Пройти тест на 100%', 'Score 100% in a test'] },
    { id: 'p5',    ic: 'target',  tier: 'gold',   k: 'flawless', g: 5,  n: ['Снайпер', 'Sharpshooter'],               d: ['Пять тестов на 100%', 'Five tests at 100%'] },
    { id: 't10',   ic: 'compass', tier: 'bronze', k: 'tests',    g: 10, n: ['Путешественник', 'Traveller'],           d: ['Пройти 10 разных тестов', 'Try 10 different tests'] },
    { id: 't30',   ic: 'globe',   tier: 'gold',   k: 'tests',    g: 30, n: ['Знаток карты', 'Map expert'],            d: ['Пройти 30 разных тестов', 'Try 30 different tests'] },
    { id: 'g3',    ic: 'layers',  tier: 'silver', k: 'grades',   g: 3,  n: ['Без границ', 'No limits'],               d: ['Пройти тесты трёх разных классов', 'Take tests from three different grades'] },
    { id: 's3',    ic: 'cal',     tier: 'bronze', k: 'longest',  g: 3,  n: ['Три дня подряд', 'Three-day streak'],    d: ['Заниматься 3 дня подряд', 'Practise 3 days in a row'] },
    { id: 's7',    ic: 'cal',     tier: 'silver', k: 'longest',  g: 7,  n: ['Неделя без пропусков', 'A full week'],   d: ['Заниматься 7 дней подряд', 'Practise 7 days in a row'] },
    { id: 's30',   ic: 'cal',     tier: 'gold',   k: 'longest',  g: 30, n: ['Месяц с картой', 'A month with the map'], d: ['Заниматься 30 дней подряд', 'Practise 30 days in a row'] },
    { id: 'r5',    ic: 'refresh', tier: 'bronze', k: 'retries',  g: 5,  n: ['Работа над ошибками', 'Learning from mistakes'], d: ['Пять раз пройти «Повторить ошибки»', 'Use “Retry mistakes” five times'] },
    { id: 'imp',   ic: 'trend',   tier: 'silver', k: 'improved', g: 1,  n: ['Рост', 'Level up'],                      d: ['Подтянуть оценку в тесте с «3» и ниже до «5»', 'Raise a mark from 3 or lower to 5 in one test'] },
    { id: 'big',   ic: 'pin',     tier: 'silver', k: 'big',      g: 1,  n: ['Большая карта', 'Big map'],              d: ['Получить «4» или «5» в тесте от 30 объектов', 'Get a 4 or 5 in a test of 30+ objects'] },
    { id: 'night', ic: 'moon',    tier: 'bronze', k: 'night',    g: 1,  n: ['Ночной географ', 'Night owl'],           d: ['Пройти тест между 00:00 и 05:00', 'Finish a test between 00:00 and 05:00'] },
    { id: 'early', ic: 'sun',     tier: 'bronze', k: 'early',    g: 1,  n: ['Ранняя пташка', 'Early bird'],           d: ['Пройти тест между 05:00 и 08:00', 'Finish a test between 05:00 and 08:00'] }
  ];
  const TIER_NAME = { bronze: ['Бронза', 'Bronze'], silver: ['Серебро', 'Silver'], gold: ['Золото', 'Gold'] };
  const bName = b => tr(b.n[0], b.n[1]);
  const bDesc = b => tr(b.d[0], b.d[1]);

  // ---------------------------------------------------------------- статистика игрока
  const dayNum = ts => { const d = new Date(ts); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };

  function computeStats(all) {
    all = all || [];
    const R = all.filter(x => !x.retry);                 // «Повторить ошибки» в оценки не идёт
    const byTest = {};
    R.forEach(x => (byTest[x.id] = byTest[x.id] || []).push(x));
    const ids = Object.keys(byTest);

    let score = 0, improved = 0;
    ids.forEach(id => {
      const l = byTest[id].slice().sort((a, b) => a.ts - b.ts);
      score += Math.max(...l.map(pct));
      if (l[0].mark <= 3 && l.slice(1).some(x => x.mark === 5)) improved++;
    });

    const days = [...new Set(all.map(x => dayNum(x.ts)))].sort((a, b) => a - b);
    let longest = 0, run = 0, prev = null;
    days.forEach(d => { run = (prev !== null && d === prev + 1) ? run + 1 : 1; longest = Math.max(longest, run); prev = d; });
    const today = dayNum(Date.now());
    const current = days.length && (prev === today || prev === today - 1) ? run : 0;

    const hour = x => new Date(x.ts).getHours();
    return {
      n: R.length,
      avg: avgOf(R),
      fives: R.filter(x => x.mark === 5).length,
      flawless: R.filter(x => x.n >= 5 && x.good === x.n).length,
      tests: ids.length,
      grades: new Set(R.map(x => x.grade).filter(Boolean)).size,
      retries: all.filter(x => x.retry).length,
      improved,
      big: R.filter(x => x.n >= 30 && x.mark >= 4).length,
      night: all.filter(x => hour(x) < 5).length,
      early: all.filter(x => hour(x) >= 5 && hour(x) < 8).length,
      longest, current,
      score: Math.round(score),
      byTest
    };
  }
  const earnedIds = st => new Set(BADGES.filter(b => (st[b.k] || 0) >= b.g).map(b => b.id));

  // ---------------------------------------------------------------- рейтинг: данные
  const LB = { rows: null, at: 0, pending: null, TTL: 60000 };
  const rpc0 = window.rpc;

  function localRows() {                                  // без сервера — только логины этого браузера
    return Object.values(STORE.users).map(u => {
      const st = computeStats(u.attempts);
      return { key: (u.name || '').toLowerCase(), name: u.name, score: st.score, tests: st.tests, attempts: st.n,
               fives: st.fives, avg: st.avg || 0, badges: earnedIds(st).size };
    }).filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score || b.fives - a.fives || a.attempts - b.attempts)
      .map((r, i) => Object.assign(r, { rank: i + 1 }));
  }

  function loadLB(force) {
    if (!REMOTE) return Promise.resolve(localRows());
    if (!force && LB.rows && Date.now() - LB.at < LB.TTL) return Promise.resolve(LB.rows);
    if (LB.pending) return LB.pending;
    LB.pending = rpc0('gt_leaderboard', { p_limit: 50 })
      .then(r => { LB.rows = Array.isArray(r) ? r : []; LB.at = Date.now(); return LB.rows; })
      .finally(() => { LB.pending = null; });
    return LB.pending;
  }

  // ---------------------------------------------------------------- рейтинг: отправка своих очков
  let lbTimer = 0, lbSent = '';
  function scheduleSubmit(delay) {
    if (!REMOTE || !USER) return;
    clearTimeout(lbTimer);
    lbTimer = setTimeout(submitLB, delay || 1500);
  }
  async function submitLB() {
    if (!REMOTE || !USER || !navigator.onLine) return;
    const st = computeStats(USER.attempts);
    if (!st.n) return;
    const stats = { score: st.score, tests: st.tests, attempts: st.n, fives: st.fives, avg: st.avg || 0, badges: earnedIds(st).size };
    const sig = USER.key + '|' + JSON.stringify(stats);
    if (sig === lbSent) return;
    try {
      await rpc0('gt_lb_submit', { p_key: USER.key, p_name: USER.name, p_stats: stats });
      lbSent = sig; LB.at = 0;
      if (CURV === 'home' && $('sec-leaders')) loadLB(true).then(r => refreshLeaders(r)).catch(() => {});
    } catch (e) {
      console.warn('Рейтинг: не удалось отправить результат —', e.message);   // функции ещё не созданы в Supabase или нет сети
    }
  }

  // ---------------------------------------------------------------- рейтинг: блок на главной
  function pl(n, a, b, c) { const m = n % 100, k = n % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; }
  const ptsWord = n => isEn() ? 'pts' : pl(n, 'очко', 'очка', 'очков');

  function podiumCard(r, i) {
    const me = USER && r.key === USER.key;
    return h('div', { className: 'gtc-pcard gtc-m' + (i + 1) + (me ? ' me' : '') },
      h('div', { className: 'gtc-hd' }, h('span', { className: 'gtc-medal', 'aria-label': tr('Место', 'Place') + ' ' + (i + 1) }, '' + (i + 1)),
        h('span', { className: 'gtc-nm' }, r.name)),
      h('div', { className: 'gtc-pt2' }, r.score + ' ' + ptsWord(r.score)),
      h('div', { className: 'gtc-mt' },
        r.tests + ' ' + tr('тестов', 'tests') + ' · ' + tr('средний', 'avg') + ' ' + r.avg + '% · «5»: ' + r.fives +
        (r.badges ? ' · ' + tr('бейджей', 'badges') + ': ' + r.badges : '')));
  }

  function lbTable(rows) {
    const t = h('table', { className: 'gtc-lbtable' },
      h('thead', {}, h('tr', {},
        h('th', {}, '#'), h('th', {}, tr('Игрок', 'Player')),
        h('th', { className: 'num' }, tr('Очки', 'Points')), h('th', { className: 'num' }, tr('Тестов', 'Tests')),
        h('th', { className: 'num' }, tr('Средний %', 'Avg %')), h('th', { className: 'num' }, tr('Бейджей', 'Badges')))),
      h('tbody'));
    rows.forEach((r, i) => t.tBodies[0].append(h('tr', { className: USER && r.key === USER.key ? 'me' : '' },
      h('td', {}, '' + (i + 1)), h('td', {}, r.name),
      h('td', { className: 'num' }, '' + r.score), h('td', { className: 'num' }, '' + r.tests),
      h('td', { className: 'num' }, r.avg + '%'), h('td', { className: 'num' }, '' + r.badges))));
    return h('div', { className: 'tscroll' }, t);
  }

  function fillLeaders(body, rows) {
    body.innerHTML = '';
    if (!rows.length) {
      body.append(h('p', { className: 'empty' }, tr('Пока в рейтинге никого нет. Войдите и пройдите тест — станьте первым!', 'Nobody is on the board yet. Sign in and finish a test to be the first!')));
      return;
    }
    body.append(h('div', { className: 'gtc-podium' }, rows.slice(0, 3).map(podiumCard)));
    if (rows.length > 3) {
      const open = h('details', { className: 'test-disclosure' });
      open.append(
        h('summary', {},
          h('span', { className: 'disclosure-copy' },
            h('strong', {}, tr('Топ-10', 'Top 10')),
            h('small', {}, tr('Полная таблица лидеров', 'Full leaderboard'))),
          h('span', { className: 'disclosure-count' }, Math.min(10, rows.length) + ' ' + tr('игроков', 'players'))),
        lbTable(rows.slice(0, 10)));
      body.append(open);
    }
    if (!REMOTE) body.append(h('p', { className: 'gtc-lbnote' }, tr('Сервер не подключён: в таблице только логины, которые заходили в этом браузере.', 'No server connected: only logins used in this browser are listed.')));
  }

  function leadersSection() {
    return h('section', { className: 'section', id: 'sec-leaders' },
      h('div', { className: 'container' },
        h('div', { className: 'section-head' },
          h('span', { className: 'section-index' }, '★'),
          h('h2', {}, tr('Таблица лидеров', 'Leaderboard')),
          h('p', {}, tr('Очки — это сумма лучших результатов (%) по каждому пройденному тесту. Проходите больше разных тестов и отвечайте точнее — поднимайтесь выше.',
                         'Points are the sum of your best results (%) across every test you have taken. Try more tests and answer more accurately to climb higher.'))),
        h('div', { className: 'gtc-body' }, h('p', { className: 'sub' }, tr('Загрузка рейтинга…', 'Loading leaderboard…')))));
  }

  function refreshLeaders(rows) {
    const s = $('sec-leaders');
    if (!s) return;
    const before = s.offsetHeight, above = s.getBoundingClientRect().bottom < 0;
    fillLeaders(s.querySelector('.gtc-body'), rows);
    if (above) window.scrollBy({ top: s.offsetHeight - before, behavior: 'instant' });
  }

  function decorateHome(off) {
    const root = $('home'), hero = root && root.querySelector('.hero');
    if (!hero) return;

    // «Моя статистика» → «Личный кабинет»
    const mine = TT('Моя статистика');
    root.querySelectorAll('button.chip').forEach(b => { if (b.textContent === mine) b.textContent = tr('Личный кабинет', 'My account'); });

    const sec = leadersSection();
    hero.after(sec);
    if (off !== null) { const f = $('gradefilters'); if (f) window.scrollBy({ top: f.getBoundingClientRect().top - off, behavior: 'instant' }); }

    const fresh = !REMOTE || (LB.rows && Date.now() - LB.at < LB.TTL);
    if (LB.rows && REMOTE) fillLeaders(sec.querySelector('.gtc-body'), LB.rows);
    if (!fresh || !REMOTE) {
      loadLB().then(rows => refreshLeaders(rows)).catch(e => {
        console.warn('Рейтинг недоступен:', e.message);
        const s = $('sec-leaders'); if (s && !(LB.rows && LB.rows.length)) s.remove();   // функции в Supabase ещё не созданы — блок просто не показываем
      });
    }
  }

  // ---------------------------------------------------------------- личный кабинет: графики
  const fmtDay = ts => new Date(ts).toLocaleDateString(isEn() ? 'en-GB' : 'ru-RU', { day: '2-digit', month: '2-digit' });

  function trendChart(R) {
    const D = R.slice().sort((a, b) => a.ts - b.ts).slice(-40);
    if (D.length < 2) return h('p', { className: 'sub' }, tr('Нужно хотя бы две попытки, чтобы построить график.', 'At least two attempts are needed to draw the chart.'));
    const W = 640, H = 230, ml = 34, mr = 24, mt = 12, mb = 26, iw = W - ml - mr, ih = H - mt - mb;
    const x = i => ml + iw * i / (D.length - 1), y = v => mt + ih * (1 - v / 100);
    const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'gtc-svg', role: 'img', 'aria-label': tr('Динамика результатов', 'Results over time') });
    [0, 25, 50, 75, 100].forEach(v => svg.append(
      S('line', { x1: ml, x2: W - mr, y1: y(v), y2: y(v), class: 'gtc-grid' }),
      S('text', { x: ml - 6, y: y(v) + 3, 'text-anchor': 'end' }, v + '')));
    const pc = SET.scale || { 5: 90, 4: 70, 3: 50 };
    [5, 4, 3].forEach(m => { if (pc[m] > 0 && pc[m] <= 100) svg.append(
      S('line', { x1: ml, x2: W - mr, y1: y(pc[m]), y2: y(pc[m]), class: 'gtc-thr gtc-c' + m }),
      S('text', { x: W - mr + 5, y: y(pc[m]) + 3, class: 'gtc-c' + m }, '' + m)); });
    svg.append(S('path', { class: 'gtc-line', d: D.map((a, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(pct(a)).toFixed(1)).join('') }));
    const ma = D.map((_, i) => { const s = D.slice(Math.max(0, i - 4), i + 1); return s.reduce((t, a) => t + pct(a), 0) / s.length; });
    svg.append(S('path', { class: 'gtc-avg', d: ma.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('') }));
    D.forEach((a, i) => svg.append(S('circle', { cx: x(i), cy: y(pct(a)), r: 4.5, class: 'gtc-pt gtc-c' + a.mark },
      S('title', {}, fdate(a.ts) + ' · ' + a.title + ' · ' + a.good + '/' + a.n + ' (' + pct(a) + '%) · ' + tr('оценка', 'mark') + ' ' + a.mark))));
    svg.append(S('text', { x: ml, y: H - 6 }, fmtDay(D[0].ts)), S('text', { x: W - mr, y: H - 6, 'text-anchor': 'end' }, fmtDay(D[D.length - 1].ts)));
    return svg;
  }

  function heatmap(all) {
    const cols = 17, cs = 13, g = 3, ml = 26, mt = 16;
    const counts = {};
    all.forEach(a => { const d = dayNum(a.ts); counts[d] = (counts[d] || 0) + 1; });
    const today = dayNum(Date.now()), row0 = (new Date().getDay() + 6) % 7, start = today - ((cols - 1) * 7 + row0);
    const W = ml + cols * (cs + g), H = mt + 7 * (cs + g);
    const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'gtc-svg', role: 'img', 'aria-label': tr('Активность по дням', 'Daily activity') });
    const loc = isEn() ? 'en-GB' : 'ru-RU';
    const wd = isEn() ? ['Mon', 'Wed', 'Fri'] : ['Пн', 'Ср', 'Пт'];
    [0, 2, 4].forEach((r, i) => svg.append(S('text', { x: 0, y: mt + r * (cs + g) + cs - 2 }, wd[i])));
    let lastMonth = -1;
    for (let c = 0; c < cols; c++) {
      const first = new Date((start + c * 7) * 864e5);
      if (first.getUTCMonth() !== lastMonth) {
        lastMonth = first.getUTCMonth();
        svg.append(S('text', { x: ml + c * (cs + g), y: 9 }, first.toLocaleDateString(loc, { month: 'short', timeZone: 'UTC' })));
      }
      for (let r = 0; r < 7; r++) {
        const dn = start + c * 7 + r;
        if (dn > today) continue;
        const n = counts[dn] || 0, lv = n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4;
        svg.append(S('rect', { x: ml + c * (cs + g), y: mt + r * (cs + g), width: cs, height: cs, rx: 3, class: 'gtc-cell' + (lv ? ' lv' + lv : '') },
          S('title', {}, new Date(dn * 864e5).toLocaleDateString(loc, { day: 'numeric', month: 'long', timeZone: 'UTC' }) + ': ' + n)));
      }
    }
    return h('div', { className: 'gtc-heat' }, svg);
  }

  function bars(items) {                                   // items: [{label, value, max, text, cls}]
    return h('div', { className: 'gtc-bars' }, items.map(it => h('div', { className: 'gtc-bar' },
      h('span', {}, it.label),
      h('span', { className: 'gtc-track' }, h('i', { className: 'gtc-fill ' + (it.cls || ''), style: 'width:' + (it.max ? Math.round(100 * it.value / it.max) : 0) + '%' })),
      h('span', { className: 'gtc-val' }, it.text))));
  }

  const card = (title, sub, body) => h('div', { className: 'gtc-card' }, h('h3', {}, title), sub ? h('p', { className: 'sub' }, sub) : '', body);

  // ---------------------------------------------------------------- личный кабинет: вкладки
  const CAB = { tab: 'overview', hist: 30 };

  function overviewTab(box, A, R, st) {
    box.append(card(tr('Динамика результатов', 'Results over time'),
      tr('Каждая точка — одна попытка, цвет — оценка. Пунктир — среднее за 5 попыток. Последние 40 попыток.', 'Each dot is one attempt, colour is the mark. Dashed line is the 5-attempt average. Last 40 attempts.'),
      trendChart(R)));

    box.append(card(tr('Активность', 'Activity'), tr('Попытки по дням за последние 17 недель.', 'Attempts per day over the last 17 weeks.'), heatmap(A)));

    const marks = [5, 4, 3, 2].map(m => ({ label: tr('Оценка', 'Mark') + ' ' + m, value: R.filter(x => x.mark === m).length, cls: 'f' + m }));
    const mx = Math.max(1, ...marks.map(m => m.value));
    marks.forEach(m => { m.max = mx; m.text = '' + m.value; });
    const byGrade = {};
    R.forEach(x => { if (x.grade) (byGrade[x.grade] = byGrade[x.grade] || []).push(x); });
    const gr = Object.entries(byGrade).map(([g, l]) => ({ label: TT(g), value: avgOf(l), max: 100, text: avgOf(l) + '%' }));
    box.append(h('div', { className: 'gtc-grid2' },
      card(tr('Оценки', 'Marks'), null, bars(marks)),
      gr.length ? card(tr('Средний результат по классам', 'Average by grade'), null, bars(gr)) : ''));

    if (R.length) box.append(h('h2', {}, tr('По тестам', 'By test')), perTestTable(R));
    const hl = hardList(R);
    if (hl) box.append(h('h2', {}, tr('Чаще всего ошибки', 'Most frequent mistakes')), h('p', { className: 'sub' }, tr('Повторите эти объекты в первую очередь.', 'Review these objects first.')), hl);
  }

  function badgeCard(b, st) {
    const cur = st[b.k] || 0, ok = cur >= b.g;
    const el = h('div', { className: 'gtc-badge t-' + b.tier + (ok ? '' : ' locked'), title: bDesc(b) },
      icon(b.ic),
      h('div', {}, h('span', { className: 'gtc-tier' }, tr(TIER_NAME[b.tier][0], TIER_NAME[b.tier][1])), h('b', {}, bName(b)), h('small', {}, bDesc(b))));
    if (!ok) el.append(h('div', { className: 'gtc-bp' },
      h('span', { className: 'gtc-track' }, h('i', { className: 'gtc-fill', style: 'width:' + Math.round(100 * cur / b.g) + '%' })),
      h('span', {}, cur + ' / ' + b.g)));
    return el;
  }

  function badgesTab(box, st) {
    const got = earnedIds(st);
    box.append(h('h2', {}, tr('Бейджи', 'Badges')),
      h('p', { className: 'sub', style: 'margin-bottom:6px' }, tr('Получено', 'Earned') + ': ' + got.size + ' ' + tr('из', 'of') + ' ' + BADGES.length),
      h('div', { className: 'gtc-progress' }, h('i', { style: 'width:' + Math.round(100 * got.size / BADGES.length) + '%' })));
    const sorted = [...BADGES.filter(b => got.has(b.id)), ...BADGES.filter(b => !got.has(b.id))];
    box.append(h('div', { className: 'gtc-bgrid' }, sorted.map(b => badgeCard(b, st))));
  }

  function historyTab(box, A) {
    box.append(h('h2', {}, tr('История попыток', 'Attempt history')));
    if (!A.length) { box.append(h('p', { className: 'sub' }, tr('Попыток пока нет.', 'No attempts yet.'))); return; }
    box.append(histTable(A, CAB.hist));
    if (A.length > CAB.hist) box.append(h('div', { className: 'row' }, h('button', { className: 'btn ghost sm', on: { click: () => { CAB.hist += 50; renderTab(); } } }, tr('Показать ещё', 'Show more'))));
  }

  let tabBox = null, tabCtx = null;
  function renderTab() {
    if (!tabBox || !tabCtx) return;
    tabBox.innerHTML = '';
    const { A, R, st } = tabCtx;
    if (CAB.tab === 'badges') badgesTab(tabBox, st);
    else if (CAB.tab === 'history') historyTab(tabBox, A);
    else overviewTab(tabBox, A, R, st);
    tabBox.parentNode.querySelectorAll('.gtc-tabs .chip').forEach(c => { const on = c.dataset.tab === CAB.tab; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  }

  // карточка «моё место»
  function rankCard(st) {
    const box = h('div', { className: 'gtc-rank' }, h('span', { className: 'grow' }, tr('Загружаем ваше место в рейтинге…', 'Loading your leaderboard position…')));
    const draw = (rank, total, hidden) => {
      box.innerHTML = '';
      if (!st.n) { box.append(h('span', { className: 'grow' }, tr('Пройдите первый тест, чтобы попасть в таблицу лидеров.', 'Finish your first test to enter the leaderboard.'))); return; }
      box.append(rank ? h('b', { className: 'n' }, '#' + rank) : h('b', { className: 'n' }, st.score),
        h('span', { className: 'grow' },
          rank ? tr('Ваше место в таблице лидеров', 'Your leaderboard position') + (total ? ' · ' + tr('игроков', 'players') + ': ' + total : '') + ' · ' + st.score + ' ' + ptsWord(st.score)
               : hidden ? tr('Вы скрыты из таблицы лидеров.', 'You are hidden from the leaderboard.') + ' ' + st.score + ' ' + ptsWord(st.score)
                        : st.score + ' ' + ptsWord(st.score) + ' · ' + tr('результат скоро появится в таблице', 'your result will appear on the board shortly')),
        h('button', { className: 'btn ghost sm', on: { click: () => nav('sec-leaders') } }, tr('Таблица лидеров', 'Leaderboard')));
      if (REMOTE) {
        const cb = h('input', { type: 'checkbox', checked: !hidden });
        cb.addEventListener('change', async () => {
          cb.disabled = true;
          try { await rpc0('gt_lb_set_hidden', { p_key: USER.key, p_name: USER.name, p_hidden: !cb.checked }); LB.at = 0; loadMe(); }
          catch (e) { alert(tr('Не удалось сохранить: ', 'Could not save: ') + e.message); cb.checked = !cb.checked; cb.disabled = false; }
        });
        box.append(h('label', { className: 'gtc-opt', style: 'flex-basis:100%' }, cb, tr('Показывать меня в таблице лидеров', 'Show me on the leaderboard')));
      }
    };
    const loadMe = () => {
      if (!REMOTE) { const r = localRows(), i = r.findIndex(x => x.key === USER.key); draw(i >= 0 ? i + 1 : 0, r.length, false); return; }
      rpc0('gt_lb_me', { p_key: USER.key }).then(m => draw(m && m.rank ? +m.rank : 0, m ? +m.total : 0, !!(m && m.hidden)))
        .catch(() => { box.remove(); });                   // рейтинг не настроен — карточку не показываем
    };
    loadMe();
    return box;
  }

  window.statsView = function (nosync) {
    show('stats');
    const p = $('stats'); p.innerHTML = '';
    if (!USER) { loginBox(() => statsView()); return; }
    const A = USER.attempts, R = real(USER), st = computeStats(A);
    tabCtx = { A, R, st };

    p.append(h('span', { className: 'eyebrow' }, tr('Личный кабинет', 'My account')), h('h1', {}, USER.name));
    if (REMOTE) p.append(h('p', { className: 'sub', style: 'margin:6px 0 0' },
      SYNC === 'err' ? TT('Нет связи с сервером — показаны данные с этого устройства, они отправятся позже.')
        : SYNC === 'ok' ? TT('Данные синхронизированы с сервером.') : TT('Синхронизация…')));

    p.append(rankCard(st));

    const kpi = (v, l) => h('div', { className: 'kpi' }, h('b', {}, '' + v), h('span', {}, l));
    p.append(h('div', { className: 'kpis' },
      kpi(st.n, TT('попыток')),
      kpi(st.avg !== null ? st.avg + '%' : '—', TT('средний результат')),
      kpi(st.fives, TT('оценок «5»')),
      kpi(st.score, tr('очков', 'points')),
      kpi(earnedIds(st).size + '/' + BADGES.length, tr('бейджей', 'badges')),
      kpi(st.current, tr('дней подряд', 'day streak'))));

    if (!A.length) {
      p.append(h('p', { className: 'sub', style: 'margin-top:24px' }, TT('Попыток пока нет. Пройдите любой тест — результат появится здесь.')));
    } else {
      const tabs = h('div', { className: 'gtc-tabs', role: 'group' });
      [['overview', tr('Обзор', 'Overview')], ['badges', tr('Бейджи', 'Badges')], ['history', tr('История', 'History')]].forEach(([id, name]) =>
        tabs.append(h('button', { className: 'chip' + (CAB.tab === id ? ' on' : ''), 'data-tab': id, 'aria-pressed': CAB.tab === id ? 'true' : 'false',
          on: { click: () => { CAB.tab = id; renderTab(); } } }, name)));
      tabBox = h('div', {});
      p.append(tabs, tabBox);
      renderTab();
    }

    // ----- данные (экспорт / импорт) — как было в исходной странице
    const file = h('input', { type: 'file', accept: 'application/json,.json', style: 'display:none', on: { change: e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { try {
        const j = JSON.parse(rd.result); if (!j || !Array.isArray(j.attempts)) throw 0;
        const seen = new Set(USER.attempts.map(x => x.ts + x.id));
        j.attempts.forEach(x => { if (!seen.has(x.ts + x.id)) { if (REMOTE) x.pend = true; USER.attempts.push(x); } });
        USER.attempts.sort((a, b) => a.ts - b.ts); saveStore(); if (REMOTE) pushPending().then(() => scheduleSubmit()); statsView(true);
      } catch (_) { alert(TT('Не удалось прочитать файл')); } };
      rd.readAsText(f); } } });
    p.append(h('h2', {}, TT('Данные')),
      h('p', { className: 'sub' }, REMOTE ? TT('Можно сохранить копию статистики в файл или загрузить файл обратно.')
        : TT('Статистика хранится только в этом браузере. Чтобы перенести на другое устройство — сохраните файл и загрузите его там под тем же логином.')),
      h('div', { className: 'row' },
        h('button', { className: 'btn ghost sm', on: { click: () => {
          const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify({ name: USER.name, attempts: USER.attempts.map(clean) }, null, 1)], { type: 'application/json' })),
            download: 'geotrainer-' + USER.name.replace(/[^\wа-яё-]+/gi, '_') + '.json' }); a.click(); } } }, TT('Сохранить в файл')),
        h('button', { className: 'btn ghost sm', on: { click: () => file.click() } }, TT('Загрузить из файла')), file),
      h('div', { className: 'row' },
        h('button', { className: 'btn', on: { click: () => { location.hash = ''; home(); } } }, TT('← К тестам')),
        h('button', { className: 'btn ghost', on: { click: () => { logout(); location.hash = ''; home(); } } }, TT('Выйти'))));

    if (REMOTE && !nosync) syncUser().then(() => { if (CURV === 'stats') statsView(true); });
  };

  // ---------------------------------------------------------------- новые бейджи после теста
  function showNewBadges(list) {
    const r = $('result');
    if (CURV !== 'result' || !r) return;
    const box = h('div', { className: 'gtc-new', role: 'status' },
      h('h3', {}, list.length > 1 ? tr('Новые бейджи!', 'New badges!') : tr('Новый бейдж!', 'New badge!')),
      list.map(b => h('div', { className: 't-' + b.tier + ' gtc-it' }, icon(b.ic, 'sm'), h('div', {}, h('b', {}, bName(b)), h('small', { style: 'display:block;color:var(--color-text-secondary)' }, bDesc(b))))),
      h('div', {}, h('button', { className: 'btn ghost sm', on: { click: () => { CAB.tab = 'badges'; location.hash = '#stats'; } } }, tr('Все бейджи', 'All badges'))));
    r.append(box);
  }

  // ---------------------------------------------------------------- подключение к основному скрипту
  const rec0 = window.recordAttempt;
  window.recordAttempt = function () {
    let before = null;
    try { if (USER) before = earnedIds(computeStats(USER.attempts)); } catch (e) { /* не мешаем сохранению */ }
    const res = rec0.apply(this, arguments);
    try {
      if (USER && before) {
        const after = earnedIds(computeStats(USER.attempts));
        const fresh = BADGES.filter(b => after.has(b.id) && !before.has(b.id));
        if (fresh.length) setTimeout(() => showNewBadges(fresh), 0);   // finish() к этому моменту уже дорисует страницу
      }
      scheduleSubmit(2500);
    } catch (e) { console.warn(e); }
    return res;
  };

  const sync0 = window.syncUser;
  window.syncUser = async function () {
    const res = await sync0.apply(this, arguments);
    scheduleSubmit();
    return res;
  };

  const home0 = window.home;
  window.home = function (keep) {
    const fe = $('gradefilters');
    const off = (keep && CURV === 'home' && fe) ? fe.getBoundingClientRect().top : null;
    home0.apply(this, arguments);
    try { decorateHome(off); } catch (e) { console.error('cabinet.js:', e); }
  };

  window.rpc = async function (fn, args) {
    const res = await rpc0(fn, args);
    if (fn === 'gt_admin_delete' && args) {                 // администратор удалил логин — убираем и из рейтинга
      rpc0('gt_lb_remove', { p_pass: args.p_pass, p_key: args.p_key }).then(() => { LB.at = 0; }).catch(() => {});
    }
    return res;
  };

  // если страница уже успела нарисовать главную или кабинет до загрузки этого файла — перерисуем
  if (typeof CURV === 'string') {
    if (CURV === 'home') window.home(true);
    else if (CURV === 'stats') window.statsView(true);
  }
})();
