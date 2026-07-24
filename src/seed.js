require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedArmada() {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(path.join(__dirname, '../AGEN_DAMRI - Master_Armada 2.csv'))
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                for (const row of results) {
                    await prisma.armada.upsert({
                        where: { idArmada: row.id_armada },
                        update: {},
                        create: {
                            idArmada: row.id_armada,
                            namaArmada: row.nama_armada,
                            tujuanArmada: row.tujuan_armada,
                            jam: row.jam,
                            harga: row.harga,
                            seat: parseInt(row.Seat) || 45
                        }
                    });
                }
                console.log('Seeded Armada successfully');
                resolve();
            });
    });
}

async function seedBookings() {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(path.join(__dirname, '../AGEN_DAMRI - Master_Data.csv'))
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                for (const row of results) {
                    // Cek jika ID kosong, skip
                    if (!row.ID_TIKET) continue;
                    
                    let parsedHarga = 0;
                    if (row.Harga) {
                        parsedHarga = parseInt(row.Harga.replace(/\D/g, '')) || 0;
                    }
                    
                    let parsedTotal = 0;
                    if (row['Total Harga']) {
                        parsedTotal = parseInt(row['Total Harga'].replace(/\D/g, '')) || 0;
                    }

                    await prisma.booking.upsert({
                        where: { bookingId: row.ID_TIKET },
                        update: {},
                        create: {
                            bookingId: row.ID_TIKET,
                            createdAt: row.Timestamp || new Date().toISOString(),
                            tanggalPemberangkatan: row['TANGGAL PEMBERANGKATAN'] || '',
                            jenisKendaraan: row['JENIS KENDARAAN'] || '',
                            tujuan: row['Tujuan'] || '',
                            harga: parsedHarga,
                            nama: row['NAMA'] || '',
                            nomorHp: row['NOMOR HP'] || '',
                            jumlahPnp: parseInt(row['JUMLAH PNP']) || 1,
                            waktu: row['WAKTU'] || '',
                            nomorKursi: row['NOMOR KURSI'] || '',
                            keterangan: row['KETERANGAN'] || '',
                            totalHarga: parsedTotal,
                            pembayaran: row['PEMBAYARAN'] || 'WAITING',
                            status: row['PEMBAYARAN'] === 'LUNAS' || row['PEMBAYARAN'] === 'ACC' ? 'LUNAS' : 'WAITING',
                            komisi: 0,
                            totalKomisi: 0
                        }
                    });
                }
                console.log('Seeded Bookings successfully');
                resolve();
            });
    });
}

async function main() {
    try {
        console.log('Starting seed...');
        await seedArmada();
        await seedBookings();
        console.log('Seed completed successfully');
    } catch (e) {
        console.error('Error during seed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
