const SCRIPT_URL = "/api";

// ==========================================
// 0. GLOBAL FETCH INTERCEPTOR (AUTO LOGOUT)
// ==========================================
const originalFetch = window.fetch;
window.fetch = async function() {
    const response = await originalFetch.apply(this, arguments);
    if (response.status === 401 || response.status === 403) {
        // Jika token tidak valid / habis, bersihkan sesi
        if (localStorage.getItem('isAdminLoggedIn') === 'true' || localStorage.getItem('adminToken')) {
            console.warn('Sesi login telah habis. Auto-logout...');
            localStorage.removeItem('isAdminLoggedIn');
            localStorage.removeItem('adminToken');
            
            // Redirect ke halaman login jika sedang di halaman admin
            if (window.location.pathname.includes('admin.html')) {
                alert('Sesi login Anda telah berakhir. Silakan login kembali.');
                window.location.replace('login.html');
            }
        }
    }
    return response;
};

// ==========================================
// 1. DATA CACHE & STATE
// ==========================================
let cachedArmadas = [];
let cachedHargaKhusus = [];
let cachedBookings = [];
let cachedLaporan = [];
let cachedEkstraBookings = [];
let cachedDenah = [];
let cachedTipeArmada = [];
let cachedPoProfiles = {};
let cachedSiteConfig = null;
let isDataLoaded = false;

// Pre-hydrate from localStorage for instantaneous 0ms initial render
try {
    const _rawA = localStorage.getItem("app_armadas");
    if (_rawA) cachedArmadas = JSON.parse(_rawA);
    const _rawP = localStorage.getItem("app_po_profiles");
    if (_rawP) cachedPoProfiles = JSON.parse(_rawP);
    const _rawD = localStorage.getItem("app_denah");
    if (_rawD) cachedDenah = JSON.parse(_rawD);
    const _rawT = localStorage.getItem("app_tipe_armada");
    if (_rawT) cachedTipeArmada = JSON.parse(_rawT);
    const _rawS = localStorage.getItem("app_site_config");
    if (_rawS) cachedSiteConfig = JSON.parse(_rawS);
    const _rawB = localStorage.getItem("app_bookings");
    if (_rawB) cachedBookings = JSON.parse(_rawB);
} catch(e) {}

// ==========================================
// 2. NETWORK HELPER (FETCH & POST)
// ==========================================
async function fetchFromSheets(action, params = "") {
    try {
        const url = `${SCRIPT_URL}?action=${action}${params}&_t=${Date.now()}`;
        const headers = {};
        const token = localStorage.getItem('adminToken');
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error("Network response was not ok");
        const json = await res.json();
        
        // Database API returns { status: "success", data: [...] }
        if (json && json.status === "success" && json.data) {
            return json.data;
        }
        // Fallback returns raw array if it was not nested
        return json.data || json;
    } catch (e) {
        console.error(`Error fetching ${action}:`, e);
        return null;
    }
}

async function postToSheets(action, payload) {
    try {
            const headers = { 'Content-Type': 'application/json' };
            const token = localStorage.getItem('adminToken');
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: headers,
            body: JSON.stringify({ action: action, payload: payload })
        });
        return await res.json();
    } catch (e) {
        console.error("Error posting to database:", e);
        return { status: "error", message: "Gagal menghubungi server" };
    }
}

