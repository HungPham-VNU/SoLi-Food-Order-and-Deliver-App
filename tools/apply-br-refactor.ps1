# Apply refactored Business Rules tables to SRS_FoodDelivery.md
# Reads new BR tables from the 5 subagent result files.

$ErrorActionPreference = 'Stop'

$srsPath = "d:\SoLi-Food-Order-and-Deliver-App\apps\api\docs\Final_Documents\SRS_FoodDelivery.md"
$sourceDir = "c:\Users\My PC\AppData\Roaming\Code\User\workspaceStorage\f011d404fa5a574c2c448fb4b4fa15d7\GitHub.copilot-chat\chat-session-resources\fb73ed06-e3fb-4d9a-9a83-c7e0ecb43894"
$sources = @(
    "$sourceDir\toolu_017XKQr5J51kNXEhXm4123BH__vscode-1779556538633\content.txt",
    "$sourceDir\toolu_011hcnynX2iTwKnS2N3d2tDS__vscode-1779556538634\content.txt",
    "$sourceDir\toolu_01UYmLW4FbkeKJkupi7aTevC__vscode-1779556538635\content.txt",
    "$sourceDir\toolu_01KSqMkLs4sL5LPyraFjoa7F__vscode-1779556538636\content.txt",
    "$sourceDir\toolu_01WXhPYsxGzQUW6b8XhVn4o3__vscode-1779556538637\content.txt"
)

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

# Parse all subagent outputs into a hashtable: UC# -> array of row strings
$ucRows = @{}

foreach ($src in $sources) {
    Write-Host "Reading $src"
    $text = [System.IO.File]::ReadAllText($src, $utf8NoBom)
    # Normalize line endings
    $text = $text -replace "`r`n", "`n"
    # Find each == UC-N == block (allow optional ## prefix and ** wrappers)
    $blockMatches = [regex]::Matches($text, '(?ms)^\s*(?:#+\s*)?(?:\*\*\s*)?==\s*UC-(\d+)\s*==(?:\s*\*\*)?\s*\n(.*?)(?=^\s*(?:#+\s*)?(?:\*\*\s*)?==\s*UC-\d+\s*==|\z|^---\s*$)')
    foreach ($bm in $blockMatches) {
        $uc = [int]$bm.Groups[1].Value
        $body = $bm.Groups[2].Value
        # Extract only the row lines starting with "| _("
        $rowLines = @()
        foreach ($line in ($body -split "`n")) {
            if ($line -match '^\| _\(\d+\)_ \| _BR-\d+\.\d+_ \|') {
                $rowLines += $line.TrimEnd()
            }
        }
        if ($rowLines.Count -gt 0) {
            $ucRows[$uc] = $rowLines
            Write-Host "  UC-$uc : $($rowLines.Count) rows"
        }
    }
}

if ($ucRows.Count -ne 35) {
    throw "Expected 35 UC tables, found $($ucRows.Count)"
}

# Load SRS
$srs = [System.IO.File]::ReadAllText($srsPath, $utf8NoBom)
$srs = $srs -replace "`r`n", "`n"

# Pattern: capture each UC's BR table body (the rows between the |---|---|---| separator
# and the next \n---\n or \n### UC-)
$pattern = '(?ms)(^### UC-(\d+):.*?#### Business Rules\s*\n\n\| Activity \| BR Code \| Description \|\s*\n\|---\|---\|---\|\s*\n)(.*?)(?=\n---\n|\n### UC-)'

$replaced = 0
$failed = @()
$result = [regex]::Replace($srs, $pattern, {
    param($m)
    $uc = [int]$m.Groups[2].Value
    if (-not $ucRows.ContainsKey($uc)) {
        $script:failed += $uc
        return $m.Value
    }
    $newBody = ($ucRows[$uc] -join "`n") + "`n"
    $script:replaced++
    return $m.Groups[1].Value + $newBody
})

Write-Host ""
Write-Host "Replaced $replaced UC BR tables"
if ($failed.Count -gt 0) {
    Write-Host "Failed UCs: $($failed -join ', ')"
}

# Write back with LF endings (original file uses LF? let's check)
# Use original line ending style: if original had CRLF then convert back
$originalRaw = [System.IO.File]::ReadAllText($srsPath, $utf8NoBom)
if ($originalRaw.Contains("`r`n")) {
    $result = $result -replace "`n", "`r`n"
}

[System.IO.File]::WriteAllText($srsPath, $result, $utf8NoBom)
Write-Host "Wrote $srsPath"
