import ldap from 'ldapjs';
import fs from 'fs';

// ============================================================
// Active Directory Service — Real LDAPS/LDAP Integration
// ============================================================
// Supports: ministry.housing.gov.om domain
// Search by: sAMAccountName (employee ID), displayName, email, UPN
// Mutations: reset password, enable/disable, unlock, force pwd change
// ============================================================

// --- userAccountControl bit flags ---
const UAC = {
  SCRIPT:                 0x0001,
  ACCOUNTDISABLE:         0x0002,
  HOMEDIR_REQUIRED:       0x0008,
  LOCKOUT:                0x0010,
  PASSWD_NOTREQD:         0x0020,
  PASSWD_CANT_CHANGE:     0x0040,
  ENCRYPTED_TEXT_PWD_ALLOWED: 0x0080,
  TEMP_DUPLICATE_ACCOUNT: 0x0100,
  NORMAL_ACCOUNT:         0x0200,
  INTERDOMAIN_TRUST_ACCOUNT: 0x0800,
  WORKSTATION_TRUST_ACCOUNT: 0x1000,
  SERVER_TRUST_ACCOUNT:   0x2000,
  DONT_EXPIRE_PASSWORD:   0x10000,
  MNS_LOGON_ACCOUNT:      0x20000,
  SMARTCARD_REQUIRED:     0x40000,
  TRUSTED_FOR_DELEGATION: 0x80000,
  NOT_DELEGATED:          0x100000,
  USE_DES_KEY_ONLY:       0x200000,
  DONT_REQ_PREAUTH:       0x400000,
  PASSWORD_EXPIRED:       0x800000,
  TRUSTED_TO_AUTH_FOR_DELEGATION: 0x1000000,
  NO_AUTH_DATA_REQUIRED:  0x02000000,
  PARTIAL_SECRETS_ACCOUNT: 0x04000000,
} as const;

type AttrMap = Record<string, string | string[]>;

/** Normalize ldapjs v2/v3 attribute container into a keyed map */
function attrsToMap(attrs: any): AttrMap {
  const out: AttrMap = {};
  if (!attrs) return out;
  if (Array.isArray(attrs)) {
    // ldapjs v3: array of { type, values }
    for (const a of attrs) {
      if (a && typeof a === 'object' && a.type) {
        const vals = a.values;
        out[a.type] = Array.isArray(vals)
          ? vals.map((x: any) => String(x))
          : String(vals ?? '');
      }
    }
  } else if (typeof attrs === 'object') {
    // ldapjs v2: keyed object; values may be array/string/LdapAttribute
    for (const [k, v] of Object.entries(attrs)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && 'values' in v) {
        const vals = (v as any).values;
        out[k] = Array.isArray(vals) ? vals.map((x: any) => String(x)) : String(vals ?? '');
      } else if (Array.isArray(v)) {
        out[k] = v.map((x: any) => String(x));
      } else if (typeof v === 'string') {
        out[k] = v;
      }
    }
  }
  return out;
}

function getFirstValue(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] || '';
  if (typeof v === 'string') return v;
  return '';
}

/** Normalize a DN (string or ldapjs DN object) to string */
function dnToString(dn: any): string {
  if (typeof dn === 'string') return dn;
  if (dn && typeof dn.toString === 'function') return dn.toString();
  return String(dn ?? '');
}

// --- Config from env ---
interface ADConfig {
  url: string;          // ldap://host:port or ldaps://host:port
  host: string;
  port: number;
  useSSL: boolean;
  baseDN: string;       // DC=ministry,DC=housing,DC=gov,DC=om
  bindDN: string;       // CN=svc_ad_portal,OU=Service Accounts,DC=ministry,DC=housing,DC=gov,DC=om
  bindPassword: string;
  domain: string;       // ministry.housing.gov.om
  searchBase: string;   // same as baseDN or narrower OU
  userFilter: string;   // (objectClass=user)
  pageSize: number;
}

