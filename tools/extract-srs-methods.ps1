$ErrorActionPreference = 'Stop'
$f = 'd:\SoLi-Food-Order-and-Deliver-App\apps\api\docs\Final_Documents\SRS_FoodDelivery.md'
$txt = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($f))
$lines = $txt -split "`r?`n"

# Find BR rows and extract every `Class.method(args)` token from them
$rx = '`([A-Z][A-Za-z0-9_]+)\.([A-Za-z_][A-Za-z0-9_]*)\(([^`)]*)\)`'
$rows = @()
$currentUC = ''
for ($i = 0; $i -lt $lines.Count; $i++) {
  $l = $lines[$i]
  if ($l -match '^##\s+UC-(\d+):') { $currentUC = "UC-$($Matches[1])" ; continue }
  if ($l -notmatch '_BR-(\d+\.\d+)_') { continue }
  $br = "BR-$($Matches[1])"
  $matches2 = [regex]::Matches($l, $rx)
  foreach ($m in $matches2) {
    $rows += [pscustomobject]@{
      UC = $currentUC
      BR = $br
      Class = $m.Groups[1].Value
      Method = $m.Groups[2].Value
      Params = $m.Groups[3].Value.Trim()
      Line = $i + 1
    }
  }
}

# unique by Class.method(params)
$uniq = $rows | Sort-Object Class, Method, Params -Unique
Write-Output ("Total references: " + $rows.Count)
Write-Output ("Unique class.method(params): " + $uniq.Count)
Write-Output ("Unique classes: " + ($rows.Class | Sort-Object -Unique).Count)
Write-Output "--- CLASSES ---"
$rows.Class | Sort-Object -Unique | ForEach-Object { Write-Output $_ }
Write-Output "--- UNIQUE METHODS ---"
$uniq | ForEach-Object { Write-Output ("{0}.{1}({2})" -f $_.Class, $_.Method, $_.Params) }
