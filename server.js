import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import { readStore, writeStore, buildOrderNumber, orderAccessToken } from './src/lib/store.js';
import { orderSchema, calculateOrderTotal, getShippingFee, validateCart, verifyPaystackReference, canTransitionStatus, PAYMENT_STATUSES } from './src/lib/validation.js';

const app = express();
const PORT = Number(process.env.PORT || 3001);
const ROOT_DIR = process.cwd();
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_placeholder';
const ADMIN_DEFAULT_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 86400000);

app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));
app.use(express.static(path.join(ROOT_DIR, 'cjgifts')));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

function errorResponse(res, status, message, details) {
  const payload = { ok: false, message };
  if (details) payload.details = details;
  return res.status(status).json(payload);
}

async function requireSession(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return errorResponse(res, 401, 'Authentication required.');
  }

  const store = await readStore();
  const session = store.sessions.find((entry) => entry.token === token && entry.expiresAt > Date.now());

  if (!session) {
    return errorResponse(res, 401, 'Session expired or invalid.');
  }

  req.user = session.user;
  req.session = session;
  next();
}

async function requireAdmin(req, res, next) {
  await requireSession(req, res, () => {
    if (!req.user || req.user.role !== 'super_admin') {
      return errorResponse(res, 403, 'Admin access required.');
    }
    next();
  });
}

async function ensureAdminUser() {
  const store = await readStore();
  const existing = store.admins?.find((user) => user.username === ADMIN_DEFAULT_USERNAME);

  if (!existing) {
    store.admins = [
      {
        id: 'admin-1',
        username: ADMIN_DEFAULT_USERNAME,
        passwordHash: bcrypt.hashSync(ADMIN_DEFAULT_PASSWORD, 10),
        role: 'super_admin',
        createdAt: Date.now()
      }
    ];

    await writeStore(store);
  }
}

app.get('/api/health', async (req, res) => {
  const store = await readStore();
  res.json({ ok: true, status: 'ok', products: store.products.length, orders: store.orders.length, timestamp: Date.now() });
});

app.get('/api/products', async (req, res) => {
  const store = await readStore();
  res.json({ ok: true, products: store.products || [] });
});

app.get('/api/products/:id', async (req, res) => {
  const store = await readStore();
  const product = (store.products || []).find((entry) => entry.id === req.params.id);

  if (!product) {
    return errorResponse(res, 404, 'Product not found.');
  }

  res.json({ ok: true, product });
});

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return errorResponse(res, 400, 'Username and password are required.');
  }

  await ensureAdminUser();
  const store = await readStore();
  const admin = store.admins.find((entry) => entry.username === username);

  if (!admin || !bcrypt.compareSync(password, admin.passwordHash)) {
    return errorResponse(res, 401, 'Invalid admin login credentials.');
  }

  const token = uuidv4();
  const session = {
    id: uuidv4(),
    token,
    user: { id: admin.id, username: admin.username, role: admin.role },
    expiresAt: Date.now() + SESSION_TTL_MS
  };

  store.sessions = [...(store.sessions || []).filter((entry) => entry.user?.username !== admin.username), session];
  await writeStore(store);

  res.json({ ok: true, token, user: session.user });
});

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  const store = await readStore();
  res.json({ ok: true, orders: store.orders || [] });
});

app.post('/api/orders', async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);

  if (!parsed.success) {
    return errorResponse(res, 400, 'Order validation failed.', parsed.error.flatten());
  }

  const payload = parsed.data;
  const store = await readStore();
  const catalog = store.products || [];
  const validation = validateCart(payload.items.map((item) => ({ productId: item.productId, quantity: item.quantity })), catalog);

  if (!validation.ok) {
    return errorResponse(res, 400, 'Cart validation failed.', validation.errors);
  }

  const shipping = getShippingFee(payload.delivery.country, validation.subtotal);
  if (!shipping.eligible) {
    return errorResponse(res, 400, shipping.message, { country: payload.delivery.country });
  }

  const orderTotal = calculateOrderTotal(validation.items, shipping.shippingFee, 0);
  const orderId = uuidv4();
  const orderNumber = buildOrderNumber();
  const accessToken = orderAccessToken();
  const paymentReference = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const order = {
    id: orderId,
    orderNumber,
    accessToken,
    paymentReference,
    customer: payload.customer,
    recipient: payload.recipient,
    delivery: payload.delivery,
    items: validation.items,
    shippingMethod: payload.shippingMethod || 'Standard',
    currency: payload.currency,
    subtotal: orderTotal.subtotal,
    shippingFee: orderTotal.shippingFee,
    tax: orderTotal.tax,
    total: orderTotal.total,
    paymentStatus: 'Pending',
    fulfillmentStatus: 'Processing',
    statusHistory: [
      {
        status: 'Processing',
        timestamp: new Date().toISOString(),
        message: 'Order created and awaiting payment confirmation.'
      }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isArchived: false
  };

  store.orders = [order, ...(store.orders || [])];

  for (const item of validation.items) {
    const product = catalog.find((entry) => entry.id === item.productId);
    if (product) {
      product.stock = Math.max(0, Number(product.stock || 0) - Number(item.quantity || 0));
    }
  }

  await writeStore(store);

  res.status(201).json({ ok: true, order, payment: { publicKey: PAYSTACK_PUBLIC_KEY } });
});

