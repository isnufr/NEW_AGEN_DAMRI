const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration...');
  
  // Ambil semua booking dan urutkan dari yang terbaru
  const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: 'desc' }
  });

  const pelangganMap = new Map();

  for (const b of bookings) {
      if (!b.nomorHp || b.nomorHp.trim() === '' || b.nomorHp.trim() === '-') continue;
      
      const hp = b.nomorHp.trim();
      const nama = b.nama ? b.nama.trim() : 'Tanpa Nama';
      
      if (!pelangganMap.has(hp)) {
          pelangganMap.set(hp, {
              nomorHp: hp,
              nama: nama,
              totalBooking: 1,
              createdAt: new Date()
          });
      } else {
          const p = pelangganMap.get(hp);
          p.totalBooking += 1;
      }
  }

  // Insert ke database
  const pelangganList = Array.from(pelangganMap.values());
  console.log(`Found ${pelangganList.length} unique customers.`);
  
  let inserted = 0;
  for (const p of pelangganList) {
      try {
          await prisma.pelanggan.upsert({
              where: { nomorHp: p.nomorHp },
              update: { totalBooking: p.totalBooking },
              create: p
          });
          inserted++;
      } catch (e) {
          console.error(`Failed to upsert customer ${p.nomorHp}: ${e.message}`);
      }
  }
  
  console.log(`Migration completed. Successfully processed ${inserted} customers.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
