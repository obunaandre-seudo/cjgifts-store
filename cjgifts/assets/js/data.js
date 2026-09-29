/* ============================================================
   CJ GIFTS — DATA LAYER
   Uses browser localStorage as the "database".
   All products are seeded once, then everything (add/edit/delete
   product, orders, customers, cart) happens through the admin
   dashboard / customer flows just like a real backend would.
   ============================================================ */

const DB_KEYS = {
  PRODUCTS: 'cjgifts_products',
  CART: 'cjgifts_cart',
  USERS: 'cjgifts_users',
  CURRENT_USER: 'cjgifts_current_user',
  ORDERS: 'cjgifts_orders',
  ADMIN: 'cjgifts_admin',
  ADMIN_SESSION: 'cjgifts_admin_session',
  WISHLIST: 'cjgifts_wishlist',
  SEEDED: 'cjgifts_seeded_v2'
};

const CATEGORIES = [
  { id: 'gift-ideas', name: 'Gift Ideas', slug: 'gift-ideas', icon: '🎁' },
  { id: 'products-accessories', name: 'Products & Accessories', slug: 'products-and-accessories', icon: '🛍️' }
];

function img(seed, w = 700, h = 700) {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

const SEED_PRODUCTS = [
  {
    id: 'p1', sku: 'CJG-GD-001', name: 'Luxury Watch Gift Set', category: 'gift-ideas',
    price: 189.99, salePrice: 149.99, stock: 24, featured: true, specialOffer: true, published: true,
    shortDescription: 'An elegant timepiece presented in a premium gift box.',
    description: 'This luxury watch gift set pairs a refined stainless-steel timepiece with a leather strap, presented in a navy-and-gold keepsake box. A timeless gift for birthdays, anniversaries, or graduations — thoughtfully packaged and ready to give.',
    images: [img('watch1'), img('watch2'), img('watch3')],
    variants: [{ name: 'Strap Color', type: 'swatch', options: [
      { label: 'Navy', value: '#0a1638' }, { label: 'Gold', value: '#d4af37' }, { label: 'Black', value: '#1a1a1a' }
    ]}],
    createdAt: Date.now() - 86400000 * 2
  },
  {
    id: 'p2', sku: 'CJG-GD-002', name: 'Scented Candle Collection', category: 'gift-ideas',
    price: 54.0, salePrice: null, stock: 60, featured: true, specialOffer: false, published: true,
    shortDescription: 'A set of three hand-poured candles in warm seasonal scents.',
    description: 'Three hand-poured soy candles — Amber Oak, Vanilla Bourbon, and Spiced Fig — housed in matte gold tins. Burns cleanly for up to 45 hours each, making this a cozy, thoughtful gift for any occasion.',
    images: [img('candle1'), img('candle2')],
    variants: [], createdAt: Date.now() - 86400000 * 10
  },
  {
    id: 'p3', sku: 'CJG-GD-003', name: 'Personalized Photo Frame', category: 'gift-ideas',
    price: 39.99, salePrice: 29.99, stock: 40, featured: false, specialOffer: true, published: true,
    shortDescription: 'Engraved wooden frame that turns a favorite photo into a keepsake.',
    description: 'A solid oak photo frame with an engraved gold nameplate, designed to hold a 5x7 photo. Each order can be custom engraved with a name or short message — perfect for weddings, new babies, or milestone gifts.',
    images: [img('frame1'), img('frame2')],
    variants: [{ name: 'Size', type: 'text', options: [{label:'5x7'},{label:'8x10'}]}],
    createdAt: Date.now() - 86400000 * 5
  },
  {
    id: 'p4', sku: 'CJG-GD-004', name: 'Gourmet Chocolate Hamper', category: 'gift-ideas',
    price: 64.5, salePrice: null, stock: 35, featured: true, specialOffer: false, published: true,
    shortDescription: 'A curated hamper of Belgian chocolates and artisan treats.',
    description: 'A generously packed hamper featuring Belgian truffles, dark chocolate bark, honey-roasted nuts, and shortbread biscuits, wrapped in a navy ribbon gift box. Ready to ship directly to the recipient with a personalized card.',
    images: [img('choc1'), img('choc2')],
    variants: [], createdAt: Date.now() - 86400000 * 1
  },
  {
    id: 'p5', sku: 'CJG-GD-005', name: 'Leather Journal & Pen Set', category: 'gift-ideas',
    price: 47.0, salePrice: 39.0, stock: 50, featured: false, specialOffer: true, published: true,
    shortDescription: 'A refillable leather journal paired with a brass fountain pen.',
    description: 'Genuine leather refillable journal with 200 lined pages, paired with a brass fountain pen in a matching gift sleeve. A distinguished gift for writers, students, and professionals alike.',
    images: [img('journal1'), img('journal2')],
    variants: [{ name: 'Color', type: 'swatch', options: [
      { label: 'Cognac', value: '#8a5a2b' }, { label: 'Black', value: '#1a1a1a' }
    ]}], createdAt: Date.now() - 86400000 * 7
  },
  {
    id: 'p6', sku: 'CJG-GD-006', name: 'Gold-Plated Jewelry Box', category: 'gift-ideas',
    price: 82.0, salePrice: null, stock: 18, featured: false, specialOffer: false, published: true,
    shortDescription: 'A velvet-lined jewelry box with gold-plated hardware.',
    description: 'A velvet-lined jewelry box featuring gold-plated hinges and a mirrored interior, with two tiers for rings, earrings, and necklaces. An elegant gift that becomes a lasting keepsake on any vanity.',
    images: [img('jewel1'), img('jewel2')],
    variants: [], createdAt: Date.now() - 86400000 * 15
  },
  {
    id: 'p7', sku: 'CJG-PA-001', name: 'Wireless Bluetooth Earbuds', category: 'products-accessories',
    price: 79.99, salePrice: 59.99, stock: 75, featured: true, specialOffer: true, published: true,
    shortDescription: 'True wireless earbuds with active noise cancellation.',
    description: 'Premium true-wireless earbuds featuring active noise cancellation, 28-hour total battery life with the charging case, and a secure, comfortable fit. Includes a USB-C charging cable and three ear-tip sizes.',
    images: [img('earbuds1'), img('earbuds2'), img('earbuds3')],
    variants: [{ name: 'Color', type: 'swatch', options: [
      { label: 'Midnight Navy', value: '#0a1638' }, { label: 'Gold', value: '#d4af37' }, { label: 'White', value: '#f4f4f4' }
    ]}], createdAt: Date.now() - 86400000 * 3
  },
  {
    id: 'p8', sku: 'CJG-PA-002', name: 'Classic Leather Wallet', category: 'products-accessories',
    price: 45.0, salePrice: null, stock: 90, featured: false, specialOffer: false, published: true,
    shortDescription: 'Slim bifold wallet crafted from full-grain leather.',
    description: 'A slim bifold wallet made from full-grain leather with six card slots, a bill compartment, and a subtle gold foil emboss. Ages beautifully with use.',
    images: [img('wallet1'), img('wallet2')],
    variants: [{ name: 'Color', type: 'swatch', options: [
      { label: 'Brown', value: '#5a3921' }, { label: 'Black', value: '#1a1a1a' }
    ]}], createdAt: Date.now() - 86400000 * 20
  },
  {
    id: 'p9', sku: 'CJG-PA-003', name: 'Classic Aviator Sunglasses', category: 'products-accessories',
    price: 58.0, salePrice: 42.0, stock: 55, featured: true, specialOffer: true, published: true,
    shortDescription: 'Polarized aviator sunglasses with gold-tone frames.',
    description: 'Polarized UV400 lenses set in lightweight gold-tone metal frames. A timeless silhouette that suits every face shape, delivered in a protective hard case.',
    images: [img('sunglass1'), img('sunglass2')],
    variants: [], createdAt: Date.now() - 86400000 * 4
  },
  {
    id: 'p10', sku: 'CJG-PA-004', name: 'Smart Fitness Band', category: 'products-accessories',
    price: 69.99, salePrice: null, stock: 4, featured: false, specialOffer: false, published: true,
    shortDescription: 'Track steps, heart rate, and sleep with a slim smart band.',
    description: 'A slim, lightweight fitness tracker with heart-rate monitoring, sleep tracking, and a 10-day battery life. Water-resistant and compatible with iOS and Android.',
    images: [img('fitband1'), img('fitband2')],
    variants: [{ name: 'Band Color', type: 'swatch', options: [
      { label: 'Black', value: '#1a1a1a' }, { label: 'Navy', value: '#0a1638' }, { label: 'Rose', value: '#c98a8a' }
    ]}], createdAt: Date.now() - 86400000 * 8
  },
  {
    id: 'p11', sku: 'CJG-PA-005', name: 'Premium Canvas Backpack', category: 'products-accessories',
    price: 95.0, salePrice: 74.0, stock: 30, featured: true, specialOffer: true, published: true,
    shortDescription: 'Water-resistant canvas backpack with a padded laptop sleeve.',
    description: 'A water-resistant waxed-canvas backpack with leather trims, a padded 15" laptop sleeve, and a spacious main compartment. Built for daily commutes and weekend trips alike.',
    images: [img('backpack1'), img('backpack2')],
    variants: [], createdAt: Date.now() - 86400000 * 6
  },
  {
    id: 'p12', sku: 'CJG-PA-006', name: 'Stainless Steel Water Bottle', category: 'products-accessories',
    price: 28.0, salePrice: null, stock: 0, featured: false, specialOffer: false, published: true,
    shortDescription: 'Double-wall insulated bottle that keeps drinks cold for 24 hours.',
    description: 'A double-wall vacuum-insulated stainless-steel bottle that keeps drinks cold for 24 hours or hot for 12. Leakproof lid and a brushed matte finish.',
    images: [img('bottle1'), img('bottle2')],
    variants: [{ name: 'Color', type: 'swatch', options: [
      { label: 'Navy', value: '#0a1638' }, { label: 'Gold', value: '#d4af37' }, { label: 'Silver', value: '#c8c8c8' }
    ]}], createdAt: Date.now() - 86400000 * 30
  }
];

/* ---------------- core storage helpers ---------------- */
function dbGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function dbSet(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function seedDatabase() {
  if (!dbGet(DB_KEYS.SEEDED, false)) {
    dbSet(DB_KEYS.PRODUCTS, SEED_PRODUCTS);
    dbSet(DB_KEYS.USERS, []);
    dbSet(DB_KEYS.ORDERS, []);
    dbSet(DB_KEYS.CART, []);
    dbSet(DB_KEYS.WISHLIST, []);
    dbSet(DB_KEYS.ADMIN, { username: 'admin', password: btoa('admin123'), name: 'Store Admin' });
    dbSet(DB_KEYS.SEEDED, true);
  }
  if (!dbGet(DB_KEYS.PRODUCTS)) dbSet(DB_KEYS.PRODUCTS, SEED_PRODUCTS);
}
seedDatabase();

/* ---------------- product helpers ---------------- */
const Products = {
  all() { return dbGet(DB_KEYS.PRODUCTS, []); },
  published() { return this.all().filter(p => p.published); },
  byId(id) { return this.all().find(p => p.id === id); },
  byCategory(cat) { return this.published().filter(p => p.category === cat); },
  featured() { return this.published().filter(p => p.featured); },
  specialOffers() { return this.published().filter(p => p.specialOffer); },
  newArrivals(n = 8) { return [...this.published()].sort((a,b)=>b.createdAt-a.createdAt).slice(0,n); },
  save(product) {
    const list = this.all();
    const idx = list.findIndex(p => p.id === product.id);
    if (idx >= 0) list[idx] = product; else list.unshift(product);
    dbSet(DB_KEYS.PRODUCTS, list);
  },
  remove(id) {
    dbSet(DB_KEYS.PRODUCTS, this.all().filter(p => p.id !== id));
  },
  search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return this.published();
    return this.published().filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description||'').toLowerCase().includes(q) ||
      (p.shortDescription||'').toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
    );
  },
  related(product, n = 4) {
    return this.published().filter(p => p.category === product.category && p.id !== product.id).slice(0, n);
  },
  newId() { return 'p' + Date.now(); }
};

