import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import ExcelJS from 'exceljs';
import * as adService from '@/lib/ad-service';
import type { NewADUserInput } from '@/lib/ad-service';

// === CONFIG ===
const JWT_SECRET = 'ad-portal-secret-key-2024';

// === TYPES ===
interface JwtPayload {
  userId: number;
  username: string;
  role: string;
  permissions: string[];
}

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

interface RouteHandlerContext {
  params: Record<string, string>;
  body: any;
  searchParams: URLSearchParams;
  clientIp: string;
  authHeader: string | null;
}

// === HELPERS ===
function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function error(message: string, status = 400) {
  return json({ error: message }, status);
}

function authenticate(authHeader: string | null): JwtPayload | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.slice(7), JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

async function getFullUser(userId: number) {
  return db.portalUser.findUnique({
    where: { id: userId },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
}

function hasPermission(perms: string[], required: string) {
  return perms.includes(required);
}

function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
}

function generateSecurePassword(): string {
  const u = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const l = 'abcdefghjkmnpqrstuvwxyz';
  const d = '23456789';
  const s = '!@#$%&*';
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  const chars = [
    u[Math.random() * u.length | 0],
    l[Math.random() * l.length | 0],
    l[Math.random() * l.length | 0],
    d[Math.random() * d.length | 0],
    d[Math.random() * d.length | 0],
    s[Math.random() * s.length | 0],
  ];
  for (let i = chars.length; i < 12; i++) chars.push(a[Math.random() * a.length | 0]);
  return chars.sort(() => Math.random() - 0.5).join('');
}

// === AD SERVICE (Real LDAPS or Mock Fallback) ===
const USE_REAL_AD = adService.isADConfigured();
console.log(`[AD] Mode: ${USE_REAL_AD ? 'REAL LDAPS/LDAP → ' + adService.getADConfig().url : 'MOCK (200 simulated users)'}`);

// Mock AD users (used only when AD is not configured)
const DEPARTMENTS = [
  'Information Technology', 'Human Resources', 'Finance', 'Operations',
  'Customer Service', 'Sales', 'Marketing', 'Legal', 'Facilities', 'Security',
];
const TITLES = [
  'Systems Administrator', 'Network Engineer', 'Help Desk Specialist', 'IT Manager',
  'HR Coordinator', 'HR Manager', 'Financial Analyst', 'Accountant', 'Operations Manager',
  'Call Center Agent', 'Team Lead', 'Supervisor', 'Director', 'VP', 'Specialist',
];
const GROUPS = [
  'Domain Users', 'Enterprise Admins', 'VPN Users', 'Remote Desktop Users',
  'Exchange Users', 'SharePoint Users', 'IT Security Group', 'Helpdesk Operators',
  'Finance Team', 'HR Team', 'Management', 'All Staff',
];
const FIRST_NAMES = [
  'Ahmed', 'Mohammed', 'Sara', 'Fatima', 'Omar', 'Layla', 'Khalid', 'Nora',
  'Youssef', 'Amira', 'Hassan', 'Mariam', 'Ali', 'Zainab', 'Ibrahim', 'Noor',
  'Tariq', 'Huda', 'Faisal', 'Reem',
];
const LAST_NAMES = [
  'Al-Rashid', 'Al-Said', 'Al-Harthy', 'Al-Balushi', 'Al-Kindi',
  'Al-Lawati', 'Al-Rawahi', 'Al-Hashmi', 'Al-Busaidi', 'Al-Shukaili',
];

function generateMockADUsers(): ADUser[] {
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
      displayName: `${fn} ${ln}`,
      username: un,
      email: `${un}@company.local`,
      department: DEPARTMENTS[i % DEPARTMENTS.length],
      title: TITLES[i % TITLES.length],
      employeeId: `EMP${String(10001 + i).padStart(6, '0')}`,
      enabled,
      locked,
      lastLogon: enabled && !locked ? new Date(Date.now() - days * 864e5).toISOString() : null,
      groups: ['Domain Users', ...shuffled.slice(0, numG)],
      distinguishedName: `CN=${fn} ${ln},OU=${DEPARTMENTS[i % DEPARTMENTS.length]},DC=company,DC=local`,
      phone: `+968-${90000000 + Math.floor(Math.random() * 9999999)}`,
      office: ['Head Office', 'Branch A', 'Branch B', 'Remote'][i % 4],
      manager: 'CEO Office',
      whenCreated: new Date(Date.now() - Math.floor(Math.random() * 3650) * 864e5).toISOString(),
      passwordLastSet: enabled ? new Date(Date.now() - Math.floor(Math.random() * 90) * 864e5).toISOString() : null,
      accountExpires: null,
      description: null,
    });
  }
  return users;
}

