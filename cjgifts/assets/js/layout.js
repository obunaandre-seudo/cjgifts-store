/* ============================================================
   CJ GIFTS — SHARED LAYOUT (header / footer / utilities)
   ============================================================ */

function siteHeaderHTML(active) {
  const user = Auth.currentUser();
  const link = (href, label, key) => `<a href="${href}" class="${active===key?'active':''}">${label}</a>`;
  const theme = document.documentElement.dataset.theme;
  const themeLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  const themeIcon = theme === 'dark'
    ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
    : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.9 13.1A8.5 8.5 0 0 1 10.9 3.1 8.5 8.5 0 1 0 20.9 13.1Z"/></svg>';
  return `
  <header class="main-header">
    <div class="container top-row">
      <a href="index.html" class="logo"><span class="mark">CJ</span>CJ <span class="accent">Gifts</span></a>
      <form class="search-box" onsubmit="event.preventDefault(); if(this.q.value.trim()) window.location.href='shop.html?search='+encodeURIComponent(this.q.value);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input name="q" type="text" placeholder="Search gifts, watches, candles...">
        </form>
      <div class="header-actions">
        <button type="button" class="icon-btn theme-toggle" id="themeToggle" aria-label="${themeLabel}" title="${themeLabel}">${themeIcon}</button>
        <a href="${user ? 'account.html' : 'login.html'}" class="icon-btn" title="${user ? 'My Account' : 'Login'}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </a>
        <a href="cart.html" class="icon-btn" title="Cart">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <span class="cart-count" id="cartCount">0</span>
        </a>
        <div class="hamburger" onclick="document.getElementById('mobileNav').classList.add('open')">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  <div class="nav-bar"><div class="container">
    <nav class="main-nav">
        ${link('index.html','Home','home')}
        ${link('shop.html','Shop','shop')}
        ${link('gift-ideas.html','Gift Ideas','gift')}
        ${link('products-accessories.html','Products &amp; Accessories','products')}
        ${link('shop.html?offer=1','Special Offers','offers')}
        ${link('about.html','About','about')}
        ${link('contact.html','Contact','contact')}
      </nav>
  </div></div>
  </header>
  <div class="mobile-nav" id="mobileNav">
    <div class="close-mobile" onclick="document.getElementById('mobileNav').classList.remove('open')">&times;</div>
    <button type="button" class="mobile-theme-toggle theme-toggle" aria-label="${themeLabel}" title="${themeLabel}"><span class="theme-toggle-icon">${themeIcon}</span><span class="theme-toggle-label">${themeLabel}</span></button>
    <form onsubmit="event.preventDefault(); if(this.q.value.trim()) window.location.href='shop.html?search='+encodeURIComponent(this.q.value);" style="margin-bottom:20px;">
      <input name="q" type="search" placeholder="Search products..." style="width:100%;padding:12px 16px;border-radius:8px;border:none;">
    </form>
    <a href="index.html">Home</a>
    <a href="shop.html">Shop</a>
    <a href="gift-ideas.html">🎁 Gift Ideas</a>
    <a href="products-accessories.html">🛍️ Products &amp; Accessories</a>
    <a href="shop.html?offer=1">Special Offers</a>
    <a href="about.html">About</a>
    <a href="contact.html">Contact</a>
    <a href="${user ? 'account.html' : 'login.html'}">${user ? 'My Account' : 'Login / Register'}</a>
    <a href="cart.html">Cart (<span id="mobileCartCount">0</span>)</a>
  </div>`;
}

