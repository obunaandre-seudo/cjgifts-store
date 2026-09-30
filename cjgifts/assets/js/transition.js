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
      overlay.innerHTML = `<div class="loader-orbit orbit-one"></div><div class="loader-orbit orbit-two"></div><div class="loader-box"><span class="loader-ribbon"></span><span class="loader-bow">\u2726</span></div><div class="loader-brand"><span>CJ</span> GIFTS</div><div class="loader-caption">A little joy is on its way</div><div class="loader-progress"><i></i></div>`;
      document.body.appendChild(overlay);
    }
    requestAnimationFrame(() => overlay.classList.add('visible'));
    if (leaving) overlay.classList.add('leaving');
    return overlay;
  }

  document.addEventListener('DOMContentLoaded', () => {
    showLoader();
    const started = performance.now();
    const finish = () => setTimeout(() => {
      const overlay = document.querySelector('.cj-loader');
      if (overlay) overlay.classList.add('dismissed');
      document.documentElement.classList.remove('cj-loading');
      setTimeout(() => overlay?.remove(), 700);
    }, Math.max(0, (reduced ? 100 : 900) - (performance.now() - started)));
    if (document.readyState === 'complete') finish();
    else window.addEventListener('load', finish, { once: true });
  }, { once: true });

  document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href]');
    if (!anchor || reduced || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (anchor.target || anchor.hasAttribute('download') || anchor.getAttribute('href').startsWith('#')) return;
    const destination = new URL(anchor.href, window.location.href);
    if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
    event.preventDefault();
    showLoader(true);
    setTimeout(() => { window.location.href = destination.href; }, 280);
  });
})();
