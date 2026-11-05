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
    let currentPesananSubtab = 'tiket';
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
        if (typeof populateTipeArmadaDropdowns === 'function') populateTipeArmadaDropdowns();
        
        // Populate static dropdowns globally
        const armadas = getArmadas();
        const activeArmadas = armadas.filter(a => a.isActive !== false);
        const armadaNameSelect = document.getElementById('adminBookingArmadaName');
        if (armadaNameSelect) {
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
            const getRank = (name) => {
                const up = String(name || '').trim().toUpperCase();
                const idx = POPULAR_RANKS.findIndex(p => up === p || up.includes(p) || p.includes(up));
                return idx === -1 ? 999 : idx;
            };

            const uniqueNames = [...new Set(activeArmadas.map(a => a.name))].sort((a, b) => {
                const bookings = typeof getBookings === 'function' ? getBookings() : [];
                const countA = bookings.filter(bk => String(bk.jenisKendaraan || '').trim().toUpperCase() === a.trim().toUpperCase()).length;
                const countB = bookings.filter(bk => String(bk.jenisKendaraan || '').trim().toUpperCase() === b.trim().toUpperCase()).length;
                if (countB !== countA) return countB - countA;

                const rankDiff = getRank(a) - getRank(b);
                if (rankDiff !== 0) return rankDiff;

                return a.localeCompare(b);
            });
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
        if (menu === 'pelanggan') {
            menu = 'pesanan';
            currentPesananSubtab = 'pelanggan';
        }
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
        else if (currentMenu === 'pesanan') {
            if (currentPesananSubtab === 'pelanggan') {
                renderPelanggan();
            } else {
                renderPesanan();
            }
        }
        else if (currentMenu === 'armada') renderArmada();
        else if (currentMenu === 'ekstra') renderEkstra();
        else if (currentMenu === 'laporan') renderLaporan();
        else if (currentMenu === 'akun') renderAkun();
        else if (currentMenu === 'iklan') renderIklan();
    }

    // ========================================
    // DASHBOARD (DENGAN KONTROL PRIVASI NOMINAL)
    // ========================================
    let rawTotalPendapatan = 0;
    let rawTotalOmset = 0;
    let isPendapatanVisible = localStorage.getItem('show_dashboard_pendapatan') === 'true';
    let isOmsetVisibility = localStorage.getItem('show_dashboard_omset') === 'true';

    function updateDashboardPendapatanDisplay() {
        const el = document.getElementById('cardTotalPendapatan');
        const eye = document.getElementById('eyeIconPendapatan');
        const btn = document.getElementById('btnEyePendapatan');
        if (!el) return;

        if (isPendapatanVisible) {
            el.textContent = formatRupiah(rawTotalPendapatan);
            el.classList.remove('tracking-widest', 'text-slate-400');
            if (eye) eye.className = 'fas fa-eye text-amber-400';
            if (btn) btn.title = 'Sembunyikan Total Pendapatan';
        } else {
            el.textContent = 'Rp ••••••••';
            el.classList.add('tracking-widest', 'text-slate-400');
            if (eye) eye.className = 'fas fa-eye-slash text-slate-400';
            if (btn) btn.title = 'Tampilkan Total Pendapatan';
        }
    }

    function updateDashboardOmsetDisplay() {
        const el = document.getElementById('cardTotalOmset');
        const eye = document.getElementById('eyeIconOmset');
        const btn = document.getElementById('btnEyeOmset');
        if (!el) return;

        if (isOmsetVisibility) {
            el.textContent = formatRupiah(rawTotalOmset);
            el.classList.remove('tracking-widest');
            if (eye) eye.className = 'fas fa-eye text-amber-400';
            if (btn) btn.title = 'Sembunyikan Total Omset';
        } else {
            el.textContent = 'Rp ••••••••';
            el.classList.add('tracking-widest');
            if (eye) eye.className = 'fas fa-eye-slash text-slate-400';
            if (btn) btn.title = 'Tampilkan Total Omset';
        }
    }

    function toggleDashboardNominal(type) {
        if (type === 'pendapatan') {
            isPendapatanVisible = !isPendapatanVisible;
            localStorage.setItem('show_dashboard_pendapatan', isPendapatanVisible ? 'true' : 'false');
            updateDashboardPendapatanDisplay();
        } else if (type === 'omset') {
            isOmsetVisibility = !isOmsetVisibility;
            localStorage.setItem('show_dashboard_omset', isOmsetVisibility ? 'true' : 'false');
            updateDashboardOmsetDisplay();
        }
    }
    window.toggleDashboardNominal = toggleDashboardNominal;

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
        rawTotalOmset = totalOmsetBus + totalOmsetEkstra;
        updateDashboardOmsetDisplay();

        // Card 4 is removed (was Setoran Hari Ini, but dashboard only has Total Setoran now)
        // const setoranToday = todayData.reduce((s, l) => s + l.totalHarga, 0) - todayData.reduce((s, l) => s + l.totalKomisi, 0);

        // Card 5: Total Setoran (today + future) (no ekstra)
        const totalSetoran = futureData.reduce((s, l) => s + l.totalHarga, 0) - futureData.reduce((s, l) => s + l.totalKomisi, 0);
        document.getElementById('cardTotalSetoran').textContent = formatRupiah(totalSetoran);

        // Card 7: Total Pendapatan (period)
        const totalPendapatanBus = periodData.reduce((s, l) => s + l.totalKomisi, 0);
        const totalPendapatanEkstra = ekstraPeriod.reduce((s, e) => s + e.komisi, 0);
        rawTotalPendapatan = totalPendapatanBus + totalPendapatanEkstra;
        updateDashboardPendapatanDisplay();

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

    // Helper to render seat number badges with rounded/circular styling
    function renderKursiBadges(kursiStr) {
        if (!kursiStr || kursiStr === '-' || kursiStr === 'null' || kursiStr === 'undefined') {
            return '<span class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[9px] font-bold border border-slate-200">No Seat</span>';
        }
        const cleanStr = String(kursiStr).replace(/^kursi\s*:?\s*/i, '').trim();
        if (!cleanStr || cleanStr === '-') {
            return '<span class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[9px] font-bold border border-slate-200">No Seat</span>';
        }
        const seats = cleanStr.split(/[,;\s]+/).filter(Boolean);
        if (seats.length === 0) {
            return '<span class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[9px] font-bold border border-slate-200">No Seat</span>';
        }
        return seats.map(s => `
            <span class="inline-flex items-center justify-center min-w-[20px] h-[20px] sm:min-w-[22px] sm:h-[22px] px-1 sm:px-1.5 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] sm:text-[10px] shadow-2xs border border-amber-400 leading-none shrink-0" title="Nomor Kursi ${s}">
                ${s}
            </span>
        `).join(' ');
    }

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
        const todayPendapatan = todayOmset - todaySetoran;
        
        const elPnp = document.getElementById('manifestTotalPnpToday');
        const elArmada = document.getElementById('manifestTotalArmada');
        const elPendapatan = document.getElementById('manifestPendapatanToday');
        const elSetoran = document.getElementById('manifestSetoranToday');
        const labelEl = document.getElementById('todayDateLabel');
        
        if (elPnp) elPnp.textContent = todayPnp + ' Orang';
        if (elArmada) elArmada.textContent = todayArmadaSet.size + ' Armada';
        if (elPendapatan) elPendapatan.textContent = formatRupiah(todayPendapatan);
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

            // Header Row (Clickable, Mobile Optimized)
            html += `
                <tr class="cursor-pointer group" onclick="toggleManifest('${safeId}')">
                    <td class="p-1 sm:p-3 border-b-3 sm:border-b-6 border-transparent">
                        <div class="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 text-slate-800 shadow-md sm:shadow-xl shadow-slate-200/50 border-2 border-amber-400 transition-all group-hover:-translate-y-0.5 sm:group-hover:-translate-y-1 group-hover:shadow-lg sm:group-hover:shadow-2xl group-hover:shadow-amber-200/50 flex items-center justify-between gap-2.5 sm:gap-4">
                            <!-- Left: Date info -->
                            <div class="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
                                <div class="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-white shadow-sm shrink-0">
                                    <i class="fas fa-calendar-alt text-sm sm:text-xl"></i>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <p class="text-[8px] sm:text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none mb-0.5 sm:mb-1">Keberangkatan</p>
                                    <p class="font-black text-xs sm:text-base text-slate-900 uppercase truncate">${formattedDate}</p>
                                </div>
                            </div>
                            <!-- Right: Total PNP & Arrow -->
                            <div class="flex items-center gap-2 sm:gap-3 shrink-0">
                                <div class="text-right">
                                    <p class="font-black text-sm sm:text-xl text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-amber-600 leading-tight">${totalPnp} PNP</p>
                                    <p class="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">${g.bookings.length} Pesanan</p>
                                </div>
                                <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors shrink-0">
                                    <i class="fas fa-chevron-down text-[10px] sm:text-xs transition-transform duration-300" id="icon-${safeId}" style="transform: ${iconTransform}"></i>
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
                                    <div onclick="openBookingDetailModal('${bId}')" class="group flex flex-col justify-center p-2.5 sm:p-3 border-b border-slate-100 last:border-0 hover:bg-blue-50/70 active:bg-blue-100/60 cursor-pointer transition-all w-full overflow-hidden select-none" title="Klik untuk lihat Detail Data Pesanan">
                                        <!-- Baris 1: Kode Booking & Rute (Kiri) | Status Pembayaran (Kanan) -->
                                        <div class="flex items-center justify-between gap-2">
                                            <div class="flex items-center gap-1.5 min-w-0 flex-1">
                                                <span class="text-[10px] sm:text-[11px] font-black text-blue-600 uppercase tracking-wider truncate">${bId} • ${bTujuan}</span>
                                            </div>
                                            <div class="flex items-center gap-1.5 shrink-0">
                                                <span class="inline-block px-2 sm:px-2.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider shadow-xs ${badgeClass}">${badgeText}</span>
                                                <div class="w-5 h-5 rounded-full bg-slate-100 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center text-slate-400 transition-all shadow-2xs">
                                                    <i class="fas fa-chevron-right text-[8px] transform group-hover:translate-x-0.5 transition-transform"></i>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Baris 2: Nama Penumpang (Kiri) | Jumlah PNP & No Kursi (Kanan, tepat dibawah status pembayaran) -->
                                        <div class="flex items-center justify-between gap-2 mt-1">
                                            <div class="min-w-0 flex-1 pr-2">
                                                <span class="font-black text-xs sm:text-sm text-slate-800 uppercase tracking-tight truncate block group-hover:text-blue-700 transition-colors">${bName}</span>
                                            </div>
                                            <div class="flex items-center gap-1.5 sm:gap-2 shrink-0 justify-end">
                                                <span class="text-[10px] sm:text-[11px] font-bold text-slate-500 whitespace-nowrap flex items-center gap-1">
                                                    <i class="fas fa-users text-slate-400 text-[9px]"></i> ${bQty} PNP
                                                </span>
                                                <div class="flex items-center gap-1 flex-wrap justify-end">
                                                    ${renderKursiBadges(bKursi)}
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Keterangan & Warning jika ada -->
                                        ${(ket || warningHtml) ? `
                                            <div class="mt-1 pt-1 border-t border-slate-100/70 flex items-center gap-2 flex-wrap">
                                                ${ket ? `<span class="text-[9px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 max-w-full truncate inline-block"><i class="fas fa-info-circle mr-1"></i>${ket}</span>` : ''}
                                                ${warningHtml ? warningHtml : ''}
                                            </div>
                                        ` : ''}
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
    // BOOKING DETAIL MODAL & ON-CLICK ACTIONS
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
        const badgeClass = isPaid ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-amber-100 text-amber-700 border border-amber-300';
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

        const bTicketId = b.bookingId || b.id || id;
        const bAlamat = b.alamat || b['ALAMAT'] || b['Alamat'] || b.titikKumpul || b['TITIK KUMPUL'] || '-';
        const bKursi = b.kursi || '-';
        const bQty = b.qty || b['JUMLAH PNP'] || 1;

        const formatHp = String(b.hp || b['NOMOR HP'] || "").replace(/[^0-9]/g, '').replace(/^0/, '62');
        const waMsgText = `Halo Sdr/i *${b.name || 'Penumpang'}*,\n\nBerikut rincian tiket perjalanan Anda di *Agen DAMRI Kawunganten*:\n` +
            `🎫 *No Tiket:* ${bTicketId}\n` +
            `🚌 *Armada:* ${armadaName}\n` +
            `📍 *Tujuan:* ${tujuan}\n` +
            `📅 *Tanggal:* ${b.dateTravel || '-'}\n` +
            `⏰ *Jam:* ${b.waktu || '-'}\n` +
            `👥 *Penumpang:* ${bQty} Orang\n` +
            `🪑 *Kursi:* ${bKursi}\n` +
            `💰 *Total:* ${formatRupiah(total)}\n` +
            `📌 *Status:* ${badgeText}\n\n` +
            `Terima kasih telah menggunakan layanan kami.`;
        const waLink = `https://wa.me/${formatHp}?text=${encodeURIComponent(waMsgText)}`;
        
        let biayaTambahanHtml = '';
        if (nominalBiayaTambahan > 0) {
            biayaTambahanHtml = `
                <div class="col-span-2 bg-amber-50 p-3 rounded-xl border border-amber-200 mt-1">
                    <p class="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Biaya Tambahan</p>
                    <p class="font-bold text-amber-800 text-xs">${formatRupiah(nominalBiayaTambahan)} <span class="font-normal text-amber-600">(${ketTambahan})</span></p>
                </div>
            `;
        }

        content.innerHTML = `
            <div class="flex flex-col gap-2.5 sm:gap-3">
                <!-- Boarding Ticket Header Card -->
                <div class="bg-gradient-to-r from-blue-50 to-indigo-50/70 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-blue-100/90 flex items-center justify-between gap-2 shadow-xs">
                    <div class="min-w-0 flex-1">
                        <p class="text-[9px] font-black text-blue-500 uppercase tracking-widest leading-none mb-1">KODE BOOKING / TIKET</p>
                        <p class="font-black text-blue-900 text-base sm:text-xl tracking-tight leading-none truncate">${bTicketId}</p>
                    </div>
                    <span class="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider shrink-0 ${badgeClass}">${badgeText}</span>
                </div>

                <!-- 2-Column Grid Info -->
                <div class="grid grid-cols-2 gap-2 sm:gap-3 text-xs">
                    <!-- Nama Penumpang -->
                    <div class="col-span-2 sm:col-span-1 bg-slate-50/80 p-2.5 sm:p-3 rounded-xl border border-slate-100">
                        <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Nama Penumpang</p>
                        <p class="font-bold text-slate-800 uppercase text-xs sm:text-sm truncate">${b.name || '-'}</p>
                    </div>

                    <!-- Nomor HP -->
                    <div class="col-span-2 sm:col-span-1 bg-slate-50/80 p-2.5 sm:p-3 rounded-xl border border-slate-100">
                        <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Nomor HP</p>
                        <div class="flex items-center justify-between gap-2">
                            <span class="font-bold text-slate-800 text-xs sm:text-sm truncate">${b.hp || '-'}</span>
                            ${formatHp ? `<a href="${waLink}" target="_blank" class="text-emerald-700 bg-emerald-100/80 hover:bg-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-colors shrink-0" title="Chat WA Langsung"><i class="fab fa-whatsapp"></i> Chat</a>` : ''}
                        </div>
                    </div>

                    <!-- Alamat / Titik Jemput -->
                    <div class="col-span-2 bg-slate-50/80 p-2.5 sm:p-3 rounded-xl border border-slate-100">
                        <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Alamat / Titik Jemput</p>
                        <p class="font-bold text-slate-700 text-xs sm:text-sm leading-snug">${bAlamat}</p>
                    </div>

                    <!-- Armada & Tujuan -->
                    <div class="col-span-2 bg-slate-50/80 p-2.5 sm:p-3 rounded-xl border border-slate-100">
                        <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Armada & Rute Tujuan</p>
                        <p class="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
                            <span>${armadaName}</span>
                            <i class="fas fa-arrow-right text-[9px] text-blue-500"></i>
                            <span class="text-blue-600 font-extrabold uppercase">${tujuan}</span>
                        </p>
                    </div>

                    <!-- Tanggal & Jam -->
                    <div class="col-span-1 bg-slate-50/80 p-2.5 sm:p-3 rounded-xl border border-slate-100">
                        <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Jadwal Berangkat</p>
                        <p class="font-bold text-slate-800 text-xs sm:text-sm truncate">${b.dateTravel || '-'}</p>
                        <p class="text-blue-600 font-black text-xs mt-0.5">${b.waktu || '-'}</p>
                    </div>

                    <!-- Kursi & Penumpang -->
                    <div class="col-span-1 bg-slate-50/80 p-2.5 sm:p-3 rounded-xl border border-slate-100">
                        <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Kursi / PNP</p>
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="text-xs font-bold text-slate-500">Kursi:</span>
                            <div class="flex items-center gap-1 flex-wrap">
                                ${renderKursiBadges(bKursi)}
                            </div>
                        </div>
                        <p class="text-slate-600 font-bold text-[11px] mt-1"><i class="fas fa-users text-slate-400 text-[10px] mr-1"></i>${bQty} Orang</p>
                    </div>

                    <!-- Total Bayar -->
                    <div class="col-span-1 bg-amber-50/70 p-2.5 sm:p-3 rounded-xl border border-amber-200/80">
                        <p class="text-[9px] font-bold text-amber-600 uppercase tracking-widest mb-0.5">Total Bayar</p>
                        <p class="font-black text-orange-600 text-xs sm:text-base">${formatRupiah(total)}</p>
                    </div>

                    <!-- Metode Bayar -->
                    <div class="col-span-1 bg-slate-50/80 p-2.5 sm:p-3 rounded-xl border border-slate-100">
                        <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Metode Bayar</p>
                        <p class="font-bold text-slate-800 text-xs sm:text-sm uppercase truncate">${b.pembayaran || '-'}</p>
                    </div>

                    <!-- Keterangan jika ada -->
                    ${rawKet !== '-' ? `
                    <div class="col-span-2 bg-slate-50/80 p-2.5 sm:p-3 rounded-xl border border-slate-100">
                        <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Keterangan</p>
                        <p class="font-bold text-slate-600 text-xs leading-snug">${rawKet}</p>
                    </div>` : ''}

                    ${biayaTambahanHtml}
                </div>
            </div>
        `;

        actions.innerHTML = `
            <div class="w-full flex flex-col gap-2.5">
                <div class="grid grid-cols-2 gap-2.5 w-full">
                    <!-- 1. E-TICKET -->
                    <button type="button" onclick="closeBookingDetailModal(); openETicket('${bTicketId}')" class="flex items-center justify-center gap-2 py-3 px-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl shadow-xs transition-all text-center min-h-[44px] select-none font-black text-xs uppercase tracking-wider">
                        <i class="fas fa-ticket-alt text-base text-indigo-200"></i>
                        <span>E-Ticket</span>
                    </button>

                    <!-- 2. EDIT -->
                    <button type="button" onclick="closeBookingDetailModal(); openEditBookingModal('${bTicketId}')" class="flex items-center justify-center gap-2 py-3 px-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-900 rounded-xl shadow-xs transition-all text-center min-h-[44px] select-none font-black text-xs uppercase tracking-wider">
                        <i class="fas fa-edit text-base text-amber-900"></i>
                        <span>Edit Pesanan</span>
                    </button>
                </div>

                <div class="flex justify-between items-center pt-2 border-t border-slate-200/70">
                    <button type="button" onclick="closeBookingDetailModal(); openDeleteModal('${bTicketId}')" class="text-red-500 hover:text-red-700 hover:bg-red-50 active:bg-red-100 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5">
                        <i class="fas fa-trash text-xs"></i> <span>Hapus</span>
                    </button>
                    <button type="button" onclick="closeBookingDetailModal()" class="bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors">
                        Tutup
                    </button>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            inner.classList.remove('scale-95', 'opacity-0');
            inner.classList.add('scale-100', 'opacity-100');
        }, 10);
    };

    window.closeBookingDetailModal = function() {
        const modal = document.getElementById('bookingDetailModal');
        const inner = document.getElementById('bookingDetailModalInner');
        if (!modal || !inner) return;
        inner.classList.remove('scale-100', 'opacity-100');
        inner.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300);
    };

    // Toggle Payment Status directly from Detail Pesanan
    window.toggleBookingPaymentStatus = async function(id) {
        const allBookings = getBookings();
        const b = allBookings.find(x => String(x.bookingId) === String(id) || String(x.id) === String(id));
        if (!b) {
            alert("Data pesanan tidak ditemukan.");
            return;
        }

        const isPaid = (b.status === 'paid' || String(b.status).toUpperCase() === 'LUNAS' || String(b.status).toUpperCase() === 'ACC');
        const newStatus = isPaid ? 'BELUM LUNAS' : 'LUNAS';

        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                title: isPaid ? 'Ubah ke Belum Lunas?' : 'Tandai Sebagai Lunas?',
                text: `Pesanan ${b.bookingId || b.id} (${b.name}) akan diubah statusnya menjadi ${newStatus}.`,
                icon: isPaid ? 'warning' : 'question',
                showCancelButton: true,
                confirmButtonColor: isPaid ? '#d97706' : '#10b981',
                cancelButtonColor: '#64748b',
                confirmButtonText: isPaid ? 'Ya, Jadikan Belum Lunas' : 'Ya, Tandai Lunas',
                cancelButtonText: 'Batal'
            });
            if (!result.isConfirmed) return;
        } else {
            if (!confirm(`Ubah status pembayaran pesanan ${b.bookingId || b.id} menjadi ${newStatus}?`)) return;
        }

        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.remove('hidden');

        try {
            const payload = { 
                id_tiket: b.bookingId || b.id, 
                status: newStatus, 
                pembayaran: newStatus 
            };
            const res = await postToSheets('updateStatus', payload);

            if (res && res.status === "success") {
                const bIndex = cachedBookings.findIndex(x => String(x.bookingId) === String(b.bookingId || b.id) || String(x.id) === String(b.bookingId || b.id));
                if (bIndex !== -1) {
                    cachedBookings[bIndex].status = (newStatus === 'LUNAS' ? 'paid' : 'BELUM LUNAS');
                    cachedBookings[bIndex].pembayaran = newStatus;
                    localStorage.setItem("app_bookings", JSON.stringify(cachedBookings));
                }
                if (typeof showMessage === 'function') {
                    showMessage(`Status berhasil diubah menjadi ${newStatus}!`);
                }
                
                // Refresh modal if open
                const detailModal = document.getElementById('bookingDetailModal');
                if (detailModal && !detailModal.classList.contains('hidden')) {
                    openBookingDetailModal(b.bookingId || b.id);
                }
                
                // Re-render views
                if (typeof renderTodayTable === 'function') renderTodayTable();
                if (typeof renderPesanan === 'function') renderPesanan();
                if (typeof updateNotifications === 'function') updateNotifications();
            } else {
                alert('Gagal update status: ' + (res ? res.message : 'Unknown error'));
            }
        } catch (e) {
            console.error(e);
            alert('Terjadi kesalahan koneksi saat update status.');
        } finally {
            if (overlay) overlay.classList.add('hidden');
        }
    };


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
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-sm text-slate-400 font-bold py-8 italic uppercase tracking-widest">Belum ada data armada</td></tr>';
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

            const rutes = groups[key];
            const firstA = rutes[0] || {};
            const poTipe = firstA.tipeArmada || 'Bus Besar';
            const poDenah = firstA.denahId && typeof getDenah === 'function' ? getDenah(firstA.denahId) : null;
            const poSeat = poDenah?.totalKursi || firstA.capacity || 40;
            const poProf = typeof getPoProfile === 'function' ? getPoProfile(key) : null;
            const poImg = poProf?.image || 'damri.webp';
            const poTagline = poProf?.tagline ? `<span class="hidden md:inline-block text-[10px] font-bold text-slate-500 italic bg-white/80 px-2 py-0.5 rounded-md border border-slate-200">${poProf.tagline}</span>` : '';

            html += `
                <tr class="cursor-pointer bg-blue-50/80 hover:bg-blue-100/90 transition-colors border-b border-blue-200" onclick="toggleArmada('${index}')">
                    <td colspan="5" class="px-3 sm:px-4 py-3">
                        <div class="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                            <div class="flex items-center gap-2.5 flex-wrap">
                                <img src="${poImg}" alt="${key}" class="w-9 h-9 rounded-xl object-cover border border-amber-300 shadow-2xs shrink-0" onerror="this.src='damri.webp'">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="font-black text-sm sm:text-base text-blue-900 uppercase">${key}</span>
                                    <span class="text-[10px] font-extrabold text-amber-800 bg-amber-100/80 border border-amber-300 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-2xs">
                                        <i class="fas fa-shuttle-van text-[9px] text-amber-600"></i> ${poTipe} • ${poSeat} Kursi
                                    </span>
                                    <span class="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md">${rutes.length} Rute</span>
                                    ${poTagline}
                                </div>
                            </div>
                            <div class="flex items-center gap-2 shrink-0">
                                <button type="button" onclick="event.stopPropagation(); openEditPoModal('${key}')" class="px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-900 text-[10px] font-black rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95" title="Kelola informasi PO, foto armada & tipe bus ${key}">
                                    <i class="fas fa-sliders-h"></i> Kelola Info & Foto PO
                                </button>
                                <i class="fas fa-chevron-down text-blue-600 text-xs transition-transform duration-300 ml-1" id="icon-armada-${index}" style="transform: ${iconRotate};"></i>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
            groups[key].forEach(a => {
                html += `
                    <tr class="armada-group-${index} ${hiddenClass} hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                        <td class="pl-8"><span class="font-black text-[10px] text-slate-400">${a.id}</span></td>
                        <td>
                            <div class="font-bold text-sm text-slate-800 uppercase">${a.name}</div>
                            <div class="flex items-center gap-1.5 mt-0.5">
                                <span class="text-[9px] bg-slate-100 text-slate-600 font-extrabold px-1.5 py-0.5 rounded">${a.tipeArmada || 'Bus Besar'}</span>
                                <span class="text-[9px] bg-amber-50 text-amber-700 font-extrabold px-1.5 py-0.5 rounded">${a.capacity} Kursi</span>
                            </div>
                        </td>
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

        const ruteFullText = asalText + ' ➁E' + tujuan;

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
        const row = document.createElement('div');
        row.id = 'ap3row-' + ap3RowCount;
        row.className = 'bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row gap-2 relative ap3-item-row';
        row.innerHTML = `
            <div class="absolute -top-2 -left-2 w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm z-10">${ap3RowCount}</div>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
                <div>
                    <label class="block md:hidden text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Dari</label>
                    <input type="text" class="ap3-dari w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500 font-bold text-slate-800" placeholder="Dari">
                </div>
                <div>
                    <label class="block md:hidden text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ke</label>
                    <input type="text" class="ap3-ke w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500 font-bold text-slate-800" placeholder="Ke">
                </div>
                <div>
                    <label class="block md:hidden text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Jumlah PNP</label>
                    <input type="number" class="ap3-pnp w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500 font-bold text-slate-800" placeholder="PNP" min="1">
                </div>
                <div>
                    <label class="block md:hidden text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tarif (Rp)</label>
                    <input type="number" class="ap3-tarif w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500 font-bold text-slate-800" placeholder="Tarif (Rp)" min="0">
                </div>
            </div>
            
            <button onclick="document.getElementById('ap3row-${ap3RowCount}').remove()" class="w-full md:w-10 h-10 md:h-auto shrink-0 flex items-center justify-center text-red-500 hover:text-white bg-red-50 hover:bg-red-500 rounded-lg transition-colors border border-red-100 hover:border-red-500 mt-2 md:mt-0">
                <i class="fas fa-trash"></i>
            </button>
        `;
        tbody.appendChild(row);
    }

    function calculateAp3() {
        const busCode = document.getElementById('ap3BusCode').value || '-';
        const crewName = document.getElementById('ap3Crew').value || '-';
        
        const rows = [];
        let totalPnp = 0;
        let totalJumlah = 0;
        
        document.querySelectorAll('#ap3Tbody .ap3-item-row').forEach(row => {
            const dari = row.querySelector('.ap3-dari').value || '';
            const ke = row.querySelector('.ap3-ke').value || '';
            const pnp = parseInt(row.querySelector('.ap3-pnp').value) || 0;
            const tarif = parseInt(row.querySelector('.ap3-tarif').value) || 0;
            
            if(dari || ke || pnp || tarif) {
                const jumlah = pnp * tarif;
                totalPnp += pnp;
                totalJumlah += jumlah;
                rows.push({ dari, ke, pnp, tarif, jumlah });
            }
        });

        if (rows.length === 0) {
            showMessage("Silakan isi minimal satu baris data penumpang.", true);
            return;
        }

        const komisi = Math.round(totalJumlah * 0.098);
        const pendapatanBersih = totalJumlah - komisi;
        
        const htmlContent = `
            <div class="text-left bg-slate-50 p-4 rounded-xl text-sm space-y-2 border border-slate-200">
                <div class="flex justify-between border-b border-slate-200 pb-2"><span class="font-bold text-slate-500">Bus Code:</span> <span class="font-black">${busCode}</span></div>
                <div class="flex justify-between border-b border-slate-200 pb-2"><span class="font-bold text-slate-500">Crew Name:</span> <span class="font-black">${crewName}</span></div>
                <div class="flex justify-between border-b border-slate-200 pb-2"><span class="font-bold text-slate-500">Total Penumpang:</span> <span class="font-black text-blue-600">${totalPnp} Orang</span></div>
                <div class="flex justify-between border-b border-slate-200 pb-2"><span class="font-bold text-slate-500">Pendapatan Angkutan:</span> <span class="font-black">${formatRupiah(totalJumlah)}</span></div>
                <div class="flex justify-between border-b border-slate-200 pb-2"><span class="font-bold text-slate-500">Komisi Agen (9,8%):</span> <span class="font-black text-red-500">- ${formatRupiah(komisi)}</span></div>
                <div class="flex justify-between pt-2 mt-2"><span class="font-black text-slate-700">Pendapatan Bersih (Disetorkan):</span> <span class="font-black text-green-600 text-lg">${formatRupiah(pendapatanBersih)}</span></div>
            </div>
        `;

        Swal.fire({
            title: 'Hasil Kalkulasi AP/3',
            html: htmlContent,
            icon: 'info',
            confirmButtonText: 'Tutup & Kembali',
            confirmButtonColor: '#f59e0b',
            customClass: {
                popup: 'rounded-3xl',
                title: 'text-xl font-black text-slate-800',
                htmlContainer: 'mx-0',
                container: 'z-[9999]'
            }
        });
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
        const prefillKursi = (b.kursi && b.kursi !== '-') ? b.kursi.split(',').map(s=>s.trim()).filter(Boolean) : [];
        editBookingSelectedSeats = new Set(prefillKursi);
        updateEditBookingSeatDisplay();
        const currentArmadaForEdit = b.armadaId ? getArmada(b.armadaId) : null;
        if (typeof loadEditBookingSeatMap === 'function') {
            loadEditBookingSeatMap(b.bookingId, currentArmadaForEdit, b.dateTravel, prefillKursi);
        }
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
        
        const kursiString = editBookingSelectedSeats.size > 0 ? [...editBookingSelectedSeats].join(', ') : '';

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
        try {
            const a = getArmada(id);
            if(!a) return;
            
            document.getElementById('editArmadaId').value = a.id;
            document.getElementById('editArmadaIdDisplay').innerText = a.id;
            document.getElementById('editArmadaNama').value = a.name;
            document.getElementById('editArmadaTujuan').value = a.destination;
            document.getElementById('editArmadaJam').value = a.time;
            document.getElementById('editArmadaHarga').value = a.price;
            document.getElementById('editArmadaSeat').value = a.capacity;
            if (document.getElementById('editArmadaTipe')) document.getElementById('editArmadaTipe').value = a.tipeArmada || 'Bus Besar';
            if (typeof populateDenahDropdown === 'function') populateDenahDropdown('editArmadaDenah', a.denahId, a.tipeArmada);

            const m = document.getElementById('modalEditArmada');
            const c = document.getElementById('modalEditArmadaContent');
            
            if (m) document.body.appendChild(m); // Safety append
            
            m.classList.remove('hidden');
            m.classList.add('flex');
            setTimeout(() => {
                if (c) {
                    c.classList.remove('scale-95', 'opacity-0');
                    c.classList.add('scale-100', 'opacity-100');
                }
            }, 10);
        } catch (e) {
            Swal.fire('Error openEdit', e.message, 'error');
        }
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
                m.classList.remove('flex');
                m.classList.add('hidden');
            }
        }, 300);
    }

    async function submitEditArmada(e) {
        e.preventDefault();
        const btn = document.getElementById('btnSubmitEditArmada');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENYIMPAN...'; btn.disabled = true;

        const tipeVal = document.getElementById('editArmadaTipe')?.value || 'Bus Besar';
        const denahVal = document.getElementById('editArmadaDenah')?.value || null;
        
        let calculatedSeat = 0;
        if (denahVal && typeof getDenah === 'function') {
            const dObj = getDenah(denahVal);
            if (dObj && dObj.totalKursi) calculatedSeat = dObj.totalKursi;
        }
        if (!calculatedSeat) {
            const defaultSeatsByType = { 'Hiace': 14, 'Bus Besar': 40, 'Long Elf': 19, 'Medium Bus': 31, 'Elf Short': 12, 'Innova / MPV': 7 };
            calculatedSeat = defaultSeatsByType[tipeVal] || 40;
        }

        const payload = {
            id_armada: document.getElementById('editArmadaId').value,
            nama_armada: document.getElementById('editArmadaNama').value,
            tujuan_armada: document.getElementById('editArmadaTujuan').value,
            jam: document.getElementById('editArmadaJam').value,
            harga: document.getElementById('editArmadaHarga').value,
            seat: calculatedSeat,
            tipe_armada: tipeVal,
            denah_id: denahVal
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
    function toggleAddArmadaTujuanInput() {
        const select = document.getElementById('addArmadaTujuanSelect');
        const inputContainer = document.getElementById('addArmadaTujuanInputContainer');
        const input = document.getElementById('addArmadaTujuan');
        if (!select || !inputContainer || !input) return;
        if (select.value === 'LAIN') {
            inputContainer.classList.remove('hidden');
            input.required = true;
            input.value = '';
        } else {
            inputContainer.classList.add('hidden');
            input.required = false;
        }
    }

    function toggleAddArmadaNamaInput() {
        const select = document.getElementById('addArmadaNamaSelect');
        const inputContainer = document.getElementById('addArmadaNamaInputContainer');
        const input = document.getElementById('addArmadaNama');
        const tujuanSelect = document.getElementById('addArmadaTujuanSelect');
        
        if (!select || !inputContainer || !input) return;
        
        if (select.value === 'BARU') {
            inputContainer.classList.remove('hidden');
            input.required = true;
            input.value = '';
            
            // If new armada, populate tujuan with all unique destinations or just empty
            if (tujuanSelect) {
                tujuanSelect.innerHTML = '<option value="">Pilih Tujuan...</option><option value="LAIN">+ Tujuan Lain</option>';
                tujuanSelect.value = 'LAIN';
                toggleAddArmadaTujuanInput();
            }
        } else {
            inputContainer.classList.add('hidden');
            input.required = false;
            
            // Auto-populate Tujuan dropdown based on selected Armada Name
            if (tujuanSelect && select.value !== '') {
                const armadas = getArmadas();
                const relatedArmadas = armadas.filter(a => a.name.toUpperCase() === select.value.toUpperCase());
                const uniqueDestinations = [...new Set(relatedArmadas.map(a => a.destination))].sort();
                
                let html = '<option value="">Pilih Tujuan...</option>';
                uniqueDestinations.forEach(dest => {
                    html += `<option value="${dest}">${dest}</option>`;
                });
                html += '<option value="LAIN">+ Tujuan Lain</option>';
                tujuanSelect.innerHTML = html;
                
                // Auto select the first destination if available
                if (uniqueDestinations.length > 0) {
                    tujuanSelect.value = uniqueDestinations[0];
                    const match = relatedArmadas.find(a => a.destination === uniqueDestinations[0]);
                    if (match) {
                        document.getElementById('addArmadaHarga').value = match.price;
                    }
                } else {
                    tujuanSelect.value = 'LAIN';
                }
                toggleAddArmadaTujuanInput();

                // Auto-sync Tipe Armada and Denah to match the selected PO!
                if (relatedArmadas.length > 0) {
                    const poArmada = relatedArmadas[0];
                    const poTipe = poArmada.tipeArmada || 'Bus Besar';
                    const poDenah = poArmada.denahId && typeof getDenah === 'function' ? getDenah(poArmada.denahId) : null;
                    const poSeat = poDenah?.totalKursi || poArmada.capacity || 40;

                    const tipeSelect = document.getElementById('addArmadaTipe');
                    if (tipeSelect) tipeSelect.value = poTipe;

                    const denahSelect = document.getElementById('addArmadaDenah');
                    if (denahSelect && poArmada.denahId) denahSelect.value = poArmada.denahId;

                    const hintEl = document.getElementById('addArmadaPoHint');
                    if (hintEl) {
                        hintEl.classList.remove('hidden');
                        hintEl.innerHTML = `<i class="fas fa-check-circle text-emerald-600 mr-1"></i> PO <b>${select.value}</b>: Tipe <b>${poTipe}</b> (${poSeat} Kursi) — Otomatis mengikuti PO.`;
                    }
                }
            } else if (tujuanSelect) {
                tujuanSelect.innerHTML = '<option value="">Pilih Tujuan...</option><option value="LAIN">+ Tujuan Lain</option>';
                tujuanSelect.value = '';
                toggleAddArmadaTujuanInput();
            }
        }
    }

    function openAddArmadaModal() {
        try {
            document.getElementById('formAddArmada').reset();
            
            const armadas = getArmadas();
            const uniqueNames = [...new Set(armadas.map(a => a.name.toUpperCase()))].sort();
            const select = document.getElementById('addArmadaNamaSelect');
            const tujuanSelect = document.getElementById('addArmadaTujuanSelect');

            if (select) {
                let html = '<option value="">Pilih Armada...</option>';
                uniqueNames.forEach(name => {
                    html += `<option value="${name}">${name}</option>`;
                });
                html += '<option value="BARU">+ Tambah Armada Baru</option>';
                select.innerHTML = html;
            }
            
            if (tujuanSelect) {
                tujuanSelect.innerHTML = '<option value="">Pilih Tujuan...</option><option value="LAIN">+ Tujuan Lain</option>';
            }
            
            toggleAddArmadaNamaInput();
            toggleAddArmadaTujuanInput();
            if (typeof populateDenahDropdown === 'function') populateDenahDropdown('addArmadaDenah');
            if (document.getElementById('addArmadaTipe')) document.getElementById('addArmadaTipe').value = 'Bus Besar';

            const m = document.getElementById('modalAddArmada');
            const c = document.getElementById('modalAddArmadaContent');
            
            if (m) document.body.appendChild(m); // Safety append
            
            m.classList.remove('hidden');
            m.classList.add('flex');
            setTimeout(() => {
                if (c) {
                    c.classList.remove('scale-95', 'opacity-0');
                    c.classList.add('scale-100', 'opacity-100');
                }
            }, 10);
        } catch (e) {
            Swal.fire('Error openAdd', e.message, 'error');
        }
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
                m.classList.remove('flex');
                m.classList.add('hidden');
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
        
        let armadaTujuan = '';
        const tujuanSelect = document.getElementById('addArmadaTujuanSelect');
        if (tujuanSelect && tujuanSelect.value) {
            if (tujuanSelect.value === 'LAIN') {
                armadaTujuan = document.getElementById('addArmadaTujuan').value;
            } else {
                armadaTujuan = tujuanSelect.value;
            }
        } else {
            armadaTujuan = document.getElementById('addArmadaTujuan').value;
        }
        
        if (!armadaName || armadaName.trim() === '') {
            showMessage('Nama armada tidak boleh kosong', true);
            return;
        }
        
        if (!armadaTujuan || armadaTujuan.trim() === '') {
            showMessage('Tujuan armada tidak boleh kosong', true);
            return;
        }

        const btn = document.getElementById('btnSubmitAddArmada');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENYIMPAN...'; btn.disabled = true;

        const tipeVal = document.getElementById('addArmadaTipe')?.value || 'Bus Besar';
        const denahVal = document.getElementById('addArmadaDenah')?.value || null;
        
        let calculatedSeat = 0;
        if (denahVal && typeof getDenah === 'function') {
            const dObj = getDenah(denahVal);
            if (dObj && dObj.totalKursi) calculatedSeat = dObj.totalKursi;
        }
        if (!calculatedSeat) {
            const defaultSeatsByType = { 'Hiace': 14, 'Bus Besar': 40, 'Long Elf': 19, 'Medium Bus': 31, 'Elf Short': 12, 'Innova / MPV': 7 };
            calculatedSeat = defaultSeatsByType[tipeVal] || 40;
        }

        const payload = {
            nama_armada: armadaName,
            tujuan_armada: armadaTujuan,
            jam: document.getElementById('addArmadaJam').value,
            harga: document.getElementById('addArmadaHarga').value,
            seat: calculatedSeat,
            tipe_armada: tipeVal,
            denah_id: denahVal
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
        
        btn.innerText = 'Tambah Armada'; btn.disabled = false;
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
        
        const kursiString = adminBookingSelectedSeats.size > 0 ? [...adminBookingSelectedSeats].join(', ') : '';
        
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
        if (typeof resetAdminBooking === 'function') resetAdminBooking();
        const dateInput = document.getElementById('adminBookingDate');
        if (dateInput && !dateInput.value) {
            dateInput.value = (typeof getLocalYYYYMMDD === 'function') ? getLocalYYYYMMDD(new Date()) : new Date().toISOString().split('T')[0];
        }
        const modal = document.getElementById('bookingModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        if (typeof onAdminBookingTripChange === 'function') onAdminBookingTripChange();
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
                const isPlane = item.tipe === 'PESAWAT';
                const isLunas = item.statusPembayaran === 'LUNAS';
                const statusColor = isLunas ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200';
                const pnpList = parseEkstraPnp(item);
                const icon = isPlane ? 'fa-plane' : 'fa-ship';
                const pnpNamesSummary = pnpList.map(p => p.nama).join(', ') || 'Tanpa Nama';
                
                // Mobile View: 2-Baris Presisi seperti Manifest (OnClick to Detail)
                html += `
                    <div onclick="openEkstraDetailModal('${item.id}')" class="block lg:hidden bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:bg-blue-50/70 active:bg-blue-100/60 cursor-pointer transition-all select-none">
                        <!-- Baris 1: Vendor & Rute (Kiri) | Status (Kanan) -->
                        <div class="flex items-center justify-between gap-2">
                            <div class="flex items-center gap-1.5 min-w-0 flex-1">
                                <div class="w-6 h-6 rounded-lg ${isPlane ? 'bg-blue-100 text-blue-600' : 'bg-teal-100 text-teal-600'} flex items-center justify-center text-[10px] shrink-0">
                                    <i class="fas ${icon}"></i>
                                </div>
                                <span class="text-xs font-black text-slate-800 uppercase tracking-tight truncate">${item.vendor}</span>
                                <span class="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider truncate">• ${item.rute}</span>
                            </div>
                            <div class="flex items-center gap-1.5 shrink-0">
                                <span class="inline-block px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider shadow-2xs border ${statusColor}">${item.statusPembayaran}</span>
                                <div class="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                    <i class="fas fa-chevron-right text-[8px]"></i>
                                </div>
                            </div>
                        </div>

                        <!-- Baris 2: Nama Penumpang (Kiri) | Total Bayar (Kanan) -->
                        <div class="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-slate-100/80">
                            <div class="min-w-0 flex-1 pr-2">
                                <span class="font-bold text-xs text-slate-700 truncate block">
                                    <i class="fas fa-users text-slate-400 text-[10px] mr-1"></i>${pnpNamesSummary} <span class="text-[10px] text-slate-400 font-semibold">(${pnpList.length} Org)</span>
                                </span>
                                <span class="text-[9px] font-bold text-slate-400 block mt-0.5">
                                    <i class="far fa-calendar-alt mr-1"></i>${item.tanggalBerangkat} • ${item.jamBerangkat}
                                </span>
                            </div>
                            <div class="text-right shrink-0">
                                <span class="font-black text-sm text-slate-900 block">${formatRupiah(item.totalHarga)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Desktop View: Table Row (OnClick to Detail) -->
                    <tr onclick="openEkstraDetailModal('${item.id}')" class="hidden lg:table-row hover:bg-blue-50/70 transition-colors group cursor-pointer border-b border-slate-100 select-none">
                        <td class="p-3.5">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl ${isPlane ? 'bg-blue-50 text-blue-600' : 'bg-teal-50 text-teal-600'} flex items-center justify-center flex-shrink-0">
                                    <i class="fas ${icon} text-base"></i>
                                </div>
                                <div>
                                    <div class="font-black text-slate-800 text-sm group-hover:text-blue-600 transition-colors">${item.vendor}</div>
                                    <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${item.tipe}</div>
                                </div>
                            </div>
                        </td>
                        <td class="p-3.5">
                            <div class="font-bold text-slate-700 text-xs">${item.rute}</div>
                            <div class="text-[11px] text-slate-400 mt-0.5"><i class="far fa-calendar-alt mr-1"></i>${item.tanggalBerangkat} | <i class="far fa-clock mr-1"></i>${item.jamBerangkat}</div>
                        </td>
                        <td class="p-3.5">
                            <div class="font-black text-blue-600 text-xs">${pnpNamesSummary} <span class="text-[10px] text-slate-400 font-bold">(${pnpList.length} Org)</span></div>
                            <div class="text-[10px] font-bold text-slate-400 mt-0.5"><i class="fas fa-phone mr-1"></i> ${parseEkstraHp(item)}</div>
                        </td>
                        <td class="p-3.5 text-right font-black text-xs text-slate-800 whitespace-nowrap">
                            ${formatRupiah(item.totalHarga)}
                        </td>
                        <td class="p-3.5 text-center">
                            <span class="inline-flex px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full border ${statusColor}">
                                ${item.statusPembayaran}
                            </span>
                        </td>
                        <td class="p-3.5 text-right">
                            <div class="flex items-center justify-end gap-1.5 text-slate-400 group-hover:text-blue-600 transition-colors">
                                <span class="text-[10px] font-black uppercase tracking-wider">Detail</span>
                                <i class="fas fa-chevron-right text-[10px] transform group-hover:translate-x-0.5 transition-transform"></i>
                            </div>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }

                // =========================================================
        // EKSTRA BOOKING (PESAWAT & KAPAL) LOGIC WITH FULL ROUTES
        // =========================================================
        function onEkstraTipeChanged() {
            const tipe = document.getElementById('ekstraTipe')?.value || 'PESAWAT';
            const isPlane = (tipe === 'PESAWAT');

            const badge = document.getElementById('ekstraModalBadge');
            const icon = document.getElementById('ekstraModalIcon');
            const subtitle = document.getElementById('ekstraModalSubtitle');
            const vendorLabel = document.getElementById('ekstraVendorLabel');
            const vendorInput = document.getElementById('ekstraVendor');
            const ruteTitle = document.getElementById('ruteSectionTitle');
            const asalLabel = document.getElementById('asalSelectLabel');
            const tujuanLabel = document.getElementById('tujuanSelectLabel');

            if (badge) {
                badge.className = isPlane 
                    ? 'w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-lg shadow-sm shrink-0 transition-all'
                    : 'w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center text-lg shadow-sm shrink-0 transition-all';
            }
            if (icon) {
                icon.className = isPlane ? 'fas fa-plane' : 'fas fa-ship';
            }
            if (subtitle) {
                subtitle.innerText = isPlane ? 'Booking Tiket Pesawat Komersil Domestik & Internasional' : 'Booking Tiket Kapal Laut & Penyeberangan Ferry';
            }
            if (vendorLabel) {
                vendorLabel.innerText = isPlane ? 'Maskapai Pesawat' : 'Operator / Nama Kapal';
            }
            if (vendorInput) {
                vendorInput.placeholder = isPlane ? 'Cth: Garuda / Citilink / AirAsia' : 'Cth: PELNI / ASDP / DLU';
            }
            if (ruteTitle) {
                ruteTitle.innerHTML = isPlane 
                    ? '<i class="fas fa-plane-departure text-blue-600"></i> Rute Penerbangan (Bandara)' 
                    : '<i class="fas fa-ship text-teal-600"></i> Rute Pelayaran (Pelabuhan)';
            }
            if (asalLabel) {
                asalLabel.innerHTML = isPlane 
                    ? '<i class="fas fa-plane-departure text-blue-600 text-[10px]"></i> Asal Bandara' 
                    : '<i class="fas fa-anchor text-teal-600 text-[10px]"></i> Asal Pelabuhan';
            }
            if (tujuanLabel) {
                tujuanLabel.innerHTML = isPlane 
                    ? '<i class="fas fa-plane-arrival text-emerald-600 text-[10px]"></i> Tujuan Bandara' 
                    : '<i class="fas fa-flag-checkered text-emerald-600 text-[10px]"></i> Tujuan Pelabuhan';
            }

            // Populate dropdowns with comprehensive dataset
            if (typeof populateRouteDropdown === 'function') {
                populateRouteDropdown('ekstraAsal', tipe);
                populateRouteDropdown('ekstraTujuan', tipe);
            }
            if (typeof populateVendorDatalist === 'function') {
                populateVendorDatalist('ekstraVendorList', tipe);
            }

            // Hide manual inputs by default
            const asalManual = document.getElementById('ekstraAsalManual');
            const tujuanManual = document.getElementById('ekstraTujuanManual');
            if (asalManual) asalManual.classList.add('hidden');
            if (tujuanManual) tujuanManual.classList.add('hidden');
        }

        function onRouteSelectChanged(selectId) {
            const selectEl = document.getElementById(selectId);
            const manualEl = document.getElementById(selectId + 'Manual');
            if (!selectEl || !manualEl) return;

            if (selectEl.value === 'MANUAL') {
                manualEl.classList.remove('hidden');
                manualEl.focus();
            } else {
                manualEl.classList.add('hidden');
            }
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
                    <div class="relative p-3 pt-3.5 bg-slate-50/80 border border-slate-200 rounded-xl shadow-2xs">
                        <div class="absolute -top-2 left-3 bg-indigo-600 text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-2xs">
                            Penumpang ${i}
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-0.5">
                            <div>
                                <label class="block text-[9px] font-bold text-slate-500 mb-0.5 uppercase tracking-wider">Nama Penumpang</label>
                                <input type="text" class="ekstra-nama-input w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" placeholder="Nama Lengkap" value="${namaVal}" required>
                            </div>
                            <div>
                                <label class="block text-[9px] font-bold text-slate-500 mb-0.5 uppercase tracking-wider">Harga Dasar (Rp)</label>
                                <input type="number" class="ekstra-harga-input w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" placeholder="Contoh: 1250000" value="${hargaVal}" oninput="calculateEkstraTotal()" required>
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
                document.getElementById('ekstraTipe').value = 'PESAWAT';
                document.getElementById('ekstraJumlahPnp').value = 1;
                document.getElementById('ekstraHp').value = '';
                const todayStr = (typeof getLocalYYYYMMDD === 'function') ? getLocalYYYYMMDD(new Date()) : new Date().toISOString().split('T')[0];
                const tglEl = document.getElementById('ekstraTanggal');
                if (tglEl) tglEl.value = todayStr;
                
                onEkstraTipeChanged();
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
                alert('Error openAddEkstra: ' + e.message);
            }
        }

        function openEditEkstraModal(item) {
            try {
                document.getElementById('ekstraId').value = item.id;
                document.getElementById('ekstraTipe').value = item.tipe || 'PESAWAT';
                onEkstraTipeChanged();

                document.getElementById('ekstraVendor').value = item.vendor || '';

                const ruteParts = (item.rute || '').split(' - ');
                const ruteAsal = (ruteParts[0] || '').trim();
                const ruteTujuan = (ruteParts.slice(1).join(' - ') || '').trim();

                if (typeof populateRouteDropdown === 'function') {
                    populateRouteDropdown('ekstraAsal', item.tipe || 'PESAWAT', ruteAsal);
                    populateRouteDropdown('ekstraTujuan', item.tipe || 'PESAWAT', ruteTujuan);
                }

                document.getElementById('ekstraTanggal').value = item.tanggalBerangkat || '';
                document.getElementById('ekstraJam').value = item.jamBerangkat || '';
                document.getElementById('ekstraStatus').value = item.statusPembayaran || 'LUNAS';
                document.getElementById('ekstraHp').value = parseEkstraHp(item) !== '-' ? parseEkstraHp(item) : '';

                const pnpList = parseEkstraPnp(item);
                document.getElementById('ekstraJumlahPnp').value = pnpList.length || 1;
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
                alert('Error openEditEkstra: ' + e.message);
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

            // Get Asal (either from dropdown or manual)
            const asalSelect = document.getElementById('ekstraAsal');
            let ruteAsal = (asalSelect?.value || '').trim();
            if (ruteAsal === 'MANUAL') {
                ruteAsal = (document.getElementById('ekstraAsalManual')?.value || '').trim();
            }

            // Get Tujuan (either from dropdown or manual)
            const tujuanSelect = document.getElementById('ekstraTujuan');
            let ruteTujuan = (tujuanSelect?.value || '').trim();
            if (ruteTujuan === 'MANUAL') {
                ruteTujuan = (document.getElementById('ekstraTujuanManual')?.value || '').trim();
            }

            if (!ruteAsal || !ruteTujuan) {
                alert('Silakan pilih atau isi Asal dan Tujuan rute perjalanan');
                btn.innerHTML = originalContent;
                btn.disabled = false;
                return;
            }

            const ruteFinal = ruteAsal + ' - ' + ruteTujuan;

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
                    if (typeof showMessage === 'function') showMessage('Tiket berhasil disimpan!');
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
                    if (typeof showMessage === 'function') showMessage('Tiket berhasil dihapus');
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


// ============================================
// TIPE ARMADA & PO MANAGEMENT
// ============================================

function populateTipeArmadaDropdowns() {
    const list = typeof getTipeArmadaList === 'function' ? getTipeArmadaList() : [];
    const tipeNames = list.map(t => t.nama || t);
    
    // 1. Populate addArmadaTipe
    const addSel = document.getElementById('addArmadaTipe');
    if (addSel) {
        const cur = addSel.value;
        addSel.innerHTML = tipeNames.map(n => `<option value="${n}">${n}</option>`).join('');
        if (cur && tipeNames.includes(cur)) addSel.value = cur;
    }

    // 2. Populate editArmadaTipe
    const editSel = document.getElementById('editArmadaTipe');
    if (editSel) {
        const cur = editSel.value;
        editSel.innerHTML = tipeNames.map(n => `<option value="${n}">${n}</option>`).join('');
        if (cur && tipeNames.includes(cur)) editSel.value = cur;
    }

    // 3. Populate editPoTipe
    const poSel = document.getElementById('editPoTipe');
    if (poSel) {
        const cur = poSel.value;
        poSel.innerHTML = tipeNames.map(n => `<option value="${n}">${n}</option>`).join('');
        if (cur && tipeNames.includes(cur)) poSel.value = cur;
    }

    // 4. Populate denahEditorKategori
    const katSel = document.getElementById('denahEditorKategori');
    if (katSel) {
        const cur = katSel.value;
        katSel.innerHTML = tipeNames.map(n => `<option value="${n}">${n}</option>`).join('') + '<option value="CUSTOM">+ Tipe Armada Lainnya...</option>';
        if (cur && (tipeNames.includes(cur) || cur === 'CUSTOM')) katSel.value = cur;
    }

    // 5. Render Filter Pills in subtabArmadaDenah
    const pillsWrap = document.getElementById('denahFilterPills');
    if (pillsWrap) {
        let pillsHtml = `<button onclick="filterDenahKategori('ALL')" class="denah-cat-pill ${currentDenahKategori === 'ALL' ? 'active px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-900 text-amber-400 shadow-sm transition-all' : 'px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-white text-slate-600 border border-slate-200 hover:border-amber-400 shadow-sm transition-all'}" data-cat="ALL">Semua Tipe</button>`;
        tipeNames.forEach(n => {
            const isActive = currentDenahKategori.toLowerCase() === n.toLowerCase();
            pillsHtml += `<button onclick="filterDenahKategori('${n}')" class="denah-cat-pill ${isActive ? 'active px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-900 text-amber-400 shadow-sm transition-all' : 'px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-white text-slate-600 border border-slate-200 hover:border-amber-400 shadow-sm transition-all'}" data-cat="${n}">${n}</button>`;
        });
        pillsWrap.innerHTML = pillsHtml;
    }
}

// Modal Kelola Tipe Armada
function openKelolaTipeModal() {
    renderTipeArmadaList();
    const m = document.getElementById('modalKelolaTipe');
    const c = document.getElementById('modalKelolaTipeContent');
    if (m) {
        m.classList.remove('hidden');
        m.classList.add('flex');
        setTimeout(() => {
            if (c) {
                c.classList.remove('scale-95', 'opacity-0');
                c.classList.add('scale-100', 'opacity-100');
            }
        }, 10);
    }
}

function closeKelolaTipeModal() {
    const m = document.getElementById('modalKelolaTipe');
    const c = document.getElementById('modalKelolaTipeContent');
    if (c) {
        c.classList.remove('scale-100', 'opacity-100');
        c.classList.add('scale-95', 'opacity-0');
    }
    setTimeout(() => {
        if (m) {
            m.classList.remove('flex');
            m.classList.add('hidden');
        }
    }, 300);
}

function renderTipeArmadaList() {
    const container = document.getElementById('tipeArmadaListContainer');
    if (!container) return;

    const list = typeof getTipeArmadaList === 'function' ? getTipeArmadaList() : [];
    const armadas = typeof getArmadas === 'function' ? getArmadas() : [];
    const denahs = typeof getDenahList === 'function' ? getDenahList() : [];

    if (!list.length) {
        container.innerHTML = '<p class="text-xs text-slate-400 italic py-3 text-center">Belum ada tipe armada</p>';
        return;
    }

    let html = '';
    list.forEach(item => {
        const nama = item.nama || item;
        const countArmada = armadas.filter(a => (a.tipeArmada || '').toLowerCase() === nama.toLowerCase()).length;
        const countDenah = denahs.filter(d => (d.kategori || '').toLowerCase() === nama.toLowerCase()).length;

        html += `
            <div class="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-amber-300 transition-all">
                <div class="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    <div class="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 text-xs">
                        <i class="fas fa-bus"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="font-black text-xs sm:text-sm text-slate-800 uppercase truncate">${nama}</p>
                        <p class="text-[10px] font-bold text-slate-400">${countDenah} Denah Kursi • ${countArmada} Rute Armada</p>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" onclick="editTipeArmadaName('${nama}')" class="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-500 hover:text-white text-amber-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1" title="Ubah Nama Tipe">
                        <i class="fas fa-edit"></i> <span class="hidden sm:inline">Ubah Nama</span>
                    </button>
                    <button type="button" onclick="deleteTipeArmadaAction('${nama}')" class="w-7 h-7 bg-red-50 hover:bg-red-500 hover:text-white text-red-600 rounded-lg text-xs font-bold transition-all flex items-center justify-center" title="Hapus Tipe">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function submitAddTipeArmada(e) {
    e.preventDefault();
    const input = document.getElementById('inputNewTipeNama');
    const nama = input?.value.trim();
    if (!nama) return;

    const btn = document.getElementById('btnSubmitAddTipe');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    try {
        const res = await postToSheets('addTipeArmada', { nama });
        if (res && res.status === 'success') {
            if (typeof showMessage === 'function') showMessage(`Tipe armada '${nama}' berhasil ditambahkan!`);
            input.value = '';
            await refreshData();
            renderTipeArmadaList();
            populateTipeArmadaDropdowns();
        } else {
            alert(res?.message || 'Gagal menambahkan tipe armada');
        }
    } catch(err) {
        alert(err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Tambah'; }
    }
}

async function editTipeArmadaName(oldName) {
    let newName = '';
    if (typeof Swal !== 'undefined') {
        const { value: formValue } = await Swal.fire({
            title: 'Ubah Nama Tipe Armada',
            input: 'text',
            inputValue: oldName,
            inputLabel: 'Nama tipe baru:',
            inputPlaceholder: 'Ketik nama tipe...',
            showCancelButton: true,
            confirmButtonColor: '#f59e0b',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Simpan',
            cancelButtonText: 'Batal',
            inputValidator: (value) => {
                if (!value || !value.trim()) return 'Nama tipe tidak boleh kosong!';
            }
        });
        if (!formValue) return;
        newName = formValue.trim();
    } else {
        const res = prompt('Ubah nama tipe armada "' + oldName + '" menjadi:', oldName);
        if (res === null) return;
        newName = res.trim();
    }

    if (!newName || newName === oldName) return;

    try {
        const res = await postToSheets('editTipeArmada', { old_nama: oldName, new_nama: newName });
        if (res && res.status === 'success') {
            if (typeof showMessage === 'function') showMessage(`Nama tipe armada berhasil diubah menjadi '${newName}'!`);
            await refreshData();
            renderTipeArmadaList();
            populateTipeArmadaDropdowns();
            renderArmada();
            renderDenahCards();
        } else {
            alert(res?.message || 'Gagal mengubah nama tipe armada');
        }
    } catch(err) {
        alert(err.message);
    }
}

async function deleteTipeArmadaAction(name) {
    if (!confirm(`Yakin ingin menghapus tipe armada '${name}'?`)) return;

    try {
        const res = await postToSheets('deleteTipeArmada', { nama: name });
        if (res && res.status === 'success') {
            if (typeof showMessage === 'function') showMessage(`Tipe armada '${name}' berhasil dihapus`);
            await refreshData();
            renderTipeArmadaList();
            populateTipeArmadaDropdowns();
        } else {
            alert(res?.message || 'Gagal menghapus tipe armada');
        }
    } catch(err) {
        alert(err.message);
    }
}

// ==========================================
// PENGELOLAAN INFORMASI PO & FOTO ARMADA
// ==========================================
const COMMON_PO_FACILITIES = [
    "Full AC",
    "Reclining Seat",
    "USB Charger",
    "Audio Musik",
    "TV / Hiburan",
    "Air Mineral",
    "Snack",
    "Toilet",
    "Bagasi Luas",
    "Bantal & Selimut",
    "Lampu Baca"
];

function renderFacilityChips(activeList = []) {
    const container = document.getElementById('facilityChipsContainer');
    if (!container) return;
    const lowerActives = (activeList || []).map(x => String(x).trim().toLowerCase());

    container.innerHTML = COMMON_PO_FACILITIES.map(fac => {
        const isAct = lowerActives.includes(fac.toLowerCase());
        const cls = isAct
            ? 'bg-amber-500 text-slate-900 border-amber-600 font-black shadow-xs'
            : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200 font-bold';
        const icon = isAct ? '<i class="fas fa-check text-[9px]"></i> ' : '<i class="fas fa-plus text-[9px] text-slate-400"></i> ';
        return `<button type="button" onclick="toggleFacilityChip('${fac}')" class="px-2.5 py-1 text-[10px] rounded-lg border transition-all flex items-center gap-1 ${cls}">${icon}${fac}</button>`;
    }).join('');
}

function toggleFacilityChip(facName) {
    const input = document.getElementById('editPoFacilities');
    if (!input) return;
    let list = input.value.split(',').map(s => s.trim()).filter(Boolean);
    const idx = list.findIndex(x => x.toLowerCase() === facName.toLowerCase());
    if (idx >= 0) {
        list.splice(idx, 1);
    } else {
        list.push(facName);
    }
    input.value = list.join(', ');
    renderFacilityChips(list);
}

function selectPoPresetImage(imgUrl) {
    const urlInput = document.getElementById('editPoImageUrl');
    const preview = document.getElementById('editPoImagePreview');
    const badge = document.getElementById('editPoImageBadge');
    const fileInput = document.getElementById('editPoImageFile');
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = imgUrl;
    if (preview) preview.src = imgUrl;
    if (badge) badge.innerHTML = `<i class="fas fa-check-circle text-emerald-400"></i> Preset: ${imgUrl}`;
}

function updatePoImagePreviewFromInput(val) {
    const preview = document.getElementById('editPoImagePreview');
    const badge = document.getElementById('editPoImageBadge');
    const clean = val.trim() || 'damri.webp';
    if (preview) preview.src = clean;
    if (badge) badge.innerHTML = `<i class="fas fa-link text-amber-400"></i> Custom URL / Path`;
}

function onPoImageFileSelected(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('editPoImagePreview');
            if (preview) preview.src = e.target.result;
            const badge = document.getElementById('editPoImageBadge');
            if (badge) badge.innerHTML = `<i class="fas fa-file-image text-amber-400"></i> File: ${file.name} (Siap diunggah)`;
        };
        reader.readAsDataURL(file);
    }
}

// LOGO PO HELPERS
function onPoLogoFileSelected(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('editPoLogoPreview');
            const placeholder = document.getElementById('editPoLogoPlaceholder');
            const badge = document.getElementById('editPoLogoBadge');
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
            if (placeholder) placeholder.classList.add('hidden');
            if (badge) badge.textContent = `File: ${file.name} (Siap diunggah)`;
        };
        reader.readAsDataURL(file);
    }
}

function updatePoLogoPreviewFromInput(val) {
    const preview = document.getElementById('editPoLogoPreview');
    const placeholder = document.getElementById('editPoLogoPlaceholder');
    const badge = document.getElementById('editPoLogoBadge');
    const clean = (val || '').trim();
    if (clean) {
        if (preview) { preview.src = clean; preview.style.display = 'block'; }
        if (placeholder) placeholder.classList.add('hidden');
        if (badge) badge.textContent = 'Custom URL/Path';
    } else {
        if (preview) preview.style.display = 'none';
        if (placeholder) placeholder.classList.remove('hidden');
        if (badge) badge.textContent = 'Badge Teks Bawaan';
    }
}

function clearPoLogo() {
    const fileInput = document.getElementById('editPoLogoFile');
    const urlInput = document.getElementById('editPoLogoUrl');
    const preview = document.getElementById('editPoLogoPreview');
    const placeholder = document.getElementById('editPoLogoPlaceholder');
    const badge = document.getElementById('editPoLogoBadge');
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
    if (preview) preview.style.display = 'none';
    if (placeholder) placeholder.classList.remove('hidden');
    if (badge) badge.textContent = 'Badge Teks Bawaan';
}

// Modal Atur Tipe Bus & Informasi PO
function openEditPoModal(poName) {
    const armadas = typeof getArmadas === 'function' ? getArmadas() : [];
    const rutes = armadas.filter(a => a.name.toUpperCase() === poName.toUpperCase());
    if (!rutes.length) {
        alert('Data PO tidak ditemukan');
        return;
    }

    const firstA = rutes[0];
    document.getElementById('editPoNama').value = poName;
    document.getElementById('modalEditPoSubtitle').textContent = `PO: ${poName} (${rutes.length} Rute)`;

    // Ambil profil PO saat ini
    const poProf = typeof getPoProfile === 'function' ? getPoProfile(poName) : null;
    const currentImg = poProf?.image || 'damri.webp';
    const currentTagline = poProf?.tagline || '';
    const currentDesc = poProf?.description || '';
    const currentFacilities = poProf?.facilities || ["Full AC", "Reclining Seat", "Bagasi Luas"];

    // Set nilai form profil
    const urlInput = document.getElementById('editPoImageUrl');
    const preview = document.getElementById('editPoImagePreview');
    const badge = document.getElementById('editPoImageBadge');
    const fileInput = document.getElementById('editPoImageFile');
    const quickPick = document.getElementById('editPoImageQuickPick');
    if (quickPick) quickPick.classList.add('hidden');
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = currentImg;
    if (preview) preview.src = currentImg;
    if (badge) badge.innerHTML = `<i class="fas fa-image text-amber-400"></i> Foto Saat Ini`;

    // Set nilai Logo PO
    const currentLogo = poProf?.logo || '';
    const logoUrlInput = document.getElementById('editPoLogoUrl');
    const logoPreview = document.getElementById('editPoLogoPreview');
    const logoBadge = document.getElementById('editPoLogoBadge');
    const logoPlaceholder = document.getElementById('editPoLogoPlaceholder');
    const logoFileInput = document.getElementById('editPoLogoFile');
    if (logoFileInput) logoFileInput.value = '';
    if (logoUrlInput) logoUrlInput.value = currentLogo;
    if (logoPreview) {
        if (currentLogo) {
            logoPreview.src = currentLogo;
            logoPreview.style.display = 'block';
            if (logoPlaceholder) logoPlaceholder.classList.add('hidden');
            if (logoBadge) logoBadge.textContent = 'Logo Terpasang';
        } else {
            logoPreview.style.display = 'none';
            if (logoPlaceholder) logoPlaceholder.classList.remove('hidden');
            if (logoBadge) logoBadge.textContent = 'Badge Teks Bawaan';
        }
    }

    const taglineInput = document.getElementById('editPoTagline');
    if (taglineInput) taglineInput.value = currentTagline;

    const descInput = document.getElementById('editPoDesc');
    if (descInput) descInput.value = currentDesc;

    const facInput = document.getElementById('editPoFacilities');
    if (facInput) {
        facInput.value = currentFacilities.join(', ');
        facInput.oninput = () => {
            const list = facInput.value.split(',').map(s => s.trim()).filter(Boolean);
            renderFacilityChips(list);
        };
    }
    renderFacilityChips(currentFacilities);

    populateTipeArmadaDropdowns();
    const tipeSel = document.getElementById('editPoTipe');
    if (tipeSel) tipeSel.value = firstA.tipeArmada || 'Bus Besar';

    populateDenahDropdown('editPoDenah', firstA.denahId);

    const m = document.getElementById('modalEditPo');
    const c = document.getElementById('modalEditPoContent');
    if (m) {
        m.classList.remove('hidden');
        m.classList.add('flex');
        setTimeout(() => {
            if (c) {
                c.classList.remove('scale-95', 'opacity-0');
                c.classList.add('scale-100', 'opacity-100');
            }
        }, 10);
    }
}

function closeEditPoModal() {
    const m = document.getElementById('modalEditPo');
    const c = document.getElementById('modalEditPoContent');
    if (c) {
        c.classList.remove('scale-100', 'opacity-100');
        c.classList.add('scale-95', 'opacity-0');
    }
    setTimeout(() => {
        if (m) {
            m.classList.remove('flex');
            m.classList.add('hidden');
        }
    }, 300);
}

function onEditPoTipeChange() {
    const tipe = document.getElementById('editPoTipe')?.value;
    const denahSelect = document.getElementById('editPoDenah');
    if (!denahSelect || !tipe) return;

    const denahList = typeof getDenahList === 'function' ? getDenahList() : [];
    const bestMatch = denahList.find(d => (d.kategori || '').toLowerCase() === tipe.toLowerCase());
    if (bestMatch) {
        denahSelect.value = bestMatch.id;
    }
}

async function submitEditPo(e) {
    e.preventDefault();
    const poNama = document.getElementById('editPoNama')?.value;
    const tipe = document.getElementById('editPoTipe')?.value;
    const denahId = document.getElementById('editPoDenah')?.value || null;
    let imgUrl = document.getElementById('editPoImageUrl')?.value?.trim() || 'damri.webp';
    let logoUrl = document.getElementById('editPoLogoUrl')?.value?.trim() || '';
    const tagline = document.getElementById('editPoTagline')?.value?.trim() || '';
    const desc = document.getElementById('editPoDesc')?.value?.trim() || '';
    const facStr = document.getElementById('editPoFacilities')?.value || '';
    const facilities = facStr.split(',').map(s => s.trim()).filter(Boolean);

    if (!poNama || !tipe) return;

    const btn = document.getElementById('btnSubmitEditPo');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...'; }

    try {
        const token = localStorage.getItem('adminToken');

        // Cek jika ada file foto armada baru yang diunggah
        const fileInput = document.getElementById('editPoImageFile');
        if (fileInput && fileInput.files && fileInput.files[0]) {
            if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengunggah Foto Armada...';
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);

            const uploadRes = await fetch('/api/upload-armada', {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                body: formData
            });
            const uploadJson = await uploadRes.json();
            if (uploadJson && uploadJson.status === 'success' && uploadJson.url) {
                imgUrl = uploadJson.url;
            } else {
                throw new Error(uploadJson?.message || 'Gagal mengunggah foto armada');
            }
        }

        // Cek jika ada file logo PO baru yang diunggah
        const logoFileInput = document.getElementById('editPoLogoFile');
        if (logoFileInput && logoFileInput.files && logoFileInput.files[0]) {
            if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengunggah Logo PO...';
            const formDataLogo = new FormData();
            formDataLogo.append('logo', logoFileInput.files[0]);

            const uploadLogoRes = await fetch('/api/upload-logo', {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                body: formDataLogo
            });
            const uploadLogoJson = await uploadLogoRes.json();
            if (uploadLogoJson && uploadLogoJson.status === 'success' && uploadLogoJson.url) {
                logoUrl = uploadLogoJson.url;
            } else {
                throw new Error(uploadLogoJson?.message || 'Gagal mengunggah logo PO');
            }
        }

        if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan Data...';

        const payload = {
            nama_armada: poNama,
            tipe_armada: tipe,
            denah_id: denahId,
            image: imgUrl,
            logo: logoUrl,
            tagline: tagline,
            description: desc,
            facilities: facilities
        };

        const res = await postToSheets('savePoProfile', payload);
        if (res && res.status === 'success') {
            if (typeof showMessage === 'function') showMessage(`Informasi, logo, dan foto armada PO ${poNama} berhasil disimpan!`);
            closeEditPoModal();
            await refreshData();
            renderArmada();
            renderDenahCards();
        } else {
            alert(res?.message || 'Gagal menyimpan profil PO');
        }
    } catch(err) {
        alert(err.message || 'Terjadi kesalahan');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Simpan Informasi & Foto PO'; }
    }
}


    if (typeof openKelolaTipeModal !== 'undefined') window.openKelolaTipeModal = openKelolaTipeModal;
    if (typeof closeKelolaTipeModal !== 'undefined') window.closeKelolaTipeModal = closeKelolaTipeModal;
    if (typeof submitAddTipeArmada !== 'undefined') window.submitAddTipeArmada = submitAddTipeArmada;
    if (typeof editTipeArmadaName !== 'undefined') window.editTipeArmadaName = editTipeArmadaName;
    if (typeof deleteTipeArmadaAction !== 'undefined') window.deleteTipeArmadaAction = deleteTipeArmadaAction;
    if (typeof openEditPoModal !== 'undefined') window.openEditPoModal = openEditPoModal;
    if (typeof closeEditPoModal !== 'undefined') window.closeEditPoModal = closeEditPoModal;
    if (typeof onEditPoTipeChange !== 'undefined') window.onEditPoTipeChange = onEditPoTipeChange;
    if (typeof submitEditPo !== 'undefined') window.submitEditPo = submitEditPo;
    if (typeof populateTipeArmadaDropdowns !== 'undefined') window.populateTipeArmadaDropdowns = populateTipeArmadaDropdowns;
    if (typeof selectPoPresetImage !== 'undefined') window.selectPoPresetImage = selectPoPresetImage;
    if (typeof updatePoImagePreviewFromInput !== 'undefined') window.updatePoImagePreviewFromInput = updatePoImagePreviewFromInput;
    if (typeof onPoImageFileSelected !== 'undefined') window.onPoImageFileSelected = onPoImageFileSelected;
    if (typeof renderFacilityChips !== 'undefined') window.renderFacilityChips = renderFacilityChips;
    if (typeof toggleFacilityChip !== 'undefined') window.toggleFacilityChip = toggleFacilityChip;
    if (typeof onPoLogoFileSelected !== 'undefined') window.onPoLogoFileSelected = onPoLogoFileSelected;
    if (typeof updatePoLogoPreviewFromInput !== 'undefined') window.updatePoLogoPreviewFromInput = updatePoLogoPreviewFromInput;
    if (typeof clearPoLogo !== 'undefined') window.clearPoLogo = clearPoLogo;

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
    
        
        // =========================================================
        // DETAIL PESANAN PESAWAT & KAPAL (ON-CLICK ELEGAN & PREMIUM)
        // =========================================================
        function openEkstraDetailModal(id) {
            const data = getEkstraBookings() || [];
            const item = data.find(x => String(x.id) === String(id));
            if (!item) {
                console.error('Tiket tidak ditemukan:', id);
                return;
            }

            const isPlane = item.tipe === 'PESAWAT';
            const isPaid = item.statusPembayaran === 'LUNAS';
            const statusColor = isPaid ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-amber-100 text-amber-700 border-amber-300';
            const pnpList = parseEkstraPnp(item);
            const rawHp = parseEkstraHp(item);
            const formatHp = String(rawHp).replace(/[^0-9]/g, '').replace(/^0/, '62');

            // Header UI update
            const badge = document.getElementById('ekstraDetailBadge');
            const icon = document.getElementById('ekstraDetailIcon');
            const title = document.getElementById('ekstraDetailTitle');
            const subtitle = document.getElementById('ekstraDetailSubtitle');

            if (badge) {
                badge.className = isPlane 
                    ? 'w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-lg shadow-sm shrink-0'
                    : 'w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center text-lg shadow-sm shrink-0';
            }
            if (icon) icon.className = isPlane ? 'fas fa-plane' : 'fas fa-ship';
            if (title) title.innerText = isPlane ? 'Detail Tiket Pesawat' : 'Detail Tiket Kapal Laut';
            if (subtitle) subtitle.innerText = isPlane ? 'Rincian data penerbangan & penumpang' : 'Rincian data pelayaran kapal & penumpang';

            // Calculate fare breakdown
            const totalAdmin = (pnpList.length || 1) * 25000;
            const sumTiket = Math.max(0, (parseInt(item.totalHarga) || 0) - totalAdmin);

            // Origin and Destination parsing
            const ruteParts = (item.rute || '').split(' - ');
            const ruteAsal = ruteParts[0] || item.rute || '-';
            const ruteTujuan = ruteParts.slice(1).join(' - ') || ruteAsal;

            // Generate WhatsApp formatted message
            const pnpTextList = pnpList.map((p, idx) => `${idx + 1}. ${p.nama} (${formatRupiah(p.harga || 0)})`).join('\n');
            const waMsg = `Halo Sdr/i *${pnpList[0]?.nama || 'Penumpang'}*,\n\n` +
                `Berikut rincian tiket *${isPlane ? 'PESAWAT' : 'KAPAL LAUT'}* Anda melalui *Agen DAMRI Kawunganten*:\n\n` +
                `🎫 *Operator:* ${item.vendor}\n` +
                `📍 *Rute:* ${item.rute}\n` +
                `📅 *Tanggal:* ${item.tanggalBerangkat}\n` +
                `⏰ *Waktu:* ${item.jamBerangkat} WIB\n` +
                `👥 *Penumpang (${pnpList.length} Org):*\n${pnpTextList}\n\n` +
                `💰 *Total Bayar:* ${formatRupiah(item.totalHarga)}\n` +
                `📌 *Status:* ${item.statusPembayaran}\n\n` +
                `Terima kasih telah memesan tiket bersama Agen DAMRI Kawunganten!`;
            const waLink = `https://wa.me/${formatHp}?text=${encodeURIComponent(waMsg)}`;

            // Body Content HTML (Boarding Pass & Maritime Style)
            const contentEl = document.getElementById('ekstraDetailContent');
            if (contentEl) {
                contentEl.innerHTML = `
                    <div class="flex flex-col gap-3">
                        <!-- Boarding Pass / Maritime Voyage Card -->
                        <div class="bg-gradient-to-br ${isPlane ? 'from-blue-50/90 via-indigo-50/60 to-blue-50/40 border-blue-200/90' : 'from-teal-50/90 via-cyan-50/60 to-teal-50/40 border-teal-200/90'} p-3.5 sm:p-4 rounded-2xl border shadow-xs relative overflow-hidden">
                            <!-- Background watermark icon -->
                            <i class="fas ${isPlane ? 'fa-plane' : 'fa-ship'} absolute -right-4 -bottom-4 text-7xl ${isPlane ? 'text-blue-500/10' : 'text-teal-500/10'} pointer-events-none"></i>
                            
                            <!-- Top row: Badge Tipe & Status -->
                            <div class="flex items-center justify-between gap-2 mb-2">
                                <span class="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isPlane ? 'bg-blue-600 text-white shadow-2xs' : 'bg-teal-600 text-white shadow-2xs'}">
                                    ${isPlane ? '✈️ TIKET PESAWAT' : '🚢 TIKET KAPAL LAUT'}
                                </span>
                                <span class="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-2xs ${statusColor}">
                                    ${item.statusPembayaran}
                                </span>
                            </div>

                            <!-- Vendor Name -->
                            <div class="mt-1">
                                <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">${isPlane ? 'Maskapai Pesawat' : 'Operator Kapal'}</p>
                                <h4 class="text-base sm:text-lg font-black text-slate-800 tracking-tight leading-snug">${item.vendor}</h4>
                            </div>

                            <!-- Route Visual: Asal -> Tujuan -->
                            <div class="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-200/70">
                                <div class="min-w-0 flex-1">
                                    <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">${isPlane ? 'Bandara Asal' : 'Pelabuhan Asal'}</p>
                                    <p class="text-xs sm:text-sm font-black text-slate-800 truncate" title="${ruteAsal}">${ruteAsal}</p>
                                </div>
                                <div class="flex flex-col items-center px-2 shrink-0">
                                    <i class="fas ${isPlane ? 'fa-plane' : 'fa-ship'} ${isPlane ? 'text-blue-600' : 'text-teal-600'} text-xs"></i>
                                    <div class="w-10 sm:w-14 h-0.5 ${isPlane ? 'bg-blue-300' : 'bg-teal-300'} mt-1 relative">
                                        <div class="w-1.5 h-1.5 ${isPlane ? 'bg-blue-600' : 'bg-teal-600'} rounded-full absolute -top-0.5 right-0"></div>
                                    </div>
                                </div>
                                <div class="min-w-0 flex-1 text-right">
                                    <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">${isPlane ? 'Bandara Tujuan' : 'Pelabuhan Tujuan'}</p>
                                    <p class="text-xs sm:text-sm font-black ${isPlane ? 'text-blue-600' : 'text-teal-700'} truncate" title="${ruteTujuan}">${ruteTujuan}</p>
                                </div>
                            </div>

                            <!-- Jadwal Berangkat -->
                            <div class="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-200/70 text-xs">
                                <div class="flex items-center gap-1.5 text-slate-700">
                                    <i class="far fa-calendar-alt text-amber-500 text-xs"></i>
                                    <span class="font-bold text-[11px] truncate">${item.tanggalBerangkat || '-'}</span>
                                </div>
                                <div class="flex items-center gap-1.5 text-slate-700 justify-end">
                                    <i class="far fa-clock text-blue-500 text-xs"></i>
                                    <span class="font-black text-[11px]">${item.jamBerangkat || '-'} WIB</span>
                                </div>
                            </div>
                        </div>

                        <!-- Data Penumpang -->
                        <div class="bg-slate-50/80 p-3 sm:p-3.5 rounded-2xl border border-slate-100">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <i class="fas fa-users text-indigo-500"></i> Rincian Penumpang
                                </span>
                                <span class="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">${pnpList.length} Orang</span>
                            </div>
                            <div class="space-y-1.5">
                                ${pnpList.map((p, idx) => `
                                    <div class="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200/70 text-xs shadow-2xs">
                                        <div class="flex items-center gap-2 min-w-0 flex-1 pr-2">
                                            <span class="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-black text-[10px] flex items-center justify-center shrink-0">${idx+1}</span>
                                            <span class="font-bold text-slate-800 uppercase truncate">${p.nama || '-'}</span>
                                        </div>
                                        <span class="font-black text-slate-700 shrink-0 text-right">${formatRupiah(p.harga || 0)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Kontak Pemesan & WhatsApp -->
                        <div class="bg-slate-50/80 p-3 sm:p-3.5 rounded-2xl border border-slate-100 flex items-center justify-between gap-2">
                            <div>
                                <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Kontak Pemesan</p>
                                <p class="font-bold text-slate-800 text-xs sm:text-sm mt-0.5">${rawHp || '-'}</p>
                            </div>
                            ${formatHp ? `
                                <a href="${waLink}" target="_blank" class="px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 active:scale-95 text-xs font-black rounded-xl border border-emerald-300 shadow-2xs transition-all flex items-center gap-1.5 shrink-0" title="Chat WhatsApp Langsung">
                                    <i class="fab fa-whatsapp text-sm text-emerald-600"></i> Chat WA
                                </a>
                            ` : ''}
                        </div>

                        <!-- Rincian Biaya -->
                        <div class="bg-gradient-to-br from-indigo-50 to-blue-50/70 p-3.5 rounded-2xl border border-indigo-100/90 shadow-2xs">
                            <div class="flex justify-between items-center mb-1 text-xs">
                                <span class="font-bold text-indigo-500 uppercase tracking-wider text-[10px]">Total Tiket Dasar</span>
                                <span class="font-black text-indigo-900">${formatRupiah(sumTiket)}</span>
                            </div>
                            <div class="flex justify-between items-center mb-1.5 pb-1.5 border-b border-indigo-200/60 text-xs">
                                <span class="font-bold text-indigo-500 uppercase tracking-wider text-[10px]">Biaya Layanan Admin (${formatRupiah(25000)} x ${pnpList.length})</span>
                                <span class="font-black text-indigo-900">${formatRupiah(totalAdmin)}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-xs font-black text-indigo-950 uppercase tracking-widest">TOTAL BAYAR</span>
                                <span class="text-base sm:text-lg font-black text-indigo-700">${formatRupiah(item.totalHarga)}</span>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Footer Actions HTML (All Shortcuts)
            const actionsEl = document.getElementById('ekstraDetailActions');
            if (actionsEl) {
                actionsEl.innerHTML = `
                    <div class="w-full flex flex-col gap-2.5">
                        <!-- Grid 3 Shortcut Utama: WhatsApp, Cetak Tiket, Edit Data -->
                        <div class="grid grid-cols-3 gap-2 w-full">
                            <!-- 1. WHATSAPP -->
                            <a href="${waLink}" target="_blank" class="flex items-center justify-center gap-1.5 py-2.5 sm:py-3 px-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl shadow-xs transition-all text-center min-h-[44px] font-black text-[11px] sm:text-xs uppercase tracking-wider select-none" title="Kirim E-Tiket via WhatsApp">
                                <i class="fab fa-whatsapp text-sm sm:text-base text-emerald-200"></i>
                                <span>WhatsApp</span>
                            </a>

                            <!-- 2. CETAK TIKET -->
                            <button type="button" onclick="printStrukEkstraById('${item.id}')" class="flex items-center justify-center gap-1.5 py-2.5 sm:py-3 px-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl shadow-xs transition-all text-center min-h-[44px] font-black text-[11px] sm:text-xs uppercase tracking-wider select-none" title="Cetak Struk Thermal">
                                <i class="fas fa-print text-sm sm:text-base text-indigo-200"></i>
                                <span>Cetak</span>
                            </button>

                            <!-- 3. EDIT DATA -->
                            <button type="button" onclick="closeEkstraDetailModal(); openEditEkstraModalById('${item.id}')" class="flex items-center justify-center gap-1.5 py-2.5 sm:py-3 px-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-900 rounded-xl shadow-xs transition-all text-center min-h-[44px] font-black text-[11px] sm:text-xs uppercase tracking-wider select-none" title="Edit Data Tiket">
                                <i class="fas fa-edit text-sm sm:text-base text-amber-900"></i>
                                <span>Edit</span>
                            </button>
                        </div>

                        <!-- Baris Bawah: Hapus & Tutup -->
                        <div class="flex justify-between items-center pt-2 border-t border-slate-200/70">
                            <button type="button" onclick="closeEkstraDetailModal(); deleteEkstra('${item.id}')" class="text-red-500 hover:text-red-700 hover:bg-red-50 active:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5">
                                <i class="fas fa-trash text-xs"></i> <span>Hapus Tiket</span>
                            </button>
                            <button type="button" onclick="closeEkstraDetailModal()" class="bg-slate-200 hover:bg-slate-300 text-slate-700 px-5 py-1.5 rounded-lg text-xs font-bold transition-colors">
                                Tutup
                            </button>
                        </div>
                    </div>
                `;
            }

            // Open Modal with smooth transition
            const modal = document.getElementById('ekstraDetailModal');
            const inner = document.getElementById('ekstraDetailModalInner');
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                setTimeout(() => {
                    if (inner) {
                        inner.classList.remove('scale-95', 'opacity-0');
                        inner.classList.add('scale-100', 'opacity-100');
                    }
                }, 10);
            }
        }

        function closeEkstraDetailModal() {
            const modal = document.getElementById('ekstraDetailModal');
            const inner = document.getElementById('ekstraDetailModalInner');
            if (inner) {
                inner.classList.remove('scale-100', 'opacity-100');
                inner.classList.add('scale-95', 'opacity-0');
            }
            setTimeout(() => {
                if (modal) {
                    modal.classList.remove('flex');
                    modal.classList.add('hidden');
                }
            }, 300);
        }

        function printStrukEkstraById(id) {
            const data = getEkstraBookings() || [];
            const item = data.find(x => String(x.id) === String(id));
            if (item) printStrukEkstra(item);
        }

        function openEditEkstraModalById(id) {
            const data = getEkstraBookings() || [];
            const item = data.find(x => String(x.id) === String(id));
            if (item) openEditEkstraModal(item);
        }

        if (typeof openEkstraDetailModal !== 'undefined') window.openEkstraDetailModal = openEkstraDetailModal;
    if (typeof closeEkstraDetailModal !== 'undefined') window.closeEkstraDetailModal = closeEkstraDetailModal;
    if (typeof printStrukEkstraById !== 'undefined') window.printStrukEkstraById = printStrukEkstraById;
    if (typeof openEditEkstraModalById !== 'undefined') window.openEditEkstraModalById = openEditEkstraModalById;
    if (typeof onEkstraTipeChanged !== 'undefined') window.onEkstraTipeChanged = onEkstraTipeChanged;
    if (typeof onRouteSelectChanged !== 'undefined') window.onRouteSelectChanged = onRouteSelectChanged;
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

// ==========================================
// SUBTAB PESANAN & PELANGGAN LOGIC
// ==========================================
function switchPesananSubtab(sub) {
    currentPesananSubtab = sub;
    const tabTiket = document.getElementById('tabBtnPesananTiket');
    const tabPelanggan = document.getElementById('tabBtnPesananPelanggan');
    const paneTiket = document.getElementById('subtabPesananTiket');
    const panePelanggan = document.getElementById('subtabPesananPelanggan');

    if (sub === 'tiket') {
        if (tabTiket) {
            tabTiket.className = 'px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all bg-slate-900 text-amber-400 shadow-md flex items-center gap-2';
        }
        if (tabPelanggan) {
            tabPelanggan.className = 'px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-2';
        }
        if (paneTiket) paneTiket.classList.remove('hidden');
        if (panePelanggan) panePelanggan.classList.add('hidden');
        renderPesanan();
    } else {
        if (tabPelanggan) {
            tabPelanggan.className = 'px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all bg-slate-900 text-amber-400 shadow-md flex items-center gap-2';
        }
        if (tabTiket) {
            tabTiket.className = 'px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-2';
        }
        if (panePelanggan) panePelanggan.classList.remove('hidden');
        if (paneTiket) paneTiket.classList.add('hidden');
        renderPelanggan();
    }
}
window.switchPesananSubtab = switchPesananSubtab;

// Ensure renderPelanggan / renderPesanan is called when menu switches
const oldSwitchMenu = switchMenu;
window.switchMenu = function(menuId) {
    if (menuId === 'pelanggan') {
        oldSwitchMenu('pesanan');
        switchPesananSubtab('pelanggan');
        return;
    }
    oldSwitchMenu(menuId);
    if (menuId === 'pesanan') {
        switchPesananSubtab(currentPesananSubtab || 'tiket');
    }
    if (menuId === 'iklan') {
        renderIklan();
    }
};

// ========================================
// KELOLA IKLAN POP-UP
// ========================================
let cachedIklanList = [];

async function fetchIklanData() {
    try {
        const data = await fetchFromSheets('getSemuaIklan');
        if (data && Array.isArray(data)) {
            cachedIklanList = data;
        }
    } catch(e) {
        console.error('Error fetching iklan:', e);
    }
}

function renderIklan() {
    const container = document.getElementById('iklanListContainer');
    if (!container) return;

    fetchIklanData().then(() => {
        if (cachedIklanList.length === 0) {
            container.innerHTML = `
                <div class="chart-card text-center py-12 col-span-full">
                    <i class="fas fa-bullhorn text-4xl text-slate-200 mb-3"></i>
                    <p class="text-sm font-bold text-slate-400">Belum ada iklan. Klik "Tambah Iklan" untuk memulai.</p>
                </div>`;
            return;
        }

        const _now = new Date();
        const today = _now.getFullYear() + '-' + String(_now.getMonth() + 1).padStart(2, '0') + '-' + String(_now.getDate()).padStart(2, '0');
        container.innerHTML = cachedIklanList.map(iklan => {
            const isLive = iklan.isActive && iklan.tanggalMulai <= today && iklan.tanggalBerakhir >= today;
            const isExpired = iklan.tanggalBerakhir < today;
            let statusBadge, statusText;
            if (isLive) {
                statusBadge = 'bg-emerald-100 text-emerald-700';
                statusText = '● TAYANG';
            } else if (isExpired) {
                statusBadge = 'bg-red-100 text-red-600';
                statusText = '● BERAKHIR';
            } else if (iklan.isActive) {
                statusBadge = 'bg-blue-100 text-blue-600';
                statusText = '● TERJADWAL';
            } else {
                statusBadge = 'bg-slate-100 text-slate-500';
                statusText = '● NONAKTIF';
            }

            const tglMulai = new Date(iklan.tanggalMulai).toLocaleDateString('id-ID', {day:'numeric',month:'short',year:'numeric'});
            const tglAkhir = new Date(iklan.tanggalBerakhir).toLocaleDateString('id-ID', {day:'numeric',month:'short',year:'numeric'});

            return `
            <div class="chart-card overflow-hidden p-0 group hover:-translate-y-1 transition-all duration-300">
                <div class="relative">
                    <img src="${iklan.bannerUrl}" alt="${iklan.judul}" class="w-full max-h-48 object-contain bg-slate-50" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDQwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNlMmU4ZjAiLz48dGV4dCB4PSIyMDAiIHk9IjEwMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zNWVtIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzk0YTNiOCI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+'">
                    <span class="absolute top-3 left-3 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${statusBadge}">${statusText}</span>
                </div>
                <div class="p-4">
                    <h4 class="text-sm font-black text-slate-800 mb-1 truncate">${iklan.judul}</h4>
                    <p class="text-xs text-slate-500 mb-3 line-clamp-2">${iklan.deskripsiSingkat}</p>
                    <div class="flex items-center gap-2 mb-3">
                        <i class="fas fa-calendar-alt text-[10px] text-slate-400"></i>
                        <span class="text-[10px] font-bold text-slate-400">${tglMulai} — ${tglAkhir}</span>
                    </div>
                    <div class="flex items-center gap-2 mb-4">
                        <i class="fab fa-whatsapp text-[10px] text-emerald-500"></i>
                        <span class="text-[10px] font-bold text-slate-400">${iklan.nomorWhatsapp}</span>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="showPreviewFromData('${iklan.id}')" class="flex-1 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors" title="Preview">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="showEditIklanModal('${iklan.id}')" class="flex-1 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="toggleIklanStatus('${iklan.id}', ${!iklan.isActive})" class="flex-1 px-3 py-2 ${iklan.isActive ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'} rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors" title="${iklan.isActive ? 'Nonaktifkan' : 'Aktifkan'}">
                            <i class="fas fa-${iklan.isActive ? 'pause' : 'play'}"></i>
                        </button>
                        <button onclick="deleteIklan('${iklan.id}')" class="flex-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');
    });
}

function showTambahIklanModal() {
    document.getElementById('iklanModalTitle').textContent = 'Tambah Iklan';
    document.getElementById('iklanEditId').value = '';
    document.getElementById('iklanForm').reset();
    document.getElementById('iklanIsActive').checked = true; // Default to active
    document.getElementById('iklanBannerPreview').classList.add('hidden');
    document.getElementById('iklanBannerFile').required = true;
    window._iklanOriginalDataUrl = null;
    window._iklanCroppedBlob = null;
    document.getElementById('iklanModal').classList.remove('hidden');
    document.getElementById('iklanModal').style.display = 'flex';
}

function showEditIklanModal(id) {
    const iklan = cachedIklanList.find(i => i.id === id);
    if (!iklan) return;

    document.getElementById('iklanModalTitle').textContent = 'Edit Iklan';
    document.getElementById('iklanEditId').value = id;
    document.getElementById('iklanJudul').value = iklan.judul;
    document.getElementById('iklanDeskripsiSingkat').value = iklan.deskripsiSingkat;
    document.getElementById('iklanDeskripsiLengkap').value = iklan.deskripsiLengkap || '';
    document.getElementById('iklanNomorWa').value = iklan.nomorWhatsapp;
    document.getElementById('iklanPesanWa').value = iklan.pesanWhatsapp || '';
    document.getElementById('iklanTglMulai').value = iklan.tanggalMulai;
    document.getElementById('iklanTglAkhir').value = iklan.tanggalBerakhir;
    document.getElementById('iklanIsActive').checked = iklan.isActive;
    document.getElementById('iklanBannerFile').required = false;

    // Show existing banner
    const preview = document.getElementById('iklanBannerPreview');
    document.getElementById('iklanBannerImg').src = iklan.bannerUrl;
    preview.classList.remove('hidden');

    document.getElementById('iklanModal').classList.remove('hidden');
    document.getElementById('iklanModal').style.display = 'flex';
}

function closeIklanModal() {
    document.getElementById('iklanModal').classList.add('hidden');
    document.getElementById('iklanModal').style.display = 'none';
}

function previewIklanBanner(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('iklanBannerImg').src = e.target.result;
            document.getElementById('iklanBannerPreview').classList.remove('hidden');
            // Store original data URL for crop
            window._iklanOriginalDataUrl = e.target.result;
            window._iklanCroppedBlob = null; // Reset cropped blob
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// ========================================
// IMAGE CROP FUNCTIONS (Cropper.js)
// ========================================
let cropperInstance = null;

function openCropModal() {
    const src = window._iklanOriginalDataUrl || document.getElementById('iklanBannerImg').src;
    if (!src) {
        Swal.fire('Info', 'Upload gambar terlebih dahulu', 'info');
        return;
    }
    const cropImg = document.getElementById('cropImage');
    cropImg.src = src;
    document.getElementById('cropModal').classList.remove('hidden');
    document.getElementById('cropModal').style.display = 'flex';

    // Destroy previous instance
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }

    // Wait for image to load, then init cropper
    cropImg.onload = function() {
        cropperInstance = new Cropper(cropImg, {
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 0.9,
            responsive: true,
            background: false,
            guides: true,
            center: true,
            highlight: true,
        });
    };

    // Reset ratio buttons
    document.querySelectorAll('.crop-ratio-btn').forEach((btn, i) => {
        btn.className = btn.className.replace(/bg-blue-100 text-blue-700/g, 'bg-slate-100 text-slate-600');
        if (i === 0) btn.className = btn.className.replace(/bg-slate-100 text-slate-600/g, 'bg-blue-100 text-blue-700');
    });
}

function closeCropModal() {
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }
    document.getElementById('cropModal').classList.add('hidden');
    document.getElementById('cropModal').style.display = 'none';
}

function setCropAspect(ratio) {
    if (!cropperInstance) return;
    cropperInstance.setAspectRatio(ratio);

    // Update button styles
    document.querySelectorAll('.crop-ratio-btn').forEach(btn => {
        btn.className = btn.className.replace(/bg-blue-100 text-blue-700/g, 'bg-slate-100 text-slate-600');
    });
    event.target.className = event.target.className.replace(/bg-slate-100 text-slate-600/g, 'bg-blue-100 text-blue-700');
}

function applyCrop() {
    if (!cropperInstance) return;

    const canvas = cropperInstance.getCroppedCanvas({
        maxWidth: 1200,
        maxHeight: 1200,
        imageSmoothingQuality: 'high'
    });

    canvas.toBlob((blob) => {
        window._iklanCroppedBlob = blob;
        // Update preview
        const url = URL.createObjectURL(blob);
        document.getElementById('iklanBannerImg').src = url;
        closeCropModal();
        Swal.fire({ icon: 'success', title: 'Gambar di-crop!', text: 'Gambar berhasil di-crop.', timer: 1200, showConfirmButton: false });
    }, 'image/jpeg', 0.9);
}

async function submitIklan(e) {
    e.preventDefault();
    const editId = document.getElementById('iklanEditId').value;
    const isEdit = !!editId;

    const formData = new FormData();
    const bannerFile = document.getElementById('iklanBannerFile').files[0];

    // Use cropped blob if available, otherwise use original file
    if (window._iklanCroppedBlob) {
        formData.append('banner', window._iklanCroppedBlob, 'cropped-banner.jpg');
    } else if (bannerFile) {
        formData.append('banner', bannerFile);
    } else if (!isEdit) {
        Swal.fire('Error', 'File banner wajib diupload!', 'error');
        return;
    }

    formData.append('judul', document.getElementById('iklanJudul').value);
    formData.append('deskripsiSingkat', document.getElementById('iklanDeskripsiSingkat').value);
    formData.append('deskripsiLengkap', document.getElementById('iklanDeskripsiLengkap').value);
    formData.append('nomorWhatsapp', document.getElementById('iklanNomorWa').value);
    formData.append('pesanWhatsapp', document.getElementById('iklanPesanWa').value);
    formData.append('tanggalMulai', document.getElementById('iklanTglMulai').value);
    formData.append('tanggalBerakhir', document.getElementById('iklanTglAkhir').value);
    formData.append('isActive', document.getElementById('iklanIsActive').checked ? 'true' : 'false');

    try {
        const url = isEdit ? `/api/iklan/${editId}` : '/api/iklan';
        const method = isEdit ? 'PUT' : 'POST';
        const token = localStorage.getItem('adminToken');

        const res = await fetch(url, {
            method,
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        let json;
        try {
            json = await res.json();
        } catch(parseErr) {
            const text = await res.text().catch(() => '');
            console.error('Non-JSON response:', res.status, text);
            Swal.fire('Error', `Server error (${res.status}). Pastikan tabel database sudah di-migrate.`, 'error');
            return;
        }

        if (json.status === 'success') {
            Swal.fire({ icon: 'success', title: 'Berhasil!', text: json.message, timer: 1500, showConfirmButton: false });
            closeIklanModal();
            renderIklan();
        } else {
            Swal.fire('Gagal', json.message || 'Terjadi kesalahan', 'error');
        }
    } catch(err) {
        console.error('Submit iklan error:', err);
        Swal.fire('Error', 'Gagal menghubungi server. Periksa koneksi internet Anda.', 'error');
    }
}

async function toggleIklanStatus(id, isActive) {
    try {
        const res = await postToSheets('toggleIklan', { id, isActive });
        if (res.status === 'success') {
            Swal.fire({ icon: 'success', title: 'Berhasil!', text: res.message, timer: 1200, showConfirmButton: false });
            renderIklan();
        } else {
            Swal.fire('Gagal', res.message, 'error');
        }
    } catch(e) {
        Swal.fire('Error', 'Gagal menghubungi server', 'error');
    }
}

async function deleteIklan(id) {
    const result = await Swal.fire({
        title: 'Hapus Iklan?',
        text: 'Iklan yang dihapus tidak dapat dikembalikan.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal'
    });
    if (!result.isConfirmed) return;

    try {
        const res = await postToSheets('deleteIklan', { id });
        if (res.status === 'success') {
            Swal.fire({ icon: 'success', title: 'Dihapus!', text: res.message, timer: 1200, showConfirmButton: false });
            renderIklan();
        } else {
            Swal.fire('Gagal', res.message, 'error');
        }
    } catch(e) {
        Swal.fire('Error', 'Gagal menghubungi server', 'error');
    }
}

function previewIklanPopup() {
    const bannerFile = document.getElementById('iklanBannerFile').files[0];
    const existingSrc = document.getElementById('iklanBannerImg').src;
    const judul = document.getElementById('iklanJudul').value || 'Judul Iklan';
    const deskSingkat = document.getElementById('iklanDeskripsiSingkat').value || 'Deskripsi singkat iklan';
    const deskLengkap = document.getElementById('iklanDeskripsiLengkap').value || '';
    const nomorWa = document.getElementById('iklanNomorWa').value || '6281234567890';
    const pesanWa = document.getElementById('iklanPesanWa').value || 'Halo, saya tertarik dengan iklan Anda';

    document.getElementById('previewJudul').textContent = judul;
    document.getElementById('previewDeskripsiSingkat').textContent = deskSingkat;
    document.getElementById('previewDeskripsiLengkap').textContent = deskLengkap;
    document.getElementById('previewDeskripsiLengkapWrap').classList.add('hidden');
    document.getElementById('previewWaBtn').href = `https://wa.me/${nomorWa.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(pesanWa)}`;

    if (bannerFile) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('previewBannerImg').src = e.target.result;
            document.getElementById('iklanPreviewModal').classList.remove('hidden');
            document.getElementById('iklanPreviewModal').style.display = 'flex';
        };
        reader.readAsDataURL(bannerFile);
    } else if (existingSrc) {
        document.getElementById('previewBannerImg').src = existingSrc;
        document.getElementById('iklanPreviewModal').classList.remove('hidden');
        document.getElementById('iklanPreviewModal').style.display = 'flex';
    } else {
        Swal.fire('Info', 'Upload banner terlebih dahulu untuk preview', 'info');
    }
}

function showPreviewFromData(id) {
    const iklan = cachedIklanList.find(i => i.id === id);
    if (!iklan) return;

    document.getElementById('previewBannerImg').src = iklan.bannerUrl;
    document.getElementById('previewJudul').textContent = iklan.judul;
    document.getElementById('previewDeskripsiSingkat').textContent = iklan.deskripsiSingkat;
    document.getElementById('previewDeskripsiLengkap').textContent = iklan.deskripsiLengkap || '';
    document.getElementById('previewDeskripsiLengkapWrap').classList.add('hidden');
    document.getElementById('previewWaBtn').href = `https://wa.me/${(iklan.nomorWhatsapp || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(iklan.pesanWhatsapp || 'Halo, saya tertarik dengan iklan Anda')}`;

    document.getElementById('iklanPreviewModal').classList.remove('hidden');
    document.getElementById('iklanPreviewModal').style.display = 'flex';
}



/* === FITUR DENAH & WIZARD 3 TAHAPAN === */

// State Subtab Armada & Denah
let currentArmadaSubtab = 'list';
let currentDenahKategori = 'ALL';

function switchArmadaSubtab(sub) {
    currentArmadaSubtab = sub;
    const tabList = document.getElementById('tabBtnArmadaList');
    const tabDenah = document.getElementById('tabBtnArmadaDenah');
    const paneList = document.getElementById('subtabArmadaList');
    const paneDenah = document.getElementById('subtabArmadaDenah');
    const actList = document.getElementById('armadaActionsList');
    const actDenah = document.getElementById('armadaActionsDenah');

    if (sub === 'list') {
        if (tabList) { tabList.className = 'px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all bg-slate-900 text-amber-400 shadow-md flex items-center gap-2'; }
        if (tabDenah) { tabDenah.className = 'px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-2'; }
        if (paneList) paneList.classList.remove('hidden');
        if (paneDenah) paneDenah.classList.add('hidden');
        if (actList) actList.classList.remove('hidden');
        if (actDenah) actDenah.classList.add('hidden');
        renderArmada();
    } else {
        if (tabDenah) { tabDenah.className = 'px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all bg-slate-900 text-amber-400 shadow-md flex items-center gap-2'; }
        if (tabList) { tabList.className = 'px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-2'; }
        if (paneDenah) paneDenah.classList.remove('hidden');
        if (paneList) paneList.classList.add('hidden');
        if (actDenah) actDenah.classList.remove('hidden');
        if (actList) actList.classList.add('hidden');
        renderDenahCards();
    }
}

function filterDenahKategori(cat) {
    currentDenahKategori = cat;
    document.querySelectorAll('.denah-cat-pill').forEach(btn => {
        if (btn.getAttribute('data-cat') === cat) {
            btn.className = 'denah-cat-pill active px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-900 text-amber-400 shadow-sm transition-all';
        } else {
            btn.className = 'denah-cat-pill px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-white text-slate-600 border border-slate-200 hover:border-amber-400 shadow-sm transition-all';
        }
    });
    renderDenahCards();
}

// Seat Map DOM Generator
function buildSeatMapElement(layout, { taken = {}, selected = new Set(), onSeat = null, compact = false, currentUserSeat = '' } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'seatmap' + (compact ? ' is-compact' : '');
    
    const front = document.createElement('div');
    front.className = 'seatmap-front';
    front.innerHTML = '<i class="fas fa-arrow-up"></i> DEPAN (SUPIR)';
    wrap.appendChild(front);

    const grid = document.createElement('div');
    grid.className = 'seatmap-grid';
    grid.style.gridTemplateColumns = 'repeat(' + (layout.kolom || 4) + ', minmax(0, 1fr))';

    const cells = Array.isArray(layout.cells) ? layout.cells : (typeof layout.cells === 'string' ? JSON.parse(layout.cells || '[]') : []);

    cells.forEach((c) => {
        if (c.t === 'seat') {
            const seatNo = String(c.l || '').trim();
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'seat';
            btn.setAttribute('data-seat', seatNo);

            const isTaken = !!taken[seatNo];
            const isSel = selected.has(seatNo);
            const isUser = currentUserSeat && currentUserSeat.split(',').map(s=>s.trim()).includes(seatNo);

            if (isSel) {
                btn.classList.add('is-selected');
            } else if (isUser) {
                btn.classList.add('is-current-user');
            } else if (isTaken) {
                btn.classList.add('is-booked');
                btn.disabled = true;
                btn.title = 'Kursi ' + seatNo + ' sudah dibooking';
            }

            btn.innerHTML = '<span>' + seatNo + '</span>';
            if (onSeat) {
                btn.onclick = (e) => {
                    e.preventDefault();
                    onSeat(seatNo, isTaken, btn);
                };
            }
            grid.appendChild(btn);
        } else if (c.t === 'driver') {
            const div = document.createElement('div');
            div.className = 'seat-cell seat-cell-driver';
            div.innerHTML = '<i class="fas fa-id-card-alt text-sm"></i><small>Supir</small>';
            grid.appendChild(div);
        } else if (c.t === 'door') {
            const div = document.createElement('div');
            div.className = 'seat-cell seat-cell-door';
            div.innerHTML = '<i class="fas fa-door-open text-xs"></i><small>Pintu</small>';
            grid.appendChild(div);
        } else {
            const div = document.createElement('div');
            div.className = 'seat-cell';
            grid.appendChild(div);
        }
    });

    wrap.appendChild(grid);
    return wrap;
}

// Render Denah Cards in Subtab 2
function renderDenahCards() {
    const grid = document.getElementById('denahCardGrid');
    if (!grid) return;

    let denahList = (typeof getDenahList === 'function' ? getDenahList() : []) || [];
    if (currentDenahKategori !== 'ALL') {
        denahList = denahList.filter(d => (d.kategori || '').toLowerCase() === currentDenahKategori.toLowerCase());
    }

    if (!denahList.length) {
        grid.innerHTML = `<div class="col-span-full py-12 text-center bg-white rounded-3xl border border-slate-200">
            <i class="fas fa-chair text-4xl text-slate-300 mb-3 block"></i>
            <p class="font-extrabold text-slate-600 text-sm">Belum ada format denah untuk kategori ini</p>
            <button onclick="openDenahEditor()" class="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition-all">
                + Buat Format Denah Baru
            </button>
        </div>`;
        return;
    }

    grid.innerHTML = '';
    denahList.forEach(d => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between';
        
        const totalKursi = d.totalKursi || (Array.isArray(d.cells) ? d.cells.filter(c => c.t === 'seat').length : 0);
        
        const header = document.createElement('div');
        header.className = 'flex items-start justify-between gap-3 mb-4';
        header.innerHTML = `
            <div>
                <span class="text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full inline-block mb-1">${d.kategori || 'Bus Besar'}</span>
                <h4 class="font-black text-slate-800 text-base leading-snug">${d.nama}</h4>
                <p class="text-[11px] font-bold text-slate-400 mt-0.5">${d.baris} baris × ${d.kolom} kolom • <b class="text-amber-600">${totalKursi} kursi</b></p>
            </div>
            <div class="flex gap-1.5 flex-shrink-0">
                <button type="button" class="btn-edit-denah w-8 h-8 rounded-xl bg-slate-100 hover:bg-amber-500 hover:text-white text-slate-600 flex items-center justify-center text-xs transition-colors shadow-sm" title="Edit Denah">
                    <i class="fas fa-edit"></i>
                </button>
                <button type="button" class="btn-del-denah w-8 h-8 rounded-xl bg-slate-100 hover:bg-red-500 hover:text-white text-slate-600 flex items-center justify-center text-xs transition-colors shadow-sm" title="Hapus Denah">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        card.appendChild(header);

        // Compact Seat Map Preview
        const previewWrap = document.createElement('div');
        previewWrap.className = 'my-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden';
        previewWrap.appendChild(buildSeatMapElement(d, { compact: true }));
        card.appendChild(previewWrap);

        // Actions handlers
        header.querySelector('.btn-edit-denah').onclick = () => openDenahEditor(d);
        header.querySelector('.btn-del-denah').onclick = () => deleteDenah(d.id);

        grid.appendChild(card);
    });
}

// Visual Layout Editor State
let editorLayoutItem = null;
let editorRows = 5;
let editorCols = 4;
let editorCells = [];
let editorTool = 'seat';

function openDenahEditor(item = null) {
    editorLayoutItem = item;
    editorRows = item?.baris || 5;
    editorCols = item?.kolom || 4;
    editorTool = 'seat';

    if (item && item.cells) {
        editorCells = typeof item.cells === 'string' ? JSON.parse(item.cells) : JSON.parse(JSON.stringify(item.cells));
    } else {
        editorCells = [];
        const need = editorRows * editorCols;
        for (let i = 0; i < need; i++) editorCells.push({ t: 'empty' });
        // Driver at top right
        if (editorCells[editorCols - 1]) editorCells[editorCols - 1] = { t: 'driver' };
        if (editorCells[0]) editorCells[0] = { t: 'seat', l: '1' };
    }

    document.getElementById('denahEditorId').value = item?.id || '';
    document.getElementById('denahEditorNama').value = item?.nama || '';
    document.getElementById('denahEditorRows').value = editorRows;
    document.getElementById('denahEditorCols').value = editorCols;
    document.getElementById('denahEditorModalTitle').innerText = item ? 'Edit Format Denah: ' + item.nama : 'Buat Format Denah Baru';

    const katSelect = document.getElementById('denahEditorKategori');
    const customInput = document.getElementById('denahEditorKategoriCustom');
    const itemKat = item?.kategori || 'Bus Besar';
    const foundOpt = Array.from(katSelect.options).find(o => o.value.toLowerCase() === itemKat.toLowerCase());
    if (foundOpt) {
        katSelect.value = foundOpt.value;
        customInput.classList.add('hidden');
    } else {
        katSelect.value = 'CUSTOM';
        customInput.classList.remove('hidden');
        customInput.value = itemKat;
    }

    // Set active tool
    document.querySelectorAll('#denahEditorTools button').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tool') === 'seat');
        b.onclick = () => {
            editorTool = b.getAttribute('data-tool');
            document.querySelectorAll('#denahEditorTools button').forEach(x => x.classList.toggle('active', x === b));
        };
    });

    drawDenahEditorGrid();

    const m = document.getElementById('modalDenahEditor');
    const c = document.getElementById('modalDenahEditorContent');
    m.classList.remove('hidden');
    m.classList.add('flex');
    setTimeout(() => {
        c.classList.remove('scale-95', 'opacity-0');
        c.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function closeDenahEditor() {
    const m = document.getElementById('modalDenahEditor');
    const c = document.getElementById('modalDenahEditorContent');
    if (c) {
        c.classList.remove('scale-100', 'opacity-100');
        c.classList.add('scale-95', 'opacity-0');
    }
    setTimeout(() => {
        if (m) {
            m.classList.remove('flex');
            m.classList.add('hidden');
        }
    }, 300);
}

function toggleCustomDenahKategori() {
    const sel = document.getElementById('denahEditorKategori');
    const custom = document.getElementById('denahEditorKategoriCustom');
    if (sel.value === 'CUSTOM') {
        custom.classList.remove('hidden');
        custom.focus();
    } else {
        custom.classList.add('hidden');
    }
}

function syncEditorCellsSize() {
    const need = editorRows * editorCols;
    while (editorCells.length < need) editorCells.push({ t: 'empty' });
    editorCells = editorCells.slice(0, need);
}

function getNextSeatNo() {
    const used = new Set(editorCells.filter(c => c.t === 'seat').map(c => String(c.l || '').trim()));
    let n = 1;
    while (used.has(String(n))) n++;
    return String(n);
}

function drawDenahEditorGrid() {
    syncEditorCellsSize();
    const g = document.getElementById('denahEditorGrid');
    if (!g) return;

    g.style.gridTemplateColumns = 'repeat(' + editorCols + ', minmax(0, 1fr))';
    g.innerHTML = '';

    let seatCount = 0;
    editorCells.forEach((c, idx) => {
        const cellBtn = document.createElement('button');
        cellBtn.type = 'button';
        cellBtn.className = 'le-cell';

        if (c.t === 'seat') {
            seatCount++;
            cellBtn.classList.add('t-seat');
            cellBtn.innerHTML = '<span>' + (c.l || '?') + '</span><small>Kursi</small>';
        } else if (c.t === 'driver') {
            cellBtn.classList.add('t-driver');
            cellBtn.innerHTML = '<i class="fas fa-id-card-alt"></i><small>Sopir</small>';
        } else if (c.t === 'door') {
            cellBtn.classList.add('t-door');
            cellBtn.innerHTML = '<i class="fas fa-door-open"></i><small>Pintu</small>';
        } else {
            cellBtn.innerHTML = '<small class="text-slate-300">Lorong</small>';
        }

        cellBtn.onclick = () => {
            const cur = editorCells[idx];
            if (editorTool === 'seat' && cur.t === 'seat') {
                const nl = prompt('Ubah nomor/kode kursi (kosongkan untuk hapus kursi):', cur.l || '');
                if (nl === null) return;
                if (!nl.trim()) editorCells[idx] = { t: 'empty' };
                else editorCells[idx] = { t: 'seat', l: nl.trim().slice(0, 6) };
            } else if (editorTool === 'seat') {
                editorCells[idx] = { t: 'seat', l: getNextSeatNo() };
            } else {
                editorCells[idx] = { t: editorTool };
            }
            drawDenahEditorGrid();
        };

        g.appendChild(cellBtn);
    });

    document.getElementById('denahEditorTotalKursiDisplay').innerText = seatCount + ' kursi penumpang';
}

function onDenahDimensionsChange() {
    editorRows = Math.min(Math.max(parseInt(document.getElementById('denahEditorRows').value) || 1, 1), 15);
    editorCols = Math.min(Math.max(parseInt(document.getElementById('denahEditorCols').value) || 1, 1), 6);
    drawDenahEditorGrid();
}

function autoNumberDenahSeats() {
    let n = 1;
    editorCells.forEach(c => {
        if (c.t === 'seat') {
            c.l = String(n++);
        }
    });
    drawDenahEditorGrid();
    if (typeof showMessage === 'function') showMessage('Nomor kursi berhasil diurutkan!');
}

async function submitDenahEditor() {
    const nama = document.getElementById('denahEditorNama').value.trim();
    if (!nama) {
        alert('Nama format denah kursi wajib diisi!');
        return;
    }

    let kategori = document.getElementById('denahEditorKategori').value;
    if (kategori === 'CUSTOM') {
        kategori = document.getElementById('denahEditorKategoriCustom').value.trim() || 'Bus Besar';
    }

    const totalKursi = editorCells.filter(c => c.t === 'seat').length;
    if (totalKursi < 1) {
        alert('Denah minimal harus memiliki 1 kursi!');
        return;
    }

    const payload = {
        id: document.getElementById('denahEditorId').value || '',
        nama: nama,
        kategori: kategori,
        baris: editorRows,
        kolom: editorCols,
        totalKursi: totalKursi,
        cells: editorCells
    };

    const action = payload.id ? 'editDenahArmada' : 'addDenahArmada';
    try {
        const res = await postToSheets(action, payload);
        if (res.status === 'success') {
            if (typeof showMessage === 'function') showMessage('Format denah tempat duduk berhasil disimpan!');
            closeDenahEditor();
            await refreshData();
            renderDenahCards();
        } else {
            alert(res.message || 'Gagal menyimpan denah');
        }
    } catch (e) {
        alert(e.message);
    }
}

async function deleteDenah(id) {
    if (!confirm('Yakin ingin menghapus format denah tempat duduk ini?')) return;
    try {
        const res = await postToSheets('deleteDenahArmada', { id });
        if (res.status === 'success') {
            if (typeof showMessage === 'function') showMessage('Format denah tempat duduk berhasil dihapus');
            await refreshData();
            renderDenahCards();
        } else {
            alert(res.message || 'Gagal menghapus denah');
        }
    } catch (e) {
        alert(e.message);
    }
}

// Helper populate dropdown denah di form armada
function populateDenahDropdown(selectId, selectedId = null, filterTipe = null) {
    const sel = document.getElementById(selectId);
    if (!sel) return;

    const denahList = (typeof getDenahList === 'function' ? getDenahList() : []) || [];
    let html = '<option value="">-- Pilih Format Denah --</option>';

    denahList.forEach(d => {
        const isMatch = selectedId && selectedId === d.id;
        const total = d.totalKursi || (Array.isArray(d.cells) ? d.cells.filter(c => c.t === 'seat').length : 0);
        html += `<option value="${d.id}" ${isMatch ? 'selected' : ''}>${d.nama} (${d.kategori} - ${total} Kursi)</option>`;
    });

    sel.innerHTML = html;
}

function onArmadaTipeChange(mode) {
    const tipe = document.getElementById(mode + 'ArmadaTipe')?.value;
    const denahSelect = document.getElementById(mode + 'ArmadaDenah');
    if (!denahSelect || !tipe) return;

    // Filter or highlight best matching denah
    const denahList = (typeof getDenahList === 'function' ? getDenahList() : []) || [];
    const bestMatch = denahList.find(d => (d.kategori || '').toLowerCase() === tipe.toLowerCase());
    if (bestMatch && !denahSelect.value) {
        denahSelect.value = bestMatch.id;
        onArmadaDenahChange(mode);
    }
}

function onArmadaDenahChange(mode) {
    const denahId = document.getElementById(mode + 'ArmadaDenah')?.value;
    const seatInput = document.getElementById(mode + 'ArmadaSeat');
    if (!denahId || !seatInput) return;

    const denah = typeof getDenah === 'function' ? getDenah(denahId) : null;
    if (denah) {
        const total = denah.totalKursi || (Array.isArray(denah.cells) ? denah.cells.filter(c => c.t === 'seat').length : 0);
        if (total > 0) {
            seatInput.value = total;
        }
    }
}

/* ====================================================================
 * WIZARD 3 TAHAPAN BOOKING TIKET ADMIN & PEMILIHAN TEMPAT DUDUK INTERAKTIF
 * ==================================================================== */
let adminBookingStep = 1;
let adminBookingSelectedSeats = new Set();
let adminBookingTakenSeats = {};

function goToBookingStep(step) {
    // Validasi saat meninggalkan Step 1
    if (adminBookingStep === 1 && step > 1) {
        const dateVal = document.getElementById('adminBookingDate').value;
        const armadaVal = document.getElementById('adminBookingArmada').value;
        if (!dateVal) {
            alert('Silakan pilih tanggal pemberangkatan terlebih dahulu!');
            document.getElementById('adminBookingDate').focus();
            return;
        }
        if (!armadaVal) {
            alert('Silakan pilih armada, jam, dan rute perjalanan terlebih dahulu!');
            document.getElementById('adminBookingArmada').focus();
            return;
        }
    }

    // Validasi saat meninggalkan Step 2 menuju Step 3
    if (adminBookingStep === 2 && step > 2) {
        const nama = document.getElementById('adminBookingNama').value.trim();
        const hp = document.getElementById('adminBookingHp').value.trim();
        if (!nama) {
            alert('Nama penumpang wajib diisi!');
            document.getElementById('adminBookingNama').focus();
            return;
        }
        if (!hp) {
            alert('Nomor HP / WhatsApp penumpang wajib diisi!');
            document.getElementById('adminBookingHp').focus();
            return;
        }

        const qty = parseInt(document.getElementById('adminBookingPnp').value) || 1;
        if (adminBookingSelectedSeats.size > qty) {
            alert('Jumlah kursi yang dipilih (' + adminBookingSelectedSeats.size + ') melebihi jumlah penumpang (' + qty + '). Silakan batalkan pilihan kursi yang berlebih.');
            return;
        }
    }

    adminBookingStep = step;

    // Toggle Step Badges
    for (let i = 1; i <= 3; i++) {
        const badge = document.getElementById('bookingStepBadge' + i);
        const pane = document.getElementById('bookingStepPane' + i);
        if (badge) {
            badge.classList.remove('active', 'completed');
            if (i === step) badge.classList.add('active');
            else if (i < step) badge.classList.add('completed');
        }
        if (pane) {
            pane.classList.toggle('hidden', i !== step);
        }
    }

    if (step === 2) {
        loadAdminBookingSeatMap();
    } else if (step === 3) {
        updateAdminBookingSummary();
    }
}

async function onAdminBookingTripChange() {
    recalcAdminBooking();
    const armadaId = document.getElementById('adminBookingArmada')?.value;
    const armada = typeof getArmada === 'function' ? getArmada(armadaId) : null;
    const infoText = document.getElementById('adminBookingArmadaInfoText');
    const tarifBadge = document.getElementById('adminBookingTarifBadge');
    
    if (armada) {
        const rawDate = document.getElementById('adminBookingDate')?.value;
        const dObj = rawDate ? new Date(rawDate) : null;
        const effectivePrice = typeof getEffectiveHarga === 'function' ? getEffectiveHarga(armada, dObj) : armada.price;
        if (infoText) infoText.innerHTML = '<b>' + armada.name + '</b> (' + (armada.tipeArmada || 'Bus') + ') • Rute: ' + armada.destination + ' • Jam: ' + armada.time;
        if (tarifBadge) tarifBadge.innerText = formatRupiah(effectivePrice) + ' / kursi';
    } else {
        if (infoText) infoText.innerText = 'Silakan pilih armada, jam, dan rute di atas';
        if (tarifBadge) tarifBadge.innerText = 'Rp0 / kursi';
    }

    // Refresh seat map if currently in step 2
    if (adminBookingStep === 2) {
        loadAdminBookingSeatMap();
    }
}

function onAdminBookingPnpChange() {
    recalcAdminBooking();
    updateAdminBookingSeatBadge();
}

function updateAdminBookingSeatBadge() {
    const qty = parseInt(document.getElementById('adminBookingPnp')?.value) || 1;
    const selCount = adminBookingSelectedSeats.size;
    const badge = document.getElementById('adminBookingSeatCounterBadge');
    const disp = document.getElementById('adminBookingSelectedSeatsDisplay');

    if (badge) {
        badge.innerText = selCount + '/' + qty + ' kursi';
        if (selCount === qty) {
            badge.className = 'ml-2 text-[10px] bg-green-100 text-green-800 font-extrabold px-2 py-0.5 rounded-full';
        } else if (selCount > qty) {
            badge.className = 'ml-2 text-[10px] bg-red-100 text-red-800 font-extrabold px-2 py-0.5 rounded-full';
        } else {
            badge.className = 'ml-2 text-[10px] bg-slate-200 text-slate-700 font-extrabold px-2 py-0.5 rounded-full';
        }
    }

    if (disp) {
        if (selCount === 0) {
            disp.innerText = 'Belum memilih kursi (Bisa dilewati)';
            disp.className = 'font-bold text-slate-400 text-xs ml-1 italic';
        } else {
            disp.innerText = [...adminBookingSelectedSeats].join(', ');
            disp.className = 'font-black text-amber-600 text-sm ml-1';
        }
    }
}

function clearAdminBookingSeats() {
    adminBookingSelectedSeats.clear();
    updateAdminBookingSeatBadge();
    loadAdminBookingSeatMap(false);
}

// Fetch taken seats for selected trip & render denah
async function loadAdminBookingSeatMap(refetchTaken = true) {
    const container = document.getElementById('adminBookingDenahContainer');
    if (!container) return;

    const armadaId = document.getElementById('adminBookingArmada')?.value;
    const armada = typeof getArmada === 'function' ? getArmada(armadaId) : null;
    const rawDate = document.getElementById('adminBookingDate')?.value;

    if (!armada || !rawDate) {
        container.innerHTML = '<div class="text-slate-400 text-xs font-bold py-6 text-center">Jadwal atau Armada belum dipilih di Tahap 1</div>';
        return;
    }

    // Determine layout: armada.denahId or default
    let layout = null;
    if (armada.denahId && typeof getDenah === 'function') {
        layout = getDenah(armada.denahId);
    }
    if (!layout && typeof getDenahList === 'function') {
        const allDenah = getDenahList();
        layout = allDenah.find(d => (d.kategori || '').toLowerCase() === (armada.tipeArmada || '').toLowerCase()) || allDenah[0];
    }

    if (!layout) {
        container.innerHTML = '<div class="text-slate-400 text-xs font-bold py-6 text-center">Format denah belum tersedia untuk tipe armada ini</div>';
        return;
    }

    document.getElementById('adminBookingDenahTipeLabel').innerText = armada.tipeArmada || 'Bus';
    document.getElementById('adminBookingDenahNamaLabel').innerText = layout.nama;

    // Load Taken Seats from cache & server
    if (refetchTaken) {
        adminBookingTakenSeats = {};
        
        // 1. Ambil dari cachedBookings yang sudah ada di memori
        const [yyyy, mm, dd] = rawDate.split('-');
        const dObj = new Date(parseInt(yyyy), parseInt(mm)-1, parseInt(dd));
        const formattedDate = INDO_DAYS[dObj.getDay()] + ', ' + dObj.getDate() + ' ' + INDO_MONTHS[dObj.getMonth()] + ' ' + dObj.getFullYear();
        
        const allBookings = (typeof getBookings === 'function' ? getBookings() : []) || [];
        allBookings.forEach(b => {
            if (b.status === 'DITOLAK' || b.status === 'CANCEL') return;
            const bDate = b.dateTravel || b['TANGGAL PEMBERANGKATAN'];
            const bArmada = b.armada || b['JENIS KENDARAAN'];
            const bWaktu = b.waktu || b['WAKTU'];

            if (bDate === formattedDate && bArmada === armada.name && (!bWaktu || bWaktu === armada.time)) {
                const seatStr = b.kursi || b['NOMOR KURSI'] || '';
                if (seatStr && seatStr !== '-') {
                    seatStr.split(',').forEach(s => {
                        const trimmed = s.trim();
                        if (trimmed) adminBookingTakenSeats[trimmed] = { status: b.status, name: b.name };
                    });
                }
            }
        });

        // 2. Query server for freshness
        try {
            const apiRes = await fetchFromSheets('getTakenSeats', '&tanggal=' + encodeURIComponent(formattedDate) + '&armada=' + encodeURIComponent(armada.name) + '&waktu=' + encodeURIComponent(armada.time));
            if (apiRes && apiRes.data && apiRes.data.taken) {
                Object.assign(adminBookingTakenSeats, apiRes.data.taken);
            }
        } catch(e) {}
    }

    // Clean up selected seats if already taken
    [...adminBookingSelectedSeats].forEach(s => {
        if (adminBookingTakenSeats[s]) adminBookingSelectedSeats.delete(s);
    });

    container.innerHTML = '';
    const seatMapEl = buildSeatMapElement(layout, {
        taken: adminBookingTakenSeats,
        selected: adminBookingSelectedSeats,
        onSeat: (seatNo, isTaken) => {
            if (isTaken) {
                if (typeof showMessage === 'function') showMessage('Kursi ' + seatNo + ' sudah terisi oleh penumpang lain!', 'warning');
                return;
            }
            const qty = parseInt(document.getElementById('adminBookingPnp').value) || 1;
            if (adminBookingSelectedSeats.has(seatNo)) {
                adminBookingSelectedSeats.delete(seatNo);
            } else {
                if (adminBookingSelectedSeats.size >= qty) {
                    if (qty === 1) {
                        adminBookingSelectedSeats.clear();
                        adminBookingSelectedSeats.add(seatNo);
                    } else {
                        alert('Jumlah kursi yang dipilih sudah mencapai ' + qty + ' kursi. Batalkan kursi lain terlebih dahulu jika ingin mengganti.');
                        return;
                    }
                } else {
                    adminBookingSelectedSeats.add(seatNo);
                }
            }
            updateAdminBookingSeatBadge();
            loadAdminBookingSeatMap(false);
        }
    });

    container.appendChild(seatMapEl);
    updateAdminBookingSeatBadge();
}

function updateAdminBookingSummary() {
    const armadaId = document.getElementById('adminBookingArmada')?.value;
    const armada = typeof getArmada === 'function' ? getArmada(armadaId) : null;
    const rawDate = document.getElementById('adminBookingDate')?.value;
    const tipePerjalanan = document.querySelector('input[name="adminTipePerjalanan"]:checked')?.value || 'Berangkat';

    let formattedDate = rawDate;
    if (rawDate) {
        const [yyyy, mm, dd] = rawDate.split('-');
        const dObj = new Date(parseInt(yyyy), parseInt(mm)-1, parseInt(dd));
        formattedDate = INDO_DAYS[dObj.getDay()] + ', ' + dObj.getDate() + ' ' + INDO_MONTHS[dObj.getMonth()] + ' ' + dObj.getFullYear();
    }

    const qty = parseInt(document.getElementById('adminBookingPnp')?.value) || 1;
    const nama = document.getElementById('adminBookingNama')?.value || '-';

    document.getElementById('summaryAdminTipeTrip').innerText = tipePerjalanan;
    document.getElementById('summaryAdminArmada').innerText = (armada ? armada.name : '-') + ' (' + (armada?.tipeArmada || 'Bus') + ')';
    document.getElementById('summaryAdminRute').innerText = armada ? armada.destination : '-';
    document.getElementById('summaryAdminJadwal').innerText = formattedDate + ' • ' + (armada ? armada.time : '-');
    document.getElementById('summaryAdminNama').innerText = nama;
    document.getElementById('summaryAdminPnp').innerText = qty + ' Penumpang';

    const seatDisp = document.getElementById('summaryAdminKursi');
    if (adminBookingSelectedSeats.size > 0) {
        seatDisp.innerText = [...adminBookingSelectedSeats].join(', ');
        seatDisp.className = 'text-amber-600 font-black text-sm';
    } else {
        seatDisp.innerText = 'Dilewati / Belum ditentukan';
        seatDisp.className = 'text-slate-400 font-bold text-xs italic';
    }

    recalcAdminBooking();
}

// Reset admin booking
function resetAdminBooking() {
    document.getElementById('formAdminBooking').reset();
    
    // Set default tanggal keberangkatan ke hari ini (YYYY-MM-DD lokal)
    const todayStr = (typeof getLocalYYYYMMDD === 'function') ? getLocalYYYYMMDD(new Date()) : new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('adminBookingDate');
    if (dateInput) {
        dateInput.value = todayStr;
    }

    adminBookingStep = 1;
    adminBookingSelectedSeats.clear();
    adminBookingTakenSeats = {};
    for (let i = 1; i <= 3; i++) {
        const badge = document.getElementById('bookingStepBadge' + i);
        const pane = document.getElementById('bookingStepPane' + i);
        if (badge) {
            badge.classList.remove('active', 'completed');
            if (i === 1) badge.classList.add('active');
        }
        if (pane) pane.classList.toggle('hidden', i !== 1);
    }
    recalcAdminBooking();
}

/* ====================================================================
 * EDIT BOOKING MODAL WITH INTERACTIVE SEAT SELECTION
 * ==================================================================== */
let editBookingSelectedSeats = new Set();
let editBookingTakenSeats = {};

async function loadEditBookingSeatMap(bookingId, armada, formattedDate, initialKursiArr = []) {
    const container = document.getElementById('editBookingDenahContainer');
    if (!container) return;

    if (!armada) {
        container.innerHTML = '<div class="text-slate-400 text-xs font-bold py-4 text-center">Pilih armada untuk melihat denah</div>';
        return;
    }

    let layout = null;
    if (armada.denahId && typeof getDenah === 'function') {
        layout = getDenah(armada.denahId);
    }
    if (!layout && typeof getDenahList === 'function') {
        const allDenah = getDenahList();
        layout = allDenah.find(d => (d.kategori || '').toLowerCase() === (armada.tipeArmada || '').toLowerCase()) || allDenah[0];
    }

    if (!layout) {
        container.innerHTML = '<div class="text-slate-400 text-xs font-bold py-4 text-center">Format denah belum tersedia</div>';
        return;
    }

    document.getElementById('editBookingDenahInfoText').innerText = layout.nama + ' (' + (armada.tipeArmada || 'Bus') + ')';

    // Populate Taken seats excluding this booking
    editBookingTakenSeats = {};
    const allBookings = (typeof getBookings === 'function' ? getBookings() : []) || [];
    allBookings.forEach(b => {
        if (b.bookingId === bookingId || b.status === 'DITOLAK' || b.status === 'CANCEL') return;
        const bDate = b.dateTravel || b['TANGGAL PEMBERANGKATAN'];
        const bArmada = b.armada || b['JENIS KENDARAAN'];
        const bWaktu = b.waktu || b['WAKTU'];

        if (bDate === formattedDate && bArmada === armada.name && (!bWaktu || bWaktu === armada.time)) {
            const seatStr = b.kursi || b['NOMOR KURSI'] || '';
            if (seatStr && seatStr !== '-') {
                seatStr.split(',').forEach(s => {
                    const trimmed = s.trim();
                    if (trimmed) editBookingTakenSeats[trimmed] = { status: b.status, name: b.name };
                });
            }
        }
    });

    container.innerHTML = '';
    const seatMapEl = buildSeatMapElement(layout, {
        taken: editBookingTakenSeats,
        selected: editBookingSelectedSeats,
        compact: true,
        onSeat: (seatNo, isTaken) => {
            if (isTaken) {
                if (typeof showMessage === 'function') showMessage('Kursi ' + seatNo + ' sudah dibooking penumpang lain!', 'warning');
                return;
            }
            const qty = parseInt(document.getElementById('editBookingPnp').value) || 1;
            if (editBookingSelectedSeats.has(seatNo)) {
                editBookingSelectedSeats.delete(seatNo);
            } else {
                if (editBookingSelectedSeats.size >= qty) {
                    if (qty === 1) {
                        editBookingSelectedSeats.clear();
                        editBookingSelectedSeats.add(seatNo);
                    } else {
                        alert('Jumlah kursi yang dipilih sudah mencapai ' + qty + ' kursi. Batalkan kursi lain terlebih dahulu.');
                        return;
                    }
                } else {
                    editBookingSelectedSeats.add(seatNo);
                }
            }
            updateEditBookingSeatDisplay();
            loadEditBookingSeatMap(bookingId, armada, formattedDate);
        }
    });

    container.appendChild(seatMapEl);
    updateEditBookingSeatDisplay();
}

function updateEditBookingSeatDisplay() {
    const qty = parseInt(document.getElementById('editBookingPnp')?.value) || 1;
    const selCount = editBookingSelectedSeats.size;
    const badge = document.getElementById('editBookingSeatCounterBadge');
    const disp = document.getElementById('editBookingSelectedSeatsDisplay');
    const hidden = document.getElementById('editBookingKursiHidden');

    if (badge) badge.innerText = selCount + '/' + qty;
    if (disp) {
        if (selCount === 0) {
            disp.innerText = 'Belum memilih kursi';
            disp.className = 'font-bold text-slate-400 text-xs ml-1 italic';
        } else {
            disp.innerText = [...editBookingSelectedSeats].join(', ');
            disp.className = 'font-black text-amber-600 text-sm ml-1';
        }
    }
    if (hidden) {
        hidden.value = [...editBookingSelectedSeats].join(', ');
    }
}

function clearEditBookingSeats() {
    editBookingSelectedSeats.clear();
    updateEditBookingSeatDisplay();
    const id = document.getElementById('editBookingId')?.value;
    const armadaId = document.getElementById('editBookingArmada')?.value;
    const armada = typeof getArmada === 'function' ? getArmada(armadaId) : null;
    const rawDate = document.getElementById('editBookingDate')?.value;
    loadEditBookingSeatMap(id, armada, rawDate);
}

    if (typeof toggleDashboardNominal !== 'undefined') window.toggleDashboardNominal = toggleDashboardNominal;