// ==========================================
// 3. INITIALIZATION & MAPPING DATA
// ==========================================
async function initData() {
    if (isDataLoaded) return true;

    try {
        const isAdmin = localStorage.getItem('isAdminLoggedIn') === 'true';
        
        const promises = [
            fetchFromSheets('getArmada'),
            fetchFromSheets('getHargaKhusus'),
            fetchFromSheets('getDenahArmada'),
            fetchFromSheets('getTipeArmada'),
            fetchFromSheets('getPoProfiles'),
            fetchFromSheets('getSiteConfig')
        ];
        
        if (isAdmin) {
            promises.push(
                fetchFromSheets('getBookings'),
                fetchFromSheets('getLaporan'),
                fetchFromSheets('getEkstraBookings')
            );
        }
        
        const results = await Promise.all(promises);
        
        const aData = results[0];
        const hData = results[1];
        const dData = results[2];
        const tData = results[3];
        const pData = results[4];
        const sData = results[5];
        let bData = [], lData = [], eData = [];
        
        if (isAdmin) {
            bData = results[6];
            lData = results[7];
            eData = results[8];
        }

        if (sData && typeof sData === 'object') {
            cachedSiteConfig = sData;
            localStorage.setItem("app_site_config", JSON.stringify(cachedSiteConfig));
        } else {
            try {
                const rawS = localStorage.getItem("app_site_config");
                if (rawS) cachedSiteConfig = JSON.parse(rawS);
            } catch(e) {}
        }

        if (pData && typeof pData === 'object') {
            cachedPoProfiles = pData;
            localStorage.setItem("app_po_profiles", JSON.stringify(cachedPoProfiles));
        } else {
            try {
                const rawP = localStorage.getItem("app_po_profiles");
                if (rawP) cachedPoProfiles = JSON.parse(rawP);
            } catch(e) {}
        }

        if (tData && Array.isArray(tData)) {
            cachedTipeArmada = tData;
            localStorage.setItem("app_tipe_armada", JSON.stringify(cachedTipeArmada));
        } else {
            try {
                const rawT = localStorage.getItem("app_tipe_armada");
                if (rawT) cachedTipeArmada = JSON.parse(rawT);
            } catch(e) {}
            if (!cachedTipeArmada || !cachedTipeArmada.length) {
                cachedTipeArmada = [
                    { id: 'tipe-1', nama: 'Hiace' },
                    { id: 'tipe-2', nama: 'Bus Besar' },
                    { id: 'tipe-3', nama: 'Long Elf' },
                    { id: 'tipe-4', nama: 'Medium Bus' },
                    { id: 'tipe-5', nama: 'Elf Short' },
                    { id: 'tipe-6', nama: 'Innova / MPV' }
                ];
            }
        }

        if (dData && Array.isArray(dData)) {
            cachedDenah = dData;
            localStorage.setItem("app_denah", JSON.stringify(cachedDenah));
        }

        if (aData && Array.isArray(aData)) {
            cachedArmadas = aData.map(a => {
                // Cari nama kolom secara fleksibel (case-insensitive)
                const keys = Object.keys(a);
                const find = (candidates) => {
                    for (const c of candidates) {
                        const match = keys.find(k => k.toLowerCase().trim() === c.toLowerCase());
                        if (match && a[match] !== undefined && a[match] !== "") return a[match];
                    }
                    return null;
                };
                return {
                    id: String(find(["id_armada", "idArmada", "ID Armada", "ID"]) || ("ARM" + Math.random().toString(36).substr(2, 5))).trim(),
                    name: String(find(["Armada", "nama_armada", "Nama Armada", "ARMADA"]) || "Unknown").trim(),
                    destination: String(find(["Tujuan", "tujuan_armada", "Tujuan Armada", "TUJUAN"]) || "Unknown").trim(),
                    time: String(find(["Jam", "jam", "JAM", "Waktu"]) || "00:00").trim(),
                    price: parseInt(String(find(["Harga", "harga", "HARGA", "Price"]) || '0').replace(/[^0-9]/g, '')) || 0,
                    capacity: parseInt(find(["Kapasitas", "Seat", "seat", "kapasitas", "KAPASITAS"])) || 40,
                    isActive: find(["is_active", "isActive"]) !== false, // Defaults to true if undefined
                    tipeArmada: String(find(["tipe_armada", "tipeArmada", "tipe", "Tipe"]) || "Bus Besar").trim(),
                    denahId: find(["denah_id", "denahId", "id_denah"]) || null,
                    bookingCount: parseInt(find(["booking_count", "bookingCount", "total_booking"])) || 0
                };
            });
            localStorage.setItem("app_armadas", JSON.stringify(cachedArmadas));
        }

        if (hData && Array.isArray(hData)) {
            cachedHargaKhusus = hData;
            localStorage.setItem("app_harga_khusus", JSON.stringify(cachedHargaKhusus));
        }

        if (bData && Array.isArray(bData)) {
            cachedBookings = bData.map(b => {
                const bArmada = b["JENIS KENDARAAN"] ? String(b["JENIS KENDARAAN"]).trim() : "";
                const bTujuan = b["Tujuan"] ? String(b["Tujuan"]).trim() : "";
                
                const armadaMatch = cachedArmadas.find(a => 
                    // Bandingkan sebagian string karena bisa saja di boking namanya "DAMRI JAKARTA" tapi di armada cuma "DAMRI"
                    (a.name === bArmada || bArmada.includes(a.name) || a.name.includes(bArmada)) 
                    && 
                    (a.destination === bTujuan || bTujuan.includes(a.destination) || a.destination.includes(bTujuan))
                );
                
                let statusLocal = "waiting_payment";
                const bStatus = b["Status"] ? String(b["Status"]).toUpperCase() : "";
                const bPembayaran = b["PEMBAYARAN"] ? String(b["PEMBAYARAN"]).toUpperCase() : "";
                
                if (bStatus === "LUNAS" || bStatus === "ACC" || bPembayaran === "LUNAS" || bPembayaran === "ACC") {
                    statusLocal = "paid";
                } else if (bStatus === "BELUM LUNAS" || bPembayaran === "BELUM LUNAS") {
                    statusLocal = "BELUM LUNAS";
                } else {
                    statusLocal = bStatus || bPembayaran || "waiting_payment";
                }

                let tgl = "";
                if (b["TANGGAL PEMBERANGKATAN"]) {
                    const rawDate = String(b["TANGGAL PEMBERANGKATAN"]);
                    if (rawDate.includes('T')) {
                        const d = new Date(rawDate);
                        if (!isNaN(d.getTime())) {
                            tgl = String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
                        } else {
                            tgl = rawDate.split('T')[0];
                        }
                    } else {
                        tgl = rawDate;
                    }
                }

                return {
                    bookingId: b["ID_TIKET"] || "UNKNOWN",
                    name: b["NAMA"] || "Tanpa Nama",
                    hp: b["NOMOR HP"] || "-",
                    alamat: b["ALAMAT"] || b["alamat"] || "-",
                    armadaId: armadaMatch ? armadaMatch.id : "UNKNOWN",
                    tujuan: bTujuan,
                    qty: parseInt(b["JUMLAH PNP"]) || 1,
                    totalPrice: parseInt(b["Total Harga"]) || parseInt(b["Harga"]) || 0,
                    status: statusLocal,
                    dateCreated: b["Timestamp"] || "",
                    dateTravel: tgl,
                    waktu: b["WAKTU"] || "",
                    pembayaran: b["PEMBAYARAN"] || "",
                    keterangan: b["KETERANGAN"] || b["Keterangan"] || b["keterangan"] || "",
                    kursi: b["NOMOR KURSI"] || ""
                };
            });
            localStorage.setItem("app_bookings", JSON.stringify(cachedBookings));
        }

        if (lData && Array.isArray(lData)) {
            cachedLaporan = lData.map(l => {
                const keys = Object.keys(l);
                const find = (candidates) => {
                    for (const c of candidates) {
                        const match = keys.find(k => k.toLowerCase().trim() === c.toLowerCase());
                        if (match && l[match] !== undefined && l[match] !== "") return l[match];
                    }
                    return null;
                };
                const mappedLaporan = {
                    timestamp: find(['Timestamp', 'timestamp']) || '',
                    tanggal: find(['TANGGAL PEMBERANGKATAN', 'Tanggal Pemberangkatan', 'tanggal_pemberangkatan']) || '',
                    idTiket: find(['ID_TIKET', 'id_tiket', 'ID Tiket']) || '',
                    jenisKendaraan: find(['JENIS KENDARAAN', 'Jenis Kendaraan', 'jenis_kendaraan']) || '',
                    tujuan: find(['Tujuan', 'tujuan', 'TUJUAN']) || '',
                    harga: parseInt(String(find(['Harga', 'harga', 'HARGA']) || '0').replace(/[^0-9]/g, '')) || 0,
                    jumlahPnp: parseInt(find(['JUMLAH PNP', 'Jumlah PNP', 'jumlah_pnp'])) || 1,
                    totalHarga: parseInt(String(find(['Total Harga', 'total_harga', 'TOTAL HARGA']) || '0').replace(/[^0-9]/g, '')) || 0,
                };
                // Calculate 10% commission dynamically
                mappedLaporan.komisi = mappedLaporan.harga * 0.1;
                mappedLaporan.totalKomisi = mappedLaporan.totalHarga * 0.1;
                return mappedLaporan;
            });
            localStorage.setItem('app_laporan', JSON.stringify(cachedLaporan));
        }

        if (eData && Array.isArray(eData)) {
            cachedEkstraBookings = eData;
            localStorage.setItem("app_ekstra", JSON.stringify(cachedEkstraBookings));
        }

        isDataLoaded = true;
        return true;
    } catch (error) {
        console.error("Critical error in initData:", error);
        
        // Fallback to localStorage if fetch fails
        const localA = localStorage.getItem("app_armadas");
        const localH = localStorage.getItem("app_harga_khusus");
        const localD = localStorage.getItem("app_denah");
        const localB = localStorage.getItem("app_bookings");
        const localL = localStorage.getItem("app_laporan");
        const localE = localStorage.getItem("app_ekstra");
        const localP = localStorage.getItem("app_po_profiles");
        if (localA) cachedArmadas = JSON.parse(localA);
        if (localH) cachedHargaKhusus = JSON.parse(localH);
        if (localD) cachedDenah = JSON.parse(localD);
        if (localB) cachedBookings = JSON.parse(localB);
        if (localL) cachedLaporan = JSON.parse(localL);
        if (localE) cachedEkstraBookings = JSON.parse(localE);
        if (localP) cachedPoProfiles = JSON.parse(localP);
        
        isDataLoaded = true;
        return false;
    }
}

