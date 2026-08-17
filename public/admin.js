    // ========================================
    // AUTH CHECK
    // ========================================
    if (localStorage.getItem('isAdminLoggedIn') !== 'true' || !localStorage.getItem('adminToken')) {
        localStorage.removeItem('isAdminLoggedIn');
        window.location.href = 'login.html';
    }

    function logout() {
        localStorage.removeItem('isAdminLoggedIn');
        localStorage.removeItem('adminToken');
        window.location.href = 'login.html';
    }

    // ========================================
    // STATE
    // ========================================
    let currentMenu = 'dashboard';
    let currentFilter = 'all';
    let chartOmsetInstance = null;
    let chartArmadaInstance = null;
    let chartPenumpangInstance = null;

    // ========================================
    // INIT
    // ========================================
    window.addEventListener('DOMContentLoaded', async () => {
        const today = new Date();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        if(document.getElementById('laporanBulanInput')) {
            document.getElementById('laporanBulanInput').value = `${yyyy}-${mm}`;
        }
        await loadAllData();
    });

    const SKELETON_HTML = `
        <tr class="animate-pulse border-b border-slate-50"><td colspan="6" class="p-4"><div class="flex items-center gap-4"><div class="w-10 h-10 bg-slate-200 rounded-xl flex-shrink-0"></div><div class="flex-1 space-y-2"><div class="h-4 bg-slate-200 rounded w-1/3"></div><div class="h-3 bg-slate-100 rounded w-1/4"></div></div><div class="w-16 h-6 bg-slate-200 rounded-lg flex-shrink-0"></div></div></td></tr>
        <tr class="animate-pulse border-b border-slate-50"><td colspan="6" class="p-4"><div class="flex items-center gap-4"><div class="w-10 h-10 bg-slate-200 rounded-xl flex-shrink-0"></div><div class="flex-1 space-y-2"><div class="h-4 bg-slate-200 rounded w-1/2"></div><div class="h-3 bg-slate-100 rounded w-1/3"></div></div><div class="w-16 h-6 bg-slate-200 rounded-lg flex-shrink-0"></div></div></td></tr>
        <tr class="animate-pulse border-b border-slate-50"><td colspan="6" class="p-4"><div class="flex items-center gap-4"><div class="w-10 h-10 bg-slate-200 rounded-xl flex-shrink-0"></div><div class="flex-1 space-y-2"><div class="h-4 bg-slate-200 rounded w-2/5"></div><div class="h-3 bg-slate-100 rounded w-1/5"></div></div><div class="w-16 h-6 bg-slate-200 rounded-lg flex-shrink-0"></div></div></td></tr>
    `;

    async function loadAllData() {
        // Tampilkan skeleton sebelum fetch data
        ['todayTableBody', 'pesananTableBody', 'armadaTableBody'].forEach(id => {
            if(document.getElementById(id)) document.getElementById(id).innerHTML = SKELETON_HTML;
        });

        isDataLoaded = false;
        await initData();
        
        // Populate static dropdowns globally
        const armadas = getArmadas();
        const activeArmadas = armadas.filter(a => a.isActive !== false);
        const armadaNameSelect = document.getElementById('adminBookingArmadaName');
        if (armadaNameSelect) {
            const uniqueNames = [...new Set(activeArmadas.map(a => a.name))];
            armadaNameSelect.innerHTML = '<option value="">-- Pilih Armada --</option>' + uniqueNames.map(n => `<option value="${n}">${n}</option>`).join('');
            
            const timeSelect = document.getElementById('adminBookingTime');
            if(timeSelect) timeSelect.innerHTML = '<option value="">-- Pilih Jam --</option>';

            const ruteSelect = document.getElementById('adminBookingArmada');
            if(ruteSelect) ruteSelect.innerHTML = '<option value="">-- Pilih Rute --</option>';
            
            if(typeof recalcAdminBooking === 'function') recalcAdminBooking();
        }
        


        renderAll();
        document.getElementById('loadingOverlay').classList.add('hidden');
    }

    // ========================================
    // SIDEBAR TOGGLE (mobile)
    // ========================================
    function toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('sidebarOverlay').classList.toggle('show');
    }

    // ========================================
    // MENU SWITCHING
    // ========================================
    function switchMenu(menu) {
        currentMenu = menu;

        // Update nav items
        document.querySelectorAll('.nav-item[data-menu]').forEach(el => {
            el.classList.toggle('active', el.dataset.menu === menu);
        });

        // Update content sections
        document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
        const target = document.getElementById('sec-' + menu);
        if (target) target.classList.add('active');

        // Close sidebar on mobile
        if (window.innerWidth < 1024) toggleSidebar();

        renderAll();
    }

    // ========================================
    // FILTER
    // ========================================
    function setFilter(f) {
        currentFilter = f;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === f);
        });
        renderDashboard();
    }

    // ========================================
    // DATE HELPERS
    // ========================================
    const INDO_MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const INDO_DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

    function getLocalYYYYMMDD(dObj) {
        if (!dObj) dObj = new Date();
        const yyyy = dObj.getFullYear();
        const mm = String(dObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dObj.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    function parseIndoDate(str) {
        if (!str) return null;
        str = String(str).trim();

        // 1. If it's an ISO string from database (e.g. 2026-07-16T17:00:00.000Z), 
        // letting new Date() parse it will correctly convert it to the local timezone.
        if (str.includes('T')) {
            const d = new Date(str);
            if (!isNaN(d.getTime())) return d;
        }

        // 2. Remove day name if present (e.g. "Minggu, ")
        str = str.replace(/^[A-Za-z]+,\s*/, '');

        // 3. Parse format: "26 April 2026"
        const parts = str.split(/\s+/);
        if (parts.length >= 3) {
            const day = parseInt(parts[0]);
            const monthIdx = INDO_MONTHS.findIndex(m => m.toLowerCase() === parts[1].toLowerCase());
            const year = parseInt(parts[2]);
            if (!isNaN(day) && monthIdx !== -1 && !isNaN(year)) {
                return new Date(year, monthIdx, day);
            }
        }

        // 4. Parse format: "DD/MM/YYYY" or "DD-MM-YYYY"
        const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (dmyMatch) {
            return new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
        }

        // 5. Try standard parsing as fallback
        const dFallback = new Date(str);
        return isNaN(dFallback.getTime()) ? null : dFallback;
    }

    function getEffectiveHarga(armada, dateObj) {
        if (!armada) return 0;
        let finalHarga = armada.price;
        
        if (dateObj && typeof fetchAllHargaKhusus === 'function') {
            const hkList = typeof cachedHargaKhusus !== 'undefined' ? cachedHargaKhusus : [];
            const selectedDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();
            
            const allArmadas = getArmadas();
            const matchingArmadaIds = allArmadas
                .filter(arm => arm.name === armada.name && arm.destination === armada.destination)
                .map(arm => arm.id);
                
            const activeHk = hkList.find(hk => {
                if (!matchingArmadaIds.includes(hk.idArmada)) return false;
                
                const [sY, sM, sD] = String(hk.tanggalAwal).split('T')[0].split('-');
                const [eY, eM, eD] = String(hk.tanggalAkhir).split('T')[0].split('-');
                
                const start = new Date(sY, parseInt(sM)-1, sD).getTime();
                const end = new Date(eY, parseInt(eM)-1, eD).getTime();
                
                return selectedDate >= start && selectedDate <= end;
            });
            
            if (activeHk) {
                finalHarga = parseInt(activeHk.hargaBaru) || armada.price;
            }
        }
        return finalHarga;
    }

    function toDateKey(d) {
        if (!d) return '';
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }

    function getTodayKey() {
        return toDateKey(new Date());
    }

    function isToday(dateStr) {
        const d = parseIndoDate(dateStr);
        return d ? toDateKey(d) === getTodayKey() : false;
    }

    function isInPeriod(dateStr) {
        const d = parseIndoDate(dateStr);
        if (!d) return false;
        const today = new Date();
        today.setHours(0,0,0,0);

        if (currentFilter === 'today') {
            return toDateKey(d) === toDateKey(today);
        } else if (currentFilter === 'month') {
            return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        } else if (currentFilter === 'year') {
            return d.getFullYear() === today.getFullYear();
        } else if (currentFilter === 'range') {
            const from = document.getElementById('filterFrom').value;
            const to = document.getElementById('filterTo').value;
            const dk = toDateKey(d);
            if (from && to) return dk >= from && dk <= to;
            if (from) return dk >= from;
            if (to) return dk <= to;
            return true;
        }
        // 'all'
        return true;
    }

    function isTodayOrFuture(dateStr) {
        const d = parseIndoDate(dateStr);
        if (!d) return false;
        const today = new Date();
        today.setHours(0,0,0,0);
        return d >= today;
    }

    // ========================================
    // RENDER ALL
    // ========================================
    function renderAll() {
        updateNotifications();
        if (currentMenu === 'dashboard') renderDashboard();
        else if (currentMenu === 'today') renderTodayTable();
        else if (currentMenu === 'pesanan') renderPesanan();
        else if (currentMenu === 'armada') renderArmada();
        else if (currentMenu === 'ekstra') renderEkstra();
        else if (currentMenu === 'laporan') renderLaporan();
        else if (currentMenu === 'akun') renderAkun();
    }

    // ========================================
    // DASHBOARD
    // ========================================
    function renderDashboard() {
        const laporan = getLaporan();
        const today = new Date();

        // Filter data by period
        const periodData = laporan.filter(l => isInPeriod(l.tanggal));
        const todayData = laporan.filter(l => isToday(l.tanggal));
        const futureData = laporan.filter(l => isTodayOrFuture(l.tanggal));

        // Filter Ekstra data by period
        const ekstra = getEkstraBookings() || [];
        const ekstraPeriod = ekstra.filter(e => {
            const d = new Date(e.tanggalBerangkat);
            if(isNaN(d)) return false;
            d.setHours(0,0,0,0);
            return isInPeriod(d);
        });

        // Card 1: Total Booking (period)
        document.getElementById('cardTotalBooking').textContent = periodData.length + ekstraPeriod.length;


        // Card 3: Total Omset (period)
        const totalOmsetBus = periodData.reduce((s, l) => s + l.totalHarga, 0);
        const totalOmsetEkstra = ekstraPeriod.reduce((s, e) => s + e.totalHarga, 0);
        document.getElementById('cardTotalOmset').textContent = formatRupiah(totalOmsetBus + totalOmsetEkstra);

        // Card 4 is removed (was Setoran Hari Ini, but dashboard only has Total Setoran now)
        // const setoranToday = todayData.reduce((s, l) => s + l.totalHarga, 0) - todayData.reduce((s, l) => s + l.totalKomisi, 0);

        // Card 5: Total Setoran (today + future) (no ekstra)
        const totalSetoran = futureData.reduce((s, l) => s + l.totalHarga, 0) - futureData.reduce((s, l) => s + l.totalKomisi, 0);
        document.getElementById('cardTotalSetoran').textContent = formatRupiah(totalSetoran);


        // Card 7: Total Pendapatan (period)
        const totalPendapatanBus = periodData.reduce((s, l) => s + l.totalKomisi, 0);
        const totalPendapatanEkstra = ekstraPeriod.reduce((s, e) => s + e.komisi, 0);
        document.getElementById('cardTotalPendapatan').textContent = formatRupiah(totalPendapatanBus + totalPendapatanEkstra);

        // Charts
        renderCharts(periodData);
    }

    function renderCharts(data) {
        // Group data by date for 16-day window (8 before, today, 7 after)
        const byDate = {};
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const dates16 = [];
        for(let i = -8; i <= 7; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            dates16.push(toDateKey(d));
        }
        
        dates16.forEach(k => { byDate[k] = { omset: 0, pnp: 0 }; });

        const allLaporan = getLaporan();
        allLaporan.forEach(l => {
            const d = parseIndoDate(l.tanggal);
            if (!d) return;
            const key = toDateKey(d);
            if (byDate[key] !== undefined) {
                byDate[key].omset += l.totalHarga;
                byDate[key].pnp += (parseInt(l.jumlahPnp) || 1);
            }
        });

        const labels = dates16.map(k => {
            const d = new Date(k + 'T00:00:00');
            return d.getDate() + '/' + (d.getMonth()+1);
        });
        const omsetValues = dates16.map(k => byDate[k].omset);
        const pnpValues = dates16.map(k => byDate[k].pnp);

        // Bar Chart: Omset
        if (chartOmsetInstance) chartOmsetInstance.destroy();
        const ctxBar = document.getElementById('chartOmset');
        if (ctxBar) {
            chartOmsetInstance = new Chart(ctxBar, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Omset (Rp)',
                        data: omsetValues,
                        backgroundColor: 'rgba(59, 130, 246, 0.7)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1,
                        borderRadius: 6,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: ctx => formatRupiah(ctx.parsed.y) } }
                    },
                    scales: {
                        y: { beginAtZero: true, ticks: { callback: v => 'Rp ' + (v/1000) + 'rb', font: { size: 10, weight: 'bold' } }, grid: { color: '#f1f5f9' } },
                        x: { ticks: { font: { size: 10, weight: 'bold' } }, grid: { display: false } }
                    }
                }
            });
        }

        // Donut Chart: Distribusi Armada
        const byArmada = {};
        data.forEach(l => {
            const name = l.jenisKendaraan || 'Lainnya';
            byArmada[name] = (byArmada[name] || 0) + 1;
        });
        const armadaLabels = Object.keys(byArmada);
        const armadaValues = Object.values(byArmada);
        const armadaColors = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16','#f97316','#6366f1'];

        if (chartArmadaInstance) chartArmadaInstance.destroy();
        const ctxDonut = document.getElementById('chartArmada');
        if (ctxDonut) {
            chartArmadaInstance = new Chart(ctxDonut, {
                type: 'doughnut',
                data: {
                    labels: armadaLabels,
                    datasets: [{ data: armadaValues, backgroundColor: armadaColors.slice(0, armadaLabels.length), borderWidth: 2, borderColor: '#fff' }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyle: 'circle', font: { size: 10, weight: 'bold' } } } },
                    cutout: '60%'
                }
            });
        }

        // Line Chart: Tren Penumpang
        if (chartPenumpangInstance) chartPenumpangInstance.destroy();
        const ctxLine = document.getElementById('chartPenumpang');
        if (ctxLine) {
            chartPenumpangInstance = new Chart(ctxLine, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Jumlah Penumpang',
                        data: pnpValues,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2.5,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10, weight: 'bold' } }, grid: { color: '#f1f5f9' } },
                        x: { ticks: { font: { size: 10, weight: 'bold' } }, grid: { display: false } }
                    }
                }
            });
        }
    }

    window.resetDashboardDateFilter = function() {
        const fromEl = document.getElementById('filterFrom');
        const toEl = document.getElementById('filterTo');
        if (fromEl) fromEl.value = '';
        if (toEl) toEl.value = '';
        setFilter('all');
    }

    window.resetManifestFilter = function() {
        const el = document.getElementById('manifestFilterDate');
        if(el) el.value = '';
        const searchEl = document.getElementById('manifestSearchInput');
        if(searchEl) searchEl.value = '';
        renderTodayTable();
    };

    function renderTodayTable() {
        // Record open manifests before re-render
        const openManifestIds = [];
        const currentRows = document.querySelectorAll('tr[id^="manifest-"]:not(.hidden)');
        if (currentRows) {
            currentRows.forEach(row => openManifestIds.push(row.id));
        }

        const tbody = document.getElementById('todayTableBody');
        if (!tbody) return;

        const filterDateEl = document.getElementById('manifestFilterDate');
        const filterDate = filterDateEl ? filterDateEl.value : '';
        let targetIndoDate = '';
        if (filterDate) {
            const [yyyy, mm, dd] = filterDate.split('-');
            const dObj = new Date(parseInt(yyyy), parseInt(mm)-1, parseInt(dd));
            targetIndoDate = INDO_DAYS[dObj.getDay()] + ', ' + dObj.getDate() + ' ' + INDO_MONTHS[dObj.getMonth()] + ' ' + dObj.getFullYear();
        }
        
        const searchInputEl = document.getElementById('manifestSearchInput');
        const searchTerm = searchInputEl ? searchInputEl.value.toLowerCase() : '';

        const allBookings = getBookings();
        // filter today and future AND confirmed (ACC/LUNAS)
        const manifestBookings = allBookings.filter(b => {
            const isConfirmed = b.status === "paid" || 
                                b.pembayaran === "LUNAS" || 
                                b.pembayaran === "ACC" || 
                                String(b.pembayaran).toUpperCase() === "ACC" ||
                                String(b.status).toUpperCase() === "ACC" ||
                                String(b.status).toUpperCase() === "LUNAS" ||
                                String(b.status).toUpperCase() === "PAID" ||
                                String(b.status).toUpperCase() === "BELUM LUNAS" ||
                                String(b.pembayaran).toUpperCase() === "BELUM LUNAS";
                                
            const armada = b.armadaId !== 'UNKNOWN' ? getArmada(b.armadaId) : null;
            const armadaName = armada ? armada.name.toLowerCase() : '';
            const tgl = b.dateTravel ? b.dateTravel.toLowerCase() : '';
            const name = b.name ? b.name.toLowerCase() : '';
            const ticketId = b.id ? String(b.id).toLowerCase() : '';
            const tj = b.tujuan ? b.tujuan.toLowerCase() : '';
            const tk = b.titikKumpul ? b.titikKumpul.toLowerCase() : '';
            const p = b.penumpangList ? b.penumpangList.toLowerCase() : '';
            
            const matchSearch = searchTerm === '' || 
                                armadaName.includes(searchTerm) || 
                                name.includes(searchTerm) || 
                                ticketId.includes(searchTerm) || 
                                tj.includes(searchTerm) || 
                                tk.includes(searchTerm) ||
                                p.includes(searchTerm) ||
                                tgl.includes(searchTerm);
                                
            if (!matchSearch) return false;

            if (targetIndoDate) {
                return b.dateTravel === targetIndoDate && isConfirmed;
            }
            return isTodayOrFuture(b.dateTravel) && isConfirmed;
        });

        // --- Summary Cards ---
        const todayOnlyBookings = targetIndoDate ? manifestBookings : manifestBookings.filter(b => isToday(b.dateTravel));
        const todayPnp = todayOnlyBookings.reduce((sum, b) => sum + (parseInt(b.qty) || 1), 0);
        
        // Count unique armada berangkat hari ini
        const todayArmadaSet = new Set();
        todayOnlyBookings.forEach(b => {
            const waktu = b.waktu || '-';
            const armada = b.armadaId !== 'UNKNOWN' ? getArmada(b.armadaId) : null;
            const armadaName = armada ? armada.name : '-';
            todayArmadaSet.add(waktu + '___' + armadaName);
        });
        
        const todayOmset = todayOnlyBookings.reduce((sum, b) => sum + (parseInt(b.totalPrice) || 0), 0);
        // Setoran is Omset - Komisi (10% of Omset)
        const todaySetoran = todayOmset * 0.9;
        
        const elPnp = document.getElementById('manifestTotalPnpToday');
        const elArmada = document.getElementById('manifestTotalArmada');
        const elOmset = document.getElementById('manifestOmsetToday');
        const elSetoran = document.getElementById('manifestSetoranToday');
        const labelEl = document.getElementById('todayDateLabel');
        
        if (elPnp) elPnp.textContent = todayPnp + ' Orang';
        if (elArmada) elArmada.textContent = todayArmadaSet.size + ' Armada';
        if (elOmset) elOmset.textContent = formatRupiah(todayOmset);
        if (elSetoran) elSetoran.textContent = formatRupiah(todaySetoran);
        if (labelEl) labelEl.textContent = targetIndoDate ? targetIndoDate : 'Hari Ini & Mendatang';

        if (manifestBookings.length === 0) {
            tbody.innerHTML = '<tr><td class="text-center text-sm text-slate-400 font-bold py-8 italic uppercase tracking-widest">Tidak ada jadwal keberangkatan</td></tr>';
            return;
        }

        // Group by Date ONLY
        const groups = {};
        manifestBookings.forEach(b => {
            const dateStr = b.dateTravel || 'UNKNOWN_DATE';
            const key = dateStr;
            if(!groups[key]) {
                groups[key] = {
                    dateTravel: dateStr,
                    bookings: []
                };
            }
            groups[key].bookings.push(b);
        });

        const sortedGroups = Object.values(groups).sort((a,b) => {
            const dA = parseIndoDate(a.dateTravel);
            const dB = parseIndoDate(b.dateTravel);
            if(dA && dB && dA.getTime() !== dB.getTime()) return dA - dB;
            return 0;
        });

        let html = '';
        sortedGroups.forEach((g) => {
            const totalPnp = g.bookings.reduce((sum, b) => sum + (parseInt(b.qty) || 1), 0);

            let formattedDate = g.dateTravel;
            if (isToday(g.dateTravel)) {
                formattedDate = "HARI INI";
            } else {
                const dObj = parseIndoDate(g.dateTravel);
                if (dObj) {
                    formattedDate = INDO_DAYS[dObj.getDay()] + ', ' + dObj.getDate() + ' ' + INDO_MONTHS[dObj.getMonth()] + ' ' + dObj.getFullYear();
                }
            }
            
            // Sort inner bookings by time (jam pemberangkatan)
            g.bookings.sort((a, b) => (a.waktu || '').localeCompare(b.waktu || ''));

            const safeIdStr = (g.dateTravel || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
            const safeId = 'manifest-' + safeIdStr;
            const isOpen = openManifestIds.includes(safeId) || sortedGroups.length === 1;
            const rowClass = isOpen ? 'bg-white' : 'hidden bg-white';
            const iconTransform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';

            // Header Row (Clickable)
            html += `
                <tr class="cursor-pointer group" onclick="toggleManifest('${safeId}')">
                    <td class="p-2 sm:p-4 border-b-8 border-transparent">
                        <div class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-4 sm:p-5 text-white shadow-xl shadow-slate-900/20 border border-slate-700 transition-all group-hover:-translate-y-1 group-hover:shadow-2xl group-hover:border-amber-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div class="flex items-center gap-4 w-full sm:w-auto">
                                <div class="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center text-amber-500 shadow-inner shrink-0">
                                    <i class="fas fa-calendar-alt text-xl"></i>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight mb-1">Waktu Pemberangkatan</p>
                                    <p class="font-black text-sm sm:text-base text-white uppercase truncate">${formattedDate}</p>
                                </div>
                            </div>
                            <div class="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 border-t border-slate-700 sm:border-0 pt-3 sm:pt-0">
                                <div class="text-left sm:text-right flex-1 sm:flex-none">
                                    <p class="font-black text-lg sm:text-xl text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">${totalPnp} PNP</p>
                                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">${g.bookings.length} Pesanan</p>
                                </div>
                                <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 group-hover:bg-amber-500 group-hover:text-slate-900 transition-colors shrink-0">
                                    <i class="fas fa-chevron-down transition-transform duration-300" id="icon-${safeId}" style="transform: ${iconTransform}"></i>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            `;

            // Expanded Row (Hidden by default unless previously open)
            html += `
                <tr id="${safeId}" class="${rowClass}">
                    <td class="p-0">
                        <div class="px-2 py-3 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
            `;

            // Group inner bookings by Waktu & Armada
            const innerGroups = {};
            g.bookings.forEach(b => {
                const armada = b.armadaId !== 'UNKNOWN' ? getArmada(b.armadaId) : null;
                const armadaName = armada ? armada.name : (b.kendaraan || b['JENIS KENDARAAN'] || '-');
                const tujuan = armada ? armada.destination : (b.tujuan || b['Tujuan'] || '-');
                const waktu = b.waktu || b['WAKTU'] || '-';
                
                const key = waktu + '___' + armadaName;
                if(!innerGroups[key]) {
                    innerGroups[key] = {
                        waktu: waktu,
                        armadaName: armadaName,
                        tujuans: new Set(),
                        bookings: []
                    };
                }
                innerGroups[key].tujuans.add(tujuan);
                innerGroups[key].bookings.push(b);
            });

            // Sort keys by time
            const sortedInnerKeys = Object.keys(innerGroups).sort();

            sortedInnerKeys.forEach(key => {
                const ig = innerGroups[key];
                const innerTotalPnp = ig.bookings.reduce((sum, b) => sum + (parseInt(b.qty || b['JUMLAH PNP']) || 1), 0);
                const combinedTujuan = Array.from(ig.tujuans).join(', ');
                
                html += `
                            <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <div class="bg-slate-200/80 border-b-2 border-slate-300 px-3 py-2 flex items-center justify-between gap-2">
                                    <div class="flex items-center gap-2 min-w-0 flex-1">
                                        <div class="bg-blue-600 text-white font-black text-[10px] sm:text-xs px-2 py-1 rounded shadow-sm leading-none shrink-0">${ig.waktu}</div>
                                        <p class="font-black text-xs sm:text-sm text-slate-700 uppercase tracking-wide truncate">${ig.armadaName}</p>
                                    </div>
                                    <span class="inline-block bg-white text-orange-600 border border-orange-200 px-2 py-1 rounded text-[9px] sm:text-[10px] font-black uppercase shadow-sm whitespace-nowrap shrink-0">${innerTotalPnp} PNP</span>
                                </div>
                                <!-- Group List -->
                                <div class="flex flex-col">
                `;

                ig.bookings.forEach(b => {
                    const isPaid = (b.status === 'paid' || String(b.status).toUpperCase() === 'LUNAS' || String(b.status).toUpperCase() === 'ACC');
                    const badgeClass = isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
                    const badgeText = isPaid ? 'LUNAS' : 'BELUM LUNAS';
                    const ket = b.keterangan || b['Keterangan'] || b['KETERANGAN'] || '';
                    
                    const bId = b.bookingId || b.id || '-';
                    const bTujuan = b.armadaId !== 'UNKNOWN' && getArmada(b.armadaId) ? getArmada(b.armadaId).destination : (b.tujuan || b['Tujuan'] || '-');
                    const bName = b.name || b['NAMA'] || '-';
                    const bHp = b.hp || b['NOMOR HP'] || '-';
                    const bQty = b.qty || b['JUMLAH PNP'] || 1;
                    const bKursi = b.kursi || '-';
                    
                    // --- Cek Harga Khusus Mismatch ---
                    let warningHtml = '';
                    if (b.dateTravel && b.armadaId !== 'UNKNOWN') {
                        const bDate = parseIndoDate(b.dateTravel);
                        const allHk = getHargaKhususList();
                        
                        if (bDate && allHk && allHk.length > 0) {
                            const bTime = bDate.getTime();
                            
                            // Cari aturan HK yang aktif untuk armada & tanggal ini
                            const bArmada = getArmada(b.armadaId);
                            let matchingArmadaIds = [];
                            if (bArmada) {
                                matchingArmadaIds = getArmadas()
                                    .filter(a => a.name === bArmada.name && a.destination === bArmada.destination)
                                    .map(a => a.id);
                            }

                            const matchingRule = allHk.find(h => {
                                if (!matchingArmadaIds.includes(h.idArmada)) return false;
                                
                                const [sY, sM, sD] = String(h.tanggalAwal).split('T')[0].split('-');
                                const [eY, eM, eD] = String(h.tanggalAkhir).split('T')[0].split('-');
                                const start = new Date(sY, parseInt(sM)-1, sD).getTime();
                                const end = new Date(eY, parseInt(eM)-1, eD).getTime();
                                
                                return bTime >= start && bTime <= end;
                            });

                            if (matchingRule) {
                                // Bandingkan harga pesanan (hargaSatuan) dengan hargaBaru
                                const currentPrice = Math.floor((parseInt(b.totalPrice) || 0) / (parseInt(b.qty) || 1));
                                const hkPrice = parseInt(matchingRule.hargaBaru);
                                
                                if (currentPrice !== hkPrice && currentPrice > 0) {
                                    warningHtml = `
                                        <div class="mt-1 flex items-center gap-1 text-[9px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded w-fit border border-orange-100" title="Pesanan ini belum menggunakan Harga Khusus. Harga aturan saat ini adalah Rp ${formatRupiah(hkPrice)}. Silakan konfirmasi dan edit.">
                                            <i class="fas fa-exclamation-triangle"></i> Harga belum update
                                        </div>
                                    `;
                                }
                            }
                        }
                    }
                    const waNumber = String(bHp).replace(/\D/g, '').replace(/^0/, '62');

                    html += `
                                    <div class="flex items-center justify-between p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors gap-3 w-full overflow-hidden">
                                        <!-- Left: Data -->
                                        <div class="flex-1 min-w-0 flex flex-col pr-1">
                                            <!-- Row 1: ID, Tujuan & Status (Mobile) -->
                                            <div class="flex items-center justify-between mb-1 gap-2">
                                                <span class="text-[10px] font-black text-blue-600 truncate flex-1 min-w-0">${bId} - ${bTujuan}</span>
                                                <span class="sm:hidden inline-block px-1.5 py-0.5 rounded text-[8px] font-black shrink-0 ${badgeClass}">${badgeText}</span>
                                            </div>
                                            
                                            <!-- Row 2: Name & WA -->
                                            <div class="flex items-center gap-2 mb-1.5 w-full">
                                                <span class="font-bold text-sm text-slate-800 uppercase truncate flex-1 min-w-0">${bName}</span>
                                                <a href="https://wa.me/${waNumber}" target="_blank" class="shrink-0 bg-green-100 text-green-600 hover:bg-green-200 w-6 h-6 rounded flex items-center justify-center transition-colors" title="Hubungi via WhatsApp">
                                                    <i class="fab fa-whatsapp"></i>
                                                </a>
                                            </div>
                                            
                                            <!-- Row 3: Qty & Kursi -->
                                            <div class="flex items-center gap-3 text-[10px] font-bold text-slate-600">
                                                <span class="flex items-center gap-1"><i class="fas fa-users text-slate-400"></i> ${bQty} PNP</span>
                                                <span class="flex items-center gap-1"><i class="fas fa-chair text-slate-400"></i> ${bKursi}</span>
                                            </div>

                                            <!-- Row 4: Keterangan & Warning (if any) -->
                                            ${ket ? `<div class="mt-2 text-[9px] text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-100 max-w-full truncate inline-block w-fit"><i class="fas fa-info-circle mr-1"></i>${ket}</div>` : ''}
                                            ${warningHtml ? `<div class="mt-1">${warningHtml}</div>` : ''}
                                        </div>

                                        <!-- Right: Actions (Desktop Status & Buttons) -->
                                        <div class="flex flex-col sm:flex-row items-end sm:items-center gap-3 shrink-0">
                                            <!-- Desktop Status -->
                                            <div class="hidden sm:block">
                                                <span class="inline-block px-2 py-1 rounded text-[10px] font-black ${badgeClass}">${badgeText}</span>
                                            </div>
                                            
                                            <!-- Actions -->
                                            <div class="flex gap-2">
                                                <button onclick="openETicket('${bId}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center transition-colors shadow-sm" title="E-Tiket">
                                                    <i class="fas fa-ticket-alt"></i>
                                                </button>
                                                <button onclick="openEditBookingModal('${bId}')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 w-8 h-8 rounded-lg flex items-center justify-center transition-colors shadow-sm" title="Edit">
                                                    <i class="fas fa-edit"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                    `;
                });

                html += `
                                </div>
                            </div>
                `;
            });

            html += `
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    // Add global toggleManifest function
    window.toggleManifest = function(id) {
        const el = document.getElementById(id);
        const icon = document.getElementById('icon-' + id);
        if (el) {
            el.classList.toggle('hidden');
            if (icon) {
                icon.style.transform = el.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        }
    };

    // ========================================
    // REQUEST PESANAN
    // ========================================
    // ========================================
    // NOTIFICATIONS SYSTEM
    // ========================================
    function updateNotifications() {
        const allBookings = getBookings().slice();
        const requests = allBookings.filter(b => b.status === 'waiting_payment' || b.status === 'Belum ACC' || b.status === 'BELUM ACC' || b.status === 'WAITING');
        
        const badgeMobile = document.getElementById('notifBadgeMobile');
        const badgeDesktop = document.getElementById('notifBadgeDesktop');
        const listContainer = document.getElementById('notifListContainer');
        
        // Update Badges
        if (requests.length > 0) {
            if (badgeMobile) { badgeMobile.innerText = requests.length; badgeMobile.classList.remove('hidden'); }
            if (badgeDesktop) { badgeDesktop.innerText = requests.length; badgeDesktop.classList.remove('hidden'); }
        } else {
            if (badgeMobile) badgeMobile.classList.add('hidden');
            if (badgeDesktop) badgeDesktop.classList.add('hidden');
        }

        // Update Modal Content
        if (!listContainer) return;
        
        if (requests.length === 0) {
            listContainer.innerHTML = '<div class="text-center text-sm text-slate-400 font-bold py-8 italic uppercase tracking-widest">Tidak ada pesanan baru</div>';
            return;
        }

        listContainer.innerHTML = requests.map(b => {
            const armada = b.armadaId !== 'UNKNOWN' ? getArmada(b.armadaId) : null;
            const armadaName = armada ? armada.name : '-';
            const tujuan = armada ? armada.destination : '-';
            
            return `
            <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3 relative">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-black uppercase">Belum ACC</span>
                        <span class="text-xs font-black text-slate-500">${b.bookingId}</span>
                    </div>
                    <h3 class="font-bold text-sm text-slate-800 uppercase">${b.name} <span class="text-slate-400 font-normal">(${b.hp})</span></h3>
                    <p class="text-xs text-slate-500 mt-1">
                        <b>${armadaName}</b> &rarr; ${tujuan}
                    </p>
                    <p class="text-[10px] text-slate-400 font-bold mt-1">
                        <i class="fas fa-calendar-alt mr-1"></i> ${b.dateTravel || '-'} | ${b.qty} Orang | ${formatRupiah(b.totalPrice)}
                    </p>
                </div>
                <div class="flex gap-2 shrink-0">
                    <button onclick="openConfirmModal('${b.bookingId}')" class="flex-1 sm:flex-none py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest rounded-lg shadow-md transition-all">ACC</button>
                    <button onclick="openDeleteModal('${b.bookingId}')" class="flex-1 sm:flex-none py-2 px-4 bg-red-100 hover:bg-red-200 text-red-600 font-bold text-xs uppercase tracking-widest rounded-lg transition-all">Tolak</button>
                </div>
            </div>`;
        }).join('');
    }

    function openNotifModal() {
        const modal = document.getElementById('notifModal');
        const inner = document.getElementById('notifModalInner');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            inner.classList.remove('scale-95', 'opacity-0');
            inner.classList.add('scale-100', 'opacity-100');
        }, 10);
    }

    function closeNotifModal() {
        const modal = document.getElementById('notifModal');
        const inner = document.getElementById('notifModalInner');
        inner.classList.remove('scale-100', 'opacity-100');
        inner.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300);
    }

    // ========================================
    // DAFTAR PESANAN (with search and pagination)
    // ========================================
    let currentPagePesanan = 1;
    const itemsPerPagePesanan = 10;
    let filteredPesanan = [];

    function renderPesanan(resetPage = false) {
        if (resetPage) currentPagePesanan = 1;

        const query = (document.getElementById('pesananSearch')?.value || '').toLowerCase().trim();
        let allBookings = getBookings().filter(b => (b.status === 'paid' || String(b.status).toUpperCase() === 'LUNAS' || String(b.status).toUpperCase() === 'ACC' || String(b.status).toUpperCase() === 'BELUM LUNAS'));

        if (query) {
            allBookings = allBookings.filter(b => {
                return String(b.bookingId).toLowerCase().includes(query) ||
                       String(b.name).toLowerCase().includes(query) ||
                       String(b.dateTravel).toLowerCase().includes(query);
            });
        }

        filteredPesanan = allBookings;

        const totalPages = Math.ceil(allBookings.length / itemsPerPagePesanan) || 1;
        if (currentPagePesanan > totalPages) currentPagePesanan = totalPages;

        const startIndex = (currentPagePesanan - 1) * itemsPerPagePesanan;
        const paginatedBookings = allBookings.slice(startIndex, startIndex + itemsPerPagePesanan);

        const tbody = document.getElementById('pesananTableBody');
        if (!tbody) return;

        tbody.innerHTML = paginatedBookings.length ? paginatedBookings.map(b => buildBookingRow(b, false)).join('') :
            '<tr><td colspan="5" class="text-center text-sm text-slate-400 font-bold py-8 italic uppercase tracking-widest">Tidak ada data pesanan</td></tr>';

        // Update Pagination UI
        const pageInfo = document.getElementById('pesananPageInfo');
        const btnPrev = document.getElementById('btnPrevPesanan');
        const btnNext = document.getElementById('btnNextPesanan');

        if (pageInfo) pageInfo.textContent = `Halaman ${currentPagePesanan} dari ${totalPages} (${allBookings.length} Total)`;
        if (btnPrev) btnPrev.disabled = currentPagePesanan === 1;
        if (btnNext) btnNext.disabled = currentPagePesanan === totalPages;
    }

    function changePagePesanan(delta) {
        currentPagePesanan += delta;
        renderPesanan(false);
    }

    // ========================================
    // BOOKING ROW BUILDER
    // ========================================
    function buildBookingRow(b, showAccBtn) {
        const isPaid = (b.status === 'paid' || String(b.status).toUpperCase() === 'LUNAS' || String(b.status).toUpperCase() === 'ACC');
        const badgeClass = isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
        const badgeText = isPaid ? 'LUNAS' : 'BELUM LUNAS';

        const armada = b.armadaId !== 'UNKNOWN' ? getArmada(b.armadaId) : null;
        const tujuan = armada ? armada.destination : (b.tujuan || '-');

        // Gunakan ID saja untuk onclick agar terhindar dari error parsing string
        const safeId = String(b.bookingId || '').replace(/'/g, "\\'");
        
        const rawKet = String(b.keterangan || b['Keterangan'] || b['KETERANGAN'] || '-');
        const mKet = rawKet.match(/Biaya Tambahan: (.*?) \((Rp[ \d.,]+)\)/);
        let nominalBiayaTambahan = 0;
        if (mKet) nominalBiayaTambahan = parseInt(mKet[2].replace(/[^\d]/g, '')) || 0;
        
        const expectedTotal = armada ? parseInt(armada.price) * (parseInt(b.qty) || 1) : 0;
        const total = Math.max(parseInt(b.totalPrice) || 0, expectedTotal + nominalBiayaTambahan);

        return `<tr class="border-b border-slate-50 group hover:bg-blue-50 transition-colors cursor-pointer" onclick="openBookingDetailModal('${safeId}', ${showAccBtn})">
            <td class="py-3 px-4 font-black text-xs text-blue-900 whitespace-nowrap">${b.bookingId}</td>
            <td class="py-3 px-4 font-bold text-xs text-slate-800 uppercase truncate max-w-[120px]">${b.name}</td>
            <td class="py-3 px-4 font-bold text-[10px] text-slate-500 truncate max-w-[150px]" title="${b.alamat || '-'}">${b.alamat || '-'}</td>\n            <td class="py-3 px-4 font-bold text-xs text-slate-600 truncate max-w-[120px]">${tujuan}</td>
            <td class="py-3 px-4 font-black text-xs text-slate-800 text-right whitespace-nowrap">${formatRupiah(total)}</td>
            <td class="py-3 px-4 text-center"><span class="inline-block px-2 py-1 rounded text-[9px] font-black ${badgeClass}">${badgeText}</span></td>
        </tr>`;
    }

    // ========================================
    // BOOKING DETAIL MODAL
    // ========================================
    window.openBookingDetailModal = function(id, showAccBtn) {
        const allBookings = getBookings();
        const b = allBookings.find(x => String(x.bookingId) === String(id) || String(x.id) === String(id));
        if (!b) {
            console.error("Booking data not found for ID:", id);
            return;
        }
        const modal = document.getElementById('bookingDetailModal');
        const inner = document.getElementById('bookingDetailModalInner');
        const content = document.getElementById('bookingDetailContent');
        const actions = document.getElementById('bookingDetailActions');

        const isPaid = (b.status === 'paid' || String(b.status).toUpperCase() === 'LUNAS' || String(b.status).toUpperCase() === 'ACC');
        const badgeClass = isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
        const badgeText = isPaid ? 'LUNAS' : 'BELUM LUNAS';

        const armada = b.armadaId !== 'UNKNOWN' ? getArmada(b.armadaId) : null;
        const armadaName = armada ? armada.name : (b.kendaraan || b['JENIS KENDARAAN'] || '-');
        const tujuan = armada ? armada.destination : (b.tujuan || '-');
        
        let rawKet = String(b.keterangan || b['Keterangan'] || b['KETERANGAN'] || '-');
        const mKet = rawKet.match(/Biaya Tambahan: (.*?) \((Rp[ \d.,]+)\)/);
        let ketTambahan = '';
        let nominalBiayaTambahan = 0;
        if (mKet) {
            ketTambahan = mKet[1].trim();
            nominalBiayaTambahan = parseInt(mKet[2].replace(/[^\d]/g, '')) || 0;
            rawKet = rawKet.replace(/,?\s*Biaya Tambahan:.*?$/, '').trim();
            if (!rawKet) rawKet = '-';
        }
        
        const expectedTotal = armada ? parseInt(armada.price) * (parseInt(b.qty) || 1) : 0;
        const total = Math.max(parseInt(b.totalPrice) || 0, expectedTotal + nominalBiayaTambahan);

        const formatHp = String(b.hp || "").replace(/[^0-9]/g, '').replace(/^0/, '62');
        const waLink = `https://wa.me/${formatHp}?text=${encodeURIComponent('Halo ' + b.name + ', ')}`;
        
        let biayaTambahanHtml = '';
        if (nominalBiayaTambahan > 0) {
            biayaTambahanHtml = `
                <div class="col-span-2 bg-amber-50 p-3 rounded-lg border border-amber-100 mt-2">
                    <p class="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">Biaya Tambahan</p>
                    <p class="font-bold text-amber-700 text-xs">${formatRupiah(nominalBiayaTambahan)} <span class="font-normal text-amber-600">(${ketTambahan})</span></p>
                </div>
            `;
        }

        content.innerHTML = `
            <div class="grid grid-cols-2 gap-y-3 gap-x-4">
                <div class="col-span-2 flex justify-between items-center pb-2 border-b border-slate-100">
                    <div>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID Tiket</p>
                        <p class="font-black text-blue-600 text-lg">${b.bookingId || '-'}</p>
                    </div>
                    <span class="px-3 py-1.5 rounded-lg text-[10px] font-black ${badgeClass}">${badgeText}</span>
                </div>
                <div class="col-span-2 sm:col-span-1">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nama Penumpang</p>
                    <p class="font-bold text-slate-800 uppercase text-sm">${b.name || '-'}</p>
                </div>
                <div class="col-span-2 sm:col-span-1">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nomor HP</p>
                    <p class="font-bold text-slate-800 text-sm">${b.hp || '-'}</p>
                </div>
                <div class="col-span-2">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Armada & Tujuan</p>
                    <p class="font-bold text-slate-800 uppercase text-sm">${armadaName} &rarr; ${tujuan}</p>
                </div>
                <div class="col-span-2 sm:col-span-1">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tanggal & Waktu</p>
                    <p class="font-bold text-slate-800 text-sm">${b.dateTravel || '-'} <span class="text-blue-500 ml-1">(${b.waktu || '-'})</span></p>
                </div>
                <div class="col-span-2 sm:col-span-1">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Jumlah / Kursi</p>
                    <p class="font-bold text-slate-800 text-sm">${b.qty || 1} Orang <span class="text-slate-400 mx-1">|</span> Kursi: ${b.kursi || '-'}</p>
                </div>
                <div class="col-span-2 sm:col-span-1">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Bayar</p>
                    <p class="font-black text-orange-600 text-base">${formatRupiah(total)}</p>
                </div>
                <div class="col-span-2 sm:col-span-1">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Metode Bayar</p>
                    <p class="font-bold text-slate-800 text-sm uppercase">${b.pembayaran || '-'}</p>
                </div>
                <div class="col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100 mt-2">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Keterangan</p>
                    <p class="font-bold text-slate-700 text-xs">${rawKet}</p>
                </div>
                ${biayaTambahanHtml}
            </div>
        `;

        actions.innerHTML = `
            <a href="${waLink}" target="_blank" class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-md transition-colors flex items-center gap-2">
                <i class="fab fa-whatsapp"></i> Hubungi
            </a>
            ${(!isPaid && showAccBtn) ? `<button onclick="closeBookingDetailModal(); openConfirmModal('${b.bookingId}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-md transition-colors flex items-center gap-2"><i class="fas fa-check"></i> ACC</button>` : ''}
            <button onclick="closeBookingDetailModal(); openEditBookingModal('${b.bookingId}')" class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-md transition-colors flex items-center gap-2">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button onclick="closeBookingDetailModal(); openDeleteModal('${b.bookingId}')" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-md transition-colors flex items-center gap-2">
                <i class="fas fa-trash"></i> Hapus
            </button>
        `;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            inner.classList.remove('scale-95', 'opacity-0');
            inner.classList.add('scale-100', 'opacity-100');
        }, 10);
    }

    window.closeBookingDetailModal = function() {
        const modal = document.getElementById('bookingDetailModal');
        const inner = document.getElementById('bookingDetailModalInner');
        inner.classList.remove('scale-100', 'opacity-100');
        inner.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300);
    }


    let activeDeleteId = null;

    function openDeleteModal(id) {
        activeDeleteId = id;
        
        let displayName = id;
        try {
            const allB = getBookings();
            const b = allB.find(x => String(x.bookingId) === String(id) || String(x.id) === String(id));
            if (b) {
                const pName = b.name || b.NAMA || 'Tanpa Nama';
                const armada = b.armadaId !== 'UNKNOWN' ? getArmada(b.armadaId) : null;
                const aName = armada ? armada.name : (b.kendaraan || b['JENIS KENDARAAN'] || '-');
                displayName = pName.toUpperCase() + ' (' + aName.toUpperCase() + ')';
            }
        } catch(e) {}
        
        document.getElementById('deleteId').textContent = displayName;
        
        const modal = document.getElementById('deleteModal');
        const inner = document.getElementById('deleteModalInner');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            inner.classList.remove('scale-95', 'opacity-0');
            inner.classList.add('scale-100', 'opacity-100');
        }, 10);
    }

    function closeDeleteModal() {
        const modal = document.getElementById('deleteModal');
        const inner = document.getElementById('deleteModalInner');
        inner.classList.remove('scale-100', 'opacity-100');
        inner.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            activeDeleteId = null;
        }, 300);
    }

    async function executeDelete() {
        if (!activeDeleteId) return;
        const btn = document.getElementById('btnExecuteDelete');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROSES...'; btn.disabled = true;

        try {
            const res = await postToSheets('deleteBooking', { id_tiket: activeDeleteId });
            if (res.status === 'success') {
                showMessage('Pesanan ' + activeDeleteId + ' berhasil dihapus.');
                refreshData();
                closeDeleteModal();
            } else {
                showMessage('Gagal menghapus pesanan!', true);
            }
        } catch (e) {
            console.error(e);
            showMessage('Terjadi kesalahan jaringan.', true);
        }
        
        btn.innerText = 'HAPUS'; btn.disabled = false;
    }

    // ========================================
    // DAFTAR ARMADA
    // ========================================
    window.toggleArmada = function(index) {
        const rows = document.querySelectorAll('.armada-group-' + index);
        rows.forEach(row => row.classList.toggle('hidden'));
        
        const icon = document.getElementById('icon-armada-' + index);
        if (icon) {
            if (rows.length > 0 && rows[0].classList.contains('hidden')) {
                icon.style.transform = 'rotate(0deg)';
            } else {
                icon.style.transform = 'rotate(180deg)';
            }
        }
    };

    function renderArmada() {
        let armadas = getArmadas();
        
        // Filter by Search
        const searchInput = document.getElementById('searchArmadaInput');
        let isSearching = false;
        if (searchInput && searchInput.value.trim() !== '') {
            isSearching = true;
            const query = searchInput.value.toLowerCase().trim();
            armadas = armadas.filter(a => 
                a.name.toLowerCase().includes(query) || 
                a.destination.toLowerCase().includes(query) ||
                a.id.toLowerCase().includes(query)
            );
        }

        const tbody = document.getElementById('armadaTableBody');
        if (!tbody) return;

        if (!armadas.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-sm text-slate-400 font-bold py-8 italic uppercase tracking-widest">Belum ada data armada</td></tr>';
            return;
        }

        const groups = {};
        armadas.forEach(a => {
            const key = (a.name || 'UNKNOWN').toUpperCase();
            if (!groups[key]) groups[key] = [];
            groups[key].push(a);
        });

        const sortedKeys = Object.keys(groups).sort();
        let html = '';

        sortedKeys.forEach((key, index) => {
            // If searching, automatically expand the results
            const hiddenClass = isSearching ? '' : 'hidden';
            const iconRotate = isSearching ? 'rotate(180deg)' : 'rotate(0deg)';

            html += `
                <tr class="cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors border-b border-blue-200" onclick="toggleArmada('${index}')">
                    <td colspan="4" class="px-4 py-3">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <i class="fas fa-bus text-blue-600"></i>
                                <span class="font-black text-sm text-blue-900 uppercase">${key}</span>
                                <span class="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md ml-2">${groups[key].length} Rute</span>
                            </div>
                            <i class="fas fa-chevron-down text-blue-600 transition-transform duration-300" id="icon-armada-${index}" style="transform: ${iconRotate};"></i>
                        </div>
                    </td>
                </tr>
            `;
            groups[key].forEach(a => {
                html += `
                    <tr class="armada-group-${index} ${hiddenClass} hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                        <td class="pl-8"><span class="font-black text-[10px] text-slate-400">${a.id}</span></td>
                        <td><span class="font-bold text-sm text-slate-800 uppercase">${a.destination}</span></td>
                        <td class="text-right"><p class="font-black text-sm text-slate-800">${formatRupiah(a.price)}</p><p class="text-[11px] text-blue-500 font-bold mt-1"><i class="far fa-clock mr-1"></i>${a.time}</p></td>
                        <td class="text-center">
                            <div class="flex gap-1 justify-center">
                                <button onclick="toggleArmadaStatusAPI('${a.id}', ${!a.isActive})" class="${a.isActive ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-400 hover:bg-slate-500'} text-white w-7 h-7 flex items-center justify-center rounded-lg text-xs shadow-sm transition-all mx-auto" title="${a.isActive ? 'Nonaktifkan Armada' : 'Aktifkan Armada'}"><i class="fas ${a.isActive ? 'fa-check' : 'fa-times'}"></i></button>
                                <button onclick="openEditArmadaModal('${a.id}')" class="bg-amber-500 hover:bg-amber-600 text-white w-7 h-7 flex items-center justify-center rounded-lg text-xs shadow-sm transition-all mx-auto" title="Edit Armada"><i class="fas fa-edit"></i></button>
                                <button onclick="openDeleteArmadaModal('${a.id}')" class="bg-red-500 hover:bg-red-600 text-white w-7 h-7 flex items-center justify-center rounded-lg text-xs shadow-sm transition-all mx-auto" title="Hapus Armada"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        });

        tbody.innerHTML = html;
    }

    // ========================================
    // LAPORAN & EXPORT
    // ========================================
    
    let activeDeleteArmadaId = null;

    function openDeleteArmadaModal(id) {
        activeDeleteArmadaId = id;
        document.getElementById('deleteArmadaId').textContent = id;
        const modal = document.getElementById('deleteArmadaModal');
        const inner = document.getElementById('deleteArmadaModalInner');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            inner.classList.remove('scale-95', 'opacity-0');
            inner.classList.add('scale-100', 'opacity-100');
        }, 10);
    }

    // ========================================
    // HARGA KHUSUS
    // ========================================
    
    window.openHargaKhususModal = function() {
        const armadas = getArmadas();
        const names = [...new Set(armadas.map(a => a.name))].sort();
        
        const sel = document.getElementById('hkPilihArmada');
        sel.innerHTML = '<option value="">-- Pilih Armada --</option>';
        names.forEach(n => {
            sel.innerHTML += `<option value="${n}">${n}</option>`;
        });
        
        document.getElementById('hkRuteContainer').innerHTML = '<p class="text-xs text-slate-400 font-bold italic text-center py-2">Silakan pilih armada terlebih dahulu</p>';
        document.getElementById('hkTanggalAwal').value = '';
        document.getElementById('hkTanggalAkhir').value = '';
        document.getElementById('hkHargaBaru').value = '';
        
        renderHargaKhususTable();
        
        const modal = document.getElementById('hargaKhususModal');
        const inner = document.getElementById('hargaKhususModalInner');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            inner.classList.remove('scale-95', 'opacity-0');
            inner.classList.add('scale-100', 'opacity-100');
        }, 10);
    };

    window.closeHargaKhususModal = function() {
        const modal = document.getElementById('hargaKhususModal');
        const inner = document.getElementById('hargaKhususModalInner');
        inner.classList.remove('scale-100', 'opacity-100');
        inner.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
        }, 300);
    };

    window.hkOnArmadaChange = function() {
        const armadaName = document.getElementById('hkPilihArmada').value;
        const container = document.getElementById('hkRuteContainer');
        if (!armadaName) {
            container.innerHTML = '<p class="text-xs text-slate-400 font-bold italic text-center py-2">Silakan pilih armada terlebih dahulu</p>';
            return;
        }
        
        const armadas = getArmadas();
        const dests = [...new Set(armadas.filter(a => a.name === armadaName).map(a => a.destination))].sort();
        
        if (dests.length === 0) {
            container.innerHTML = '<p class="text-xs text-slate-400 font-bold italic text-center py-2">Tidak ada rute ditemukan</p>';
            return;
        }
        
        let html = `
            <div class="flex items-center mb-2 pb-2 border-b border-slate-100">
                <input type="checkbox" id="hkCheckAll" class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" onchange="hkToggleAllRute(this.checked)">
                <label for="hkCheckAll" class="ml-2 text-xs font-black text-slate-700 uppercase cursor-pointer">Pilih Semua Rute</label>
            </div>
            <div class="space-y-2 pl-1">
        `;
        dests.forEach((d, idx) => {
            html += `
                <div class="flex items-center">
                    <input type="checkbox" id="hkRute_${idx}" value="${d}" class="hk-rute-checkbox w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" onchange="hkCheckRuteState()">
                    <label for="hkRute_${idx}" class="ml-2 text-[10px] font-bold text-slate-600 uppercase cursor-pointer">${d}</label>
                </div>
            `;
        });
        html += `</div>`;
        container.innerHTML = html;
    };

    window.hkToggleAllRute = function(isChecked) {
        const checkboxes = document.querySelectorAll('.hk-rute-checkbox');
        checkboxes.forEach(cb => cb.checked = isChecked);
    };

    window.hkCheckRuteState = function() {
        const checkboxes = document.querySelectorAll('.hk-rute-checkbox');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        document.getElementById('hkCheckAll').checked = allChecked;
    };

    async function fetchAllHargaKhusus() {
        try {
            const res = await fetch('/api?action=getHargaKhusus', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
            });
            const data = await res.json();
            if (data.status === 'success') {
                return data.data;
            }
        } catch(e) {}
        return [];
    }

    window.toggleHkGroup = function(index) {
        const rows = document.querySelectorAll(`.hk-group-${index}`);
        const icon = document.getElementById(`icon-hk-${index}`);
        if(rows.length === 0) return;
        
        let isHidden = rows[0].classList.contains('hidden');
        rows.forEach(r => {
            if(isHidden) r.classList.remove('hidden');
            else r.classList.add('hidden');
        });
        if(isHidden) icon.style.transform = 'rotate(180deg)';
        else icon.style.transform = 'rotate(0deg)';
    };

    window.hkToggleGroupCheckbox = function(groupKey, isChecked) {
        const checkboxes = document.querySelectorAll(`.hk-del-cb[data-group="${groupKey}"]`);
        checkboxes.forEach(cb => cb.checked = isChecked);
    };

    window.hkCheckGroupState = function(groupKey) {
        const checkboxes = document.querySelectorAll(`.hk-del-cb[data-group="${groupKey}"]`);
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        const groupCb = document.getElementById(`hkGroupCb_${groupKey}`);
        if(groupCb) groupCb.checked = allChecked;
    };

    async function renderHargaKhususTable() {
        const container = document.getElementById('hkAturanAktifContainer');
        if(!container) return;
        container.innerHTML = '<p class="text-center py-4 text-xs italic text-slate-400">Loading...</p>';
        
        const hkList = await fetchAllHargaKhusus();
        
        if (hkList.length === 0) {
            container.innerHTML = '<p class="text-center py-4 text-xs italic text-slate-400">Belum ada harga khusus aktif</p>';
            return;
        }
        
        const armadas = getArmadas();
        
        // Group by Armada Name
        const groups = {};
        hkList.forEach(h => {
            const armadaInfo = armadas.find(a => String(a.id) === String(h.idArmada)) || { name: 'UNKNOWN', destination: 'UNKNOWN' };
            const key = armadaInfo.name;
            if(!groups[key]) groups[key] = [];
            groups[key].push({ ...h, armadaInfo });
        });
        
        let html = '';
        const sortedKeys = Object.keys(groups).sort();
        
        sortedKeys.forEach((key, index) => {
            const groupKey = key.replace(/\s+/g, '_');
            html += `
                <div class="border border-slate-200 rounded-xl overflow-hidden bg-white mb-3">
                    <!-- Header Group -->
                    <div class="bg-slate-50 px-4 py-3 flex items-center justify-between border-b border-slate-200">
                        <div class="flex items-center gap-3">
                            <input type="checkbox" id="hkGroupCb_${groupKey}" class="w-4 h-4 text-red-600 bg-white border-gray-300 rounded focus:ring-red-500" onchange="hkToggleGroupCheckbox('${groupKey}', this.checked)">
                            <div class="cursor-pointer flex items-center gap-2" onclick="toggleHkGroup('${index}')">
                                <i class="fas fa-bus text-blue-600"></i>
                                <span class="font-black text-[11px] text-blue-900 uppercase">${key}</span>
                                <span class="text-[9px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md">${groups[key].length} Aturan</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <button onclick="deleteHargaKhususMassal('${groupKey}')" class="text-[9px] font-black uppercase tracking-widest text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors flex items-center gap-1">
                                <i class="fas fa-trash"></i> Hapus Terpilih
                            </button>
                            <i class="fas fa-chevron-down text-blue-600 transition-transform duration-300 cursor-pointer" id="icon-hk-${index}" onclick="toggleHkGroup('${index}')"></i>
                        </div>
                    </div>
                    <!-- Body Group -->
                    <table class="w-full text-left border-collapse">
                        <tbody class="divide-y divide-slate-100">
            `;
            groups[key].forEach(h => {
                const isSatuHari = h.tanggalAwal === h.tanggalAkhir;
                const periodeStr = isSatuHari ? h.tanggalAwal : `${h.tanggalAwal} <br/>s/d<br/> ${h.tanggalAkhir}`;
                html += `
                            <tr class="hk-group-${index} hidden hover:bg-slate-50 transition-colors">
                                <td class="py-2 px-4 w-10 text-center">
                                    <input type="checkbox" value="${h.id}" data-group="${groupKey}" class="hk-del-cb w-3.5 h-3.5 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500" onchange="hkCheckGroupState('${groupKey}')">
                                </td>
                                <td class="py-2 px-2">
                                    <span class="block text-[9px] font-black text-slate-700 uppercase">${h.armadaInfo.destination}</span>
                                </td>
                                <td class="py-2 px-2 text-[9px] font-bold text-slate-500 leading-tight">${periodeStr}</td>
                                <td class="py-2 px-3 text-[10px] font-black text-emerald-600 text-right">${formatRupiah(parseInt(h.hargaBaru))}</td>
                            </tr>
                `;
            });
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    window.saveHargaKhusus = async function() {
        const armadaName = document.getElementById('hkPilihArmada').value;
        const tglAwal = document.getElementById('hkTanggalAwal').value;
        const tglAkhir = document.getElementById('hkTanggalAkhir').value;
        const hargaBaru = document.getElementById('hkHargaBaru').value.replace(/\D/g, '');
        
        if (!armadaName) return showMessage('Silakan pilih armada', true);
        if (!tglAwal || !tglAkhir || !hargaBaru) return showMessage('Lengkapi rentang tanggal & harga baru', true);
        if (new Date(tglAwal) > new Date(tglAkhir)) return showMessage('Tanggal awal tidak boleh lebih besar dari akhir', true);
        
        const checkboxes = document.querySelectorAll('.hk-rute-checkbox:checked');
        if (checkboxes.length === 0) return showMessage('Silakan pilih minimal satu rute/tujuan', true);
        
        const ruteTerpilih = Array.from(checkboxes).map(cb => cb.value);
        
        // Find one representative idArmada for each chosen route
        const armadas = getArmadas();
        const idArmadaList = [];
        ruteTerpilih.forEach(r => {
            const match = armadas.find(a => a.name === armadaName && a.destination === r);
            if (match) idArmadaList.push(match.id);
        });
        
        const btn = document.getElementById('btnSaveHargaKhusus');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;
        
        try {
            const res = await fetch('/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
                body: JSON.stringify({
                    action: 'addHargaKhususMassal',
                    payload: { idArmadaList, tanggalAwal: tglAwal, tanggalAkhir: tglAkhir, hargaBaru: parseInt(hargaBaru) }
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                showMessage('Harga khusus massal berhasil disimpan');
                document.getElementById('hkTanggalAwal').value = '';
                document.getElementById('hkTanggalAkhir').value = '';
                document.getElementById('hkHargaBaru').value = '';
                hkToggleAllRute(false);
                renderHargaKhususTable();
            } else {
                showMessage(data.message || 'Gagal menyimpan', true);
            }
        } catch (error) { showMessage('Terjadi kesalahan server', true); }
        
        btn.innerHTML = 'SIMPAN HARGA';
        btn.disabled = false;
    };

    window.deleteHargaKhusus = async function(id) {
        if(!confirm('Yakin ingin menghapus aturan harga khusus ini?')) return;
        try {
            const res = await fetch('/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
                body: JSON.stringify({ action: 'deleteHargaKhusus', payload: { id } })
            });
            const data = await res.json();
            if (data.status === 'success') {
                showMessage('Harga khusus dihapus');
                renderHargaKhususTable();
            } else {
                showMessage('Gagal menghapus', true);
            }
        } catch (error) {
            showMessage('Kesalahan server', true);
        }
    };

    window.deleteHargaKhususMassal = async function(groupKey) {
        const checkboxes = document.querySelectorAll(`.hk-del-cb[data-group="${groupKey}"]:checked`);
        if(checkboxes.length === 0) return showMessage('Silakan pilih minimal satu aturan untuk dihapus', true);
        
        if(!confirm(`Yakin ingin menghapus ${checkboxes.length} aturan terpilih?`)) return;
        
        const ids = Array.from(checkboxes).map(cb => cb.value);
        
        try {
            const res = await fetch('/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
                body: JSON.stringify({ action: 'deleteHargaKhususMassal', payload: { ids } })
            });
            const data = await res.json();
            if (data.status === 'success') {
                showMessage(`Berhasil menghapus ${checkboxes.length} harga khusus`);
                renderHargaKhususTable();
            } else {
                showMessage('Gagal menghapus', true);
            }
        } catch (error) {
            showMessage('Kesalahan server', true);
        }
    };

    function closeDeleteArmadaModal() {
        const modal = document.getElementById('deleteArmadaModal');
        const inner = document.getElementById('deleteArmadaModalInner');
        inner.classList.remove('scale-100', 'opacity-100');
        inner.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            activeDeleteArmadaId = null;
        }, 300);
    }

    async function executeDeleteArmada() {
        if (!activeDeleteArmadaId) return;
        const btn = document.getElementById('btnExecuteDeleteArmada');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROSES...'; btn.disabled = true;

        try {
            const res = await postToSheets('deleteArmada', { id_armada: activeDeleteArmadaId });
            if (res.status === 'success') {
                showMessage('Armada berhasil dihapus');
                refreshData();
                closeDeleteArmadaModal();
            } else {
                showMessage('Gagal menghapus armada', true);
            }
        } catch(e) {
            showMessage('Kesalahan jaringan', true);
        }
        
        btn.innerText = 'HAPUS'; btn.disabled = false;
    }

    async function toggleArmadaStatusAPI(id_armada, is_active) {
        try {
            const res = await postToSheets('toggleArmadaStatus', { id_armada, is_active });
            if (res.status === 'success') {
                showMessage(res.message || 'Status armada berhasil diubah');
                refreshData();
            } else {
                showMessage('Gagal mengubah status armada', true);
            }
        } catch(e) {
            showMessage('Kesalahan jaringan saat mengubah status', true);
        }
    }

    function renderLaporan() {
        populateCustomManifestFilters();
    }

    // ============================================
    // CUSTOM MANIFEST REPORT LOGIC
    // ============================================
    
    function toggleCustomManifestDate() {
        const type = document.getElementById('customManifestDateType').value;
        const dateInput = document.getElementById('customManifestDateVal');
        if (type === 'custom') {
            dateInput.classList.remove('hidden');
        } else {
            dateInput.classList.add('hidden');
        }
        populateCustomManifestFilters();
    }

    window.toggleCustomManifestDate = toggleCustomManifestDate;

    function populateCustomManifestFilters() {
        const dateType = document.getElementById('customManifestDateType').value;
        let selectedDate = '';
        
        if (dateType === 'today') {
            selectedDate = getTodayKey(); // YYYY-MM-DD
        } else {
            selectedDate = document.getElementById('customManifestDateVal').value;
        }

        const armadaContainer = document.getElementById('customManifestArmadaContainer');
        const timeContainer = document.getElementById('customManifestTimeContainer');

        if (!selectedDate) {
            armadaContainer.innerHTML = '<p class="text-[10px] text-slate-400 font-bold p-2 text-center uppercase tracking-widest">Pilih tanggal dahulu</p>';
            timeContainer.innerHTML = '<p class="text-[10px] text-slate-400 font-bold p-2 text-center uppercase tracking-widest">Pilih tanggal dahulu</p>';
            return;
        }

        // Get bookings for the selected date
        const allBookings = getBookings();
        const dateBookings = allBookings.filter(b => {
            const isConfirmed = b.status === "paid" || 
                                b.pembayaran === "LUNAS" || 
                                b.pembayaran === "ACC" || 
                                String(b.pembayaran).toUpperCase() === "ACC" ||
                                String(b.status).toUpperCase() === "ACC" ||
                                String(b.status).toUpperCase() === "LUNAS" ||
                                String(b.status).toUpperCase() === "PAID";
            
            let bDateKey = '';
            const bd = parseIndoDate(b.dateTravel);
            if(bd) bDateKey = toDateKey(bd);
            
            let selDateKey = '';
            const sd = parseIndoDate(selectedDate);
            if(sd) selDateKey = toDateKey(sd);

            return bDateKey === selDateKey && isConfirmed;
        });

        if (dateBookings.length === 0) {
            armadaContainer.innerHTML = '<p class="text-[10px] text-slate-400 font-bold p-2 text-center uppercase tracking-widest">Tidak ada data (Lunas/ACC) di tanggal ini</p>';
            timeContainer.innerHTML = '<p class="text-[10px] text-slate-400 font-bold p-2 text-center uppercase tracking-widest">Tidak ada data (Lunas/ACC) di tanggal ini</p>';
            return;
        }

        const armadas = new Set();
        const times = new Set();

        dateBookings.forEach(b => {
            const armadaName = b.armadaId !== 'UNKNOWN' && getArmada(b.armadaId) ? getArmada(b.armadaId).name : (b.kendaraan || b['JENIS KENDARAAN'] || 'UNKNOWN');
            const waktu = b.waktu || b['WAKTU'] || 'UNKNOWN';
            armadas.add(armadaName);
            times.add(waktu);
        });

        // Render Armada Checkboxes
        let armadaHtml = '';
        Array.from(armadas).sort().forEach(a => {
            armadaHtml += `
                <label class="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer transition-colors border border-transparent hover:border-slate-200">
                    <input type="checkbox" name="customManifestArmada" value="${a}" class="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" onchange="updateCustomManifestTimes()">
                    <span class="text-xs font-bold text-slate-700 uppercase">${a}</span>
                </label>
            `;
        });
        armadaContainer.innerHTML = armadaHtml;

        updateCustomManifestTimes();
    }

    window.populateCustomManifestFilters = populateCustomManifestFilters;

    function updateCustomManifestTimes() {
        const dateType = document.getElementById('customManifestDateType').value;
        let selectedDate = '';
        if (dateType === 'today') {
            selectedDate = getTodayKey();
        } else {
            selectedDate = document.getElementById('customManifestDateVal').value;
        }

        if (!selectedDate) return;

        const allBookings = getBookings();
        const dateBookings = allBookings.filter(b => {
            const isConfirmed = b.status === "paid" || 
                                b.pembayaran === "LUNAS" || 
                                b.pembayaran === "ACC" || 
                                String(b.pembayaran).toUpperCase() === "ACC" ||
                                String(b.status).toUpperCase() === "ACC" ||
                                String(b.status).toUpperCase() === "LUNAS" ||
                                String(b.status).toUpperCase() === "PAID";
            let bDateKey = '';
            const bd = parseIndoDate(b.dateTravel);
            if(bd) bDateKey = toDateKey(bd);
            
            let selDateKey = '';
            const sd = parseIndoDate(selectedDate);
            if(sd) selDateKey = toDateKey(sd);

            return bDateKey === selDateKey && isConfirmed;
        });

        const armadaCheckboxes = document.querySelectorAll('input[name="customManifestArmada"]:checked');
        const selectedArmadas = Array.from(armadaCheckboxes).map(cb => cb.value);

        const times = new Set();
        dateBookings.forEach(b => {
            const armadaName = b.armadaId !== 'UNKNOWN' && getArmada(b.armadaId) ? getArmada(b.armadaId).name : (b.kendaraan || b['JENIS KENDARAAN'] || 'UNKNOWN');
            const waktu = b.waktu || b['WAKTU'] || 'UNKNOWN';
            
            if (selectedArmadas.length === 0 || selectedArmadas.includes(armadaName)) {
                times.add(waktu);
            }
        });

        const timeContainer = document.getElementById('customManifestTimeContainer');
        if (times.size === 0) {
             timeContainer.innerHTML = '<p class="text-[10px] text-slate-400 font-bold p-2 text-center uppercase tracking-widest">Tidak ada jam</p>';
             return;
        }

        let timeHtml = '';
        Array.from(times).sort().forEach(t => {
            timeHtml += `
                <label class="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer transition-colors border border-transparent hover:border-slate-200">
                    <input type="checkbox" name="customManifestTime" value="${t}" class="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500">
                    <span class="text-xs font-bold text-slate-700 uppercase">${t}</span>
                </label>
            `;
        });
        timeContainer.innerHTML = timeHtml;
    }

    window.updateCustomManifestTimes = updateCustomManifestTimes;

    function downloadCustomManifest(format) {
        const dateType = document.getElementById('customManifestDateType').value;
        let selectedDate = '';
        let displayDate = '';
        
        if (dateType === 'today') {
            const today = new Date();
            selectedDate = getTodayKey();
            displayDate = INDO_DAYS[today.getDay()] + ', ' + today.getDate() + ' ' + INDO_MONTHS[today.getMonth()] + ' ' + today.getFullYear();
        } else {
            selectedDate = document.getElementById('customManifestDateVal').value;
            if(!selectedDate) {
                showMessage("Silakan pilih tanggal custom terlebih dahulu!");
                return;
            }
            const parts = selectedDate.split('-');
            if (parts.length === 3) {
                const d = new Date(parts[0], parseInt(parts[1]) - 1, parts[2]);
                displayDate = INDO_DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + INDO_MONTHS[d.getMonth()] + ' ' + d.getFullYear();
            } else {
                displayDate = selectedDate;
            }
        }

        // Get selected armadas
        const armadaCheckboxes = document.querySelectorAll('input[name="customManifestArmada"]:checked');
        const selectedArmadas = Array.from(armadaCheckboxes).map(cb => cb.value);

        // Get selected times
        const timeCheckboxes = document.querySelectorAll('input[name="customManifestTime"]:checked');
        const selectedTimes = Array.from(timeCheckboxes).map(cb => cb.value);

        if (selectedArmadas.length === 0 && selectedTimes.length === 0) {
            showMessage("Pilih setidaknya satu armada atau satu jam keberangkatan!");
            return;
        }

        const allBookings = getBookings();
        let filteredBookings = allBookings.filter(b => {
            const isConfirmed = b.status === "paid" || 
                                b.pembayaran === "LUNAS" || 
                                b.pembayaran === "ACC" || 
                                String(b.pembayaran).toUpperCase() === "ACC" ||
                                String(b.status).toUpperCase() === "ACC" ||
                                String(b.status).toUpperCase() === "LUNAS" ||
                                String(b.status).toUpperCase() === "PAID";
            
            let bDateKey = '';
            const bd = parseIndoDate(b.dateTravel);
            if(bd) bDateKey = toDateKey(bd);
            
            let selDateKey = '';
            const sd = parseIndoDate(selectedDate);
            if(sd) selDateKey = toDateKey(sd);

            return bDateKey === selDateKey && isConfirmed;
        });

        if (selectedArmadas.length > 0) {
            filteredBookings = filteredBookings.filter(b => {
                const armadaName = b.armadaId !== 'UNKNOWN' && getArmada(b.armadaId) ? getArmada(b.armadaId).name : (b.kendaraan || b['JENIS KENDARAAN'] || 'UNKNOWN');
                return selectedArmadas.includes(armadaName);
            });
        }

        if (selectedTimes.length > 0) {
            filteredBookings = filteredBookings.filter(b => {
                const waktu = b.waktu || b['WAKTU'] || 'UNKNOWN';
                return selectedTimes.includes(waktu);
            });
        }

        if (filteredBookings.length === 0) {
            showMessage("Tidak ada data penumpang yang cocok dengan filter yang dipilih.");
            return;
        }

        // Sort by Time, then Armada
        filteredBookings.sort((a, b) => {
            const timeA = a.waktu || a['WAKTU'] || '';
            const timeB = b.waktu || b['WAKTU'] || '';
            if (timeA !== timeB) return timeA.localeCompare(timeB);
            
            const armadaA = a.armadaId !== 'UNKNOWN' && getArmada(a.armadaId) ? getArmada(a.armadaId).name : (a.kendaraan || a['JENIS KENDARAAN'] || '');
            const armadaB = b.armadaId !== 'UNKNOWN' && getArmada(b.armadaId) ? getArmada(b.armadaId).name : (b.kendaraan || b['JENIS KENDARAAN'] || '');
            return armadaA.localeCompare(armadaB);
        });

            // Group bookings by time for both CSV and PDF
        const groupedBookings = {};
        filteredBookings.forEach(b => {
            const waktu = b.waktu || b['WAKTU'] || '-';
            if (!groupedBookings[waktu]) groupedBookings[waktu] = [];
            groupedBookings[waktu].push(b);
        });
        const sortedTimes = Object.keys(groupedBookings).sort();

        if (format === 'csv') {
            let csv = 'ID Tiket,Armada,Tujuan,Nama Penumpang,Jml,Kursi,Status,Ket\n';
            
            sortedTimes.forEach(time => {
                const groupData = groupedBookings[time];
                groupData.forEach(b => {
                    const armadaName = b.armadaId !== 'UNKNOWN' && getArmada(b.armadaId) ? getArmada(b.armadaId).name : (b.kendaraan || b['JENIS KENDARAAN'] || '-');
                    const tujuan = b.armadaId !== 'UNKNOWN' && getArmada(b.armadaId) ? getArmada(b.armadaId).destination : (b.tujuan || b['Tujuan'] || '-');
                    const id = b.bookingId || b.id || '-';
                    const nama = b.name || b['NAMA'] || '-';

                    const jml = b.qty || b['JUMLAH PNP'] || 1;
                    const kursi = b.kursi || '-';
                    const status = b.status || '-';
                    const ket = b.keterangan || b['Keterangan'] || b['KETERANGAN'] || '';
                    
                    csv += `"${id}","${armadaName}","${tujuan}","${nama}","${jml}","${kursi}","${status}","${ket}"\n`;
                });
                
                const groupTotalPnp = groupData.reduce((sum, b) => sum + (parseInt(b.qty || b['JUMLAH PNP']) || 1), 0);
                csv += `,,,"TOTAL PENUMPANG JAM ${time}","${groupTotalPnp}",,,\n\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('hidden', '');
            a.setAttribute('href', url);
            a.setAttribute('download', `Manifest_${selectedDate}.csv`);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return;
        }

        if (format === 'pdf') {
            if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
                showMessage("Library PDF belum termuat, mohon tunggu beberapa saat.");
                return;
            }

            const generateManifestPdf = async () => {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF('p', 'mm', 'a4'); // Portrait A4
                
                let titleX = 14;
                try {
                    const img = new Image();
                    img.src = '/logo.png';
                    await new Promise((resolve, reject) => {
                        img.onload = () => resolve(img);
                        img.onerror = reject;
                    });
                    doc.addImage(img, 'PNG', 14, 12, 18, 18);
                    titleX = 36;
                } catch(e) {
                    console.log("Logo error", e);
                }
                
                doc.setFontSize(22);
                doc.setFont("helvetica", "bold");
                doc.text("AGEN DAMRI KAWUNGANTEN", titleX, 22);
                
                doc.setFontSize(12);
                doc.setFont("helvetica", "normal");
                doc.text(`Data Penumpang (${displayDate})`, titleX, 30);
                
                let filterText = [];
                if(selectedArmadas.length > 0) filterText.push(`Armada: ${selectedArmadas.join(', ')}`);
                if(selectedTimes.length > 0) filterText.push(`Jam: ${selectedTimes.join(', ')}`);
                doc.setFontSize(10);
                doc.setFont("helvetica", "italic");
                doc.text(filterText.join(' | '), titleX, 36);

                doc.setLineWidth(0.5);
                doc.setDrawColor(200, 200, 200);
                doc.line(14, 40, 196, 40);
            
                let currentY = 45;

                sortedTimes.forEach((time, groupIndex) => {
                    const groupData = groupedBookings[time];
                    const tableData = groupData.map((b, i) => {
                        const armadaName = b.armadaId !== 'UNKNOWN' && getArmada(b.armadaId) ? getArmada(b.armadaId).name : (b.kendaraan || b['JENIS KENDARAAN'] || '-');
                        const tujuan = b.armadaId !== 'UNKNOWN' && getArmada(b.armadaId) ? getArmada(b.armadaId).destination : (b.tujuan || b['Tujuan'] || '-');
                        const nama = b.name || b['NAMA'] || '-';
                        const jml = b.qty || b['JUMLAH PNP'] || 1;
                        const kursi = b.kursi || '-';
                        const ket = b.keterangan || b['Keterangan'] || b['KETERANGAN'] || '';
                        
                        return [
                            i + 1,
                            armadaName,
                            tujuan,
                            nama,
                            jml,
                            kursi,
                            ket
                        ];
                    });

                    doc.autoTable({
                        startY: currentY,
                        head: [['No', 'Armada', 'Tujuan', 'Nama Penumpang', 'Jml', 'Kursi', 'Ket']],
                        body: tableData,
                        theme: 'grid',
                        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
                        styles: { fontSize: 9, cellPadding: 3 },
                        columnStyles: {
                            0: { cellWidth: 10, halign: 'center' },
                            1: { cellWidth: 35 },
                            2: { cellWidth: 35 },
                            3: { cellWidth: 45 },
                            4: { cellWidth: 10, halign: 'center' },
                            5: { cellWidth: 15, halign: 'center' },
                            6: { cellWidth: 'auto' }
                        },
                        margin: { bottom: 20 }
                    });
                    
                    const groupTotalPnp = groupData.reduce((sum, b) => sum + (parseInt(b.qty || b['JUMLAH PNP']) || 1), 0);
                    doc.setFontSize(11);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(0, 0, 0);
                    currentY = doc.lastAutoTable.finalY + 8;
                    doc.text(`Total Penumpang Jam ${time}: ${groupTotalPnp} Orang`, 14, currentY);
                    
                    currentY += 12; // Extra spacing for the next table
                });

                doc.save(`Manifest_${selectedDate}.pdf`);
            };
            generateManifestPdf();
        }
    }

    window.downloadCustomManifest = downloadCustomManifest;

    function downloadReport(type, format) {
        let allLaporan = getLaporan() || [];
        const ekstra = getEkstraBookings() || [];
        
        const formatTanggal = (dStr) => {
            const d = new Date(dStr);
            if(isNaN(d)) return dStr;
            return INDO_DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + INDO_MONTHS[d.getMonth()] + ' ' + d.getFullYear();
        };
        
        const ekstraFormatted = ekstra.map(e => ({
            tanggal: formatTanggal(e.tanggalBerangkat),
            jenisKendaraan: (e.vendor || e.tipe || 'Ekstra') + (e.rute ? ' ' + e.rute : ''),
            jumlahPnp: (e.hargaTiket && e.totalHarga) ? Math.round(e.totalHarga / e.hargaTiket) : 1,
            totalHarga: Number(e.totalHarga) || 0,
            totalKomisi: Number(e.komisi) || 0
        }));
        
        allLaporan = [...allLaporan, ...ekstraFormatted];

        const today = new Date();
        let filteredData = [];
        let title = '';
        
        if (type === 'bulanan') {
            let targetMonth = today.getMonth();
            let targetYear = today.getFullYear();
            const bulanInput = document.getElementById('laporanBulanInput');
            if (bulanInput && bulanInput.value) {
                const parts = bulanInput.value.split('-');
                if (parts.length === 2) {
                    targetYear = parseInt(parts[0]);
                    targetMonth = parseInt(parts[1]) - 1;
                }
            }
            
            filteredData = allLaporan.filter(l => {
                const d = parseIndoDate(l.tanggal);
                return d && d.getMonth() === targetMonth && d.getFullYear() === targetYear;
            });
            title = 'Laporan Penghasilan Bulanan (' + INDO_MONTHS[targetMonth] + ' ' + targetYear + ')';
        } else if (type === 'tahunan') {
            filteredData = allLaporan.filter(l => {
                const d = parseIndoDate(l.tanggal);
                return d && d.getFullYear() === today.getFullYear();
            });
            title = 'Laporan Penghasilan Tahunan (' + today.getFullYear() + ')';
        } else if (type === 'pajak') {
            filteredData = allLaporan.filter(l => {
                const d = parseIndoDate(l.tanggal);
                return d && d.getFullYear() === today.getFullYear();
            });
            title = 'Laporan Pajak Tahunan (' + today.getFullYear() + ')';
        }

        // Group by Date
        const groupedData = {};
        filteredData.forEach(l => {
            if (!groupedData[l.tanggal]) {
                groupedData[l.tanggal] = {
                    tanggal: l.tanggal,
                    totalHarga: 0,
                    totalKomisi: 0,
                    details: {}
                };
            }
            groupedData[l.tanggal].totalHarga += (Number(l.totalHarga) || 0);
            groupedData[l.tanggal].totalKomisi += (Number(l.totalKomisi) || 0);

            const vkName = (l.jenisKendaraan || 'Lainnya').trim();
            if(!groupedData[l.tanggal].details[vkName]) {
                groupedData[l.tanggal].details[vkName] = { pnp: 0, omset: 0, komisi: 0 };
            }
            groupedData[l.tanggal].details[vkName].pnp += (Number(l.jumlahPnp) || 1);
            groupedData[l.tanggal].details[vkName].omset += (Number(l.totalHarga) || 0);
            groupedData[l.tanggal].details[vkName].komisi += (Number(l.totalKomisi) || 0);
        });
        filteredData = Object.values(groupedData);

        // Sort from oldest to newest
        filteredData.sort((a, b) => {
            const dateA = parseIndoDate(a.tanggal);
            const dateB = parseIndoDate(b.tanggal);
            return (dateA ? dateA.getTime() : 0) - (dateB ? dateB.getTime() : 0);
        });
        
        if (format === 'csv') {
            let csv = 'Tanggal / Rincian,Total Omset,Komisi (Pendapatan Kotor)\n';
            filteredData.forEach(l => {
                csv += `"${l.tanggal}",${l.totalHarga},${l.totalKomisi}\n`;
                for(const vk in l.details) {
                    const detail = l.details[vk];
                    csv += `"   - ${vk} (${detail.pnp})",${detail.omset},${detail.komisi}\n`;
                }
            });
            let totalOmset = filteredData.reduce((s,l) => s + l.totalHarga, 0);
            let totalPendapatan = filteredData.reduce((s,l) => s + l.totalKomisi, 0);
            csv += `TOTAL,${totalOmset},${totalPendapatan}\n`;

            if (type === 'pajak') {
                let pajak = totalOmset * 0.005; // 0.5% UMKM Final Tax
                csv += `ESTIMASI PAJAK (0.5%),,${pajak}\n`;
            }
            
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('hidden', '');
            a.setAttribute('href', url);
            a.setAttribute('download', title + '.csv');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return;
        }

        if (format === 'pdf') {
            if (typeof window.jspdf === 'undefined') {
                showMessage("Library PDF belum termuat, mohon tunggu beberapa saat.");
                return;
            }

            const generateReportPdf = async () => {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                
                let titleX = 14;
                try {
                    const img = new Image();
                    img.src = '/logo.png';
                    await new Promise((resolve, reject) => {
                        img.onload = () => resolve(img);
                        img.onerror = reject;
                    });
                    // Posisi pojok kanan (A4 width 210 - 14 margin - 22 width = 174)
                    doc.addImage(img, 'PNG', 174, 15, 22, 22);
                } catch(e) {
                    console.log("Logo error", e);
                }
                
                doc.setFontSize(22);
                doc.setFont("helvetica", "bold");
                doc.text("AGEN DAMRI KAWUNGANTEN", titleX, 22);
                
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.text("Pemilik: ISNU FADKHUL ROIS", titleX, 30);
                doc.text("NIK: 3301092802990006", titleX, 35);
                doc.text("No HP: 0821-3360-7759", titleX, 40);
                
                doc.setLineWidth(0.5);
                doc.setDrawColor(200, 200, 200);
                doc.line(14, 45, 196, 45);

                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.text(title, 14, 55);
            
            let totalOmset = filteredData.reduce((s,l) => s + l.totalHarga, 0);
            let totalPendapatan = filteredData.reduce((s,l) => s + l.totalKomisi, 0);
            
            let tableData = [];
            filteredData.forEach(l => {
                tableData.push([
                    l.tanggal, 
                    formatRupiah(l.totalHarga), 
                    formatRupiah(l.totalKomisi)
                ]);
                for(const vk in l.details) {
                    const detail = l.details[vk];
                    tableData.push([
                        `   - ${vk} (${detail.pnp})`, 
                        formatRupiah(detail.omset), 
                        formatRupiah(detail.komisi)
                    ]);
                }
            });
            
            tableData.push([
                "TOTAL", 
                formatRupiah(totalOmset), 
                formatRupiah(totalPendapatan)
            ]);

            if (type === 'pajak') {
                let pajak = totalOmset * 0.005;
                tableData.push(["ESTIMASI PAJAK (0.5% OMSET)", "", formatRupiah(pajak)]);
            }

            doc.autoTable({
                startY: 60,
                head: [['Tanggal / Rincian', 'Total Omset', 'Komisi (Pendapatan Kotor)']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [37, 99, 235] },
                styles: { fontSize: 9 },
                columnStyles: {
                    1: { halign: 'right' },
                    2: { halign: 'right' }
                },
                didParseCell: function (data) {
                    if (data.row.index >= tableData.length - (type==='pajak'?2:1)) {
                        data.cell.styles.fontStyle = 'bold';
                        if(data.column.index === 0) data.cell.styles.textColor = [220, 38, 38];
                    } else if (data.column.index === 0) {
                        const cellText = data.cell.text[0];
                        if (cellText && cellText.startsWith('   - ')) {
                            data.cell.styles.fontStyle = 'normal';
                            data.cell.styles.textColor = [80, 80, 80];
                        } else {
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                }
            });

            let finalY = doc.lastAutoTable.finalY || 60;
            finalY += 20;
            
            // Check if it fits on the page, if not add new page
            if (finalY > 260) {
                doc.addPage();
                finalY = 30;
            }

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text("Kawunganten, .............................", 140, finalY);
            doc.text("Pemilik Usaha", 140, finalY + 6);
            
            doc.setFont("helvetica", "bold");
            doc.text("ISNU FADKHUL ROIS", 140, finalY + 30);

            doc.save(title + '.pdf');
            };
            generateReportPdf();
        }
    }

    // ========================================
    // ACC MODAL
    // ========================================
    let activeAccId = null;

    function openConfirmModal(id) {
        activeAccId = id;
        document.getElementById('confirmId').innerText = id;
        const modal = document.getElementById('confirmModal');
        const inner = document.getElementById('confirmModalInner');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            inner.classList.remove('scale-95', 'opacity-0');
            inner.classList.add('scale-100', 'opacity-100');
        }, 10);
    }

    function closeConfirmModal() {
        const modal = document.getElementById('confirmModal');
        const inner = document.getElementById('confirmModalInner');
        inner.classList.remove('scale-100', 'opacity-100');
        inner.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            activeAccId = null;
        }, 300);
    }

    // ========================================
    // E-TICKET MODAL
    // ========================================
    function openETicket(id) {
        const b = getBooking(id);
        if (!b) return;
        
        const armada = b.armadaId !== 'UNKNOWN' ? getArmada(b.armadaId) : null;
        const armadaName = armada ? armada.name : '-';
        let tujuan = armada ? armada.destination : '-';
        
        let asalText = 'Kawunganten';
        let rawTujuan = b.tujuan || b['Tujuan'] || tujuan;
        if (rawTujuan && String(rawTujuan).startsWith('[PULANG] ')) {
            asalText = rawTujuan.replace('[PULANG] ', '');
            tujuan = 'KAWUNGANTEN';
        }

        const isPaid = (b.status === 'paid' || b.status === 'Lunas' || b.status === 'ACC' || b.status === 'LUNAS');
        const statusPay = isPaid ? 'LUNAS' : 'BELUM LUNAS';
        
        let formattedDate = b.dateTravel || '-';
        const dObj = parseIndoDate(formattedDate);
        
        const qty = parseInt(b.qty) || 1;
        const harga = getEffectiveHarga(armada, dObj);
        
        const totalHargaData = (b.totalHarga !== undefined && b.totalHarga !== null) ? parseInt(String(b.totalHarga).replace(/[^0-9]/g, '')) : (b.total !== undefined && b.total !== null ? parseInt(String(b.total).replace(/[^0-9]/g, '')) : (harga * qty));
        const expectedTotal = harga * qty;
        
        let rawKet = String(b.keterangan || b.ket || '-');
        const mKet = rawKet.match(/Biaya Tambahan: (.*?) \((Rp[ \d.,]+)\)/);
        let ketTambahan = '';
        let nominalBiayaTambahan = 0;
        if (mKet) {
            ketTambahan = mKet[1].trim();
            nominalBiayaTambahan = parseInt(mKet[2].replace(/[^\d]/g, '')) || 0;
            rawKet = rawKet.replace(/,?\s*Biaya Tambahan:.*?$/, '').trim();
            if (!rawKet) rawKet = '-';
        }
        const hasBiayaTambahan = nominalBiayaTambahan > 0;
        
        const total = Math.max(totalHargaData || 0, expectedTotal + nominalBiayaTambahan);

        if (dObj) formattedDate = INDO_DAYS[dObj.getDay()] + ', ' + dObj.getDate() + ' ' + INDO_MONTHS[dObj.getMonth()] + ' ' + dObj.getFullYear();

        const now = new Date();
        const tglBeliObj = new Date(b.createdAt || new Date());
        const tglBeli = String(tglBeliObj.getDate()).padStart(2, '0') + '/' + String(tglBeliObj.getMonth() + 1).padStart(2, '0') + '/' + tglBeliObj.getFullYear() + ' ' + String(tglBeliObj.getHours()).padStart(2, '0') + ':' + String(tglBeliObj.getMinutes()).padStart(2, '0');

        if(document.getElementById('ticketDate')) document.getElementById('ticketDate').innerText = formattedDate;
        if(document.getElementById('ticketTime')) document.getElementById('ticketTime').innerText = b.waktu || '-';
        if(document.getElementById('ticketArmada')) document.getElementById('ticketArmada').innerText = armadaName;
        if(document.getElementById('ticketAsal')) document.getElementById('ticketAsal').innerText = asalText;
        if(document.getElementById('ticketTujuan')) document.getElementById('ticketTujuan').innerText = tujuan;
        if(document.getElementById('ticketKursi')) document.getElementById('ticketKursi').innerText = b.kursi || '-';
        if(document.getElementById('ticketKeterangan')) document.getElementById('ticketKeterangan').innerText = rawKet;
        if(document.getElementById('ticketQty')) document.getElementById('ticketQty').innerText = qty;
        
        if(document.getElementById('ticketId')) document.getElementById('ticketId').innerText = b.bookingId;
        if(document.getElementById('ticketName')) document.getElementById('ticketName').innerText = b.name;
        if(document.getElementById('ticketTglBeli')) document.getElementById('ticketTglBeli').innerText = "TGL BELI: " + tglBeli;
        if(document.getElementById('ticketHargaSatuan')) document.getElementById('ticketHargaSatuan').innerText = formatRupiah(harga);
        
        if (hasBiayaTambahan) {
            if(document.getElementById('ticketBiayaTambahanContainer')) {
                document.getElementById('ticketBiayaTambahanContainer').classList.remove('hidden');
                document.getElementById('ticketBiayaTambahan').innerText = formatRupiah(nominalBiayaTambahan);
                document.getElementById('ticketBiayaTambahanKet').innerText = ketTambahan ? `(${ketTambahan})` : '';
            }
            if(document.getElementById('r_biaya_tambahan_container')) {
                document.getElementById('r_biaya_tambahan_container').style.display = 'flex';
                document.getElementById('r_biaya_tambahan').innerText = formatRupiah(nominalBiayaTambahan);
                document.getElementById('r_biaya_tambahan_ket').innerText = ketTambahan || '-';
            }
        } else {
            if(document.getElementById('ticketBiayaTambahanContainer')) {
                document.getElementById('ticketBiayaTambahanContainer').classList.add('hidden');
            }
            if(document.getElementById('r_biaya_tambahan_container')) {
                document.getElementById('r_biaya_tambahan_container').style.display = 'none';
            }
        }

        if(document.getElementById('ticketTotal')) document.getElementById('ticketTotal').innerText = formatRupiah(total);
        
        if(document.getElementById('ticketArmadaArsip')) document.getElementById('ticketArmadaArsip').innerText = armadaName;
        if(document.getElementById('ticketNameArsip')) document.getElementById('ticketNameArsip').innerText = b.name;
        if(document.getElementById('ticketQtyArsip')) document.getElementById('ticketQtyArsip').innerText = qty;
        if(document.getElementById('ticketTujuanArsip')) document.getElementById('ticketTujuanArsip').innerText = tujuan;
        if(document.getElementById('ticketDateArsip')) document.getElementById('ticketDateArsip').innerText = formattedDate;

        currentTicketDataForBT = {
            idTiket: b.bookingId,
            tglBeli: tglBeli,
            nama: b.name,
            tujuan: tujuan,
            tglBerangkat: formattedDate,
            jam: b.waktu || '-',
            jumlahPnp: qty + ' Orang',
            kursi: b.kursi || '-',
            armada: armadaName,
            totalHarga: formatRupiah(total),
            hargaSatuan: formatRupiah(harga),
            biayaTambahan: hasBiayaTambahan ? nominalBiayaTambahan : 0,
            biayaTambahanKet: ketTambahan,
            status: statusPay,
            keterangan: rawKet
        };

        const ruteFullText = asalText + ' ➔ ' + tujuan;

        // Populate Thermal Receipt
        if(document.getElementById('r_tgl_beli')) document.getElementById('r_tgl_beli').innerText = 'TGL BELI: ' + tglBeli;
        document.getElementById('r_id').innerText = b.bookingId;
        document.getElementById('r_tgl').innerText = formattedDate;
        document.getElementById('r_jam').innerText = b.waktu || '-';
        document.getElementById('r_nama').innerText = b.name;
        document.getElementById('r_pnp').innerText = qty + ' Orang';
        document.getElementById('r_kursi').innerText = b.kursi || '-';
        if(document.getElementById('r_keterangan')) document.getElementById('r_keterangan').innerText = rawKet;
        document.getElementById('r_bus').innerText = armadaName;
        document.getElementById('r_rute').innerText = ruteFullText;

        const ruteShortText = (b.tujuan && String(b.tujuan).startsWith('[PULANG] ')) 
            ? String(asalText).substring(0,3).toUpperCase() + ' - KWT' 
            : 'KWT - ' + String(tujuan).substring(0,3).toUpperCase();

        document.getElementById('r_harga').innerText = formatRupiah(harga);
        document.getElementById('r_total').innerText = formatRupiah(total);
        if(document.getElementById('r_rute_short')) document.getElementById('r_rute_short').innerText = ruteShortText;
        
        document.getElementById('r_bus_arsip').innerText = armadaName;
        document.getElementById('r_pnp_arsip_num').innerText = qty + ' Org';
        document.getElementById('r_rute_arsip').innerText = ruteFullText;
        document.getElementById('r_nama_arsip').innerText = b.name;
        document.getElementById('r_tgl_arsip').innerText = formattedDate;

        // Prepare WA Link
        const hp = b.hp || '';
        const waNum = String(hp).replace(/[^0-9]/g, '').replace(/^0/, '62');
        const textWa = `*AGEN DAMRI KAWUNGANTEN*\n\nHalo ${b.name}, ini adalah rincian E-Ticketing Anda:\n\n*ID Tiket:* ${b.bookingId}\n*Armada:* ${armadaName}\n*Rute:* ${ruteFullText}\n*Tanggal:* ${formattedDate}\n*Jam:* ${b.waktu || '-'}\n*Jml Penumpang:* ${qty} Orang\n*Total Harga:* ${formatRupiah(total)}\n*Status:* ${statusPay}\n\nTerima kasih telah menggunakan jasa kami!\nWebsite: agendamrikawunganten.net`;
        currentTicketWaText = `https://wa.me/${waNum}?text=${encodeURIComponent(textWa)}`;

        openEticketModal();
    }

    function closeETicket() {
        const modal = document.getElementById('ticketModal');
        const inner = document.getElementById('ticketModalInner');
        inner.classList.remove('scale-100', 'opacity-100');
        inner.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300);
    }

    function printETicket() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            printRawBT();
        } else {
            window.print();
        }
    }

    function kirimWaTicket() {
        if(typeof currentTicketWaText !== 'undefined' && currentTicketWaText) {
            window.open(currentTicketWaText, '_blank');
        } else {
            alert('Link WhatsApp belum tersedia.');
        }
    }

    async function executeAcc() {
        if (!activeAccId) return;
        const id = activeAccId;
        closeConfirmModal();
        document.getElementById('loadingOverlay').classList.remove('hidden');

        try {
            const payload = { id_tiket: id, status: "LUNAS", pembayaran: "LUNAS" };
            const res = await postToSheets('updateStatus', payload);

            if (res && res.status === "success") {
                const bIndex = cachedBookings.findIndex(b => b.bookingId === id);
                if (bIndex !== -1) {
                    cachedBookings[bIndex].status = 'paid';
                    cachedBookings[bIndex].pembayaran = 'LUNAS';
                    localStorage.setItem("app_bookings", JSON.stringify(cachedBookings));
                }
                showMessage("Berhasil! Data di database sudah di-ACC.");
                
                // Tutup modal notifikasi jika terbuka
                if (typeof closeNotifModal === 'function') closeNotifModal();
                // Tutup modal detail booking jika terbuka
                if (typeof closeBookingDetailModal === 'function') closeBookingDetailModal();
                
                // Lempar ke menu manifest (today)
                if (typeof switchMenu === 'function') switchMenu('today');
            } else {
                showMessage("Gagal ACC: " + (res.message || "Unknown error"));
            }
        } catch (e) {
            console.error(e);
            showMessage("Gagal terhubung ke database!");
        }

        document.getElementById('loadingOverlay').classList.add('hidden');
        renderAll();
    }

    // ========================================
    // REFRESH & MESSAGES
    // ========================================
    async function refreshData() {
        await loadAllData();
        showMessage("Data berhasil disinkronisasi!");
    }

    function showMessage(msg, isError = false) {
        const alertBox = document.getElementById('customAlert');
        document.getElementById('alertText').innerText = msg;
        alertBox.style.backgroundColor = isError ? '#ef4444' : '#10b981';
        alertBox.style.display = 'flex';
        setTimeout(() => alertBox.style.display = 'none', 3000);
    }

    // ========================================
    // AP3 DAMRI LOGIC
    // ========================================
    let ap3RowCount = 0;

    function openAp3Modal() {
        const modal = document.getElementById('ap3Modal');
        const inner = document.getElementById('ap3ModalInner');
        
        document.getElementById('ap3BusCode').value = '';
        document.getElementById('ap3Crew').value = '';
        document.getElementById('ap3Tbody').innerHTML = '';
        ap3RowCount = 0;
        
        addAp3Row();

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            inner.classList.remove('scale-95', 'opacity-0');
            inner.classList.add('scale-100', 'opacity-100');
        }, 10);
    }

    function closeAp3Modal() {
        const modal = document.getElementById('ap3Modal');
        const inner = document.getElementById('ap3ModalInner');
        inner.classList.remove('scale-100', 'opacity-100');
        inner.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300);
    }

    function addAp3Row() {
        ap3RowCount++;
        const tbody = document.getElementById('ap3Tbody');
        const tr = document.createElement('tr');
        tr.id = 'ap3row-' + ap3RowCount;
        tr.innerHTML = `
            <td class="p-2 font-black text-xs text-slate-500 border-b border-slate-100">${ap3RowCount}</td>
            <td class="p-2 border-b border-slate-100"><input type="text" class="ap3-dari min-w-[100px] w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500 font-bold text-slate-800" placeholder="Dari"></td>
            <td class="p-2 border-b border-slate-100"><input type="text" class="ap3-ke min-w-[100px] w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500 font-bold text-slate-800" placeholder="Ke"></td>
            <td class="p-2 border-b border-slate-100"><input type="number" class="ap3-pnp min-w-[60px] w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500 font-bold text-slate-800" placeholder="PNP" min="1"></td>
            <td class="p-2 border-b border-slate-100"><input type="number" class="ap3-tarif min-w-[100px] w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500 font-bold text-slate-800" placeholder="Tarif" min="0"></td>
            <td class="p-2 border-b border-slate-100 text-center"><button onclick="document.getElementById('ap3row-${ap3RowCount}').remove()" class="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"><i class="fas fa-times"></i></button></td>
        `;
        tbody.appendChild(tr);
    }

    function generateAp3Pdf() {
        if (typeof window.jspdf === 'undefined') {
            showMessage("Library PDF belum termuat, mohon tunggu beberapa saat.");
            return;
        }

        const busCode = document.getElementById('ap3BusCode').value || '';
        const crewName = document.getElementById('ap3Crew').value || '';
        
        const rows = [];
        let totalPnp = 0;
        let totalJumlah = 0;
        
        document.querySelectorAll('#ap3Tbody tr').forEach(tr => {
            const dari = tr.querySelector('.ap3-dari').value || '';
            const ke = tr.querySelector('.ap3-ke').value || '';
            const pnp = parseInt(tr.querySelector('.ap3-pnp').value) || 0;
            const tarif = parseInt(tr.querySelector('.ap3-tarif').value) || 0;
            
            if(dari || ke || pnp || tarif) {
                const jumlah = pnp * tarif;
                totalPnp += pnp;
                totalJumlah += jumlah;
                rows.push({ dari, ke, pnp, tarif, jumlah });
            }
        });

        // 9.8% Komisi
        const komisi = Math.round(totalJumlah * 0.098);
        const pendapatanBersih = totalJumlah - komisi;
        const noRef = String(Math.floor(100000 + Math.random() * 900000));
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', [200, 150]);

        doc.setFont("times", "bold");
        doc.setFontSize(9);
        doc.text('PERUSAHAAN UMUM "DAMRI"', 27.5, 10, { align: 'center' });
        doc.text('( PERUM DAMRI )', 27.5, 14, { align: 'center' });
        doc.text('KANTOR CABANG PURWOKERTO', 27.5, 18, { align: 'center' });
        doc.setFontSize(7);
        doc.setFont("times", "normal");
        doc.text('Jl. Pasar Sri Rahayu No. 1 Purwokerto', 27.5, 22, { align: 'center' });
        doc.text('Telp./Fax. (0281) 636064', 27.5, 25, { align: 'center' });
        
        doc.setLineWidth(0.5);
        doc.line(5, 27, 50, 27);
        doc.setLineWidth(0.2);
        doc.line(5, 28, 50, 28);

        // Center Title
        doc.setFont("times", "bold");
        doc.setFontSize(11);
        doc.text('LAPORAN PENYERAHAN PENUMPANG', 125, 12, { align: 'center' });
        doc.setLineWidth(0.3);
        doc.line(90, 13, 160, 13);

        // (AP/3)
        doc.setFontSize(14);
        doc.text('(AP/3)', 195, 12, { align: 'right' });
        
        // No
        doc.setFontSize(14);
        doc.setFont("times", "bold");
        doc.text('No. :', 155, 20);
        doc.setTextColor(220, 38, 38);
        doc.text(noRef, 170, 20);
        doc.setTextColor(0, 0, 0);

        // Agen & Bus Code
        doc.setFontSize(9);
        doc.setFont("times", "normal");
        doc.text('Agen/Sub Agen : KAWUNGANTEN', 75, 18);
        doc.text('Bus Code         : ' + busCode, 75, 23);
        
        const head = [
            [
                { content: 'No.', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'TUJUAN', colSpan: 2, styles: { halign: 'center' } },
                { content: 'PNP.', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'TARIF', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'PENDAPATAN (Rp.)', colSpan: 3, styles: { halign: 'center' } },
                { content: 'KET.', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
            ],
            [
                { content: 'DARI', styles: { halign: 'center' } },
                { content: 'KE', styles: { halign: 'center' } },
                { content: 'PNP.', styles: { halign: 'center' } },
                { content: 'BAGASI', styles: { halign: 'center' } },
                { content: 'JUMLAH', styles: { halign: 'center' } }
            ]
        ];

        const tableBody = [];
        for (let i = 0; i < 10; i++) {
            if (i < rows.length) {
                const r = rows[i];
                tableBody.push([
                    (i+1).toString(),
                    r.dari,
                    r.ke,
                    r.pnp.toString(),
                    r.tarif.toLocaleString('id-ID'),
                    '', 
                    '', 
                    r.jumlah.toLocaleString('id-ID'),
                    ''  
                ]);
            } else {
                tableBody.push(['', '', '', '', '', '', '', '', '']); 
            }
        }
        
        tableBody.push([
            { content: 'JUMLAH :', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold' } },
            totalPnp > 0 ? totalPnp.toString() : '', 
            '',
            '',
            '',
            totalJumlah > 0 ? totalJumlah.toLocaleString('id-ID') : '', 
            ''
        ]);

        doc.autoTable({
            startY: 29,
            head: head,
            body: tableBody,
            theme: 'grid',
            styles: { 
                font: 'times', 
                fontSize: 8, 
                lineWidth: 0.2, 
                lineColor: [0, 0, 0],
                textColor: [0, 0, 0]
            },
            headStyles: { 
                fillColor: [255, 255, 255], 
                textColor: [0, 0, 0],
                fontStyle: 'normal'
            },
            margin: { left: 5, right: 5 },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center' }, 
                1: { cellWidth: 28, halign: 'center' }, 
                2: { cellWidth: 28, halign: 'center' }, 
                3: { cellWidth: 10, halign: 'center' }, 
                4: { cellWidth: 25, halign: 'center' }, 
                5: { cellWidth: 22, halign: 'center' }, 
                6: { cellWidth: 22, halign: 'center' }, 
                7: { cellWidth: 25, halign: 'center' }, 
                8: { cellWidth: 22, halign: 'center' } 
            },
            tableWidth: 190 
        });

        const finalY = doc.lastAutoTable.finalY + 4;
        
        doc.setFontSize(9);
        
        // Baris 1
        doc.text('yang menerima,', 25, finalY + 2, { align: 'center' });
        doc.text('Pendapatan Angkutan', 75, finalY + 2);
        doc.text(': Rp.', 110, finalY + 2);
        doc.text(totalJumlah.toLocaleString('id-ID'), 120, finalY + 2);
        
        const today = new Date();
        const dStr = INDO_DAYS[today.getDay()] + ' - ' + today.getDate() + ' ' + INDO_MONTHS[today.getMonth()] + ' - ' + today.getFullYear();
        doc.text('Kawunganten, ' + dStr, 175, finalY + 2, { align: 'center' });

        // Baris 2
        doc.text('( Crew )', 25, finalY + 6, { align: 'center' });
        doc.text('Komisi 9,8 %', 75, finalY + 7);
        doc.text(': Rp.', 110, finalY + 7);
        doc.text(komisi.toLocaleString('id-ID'), 120, finalY + 7);
        
        // Underline Komisi
        doc.setLineWidth(0.2);
        doc.line(110, finalY + 8.5, 140, finalY + 8.5);

        // Baris 3
        doc.text('Agen', 175, finalY + 7, { align: 'center' });
        doc.text('Pendapatan Bersih', 75, finalY + 12);
        doc.text(': Rp.', 110, finalY + 12);
        doc.text(pendapatanBersih.toLocaleString('id-ID'), 120, finalY + 12);
        doc.text('(Cap)', 175, finalY + 11, { align: 'center' });

        // Baris 4 (Signatures & Jumlah)
        doc.text('Jumlah disetorkan', 75, finalY + 20);
        doc.text(': Rp.', 110, finalY + 20);
        doc.text(pendapatanBersih.toLocaleString('id-ID'), 120, finalY + 20);

        doc.text('(........................................)', 25, finalY + 20, { align: 'center' });
        doc.text('(........................................)', 175, finalY + 20, { align: 'center' });
        
        // Baris 5 (Nama Terang)
        if (crewName) {
            doc.text(crewName, 25, finalY + 19, { align: 'center' });
        }
        doc.text('Nama terang', 25, finalY + 24, { align: 'center' });
        
        doc.text('ISNU FR', 175, finalY + 19, { align: 'center' });
        doc.text('Nama terang', 175, finalY + 24, { align: 'center' });

        doc.save('AP3_DAMRI_' + noRef + '.pdf');
        closeAp3Modal();
    }

    // ========================================
    // EDIT MODAL LOGIC
    // ========================================
    function openEditBookingModal(id) {
        const b = getBooking(id);
        if(!b) return;
        
        document.getElementById('editBookingId').value = b.bookingId;
        document.getElementById('editBookingIdDisplay').innerText = b.bookingId;
        document.getElementById('editBookingNama').value = b.name;
        document.getElementById('editBookingHp').value = b.hp;
        document.getElementById('editBookingAlamat').value = b.alamat && b.alamat !== '-' ? b.alamat : '';
        
        let rawKet = String(b.keterangan || b.ket || '');
        const mKet = rawKet.match(/Biaya Tambahan: (.*?) \((Rp[ \d.,]+)\)/);
        if (mKet) {
            document.getElementById('editBookingBiayaTambahanKet').value = mKet[1].trim();
            document.getElementById('editBookingBiayaTambahanNominal').value = parseInt(mKet[2].replace(/[^\d]/g, '')) || 0;
            document.querySelector('input[name="editBookingHasBiayaTambahan"][value="yes"]').checked = true;
            
            rawKet = rawKet.replace(/,?\s*Biaya Tambahan:.*?$/, '').trim();
        } else {
            document.getElementById('editBookingBiayaTambahanKet').value = '';
            document.getElementById('editBookingBiayaTambahanNominal').value = 0;
            document.querySelector('input[name="editBookingHasBiayaTambahan"][value="no"]').checked = true;
        }
        if(document.getElementById('editBookingKeterangan')) document.getElementById('editBookingKeterangan').value = rawKet;
        toggleEditBiayaTambahan();
        document.getElementById('editBookingPnp').value = b.qty;
        const prefillKursi = b.kursi && b.kursi !== '-' ? b.kursi.split(',') : [];
        renderEditBookingKursi(prefillKursi);
        const statusSelect = document.getElementById('editBookingStatus');
        if (statusSelect) {
            statusSelect.value = (b.status === 'BELUM LUNAS') ? 'BELUM LUNAS' : 'LUNAS';
        }

        const dObj = parseIndoDate(b.dateTravel);
        if(dObj) {
            document.getElementById('editBookingDate').value = getLocalYYYYMMDD(dObj);
        } else {
            document.getElementById('editBookingDate').value = '';
        }

        const armadas = getArmadas();
        const uniqueNames = [...new Set(armadas.map(a => a.name))];
        const nameSelect = document.getElementById('editBookingArmadaName');
        nameSelect.innerHTML = '<option value="">-- Pilih Armada --</option>' + uniqueNames.map(n => `<option value="${n}">${n}</option>`).join('');
        document.getElementById('editBookingArmadaRute').innerHTML = '';
        document.getElementById('editBookingArmadaJam').innerHTML = '';
        document.getElementById('editBookingArmada').value = '';
        
        if (b.armadaId) {
            const currentArmada = getArmada(b.armadaId);
            if (currentArmada) {
                nameSelect.value = currentArmada.name;
                updateEditBookingRute();
                document.getElementById('editBookingArmadaRute').value = currentArmada.destination;
                updateEditBookingJam();
                
                // Fix: Prioritaskan waktu dari data booking jika ada dan valid
                const bWaktu = b.waktu || b['WAKTU'];
                const jamSelect = document.getElementById('editBookingArmadaJam');
                const jamOptions = Array.from(jamSelect.options).map(o => o.value);
                const waktuToSelect = (bWaktu && jamOptions.includes(bWaktu)) ? bWaktu : currentArmada.time;
                jamSelect.value = waktuToSelect;
                
                updateEditBookingArmadaId();
            }
        }

        recalcEditBooking();

        const m = document.getElementById('modalEditBooking');
        const c = document.getElementById('modalEditBookingContent');
        m.classList.remove('hidden');
        m.classList.add('flex');
        setTimeout(() => { 
            m.classList.remove('opacity-0'); 
            c.classList.remove('scale-95');
            if (window.innerWidth < 768) {
                c.style.transform = 'scale(0.9)';
            }
        }, 10);
    }

    function closeEditBookingModal() {
        const m = document.getElementById('modalEditBooking');
        const c = document.getElementById('modalEditBookingContent');
        m.classList.add('opacity-0'); c.classList.add('scale-95');
        c.style.transform = '';
        setTimeout(() => { m.classList.add('hidden'); m.classList.remove('flex'); }, 300);
    }

    function updateEditBookingRute() {
        const armadas = getArmadas();
        const name = document.getElementById('editBookingArmadaName').value;
        const ruteSelect = document.getElementById('editBookingArmadaRute');
        
        const filtered = armadas.filter(a => a.name === name);
        const uniqueRute = [...new Set(filtered.map(a => a.destination))];
        ruteSelect.innerHTML = '<option value="">-- Pilih Rute --</option>' + uniqueRute.map(r => `<option value="${r}">${r}</option>`).join('');
        
        document.getElementById('editBookingArmadaJam').innerHTML = '';
        document.getElementById('editBookingArmada').value = '';
        recalcEditBooking();
    }

    function updateEditBookingJam() {
        const armadas = getArmadas();
        const name = document.getElementById('editBookingArmadaName').value;
        const rute = document.getElementById('editBookingArmadaRute').value;
        const jamSelect = document.getElementById('editBookingArmadaJam');
        
        const filtered = armadas.filter(a => a.name === name && a.destination === rute);
        const uniqueJam = [...new Set(filtered.map(a => a.time))];
        jamSelect.innerHTML = '<option value="">-- Pilih Jam --</option>' + uniqueJam.map(j => `<option value="${j}">${j}</option>`).join('');
        
        document.getElementById('editBookingArmada').value = '';
        recalcEditBooking();
    }

    function updateEditBookingArmadaId() {
        const armadas = getArmadas();
        const name = document.getElementById('editBookingArmadaName').value;
        const rute = document.getElementById('editBookingArmadaRute').value;
        const jam = document.getElementById('editBookingArmadaJam').value;
        
        const armada = armadas.find(a => a.name === name && a.destination === rute && a.time === jam);
        if (armada) {
            document.getElementById('editBookingArmada').value = armada.id;
        } else {
            document.getElementById('editBookingArmada').value = '';
        }
        recalcEditBooking();
    }

    let editLastPnp = 0;
    function renderEditBookingKursi(prefill = null) {
        const qty = parseInt(document.getElementById('editBookingPnp').value) || 1;
        if (!prefill && qty === editLastPnp) return;
        
        const existing = [];
        if (prefill) {
            existing.push(...prefill);
        } else {
            for (let i = 1; i <= editLastPnp; i++) {
                const el = document.getElementById('editBookingKursi_' + i);
                if (el) existing.push(el.value);
            }
        }
        
        editLastPnp = qty;
        const container = document.getElementById('editBookingKursiContainer');
        if (!container) return;
        container.innerHTML = '';
        
        const label = document.createElement('label');
        label.className = 'block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2';
        label.innerText = 'Nomor Kursi (Opsional, Wajib terisi semua jika diisi)';
        container.appendChild(label);
        
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 gap-2';
        
        for (let i = 1; i <= qty; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'editBookingKursi_' + i;
            input.placeholder = 'Kursi ' + i;
            if (existing[i-1]) input.value = existing[i-1].trim();
            input.className = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all text-center';
            grid.appendChild(input);
        }
        container.appendChild(grid);
    }

    function toggleEditBiayaTambahan() {
        const hasBiayaTambahan = document.querySelector('input[name="editBookingHasBiayaTambahan"]:checked').value === 'yes';
        const container = document.getElementById('editBookingBiayaTambahanContainer');
        if (hasBiayaTambahan) {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
            document.getElementById('editBookingBiayaTambahanNominal').value = 0;
        }
        recalcEditBooking();
    }

    function recalcEditBooking() {
        renderEditBookingKursi();
        const armadaId = document.getElementById('editBookingArmada').value;
        const qty = parseInt(document.getElementById('editBookingPnp').value) || 1;
        const armada = getArmada(armadaId);
        
        const hasBiayaTambahan = document.querySelector('input[name="editBookingHasBiayaTambahan"]:checked').value === 'yes';
        const nominalBiayaTambahan = hasBiayaTambahan ? (parseInt(document.getElementById('editBookingBiayaTambahanNominal').value) || 0) : 0;
        
        const rawDate = document.getElementById('editBookingDate').value;
        let dObjForHarga = null;
        if (rawDate) {
            dObjForHarga = new Date(rawDate);
        } else {
            const id = document.getElementById('editBookingId').value;
            const b = cachedBookings.find(bk => bk.bookingId === id);
            if (b) dObjForHarga = parseIndoDate(b.dateTravel);
        }
        
        if(armada) {
            const harga = getEffectiveHarga(armada, dObjForHarga);
            const total = (harga * qty) + nominalBiayaTambahan;
            document.getElementById('editBookingTotalDisplay').innerText = formatRupiah(total);
        } else {
            document.getElementById('editBookingTotalDisplay').innerText = 'Rp 0';
        }
    }

    async function submitEditBooking(e) {
        e.preventDefault();
        const btn = document.getElementById('btnSubmitEditBooking');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENYIMPAN...';
        btn.disabled = true;

        const id = document.getElementById('editBookingId').value;
        const armadaId = document.getElementById('editBookingArmada').value;
        const armada = getArmada(armadaId);
        
        const rawDate = document.getElementById('editBookingDate').value;
        let formattedDate = "";
        if(rawDate) {
            const [yyyy, mm, dd] = rawDate.split('-');
            const dObj = new Date(parseInt(yyyy), parseInt(mm)-1, parseInt(dd));
            formattedDate = INDO_DAYS[dObj.getDay()] + ', ' + dObj.getDate() + ' ' + INDO_MONTHS[dObj.getMonth()] + ' ' + dObj.getFullYear();
        } else {
            // fallback if rawDate is empty
            const b = cachedBookings.find(bk => bk.bookingId === id);
            formattedDate = b ? b.dateTravel : '';
        }

        const qty = parseInt(document.getElementById('editBookingPnp').value) || 1;
        
        let filledKursiCount = 0;
        let kursiValues = [];
        for (let i = 1; i <= qty; i++) {
            const el = document.getElementById('editBookingKursi_' + i);
            const val = el ? el.value.trim() : '';
            if (val) filledKursiCount++;
            kursiValues.push(val);
        }
        
        if (filledKursiCount > 0 && filledKursiCount < qty) {
            alert('Harap isi semua nomor kursi (' + qty + ' kursi) atau biarkan semuanya kosong.');
            const btn = document.getElementById('btnSubmitEditBooking');
            btn.innerText = 'Simpan Perubahan'; btn.disabled = false;
            return;
        }
        const kursiString = filledKursiCount === qty ? kursiValues.join(', ') : '';

        const dObjForHarga = parseIndoDate(formattedDate);
        const hargaEff = getEffectiveHarga(armada, dObjForHarga);
        
        let finalKet = document.getElementById('editBookingKeterangan') ? document.getElementById('editBookingKeterangan').value : '';
        const hasBiayaTambahan = document.querySelector('input[name="editBookingHasBiayaTambahan"]:checked').value === 'yes';
        const nominalBiayaTambahan = hasBiayaTambahan ? (parseInt(document.getElementById('editBookingBiayaTambahanNominal').value) || 0) : 0;
        const ketBiayaTambahan = hasBiayaTambahan ? document.getElementById('editBookingBiayaTambahanKet').value : '';
        
        if (hasBiayaTambahan && nominalBiayaTambahan > 0) {
            const ketTambahanText = `Biaya Tambahan: ${ketBiayaTambahan} (${formatRupiah(nominalBiayaTambahan)})`;
            finalKet = finalKet ? `${finalKet}, ${ketTambahanText}` : ketTambahanText;
        }

        const payload = {
            id_tiket: id,
            nama: document.getElementById('editBookingNama').value,
            hp: document.getElementById('editBookingHp').value,
            alamat: document.getElementById('editBookingAlamat').value,
            keterangan: finalKet,
            tanggalPemberangkatan: formattedDate,
            jenisKendaraan: armada ? armada.name : '',
            tujuan: armada ? armada.destination : '',
            jumlahPnp: qty,
            nomorKursi: kursiString,
            harga: hargaEff,
            totalHarga: (hargaEff * qty) + nominalBiayaTambahan,
            waktu: armada ? armada.time : ''
        };
        const statusSelect = document.getElementById('editBookingStatus');
        if (statusSelect) payload.status = statusSelect.value;

        try {
            const res = await postToSheets('editBookingData', payload);
            if(res.status === 'success') {
                showMessage('Data pesanan berhasil diperbarui!');
                closeEditBookingModal();
                await refreshData();
            } else {
                showMessage('Gagal menyimpan pesanan', true);
            }
        } catch(err) {
            showMessage('Kesalahan jaringan', true);
        }
        
        btn.innerText = 'Simpan Perubahan';
        btn.disabled = false;
    }

    function openEditArmadaModal(id) {
        const m = document.getElementById('modalEditArmada');
        const c = document.getElementById('modalEditArmadaContent');
        m.classList.remove('hidden');
        m.classList.add('flex');
        m.style.setProperty('display', 'flex', 'important');
        
        setTimeout(() => {
            if (c) {
                c.classList.remove('scale-95', 'opacity-0');
                c.classList.add('scale-100', 'opacity-100');
                c.style.setProperty('opacity', '1', 'important');
                c.style.setProperty('transform', 'scale(1)', 'important');
            }
        }, 10);
    }

    function closeEditArmadaModal() {
        const m = document.getElementById('modalEditArmada');
        const c = document.getElementById('modalEditArmadaContent');
        if (c) {
            c.classList.remove('scale-100', 'opacity-100');
            c.classList.add('scale-95', 'opacity-0');
        }
        setTimeout(() => {
            if (m) {
                m.classList.remove('flex', 'opacity-100');
                m.classList.add('hidden', 'opacity-0');
            }
        }, 300);
    }

    async function submitEditArmada(e) {
        e.preventDefault();
        const btn = document.getElementById('btnSubmitEditArmada');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENYIMPAN...'; btn.disabled = true;

        const payload = {
            id_armada: document.getElementById('editArmadaId').value,
            nama_armada: document.getElementById('editArmadaNama').value,
            tujuan_armada: document.getElementById('editArmadaTujuan').value,
            jam: document.getElementById('editArmadaJam').value,
            harga: document.getElementById('editArmadaHarga').value,
            seat: document.getElementById('editArmadaSeat').value
        };

        try {
            const res = await postToSheets('editArmadaData', payload);
            if(res.status === 'success') {
                showMessage('Data armada berhasil diperbarui!');
                closeEditArmadaModal();
                refreshData();
            } else {
                showMessage('Gagal menyimpan armada', true);
            }
        } catch(err) {
            showMessage('Kesalahan jaringan', true);
        }
        
        btn.innerText = 'Simpan Perubahan';
        btn.disabled = false;
    }

    // ========================================
    // TAMBAH ARMADA
    // ========================================
    function toggleAddArmadaNamaInput() {
        const select = document.getElementById('addArmadaNamaSelect');
        const input = document.getElementById('addArmadaNama');
        if (!select || !input) return;
        if (select.value === 'BARU') {
            input.classList.remove('hidden');
            input.required = true;
            input.value = '';
        } else {
            input.classList.add('hidden');
            input.required = false;
        }
    }

    function openAddArmadaModal() {
        const m = document.getElementById('modalAddArmada');
        const c = document.getElementById('modalAddArmadaContent');
        m.classList.remove('hidden');
        m.classList.add('flex');
        m.style.setProperty('display', 'flex', 'important');
        
        setTimeout(() => {
            if (c) {
                c.classList.remove('scale-95', 'opacity-0');
                c.classList.add('scale-100', 'opacity-100');
                c.style.setProperty('opacity', '1', 'important');
                c.style.setProperty('transform', 'scale(1)', 'important');
            }
        }, 10);
    }

    function closeAddArmadaModal() {
        const m = document.getElementById('modalAddArmada');
        const c = document.getElementById('modalAddArmadaContent');
        if (c) {
            c.classList.remove('scale-100', 'opacity-100');
            c.classList.add('scale-95', 'opacity-0');
        }
        setTimeout(() => {
            if (m) {
                m.classList.remove('flex', 'opacity-100');
                m.classList.add('hidden', 'opacity-0');
            }
        }, 300);
    }

    async function submitAddArmada(e) {
        e.preventDefault();
        
        let armadaName = '';
        const select = document.getElementById('addArmadaNamaSelect');
        if (select && select.value) {
            if (select.value === 'BARU') {
                armadaName = document.getElementById('addArmadaNama').value;
            } else {
                armadaName = select.value;
            }
        } else {
            armadaName = document.getElementById('addArmadaNama').value;
        }
        
        if (!armadaName || armadaName.trim() === '') {
            showMessage('Nama armada tidak boleh kosong', true);
            return;
        }

        const btn = document.getElementById('btnSubmitAddArmada');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENYIMPAN...'; btn.disabled = true;

        const payload = {
            nama_armada: armadaName,
            tujuan_armada: document.getElementById('addArmadaTujuan').value,
            jam: document.getElementById('addArmadaJam').value,
            harga: document.getElementById('addArmadaHarga').value,
            seat: document.getElementById('addArmadaSeat').value
        };

        try {
            const res = await postToSheets('addArmada', payload);
            if(res.status === 'success') {
                showMessage('Armada baru berhasil ditambahkan!');
                closeAddArmadaModal();
                refreshData();
            } else {
                showMessage('Gagal menambahkan armada', true);
            }
        } catch(err) {
            showMessage('Kesalahan jaringan', true);
        }
        
        btn.innerText = 'Simpan Armada Baru'; btn.disabled = false;
    }

    // ========================================
    // ADMIN BOOKING & THERMAL E-TICKETING
    // ========================================
    let currentTicketWaText = "";
    let currentTicketDataForBT = null;

    async function submitAdminBooking(e) {
        e.preventDefault();
        const btn = document.getElementById('btnSubmitAdminBooking');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MEMPROSES...'; btn.disabled = true;

        const armadaId = document.getElementById('adminBookingArmada').value;
        const armada = getArmada(armadaId);
        
        const rawDate = document.getElementById('adminBookingDate').value;
        const [yyyy, mm, dd] = rawDate.split('-');
        const dObj = new Date(parseInt(yyyy), parseInt(mm)-1, parseInt(dd));
        const formattedDate = INDO_DAYS[dObj.getDay()] + ', ' + dObj.getDate() + ' ' + INDO_MONTHS[dObj.getMonth()] + ' ' + dObj.getFullYear();
        
        const qty = parseInt(document.getElementById('adminBookingPnp').value) || 1;
        const statusPay = document.querySelector('input[name="adminBookingStatus"]:checked').value;
        const hp = document.getElementById('adminBookingHp').value;
        const name = document.getElementById('adminBookingNama').value;
        const ket = document.getElementById('adminBookingKeterangan').value;
        const alamat = document.getElementById('adminBookingAlamat').value;
        
        const hasBiayaTambahan = document.querySelector('input[name="adminBookingHasBiayaTambahan"]:checked').value === 'yes';
        const nominalBiayaTambahan = hasBiayaTambahan ? (parseInt(document.getElementById('adminBookingBiayaTambahanNominal').value) || 0) : 0;
        const ketBiayaTambahan = hasBiayaTambahan ? document.getElementById('adminBookingBiayaTambahanKet').value : '';
        
        let finalKet = ket;
        if (hasBiayaTambahan && nominalBiayaTambahan > 0) {
            const ketTambahanText = `Biaya Tambahan: ${ketBiayaTambahan} (${formatRupiah(nominalBiayaTambahan)})`;
            finalKet = finalKet ? `${finalKet}, ${ketTambahanText}` : ketTambahanText;
        }

        let finalHargaSatuan = armada ? armada.price : 0;
        
        if (armada && rawDate && typeof fetchAllHargaKhusus === 'function') {
            const hkList = cachedHargaKhusus || [];
            const selectedDate = new Date(rawDate).getTime();
            
            const allArmadas = getArmadas();
            const matchingArmadaIds = allArmadas
                .filter(arm => arm.name === armada.name && arm.destination === armada.destination)
                .map(arm => arm.id);
                
            const activeHk = hkList.find(hk => {
                if (!matchingArmadaIds.includes(hk.idArmada)) return false;
                const start = new Date(hk.tanggalAwal).getTime();
                const end = new Date(hk.tanggalAkhir).getTime();
                return selectedDate >= start && selectedDate <= end;
            });
            
            if (activeHk) {
                finalHargaSatuan = parseInt(activeHk.hargaBaru) || armada.price;
            }
        }
        
        const total = armada ? (finalHargaSatuan * qty) + nominalBiayaTambahan : 0;
        
        let filledKursiCount = 0;
        let kursiValues = [];
        for (let i = 1; i <= qty; i++) {
            const el = document.getElementById('adminBookingKursi_' + i);
            const val = el ? el.value.trim() : '';
            if (val) filledKursiCount++;
            kursiValues.push(val);
        }
        
        if (filledKursiCount > 0 && filledKursiCount < qty) {
            alert('Harap isi semua nomor kursi (' + qty + ' kursi) atau biarkan semuanya kosong.');
            btn.innerText = 'BOOKING'; btn.disabled = false;
            return;
        }
        const kursiString = filledKursiCount === qty ? kursiValues.join(', ') : '';
        
        const generateId = () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = '';
            for (let i = 0; i < 8; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        };
        const idTiket = generateId();

        const tipePerjalanan = document.querySelector('input[name="adminTipePerjalanan"]:checked').value;
        let finalTujuan = armada ? armada.destination : '';
        if (tipePerjalanan === 'Pulang' && finalTujuan) {
            finalTujuan = '[PULANG] ' + finalTujuan;
        }

        const payload = {
            'Timestamp': new Date().toISOString(),
            'TANGGAL PEMBERANGKATAN': formattedDate,
            'ID_TIKET': idTiket,
            'JENIS KENDARAAN': armada ? armada.name : '',
            'Tujuan': finalTujuan,
            'Harga': armada ? formatRupiah(armada.price) : '0',
            'NAMA': name,
            'NOMOR HP': hp,
            'JUMLAH PNP': qty,
            'WAKTU': armada ? armada.time : '',
            'PEMBAYARAN': 'CASH',
            'Status': statusPay,
            'Keterangan': finalKet,
            'ALAMAT': alamat,
            'Biaya Tambahan': nominalBiayaTambahan,
            'NOMOR KURSI': kursiString,
            'Total Harga': total
        };

        try {
            const res = await postToSheets('addBooking', payload);
            if(res.status === 'success') {
                showMessage('Booking berhasil dibuat!');
                await refreshData(); // Tunggu data baru masuk
                resetAdminBooking();
                closeBookingModal();

                // Pindah ke menu manifest dan filter sesuai tanggal
                if (typeof switchMenu === 'function') switchMenu('today');
                const filterEl = document.getElementById('manifestFilterDate');
                if (filterEl) {
                    filterEl.value = rawDate; // yyyy-mm-dd format
                    if (typeof renderTodayTable === 'function') renderTodayTable();
                }
                
                // Populate Thermal Receipt
                const now = new Date();
                const tglBeli = String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth() + 1).padStart(2, '0') + '/' + now.getFullYear() + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

                document.getElementById('r_tgl_beli').innerText = tglBeli;
                document.getElementById('r_id').innerText = idTiket;
                document.getElementById('r_tgl').innerText = formattedDate;
                document.getElementById('r_jam').innerText = payload['WAKTU'];
                document.getElementById('r_nama').innerText = payload['NAMA'];
                document.getElementById('r_pnp').innerText = payload['JUMLAH PNP'] + ' Orang';
                document.getElementById('r_kursi').innerText = kursiString || '-';
                document.getElementById('r_bus').innerText = payload['JENIS KENDARAAN'];
                document.getElementById('r_rute').innerText = payload['Tujuan'];
                document.getElementById('r_harga').innerText = formatRupiah(armada ? armada.price : 0);
                
                if (hasBiayaTambahan && nominalBiayaTambahan > 0) {
                    if(document.getElementById('r_biaya_tambahan_container')) document.getElementById('r_biaya_tambahan_container').style.display = 'flex';
                    if(document.getElementById('r_biaya_tambahan_ket')) document.getElementById('r_biaya_tambahan_ket').innerText = ketBiayaTambahan || '-';
                    if(document.getElementById('r_biaya_tambahan')) document.getElementById('r_biaya_tambahan').innerText = formatRupiah(nominalBiayaTambahan);
                } else {
                    if(document.getElementById('r_biaya_tambahan_container')) document.getElementById('r_biaya_tambahan_container').style.display = 'none';
                }
                
                document.getElementById('r_total').innerText = formatRupiah(total);
                document.getElementById('r_rute_short').innerText = 'KWT - ' + String(payload['Tujuan']).substring(0,3).toUpperCase();
                
                document.getElementById('r_bus_arsip').innerText = payload['JENIS KENDARAAN'];
                document.getElementById('r_pnp_arsip_num').innerText = payload['JUMLAH PNP'];
                document.getElementById('r_rute_arsip').innerText = payload['Tujuan'];
                document.getElementById('r_nama_arsip').innerText = payload['NAMA'];
                document.getElementById('r_tgl_arsip').innerText = formattedDate;

                // Populate E-Ticket Visual Modal (ticket*)
                let visualAsal = 'Kawunganten';
                let visualTujuan = payload['Tujuan'];
                if (visualTujuan && String(visualTujuan).startsWith('[PULANG] ')) {
                    visualAsal = visualTujuan.replace('[PULANG] ', '');
                    visualTujuan = 'KAWUNGANTEN';
                }

                if(document.getElementById('ticketDate')) document.getElementById('ticketDate').innerText = formattedDate;
                if(document.getElementById('ticketTime')) document.getElementById('ticketTime').innerText = payload['WAKTU'] || '-';
                if(document.getElementById('ticketArmada')) document.getElementById('ticketArmada').innerText = payload['JENIS KENDARAAN'];
                if(document.getElementById('ticketAsal')) document.getElementById('ticketAsal').innerText = visualAsal;
                if(document.getElementById('ticketTujuan')) document.getElementById('ticketTujuan').innerText = visualTujuan;
                if(document.getElementById('ticketKursi')) document.getElementById('ticketKursi').innerText = kursiString || '-';
                if(document.getElementById('ticketQty')) document.getElementById('ticketQty').innerText = payload['JUMLAH PNP'];
                if(document.getElementById('ticketId')) document.getElementById('ticketId').innerText = idTiket;
                if(document.getElementById('ticketName')) document.getElementById('ticketName').innerText = payload['NAMA'];
                if(document.getElementById('ticketTglBeli')) document.getElementById('ticketTglBeli').innerText = "TGL BELI: " + tglBeli;
                
                if(document.getElementById('ticketHargaSatuan')) document.getElementById('ticketHargaSatuan').innerText = formatRupiah(armada ? armada.price : 0);
                if(document.getElementById('ticketTotal')) document.getElementById('ticketTotal').innerText = formatRupiah(total);
                
                if (hasBiayaTambahan && nominalBiayaTambahan > 0) {
                    if(document.getElementById('ticketBiayaTambahanContainer')) {
                        document.getElementById('ticketBiayaTambahanContainer').classList.remove('hidden');
                        document.getElementById('ticketBiayaTambahanContainer').classList.add('flex');
                    }
                    if(document.getElementById('ticketBiayaTambahanKet')) document.getElementById('ticketBiayaTambahanKet').innerText = '(' + (ketBiayaTambahan || 'Tambahan') + ')';
                    if(document.getElementById('ticketBiayaTambahan')) document.getElementById('ticketBiayaTambahan').innerText = formatRupiah(nominalBiayaTambahan);
                } else {
                    if(document.getElementById('ticketBiayaTambahanContainer')) {
                        document.getElementById('ticketBiayaTambahanContainer').classList.add('hidden');
                        document.getElementById('ticketBiayaTambahanContainer').classList.remove('flex');
                    }
                }

                if(document.getElementById('ticketArmadaArsip')) document.getElementById('ticketArmadaArsip').innerText = payload['JENIS KENDARAAN'];
                if(document.getElementById('ticketNameArsip')) document.getElementById('ticketNameArsip').innerText = payload['NAMA'];
                if(document.getElementById('ticketQtyArsip')) document.getElementById('ticketQtyArsip').innerText = payload['JUMLAH PNP'];
                if(document.getElementById('ticketTujuanArsip')) document.getElementById('ticketTujuanArsip').innerText = payload['Tujuan'];
                if(document.getElementById('ticketDateArsip')) document.getElementById('ticketDateArsip').innerText = formattedDate;

                // Prepare WA Link
                const waNum = String(hp).replace(/[^0-9]/g, '').replace(/^0/, '62');
                const textWa = `*AGEN DAMRI KAWUNGANTEN*\n\nHalo ${name}, ini adalah rincian E-Ticketing Anda:\n\n*ID Tiket:* ${idTiket}\n*Armada:* ${payload['JENIS KENDARAAN']}\n*Tujuan:* ${payload['Tujuan']}\n*Tanggal:* ${formattedDate}\n*Jam:* ${payload['WAKTU']}\n*Jml Penumpang:* ${qty} Orang\n*Total Harga:* ${formatRupiah(total)}\n*Status:* ${statusPay}\n\nTerima kasih telah menggunakan jasa kami!\nWebsite: agendamrikawunganten.net`;
                currentTicketWaText = `https://wa.me/${waNum}?text=${encodeURIComponent(textWa)}`;

                // Simpan data untuk Web Bluetooth API
                currentTicketDataForBT = {
                    idTiket: idTiket,
                    tglBeli: tglBeli,
                    nama: payload['NAMA'],
                    tujuan: payload['Tujuan'],
                    tglBerangkat: formattedDate,
                    jam: payload['WAKTU'],
                    jumlahPnp: qty + ' Orang',
                    kursi: kursiString,
                    armada: payload['JENIS KENDARAAN'],
                    totalHarga: formatRupiah(total),
                    hargaSatuan: formatRupiah(armada ? armada.price : 0),
                    biayaTambahan: hasBiayaTambahan ? nominalBiayaTambahan : 0,
                    biayaTambahanKet: ketBiayaTambahan,
                    status: statusPay
                };

                openEticketModal();
            } else {
                showMessage('Gagal booking', true);
            }
        } catch(err) {
            showMessage('Kesalahan jaringan', true);
        }
        
        btn.innerText = 'BOOKING'; btn.disabled = false;
    }

    function resetAdminBooking() {
        document.getElementById('formAdminBooking').reset();
        document.getElementById('adminBookingDate').value = getLocalYYYYMMDD(new Date());
        document.getElementById('adminBookingTotalDisplay').innerText = 'Rp0';
        if(typeof toggleAdminBiayaTambahan === 'function') toggleAdminBiayaTambahan();
        updateAdminRute();
    }

    function updateAdminTime() {
        const selectedName = document.getElementById('adminBookingArmadaName').value;
        const timeSelect = document.getElementById('adminBookingTime');
        const ruteSelect = document.getElementById('adminBookingArmada');
        
        if (!selectedName) {
            timeSelect.innerHTML = '<option value="">-- Pilih Jam --</option>';
            ruteSelect.innerHTML = '<option value="">-- Pilih Rute --</option>';
        } else {
            const armadas = getArmadas();
            const activeArmadas = armadas.filter(a => a.isActive !== false);
            const filteredByName = activeArmadas.filter(a => a.name === selectedName);
            const uniqueTimes = [...new Set(filteredByName.map(a => a.time))].sort();
            
            timeSelect.innerHTML = '<option value="">-- Pilih Jam --</option>' + uniqueTimes.map(t => `<option value="${t}">${t}</option>`).join('');
            ruteSelect.innerHTML = '<option value="">-- Pilih Rute --</option>';
        }
        recalcAdminBooking();
    }

    function updateAdminRute() {
        const selectedName = document.getElementById('adminBookingArmadaName').value;
        const selectedTime = document.getElementById('adminBookingTime').value;
        const ruteSelect = document.getElementById('adminBookingArmada');
        
        if (!selectedName || !selectedTime) {
            ruteSelect.innerHTML = '<option value="">-- Pilih Rute --</option>';
        } else {
            const armadas = getArmadas();
            const activeArmadas = armadas.filter(a => a.isActive !== false);
            const filtered = activeArmadas.filter(a => a.name === selectedName && a.time === selectedTime);
            ruteSelect.innerHTML = '<option value="">-- Pilih Rute --</option>' + filtered.map(a => `<option value="${a.id}">${a.destination}</option>`).join('');
        }
        recalcAdminBooking();
    }

    let adminLastPnp = 0;
    function renderAdminBookingKursi() {
        const qty = parseInt(document.getElementById('adminBookingPnp').value) || 1;
        if (qty === adminLastPnp) return;
        
        const existing = [];
        for (let i = 1; i <= adminLastPnp; i++) {
            const el = document.getElementById('adminBookingKursi_' + i);
            if (el) existing.push(el.value);
        }
        
        adminLastPnp = qty;
        const container = document.getElementById('adminBookingKursiContainer');
        if (!container) return;
        container.innerHTML = '';
        
        const label = document.createElement('label');
        label.className = 'block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2';
        label.innerText = 'Nomor Kursi (Opsional, Wajib terisi semua jika diisi)';
        container.appendChild(label);
        
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 md:grid-cols-4 gap-2';
        
        for (let i = 1; i <= qty; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'adminBookingKursi_' + i;
            input.placeholder = 'Kursi ' + i;
            if (existing[i-1]) input.value = existing[i-1];
            input.className = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-center';
            grid.appendChild(input);
        }
        container.appendChild(grid);
    }

    function recalcAdminBooking() {
        renderAdminBookingKursi();
        const armadaId = document.getElementById('adminBookingArmada').value;
        const d = document.getElementById('adminBookingDate').value;
        const qty = parseInt(document.getElementById('adminBookingPnp').value) || 1;
        const armada = getArmada(armadaId);
        
        const hasBiayaTambahan = document.querySelector('input[name="adminBookingHasBiayaTambahan"]:checked').value === 'yes';
        const nominalBiayaTambahan = hasBiayaTambahan ? (parseInt(document.getElementById('adminBookingBiayaTambahanNominal').value) || 0) : 0;

        if(armada) {
            const dObj = d ? new Date(d) : null;
            const finalHarga = getEffectiveHarga(armada, dObj);
            
            document.getElementById('adminBookingTotalDisplay').innerText = formatRupiah((finalHarga * qty) + nominalBiayaTambahan);
            // Simpan harga satuan untuk submit form (jika ada hidden field, atau submit form hitung ulang)
            // Di admin.js, submitAdminBooking biasanya menghitung ulang dari elemen total
        } else {
            document.getElementById('adminBookingTotalDisplay').innerText = 'Rp0';
        }
    }

    function toggleAdminBiayaTambahan() {
        const hasBiayaTambahan = document.querySelector('input[name="adminBookingHasBiayaTambahan"]:checked').value === 'yes';
        const container = document.getElementById('adminBookingBiayaTambahanContainer');
        if (hasBiayaTambahan) {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
        recalcAdminBooking();
    }

    function openBookingModal() {
        const modal = document.getElementById('bookingModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function closeBookingModal() {
        const modal = document.getElementById('bookingModal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    function openEticketModal() {
        const modal = document.getElementById('ticketModal');
        const inner = document.getElementById('ticketModalInner');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            inner.classList.remove('scale-95', 'opacity-0');
            inner.classList.add('scale-100', 'opacity-100');
        }, 10);
    }
    function printRawBT() {
        if(typeof currentTicketDataForBT === 'undefined' || !currentTicketDataForBT) {
            alert('Data tiket tidak ditemukan.');
            return;
        }
        const t = currentTicketDataForBT;
        
        // ESC/POS Commands
        const CMD = {
            INIT: [0x1B, 0x40],
            ALIGN_LEFT: [0x1B, 0x61, 0x00],
            ALIGN_CENTER: [0x1B, 0x61, 0x01],
            ALIGN_RIGHT: [0x1B, 0x61, 0x02],
            BOLD_ON: [0x1B, 0x45, 0x01],
            BOLD_OFF: [0x1B, 0x45, 0x00],
            TEXT_NORMAL: [0x1D, 0x21, 0x00],
            TEXT_DOUBLE_HW: [0x1D, 0x21, 0x11],
            INVERSE_ON: [0x1D, 0x42, 0x01],
            INVERSE_OFF: [0x1D, 0x42, 0x00],
            LF: [0x0A]
        };

        let bytes = [];
        
        function strToBytes(str) {
            let arr = [];
            for (let i = 0; i < str.length; i++) {
                arr.push(str.charCodeAt(i));
            }
            return arr;
        }

        function add(cmd) { bytes.push(...cmd); }
        function addStr(str) { bytes.push(...strToBytes(str)); }
        function addLine(str) { addStr(str); add(CMD.LF); }

        // Start Document
        add(CMD.INIT);
        add(CMD.ALIGN_CENTER);
        add(CMD.BOLD_ON);
        addLine("AGEN DAMRI KAWUNGANTEN");
        add(CMD.BOLD_OFF);
        addLine("Pusat Penjualan Tiket");
        addLine("TGL BELI: " + t.tglBeli);
        add(CMD.BOLD_ON);
        addLine("*** TIKET RESMI ***");
        add(CMD.BOLD_OFF);
        addLine("================================");
        
        add(CMD.BOLD_ON);
        add(CMD.INVERSE_ON);
        add(CMD.TEXT_DOUBLE_HW);
        let armada = String(t.armada).toUpperCase();
        function centerInverseDouble(str, len) {
            if(!str) str = "";
            if(str.length >= len) return str.substring(0, len);
            let pad = len - str.length;
            let left = Math.floor(pad/2);
            let right = pad - left;
            return " ".repeat(left) + str + " ".repeat(right);
        }
        addLine(centerInverseDouble(armada, 16));
        add(CMD.TEXT_NORMAL);
        add(CMD.INVERSE_OFF);
        add(CMD.BOLD_OFF);
        addLine("--------------------------------");
        
        let line1 = "Kode Boking";
        let right1Text = t.idTiket;
        let spaces1 = 32 - line1.length - right1Text.length;
        if(spaces1 < 0) spaces1 = 0;
        add(CMD.ALIGN_LEFT);
        addStr(line1);
        addStr(" ".repeat(spaces1));
        add(CMD.BOLD_ON);
        addStr(right1Text);
        add(CMD.BOLD_OFF);
        add(CMD.LF);
        addLine("--------------------------------");
        
        function addTwoColumnsLeftRight(leftStr, rightStr, extraSpacing = false) {
            if(!rightStr) rightStr = "";
            let spaces = 32 - leftStr.length - rightStr.length;
            if(spaces < 0) spaces = 0;
            addLine(leftStr + " ".repeat(spaces) + rightStr);
            if(extraSpacing) add(CMD.LF);
        }
        
        let asalThermal = "Kawunganten";
        let tujuanThermal = t.tujuan;
        if (t.tujuan && String(t.tujuan).startsWith('[PULANG] ')) {
            asalThermal = t.tujuan.replace('[PULANG] ', '');
            tujuanThermal = "KAWUNGANTEN";
        }

        addTwoColumnsLeftRight("Tanggal", t.tglBerangkat, true);
        addTwoColumnsLeftRight("Jam", t.jam, true);
        addTwoColumnsLeftRight("Asal", asalThermal, true);
        addTwoColumnsLeftRight("Tujuan", tujuanThermal, true);
        addTwoColumnsLeftRight("Nama", t.nama, true);
        addTwoColumnsLeftRight("Jumlah Pnp", t.jumlahPnp, true);
        addTwoColumnsLeftRight("Kursi", t.kursi || "-", true);
        const ketText = t.keterangan || t['Keterangan'] || t['KETERANGAN'] || '';
        if (ketText) {
            addTwoColumnsLeftRight("Ket.", ketText, true);
        }
        
        addLine("--------------------------------");
        addTwoColumnsLeftRight("Harga/Tiket", t.hargaSatuan, false);
        
        let lineTot = "TOTAL";
        let rightTot = " " + t.totalHarga + " ";
        let spacesTot = 32 - lineTot.length - rightTot.length;
        if(spacesTot < 0) spacesTot = 0;
        add(CMD.BOLD_ON);
        addStr(lineTot);
        addStr(" ".repeat(spacesTot));
        add(CMD.INVERSE_ON);
        addStr(rightTot);
        add(CMD.INVERSE_OFF);
        add(CMD.BOLD_OFF);
        add(CMD.LF);
        
        addLine("================================");
        
        add(CMD.ALIGN_CENTER);
        addLine("HADIR 30 MENIT SEBELUM");
        addLine("PEMBERANGKATAN");
        add(CMD.LF);
        addLine("TIKET YANG SUDAH DIBOOKING");
        addLine("TIDAK BISA DICANCEL MENDADAK");
        addLine("(MAX 1x24jam)");
        add(CMD.LF);
        addLine("Terima Kasih");
        addLine("Info: 082133607759");
        addLine("--------------------------------");
        
        add(CMD.BOLD_ON);
        addLine("ARSIP AGEN");
        add(CMD.BOLD_OFF);
        add(CMD.LF);
        
        add(CMD.BOLD_ON);
        add(CMD.INVERSE_ON);
        add(CMD.TEXT_DOUBLE_HW);
        addLine(centerInverseDouble(armada, 16));
        add(CMD.TEXT_NORMAL);
        add(CMD.INVERSE_OFF);
        add(CMD.BOLD_OFF);
        add(CMD.LF);
        
        add(CMD.BOLD_ON);
        addLine(t.nama + " (" + t.jumlahPnp + " Org) - " + t.tujuan);
        add(CMD.BOLD_OFF);
        addLine(t.tglBerangkat);
        add(CMD.LF);
        add(CMD.LF);
        add(CMD.LF); 

        // Convert to binary string
        let binStr = "";
        for (let i = 0; i < bytes.length; i++) {
            binStr += String.fromCharCode(bytes[i]);
        }
        
        // Encode Base64 & call RawBT Intent
        const base64 = btoa(binStr);
        const intentUrl = "intent:base64," + base64 + "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;";
        window.location.href = intentUrl;
    }

    function closeEticketModal() {
        document.getElementById('eticketModal').classList.add('hidden');
        document.getElementById('eticketModal').classList.remove('flex');
    }
    function sendWaAdmin() {
        if(currentTicketWaText) window.open(currentTicketWaText, '_blank');
    }

    document.addEventListener('DOMContentLoaded', () => {
        if(document.getElementById('adminBookingDate')) {
            document.getElementById('adminBookingDate').value = getLocalYYYYMMDD(new Date());
        }
    });
let adminsData = [];
async function renderAkun() {
    const tbody = document.getElementById('akunTableBody');
    if (!tbody) return;
    tbody.innerHTML = `
        <tr class="animate-pulse border-b border-slate-50"><td colspan="4" class="p-4"><div class="flex items-center gap-4"><div class="w-8 h-8 bg-slate-200 rounded flex-shrink-0"></div><div class="flex-1 space-y-2"><div class="h-4 bg-slate-200 rounded w-1/3"></div><div class="h-3 bg-slate-100 rounded w-1/4"></div></div><div class="w-16 h-6 bg-slate-200 rounded-lg flex-shrink-0"></div></div></td></tr>
        <tr class="animate-pulse border-b border-slate-50"><td colspan="4" class="p-4"><div class="flex items-center gap-4"><div class="w-8 h-8 bg-slate-200 rounded flex-shrink-0"></div><div class="flex-1 space-y-2"><div class="h-4 bg-slate-200 rounded w-1/2"></div><div class="h-3 bg-slate-100 rounded w-1/3"></div></div><div class="w-16 h-6 bg-slate-200 rounded-lg flex-shrink-0"></div></div></td></tr>
    `;
    
    try {
        const res = await fetch('/api?action=getAdmin', { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') } });
        const json = await res.json();
        if(json.status === 'success') {
            adminsData = json.data;
            if(adminsData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center text-sm text-slate-400 font-bold py-8 italic uppercase">Belum ada data</td></tr>';
                return;
            }
            tbody.innerHTML = adminsData.map((a, index) => `
                <tr class="hover:bg-slate-50 transition-colors group">
                    <td class="text-center font-bold text-slate-400">${index + 1}</td>
                    <td class="font-bold text-slate-700">${a.Username}</td>
                    <td>
                        <div class="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button onclick="editAdmin('${a.id}')" class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all">
                                <i class="fas fa-edit text-xs"></i>
                            </button>
                            <button onclick="confirmDeleteAdmin('${a.id}')" class="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all">
                                <i class="fas fa-trash-alt text-xs"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-red-500">Gagal memuat data</td></tr>';
    }
}

function editAdmin(id) {
    const admin = adminsData.find(a => a.id === id);
    if(admin) {
        document.getElementById('adminId').value = admin.id;
        document.getElementById('adminUsername').value = admin.Username;
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminModal').classList.remove('hidden');
    }
}

async function saveAdmin(e) {
    e.preventDefault();
    const id = document.getElementById('adminId').value;
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;
    
    if (!id && !password) {
        alert("Password wajib diisi untuk akun baru!");
        return;
    }
    
    const btn = document.getElementById('adminSaveBtn');
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    
    const action = id ? 'editAdmin' : 'addAdmin';
    const payload = id ? { id, username, password } : { username, password };
    
    try {
        const res = await fetch('/api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') },
            body: JSON.stringify({ action, payload })
        });
        const json = await res.json();
        
        if(json.status === 'success') {
            showMessage('Berhasil', json.message || 'Data disimpan');
            document.getElementById('adminModal').classList.add('hidden');
            renderAkun();
        } else {
            alert(json.message || 'Gagal menyimpan');
        }
    } catch(err) {
        alert('Terjadi kesalahan koneksi');
    }
    
    btn.innerHTML = 'Simpan';
    btn.disabled = false;
}

let deleteAdminId = null;
function confirmDeleteAdmin(id) {
    deleteAdminId = id;
    document.getElementById('deleteAdminModal').classList.remove('hidden');
}

document.getElementById('btnConfirmDeleteAdmin').addEventListener('click', async () => {
    if(!deleteAdminId) return;
    const btn = document.getElementById('btnConfirmDeleteAdmin');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    
    try {
        const res = await fetch('/api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') },
            body: JSON.stringify({ action: 'deleteAdmin', payload: { id: deleteAdminId } })
        });
        const json = await res.json();
        
        if(json.status === 'success') {
            showMessage('Berhasil', 'Admin dihapus');
            document.getElementById('deleteAdminModal').classList.add('hidden');
            renderAkun();
        } else {
            alert(json.message || 'Gagal menghapus');
        }
    } catch(err) {
        alert('Terjadi kesalahan koneksi');
    }
    
    btn.innerHTML = 'Ya, Hapus';
    btn.disabled = false;
});

// ============================================
// DARK MODE TOGGLE  EEnhanced
// ============================================
function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('adminDarkMode', isDark ? '1' : '0');
    updateDarkModeIcons(isDark);
    updateChartColors(isDark);
}

function updateDarkModeIcons(isDark) {
    document.querySelectorAll('.dark-mode-btn i').forEach(icon => {
        icon.style.transform = isDark ? 'rotate(360deg)' : 'rotate(0deg)';
        if (isDark) {
            icon.classList.replace('fa-moon', 'fa-sun');
        } else {
            icon.classList.replace('fa-sun', 'fa-moon');
        }
    });
    // Update tooltip
    document.querySelectorAll('.dark-mode-btn').forEach(btn => {
        btn.title = isDark ? 'Mode Terang' : 'Mode Gelap';
    });
}

function updateChartColors(isDark) {
    if (typeof Chart === 'undefined') return;
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(51,65,85,0.4)' : 'rgba(0,0,0,0.05)';

    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;

    // Update all existing chart instances
    Object.values(Chart.instances || {}).forEach(chart => {
        if (!chart || !chart.config) return;
        try {
            // Update scales
            if (chart.options.scales) {
                Object.values(chart.options.scales).forEach(scale => {
                    if (scale.ticks) scale.ticks.color = textColor;
                    if (scale.grid) scale.grid.color = gridColor;
                });
            }
            // Update legend
            if (chart.options.plugins && chart.options.plugins.legend && chart.options.plugins.legend.labels) {
                chart.options.plugins.legend.labels.color = textColor;
            }
            chart.update('none');
        } catch(e) { /* skip */ }
    });
}

// Initialize Dark Mode on load (prevents flash)
(function initDarkMode() {
    const saved = localStorage.getItem('adminDarkMode');
    const isDark = saved === '1';
    if (isDark) {
        document.body.classList.add('dark-mode');
    }
    // Defer icon + chart update to after DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            updateDarkModeIcons(isDark);
            updateChartColors(isDark);
        });
    } else {
        updateDarkModeIcons(isDark);
        updateChartColors(isDark);
    }
})();
        function parseEkstraPnp(item) {
            try {
                const parsed = JSON.parse(item.namaPenumpang);
                if (parsed && parsed.pnp && Array.isArray(parsed.pnp)) return parsed.pnp;
                if (Array.isArray(parsed)) return parsed;
            } catch (e) {
                // Legacy
            }
            return [{ nama: item.namaPenumpang, harga: item.hargaTiket }];
        }

        function parseEkstraHp(item) {
            try {
                const parsed = JSON.parse(item.namaPenumpang);
                if (parsed && parsed.hp) return parsed.hp;
            } catch (e) {
                // Legacy
            }
            return '-';
        }

        function renderEkstra() {
            const tbody = document.getElementById('ekstraTableBody');
            const data = getEkstraBookings() || [];
            
            if(data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-400 font-medium">Belum ada data tiket pesawat / kapal</td></tr>';
                return;
            }

            // Urutkan dari yang terbaru (bisa pakai createdAt)
            let html = '';
            data.forEach((item, index) => {
                const isLunas = item.statusPembayaran === 'LUNAS';
                const statusColor = isLunas ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200';
                const pnpList = parseEkstraPnp(item);
                const icon = item.tipe === 'PESAWAT' ? 'fa-plane' : 'fa-ship';
                
                html += `
                    <tr class="block lg:table-row hover:bg-slate-50/80 transition-colors group p-4 lg:p-0 mb-4 lg:mb-0 bg-white border border-slate-100 lg:border-none rounded-2xl lg:rounded-none shadow-sm lg:shadow-none">
                        <td class="block lg:table-cell p-3 lg:p-4 border-b border-dashed border-slate-100 lg:border-none">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 lg:w-10 lg:h-10 rounded-2xl lg:rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                                    <i class="fas ${icon} text-lg lg:text-base"></i>
                                </div>
                                <div>
                                    <div class="lg:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Maskapai/Vendor</div>
                                    <div class="font-black text-slate-800 text-base lg:text-sm">${item.vendor}</div>
                                    <div class="text-[11px] lg:text-[10px] font-bold text-slate-400 uppercase mt-0.5 lg:mt-0">${item.tipe}</div>
                                </div>
                            </div>
                        </td>
                        <td class="block lg:table-cell p-3 lg:p-4 border-b border-dashed border-slate-100 lg:border-none">
                            <div class="lg:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Waktu & Rute</div>
                            <div class="font-bold text-slate-700">${item.rute}</div>
                            <div class="text-xs text-slate-500 mt-1"><i class="far fa-calendar-alt mr-1"></i>${item.tanggalBerangkat} | <i class="far fa-clock mr-1"></i>${item.jamBerangkat}</div>
                        </td>
                        <td class="flex lg:table-cell items-center justify-between lg:justify-start p-3 lg:p-4 border-b border-dashed border-slate-100 lg:border-none">
                            <div class="lg:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest">Penumpang</div>
                            <div>
                                <div class="font-black text-blue-600">${pnpList.map(p => p.nama).join(', ')} <span class="text-xs text-slate-400 font-bold ml-1">(${pnpList.length} Org)</span></div>
                                <div class="text-[10px] font-bold text-slate-400 mt-0.5"><i class="fas fa-phone mr-1"></i> ${parseEkstraHp(item)}</div>
                            </div>
                        </td>
                        <td class="flex lg:table-cell items-center justify-between lg:text-right p-3 lg:p-4 border-b border-dashed border-slate-100 lg:border-none">
                            <div class="lg:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Bayar</div>
                            <div class="font-bold text-slate-700 text-right">${formatRupiah(item.totalHarga)}</div>
                        </td>
                        <td class="flex lg:table-cell items-center justify-between lg:text-center p-3 lg:p-4 border-b border-dashed border-slate-100 lg:border-none">
                            <div class="lg:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</div>
                            <span class="inline-flex px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border ${statusColor}">
                                ${item.statusPembayaran}
                            </span>
                        </td>
                        <td class="block lg:table-cell p-3 lg:p-4 lg:text-center">
                            <div class="flex items-center lg:justify-center gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                <button onclick='printStrukEkstra(${JSON.stringify(item)})' class="w-10 h-10 lg:w-8 lg:h-8 rounded-xl lg:rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-center" title="Cetak Struk">
                                    <i class="fas fa-print"></i>
                                </button>
                                <button onclick='openEditEkstraModal(${JSON.stringify(item)})' class="w-10 h-10 lg:w-8 lg:h-8 rounded-xl lg:rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white transition-colors flex items-center justify-center" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="deleteEkstra('${item.id}')" class="w-10 h-10 lg:w-8 lg:h-8 rounded-xl lg:rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center" title="Hapus">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }

        function generateEkstraPnpFields(data = null) {
            const countInput = document.getElementById('ekstraJumlahPnp');
            let count = parseInt(countInput.value) || 1;
            if (count < 1) { count = 1; countInput.value = 1; }
            
            const container = document.getElementById('ekstraPnpContainer');
            container.innerHTML = '';
            
            for(let i=1; i<=count; i++) {
                let namaVal = '';
                let hargaVal = '';
                if(data && Array.isArray(data) && data[i-1]) {
                    namaVal = data[i-1].nama || '';
                    hargaVal = data[i-1].harga || '';
                }
                
                container.innerHTML += `
                    <div class="relative p-4 pt-5 bg-white border border-slate-200 rounded-xl shadow-sm mt-3">
                        <div class="absolute -top-2 left-4 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md shadow-md">Penumpang ${i}</div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                            <div>
                                <label class="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Nama</label>
                                <input type="text" class="ekstra-nama-input w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="Nama Penumpang" value="${namaVal}" required>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Harga Dasar (Rp)</label>
                                <input type="number" class="ekstra-harga-input w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="Harga Tiket" value="${hargaVal}" oninput="calculateEkstraTotal()" required>
                            </div>
                        </div>
                    </div>
                `;
            }
            calculateEkstraTotal();
        }

        function calculateEkstraTotal() {
            const hargaInputs = document.querySelectorAll('.ekstra-harga-input');
            let sumHarga = 0;
            hargaInputs.forEach(input => {
                sumHarga += parseInt(input.value) || 0;
            });
            const count = hargaInputs.length;
            const adminTotal = count * 25000;
            const grandTotal = sumHarga + adminTotal;
            
            document.getElementById('ekstraSumHarga').innerText = formatRupiah(sumHarga);
            document.getElementById('ekstraSumAdmin').innerText = formatRupiah(adminTotal);
            document.getElementById('ekstraGrandTotal').innerText = formatRupiah(grandTotal);
        }

        function openAddEkstraModal() {
            try {
                document.getElementById('ekstraId').value = '';
                document.getElementById('ekstraForm').reset();
                document.getElementById('ekstraAsal').value = '';
                document.getElementById('ekstraTujuan').value = '';
                document.getElementById('ekstraJumlahPnp').value = 1;
                document.getElementById('ekstraHp').value = '';
                generateEkstraPnpFields();
                document.getElementById('ekstraModalTitle').innerText = 'Tambah Tiket Ekstra';
                
                const modal = document.getElementById('ekstraModal');
                const inner = document.getElementById('ekstraModalInner');
                modal.classList.remove('hidden', 'opacity-0');
                modal.classList.add('flex', 'opacity-100');
                setTimeout(() => {
                    if (inner) {
                        inner.classList.remove('scale-95', 'opacity-0');
                        inner.classList.add('scale-100', 'opacity-100');
                    }
                }, 10);
            } catch (e) {
                alert('Error openAddEkstra: ' + e.message + '\nLine: ' + e.lineNumber);
            }
        }

        function openEditEkstraModal(item) {
            try {
                document.getElementById('ekstraId').value = item.id;
                document.getElementById('ekstraTipe').value = item.tipe;
                document.getElementById('ekstraVendor').value = item.vendor;
                const ruteParts = (item.rute || '').split(' - ');
                document.getElementById('ekstraAsal').value = (ruteParts[0] || '').trim();
                document.getElementById('ekstraTujuan').value = (ruteParts.slice(1).join(' - ') || '').trim();
                document.getElementById('ekstraTanggal').value = item.tanggalBerangkat;
                document.getElementById('ekstraJam').value = item.jamBerangkat;
                document.getElementById('ekstraStatus').value = item.statusPembayaran;
                document.getElementById('ekstraHp').value = parseEkstraHp(item) !== '-' ? parseEkstraHp(item) : '';

                const pnpList = parseEkstraPnp(item);
                document.getElementById('ekstraJumlahPnp').value = pnpList.length;
                generateEkstraPnpFields(pnpList);

                document.getElementById('ekstraModalTitle').innerText = 'Edit Tiket Ekstra';
                
                const modal = document.getElementById('ekstraModal');
                const inner = document.getElementById('ekstraModalInner');
                modal.classList.remove('hidden', 'opacity-0');
                modal.classList.add('flex', 'opacity-100');
                setTimeout(() => {
                    if (inner) {
                        inner.classList.remove('scale-95', 'opacity-0');
                        inner.classList.add('scale-100', 'opacity-100');
                    }
                }, 10);
            } catch (e) {
                alert('Error openEditEkstra: ' + e.message + '\nLine: ' + e.lineNumber);
            }
        }

        function closeEkstraModal() {
            const modal = document.getElementById('ekstraModal');
            const inner = document.getElementById('ekstraModalInner');
            if (inner) {
                inner.classList.remove('scale-100', 'opacity-100');
                inner.classList.add('scale-95', 'opacity-0');
            }
            setTimeout(() => {
                if (modal) {
                    modal.classList.add('hidden', 'opacity-0');
                    modal.classList.remove('flex', 'opacity-100');
                }
            }, 300);
        }

        async function submitEkstra(e) {
            e.preventDefault();
            const btn = document.getElementById('ekstraSubmitBtn');
            const originalContent = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
            btn.disabled = true;

            const id = document.getElementById('ekstraId').value;
            const action = id ? 'editEkstraBooking' : 'addEkstraBooking';
            
            const namaInputs = document.querySelectorAll('.ekstra-nama-input');
            const hargaInputs = document.querySelectorAll('.ekstra-harga-input');
            let pnpArray = [];
            for (let i = 0; i < namaInputs.length; i++) {
                pnpArray.push({
                    nama: namaInputs[i].value,
                    harga: parseInt(hargaInputs[i].value) || 0
                });
            }

            const ruteAsal = document.getElementById('ekstraAsal').value.trim();
            const ruteTujuan = document.getElementById('ekstraTujuan').value.trim();
            const ruteFinal = (ruteAsal && ruteTujuan) ? ruteAsal + ' - ' + ruteTujuan : (ruteAsal || ruteTujuan);

            const payload = {
                id: id,
                tipe: document.getElementById('ekstraTipe').value,
                vendor: document.getElementById('ekstraVendor').value,
                rute: ruteFinal,
                tanggalBerangkat: document.getElementById('ekstraTanggal').value,
                jamBerangkat: document.getElementById('ekstraJam').value,
                namaPenumpang: JSON.stringify({
                    hp: document.getElementById('ekstraHp').value,
                    pnp: pnpArray
                }),
                kodeBooking: '',
                hargaTiket: 0, // calculated backend
                statusPembayaran: document.getElementById('ekstraStatus').value,
            };

            try {
                const res = await fetch('/api', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') },
                    body: JSON.stringify({ action: action, payload: payload })
                });
                const result = await res.json();
                if(result.status === 'success') {
                    closeEkstraModal();
                    await refreshData();
                } else {
                    alert('Gagal: ' + result.message);
                }
            } catch (err) {
                console.error(err);
                alert('Terjadi kesalahan jaringan');
            } finally {
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }
        }

        async function deleteEkstra(id) {
            if(!confirm('Apakah Anda yakin ingin menghapus tiket ini?')) return;
            
            try {
                const res = await fetch('/api', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') },
                    body: JSON.stringify({ action: 'deleteEkstraBooking', payload: { id: id } })
                });
                const result = await res.json();
                if(result.status === 'success') {
                    await refreshData();
                } else {
                    alert('Gagal menghapus: ' + result.message);
                }
            } catch(err) {
                console.error(err);
                alert('Terjadi kesalahan');
            }
        }

        function printStrukEkstra(item) {
            const CMD = {
                INIT: [0x1B, 0x40],
                ALIGN_LEFT: [0x1B, 0x61, 0x00],
                ALIGN_CENTER: [0x1B, 0x61, 0x01],
                ALIGN_RIGHT: [0x1B, 0x61, 0x02],
                BOLD_ON: [0x1B, 0x45, 0x01],
                BOLD_OFF: [0x1B, 0x45, 0x00],
                TEXT_NORMAL: [0x1D, 0x21, 0x00],
                TEXT_DOUBLE_HW: [0x1D, 0x21, 0x11],
                INVERSE_ON: [0x1D, 0x42, 0x01],
                INVERSE_OFF: [0x1D, 0x42, 0x00],
                LF: [0x0A]
            };
    
            let bytes = [];
            
            function strToBytes(str) {
                let arr = [];
                for (let i = 0; i < str.length; i++) {
                    arr.push(str.charCodeAt(i));
                }
                return arr;
            }
    
            function add(cmd) { bytes.push(...cmd); }
            function addStr(str) { bytes.push(...strToBytes(str)); }
            function addLine(str) { addStr(str); add(CMD.LF); }
            function addTwoColumnsLeftRight(leftStr, rightStr, extraSpacing = false) {
                if(!rightStr) rightStr = "";
                let spaces = 32 - leftStr.length - String(rightStr).length;
                if(spaces < 0) spaces = 0;
                addLine(leftStr + " ".repeat(spaces) + rightStr);
                if(extraSpacing) add(CMD.LF);
            }

            // Start Document
            add(CMD.INIT);
            add(CMD.ALIGN_CENTER);
            add(CMD.BOLD_ON);
            addLine("AGEN DAMRI KAWUNGANTEN");
            add(CMD.BOLD_OFF);
            addLine("AGEN TIKET & TRAVEL");
            addLine("================================");
            
            add(CMD.ALIGN_LEFT);
            addTwoColumnsLeftRight("TGL/JAM", item.tanggalBerangkat + " " + item.jamBerangkat, true);
            addLine("--------------------------------");
            addTwoColumnsLeftRight("TIPE", item.tipe, true);
            addTwoColumnsLeftRight("VENDOR", item.vendor, true);
            
            add(CMD.ALIGN_CENTER);
            add(CMD.BOLD_ON);
            addLine(item.rute);
            add(CMD.BOLD_OFF);
            add(CMD.ALIGN_LEFT);
            addLine("--------------------------------");
            
            addTwoColumnsLeftRight("PEMESAN", parseEkstraHp(item), true);
            addLine("--------------------------------");
            
            const pnpList = parseEkstraPnp(item);
            pnpList.forEach((p, idx) => {
                addTwoColumnsLeftRight(`PNP ${idx+1}: ${p.nama}`, formatRupiah(p.harga), false);
            });
            addLine("--------------------------------");
            addTwoColumnsLeftRight("BIAYA ADMIN", formatRupiah(25000 * pnpList.length), true);
            
            let lineTot = "TOTAL BAYAR";
            let rightTot = " " + formatRupiah(item.totalHarga) + " ";
            let spacesTot = 32 - lineTot.length - rightTot.length;
            if(spacesTot < 0) spacesTot = 0;
            add(CMD.BOLD_ON);
            addStr(lineTot);
            addStr(" ".repeat(spacesTot));
            add(CMD.INVERSE_ON);
            addStr(rightTot);
            add(CMD.INVERSE_OFF);
            add(CMD.BOLD_OFF);
            add(CMD.LF);
            
            addTwoColumnsLeftRight("STATUS", item.statusPembayaran, false);
            addLine("================================");
            
            add(CMD.ALIGN_CENTER);
            addLine("Terima Kasih");
            addLine("Simpan struk ini sebagai bukti");
            addLine("pembayaran yang sah.");
            add(CMD.LF);
            addLine("082133607759");
            addLine("JL.Raya Kawunganten");
            addLine("(Depan Koramil Kawunganten)");
            addLine("Website : agendamrikawunganten.net");
            add(CMD.LF);
            add(CMD.LF);
            add(CMD.LF); 
    
            // Convert to binary string
            let binStr = "";
            for (let i = 0; i < bytes.length; i++) {
                binStr += String.fromCharCode(bytes[i]);
            }
            
            // Encode Base64 & call RawBT Intent
            const base64 = btoa(binStr);
            const intentUrl = "intent:base64," + base64 + "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;";
            window.location.href = intentUrl;
        }

    function promptRefresh() {
        const modal = document.getElementById('modalConfirmRefresh');
        const content = document.getElementById('modalConfirmRefreshContent');
        if(!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            content.classList.remove('scale-95');
        }, 10);
    }

    function closePromptRefresh() {
        const modal = document.getElementById('modalConfirmRefresh');
        const content = document.getElementById('modalConfirmRefreshContent');
        if(!modal) return;
        modal.classList.add('opacity-0');
        content.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300);
    }

    async function executeRefresh() {
        const btn = document.getElementById('btnExecuteRefresh');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SEGARKAN...'; 
        btn.disabled = true;
        
        try {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                }
            }
        } catch(e) { console.error(e); }
        
        // Force reload from server with cache busting
        window.location.href = window.location.href.split('?')[0] + '?_t=' + Date.now();
    }
    
    // Export globally
    window.promptRefresh = promptRefresh;
    window.closePromptRefresh = closePromptRefresh;
    window.executeRefresh = executeRefresh;

    // Export modals globally to ensure HTML onclick can access them
    if (typeof openETicket !== 'undefined') window.openETicket = openETicket;
    if (typeof closeETicket !== 'undefined') window.closeETicket = closeETicket;
    if (typeof openEticketModal !== 'undefined') window.openEticketModal = openEticketModal;
    if (typeof closeEticketModal !== 'undefined') window.closeEticketModal = closeEticketModal;
    
    if (typeof openEditBookingModal !== 'undefined') window.openEditBookingModal = openEditBookingModal;
    if (typeof closeEditBookingModal !== 'undefined') window.closeEditBookingModal = closeEditBookingModal;
    if (typeof submitEditBooking !== 'undefined') window.submitEditBooking = submitEditBooking;
    
    if (typeof openAddArmadaModal !== 'undefined') window.openAddArmadaModal = openAddArmadaModal;
    if (typeof closeAddArmadaModal !== 'undefined') window.closeAddArmadaModal = closeAddArmadaModal;
    if (typeof submitAddArmada !== 'undefined') window.submitAddArmada = submitAddArmada;
    if (typeof toggleAddArmadaNamaInput !== 'undefined') window.toggleAddArmadaNamaInput = toggleAddArmadaNamaInput;

    if (typeof openEditArmadaModal !== 'undefined') window.openEditArmadaModal = openEditArmadaModal;
    if (typeof closeEditArmadaModal !== 'undefined') window.closeEditArmadaModal = closeEditArmadaModal;
    if (typeof submitEditArmada !== 'undefined') window.submitEditArmada = submitEditArmada;

    if (typeof openHargaKhususModal !== 'undefined') window.openHargaKhususModal = openHargaKhususModal;
    if (typeof closeHargaKhususModal !== 'undefined') window.closeHargaKhususModal = closeHargaKhususModal;
    if (typeof toggleHkGroup !== 'undefined') window.toggleHkGroup = toggleHkGroup;
    if (typeof toggleEditBiayaTambahan !== 'undefined') window.toggleEditBiayaTambahan = toggleEditBiayaTambahan;
    
    if (typeof openAddEkstraModal !== 'undefined') window.openAddEkstraModal = openAddEkstraModal;
    if (typeof openEditEkstraModal !== 'undefined') window.openEditEkstraModal = openEditEkstraModal;
    if (typeof closeEkstraModal !== 'undefined') window.closeEkstraModal = closeEkstraModal;
    if (typeof submitEkstra !== 'undefined') window.submitEkstra = submitEkstra;
    if (typeof deleteEkstra !== 'undefined') window.deleteEkstra = deleteEkstra;

    if (typeof openAp3Modal !== 'undefined') window.openAp3Modal = openAp3Modal;
    if (typeof closeAp3Modal !== 'undefined') window.closeAp3Modal = closeAp3Modal;

    if (typeof submitAdminBooking !== 'undefined') window.submitAdminBooking = submitAdminBooking;
    if (typeof saveAdmin !== 'undefined') window.saveAdmin = saveAdmin;
    if (typeof editAdmin !== 'undefined') window.editAdmin = editAdmin;
    if (typeof deleteAdmin !== 'undefined') window.deleteAdmin = deleteAdmin;
    if (typeof openDeleteAdminModal !== 'undefined') window.openDeleteAdminModal = openDeleteAdminModal;

