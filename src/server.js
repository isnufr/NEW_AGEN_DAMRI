require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config for banner uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + '-' + Math.random().toString(36).substr(2, 9) + ext);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 4 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
        const mimeOk = allowed.test(file.mimetype.split('/')[1]);
        if (extOk && mimeOk) {
            cb(null, true);
        } else {
            cb(new Error('Format file tidak didukung. Gunakan JPG, PNG, WebP, atau GIF.'));
        }
    }
});

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Performance & Optimization Cache
let cachedArmadaResponse = null;
let lastArmadaFetchTime = 0;
const ARMADA_CACHE_TTL = 30000; // 30 seconds
const memoryTestBookings = {};

function invalidateArmadaCache() {
    cachedArmadaResponse = null;
    lastArmadaFetchTime = 0;
}

// Middleware
app.use(cors());
app.use(compression({
    level: 6,
    threshold: 1024
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.io Broadcaster for modifying actions & automatic cache invalidation
app.use('/api', (req, res, next) => {
    if (req.method === 'POST') {
        const originalJson = res.json;
        res.json = function(body) {
            if (body && (body.status === 'success' || body.success)) {
                let action = req.body?.action;
                if (typeof req.body === 'string') {
                    try { action = JSON.parse(req.body).action; } catch(e) {}
                }
                invalidateArmadaCache();
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

// Serve frontend build from /public with high-performance caching headers
app.use(express.static(path.join(__dirname, '../public'), {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        } else if (filePath.match(/\.(webp|jpg|jpeg|png|svg|ico|gif|woff2?|ttf|eot)$/i)) {
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        } else if (filePath.match(/\.(css|js)$/i)) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }
}));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads'), {
    maxAge: '7d',
    etag: true,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
}));

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

// Helper Denah Armada (Database with JSON File Fallback & Sync)
const DEFAULT_DENAH_FILE = path.join(__dirname, 'default-denah.json');
const DATA_DIR = path.join(__dirname, '../data');
const CUSTOM_DENAH_FILE = path.join(DATA_DIR, 'denah.json');

if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch(e) {}
}

const TIPE_ARMADA_FILE = path.join(DATA_DIR, 'tipe-armada.json');
const PO_PROFILES_FILE = path.join(DATA_DIR, 'po-profiles.json');
const SITE_CONFIG_FILE = path.join(DATA_DIR, 'site-config.json');
const ARMADA_CACHE_FILE = path.join(DATA_DIR, 'armada-cache.json');

const DEFAULT_SITE_CONFIG = {
    general: {
        namaAgen: "AGEN DAMRI KAWUNGANTEN",
        brandName: "AGEN BUS KAWUNGANTEN",
        tagline: "Pusat Penjualan Tiket Bus, Travel, Pesawat & Kapal",
        deskripsi: "Layanan resmi pemesanan tiket bus DAMRI, Efisiensi, Estu Trans, Best Premium, 77 Trans, Pesawat dan Kapal Laut online di Kawunganten Cilacap.",
        alamat: "Jl. Raya Kawunganten, Desa Kawunganten, Kec. Kawunganten, Kab. Cilacap, Jawa Tengah.",
        googleMapsUrl: "https://maps.app.goo.gl/mFP2Nn4KUyworYe66",
        whatsappUtama: "082133607759",
        whatsappDisplay: "0821-3360-7759",
        jamLayanan: "Setiap Hari (06.00 - 21.00 WIB)",
        runningText: "Selamat Datang di Agen Bus Kawunganten! Melayani tiket resmi bus DAMRI, Efisiensi, Estu Trans, 77 Trans, Best Premium, Travel, Pesawat & Kapal Laut.",
        runningTextActive: true
    },
    hero: {
        badge: "AGEN BUS KAWUNGANTEN",
        titleLine1: "Perjalanan Nyaman",
        titleLine2: "Pesan Tiket Aman",
        subtitle: "Pusat Penjualan Tiket Bus, Travel, Pesawat & Kapal Laut Resmi dan Terpercaya di Kawunganten Cilacap"
    },
    payments: [
        {
            id: "mandiri",
            name: "Transfer Mandiri",
            displayName: "BANK MANDIRI",
            bankName: "Bank Mandiri",
            nomorRekening: "1800013416526",
            atasNama: "ISNU FADKHUL ROIS",
            badgeColor: "#003d79",
            icon: "fa-university",
            isActive: true
        },
        {
            id: "seabank",
            name: "Transfer Seabank",
            displayName: "SEABANK",
            bankName: "SeaBank",
            nomorRekening: "901528007687",
            atasNama: "ISNU FADKHUL ROIS",
            badgeColor: "#f05a28",
            icon: "fa-shield-alt",
            isActive: true
        },
        {
            id: "dana",
            name: "Saldo Dana",
            displayName: "DANA (E-WALLET)",
            bankName: "DANA",
            nomorRekening: "082133607759",
            atasNama: "ISNU FADKHUL ROIS",
            badgeColor: "#118ee9",
            icon: "fa-wallet",
            isActive: true
        },
        {
            id: "qris",
            name: "QRIS AGEN",
            displayName: "QRIS SCAN (OTOMATIS)",
            bankName: "QRIS SCAN",
            nomorRekening: "SCAN KODE QR DI ATAS",
            atasNama: "AGEN DAMRI KAWUNGANTEN",
            badgeColor: "#0f172a",
            icon: "fa-qrcode",
            qrisImage: "qris.webp",
            isActive: true
        },
        {
            id: "bca",
            name: "Transfer BCA",
            displayName: "BANK BCA",
            bankName: "Bank BCA",
            nomorRekening: "",
            atasNama: "ISNU FADKHUL ROIS",
            badgeColor: "#003d79",
            icon: "fa-university",
            isActive: false
        },
        {
            id: "bri",
            name: "Transfer BRI",
            displayName: "BANK BRI",
            bankName: "Bank BRI",
            nomorRekening: "",
            atasNama: "ISNU FADKHUL ROIS",
            badgeColor: "#00529c",
            icon: "fa-university",
            isActive: false
        }
    ],
    policy: {
        catatanPembayaran: "PENTING: Dimohon untuk melakukan pembayaran sesuai total tagihan sebelum klik BOOKING, lalu sertakan bukti pembayaran saat chat WhatsApp.",
        syaratKetentuan: "Hadir 30 menit sebelum keberangkatan. Tiket yang sudah dibooking tidak bisa dicancel mendadak (max 1x24 jam)."
    },
    social: {
        facebook: "",
        instagram: "",
        tiktok: "",
        website: "agendamrikawunganten.net",
        copyright: "AGEN DAMRI KAWUNGANTEN. ALL RIGHTS RESERVED."
    }
};

let cachedSiteConfigData = null;

function getSiteConfigData() {
    if (cachedSiteConfigData) return cachedSiteConfigData;
    try {
        if (fs.existsSync(SITE_CONFIG_FILE)) {
            const raw = fs.readFileSync(SITE_CONFIG_FILE, 'utf-8');
            if (raw && raw.trim()) {
                cachedSiteConfigData = JSON.parse(raw);
                return cachedSiteConfigData;
            }
        }
        fs.writeFileSync(SITE_CONFIG_FILE, JSON.stringify(DEFAULT_SITE_CONFIG, null, 2));
        cachedSiteConfigData = DEFAULT_SITE_CONFIG;
        return cachedSiteConfigData;
    } catch (e) {
        console.error('Error reading site config:', e);
        return DEFAULT_SITE_CONFIG;
    }
}

function saveSiteConfigData(data) {
    cachedSiteConfigData = data;
    try {
        fs.writeFileSync(SITE_CONFIG_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error saving site config:', e);
    }
}
const DEFAULT_PO_PROFILES = {
    "77 TRANS": {
        "image": "77trans.webp",
        "logo": "",
        "tagline": "Eksekutif & Nyaman",
        "description": "Layanan bus eksekutif full AC, nyaman dan terpercaya melayani rute Jawa Tengah & sekitarnya.",
        "facilities": ["Full AC", "Reclining Seat", "USB Charger", "Bagasi Luas", "Audio / Musik"]
    },
    "ESTU TRANS": {
        "image": "estutrans.webp",
        "logo": "",
        "tagline": "Cepat, Aman & Tepat Waktu",
        "description": "Perjalanan door-to-door dengan armada terawat, supir berpengalaman, dan kenyamanan prima.",
        "facilities": ["Full AC", "Reclining Seat", "Audio Musik", "Air Mineral", "USB Charger"]
    },
    "DAMRI": {
        "image": "damri.webp",
        "logo": "logo.png",
        "tagline": "Pelopor Angkutan Nasional",
        "description": "Layanan bus antar kota dan antar pulau BUMN terpercaya dengan rute terlengkap dan armada standar keselamatan tinggi.",
        "facilities": ["Full AC", "Reclining Seat", "Bagasi Luas", "Charging Port", "Toilet"]
    },
    "BEST PREMIUM": {
        "image": "bestpremium.webp",
        "logo": "",
        "tagline": "Luxury Travel Experience",
        "description": "Layanan travel eksekutif dengan kenyamanan kelas premium dan privasi maksimal sepanjang perjalanan.",
        "facilities": ["Captain Seat", "Full AC", "USB Charger", "Audio Video", "Air Mineral"]
    },
    "EFISIENSI": {
        "image": "efisiensi.webp",
        "logo": "",
        "tagline": "Cepat, Tepat & Terpercaya",
        "description": "Bus cepat eksekutif antar kota dengan armada modern, interior bersih, dan ketepatan waktu tinggi.",
        "facilities": ["Full AC", "Reclining Seat", "Snack & Minum", "Audio TV", "Bagasi Luas"]
    },
    "QYTA TRANS": {
        "image": "qyta.webp",
        "logo": "",
        "tagline": "Sahabat Perjalanan Anda",
        "description": "Shuttle dan travel antar kota dengan armada bersih, nyaman, dan pelayanan ramah keluarga.",
        "facilities": ["Full AC", "Comfort Seat", "Musik / Hiburan", "Driver Berpengalaman", "USB Charger"]
    },
    "RIYAN": {
        "image": "riyan.webp",
        "logo": "",
        "tagline": "Perjalanan Menyenangkan",
        "description": "Layanan bus reguler dan pariwisata terbaik dengan tarif bersahabat dan armada prima.",
        "facilities": ["Full AC", "Reclining Seat", "Bagasi Luas", "Sound System"]
    },
    "ARDY TRANS": {
        "image": "riyan.webp",
        "logo": "",
        "tagline": "Pelayanan Ramah & Aman",
        "description": "Travel dan shuttle antar kota yang handal dengan pelayanan prima dan armada selalu prima.",
        "facilities": ["Full AC", "Reclining Seat", "USB Charger", "Musik"]
    }
};

function loadPoProfilesData() {
    try {
        if (fs.existsSync(PO_PROFILES_FILE)) {
            const raw = fs.readFileSync(PO_PROFILES_FILE, 'utf-8');
            if (raw && raw.trim()) {
                const parsed = JSON.parse(raw);
                return { ...DEFAULT_PO_PROFILES, ...parsed };
            }
        }
        fs.writeFileSync(PO_PROFILES_FILE, JSON.stringify(DEFAULT_PO_PROFILES, null, 2));
        return DEFAULT_PO_PROFILES;
    } catch (e) {
        console.error('Error loading po profiles file:', e);
        return DEFAULT_PO_PROFILES;
    }
}

let cachedPoProfilesMerged = null;

async function getPoProfilesMerged() {
    if (cachedPoProfilesMerged) return cachedPoProfilesMerged;
    let fileProfiles = {};
    try {
        if (fs.existsSync(PO_PROFILES_FILE)) {
            const raw = fs.readFileSync(PO_PROFILES_FILE, 'utf-8');
            if (raw && raw.trim()) fileProfiles = JSON.parse(raw);
        }
    } catch (e) {
        console.error('Error reading po-profiles.json:', e);
    }

    let merged = { ...DEFAULT_PO_PROFILES, ...fileProfiles };

    try {
        if (prisma.poProfile) {
            const dbProfiles = await prisma.poProfile.findMany();
            if (dbProfiles && dbProfiles.length > 0) {
                for (const item of dbProfiles) {
                    let fac = [];
                    try { fac = item.facilities ? JSON.parse(item.facilities) : []; } catch(_) { fac = []; }
                    merged[item.namaArmada] = {
                        image: item.image || merged[item.namaArmada]?.image || 'damri.webp',
                        logo: item.logo !== undefined ? item.logo : (merged[item.namaArmada]?.logo || ''),
                        tagline: item.tagline !== undefined ? item.tagline : (merged[item.namaArmada]?.tagline || ''),
                        description: item.description !== undefined ? item.description : (merged[item.namaArmada]?.description || ''),
                        facilities: Array.isArray(fac) && fac.length > 0 ? fac : (merged[item.namaArmada]?.facilities || [])
                    };
                }
            } else {
                for (const [nama, prof] of Object.entries(merged)) {
                    try {
                        await prisma.poProfile.upsert({
                            where: { namaArmada: nama },
                            update: {},
                            create: {
                                namaArmada: nama,
                                image: prof.image || 'damri.webp',
                                logo: prof.logo || '',
                                tagline: prof.tagline || '',
                                description: prof.description || '',
                                facilities: JSON.stringify(prof.facilities || [])
                            }
                        });
                    } catch(seedErr) {}
                }
            }
        }
    } catch (dbErr) {
        console.warn('Notice: PoProfile DB query skipped/failed, using file:', dbErr.message);
    }

    cachedPoProfilesMerged = merged;
    return merged;
}

async function persistPoProfile(nama, prof, allProfiles) {
    cachedPoProfilesMerged = null;
    try {
        fs.writeFileSync(PO_PROFILES_FILE, JSON.stringify(allProfiles, null, 2));
    } catch (e) {
        console.error('Error saving po profiles file:', e);
    }

    try {
        if (prisma.poProfile) {
            await prisma.poProfile.upsert({
                where: { namaArmada: nama },
                update: {
                    image: prof.image || 'damri.webp',
                    logo: prof.logo !== undefined ? prof.logo : '',
                    tagline: prof.tagline !== undefined ? prof.tagline : '',
                    description: prof.description !== undefined ? prof.description : '',
                    facilities: JSON.stringify(prof.facilities || [])
                },
                create: {
                    namaArmada: nama,
                    image: prof.image || 'damri.webp',
                    logo: prof.logo || '',
                    tagline: prof.tagline || '',
                    description: prof.description || '',
                    facilities: JSON.stringify(prof.facilities || [])
                }
            });
        }
    } catch (dbErr) {
        console.error('Error saving PoProfile to database:', dbErr);
    }
}

function savePoProfilesData(data) {
    try {
        fs.writeFileSync(PO_PROFILES_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error saving po profiles file:', e);
    }
}

const DEFAULT_TIPE_ARMADA = [
    { id: 'tipe-1', nama: 'Hiace' },
    { id: 'tipe-2', nama: 'Bus Besar' },
    { id: 'tipe-3', nama: 'Long Elf' },
    { id: 'tipe-4', nama: 'Medium Bus' },
    { id: 'tipe-5', nama: 'Elf Short' },
    { id: 'tipe-6', nama: 'Innova / MPV' }
];

let cachedTipeArmadaData = null;

function loadTipeArmadaData() {
    if (cachedTipeArmadaData) return cachedTipeArmadaData;
    try {
        if (fs.existsSync(TIPE_ARMADA_FILE)) {
            const raw = fs.readFileSync(TIPE_ARMADA_FILE, 'utf-8');
            if (raw && raw.trim()) {
                cachedTipeArmadaData = JSON.parse(raw);
                return cachedTipeArmadaData;
            }
        }
        fs.writeFileSync(TIPE_ARMADA_FILE, JSON.stringify(DEFAULT_TIPE_ARMADA, null, 2));
        cachedTipeArmadaData = DEFAULT_TIPE_ARMADA;
        return cachedTipeArmadaData;
    } catch (e) {
        console.error('Error loading tipe armada file:', e);
        return DEFAULT_TIPE_ARMADA;
    }
}

function saveTipeArmadaData(list) {
    cachedTipeArmadaData = list;
    try {
        fs.writeFileSync(TIPE_ARMADA_FILE, JSON.stringify(list, null, 2));
    } catch (e) {
        console.error('Error saving tipe armada file:', e);
    }
}

function loadDefaultDenah() {
    try {
        if (fs.existsSync(CUSTOM_DENAH_FILE)) {
            const raw = fs.readFileSync(CUSTOM_DENAH_FILE, 'utf-8');
            if (raw && raw.trim()) return JSON.parse(raw);
        }
        if (fs.existsSync(DEFAULT_DENAH_FILE)) {
            const defaults = JSON.parse(fs.readFileSync(DEFAULT_DENAH_FILE, 'utf-8'));
            try { fs.writeFileSync(CUSTOM_DENAH_FILE, JSON.stringify(defaults, null, 2)); } catch(e) {}
            return defaults;
        }
    } catch (e) {
        console.error('Error loading denah json:', e);
    }
    return [];
}

let cachedAllDenah = null;

async function getAllDenah() {
    if (cachedAllDenah) return cachedAllDenah;
    try {
        const denahFromDb = await prisma.denahArmada.findMany({
            orderBy: { createdAt: 'asc' }
        });
        if (denahFromDb && denahFromDb.length > 0) {
            cachedAllDenah = denahFromDb.map(d => ({
                id: d.id,
                nama: d.nama,
                kategori: d.kategori,
                baris: d.baris,
                kolom: d.kolom,
                totalKursi: d.totalKursi,
                cells: typeof d.cells === 'string' ? JSON.parse(d.cells) : d.cells
            }));
            return cachedAllDenah;
        }

        const defaults = loadDefaultDenah();
        for (const item of defaults) {
            try {
                await prisma.denahArmada.create({
                    data: {
                        id: item.id,
                        nama: item.nama,
                        kategori: item.kategori || 'Bus Besar',
                        baris: item.baris || 5,
                        kolom: item.kolom || 4,
                        totalKursi: item.totalKursi || 0,
                        cells: JSON.stringify(item.cells || [])
                    }
                });
            } catch (err) {}
        }
        cachedAllDenah = defaults;
        return defaults;
    } catch (err) {
        return loadDefaultDenah();
    }
}

async function saveOrUpdateDenah(item, isEdit = false) {
    cachedAllDenah = null;
    const cellsArr = Array.isArray(item.cells) ? item.cells : (typeof item.cells === 'string' ? JSON.parse(item.cells) : []);
    const totalKursi = cellsArr.filter(c => c && c.t === 'seat').length;
    const cellsStr = JSON.stringify(cellsArr);

    let targetId = item.id;
    if (!targetId || targetId.trim() === '') {
        targetId = 'DENAH-' + Date.now().toString(36).toUpperCase();
    }

    let dbResult = null;
    try {
        if (isEdit && item.id) {
            dbResult = await prisma.denahArmada.update({
                where: { id: item.id },
                data: {
                    nama: item.nama,
                    kategori: item.kategori || 'Bus Besar',
                    baris: parseInt(item.baris) || 5,
                    kolom: parseInt(item.kolom) || 4,
                    totalKursi: totalKursi,
                    cells: cellsStr
                }
            });
        } else {
            dbResult = await prisma.denahArmada.create({
                data: {
                    id: targetId,
                    nama: item.nama,
                    kategori: item.kategori || 'Bus Besar',
                    baris: parseInt(item.baris) || 5,
                    kolom: parseInt(item.kolom) || 4,
                    totalKursi: totalKursi,
                    cells: cellsStr
                }
            });
        }
    } catch (err) {
        console.warn('Prisma denah save warning:', err.message);
    }

    try {
        let list = loadDefaultDenah();
        const obj = {
            id: targetId,
            nama: item.nama,
            kategori: item.kategori || 'Bus Besar',
            baris: parseInt(item.baris) || 5,
            kolom: parseInt(item.kolom) || 4,
            totalKursi: totalKursi,
            cells: cellsArr
        };
        const idx = list.findIndex(d => d.id === targetId);
        if (idx >= 0) {
            list[idx] = obj;
        } else {
            list.push(obj);
        }
        fs.writeFileSync(CUSTOM_DENAH_FILE, JSON.stringify(list, null, 2));
        return obj;
    } catch (err) {
        console.error('File fallback save error:', err);
    }
    return dbResult;
}

async function removeDenah(id) {
    cachedAllDenah = null;
    try {
        await prisma.denahArmada.delete({ where: { id: id } });
    } catch (err) {
        console.warn('Prisma denah delete warning:', err.message);
    }
    try {
        let list = loadDefaultDenah();
        list = list.filter(d => d.id !== id);
        fs.writeFileSync(CUSTOM_DENAH_FILE, JSON.stringify(list, null, 2));
    } catch(err) {}
}

// API Endpoints
app.get('/api', async (req, res) => {
    const action = req.query.action;

    try {
        const publicActions = ['getArmada', 'getDenahArmada', 'getTipeArmada', 'getPoProfiles', 'getTakenSeats', 'getBookingById', 'getPelangganTable', 'getHargaKhusus', 'getPopupIklan', 'getSiteConfig'];
        if (!publicActions.includes(action) && !req.user) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        if (action === 'getSiteConfig') {
            const data = getSiteConfigData();
            return res.json({ status: 'success', data });
        }

        if (action === 'getPoProfiles') {
            const data = await getPoProfilesMerged();
            return res.json({ status: 'success', data });
        }

        if (action === 'getDenahArmada') {
            const list = await getAllDenah();
            return res.json({ status: 'success', data: list });
        }

        if (action === 'getTipeArmada') {
            const list = loadTipeArmadaData();
            return res.json({ status: 'success', data: list });
        }

        if (action === 'getTakenSeats') {
            const { tanggal, armada, waktu, tujuan, exclude_id } = req.query;
            if (!tanggal || !armada) {
                return res.json({ status: 'success', data: { taken: {} } });
            }
            const whereClause = {
                tanggalPemberangkatan: tanggal,
                jenisKendaraan: armada
            };
            if (waktu) whereClause.waktu = waktu;
            if (exclude_id) {
                whereClause.bookingId = { not: exclude_id };
            }
            let bookings = [];
            try {
                bookings = await prisma.booking.findMany({
                    where: whereClause
                });
            } catch (dbErr) {
                console.warn('Prisma getKursiTerisi notice, using memory fallback:', dbErr.message);
                bookings = Object.values(memoryTestBookings).filter(b => 
                    b['TANGGAL PEMBERANGKATAN'] === tanggal && 
                    b['JENIS KENDARAAN'] === armada &&
                    (!waktu || b['WAKTU'] === waktu) &&
                    (!exclude_id || b['ID_TIKET'] !== exclude_id)
                ).map(b => ({
                    status: b['Status'],
                    nomorKursi: b['NOMOR KURSI'],
                    nama: b['NAMA'],
                    bookingId: b['ID_TIKET']
                }));
            }
            const taken = {};
            bookings.forEach(b => {
                if (b.status === 'DITOLAK' || b.status === 'CANCEL') return;
                if (b.nomorKursi) {
                    const seats = b.nomorKursi.split(',').map(s => s.trim()).filter(Boolean);
                    seats.forEach(s => {
                        taken[s] = {
                            status: b.status,
                            nama: b.nama,
                            bookingId: b.bookingId
                        };
                    });
                }
            });
            return res.json({ status: 'success', data: { taken } });
        }

        if (action === 'getBookingById') {
            const id = req.query.id;
            if (!id) return res.status(400).json({ status: 'error', message: 'ID_TIKET is required' });
            
            let booking = null;
            try {
                booking = await prisma.booking.findFirst({
                    where: { bookingId: id }
                });
            } catch (dbErr) {
                console.warn('Prisma getBookingById notice, checking memory fallback:', dbErr.message);
                if (memoryTestBookings[id]) {
                    return res.json({ status: 'success', data: memoryTestBookings[id] });
                }
            }
            
            if (!booking) {
                if (memoryTestBookings[id]) {
                    return res.json({ status: 'success', data: memoryTestBookings[id] });
                }
                return res.json({ status: 'success', data: null });
            }
            
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
                'ALAMAT': booking.alamat,
                'Total Harga': booking.totalHarga,
                'PEMBAYARAN': booking.pembayaran,
                'Status': booking.status
            };
            return res.json({ status: 'success', data: formattedBooking });
        }

        if (action === 'getBookings') {
            let bookings = [];
            try {
                bookings = await prisma.booking.findMany();
                // Sort in memory for accurate chronological order regardless of string format
                bookings.sort((a, b) => parseCustomDate(b.createdAt) - parseCustomDate(a.createdAt));
            } catch (dbErr) {
                console.warn('Prisma getBookings notice, using fallback:', dbErr.message);
                return res.json({ status: 'success', data: Object.values(memoryTestBookings) });
            }
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
                'ALAMAT': b.alamat,
                'Total Harga': b.totalHarga,
                'PEMBAYARAN': b.pembayaran,
                'Status': b.status
            }));
            return res.json({ status: 'success', data: formattedBookings });
        }
        
        if (action === 'getArmada') {
            if (cachedArmadaResponse && (Date.now() - lastArmadaFetchTime < ARMADA_CACHE_TTL)) {
                return res.json({ status: 'success', data: cachedArmadaResponse });
            }

            let armadas = [];
            try {
                armadas = await prisma.armada.findMany({
                    orderBy: { namaArmada: 'asc' }
                });
                if (armadas && armadas.length > 0) {
                    try { fs.writeFileSync(ARMADA_CACHE_FILE, JSON.stringify(armadas, null, 2)); } catch(e) {}
                }
            } catch (dbErr) {
                console.warn('Prisma getArmada notice, using cache file:', dbErr.message);
                if (fs.existsSync(ARMADA_CACHE_FILE)) {
                    try { armadas = JSON.parse(fs.readFileSync(ARMADA_CACHE_FILE, 'utf-8')); } catch(e) {}
                }
            }

            // Ambil statistik pesanan riil untuk sorting armada paling ramai / laku
            const bookingCounts = {};
            try {
                const grouped = await prisma.booking.groupBy({
                    by: ['jenisKendaraan'],
                    _count: { bookingId: true }
                });
                grouped.forEach(g => {
                    if (g.jenisKendaraan) {
                        const k = String(g.jenisKendaraan).trim().toUpperCase();
                        bookingCounts[k] = (bookingCounts[k] || 0) + (g._count.bookingId || 0);
                    }
                });
            } catch (e) {
                console.warn('Booking stats groupBy notice:', e.message);
            }

            // Bobot prioritas armada populer agen Kawunganten sebagai acuan / tie-breaker
            const POPULAR_RANKS = [
                'DAMRI JAKARTA',
                'DAMRI SUMATRA',
                'DAMRI',
                'EFISIENSI',
                'BEST PREMIUM',
                'ESTU TRANS',
                '77 TRANS',
                'QYTA TRANS',
                'BUS JOGJA',
                'ARDY TRANS',
                'RIYAN',
                'HANDOYO',
                'MADU KISMO'
            ];

            const getArmadaRank = (nama) => {
                const upper = String(nama || '').trim().toUpperCase();
                const idx = POPULAR_RANKS.findIndex(p => upper === p || upper.includes(p) || p.includes(upper));
                return idx === -1 ? 999 : idx;
            };

            const formattedArmadas = armadas.map(a => {
                const cleanName = String(a.namaArmada || '').trim().toUpperCase();
                const bCount = bookingCounts[cleanName] || 0;
                return {
                    'id_armada': a.idArmada,
                    'nama_armada': a.namaArmada,
                    'tujuan_armada': a.tujuanArmada,
                    'jam': a.jam,
                    'harga': a.harga,
                    'Seat': a.seat,
                    'is_active': a.isActive,
                    'tipe_armada': a.tipeArmada || 'Bus Besar',
                    'denah_id': a.denahId || null,
                    'booking_count': bCount
                };
            });

            // Urutkan armada:
            // 1. Jumlah pesanan terbanyak (paling laku / ramai)
            // 2. Prioritas armada populer (DAMRI, Efisiensi, Best Premium, Estu Trans, dst.)
            // 3. Nama armada (abjad)
            formattedArmadas.sort((a, b) => {
                const countDiff = (b.booking_count || 0) - (a.booking_count || 0);
                if (countDiff !== 0) return countDiff;

                const rankA = getArmadaRank(a.nama_armada);
                const rankB = getArmadaRank(b.nama_armada);
                if (rankA !== rankB) return rankA - rankB;

                return (a.nama_armada || '').localeCompare(b.nama_armada || '');
            });

            cachedArmadaResponse = formattedArmadas;
            lastArmadaFetchTime = Date.now();
            return res.json({ status: 'success', data: formattedArmadas });
        }
        
        if (action === 'getHargaKhusus') {
            let hargaKhusus = [];
            try {
                hargaKhusus = await prisma.hargaKhusus.findMany({
                    orderBy: { tanggalAwal: 'desc' }
                });
            } catch (dbErr) {
                console.warn('Prisma getHargaKhusus notice:', dbErr.message);
            }
            return res.json({ status: 'success', data: hargaKhusus });
        }
        
        if (action === 'getEkstraBookings') {
            let bookings = [];
            try {
                bookings = await prisma.ekstraBooking.findMany();
                // Sort in memory for accurate chronological order
                bookings.sort((a, b) => parseCustomDate(b.createdAt) - parseCustomDate(a.createdAt));
            } catch (dbErr) {
                console.warn('Prisma getEkstraBookings notice:', dbErr.message);
            }
            return res.json({ status: 'success', data: bookings });
        }
        
        if (action === 'getLaporan') {
            let laporan = [];
            try {
                laporan = await prisma.booking.findMany();
                // Sort in memory for accurate chronological order
                laporan.sort((a, b) => parseCustomDate(b.createdAt) - parseCustomDate(a.createdAt));
            } catch (dbErr) {
                console.warn('Prisma getLaporan notice, using fallback:', dbErr.message);
                return res.json({ status: 'success', data: Object.values(memoryTestBookings) });
            }
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

        if (action === 'getPopupIklan') {
            try {
                const now = new Date();
                const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
                const iklanList = await prisma.popupIklan.findMany({
                    where: {
                        isActive: true,
                        tanggalMulai: { lte: today },
                        tanggalBerakhir: { gte: today }
                    },
                    orderBy: { createdAt: 'desc' }
                });
                return res.json({ status: 'success', data: iklanList });
            } catch (dbErr) {
                console.warn('Prisma getPopupIklan notice:', dbErr.message);
                return res.json({ status: 'success', data: [] });
            }
        }

        if (action === 'getSemuaIklan') {
            try {
                const iklanList = await prisma.popupIklan.findMany({
                    orderBy: { createdAt: 'desc' }
                });
                return res.json({ status: 'success', data: iklanList });
            } catch (dbErr) {
                console.warn('Prisma getSemuaIklan notice:', dbErr.message);
                return res.json({ status: 'success', data: [] });
            }
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
            
            const bookingRecord = {
                'Timestamp': new Date().toISOString(),
                'TANGGAL PEMBERANGKATAN': payload['TANGGAL PEMBERANGKATAN'],
                'ID_TIKET': payload['ID_TIKET'],
                'JENIS KENDARAAN': payload['JENIS KENDARAAN'],
                'Tujuan': payload['Tujuan'],
                'Harga': harga,
                'NAMA': payload['NAMA'],
                'NOMOR HP': payload['NOMOR HP'],
                'JUMLAH PNP': parseInt(payload['JUMLAH PNP']) || 1,
                'WAKTU': payload['WAKTU'],
                'NOMOR KURSI': payload['NOMOR KURSI'] || '',
                'KETERANGAN': payload['KETERANGAN'] || payload['Keterangan'] || payload['keterangan'] || '',
                'ALAMAT': payload['ALAMAT'] || payload['alamat'] || '-',
                'Total Harga': totalHarga,
                'PEMBAYARAN': payload['PEMBAYARAN'] || 'CASH',
                'Status': payload['Status'] ? payload['Status'] : (payload['PEMBAYARAN'] === 'LUNAS' || payload['PEMBAYARAN'] === 'ACC' ? 'LUNAS' : 'WAITING'),
                'Komisi': harga * 0.1,
                'Total Komisi': totalHarga * 0.1
            };

            memoryTestBookings[payload['ID_TIKET']] = bookingRecord;

            let newBooking = null;
            try {
                newBooking = await prisma.booking.create({
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
            } catch (dbErr) {
                console.warn('Prisma addBooking notice, saved to memory fallback:', dbErr.message);
                newBooking = bookingRecord;
            }
            
            return res.json({ status: 'success', message: 'Booking berhasil', data: newBooking });
        }

        if (action === 'updateStatus') {
            const { id_tiket, status } = payload;
            if (memoryTestBookings[id_tiket]) {
                memoryTestBookings[id_tiket]['PEMBAYARAN'] = status;
                memoryTestBookings[id_tiket]['Status'] = status;
            }
            try {
                await prisma.booking.updateMany({
                    where: { bookingId: id_tiket },
                    data: { 
                        pembayaran: status,
                        status: status 
                    }
                });
            } catch (dbErr) {
                console.warn('Prisma updateStatus notice:', dbErr.message);
            }
            
            return res.json({ status: 'success', message: 'Status berhasil diupdate' });
        }

        if (action === 'deleteBooking') {
            const { id_tiket } = payload;
            delete memoryTestBookings[id_tiket];
            try {
                await prisma.booking.delete({
                    where: { bookingId: id_tiket }
                });
            } catch (dbErr) {
                console.warn('Prisma deleteBooking notice:', dbErr.message);
            }
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
                alamat: alamat || '-',
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

        if (action === 'getTipeArmada') {
            const list = loadTipeArmadaData();
            return res.json({ status: 'success', data: list });
        }

        if (action === 'addTipeArmada') {
            const { nama } = payload;
            const cleanName = String(nama || '').trim();
            if (!cleanName) return res.status(400).json({ status: 'error', message: 'Nama tipe armada wajib diisi' });
            const list = loadTipeArmadaData();
            if (list.some(t => t.nama.toLowerCase() === cleanName.toLowerCase())) {
                return res.status(400).json({ status: 'error', message: 'Tipe armada sudah ada' });
            }
            const newItem = {
                id: 'tipe-' + Date.now().toString(36),
                nama: cleanName
            };
            list.push(newItem);
            saveTipeArmadaData(list);
            return res.json({ status: 'success', message: 'Tipe armada berhasil ditambahkan', data: newItem });
        }

        if (action === 'editTipeArmada') {
            const { old_nama, new_nama } = payload;
            const oldClean = String(old_nama || '').trim();
            const newClean = String(new_nama || '').trim();
            if (!oldClean || !newClean) return res.status(400).json({ status: 'error', message: 'Nama lama dan baru wajib diisi' });
            
            const list = loadTipeArmadaData();
            const idx = list.findIndex(t => t.nama.toLowerCase() === oldClean.toLowerCase());
            if (idx === -1) return res.status(404).json({ status: 'error', message: 'Tipe armada tidak ditemukan' });
            
            list[idx].nama = newClean;
            saveTipeArmadaData(list);

            try {
                await prisma.denahArmada.updateMany({
                    where: { kategori: oldClean },
                    data: { kategori: newClean }
                });
                await prisma.armada.updateMany({
                    where: { tipeArmada: oldClean },
                    data: { tipeArmada: newClean }
                });
            } catch (err) {
                console.warn('Sync tipe armada error:', err.message);
            }

            return res.json({ status: 'success', message: `Nama tipe armada berhasil diubah menjadi ${newClean}` });
        }

        if (action === 'deleteTipeArmada') {
            const { nama } = payload;
            const cleanName = String(nama || '').trim();
            let list = loadTipeArmadaData();
            list = list.filter(t => t.nama.toLowerCase() !== cleanName.toLowerCase());
            saveTipeArmadaData(list);
            return res.json({ status: 'success', message: 'Tipe armada berhasil dihapus' });
        }

        if (action === 'setPoType') {
            const { nama_armada, tipe_armada, denah_id, image, description, facilities, tagline } = payload;
            let computedSeat = 0;
            if (denah_id) {
                const d = await prisma.denahArmada.findUnique({ where: { id: denah_id } });
                if (d && d.totalKursi) computedSeat = d.totalKursi;
            }
            
            const updateData = { 
                tipeArmada: tipe_armada || 'Bus Besar', 
                denahId: denah_id || null 
            };
            if (computedSeat > 0) updateData.seat = computedSeat;

            await prisma.armada.updateMany({
                where: { namaArmada: nama_armada },
                data: updateData
            });

            // Update PO Profile if provided
            if (image || logo !== undefined || description !== undefined || facilities !== undefined || tagline !== undefined) {
                const profiles = await getPoProfilesMerged();
                const cleanKey = String(nama_armada || '').trim().toUpperCase();
                let foundKey = Object.keys(profiles).find(k => k.toUpperCase() === cleanKey) || String(nama_armada || '').trim();
                profiles[foundKey] = {
                    image: image || profiles[foundKey]?.image || 'damri.webp',
                    logo: logo !== undefined ? logo : (profiles[foundKey]?.logo || ''),
                    tagline: tagline !== undefined ? tagline : (profiles[foundKey]?.tagline || ''),
                    description: description !== undefined ? description : (profiles[foundKey]?.description || ''),
                    facilities: Array.isArray(facilities) ? facilities : (profiles[foundKey]?.facilities || [])
                };
                await persistPoProfile(foundKey, profiles[foundKey], profiles);
            }

            return res.json({ status: 'success', message: `Profil dan tipe bus PO ${nama_armada} berhasil diperbarui!` });
        }

        if (action === 'savePoProfile') {
            const { nama_armada, image, logo, description, facilities, tagline, tipe_armada, denah_id } = payload;
            if (!nama_armada) return res.status(400).json({ status: 'error', message: 'Nama PO wajib diisi' });

            const profiles = await getPoProfilesMerged();
            const cleanKey = String(nama_armada || '').trim().toUpperCase();
            let foundKey = Object.keys(profiles).find(k => k.toUpperCase() === cleanKey) || String(nama_armada || '').trim();
            profiles[foundKey] = {
                image: image || profiles[foundKey]?.image || 'damri.webp',
                logo: logo !== undefined ? logo : (profiles[foundKey]?.logo || ''),
                tagline: tagline !== undefined ? tagline : (profiles[foundKey]?.tagline || ''),
                description: description !== undefined ? description : (profiles[foundKey]?.description || ''),
                facilities: Array.isArray(facilities) ? facilities : (profiles[foundKey]?.facilities || [])
            };
            await persistPoProfile(foundKey, profiles[foundKey], profiles);

            // Also synchronize tipe_armada and denah_id to database if provided
            if (tipe_armada || denah_id) {
                try {
                    let computedSeat = 0;
                    if (denah_id) {
                        const d = await prisma.denahArmada.findUnique({ where: { id: denah_id } });
                        if (d && d.totalKursi) computedSeat = d.totalKursi;
                    }
                    const updateData = {};
                    if (tipe_armada) updateData.tipeArmada = tipe_armada;
                    if (denah_id) updateData.denahId = denah_id;
                    if (computedSeat > 0) updateData.seat = computedSeat;

                    await prisma.armada.updateMany({
                        where: { namaArmada: nama_armada },
                        data: updateData
                    });
                } catch (dbErr) {
                    console.warn('Warning: Could not sync tipe_armada/denah to database:', dbErr.message);
                }
            }

            return res.json({ status: 'success', message: `Informasi dan foto armada PO ${nama_armada} berhasil disimpan!`, data: profiles[foundKey] });
        }

        if (action === 'addArmada') {
            let { nama_armada, tujuan_armada, jam, harga, seat, tipe_armada, denah_id } = payload;
            
            // Cek apakah PO sudah ada rute sebelumnya: jika sudah ada, warisi tipe armada dan denahnya!
            const existingPo = await prisma.armada.findFirst({
                where: { namaArmada: nama_armada }
            });
            if (existingPo) {
                tipe_armada = existingPo.tipeArmada || tipe_armada;
                denah_id = existingPo.denahId || denah_id;
                seat = existingPo.seat || seat;
            }

            let computedSeat = parseInt(seat) || 0;
            if (!computedSeat && denah_id) {
                const d = await prisma.denahArmada.findUnique({ where: { id: denah_id } });
                if (d && d.totalKursi) computedSeat = d.totalKursi;
            }
            if (!computedSeat) computedSeat = 40;

            const newArmada = await prisma.armada.create({
                data: {
                    idArmada: 'ARM' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
                    namaArmada: nama_armada,
                    tujuanArmada: tujuan_armada,
                    jam: jam,
                    harga: harga.toString(),
                    seat: computedSeat,
                    tipeArmada: tipe_armada || 'Bus Besar',
                    denahId: denah_id || null
                }
            });
            return res.json({ status: 'success', message: 'Armada berhasil ditambahkan', data: newArmada });
        }

        if (action === 'editArmadaData') {
            const { id_armada, nama_armada, tujuan_armada, jam, harga, seat, tipe_armada, denah_id } = payload;
            
            let computedSeat = parseInt(seat) || 0;
            if (!computedSeat && denah_id) {
                const d = await prisma.denahArmada.findUnique({ where: { id: denah_id } });
                if (d && d.totalKursi) computedSeat = d.totalKursi;
            }
            if (!computedSeat) computedSeat = 40;

            const updatePayload = {
                namaArmada: nama_armada,
                tujuanArmada: tujuan_armada,
                jam: jam,
                harga: harga.toString(),
                seat: computedSeat
            };
            if (tipe_armada !== undefined) updatePayload.tipeArmada = tipe_armada;
            if (denah_id !== undefined) updatePayload.denahId = denah_id || null;

            await prisma.armada.update({
                where: { idArmada: id_armada },
                data: updatePayload
            });

            // PO konsisten: update tipe armada dan denah ke semua rute PO ini
            if (nama_armada && (tipe_armada !== undefined || denah_id !== undefined)) {
                const poSync = {};
                if (tipe_armada !== undefined) poSync.tipeArmada = tipe_armada;
                if (denah_id !== undefined) poSync.denahId = denah_id || null;
                if (computedSeat > 0) poSync.seat = computedSeat;

                await prisma.armada.updateMany({
                    where: { namaArmada: nama_armada },
                    data: poSync
                });
            }

            return res.json({ status: 'success', message: 'Data armada berhasil diperbarui' });
        }

        if (action === 'addDenahArmada') {
            const resData = await saveOrUpdateDenah(payload, false);
            return res.json({ status: 'success', message: 'Denah format tempat duduk berhasil disimpan', data: resData });
        }

        if (action === 'editDenahArmada') {
            const resData = await saveOrUpdateDenah(payload, true);
            return res.json({ status: 'success', message: 'Denah format tempat duduk berhasil diperbarui', data: resData });
        }

        if (action === 'deleteDenahArmada') {
            await removeDenah(payload.id);
            return res.json({ status: 'success', message: 'Denah format tempat duduk berhasil dihapus' });
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

        if (action === 'toggleIklan') {
            const { id, isActive } = payload;
            await prisma.popupIklan.update({
                where: { id },
                data: { isActive }
            });
            return res.json({ status: 'success', message: `Iklan berhasil ${isActive ? 'diaktifkan' : 'dinonaktifkan'}` });
        }

        if (action === 'deleteIklan') {
            const { id } = payload;
            const iklan = await prisma.popupIklan.findUnique({ where: { id } });
            if (iklan && iklan.bannerUrl) {
                const filePath = path.join(__dirname, '../public', iklan.bannerUrl);
                try { fs.unlinkSync(filePath); } catch(e) {}
            }
            await prisma.popupIklan.delete({ where: { id } });
            return res.json({ status: 'success', message: 'Iklan berhasil dihapus' });
        }

        if (action === 'saveSiteConfig') {
            const newConfig = payload;
            if (!newConfig) return res.status(400).json({ status: 'error', message: 'Payload konfigurasi kosong' });
            saveSiteConfigData(newConfig);
            io.emit('site_config_updated', newConfig);
            return res.json({ status: 'success', message: 'Konfigurasi website berhasil disimpan', data: newConfig });
        }

        return res.status(400).json({ status: 'error', message: 'Action not found' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 'error', message: 'Server error' });
    }
});


// Iklan upload endpoints (multipart form)
// Wrapper to handle multer errors gracefully
function handleMulterError(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ status: 'error', message: 'Ukuran file terlalu besar. Maksimal 4MB.' });
        }
        return res.status(400).json({ status: 'error', message: 'Upload error: ' + err.message });
    } else if (err) {
        return res.status(400).json({ status: 'error', message: err.message });
    }
    next();
}

app.post('/api/iklan', (req, res, next) => {
    upload.single('banner')(req, res, (err) => {
        if (err) return handleMulterError(err, req, res, next);
        next();
    });
}, async (req, res) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        try { jwt.verify(token, JWT_SECRET); } catch(e) { return res.status(401).json({ status: 'error', message: 'Token tidak valid. Silakan login ulang.' }); }

        if (!req.file) return res.status(400).json({ status: 'error', message: 'File banner wajib diupload' });

        const { judul, deskripsiSingkat, deskripsiLengkap, nomorWhatsapp, pesanWhatsapp, tanggalMulai, tanggalBerakhir, isActive } = req.body;
        const bannerUrl = '/uploads/' + req.file.filename;

        const iklan = await prisma.popupIklan.create({
            data: {
                judul,
                deskripsiSingkat,
                deskripsiLengkap: deskripsiLengkap || '',
                bannerUrl,
                nomorWhatsapp,
                pesanWhatsapp: pesanWhatsapp || 'Halo, saya tertarik dengan iklan Anda',
                tanggalMulai,
                tanggalBerakhir,
                isActive: isActive === 'true'
            }
        });
        io.emit('data_updated');
        return res.json({ status: 'success', message: 'Iklan berhasil ditambahkan', data: iklan });
    } catch (err) {
        console.error('Add Iklan Error:', err);
        return res.status(500).json({ status: 'error', message: 'Gagal menambahkan iklan: ' + (err.message || 'Server error') });
    }
});

