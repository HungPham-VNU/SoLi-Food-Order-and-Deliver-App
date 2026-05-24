# Surgical dedup fix for SRS_FoodDelivery.md
# Removes the accidental whole-document reinsertion that was injected inside the BR-16.1 cell.
# The duplicate block runs from 1-based line 1329 through line 2655.
# Line 1328 is the corrupted BR-16.1 row; line 2655 is its orphaned tail.
# After the fix: line 1328 is restored, lines 1329-2655 are removed.

$ErrorActionPreference = 'Stop'
$srsPath = 'apps\api\docs\Final_Documents\SRS_FoodDelivery.md'

$lines = Get-Content $srsPath -Encoding UTF8   # CRLF is stripped by Get-Content; rejoining later

# Safety checks
if ($lines.Count -ne 4233) {
    Write-Error "Unexpected line count $($lines.Count); expected 4233. Aborting."
    exit 1
}
if ($lines[1327] -notmatch '# Software Requirements Specification') {
    Write-Error "Line 1328 does not contain the expected corruption marker. Aborting."
    exit 1
}
if ($lines[2654] -notmatch 'Class-validator decorators') {
    Write-Error "Line 2655 does not contain the expected BR-16.1 tail. Aborting."
    exit 1
}

# Reconstruct the BR-16.1 row:
#   prefix  = everything on line 1328 before "# Software Requirements Specification"
#   missing = '$`'  (the regex end-anchor + closing backtick that were consumed)
#   suffix  = line 2655 (the orphaned tail)
$splitMarker = '# Software Requirements Specification'
$prefixIdx   = $lines[1327].IndexOf($splitMarker)
$prefix      = $lines[1327].Substring(0, $prefixIdx)
$missing     = [string][char]36 + [string][char]96   # $`
$suffix      = $lines[2654]
$fixedBR16   = $prefix + $missing + $suffix

# Build the repaired document
# Keep: lines[0..1326] (original 1-1327)  + fixedBR16  + lines[2655..end]
$repaired = $lines[0..1326] + $fixedBR16 + $lines[2655..($lines.Count - 1)]

# Write back as UTF-8 without BOM, CRLF line endings (matching original)
$enc  = [System.Text.UTF8Encoding]::new($false)
$text = $repaired -join "`r`n"
[System.IO.File]::WriteAllBytes($srsPath, $enc.GetBytes($text))

Write-Output "Done. Lines before: 4233  Lines after: $($repaired.Count)"

# Quick structural verification
$dupeIntro  = ($repaired | Where-Object { $_ -match '^## 1\. Introduction' }).Count
$uc1Count   = ($repaired | Where-Object { $_ -match '^### UC-1:' }).Count
$uc16Count  = ($repaired | Where-Object { $_ -match '^### UC-16:' }).Count
$uc35Count  = ($repaired | Where-Object { $_ -match '^### UC-35:' }).Count
Write-Output "Introduction headers: $dupeIntro (expect 1)"
Write-Output "UC-1 headers: $uc1Count (expect 1)"
Write-Output "UC-16 headers: $uc16Count (expect 1)"
Write-Output "UC-35 headers: $uc35Count (expect 1)"
