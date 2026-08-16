require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normalizeHp(hp) {
    if (!hp) return hp;
    // Hapus semua spasi dan minus
    let norm = hp.replace(/[-\s]/g, '');
    
    // Ubah awalan +62 menjadi 0
    if (norm.startsWith('+62')) {
        norm = '0' + norm.substring(3);
    }
    // Ubah awalan 62 menjadi 0
    else if (norm.startsWith('62') && norm.length > 3) {
        norm = '0' + norm.substring(2);
    }
    // Ubah awalan + apa pun (jika masih ada) menjadi 0
    else if (norm.startsWith('+')) {
        norm = norm.replace(/^\+(\d{1,3})/, '0');
    }

    return norm;
}

async function main() {
    console.log('Memulai normalisasi nomor HP...');

    // 1. Normalisasi tabel Booking
    const bookings = await prisma.booking.findMany();
    let updatedBookings = 0;

    for (const b of bookings) {
        if (!b.nomorHp || b.nomorHp.trim() === '' || b.nomorHp.trim() === '-') continue;

        const normHp = normalizeHp(b.nomorHp);
        
        // Jika beda dengan yang lama, update
        if (normHp !== b.nomorHp) {
            await prisma.booking.update({
                where: { bookingId: b.bookingId },
                data: { nomorHp: normHp }
            });
            updatedBookings++;
        }
    }
    console.log(`Berhasil menormalisasi ${updatedBookings} nomor HP di tabel Booking.`);

    // 2. Bersihkan ulang (Re-build) tabel Pelanggan
    console.log('Menghitung ulang data Pelanggan...');
    
    await prisma.pelanggan.deleteMany({});
    
    const cleanBookings = await prisma.booking.findMany({
        orderBy: { createdAt: 'desc' }
    });

    const pelangganMap = new Map();

    for (const b of cleanBookings) {
        if (!b.nomorHp || b.nomorHp.trim() === '' || b.nomorHp.trim() === '-') continue;
        
        const hp = b.nomorHp; // Sudah bersih
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

    const pelangganList = Array.from(pelangganMap.values());
    console.log(`Ditemukan ${pelangganList.length} pelanggan unik setelah normalisasi.`);
    
    let inserted = 0;
    await prisma.pelanggan.createMany({
        data: pelangganList
    });
    inserted = pelangganList.length;

    console.log(`Selesai! Berhasil menyimpan ${inserted} data pelanggan yang sudah digabung.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