/* ---------------- cart helpers ---------------- */
const Cart = {
  items() { return dbGet(DB_KEYS.CART, []); },
  save(items) { dbSet(DB_KEYS.CART, items); },
  count() { return this.items().reduce((s,i)=>s+i.qty,0); },
  add(productId, variant, qty) {
    const items = this.items();
    const key = productId + '|' + (variant || '');
    const existing = items.find(i => (i.productId+'|'+(i.variant||'')) === key);
    if (existing) existing.qty += qty;
    else items.push({ productId, variant: variant || null, qty });
    this.save(items);
  },
  updateQty(productId, variant, qty) {
    let items = this.items();
    const key = productId + '|' + (variant || '');
    items = items.map(i => (i.productId+'|'+(i.variant||'')) === key ? {...i, qty} : i);
    items = items.filter(i => i.qty > 0);
    this.save(items);
  },
  remove(productId, variant) {
    const key = productId + '|' + (variant || '');
    this.save(this.items().filter(i => (i.productId+'|'+(i.variant||'')) !== key));
  },
  clear() { this.save([]); },
  detailed() {
    return this.items().map(i => {
      const p = Products.byId(i.productId);
      if (!p) return null;
      const unit = p.salePrice ?? p.price;
      return { ...i, product: p, unitPrice: unit, lineTotal: unit * i.qty };
    }).filter(Boolean);
  },
  subtotal() { return this.detailed().reduce((s,i)=>s+i.lineTotal,0); },
  discount() {
    return this.detailed().reduce((s,i)=> s + (i.product.salePrice ? (i.product.price - i.product.salePrice) * i.qty : 0), 0);
  }
};

