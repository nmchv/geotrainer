const config = window.GT_ACCOUNT_CONFIG;
const bridge = window.GT_ACCOUNT_BRIDGE;
const widget = document.createElement("button");
widget.className = "gt-account-widget";
widget.type = "button";
widget.textContent = "Войти по почте";
document.body.append(widget);

const dialog = document.createElement("dialog");
dialog.className = "gt-account-dialog";
dialog.setAttribute("aria-labelledby", "gt-account-title");
const title = document.createElement("h2");
title.id = "gt-account-title";
title.textContent = "Общий аккаунт nmchv";
const description = document.createElement("p");
description.textContent = "Войдите с почтой и паролем, которые используете в личном кабинете.";
const message = document.createElement("p");
message.className = "gt-account-message";
message.setAttribute("role", "alert");

const form = document.createElement("form");
form.className = "gt-account-form";
const emailLabel = document.createElement("label");
emailLabel.textContent = "Электронная почта";
const emailInput = document.createElement("input");
emailInput.type = "email";
emailInput.name = "email";
emailInput.autocomplete = "email";
emailInput.required = true;
emailLabel.append(emailInput);

const passwordLabel = document.createElement("label");
passwordLabel.textContent = "Пароль";
const passwordInput = document.createElement("input");
passwordInput.type = "password";
passwordInput.name = "password";
passwordInput.autocomplete = "current-password";
passwordInput.minLength = 8;
passwordInput.required = true;
passwordLabel.append(passwordInput);

const nameLabel = document.createElement("label");
nameLabel.textContent = "Имя";
const nameInput = document.createElement("input");
nameInput.type = "text";
nameInput.name = "display_name";
nameInput.autocomplete = "name";
nameInput.maxLength = 80;
nameLabel.append(nameInput);
nameLabel.hidden = true;

const legacyLabel = document.createElement("label");
legacyLabel.textContent = "Старый локальный профиль для переноса";
const legacySelect = document.createElement("select");
legacySelect.name = "legacy_user";
const noLegacyOption = document.createElement("option");
noLegacyOption.value = "";
noLegacyOption.textContent = "Не переносить старые данные";
legacySelect.append(noLegacyOption);
legacyLabel.append(legacySelect);

const submit = document.createElement("button");
submit.type = "submit";
submit.className = "gt-account-submit";
submit.textContent = "Войти";
const modeToggle = document.createElement("button");
modeToggle.type = "button";
modeToggle.className = "gt-account-link";
modeToggle.textContent = "Создать аккаунт";
const legacyLogin = document.createElement("button");
legacyLogin.type = "button";
legacyLogin.className = "gt-account-link";
legacyLogin.textContent = "Сначала войти в старый профиль";
const signOut = document.createElement("button");
signOut.type = "button";
signOut.className = "gt-account-link";
signOut.textContent = "Выйти из общего аккаунта";
signOut.hidden = true;
const close = document.createElement("button");
close.type = "button";
close.className = "gt-account-link";
close.textContent = "Закрыть";

form.append(emailLabel, passwordLabel, nameLabel, legacyLabel, submit, modeToggle, legacyLogin);
dialog.append(title, description, message, form, signOut, close);
document.body.append(dialog);

const style = document.createElement("style");
style.textContent = `
  .gt-account-widget{position:fixed;right:14px;bottom:14px;z-index:10000;padding:10px 14px;border:1px solid #5b8def;border-radius:10px;color:#fff;background:#315db5;font:600 14px system-ui,sans-serif;cursor:pointer}
  .gt-account-widget.is-error{border-color:#e87982;background:#902e3a}
  .gt-account-dialog{width:min(420px,calc(100vw - 28px));max-height:90vh;padding:24px;border:1px solid #394150;border-radius:14px;color:#eef1f7;background:#11151c;font:16px/1.5 system-ui,sans-serif}
  .gt-account-dialog::backdrop{background:rgba(0,0,0,.7)}
  .gt-account-dialog h2{margin:0 0 8px;font-size:1.35em}
  .gt-account-dialog p{margin:0 0 14px;color:#abb3c2}
  .gt-account-dialog .gt-account-message.is-error{color:#f2b5b5}
  .gt-account-form{display:grid;gap:12px}
  .gt-account-form label{display:grid;gap:5px;font-weight:600}
  .gt-account-form input,.gt-account-form select{min-height:44px;padding:8px 10px;border:1px solid #394150;border-radius:8px;color:#fff;background:#0b0e13;font:inherit}
  .gt-account-submit{min-height:44px;border:0;border-radius:8px;color:#fff;background:#4778d5;font:inherit;font-weight:700;cursor:pointer}
  .gt-account-link{padding:7px 0;border:0;color:#a8c1f5;background:none;font:inherit;text-align:left;cursor:pointer}
  .gt-account-dialog button:focus-visible,.gt-account-widget:focus-visible{outline:3px solid #fff;outline-offset:3px}
`;
document.head.append(style);

