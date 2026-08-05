// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('/home/z/my-project/node_modules/.prisma/client/index.js');
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// === SETUP ===
const prisma = new PrismaClient({
  datasourceUrl: 'file:/home/z/my-project/db/custom.db',
});

const JWT_SECRET = process.env.JWT_SECRET || 'ad-portal-secret-key-2024';
const PORT = 3001;

console.log('AD Portal API Server starting on port', PORT);

// === TYPES ===
interface JwtPayload {
  userId: number;
  username: string;
  role: string;
  permissions: string[];
}

interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// === HELPERS ===
function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function error(message: string, status = 400) {
  return json({ error: message }, status);
}

async function authenticate(req: Request): Promise<JwtPayload | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.slice(7), JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

async function getFullUser(userId: number) {
  return prisma.portalUser.findUnique({
    where: { id: userId },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
}

function hasPermission(perms: string[], required: string) {
  return perms.includes(required);
}

function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
}

// === AD MOCK SERVICE ===
const DEPARTMENTS = ['Information Technology', 'Human Resources', 'Finance', 'Operations', 'Customer Service', 'Sales', 'Marketing', 'Legal', 'Facilities', 'Security'];
const TITLES = ['Systems Administrator', 'Network Engineer', 'Help Desk Specialist', 'IT Manager', 'HR Coordinator', 'HR Manager', 'Financial Analyst', 'Accountant', 'Operations Manager', 'Call Center Agent', 'Team Lead', 'Supervisor', 'Director', 'VP', 'Specialist'];
const GROUPS = ['Domain Users', 'Enterprise Admins', 'VPN Users', 'Remote Desktop Users', 'Exchange Users', 'SharePoint Users', 'IT Security Group', 'Helpdesk Operators', 'Finance Team', 'HR Team', 'Management', 'All Staff'];
const FIRST_NAMES = ['Ahmed', 'Mohammed', 'Sara', 'Fatima', 'Omar', 'Layla', 'Khalid', 'Nora', 'Youssef', 'Amira', 'Hassan', 'Mariam', 'Ali', 'Zainab', 'Ibrahim', 'Noor', 'Tariq', 'Huda', 'Faisal', 'Reem'];
const LAST_NAMES = ['Al-Rashid', 'Al-Said', 'Al-Harthy', 'Al-Balushi', 'Al-Kindi', 'Al-Lawati', 'Al-Rawahi', 'Al-Hashmi', 'Al-Busaidi', 'Al-Shukaili'];

interface ADUser {
  displayName: string;
  username: string;
  email: string;
  department: string;
  title: string;
  employeeId: string;
  enabled: boolean;
  locked: boolean;
  lastLogon: string | null;
  groups: string[];
  distinguishedName: string;
  phone: string;
  office: string;
  manager: string;
  whenCreated: string;
  passwordLastSet: string | null;
  accountExpires: string | null;
  description: string | null;
}

function generateADUsers(): ADUser[] {
  const users: ADUser[] = [];
  const used = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const fn = FIRST_NAMES[i % FIRST_NAMES.length];
    const ln = LAST_NAMES[i % LAST_NAMES.length];
    let un = `${fn.toLowerCase()}.${ln.toLowerCase()}`.replace(/[^a-z.]/g, '');
    let c = 1;
    while (used.has(un)) { un = `${un}${c}`; c++; }
    used.add(un);
    const enabled = Math.random() > 0.15;
    const locked = !enabled ? false : Math.random() > 0.85;
    const days = Math.floor(Math.random() * 90);
    const numG = 1 + Math.floor(Math.random() * 4);
    const shuffled = [...GROUPS].sort(() => Math.random() - 0.5);
    users.push({
      displayName: `${fn} ${ln}`, username: un, email: `${un}@company.local`,
      department: DEPARTMENTS[i % DEPARTMENTS.length], title: TITLES[i % TITLES.length],
      employeeId: `EMP${String(10001 + i).padStart(6, '0')}`, enabled, locked,
      lastLogon: enabled && !locked ? new Date(Date.now() - days * 864e5).toISOString() : null,
      groups: ['Domain Users', ...shuffled.slice(0, numG)],
      distinguishedName: `CN=${fn} ${ln},OU=${DEPARTMENTS[i % DEPARTMENTS.length]},DC=company,DC=local`,
      phone: `+968-${90000000 + Math.floor(Math.random() * 9999999)}`,
      office: ['Head Office', 'Branch A', 'Branch B', 'Remote'][i % 4],
      manager: 'CEO Office',
      whenCreated: new Date(Date.now() - Math.floor(Math.random() * 3650) * 864e5).toISOString(),
      passwordLastSet: enabled ? new Date(Date.now() - Math.floor(Math.random() * 90) * 864e5).toISOString() : null,
      accountExpires: null, description: null,
    });
  }
  return users;
}