const MOCK_AD_USERS = generateMockADUsers();

// Mock OUs (used only when AD is not configured)
const MOCK_OUs = [
  { name: 'Employees', ou: 'Employees', dn: 'OU=Employees,DC=company,DC=local' },
  { name: 'Clients', ou: 'Clients', dn: 'OU=Clients,DC=company,DC=local' },
  { name: 'Service Accounts', ou: 'Service Accounts', dn: 'OU=Service Accounts,DC=company,DC=local' },
  { name: 'IT', ou: 'IT', dn: 'OU=IT,OU=Employees,DC=company,DC=local' },
  { name: 'HR', ou: 'HR', dn: 'OU=HR,OU=Employees,DC=company,DC=local' },
  { name: 'Finance', ou: 'Finance', dn: 'OU=Finance,OU=Employees,DC=company,DC=local' },
];

/** List AD OUs/containers (real or mock) */
async function adListOUs(): Promise<{ ous: { name: string; ou: string; dn: string }[]; domain: string }> {
  if (USE_REAL_AD) {
    try {
      return { ous: await adService.listContainerOUs(), domain: adService.getADConfig().domain };
    } catch (err: any) {
      console.error('[AD] Real AD OU list failed, falling back to mock:', err.message);
    }
  }
  return { ous: MOCK_OUs, domain: 'company.local' };
}

/** Create an AD user (real or mock) */
async function adCreateUser(input: NewADUserInput): Promise<{ success: boolean; message: string; newPassword?: string }> {
  if (USE_REAL_AD) {
    try {
      await adService.createADUser(input);
      return { success: true, message: `AD account '${input.sAMAccountName}' created successfully.` };
    } catch (err: any) {
      return { success: false, message: `AD error: ${err.message}` };
    }
  }
  // Mock fallback
  const uname = input.sAMAccountName.trim();
  if (MOCK_AD_USERS.some(u => u.username.toLowerCase() === uname.toLowerCase())) {
    return { success: false, message: `User '${uname}' already exists.` };
  }
  MOCK_AD_USERS.push({
    displayName: input.displayName,
    username: uname,
    email: input.mail,
    department: input.department || 'Mock Department',
    title: input.title || 'Specialist',
    employeeId: input.employeeId || `EMP${String(MOCK_AD_USERS.length + 10001).padStart(6, '0')}`,
    enabled: input.enabled,
    locked: false,
    lastLogon: null,
    groups: ['Domain Users'],
    distinguishedName: `CN=${input.displayName},${input.ou}`,
    phone: input.phone || '',
    office: input.office || 'Head Office',
    manager: 'CEO Office',
    whenCreated: new Date().toISOString(),
    passwordLastSet: input.mustChangePassword ? null : new Date().toISOString(),
    accountExpires: null,
    description: input.description || null,
  });
  return { success: true, message: `AD account '${uname}' created successfully.` };
}

/** Search AD users (real or mock) */
async function adSearchUsers(query: string, field?: string): Promise<{ users: ADUser[]; total: number }> {
  if (USE_REAL_AD) {
    try {
      return await adService.searchUsers(query, field);
    } catch (err: any) {
      console.error('[AD] Real AD search failed, falling back to mock:', err.message);
    }
  }
  const results = MOCK_AD_USERS.filter(u => {
    if (field === 'username') return u.username.includes(query);
    if (field === 'email') return u.email.includes(query);
    if (field === 'employeeId') return u.employeeId.includes(query);
    return u.username.includes(query) || u.displayName.toLowerCase().includes(query) || u.email.includes(query) || u.employeeId.includes(query);
  });
  return { users: results.slice(0, 50), total: results.length };
}

/** Get single AD user (real or mock) */
async function adGetUser(username: string): Promise<ADUser> {
  if (USE_REAL_AD) {
    try {
      return await adService.getUser(username);
    } catch (err: any) {
      console.error('[AD] Real AD getUser failed, falling back to mock:', err.message);
    }
  }
  const user = MOCK_AD_USERS.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) throw new Error('User not found');
  return user;
}

function validatePasswordInput(pw: string): string | null {
  if (!pw) return 'Password is required.';
  if (pw.length < 12) return 'Password must be at least 12 characters long.';
  const classes = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  if (classes < 3) return 'Password must include at least 3 of: uppercase, lowercase, digit, symbol.';
  return null;
}

