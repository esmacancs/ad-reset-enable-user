// grant-agent-permissions.cjs - grants enable/disable AD permissions to the Password Reset Agent role.
// Run from the project folder:  node grant-agent-permissions.cjs
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  const role = await prisma.role.findUnique({ where: { name: 'Password Reset Agent' } });
  if (!role) {
    console.error('Role "Password Reset Agent" not found');
    process.exit(1);
  }
  for (const name of ['enable_ad_accounts', 'disable_ad_accounts']) {
    const perm = await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    await prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: role.id, permission_id: perm.id } },
      update: {},
      create: { role_id: role.id, permission_id: perm.id },
    });
    console.log('Granted "' + name + '" to role "' + role.name + '"');
  }
  await prisma.$disconnect();
  console.log('Done. Agents must log out and back in to pick up the new permissions.');
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
