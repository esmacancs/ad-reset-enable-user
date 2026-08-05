# ===== Fetch AD's trusted CA certificates over plain LDAP (389) - simple bind =====
$AD_HOST = '10.177.19.9'
$AD_PORT = 389
$AD_USER = 'ministry\odp.mig'
$AD_PASS = 'Oman@2025!@#123'
$OUT = Join-Path $PWD 'ad-certs'
New-Item -ItemType Directory -Force -Path $OUT | Out-Null

Add-Type -AssemblyName System.DirectoryServices.Protocols

'Password length in file: ' + $AD_PASS.Length + '  (expected 15 for: Oman@2025!@#123)'

$id = New-Object System.DirectoryServices.Protocols.LdapDirectoryIdentifier($AD_HOST, $AD_PORT)
$conn = New-Object System.DirectoryServices.Protocols.LdapConnection($id)
$conn.AuthType = [System.DirectoryServices.Protocols.AuthType]::Basic
$conn.SessionOptions.ProtocolVersion = 3
$conn.Timeout = (New-Object System.TimeSpan(0, 0, 30))
$conn.Credential = New-Object System.Net.NetworkCredential($AD_USER, $AD_PASS)

try {
  $conn.Bind()
  'SIMPLE BIND: OK'
} catch {
  'SIMPLE BIND FAILED: ' + $_.Exception.Message
  return
}

# 1) dump ALL root DSE attributes (diagnostic)
$req1 = New-Object System.DirectoryServices.Protocols.SearchRequest($null, '(objectClass=*)', [System.DirectoryServices.Protocols.SearchScope]::Base, $null)
$resp1 = [System.DirectoryServices.Protocols.SearchResponse]$conn.SendRequest($req1)
$rootEntry = @($resp1.Entries)[0]
'--- root DSE attributes ---'
foreach ($n in $rootEntry.Attributes.AttributeNames) {
  $attr = $rootEntry.Attributes[$n]
  $vals = @()
  for ($j = 0; $j -lt $attr.Count; $j++) { $vals += $attr[$j] }
  ('  {0} = {1}' -f $n, ($vals -join ' ; '))
}

# 2) find the real config NC from namingContexts
$namingContexts = @()
$ncAttr = $rootEntry.Attributes['namingContexts']
if ($ncAttr) {
  for ($j = 0; $j -lt $ncAttr.Count; $j++) { $namingContexts += $ncAttr[$j] }
}
$configNC = $namingContexts | Where-Object { $_ -like 'CN=Configuration,*' } | Select-Object -First 1
$domainNC = $namingContexts | Where-Object { $_ -notlike 'CN=*' } | Select-Object -First 1

if (-not $configNC) {
  'No config NC found in namingContexts - cannot continue.'
  return
}
'Config NC  : ' + $configNC
'Domain NC  : ' + $domainNC

# 3) search config NC subtree for published CA certs
try {
  $req2 = New-Object System.DirectoryServices.Protocols.SearchRequest([string]$configNC, '(objectClass=certificationAuthority)', [System.DirectoryServices.Protocols.SearchScope]::Subtree, @('cn', 'cACertificate'))
  $resp2 = [System.DirectoryServices.Protocols.SearchResponse]$conn.SendRequest($req2)
} catch {
  'CA SEARCH FAILED: ' + $_.Exception.Message
  return
}

'Found ' + $resp2.Entries.Count + ' CA cert(s)'

$i = 0
foreach ($e in $resp2.Entries) {
  $cn = $null
  $certBytes = $null
  foreach ($n in $e.Attributes.AttributeNames) {
    $attr = $e.Attributes[$n]
    if ($n -ieq 'cn') { $cn = $attr[0] }
    if ($n -ieq 'cacertificate') { $certBytes = $attr[0] }
  }
  if (-not $certBytes) { continue }
  $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($certBytes)
  $b64 = [Convert]::ToBase64String($certBytes, [Base64FormattingOptions]::InsertLineBreaks)
  $pem = '-----BEGIN CERTIFICATE-----' + [Environment]::NewLine + $b64 + [Environment]::NewLine + '-----END CERTIFICATE-----'
  $safeName = ($cn -replace '[^\w\-\.]', '_')
  $path = Join-Path $OUT ($i.ToString() + '_' + $safeName + '.pem')
  [System.IO.File]::WriteAllText($path, $pem)
  'Exported: ' + $path
  '  Subject : ' + $cert.Subject
  '  Issuer  : ' + $cert.Issuer
  '  ValidTo : ' + $cert.NotAfter
  $i++
}

if ($i -eq 0) {
  'No certificationAuthority objects found under: ' + $configNC
  'The domain PKI may not be AD-integrated (enterprise CA).'
  'If so, the DC LDAPS cert must be obtained from the issuing CA directly'
  'or from a working LDAPS handshake (once LDAPS is enabled).'
}