app.put('/api/iklan/:id', (req, res, next) => {
    upload.single('banner')(req, res, (err) => {
        if (err) return handleMulterError(err, req, res, next);
        next();
    });
}, async (req, res) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        try { jwt.verify(token, JWT_SECRET); } catch(e) { return res.status(401).json({ status: 'error', message: 'Token tidak valid. Silakan login ulang.' }); }

        const { id } = req.params;
        const { judul, deskripsiSingkat, deskripsiLengkap, nomorWhatsapp, pesanWhatsapp, tanggalMulai, tanggalBerakhir, isActive } = req.body;

        const updateData = {
            judul,
            deskripsiSingkat,
            deskripsiLengkap: deskripsiLengkap || '',
            nomorWhatsapp,
            pesanWhatsapp: pesanWhatsapp || 'Halo, saya tertarik dengan iklan Anda',
            tanggalMulai,
            tanggalBerakhir,
            isActive: isActive === 'true'
        };

        if (req.file) {
            // Delete old banner
            const old = await prisma.popupIklan.findUnique({ where: { id } });
            if (old && old.bannerUrl) {
                const oldPath = path.join(__dirname, '../public', old.bannerUrl);
                try { fs.unlinkSync(oldPath); } catch(e) {}
            }
            updateData.bannerUrl = '/uploads/' + req.file.filename;
        }

        const iklan = await prisma.popupIklan.update({ where: { id }, data: updateData });
        io.emit('data_updated');
        return res.json({ status: 'success', message: 'Iklan berhasil diperbarui', data: iklan });
    } catch (err) {
        console.error('Edit Iklan Error:', err);
        return res.status(500).json({ status: 'error', message: 'Gagal memperbarui iklan: ' + (err.message || 'Server error') });
    }
});

