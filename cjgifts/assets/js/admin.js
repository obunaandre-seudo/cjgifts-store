/* ============================================================
   CJ GIFTS — ADMIN DASHBOARD LOGIC
   ============================================================ */

async function requireAdmin() {
  try {
    const response = await fetch('/api/admin/session', { credentials: 'same-origin' });
    if (response.ok) {
      await productsReady;
      return true;
    }
  } catch {}
  window.location.href = '../login.html';
  return false;
}

function adminSidebarHTML(active) {
  const link = (href, label, key, icon) =>
    `<a href="${href}" class="${active===key?'active':''}">${icon} ${label}</a>`;
  return `
    <div class="logo"><span class="mark">CJ</span>Admin</div>
    <nav>
      ${link('dashboard.html','Dashboard','dashboard','📊')}
      ${link('products.html','Products','products','🛍️')}
      ${link('add-product.html','Add Product','add-product','➕')}
      ${link('orders.html','Orders','orders','📦')}
      ${link('customers.html','Customers','customers','👥')}
    </nav>
    <div style="padding:20px 24px;margin-top:20px;border-top:1px solid rgba(255,255,255,.08);">
      <button class="btn btn-outline-gold btn-block btn-sm" style="color:var(--gold);border-color:var(--gold);" onclick="adminLogout()">Logout</button>
    </div>`;
}

function renderAdminShell(active) {
  const side = document.getElementById('adminSidebar');
  if (side) side.innerHTML = adminSidebarHTML(active);
  const toggle = document.getElementById('adminMenuToggle');
  if (toggle) toggle.addEventListener('click', () => side.classList.toggle('open'));
}

async function adminLogout() {
  try {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {}
  window.location.href = '../login.html';
}

function adminEscapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function orderItemsHTML(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) return '<span class="order-items-empty">Item details unavailable</span>';
  return `<ul class="order-item-list">${items.map(item => {
    const name = adminEscapeHTML(item.name || item.product?.name || 'Gift');
    const quantity = Number(item.quantity ?? item.qty ?? 1);
    return `<li><span>${name}</span><strong>×${Number.isFinite(quantity) ? quantity : 1}</strong></li>`;
  }).join('')}</ul>`;
}

async function refreshAdminProducts() {
  const response = await fetch('/api/admin/products', { credentials: 'same-origin' });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.message || 'Unable to load products.');
  Products.replace(result.products);
}

async function refreshAdminOrders() {
  const response = await fetch('/api/admin/orders', { credentials: 'same-origin' });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.message || 'Unable to load orders.');
  Orders.replace(result.orders);
}

async function refreshAdminCustomers() {
  const response = await fetch('/api/admin/customers', { credentials: 'same-origin' });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.message || 'Unable to load customers.');
  return result.customers;
}

function setAdminOrderRefreshMessage(message = '') {
  const notice = document.getElementById('adminOrderRefreshMessage');
  if (notice) {
    notice.textContent = message;
    notice.hidden = !message;
  }
}