// ==========================================
// 4. GETTERS
// ==========================================
function getPoProfiles() {
    return cachedPoProfiles || {};
}

function getPoProfile(poName) {
    if (!poName) return null;
    const clean = String(poName).trim().toUpperCase();
    const profiles = cachedPoProfiles || {};
    let key = Object.keys(profiles).find(k => k.toUpperCase() === clean);
    if (!key) {
        key = Object.keys(profiles)
            .sort((a, b) => b.length - a.length)
            .find(k => {
                const ku = k.toUpperCase().trim();
                return ku && (clean.startsWith(ku + ' ') || ku.startsWith(clean + ' '));
            });
    }
    if (key && profiles[key]) {
        return {
            name: key,
            image: profiles[key].image || 'damri.webp',
            logo: profiles[key].logo || (clean.includes('DAMRI') ? 'logo.png' : ''),
            tagline: profiles[key].tagline || 'Eksekutif & Nyaman',
            description: profiles[key].description || `Layanan perjalanan terbaik dari ${poName}.`,
            facilities: Array.isArray(profiles[key].facilities) ? profiles[key].facilities : ["Full AC", "Reclining Seat", "Bagasi Luas"]
        };
    }
    // Fallback preset
    let defaultImg = 'damri.webp';
    if (clean.includes('77')) defaultImg = '77trans.webp';
    else if (clean.includes('BEST')) defaultImg = 'bestpremium.webp';
    else if (clean.includes('JOGJA')) defaultImg = 'busjogja.webp';
    else if (clean.includes('EFISIENSI')) defaultImg = 'efisiensi.webp';
    else if (clean.includes('ESTU')) defaultImg = 'estutrans.webp';
    else if (clean.includes('QYTA')) defaultImg = 'qyta.webp';
    else if (clean.includes('RIYAN') || clean.includes('ARDY')) defaultImg = 'riyan.webp';

    return {
        name: poName,
        image: defaultImg,
        logo: clean.includes('DAMRI') ? 'logo.png' : '',
        tagline: 'Aman & Nyaman',
        description: `Layanan transportasi perjalanan terpercaya dari ${poName}.`,
        facilities: ["Full AC", "Reclining Seat", "Bagasi Luas", "USB Charger"]
    };
}