// Autocomplete logic for Pelanggan
let searchTimeout;
async function searchPelanggan(query, formType, targetField) {
    const dropdownId = formType === 'booking' ? 
        (targetField === 'nama' ? 'autocompleteNamaBooking' : 'autocompleteHpBooking') : 
        (targetField === 'nama' ? 'autocompleteNamaEkstra' : 'autocompleteHpEkstra');
    const dropdown = document.getElementById(dropdownId);
    
    if (!dropdown) return;
    
    if (!query || query.length < 2) {
        dropdown.classList.add('hidden');
        return;
    }
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        try {
            const res = await fetch('/api?action=cariPelanggan&q=' + encodeURIComponent(query), { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') } });
            const data = await res.json();
            
            if (data.status === 'success' && data.data.length > 0) {
                dropdown.innerHTML = '';
                data.data.forEach(p => {
                    const div = document.createElement('div');
                    div.className = 'p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors flex justify-between items-center';
                    const badgeAlamat = (p.alamat && p.alamat !== '-' && p.alamat !== 'null') ? `<div class="text-[10px] text-blue-600 font-semibold mt-0.5 truncate max-w-[150px]"><i class="fas fa-map-marker-alt"></i> ${p.alamat}</div>` : '';
                    div.innerHTML = `
                        <div>
                            <div class="font-bold text-sm text-slate-800">${p.nama}</div>
                            <div class="text-xs text-slate-500">${p.nomorHp}</div>
                            ${badgeAlamat}
                        </div>
                        <div class="text-[10px] bg-slate-100 px-2 py-1 rounded font-bold text-slate-400">
                            ${p.totalBooking} Booking
                        </div>
                    `;
                    div.onclick = () => {
                        if (formType === 'booking') {
                            document.getElementById('adminBookingNama').value = p.nama;
                            document.getElementById('adminBookingHp').value = p.nomorHp;
                            document.getElementById('adminBookingAlamat').value = (p.alamat && p.alamat !== '-' && p.alamat !== 'null') ? p.alamat : '';
                            document.getElementById('autocompleteNamaBooking').classList.add('hidden');
                            document.getElementById('autocompleteHpBooking').classList.add('hidden');
                        } else {
                            const n = document.getElementById('ekstraNama'); if(n) n.value = p.nama;
                            const h = document.getElementById('ekstraHp'); if(h) h.value = p.nomorHp;
                            const dn = document.getElementById('autocompleteNamaEkstra'); if(dn) dn.classList.add('hidden');
                            const dh = document.getElementById('autocompleteHpEkstra'); if(dh) dh.classList.add('hidden');
                        }
                    };
                    dropdown.appendChild(div);
                });
                dropdown.classList.remove('hidden');
            } else {
                dropdown.innerHTML = '<div class="p-3 text-xs text-slate-400 text-center font-bold">Tidak ada data ditemukan</div>';
                dropdown.classList.remove('hidden');
            }
        } catch (e) {
            console.error('Error searching pelanggan:', e);
        }
    }, 300);
}