const AD_USERS = generateADUsers();

function generateSecurePassword(): string {
  const u = 'ABCDEFGHJKLMNPQRSTUVWXYZ', l = 'abcdefghjkmnpqrstuvwxyz', d = '23456789', s = '!@#$%&*';
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  const chars = [u[Math.random()*u.length|0], l[Math.random()*l.length|0], l[Math.random()*l.length|0],
    d[Math.random()*d.length|0], d[Math.random()*d.length|0], s[Math.random()*s.length|0]];
  for (let i = chars.length; i < 12; i++) chars.push(a[Math.random()*a.length|0]);
  return chars.sort(() => Math.random() - 0.5).join('');
}

// === ROUTES ===
const router = new Map<string, (req: AuthenticatedRequest, params: Record<string, string>) => Promise<Response>>();

// POST /api/auth/login
router.set('POST /api/auth/login', async (req) => {
  const { username, password } = await req.json() as any;
  if (!username || !password) return error('Username and password are required');

  const user = await prisma.portalUser.findUnique({
    where: { username },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  if (!user) return error('Invalid username or password', 401);

  if (user.status !== 'active') {
    await prisma.auditLog.create({ data: { agent_username: username, action: 'LOGIN', description: 'Login on disabled account', result: 'denied', agent_ip: getClientIp(req) } });
    return error('Account is disabled', 403);
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    await prisma.auditLog.create({ data: { agent_username: username, action: 'LOGIN', description: 'Login while locked', result: 'denied', agent_ip: getClientIp(req) } });
    return error('Account temporarily locked. Try again later.', 423);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const fails = user.failed_logins + 1;
    const lock = fails >= 5;
    await prisma.portalUser.update({ where: { id: user.id }, data: { failed_logins: fails, locked_until: lock ? new Date(Date.now() + 15 * 60 * 1000) : null } });
    await prisma.auditLog.create({ data: { agent_username: username, action: 'LOGIN', description: lock ? `Locked after ${fails} fails` : `Failed (${fails}/5)`, result: 'failure', agent_ip: getClientIp(req) } });
    return error(lock ? 'Account locked' : 'Invalid username or password', lock ? 423 : 401);
  }

  const permissions = user.role.permissions.map(rp => rp.permission.name);
  const token = jwt.sign({ userId: user.id, username: user.username, role: user.role.name, permissions }, JWT_SECRET, { expiresIn: '8h' });
  await prisma.portalUser.update({ where: { id: user.id }, data: { failed_logins: 0, locked_until: null } });
  await prisma.auditLog.create({ data: { agent_username: user.username, action: 'LOGIN', description: 'Successful login', result: 'success', agent_ip: getClientIp(req) } });

  return json({ token, user: { id: user.id, username: user.username, fullName: user.full_name, email: user.email, role: user.role.name, permissions } });
});

// GET /api/auth/me
router.set('GET /api/auth/me', async (req) => {
  const payload = await authenticate(req);
  if (!payload) return error('Unauthorized', 401);
  const user = await getFullUser(payload.userId);
  if (!user || user.status !== 'active') return error('Account not found', 401);
  const perms = user.role.permissions.map(rp => rp.permission.name);
  return json({ user: { id: user.id, username: user.username, fullName: user.full_name, email: user.email, role: user.role.name, permissions: perms } });
});

// GET /api/dashboard
router.set('GET /api/dashboard', async (req) => {
  const payload = await authenticate(req);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'view_reports')) return error('Insufficient permissions', 403);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [operationsToday, passwordResetsToday, disabledUsersToday, enabledUsersToday, activeAgents, recentActivity] = await Promise.all([
    prisma.auditLog.count({ where: { created_at: { gte: today }, result: 'success' } }),
    prisma.auditLog.count({ where: { created_at: { gte: today }, result: 'success', action: 'RESET_PASSWORD' } }),
    prisma.auditLog.count({ where: { created_at: { gte: today }, result: 'success', action: 'DISABLE_ACCOUNT' } }),
    prisma.auditLog.count({ where: { created_at: { gte: today }, result: 'success', action: 'ENABLE_ACCOUNT' } }),
    prisma.portalUser.count({ where: { status: 'active' } }),
    prisma.auditLog.findMany({ orderBy: { created_at: 'desc' }, take: 10 }),
  ]);

  return json({ operationsToday, passwordResetsToday, disabledUsersToday, enabledUsersToday, activeAgents, recentActivity });
});

