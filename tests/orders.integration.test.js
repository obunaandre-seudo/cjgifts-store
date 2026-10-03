import test from 'node:test';
import assert from 'node:assert/strict';

process.env.VERCEL = '1';
process.env.PAYSTACK_SECRET_KEY = '';

const [{ default: app }, { prisma }] = await Promise.all([
  import('../server.js'),
  import('../src/lib/prisma.js')
]);

test('checkout stays unpaid when Paystack is unavailable and cannot be fulfilled', async () => {
  const original = {
    transaction: prisma.$transaction,
    productFindMany: prisma.product.findMany,
    productUpdateMany: prisma.product.updateMany,
    customerUpsert: prisma.customer.upsert,
    customerFindMany: prisma.customer.findMany,
    orderCreate: prisma.order.create,
    orderFindUnique: prisma.order.findUnique,
    orderFindMany: prisma.order.findMany,
    paymentCreate: prisma.payment.create,
    paymentFindFirst: prisma.payment.findFirst,
    paymentUpdate: prisma.payment.update,
    orderUpdate: prisma.order.update,
    adminSessionFindUnique: prisma.adminSession.findUnique
  };

  const dates = new Date();
  const customer = { id: 'customer-checkout-test', name: 'Test Buyer', email: 'buyer@example.test', phone: '5551234567' };
  let stock = 6;
  let savedOrder = null;
  let savedPayment = null;
  let savedCustomerInput = null;

  prisma.product.findMany = async () => [{
    id: 'gift-product-test', sku: 'TEST-GIFT', name: 'Test Gift Box', published: true,
    price: 25, salePrice: 20, stock, category: 'gift-ideas'
  }];
  prisma.product.updateMany = async ({ where, data }) => {
    if (where.stock.gte > stock) return { count: 0 };
    stock -= data.stock.decrement;
    return { count: 1 };
  };
  prisma.customer.upsert = async input => {
    savedCustomerInput = input;
    return { ...customer, phone: input.create.phone, address: input.create.address };
  };
  prisma.customer.findMany = async () => [{
    ...customer,
    address: savedCustomerInput?.update.address,
    orders: [{ total: 52 }],
    createdAt: dates
  }];
  prisma.order.create = async ({ data }) => {
    savedOrder = {
      id: 'order-checkout-test', orderNumber: data.orderNumber, accessToken: data.accessToken,
      customer, items: data.items.create, subtotal: data.subtotal, shippingFee: data.shippingFee,
      tax: data.tax, total: data.total, currency: data.currency, paymentStatus: data.paymentStatus,
      fulfillmentStatus: data.fulfillmentStatus, deliveryCountry: data.deliveryCountry,
      deliveryCity: data.deliveryCity, deliveryStreet: data.deliveryStreet,
      deliveryRegion: data.deliveryRegion, notes: data.notes, statusHistory: data.statusHistory,
      createdAt: dates, updatedAt: dates
    };
    return savedOrder;
  };
  prisma.order.findMany = async () => savedOrder ? [savedOrder] : [];
  prisma.order.findUnique = async () => savedOrder;
  prisma.payment.create = async ({ data }) => {
    savedPayment = { id: 'payment-checkout-test', ...data, status: 'Pending' };
    return savedPayment;
  };
  prisma.payment.findFirst = async () => savedPayment ? { ...savedPayment, order: savedOrder } : null;
  prisma.payment.update = async ({ data }) => { Object.assign(savedPayment, data); return savedPayment; };
  prisma.order.update = async ({ data }) => {
    Object.assign(savedOrder, data);
    savedOrder.updatedAt = dates;
    return savedOrder;
  };
  prisma.adminSession.findUnique = async () => ({
    expiresAt: new Date(Date.now() + 60_000),
    admin: { role: 'admin', email: 'admin@example.test' }
  });
  prisma.$transaction = async operation => typeof operation === 'function'
    ? operation({ product: prisma.product, customer: prisma.customer, order: prisma.order, payment: prisma.payment })
    : Promise.all(operation);

  const listener = app.listen(0);
  try {
    await new Promise(resolve => listener.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${listener.address().port}`;
    const orderResponse = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { name: customer.name, email: customer.email, phone: customer.phone },
        recipient: { name: customer.name, phone: customer.phone },
        delivery: { country: 'United States', city: 'Test City', region: 'CA', street: '1 Test Street' },
        items: [{ productId: 'gift-product-test', name: 'Test Gift Box', quantity: 2, unitPrice: 20 }],
        currency: 'USD'
      })
    });
    const created = await orderResponse.json();
    assert.equal(orderResponse.status, 201);
    assert.equal(created.order.items[0].name, 'Test Gift Box');
    assert.equal(created.order.items[0].quantity, 2);
    assert.equal(created.order.currency, 'NGN');
    assert.equal(created.order.paymentStatus, 'Pending');
    assert.equal(stock, 4);
    assert.equal(savedCustomerInput.create.phone, customer.phone);
    assert.deepEqual(savedCustomerInput.create.address, {
      line1: '1 Test Street', city: 'Test City', state: 'CA', country: 'United States', postal: ''
    });
    assert.equal(savedCustomerInput.update.phone, customer.phone);
    assert.deepEqual(savedCustomerInput.update.address, savedCustomerInput.create.address);

    const paymentResponse = await fetch(`${baseUrl}/api/payments/initiate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: created.order.id, accessToken: created.order.accessToken })
    });
    const payment = await paymentResponse.json();
    assert.equal(paymentResponse.status, 503);
    assert.equal(payment.ok, false);

    savedPayment = {
      id: 'payment-checkout-test', orderId: created.order.id, reference: 'pending-reference',
      amount: created.order.total, currency: 'NGN', status: 'Pending', order: savedOrder
    };

    const verifyResponse = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: created.order.id, accessToken: created.order.accessToken, reference: savedPayment.reference })
    });
    assert.equal(verifyResponse.status, 503);

    const webhookResponse = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'charge.success', data: { reference: savedPayment.reference, status: 'success' } })
    });
    assert.equal(webhookResponse.status, 401);

    const unpaidStatusResponse = await fetch(`${baseUrl}/api/admin/orders/${created.order.id}/status`, {
      method: 'PUT',
      headers: { Cookie: 'cjgifts_admin_session=test-session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Shipped' })
    });
    assert.equal(unpaidStatusResponse.status, 409);

    const adminResponse = await fetch(`${baseUrl}/api/admin/orders`, {
      headers: { Cookie: 'cjgifts_admin_session=test-session' }
    });
    const admin = await adminResponse.json();
    assert.equal(adminResponse.status, 200);
    assert.equal(admin.orders.length, 1);
    assert.equal(admin.orders[0].items[0].name, 'Test Gift Box');
    assert.equal(admin.orders[0].items[0].quantity, 2);
    assert.equal(admin.orders[0].paymentStatus, 'Pending');

    const customersResponse = await fetch(`${baseUrl}/api/admin/customers`, {
      headers: { Cookie: 'cjgifts_admin_session=test-session' }
    });
    const customers = await customersResponse.json();
    assert.equal(customersResponse.status, 200);
    assert.equal(customers.customers[0].phone, customer.phone);
    assert.equal(customers.customers[0].address.city, 'Test City');
    assert.equal(customers.customers[0].orderCount, 1);
  } finally {
    await new Promise(resolve => listener.close(resolve));
    prisma.$transaction = original.transaction;
    prisma.product.findMany = original.productFindMany;
    prisma.product.updateMany = original.productUpdateMany;
    prisma.customer.upsert = original.customerUpsert;
    prisma.customer.findMany = original.customerFindMany;
    prisma.order.create = original.orderCreate;
    prisma.order.findUnique = original.orderFindUnique;
    prisma.order.findMany = original.orderFindMany;
    prisma.payment.create = original.paymentCreate;
    prisma.payment.findFirst = original.paymentFindFirst;
    prisma.payment.update = original.paymentUpdate;
    prisma.order.update = original.orderUpdate;
    prisma.adminSession.findUnique = original.adminSessionFindUnique;
  }
});