// Endpoint upload foto armada PO (Admin)
app.post('/api/upload-armada', (req, res, next) => {
    upload.single('image')(req, res, (err) => {
        if (err) return handleMulterError(err, req, res, next);
        next();
    });
}, async (req, res) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        try { jwt.verify(token, JWT_SECRET); } catch(e) { return res.status(401).json({ status: 'error', message: 'Token tidak valid' }); }

        if (!req.file) return res.status(400).json({ status: 'error', message: 'File gambar wajib diupload' });
        const imageUrl = '/uploads/' + req.file.filename;
        return res.json({ status: 'success', url: imageUrl, message: 'Foto armada berhasil diunggah' });
    } catch (err) {
        console.error('Upload Armada Photo Error:', err);
        return res.status(500).json({ status: 'error', message: 'Gagal mengunggah foto armada: ' + (err.message || 'Server error') });
    }
});

// Endpoint upload logo PO (Admin)
app.post('/api/upload-logo', (req, res, next) => {
    upload.single('logo')(req, res, (err) => {
        if (err) return handleMulterError(err, req, res, next);
        next();
    });
}, async (req, res) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        try { jwt.verify(token, JWT_SECRET); } catch(e) { return res.status(401).json({ status: 'error', message: 'Token tidak valid' }); }

        if (!req.file) return res.status(400).json({ status: 'error', message: 'File logo wajib diupload' });
        const logoUrl = '/uploads/' + req.file.filename;
        return res.json({ status: 'success', url: logoUrl, message: 'Logo PO berhasil diunggah' });
    } catch (err) {
        console.error('Upload Logo Error:', err);
        return res.status(500).json({ status: 'error', message: 'Gagal mengunggah logo PO: ' + (err.message || 'Server error') });
    }
});

// Endpoint upload gambar QRIS pembayaran (Admin)
app.post('/api/upload-qris', (req, res, next) => {
    upload.fields([{ name: 'qris', maxCount: 1 }, { name: 'qrisImage', maxCount: 1 }])(req, res, (err) => {
        if (err) return handleMulterError(err, req, res, next);
        if (req.files) {
            req.file = req.files['qris']?.[0] || req.files['qrisImage']?.[0];
        }
        next();
    });
}, async (req, res) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        try { jwt.verify(token, JWT_SECRET); } catch(e) { return res.status(401).json({ status: 'error', message: 'Token tidak valid' }); }

        if (!req.file) return res.status(400).json({ status: 'error', message: 'File QRIS wajib diupload' });
        const qrisUrl = '/uploads/' + req.file.filename;
        return res.json({ status: 'success', success: true, url: qrisUrl, message: 'Gambar QRIS berhasil diunggah' });
    } catch (err) {
        console.error('Upload QRIS Error:', err);
        return res.status(500).json({ status: 'error', message: 'Gagal mengunggah gambar QRIS: ' + (err.message || 'Server error') });
    }
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