// GET /api/users/search
router.set('GET /api/users/search', async (req) => {
  const payload = await authenticate(req);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'search_users')) return error('Insufficient permissions', 403);

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').toLowerCase();
  const field = url.searchParams.get('field') || '';
  if (!q) return json({ users: [], total: 0 });

  const results = AD_USERS.filter(u => {
    if (field === 'username') return u.username.includes(q);
    if (field === 'email') return u.email.includes(q);
    if (field === 'employeeId') return u.employeeId.includes(q);
    return u.username.includes(q) || u.displayName.toLowerCase().includes(q) || u.email.includes(q) || u.employeeId.includes(q);
  });

  return json({ users: results.slice(0, 50), total: results.length });
});

// GET /api/users/:username
router.set('GET /api/users/_USERNAME_', async (req, params) => {
  const payload = await authenticate(req);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'view_user_details')) return error('Insufficient permissions', 403);

  const user = AD_USERS.find(u => u.username.toLowerCase() === params.username.toLowerCase());
  if (!user) return error('User not found', 404);
  return json(user);
});

// Helper for AD mutation operations
async function adMutation(req: Request, payload: JwtPayload, username: string, opType: string, perm: string, fn: (u: ADUser) => { success: boolean; message: string; data?: any }) {
  if (!hasPermission(payload.permissions, perm)) return error('Insufficient permissions', 403);
  const user = AD_USERS.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return error('User not found', 404);

  const result = fn(user);
  await prisma.auditLog.create({
    data: { agent_username: payload.username, action: opType, target_username: username, description: result.message, result: result.success ? 'success' : 'failure', agent_ip: getClientIp(req) }
  });
  await prisma.aDOperation.create({
    data: { operation_type: opType, target_user: username, requested_by: payload.username, status: result.success ? 'completed' : 'failed' }
  });

  return json(result);
}

// POST /api/users/:username/reset-password
router.set('POST /api/users/_USERNAME_/reset-password', async (req, params) => {
  const payload = await authenticate(req);
  if (!payload) return error('Unauthorized', 401);
  return adMutation(req, payload, params.username, 'RESET_PASSWORD', 'reset_passwords', (u) => {
    if (!u.enabled) return { success: false, message: `Account '${u.username}' is disabled.` };
    const pw = generateSecurePassword();
    u.passwordLastSet = new Date().toISOString();
    return { success: true, message: `Password for '${u.username}' reset.`, newPassword: pw };
  });
});

// POST /api/users/:username/unlock
router.set('POST /api/users/_USERNAME_/unlock', async (req, params) => {
  const payload = await authenticate(req);
  if (!payload) return error('Unauthorized', 401);
  return adMutation(req, payload, params.username, 'UNLOCK_ACCOUNT', 'unlock_accounts', (u) => {
    if (!u.locked) return { success: false, message: `Account '${u.username}' is not locked.` };
    u.locked = false;
    return { success: true, message: `Account '${u.username}' unlocked.` };
  });
});

