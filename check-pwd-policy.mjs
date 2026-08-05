import ldap from 'ldapjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nextEnv from '@next/env';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { loadEnvConfig } = nextEnv;
loadEnvConfig(__dirname);

const username = process.argv[2];
const candidate = process.argv[3];

let POLICY = {};
let ACCOUNT_UPN = null;

const FILETIME_EPOCH = 116444736000000000n;

function filetimeToReadable(ftRaw) {
  if (!ftRaw) return 'n/a';
  const n = BigInt(String(ftRaw).trim());
  if (n <= 0n || n >= 9223372036854775807n) return '0 (MUST CHANGE AT NEXT LOGON)';
  const ms = Number((n - FILETIME_EPOCH) / 10000n);
  return new Date(ms).toISOString();
}

function filetimeToMs(ftRaw) {
  const n = BigInt(String(ftRaw).trim());
  if (n <= 0n) return 0;
  return Number((n - FILETIME_EPOCH) / 10000n);
}

function filetimeToDays(raw) {
  if (!raw) return null;
  const n = BigInt(String(raw).trim());
  if (n === 0n) return null;
  const abs = n < 0n ? -n : n;
  return Number(abs / 10000000n / 86400n);
}

function tlsOptions() {
  const tls = { servername: process.env.AD_TLS_SERVERNAME || undefined };
  if (process.env.AD_CA_CERT) {
    try { tls.ca = [fs.readFileSync(path.resolve(__dirname, process.env.AD_CA_CERT))]; } catch { /* ignore */ }
  }
  if ((process.env.AD_TLS_REJECT_UNAUTHORIZED || 'true').toLowerCase() === 'false') tls.rejectUnauthorized = false;
  return tls;
}

const useSSL = (process.env.AD_USE_SSL || 'false').toLowerCase() === 'true';
const host = process.env.AD_HOST || '10.177.19.9';
const port = parseInt(process.env.AD_PORT || (useSSL ? '636' : '389'));
const baseDN = process.env.AD_BASE_DN || 'DC=ministry,DC=housing,DC=gov,DC=om';
const bindDN = process.env.AD_BIND_DN || '';
const bindPassword = process.env.AD_BIND_PASSWORD || '';

if (!bindDN || !bindPassword) {
  console.log('ERROR: AD_BIND_DN / AD_BIND_PASSWORD not set in .env');
  process.exit(1);
}

const client = ldap.createClient({ url: `${useSSL ? 'ldaps' : 'ldap'}://${host}:${port}`, tlsOptions: tlsOptions(), connectTimeout: 10000, timeout: 30000 });
client.on('error', (err) => console.log('client error:', err.message));

client.bind(bindDN, bindPassword, (err) => {
  if (err) { console.log('BIND FAILED:', err.message); process.exit(1); }
  console.log('BIND: OK');
  readPasswordPolicy();
});

function readPasswordPolicy() {
  client.search(baseDN, {
    filter: '(objectClass=domainDNS)',
    scope: 'base', sizeLimit: 1,
    attributes: ['minPwdLength', 'pwdProperties', 'pwdHistoryLength', 'maxPwdAge', 'minPwdAge', 'dc', 'name'],
  }, (serr, res) => {
    if (serr) { console.log('Policy search failed:', serr.message); process.exit(1); }
    let got = false;
    res.on('searchEntry', (e) => {
      got = true;
      const m = {};
      for (const a of e.attributes) m[a.type] = a.values.map((x) => String(x));
      const minLen = parseInt(m.minPwdLength?.[0] || '0');
      const props = parseInt(m.pwdProperties?.[0] || '0');
      const history = parseInt(m.pwdHistoryLength?.[0] || '0');
      const maxAge = parseFiletime(m.maxPwdAge?.[0]);
      const minAge = parseFiletime(m.minPwdAge?.[0]);

      POLICY = { minLen, props, history, minAgeDays: filetimeToDays(m.minPwdAge?.[0]) };

      console.log('\n=== DOMAIN PASSWORD POLICY ===');
      console.log('domain            :', m.dc?.[0] || baseDN);
      console.log('minimum length    :', minLen, 'characters');
      console.log('complexity        :', props & 0x1 ? 'REQUIRED (upper + lower + digit + symbol)' : 'not required');
      console.log('history length    :', history, 'previous passwords cannot be reused');
      console.log('max password age  :', maxAge, '(password expires)');
      console.log('min password age  :', minAge, '(cannot change again until this elapses)');
      console.log('pwdProperties bits: 0x' + props.toString(16));
      if (props & 0x2) console.log('  >> 0x2 NO_CLEAR_CHANGE set: password change must go through a domain-joined login/OWA, not plain LDAP');
      if (props & 0x4) console.log('  >> 0x4 NO_ANON_CHANGE set: anonymous password change not allowed');
    });
    res.on('end', () => {
      if (!got) { console.log('Could not read password policy object.'); process.exit(1); }
      if (username && candidate) checkCandidate();
      else { cleanup(); process.exit(0); }
    });
    res.on('error', (e) => { console.log('Policy search error:', e.message); process.exit(1); });
  });
}

