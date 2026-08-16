
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
            const res = await fetch('/api?action=cariPelanggan&q=' + encodeURIComponent(query));
            const data = await res.json();
            
            if (data.status === 'success' && data.data.length > 0) {
                dropdown.innerHTML = '';
                data.data.forEach(p => {
                    const div = document.createElement('div');
                    div.className = 'p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors flex justify-between items-center';
                    div.innerHTML = `
                        <div>
                            <div class="font-bold text-sm text-slate-800">${p.nama}</div>
                            <div class="text-xs text-slate-500">${p.nomorHp}</div>
                        </div>
                        <div class="text-[10px] bg-slate-100 px-2 py-1 rounded font-bold text-slate-400">
                            ${p.totalBooking} Booking
                        </div>
                    `;
                    div.onclick = () => {
                        if (formType === 'booking') {
                            document.getElementById('adminBookingNama').value = p.nama;
                            document.getElementById('adminBookingHp').value = p.nomorHp;
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