function siteFooterHTML() {
  return `
  <div class="footer-top">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a href="index.html" class="logo" style="margin-bottom:14px;"><span class="mark">CJ</span>CJ <span class="accent">Gifts</span></a>
        <p>A modern shopping destination for thoughtful gifts and everyday essentials — curated with care, delivered with pride.</p>
        <div class="social-row">
          <a href="#" title="Facebook">f</a>
          <a href="#" title="Instagram">ig</a>
          <a href="#" title="Twitter/X">x</a>
          <a href="#" title="Pinterest">p</a>
        </div>
      </div>
      <div>
        <h4>Shop</h4>
        <ul>
          <li><a href="shop.html">All Products</a></li>
          <li><a href="gift-ideas.html">Gift Ideas</a></li>
          <li><a href="products-accessories.html">Products &amp; Accessories</a></li>
          <li><a href="shop.html?offer=1">Special Offers</a></li>
        </ul>
      </div>
      <div>
        <h4>Company</h4>
          <li><a href="about.html">About Us</a></li>
          <li><a href="contact.html">Contact</a></li>
          <li><a href="account.html">My Account</a></li>
        </ul>
      </div>
      <div>
        <h4>Customer Care</h4>
        <ul>
          <li><a href="contact.html">Support Center</a></li>
          <li><a href="contact.html">Shipping Info</a></li>
          <li><a href="#" onclick="return false;">Privacy Policy</a></li>
          <li><a href="#" onclick="return false;">Terms &amp; Conditions</a></li>
        </ul>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <div class="container footer-bottom">
      <span>&copy; ${new Date().getFullYear()} CJ Gifts. All rights reserved.</span>
      <span><a href="#" onclick="return false;">Privacy</a><a href="#" onclick="return false;">Terms</a></span>
    </div>
  </div>`;
}

function renderLayout(active) {
  setTheme(getSavedTheme(), false);
  const h = document.getElementById('site-header');
  const f = document.getElementById('site-footer');
  if (h) h.innerHTML = siteHeaderHTML(active);
  if (f) f.innerHTML = siteFooterHTML();
  document.querySelectorAll('.theme-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  });
  updateCartCount();
  initLoveHearts();
}

function getSavedTheme() {
  try {
    return localStorage.getItem('cjgifts_theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function setTheme(theme, persist = true) {
  const selectedTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = selectedTheme;
  if (persist) {
    try {
      localStorage.setItem('cjgifts_theme', selectedTheme);
    } catch {}
  }

  document.querySelectorAll('.theme-toggle').forEach(toggle => {
    const isDark = selectedTheme === 'dark';
    const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    const icon = isDark
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.9 13.1A8.5 8.5 0 0 1 10.9 3.1 8.5 8.5 0 1 0 20.9 13.1Z"/></svg>';
    const iconWrapper = toggle.querySelector('.theme-toggle-icon');
    if (iconWrapper) iconWrapper.innerHTML = icon;
    else toggle.innerHTML = icon;
    const textLabel = toggle.querySelector('.theme-toggle-label');
    if (textLabel) textLabel.textContent = label;
  });
}

function initLoveHearts() {
  if (document.querySelector('.love-hearts')) return;
  const box = document.createElement('div');
  box.className = 'love-hearts';
  box.setAttribute('aria-hidden', 'true');
  const glyphs = ['\u2665', '\u2764', '\u2665', '\u2661', '\u2665', '\u2728'];
  for (let i = 0; i < 16; i++) {
    const h = document.createElement('span');
    h.textContent = glyphs[i % glyphs.length];
    h.style.cssText = `--x:${(i * 6.4 + (i % 3) * 3).toFixed(1)}%;--s:${14 + (i * 7) % 22}px;--d:${9 + (i * 5) % 9}s;--dl:${-(i * 1.7).toFixed(1)}s;--sw:${20 + (i * 11) % 40}px`;
    box.appendChild(h);
  }
  document.body.appendChild(box);
}

function updateCartCount() {
  const n = Cart.count();
  document.querySelectorAll('#cartCount, #mobileCartCount').forEach(el => el.textContent = n);
}

function showToast(message) {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'toast';
    toast.innerHTML = `<span class="tick">✓</span><span id="toastMsg"></span>`;
    document.body.appendChild(toast);
  }
  document.getElementById('toastMsg').textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 2600);
}

function initScrollReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach(e=>e.classList.add('in')); return; }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('in'); obs.unobserve(entry.target); }
    });
  }, { threshold: 0.12 });
  els.forEach(e => obs.observe(e));
}

document.addEventListener('DOMContentLoaded', initScrollReveal);
