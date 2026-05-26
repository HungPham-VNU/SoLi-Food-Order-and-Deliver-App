$path = "apps\api\docs\Final_Documents\SRS_FoodDelivery.md"
$utf8 = [System.Text.UTF8Encoding]::new($false)
$text = [System.IO.File]::ReadAllText($path, $utf8)
$lines = [regex]::Split($text, "`r`n|`n")

$currentUC = $null
$ucRows = @{}
$rowRegex = '^\| _\((\d+)\)_ \| _BR-(\d+)\.(\d+)_ \| (.+?) \|\s*$'

for ($i = 0; $i -lt $lines.Count; $i++) {
  $line = $lines[$i]
  if ($line -match '^### UC-(\d+):') {
    $currentUC = [int]$matches[1]
    if (-not $ucRows.ContainsKey($currentUC)) { $ucRows[$currentUC] = New-Object 'System.Collections.Generic.List[object]' }
    continue
  }
  if ($currentUC -ne $null -and $line -match $rowRegex) {
    if ([int]$matches[2] -eq $currentUC) {
      $ucRows[$currentUC].Add([pscustomobject]@{ Line=$i+1; Act=$matches[1]; BR="BR-$($matches[2]).$($matches[3])"; Body=$matches[4] })
    }
  }
}

$rowCount = 0
foreach ($k in $ucRows.Keys) { $rowCount += $ucRows[$k].Count }
Write-Host "Total rows captured: $rowCount"

Write-Host ""
Write-Host "=== EXACT body duplicates per UC ==="
$ucProblems = @{}
foreach ($uc in ($ucRows.Keys | Sort-Object)) {
  $byBody = @{}
  foreach ($r in $ucRows[$uc]) {
    if (-not $byBody.ContainsKey($r.Body)) { $byBody[$r.Body] = New-Object 'System.Collections.Generic.List[object]' }
    $byBody[$r.Body].Add($r)
  }
  foreach ($k in $byBody.Keys) {
    if ($byBody[$k].Count -gt 1) {
      $brs = ($byBody[$k] | ForEach-Object { $_.BR }) -join ','
      $hdr = if ($k -match '^\*\*([^*]+):\*\*') { $matches[1] } else { '?' }
      Write-Host ("UC-{0} EXACT-DUP [{1}] x{2}: {3}" -f $uc, $hdr, $byBody[$k].Count, $brs)
      if (-not $ucProblems.ContainsKey($uc)) { $ucProblems[$uc] = $true }
    }
  }
}

Write-Host ""
Write-Host "=== Reference-pattern rows ==="
$refPatterns = @('applies the detailed', 'Same Requirement Application', 'as specified in', 'as defined in BR-')
foreach ($uc in ($ucRows.Keys | Sort-Object)) {
  foreach ($r in $ucRows[$uc]) {
    foreach ($p in $refPatterns) {
      if ($r.Body -match [regex]::Escape($p)) {
        Write-Host ("UC-{0} {1} line {2}: matches '{3}'" -f $uc, $r.BR, $r.Line, $p)
        break
      }
    }
  }
}

Write-Host ""
Write-Host "=== Repeated headers per UC ==="
foreach ($uc in ($ucRows.Keys | Sort-Object)) {
  $byHdr = @{}
  foreach ($r in $ucRows[$uc]) {
    if ($r.Body -match '^\*\*([^*]+):\*\*') {
      $h = $matches[1].Trim()
      if (-not $byHdr.ContainsKey($h)) { $byHdr[$h] = New-Object 'System.Collections.Generic.List[string]' }
      $byHdr[$h].Add($r.BR)
    }
  }
  foreach ($k in $byHdr.Keys) {
    if ($byHdr[$k].Count -gt 1) {
      Write-Host ("UC-{0} HDR-REPEAT [{1}] x{2}: {3}" -f $uc, $k, $byHdr[$k].Count, ($byHdr[$k] -join ','))
    }
  }
}

Write-Host ""
Write-Host "UCs with EXACT body duplicates: $($ucProblems.Count)"
