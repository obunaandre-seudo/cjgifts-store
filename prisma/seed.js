import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const testProducts = [
  {
    sku: 'CJG-TEST-001',
    name: 'Test Gift Watch',
    slug: 'test-gift-watch',
    shortDescription: 'A sample watch listing for testing the Neon catalog.',
    description: 'Test product. Do not fulfill as a real customer order.',
    price: '49.99',
    salePrice: '39.99',
    stock: 20,
    category: 'products-accessories',
    featured: true,
    specialOffer: true,
    published: true,
    images: ['https://picsum.photos/seed/cjgifts-test-watch/700/700'],
    variants: []
  },
  {
    sku: 'CJG-TEST-002',
    name: 'Test Candle Set',
    slug: 'test-candle-set',
    shortDescription: 'A sample candle listing for testing product reads.',
    description: 'Test product. Do not fulfill as a real customer order.',
    price: '24.50',
    stock: 35,
    category: 'gift-ideas',
    featured: true,
    specialOffer: false,
    published: true,
    images: ['https://picsum.photos/seed/cjgifts-test-candle/700/700'],
    variants: []
  },
  {
    sku: 'CJG-TEST-003',
    name: 'Test Gift Box',
    slug: 'test-gift-box',
    shortDescription: 'A sample gift box listing for checking the catalog.',
    description: 'Test product. Do not fulfill as a real customer order.',
    price: '79.00',
    stock: 12,
    category: 'gift-ideas',
    featured: false,
    specialOffer: true,
    published: true,
    images: ['https://picsum.photos/seed/cjgifts-test-box/700/700'],
    variants: []
  }
];

try {
  for (const product of testProducts) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: product,
      create: product
    });
  }
  console.log(`Seeded ${testProducts.length} test products.`);
} finally {
  await prisma.$disconnect();
}