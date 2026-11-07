/* ============================================================
   BPOINT GIFT STORE — SHARED LAYOUT (header / footer / utilities)
   ============================================================ */

function siteHeaderHTML(active) {
  const user = Auth.currentUser();
  const link = (href, label, key) => `<a href="${href}" class="${active===key?'active':''}">${label}</a>`;
  const theme = document.documentElement.dataset.theme;
  const themeLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  const themeIcon = theme === 'dark'
    ? '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
    : '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.9 13.1A8.5 8.5 0 0 1 10.9 3.1 8.5 8.5 0 1 0 20.9 13.1Z"/></svg>';
  const searchJs = "event.preventDefault(); if(this.q.value.trim()) window.location.href='shop.html?search='+encodeURIComponent(this.q.value);";
  return `
  <div class="announce">Gift-wrapped with care <span>◆</span> Secure bank transfer checkout</div>
  <header class="main-header">
    <div class="container top-row">
      <a href="index.html" class="logo" aria-label="BPoint Gift Store home"><img class="logo-image" src="assets/images/bpoint-logo.jpg" alt="" width="40" height="40">BPoint <span class="accent">Gifts</span></a>
      <nav class="main-nav" aria-label="Main">
        ${link('index.html','Home','home')}
        ${link('shop.html','Shop','shop')}
        ${link('gift-ideas.html','Gift Ideas','gift')}
        ${link('shop.html?offer=1','Offers','offers')}
        ${link('about.html','About','about')}
        ${link('contact.html','Contact','contact')}
      </nav>
      <div class="header-actions">
        <form class="search-box" role="search" onsubmit="${searchJs}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input name="q" type="search" placeholder="Search gifts" aria-label="Search gifts">
        </form>
        <button type="button" class="icon-btn theme-toggle" id="themeToggle" aria-label="${themeLabel}" title="${themeLabel}">${themeIcon}</button>
        <a href="${user ? 'account.html' : 'login.html'}" class="icon-btn" title="${user ? 'My Account' : 'Login'}" aria-label="${user ? 'My Account' : 'Login'}">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </a>
        <a href="cart.html" class="icon-btn" title="Cart" aria-label="Cart">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 7h12l1 13H5L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>
          <span class="cart-count" id="cartCount">0</span>
        </a>
        <div class="hamburger" role="button" aria-label="Open menu" tabindex="0" onclick="document.getElementById('mobileNav').classList.add('open')"><span></span><span></span><span></span></div>
      </div>
    </div>
  </header>
  <div class="mobile-nav" id="mobileNav">
    <div class="close-mobile" onclick="document.getElementById('mobileNav').classList.remove('open')">&times;</div>
    <button type="button" class="mobile-theme-toggle theme-toggle" aria-label="${themeLabel}" title="${themeLabel}"><span class="theme-toggle-icon">${themeIcon}</span><span class="theme-toggle-label">${themeLabel}</span></button>
    <form onsubmit="${searchJs}" style="margin-bottom:14px;">
      <input name="q" type="search" placeholder="Search gifts..." aria-label="Search gifts">
    </form>
    <a href="index.html">Home</a>
    <a href="shop.html">Shop</a>
    <a href="gift-ideas.html">Gift Ideas</a>
    <a href="shop.html?offer=1">Special Offers</a>
    <a href="about.html">About</a>
    <a href="contact.html">Contact</a>
    <a href="${user ? 'account.html' : 'login.html'}">${user ? 'My Account' : 'Login / Register'}</a>
    <a href="cart.html">Cart (<span id="mobileCartCount">0</span>)</a>
  </div>
  <a class="whatsapp-float" href="https://wa.me/27760260217?text=Hi%20BPoint%20Gifts%2C%20I%20need%20help%20with%20my%20order%20or%20payment." target="_blank" rel="noopener noreferrer" aria-label="Contact BPoint Gifts on WhatsApp">
    <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3.2A12.6 12.6 0 0 0 5.2 22.3L3.5 28.7l6.6-1.7A12.8 12.8 0 1 0 16 3.2Zm0 23.2c-1.9 0-3.8-.5-5.4-1.5l-.4-.2-3.9 1 1-3.8-.3-.4A10.4 10.4 0 1 1 16 26.4Zm5.7-7.8c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.5-1.6-.9-.8-1.6-1.8-1.8-2.1-.2-.3 0-.5.1-.7l.5-.6.3-.5c.1-.2 0-.4 0-.6-.1-.2-.7-1.7-1-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7s1.2 3.1 1.4 3.3c.2.2 2.3 3.6 5.6 5 .8.3 1.4.5 1.9.6.8.2 1.5.2 2.1.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.3-.6-.5Z"/></svg>
    <span>WhatsApp</span>
  </a>`;
}

function siteFooterHTML() {
  return `
  <div class="footer-top">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a href="index.html" class="logo"><img class="logo-image" src="assets/images/bpoint-logo.jpg" alt="" width="40" height="40">BPoint <span class="accent">Gifts</span></a>
        <p>Considered gifts for every occasion — curated with care, wrapped beautifully, delivered with pride.</p>
        <div class="social-row">
          <a href="#" title="Facebook" aria-label="Facebook">fb</a>
          <a href="#" title="Instagram" aria-label="Instagram">ig</a>
          <a href="#" title="X" aria-label="X">x</a>
          <a href="#" title="Pinterest" aria-label="Pinterest">pin</a>
        </div>
      </div>
      <div>
        <h4>Shop</h4>
        <ul>
          <li><a href="shop.html">All Gifts</a></li>
          <li><a href="gift-ideas.html">Gift Ideas</a></li>
          <li><a href="shop.html?offer=1">Special Offers</a></li>
        </ul>
      </div>
      <div>
        <h4>Company</h4>
        <ul>
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
      <span>&copy; ${new Date().getFullYear()} BPoint Gift Store. All rights reserved.</span>
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
}

function getSavedTheme() {
  try {
    return localStorage.getItem('bpoint_theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function setTheme(theme, persist = true) {
  const selectedTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = selectedTheme;
  if (persist) {
    try {
      localStorage.setItem('bpoint_theme', selectedTheme);
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
