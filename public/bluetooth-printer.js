// ESC/POS Commands
const CMD = {
    INIT: [0x1B, 0x40],
    ALIGN_LEFT: [0x1B, 0x61, 0x00],
    ALIGN_CENTER: [0x1B, 0x61, 0x01],
    ALIGN_RIGHT: [0x1B, 0x61, 0x02],
    BOLD_ON: [0x1B, 0x45, 0x01],
    BOLD_OFF: [0x1B, 0x45, 0x00],
    TEXT_NORMAL: [0x1D, 0x21, 0x00],
    TEXT_DOUBLE: [0x1D, 0x21, 0x11],
    LF: [0x0A],
};

let cachedDevice = null;
let cachedServer = null;

async function getBluetoothPrinter() {
    if (cachedDevice && cachedDevice.gatt.connected) {
        return cachedServer;
    }

    try {
        const device = await navigator.bluetooth.requestDevice({
            filters: [{
                services: ['000018f0-0000-1000-8000-00805f9b34fb']
            }],
            optionalServices: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2'] // Some common printer services
        }).catch(err => {
            // Fallback to accepting all devices if specific service UUID is not broadcasted properly
            console.log("Fallback to acceptAllDevices", err);
            return navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']
            });
        });

        cachedDevice = device;
        device.addEventListener('gattserverdisconnected', () => {
            console.log('Bluetooth disconnected');
            cachedServer = null;
        });

        const server = await device.gatt.connect();
        cachedServer = server;
        return server;
    } catch (error) {
        console.error("Bluetooth connection failed:", error);
        throw error;
    }
}

async function sendDataToPrinter(server, dataArray) {
    // Standard Bluetooth printer services
    const serviceUUIDs = ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2'];
    let characteristic = null;

    for (let uuid of serviceUUIDs) {
        try {
            const service = await server.getPrimaryService(uuid);
            const characteristics = await service.getCharacteristics();
            // Find a writable characteristic
            characteristic = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);
            if (characteristic) break;
        } catch (e) {
            console.log(`Service ${uuid} not found or no access.`);
        }
    }

    if (!characteristic) {
        throw new Error("Could not find a writable characteristic on this printer.");
    }

    // Split data into chunks of 512 bytes (common MTU limit for BLE)
    const CHUNK_SIZE = 512;
    for (let i = 0; i < dataArray.length; i += CHUNK_SIZE) {
        const chunk = new Uint8Array(dataArray.slice(i, i + CHUNK_SIZE));
        if (characteristic.properties.writeWithoutResponse) {
            await characteristic.writeValueWithoutResponse(chunk);
        } else {
            await characteristic.writeValue(chunk);
        }
    }
}

function encodeText(text) {
    const encoder = new TextEncoder();
    return Array.from(encoder.encode(text));
}

// Data tiket diset dari admin.html saat booking
let currentTicketDataForBT = null;

async function printThermalReceiptBT() {
    if (!navigator.bluetooth) {
        alert("Browser ini tidak mendukung Web Bluetooth API. Gunakan Google Chrome di Android/PC.");
        return;
    }
    
    if (!currentTicketDataForBT) {
        alert("Data tiket tidak ditemukan.");
        return;
    }
    const ticket = currentTicketDataForBT;

    // Ubah status tombol
    const btn = document.getElementById('btnCetakThermalBT');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghubungkan...';
    btn.disabled = true;

    try {
        const server = await getBluetoothPrinter();
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mencetak...';

        let data = [];
        const addCmd = (cmd) => data.push(...cmd);
        const addText = (txt) => data.push(...encodeText(txt));
        const addLine = () => addText("--------------------------------\n"); // 32 chars for 58mm printer

        // Build Receipt
        addCmd(CMD.INIT);
        addCmd(CMD.ALIGN_CENTER);
        addCmd(CMD.BOLD_ON);
        addCmd(CMD.TEXT_DOUBLE);
        addText("AGEN DAMRI\n");
        addCmd(CMD.TEXT_NORMAL);
        addText("KAWUNGANTEN\n");
        addCmd(CMD.BOLD_OFF);
        addText("Pusat Penjualan Tiket Resmi\n");
        addLine();

        addCmd(CMD.ALIGN_LEFT);
        addText(`No Tiket : ${ticket.idTiket}\n`);
        addText(`Tgl Beli : ${ticket.tglBeli}\n`);
        addLine();
        
        addCmd(CMD.BOLD_ON);
        addText(`NAMA Pnp : ${ticket.nama}\n`);
        addCmd(CMD.BOLD_OFF);
        addText(`Tujuan   : ${ticket.tujuan}\n`);
        addText(`Tgl Brgkt: ${ticket.tglBerangkat}\n`);
        addText(`Jam Brgkt: ${ticket.jam}\n`);
        addText(`Jml Pnp  : ${ticket.jumlahPnp}\n`);
        addText(`Armada   : ${ticket.armada}\n`);
        addLine();

        addCmd(CMD.ALIGN_RIGHT);
        addCmd(CMD.BOLD_ON);
        addText(`TOTAL : ${ticket.totalHarga}\n`);
        addCmd(CMD.BOLD_OFF);
        addCmd(CMD.ALIGN_LEFT);
        addText(`Status   : ${ticket.status}\n`);
        addLine();

        addCmd(CMD.ALIGN_CENTER);
        addText("Terima Kasih!\n");
        addText("Simpan struk ini sbg bukti.\n");
        addText("agendamrikawunganten.net\n");

        // Feed some blank lines and cut
        addCmd(CMD.LF);
        addCmd(CMD.LF);
        addCmd(CMD.LF);

        // Send to printer
        await sendDataToPrinter(server, data);
        
        btn.innerHTML = '<i class="fas fa-check"></i> Tercetak';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 3000);

    } catch (error) {
        console.error("Print Error:", error);
        alert("Gagal mencetak: " + error.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
