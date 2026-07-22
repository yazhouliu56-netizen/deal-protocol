import { PrismaClient } from '../../src/generated/prisma/index.js';
const p = new PrismaClient();
const users = await p.user.findMany({ select: { email: true, role: true, roles: true } });
console.log(JSON.stringify(users, null, 2));
await p.$disconnect();