function parseFiletime(raw) {
  if (!raw) return 'n/a';
  const n = BigInt(String(raw).trim());
  if (n === 0n) return 'never expires';
  const abs = n < 0n ? -n : n;
  const days = Number(abs / 10000000n / 86400n);
  return days > 0 ? `${days} day(s)` : `${Math.max(0, Math.round(Number(abs / 10000000n / 3600n)))} hour(s)`;
}

function checkCandidate() {
  let foundDN = null;
  let curSam = '';
      client.search(baseDN, {
        filter: `(&(objectClass=user)(sAMAccountName=${username.replace(/[()*\\]/g, '\\$&')}))`,
        scope: 'sub', sizeLimit: 1,
        attributes: ['sAMAccountName', 'userPrincipalName', 'displayName', 'pwdLastSet', 'userAccountControl', 'lockoutTime', 'badPwdCount', 'accountExpires', 'distinguishedName', 'cn', 'objectClass'],
      }, (serr, res) => {
        if (serr) { console.log('User search failed:', serr.message); cleanup(); process.exit(1); }
        let found = false;
        res.on('searchEntry', (e) => {
          found = true;
          const m = {};
          for (const a of e.attributes) m[a.type] = a.values.map((x) => String(x));
          console.log('\n=== ACCOUNT STATE for', username, '===');
          const uac = parseInt(m.userAccountControl?.[0] || '0');
          const pwdLastSet = m.pwdLastSet?.[0];
          const lockoutTime = parseInt(m.lockoutTime?.[0] || '0');
          const badPwdCount = parseInt(m.badPwdCount?.[0] || '0');
          foundDN = m.distinguishedName?.[0] || e.dn.toString();
          curSam = m.sAMAccountName?.[0] || '';
          console.log('DN (from search)  :', foundDN);
          console.log('DN (attribute)    :', m.distinguishedName?.[0] || '(not returned)');
          console.log('cn                :', m.cn?.[0] || '(none)');
          console.log('objectClass       :', (m.objectClass || []).join(', '));
          console.log('UPN               :', m.userPrincipalName?.[0] || '(none)');
          ACCOUNT_UPN = m.userPrincipalName?.[0] || null;
          if (uac & 0x2) console.log('!! account is DISABLED');
          if (uac & 0x20) console.log('!! PASSWD_NOTREQD set: user may not be required to have a password');
          console.log('badPwdCount      :', badPwdCount, badPwdCount > 0 ? '(wrong passwords have been tried)' : '');
          if (lockoutTime && lockoutTime !== -1) {
            console.log('!! ACCOUNT IS LOCKED OUT (lockoutTime set). Unlock it in the portal first.');
          } else {
            console.log('lockoutTime      : not locked');
          }
          const expires = parseInt(m.accountExpires?.[0] || '0');
          if (expires && expires > 0 && expires < 9223372036854775807) console.log('!! ACCOUNT EXPIRES:', filetimeToReadable(expires));
          if (pwdLastSet === '0') {
            console.log('!! pwdLastSet = 0 -> MUST CHANGE AT NEXT LOGON (flag ACTIVE - correct after Force)');
          } else {
            console.log('pwdLastSet       :', filetimeToReadable(pwdLastSet));
            const minAgeDays = POLICY.minAgeDays;
            if (minAgeDays && minAgeDays > 0) {
              const setMs = filetimeToMs(pwdLastSet);
              const allowedMs = setMs + minAgeDays * 86400000;
              const canChangeOn = new Date(allowedMs).toISOString();
              if (allowedMs > Date.now()) {
                console.log(`!! MIN PASSWORD AGE (${minAgeDays} day(s)) still active: another change is BLOCKED until ${canChangeOn}`);
                console.log(`   -> this is the most likely reason a new password is "not taking"`);
              } else {
                console.log(`   min password age (${minAgeDays} day(s)) satisfied - change allowed now`);
              }
            }
          }

      client.search(baseDN, {
        filter: '(objectClass=domainDNS)', scope: 'base', sizeLimit: 1,
        attributes: ['minPwdLength', 'pwdProperties', 'pwdHistoryLength'],
      }, (e2, r2) => {
        r2.on('searchEntry', (ee) => {
          const pp = {};
          for (const a of ee.attributes) pp[a.type] = a.values.map((x) => String(x));
          const minLen = parseInt(pp.minPwdLength?.[0] || '0');
          const complexity = parseInt(pp.pwdProperties?.[0] || '0') & 0x1;

          const fails = [];
          if (candidate.length < minLen) fails.push(`length ${candidate.length} < required ${minLen}`);
          if (complexity) {
            const classes = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(candidate)).length;
            if (classes < 3) fails.push(`only ${classes} of 4 character classes (need upper+lower+digit+symbol)`);
          }
          if (candidate.toLowerCase().includes(username.toLowerCase())) fails.push('contains the username');
          if (candidate === candidate.toLowerCase() || candidate === candidate.toUpperCase()) {
            if (complexity) fails.push('all same case');
          }
          if (fails.length) {
            console.log('RESULT: REJECTED by policy ->');
            for (const f of fails) console.log('  -', f);
          } else {
            console.log('RESULT: PASSES policy checks (length + complexity + not containing username)');
          }
        });
        r2.on('end', () => {
          const arg4 = process.argv[4];
          if (arg4 === '--login') testLogin(username, candidate);
          else if (arg4 === '--test-modify') testModify(foundDN, curSam);
          else if (arg4 === '--reset') testReset(foundDN, process.argv[5]);
          else { cleanup(); process.exit(0); }
        });
        r2.on('error', (er) => { console.log(er.message); cleanup(); process.exit(1); });
      });
    });
    res.on('end', () => {
      if (!found) { console.log('User not found:', username); cleanup(); process.exit(1); }
    });
    res.on('error', (e) => { console.log('User search error:', e.message); cleanup(); process.exit(1); });
  });
}

