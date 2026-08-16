require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.io Broadcaster for modifying actions
app.use('/api', (req, res, next) => {
    if (req.method === 'POST') {
        const originalJson = res.json;
        res.json = function(body) {
            if (body && body.status === 'success') {
                let action = req.body?.action;
                if (typeof req.body === 'string') {
                    try { action = JSON.parse(req.body).action; } catch(e) {}
                }
                if (action && action !== 'loginAdmin') {
                    io.emit('data_updated');
                }
            }
            return originalJson.call(this, body);
        };
    }
    next();
});

// Token parsing middleware
app.use((req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (!err) req.user = user;
        });
    }
    next();
});

// Serve frontend build from /public
app.use(express.static(path.join(__dirname, '../public')));

// Helper untuk parse tanggal dari format campuran (DD/MM/YYYY atau ISO)
function parseCustomDate(dateStr) {
    if (!dateStr) return new Date(0);
    if (dateStr.includes('T')) return new Date(dateStr);
    
    const parts = dateStr.split(' ');
    const dParts = parts[0].split('/');
    if (dParts.length === 3) {
        const day = parseInt(dParts[0], 10);
        const month = parseInt(dParts[1], 10) - 1;
        const year = parseInt(dParts[2], 10);
        
        const timePart = parts[1] || '00.00.00';
        const tParts = timePart.split('.');
        const hour = parseInt(tParts[0], 10) || 0;
        const min = parseInt(tParts[1], 10) || 0;
        const sec = parseInt(tParts[2], 10) || 0;
        
        return new Date(year, month, day, hour, min, sec);
    }
    return new Date(dateStr);
}

// Helper untuk menyimpan data pelanggan secara otomatis
function normalizeHp(hp) {
    if (!hp) return hp;
    let norm = hp.replace(/[-\s]/g, '');
    if (norm.startsWith('+62')) norm = '0' + norm.substring(3);
    else if (norm.startsWith('62') && norm.length > 3) norm = '0' + norm.substring(2);
    else if (norm.startsWith('+')) norm = norm.replace(/^\+(\d{1,3})/, '0');
    return norm;
}

async function upsertPelanggan(hp, nama, alamat) {
    if (!hp || hp.trim() === '' || hp.trim() === '-') return;
    try {
        const hpTrim = normalizeHp(hp);
        const namaTrim = nama ? nama.trim() : 'Tanpa Nama';
        const alamatTrim = alamat ? alamat.trim() : '-';
        await prisma.pelanggan.upsert({
            where: { nomorHp: hpTrim },
            update: { totalBooking: { increment: 1 }, alamat: alamatTrim !== '-' ? alamatTrim : undefined },
            create: { nomorHp: hpTrim, nama: namaTrim, alamat: alamatTrim, totalBooking: 1 }
        });
    } catch (e) {
        console.error('Failed to upsert pelanggan:', e);
    }
}