/** AD mutations */
async function adResetPassword(username: string, customPassword?: string): Promise<{ success: boolean; message: string; newPassword?: string }> {
  if (USE_REAL_AD) {
    try {
      const user = await adService.getUser(username);
      if (!user.enabled) return { success: false, message: `Account '${username}' is disabled.` };
      let pw = customPassword;
      if (pw) {
        const invalid = validatePasswordInput(pw);
        if (invalid) return { success: false, message: invalid };
      } else {
        pw = generateSecurePassword();
      }
      await adService.resetPassword(username, pw);
      return { success: true, message: `Password for '${username}' reset successfully.`, newPassword: pw };
    } catch (err: any) {
      return { success: false, message: `AD error: ${err.message}` };
    }
  }
  // Mock fallback
  const user = MOCK_AD_USERS.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return { success: false, message: `User '${username}' not found.` };
  if (!user.enabled) return { success: false, message: `Account '${username}' is disabled.` };
  let pw = customPassword;
  if (pw) {
    const invalid = validatePasswordInput(pw);
    if (invalid) return { success: false, message: invalid };
  } else {
    pw = generateSecurePassword();
  }
  user.passwordLastSet = new Date().toISOString();
  return { success: true, message: `Password for '${username}' reset.`, newPassword: pw };
}

async function adUnlockAccount(username: string): Promise<{ success: boolean; message: string }> {
  if (USE_REAL_AD) {
    try {
      await adService.unlockAccount(username);
      return { success: true, message: `Account '${username}' unlocked.` };
    } catch (err: any) {
      return { success: false, message: `AD error: ${err.message}` };
    }
  }
  const user = MOCK_AD_USERS.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return { success: false, message: `User '${username}' not found.` };
  if (!user.locked) return { success: false, message: `Account '${username}' is not locked.` };
  user.locked = false;
  return { success: true, message: `Account '${username}' unlocked.` };
}

async function adEnableAccount(username: string): Promise<{ success: boolean; message: string }> {
  if (USE_REAL_AD) {
    try {
      await adService.enableAccount(username);
      return { success: true, message: `Account '${username}' enabled.` };
    } catch (err: any) {
      return { success: false, message: `AD error: ${err.message}` };
    }
  }
  const user = MOCK_AD_USERS.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return { success: false, message: `User '${username}' not found.` };
  if (user.enabled) return { success: false, message: `Account '${username}' is already enabled.` };
  user.enabled = true;
  return { success: true, message: `Account '${username}' enabled.` };
}

async function adDisableAccount(username: string): Promise<{ success: boolean; message: string }> {
  if (USE_REAL_AD) {
    try {
      await adService.disableAccount(username);
      return { success: true, message: `Account '${username}' disabled.` };
    } catch (err: any) {
      return { success: false, message: `AD error: ${err.message}` };
    }
  }
  const user = MOCK_AD_USERS.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return { success: false, message: `User '${username}' not found.` };
  if (!user.enabled) return { success: false, message: `Account '${username}' is already disabled.` };
  user.enabled = false;
  user.locked = false;
  return { success: true, message: `Account '${username}' disabled.` };
}

async function adForcePasswordChange(username: string): Promise<{ success: boolean; message: string; newPassword?: string }> {
  if (USE_REAL_AD) {
    try {
      const user = await adService.getUser(username);
      if (!user.enabled) return { success: false, message: `Account '${username}' is disabled.` };
      const pw = generateSecurePassword();
      await adService.forcePasswordChange(username, pw);
      return { success: true, message: `Temporary password set for '${username}'. User must change it at next logon.`, newPassword: pw };
    } catch (err: any) {
      return { success: false, message: `AD error: ${err.message}` };
    }
  }
  const user = MOCK_AD_USERS.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return { success: false, message: `User '${username}' not found.` };
  if (!user.enabled) return { success: false, message: `Cannot force password change on disabled account.` };
  const pw = generateSecurePassword();
  user.passwordLastSet = null;
  return { success: true, message: `Temporary password set for '${username}'. User must change it at next logon.`, newPassword: pw };
}

