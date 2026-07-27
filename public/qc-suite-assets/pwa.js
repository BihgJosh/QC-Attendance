/**
 * SOJ QC — PWA install prompt + service worker registration.
 * Included on every page via <script src="/pwa.js" defer></script>.
 * Self-contained: injects its own styles, so it works the same regardless
 * of which page's own CSS is loaded alongside it.
 */
(function () {
  'use strict';

  // ---------- Register service worker ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/qc-suite-assets/service-worker.js', { scope: '/qc-tools/' }).catch(function () {});
    });
  }

  // ---------- Skip entirely if already installed/running standalone ----------
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true; // iOS Safari
  }
  if (isStandalone()) return;

  // ---------- Respect a recent "Not Now" dismissal ----------
  var DISMISS_KEY = 'soj-qc-install-dismissed-until';
  function isDismissed() {
    var until = localStorage.getItem(DISMISS_KEY);
    return until && Date.now() < Number(until);
  }
  function dismissFor(days) {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + days * 24 * 60 * 60 * 1000));
  }
  if (isDismissed()) return;

  // ---------- Shared styles for the banner ----------
  var style = document.createElement('style');
  style.textContent =
    '#soj-pwa-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;' +
    'max-width:480px;margin:0 auto;background:rgba(2,12,32,0.96);color:#fff;backdrop-filter:blur(16px);' +
    'border:1.5px solid rgba(103,232,249,0.2);border-radius:18px;' +
    'box-shadow:0 14px 40px rgba(2,12,32,0.3);padding:16px 16px 16px 14px;' +
    'font-family:-apple-system,Inter,"Segoe UI",sans-serif;display:flex;gap:12px;align-items:flex-start;' +
    'animation:soj-pwa-in .35s ease;}' +
    '@keyframes soj-pwa-in{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}' +
    '#soj-pwa-banner .soj-pwa-icon{width:42px;height:42px;border-radius:12px;flex-shrink:0;' +
    'background:linear-gradient(135deg,#0891B2,#2563EB 48%,#A21CAF);display:flex;align-items:center;justify-content:center;' +
    'box-shadow:0 6px 16px rgba(120,90,255,0.3);}' +
    '#soj-pwa-banner .soj-pwa-icon svg{width:22px;height:22px;}' +
    '#soj-pwa-banner .soj-pwa-body{flex:1;min-width:0;}' +
    '#soj-pwa-banner .soj-pwa-title{font-size:14px;font-weight:800;color:#fff;margin:0 0 2px;}' +
    '#soj-pwa-banner .soj-pwa-desc{font-size:12.5px;color:rgba(255,255,255,.62);line-height:1.4;margin:0 0 10px;}' +
    '#soj-pwa-banner .soj-pwa-actions{display:flex;gap:8px;}' +
    '#soj-pwa-banner button{border:none;border-radius:10px;font-size:12.5px;font-weight:700;' +
    'padding:8px 14px;cursor:pointer;font-family:inherit;}' +
    '#soj-pwa-banner .soj-pwa-install{background:linear-gradient(135deg,#22D3EE,#60A5FA 48%,#C146E8);color:#071225;' +
    'box-shadow:0 6px 16px rgba(120,90,255,0.28);}' +
    '#soj-pwa-banner .soj-pwa-dismiss{background:rgba(255,255,255,.08);color:rgba(255,255,255,.72);border:1.5px solid rgba(255,255,255,.12) !important;}' +
    '#soj-pwa-banner .soj-pwa-close{position:absolute;top:10px;right:12px;background:none !important;' +
    'color:#A6A0C4;font-size:16px;padding:2px 6px !important;line-height:1;}' +
    '@media (min-width:640px){#soj-pwa-banner{left:auto;right:24px;bottom:24px;width:380px;}}';
  document.head.appendChild(style);

  var DIAMOND_SVG = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10L12 2Z" fill="#fff"/></svg>';

  function buildBanner(innerHtml) {
    var el = document.createElement('div');
    el.id = 'soj-pwa-banner';
    el.style.position = 'fixed';
    el.innerHTML = innerHtml;
    document.body.appendChild(el);
    return el;
  }

  // ---------- Android / Chrome / Edge: beforeinstallprompt ----------
  var deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    showAndroidBanner();
  });

  function showAndroidBanner() {
    if (document.getElementById('soj-pwa-banner')) return;
    var banner = buildBanner(
      '<div class="soj-pwa-icon">' + DIAMOND_SVG + '</div>' +
      '<div class="soj-pwa-body">' +
        '<p class="soj-pwa-title">Install the QC app</p>' +
        '<p class="soj-pwa-desc">Add this to your home screen for quick, one-tap access on service days.</p>' +
        '<div class="soj-pwa-actions">' +
          '<button class="soj-pwa-install">Install App</button>' +
          '<button class="soj-pwa-dismiss">Not Now</button>' +
        '</div>' +
      '</div>' +
      '<button class="soj-pwa-close" aria-label="Close">✕</button>'
    );

    banner.querySelector('.soj-pwa-install').addEventListener('click', function () {
      banner.remove();
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () { deferredPrompt = null; });
    });
    banner.querySelector('.soj-pwa-dismiss').addEventListener('click', function () {
      dismissFor(7);
      banner.remove();
    });
    banner.querySelector('.soj-pwa-close').addEventListener('click', function () {
      dismissFor(7);
      banner.remove();
    });
  }

  window.addEventListener('appinstalled', function () {
    var b = document.getElementById('soj-pwa-banner');
    if (b) b.remove();
    deferredPrompt = null;
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 365 * 24 * 60 * 60 * 1000));
  });

  // ---------- iOS Safari: no beforeinstallprompt, show instructions instead ----------
  function isIosSafari() {
    var ua = window.navigator.userAgent;
    var isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    var isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return isIos && isSafari;
  }

  function showIosBanner() {
    if (document.getElementById('soj-pwa-banner')) return;
    var banner = buildBanner(
      '<div class="soj-pwa-icon">' + DIAMOND_SVG + '</div>' +
      '<div class="soj-pwa-body">' +
        '<p class="soj-pwa-title">Install the QC app</p>' +
        '<p class="soj-pwa-desc">Tap the <strong>Share</strong> button ' +
          '<span style="display:inline-block;transform:translateY(2px);">⬆️</span> below, ' +
          'then choose <strong>"Add to Home Screen."</strong></p>' +
        '<div class="soj-pwa-actions">' +
          '<button class="soj-pwa-dismiss">Got it</button>' +
        '</div>' +
      '</div>' +
      '<button class="soj-pwa-close" aria-label="Close">✕</button>'
    );
    banner.querySelector('.soj-pwa-dismiss').addEventListener('click', function () {
      dismissFor(7);
      banner.remove();
    });
    banner.querySelector('.soj-pwa-close').addEventListener('click', function () {
      dismissFor(7);
      banner.remove();
    });
  }

  if (isIosSafari()) {
    // Slight delay so it doesn't compete with the page's own load/render.
    setTimeout(showIosBanner, 1500);
  }
})();
