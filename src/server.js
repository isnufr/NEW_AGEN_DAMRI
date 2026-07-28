require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// API Endpoints
app.get('/api', async (req, res) => {
    const action = req.query.action;

    try {
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
                'Seat': a.seat
            }));
            return res.json({ status: 'success', data: formattedArmadas });
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

        return res.status(400).json({ status: 'error', message: 'Action not found' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 'error', message: 'Server error' });
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
                    totalHarga: totalHarga,
                    pembayaran: payload['PEMBAYARAN'] || 'CASH',
                    status: payload['Status'] ? payload['Status'] : (payload['PEMBAYARAN'] === 'LUNAS' || payload['PEMBAYARAN'] === 'ACC' ? 'LUNAS' : 'WAITING'),
                    komisi: harga * 0.1,
                    totalKomisi: totalHarga * 0.1,
                }
            });
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
            const { id_tiket, nama, hp, tanggalPemberangkatan, jenisKendaraan, tujuan, jumlahPnp, harga, totalHarga, waktu, nomorKursi, status, keterangan } = payload;
            
            const updateData = {
                nama: nama,
                nomorHp: hp,
                tanggalPemberangkatan: tanggalPemberangkatan,
                jenisKendaraan: jenisKendaraan,
                tujuan: tujuan,
                jumlahPnp: parseInt(jumlahPnp) || 1,
                waktu: waktu,
                nomorKursi: nomorKursi || '',
                totalHarga: parseInt(totalHarga) || 0,
                komisi: parseInt(harga) * 0.1,
                totalKomisi: parseInt(totalHarga) * 0.1
            };
            if (status) updateData.status = status;
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

        if (action === 'deleteArmada') {
            const { id_armada } = payload;
            await prisma.armada.delete({
                where: { idArmada: id_armada }
            });
            return res.json({ status: 'success', message: 'Data armada berhasil dihapus' });
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
            const komisi = tipe === 'PESAWAT' ? Math.floor(sumHargaBase * 0.15) : Math.floor(sumHargaBase * 0.25);
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
            const komisi = tipe === 'PESAWAT' ? Math.floor(sumHargaBase * 0.15) : Math.floor(sumHargaBase * 0.25);
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
                return res.json({ status: 'success', message: 'Login berhasil' });
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

        return res.status(400).json({ status: 'error', message: 'Action not found' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
