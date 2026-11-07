/*!
 * GeoTrainer — вход с паролем.
 *
 * Подключается в index.html ПЕРЕД cabinet.js и ПОСЛЕ основного inline-скрипта (см. INSTRUCTIONS.md).
 *
 * Как это работает для ученика:
 *   • первый раз: вводит логин → если такого нет, придумывает пароль (от 4 символов) и сразу входит;
 *   • дальше с этого устройства ничего вводить не нужно — вход запоминается, пока он сам не нажмёт «Выйти»;
 *   • после «Выйти» логин остаётся на кнопке: нажал на него и ввёл только пароль;
 *   • у старых логинов пароля пока нет — они продолжают работать, а в личном кабинете появляется
 *     карточка «Защитите свой логин паролем»;
 *   • забыл пароль — учитель сбрасывает его в админке, ученик придумывает новый.
 *
 * Если на сервере ещё не выполнен обновлённый SQL, окно входа работает по-старому (только логин).
 * Без сервера (config.js пуст) файл ничего не меняет.
 */
(function () {
  'use strict';

  if (typeof h !== 'function' || typeof loginBox !== 'function' || typeof loginAs !== 'function' ||
      typeof logout !== 'function' || typeof syncUser !== 'function' || typeof rpc !== 'function') {
    console.warn('auth.js: не найден основной скрипт index.html — модуль не запущен');
    return;
  }

  const tr = (ru, en) => { if (en && !Object.prototype.hasOwnProperty.call(DICT, ru)) DICT[ru] = en; return TT(ru); };
  const rpc0 = window.rpc;
  const norm = s => (s || '').trim().replace(/\s+/g, ' ').slice(0, 30);   // как в loginAs()
  let NOAUTH = false;                                                       // на сервере нет обновлённого SQL

  // ---------------------------------------------------------------- стили
  const css = `
.gta-lbl{margin:14px 0 6px;font-size:.85rem;color:var(--color-text-secondary)}
.gta-chips{display:flex;flex-wrap:wrap;gap:8px}
.gta-chip{display:inline-flex;align-items:stretch;border:1px solid var(--color-border);border-radius:999px;background:var(--color-surface);overflow:hidden;max-width:100%}
.gta-pick{font:inherit;color:inherit;background:none;border:0;padding:8px 6px 8px 14px;cursor:pointer;min-height:40px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px}
.gta-pick:hover,.gta-pick:focus-visible{background:var(--color-surface-sunken,rgba(127,127,127,.12))}
.gta-x{font:inherit;color:var(--color-text-secondary);background:none;border:0;padding:0 12px 0 6px;cursor:pointer;min-width:34px}
.gta-x:hover,.gta-x:focus-visible{color:var(--color-bad)}
.gta-who{display:inline-block;margin:2px 0 10px;padding:6px 12px;border-radius:999px;border:1px solid var(--color-border);font-weight:600;max-width:100%;overflow-wrap:anywhere}
.gta-show{display:flex;align-items:center;gap:8px;margin:8px 0 0;font-size:.9rem;color:var(--color-text-secondary);cursor:pointer}
.gta-show input{width:auto;margin:0}
.gta-hint{margin:10px 0 0;font-size:.85rem;color:var(--color-text-secondary)}
.gta-busy{opacity:.6;pointer-events:none}
.gta-ok{color:var(--color-ok);margin:8px 0 0}
.gta-acc .row{margin-top:10px}
.gta-acc input[type=password],.gta-acc input[type=text]{width:100%}
`;
  const st = document.createElement('style'); st.id = 'gta-css'; st.textContent = css; document.head.append(st);

  // ---------------------------------------------------------------- вход, запомненный в браузере
  // localStorage 'gt_auth_v1' = { logins: [{ key, name, token, last }] }
  //   token — вход этого устройства (в базе лежит только его хеш); пустой после «Выйти»
  const SK = 'gt_auth_v1';
  const read = () => { try { const j = JSON.parse(localStorage.getItem(SK)); if (j && Array.isArray(j.logins)) return j; } catch (e) { /* пусто */ } return { logins: [] }; };
  const write = j => { try { localStorage.setItem(SK, JSON.stringify(j)); } catch (e) { /* без localStorage вход просто не запомнится */ } };
  const list = () => read().logins.slice().sort((a, b) => (b.last || 0) - (a.last || 0));
  const token = key => { const l = read().logins.find(x => x.key === key); return (l && l.token) || ''; };
  function remember(key, name, tok) {
    const j = read();
    j.logins = j.logins.filter(x => x.key !== key);
    j.logins.push({ key, name, token: tok || '', last: Date.now() });
    j.logins = j.logins.sort((a, b) => b.last - a.last).slice(0, 8);
    write(j);
  }
  function dropToken(key) { const j = read(); j.logins.forEach(x => { if (x.key === key) x.token = ''; }); write(j); }
  function forget(key) { const j = read(); j.logins = j.logins.filter(x => x.key !== key); write(j); }
  function rekey(oldKey, newKey, name) {
    const j = read(), l = j.logins.find(x => x.key === oldKey);
    if (!l) return;
    j.logins = j.logins.filter(x => x.key !== newKey && x.key !== oldKey);
    j.logins.push({ key: newKey, name, token: l.token, last: Date.now() });
    write(j);
  }
  const changed = key => { try { window.dispatchEvent(new CustomEvent('gt-auth', { detail: { key } })); } catch (e) { /* старый браузер */ } };

  // ---------------------------------------------------------------- тексты ошибок
  const missing = e => /Could not find the function|PGRST202|does not exist/.test((e && e.message) || '');
  function errText(e) {
    const m = (e && e.message) || String(e || '');
    if (!navigator.onLine || /Failed to fetch|NetworkError|aborted|Load failed|offline/i.test(m)) return tr('Для входа нужен интернет. Проверьте соединение.', 'Signing in needs an internet connection.');
    if (/weak password/.test(m)) return tr('Пароль — от 4 символов.', 'The password must be at least 4 characters.');
    if (/taken/.test(m)) return tr('Для этого логина пароль уже задан.', 'A password is already set for this login.');
    if (/unauthorized/.test(m)) return tr('Нужно войти заново.', 'Please sign in again.');
    return m;
  }
  function loginErr(r) {
    if (r && r.error === 'locked') {
      const mins = Math.max(1, Math.ceil((r.seconds || 60) / 60));
      return tr('Слишком много неверных попыток. Подождите', 'Too many wrong attempts. Wait') + ' ' + mins + ' ' + tr('мин.', 'min.');
    }
    return tr('Неверный пароль.', 'Wrong password.');
  }

  const pwInput = (autocomplete, label) => h('input', { type: 'password', maxLength: 72, autocomplete, 'aria-label': label, placeholder: label });
  function showToggle(inp) {
    const cb = h('input', { type: 'checkbox' });
    cb.addEventListener('change', () => { inp.type = cb.checked ? 'text' : 'password'; });
    return h('label', { className: 'gta-show' }, cb, tr('Показать пароль', 'Show password'));
  }

  // ---------------------------------------------------------------- окно входа
  const closeDialog = () => { const d = $('login'); if (d) d.remove(); document.documentElement.classList.remove('modal'); };

  function openDialog(cb, pre) {
    const old = $('login'); if (old) old.remove();
    const card = h('div', { className: 'login-card' });
    const box = h('div', { id: 'login', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lg-t' }, card);
    document.body.append(box); document.documentElement.classList.add('modal');
    let busy = false;
    const cancel = () => { closeDialog(); if (location.hash === '#stats') location.hash = ''; };
    box.addEventListener('keydown', e => { if (e.key === 'Escape') cancel(); });
    const wait = on => { busy = on; card.classList.toggle('gta-busy', on); };

    const frame = (title, sub, ...kids) => {
      card.innerHTML = '';
      card.append(h('span', { className: 'eyebrow' }, tr('Вход', 'Sign in')), h('h2', { id: 'lg-t' }, title), sub ? h('p', { className: 'sub' }, sub) : '', ...kids);
      setTimeout(() => { const i = card.querySelector('input[type=text],input[type=password]'); if (i) i.focus(); }, 30);
    };
    const errP = msg => h('p', { className: 'badc', style: 'min-height:1.4em;margin:6px 0 0', role: 'alert' }, msg || '');

    async function finish(key, name, tok) {
      remember(key, name, tok);
      wait(true);
      try { await loginAs(name); } catch (e) { console.warn(e); }
      closeDialog();
      changed(key);
      if (cb) cb(); else route();
    }

    // шаг 1: выбрать сохранённый логин или ввести новый
    function stepName(msg) {
      const saved = list();
      const inp = h('input', { type: 'text', placeholder: tr('Например: Иван 9А', 'For example: Ivan 9A'), maxLength: 30, autocomplete: 'off', 'aria-label': tr('Логин', 'Login') });
      const err = errP(msg);
      const go = () => {
        if (busy) return;
        const name = norm(inp.value);
        if (!name) { err.textContent = tr('Введите логин', 'Enter a login'); inp.focus(); return; }
        next(name);
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      const chips = saved.length ? [
        h('p', { className: 'gta-lbl' }, tr('Ваши логины на этом устройстве', 'Logins on this device')),
        h('div', { className: 'gta-chips' }, saved.map(l => h('span', { className: 'gta-chip' },
          h('button', { className: 'gta-pick', type: 'button', title: l.name, on: { click: () => { if (!busy) next(l.name); } } }, l.name),
          h('button', { className: 'gta-x', type: 'button', 'aria-label': tr('Убрать из списка', 'Remove from the list') + ': ' + l.name, title: tr('Убрать из списка', 'Remove from the list'),
            on: { click: () => { forget(l.key); stepName(); } } }, '×')))),
        h('p', { className: 'gta-lbl' }, tr('Или введите другой логин', 'Or enter another login'))
      ] : [];
      frame(tr('Введите ваш логин', 'Enter your login'),
        tr('Если такого логина ещё нет, вы придумаете для него пароль. Пароль нужен, чтобы никто другой не зашёл под вашим логином.',
           'If the login does not exist yet, you will choose a password for it. The password stops anyone else from using your login.'),
        ...chips, inp, err,
        h('div', { className: 'row' }, h('button', { className: 'btn', on: { click: go } }, tr('Далее', 'Next')), h('button', { className: 'btn ghost', on: { click: cancel } }, tr('Отмена', 'Cancel'))));
    }

    // дальше: выясняем, что за логин
    async function next(name) {
      const key = name.toLowerCase();
      wait(true);
      let status;
      try {
        if (!navigator.onLine) throw new Error('offline');
        status = await rpc0('gt_acc_status', { p_key: key });
      } catch (e) {
        wait(false);
        if (missing(e)) { NOAUTH = true; closeDialog(); loginBox0(cb); return; }      // SQL ещё не обновлён — по-старому
        return stepName(errText(e));
      }
      if (status && status.has_pass) { wait(false); return stepPass(key, name); }
      if (status && status.known === false) {
        try {
          const mv = await rpc0('gt_acc_moved', { p_key: key });
          if (mv && mv.key) { wait(false); return stepMoved(name, mv); }
        } catch (e) { /* подсказка о переносе необязательна */ }
      }
      wait(false);
      stepCreate(key, name, !!(status && status.known));
    }

    // шаг 2а: у логина есть пароль
    function stepPass(key, name, msg) {
      const inp = pwInput('current-password', tr('Пароль', 'Password'));
      const err = errP(msg);
      const go = async () => {
        if (busy) return;
        if (!inp.value) { err.textContent = tr('Введите пароль', 'Enter your password'); inp.focus(); return; }
        wait(true);
        let r;
        try { r = await rpc0('gt_acc_login', { p_key: key, p_pass: inp.value }); }
        catch (e) { wait(false); err.textContent = errText(e); return; }
        if (r && r.ok) return finish(key, name, r.token);
        wait(false);
        if (r && r.error === 'nopass') return stepCreate(key, name, true);
        err.textContent = loginErr(r); inp.select();
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      frame(tr('Введите пароль', 'Enter your password'), null,
        h('div', { className: 'gta-who' }, name), inp, showToggle(inp), err,
        h('div', { className: 'row' }, h('button', { className: 'btn', on: { click: go } }, tr('Войти', 'Sign in')), h('button', { className: 'btn ghost', on: { click: () => stepName() } }, tr('Назад', 'Back'))),
        h('p', { className: 'gta-hint' }, tr('Забыли пароль? Попросите учителя сбросить его — после этого вы придумаете новый.', 'Forgot the password? Ask your teacher to reset it — then you can choose a new one.')));
    }

    // шаг 2б: нового логина нет или у него нет пароля — придумываем пароль
    function stepCreate(key, name, known) {
      const inp = pwInput('new-password', tr('Придумайте пароль', 'Choose a password'));
      const err = errP();
      const go = async () => {
        if (busy) return;
        if (inp.value.length < 4) { err.textContent = tr('Пароль — от 4 символов.', 'The password must be at least 4 characters.'); inp.focus(); return; }
        wait(true);
        let tok;
        try { tok = await rpc0('gt_acc_register', { p_key: key, p_name: name, p_pass: inp.value }); }
        catch (e) {
          wait(false);
          if (/taken/.test(e.message || '')) return stepPass(key, name, tr('Для этого логина пароль уже задан — введите его.', 'This login already has a password — enter it.'));
          err.textContent = errText(e); return;
        }
        finish(key, name, tok);
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      frame(known ? tr('Задайте пароль', 'Set a password') : tr('Новый логин', 'New login'),
        known ? tr('Логин уже есть, но пароля у него пока нет. Если это ваш логин — задайте пароль, и больше никто не сможет зайти под ним.',
                   'This login exists but has no password yet. If it is yours, set a password so nobody else can use it.')
              : tr('Такого логина ещё нет — он будет создан. Придумайте пароль (от 4 символов). Если забудете, учитель сможет его сбросить.',
                   'This login does not exist yet — it will be created. Choose a password (at least 4 characters). If you forget it, your teacher can reset it.'),
        h('div', { className: 'gta-who' }, name), inp, showToggle(inp), err,
        h('div', { className: 'row' }, h('button', { className: 'btn', on: { click: go } }, known ? tr('Задать и войти', 'Set and sign in') : tr('Создать и войти', 'Create and sign in')),
          h('button', { className: 'btn ghost', on: { click: () => stepName() } }, tr('Назад', 'Back'))));
    }

    // логин, которого нет, но учитель его переименовал
    function stepMoved(name, mv) {
      frame(tr('Логин изменён', 'Login changed'),
        tr('Логин «', 'The login “') + name + tr('» теперь называется «', '” is now called “') + mv.name + tr('». Все ваши результаты — под новым логином.', '”. All your results are kept under the new login.'),
        h('div', { className: 'row' },
          h('button', { className: 'btn', on: { click: () => next(mv.name) } }, tr('Войти как «', 'Sign in as “') + mv.name + tr('»', '”')),
          h('button', { className: 'btn ghost', on: { click: () => stepName() } }, tr('Другой логин', 'Another login'))));
    }

    if (pre && pre.name) next(pre.name); else stepName();
  }

  const loginBox0 = window.loginBox;
  window.loginBox = function (cb, pre) {
    if (!REMOTE || NOAUTH) return loginBox0.apply(this, arguments);
    openDialog(cb, pre);
  };

  // ---------------------------------------------------------------- выход
  const logout0 = window.logout;
  window.logout = function () {
    const k = USER && USER.key, t = k ? token(k) : '';
    if (t) rpc0('gt_acc_logout', { p_token: t }).catch(() => {});      // этот вход на сервере больше не действует
    if (k) dropToken(k);                                                 // логин остаётся на кнопке, но без пароля не войти
    return logout0.apply(this, arguments);
  };

  // ---------------------------------------------------------------- «учитель изменил ваш логин»
  // Если на этом устройстве остался старый логин, а учитель его переименовал, синхронизация создала бы на сервере дубликат.
  // Вместо этого предлагаем войти под новым логином.
  const moved = {};            // key → { t, mv }
  const isMoved = k => !!(moved[k] && moved[k].mv);

  function showMoved(mv) {
    if ($('login')) return;
    const card = h('div', { className: 'login-card' },
      h('span', { className: 'eyebrow' }, tr('Вход', 'Sign in')), h('h2', { id: 'lg-t' }, tr('Учитель изменил ваш логин', 'Your teacher changed your login')),
      h('p', { className: 'sub' }, tr('Теперь ваш логин — «', 'Your login is now “') + mv.name + tr('». Войдите под ним (понадобится пароль), и результаты продолжат сохраняться.', '”. Sign in with it (you will need the password) so your results keep being saved.')),
      h('div', { className: 'row' },
        h('button', { className: 'btn', on: { click: () => { closeDialog(); window.logout(); openDialog(null, { name: mv.name }); } } }, tr('Войти как «', 'Sign in as “') + mv.name + tr('»', '”')),
        h('button', { className: 'btn ghost', on: { click: closeDialog } }, tr('Позже', 'Later'))));
    document.body.append(h('div', { id: 'login', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lg-t' }, card));
    document.documentElement.classList.add('modal');
  }

  // Проверка идёт один раз на логин (результат «не переносили» помним 10 минут); параллельные вызовы ждут тот же ответ.
  function movedCheck(k) {
    let c = moved[k];
    if (!c || (!c.p && !c.mv && Date.now() - c.t > 600000)) {
      c = moved[k] = { t: Date.now(), mv: null, p: null };
      c.p = rpc0('gt_acc_moved', { p_key: k })
        .then(mv => { if (mv && mv.key) { c.mv = mv; showMoved(mv); } })
        .catch(e => { if (missing(e)) NOAUTH = true; })
        .finally(() => { c.p = null; });
    }
    return c.p || Promise.resolve();
  }

  const sync0 = window.syncUser;
  window.syncUser = async function () {
    if (REMOTE && !NOAUTH && USER && navigator.onLine) {
      const k = USER.key;
      await movedCheck(k);
      if (isMoved(k)) return false;
    }
    return sync0.apply(this, arguments);
  };
  if (typeof pushPending === 'function') {
    const push0 = window.pushPending;
    window.pushPending = async function () {
      if (REMOTE && !NOAUTH && USER && navigator.onLine) { await movedCheck(USER.key); if (isMoved(USER.key)) return false; }
      return push0.apply(this, arguments);
    };
  }

  // ---------------------------------------------------------------- карточка «Пароль» в личном кабинете ученика
  function accountBlock() {
    if (!REMOTE || NOAUTH || !USER) return null;
    const wrap = h('div', { className: 'gtc-card gta-acc' }, h('h3', {}, tr('Пароль', 'Password')), h('p', { className: 'sub' }, tr('Проверяем…', 'Checking…')));
    const key = USER.key, name = USER.name;

    const paint = (...kids) => { wrap.innerHTML = ''; wrap.append(h('h3', {}, tr('Пароль', 'Password')), ...kids); };
    const msgP = (t, ok) => h('p', { className: ok ? 'gta-ok' : 'badc', role: 'alert', style: 'min-height:1.2em' }, t || '');

    function protectedView(note) {
      const btn = h('button', { className: 'btn ghost sm', on: { click: edit } }, tr('Сменить пароль', 'Change password'));
      paint(h('p', { className: 'sub' }, tr('✓ Логин защищён паролем. На этом устройстве вам не придётся вводить его каждый раз.', '✓ Your login is protected by a password. You will not have to type it every time on this device.')),
        note ? msgP(note, true) : '', h('div', { className: 'row' }, btn));
    }
    function edit() {
      const inp = pwInput('new-password', tr('Новый пароль', 'New password'));
      const err = msgP('');
      const save = h('button', { className: 'btn sm' }, tr('Сохранить', 'Save'));
      const go = async () => {
        if (inp.value.length < 4) { err.textContent = tr('Пароль — от 4 символов.', 'The password must be at least 4 characters.'); return; }
        save.disabled = true;
        try { await rpc0('gt_acc_set_password', { p_key: key, p_token: token(key), p_new: inp.value }); protectedView(tr('Пароль изменён. На других устройствах потребуется войти заново.', 'Password changed. Other devices will need to sign in again.')); }
        catch (e) { err.textContent = errText(e); save.disabled = false; if (/unauthorized/.test(e.message || '')) { dropToken(key); changed(key); } }
      };
      save.addEventListener('click', go);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); else if (e.key === 'Escape') protectedView(); });
      paint(inp, showToggle(inp), err, h('div', { className: 'row' }, save, h('button', { className: 'btn ghost sm', on: { click: () => protectedView() } }, tr('Отмена', 'Cancel'))));
      inp.focus();
    }
    function claimView() {
      const inp = pwInput('new-password', tr('Придумайте пароль', 'Choose a password'));
      const err = msgP('');
      const btn = h('button', { className: 'btn sm' }, tr('Задать пароль', 'Set password'));
      const go = async () => {
        if (inp.value.length < 4) { err.textContent = tr('Пароль — от 4 символов.', 'The password must be at least 4 characters.'); return; }
        btn.disabled = true;
        try {
          const tok = await rpc0('gt_acc_register', { p_key: key, p_name: name, p_pass: inp.value });
          remember(key, name, tok); changed(key); protectedView(tr('Готово: пароль задан.', 'Done: the password is set.'));
        } catch (e) {
          btn.disabled = false;
          if (/taken/.test(e.message || '')) return confirmView();
          err.textContent = errText(e);
        }
      };
      btn.addEventListener('click', go);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      paint(h('p', { className: 'sub' }, tr('Сейчас под вашим логином может зайти любой, кто его знает. Задайте пароль (от 4 символов) — и больше никто не сможет. Дальше всё как обычно: на этом устройстве вводить его каждый раз не нужно.',
                                           'Right now anyone who knows your login can use it. Set a password (at least 4 characters) and nobody else can. Everything else stays the same: you will not have to type it every time on this device.')),
        inp, showToggle(inp), err, h('div', { className: 'row' }, btn));
    }
    function confirmView(note) {       // пароль у логина уже есть, а это устройство вошло без него
      const inp = pwInput('current-password', tr('Пароль', 'Password'));
      const err = msgP(note || '');
      const btn = h('button', { className: 'btn sm' }, tr('Подтвердить', 'Confirm'));
      const go = async () => {
        if (!inp.value) return;
        btn.disabled = true;
        try {
          const r = await rpc0('gt_acc_login', { p_key: key, p_pass: inp.value });
          if (r && r.ok) { remember(key, name, r.token); changed(key); protectedView(tr('Готово: вход подтверждён.', 'Done: sign-in confirmed.')); return; }
          err.textContent = loginErr(r); btn.disabled = false;
          if (r && r.error === 'nopass') claimView();
        } catch (e) { err.textContent = errText(e); btn.disabled = false; }
      };
      btn.addEventListener('click', go);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      paint(h('p', { className: 'sub' }, tr('У этого логина уже задан пароль, но это устройство вошло без него. Введите пароль — тогда результаты продолжат попадать в таблицу лидеров. Забыли? Попросите учителя сбросить пароль.',
                                           'This login already has a password, but this device signed in without it. Enter it so your results keep counting on the leaderboard. Forgot it? Ask your teacher to reset it.')),
        inp, showToggle(inp), err, h('div', { className: 'row' }, btn));
    }

    (async () => {
      try {
        const t = token(key);
        if (t && (await rpc0('gt_acc_valid', { p_key: key, p_token: t }))) return protectedView();
        if (t) dropToken(key);                                  // вход устарел или пароль сбросили
        const s = await rpc0('gt_acc_status', { p_key: key });
        if (s && s.has_pass) confirmView(); else claimView();
      } catch (e) {
        if (missing(e)) { NOAUTH = true; wrap.remove(); return; }
        paint(h('p', { className: 'sub' }, tr('Нет связи с сервером — проверим позже.', 'No connection to the server — will check later.')));
      }
    })();
    return wrap;
  }

  window.GTAuth = { token, list, remember, dropToken, forget, rekey, changed, errText, accountBlock, openLogin: (cb, pre) => window.loginBox(cb, pre), isMoved };
})();
