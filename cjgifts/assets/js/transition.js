(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('cj-loading');

  function showLoader(leaving = false) {
    let overlay = document.querySelector('.cj-loader');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'cj-loader';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-label', 'Loading CJ Gifts');
      overlay.innerHTML = '<span class="loader-status">Loading</span><span class="loader-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
      document.body.appendChild(overlay);
    }
    requestAnimationFrame(() => overlay.classList.add('visible'));
    if (leaving) overlay.classList.add('leaving');
    return overlay;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const overlay = showLoader();
    setTimeout(() => {
      overlay.classList.add('dismissed');
      document.documentElement.classList.remove('cj-loading');
      setTimeout(() => overlay.remove(), 240);
    }, reduced ? 60 : 90);
  }, { once: true });

  document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href]');
    if (!anchor || reduced || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (anchor.target || anchor.hasAttribute('download') || anchor.getAttribute('href').startsWith('#')) return;
    const destination = new URL(anchor.href, window.location.href);
    if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
    event.preventDefault();
    showLoader(true);
    setTimeout(() => { window.location.href = destination.href; }, 180);
  });
})();