// Hide dropdowns when clicking outside
document.addEventListener('click', (e) => {
    const ids = ['autocompleteNamaBooking', 'autocompleteHpBooking', 'autocompleteNamaEkstra', 'autocompleteHpEkstra'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.contains(e.target) && !e.target.id.includes('Nama') && !e.target.id.includes('Hp')) {
            el.classList.add('hidden');
        }
    });
});


// ==========================================
// DATA PELANGGAN LOGIC
// ==========================================
let pelangganData = [];
let currentPagePelanggan = 1;
const itemsPerPagePelanggan = 25;

async function renderPelanggan(resetPage = false) {
    if (resetPage) currentPagePelanggan = 1;
    const search = document.getElementById('pelangganSearch').value;
    
    try {
        const res = await fetch(`/api?action=getPelangganTable&search=${encodeURIComponent(search)}&page=${currentPagePelanggan}&limit=${itemsPerPagePelanggan}`);
        const data = await res.json();
        
        const tbody = document.getElementById('pelangganTableBody');
        tbody.innerHTML = '';
        
        if (data.status === 'success' && data.data.length > 0) {
            data.data.forEach(p => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-slate-50 hover:bg-slate-50/50 transition-colors group';
                tr.innerHTML = `
                    <td class="p-4">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs shrink-0">${p.nama.charAt(0).toUpperCase()}</div>
                            <span class="font-bold text-slate-700 text-sm">${p.nama}</span>
                        </div>
                    </td>
                    <td class="p-4">
                        <span class="font-semibold text-slate-600 text-sm"><i class="fab fa-whatsapp text-emerald-500 mr-2"></i>${p.nomorHp}</span>
                    </td>
                    <td class="p-4">
                        <span class="font-semibold text-slate-500 text-sm truncate max-w-[150px] inline-block" title="${p.alamat || '-'}">${p.alamat || '-'}</span>
                    </td>
                    <td class="p-4 text-center">
                        <span class="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-black">${p.totalBooking} Order</span>
                    </td>
                    <td class="p-4 text-center">
                        <span class="text-xs font-semibold text-slate-500">${new Date(p.createdAt).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}</span>
                    </td>
                    <td class="p-4 text-center">
                        <div class="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="openEditPelangganModal('${p.nomorHp}', '${p.nama.replace(/'/g, "\\'")}', '${(p.alamat || "").replace(/'/g, "\\'")}')" class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-colors" title="Edit Nama">
                                <i class="fas fa-edit text-sm"></i>
                            </button>
                            <button onclick="deletePelanggan('${p.nomorHp}')" class="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors" title="Hapus Pelanggan">
                                <i class="fas fa-trash text-sm"></i>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            
            document.getElementById('pelangganPageInfo').textContent = `Halaman ${data.page} dari ${data.totalPages}`;
            document.getElementById('btnPrevPelanggan').disabled = data.page <= 1;
            document.getElementById('btnNextPelanggan').disabled = data.page >= data.totalPages;
            
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-400 font-bold text-sm">Tidak ada data pelanggan.</td></tr>';
            document.getElementById('pelangganPageInfo').textContent = 'Halaman 1 dari 1';
            document.getElementById('btnPrevPelanggan').disabled = true;
            document.getElementById('btnNextPelanggan').disabled = true;
        }
    } catch (err) {
        console.error('Error load pelanggan:', err);
    }
}

function changePagePelanggan(delta) {
    currentPagePelanggan += delta;
    renderPelanggan();
}

function openEditPelangganModal(hp, nama, alamat) {
    document.getElementById('editPelangganHpOld').value = hp;
    document.getElementById('editPelangganHp').value = hp;
    document.getElementById('editPelangganNama').value = nama;
    document.getElementById('editPelangganAlamat').value = alamat && alamat !== '-' && alamat !== 'null' ? alamat : '';
    const modal = document.getElementById('modalEditPelanggan');
    const content = document.getElementById('modalEditPelangganContent');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    }, 10);
}

function closeEditPelangganModal() {
    const modal = document.getElementById('modalEditPelanggan');
    const content = document.getElementById('modalEditPelangganContent');
    modal.classList.add('opacity-0');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
}

async function submitEditPelanggan() {
    const hp = document.getElementById('editPelangganHpOld').value;
    const newNama = document.getElementById('editPelangganNama').value.trim();
    const newAlamat = document.getElementById('editPelangganAlamat').value.trim();
    if (!newNama) return Swal.fire({ icon: 'error', title: 'Oops...', text: 'Nama tidak boleh kosong' });
    
    try {
        const res = await fetch('/api', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            },
            body: JSON.stringify({ action: 'editPelanggan', payload: { nomorHp: hp, namaBaru: newNama, alamatBaru: newAlamat } })
        });
        const data = await res.json();
        if (data.status === 'success') {
            closeEditPelangganModal();
            renderPelanggan();
            Swal.fire({
                icon: 'success',
                title: 'Berhasil',
                text: 'Data pelanggan telah diperbarui!',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            Swal.fire({ icon: 'error', title: 'Gagal', text: data.message });
        }
    } catch (err) {
        console.error(err);
        Swal.fire({ icon: 'error', title: 'Kesalahan Server', text: 'Gagal menyambung ke server' });
    }
}

function deletePelanggan(hp) {
    Swal.fire({
        title: 'Hapus Pelanggan?',
        text: 'Riwayat pesanan orang ini TIDAK akan terhapus.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const res = await fetch('/api', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
                    },
                    body: JSON.stringify({ action: 'deletePelanggan', payload: { nomorHp: hp } })
                });
                const data = await res.json();
                if (data.status === 'success') {
                    renderPelanggan();
                    Swal.fire({
                        icon: 'success',
                        title: 'Terhapus!',
                        text: 'Pelanggan berhasil dihapus dari kontak.',
                        timer: 2000,
                        showConfirmButton: false
                    });
                } else {
                    Swal.fire({ icon: 'error', title: 'Gagal', text: data.message });
                }
            } catch(err) {
                console.error(err);
                Swal.fire({ icon: 'error', title: 'Kesalahan Server', text: 'Gagal menyambung ke server' });
            }
        }
    });
}

function exportPelangganCSV() {
    window.location.href = `/api/export-pelanggan?token=${localStorage.getItem('adminToken')}`;
}

// Ensure renderPelanggan is called when menu switches to pelanggan
const oldSwitchMenu = switchMenu;
window.switchMenu = function(menuId) {
    oldSwitchMenu(menuId);
    if (menuId === 'pelanggan') {
        renderPelanggan(true);
    }
};