function getArmadas() {
    return cachedArmadas;
}

function getTipeArmadaList() {
    return cachedTipeArmada;
}

function getDenahList() {
    return cachedDenah;
}

function getDenah(id) {
    return cachedDenah.find(d => d.id === id);
}

function getHargaKhususList() {
    return cachedHargaKhusus;
}

function getEkstraBookings() {
    return cachedEkstraBookings;
}

function getBookings() {
    return cachedBookings;
}

function getArmada(id) {
    return cachedArmadas.find(a => a.id === id);
}

function getBooking(id) {
    return cachedBookings.find(b => b.bookingId === id);
}

function getLaporan() {
    return cachedLaporan;
}

function getSiteConfig() {
    if (!cachedSiteConfig) {
        try {
            const raw = localStorage.getItem('app_site_config');
            if (raw) cachedSiteConfig = JSON.parse(raw);
        } catch(e) {}
    }
    return cachedSiteConfig;
}

// ==========================================
// 5. UTILITIES (Formatting)
// ==========================================
function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(number).replace(/[\u00A0\u202F]/g, ' ');
}

function generateBookingId() {
    const prefix = "DMR";
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return prefix + Date.now().toString().slice(-4) + rnd;
}

// ==========================================
// 6. UI HELPERS (Toast, Alert)
// ==========================================
function showMessage(msg, isError = false) {
    const alertBox = document.getElementById('customAlert');
    const alertText = document.getElementById('alertText');
    if (alertBox && alertText) {
        alertText.innerText = msg;
        alertBox.style.display = 'flex';
        alertBox.style.backgroundColor = isError ? '#ef4444' : '#10b981';
        setTimeout(() => alertBox.style.display = 'none', 3000);
    } else {
        alert(msg);
    }
}

