const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const hk = await prisma.hargaKhusus.findMany();
    const armadas = await prisma.armada.findMany();
    const bookings = await prisma.booking.findMany({ where: { dateTravel: '2026-08-17' } });

    console.log('Harga Khusus:', hk.length);
    console.log('Bookings on 2026-08-17:', bookings.length);

    for (const b of bookings) {
        console.log('\n--- Booking:', b.nama, '| ArmadaId:', b.jenisKendaraan, '| Date:', b.tanggalPemberangkatan, '| Harga:', b.harga);
        
        const bDateStr = b.tanggalPemberangkatan; 
        
        // This is exactly how parseIndoDate works in frontend for "17 AGUSTUS 2026"
        const INDO_MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
        const parts = bDateStr.split(' ');
        let bTime = 0;
        if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = INDO_MONTHS.indexOf(parts[1].toUpperCase());
            const year = parseInt(parts[2]);
            bTime = new Date(year, month, day).getTime();
        }

        const bArmada = armadas.find(a => a.idArmada === b.jenisKendaraan);
        let matchingArmadaIds = [];
        if (bArmada) {
            matchingArmadaIds = armadas
                .filter(a => a.namaArmada === bArmada.namaArmada && a.tujuanArmada === bArmada.tujuanArmada)
                .map(a => a.idArmada);
        }

        const matchingRule = hk.find(h => {
            if (!matchingArmadaIds.includes(h.idArmada)) return false;
            
            const [sY, sM, sD] = String(h.tanggalAwal).split('T')[0].split('-');
            const [eY, eM, eD] = String(h.tanggalAkhir).split('T')[0].split('-');
            const start = new Date(sY, parseInt(sM)-1, sD).getTime();
            const end = new Date(eY, parseInt(eM)-1, eD).getTime();
            
            return bTime >= start && bTime <= end;
        });

        if (matchingRule) {
            console.log('MATCH FOUND:', matchingRule.idArmada, matchingRule.tanggalAwal, matchingRule.hargaBaru);
            const currentPrice = b.harga;
            const hkPrice = parseInt(matchingRule.hargaBaru);
            console.log('currentPrice:', currentPrice, 'hkPrice:', hkPrice);
            if (currentPrice !== hkPrice && currentPrice > 0) {
                console.log('>>> WARNING SHOULD SHOW UP!');
            }
        } else {
            console.log('NO MATCHING RULE FOUND.');
        }
    }
}
main().finally(() => prisma.$disconnect());
