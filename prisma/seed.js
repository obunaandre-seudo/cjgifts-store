import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const directDatabaseUrl = process.env.DATABASE_URL?.trim();
if (!directDatabaseUrl || new URL(directDatabaseUrl).protocol !== 'postgresql:') {
  throw new Error('DATABASE_URL must be set to the direct Neon PostgreSQL connection string to seed.');
}
const prisma = new PrismaClient({ datasources: { db: { url: directDatabaseUrl } } });

const deliveryZones = [
  { code: 'NG', country: 'Nigeria', shippingFee: '6975', active: true },
  { code: 'US', country: 'United States', shippingFee: '18600', active: true },
  { code: 'GB', country: 'United Kingdom', shippingFee: '21700', active: true },
  { code: 'KE', country: 'Kenya', shippingFee: '13950', active: true }
];

try {
  await prisma.$transaction(deliveryZones.map((zone) => prisma.deliveryZone.upsert({
    where: { code: zone.code },
    update: { country: zone.country, shippingFee: zone.shippingFee, active: zone.active },
    create: zone
  })));
  console.log(`Seeded ${deliveryZones.length} delivery zones; existing products and customer data were not changed.`);
} finally {
  await prisma.$disconnect();
}