app.post('/api/payments/initiate', async (req, res) => {
  const { orderId, email, amount, currency, callbackUrl } = req.body || {};

  if (!orderId || !email || !amount || !currency) {
    return errorResponse(res, 400, 'Missing required payment fields.');
  }

  if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('your_paystack')) {
    return res.json({
      ok: true,
      mock: true,
      message: 'Paystack credentials are not configured. Using safe local test mode.',
      reference: `paystack_test_${Date.now()}`,
      authorizationUrl: callbackUrl || 'http://localhost:3001/order-success.html',
      amount,
      currency
    });
  }

  const order = (await readStore()).orders.find((entry) => entry.id === orderId) || null;
  const reference = order?.paymentReference || `pay_${Date.now()}`;

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      amount: Number(amount) * 100,
      currency,
      reference,
      callback_url: callbackUrl
    })
  });

  const data = await response.json();
  if (!response.ok || !data.status) {
    return errorResponse(res, 400, 'Unable to initialize Paystack payment.', data);
  }

  res.json({ ok: true, authorizationUrl: data.data.authorization_url, reference: data.data.reference });
});

app.post('/api/payments/verify', async (req, res) => {
  const { reference, orderId, expectedAmount, expectedCurrency } = req.body || {};

  if (!reference) {
    return errorResponse(res, 400, 'A payment reference is required.');
  }

  const store = await readStore();
  const order = (store.orders || []).find((entry) => entry.id === orderId);

  if (!order) {
    return errorResponse(res, 404, 'Order not found.');
  }

  if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('your_paystack')) {
    const success = reference.startsWith('paystack_test_') || reference.startsWith('pay_');
    if (!success) {
      return errorResponse(res, 400, 'Verification failed: invalid local test reference.');
    }

    order.paymentStatus = 'Paid';
    order.fulfillmentStatus = 'Processing';
    order.statusHistory = [
      ...order.statusHistory,
      { status: 'Processing', timestamp: new Date().toISOString(), message: 'Payment verified in local test mode.' }
    ];
    order.updatedAt = Date.now();
    await writeStore(store);

    return res.json({ ok: true, verified: true, order });
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
  });

  const data = await response.json();
  if (!response.ok || !data.status) {
    return errorResponse(res, 400, 'Payment verification failed.', data);
  }

  const verification = verifyPaystackReference({
    expectedReference: order.paymentReference,
    receivedReference: data.data.reference,
    expectedAmount: Number(expectedAmount),
    receivedAmount: Number(data.data.amount) / 100,
    expectedCurrency: expectedCurrency || order.currency,
    receivedCurrency: data.data.currency || order.currency
  });

  if (!verification.ok) {
    return errorResponse(res, 400, verification.reason);
  }

  order.paymentStatus = 'Paid';
  order.fulfillmentStatus = 'Processing';
  order.statusHistory = [
    ...order.statusHistory,
    { status: 'Processing', timestamp: new Date().toISOString(), message: 'Payment verified successfully.' }
  ];
  order.updatedAt = Date.now();

  await writeStore(store);

  res.json({ ok: true, verified: true, order });
});

app.post('/api/payments/webhook', async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  const body = req.body || {};

  if (!signature) {
    return res.status(401).json({ ok: false, message: 'Missing webhook signature.' });
  }

  const store = await readStore();
  const eventId = body.event || `evt_${Date.now()}`;
  const exists = (store.paymentEvents || []).some((entry) => entry.eventId === eventId);

  if (exists) {
    return res.status(200).json({ ok: true, duplicate: true });
  }

  store.paymentEvents = [...(store.paymentEvents || []), { eventId, receivedAt: Date.now(), payload: body }];
  if (body.event === 'charge.success' && body.data?.reference) {
    const order = (store.orders || []).find((entry) => entry.id === body.data.metadata?.orderId || entry.orderNumber === body.data.metadata?.orderNumber);
    if (order) {
      order.paymentStatus = 'Paid';
      order.fulfillmentStatus = 'Processing';
      order.statusHistory = [...order.statusHistory, { status: 'Processing', timestamp: new Date().toISOString(), message: 'Webhook payment confirmed.' }];
      order.updatedAt = Date.now();
    }
  }

  await writeStore(store);
  res.status(200).json({ ok: true, received: true });
});

app.get('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { token } = req.query;
  const store = await readStore();
  const order = (store.orders || []).find((entry) => entry.id === id || entry.orderNumber === id);

  if (!order) {
    return errorResponse(res, 404, 'Order not found.');
  }

  const canView = token && order.accessToken === token;
  if (!canView) {
    return errorResponse(res, 403, 'Unauthorized order lookup.');
  }

  res.json({ ok: true, order });
});

app.get('/api/customer/orders', async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return errorResponse(res, 400, 'An email is required to lookup orders.');
  }

  const store = await readStore();
  const orders = (store.orders || []).filter((order) => order.customer.email.toLowerCase() === String(email).toLowerCase());
  res.json({ ok: true, orders });
});

app.get('/api/debug', async (req, res) => {
  const store = await readStore();
  res.json({ ok: true, admin: { username: ADMIN_DEFAULT_USERNAME, hasSecret: Boolean(PAYSTACK_SECRET_KEY), publicKey: PAYSTACK_PUBLIC_KEY }, orderCount: store.orders.length });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'cjgifts', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Unhandled API error:', err);
  res.status(500).json({ ok: false, message: 'Internal server error.' });
});

app.listen(PORT, async () => {
  await ensureAdminUser();
  console.log(`CJ Gifts backend listening on http://localhost:${PORT}`);
});

export default app;
