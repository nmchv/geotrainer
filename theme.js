/*!
 * Переключатель светлой/тёмной темы для экосистемы nmchv.ru
 * (nmchv.ru · wiki.nmchv.ru · geotrainer.nmchv.ru).
 *
 * Один и тот же файл лежит во всех трёх проектах. Подключается в <head>
 * синхронным <script src="…/theme.js"></script> — так тема выставляется
 * до первой отрисовки и страница не «мигает».
 *
 * Выбор посетителя хранится в cookie на домене .nmchv.ru (общий для всех
 * поддоменов) и дублируется в localStorage. Пока выбора нет — тема
 * берётся из настроек системы (prefers-color-scheme).
 *
 * Кнопка — любой элемент с атрибутом data-theme-toggle. Обработчик
 * делегированный, поэтому работает и для кнопок, которые рисует JavaScript.
 */
(function () {
  'use strict';

  var KEY = 'nmchv-theme';
  var DEFAULT = 'system';                // 'system' | 'dark' | 'light'
  var COLORS = { dark: '#08090b', light: '#f5f7fa' }; // для <meta name="theme-color">
  var LABELS = {
    ru: ['Включить светлую тему', 'Включить тёмную тему'],
    en: ['Switch to light theme', 'Switch to dark theme']
  };

  var root = document.documentElement;
  var query = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

  function readCookie() {
    var m = document.cookie.match(new RegExp('(?:^|; )' + KEY + '=(light|dark)'));
    return m ? m[1] : null;
  }

  function stored() {
    var v = readCookie();
    if (!v) {
      try { v = localStorage.getItem(KEY); } catch (e) { v = null; }
    }
    return v === 'light' || v === 'dark' ? v : null;
  }

  function save(v) {
    var host = location.hostname;
    var shared = /(^|\.)nmchv\.ru$/.test(host) ? '; Domain=.nmchv.ru' : '';
    var secure = location.protocol === 'https:' ? '; Secure' : '';
    try {
      document.cookie = KEY + '=' + v + shared + '; Path=/; Max-Age=31536000; SameSite=Lax' + secure;
    } catch (e) { /* cookie недоступна — останется localStorage */ }
    try { localStorage.setItem(KEY, v); } catch (e) { /* приватный режим */ }
  }

  function systemTheme() {
    return query && query.matches ? 'light' : 'dark';
  }

  function resolve() {
    return stored() || (DEFAULT === 'light' || DEFAULT === 'dark' ? DEFAULT : systemTheme());
  }

  function labelFor(btn, theme) {
    var toLight = theme === 'dark';
    var custom = toLight ? btn.getAttribute('data-label-light') : btn.getAttribute('data-label-dark');
    if (custom) return custom;
    var lang = (root.getAttribute('lang') || 'ru').slice(0, 2).toLowerCase();
    var pair = LABELS[lang] || LABELS.en;
    return toLight ? pair[0] : pair[1];
  }

  function syncButtons(theme) {
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      var label = labelFor(buttons[i], theme);
      buttons[i].setAttribute('aria-label', label);
      buttons[i].setAttribute('title', label);
    }
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', COLORS[theme]);
    syncButtons(theme);
    try {
      window.dispatchEvent(new CustomEvent('nmchv:themechange', { detail: { theme: theme } }));
    } catch (e) { /* старые браузеры */ }
  }

  var animTimer;
  function set(theme, animate) {
    if (theme !== 'light' && theme !== 'dark') return;
    if (animate) {
      root.classList.add('theme-anim');
      clearTimeout(animTimer);
      animTimer = setTimeout(function () { root.classList.remove('theme-anim'); }, 400);
    }
    save(theme);
    apply(theme);
  }

  function toggle() {
    set(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light', true);
  }

  // 1. Тема выставляется сразу, до отрисовки страницы.
  apply(resolve());

  // 2. Кнопки подписываем, когда документ готов; клики ловим делегированием.
  document.addEventListener('DOMContentLoaded', function () { syncButtons(root.getAttribute('data-theme')); });
  document.addEventListener('click', function (e) {
    var el = e.target;
    var btn = el && el.closest ? el.closest('[data-theme-toggle]') : null;
    if (btn) { e.preventDefault(); toggle(); }
  });

  // 3. Пока посетитель сам ничего не выбрал — следуем за системной темой.
  if (query) {
    var onSystem = function () { if (!stored() && DEFAULT === 'system') apply(systemTheme()); };
    if (query.addEventListener) query.addEventListener('change', onSystem);
    else if (query.addListener) query.addListener(onSystem);
  }

  // 4. Синхронизация между вкладками и при возврате на вкладку (cookie общая для поддоменов).
  window.addEventListener('storage', function (e) {
    if (e.key === KEY && (e.newValue === 'light' || e.newValue === 'dark')) apply(e.newValue);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    var v = stored();
    if (v && v !== root.getAttribute('data-theme')) apply(v);
  });

  window.NmchvTheme = {
    get: function () { return root.getAttribute('data-theme'); },
    set: function (t) { set(t, true); },
    toggle: toggle,
    refresh: function () { syncButtons(root.getAttribute('data-theme')); } // перечитать подписи кнопок (после смены языка)
  };
})();
