import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const storePath = path.join(rootDir, 'data', 'store.json');

export const seedProducts = [
  {
    id: 'p1',
    sku: 'CJG-GD-001',
    name: 'Luxury Watch Gift Set',
    category: 'gift-ideas',
    price: 189.99,
    salePrice: 149.99,
    stock: 24,
    featured: true,
    specialOffer: true,
    published: true,
    shortDescription: 'An elegant timepiece presented in a premium gift box.',
    description: 'A timeless gift set with a stainless-steel watch and premium presentation box.',
    images: ['https://picsum.photos/seed/watch1/700/700', 'https://picsum.photos/seed/watch2/700/700'],
    variants: [],
    createdAt: Date.now() - 86400000 * 2
  },
  {
    id: 'p2',
    sku: 'CJG-GD-002',
    name: 'Scented Candle Collection',
    category: 'gift-ideas',
    price: 54,
    salePrice: null,
    stock: 60,
    featured: true,
    specialOffer: false,
    published: true,
    shortDescription: 'A set of three hand-poured candles in warm seasonal scents.',
    description: 'Three soy candles in warm seasonal fragrances designed for gifting.',
    images: ['https://picsum.photos/seed/candle1/700/700'],
    variants: [],
    createdAt: Date.now() - 86400000 * 10
  },
  {
    id: 'p3',
    sku: 'CJG-PA-001',
    name: 'Wireless Bluetooth Earbuds',
    category: 'products-accessories',
    price: 79.99,
    salePrice: 59.99,
    stock: 75,
    featured: true,
    specialOffer: true,
    published: true,
    shortDescription: 'True wireless earbuds with active noise cancellation.',
    description: 'Premium earbuds with noise cancelling, wireless charging, and comfortable fit.',
    images: ['https://picsum.photos/seed/earbuds1/700/700'],
    variants: [],
    createdAt: Date.now() - 86400000 * 3
  }
];

const defaultStore = {
  products: seedProducts,
  users: [],
  orders: [],
  payments: [],
  paymentEvents: [],
  deliveryZones: [
    { code: 'NG', country: 'Nigeria', defaultShippingFee: 4.5 },
    { code: 'US', country: 'United States', defaultShippingFee: 12 },
    { code: 'GB', country: 'United Kingdom', defaultShippingFee: 14 },
    { code: 'KE', country: 'Kenya', defaultShippingFee: 9 }
  ]
};

export async function ensureStore() {
  await fs.mkdir(path.dirname(storePath), { recursive: true });

  try {
    await fs.access(storePath);
    return;
  } catch {
    await fs.writeFile(storePath, JSON.stringify(defaultStore, null, 2));
  }
}

export async function readStore() {
  await ensureStore();

  const raw = await fs.readFile(storePath, 'utf8');
  return JSON.parse(raw);
}

export async function writeStore(data) {
  await fs.writeFile(storePath, JSON.stringify(data, null, 2));
}

export function buildOrderNumber() {
  return `CJG-${Date.now().toString().slice(-8)}`;
}

export function orderAccessToken() {
  return `ord_${Math.random().toString(36).slice(2, 12)}`;
}
