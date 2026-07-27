/**
 * SOJ QC emergency watcher.
 * Polls while the app is open and renders a shared top-of-page alert strip.
 */
(function () {
  'use strict';

  var EMERGENCY_API_URL = 'https://script.google.com/macros/s/AKfycbzZJ5LEnQGUAC8ChcZ--oxUfUkJMYG8jg-IRUu2i_KcqFD6GByKk5ahTIrbMXz8sjDNMQ/exec';
  var POLL_INTERVAL_MS = 45000;
  var SINCE_KEY = 'soj-qc-emergency-since';
  var emergencyQueue = [];
  var currentIdx = 0;
  var autoAdvanceTimer = null;
  var pointerStartX = 0;
  var pointerDeltaX = 0;
  var pointerTracking = false;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function ensureStyles() {
    if (document.getElementById('soj-emg-style')) return;
    var style = document.createElement('style');
    style.id = 'soj-emg-style';
    style.textContent =
      '#soj-emg-alert-container{position:fixed;top:12px;left:12px;right:12px;z-index:99999;max-width:720px;margin:0 auto;' +
      'font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;touch-action:pan-y;user-select:none;' +
      'background:#FFF1DF;color:#442713;border:1px solid #F3B26B;border-left:5px solid #E97716;border-radius:14px;' +
      'box-shadow:0 12px 30px rgba(116,61,12,.18);overflow:hidden;cursor:pointer;transform:translateX(0);' +
      'transition:transform .2s ease,opacity .2s ease,box-shadow .2s ease}' +
      '#soj-emg-alert-container:focus-visible{outline:3px solid rgba(233,119,22,.35);outline-offset:3px}' +
      '#soj-emg-alert-container:hover{box-shadow:0 15px 34px rgba(116,61,12,.23)}' +
      '#soj-emg-alert-container .summary{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px 14px}' +
      '#soj-emg-alert-container .signal{width:36px;height:36px;border-radius:11px;background:#FFD7A8;display:grid;place-items:center;color:#A94808;font-size:18px;font-weight:900}' +
      '#soj-emg-alert-container .copy{min-width:0}' +
      '#soj-emg-alert-container .eyebrow{margin:0 0 2px;color:#A94808;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}' +
      '#soj-emg-alert-container .headline{margin:0;font-size:13.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#soj-emg-alert-container .open-hint{color:#9A5A22;font-size:11px;font-weight:800;white-space:nowrap}' +
      '#soj-emg-alert-container .detail{display:none;border-top:1px solid rgba(194,104,28,.2);padding:12px 14px 14px 62px}' +
      '#soj-emg-alert-container.is-open .detail{display:block}' +
      '#soj-emg-alert-container .description{margin:0 0 7px;font-size:13px;line-height:1.5;color:#5A3218;white-space:pre-wrap}' +
      '#soj-emg-alert-container .meta{margin:0;color:#8A5328;font-size:11.5px;font-weight:700}' +
      '#soj-emg-alert-container .controls{display:flex;gap:8px;align-items:center;margin-top:12px}' +
      '#soj-emg-alert-container button{border:1px solid rgba(169,72,8,.22);background:rgba(255,255,255,.58);color:#773B11;' +
      'border-radius:9px;padding:7px 11px;font:800 11.5px/1 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}' +
      '#soj-emg-alert-container button.dismiss{background:#C9570E;color:#fff;border-color:#C9570E}' +
      '#soj-emg-alert-container .swipe-note{margin-left:auto;color:#9A6A43;font-size:10.5px;font-weight:700}' +
      '#soj-emg-alert-container.is-entering{animation:soj-emg-drop .28s ease-out}' +
      '@keyframes soj-emg-drop{from{transform:translateY(-18px);opacity:0}to{transform:translateY(0);opacity:1}}' +
      '@media(max-width:520px){#soj-emg-alert-container .open-hint{display:none}#soj-emg-alert-container .detail{padding-left:14px}}' +
      '@media(prefers-reduced-motion:reduce){#soj-emg-alert-container{transition:none}#soj-emg-alert-container.is-entering{animation:none}}';
    document.head.appendChild(style);
  }

  function toggleDetails(container) {
    var isOpen = container.classList.toggle('is-open');
    container.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    var hint = container.querySelector('.open-hint');
    if (hint) hint.textContent = isOpen ? 'Tap to close' : 'Tap to open';
  }

  function removeCurrent(direction) {
    var container = document.getElementById('soj-emg-alert-container');
    if (!container || !emergencyQueue.length) return;
    container.style.transform = 'translateX(' + (direction < 0 ? '-110%' : '110%') + ')';
    container.style.opacity = '0';
    window.setTimeout(function () {
      emergencyQueue.splice(currentIdx, 1);
      if (currentIdx >= emergencyQueue.length) currentIdx = 0;
      renderCurrent();
      startAutoAdvance();
    }, 190);
  }

  function bindGestures(container) {
    container.addEventListener('pointerdown', function (event) {
      if (event.target.closest('button')) return;
      pointerTracking = true;
      pointerStartX = event.clientX;
      pointerDeltaX = 0;
      container.setPointerCapture(event.pointerId);
      container.style.transition = 'none';
    });
    container.addEventListener('pointermove', function (event) {
      if (!pointerTracking) return;
      pointerDeltaX = event.clientX - pointerStartX;
      container.style.transform = 'translateX(' + pointerDeltaX + 'px)';
      container.style.opacity = String(Math.max(.35, 1 - Math.abs(pointerDeltaX) / 320));
    });
    container.addEventListener('pointerup', function () {
      if (!pointerTracking) return;
      pointerTracking = false;
      container.style.transition = '';
      if (Math.abs(pointerDeltaX) >= 80) {
        removeCurrent(pointerDeltaX);
        return;
      }
      container.style.transform = '';
      container.style.opacity = '';
      if (Math.abs(pointerDeltaX) < 8) toggleDetails(container);
    });
    container.addEventListener('pointercancel', function () {
      pointerTracking = false;
      container.style.transition = '';
      container.style.transform = '';
      container.style.opacity = '';
    });
    container.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleDetails(container);
      }
      if (event.key === 'Escape') removeCurrent(1);
    });
  }

  function renderCurrent() {
    var container = document.getElementById('soj-emg-alert-container');
    if (!emergencyQueue.length) {
      if (container) container.remove();
      clearInterval(autoAdvanceTimer);
      autoAdvanceTimer = null;
      return;
    }
    ensureStyles();
    if (currentIdx >= emergencyQueue.length) currentIdx = 0;
    var em = emergencyQueue[currentIdx];
    var total = emergencyQueue.length;
    if (!container) {
      container = document.createElement('section');
      container.id = 'soj-emg-alert-container';
      container.tabIndex = 0;
      container.setAttribute('role', 'alert');
      document.body.appendChild(container);
      bindGestures(container);
    }
    container.className = 'is-entering';
    container.setAttribute('aria-expanded', 'false');
    container.style.transform = '';
    container.style.opacity = '';
    container.innerHTML =
      '<div class="summary">' +
        '<span class="signal" aria-hidden="true">!</span>' +
        '<div class="copy"><p class="eyebrow">Emergency alert' + (total > 1 ? ' · ' + (currentIdx + 1) + ' of ' + total : '') + '</p>' +
        '<p class="headline">' + esc(em.location) + '</p></div>' +
        '<span class="open-hint">Tap to open</span>' +
      '</div>' +
      '<div class="detail">' +
        '<p class="description">' + esc(em.description) + '</p>' +
        '<p class="meta">Reported by ' + esc(em.reportedBy) + '</p>' +
        '<div class="controls">' +
          (total > 1 ? '<button type="button" class="next">Next alert</button>' : '') +
          '<button type="button" class="dismiss">Dismiss</button>' +
          '<span class="swipe-note">Swipe to remove</span>' +
        '</div>' +
      '</div>';
    var nextButton = container.querySelector('.next');
    if (nextButton) nextButton.addEventListener('click', function (event) {
      event.stopPropagation();
      currentIdx = (currentIdx + 1) % emergencyQueue.length;
      renderCurrent();
      startAutoAdvance();
    });
    container.querySelector('.dismiss').addEventListener('click', function (event) {
      event.stopPropagation();
      removeCurrent(1);
    });
  }

  function startAutoAdvance() {
    clearInterval(autoAdvanceTimer);
    if (emergencyQueue.length <= 1) return;
    autoAdvanceTimer = setInterval(function () {
      var container = document.getElementById('soj-emg-alert-container');
      if (container && container.classList.contains('is-open')) return;
      currentIdx = (currentIdx + 1) % emergencyQueue.length;
      renderCurrent();
    }, 6000);
  }

  function addEmergencies(list) {
    if (!list || !list.length) return;
    list.forEach(function (em) { emergencyQueue.push(em); });
    renderCurrent();
    startAutoAdvance();
  }

  function showOsNotification(emergency) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var body = emergency.description + ' — reported by ' + emergency.reportedBy;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(function (registration) {
        registration.showNotification('Emergency — ' + emergency.location, {
          body: body,
          icon: '/qc-suite-assets/icons/icon-192.png',
          badge: '/qc-suite-assets/icons/icon-192.png',
          tag: 'soj-qc-emergency',
          requireInteraction: true,
        });
      });
    } else {
      new Notification('Emergency — ' + emergency.location, { body: body });
    }
  }

  function poll() {
    var since = localStorage.getItem(SINCE_KEY) || '0';
    fetch(EMERGENCY_API_URL + '?action=checkEmergency&since=' + since)
      .then(function (response) { return response.json(); })
      .then(function (result) {
        if (!result || !result.ok) return;
        if (result.emergencies && result.emergencies.length) {
          result.emergencies.forEach(showOsNotification);
          addEmergencies(result.emergencies);
        }
        localStorage.setItem(SINCE_KEY, String(result.serverNow || Date.now()));
      })
      .catch(function () {});
  }

  function primeBaseline() {
    if (localStorage.getItem(SINCE_KEY)) {
      poll();
      return;
    }
    fetch(EMERGENCY_API_URL + '?action=checkEmergency&since=0')
      .then(function (response) { return response.json(); })
      .then(function (result) {
        localStorage.setItem(SINCE_KEY, String((result && result.serverNow) || Date.now()));
      })
      .catch(function () {});
  }

  window.__qcuEmergencyAlerts = { add: addEmergencies };
  primeBaseline();
  setInterval(poll, POLL_INTERVAL_MS);
})();
