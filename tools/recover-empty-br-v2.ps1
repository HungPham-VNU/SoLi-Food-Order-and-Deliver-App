# ASCII-only PowerShell driver: loads br-recovery.json and patches SRS_FoodDelivery.md.
# Each empty BR row of the form "| _(N)_ | _BR-X.Y_ | **Title:** |"
# becomes "| _(N)_ | _BR-X.Y_ | **Title:**<br>BULLET bullet1<br>BULLET bullet2 |"
# where BULLET is the U+2756 black diamond minus white X character used elsewhere in the SRS.

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$jsonPath = Join-Path $PSScriptRoot 'br-recovery.json'
$srsPath  = Join-Path $repo 'apps\api\docs\Final_Documents\SRS_FoodDelivery.md'

# Read JSON (UTF-8) via .NET so non-ASCII content survives PS 5.1's default encoding quirks.
$jsonBytes = [System.IO.File]::ReadAllBytes($jsonPath)
$jsonText  = [System.Text.UTF8Encoding]::new($false).GetString($jsonBytes)
$recoveries = $jsonText | ConvertFrom-Json

# Read SRS as UTF-8.
$srsBytes = [System.IO.File]::ReadAllBytes($srsPath)
$srsText  = [System.Text.UTF8Encoding]::new($false).GetString($srsBytes)

$bulletChar = [char]0x2756  # the same diamond glyph used by existing populated rows
$bulletPrefix = "$bulletChar "

$updated  = 0
$missing  = New-Object System.Collections.ArrayList

# Each property name on the PSCustomObject is a BR code string like "1.2", "22.11", "35.10".
foreach ($prop in $recoveries.PSObject.Properties) {
    $code    = $prop.Name
    $bullets = $prop.Value  # array of strings

    $body = ($bullets | ForEach-Object { "$bulletPrefix$_" }) -join '<br>'

    $escCode = [regex]::Escape($code)
    $pattern = "(\|\s*_\(\d+\)_\s*\|\s*_BR-$escCode" + "_\s*\|\s*\*\*[^*|]+:\*\*)\s*(\|)"
    $replacement = '${1}<br>' + $body + ' ${2}'

    $regex = New-Object System.Text.RegularExpressions.Regex($pattern)
    $match = $regex.Match($srsText)
    if (-not $match.Success) {
        [void]$missing.Add($code)
        continue
    }
    $srsText = $regex.Replace($srsText, $replacement, 1)
    $updated++
}

# Write SRS back as UTF-8 without BOM (matches existing file encoding).
$enc = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllBytes($srsPath, $enc.GetBytes($srsText))

Write-Output "Recovered $updated BR rows"
if ($missing.Count -gt 0) {
    Write-Output ("Missing patterns for: " + ($missing -join ', '))
}
