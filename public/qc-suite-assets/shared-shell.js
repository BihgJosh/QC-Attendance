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
})();
