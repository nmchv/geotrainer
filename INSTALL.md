# GeoTrainer как приложение (PWA) для iPhone и Mac

## 1. Что положить в репозиторий

Скопируйте в **корень** репозитория `nmchv/geotrainer` (рядом с `index.html`):

```
manifest.webmanifest
sw.js
pwa.js
icons/icon-192.png
icons/icon-512.png
icons/icon-maskable-512.png
icons/apple-touch-icon.png
```

Через сайт GitHub: **Add file → Upload files**, перетащите файлы и папку `icons`, нажмите Commit.

## 2. Что вставить в index.html

Внутрь `<head>`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#0f172a">

<!-- iPhone / iPad / Mac Safari -->
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="GeoTrainer">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

Перед закрывающим `</body>`:

```html
<script src="/pwa.js"></script>
```

Если `viewport` в `<head>` уже есть, второй раз его добавлять не нужно, но добавьте `viewport-fit=cover`.

Если в приложении есть шапка у самого верха экрана, на iPhone её может закрыть «чёлка». Добавьте в CSS:
`padding-top: env(safe-area-inset-top);`

## 3. Проверка

1. Подождите минуту, пока GitHub Pages опубликует изменения (вкладка Actions).
2. Откройте https://www.geotrainer.nmchv.ru и проверьте, что открываются `/manifest.webmanifest` и `/sw.js`.
3. Сайт должен работать по HTTPS (без этого service worker не включится).

## 4. Установка

**iPhone / iPad (Safari):** кнопка «Поделиться» → «На экран “Домой”» → «Добавить».
Именно Safari: в Chrome для iOS установка работает иначе, а push на iPhone работает только у приложений, добавленных на экран «Домой».

**Mac (Safari 17+):** меню «Файл» → «Добавить в Dock…».
**Mac (Chrome):** иконка установки в адресной строке или меню ⋮ → «Установить GeoTrainer».

## 5. Как обновлять

Файлы из `PRECACHE` в `sw.js` кэшируются. Если вы изменили `maps*.js`, `tests.json` и т.п., приложение подхватит новую версию при следующем запуске (обновление идёт в фоне). Чтобы сбросить кэш у всех сразу, увеличьте номер в `const CACHE = 'geotrainer-v1'` до `v2`.
Если добавите новые файлы с картами, впишите их в список `PRECACHE`, иначе они не будут работать офлайн.

## 6. Push-уведомления

Клиентская часть уже готова (`sw.js` принимает push, `pwa.js` умеет подписывать). Но **GitHub Pages — статический хостинг и сам уведомления отправлять не может**. Нужен небольшой сервер или сервис, который:

1. хранит подписки пользователей,
2. отправляет push на эти подписки.

Что нужно знать про iOS:
- работает с iOS 16.4 и новее;
- только если сайт добавлен на экран «Домой» и открыт оттуда;
- разрешение запрашивается только по нажатию кнопки, например:

```html
<button id="push-btn">Включить уведомления</button>
<script>
  document.getElementById('push-btn').addEventListener('click', async () => {
    try {
      const sub = await enablePush('ВАШ_ПУБЛИЧНЫЙ_VAPID_КЛЮЧ');
      // отправьте sub на ваш сервер (fetch POST), чтобы сохранить подписку
      console.log(sub);
    } catch (e) { alert(e.message); }
  });
</script>
```

Ключи VAPID создаются одной командой: `npx web-push generate-vapid-keys`.
Публичный ключ идёт в `enablePush(...)`, приватный хранится только на сервере.

Варианты бэкенда:
- **Cloudflare Worker + KV** (бесплатно, свой код, полный контроль);
- **OneSignal** (готовый сервис с панелью отправки, меньше кода);
- **Firebase Cloud Messaging**.

Формат сообщения, которое понимает `sw.js`:
`{ "title": "Заголовок", "body": "Текст", "url": "/" }`
