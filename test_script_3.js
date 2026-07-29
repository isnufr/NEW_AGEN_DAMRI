
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
                const icon = item.tipe === 'PESAWAT' ? 'fa-plane' : 'fa-ship';
                
                html += `
                    <tr class="hover:bg-slate-50/80 transition-colors group">
                        <td class="p-4">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                                    <i class="fas ${icon}"></i>
                                </div>
                                <div>
                                    <div class="font-black text-slate-800">${item.vendor}</div>
                                    <div class="text-[10px] font-bold text-slate-400 uppercase">${item.tipe}</div>
                                </div>
                            </div>
                        </td>
                        <td class="p-4">
                            <div class="font-bold text-slate-700">${item.rute}</div>
                            <div class="text-xs text-slate-500"><i class="far fa-calendar-alt mr-1"></i>${item.tanggalBerangkat} | <i class="far fa-clock mr-1"></i>${item.jamBerangkat}</div>
                        </td>
                        <td class="p-4">
                            <div class="font-black text-blue-600">${item.namaPenumpang}</div>
                            <div class="text-xs font-bold text-slate-500 tracking-wider">PNR: ${item.kodeBooking}</div>
                        </td>
                        <td class="p-4 text-right">
                            <div class="font-bold text-slate-700">${formatRupiah(item.hargaTiket)}</div>
                        </td>
                        <td class="p-4 text-center">
                            <span class="inline-flex px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border ${statusColor}">
                                ${item.statusPembayaran}
                            </span>
                        </td>
                        <td class="p-4 text-center">
                            <div class="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onclick='printStrukEkstra(${JSON.stringify(item)})' class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-center" title="Cetak Struk">
                                    <i class="fas fa-print"></i>
                                </button>
                                <button onclick='openEditEkstraModal(${JSON.stringify(item)})' class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white transition-colors flex items-center justify-center" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="deleteEkstra('${item.id}')" class="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center" title="Hapus">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }

        function openAddEkstraModal() {
            document.getElementById('ekstraId').value = '';
            document.getElementById('ekstraForm').reset();
            document.getElementById('ekstraModalTitle').innerText = 'Tambah Tiket Ekstra';
            
            const modal = document.getElementById('ekstraModal');
            const inner = document.getElementById('ekstraModalInner');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            setTimeout(() => {
                inner.classList.remove('scale-95', 'opacity-0');
                inner.classList.add('scale-100', 'opacity-100');
            }, 10);
        }

        function openEditEkstraModal(item) {
            document.getElementById('ekstraId').value = item.id;
            document.getElementById('ekstraTipe').value = item.tipe;
            document.getElementById('ekstraVendor').value = item.vendor;
            document.getElementById('ekstraRute').value = item.rute;
            document.getElementById('ekstraTanggal').value = item.tanggalBerangkat;
            document.getElementById('ekstraJam').value = item.jamBerangkat;
            document.getElementById('ekstraNama').value = item.namaPenumpang;
            document.getElementById('ekstraKode').value = item.kodeBooking;
            document.getElementById('ekstraHarga').value = item.hargaTiket;
            document.getElementById('ekstraStatus').value = item.statusPembayaran;

            document.getElementById('ekstraModalTitle').innerText = 'Edit Tiket Ekstra';
            
            const modal = document.getElementById('ekstraModal');
            const inner = document.getElementById('ekstraModalInner');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            setTimeout(() => {
                inner.classList.remove('scale-95', 'opacity-0');
                inner.classList.add('scale-100', 'opacity-100');
            }, 10);
        }

        function closeEkstraModal() {
            const modal = document.getElementById('ekstraModal');
            const inner = document.getElementById('ekstraModalInner');
            inner.classList.remove('scale-100', 'opacity-100');
            inner.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
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
            
            const payload = {
                id: id,
                tipe: document.getElementById('ekstraTipe').value,
                vendor: document.getElementById('ekstraVendor').value,
                rute: document.getElementById('ekstraRute').value,
                tanggalBerangkat: document.getElementById('ekstraTanggal').value,
                jamBerangkat: document.getElementById('ekstraJam').value,
                namaPenumpang: document.getElementById('ekstraNama').value,
                kodeBooking: document.getElementById('ekstraKode').value,
                hargaTiket: document.getElementById('ekstraHarga').value,
                statusPembayaran: document.getElementById('ekstraStatus').value,
            };

            try {
                const res = await fetch('/api', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
                    headers: { 'Content-Type': 'application/json' },
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
            const width = 300;
            const height = 500;
            const left = (screen.width - width) / 2;
            const top = (screen.height - height) / 2;

            const printWindow = window.open('', '_blank', `width=${width},height=${height},left=${left},top=${top}`);
            
            const css = `
                <style>
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        margin: 0;
                        padding: 10px;
                        background: #fff;
                        color: #000;
                        font-size: 12px;
                        line-height: 1.2;
                    }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .title { font-size: 16px; margin-bottom: 5px; }
                    .subtitle { font-size: 11px; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                    .divider { border-top: 1px dashed #000; margin: 10px 0; }
                    .footer { font-size: 10px; margin-top: 15px; }
                    @media print {
                        @page { margin: 0; }
                        body { padding: 5px; }
                    }
                </style>
            `;

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Print Struk</title>
                    ${css}
                </head>
                <body>
                    <div class="center bold title">AGEN DAMRI KAWUNGANTEN</div>
                    <div class="center subtitle">AGEN TIKET & TRAVEL</div>
                    
                    <div class="row"><span>KODE</span> <span>: <span class="bold">${item.kodeBooking}</span></span></div>
                    <div class="row"><span>TGL/JAM</span> <span>: ${item.tanggalBerangkat} ${item.jamBerangkat}</span></div>
                    
                    <div class="divider"></div>
                    
                    <div class="row"><span>PENUMPANG</span> <span>: <span class="bold">${item.namaPenumpang}</span></span></div>
                    <div class="row"><span>TIPE</span> <span>: ${item.tipe}</span></div>
                    <div class="row"><span>MASKAPAI</span> <span>: <span class="bold">${item.vendor}</span></span></div>
                    <div class="row"><span>RUTE</span> <span>: ${item.rute}</span></div>
                    
                    <div class="divider"></div>
                    
                    <div class="row"><span>TOTAL HARGA</span> <span>: <span class="bold">Rp ${item.totalHarga.toLocaleString('id-ID')}</span></span></div>
                    <div class="row"><span>STATUS</span> <span>: ${item.statusPembayaran}</span></div>
                    
                    <div class="divider"></div>
                    
                    <div class="center footer">
                        <p>Simpan struk ini sebagai bukti pembayaran yang sah.</p>
                        <p>Terima Kasih</p>
                    </div>
                    
                        window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 500);
                        }
                    <\/script>
                </body>
                </html>
            `;

            printWindow.document.write(html);
            printWindow.document.close();
        }
    