// API Endpoints
app.get('/api', async (req, res) => {
    const action = req.query.action;

    try {
        const publicActions = ['getArmada', 'getBookingById', 'getPelangganTable'];
        if (!publicActions.includes(action) && !req.user) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        if (action === 'getBookingById') {
            const id = req.query.id;
            if (!id) return res.status(400).json({ status: 'error', message: 'ID_TIKET is required' });
            
            const booking = await prisma.booking.findFirst({
                where: { bookingId: id }
            });
            
            if (!booking) return res.json({ status: 'success', data: null });
            
            const formattedBooking = {
                'Timestamp': booking.createdAt,
                'TANGGAL PEMBERANGKATAN': booking.tanggalPemberangkatan,
                'ID_TIKET': booking.bookingId,
                'JENIS KENDARAAN': booking.jenisKendaraan,
                'Tujuan': booking.tujuan,
                'Harga': booking.harga,
                'NAMA': booking.nama,
                'NOMOR HP': booking.nomorHp,
                'JUMLAH PNP': booking.jumlahPnp,
                'WAKTU': booking.waktu,
                'NOMOR KURSI': booking.nomorKursi,
                'KETERANGAN': booking.keterangan,
                'Total Harga': booking.totalHarga,
                'PEMBAYARAN': booking.pembayaran,
                'Status': booking.status
            };
            return res.json({ status: 'success', data: formattedBooking });
        }

        if (action === 'getBookings') {
            const bookings = await prisma.booking.findMany();
            // Sort in memory for accurate chronological order regardless of string format
            bookings.sort((a, b) => parseCustomDate(b.createdAt) - parseCustomDate(a.createdAt));
            // Google Sheets script returns raw array for bookings, we need to mimic the previous Google Sheets structure exactly
            const formattedBookings = bookings.map(b => ({
                'Timestamp': b.createdAt,
                'TANGGAL PEMBERANGKATAN': b.tanggalPemberangkatan,
                'ID_TIKET': b.bookingId,
                'JENIS KENDARAAN': b.jenisKendaraan,
                'Tujuan': b.tujuan,
                'Harga': b.harga,
                'NAMA': b.nama,
                'NOMOR HP': b.nomorHp,
                'JUMLAH PNP': b.jumlahPnp,
                'WAKTU': b.waktu,
                'NOMOR KURSI': b.nomorKursi,
                'KETERANGAN': b.keterangan,
                'Total Harga': b.totalHarga,
                'PEMBAYARAN': b.pembayaran,
                'Status': b.status
            }));
            return res.json({ status: 'success', data: formattedBookings });
        }
        
        if (action === 'getArmada') {
            const armadas = await prisma.armada.findMany({
                orderBy: { namaArmada: 'asc' }
            });
            const formattedArmadas = armadas.map(a => ({
                'id_armada': a.idArmada,
                'nama_armada': a.namaArmada,
                'tujuan_armada': a.tujuanArmada,
                'jam': a.jam,
                'harga': a.harga,
                'Seat': a.seat,
                'is_active': a.isActive
            }));
            return res.json({ status: 'success', data: formattedArmadas });
        }
        
        if (action === 'getHargaKhusus') {
            const hargaKhusus = await prisma.hargaKhusus.findMany({
                orderBy: { tanggalAwal: 'desc' }
            });
            return res.json({ status: 'success', data: hargaKhusus });
        }
        
        if (action === 'getEkstraBookings') {
            const bookings = await prisma.ekstraBooking.findMany();
            // Sort in memory for accurate chronological order
            bookings.sort((a, b) => parseCustomDate(b.createdAt) - parseCustomDate(a.createdAt));
            return res.json({ status: 'success', data: bookings });
        }
        
        if (action === 'getLaporan') {
            const laporan = await prisma.booking.findMany();
            // Sort in memory for accurate chronological order
            laporan.sort((a, b) => parseCustomDate(b.createdAt) - parseCustomDate(a.createdAt));
            const formattedLaporan = laporan.map(l => ({
                'Timestamp': l.createdAt,
                'TANGGAL PEMBERANGKATAN': l.tanggalPemberangkatan,
                'ID_TIKET': l.bookingId,
                'JENIS KENDARAAN': l.jenisKendaraan,
                'Tujuan': l.tujuan,
                'Harga': l.harga,
                'NAMA': l.nama,
                'NOMOR HP': l.nomorHp,
                'JUMLAH PNP': l.jumlahPnp,
                'WAKTU': l.waktu,
                'NOMOR KURSI': l.nomorKursi,
                'KETERANGAN': l.keterangan,
                'Total Harga': l.totalHarga,
                'Komisi': l.komisi,
                'Total Komisi': l.totalKomisi,
                'PEMBAYARAN': l.pembayaran
            }));
            return res.json({ status: 'success', data: formattedLaporan });
        }

        if (action === 'getAdmin') {
            const admins = await prisma.admin.findMany();
            const formattedAdmins = admins.map(a => ({
                id: a.id,
                Username: a.username
            }));
            return res.json({ status: 'success', data: formattedAdmins });
        }

        if (action === 'getPelanggan') {
            const pelanggan = await prisma.pelanggan.findMany({
                orderBy: { totalBooking: 'desc' }
            });
            return res.json({ status: 'success', data: pelanggan });
        }
        
        
        if (action === 'getPelangganTable') {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 25;
            const search = req.query.search || '';
            
            const whereClause = search ? {
                OR: [
                    { nama: { contains: search } },
                    { nomorHp: { contains: search } }
                ]
            } : {};
            
            const total = await prisma.pelanggan.count({ where: whereClause });
            const pelangganList = await prisma.pelanggan.findMany({
                where: whereClause,
                orderBy: { totalBooking: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            });
            
            return res.json({ 
                status: 'success', 
                data: pelangganList,
                page: page,
                totalPages: Math.ceil(total / limit) || 1,
                totalItems: total
            });
        }

        if (action === 'cariPelanggan') {
            const q = req.query.q;
            if (!q || q.length < 2) return res.json({ status: 'success', data: [] });
            
            const results = await prisma.pelanggan.findMany({
                where: {
                    OR: [
                        { nama: { contains: q } },
                        { nomorHp: { contains: q } }
                    ]
                },
                take: 10,
                orderBy: { totalBooking: 'desc' }
            });
            return res.json({ status: 'success', data: results });
        }

        return res.status(400).json({ status: 'error', message: 'Action not found' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 'error', message: 'Server error' });
    }
});


app.get('/api/export-pelanggan', async (req, res) => {
    try {
        const token = req.query.token;
        if (!token) return res.status(401).send('Unauthorized');
        try {
            jwt.verify(token, JWT_SECRET);
        } catch(err) {
            return res.status(401).send('Invalid token');
        }

        const pelanggan = await prisma.pelanggan.findMany({
            orderBy: { totalBooking: 'desc' }
        });
        
        let csvContent = 'Nama Pelanggan,Nomor HP,Total Booking,Terdaftar Sejak\n';
        pelanggan.forEach(p => {
            const date = new Date(p.createdAt).toLocaleDateString('id-ID');
            const safeNama = (p.nama || '').replace(/"/g, '""');
            csvContent += `"${safeNama}","${p.nomorHp}",${p.totalBooking},"${date}"\n`;
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="Data_Pelanggan_Loyal.csv"');
        return res.send(csvContent);
    } catch (err) {
        console.error('Export Error:', err);
        res.status(500).send('Failed to export pelanggan');
    }
});

app.get('/api/export', async (req, res) => {
    try {
        const token = req.query.token;
        if (!token) return res.status(401).send('Unauthorized');
        
        try {
            jwt.verify(token, JWT_SECRET);
        } catch(err) {
            return res.status(401).send('Invalid token');
        }

        const xlsx = require('xlsx');
        const bookings = await prisma.booking.findMany();
        const armadas = await prisma.armada.findMany();
        const ekstraBookings = await prisma.ekstraBooking.findMany();

        // Format bookings for better readability in Excel
        const formattedBookings = bookings.map(l => ({
            'Timestamp': l.createdAt,
            'ID_TIKET': l.bookingId,
            'TANGGAL PEMBERANGKATAN': l.tanggalPemberangkatan,
            'NAMA': l.nama,
            'NOMOR HP': l.nomorHp,
            'JENIS KENDARAAN': l.jenisKendaraan,
            'Tujuan': l.tujuan,
            'JUMLAH PNP': l.jumlahPnp,
            'WAKTU': l.waktu,
            'NOMOR KURSI': l.nomorKursi,
            'Harga': l.harga,
            'Total Harga': l.totalHarga,
            'Komisi': l.komisi,
            'Total Komisi': l.totalKomisi,
            'PEMBAYARAN': l.pembayaran,
            'KETERANGAN': l.keterangan
        }));

        const wb = xlsx.utils.book_new();
        
        const wsBookings = xlsx.utils.json_to_sheet(formattedBookings);
        xlsx.utils.book_append_sheet(wb, wsBookings, 'Daftar Pesanan');
        
        const wsArmada = xlsx.utils.json_to_sheet(armadas);
        xlsx.utils.book_append_sheet(wb, wsArmada, 'Data Armada');

        const wsEkstra = xlsx.utils.json_to_sheet(ekstraBookings);
        xlsx.utils.book_append_sheet(wb, wsEkstra, 'Pesanan Ekstra');

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', 'attachment; filename="Backup_Database_Damri.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        console.error('Export Error:', err);
        res.status(500).send('Failed to export database');
    }
});

app.post('/api', async (req, res) => {
    try {
        const body = req.body;
        // Check if payload needs to be parsed (if frontend sends stringified body)
        let data = body;
        if (typeof body === 'string') {
            data = JSON.parse(body);
        }
        
        const { action, payload } = data;

        const publicActions = ['addBooking', 'loginAdmin'];
        if (!publicActions.includes(action) && !req.user) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        if (action === 'addBooking') {
            const harga = payload['Harga'] ? parseInt(payload['Harga'].toString().replace(/\D/g,'')) || 0 : 0;
            const totalHarga = parseInt(payload['Total Harga']) || harga * (parseInt(payload['JUMLAH PNP']) || 1);
            
            const newBooking = await prisma.booking.create({
                data: {
                    bookingId: payload['ID_TIKET'],
                    createdAt: new Date().toISOString(),
                    tanggalPemberangkatan: payload['TANGGAL PEMBERANGKATAN'],
                    jenisKendaraan: payload['JENIS KENDARAAN'],
                    tujuan: payload['Tujuan'],
                    harga: harga,
                    nama: payload['NAMA'],
                    nomorHp: payload['NOMOR HP'],
                    jumlahPnp: parseInt(payload['JUMLAH PNP']) || 1,
                    waktu: payload['WAKTU'],
                    nomorKursi: payload['NOMOR KURSI'] || '',
                    keterangan: payload['KETERANGAN'] || payload['Keterangan'] || payload['keterangan'] || '',
                    alamat: payload['ALAMAT'] || payload['alamat'] || '-',
                    totalHarga: totalHarga,
                    pembayaran: payload['PEMBAYARAN'] || 'CASH',
                    status: payload['Status'] ? payload['Status'] : (payload['PEMBAYARAN'] === 'LUNAS' || payload['PEMBAYARAN'] === 'ACC' ? 'LUNAS' : 'WAITING'),
                    komisi: harga * 0.1,
                    totalKomisi: totalHarga * 0.1,
                }
            });
            
            // Upsert pelanggan
            payload['NOMOR HP'] = normalizeHp(payload['NOMOR HP']);
            await upsertPelanggan(payload['NOMOR HP'], payload['NAMA'], payload['ALAMAT'] || payload['alamat']);
            
            return res.json({ status: 'success', message: 'Booking berhasil', data: newBooking });
        }

        if (action === 'updateStatus') {
            const { id_tiket, status } = payload;
            
            await prisma.booking.updateMany({
                where: { bookingId: id_tiket },
                data: { 
                    pembayaran: status,
                    status: status 
                }
            });
            
            return res.json({ status: 'success', message: 'Status berhasil diupdate' });
        }

        if (action === 'deleteBooking') {
            const { id_tiket } = payload;
            await prisma.booking.delete({
                where: { bookingId: id_tiket }
            });
            return res.json({ status: 'success', message: 'Data pesanan ditolak dan dihapus' });
        }

        if (action === 'editBookingData') {
            const { id_tiket, nama, hp, tanggalPemberangkatan, jenisKendaraan, tujuan, jumlahPnp, harga, totalHarga, waktu, nomorKursi, status, keterangan, alamat } = payload;
            
            const updateData = {
                nama: nama,
                nomorHp: hp,
                tanggalPemberangkatan: tanggalPemberangkatan,
                jenisKendaraan: jenisKendaraan,
                tujuan: tujuan,
                jumlahPnp: parseInt(jumlahPnp) || 1,
                waktu: waktu,
                nomorKursi: nomorKursi || '',
                harga: parseInt(harga) || 0,
                totalHarga: parseInt(totalHarga) || 0,
                komisi: (parseInt(harga) || 0) * 0.1,
                totalKomisi: (parseInt(totalHarga) || 0) * 0.1
            };
            if (status) {
                updateData.status = status;
                updateData.pembayaran = status;
            }
            if (keterangan !== undefined) updateData.keterangan = keterangan;

            await prisma.booking.update({
                where: { bookingId: id_tiket },
                data: updateData
            });
            return res.json({ status: 'success', message: 'Data pesanan berhasil diperbarui' });
        }

        if (action === 'addArmada') {
            const { nama_armada, tujuan_armada, jam, harga, seat } = payload;
            const newArmada = await prisma.armada.create({
                data: {
                    idArmada: 'ARM' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
                    namaArmada: nama_armada,
                    tujuanArmada: tujuan_armada,
                    jam: jam,
                    harga: harga.toString(),
                    seat: parseInt(seat) || 40
                }
            });
            return res.json({ status: 'success', message: 'Armada berhasil ditambahkan', data: newArmada });
        }

        if (action === 'editArmadaData') {
            const { id_armada, nama_armada, tujuan_armada, jam, harga, seat } = payload;
            await prisma.armada.update({
                where: { idArmada: id_armada },
                data: {
                    namaArmada: nama_armada,
                    tujuanArmada: tujuan_armada,
                    jam: jam,
                    harga: harga.toString(),
                    seat: parseInt(seat) || 40
                }
            });
            return res.json({ status: 'success', message: 'Data armada berhasil diperbarui' });
        }

        if (action === 'toggleArmadaStatus') {
            const { id_armada, is_active } = payload;
            await prisma.armada.update({
                where: { idArmada: id_armada },
                data: { isActive: is_active }
            });
            return res.json({ status: 'success', message: `Status armada berhasil ${is_active ? 'diaktifkan' : 'dinonaktifkan'}` });
        }

        if (action === 'deleteArmada') {
            const { id_armada } = payload;
            await prisma.armada.delete({
                where: { idArmada: id_armada }
            });
            return res.json({ status: 'success', message: 'Data armada berhasil dihapus' });
        }

        if (action === 'addHargaKhususMassal') {
            const { idArmadaList, tanggalAwal, tanggalAkhir, hargaBaru } = payload;
            
            if (!Array.isArray(idArmadaList) || idArmadaList.length === 0) {
                return res.json({ status: 'error', message: 'Tidak ada armada yang dipilih.' });
            }

            const startNew = new Date(tanggalAwal).getTime();
            const endNew = new Date(tanggalAkhir).getTime();
            
            let idListToCheck = [];
            // Untuk tiap rute (idArmada), kita harus kumpulkan semua jamnya (armada lain dengan nama & tujuan sama)
            // agar pengecekan overlap mencakup semuanya.
            for (let id of idArmadaList) {
                const targetArmada = await prisma.armada.findUnique({ where: { idArmada: id } });
                if (targetArmada) {
                    const relatedArmadas = await prisma.armada.findMany({
                        where: { namaArmada: targetArmada.namaArmada, tujuanArmada: targetArmada.tujuanArmada },
                        select: { idArmada: true }
                    });
                    relatedArmadas.forEach(r => idListToCheck.push(r.idArmada));
                }
            }

            // Hapus duplikat ID
            idListToCheck = [...new Set(idListToCheck)];
            
            // Cek apakah ada yang overlap untuk rute-rute tersebut
            const existing = await prisma.hargaKhusus.findMany({
                where: { idArmada: { in: idListToCheck } }
            });
            
            let isOverlap = false;
            for (let e of existing) {
                let startE = new Date(e.tanggalAwal).getTime();
                let endE = new Date(e.tanggalAkhir).getTime();
                if (startNew <= endE && endNew >= startE) {
                    isOverlap = true;
                    break;
                }
            }
            
            if (isOverlap) {
                return res.json({ status: 'error', message: 'Rentang tanggal bertabrakan dengan harga khusus yang sudah ada untuk armada/rute yang dipilih.' });
            }

            // Insert massal
            const dataToInsert = idArmadaList.map(id => ({
                idArmada: id,
                tanggalAwal,
                tanggalAkhir,
                hargaBaru: hargaBaru.toString()
            }));

            const baru = await prisma.hargaKhusus.createMany({
                data: dataToInsert
            });
            
            return res.json({ status: 'success', message: 'Harga Khusus Massal berhasil ditambahkan', count: baru.count });
        }

        if (action === 'deleteHargaKhusus') {
            const { id } = payload;
            await prisma.hargaKhusus.delete({
                where: { id: id }
            });
            return res.json({ status: 'success', message: 'Harga Khusus berhasil dihapus' });
        }

        if (action === 'deleteHargaKhususMassal') {
            const { ids } = payload;
            if (!Array.isArray(ids) || ids.length === 0) {
                return res.json({ status: 'error', message: 'Tidak ada data yang dihapus' });
            }
            
            const result = await prisma.hargaKhusus.deleteMany({
                where: { id: { in: ids } }
            });
            
            return res.json({ status: 'success', message: 'Harga Khusus berhasil dihapus', count: result.count });
        }

        if (action === 'addEkstraBooking') {
            const { tipe, vendor, rute, tanggalBerangkat, jamBerangkat, kodeBooking, namaPenumpang, statusPembayaran } = payload;
            
            let parsedPnp = [];
            let sumHargaBase = 0;
            try {
                const parsed = JSON.parse(namaPenumpang);
                if (parsed && parsed.pnp && Array.isArray(parsed.pnp)) {
                    parsedPnp = parsed.pnp;
                } else if (Array.isArray(parsed)) {
                    parsedPnp = parsed;
                }
                parsedPnp.forEach(p => sumHargaBase += parseInt(p.harga) || 0);
            } catch (e) {
                sumHargaBase = 0;
            }

            const pnpCount = parsedPnp.length > 0 ? parsedPnp.length : 1;
            const adminFee = pnpCount * 25000;
            const komisi = tipe === 'PESAWAT' ? Math.floor(sumHargaBase * 0.10) : Math.floor(sumHargaBase * 0.25);
            const totalHarga = sumHargaBase + adminFee;

            const newBooking = await prisma.ekstraBooking.create({
                data: {
                    tipe: tipe,
                    vendor: vendor,
                    rute: rute,
                    tanggalBerangkat: tanggalBerangkat,
                    jamBerangkat: jamBerangkat,
                    kodeBooking: kodeBooking || '',
                    namaPenumpang: namaPenumpang,
                    hargaTiket: sumHargaBase,
                    totalHarga: totalHarga,
                    komisi: komisi,
                    statusPembayaran: statusPembayaran || 'LUNAS',
                    createdAt: new Date().toISOString()
                }
            });
            return res.json({ status: 'success', message: 'Tiket berhasil ditambahkan', data: newBooking });
        }

        if (action === 'editEkstraBooking') {
            const { id, tipe, vendor, rute, tanggalBerangkat, jamBerangkat, kodeBooking, namaPenumpang, statusPembayaran } = payload;
            
            let parsedPnp = [];
            let sumHargaBase = 0;
            try {
                const parsed = JSON.parse(namaPenumpang);
                if (parsed && parsed.pnp && Array.isArray(parsed.pnp)) {
                    parsedPnp = parsed.pnp;
                } else if (Array.isArray(parsed)) {
                    parsedPnp = parsed;
                }
                parsedPnp.forEach(p => sumHargaBase += parseInt(p.harga) || 0);
            } catch (e) {
                sumHargaBase = 0;
            }

            const pnpCount = parsedPnp.length > 0 ? parsedPnp.length : 1;
            const adminFee = pnpCount * 25000;
            const komisi = tipe === 'PESAWAT' ? Math.floor(sumHargaBase * 0.10) : Math.floor(sumHargaBase * 0.25);
            const totalHarga = sumHargaBase + adminFee;

            await prisma.ekstraBooking.update({
                where: { id: id },
                data: {
                    tipe: tipe,
                    vendor: vendor,
                    rute: rute,
                    tanggalBerangkat: tanggalBerangkat,
                    jamBerangkat: jamBerangkat,
                    kodeBooking: kodeBooking || '',
                    namaPenumpang: namaPenumpang,
                    hargaTiket: sumHargaBase,
                    totalHarga: totalHarga,
                    komisi: komisi,
                    statusPembayaran: statusPembayaran
                }
            });
            return res.json({ status: 'success', message: 'Data tiket berhasil diperbarui' });
        }

        if (action === 'deleteEkstraBooking') {
            const { id } = payload;
            await prisma.ekstraBooking.delete({
                where: { id: id }
            });
            return res.json({ status: 'success', message: 'Tiket berhasil dihapus' });
        }

        if (action === 'loginAdmin') {
            const { username, password } = payload;
            const admin = await prisma.admin.findUnique({ where: { username } });
            if (admin && admin.password === password) {
                const token = jwt.sign({ username: admin.username, id: admin.id }, JWT_SECRET, { expiresIn: '1d' });
                return res.json({ status: 'success', message: 'Login berhasil', token });
            }
            return res.json({ status: 'error', message: 'Username atau password salah' });
        }

        if (action === 'addAdmin') {
            const { username, password } = payload;
            const existing = await prisma.admin.findUnique({ where: { username } });
            if (existing) {
                return res.json({ status: 'error', message: 'Username sudah digunakan' });
            }
            await prisma.admin.create({ data: { username, password } });
            return res.json({ status: 'success', message: 'Admin berhasil ditambahkan' });
        }

        if (action === 'editAdmin') {
            const { id, username, password } = payload;
            const existing = await prisma.admin.findUnique({ where: { username } });
            if (existing && existing.id !== id) {
                return res.json({ status: 'error', message: 'Username sudah digunakan' });
            }
            const updateData = { username };
            if (password && password.trim() !== '') {
                updateData.password = password;
            }
            await prisma.admin.update({
                where: { id },
                data: updateData
            });
            return res.json({ status: 'success', message: 'Admin berhasil diperbarui' });
        }

        if (action === 'deleteAdmin') {
            const { id } = payload;
            const count = await prisma.admin.count();
            if (count <= 1) {
                return res.json({ status: 'error', message: 'Tidak dapat menghapus admin terakhir' });
            }
            await prisma.admin.delete({ where: { id } });
            return res.json({ status: 'success', message: 'Admin berhasil dihapus' });
        }

        
        if (action === 'editPelanggan') {
            const { nomorHp, namaBaru, alamatBaru } = payload;
            await prisma.pelanggan.update({
                where: { nomorHp: nomorHp },
                data: { nama: namaBaru, alamat: alamatBaru || "-" }
            });
            return res.json({ status: 'success', message: 'Nama pelanggan berhasil diubah' });
        }

        if (action === 'deletePelanggan') {
            const { nomorHp } = payload;
            await prisma.pelanggan.delete({
                where: { nomorHp: nomorHp }
            });
            return res.json({ status: 'success', message: 'Pelanggan berhasil dihapus dari kontak' });
        }

        if (action === 'migratePelanggan') {
            const bookings = await prisma.booking.findMany({
                orderBy: { createdAt: 'desc' }
            });
            const pelangganMap = new Map();
            for (const b of bookings) {
                if (!b.nomorHp || b.nomorHp.trim() === '' || b.nomorHp.trim() === '-') continue;
                const hp = b.nomorHp.trim();
                const nama = b.nama ? b.nama.trim() : 'Tanpa Nama';
                if (!pelangganMap.has(hp)) {
                    pelangganMap.set(hp, { nomorHp: hp, nama: nama, totalBooking: 1 });
                } else {
                    pelangganMap.get(hp).totalBooking += 1;
                }
            }
            const pelangganList = Array.from(pelangganMap.values());
            let inserted = 0;
            for (const p of pelangganList) {
                try {
                    await prisma.pelanggan.upsert({
                        where: { nomorHp: p.nomorHp },
                        update: { totalBooking: p.totalBooking },
                        create: p
                    });
                    inserted++;
                } catch(e){}
            }
            return res.json({ status: 'success', message: `Migrasi selesai. ${inserted} pelanggan diproses.` });
        }

        return res.status(400).json({ status: 'error', message: 'Action not found' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

app.get('/api/migrate-pelanggan', async (req, res) => {
    try {
        const result = require('child_process').execSync('node src/migrate-pelanggan.js').toString();
        res.json({status: 'success', message: 'Migration completed', log: result});
    } catch (e) {
        res.status(500).json({status: 'error', message: e.message});
    }
});

app.get('/api/normalize-hp', async (req, res) => {
    try {
        const result = require('child_process').execSync('node src/normalize-hp.js').toString();
        res.json({status: 'success', message: 'Normalization completed', log: result});
    } catch (e) {
        res.status(500).json({status: 'error', message: e.message});
    }
});
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