// ==========================================
// 7. REAL-TIME SYNC (SOCKET.IO)
// ==========================================
if (typeof io !== 'undefined') {
    const socket = io();
    socket.on('data_updated', async () => {
        isDataLoaded = false;
        await initData();
        // Cek jika sedang di halaman admin
        if (typeof renderAll === 'function') {
            renderAll();
        } else if (typeof window.reloadPublicUI === 'function') {
            window.reloadPublicUI();
        }
    });

    socket.on('site_config_updated', (newConfig) => {
        cachedSiteConfig = newConfig;
        try {
            localStorage.setItem('app_site_config', JSON.stringify(newConfig));
        } catch(e) {}
        if (typeof applySiteConfig === 'function') {
            applySiteConfig(newConfig);
        }
        if (typeof renderKontrol === 'function' && typeof currentMenu !== 'undefined' && currentMenu === 'kontrol') {
            renderKontrol();
        }
    });
}

// ==========================================
// 8. SHARED VISUAL ARMADA PICKER (ADMIN & PELANGGAN)
// ==========================================
function escapeArmadaHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function updateArmadaVisualPickerSelection(containerId, selectId, badgeId, selectedValue) {
    const container = document.getElementById(containerId);
    const select = selectId ? document.getElementById(selectId) : null;
    const badge = badgeId ? document.getElementById(badgeId) : null;
    const val = selectedValue !== undefined && selectedValue !== null
        ? String(selectedValue)
        : (select ? String(select.value || '') : '');

    if (container) {
        if (val) {
            container.classList.remove('ring-2', 'ring-red-400', 'rounded-2xl', 'p-1');
        }
        const cards = container.querySelectorAll('.armada-visual-card');
        cards.forEach(card => {
            const cardVal = card.getAttribute('data-armada-value') || '';
            const isSelected = Boolean(val) && cardVal === val;
            card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

            if (isSelected) {
                card.className = 'armada-visual-card is-selected group relative flex flex-col text-left rounded-2xl overflow-hidden transition-all duration-200 focus:outline-none active:scale-[0.97] min-w-0 w-full border-2 border-amber-500 bg-amber-50/60 shadow-lg shadow-amber-500/20 ring-2 ring-amber-400/30';
            } else {
                card.className = 'armada-visual-card group relative flex flex-col text-left rounded-2xl overflow-hidden transition-all duration-200 focus:outline-none active:scale-[0.97] min-w-0 w-full border border-slate-200 bg-white hover:border-amber-300 hover:shadow-md shadow-sm';
            }

            const checkBadge = card.querySelector('.armada-check-badge');
            if (checkBadge) {
                checkBadge.className = isSelected
                    ? 'armada-check-badge absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all duration-200 pointer-events-none bg-amber-500 text-slate-950 shadow-md ring-2 ring-white scale-100'
                    : 'armada-check-badge absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all duration-200 pointer-events-none bg-slate-950/45 border border-white/70 text-transparent backdrop-blur-sm scale-90 group-hover:scale-100';
            }

            const footer = card.querySelector('.armada-card-footer');
            if (footer) {
                footer.className = `armada-card-footer w-full px-2.5 py-2 sm:px-3 sm:py-2.5 flex items-center justify-between gap-1.5 flex-1 min-h-[38px] sm:min-h-[44px] transition-colors ${isSelected ? 'bg-gradient-to-r from-amber-50 to-white' : 'bg-white'}`;
            }

            const title = card.querySelector('.armada-card-title');
            if (title) {
                title.className = `armada-card-title font-black text-[11px] sm:text-xs uppercase tracking-tight leading-tight line-clamp-2 ${isSelected ? 'text-amber-900' : 'text-slate-800'}`;
            }

            const arrow = card.querySelector('.armada-card-arrow');
            if (arrow) {
                arrow.className = `armada-card-arrow fas ${isSelected ? 'fa-check-circle text-amber-600' : 'fa-chevron-right text-slate-300 group-hover:text-amber-500'} text-[10px] shrink-0 transition-all duration-200`;
            }
        });
    }

    if (badge) {
        if (val) {
            badge.className = 'inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full text-[10px] font-black shadow-sm max-w-[60%] truncate';
            badge.innerHTML = `<i class="fas fa-check-circle text-amber-600 shrink-0"></i><span class="truncate">${escapeArmadaHtml(val)}</span>`;
        } else {
            badge.className = 'inline-flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold';
            badge.innerHTML = `<i class="fas fa-hand-pointer text-[9px] text-amber-500"></i><span>Ketuk Foto Armada</span>`;
        }
    }
}