let _config: ADConfig | null = null;
let _connected = false;
let _lastError: string | null = null;
let _lastCheck: number = 0;

export function getADConfig(): ADConfig {
  if (_config) return _config;
  const useSSL = (process.env.AD_USE_SSL || 'false').toLowerCase() === 'true';
  const host = process.env.AD_HOST || '10.177.19.9';
  const port = parseInt(process.env.AD_PORT || (useSSL ? '636' : '389'));
  _config = {
    url: `${useSSL ? 'ldaps' : 'ldap'}://${host}:${port}`,
    host,
    port,
    useSSL,
    baseDN: process.env.AD_BASE_DN || 'DC=ministry,DC=housing,DC=gov,DC=om',
    bindDN: process.env.AD_BIND_DN || '',
    bindPassword: process.env.AD_BIND_PASSWORD || '',
    domain: process.env.AD_DOMAIN || 'ministry.housing.gov.om',
    searchBase: process.env.AD_SEARCH_BASE || process.env.AD_BASE_DN || 'DC=ministry,DC=housing,DC=gov,DC=om',
    userFilter: process.env.AD_USER_FILTER || '(objectClass=user)',
    pageSize: parseInt(process.env.AD_PAGE_SIZE || '100'),
  };
  return _config;
}

export function isADConfigured(): boolean {
  const cfg = getADConfig();
  return !!(cfg.bindDN && cfg.bindPassword);
}

// --- Connection pool (simple singleton) ---
function loadTlsCa(): Buffer[] | undefined {
  const caPath = process.env.AD_CA_CERT;
  if (!caPath) return undefined;
  try {
    return [fs.readFileSync(caPath)];
  } catch (err: any) {
    console.error('[AD] Failed to read CA cert file:', caPath, err.message);
    return undefined;
  }
}