/* ---------------- users / auth ---------------- */
const Auth = {
  users() { return dbGet(DB_KEYS.USERS, []); },
  register(name, email, password) {
    const users = this.users();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { ok: false, error: 'An account with this email already exists.' };
    }
    const user = { id: 'u' + Date.now(), name, email, password: btoa(password), createdAt: Date.now(),
      address: {}, phone: '' };
    users.push(user);
    dbSet(DB_KEYS.USERS, users);
    dbSet(DB_KEYS.CURRENT_USER, user.id);
    return { ok: true, user };
  },
  login(email, password) {
    const user = this.users().find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === btoa(password));
    if (!user) return { ok: false, error: 'Invalid email or password.' };
    dbSet(DB_KEYS.CURRENT_USER, user.id);
    return { ok: true, user };
  },
  logout() { localStorage.removeItem(DB_KEYS.CURRENT_USER); },
  currentUser() {
    const id = dbGet(DB_KEYS.CURRENT_USER, null);
    if (!id) return null;
    return this.users().find(u => u.id === id) || null;
  },
  updateUser(id, patch) {
    const users = this.users().map(u => u.id === id ? {...u, ...patch} : u);
    dbSet(DB_KEYS.USERS, users);
  }
};

/* ---------------- admin auth ---------------- */
const AdminAuth = {
  info() { return dbGet(DB_KEYS.ADMIN, { username: 'admin', password: btoa('admin123') }); },
  login(username, password) {
    const info = this.info();
    if (info.username === username && info.password === btoa(password)) {
      dbSet(DB_KEYS.ADMIN_SESSION, true);
      return true;
    }
    return false;
  },
  isLoggedIn() { return dbGet(DB_KEYS.ADMIN_SESSION, false); },
  logout() { localStorage.removeItem(DB_KEYS.ADMIN_SESSION); }
};