function cleanup() {
  try { client.unbind(() => {}); } catch {}
  try { client.destroy(); } catch {}
}

function testLogin(username, password) {
  console.log('\n=== LOGIN TEST (bind as the user with the supplied password) ===');
  const domain = process.env.AD_DOMAIN || 'ministry.housing.gov.om';
  const bindAs = ACCOUNT_UPN || `${username}@${domain}`;
  const c2 = ldap.createClient({ url: `${useSSL ? 'ldaps' : 'ldap'}://${host}:${port}`, tlsOptions: tlsOptions(), connectTimeout: 10000, timeout: 30000 });
  c2.on('error', (e) => console.log('login client error:', e.message));
  console.log('binding as       :', bindAs);
  c2.bind(bindAs, password, (err) => {
    if (err) {
      const code = err.code;
      const raw = String(err.message || err.name || '').toLowerCase();
      const looksMustChange = raw.includes('52d') || raw.includes('must be changed') || raw.includes('must change');
      const looksBadPwd = raw.includes('52e');
      console.log(`LOGIN TEST: FAILED (${code ? '0x' + code.toString(16) : 'no code'})`);
      console.log('   raw message  :', err.message || err.name || JSON.stringify(err));
      if (looksMustChange) {
        console.log('   INTERPRETATION: password is CORRECT but the account is forced to change it (0x52d).');
        console.log('   -> the temp password on AD matches; the failure is OWA-side (typing/username/browser).');
      } else if (looksBadPwd) {
        console.log('   INTERPRETATION: password is WRONG on AD (0x52e).');
        console.log('   -> AD holds a different password than the one being tested.');
      } else {
        console.log('   INTERPRETATION: generic invalid-credentials (locked/disabled/wrong/must-change all look the same here).');
      }
    } else {
      console.log('LOGIN TEST: OK - this password works on the DC right now.');
    }
    try { c2.unbind(() => {}); } catch {}
    try { c2.destroy(); } catch {}
    cleanup();
    process.exit(0);
  });
}

// Reproduce the portal's modify on the search-derived DN (benign no-op on sAMAccountName)
// Uses a raw ModifyRequest so the DN is written as raw UTF-8 (ldapjs client.modify would
// re-escape non-ASCII bytes as \xx, which AD rejects with "No Such Object").
function rawModify(client, dn, changes) {
  return new Promise((resolve, reject) => {
    const req = new ldap.ModifyRequest({ object: dn, changes });
    client._send(req, [ldap.LDAP_SUCCESS], null, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function testModify(dn, curSam) {
  console.log('\n=== BENIGN MODIFY TEST (same DN the portal sends) ===');
  console.log('target            :', dn);
  if (!curSam) { console.log('no sAMAccountName captured - aborting'); cleanup(); process.exit(0); }
  const change = new ldap.Change({ operation: 'replace', modification: new ldap.Attribute({ type: 'sAMAccountName', values: [curSam] }) });
  rawModify(client, dn, [change]).then(
    () => {
      console.log('MODIFY OK         : the DN IS addressable (portal should work).');
      cleanup(); process.exit(0);
    },
    (err) => {
      console.log('MODIFY FAILED     :', err.message);
      console.log('  -> AD cannot address this DN for modification (portal fails the same way).');
      cleanup(); process.exit(0);
    }
  );
}

// Reproduce the portal's exact reset modify (unicodePwd) - this actually changes the password
function testReset(dn, pw) {
  console.log('\n=== RESET MODIFY TEST (unicodePwd, exactly as the portal does) ===');
  console.log('target            :', dn);
  if (!pw || pw.length < 8) { console.log('usage: --reset "<new-password>" - aborted'); cleanup(); process.exit(0); }
  const pwdBuf = Buffer.from(`"${pw}"`, 'utf16le');
  const change = new ldap.Change({ operation: 'replace', modification: new ldap.Attribute({ type: 'unicodePwd', values: [pwdBuf] }) });
  rawModify(client, dn, [change]).then(
    () => {
      console.log('RESET MODIFY OK    : password set on', dn);
      cleanup(); process.exit(0);
    },
    (err) => {
      console.log('RESET MODIFY FAILED:', err.message);
      cleanup(); process.exit(0);
    }
  );
}
