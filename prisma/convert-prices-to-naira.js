import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const USD_TO_NGN = 1550;

try {
  const products = await prisma.product.findMany({ where: { priceCurrency: 'USD' } });

  await prisma.$transaction(products.map((product) => prisma.product.update({
    where: { id: product.id },
    data: {
      price: product.price.mul(USD_TO_NGN),
      salePrice: product.salePrice === null ? null : product.salePrice.mul(USD_TO_NGN),
      priceCurrency: 'NGN'
    }
  })));

  console.log(`Converted ${products.length} product(s) from USD to NGN at ₦${USD_TO_NGN}/USD.`);
} finally {
  await prisma.$disconnect();
}
