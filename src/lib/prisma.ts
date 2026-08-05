// Workaround for Turbopack Prisma client resolution issue
// Turbopack hashes the @prisma/client module name, causing 500 errors
// This file uses a direct path to avoid the issue

let prismaClient: any;

export async function getDb() {
  if (!prismaClient) {
    const { PrismaClient } = await import('@prisma/client');
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}
