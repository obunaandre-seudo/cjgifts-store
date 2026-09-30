import 'dotenv/config';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import { readStore, writeStore, buildOrderNumber } from './src/lib/store.js';
import { prisma } from './src/lib/prisma.js';
import { orderSchema, calculateOrderTotal, getShippingFee, validateCart, verifyPaystackReference, canTransitionStatus, PAYMENT_STATUSES } from './src/lib/validation.js';

const app = express();
const PORT = Number(process.env.PORT || 3001);
const ROOT_DIR = process.cwd();
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_placeholder';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 86400000);
const ADMIN_SESSION_COOKIE = 'cjgifts_admin_session';
const CUSTOMER_SESSION_COOKIE = 'cjgifts_customer_session';

app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '2mb', verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

function errorResponse(res, status, message, details) {
  const payload = { ok: false, message };
  if (details) payload.details = details;
  return res.status(status).json(payload);
}

function serializeProduct(product) {
  return {
    ...product,
    category: product.category === 'products-accessories' ? 'gift-ideas' : product.category,
    price: Number(product.price),
    salePrice: product.salePrice === null ? null : Number(product.salePrice),
    createdAt: product.createdAt.getTime(),
    updatedAt: product.updatedAt.getTime()
  };
}

function parseProductInput(body = {}) {
  const name = String(body.name || '').trim();
  const sku = String(body.sku || '').trim();
  const slug = String(body.slug || name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const price = Number(body.price);
  const salePrice = body.salePrice === null || body.salePrice === '' || body.salePrice === undefined ? null : Number(body.salePrice);
  const stock = Number(body.stock);
  const images = Array.isArray(body.images) ? body.images.filter((image) => typeof image === 'string' && image.length > 0) : [];
  const categories = new Set(['gift-ideas']);

  if (!name || !sku || !slug || !categories.has(body.category) || !Number.isFinite(price) || price < 0 ||
      (salePrice !== null && (!Number.isFinite(salePrice) || salePrice < 0)) || !Number.isInteger(stock) || stock < 0 || images.length === 0) {
    return null;
  }

  return {
    name,
    sku,
    slug,
    shortDescription: String(body.shortDescription || ''),
    description: String(body.description || ''),
    price,
    salePrice,
    stock,
    category: body.category,
    featured: Boolean(body.featured),
    specialOffer: Boolean(body.specialOffer),
    published: Boolean(body.published),
    images,
    variants: Array.isArray(body.variants) ? body.variants : []
  };
}

function readAdminCookie(req) {
  const prefix = `${ADMIN_SESSION_COOKIE}=`;
  const entry = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : null;
}

function setAdminCookie(req, res, token, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1' || req.headers['x-forwarded-proto'] === 'https';
  const secureFlag = secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${ADMIN_SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}${secureFlag}`);
}

function clearAdminCookie(req, res) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1' || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', `${ADMIN_SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure ? '; Secure' : ''}`);
}

function serializeOrder(order) {
  const delivery = {
    country: order.deliveryCountry,
    city: order.deliveryCity,
    region: order.deliveryRegion || '',
    street: order.deliveryStreet,
    apartment: order.deliveryApartment || '',
    postalCode: order.deliveryPostalCode || '',
    instructions: order.notes || ''
  };
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    accessToken: order.accessToken,
    customer: { name: order.customer.name, email: order.customer.email, phone: order.customer.phone || '' },
    recipient: { name: order.customer.name, phone: order.customer.phone || '' },
    delivery,
    shippingAddress: { address: delivery.street, city: delivery.city, state: delivery.region, country: delivery.country, postal: delivery.postalCode },
    items: (order.items || []).map((item) => ({
      productId: item.productId,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      qty: item.quantity,
      unitPrice: Number(item.unitPrice),
      price: Number(item.unitPrice)
    })),
    subtotal: Number(order.subtotal),
    discount: 0,
    shipping: Number(order.shippingFee),
    shippingFee: Number(order.shippingFee),
    tax: Number(order.tax),
    total: Number(order.total),
    currency: order.currency,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    status: order.fulfillmentStatus,
    statusHistory: order.statusHistory || [],
    createdAt: order.createdAt.getTime(),
    updatedAt: order.updatedAt.getTime()
  };
}

class OrderRequestError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function readCustomerCookie(req) {
  const prefix = `${CUSTOMER_SESSION_COOKIE}=`;
  const entry = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : null;
}

function setCustomerCookie(req, res, token, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1' || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', `${CUSTOMER_SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`);
}

function clearCustomerCookie(req, res) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1' || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', `${CUSTOMER_SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure ? '; Secure' : ''}`);
}

function publicCustomer(customer) {
  return { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone || '', address: customer.address || {} };
}

async function getCustomerSession(req) {
  const token = readCustomerCookie(req);
  if (!token) return null;
  const session = await prisma.customerSession.findUnique({ where: { tokenHash: hashSessionToken(token) }, include: { customer: true } });
  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.customerSession.delete({ where: { id: session.id } });
    return null;
  }
  return session;
}

async function requireCustomer(req, res, next) {
  try {
    const session = await getCustomerSession(req);
    if (!session) return errorResponse(res, 401, 'Customer sign-in required.');
    req.customer = session.customer;
    return next();
  } catch (error) {
    return next(error);
  }
}

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function getAdminSession(req) {
  const token = readAdminCookie(req);
  if (!token) return null;

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { admin: true }
  });

  if (!session || session.expiresAt <= new Date() || session.admin.role !== 'admin') {
    if (session) await prisma.adminSession.delete({ where: { id: session.id } });
    return null;
  }

  return session;
}

async function requireAdmin(req, res, next) {
  try {
    const session = await getAdminSession(req);
    if (!session) return errorResponse(res, 401, 'Admin authentication required.');
    req.admin = session.admin;
    req.adminSession = session;
    return next();
  } catch (error) {
    return next(error);
  }
}

async function ensureConfiguredAdmin() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) return null;

  let admin = await prisma.adminUser.findUnique({ where: { email } });
  const passwordMatches = admin && await bcrypt.compare(password, admin.passwordHash);
  if (!admin || !passwordMatches) {
    const passwordHash = await bcrypt.hash(password, 12);
    if (!admin) {
      admin = await prisma.adminUser.create({ data: { email, passwordHash, role: 'admin' } });
    } else {
      await prisma.adminSession.deleteMany({ where: { adminId: admin.id } });
      admin = await prisma.adminUser.update({ where: { id: admin.id }, data: { passwordHash } });
    }
  }

  return admin;
}

app.use('/admin', async (req, res, next) => {
  if (req.path === '/login.html') return res.redirect('/login.html');
  if (!req.path.endsWith('.html')) return next();
  try {
    if (!(await getAdminSession(req))) return res.redirect('/login.html');
    return next();
  } catch (error) {
    return next(error);
  }
});

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(express.static(path.join(ROOT_DIR, 'cjgifts')));

app.get('/api/health', async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  const [products, orders] = await Promise.all([prisma.product.count(), prisma.order.count()]);
  res.json({ ok: true, status: 'ok', database: 'connected', products, orders, timestamp: Date.now() });
});

app.get('/api/products', async (req, res) => {
  const products = await prisma.product.findMany({ where: { published: true }, orderBy: { createdAt: 'desc' } });
  res.json({ ok: true, products: products.map(serializeProduct) });
});

app.get('/api/products/:id', async (req, res) => {
  const product = await prisma.product.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }, { sku: req.params.id }], published: true }
  });

  if (!product) {
    return errorResponse(res, 404, 'Product not found.');
  }

  res.json({ ok: true, product: serializeProduct(product) });
});

app.post('/api/admin/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return errorResponse(res, 400, 'Email and password are required.');

    const admin = await ensureConfiguredAdmin();
    if (!admin) return errorResponse(res, 503, 'Admin sign-in is not configured. Set ADMIN_EMAIL and a 12-character-or-longer ADMIN_PASSWORD.');
    if (!await bcrypt.compare(password, admin.passwordHash)) return errorResponse(res, 401, 'Invalid email or password.');

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await prisma.adminSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    await prisma.adminSession.create({
      data: { tokenHash: hashSessionToken(token), adminId: admin.id, expiresAt }
    });

    setAdminCookie(req, res, token, Math.floor(SESSION_TTL_MS / 1000));
    return res.json({ ok: true, admin: { email: admin.email } });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/customer/register', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6) {
      return errorResponse(res, 400, 'Enter a name, valid email, and password with at least 6 characters.');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const customer = await prisma.customer.create({ data: { name, email, passwordHash } });
    const token = randomBytes(32).toString('base64url');
    await prisma.customerSession.create({ data: { tokenHash: hashSessionToken(token), customerId: customer.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS) } });
    setCustomerCookie(req, res, token, Math.floor(SESSION_TTL_MS / 1000));
    return res.status(201).json({ ok: true, customer: publicCustomer(customer) });
  } catch (error) {
    if (error.code === 'P2002') return errorResponse(res, 409, 'An account with this email already exists.');
    return next(error);
  }
});

app.post('/api/customer/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const customer = await prisma.customer.findUnique({ where: { email } });
    if (!customer?.passwordHash || !await bcrypt.compare(password, customer.passwordHash)) return errorResponse(res, 401, 'Invalid email or password.');
    const token = randomBytes(32).toString('base64url');
    await prisma.customerSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    await prisma.customerSession.create({ data: { tokenHash: hashSessionToken(token), customerId: customer.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS) } });
    setCustomerCookie(req, res, token, Math.floor(SESSION_TTL_MS / 1000));
    return res.json({ ok: true, customer: publicCustomer(customer) });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/customer/session', requireCustomer, (req, res) => res.json({ ok: true, customer: publicCustomer(req.customer) }));

app.put('/api/customer/profile', requireCustomer, async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (name.length < 2) return errorResponse(res, 400, 'Name must be at least 2 characters.');
    const address = req.body?.address && typeof req.body.address === 'object' ? req.body.address : {};
    const customer = await prisma.customer.update({ where: { id: req.customer.id }, data: { name, phone: String(req.body?.phone || '').trim() || null, address } });
    return res.json({ ok: true, customer: publicCustomer(customer) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/customer/logout', async (req, res, next) => {
  try {
    const token = readCustomerCookie(req);
    if (token) await prisma.customerSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
    clearCustomerCookie(req, res);
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/admin/session', requireAdmin, (req, res) => {
  res.json({ ok: true, admin: { email: req.admin.email } });
});

app.post('/api/admin/logout', async (req, res, next) => {
  try {
    const token = readAdminCookie(req);
    if (token) await prisma.adminSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
    clearAdminCookie(req, res);
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/admin/products', requireAdmin, async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json({ ok: true, products: products.map(serializeProduct) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/admin/products', requireAdmin, async (req, res, next) => {
  try {
    const data = parseProductInput(req.body);
    if (!data) return errorResponse(res, 400, 'Product details are invalid.');
    const product = await prisma.product.create({ data });
    return res.status(201).json({ ok: true, product: serializeProduct(product) });
  } catch (error) {
    if (error.code === 'P2002') return errorResponse(res, 409, 'A product with that SKU or slug already exists.');
    return next(error);
  }
});

app.put('/api/admin/products/:id', requireAdmin, async (req, res, next) => {
  try {
    const data = parseProductInput(req.body);
    if (!data) return errorResponse(res, 400, 'Product details are invalid.');
    const product = await prisma.product.update({ where: { id: req.params.id }, data });
    return res.json({ ok: true, product: serializeProduct(product) });
  } catch (error) {
    if (error.code === 'P2002') return errorResponse(res, 409, 'A product with that SKU or slug already exists.');
    if (error.code === 'P2025') return errorResponse(res, 404, 'Product not found.');
    return next(error);
  }
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res, next) => {
  try {
    const product = await prisma.product.update({ where: { id: req.params.id }, data: { published: false } });
    return res.json({ ok: true, product: serializeProduct(product) });
  } catch (error) {
    if (error.code === 'P2025') return errorResponse(res, 404, 'Product not found.');
    return next(error);
  }
});

app.get('/api/admin/orders', requireAdmin, async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      include: { customer: true, items: true },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ ok: true, orders: orders.map(serializeOrder) });
  } catch (error) {
    return next(error);
  }
});

app.put('/api/admin/orders/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const status = String(req.body?.status || '');
    const allowed = ['Pending', 'Processing', 'Preparing', 'Shipped', 'Delivered', 'Cancelled'];
    if (!allowed.includes(status)) return errorResponse(res, 400, 'Order status is invalid.');
    const current = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!current) return errorResponse(res, 404, 'Order not found.');
    const statusHistory = Array.isArray(current.statusHistory) ? current.statusHistory : [];
    const order = await prisma.order.update({
      where: { id: current.id },
      data: {
        fulfillmentStatus: status,
        statusHistory: [...statusHistory, { status, timestamp: new Date().toISOString(), message: 'Order status updated by admin.' }]
      },
      include: { customer: true, items: true }
    });
    return res.json({ ok: true, order: serializeOrder(order) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/orders', async (req, res, next) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return errorResponse(res, 400, 'Order validation failed.', parsed.error.flatten());

  const payload = parsed.data;
  try {
    const order = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: payload.items.map((item) => item.productId) }, published: true }
      });
      const catalog = products.map((product) => ({
        ...product,
        price: Number(product.price),
        salePrice: product.salePrice === null ? null : Number(product.salePrice)
      }));
      const validation = validateCart(payload.items.map((item) => ({ productId: item.productId, quantity: item.quantity })), catalog);
      if (!validation.ok) throw new OrderRequestError(400, 'Cart validation failed.', validation.errors);

      const shipping = getShippingFee(payload.delivery.country, validation.subtotal);
      if (!shipping.eligible) throw new OrderRequestError(400, shipping.message, { country: payload.delivery.country });
      const totals = calculateOrderTotal(validation.items, shipping.shippingFee, 0);
      const email = payload.customer.email.trim().toLowerCase();
      const customer = await tx.customer.upsert({
        where: { email },
        create: {
          name: payload.customer.name,
          email,
          phone: payload.customer.phone,
          address: {
            line1: payload.delivery.street,
            city: payload.delivery.city,
            state: payload.delivery.region || '',
            country: payload.delivery.country,
            postal: payload.delivery.postalCode || ''
          }
        },
        update: { name: payload.customer.name, phone: payload.customer.phone }
      });

      for (const item of validation.items) {
        const updated = await tx.product.updateMany({
          where: { id: item.productId, published: true, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } }
        });
        if (updated.count !== 1) throw new OrderRequestError(409, `${item.name} no longer has enough stock.`);
      }

      const productsById = new Map(products.map((product) => [product.id, product]));
      return tx.order.create({
        data: {
          orderNumber: buildOrderNumber(),
          accessToken: randomBytes(32).toString('base64url'),
          customerId: customer.id,
          subtotal: totals.subtotal,
          shippingFee: totals.shippingFee,
          tax: totals.tax,
          total: totals.total,
          currency: payload.currency,
          paymentStatus: 'Pending',
          fulfillmentStatus: 'Processing',
          deliveryCountry: payload.delivery.country,
          deliveryCity: payload.delivery.city,
          deliveryStreet: payload.delivery.street,
          deliveryRegion: payload.delivery.region || null,
          notes: [payload.delivery.apartment, payload.delivery.instructions].filter(Boolean).join(' — ') || null,
          statusHistory: [{ status: 'Processing', timestamp: new Date().toISOString(), message: 'Order created and awaiting payment confirmation.' }],
          items: {
            create: validation.items.map((item) => ({
              productId: item.productId,
              name: item.name,
              sku: productsById.get(item.productId).sku,
              quantity: item.quantity,
              unitPrice: item.unitPrice
            }))
          }
        },
        include: { customer: true, items: true }
      });
    });
    return res.status(201).json({ ok: true, order: serializeOrder(order) });
  } catch (error) {
    if (error instanceof OrderRequestError) return errorResponse(res, error.status, error.message, error.details);
    return next(error);
  }
});

app.post('/api/payments/initiate', async (req, res, next) => {
  try {
    const { orderId, accessToken, callbackUrl } = req.body || {};
    if (!orderId) return errorResponse(res, 400, 'An order is required to start payment.');
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } });
    if (!order) return errorResponse(res, 404, 'Order not found.');
    if (!accessToken || order.accessToken !== accessToken) return errorResponse(res, 403, 'Unauthorized order payment.');
    if (order.paymentStatus === 'Paid') return res.json({ ok: true, alreadyPaid: true });

    const reference = `cjgifts_${order.id}_${Date.now()}`;
    const payment = await prisma.payment.create({ data: {
      orderId: order.id,
      reference,
      amount: order.total,
      currency: order.currency,
      status: 'Pending'
    } });

    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('your_paystack')) {
      return res.json({ ok: true, mock: true, reference: payment.reference, authorizationUrl: callbackUrl || '/order-success.html' });
    }

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: order.customer.email,
        amount: Number(order.total) * 100,
        currency: order.currency,
        reference: payment.reference,
        callback_url: callbackUrl
      })
    });
    const data = await response.json();
    if (!response.ok || !data.status) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'Failed', payload: data } });
      return errorResponse(res, 400, 'Unable to initialize Paystack payment.', data);
    }
    return res.json({ ok: true, authorizationUrl: data.data.authorization_url, reference: data.data.reference });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/payments/verify', async (req, res, next) => {
  try {
    const { reference, orderId, accessToken } = req.body || {};
    if (!reference || !orderId) return errorResponse(res, 400, 'A payment reference and order are required.');
    const payment = await prisma.payment.findFirst({
      where: { reference, orderId },
      include: { order: { include: { customer: true, items: true } } }
    });
    if (!payment) return errorResponse(res, 404, 'Payment or order not found.');
    if (!accessToken || payment.order.accessToken !== accessToken) return errorResponse(res, 403, 'Unauthorized payment verification.');
    if (payment.status === 'Paid') return res.json({ ok: true, verified: true, order: serializeOrder(payment.order) });

    if (PAYSTACK_SECRET_KEY && !PAYSTACK_SECRET_KEY.includes('your_paystack')) {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        method: 'GET', headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
      });
      const data = await response.json();
      if (!response.ok || !data.status) return errorResponse(res, 400, 'Payment verification failed.', data);
      const verification = verifyPaystackReference({
        expectedReference: payment.reference,
        receivedReference: data.data.reference,
        expectedAmount: Number(payment.amount),
        receivedAmount: Number(data.data.amount) / 100,
        expectedCurrency: payment.currency,
        receivedCurrency: data.data.currency || payment.currency
      });
      if (!verification.ok || data.data.status !== 'success') return errorResponse(res, 400, verification.reason || 'Payment is not successful.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const history = Array.isArray(payment.order.statusHistory) ? payment.order.statusHistory : [];
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'Paid' } });
      return tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'Paid',
          statusHistory: [...history, { status: 'Processing', timestamp: new Date().toISOString(), message: 'Payment verified successfully.' }]
        },
        include: { customer: true, items: true }
      });
    });
    return res.json({ ok: true, verified: true, order: serializeOrder(updated) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/payments/webhook', async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  const body = req.body || {};
  if (!signature || !PAYSTACK_SECRET_KEY || !req.rawBody) {
    return res.status(401).json({ ok: false, message: 'Webhook signature could not be verified.' });
  }
  const expected = createHmac('sha512', PAYSTACK_SECRET_KEY).update(req.rawBody).digest();
  let received;
  try { received = Buffer.from(String(signature), 'hex'); } catch { received = Buffer.alloc(0); }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return res.status(401).json({ ok: false, message: 'Webhook signature is invalid.' });
  }
  if (!['charge.success', 'charge.failed'].includes(body.event) || !body.data?.reference) {
    return res.status(200).json({ ok: true, received: true });
  }
  const payment = await prisma.payment.findUnique({
    where: { reference: body.data.reference },
    include: { order: true }
  });
  if (!payment) return res.status(200).json({ ok: true, received: true, matched: false });
  const paymentStatus = body.event === 'charge.success' ? 'Paid' : 'Failed';
  if (payment.status === paymentStatus) return res.status(200).json({ ok: true, duplicate: true });
  const nextOrderStatus = body.event === 'charge.success' ? 'Paid' : 'Failed';
  const history = Array.isArray(payment.order.statusHistory) ? payment.order.statusHistory : [];
  await prisma.$transaction([
    prisma.payment.update({ where: { id: payment.id }, data: { status: paymentStatus, payload: body } }),
    prisma.order.update({
      where: { id: payment.orderId },
      data: {
        paymentStatus,
        statusHistory: [...history, { status: nextOrderStatus, timestamp: new Date().toISOString(), message: `Payment ${paymentStatus.toLowerCase()} confirmed by Paystack webhook.` }]
      }
    })
  ]);
  return res.status(200).json({ ok: true, received: true });
});

app.get('/api/orders/:id', async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { OR: [{ id: req.params.id }, { orderNumber: req.params.id }] },
      include: { customer: true, items: true }
    });
    if (!order) return errorResponse(res, 404, 'Order not found.');
    if (!req.query.token || order.accessToken !== req.query.token) return errorResponse(res, 403, 'Unauthorized order lookup.');
    return res.json({ ok: true, order: serializeOrder(order) });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/customer/orders', requireCustomer, async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { customerId: req.customer.id },
      include: { customer: true, items: true },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ ok: true, orders: orders.map(serializeOrder) });
  } catch (error) {
    return next(error);
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'cjgifts', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Unhandled API error:', err);
  res.status(500).json({ ok: false, message: 'Internal server error.' });
});

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`CJ Gifts backend listening on http://localhost:${PORT}`);
  });
}

export default app;