// === AD MUTATION HELPER (with real AD support + civil ID verification) ===
async function adMutation(
  payload: JwtPayload,
  username: string,
  opType: string,
  perm: string,
  adOp: () => Promise<{ success: boolean; message: string; newPassword?: string; data?: unknown }>,
  clientIp: string,
  civilIdNumber?: string,
  civilIdExpiry?: string,
) {
  if (!hasPermission(payload.permissions, perm)) return error('Insufficient permissions', 403);

  // Validate civil ID if provided
  if (civilIdNumber !== undefined) {
    if (!civilIdNumber || civilIdNumber.trim().length < 5) {
      return error('Valid Civil ID number is required (minimum 5 characters)', 400);
    }
    if (!civilIdExpiry || !/^\d{4}-\d{2}-\d{2}$/.test(civilIdExpiry)) {
      return error('Valid Civil ID expiry date is required (YYYY-MM-DD)', 400);
    }
    // Check if Civil ID is expired
    const expiryDate = new Date(civilIdExpiry);
    if (expiryDate < new Date()) {
      return error('The Civil ID has expired. Cannot proceed with verification.', 400);
    }
  }

  const result = await adOp();

  // Save audit log
  await db.auditLog.create({
    data: {
      agent_username: payload.username,
      action: opType,
      target_username: username,
      description: result.message,
      result: result.success ? 'success' : 'failure',
      agent_ip: clientIp,
    },
  });
  await db.aDOperation.create({
    data: {
      operation_type: opType,
      target_user: username,
      requested_by: payload.username,
      status: result.success ? 'completed' : 'failed',
    },
  });

  // Save civil ID verification record
  if (civilIdNumber && civilIdExpiry && result.success) {
    await db.civilIdVerification.create({
      data: {
        target_username: username,
        civil_id_number: civilIdNumber.trim(),
        civil_id_expiry: civilIdExpiry,
        verified_by: payload.username,
        agent_ip: clientIp,
        operation_type: opType,
      },
    });
  }

  return json(result);
}

// === ROUTE MATCHING ===
interface RouteEntry {
  pattern: string;
  paramNames: string[];
  handler: (ctx: RouteHandlerContext) => Promise<Response>;
}

const routes: Map<string, RouteEntry[]> = new Map();

function addRoute(method: string, pattern: string, handler: (ctx: RouteHandlerContext) => Promise<Response>) {
  if (!routes.has(method)) routes.set(method, []);
  const paramNames = [...pattern.matchAll(/:(\w+)/g)].map(m => m[1]);
  const regexStr = '^' + pattern.replace(/:(\w+)/g, '([^/]+)') + '$';
  (routes.get(method)!).push({ pattern: regexStr, paramNames, handler });
}

function matchRoute(method: string, pathname: string): { entry: RouteEntry; params: Record<string, string> } | null {
  const methodRoutes = routes.get(method);
  if (!methodRoutes) return null;
  for (const entry of methodRoutes) {
    const match = new RegExp(entry.pattern).exec(pathname);
    if (match) {
      const params: Record<string, string> = {};
      entry.paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
      return { entry, params };
    }
  }
  return null;
}

// === REGISTER ROUTES ===

// POST /auth/login
addRoute('POST', '/auth/login', async ({ body, clientIp }) => {
  const { username, password } = body as any;
  if (!username || !password) return error('Username and password are required');

  const user = await db.portalUser.findUnique({
    where: { username },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  if (!user) return error('Invalid username or password', 401);

  if (user.status !== 'active') {
    await db.auditLog.create({
      data: { agent_username: username, action: 'LOGIN', description: 'Login on disabled account', result: 'denied', agent_ip: clientIp },
    });
    return error('Account is disabled', 403);
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    await db.auditLog.create({
      data: { agent_username: username, action: 'LOGIN', description: 'Login while locked', result: 'denied', agent_ip: clientIp },
    });
    return error('Account temporarily locked. Try again later.', 423);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const fails = user.failed_logins + 1;
    const lock = fails >= 5;
    await db.portalUser.update({
      where: { id: user.id },
      data: { failed_logins: fails, locked_until: lock ? new Date(Date.now() + 15 * 60 * 1000) : null },
    });
    await db.auditLog.create({
      data: {
        agent_username: username, action: 'LOGIN',
        description: lock ? `Locked after ${fails} fails` : `Failed (${fails}/5)`,
        result: 'failure', agent_ip: clientIp,
      },
    });
    return error(lock ? 'Account locked' : 'Invalid username or password', lock ? 423 : 401);
  }

  const permissions = user.role.permissions.map(rp => rp.permission.name);
  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role.name, permissions },
    JWT_SECRET,
    { expiresIn: '8h' },
  );
  await db.portalUser.update({ where: { id: user.id }, data: { failed_logins: 0, locked_until: null } });
  await db.auditLog.create({
    data: { agent_username: user.username, action: 'LOGIN', description: 'Successful login', result: 'success', agent_ip: clientIp },
  });

  return json({
    token,
    user: { id: user.id, username: user.username, fullName: user.full_name, email: user.email, role: user.role.name, permissions },
  });
});

// GET /auth/me
addRoute('GET', '/auth/me', async ({ authHeader }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  const user = await getFullUser(payload.userId);
  if (!user || user.status !== 'active') return error('Account not found', 401);
  const perms = user.role.permissions.map(rp => rp.permission.name);
  return json({
    user: { id: user.id, username: user.username, fullName: user.full_name, email: user.email, role: user.role.name, permissions: perms },
  });
});

