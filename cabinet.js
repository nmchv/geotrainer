/*!
 * GeoTrainer — личный кабинет, бейджи, таблица лидеров, панель администратора.
 *
 * Подключается в index.html ПОСЛЕ основного inline-скрипта (см. INSTRUCTIONS.md).
 * Файл ничего не требует, кроме того, что уже есть на странице: функции и переменные
 * основного скрипта (h, $, TT, USER, STORE, rpc, statsView, home, recordAttempt …)
 * доступны по имени, а нужные функции этот файл «оборачивает» поверх оригинальных.
 *
 * Что делает:
 *   1. statsView   → личный кабинет ученика (вкладки, графики, бейджи, смена логина).
 *   2. home        → на главной блок «Таблица лидеров» (только первые три места).
 *   3. recordAttempt / syncUser → отправляют очки в рейтинг и показывают новые бейджи.
 *   4. adminStats  → в админке: кабинеты учеников, видимость в рейтинге, смена логина, конструктор бейджей.
 *   5. rpc         → при удалении логина администратором убирает его и из рейтинга.
 *   6. Пароли: если подключён auth.js (он должен идти ПЕРЕД этим файлом), очки и смена логина отправляются
 *      с токеном входа, в кабинете есть карточка «Пароль», а в админке — сброс пароля.
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
.gtc-rename{margin-top:10px;max-width:560px}
.gtc-rename .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.gtc-rename .grow{flex:1 1 200px}
.gtc-badge .gtc-manual{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.gtc-badge .gtc-manual span{font-size:.75rem;color:var(--color-text-secondary)}
.gtc-admin{margin-top:44px;padding-top:8px;border-top:1px solid var(--color-border)}
.gtc-admin .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}
.gtc-admin .row .grow{flex:1 1 220px}
.gtc-form{display:grid;gap:14px;max-width:680px}
.gtc-form label{display:grid;gap:5px;font-size:.9rem;color:var(--color-text-secondary)}
.gtc-form .two{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.gtc-lbl{display:block;font-size:.9rem;color:var(--color-text-secondary);margin-bottom:6px}
.gtc-pick{display:flex;flex-wrap:wrap;gap:6px}
.gtc-pick button{padding:3px;border:2px solid transparent;border-radius:50%;background:none;cursor:pointer;line-height:0;color:inherit}
.gtc-pick button.on{border-color:var(--color-accent)}
.gtc-prev{max-width:300px}
.gtc-blist{display:grid;gap:8px;margin-top:12px}
.gtc-bitem{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border:1px solid var(--color-border);border-radius:12px;padding:10px 14px;background:var(--color-surface)}
.gtc-bitem .grow{flex:1 1 180px;min-width:0}
.gtc-bitem small{display:block;color:var(--color-text-secondary);font-size:.8rem}
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

  // бейджи, созданные администратором, подгружаются с сервера (см. loadCustom)
  let CUSTOM = [];
  const allBadges = () => BADGES.concat(CUSTOM);
  const bName = b => b.custom ? b.n[0] : tr(b.n[0], b.n[1]);
  const bDesc = b => b.custom ? b.d[0] : tr(b.d[0], b.d[1]);
  // что можно считать в условии бейджа (ключи — поля computeStats)
  const METRICS = [
    ['n',        'Пройдено тестов (попыток)',                     'Tests finished (attempts)'],
    ['tests',    'Разных пройденных тестов',                      'Different tests taken'],
    ['fives',    'Оценок «5»',                                    'Marks 5'],
    ['flawless', 'Тестов на 100% (от 5 вопросов)',                'Tests at 100% (5+ questions)'],
    ['grades',   'Разных классов в пройденных тестах',            'Different grades taken'],
    ['longest',  'Дней подряд (лучшая серия)',                    'Days in a row (best streak)'],
    ['retries',  'Раз «Повторить ошибки»',                        '“Retry mistakes” runs'],
    ['improved', 'Тестов, где оценка выросла с «3» до «5»',       'Tests improved from 3 or lower to 5'],
    ['big',      'Больших тестов (30+ объектов) на «4» или «5»',  'Big tests (30+ objects) with 4 or 5'],
    ['night',    'Прохождений ночью (00:00–05:00)',               'Attempts at night (00:00–05:00)'],
    ['early',    'Прохождений утром (05:00–08:00)',               'Attempts in the morning (05:00–08:00)'],
    ['score',    'Очков в рейтинге',                              'Leaderboard points']
  ];
  const metricName = k => { const m = METRICS.find(x => x[0] === k); return m ? tr(m[1], m[2]) : k; };
  const toBadge = row => {
    const d = row.def || {};
    return { id: row.id, custom: true, ic: d.icon || 'star', tier: d.tier || 'bronze', manual: d.kind === 'manual',
             k: d.metric, g: +d.goal || 1, n: [d.name || '', d.name || ''], d: [d.desc || '', d.desc || ''] };
  };

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
  // какие бейджи получены: по условию — считаем из статистики, «вручную» — смотрим выдачи администратора (aw — Set id)
  const earnedSet = (st, aw) => new Set(allBadges().filter(b => b.manual ? !!(aw && aw.has(b.id)) : (st[b.k] || 0) >= b.g).map(b => b.id));
  // сколько бейджей получено автоматически (выданные вручную сервер добавляет сам)
  const autoCount = st => allBadges().filter(b => !b.manual && (st[b.k] || 0) >= b.g).length;

    // ---------------------------------------------------------------- данные с сервера
  const rpc0 = window.rpc;
  const GA = window.GTAuth || null;                                   // auth.js (необязателен)
  const tokenOf = key => (GA && GA.token(key)) || null;
  const adminPass = () => { try { return sessionStorage.getItem('gt_ap') || ''; } catch (e) { return ''; } };

  // понятный текст вместо технических ошибок сервера
  const errText = e => {
    const m = (e && e.message) || String(e || '');
    if (/taken/.test(m)) return tr('Такой логин уже занят.', 'This login is already taken.');
    if (/bad name/.test(m)) return tr('Введите логин (до 30 символов).', 'Enter a login (up to 30 characters).');
    if (/not found/.test(m)) return tr('Логин не найден на сервере. Обновите страницу и повторите.', 'Login not found on the server. Reload the page and try again.');
    if (/schema/.test(m)) return tr('Сервер не смог переименовать логин: проверьте SQL (см. инструкцию).', 'The server could not rename the login: check the SQL (see the instructions).');
    if (/unauthorized/.test(m)) return tr('Нужно войти заново: введите пароль в личном кабинете.', 'Please sign in again: enter your password in your account.');
    if (/weak password/.test(m)) return tr('Пароль — от 4 символов.', 'The password must be at least 4 characters.');
    if (/forbidden/.test(m)) return tr('Неверный пароль администратора.', 'Wrong admin password.');
    if (/Could not find the function|PGRST202|does not exist/.test(m)) return tr('На сервере не выполнен обновлённый SQL (supabase-leaderboard.sql).', 'The updated SQL has not been run on the server (supabase-leaderboard.sql).');
    return m;
  };

  // бейджи, созданные администратором
  let customAt = 0;
  async function loadCustom(force) {
    if (!REMOTE) return false;
    if (!force && Date.now() - customAt < 300000) return false;
    const list = await rpc0('gt_badges_list');
    customAt = Date.now();
    const next = (Array.isArray(list) ? list : []).map(toBadge);
    const changed = JSON.stringify(next) !== JSON.stringify(CUSTOM);
    CUSTOM = next;
    return changed;
  }

  // бейджи, выданные вручную: логин → Set(id бейджей)
  const AW = {};
  async function loadAwards(key) {
    if (!REMOTE || !key) return false;
    const list = await rpc0('gt_my_awards', { p_key: key });
    const next = new Set(Array.isArray(list) ? list : []);
    const prev = AW[key] || new Set();
    AW[key] = next;
    return next.size !== prev.size || [...next].some(x => !prev.has(x));
  }

  // ---------------------------------------------------------------- рейтинг: данные
  const LB = { rows: null, at: 0, pending: null, TTL: 60000 };

  function localRows() {                                  // без сервера — только логины этого браузера
    return Object.values(STORE.users).map(u => {
      const st = computeStats(u.attempts);
      return { key: (u.name || '').toLowerCase(), name: u.name, score: st.score, badges: earnedSet(st, null).size, fives: st.fives, attempts: st.n };
    }).filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score || b.fives - a.fives || a.attempts - b.attempts)
      .slice(0, 3)
      .map((r, i) => Object.assign(r, { rank: i + 1 }));
  }

  function loadLB(force) {
    if (!REMOTE) return Promise.resolve(localRows());
    if (!force && LB.rows && Date.now() - LB.at < LB.TTL) return Promise.resolve(LB.rows);
    if (LB.pending) return LB.pending;
    LB.pending = rpc0('gt_leaderboard', { p_limit: 3 })
      .then(r => { LB.rows = Array.isArray(r) ? r.slice(0, 3) : []; LB.at = Date.now(); return LB.rows; })
      .finally(() => { LB.pending = null; });
    return LB.pending;
  }

  // ---------------------------------------------------------------- рейтинг: отправка своих очков
  let lbTimer = 0, lbSent = '';
  const statsPayload = st => ({ score: st.score, tests: st.tests, attempts: st.n, fives: st.fives, avg: st.avg || 0, badges: autoCount(st) });

  function scheduleSubmit(delay) {
    if (!REMOTE || !USER) return;
    clearTimeout(lbTimer);
    lbTimer = setTimeout(submitLB, delay || 1500);
  }
  async function submitLB() {
    if (!REMOTE || !USER || !navigator.onLine) return;
    try { await loadCustom(); } catch (e) { /* бейджи администратора не загрузились — считаем только встроенные */ }
    const st = computeStats(USER.attempts);
    if (!st.n) return;
    const stats = statsPayload(st);
    const sig = USER.key + '|' + JSON.stringify(stats);
    if (sig === lbSent) return;
    try {
      await rpc0('gt_lb_submit', { p_key: USER.key, p_name: USER.name, p_stats: stats, p_token: tokenOf(USER.key) });
      lbSent = sig; LB.at = 0;
      if (CURV === 'home' && $('sec-leaders')) loadLB(true).then(r => refreshLeaders(r)).catch(() => {});
    } catch (e) {
      if (/unauthorized/.test(e.message || '') && GA) { GA.dropToken(USER.key); GA.changed(USER.key); }   // пароль сбросили или вход устарел — в кабинете появится запрос пароля
      console.warn('Рейтинг: не удалось отправить результат —', e.message);   // функции ещё не созданы в Supabase или нет сети
    }
  }

  // ---------------------------------------------------------------- рейтинг: блок на главной (только топ-3)
  function pl(n, a, b, c) { const m = n % 100, k = n % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; }
  const ptsWord = n => isEn() ? 'pts' : pl(n, 'очко', 'очка', 'очков');

  function podiumCard(r, i) {
    const me = USER && r.key === USER.key;
    return h('div', { className: 'gtc-pcard gtc-m' + (i + 1) + (me ? ' me' : '') },
      h('div', { className: 'gtc-hd' }, h('span', { className: 'gtc-medal', 'aria-label': tr('Место', 'Place') + ' ' + (i + 1) }, '' + (i + 1)),
        h('span', { className: 'gtc-nm' }, r.name)),
      h('div', { className: 'gtc-pt2' }, r.score + ' ' + ptsWord(r.score)),
      h('div', { className: 'gtc-mt' }, tr('Бейджей', 'Badges') + ': ' + (r.badges || 0)));
  }

  function fillLeaders(body, rows) {
    body.innerHTML = '';
    if (!rows.length) {
      body.append(h('p', { className: 'empty' }, tr('Пока в рейтинге никого нет. Войдите и пройдите тест — станьте первым!', 'Nobody is on the board yet. Sign in and finish a test to be the first!')));
      return;
    }
    body.append(h('div', { className: 'gtc-podium' }, rows.slice(0, 3).map(podiumCard)));
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

    // ---------------------------------------------------------------- смена логина
  const normName = s => (s || '').trim().replace(/\s+/g, ' ').slice(0, 30);   // как в loginAs()

  async function renameSelf(raw) {
    const name = normName(raw);
    if (!name) throw new Error('bad name');
    if (name === USER.name) return;
    const old = USER.key, key = name.toLowerCase();
    if (REMOTE) {
      if (!navigator.onLine) throw new Error(tr('Нет связи с сервером.', 'No connection to the server.'));
      if (!(await pushPending())) throw new Error(tr('Не удалось отправить попытки на сервер — повторите позже.', 'Could not upload your attempts — try again later.'));
      await rpc0('gt_login', { p_key: old, p_name: USER.name });          // убедимся, что логин есть на сервере
      await rpc0('gt_rename', { p_key: old, p_name: name, p_token: tokenOf(old) });
    } else if (key !== old && STORE.users[key]) {
      throw new Error('taken');
    }
    const u = STORE.users[old];
    delete STORE.users[old];
    if (key !== old) delete STORE.users[key];                              // устаревшая локальная копия того же логина
    u.name = name; u.key = key; STORE.users[key] = u; USER = u;
    try { localStorage.setItem(CKEY, key); } catch (e) { /* без localStorage вход просто не запомнится */ }
    saveStore();
    if (AW[old]) { AW[key] = AW[old]; delete AW[old]; }
    if (GA && key !== old) GA.rekey(old, key, name);
    lbSent = ''; LB.at = 0; scheduleSubmit(800);
  }

  async function renameAdmin(key, raw) {
    const name = normName(raw);
    if (!name) throw new Error('bad name');
    const nk = await rpc0('gt_admin_rename', { p_pass: adminPass(), p_key: key, p_name: name });
    const newKey = typeof nk === 'string' && nk ? nk : name.toLowerCase();
    if (AW[key] && newKey !== key) { AW[newKey] = AW[key]; delete AW[key]; }
    LB.at = 0;
    return { key: newKey, name };
  }

  // админ: задан ли пароль у ученика и кнопка сброса
  function adminAccountCard(ctx) {
    if (!ctx.pwOk) return null;
    const wrap = h('div', { className: 'gtc-card' });
    const msg = h('p', { className: 'sub', role: 'status' });
    const paint = () => {
      wrap.innerHTML = '';
      wrap.append(h('h3', {}, tr('Пароль', 'Password')));
      if (!ctx.hasPass) { wrap.append(h('p', { className: 'sub' }, tr('Пароль не задан: либо старый логин, либо пароль сброшен. Ученик задаст его при следующем входе.', 'No password: either an older login or the password was reset. The student will set one at next sign-in.')), msg); return; }
      const btn = h('button', { className: 'btn ghost sm' }, tr('Сбросить пароль', 'Reset password'));
      btn.addEventListener('click', async () => {
        if (!confirm(tr('Сбросить пароль для «', 'Reset the password for “') + ctx.name + tr('»? Все его устройства выйдут, а при следующем входе он придумает новый пароль.', '”? All its devices will be signed out and the student will choose a new password at next sign-in.'))) return;
        btn.disabled = true;
        try { await rpc0('gt_admin_reset_pass', { p_pass: adminPass(), p_key: ctx.key }); ctx.hasPass = false; if (ADM.data) ADM.data.pw.delete(ctx.key); paint(); msg.textContent = tr('Пароль сброшен.', 'Password reset.'); }
        catch (e) { msg.textContent = errText(e); btn.disabled = false; }
      });
      wrap.append(h('p', { className: 'sub' }, tr('✓ Пароль задан. Если ученик его забыл — сбросьте: он придумает новый при следующем входе.', '✓ A password is set. If the student forgot it, reset it: they will choose a new one at next sign-in.')),
        h('div', { className: 'row' }, btn), msg);
    };
    paint();
    return wrap;
  }

  function renameBlock(ctx) {
    const wrap = h('div', { className: 'gtc-rename' });
    const show = () => {
      wrap.innerHTML = '';
      wrap.append(h('button', { className: 'btn ghost sm', on: { click: edit } }, tr('Сменить логин', 'Change login')));
    };
    const edit = () => {
      wrap.innerHTML = '';
      const inp = h('input', { type: 'text', value: ctx.name, maxlength: 30, autocomplete: 'off', 'aria-label': tr('Новый логин', 'New login') });
      const msg = h('p', { className: 'badc', role: 'alert' });
      const save = h('button', { className: 'btn sm' }, tr('Сохранить', 'Save'));
      const go = async () => {
        save.disabled = true; msg.textContent = '';
        try {
          if (ctx.admin) { const r = await renameAdmin(ctx.key, inp.value); ctx.key = r.key; ctx.name = r.name; buildCabinet(ctx.p, ctx); }
          else { await renameSelf(inp.value); statsView(true); }
        } catch (e) { msg.textContent = errText(e); save.disabled = false; }
      };
      save.addEventListener('click', go);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); else if (e.key === 'Escape') show(); });
      wrap.append(
        h('div', { className: 'row' }, h('div', { className: 'grow' }, inp), save, h('button', { className: 'btn ghost sm', on: { click: show } }, tr('Отмена', 'Cancel'))),
        msg,
        h('p', { className: 'sub', style: 'margin:0' }, tr('Все попытки и бейджи сохранятся под новым логином. До 30 символов.', 'All attempts and badges are kept under the new login. Up to 30 characters.')));
      inp.focus(); inp.select();
    };
    show();
    return wrap;
  }

  // ---------------------------------------------------------------- личный кабинет: вкладки
  const CAB = { tab: 'overview', hist: 30, token: 0 };
  let tabBox = null, tabCtx = null;

  function overviewTab(box, A, R) {
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

  function badgeCard(b, st, ctx, got) {
    const cur = st[b.k] || 0;
    const el = h('div', { className: 'gtc-badge t-' + b.tier + (got ? '' : ' locked'), title: bDesc(b) },
      icon(b.ic),
      h('div', {}, h('span', { className: 'gtc-tier' }, tr(TIER_NAME[b.tier][0], TIER_NAME[b.tier][1])), h('b', {}, bName(b)), h('small', {}, bDesc(b))));
    if (b.manual) {
      const foot = h('div', { className: 'gtc-bp gtc-manual' }, h('span', {}, got ? tr('Выдан администратором', 'Awarded by the admin') : tr('Выдаётся администратором', 'Awarded by the admin')));
      if (ctx.admin && b.id !== 'prev') {
        const btn = h('button', { className: 'btn ghost sm' }, got ? tr('Забрать', 'Revoke') : tr('Выдать', 'Award'));
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            await rpc0('gt_admin_badge_award', { p_pass: adminPass(), p_badge: b.id, p_key: ctx.key, p_on: !got });
            const s = AW[ctx.key] || (AW[ctx.key] = new Set());
            if (got) s.delete(b.id); else s.add(b.id);
            LB.at = 0;
            buildCabinet(ctx.p, ctx);
          } catch (e) { alert(errText(e)); btn.disabled = false; }
        });
        foot.append(btn);
      }
      el.append(foot);
    } else if (!got) {
      el.append(h('div', { className: 'gtc-bp' },
        h('span', { className: 'gtc-track' }, h('i', { className: 'gtc-fill', style: 'width:' + Math.min(100, Math.round(100 * cur / b.g)) + '%' })),
        h('span', {}, cur + ' / ' + b.g)));
    }
    return el;
  }

  function badgesTab(box, st, ctx) {
    const all = allBadges(), got = earnedSet(st, ctx.awards);
    box.append(h('h2', {}, tr('Бейджи', 'Badges')),
      h('p', { className: 'sub', style: 'margin-bottom:6px' }, tr('Получено', 'Earned') + ': ' + got.size + ' ' + tr('из', 'of') + ' ' + all.length),
      h('div', { className: 'gtc-progress' }, h('i', { style: 'width:' + Math.round(100 * got.size / Math.max(1, all.length)) + '%' })));
    const sorted = [...all.filter(b => got.has(b.id)), ...all.filter(b => !got.has(b.id))];
    box.append(h('div', { className: 'gtc-bgrid' }, sorted.map(b => badgeCard(b, st, ctx, got.has(b.id)))));
  }

  function historyTab(box, A) {
    box.append(h('h2', {}, tr('История попыток', 'Attempt history')));
    if (!A.length) { box.append(h('p', { className: 'sub' }, tr('Попыток пока нет.', 'No attempts yet.'))); return; }
    box.append(histTable(A, CAB.hist));
    if (A.length > CAB.hist) box.append(h('div', { className: 'row' }, h('button', { className: 'btn ghost sm', on: { click: () => { CAB.hist += 50; renderTab(); } } }, tr('Показать ещё', 'Show more'))));
  }

  function renderTab() {
    if (!tabBox || !tabCtx) return;
    tabBox.innerHTML = '';
    const { A, R, st, ctx } = tabCtx;
    if (CAB.tab === 'badges') badgesTab(tabBox, st, ctx);
    else if (CAB.tab === 'history') historyTab(tabBox, A);
    else overviewTab(tabBox, A, R);
    tabBox.parentNode.querySelectorAll('.gtc-tabs .chip').forEach(c => { const on = c.dataset.tab === CAB.tab; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  }

  // карточка «место в рейтинге»; у администратора — ещё и переключатель «показывать в таблице лидеров»
  function rankCard(ctx, st) {
    const box = h('div', { className: 'gtc-rank' }, h('span', { className: 'grow' }, tr('Загружаем место в рейтинге…', 'Loading leaderboard position…')));
    const draw = m => {
      box.innerHTML = '';
      const rank = m && m.rank ? +m.rank : 0, hidden = !!(m && m.hidden);
      if (!st.n) {
        box.append(h('span', { className: 'grow' }, ctx.admin ? tr('У ученика пока нет попыток.', 'This student has no attempts yet.')
                                                              : tr('Пройдите первый тест, чтобы попасть в таблицу лидеров.', 'Finish your first test to enter the leaderboard.')));
      } else {
        box.append(rank ? h('b', { className: 'n' }, '#' + rank) : h('b', { className: 'n' }, '' + st.score),
          h('span', { className: 'grow' },
            rank ? tr('Место в таблице лидеров', 'Leaderboard position') + (m.total ? ' · ' + tr('игроков', 'players') + ': ' + m.total : '') + ' · ' + st.score + ' ' + ptsWord(st.score)
                 : hidden ? (ctx.admin ? tr('Скрыт из таблицы лидеров.', 'Hidden from the leaderboard.') : tr('Администратор скрыл вас из таблицы лидеров.', 'The admin has hidden you from the leaderboard.')) + ' ' + st.score + ' ' + ptsWord(st.score)
                          : st.score + ' ' + ptsWord(st.score) + ' · ' + tr('результат скоро появится в таблице', 'your result will appear on the board shortly')));
        if (!ctx.admin) box.append(h('button', { className: 'btn ghost sm', on: { click: () => nav('sec-leaders') } }, tr('Таблица лидеров', 'Leaderboard')));
      }
      if (ctx.admin && REMOTE) {
        const cb = h('input', { type: 'checkbox', checked: !hidden });
        cb.addEventListener('change', async () => {
          cb.disabled = true;
          try { await rpc0('gt_admin_set_hidden', { p_pass: adminPass(), p_key: ctx.key, p_name: ctx.name, p_hidden: !cb.checked }); LB.at = 0; load(); }
          catch (e) { alert(errText(e)); cb.checked = !cb.checked; cb.disabled = false; }
        });
        box.append(h('label', { className: 'gtc-opt', style: 'flex-basis:100%' }, cb, tr('Показывать в таблице лидеров', 'Show on the leaderboard')));
      }
    };
    const load = () => {
      if (!REMOTE) { const r = localRows(), i = r.findIndex(x => x.key === ctx.key); draw(i >= 0 ? { rank: i + 1 } : null); return; }
      rpc0('gt_lb_me', { p_key: ctx.key }).then(draw).catch(() => { box.remove(); });   // рейтинг не настроен — карточку не показываем
    };
    load();
    return box;
  }

  // экспорт / импорт данных — как было в исходной странице
  function dataSection() {
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
    return h('div', {},
      h('h2', {}, TT('Данные')),
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
  }

  // ---------------------------------------------------------------- личный кабинет: сборка страницы
  // ctx: { admin, key, name, attempts, onBack }. Один и тот же кабинет показывается ученику (#stats) и администратору.
  function buildCabinet(p, ctx) {
    const token = ++CAB.token;
    ctx.p = p;
    ctx.awards = AW[ctx.key] || new Set();
    p.innerHTML = '';
    const A = ctx.attempts, R = A.filter(x => !x.retry), st = computeStats(A);
    tabCtx = { A, R, st, ctx };

    if (ctx.admin) p.append(h('div', { className: 'row' }, h('button', { className: 'btn ghost sm', on: { click: () => ctx.onBack && ctx.onBack() } }, tr('← К списку учеников', '← Back to students'))));
    p.append(h('span', { className: 'eyebrow' }, ctx.admin ? tr('Кабинет ученика · вид администратора', 'Student account · admin view') : tr('Личный кабинет', 'My account')),
             h('h1', {}, ctx.name));
    if (!ctx.admin && REMOTE) p.append(h('p', { className: 'sub', style: 'margin:6px 0 0' },
      SYNC === 'err' ? TT('Нет связи с сервером — показаны данные с этого устройства, они отправятся позже.')
        : SYNC === 'ok' ? TT('Данные синхронизированы с сервером.') : TT('Синхронизация…')));
    p.append(renameBlock(ctx));
    const acc = ctx.admin ? adminAccountCard(ctx) : (GA ? GA.accountBlock() : null);
    if (acc) p.append(acc);
    p.append(rankCard(ctx, st));

    const kpi = (v, l) => h('div', { className: 'kpi' }, h('b', {}, '' + v), h('span', {}, l));
    p.append(h('div', { className: 'kpis' },
      kpi(st.n, TT('попыток')),
      kpi(st.avg !== null ? st.avg + '%' : '—', TT('средний результат')),
      kpi(st.fives, TT('оценок «5»')),
      kpi(st.score, tr('очков', 'points')),
      kpi(earnedSet(st, ctx.awards).size + '/' + allBadges().length, tr('бейджей', 'badges')),
      kpi(st.current, tr('дней подряд', 'day streak'))));

    if (!A.length) {
      p.append(h('p', { className: 'sub', style: 'margin-top:24px' }, ctx.admin ? tr('Попыток пока нет.', 'No attempts yet.') : TT('Попыток пока нет. Пройдите любой тест — результат появится здесь.')));
      tabBox = null;
    } else {
      const tabs = h('div', { className: 'gtc-tabs', role: 'group' });
      [['overview', tr('Обзор', 'Overview')], ['badges', tr('Бейджи', 'Badges')], ['history', tr('История', 'History')]].forEach(([id, name]) =>
        tabs.append(h('button', { className: 'chip' + (CAB.tab === id ? ' on' : ''), 'data-tab': id, 'aria-pressed': CAB.tab === id ? 'true' : 'false',
          on: { click: () => { CAB.tab = id; renderTab(); } } }, name)));
      tabBox = h('div', {});
      p.append(tabs, tabBox);
      renderTab();
    }

    if (!ctx.admin) p.append(dataSection());

    // бейджи администратора и выданные вручную подгружаем в фоне; страница перерисуется, только если что-то изменилось
    if (REMOTE) {
      Promise.all([loadCustom().catch(() => false), loadAwards(ctx.key).catch(() => false)]).then(r => {
        if ((r[0] || r[1]) && CAB.token === token && p.isConnected) buildCabinet(p, ctx);
      });
    }
  }

  window.statsView = function (nosync) {
    show('stats');
    const p = $('stats'); p.innerHTML = '';
    if (!USER) { loginBox(() => statsView()); return; }
    buildCabinet(p, { admin: false, key: USER.key, name: USER.name, get attempts() { return USER.attempts; } });
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
    try { if (USER) before = earnedSet(computeStats(USER.attempts), null); } catch (e) { /* не мешаем сохранению */ }
    const res = rec0.apply(this, arguments);
    try {
      if (USER && before) {
        const after = earnedSet(computeStats(USER.attempts), null);
        const fresh = allBadges().filter(b => after.has(b.id) && !before.has(b.id));
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

    // админка: кабинеты учеников, видимость в рейтинге, смена логина, конструктор бейджей
  if (typeof adminStats === 'function') {
    const admin0 = window.adminStats;
    window.adminStats = function (p) {
      admin0.apply(this, arguments);
      try { adminPanel(p); } catch (e) { console.error('cabinet.js:', e); }
    };
  }

  // вход изменился (задан пароль, пароль сброшен, вход устарел): отправим очки и перерисуем кабинет
  window.addEventListener('gt-auth', () => {
    lbSent = ''; scheduleSubmit(500);
    if (CURV === 'stats' && USER) window.statsView(true);
  });

  if (REMOTE) loadCustom().catch(() => {});                 // бейджи администратора нужны для подсчёта и уведомлений

  // ---------------------------------------------------------------- админка
  // Блок добавляется под исходной «Статистикой учеников» и включает:
  //   • список учеников: открыть личный кабинет, сменить логин, показывать / скрывать в таблице лидеров;
  //   • «Заполнить рейтинг» — внести в рейтинг всех, кто занимался раньше;
  //   • конструктор бейджей.
  const ADM = { data: null };

  async function loadAdminData() {
    const pass = adminPass();
    const [all, lbRows, awards, accs] = await Promise.all([
      rpc0('gt_admin_all', { p_pass: pass }),
      rpc0('gt_admin_lb', { p_pass: pass }).catch(() => null),        // null — обновлённый SQL ещё не выполнен
      rpc0('gt_admin_awards', { p_pass: pass }).catch(() => []),
      rpc0('gt_admin_accounts', { p_pass: pass }).catch(() => null)     // null — обновлённый SQL ещё не выполнен
    ]);
    await loadCustom(true).catch(() => {});
    const by = {};
    all.attempts.forEach(a => (by[a.key] = by[a.key] || []).push(a));
    Object.values(by).forEach(l => l.sort((a, b) => a.ts - b.ts));
    const hidden = {};
    (lbRows || []).forEach(r => { hidden[r.key] = !!r.hidden; });
    const aw = {};
    (awards || []).forEach(x => { (aw[x.key] = aw[x.key] || new Set()).add(x.badge_id); });
    Object.keys(aw).forEach(k => { AW[k] = aw[k]; });
    ADM.data = { users: all.users, by, hidden, aw, lbOk: lbRows !== null, pw: new Set(accs || []), pwOk: accs !== null };
    return ADM.data;
  }

  function openStudent(u) {
    const p = $('admin');
    const D = ADM.data;
    AW[u.key] = D.aw[u.key] || new Set();
    buildCabinet(p, { admin: true, key: u.key, name: u.name, attempts: D.by[u.key] || [], hasPass: D.pw.has(u.key), pwOk: D.pwOk, onBack: () => { ADM.data = null; admin(); } });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ----- конструктор бейджей
  const ICON_NAMES = Object.keys(IC);

  function builderPanel() {
    const wrap = h('div', {});
    const f = { id: null, name: '', desc: '', icon: 'star', tier: 'bronze', kind: 'metric', metric: 'tests', goal: 5 };

    const msg = h('p', { className: 'sub', role: 'status' });
    const inName = h('input', { type: 'text', maxlength: 60, placeholder: tr('Например: Знаток Европы', 'For example: Europe expert') });
    const inDesc = h('input', { type: 'text', maxlength: 200, placeholder: tr('За что выдаётся этот бейдж', 'What this badge is awarded for') });
    const selTier = h('select', {}, ['bronze', 'silver', 'gold'].map(t => h('option', { value: t }, tr(TIER_NAME[t][0], TIER_NAME[t][1]))));
    const selKind = h('select', {},
      h('option', { value: 'metric' }, tr('Автоматически — по условию', 'Automatic — by a condition')),
      h('option', { value: 'manual' }, tr('Вручную — выдаёт администратор', 'Manual — awarded by the admin')));
    const selMetric = h('select', {}, METRICS.map(m => h('option', { value: m[0] }, tr(m[1], m[2]))));
    const inGoal = h('input', { type: 'number', min: 1, max: 100000, step: 1, value: 5 });
    const rowMetric = h('div', { className: 'two' },
      h('label', {}, tr('Что считаем', 'What to count'), selMetric),
      h('label', {}, tr('Нужно набрать', 'Required value'), inGoal));
    const prev = h('div', { className: 'gtc-prev' });
    const picks = h('div', { className: 'gtc-pick', role: 'radiogroup', 'aria-label': tr('Иконка', 'Icon') });
    const btnSave = h('button', { className: 'btn' }, tr('Создать бейдж', 'Create badge'));
    const btnCancel = h('button', { className: 'btn ghost', style: 'display:none' }, tr('Отменить правку', 'Cancel editing'));
    const list = h('div', { className: 'gtc-blist' });

    const draw = () => {
      rowMetric.style.display = f.kind === 'metric' ? '' : 'none';
      prev.innerHTML = '';
      prev.append(badgeCard({ id: 'prev', custom: true, ic: f.icon, tier: f.tier, manual: f.kind === 'manual', k: f.metric, g: +f.goal || 1,
        n: [f.name || tr('Название бейджа', 'Badge name')], d: [f.desc || tr('Описание бейджа', 'Badge description')] }, {}, { admin: false }, true));
      picks.querySelectorAll('button').forEach(b => { const on = b.dataset.icon === f.icon; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
      btnSave.textContent = f.id ? tr('Сохранить изменения', 'Save changes') : tr('Создать бейдж', 'Create badge');
      btnCancel.style.display = f.id ? '' : 'none';
    };
    ICON_NAMES.forEach(n => {
      const b = h('button', { type: 'button', 'data-icon': n, role: 'radio', title: n }, icon(n, 'sm'));
      b.addEventListener('click', () => { f.icon = n; draw(); });
      picks.append(b);
    });
    inName.addEventListener('input', () => { f.name = inName.value; draw(); });
    inDesc.addEventListener('input', () => { f.desc = inDesc.value; draw(); });
    selTier.addEventListener('change', () => { f.tier = selTier.value; draw(); });
    selKind.addEventListener('change', () => { f.kind = selKind.value; draw(); });
    selMetric.addEventListener('change', () => { f.metric = selMetric.value; draw(); });
    inGoal.addEventListener('input', () => { f.goal = inGoal.value; draw(); });

    const reset = () => {
      Object.assign(f, { id: null, name: '', desc: '', icon: 'star', tier: 'bronze', kind: 'metric', metric: 'tests', goal: 5 });
      inName.value = ''; inDesc.value = ''; selTier.value = 'bronze'; selKind.value = 'metric'; selMetric.value = 'tests'; inGoal.value = 5;
      draw();
    };
    btnCancel.addEventListener('click', () => { reset(); msg.textContent = ''; });

    const drawList = () => {
      list.innerHTML = '';
      if (!CUSTOM.length) { list.append(h('p', { className: 'sub' }, tr('Своих бейджей пока нет. Создайте первый выше.', 'No custom badges yet. Create the first one above.'))); return; }
      CUSTOM.forEach(b => {
        const cond = b.manual ? tr('выдаётся вручную', 'awarded manually') : metricName(b.k) + ' ≥ ' + b.g;
        list.append(h('div', { className: 'gtc-bitem t-' + b.tier },
          icon(b.ic, 'sm'),
          h('div', { className: 'grow' }, h('b', {}, b.n[0]), h('small', {}, (b.d[0] ? b.d[0] + ' · ' : '') + cond)),
          h('button', { className: 'btn ghost sm', on: { click: () => {
            Object.assign(f, { id: b.id, name: b.n[0], desc: b.d[0], icon: b.ic, tier: b.tier, kind: b.manual ? 'manual' : 'metric', metric: b.k || 'tests', goal: b.g });
            inName.value = f.name; inDesc.value = f.desc; selTier.value = f.tier; selKind.value = f.kind; selMetric.value = f.metric; inGoal.value = f.goal;
            draw(); msg.textContent = ''; wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } } }, tr('Изменить', 'Edit')),
          h('button', { className: 'btn ghost sm', on: { click: async () => {
            if (!confirm(tr('Удалить бейдж «', 'Delete the badge “') + b.n[0] + tr('»? Он пропадёт у всех учеников.', '”? It will disappear for every student.'))) return;
            try { await rpc0('gt_admin_badge_delete', { p_pass: adminPass(), p_id: b.id }); await loadCustom(true); LB.at = 0; drawList(); msg.textContent = tr('Бейдж удалён.', 'Badge deleted.'); }
            catch (e) { msg.textContent = errText(e); }
          } } }, tr('Удалить', 'Delete'))));
      });
    };

    btnSave.addEventListener('click', async () => {
      const name = f.name.trim();
      if (!name) { msg.textContent = tr('Введите название бейджа.', 'Enter a badge name.'); inName.focus(); return; }
      const goal = Math.max(1, Math.round(+f.goal || 1));
      const id = f.id || ('c' + Date.now().toString(36));
      btnSave.disabled = true;
      try {
        await rpc0('gt_admin_badge_save', { p_pass: adminPass(), p_id: id, p_def: { name, desc: f.desc.trim(), icon: f.icon, tier: f.tier, kind: f.kind, metric: f.kind === 'metric' ? f.metric : null, goal } });
        await loadCustom(true); LB.at = 0;
        const edited = !!f.id;
        reset(); drawList();
        msg.textContent = (edited ? tr('Изменения сохранены.', 'Changes saved.') : tr('Бейдж создан.', 'Badge created.')) + ' ' +
          tr('Ученики увидят его в кабинете. Чтобы число бейджей в таблице лидеров обновилось сразу, нажмите «Заполнить рейтинг».',
             'Students will see it in their account. To refresh badge counts on the leaderboard right away, press “Fill the leaderboard”.');
      } catch (e) { msg.textContent = errText(e); }
      finally { btnSave.disabled = false; }
    });

    wrap.append(
      h('h2', {}, tr('Конструктор бейджей', 'Badge builder')),
      h('p', { className: 'sub' }, tr('Придумайте свой бейдж: название, описание, иконку и условие. Условие проверяется автоматически, либо бейдж можно выдавать вручную — в кабинете ученика.',
                                      'Create your own badge: name, description, icon and condition. The condition is checked automatically, or you can award the badge by hand from the student’s account.')),
      h('div', { className: 'gtc-card gtc-form' },
        h('label', {}, tr('Название', 'Name'), inName),
        h('label', {}, tr('Описание', 'Description'), inDesc),
        h('div', {}, h('span', { className: 'gtc-lbl' }, tr('Иконка', 'Icon')), picks),
        h('div', { className: 'two' }, h('label', {}, tr('Уровень', 'Tier'), selTier), h('label', {}, tr('Как выдаётся', 'How it is awarded'), selKind)),
        rowMetric,
        h('div', {}, h('span', { className: 'gtc-lbl' }, tr('Так бейдж выглядит у ученика', 'How the student sees it')), prev),
        h('div', { className: 'row' }, btnSave, btnCancel), msg),
      h('h3', { style: 'margin:22px 0 0;font-size:1rem' }, tr('Созданные бейджи', 'Your badges')), list);
    draw(); drawList();
    wrap.refreshList = drawList;
    return wrap;
  }

  // ----- ученики и рейтинг
  function adminPanel(p) {
    const wrap = h('div', { className: 'gtc-admin' });
    p.append(wrap);
    if (!REMOTE) {
      wrap.append(h('h2', {}, tr('Рейтинг и бейджи', 'Leaderboard and badges')),
        h('p', { className: 'sub' }, tr('Для этих функций нужен сервер (Supabase): сейчас config.js пуст.', 'These features need a server (Supabase): config.js is empty right now.')));
      return;
    }
    const status = h('p', { className: 'sub', role: 'status' });
    const body = h('div', {});
    const q = h('input', { type: 'search', placeholder: tr('Поиск по логину', 'Search by login') });
    const builder = builderPanel();

    const renderTable = () => {
      body.innerHTML = '';
      const D = ADM.data;
      if (!D) return;
      if (!D.lbOk) body.append(h('p', { className: 'badc' }, tr('На сервере не выполнен обновлённый SQL (supabase-leaderboard.sql) — переключатели рейтинга и бейджи работать не будут.', 'The updated SQL (supabase-leaderboard.sql) has not been run — leaderboard switches and badges will not work.')));
      let L = D.users.map(u => { const st = computeStats(D.by[u.key] || []); return { u, st, got: earnedSet(st, D.aw[u.key]).size }; });
      const v = q.value.trim().toLowerCase();
      if (v) L = L.filter(x => x.u.name.toLowerCase().includes(v));
      L.sort((a, b) => b.st.score - a.st.score || a.u.name.localeCompare(b.u.name, isEn() ? 'en' : 'ru'));
      if (!L.length) { body.append(h('p', { className: 'stat' }, tr('Ничего не найдено.', 'Nothing found.'))); return; }

      const t = h('table', {}, h('thead', {}, h('tr', {},
        h('th', {}, tr('Логин', 'Login')), h('th', {}, tr('Очки', 'Points')), h('th', {}, tr('Бейджей', 'Badges')),
        h('th', {}, tr('В таблице лидеров', 'On the leaderboard')), h('th', {}, tr('Пароль', 'Password')), h('th', {}, ''))), h('tbody'));
      L.forEach(({ u, st, got }) => {
        const shown = !D.hidden[u.key];
        const cb = h('input', { type: 'checkbox', checked: shown, disabled: !D.lbOk, 'aria-label': tr('Показывать в таблице лидеров', 'Show on the leaderboard'),
          title: st.score ? '' : tr('Попадёт в таблицу, когда наберёт очки', 'Will appear once they score points') });
        cb.addEventListener('change', async () => {
          cb.disabled = true;
          try { await rpc0('gt_admin_set_hidden', { p_pass: adminPass(), p_key: u.key, p_name: u.name, p_hidden: !cb.checked }); D.hidden[u.key] = !cb.checked; LB.at = 0; }
          catch (e) { alert(errText(e)); cb.checked = !cb.checked; }
          finally { cb.disabled = false; }
        });
        t.tBodies[0].append(h('tr', {},
          h('td', {}, u.name), h('td', {}, '' + st.score), h('td', {}, got + '/' + allBadges().length), h('td', {}, cb),
          h('td', {}, !D.pwOk ? '—' : D.pw.has(u.key) ? '✓' : tr('нет', 'none')),
          h('td', { style: 'white-space:nowrap' },
            h('button', { className: 'btn ghost sm', on: { click: () => openStudent(u) } }, tr('Кабинет', 'Account')), ' ',
            h('button', { className: 'btn ghost sm', on: { click: async () => {
              const nn = prompt(tr('Новый логин для «', 'New login for “') + u.name + tr('»:', '”:'), u.name);
              if (nn === null) return;
              try { await renameAdmin(u.key, nn); await refresh(); } catch (e) { alert(errText(e)); }
            } } }, tr('Сменить логин', 'Rename')))));
      });
      body.append(h('div', { className: 'tscroll' }, t));
    };

    async function refresh() {
      status.textContent = tr('Загрузка…', 'Loading…');
      try {
        await loadAdminData();
        status.textContent = tr('Учеников', 'Students') + ': ' + ADM.data.users.length;
        renderTable(); builder.refreshList();
      } catch (e) { status.textContent = errText(e); body.innerHTML = ''; }
    }

    // внести в рейтинг всех, кто занимался раньше (повторный запуск безопасен: очки на сервере только растут)
    const btnFill = h('button', { className: 'btn ghost sm' }, tr('Заполнить рейтинг', 'Fill the leaderboard'));
    btnFill.addEventListener('click', async () => {
      btnFill.disabled = true;
      try {
        status.textContent = tr('Загружаю данные…', 'Loading data…');
        const D = await loadAdminData();
        let done = 0, skipped = 0, failed = 0;
        for (const u of D.users) {
          const st = computeStats(D.by[u.key] || []);
          if (!st.n) { skipped++; continue; }                  // у логина ещё нет ни одной попытки
          try { await rpc0('gt_admin_lb_submit', { p_pass: adminPass(), p_key: u.key, p_name: u.name, p_stats: statsPayload(st) }); done++; }
          catch (e) { failed++; console.warn('Рейтинг:', u.name, e.message); }
          status.textContent = tr('Обработано', 'Processed') + ': ' + (done + skipped + failed) + ' / ' + D.users.length;
        }
        LB.at = 0;
        status.textContent = tr('Готово. В рейтинг внесено логинов', 'Done. Logins added to the leaderboard') + ': ' + done +
          (skipped ? ' · ' + tr('без попыток (пропущено)', 'no attempts (skipped)') + ': ' + skipped : '') +
          (failed ? ' · ' + tr('с ошибкой', 'failed') + ': ' + failed : '');
        renderTable();
      } catch (e) { status.textContent = errText(e); }
      finally { btnFill.disabled = false; }
    });

    q.addEventListener('input', renderTable);
    wrap.append(
      h('h2', {}, tr('Ученики и рейтинг', 'Students and leaderboard')),
      h('p', { className: 'sub' }, tr('Откройте личный кабинет ученика, смените его логин или решите, показывать ли его в таблице лидеров (на главной видны только первые три).',
                                      'Open a student’s account, change their login, or decide whether they appear on the leaderboard (only the top three are shown on the home page).')),
      h('div', { className: 'row' }, h('div', { className: 'grow' }, q),
        h('button', { className: 'btn ghost sm', on: { click: refresh } }, tr('Обновить', 'Refresh')), btnFill),
      status, body, builder);
    refresh();
  }

  // если страница уже успела нарисовать главную или кабинет до загрузки этого файла — перерисуем
  if (typeof CURV === 'string') {
    if (CURV === 'home') window.home(true);
    else if (CURV === 'stats') window.statsView(true);
  }
})();
