import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@empresa.local';
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error('ADMIN_PASSWORD precisa estar definido para executar o seed.');
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: UserRole.ADMIN },
    create: { email, name: 'Administrador', role: UserRole.ADMIN, passwordHash },
  });
  console.log(`Administrador preparado e senha sincronizada com o .env: ${email}`);
}

main().finally(() => prisma.$disconnect());
