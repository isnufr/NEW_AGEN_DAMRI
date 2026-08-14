const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const hk = await prisma.hargaKhusus.findMany();
    const armadas = await prisma.armada.findMany();
    const bookings = await prisma.booking.findMany({ where: { dateTravel: '2026-08-17' } });

    console.log('Harga Khusus:', hk.length);
    console.log('Bookings on 2026-08-17:', bookings.length);

    for (const b of bookings) {
        console.log('\n--- Booking:', b.name, '| ArmadaId:', b.armadaId, '| Date:', b.dateTravel, '| HargaSatuan:', b.hargaSatuan, '| Harga Total DB:', b.totalHarga, '| Harga (fallback):', b.harga);
        
        const bDateStr = b.dateTravel; 
        const bDateSplit = bDateStr.split('-');
        let bTime = 0;
        if (bDateSplit.length === 3) {
            bTime = new Date(bDateSplit[0], parseInt(bDateSplit[1])-1, bDateSplit[2]).getTime();
        } else {
            console.log('Cant split bDateStr:', bDateStr);
        }

        const matchingRule = hk.find(h => {
            if (String(h.idArmada) !== String(b.armadaId)) return false;
            
            const [sY, sM, sD] = String(h.tanggalAwal).split('T')[0].split('-');
            const [eY, eM, eD] = String(h.tanggalAkhir).split('T')[0].split('-');
            const start = new Date(sY, parseInt(sM)-1, sD).getTime();
            const end = new Date(eY, parseInt(eM)-1, eD).getTime();
            
            return bTime >= start && bTime <= end;
        });

        if (matchingRule) {
            console.log('MATCH FOUND:', matchingRule.idArmada, matchingRule.tanggalAwal, matchingRule.hargaBaru);
            const currentPrice = parseInt(String(b.hargaSatuan || b.harga || b.price || '0').replace(/\D/g, ''));
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