function renderArmadaVisualPicker(config) {
    const {
        containerId,
        selectId,
        badgeId,
        items = [],
        selectedValue,
        onSelect
    } = config || {};

    const container = document.getElementById(containerId);
    const select = selectId ? document.getElementById(selectId) : null;
    if (!container) return;

    const currentVal = selectedValue !== undefined && selectedValue !== null
        ? String(selectedValue)
        : (select ? String(select.value || '') : '');

    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-6 px-4 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-bold">
                <i class="fas fa-bus text-slate-300 text-lg mb-1.5 block"></i>
                Belum ada armada aktif tersedia
            </div>
        `;
        updateArmadaVisualPickerSelection(containerId, selectId, badgeId, '');
        return;
    }

    container.innerHTML = items.map(item => {
        const name = String(item.name || '').trim();
        const profile = getPoProfile(name);
        const poImg = item.image || (profile && profile.image) || 'damri.webp';
        const poLogo = item.logo !== undefined ? item.logo : (profile && profile.logo ? profile.logo : '');
        const subLabel = item.subLabel || '';

        return `
            <button type="button"
                data-armada-value="${escapeArmadaHtml(name)}"
                aria-pressed="false"
                class="armada-visual-card group relative flex flex-col text-left rounded-2xl overflow-hidden transition-all duration-200 focus:outline-none active:scale-[0.97] min-w-0 w-full border border-slate-200 bg-white hover:border-amber-300 hover:shadow-md shadow-sm">
                <div class="relative w-full aspect-[16/9] sm:aspect-[16/10] bg-slate-900 overflow-hidden shrink-0">
                    <img src="${escapeArmadaHtml(poImg)}"
                        alt="${escapeArmadaHtml(name)}"
                        loading="lazy"
                        class="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                        onerror="this.onerror=null; this.src='damri.webp';">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/10 to-black/15 pointer-events-none"></div>

                    ${poLogo ? `
                    <div class="armada-logo-chip absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-white/95 backdrop-blur-sm px-1.5 py-0.5 rounded-md shadow-sm border border-white/60 max-w-[54px] pointer-events-none">
                        <img src="${escapeArmadaHtml(poLogo)}" alt="" class="h-3 sm:h-3.5 w-auto object-contain" onerror="this.parentElement.style.display='none'">
                    </div>` : ''}

                    <div class="armada-check-badge absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all duration-200 pointer-events-none bg-slate-950/45 border border-white/70 text-transparent backdrop-blur-sm scale-90 group-hover:scale-100">
                        <i class="fas fa-check text-[9px] sm:text-[10px] font-black"></i>
                    </div>

                    ${subLabel ? `
                    <div class="absolute bottom-1.5 left-2 right-2 flex items-center pointer-events-none">
                        <span class="inline-flex items-center gap-1 text-[8.5px] sm:text-[9px] font-extrabold uppercase tracking-wider text-amber-300 truncate">
                            <i class="fas fa-bus text-[8px]"></i> ${escapeArmadaHtml(subLabel)}
                        </span>
                    </div>` : ''}
                </div>

                <div class="armada-card-footer w-full px-2.5 py-2 sm:px-3 sm:py-2.5 flex items-center justify-between gap-1.5 flex-1 min-h-[38px] sm:min-h-[44px] bg-white transition-colors">
                    <span class="armada-card-title font-black text-[11px] sm:text-xs uppercase tracking-tight leading-tight line-clamp-2 text-slate-800">${escapeArmadaHtml(name)}</span>
                    <i class="armada-card-arrow fas fa-chevron-right text-[10px] text-slate-300 shrink-0 transition-all duration-200"></i>
                </div>
            </button>
        `;
    }).join('');

    container.onclick = (e) => {
        const btn = e.target.closest('.armada-visual-card');
        if (!btn || !container.contains(btn)) return;
        const val = btn.getAttribute('data-armada-value') || '';
        if (select) {
            select.value = val;
            if (typeof onSelect === 'function') {
                onSelect(val);
            } else {
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } else if (typeof onSelect === 'function') {
            onSelect(val);
        }
        updateArmadaVisualPickerSelection(containerId, selectId, badgeId, val);
    };

    updateArmadaVisualPickerSelection(containerId, selectId, badgeId, currentVal);
}

if (typeof window !== 'undefined') {
    window.getPoProfiles = getPoProfiles;
    window.getPoProfile = getPoProfile;
    window.getSiteConfig = getSiteConfig;
    window.renderArmadaVisualPicker = renderArmadaVisualPicker;
    window.updateArmadaVisualPickerSelection = updateArmadaVisualPickerSelection;
}
