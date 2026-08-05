# ===== verify-ad.ps1 - checks .env parsing, LDAPS bind, and AD search =====
# Run from the project folder on the VM:
#   powershell -ExecutionPolicy Bypass -File verify-ad.ps1

Write-Host ""
Write-Host "=== 1) Resolved .env values (what the app actually reads) ==="
@'
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
console.log('URL       : ' + (process.env.AD_USE_SSL === 'true' ? 'ldaps' : 'ldap') + '://' + process.env.AD_HOST + ':' + process.env.AD_PORT);
console.log('BIND DN   : ' + process.env.AD_BIND_DN);
console.log('PW length : ' + (process.env.AD_BIND_PASSWORD || '').length + '  (expected 14 chars)');
console.log('BASE DN   : ' + process.env.AD_BASE_DN);
console.log('SEARCH DN : ' + (process.env.AD_SEARCH_BASE || process.env.AD_BASE_DN));
console.log('CA CERT   : ' + process.env.AD_CA_CERT);
console.log('TLS SNAME : ' + process.env.AD_TLS_SERVERNAME);
console.log('REJECT    : ' + process.env.AD_TLS_REJECT_UNAUTHORIZED);
'@ | node -

Write-Host ""
Write-Host "=== 2) LDAPS bind + search (exactly the app's code path) ==="
@'
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
const fs = require('fs');
const ldap = require('ldapjs');

const url = (process.env.AD_USE_SSL === 'true' ? 'ldaps' : 'ldap') + '://' + process.env.AD_HOST + ':' + process.env.AD_PORT;
const tlsOptions = { rejectUnauthorized: (process.env.AD_TLS_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false' };
if (process.env.AD_TLS_SERVERNAME) tlsOptions.servername = process.env.AD_TLS_SERVERNAME;
if (process.env.AD_CA_CERT) {
  try { tlsOptions.ca = [fs.readFileSync(process.env.AD_CA_CERT)]; } catch (e) { console.log('WARN: cannot read AD_CA_CERT:', e.message); }
}

const client = ldap.createClient({ url, tlsOptions, connectTimeout: 10000, timeout: 30000 });
client.on('error', e => console.log('CLIENT ERROR:', e.message));

client.bind(process.env.AD_BIND_DN, process.env.AD_BIND_PASSWORD, err => {
  if (err) { console.log('BIND FAILED:', err.message); process.exit(1); return; }
  console.log('BIND: OK');

  client.search(process.env.AD_SEARCH_BASE || process.env.AD_BASE_DN, {
    scope: 'sub',
    filter: '(&(objectClass=user)(sAMAccountName=otech*))',
    attributes: ['sAMAccountName', 'displayName'],
    paged: { pageSize: 10 },
  }, (serr, res) => {
    if (serr) { console.log('SEARCH FAILED:', serr.message); process.exit(1); return; }
    let n = 0;
    res.on('searchEntry', e => { n++; console.log('  - ' + JSON.stringify(e.object)); });
    res.on('error', e => console.log('SEARCH ERROR:', e.message));
    res.on('end', () => { console.log('SEARCH: OK - ' + n + ' result(s)'); client.unbind(); process.exit(0); });
  });
});
'@ | node -
