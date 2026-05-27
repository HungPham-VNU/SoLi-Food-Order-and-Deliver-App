# Robust line-by-line audit
$path = "apps\api\docs\Final_Documents\SRS_FoodDelivery.md"
$utf8 = [System.Text.UTF8Encoding]::new($false)
$text = [System.IO.File]::ReadAllText($path, $utf8)
$lines = $text -split "(`r`n|`n)"
# Filter only actual line content (not separators)
$contentLines = @()
foreach ($l in $lines) { if ($l -ne "`r`n" -and $l -ne "`n" -and $l -ne "") { $contentLines += $l } elseif ($l -eq "") { $contentLines += "" } }

$currentUC = $null
$ucBRs = @{}
$brOrder = @{}
foreach ($line in $contentLines) {
  if ($line -match '^### UC-(\d+):') {
    $currentUC = [int]$matches[1]
    if (-not $ucBRs.ContainsKey($currentUC)) { $ucBRs[$currentUC] = New-Object 'System.Collections.Generic.List[object]'; $brOrder[$currentUC] = New-Object 'System.Collections.Generic.List[string]' }
    continue
  }
  if ($currentUC -ne $null -and $line -match '^\| _\((\d+)\)_ \| _BR-(\d+)\.(\d+)_ \| (.+) \|\s*$') {
    $act = $matches[1]; $brMajor = $matches[2]; $brMinor = $matches[3]; $body = $matches[4]
    if ([int]$brMajor -eq $currentUC) {
      $ucBRs[$currentUC].Add([pscustomobject]@{ Act=$act; BR="BR-$brMajor.$brMinor"; Body=$body })
      $brOrder[$currentUC].Add("BR-$brMajor.$brMinor")
    }
  }
}

Write-Host "=== Per-UC row counts ==="
$total = 0
foreach ($uc in ($ucBRs.Keys | Sort-Object)) {
  $cnt = $ucBRs[$uc].Count
  $total += $cnt
  Write-Host ("UC-{0}: {1} rows" -f $uc, $cnt)
}
Write-Host "Total BR rows: $total"

Write-Host ""
Write-Host "=== Exact duplicate bodies per UC ==="
$dupCount = 0
foreach ($uc in ($ucBRs.Keys | Sort-Object)) {
  $byBody = @{}
  foreach ($item in $ucBRs[$uc]) {
    if (-not $byBody.ContainsKey($item.Body)) { $byBody[$item.Body] = New-Object 'System.Collections.Generic.List[string]' }
    $byBody[$item.Body].Add("$($item.BR)(act $($item.Act))")
  }
  foreach ($k in $byBody.Keys) {
    if ($byBody[$k].Count -gt 1) {
      $hdr = if ($k -match '^\*\*([^*]+):\*\*') { $matches[1] } else { 'unknown' }
      Write-Host ("UC-{0} DUP [{1}]: {2}" -f $uc, $hdr, ($byBody[$k] -join ', '))
      $dupCount++
    }
  }
}
Write-Host "Total dup groups: $dupCount"

Write-Host ""
Write-Host "=== Header repetition per UC (concern header used >1) ==="
$hdrRepCount = 0
foreach ($uc in ($ucBRs.Keys | Sort-Object)) {
  $byHdr = @{}
  foreach ($item in $ucBRs[$uc]) {
    if ($item.Body -match '^\*\*([^*]+):\*\*') {
      $h = $matches[1].Trim()
      if (-not $byHdr.ContainsKey($h)) { $byHdr[$h] = 0 }
      $byHdr[$h]++
    }
  }
  foreach ($k in $byHdr.Keys) {
    if ($byHdr[$k] -gt 1) {
      Write-Host ("UC-{0} header repeated x{1}: '{2}'" -f $uc, $byHdr[$k], $k)
      $hdrRepCount++
    }
  }
}
Write-Host "Total repeated-header issues: $hdrRepCount"