// GET /dashboard
addRoute('GET', '/dashboard', async ({ authHeader }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'view_reports')) return error('Insufficient permissions', 403);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [operationsToday, passwordResetsToday, disabledUsersToday, enabledUsersToday, activeAgents, recentActivity] = await Promise.all([
    db.auditLog.count({ where: { created_at: { gte: today }, result: 'success' } }),
    db.auditLog.count({ where: { created_at: { gte: today }, result: 'success', action: 'RESET_PASSWORD' } }),
    db.auditLog.count({ where: { created_at: { gte: today }, result: 'success', action: 'DISABLE_ACCOUNT' } }),
    db.auditLog.count({ where: { created_at: { gte: today }, result: 'success', action: 'ENABLE_ACCOUNT' } }),
    db.portalUser.count({ where: { status: 'active' } }),
    db.auditLog.findMany({ orderBy: { created_at: 'desc' }, take: 10 }),
  ]);

  return json({ operationsToday, passwordResetsToday, disabledUsersToday, enabledUsersToday, activeAgents, recentActivity });
});

// GET /users/search (real AD or mock)
addRoute('GET', '/users/search', async ({ searchParams, authHeader }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'search_users')) return error('Insufficient permissions', 403);

  const q = (searchParams.get('q') || '').trim();
  const field = searchParams.get('field') || '';
  if (!q) return json({ users: [], total: 0 });

  const result = await adSearchUsers(q, field || undefined);
  return json(result);
});

// GET /users/:username (real AD or mock)
addRoute('GET', '/users/:username', async ({ params, authHeader }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'view_user_details')) return error('Insufficient permissions', 403);

  try {
    const user = await adGetUser(params.username);
    return json(user);
  } catch {
    return error('User not found', 404);
  }
});

// GET /users/:username/verifications — civil ID verification history
addRoute('GET', '/users/:username/verifications', async ({ params, authHeader }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'view_user_details')) return error('Insufficient permissions', 403);

  const records = await db.civilIdVerification.findMany({
    where: { target_username: params.username },
    orderBy: { created_at: 'desc' },
    take: 50,
  });
  return json({ verifications: records, total: records.length });
});

// POST /users/:username/reset-password (real AD or mock)
addRoute('POST', '/users/:username/reset-password', async ({ params, body, clientIp, authHeader }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  const { civilIdNumber, civilIdExpiry, password } = body as any;
  return adMutation(payload, params.username, 'RESET_PASSWORD', 'reset_passwords',
    () => adResetPassword(params.username, password), clientIp, civilIdNumber, civilIdExpiry);
});

// POST /users/:username/unlock (real AD or mock)
addRoute('POST', '/users/:username/unlock', async ({ params, body, clientIp, authHeader }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  const { civilIdNumber, civilIdExpiry } = body as any;
  return adMutation(payload, params.username, 'UNLOCK_ACCOUNT', 'unlock_accounts',
    () => adUnlockAccount(params.username), clientIp, civilIdNumber, civilIdExpiry);
});

// POST /users/:username/enable (real AD or mock)
addRoute('POST', '/users/:username/enable', async ({ params, body, clientIp, authHeader }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  const { civilIdNumber, civilIdExpiry } = body as any;
  return adMutation(payload, params.username, 'ENABLE_ACCOUNT', 'enable_ad_accounts',
    () => adEnableAccount(params.username), clientIp, civilIdNumber, civilIdExpiry);
});

// POST /users/:username/disable (real AD or mock)
addRoute('POST', '/users/:username/disable', async ({ params, body, clientIp, authHeader }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  const { civilIdNumber, civilIdExpiry } = body as any;
  return adMutation(payload, params.username, 'DISABLE_ACCOUNT', 'disable_ad_accounts',
    () => adDisableAccount(params.username), clientIp, civilIdNumber, civilIdExpiry);
});

// POST /users/:username/force-password-change (real AD or mock)
addRoute('POST', '/users/:username/force-password-change', async ({ params, body, clientIp, authHeader }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  const { civilIdNumber, civilIdExpiry } = body as any;
  return adMutation(payload, params.username, 'FORCE_PASSWORD_CHANGE', 'force_password_change',
    () => adForcePasswordChange(params.username), clientIp, civilIdNumber, civilIdExpiry);
});

