$base = "http://localhost:3000"
$h = @{ Origin = $base }
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$script:fails = 0

function Call($method, $path, $body) {
  $p = @{ Method = $method; Uri = "$base$path"; ContentType = "application/json"; Headers = $h; WebSession = $s; UseBasicParsing = $true }
  if ($body) { $p.Body = ($body | ConvertTo-Json -Depth 5) }
  try {
    $r = Invoke-WebRequest @p
    return @{ status = [int]$r.StatusCode; body = $r.Content }
  } catch {
    $msg = $_.ErrorDetails.Message
    if (-not $msg -and $_.Exception.Response) {
      try { $msg = (New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() } catch {}
    }
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    return @{ status = $code; body = $msg }
  }
}

function Check($label, $r, $expected) {
  if ($r.status -eq $expected) {
    Write-Host "PASS  $label ($($r.status))" -ForegroundColor Green
  } else {
    Write-Host "FAIL  $label (got $($r.status), expected $expected) $($r.body)" -ForegroundColor Red
    $script:fails++
  }
}

$email = Read-Host "Email of a verified test account"
$pw = Read-Host "Password"

Check "login" (Call Post "/api/auth/login" @{ email = $email; password = $pw }) 200

# Create and normalize
$r = Call Post "/api/watches" @{ url = "https://example.com/page#top" }
Check "create valid watch" $r 201
$saved = ($r.body | ConvertFrom-Json).watch
Write-Host "      saved url: $($saved.url)  status: $($saved.status)"

# Unsafe URLs
foreach ($u in @("http://localhost:3000", "http://169.254.169.254/latest/meta-data", "ftp://example.com", "https://example.com:22")) {
  Check "reject $u" (Call Post "/api/watches" @{ url = $u }) 400
}

# Keyword rules
Check "keyword mode without keywords" (Call Post "/api/watches" @{ url = "https://example.com"; alertMode = "KEYWORDS_APPEAR" }) 400
Check "keyword mode with keywords" (Call Post "/api/watches" @{ url = "https://example.com"; alertMode = "KEYWORDS_APPEAR"; keywords = @("in stock") }) 201

# List and unknown ids
$l = Call Get "/api/watches"
Check "list watches" $l 200
Check "get unknown id" (Call Get "/api/watches/doesnotexist") 404
Check "delete unknown id" (Call Delete "/api/watches/doesnotexist") 404

# Pause and resume
$id = $saved.id
$r = Call Patch "/api/watches/$id" @{ action = "pause" }
Check "pause" $r 200
Write-Host "      status: $((($r.body | ConvertFrom-Json).watch).status)"
$r = Call Patch "/api/watches/$id" @{ action = "resume" }
Check "resume" $r 200
Write-Host "      status: $((($r.body | ConvertFrom-Json).watch).status)"

# Cap of 10
$count = @(($l.body | ConvertFrom-Json).watches).Count
while ($count -lt 10) {
  $x = Call Post "/api/watches" @{ url = "https://example.com" }
  if ($x.status -ne 201) { Check "fill up to the cap" $x 201; break }
  $count++
}
Check "11th watch is refused" (Call Post "/api/watches" @{ url = "https://example.com" }) 403

# Clean up
$all = (Call Get "/api/watches").body | ConvertFrom-Json
foreach ($w in $all.watches) { Call Delete "/api/watches/$($w.id)" | Out-Null }
Check "all watches deleted" (Call Get "/api/watches") 200
$left = @(((Call Get "/api/watches").body | ConvertFrom-Json).watches).Count
Write-Host "      watches left: $left"

if ($script:fails -eq 0) { Write-Host "`nAll checks passed." -ForegroundColor Green }
else { Write-Host "`n$($script:fails) check(s) failed." -ForegroundColor Red }