let client;
let sessionUser;
let mode = "login";
let callback;
let lastIssue = "";
const legacyLoginBox = window.loginBox;
const legacySyncUser = window.syncUser;
const legacyPushPending = window.pushPending;

function setMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("is-error", isError);
}

function showIssue(text) {
  lastIssue = text;
  setMessage(text, true);
  widget.textContent = "Проблема синхронизации";
  widget.title = text;
  widget.classList.add("is-error");
}

function updateWidget() {
  if (lastIssue) {
    widget.textContent = "Проблема синхронизации";
    widget.title = lastIssue;
    widget.classList.add("is-error");
    return;
  }
  widget.textContent = sessionUser
    ? `Общий аккаунт: ${sessionUser.email || "подключён"}`
    : bridge.currentUser()
      ? "Привязать к личному кабинету"
      : "Войти по почте";
  widget.title = sessionUser
    ? "Настройки общего аккаунта"
    : bridge.currentUser()
      ? "Привязать профиль GeoTrainer к общему аккаунту nmchv"
      : "Войти с общим аккаунтом nmchv";
  widget.classList.remove("is-error");
}

function updateMode() {
  const registering = mode === "register";
  nameLabel.hidden = !registering;
  nameInput.required = registering;
  passwordInput.autocomplete = registering ? "new-password" : "current-password";
  submit.textContent = registering ? "Создать аккаунт" : "Войти";
  modeToggle.textContent = registering ? "Уже есть аккаунт? Войти" : "Создать аккаунт";
  description.textContent = registering
    ? "Создайте общий аккаунт. Если почта требует подтверждения, сначала подтвердите её."
    : "Войдите с почтой и паролем, которые используете в личном кабинете.";
}

function refreshLegacyOptions(preferredKey = "") {
  legacySelect.replaceChildren(noLegacyOption);
  for (const user of bridge.localUsers()) {
    const option = document.createElement("option");
    option.value = user.key;
    option.textContent = `${user.name} — ${user.count} попыток`;
    legacySelect.append(option);
  }
  if (preferredKey && [...legacySelect.options].some((option) => option.value === preferredKey)) {
    legacySelect.value = preferredKey;
  }
}

function openDialog(done, preferredKey = "") {
  callback = done;
  refreshLegacyOptions(preferredKey);
  setMessage(lastIssue, Boolean(lastIssue));
  form.hidden = Boolean(sessionUser);
  signOut.hidden = !sessionUser;
  if (sessionUser) {
    description.textContent = `Подключён аккаунт ${sessionUser.email || ""}.`;
  } else {
    mode = "login";
    updateMode();
  }
  dialog.showModal();
}

function userName(user) {
  return user.user_metadata?.display_name || user.email?.split("@")[0] || "Ученик";
}

function sourceId(attempt, legacyKey, index) {
  if (typeof attempt._accountSourceId === "string" && attempt._accountSourceId) {
    return attempt._accountSourceId;
  }
  attempt._accountSourceId = `geo:${legacyKey}:${attempt.ts || 0}:${attempt.id || "attempt"}:${index}`;
  return attempt._accountSourceId;
}

function attemptRow(userId, legacyUser, attempt, index) {
  const id = sourceId(attempt, legacyUser?.key || "new", index);
  const attemptData = { ...attempt, _accountSourceId: id };
  delete attemptData.pend;
  const timestamp = Number(attempt.ts);
  return {
    user_id: userId,
    source_id: id,
    legacy_username: legacyUser?.name || null,
    attempt_data: attemptData,
    created_at: Number.isFinite(timestamp) && timestamp > 0
      ? new Date(timestamp).toISOString()
      : new Date().toISOString()
  };
}

