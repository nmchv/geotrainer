/*!
 * GeoTrainer — связь с личным кабинетом nmchv.
 * Добавляет в кабинет ученика возможность привязать логин Геотренажёра к аккаунту
 * (email) личного кабинета и синхронизировать попытки в geotrainer_attempts.
 *
 * Подключается ПОСЛЕ auth.js и cabinet.js.
 */
(function () {
  'use strict';

  const ACCOUNT_URL = 'https://wdijrafblddfcqfbtfmr.supabase.co';
  const ACCOUNT_KEY = 'sb_publishable_DdBUmki3byO8VR7Qy63q8g_HFk2qDtJ';
  const CABINET_URL = 'https://www.login.nmchv.ru/';

  if (typeof h !== 'function' || typeof TT !== 'function' || typeof rpc !== 'function') return;

  const tr = (ru, en) => { if (en && !Object.prototype.hasOwnProperty.call(DICT, ru)) DICT[ru] = en; return TT(ru); };
  const GA = window.GTAuth || null;
  const linkKey = () => (typeof USER !== 'undefined' && USER && USER.key) ? 'gt_account_link_' + USER.key : '';

  function readLink() {
    try { const k = linkKey(); return k ? JSON.parse(localStorage.getItem(k) || 'null') : null; } catch { return null; }
  }
  function writeLink(v) {
    try { const k = linkKey(); if (k) localStorage.setItem(k, JSON.stringify(v)); } catch {}
  }

  let sbp = null;
  async function getClient() {
    if (sbp) return sbp;
    sbp = (async () => {
      const mod = await import('https://esm.sh/@supabase/supabase-js@2');
      return mod.createClient(ACCOUNT_URL, ACCOUNT_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'gt-nmchv-account-auth' }
      });
    })().catch((e) => { sbp = null; throw e; });
    return sbp;
  }

  async function syncAttempts(client, legacyName) {
    if (typeof USER === 'undefined' || !USER || !Array.isArray(USER.attempts)) return 0;
    const attempts = USER.attempts.map((a) => {
      const o = (typeof clean === 'function') ? clean(a) : { ...a };
      delete o.pend;
      o.source_id = String(o.ts || '') + ':' + String(o.id || '');
      return o;
    });
    if (!attempts.length) return 0;
    const { data, error } = await client.rpc('sync_geotrainer_attempts', {
      p_legacy_name: legacyName || (USER && USER.name) || '',
      p_attempts: attempts
    });
    if (error) throw error;
    return data || attempts.length;
  }

  async function ensureLinkRecord(client, email) {
    if (!USER) throw new Error(tr('Сначала войдите в Геотренажёр.', 'Sign in to GeoTrainer first.'));
    const { data, error } = await client.rpc('link_geotrainer_account', {
      p_email: email,
      p_legacy_key: USER.key,
      p_legacy_name: USER.name
    });
    if (error) throw error;
    const info = { email: email.toLowerCase(), legacy_key: USER.key, legacy_name: USER.name, linked_at: data?.linked_at || new Date().toISOString() };
    writeLink(info);
    return info;
  }

  function statusLine(msg, ok) {
    return h('p', { className: ok ? 'gta-ok' : 'sub', role: 'status', style: 'min-height:1.2em;margin:8px 0 0' }, msg || '');
  }

  function buildCard() {
    if (typeof USER === 'undefined' || !USER) return null;
    const wrap = h('div', { className: 'gtc-card gta-acc' }, h('h3', {}, tr('Личный кабинет nmchv', 'nmchv account')), h('p', { className: 'sub' }, tr('Проверяем связь…', 'Checking link…')));

    const paint = (...kids) => { wrap.innerHTML = ''; wrap.append(h('h3', {}, tr('Личный кабинет nmchv', 'nmchv account')), ...kids); };

    async function renderLinked(sessionEmail, info) {
      const email = sessionEmail || info?.email || '';
      const msg = statusLine('');
      const syncBtn = h('button', { className: 'btn sm' }, tr('Синхронизировать сейчас', 'Sync now'));
      const unlinkBtn = h('button', { className: 'btn ghost sm' }, tr('Выйти из аккаунта nmchv', 'Sign out of nmchv account'));
      syncBtn.addEventListener('click', async () => {
        syncBtn.disabled = true;
        try {
          const client = await getClient();
          await ensureLinkRecord(client, email);
          const n = await syncAttempts(client, USER.name);
          msg.className = 'gta-ok'; msg.textContent = tr(`Синхронизировано попыток: ${n}. Данные доступны в личном кабинете.`, `Synced attempts: ${n}. Data is available in your nmchv account.`);
        } catch (e) {
          msg.className = 'badc'; msg.textContent = (e && e.message) || tr('Не удалось синхронизировать.', 'Sync failed.');
        } finally { syncBtn.disabled = false; }
      });
      unlinkBtn.addEventListener('click', async () => {
        unlinkBtn.disabled = true;
        try { const client = await getClient(); await client.auth.signOut(); } catch {}
        paint(h('p', { className: 'sub' }, tr('Сессия аккаунта nmchv на этом устройстве завершена. Привязка сохранена в личном кабинете.', 'nmchv account session ended on this device. The link remains in your account.')), h('div', { className: 'row' }, h('button', { className: 'btn ghost sm', on: { click: () => init() } }, tr('Назад', 'Back'))));
      });
      paint(
        h('p', { className: 'sub' }, tr(`Логин «${USER.name}» связан с ${email}. Вся статистика и попытки могут храниться в личном кабинете nmchv.`, `Login “${USER.name}” is linked to ${email}. Your stats and attempts can be stored in your nmchv account.`)),
        h('div', { className: 'row' }, syncBtn, unlinkBtn, h('a', { className: 'btn ghost sm', href: CABINET_URL, target: '_blank', rel: 'noopener noreferrer' }, tr('Открыть кабинет', 'Open account'))),
        msg
      );
      // авто-синхронизация при открытии
      try { const client = await getClient(); await syncAttempts(client, USER.name); } catch {}
    }

    function renderForm(prefillEmail) {
      const info = readLink();
      const emailInp = h('input', { type: 'email', placeholder: 'you@example.com', autocomplete: 'email', value: prefillEmail || info?.email || '' });
      const passInp = h('input', { type: 'password', placeholder: tr('Пароль от личного кабинета', 'nmchv account password'), autocomplete: 'current-password' });
      const msg = statusLine('');
      const btn = h('button', { className: 'btn sm' }, tr('Связать и синхронизировать', 'Link and sync'));
      const help = h('p', { className: 'gta-hint' }, tr('Введите email и пароль от личного кабинета nmchv. Если почта совпадает, логин Геотренажёра будет связан, а все попытки сохранятся в личном кабинете.', 'Enter the email and password of your nmchv account. If the email matches, your GeoTrainer login will be linked and all attempts will be stored in your account.'));

      const go = async () => {
        const email = (emailInp.value || '').trim().toLowerCase();
        const password = passInp.value || '';
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.className = 'badc'; msg.textContent = tr('Укажите корректный email.', 'Enter a valid email.'); return; }
        if (!password) { msg.className = 'badc'; msg.textContent = tr('Введите пароль от личного кабинета.', 'Enter your account password.'); return; }
        btn.disabled = true; msg.className = 'sub'; msg.textContent = tr('Входим и связываем…', 'Signing in and linking…');
        try {
          const client = await getClient();
          const { data, error } = await client.auth.signInWithPassword({ email, password });
          if (error) throw error;
          const sessionEmail = (data?.user?.email || email).toLowerCase();
          await ensureLinkRecord(client, sessionEmail);
          const n = await syncAttempts(client, USER.name);
          msg.className = 'gta-ok'; msg.textContent = tr(`Готово: логин связан с ${sessionEmail}. Синхронизировано попыток: ${n}.`, `Done: linked to ${sessionEmail}. Synced attempts: ${n}.`);
          setTimeout(() => renderLinked(sessionEmail, readLink()), 600);
        } catch (e) {
          const m = (e && e.message) || '';
          if (/Invalid login credentials/i.test(m)) msg.textContent = tr('Неверный email или пароль личного кабинета.', 'Wrong nmchv account email or password.');
          else if (/email_mismatch/i.test(m)) msg.textContent = tr('Email сессии не совпадает. Войдите тем же email, что и в личном кабинете.', 'Session email does not match. Sign in with the same email as your account.');
          else if (/duplicate key|geotrainer_links_legacy_key_key/i.test(m)) msg.textContent = tr('Этот логин Геотренажёра уже привязан к другому аккаунту.', 'This GeoTrainer login is already linked to another account.');
          else if (/column reference \"project_id\" is ambiguous/i.test(m)) msg.textContent = tr('На стороне личного кабинета нужно применить исправление миграции (триггер активности). После обновления БД повторите синхронизацию.', 'The account database needs a trigger fix migration. Apply it and try syncing again.');
          else msg.textContent = tr('Не удалось связать: ', 'Could not link: ') + m;
          msg.className = 'badc';
        } finally { btn.disabled = false; }
      };

      btn.addEventListener('click', go);
      passInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });

      paint(
        h('p', { className: 'sub' }, tr('Свяжите логин Геотренажёра с email личного кабинета nmchv. Если email совпадает, статистика и все попытки будут храниться в личном кабинете.', 'Link your GeoTrainer login with your nmchv account email. If the email matches, your stats and all attempts will be stored in your personal account.')),
        h('label', { className: 'gta-lbl' }, tr('Email личного кабинета', 'nmchv account email')), emailInp,
        h('label', { className: 'gta-lbl' }, tr('Пароль личного кабинета', 'nmchv account password')), passInp,
        h('div', { className: 'row' }, btn, h('a', { className: 'btn ghost sm', href: CABINET_URL, target: '_blank', rel: 'noopener noreferrer' }, tr('Открыть кабинет', 'Open account'))),
        help, msg
      );
    }

    async function init() {
      paint(h('p', { className: 'sub' }, tr('Проверяем связь…', 'Checking link…')));
      try {
        const client = await getClient();
        const { data } = await client.auth.getSession();
        const session = data && data.session;
        const info = readLink();
        if (session && session.user && session.user.email) {
          try { await ensureLinkRecord(client, session.user.email.toLowerCase()); } catch {}
          return renderLinked(session.user.email.toLowerCase(), readLink() || info);
        }
        renderForm(info?.email);
      } catch {
        renderForm((readLink() || {}).email);
      }
    }

    init();
    return wrap;
  }

  // Встраиваем карточку в кабинет ученика (в buildCabinet вызывается GA.accountBlock()).
  const wrapOriginal = GA && GA.accountBlock;
  function combinedBlock() {
    const parts = [];
    if (typeof wrapOriginal === 'function') { const p = wrapOriginal(); if (p) parts.push(p); }
    const linkCard = buildCard(); if (linkCard) parts.push(linkCard);
    if (!parts.length) return null;
    if (parts.length === 1) return parts[0];
    const frag = document.createDocumentFragment();
    parts.forEach((p) => frag.append(p));
    // cabinet appends returned node; fragment appends children - better return a wrapper
    const container = h('div', { className: 'gta-account-blocks' });
    parts.forEach((p) => container.append(p));
    return container;
  }

  if (GA) {
    GA.accountBlock = combinedBlock;
  } else {
    window.GTAuth = { accountBlock: combinedBlock };
  }

  // Синхронизация после успешной отправки попыток (если есть сессия аккаунта)
  async function autoSync() {
    if (!USER) return;
    try {
      const client = await getClient();
      const { data } = await client.auth.getSession();
      if (data && data.session && data.session.user) {
        await ensureLinkRecord(client, data.session.user.email.toLowerCase());
        await syncAttempts(client, USER.name);
      }
    } catch {}
  }
  const sync0 = window.syncUser;
  if (typeof sync0 === 'function') {
    window.syncUser = async function () {
      const res = await sync0.apply(this, arguments);
      autoSync();
      return res;
    };
  }
  const push0 = window.pushPending;
  if (typeof push0 === 'function') {
    window.pushPending = async function () {
      const res = await push0.apply(this, arguments);
      if (res) autoSync();
      return res;
    };
  }

})();
