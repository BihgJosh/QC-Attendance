(function () {
  'use strict';

  var links = [
    { label: 'Home', href: '/' },
    { label: 'QC Tools', href: '/service-tools' },
    { label: 'Service Post', href: '/qc-tools/post-report' },
    { label: 'Timer', href: '/qc-tools/timer' },
    { label: 'Observer', href: '/qc-tools/observer' },
    { label: 'Emergency', href: '/qc-tools/emergency', emergency: true },
    { label: 'Manager', href: '/qc-tools/dashboard' }
  ];

  function isActive(href) {
    if (href === '/') return window.location.pathname === '/';
    return window.location.pathname === href || window.location.pathname.indexOf(href) === 0;
  }

  var header = document.createElement('header');
  header.className = 'qc-suite-nav';
  header.innerHTML =
    '<nav class="qc-suite-nav__inner" aria-label="QC tools navigation">' +
      '<a class="qc-suite-brand" href="/" aria-label="Go to homepage">' +
        '<img src="/soja-logo.jpeg" alt="" width="42" height="42">' +
        '<span><strong>Quality Control Unit</strong><small>Service tools</small></span>' +
      '</a>' +
      '<div class="qc-suite-links">' + links.map(function (link) {
        return '<a href="' + link.href + '"' +
          (isActive(link.href) ? ' aria-current="page"' : '') +
          (link.emergency ? ' data-emergency="true"' : '') + '>' + link.label + '</a>';
      }).join('') + '</div>' +
      '<select class="qc-suite-mobile" aria-label="Choose a QC tool">' + links.map(function (link) {
        return '<option value="' + link.href + '"' + (isActive(link.href) ? ' selected' : '') + '>' + link.label + '</option>';
      }).join('') + '</select>' +
    '</nav>';

  document.body.insertBefore(header, document.body.firstChild);
  header.querySelector('.qc-suite-mobile').addEventListener('change', function (event) {
    window.location.href = event.target.value;
  });

  function associateLabels(root) {
    root.querySelectorAll('label:not([for])').forEach(function (label) {
      var control = label.nextElementSibling;
      if (control && /^(INPUT|SELECT|TEXTAREA)$/.test(control.tagName) && control.id) {
        label.setAttribute('for', control.id);
      }
    });
  }

  associateLabels(document);
  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) associateLabels(node);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });

  var resultLastFocus = null;
  var resultRetryAction = null;
  var resultRoot = document.createElement('div');
  resultRoot.className = 'submission-result';
  resultRoot.setAttribute('data-open', 'false');
  resultRoot.setAttribute('data-status', 'success');
  resultRoot.innerHTML =
    '<section class="submission-result__dialog" role="dialog" aria-modal="true" aria-labelledby="submission-result-title" aria-describedby="submission-result-message">' +
      '<div class="submission-result__icon" aria-hidden="true"></div>' +
      '<h2 class="submission-result__title" id="submission-result-title" tabindex="-1"></h2>' +
      '<p class="submission-result__message" id="submission-result-message"></p>' +
      '<p class="submission-result__note"></p>' +
      '<div class="submission-result__actions"></div>' +
    '</section>';
  document.body.appendChild(resultRoot);

  function closeSubmissionResult() {
    resultRoot.setAttribute('data-open', 'false');
    resultRetryAction = null;
    document.body.style.overflow = '';
    if (resultLastFocus && document.contains(resultLastFocus)) resultLastFocus.focus();
  }

  function submissionIcon(status) {
    return status === 'success'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6 9 17l-5-5"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 9v4m0 4h.01"/><circle cx="12" cy="12" r="9"/></svg>';
  }

  function showSubmissionResult(options) {
    var status = options.status === 'error' ? 'error' : 'success';
    resultLastFocus = document.activeElement;
    resultRetryAction = typeof options.onRetry === 'function' ? options.onRetry : null;
    resultRoot.setAttribute('data-status', status);
    resultRoot.querySelector('.submission-result__icon').innerHTML = submissionIcon(status);
    resultRoot.querySelector('.submission-result__title').textContent = options.title || (status === 'success' ? 'Report submitted' : 'Submission failed');
    resultRoot.querySelector('.submission-result__message').textContent = options.message || (status === 'success' ? 'Your report has been saved successfully.' : 'Your report could not be saved.');
    resultRoot.querySelector('.submission-result__note').textContent = status === 'success'
      ? 'Your submission is complete. Please avoid sending the same report twice.'
      : 'Your entries are still here. Check your connection, then retry when ready.';
    resultRoot.querySelector('.submission-result__actions').innerHTML = status === 'success'
      ? '<a class="submission-result__action" href="/service-tools">Back to Service Tools</a><button class="submission-result__action submission-result__action--secondary" type="button" data-result-action="another">Submit another report</button>'
      : '<button class="submission-result__action" type="button" data-result-action="retry">Retry submission</button><button class="submission-result__action submission-result__action--secondary" type="button" data-result-action="review">Review form</button>';
    resultRoot.setAttribute('data-open', 'true');
    document.body.style.overflow = 'hidden';
    resultRoot.querySelector('.submission-result__title').focus();
  }

  resultRoot.addEventListener('click', function (event) {
    var action = event.target.closest('[data-result-action]');
    if (!action) return;
    if (action.getAttribute('data-result-action') === 'retry' && resultRetryAction) {
      var retry = resultRetryAction;
      closeSubmissionResult();
      retry();
      return;
    }
    if (action.getAttribute('data-result-action') === 'another') {
      window.location.reload();
      return;
    }
    closeSubmissionResult();
  });

  resultRoot.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeSubmissionResult();
    if (event.key !== 'Tab') return;
    var controls = Array.from(resultRoot.querySelectorAll('a[href], button:not([disabled])'));
    if (!controls.length) return;
    var first = controls[0];
    var last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  window.QCSubmissionResult = { show: showSubmissionResult, close: closeSubmissionResult };
})();
