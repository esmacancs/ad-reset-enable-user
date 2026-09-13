import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ROLE_PERMISSIONS } from '../src/lib/permissions';

const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding database...');

  // Create permissions
  const permissionNames = Object.values(ROLE_PERMISSIONS).flat();
  const uniquePermissions = [...new Set(permissionNames)];

  for (const permName of uniquePermissions) {
    await prisma.permission.upsert({
      where: { name: permName },
      update: {},
      create: { name: permName },
    });
  }
  console.log(`Created ${uniquePermissions.length} permissions`);

  // Create roles and assign permissions
  for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });

    for (const permName of perms) {
      const perm = await prisma.permission.findUnique({ where: { name: permName } });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: { role_id_permission_id: { role_id: role.id, permission_id: perm.id } },
          update: {},
          create: { role_id: role.id, permission_id: perm.id },
        });
      }
    }
    console.log(`Created role: ${roleName} with ${perms.length} permissions`);
  }

  // Create admin user
  const superAdminRole = await prisma.role.findUnique({ where: { name: 'Superadmin' } });
  const adminRole = await prisma.role.findUnique({ where: { name: 'Administrator' } });
  const supervisorRole = await prisma.role.findUnique({ where: { name: 'Supervisor' } });
  const prAgentRole = await prisma.role.findUnique({ where: { name: 'Password Reset Agent' } });

  const superAdminHash = await bcrypt.hash('SuperAdmin@123', 12);
  await prisma.portalUser.upsert({
    where: { username: 'superadmin' },
    update: {},
    create: {
      username: 'superadmin',
      full_name: 'Super Administrator',
      email: 'superadmin@company.local',
      password_hash: superAdminHash,
      role_id: superAdminRole!.id,
      location: 'Head Office',
      phone: '+968-90000000',
      status: 'active',
    },
  });

  const adminHash = await bcrypt.hash('Admin@123', 12);
  await prisma.portalUser.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      full_name: 'System Administrator',
      email: 'admin@company.local',
      password_hash: adminHash,
      role_id: adminRole!.id,
      location: 'Head Office',
      phone: '+968-90000001',
      status: 'active',
    },
  });

  // Create supervisor user
  const supervisorHash = await bcrypt.hash('Super@123', 12);
  await prisma.portalUser.upsert({
    where: { username: 'supervisor1' },
    update: {},
    create: {
      username: 'supervisor1',
      full_name: 'Sara Al-Rashid',
      email: 'sara.alrashid@company.local',
      password_hash: supervisorHash,
      role_id: supervisorRole!.id,
      location: 'Head Office',
      phone: '+968-90000002',
      status: 'active',
    },
  });

  // Create password reset agents
  const agents = [
    { username: 'agent1', full_name: 'Omar Al-Harthy', email: 'omar.alharthy@company.local', location: 'Branch A', phone: '+968-90000003', password: 'Agent1@123' },
    { username: 'agent2', full_name: 'Fatima Al-Balushi', email: 'fatima.albalushi@company.local', location: 'Branch B', phone: '+968-90000004', password: 'Agent2@123' },
    { username: 'agent3', full_name: 'Khalid Al-Kindi', email: 'khalid.alkindi@company.local', location: 'Head Office', phone: '+968-90000005', password: 'Agent3@123' },
  ];

  for (const agent of agents) {
    const hash = await bcrypt.hash(agent.password, 12);
    await prisma.portalUser.upsert({
      where: { username: agent.username },
      update: {},
      create: {
        username: agent.username,
        full_name: agent.full_name,
        email: agent.email,
        password_hash: hash,
        role_id: prAgentRole!.id,
        location: agent.location,
        phone: agent.phone,
        status: 'active',
      },
    });
  }

  // Create some sample audit logs
  const sampleActions = [
    { action: 'login', agent: 'admin', target: null, desc: 'Successful login', result: 'success' },
    { action: 'search_user', agent: 'admin', target: 'ahmed.alrashid', desc: 'Searched AD user', result: 'success' },
    { action: 'reset_password', agent: 'agent1', target: 'sara.alsaid', desc: 'Password reset', result: 'success' },
    { action: 'unlock_account', agent: 'agent2', target: 'omar.alharthy', desc: 'Account unlocked', result: 'success' },
    { action: 'disable_account', agent: 'admin', target: 'test.user', desc: 'Account disabled', result: 'success' },
    { action: 'enable_account', agent: 'admin', target: 'test.user2', desc: 'Account enabled', result: 'success' },
    { action: 'force_password_change', agent: 'agent1', target: 'mohammed.alsaid', desc: 'Force password change', result: 'success' },
    { action: 'login_failed', agent: 'unknown', target: null, desc: 'Invalid credentials', result: 'failure' },
    { action: 'reset_password', agent: 'agent3', target: 'khalid.alkindi', desc: 'Password reset denied - insufficient permissions', result: 'denied' },
    { action: 'create_agent', agent: 'admin', target: 'agent4', desc: 'New agent created', result: 'success' },
    { action: 'search_user', agent: 'supervisor1', target: 'ahmed.alrashid', desc: 'Searched AD user', result: 'success' },
    { action: 'reset_password', agent: 'agent1', target: 'layla.albalushi', desc: 'Password reset', result: 'success' },
  ];

  for (let i = 0; i < sampleActions.length; i++) {
    const sa = sampleActions[i];
    await prisma.auditLog.create({
      data: {
        agent_username: sa.agent,
        agent_ip: '192.168.1.' + (10 + i),
        action: sa.action,
        target_username: sa.target,
        description: sa.desc,
        result: sa.result,
        created_at: new Date(Date.now() - (sampleActions.length - i) * 3600000),
      },
    });
  }

  // Create sample AD operations
  const sampleOps = [
    { type: 'reset_password', target: 'sara.alsaid', by: 'agent1', status: 'completed' },
    { type: 'unlock_account', target: 'omar.alharthy', by: 'agent2', status: 'completed' },
    { type: 'disable_account', target: 'test.user', by: 'admin', status: 'completed' },
    { type: 'enable_account', target: 'test.user2', by: 'admin', status: 'completed' },
    { type: 'force_password_change', target: 'mohammed.alsaid', by: 'agent1', status: 'completed' },
  ];

  for (let i = 0; i < sampleOps.length; i++) {
    const op = sampleOps[i];
    await prisma.aDOperation.create({
      data: {
        operation_type: op.type,
        target_user: op.target,
        requested_by: op.by,
        status: op.status,
        created_at: new Date(Date.now() - (sampleOps.length - i) * 3600000),
      },
    });
  }

  console.log('Seed completed successfully!');
  console.log('---');
  console.log('Login credentials:');
  console.log('  Superadmin: superadmin / SuperAdmin@123');
  console.log('  Admin:     admin / Admin@123');
  console.log('  Supervisor: supervisor1 / Super@123');
  console.log('  Agent:     agent1 / Agent1@123');
  console.log('  Agent:     agent2 / Agent2@123');
  console.log('  Agent:     agent3 / Agent3@123');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
