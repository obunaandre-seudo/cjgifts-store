import { z } from 'zod';

export const SUPPORTED_CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR', 'ZAR'];
export const ORDER_STATUSES = ['Pending', 'Processing', 'Preparing', 'Shipped', 'Delivered', 'Cancelled'];
export const PAYMENT_STATUSES = ['Pending', 'Paid', 'Failed', 'Refunded'];

export const orderSchema = z.object({
  customer: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(6)
  }),
  recipient: z.object({
    name: z.string().min(2),
    phone: z.string().min(6).optional().or(z.literal(''))
  }),
  delivery: z.object({
    country: z.string().min(2),
    city: z.string().min(2),
    region: z.string().optional().or(z.literal('')),
    street: z.string().min(3),
    apartment: z.string().optional().or(z.literal('')),
    postalCode: z.string().optional().or(z.literal('')),
    instructions: z.string().optional().or(z.literal(''))
  }),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1),
    name: z.string().min(1),
    unitPrice: z.number().positive()
  })).min(1),
  shippingMethod: z.string().optional().or(z.literal('')),
  currency: z.string().refine((value) => SUPPORTED_CURRENCIES.includes(value), { message: 'Currency is not supported.' })
});

export function calculateLineTotal(product, quantity = 1) {
  const unitPrice = Number(product.salePrice ?? product.price ?? 0);
  return Number((unitPrice * quantity).toFixed(2));
}

export function calculateOrderTotal(items, shippingFee = 0, tax = 0) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0);
  const total = subtotal + Number(shippingFee || 0) + Number(tax || 0);
  return {
    subtotal: Number(subtotal.toFixed(2)),
    shippingFee: Number(Number(shippingFee || 0).toFixed(2)),
    tax: Number(Number(tax || 0).toFixed(2)),
    total: Number(total.toFixed(2))
  };
}

export function getShippingFee(country, subtotal = 0) {
  const zoneFee = {
    Nigeria: 5985,
    'United States': 15960,
    'United Kingdom': 18620,
    Kenya: 11970
  };

  if (!country) return 0;
  const fee = zoneFee[country] ?? 0;

  if (fee === 0) {
    return { shippingFee: 0, eligible: false, message: 'This destination is not currently supported for delivery.' };
  }

  return {
    shippingFee: Number((subtotal > 199500 ? fee * 0.75 : fee).toFixed(2)),
    eligible: true,
    message: 'Delivery is available to this destination.'
  };
}

export function validateCart(cartItems, catalog) {
  const errors = [];
  const items = [];
  let subtotal = 0;

  for (const item of cartItems) {
    const product = catalog.find((entry) => entry.id === item.productId);
    if (!product) {
      errors.push(`Product ${item.productId} is not available.`);
      continue;
    }

    if (!product.published) {
      errors.push(`${product.name} is no longer available.`);
      continue;
    }

    const quantity = Number(item.quantity || 0);
    if (quantity <= 0) {
      errors.push(`${product.name} quantity must be greater than zero.`);
      continue;
    }

    if (product.stock < quantity) {
      errors.push(`${product.name} has only ${product.stock} units left.`);
      continue;
    }

    const unitPrice = Number(product.salePrice ?? product.price ?? 0);
    const lineTotal = Number((unitPrice * quantity).toFixed(2));
    subtotal += lineTotal;
    items.push({ productId: product.id, quantity, name: product.name, unitPrice, lineTotal });
  }

  return {
    ok: errors.length === 0,
    errors,
    items,
    subtotal: Number(subtotal.toFixed(2)),
    total: Number(subtotal.toFixed(2))
  };
}

export function isDuplicatePaymentEvent(paymentEvents, eventId) {
  return paymentEvents.some((event) => event.eventId === eventId);
}

export function verifyPaystackReference({ expectedReference, receivedReference, expectedAmount, receivedAmount, expectedCurrency, receivedCurrency }) {
  if (!receivedReference || receivedReference !== expectedReference) {
    return { ok: false, reason: 'Payment reference mismatch.' };
  }

  if (Number(receivedAmount) !== Number(expectedAmount)) {
    return { ok: false, reason: 'Payment amount does not match the order total.' };
  }

  if (receivedCurrency !== expectedCurrency) {
    return { ok: false, reason: 'Payment currency does not match the order currency.' };
  }

  return { ok: true };
}

export function canTransitionStatus(currentStatus, nextStatus) {
  const flow = {
    Pending: ['Processing', 'Cancelled'],
    Processing: ['Preparing', 'Cancelled'],
    Preparing: ['Shipped', 'Cancelled'],
    Shipped: ['Delivered', 'Cancelled'],
    Delivered: ['Delivered'],
    Cancelled: ['Cancelled']
  };

  return (flow[currentStatus] || []).includes(nextStatus);
}
