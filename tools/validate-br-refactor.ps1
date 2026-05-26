# Validate refactored SRS_FoodDelivery.md
# Checks: forbidden wording, BR row shape, reference rows, duplicate descriptions,
# MSG balance, PlantUML balance, intra-UC semantic duplicates (Jaccard >= 0.8).

$ErrorActionPreference = 'Stop'
$srsPath = "d:\SoLi-Food-Order-and-Deliver-App\apps\api\docs\Final_Documents\SRS_FoodDelivery.md"
$utf8 = [System.Text.UTF8Encoding]::new($false)
$text = [System.IO.File]::ReadAllText($srsPath, $utf8)
$text = $text -replace "`r`n","`n"

Write-Host "=== Forbidden wording scan ==="
$forbidden = @('eventual','planned','deferred','future release','roadmap','STUBBED','not implemented','scheduled','forward-looking','partial implementation','target design','implementation missing','when implemented','upcoming','later phase','repository absent','Same Requirement Application','applies the detailed requirement specified in')
foreach ($f in $forbidden) {
    $hits = ([regex]::Matches($text, [regex]::Escape($f), 'IgnoreCase')).Count
    if ($hits -gt 0) { Write-Host "  HIT: '$f' -> $hits" -ForegroundColor Yellow }
}

Write-Host ""
Write-Host "=== BR row shape ==="
$brRows = [regex]::Matches($text, '(?m)^\| _\((\d+)\)_ \| _BR-(\d+)\.(\d+)_ \| (.+) \|\s*$')
Write-Host "  Total BR rows: $($brRows.Count)"
$invalid = ([regex]::Matches($text, '(?m)^\| .{1,30} \| .{1,30} \| .+ \|') | Where-Object { $_.Value -notmatch '^\| _\(\d+\)_ \| _BR-\d+\.\d+_' -and $_.Value -notmatch 'Activity \| BR Code' -and $_.Value -notmatch '\|---\|---\|---\|' }).Count
# Description must start with **Concern:** pattern
$badDesc = 0
foreach ($r in $brRows) {
    $desc = $r.Groups[4].Value
    if ($desc -notmatch '^\*\*[^*]+:\*\*<br>') { $badDesc++ }
}
Write-Host "  Rows with non-atomic-style description (no **Concern:**<br>): $badDesc"

Write-Host ""
Write-Host "=== Reference rows (forbidden 'Same Requirement Application') ==="
$refRows = ([regex]::Matches($text, 'Same Requirement Application')).Count
Write-Host "  Reference rows remaining: $refRows"

Write-Host ""
Write-Host "=== Per-UC duplicate descriptions (exact text) ==="
$ucMatches = [regex]::Matches($text, '(?ms)^### UC-(\d+):.*?(?=\n### UC-\d+:|\n## )')
$totalExactDup = 0
$totalSemDup = 0
foreach ($ucm in $ucMatches) {
    $ucNum = $ucm.Groups[1].Value
    $ucBody = $ucm.Value
    $rows = [regex]::Matches($ucBody, '(?m)^\| _\(\d+\)_ \| _BR-\d+\.\d+_ \| (.+) \|\s*$')
    $descs = @()
    foreach ($r in $rows) { $descs += $r.Groups[1].Value }
    # Exact duplicates
    $groups = $descs | Group-Object | Where-Object { $_.Count -gt 1 }
    foreach ($g in $groups) {
        Write-Host "  UC-$ucNum exact-dup x$($g.Count): $($g.Name.Substring(0,[Math]::Min(80,$g.Name.Length)))..." -ForegroundColor Yellow
        $totalExactDup++
    }
    # Header-only duplicates (the **Concern:** prefix repeated across rows)
    $headers = @()
    foreach ($d in $descs) {
        if ($d -match '^\*\*([^*]+):\*\*') { $headers += $matches[1].Trim() }
    }
    $headerGroups = $headers | Group-Object | Where-Object { $_.Count -gt 1 }
    foreach ($hg in $headerGroups) {
        Write-Host "  UC-$ucNum repeated-header x$($hg.Count): '$($hg.Name)'" -ForegroundColor DarkYellow
    }
    # Semantic similarity (Jaccard on tokens, threshold >= 0.85)
    for ($i = 0; $i -lt $descs.Count; $i++) {
        for ($j = $i+1; $j -lt $descs.Count; $j++) {
            $a = [System.Collections.Generic.HashSet[string]]::new()
            $b = [System.Collections.Generic.HashSet[string]]::new()
            foreach ($t in ($descs[$i].ToLower() -split '\W+')) { if ($t.Length -gt 3) { [void]$a.Add($t) } }
            foreach ($t in ($descs[$j].ToLower() -split '\W+')) { if ($t.Length -gt 3) { [void]$b.Add($t) } }
            if ($a.Count -eq 0 -or $b.Count -eq 0) { continue }
            $inter = [System.Collections.Generic.HashSet[string]]::new($a); [void]$inter.IntersectWith($b)
            $uni = [System.Collections.Generic.HashSet[string]]::new($a); [void]$uni.UnionWith($b)
            $jac = $inter.Count / $uni.Count
            if ($jac -ge 0.85) {
                Write-Host "  UC-$ucNum Jaccard=$([Math]::Round($jac,2)) between row $($i+1) and row $($j+1)" -ForegroundColor Magenta
                $totalSemDup++
            }
        }
    }
}
Write-Host "  Total exact-dup groups: $totalExactDup"
Write-Host "  Total semantic-dup pairs (Jaccard>=0.85): $totalSemDup"

Write-Host ""
Write-Host "=== MSG balance ==="
$defined = [regex]::Matches($text, '(?m)^\| _\((MSG-[A-Z]+-\d+)\)_ \|').Count
# Defined via catalogue rows (Define table format may differ; count via | MSG-X-NN |)
$msgCodes = New-Object System.Collections.Generic.HashSet[string]
foreach ($mm in [regex]::Matches($text, '\| (MSG-[A-Z]+-\d+) \|')) { [void]$msgCodes.Add($mm.Groups[1].Value) }
$refMsg = New-Object System.Collections.Generic.HashSet[string]
foreach ($mm in [regex]::Matches($text, '`(MSG-[A-Z]+-\d+)`')) { [void]$refMsg.Add($mm.Groups[1].Value) }
Write-Host "  Defined MSG codes: $($msgCodes.Count)"
Write-Host "  Referenced MSG codes: $($refMsg.Count)"
$missing = [System.Collections.Generic.HashSet[string]]::new($refMsg); [void]$missing.ExceptWith($msgCodes)
$unused = [System.Collections.Generic.HashSet[string]]::new($msgCodes); [void]$unused.ExceptWith($refMsg)
Write-Host "  Missing (referenced but undefined): $($missing.Count) -> $(($missing | Sort-Object) -join ', ')"
Write-Host "  Unused (defined but unreferenced): $($unused.Count) -> $(($unused | Sort-Object) -join ', ')"

Write-Host ""
Write-Host "=== PlantUML balance ==="
$starts = ([regex]::Matches($text, '(?m)^@startuml')).Count
$ends = ([regex]::Matches($text, '(?m)^@enduml')).Count
Write-Host "  @startuml: $starts  @enduml: $ends"

Write-Host ""
Write-Host "Done."
