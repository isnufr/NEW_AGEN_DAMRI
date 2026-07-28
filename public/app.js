const SCRIPT_URL = "/api";

// ==========================================
// 1. DATA CACHE & STATE
// ==========================================
let cachedArmadas = [];
let cachedBookings = [];
let cachedLaporan = [];
let isDataLoaded = false;

// ==========================================
// 2. NETWORK HELPER (FETCH & POST)
// ==========================================
async function fetchFromSheets(action, params = "") {
    try {
        const url = `${SCRIPT_URL}?action=${action}${params}&_t=${Date.now()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Network response was not ok");
        const json = await res.json();
        
        // Google Sheets API returns { status: "success", data: [...] }
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
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: action, payload: payload })
        });
        return await res.json();
    } catch (e) {
        console.error("Error posting to sheets:", e);
        return { status: "error", message: "Gagal menghubungi server" };
    }
}

// ==========================================
// 3. INITIALIZATION & MAPPING DATA
// ==========================================
async function initData() {
    if (isDataLoaded) return true;

    try {
        const [bData, aData, lData] = await Promise.all([
            fetchFromSheets('getBookings'),
            fetchFromSheets('getArmada'),
            fetchFromSheets('getLaporan')
        ]);

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
                    capacity: parseInt(find(["Kapasitas", "Seat", "seat", "kapasitas", "KAPASITAS"])) || 40
                };
            });
            localStorage.setItem("app_armadas", JSON.stringify(cachedArmadas));
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
                
                if (bStatus === "LUNAS" || bStatus === "ACC" || bPembayaran === "LUNAS" || bPembayaran === "ACC" || bStatus === "BELUM LUNAS" || bPembayaran === "BELUM LUNAS") {
                    statusLocal = "paid";
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
                    armadaId: armadaMatch ? armadaMatch.id : "UNKNOWN",
                    qty: parseInt(b["JUMLAH PNP"]) || 1,
                    totalPrice: parseInt(b["Total Harga"]) || parseInt(b["Harga"]) || 0,
                    status: statusLocal,
                    dateCreated: b["Timestamp"] || "",
                    dateTravel: tgl,
                    waktu: b["WAKTU"] || "",
                    pembayaran: b["PEMBAYARAN"] || "",
                    keterangan: b["KETERANGAN"] || "",
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

        isDataLoaded = true;
        return true;
    } catch (error) {
        console.error("Critical error in initData:", error);
        
        // Fallback to localStorage if fetch fails
        const localA = localStorage.getItem("app_armadas");
        const localB = localStorage.getItem("app_bookings");
        const localL = localStorage.getItem("app_laporan");
        if (localA) cachedArmadas = JSON.parse(localA);
        if (localB) cachedBookings = JSON.parse(localB);
        if (localL) cachedLaporan = JSON.parse(localL);
        
        isDataLoaded = true;
        return false;
    }
}

// ==========================================
// 4. GETTERS
// ==========================================
function getArmadas() {
    return cachedArmadas;
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