// GET /agents
addRoute('GET', '/agents', async ({ authHeader }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'create_agents')) return error('Insufficient permissions', 403);

  const agents = await db.portalUser.findMany({
    include: { role: { include: { permissions: { include: { permission: true } } } } },
    orderBy: { created_at: 'desc' },
  });

  return json(agents.map(a => ({
    id: a.id,
    username: a.username,
    fullName: a.full_name,
    email: a.email,
    location: a.location,
    phone: a.phone,
    status: a.status,
    role: { id: a.role.id, name: a.role.name, permissions: a.role.permissions.map(rp => rp.permission.name) },
    failedLogins: a.failed_logins,
    lockedUntil: a.locked_until,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  })));
});

// POST /agents
addRoute('POST', '/agents', async ({ body, clientIp, authHeader }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'create_agents')) return error('Insufficient permissions', 403);

  const { username, password, fullName, email, location, phone, roleId } = body as any;
  if (!username || !password || !fullName || !email || !roleId) return error('Missing required fields');

  const exists = await db.portalUser.findUnique({ where: { username } });
  if (exists) return error('Username already exists', 409);
  const role = await db.role.findUnique({ where: { id: roleId } });
  if (!role) return error('Role not found');

  const hash = await bcrypt.hash(password, 12);
  const agent = await db.portalUser.create({
    data: { username, password_hash: hash, full_name: fullName, email, location: location || null, phone: phone || null, role_id: roleId },
    include: { role: true },
  });

  await db.auditLog.create({
    data: { agent_username: payload.username, action: 'CREATE_AGENT', target_username: username, description: `Created agent ${username}`, result: 'success', agent_ip: clientIp },
  });

  return json({
    id: agent.id, username: agent.username, fullName: agent.full_name, email: agent.email,
    location: agent.location, phone: agent.phone, status: agent.status,
    role: { id: agent.role.id, name: agent.role.name },
  }, 201);
});

// PUT /agents/:id
addRoute('PUT', '/agents/:id', async ({ params, body, clientIp, authHeader }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'create_agents')) return error('Insufficient permissions', 403);

  const id = parseInt(params.id);
  const agent = await db.portalUser.update({
    where: { id },
    data: { full_name: body.fullName, email: body.email, location: body.location || null, phone: body.phone || null, role_id: body.roleId },
    include: { role: true },
  });
  await db.auditLog.create({
    data: { agent_username: payload.username, action: 'UPDATE_AGENT', target_username: agent.username, description: `Updated agent ${agent.username}`, result: 'success', agent_ip: clientIp },
  });
  return json({ id: agent.id, username: agent.username, fullName: agent.full_name, email: agent.email, status: agent.status, role: { id: agent.role.id, name: agent.role.name } });
});

// DELETE /agents/:id
addRoute('DELETE', '/agents/:id', async ({ params, clientIp, authHeader }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'create_agents')) return error('Insufficient permissions', 403);

  const id = parseInt(params.id);
  const agent = await db.portalUser.update({ where: { id }, data: { status: 'disabled' } });
  await db.auditLog.create({
    data: { agent_username: payload.username, action: 'DISABLE_AGENT', target_username: agent.username, description: `Disabled agent ${agent.username}`, result: 'success', agent_ip: clientIp },
  });
  return json({ success: true, message: `Agent '${agent.username}' disabled.` });
});

// PUT /agents/:id/password
addRoute('PUT', '/agents/:id/password', async ({ params, body, clientIp, authHeader }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'create_agents')) return error('Insufficient permissions', 403);

  const { password } = body as any;
  if (!password || password.length < 8) return error('Password must be at least 8 characters');

  const id = parseInt(params.id);
  const agent = await db.portalUser.findUnique({ where: { id } });
  if (!agent) return error('Agent not found', 404);

  const hash = await bcrypt.hash(password, 12);
  await db.portalUser.update({
    where: { id },
    data: { password_hash: hash, failed_logins: 0, locked_until: null },
  });
  await db.auditLog.create({
    data: { agent_username: payload.username, action: 'RESET_AGENT_PASSWORD', target_username: agent.username, description: `Reset password for agent ${agent.username}`, result: 'success', agent_ip: clientIp },
  });
  return json({ success: true, message: `Password reset for agent '${agent.username}'.` });
});

