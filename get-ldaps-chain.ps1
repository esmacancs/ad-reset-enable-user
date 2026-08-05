# ===== Verify LDAPS and export the DC's certificate chain to PEM =====
# Run on the VM AFTER LDAPS is fixed on the DC.
$AD_HOST = '10.177.19.9'
$DC_FQDN = 'mhup-oci-cdc01.ministry.housing.gov.om'

$tcp = New-Object System.Net.Sockets.TcpClient
$tcp.Connect($AD_HOST, 636)
$ssl = New-Object System.Net.Security.SslStream($tcp.GetStream(), $false, { $true })
try {
  $ssl.AuthenticateAsClient($DC_FQDN)
  'TLS HANDSHAKE: OK'
  '  Remote cert subject : ' + $ssl.RemoteCertificate.Subject
  '  Issuer              : ' + $ssl.RemoteCertificate.Issuer
  '  ValidTo             : ' + $ssl.RemoteCertificate.GetExpirationDateString()

  $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($ssl.RemoteCertificate)
  $chain = New-Object System.Security.Cryptography.X509Certificates.X509Chain
  $chain.ChainPolicy.VerificationFlags = [System.Security.Cryptography.X509Certificates.X509VerificationFlags]::AllowUnknownCertificateAuthority
  $chain.ChainPolicy.RevocationMode = [System.Security.Cryptography.X509Certificates.X509RevocationMode]::NoCheck
  $chain.Build($cert)

  'Chain elements: ' + $chain.ChainElements.Count
  $i = 0
  foreach ($el in $chain.ChainElements) {
    $c = $el.Certificate
    $pem = '-----BEGIN CERTIFICATE-----' + [Environment]::NewLine +
           [Convert]::ToBase64String($c.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert), [Base64FormattingOptions]::InsertLineBreaks) +
           [Environment]::NewLine + '-----END CERTIFICATE-----'
    $path = Join-Path $PWD ('chain_' + $i + '.pem')
    [System.IO.File]::WriteAllText($path, $pem)
    'Exported: ' + $path
    '  Subject : ' + $c.Subject
    '  Issuer  : ' + $c.Issuer
    $i++
  }
  'Tip: for AD_CA_CERT, use the TOP-most (root) chain_<n>.pem file.'
} catch {
  'TLS FAILED: ' + $_.Exception.InnerException.Message
}
$ssl.Dispose(); $tcp.Close()