// POST /api/users/:username/enable
router.set('POST /api/users/_USERNAME_/enable', async (req, params) => {
  const payload = await authenticate(req);
  if (!payload) return error('Unauthorized', 401);
  return adMutation(req, payload, params.username, 'ENABLE_ACCOUNT', 'enable_ad_accounts', (u) => {
    if (u.enabled) return { success: false, message: `Account '${u.username}' is already enabled.` };
    u.enabled = true;
    return { success: true, message: `Account '${u.username}' enabled.` };
  });
});

// POST /api/users/:username/disable
router.set('POST /api/users/_USERNAME_/disable', async (req, params) => {
  const payload = await authenticate(req);
  if (!payload) return error('Unauthorized', 401);
  return adMutation(req, payload, params.username, 'DISABLE_ACCOUNT', 'disable_ad_accounts', (u) => {
    if (!u.enabled) return { success: false, message: `Account '${u.username}' is already disabled.` };
    u.enabled = false; u.locked = false;
    return { success: true, message: `Account '${u.username}' disabled.` };
  });
});

// POST /api/users/:username/force-password-change
router.set('POST /api/users/_USERNAME_/force-password-change', async (req, params) => {
  const payload = await authenticate(req);
  if (!payload) return error('Unauthorized', 401);
  return adMutation(req, payload, params.username, 'FORCE_PASSWORD_CHANGE', 'force_password_change', (u) => {
    if (!u.enabled) return { success: false, message: `Cannot force password change on disabled account.` };
    u.passwordLastSet = null;
    return { success: true, message: `User '${u.username}' must change password at next logon.` };
  });
});

// GET /api/agents
router.set('GET /api/agents', async (req) => {
  const payload = await authenticate(req);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'create_agents')) return error('Insufficient permissions', 403);

  const agents = await prisma.portalUser.findMany({
    include: { role: { include: { permissions: { include: { permission: true } } } } },
    orderBy: { created_at: 'desc' },
  });

  return json(agents.map(a => ({
    id: a.id, username: a.username, fullName: a.full_name, email: a.email,
    location: a.location, phone: a.phone, status: a.status,
    role: { id: a.role.id, name: a.role.name, permissions: a.role.permissions.map(rp => rp.permission.name) },
    failedLogins: a.failed_logins, lockedUntil: a.locked_until, createdAt: a.created_at, updatedAt: a.updated_at,
  })));
});

// POST /api/agents
router.set('POST /api/agents', async (req) => {
  const payload = await authenticate(req);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'create_agents')) return error('Insufficient permissions', 403);

  const { username, password, fullName, email, location, phone, roleId } = await req.json() as any;
  if (!username || !password || !fullName || !email || !roleId) return error('Missing required fields');

  const exists = await prisma.portalUser.findUnique({ where: { username } });
  if (exists) return error('Username already exists', 409);
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return error('Role not found');

  const hash = await bcrypt.hash(password, 12);
  const agent = await prisma.portalUser.create({
    data: { username, password_hash: hash, full_name: fullName, email, location: location || null, phone: phone || null, role_id: roleId },
    include: { role: true },
  });

  await prisma.auditLog.create({ data: { agent_username: payload.username, action: 'CREATE_AGENT', target_username: username, description: `Created agent ${username}`, result: 'success', agent_ip: getClientIp(req) } });

  return json({ id: agent.id, username: agent.username, fullName: agent.full_name, email: agent.email, location: agent.location, phone: agent.phone, status: agent.status, role: { id: agent.role.id, name: agent.role.name } }, 201);
});

// PUT /api/agents/:id
router.set('PUT /api/agents/_ID_', async (req, params) => {
  const payload = await authenticate(req);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'create_agents')) return error('Insufficient permissions', 403);

  const id = parseInt(params.id);
  const body = await req.json() as any;
  const agent = await prisma.portalUser.update({ where: { id }, data: { full_name: body.fullName, email: body.email, location: body.location || null, phone: body.phone || null, role_id: body.roleId }, include: { role: true } });
  await prisma.auditLog.create({ data: { agent_username: payload.username, action: 'UPDATE_AGENT', target_username: agent.username, description: `Updated agent ${agent.username}`, result: 'success', agent_ip: getClientIp(req) } });
  return json({ id: agent.id, username: agent.username, fullName: agent.full_name, email: agent.email, status: agent.status, role: { id: agent.role.id, name: agent.role.name } });
});