function createClient(): Promise<ldap.Client> {
  return new Promise((resolve, reject) => {
    const cfg = getADConfig();
    const tlsReject = (process.env.AD_TLS_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false';
    const tlsOptions: any = { rejectUnauthorized: tlsReject };
    if (cfg.useSSL) {
      const ca = loadTlsCa();
      if (ca) tlsOptions.ca = ca;
      if (process.env.AD_TLS_SERVERNAME) tlsOptions.servername = process.env.AD_TLS_SERVERNAME;
    }
    const client = ldap.createClient({
      url: cfg.url,
      connectTimeout: 10000,
      timeout: 30000,
      ...(cfg.useSSL ? { tlsOptions } : {}),
    });

    if (cfg.useSSL) {
      // Production: set AD_CA_CERT to the PEM file of the CA that issued the DC's
      // LDAPS certificate and keep AD_TLS_REJECT_UNAUTHORIZED=true (or unset).
      // The CA file can also be supplied via NODE_EXTRA_CA_CERTS as an alternative.
    }

    client.on('error', (err) => {
      console.error('[AD] Client error:', err.message);
    });

    resolve(client);
  });
}

/** Bind (authenticate) to AD with the service account */
async function bind(client: ldap.Client): Promise<void> {
  const cfg = getADConfig();
  return new Promise((resolve, reject) => {
    client.bind(cfg.bindDN, cfg.bindPassword, (err) => {
      if (err) {
        _lastError = `Bind failed: ${err.message}`;
        reject(new Error(_lastError));
      } else {
        _lastError = null;
        resolve();
      }
    });
  });
}

/** Unbind and destroy the client */
async function unbind(client: ldap.Client): Promise<void> {
  return new Promise((resolve) => {
    try {
      client.unbind(() => resolve());
    } catch {
      resolve();
    }
    try {
      client.destroy();
    } catch {
      // ignore
    }
  });
}

// --- AD User type (matches the frontend interface) ---
export interface ADUser {
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

// --- Parse AD attributes into our ADUser interface ---
function parseADUser(dn: any, attrs: ldap.SearchEntryAttributes): ADUser {
  const map = attrsToMap(attrs);
  const getFirst = (attr: string): string => getFirstValue(map[attr]);
  const getArray = (attr: string): string[] => {
    const v = map[attr];
    if (Array.isArray(v)) return v;
    if (typeof v === 'string' && v) return [v];
    return [];
  };

  const dnStr = getFirstValue(map['distinguishedName']) || dnToString(dn);
  const uac = parseInt(getFirst('userAccountControl')) || 0;
  const enabled = !(uac & UAC.ACCOUNTDISABLE);
  const lockoutTime = parseInt(getFirst('lockoutTime')) || 0;
  const locked = lockoutTime > 0;

  const pwdLastSet = parseInt(getFirst('pwdLastSet')) || 0;
  const lastLogon = parseInt(getFirst('lastLogon')) || 0;
  const accountExpires = parseInt(getFirst('accountExpires')) || 0;
  const whenCreated = getFirst('whenCreated');
  const memberOf = getArray('memberOf');
  const groups = memberOf.map(dn => {
    const m = dn.match(/^CN=([^,]+)/i);
    return m ? m[1] : dn;
  });

  // Parse department from OU in DN (fallback if department attr is empty)
  const departmentAttr = getFirst('department');
  let department = departmentAttr;
  if (!department) {
    const ouMatch = dnStr.match(/OU=([^,]+)/i);
    if (ouMatch) department = ouMatch[1].replace(/_/g, ' ');
  }

  // Email: prefer mail attribute, fallback to userPrincipalName
  const mail = getFirst('mail') || getFirst('userPrincipalName') || '';

  // Format dates
  const FILETIME_EPOCH = 116444736000000000n; // Jan 1, 1970 in 100-ns intervals
  const filetimeToDate = (ft: number): string | null => {
    if (!ft || ft === 0 || ft >= 9223372036854775807) return null; // never expires
    const ms = Number((BigInt(ft) - FILETIME_EPOCH) / 10000n);
    if (ms <= 0) return null;
    return new Date(ms).toISOString();
  };

  return {
    displayName: getFirst('displayName') || getFirst('cn') || getFirst('sAMAccountName'),
    username: getFirst('sAMAccountName'),
    email: mail,
    department,
    title: getFirst('title'),
    employeeId: getFirst('employeeId') || getFirst('sAMAccountName'),
    enabled,
    locked,
    lastLogon: filetimeToDate(lastLogon),
    groups,
    distinguishedName: dnStr,
    phone: getFirst('telephoneNumber') || '',
    office: getFirst('physicalDeliveryOfficeName') || '',
    manager: getFirst('manager') ? (() => {
      const m = getFirst('manager').match(/CN=([^,]+)/i);
      return m ? m[1] : getFirst('manager');
    })() : '',
    whenCreated: parseGeneralizedTime(whenCreated),
    passwordLastSet: filetimeToDate(pwdLastSet),
    accountExpires: filetimeToDate(accountExpires),
    description: getFirst('description') || null,
  };
}

// --- Parse Microsoft FILETIME to readable date string ---
function filetimeToReadable(ft: number): string {
  if (!ft || ft === 0 || ft >= 9223372036854775807) return 'Never';
  const FILETIME_EPOCH = 116444736000000000n;
  const ms = Number((BigInt(ft) - FILETIME_EPOCH) / 10000n);
  if (ms <= 0) return 'Never';
  return new Date(ms).toLocaleString();
}

// --- Parse AD generalized time (YYYYMMDDHHMMSS.0Z) into ISO string ---
function parseGeneralizedTime(gt: string): string {
  if (!gt) return '';
  const m = gt.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (m) {
    const [, y, mo, d, h, mi, s] = m;
    return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
  }
  const d = new Date(gt);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

// ============================================================
// PUBLIC API
// ============================================================

/** Test AD connection — returns status info */
export async function testConnection(): Promise<{ connected: boolean; error?: string; latencyMs?: number; serverInfo?: string }> {
  const cfg = getADConfig();
  if (!cfg.bindDN || !cfg.bindPassword) {
    return { connected: false, error: 'AD not configured. Set AD_BIND_DN and AD_BIND_PASSWORD in .env' };
  }

  const start = Date.now();
  const client = await createClient();
  try {
    await bind(client);
    const latency = Date.now() - start;

    // Read root DSE to verify the connection
    const rootDSE = await new Promise<string>((resolve, reject) => {
      client.search('', { scope: 'base', attributes: ['dnsHostName', 'domainFunctionality', 'defaultNamingContext'] }, (err, res) => {
        if (err) return reject(err);
        let info = '';
        res.on('searchEntry', (entry) => {
          const m = attrsToMap(entry.attributes);
          info = `DNS: ${getFirstValue(m.dnsHostName) || 'N/A'}, NC: ${getFirstValue(m.defaultNamingContext) || 'N/A'}`;
        });
        res.on('end', () => resolve(info));
        res.on('error', (e) => reject(e));
      });
    });

    _connected = true;
    _lastCheck = Date.now();
    return { connected: true, latencyMs: latency, serverInfo: rootDSE };
  } catch (err: any) {
    _connected = false;
    _lastError = err.message;
    return { connected: false, error: err.message };
  } finally {
    await unbind(client);
  }
}

/** Get current connection status (cached) */
export function getConnectionStatus(): { connected: boolean; error: string | null; lastCheck: number } {
  // Consider stale after 60 seconds
  if (_connected && Date.now() - _lastCheck > 60000) {
    _connected = false;
  }
  return { connected: _connected, error: _lastError, lastCheck: _lastCheck };
}

/** Search AD users by query */
export async function searchUsers(query: string, field?: string): Promise<{ users: ADUser[]; total: number }> {
  const cfg = getADConfig();
  const client = await createClient();
  try {
    await bind(client);

    // Build LDAP filter based on field
    let filter: string;
    const q = query.replace(/[()*\\]/g, '\$&'); // Escape LDAP special chars

    if (field === 'username' || field === 'employeeId') {
      filter = `(&(objectClass=user)(sAMAccountName=*${q}*))`;
    } else if (field === 'email') {
      filter = `(&(objectClass=user)(|(mail=*${q}*)(userPrincipalName=*${q}*)))`;
    } else {
      // Search across multiple fields
      filter = `(&(objectClass=user)(|(sAMAccountName=*${q}*)(displayName=*${q}*)(mail=*${q}*)(userPrincipalName=*${q}*)(employeeId=*${q}*)(title=*${q}*)(department=*${q}*)))`;
    }

    // Also exclude computer accounts
    filter = filter.replace('(objectClass=user)', '(&(objectClass=user)(!(objectClass=computer)))');

    const users: ADUser[] = [];
    let total = 0;

    // First do a quick count (sized) search
    await new Promise<void>((resolve, reject) => {
      client.search(cfg.searchBase, {
        filter,
        scope: 'sub',
        sizeLimit: 50,
        attributes: [
          'sAMAccountName', 'displayName', 'cn', 'mail', 'userPrincipalName',
          'department', 'title', 'employeeId', 'userAccountControl', 'lockoutTime',
          'pwdLastSet', 'lastLogon', 'whenCreated', 'accountExpires', 'telephoneNumber',
          'physicalDeliveryOfficeName', 'manager', 'description', 'memberOf',
          'distinguishedName',
        ],
      }, (err, res) => {
        if (err) return reject(err);
        res.on('searchEntry', (entry) => {
          total++;
          if (users.length < 50) {
            users.push(parseADUser(entry.dn, entry.attributes));
          }
        });
        res.on('end', (result) => {
          if (result?.status === 0) resolve();
          else reject(new Error(`LDAP search failed: status ${result?.status}`));
        });
        res.on('error', reject);
      });
    });

    _connected = true;
    _lastCheck = Date.now();
    return { users, total };
  } catch (err: any) {
    _connected = false;
    _lastError = err.message;
    throw new Error(`AD search failed: ${err.message}`);
  } finally {
    await unbind(client);
  }
}

/** Get a single AD user by sAMAccountName */
export async function getUser(username: string): Promise<ADUser> {
  const cfg = getADConfig();
  const client = await createClient();
  try {
    await bind(client);

    const escaped = username.replace(/[()*\\]/g, '\$&');
    const filter = `(&(objectClass=user)(!(objectClass=computer))(sAMAccountName=${escaped}))`;

    let found: ADUser | null = null;

    await new Promise<void>((resolve, reject) => {
      client.search(cfg.searchBase, {
        filter,
        scope: 'sub',
        sizeLimit: 1,
        attributes: [
          'sAMAccountName', 'displayName', 'cn', 'mail', 'userPrincipalName',
          'department', 'title', 'employeeId', 'userAccountControl', 'lockoutTime',
          'pwdLastSet', 'lastLogon', 'whenCreated', 'accountExpires', 'telephoneNumber',
          'physicalDeliveryOfficeName', 'manager', 'description', 'memberOf',
          'distinguishedName',
        ],
      }, (err, res) => {
        if (err) return reject(err);
        res.on('searchEntry', (entry) => {
          found = parseADUser(entry.dn, entry.attributes);
        });
        res.on('end', (result) => {
          if (result?.status === 0) resolve();
          else reject(new Error(`LDAP search failed: status ${result?.status}`));
        });
        res.on('error', reject);
      });
    });

    if (!found) throw new Error('User not found');

    _connected = true;
    _lastCheck = Date.now();
    return found;
  } catch (err: any) {
    _connected = false;
    _lastError = err.message;
    throw err;
  } finally {
    await unbind(client);
  }
}

/** Reset a user's password via LDAP (unicodePwd attribute - requires LDAPS/secure channel) */
export async function resetPassword(username: string, newPassword: string): Promise<void> {
  const cfg = getADConfig();
  const client = await createClient();
  try {
    await bind(client);

    const user = await getUserByDN(client, cfg, username);

    await new Promise<void>((resolve, reject) => {
      // AD password set via the unicodePwd attribute (UTF-16LE, double-quoted).
      // AD rejects this over unencrypted connections - use LDAPS (port 636).
      const pwd = Buffer.from(`"${newPassword}"`, 'utf16le');
      rawModify(client, user.dn, [
        new ldap.Change({ operation: 'replace', modification: new ldap.Attribute({ type: 'unicodePwd', values: [pwd] }) }),
      ]).then(resolve, (err: any) => reject(new Error(`Password reset failed: ${err.message}`)));
    });

    _connected = true;
    _lastCheck = Date.now();
  } catch (err: any) {
    _connected = false;
    _lastError = err.message;
    throw err;
  } finally {
    await unbind(client);
  }
}

/** Enable a disabled AD account (remove ACCOUNTDISABLE flag) */
export async function enableAccount(username: string): Promise<void> {
  await modifyUserAccountControl(username, UAC.ACCOUNTDISABLE, false);
}

/** Disable an AD account (add ACCOUNTDISABLE flag) */
export async function disableAccount(username: string): Promise<void> {
  await modifyUserAccountControl(username, UAC.ACCOUNTDISABLE, true);
}

/** Unlock a locked AD account (clear lockoutTime) */
export async function unlockAccount(username: string): Promise<void> {
  const cfg = getADConfig();
  const client = await createClient();
  try {
    await bind(client);

    const user = await getUserByDN(client, cfg, username);

    await new Promise<void>((resolve, reject) => {
      rawModify(client, user.dn, [
        new ldap.Change({ operation: 'replace', modification: new ldap.Attribute({ type: 'lockoutTime', values: ['0'] }) }),
      ]).then(resolve, (err: any) => reject(new Error(`Unlock failed: ${err.message}`)));
    });

    _connected = true;
    _lastCheck = Date.now();
  } catch (err: any) {
    _connected = false;
    _lastError = err.message;
    throw err;
  } finally {
    await unbind(client);
  }
}

/**
 * Force password change at next logon: set a new temporary password AND
 * mark the account (pwdLastSet = 0) so the user must change it on next logon.
 * Both changes are applied atomically in a single LDAP modify.
 */
export async function forcePasswordChange(username: string, newPassword: string): Promise<void> {
  const cfg = getADConfig();
  const client = await createClient();
  try {
    await bind(client);

    const user = await getUserByDN(client, cfg, username);

    await new Promise<void>((resolve, reject) => {
      const pwd = Buffer.from(`"${newPassword}"`, 'utf16le');
      rawModify(client, user.dn, [
        new ldap.Change({ operation: 'replace', modification: new ldap.Attribute({ type: 'unicodePwd', values: [pwd] }) }),
        new ldap.Change({ operation: 'replace', modification: new ldap.Attribute({ type: 'pwdLastSet', values: ['0'] }) }),
      ]).then(resolve, (err: any) => reject(new Error(`Force password change failed: ${err.message}`)));
    });

    _connected = true;
    _lastCheck = Date.now();
  } catch (err: any) {
    _connected = false;
    _lastError = err.message;
    throw err;
  } finally {
    await unbind(client);
  }
}

// --- Internal helpers ---

/**
 * Send an LDAP modify with the DN written to the wire as raw UTF-8.
 * ldapjs's client.modify() runs the DN through DN.fromString().toString(), which
 * re-escapes every non-ASCII byte as \xx - and AD rejects that escaped form with
 * "No Such Object". Constructing the ModifyRequest directly keeps the raw string.
 */
function rawModify(client: ldap.Client, dn: string, changes: ldap.Change[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = new ldap.ModifyRequest({ object: dn, changes });
    (client as any)._send(req, [ldap.LDAP_SUCCESS], null, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function getUserByDN(client: ldap.Client, cfg: ADConfig, username: string): Promise<{ dn: string; uac: number; locked: boolean; enabled: boolean }> {
  const escaped = username.replace(/[()*\\]/g, '\$&');
  const filter = `(&(objectClass=user)(!(objectClass=computer))(sAMAccountName=${escaped}))`;

  return new Promise((resolve, reject) => {
    client.search(cfg.searchBase, {
      filter,
      scope: 'sub',
      sizeLimit: 1,
      attributes: ['userAccountControl', 'lockoutTime', 'distinguishedName'],
    }, (err, res) => {
      if (err) return reject(err);
      res.on('searchEntry', (entry) => {
        const m = attrsToMap(entry.attributes);
        const uac = parseInt(getFirstValue(m.userAccountControl)) || 0;
        const lockoutTime = parseInt(getFirstValue(m.lockoutTime)) || 0;
        resolve({
          dn: getFirstValue(m.distinguishedName) || dnToString(entry.dn),
          uac,
          locked: lockoutTime > 0,
          enabled: !(uac & UAC.ACCOUNTDISABLE),
        });
      });
      res.on('end', () => reject(new Error('User not found')));
      res.on('error', reject);
    });
  });
}

async function modifyUserAccountControl(username: string, flag: number, set: boolean): Promise<void> {
  const cfg = getADConfig();
  const client = await createClient();
  try {
    await bind(client);

    const user = await getUserByDN(client, cfg, username);

    let newUAC: number;
    if (set) {
      newUAC = user.uac | flag;
    } else {
      newUAC = user.uac & ~flag;
    }

    await new Promise<void>((resolve, reject) => {
      rawModify(client, user.dn, [
        new ldap.Change({ operation: 'replace', modification: new ldap.Attribute({ type: 'userAccountControl', values: [String(newUAC)] }) }),
      ]).then(resolve, (err: any) => reject(new Error(`UAC modify failed: ${err.message}`)));
    });

    _connected = true;
    _lastCheck = Date.now();
  } catch (err: any) {
    _connected = false;
    _lastError = err.message;
    throw err;
  } finally {
    await unbind(client);
  }
}
