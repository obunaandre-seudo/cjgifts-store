import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateOrderTotal, validateCart, getShippingFee, verifyPaystackReference, canTransitionStatus } from '../src/lib/validation.js';

const catalog = [
  { id: 'p1', name: 'Watch', price: 100, salePrice: 80, stock: 5, published: true },
  { id: 'p2', name: 'Candle', price: 30, stock: 2, published: true }
];

test('calculateOrderTotal sums subtotal and shipping fees', () => {
  const total = calculateOrderTotal([
    { productId: 'p1', quantity: 2, unitPrice: 80 },
    { productId: 'p2', quantity: 1, unitPrice: 30 }
  ], 12, 0);

  assert.equal(total.subtotal, 190);
  assert.equal(total.total, 202);
});

test('validateCart rejects out-of-stock products', () => {
  const result = validateCart([{ productId: 'p2', quantity: 3 }], catalog);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /only 2 units left/i);
});

test('getShippingFee blocks unsupported destinations', () => {
  const result = getShippingFee('France');
  assert.equal(result.eligible, false);
  assert.match(result.message, /not currently supported/i);
});

test('verifyPaystackReference catches mismatched amount', () => {
  const result = verifyPaystackReference({
    expectedReference: 'ref_123',
    receivedReference: 'ref_123',
    expectedAmount: 200,
    receivedAmount: 250,
    expectedCurrency: 'NGN',
    receivedCurrency: 'NGN'
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /amount/i);
});

test('canTransitionStatus restricts invalid order flow', () => {
  assert.equal(canTransitionStatus('Pending', 'Shipped'), false);
  assert.equal(canTransitionStatus('Shipped', 'Delivered'), true);
});

test('validateCart approves valid items', () => {
  const result = validateCart([{ productId: 'p1', quantity: 2 }], catalog);
  assert.equal(result.ok, true);
  assert.equal(result.items[0].quantity, 2);
});