// GET /audit
addRoute('GET', '/audit', async ({ searchParams, authHeader }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'view_all_audit_logs')) return error('Insufficient permissions', 403);

  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const where: Record<string, any> = {};

  if (searchParams.get('dateFrom')) where.created_at = { ...where.created_at || {}, gte: new Date(searchParams.get('dateFrom')!) };
  if (searchParams.get('dateTo')) where.created_at = { ...where.created_at || {}, lte: new Date(searchParams.get('dateTo')!) };
  if (searchParams.get('agent')) where.agent_username = { contains: searchParams.get('agent') };
  if (searchParams.get('action')) where.action = { contains: searchParams.get('action') };
  if (searchParams.get('result')) where.result = searchParams.get('result');

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    db.auditLog.count({ where }),
  ]);
  return json({ logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

// GET /audit/export
addRoute('GET', '/audit/export', async ({ searchParams, authHeader }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'view_all_audit_logs')) return error('Insufficient permissions', 403);

  const where: Record<string, any> = {};

  if (searchParams.get('dateFrom')) where.created_at = { ...where.created_at || {}, gte: new Date(searchParams.get('dateFrom')!) };
  if (searchParams.get('dateTo')) where.created_at = { ...where.created_at || {}, lte: new Date(searchParams.get('dateTo')!) };
  if (searchParams.get('agent')) where.agent_username = { contains: searchParams.get('agent') };
  if (searchParams.get('action')) where.action = { contains: searchParams.get('action') };
  if (searchParams.get('result')) where.result = searchParams.get('result');

  const logs = await db.auditLog.findMany({ where, orderBy: { created_at: 'desc' }, take: 10000 });
  const header = 'Timestamp,Agent,Action,Target,Description,Result,IP\n';
  const rows = logs.map(l =>
    `${l.created_at.toISOString()},${l.agent_username},${l.action},${l.target_username || ''},"${(l.description || '').replace(/"/g, '""')}",${l.result},${l.agent_ip || ''}`,
  ).join('\n');

  return new Response(header + rows, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=audit-${Date.now()}.csv`,
    },
  });
});

// GET /civil-id/export — Export all Civil ID verifications to Excel (admin only)
addRoute('GET', '/civil-id/export', async ({ authHeader, searchParams }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'manage_roles')) return error('Admin only', 403);

  const where: Record<string, any> = {};
  const usernameFilter = searchParams.get('username');
  if (usernameFilter) where.target_username = { contains: usernameFilter };

  const verifications = await db.civilIdVerification.findMany({
    where,
    orderBy: { created_at: 'desc' },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AD Identity Portal';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Civil ID Verifications', {
    properties: { tabColor: { argb: '1d4ed8' } },
  });

  // Define columns
  sheet.columns = [
    { header: '#', key: 'id', width: 6 },
    { header: 'AD Username', key: 'target_username', width: 28 },
    { header: 'Civil ID Number', key: 'civil_id_number', width: 20 },
    { header: 'Civil ID Expiry', key: 'civil_id_expiry', width: 18 },
    { header: 'Operation', key: 'operation_type', width: 22 },
    { header: 'Verified By', key: 'verified_by', width: 18 },
    { header: 'Agent IP', key: 'agent_ip', width: 16 },
    { header: 'Verified At', key: 'created_at', width: 24 },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1d4ed8' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: '0f172a' } },
    };
  });

  // Add data rows
  const opLabels: Record<string, string> = {
    RESET_PASSWORD: 'Password Reset',
    UNLOCK_ACCOUNT: 'Unlock Account',
    ENABLE_ACCOUNT: 'Enable Account',
    DISABLE_ACCOUNT: 'Disable Account',
    FORCE_PASSWORD_CHANGE: 'Force Password Change',
  };

  verifications.forEach((v, i) => {
    const row = sheet.addRow({
      id: i + 1,
      target_username: v.target_username,
      civil_id_number: v.civil_id_number,
      civil_id_expiry: v.civil_id_expiry,
      operation_type: opLabels[v.operation_type] || v.operation_type,
      verified_by: v.verified_by,
      agent_ip: v.agent_ip || '-',
      created_at: v.created_at.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC'),
    });
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'e2e8f0' } },
      };
      // Zebra striping
      if (i % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'f8fafc' } };
      }
    });
    // Civil ID number column: monospace
    const cidCell = row.getCell(3);
    cidCell.font = { name: 'Consolas', size: 11 };
  });

  // Auto-filter
  sheet.autoFilter = { from: 'A1', to: `H${verifications.length + 1}` };

  // Freeze header
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Summary row
  const summaryRow = sheet.addRow({});
  const summaryIdx = verifications.length + 3;
  sheet.spliceRows(summaryIdx, 0, []);
  const sr = sheet.getRow(summaryIdx);
  sr.getCell(1).value = 'Summary';
  sr.getCell(1).font = { bold: true, size: 12 };
  sr.getCell(2).value = `Total Records: ${verifications.length}`;
  sr.getCell(4).value = `Generated: ${new Date().toLocaleString('en-OM', { timeZone: 'Asia/Muscat' })}`;
  sr.getCell(7).value = 'AD Identity Portal - Ministry of Housing';

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `civil-id-verifications-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

// GET /ad/ous — list OUs/containers where users can be created (Superadmin only)
addRoute('GET', '/ad/ous', async ({ authHeader }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'create_ad_accounts')) return error('Insufficient permissions', 403);

  const result = await adListOUs();
  return json(result);
});

// POST /ad/users — create a new AD account (Superadmin only)
addRoute('POST', '/ad/users', async ({ body, clientIp, authHeader }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'create_ad_accounts')) return error('Insufficient permissions', 403);

  const {
    firstName, lastName, displayName: providedDisplayName, sAMAccountName, email,
    ou, department, title, description, office, phone, employeeId,
    mustChangePassword, enabled,
  } = body as any;

  const fname = (firstName || '').trim();
  const lname = (lastName || '').trim();
  const uname = (sAMAccountName || '').trim();
  const mail = (email || '').trim();
  const oname = (ou || '').trim();
  const dName = (providedDisplayName || '').trim() || `${fname} ${lname}`.trim();

  if (!fname || !lname || !uname || !oname) return error('Missing required fields (firstName, lastName, username, OU)', 400);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(uname)) {
    return error('Username may only contain letters, numbers, dot, dash or underscore and must not start with a special character.', 400);
  }
  if (!mail) return error('Email is required', 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return error('A valid email address is required', 400);

  let password = ((body.password as string) || '').trim();
  let autoGenerated = false;
  if (!password) {
    password = generateSecurePassword();
    autoGenerated = true;
  } else {
    const invalid = validatePasswordInput(password);
    if (invalid) return error(invalid, 400);
  }

  const result = await adCreateUser({
    firstName: fname,
    lastName: lname,
    displayName: dName,
    sAMAccountName: uname,
    userPrincipalName: `${uname}@${adService.getADConfig().domain}`,
    mail,
    ou: oname,
    department: department?.trim() || undefined,
    title: title?.trim() || undefined,
    description: description?.trim() || undefined,
    office: office?.trim() || undefined,
    phone: phone?.trim() || undefined,
    employeeId: employeeId?.trim() || undefined,
    password,
    mustChangePassword: mustChangePassword !== false,
    enabled: enabled !== false,
  });

  await db.auditLog.create({
    data: {
      agent_username: payload.username,
      action: 'CREATE_AD_ACCOUNT',
      target_username: uname,
      description: result.message,
      result: result.success ? 'success' : 'failure',
      agent_ip: clientIp,
    },
  });
  await db.aDOperation.create({
    data: {
      operation_type: 'CREATE_AD_ACCOUNT',
      target_user: uname,
      requested_by: payload.username,
      status: result.success ? 'completed' : 'failed',
    },
  });

  if (autoGenerated && result.success) return json({ ...result, newPassword: password });
  return json(result);
});

