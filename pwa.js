/* GeoTrainer PWA: регистрация service worker и подписка на push */

(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function (e) {
        console.warn('Service worker не зарегистрирован:', e);
      });
    });
  }

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  // Приложение открыто как установленное (с экрана «Домой» или из Dock)?
  window.isInstalledPWA = function () {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  };

  // Вызывать ТОЛЬКО по нажатию кнопки (требование iOS).
  // vapidPublicKey: публичный VAPID-ключ, см. INSTALL.md, шаг «Push».
  // Возвращает объект подписки, его нужно отправить на ваш сервер.
  window.enablePush = async function (vapidPublicKey) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Push не поддерживается. На iPhone сначала добавьте сайт на экран «Домой».');
    }
    var permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Разрешение на уведомления не выдано.');

    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });
    }
    return sub.toJSON();
  };
})();
