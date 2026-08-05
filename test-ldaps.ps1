# ===== LDAPS test for production AD =====
$AD_HOST = '10.177.19.9'
$AD_PORT = 636
$AD_BASE = 'DC=ministry,DC=housing,DC=gov,DC=om'
$AD_USER = 'ministry\odp.mig'
$AD_PASS = 'Oman@2025!@#123'

Add-Type -AssemblyName System.DirectoryServices

'=== 1) TCP to 636 ==='
$c = New-Object System.Net.Sockets.TcpClient
try { $c.Connect($AD_HOST, $AD_PORT); 'TCP 636: OK' } catch { 'TCP 636: FAILED - ' + $_.Exception.Message; return }
$c.Close()

'=== 2) TLS handshake + cert ==='
$tcp = New-Object System.Net.Sockets.TcpClient
$tcp.Connect($AD_HOST, $AD_PORT)
$ssl = New-Object System.Net.Security.SslStream($tcp.GetStream(), $false, { $true })
try {
  $ssl.AuthenticateAsClient($AD_HOST)
  'TLS: OK'
  '  Subject : ' + $ssl.RemoteCertificate.Subject
  '  ValidTo : ' + $ssl.RemoteCertificate.GetExpirationDateString()
} catch {
  'TLS: FAILED - ' + $_.Exception.InnerException.Message
}
$ssl.Dispose(); $tcp.Close()

'=== 3) LDAPS bind + search ==='
$entry = New-Object System.DirectoryServices.DirectoryEntry("LDAP://$AD_HOST`:$AD_PORT/$AD_BASE", $AD_USER, $AD_PASS)
try {
  $entry.RefreshCache()
  'LDAPS BIND: OK'
} catch {
  'LDAPS BIND: FAILED - ' + $_.Exception.InnerException.Message
  return
}
$searcher = New-Object System.DirectoryServices.DirectorySearcher($entry)
$searcher.Filter = '(sAMAccountName=noor*)'
$searcher.SearchScope = 'Subtree'
$searcher.PageSize = 5
try {
  $results = $searcher.FindAll()
  'LDAPS SEARCH: OK - ' + $results.Count + ' match(es)'
  foreach ($r in $results) { '  - ' + $r.Properties['samaccountname'][0] }
} catch {
  'LDAPS SEARCH: FAILED - ' + $_.Exception.InnerException.Message
}

'=== 4) Node TLS negotiation (app''s TLS stack) ==='
@'
const tls = require('tls');
const tests = [
  { name: 'default' },
  { name: 'min1.2', minVersion: 'TLSv1.2' },
  { name: 'min1.1', minVersion: 'TLSv1.1' },
  { name: 'min1.0', minVersion: 'TLSv1' },
  { name: 'force1.2', minVersion: 'TLSv1.2', maxVersion: 'TLSv1.2' },
];
let i = 0;
function next() {
  if (i >= tests.length) return;
  const t = tests[i++];
  const s = tls.connect({ host: '10.177.19.9', port: 636, rejectUnauthorized: false, ...t }, () => {
    console.log('OK  ', t.name, 'protocol=', s.getProtocol());
    s.destroy(); next();
  });
  s.on('error', e => { console.log('FAIL', t.name, e.message); next(); });
  s.setTimeout(8000);
}
next();
'@ | node -
