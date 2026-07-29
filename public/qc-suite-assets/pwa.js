(function () {
  'use strict';

  var DISMISS_KEY = 'qcu-install-prompt-dismissed-until';
  var DISMISS_DAYS = 7;
  var deferredPrompt = null;

  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) return;
  if (Number(localStorage.getItem(DISMISS_KEY) || 0) > Date.now()) return;

  function dismiss(banner) {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000));
    banner.remove();
  }

  function showPrompt(isIOS) {
    if (document.getElementById('qcu-install-prompt')) return;
    var style = document.createElement('style');
    style.textContent =
      '#qcu-install-prompt{position:fixed;z-index:9999;left:12px;right:12px;bottom:12px;max-width:560px;margin:auto;display:flex;align-items:center;gap:12px;padding:16px;border:1px solid rgba(255,255,255,.15);border-radius:22px;background:rgba(7,18,37,.96);color:#fff;box-shadow:0 24px 70px rgba(3,8,24,.48);backdrop-filter:blur(18px);font-family:inherit}' +
      '#qcu-install-prompt:before{content:"";position:absolute;inset:0 auto 0 0;width:4px;border-radius:22px 0 0 22px;background:linear-gradient(#22d3ee,#3b82f6,#d946ef)}' +
      '#qcu-install-prompt .qcu-pwa-icon{display:grid;place-items:center;flex:0 0 44px;height:44px;border-radius:16px;background:linear-gradient(135deg,#22d3ee,#3b82f6 52%,#c026d3);font-size:20px}' +
      '#qcu-install-prompt .qcu-pwa-copy{min-width:0;flex:1}#qcu-install-prompt strong{display:block;font-size:15px;letter-spacing:-.01em}' +
      '#qcu-install-prompt p{margin:3px 0 0;color:#cbd5e1;font-size:12px;line-height:1.45}' +
      '#qcu-install-prompt button{border:0;cursor:pointer;font:700 13px inherit}' +
      '#qcu-install-prompt .qcu-pwa-install{padding:9px 14px;border-radius:12px;color:white;background:linear-gradient(135deg,#38bdf8,#7c3aed 60%,#c026d3)}' +
      '#qcu-install-prompt .qcu-pwa-close{display:grid;place-items:center;width:36px;height:36px;padding:0;border-radius:12px;color:#94a3b8;background:transparent;font-size:18px}' +
      '#qcu-install-prompt .qcu-pwa-close:hover{color:#fff;background:rgba(255,255,255,.1)}' +
      '@media(max-width:440px){#qcu-install-prompt{gap:9px;padding:14px}#qcu-install-prompt .qcu-pwa-icon{flex-basis:40px;height:40px}#qcu-install-prompt p{font-size:11px}}';
    document.head.appendChild(style);

    var banner = document.createElement('aside');
    banner.id = 'qcu-install-prompt';
    banner.setAttribute('aria-label', 'Install QC unit app');
    banner.innerHTML =
      '<div class="qcu-pwa-icon" aria-hidden="true">' + (isIOS ? '&#8679;' : '&#8595;') + '</div>' +
      '<div class="qcu-pwa-copy"><strong>Install QC unit app</strong><p>' +
      (isIOS ? 'Tap <b>Share</b>, then choose <b>Add to Home Screen</b>.' : 'Open attendance, postings and service tools from your home screen.') +
      '</p></div>' +
      (isIOS ? '' : '<button class="qcu-pwa-install" type="button">Install</button>') +
      '<button class="qcu-pwa-close" type="button" aria-label="Dismiss install prompt">&times;</button>';
    document.body.appendChild(banner);

    banner.querySelector('.qcu-pwa-close').addEventListener('click', function () { dismiss(banner); });
    var installButton = banner.querySelector('.qcu-pwa-install');
    if (installButton) {
      installButton.addEventListener('click', function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (choice) {
          if (choice.outcome === 'accepted') banner.remove();
          deferredPrompt = null;
        });
      });
    }
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    showPrompt(false);
  });
  window.addEventListener('appinstalled', function () {
    var banner = document.getElementById('qcu-install-prompt');
    if (banner) banner.remove();
    localStorage.removeItem(DISMISS_KEY);
  });

  var isIOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
  var isSafari = /Safari/.test(window.navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(window.navigator.userAgent);
  if (isIOS && isSafari) showPrompt(true);
})();