function watchAdminOrders(onRefresh) {
  let refreshing = false;
  const refresh = async () => {
    if (refreshing || document.visibilityState === 'hidden') return;
    refreshing = true;
    try {
      await refreshAdminOrders();
      setAdminOrderRefreshMessage('');
      onRefresh();
    } catch (error) {
      setAdminOrderRefreshMessage(`Orders could not be refreshed: ${error.message || 'Please try again.'}`);
    } finally {
      refreshing = false;
    }
  };
  window.setInterval(refresh, 15000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
}

/* ---------- dashboard overview ---------- */
async function initAdminDashboard() {
  if (!await requireAdmin()) return;
  let initialOrderError = '';
  const orderRefresh = refreshAdminOrders().catch(error => { initialOrderError = error.message || 'Please try again.'; });
  await Promise.all([refreshAdminProducts(), orderRefresh]);
  renderAdminShell('dashboard');
  setAdminOrderRefreshMessage(initialOrderError ? `Orders could not be refreshed: ${initialOrderError}` : '');
  renderAdminDashboardOrders();
  watchAdminOrders(renderAdminDashboardOrders);
  const recentProducts = [...Products.all()].sort((a,b)=>b.createdAt-a.createdAt).slice(0,5);
  document.getElementById('recentProductsBody').innerHTML = recentProducts.length ? recentProducts.map(p => `
    <tr>
      <td><img src="${p.images[0]}" alt=""></td>
      <td><strong>${p.name}</strong><br><span style="font-size:12px;color:var(--gray-600);">${p.sku}</span></td>
      <td>${CATEGORIES.find(c=>c.id===p.category)?.name}</td>
      <td>${formatPrice(p.salePrice ?? p.price)}</td>
      <td>${p.stock}</td>
      <td><span class="badge ${p.published?'published':'draft'}">${p.published?'Published':'Draft'}</span></td>
    </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;color:var(--gray-600);padding:30px;">No products yet</td></tr>`;
}

function renderAdminDashboardOrders() {
  const products = Products.all();
  const orders = Orders.all();
  const customers = Auth.users();
  const revenue = orders.filter(o=>o.paymentStatus==='Paid' && o.paymentMode!=='test').reduce((s,o)=>s+o.total,0);
  const pending = orders.filter(o=>o.status==='Pending' || o.status === 'Processing').length;

  document.getElementById('statProducts').textContent = products.length;
  document.getElementById('statOrders').textContent = orders.length;
  document.getElementById('statCustomers').textContent = customers.length;
  document.getElementById('statRevenue').textContent = formatPrice(revenue);
  document.getElementById('statPending').textContent = pending;

  const recentOrders = orders.slice(0,5);
  document.getElementById('recentOrdersBody').innerHTML = recentOrders.length ? recentOrders.map(o => `
    <tr>
      <td><strong>${o.orderNumber}</strong></td>
      <td>${o.customer.name}</td>
      <td>${orderItemsHTML(o)}</td>
      <td>${new Date(o.createdAt).toLocaleDateString()}</td>
      <td>${formatPrice(o.total)}</td>
      <td><span class="badge ${o.status.toLowerCase()}">${o.status}</span></td>
    </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;color:var(--gray-600);padding:30px;">No orders yet</td></tr>`;

}

/* ---------- products list ---------- */
async function initAdminProductsPage() {
  if (!await requireAdmin()) return;
  await refreshAdminProducts();
  renderAdminShell('products');
  renderAdminProductsTable();
  document.getElementById('adminProductSearch').addEventListener('input', renderAdminProductsTable);
  document.getElementById('adminCategoryFilter').addEventListener('change', renderAdminProductsTable);
}

function renderAdminProductsTable() {
  const q = (document.getElementById('adminProductSearch')?.value || '').toLowerCase();
  const cat = document.getElementById('adminCategoryFilter')?.value || '';
  let list = Products.all();
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  if (cat) list = list.filter(p => p.category === cat);
  list.sort((a,b)=>b.createdAt-a.createdAt);

  const body = document.getElementById('adminProductsBody');
  body.innerHTML = list.length ? list.map(p => `
    <tr>
      <td><img src="${p.images[0]}" alt=""></td>
      <td><strong>${p.name}</strong><br><span style="font-size:12px;color:var(--gray-600);">${p.sku}</span></td>
      <td>${CATEGORIES.find(c=>c.id===p.category)?.name}</td>
      <td>${p.salePrice ? `<s style="color:var(--gray-400);">${formatPrice(p.price)}</s> ${formatPrice(p.salePrice)}` : formatPrice(p.price)}</td>
      <td>${p.stock}</td>
      <td><span class="badge ${p.published?'published':'draft'}">${p.published?'Published':'Draft'}</span></td>
      <td class="table-actions">
        <a href="add-product.html?id=${p.id}">Edit</a>
        <button class="del" onclick="deleteAdminProduct('${p.id}')">Delete</button>
      </td>
    </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;color:var(--gray-600);padding:30px;">No products found</td></tr>`;
}

async function deleteAdminProduct(id) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  try {
    const response = await fetch(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Unable to archive product.');
    await refreshAdminProducts();
    renderAdminProductsTable();
    showToast('Product archived');
  } catch (error) {
    showToast(error.message || 'Unable to archive product.');
  }
}

/* ---------- add/edit product ---------- */
let ADMIN_IMAGES = [];
let ADMIN_VARIANTS = [];

async function initAdminAddProductPage() {
  if (!await requireAdmin()) return;
  await refreshAdminProducts();
  renderAdminShell('add-product');

  const id = getQueryParam('id');
  const editing = !!id;
  const existing = editing ? Products.byId(id) : null;
  document.getElementById('formTitle').textContent = editing ? 'Edit Product' : 'Add New Product';

  ADMIN_IMAGES = existing ? [...existing.images] : [];
  ADMIN_VARIANTS = existing ? existing.variants.map(v => ({
    name: v.name, type: v.type, options: v.options.map(o=>({...o}))
  })) : [];

  if (existing) {
    document.getElementById('fName').value = existing.name;
    document.getElementById('fShortDesc').value = existing.shortDescription;
    document.getElementById('fDesc').value = existing.description;
    document.getElementById('fSku').value = existing.sku;
    document.getElementById('fPrice').value = existing.price;
    document.getElementById('fSalePrice').value = existing.salePrice || '';
    document.getElementById('fStock').value = existing.stock;
    document.getElementById('fCategory').value = existing.category;
    document.getElementById('fFeatured').checked = existing.featured;
    document.getElementById('fOffer').checked = existing.specialOffer;
    document.getElementById('fPublished').checked = existing.published;
  } else {
    document.getElementById('fPublished').checked = true;
    document.getElementById('fSku').value = 'CJG-' + Math.floor(1000+Math.random()*9000);
  }

  renderImagePreviews();
  renderVariantRows();

  document.getElementById('imageUploadZone').addEventListener('click', () => document.getElementById('imageFileInput').click());
  document.getElementById('imageFileInput').addEventListener('change', handleImageUpload);
  document.getElementById('addVariantBtn').addEventListener('click', () => {
    ADMIN_VARIANTS.push({ name:'', type:'text', options:[{label:''}] });
    renderVariantRows();
  });

  document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveProductForm(id, existing);
  });
}

function handleImageUpload(e) {
  const files = Array.from(e.target.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (ev) => { ADMIN_IMAGES.push(ev.target.result); renderImagePreviews(); };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
}
function renderImagePreviews() {
  const el = document.getElementById('imagePreviewGrid');
  if (!ADMIN_IMAGES.length) { el.innerHTML = `<span style="font-size:13px;color:var(--gray-600);">No images uploaded yet — a placeholder image will be used.</span>`; return; }
  el.innerHTML = ADMIN_IMAGES.map((src,i) => `
    <div class="img-item">
      <img src="${src}">
      <div class="rm" onclick="removeAdminImage(${i})">&times;</div>
      ${i===0?'<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(161,13,44,.8);color:#fff;font-size:9.5px;text-align:center;padding:2px;">PRIMARY</div>':''}
    </div>`).join('');
}
function removeAdminImage(i) { ADMIN_IMAGES.splice(i,1); renderImagePreviews(); }

function renderVariantRows() {
  const el = document.getElementById('variantsWrap');
  if (!ADMIN_VARIANTS.length) { el.innerHTML = `<p style="font-size:13px;color:var(--gray-600);">No variants added. This product will be sold as a simple item.</p>`; return; }
  el.innerHTML = ADMIN_VARIANTS.map((v,vi) => `
    <div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:8px;padding:14px;margin-bottom:12px;">
      <div class="variant-row">
        <input placeholder="Variant name (e.g. Color, Size)" value="${v.name}" oninput="ADMIN_VARIANTS[${vi}].name=this.value">
        <button type="button" class="del" style="color:var(--danger);font-size:13px;" onclick="removeVariant(${vi})">Remove</button>
      </div>
      ${v.options.map((o,oi) => `
        <div class="variant-row">
          <input placeholder="Option (e.g. Navy)" value="${o.label}" oninput="ADMIN_VARIANTS[${vi}].options[${oi}].label=this.value">
          <button type="button" class="del" style="color:var(--danger);font-size:13px;" onclick="removeVariantOption(${vi},${oi})">&times;</button>
        </div>`).join('')}
      <button type="button" class="btn btn-outline btn-sm" onclick="addVariantOption(${vi})">+ Add Option</button>
    </div>`).join('');
}
function removeVariant(vi) { ADMIN_VARIANTS.splice(vi,1); renderVariantRows(); }
function addVariantOption(vi) { ADMIN_VARIANTS[vi].options.push({label:''}); renderVariantRows(); }
function removeVariantOption(vi,oi) { ADMIN_VARIANTS[vi].options.splice(oi,1); renderVariantRows(); }

async function saveProductForm(id, existing) {
  const name = document.getElementById('fName').value.trim();
  const price = parseFloat(document.getElementById('fPrice').value);
  if (!name || isNaN(price)) { showToast('Please fill in the required fields'); return; }

  const salePriceRaw = document.getElementById('fSalePrice').value;
  const product = {
    id,
    sku: document.getElementById('fSku').value.trim(),
    name,
    shortDescription: document.getElementById('fShortDesc').value.trim(),
    description: document.getElementById('fDesc').value.trim(),
    price,
    salePrice: salePriceRaw ? parseFloat(salePriceRaw) : null,
    stock: parseInt(document.getElementById('fStock').value) || 0,
    category: document.getElementById('fCategory').value,
    featured: document.getElementById('fFeatured').checked,
    specialOffer: document.getElementById('fOffer').checked,
    published: document.getElementById('fPublished').checked,
    images: ADMIN_IMAGES.length ? ADMIN_IMAGES : [img(slugify(name)||'product')],
    variants: ADMIN_VARIANTS.filter(v => v.name && v.options.some(o=>o.label)).map(v => ({
      ...v, options: v.options.filter(o=>o.label)
    })),
    createdAt: existing ? existing.createdAt : Date.now()
  };
  try {
    const response = await fetch(id ? `/api/admin/products/${encodeURIComponent(id)}` : '/api/admin/products', {
      method: id ? 'PUT' : 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Unable to save product.');
    await refreshAdminProducts();
    showToast(existing ? 'Product updated successfully' : 'Product published successfully');
    setTimeout(() => window.location.href = 'products.html', 700);
  } catch (error) {
    showToast(error.message || 'Unable to save product.');
  }
}

/* ---------- admin orders ---------- */
async function initAdminOrdersPage() {
  if (!await requireAdmin()) return;
  let initialOrderError = '';
  try { await refreshAdminOrders(); }
  catch (error) { initialOrderError = error.message || 'Please try again.'; }
  renderAdminShell('orders');
  setAdminOrderRefreshMessage(initialOrderError ? `Orders could not be refreshed: ${initialOrderError}` : '');
  renderAdminOrdersTable();
  watchAdminOrders(renderAdminOrdersTable);
  document.getElementById('adminOrderSearch').addEventListener('input', renderAdminOrdersTable);
  document.getElementById('adminOrderStatusFilter').addEventListener('change', renderAdminOrdersTable);
}
function renderAdminOrdersTable() {
  const q = (document.getElementById('adminOrderSearch')?.value || '').toLowerCase();
  const status = document.getElementById('adminOrderStatusFilter')?.value || '';
  let list = Orders.all();
  if (q) list = list.filter(o => o.orderNumber.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q) || o.customer.email.toLowerCase().includes(q));
  if (status) list = list.filter(o => o.status === status);

  const statuses = ['Pending','Processing','Preparing','Shipped','Delivered','Cancelled'];
  const body = document.getElementById('adminOrdersBody');
  body.innerHTML = list.length ? list.map(o => {
    const canFulfill = o.paymentStatus === 'Paid' && o.paymentMode !== 'test';
    return `
    <tr>
      <td><strong>${o.orderNumber}</strong></td>
      <td>${o.customer.name}<br><span style="font-size:12px;color:var(--gray-600);">${o.customer.email}</span></td>
      <td>${orderItemsHTML(o)}</td>
      <td>${formatPrice(o.total)}</td>
      <td><span class="badge paid">${o.paymentMode==='test'?`Test - ${o.paymentStatus}`:o.paymentStatus}</span></td>
      <td>
        <select onchange="updateOrderStatus('${o.id}', this.value)" style="padding:6px 10px;border-radius:6px;border:1px solid var(--gray-200);font-size:12.5px;">
          ${statuses.map(s => `<option value="${s}" ${o.status===s?'selected':''} ${s!=='Cancelled'&&!canFulfill?'disabled':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td>${new Date(o.createdAt).toLocaleDateString()}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="7" style="text-align:center;color:var(--gray-600);padding:30px;">No orders found</td></tr>`;
}
async function updateOrderStatus(id, status) {
  try {
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.message || 'Unable to update order status.');
    await refreshAdminOrders();
    showToast('Order status updated');
    renderAdminOrdersTable();
  } catch (error) {
    await refreshAdminOrders().catch(() => {});
    renderAdminOrdersTable();
    showToast(error.message || 'Unable to update order status.');
  }
}

/* ---------- admin customers ---------- */
async function initAdminCustomersPage() {
  if (!await requireAdmin()) return;
  renderAdminShell('customers');
  await renderAdminCustomersTable();
  document.getElementById('adminCustomerSearch').addEventListener('input', renderAdminCustomersTable);
}
async function renderAdminCustomersTable() {
  const q = (document.getElementById('adminCustomerSearch')?.value || '').toLowerCase();
  let list;
  try { list = await refreshAdminCustomers(); }
  catch (error) {
    document.getElementById('adminCustomersBody').innerHTML = `<tr><td colspan="7">${adminEscapeHTML(error.message || 'Unable to load customers.')}</td></tr>`;
    return;
  }
  if (q) list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));

  const body = document.getElementById('adminCustomersBody');
  body.innerHTML = list.length ? list.map(u => {
    const address = u.address || {};
    const addressText = [address.line1, address.city, address.state, address.postal, address.country]
      .filter(Boolean).map(adminEscapeHTML).join(', ');
    return `
    <tr>
      <td><strong>${adminEscapeHTML(u.name)}</strong></td>
      <td>${adminEscapeHTML(u.email)}</td>
      <td>${u.phone || '—'}</td>
      <td>${addressText || '—'}</td>
      <td>${u.orderCount}</td>
      <td>${formatPrice(u.totalSpent)}</td>
      <td>${new Date(u.createdAt).toLocaleDateString()}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="7" style="text-align:center;color:var(--gray-600);padding:30px;">No customers yet</td></tr>`;
}
