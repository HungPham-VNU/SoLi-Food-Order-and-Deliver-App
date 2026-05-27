$path = "apps\api\docs\Final_Documents\SRS_FoodDelivery.md"
$utf8 = [System.Text.UTF8Encoding]::new($false)
$text = [System.IO.File]::ReadAllText($path, $utf8)
$lines = $text -split "(`r`n|`n)"
$contentLines = @()
foreach ($l in $lines) { if ($l -ne "`r`n" -and $l -ne "`n") { $contentLines += $l } }

$want = @(15, 19, 8, 9, 10)
$currentUC = $null
$rows = New-Object 'System.Collections.Generic.List[object]'
foreach ($line in $contentLines) {
  if ($line -match '^### UC-(\d+):') { $currentUC = [int]$matches[1]; continue }
  if ($currentUC -ne $null -and $want -contains $currentUC -and $line -match '^\| _\((\d+)\)_ \| _BR-(\d+)\.(\d+)_ \| (.+) \|\s*$') {
    if ([int]$matches[2] -eq $currentUC) {
      $rows.Add([pscustomobject]@{ UC=$currentUC; Act=$matches[1]; BR="BR-$($matches[2]).$($matches[3])"; Body=$matches[4] })
    }
  }
}

foreach ($uc in @(15, 19, 8, 9, 10)) {
  Write-Host "=== UC-$uc ===" -ForegroundColor Cyan
  $ucRows = $rows | Where-Object { $_.UC -eq $uc }
  $idx = 0
  foreach ($r in $ucRows) {
    $idx++
    Write-Host ("[{0}] {1} (act {2}): {3}" -f $idx, $r.BR, $r.Act, $r.Body)
  }
}