/* ---------------- orders ---------------- */
const Orders = {
  all() { return dbGet(DB_KEYS.ORDERS, []); },
  byUser(userId) { return this.all().filter(o => o.userId === userId).sort((a,b)=>b.createdAt-a.createdAt); },
  byId(id) { return this.all().find(o => o.id === id); },
  create(order) {
    const orders = this.all();
    orders.unshift(order);
    dbSet(DB_KEYS.ORDERS, orders);
  },
  updateStatus(id, status) {
    const orders = this.all().map(o => o.id === id ? {...o, status, updatedAt: Date.now()} : o);
    dbSet(DB_KEYS.ORDERS, orders);
  },
  newOrderNumber() {
    return 'CJG-' + Math.floor(100000 + Math.random()*900000);
  }
};

/* ---------------- wishlist ---------------- */
const Wishlist = {
  items() { return dbGet(DB_KEYS.WISHLIST, []); },
  toggle(productId) {
    let items = this.items();
    if (items.includes(productId)) items = items.filter(i => i !== productId);
    else items.push(productId);
    dbSet(DB_KEYS.WISHLIST, items);
    return items.includes(productId);
  },
  has(productId) { return this.items().includes(productId); }
};

function formatPrice(n) {
  return '$' + Number(n).toFixed(2);
}
function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
}