async function loadCloudAttempts(userId) {
  const { data, error } = await client.from("geotrainer_attempts")
    .select("source_id,attempt_data,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function connectAccount(user, legacyKey = "") {
  const legacyUser = legacyKey ? bridge.localUser(legacyKey) : null;
  if (legacyKey && !legacyUser) {
    throw new Error("Выбранный локальный профиль больше не найден. Обновите список и повторите.");
  }

  if (legacyUser?.attempts?.length) {
    const rows = legacyUser.attempts.map((attempt, index) => attemptRow(user.id, legacyUser, attempt, index));
    const { error } = await client.from("geotrainer_attempts")
      .upsert(rows, { onConflict: "user_id,source_id", ignoreDuplicates: true });
    if (error) throw error;
    bridge.saveStore();
  }

  const cloudRows = await loadCloudAttempts(user.id);
  const attempts = cloudRows.map((row) => ({
    ...row.attempt_data,
    _accountSourceId: row.source_id,
    pend: undefined
  }));
  const accountUser = {
    key: user.id,
    id: user.id,
    name: userName(user),
    email: user.email || "",
    attempts
  };
  bridge.setCurrentUser(accountUser);
  sessionUser = user;
  window.GT_ACCOUNT_USER_ID = user.id;
  lastIssue = "";
  updateWidget();
}

async function handleSubmit(event) {
  event.preventDefault();
  submit.disabled = true;
  setMessage("");
  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const legacyKey = legacySelect.value;
    let response;
    if (mode === "register") {
      response = await client.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: nameInput.value.trim() },
          emailRedirectTo: location.href
        }
      });
    } else {
      response = await client.auth.signInWithPassword({ email, password });
    }
    if (response.error) throw response.error;
    const user = response.data.session?.user;
    if (!user) {
      setMessage("Аккаунт создан. Подтвердите адрес в письме, затем войдите.");
      return;
    }
    await connectAccount(user, legacyKey);
    dialog.close();
    callback?.();
  } catch (error) {
    setMessage(error?.message || "Не удалось подключить общий аккаунт.", true);
  } finally {
    submit.disabled = false;
  }
}

async function signOutAccount() {
  if (!client || !sessionUser) return;
  signOut.disabled = true;
  setMessage("");
  try {
    const { error } = await client.auth.signOut();
    if (error) throw error;
    sessionUser = null;
    window.GT_ACCOUNT_USER_ID = null;
    bridge.setCurrentUser(null);
    updateWidget();
    dialog.close();
  } catch (error) {
    setMessage(error?.message || "Не удалось выйти из общего аккаунта.", true);
  } finally {
    signOut.disabled = false;
  }
}

form.addEventListener("submit", handleSubmit);
modeToggle.addEventListener("click", () => {
  mode = mode === "login" ? "register" : "login";
  setMessage("");
  updateMode();
});
signOut.addEventListener("click", signOutAccount);
close.addEventListener("click", () => dialog.close());
legacyLogin.addEventListener("click", () => {
  if (!legacyLoginBox) return setMessage("Вход в старый профиль недоступен.");
  dialog.close();
  legacyLoginBox(async () => {
    let warning = "";
    if (legacySyncUser && bridge.currentUser()) {
      try {
        if (!await legacySyncUser()) warning = "Старую историю из Supabase получить не удалось.";
      } catch {
        warning = "Старую историю из Supabase получить не удалось; будут доступны только данные на этом устройстве.";
      }
    }
    const key = bridge.currentUser()?.key || "";
    openDialog(callback, key);
    if (warning) setMessage(warning, true);
  });
});
widget.addEventListener("click", () => openDialog(undefined, bridge.currentUser()?.key || ""));
window.addEventListener("gt-auth", updateWidget);

window.loginBox = (done, pre) => {
  if (sessionUser) {
    done?.();
    return;
  }
  if (legacyLoginBox) {
    legacyLoginBox(done, pre);
    return;
  }
  openDialog(done, bridge.currentUser()?.key || "");
};
const legacyLogout = window.logout;
window.logout = (...args) => sessionUser
  ? signOutAccount()
  : legacyLogout?.apply(window, args);
window.syncUser = async (...args) => sessionUser
  ? true
  : legacySyncUser?.apply(window, args) ?? false;
window.pushPending = async (...args) => sessionUser
  ? true
  : legacyPushPending?.apply(window, args) ?? false;
if (typeof window.recordAttempt === "function") {
  const recordAttempt = window.recordAttempt;
  window.recordAttempt = function (...args) {
    const result = recordAttempt.apply(this, args);
    const user = bridge.currentUser();
    if (sessionUser && user?.attempts?.length) {
      const attempt = user.attempts.at(-1);
      const row = attemptRow(sessionUser.id, null, attempt, user.attempts.length - 1);
      client.from("geotrainer_attempts")
        .upsert(row, { onConflict: "user_id,source_id", ignoreDuplicates: true })
        .then(({ error }) => {
          if (error) showIssue(`Результат сохранён на устройстве, но не отправлен в аккаунт: ${error.message}`);
        });
    }
    return result;
  };
}

async function initialize() {
  window.GT_ACCOUNT_USER_ID = null;
  if (!config?.url || !config?.key) {
    widget.disabled = true;
    widget.textContent = "Общий аккаунт не настроен";
    return;
  }
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  client = createClient(config.url, config.key, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
  });
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (data.session?.user) {
    await connectAccount(data.session.user);
  } else {
    updateWidget();
  }
  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      sessionUser = null;
      window.GT_ACCOUNT_USER_ID = null;
      bridge.setCurrentUser(null);
      updateWidget();
    }
  });
}

initialize().catch((error) => {
  showIssue(error?.message || "Не удалось подключиться к Supabase.");
});
