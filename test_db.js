const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$connect()
    .then(() => { console.log('Connected successfully!'); process.exit(0); })
    .catch(e => { console.error('Connection failed:', e); process.exit(1); });