// GET /ad/status — AD connection health check (performs a live bind when the cached status is stale)
addRoute('GET', '/ad/status', async () => {
  const cfg = adService.getADConfig();
  const cached = adService.getConnectionStatus();
  if (USE_REAL_AD && Date.now() - cached.lastCheck > 30000) {
    try {
      await adService.testConnection();
    } catch {
      // testConnection never throws; keep cached error on failure
    }
  }
  const status = adService.getConnectionStatus();
  return json({
    mode: USE_REAL_AD ? 'live' : 'mock',
    configured: adService.isADConfigured(),
    connected: status.connected,
    error: status.error,
    lastCheck: status.lastCheck,
    config: {
      url: cfg.url,
      host: cfg.host,
      port: cfg.port,
      useSSL: cfg.useSSL,
      baseDN: cfg.baseDN,
      domain: cfg.domain,
      searchBase: cfg.searchBase,
      bindDN: cfg.bindDN ? cfg.bindDN.replace(/^(.*?),.*/, '$1***') : '(not set)',
    },
  });
});

// POST /ad/test — test AD connection (admin only)
addRoute('POST', '/ad/test', async ({ authHeader }) => {
  const payload = authenticate(authHeader);
  if (!payload) return error('Unauthorized', 401);
  if (!hasPermission(payload.permissions, 'manage_roles')) return error('Insufficient permissions', 403);
  const result = await adService.testConnection();
  return json(result);
});

// === MAIN HANDLER ===
export async function handleApiRequest(
  method: string,
  pathname: string,
  body: any,
  authHeader: string | null,
  searchParams: URLSearchParams,
  request?: Request,
): Promise<Response> {
  const clientIp = request ? getClientIp(request) : 'unknown';

  const matched = matchRoute(method, pathname);
  if (!matched) return error('Not found', 404);

  try {
    return await matched.entry.handler({ params: matched.params, body, searchParams, clientIp, authHeader });
  } catch (err: unknown) {
    console.error('API Error:', err);
    return error('Internal server error', 500);
  }
}
