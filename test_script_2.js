
let adminsData = [];
async function renderAkun() {
    const tbody = document.getElementById('akunTableBody');
    if (!tbody) return;
    tbody.innerHTML = `
        <tr class="animate-pulse border-b border-slate-50"><td colspan="4" class="p-4"><div class="flex items-center gap-4"><div class="w-8 h-8 bg-slate-200 rounded flex-shrink-0"></div><div class="flex-1 space-y-2"><div class="h-4 bg-slate-200 rounded w-1/3"></div><div class="h-3 bg-slate-100 rounded w-1/4"></div></div><div class="w-16 h-6 bg-slate-200 rounded-lg flex-shrink-0"></div></div></td></tr>
        <tr class="animate-pulse border-b border-slate-50"><td colspan="4" class="p-4"><div class="flex items-center gap-4"><div class="w-8 h-8 bg-slate-200 rounded flex-shrink-0"></div><div class="flex-1 space-y-2"><div class="h-4 bg-slate-200 rounded w-1/2"></div><div class="h-3 bg-slate-100 rounded w-1/3"></div></div><div class="w-16 h-6 bg-slate-200 rounded-lg flex-shrink-0"></div></div></td></tr>
    `;
    
    try {
        const res = await fetch('/api?action=getAdmin');
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
                    <td class="font-bold text-slate-700 font-mono text-sm">••••••••</td>
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
            headers: {'Content-Type': 'application/json'},
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
            headers: {'Content-Type': 'application/json'},
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