// DELETE /api/agents/:id
router.set('DELETE /api/agents/_ID_', async (req, params) => {
  const payload = await authenticate(req);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'create_agents')) return error('Insufficient permissions', 403);

  const id = parseInt(params.id);
  const agent = await prisma.portalUser.update({ where: { id }, data: { status: 'disabled' } });
  await prisma.auditLog.create({ data: { agent_username: payload.username, action: 'DISABLE_AGENT', target_username: agent.username, description: `Disabled agent ${agent.username}`, result: 'success', agent_ip: getClientIp(req) } });
  return json({ success: true, message: `Agent '${agent.username}' disabled.` });
});

// GET /api/audit
router.set('GET /api/audit', async (req) => {
  const payload = await authenticate(req);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'view_all_audit_logs')) return error('Insufficient permissions', 403);

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
  const where: any = {};
  if (url.searchParams.get('dateFrom')) where.created_at = { ...(where.created_at || {}), gte: new Date(url.searchParams.get('dateFrom')!) };
  if (url.searchParams.get('dateTo')) where.created_at = { ...(where.created_at || {}), lte: new Date(url.searchParams.get('dateTo')!) };
  if (url.searchParams.get('agent')) where.agent_username = { contains: url.searchParams.get('agent') };
  if (url.searchParams.get('action')) where.action = { contains: url.searchParams.get('action') };
  if (url.searchParams.get('result')) where.result = url.searchParams.get('result');

  const [logs, total] = await Promise.all([prisma.auditLog.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }), prisma.auditLog.count({ where })]);
  return json({ logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

// GET /api/audit/export
router.set('GET /api/audit/export', async (req) => {
  const payload = await authenticate(req);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'view_all_audit_logs')) return error('Insufficient permissions', 403);

  const url = new URL(req.url);
  const where: any = {};
  if (url.searchParams.get('dateFrom')) where.created_at = { ...(where.created_at || {}), gte: new Date(url.searchParams.get('dateFrom')!) };
  if (url.searchParams.get('dateTo')) where.created_at = { ...(where.created_at || {}), lte: new Date(url.searchParams.get('dateTo')!) };
  if (url.searchParams.get('agent')) where.agent_username = { contains: url.searchParams.get('agent') };
  if (url.searchParams.get('action')) where.action = { contains: url.searchParams.get('action') };
  if (url.searchParams.get('result')) where.result = url.searchParams.get('result');

  const logs = await prisma.auditLog.findMany({ where, orderBy: { created_at: 'desc' }, take: 10000 });
  const header = 'Timestamp,Agent,Action,Target,Description,Result,IP\n';
  const rows = logs.map(l => `${l.created_at.toISOString()},${l.agent_username},${l.action},${l.target_username || ''},"${(l.description || '').replace(/"/g, '""')}",${l.result},${l.agent_ip || ''}`).join('\n');

  return new Response(header + rows, {
    headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename=audit-${Date.now()}.csv` },
  });
});

// === ROUTER ===
function matchRoute(method: string, path: string): { handler: (req: AuthenticatedRequest, params: Record<string, string>) => Promise<Response>; params: Record<string, string> } | null {
  for (const [key, handler] of router) {
    const [m, pattern] = key.split(' ');
    if (m !== method) continue;
    const regexStr = '^' + pattern.replace(/_USERNAME_/g, '([^/]+)').replace(/_ID_/g, '([^/]+)') + '$';
    const match = new RegExp(regexStr).exec(path);
    if (match) {
      const paramNames = [...pattern.matchAll(/_(USERNAME|ID)_/g)].map(m => m[1].toLowerCase());
      const params: Record<string, string> = {};
      paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
      return { handler, params };
    }
  }
  return null;
}

// === SERVER ===
Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });

    const matched = matchRoute(method, path);
    if (!matched) return json({ error: 'Not found' }, 404);

    try {
      return await matched.handler(req as AuthenticatedRequest, matched.params);
    } catch (err: any) {
      console.error('API Error:', err);
      return json({ error: 'Internal server error' }, 500);
    }
  },
});

console.log(`AD Portal API running on http://0.0.0.0:${PORT}`);
