$t = [System.IO.File]::ReadAllText("apps\api\docs\Final_Documents\SRS_FoodDelivery.md", [System.Text.UTF8Encoding]::new($false)) -replace "`r`n","`n"
$ucMatches = [regex]::Matches($t, '(?ms)^### UC-(\d+):.*?(?=\n### UC-\d+:|\n## )')
foreach ($ucm in $ucMatches) {
  $ucNum = $ucm.Groups[1].Value
  $rows = [regex]::Matches($ucm.Value, '(?m)^\| _\((\d+)\)_ \| _BR-\d+\.\d+_ \| (.+?) \|\s*$')
  $h = @{}
  foreach ($r in $rows) {
    $key = $r.Groups[2].Value
    if ($h.ContainsKey($key)) { $h[$key] = $h[$key] + "," + $r.Groups[1].Value } else { $h[$key] = $r.Groups[1].Value }
  }
  foreach ($k in $h.Keys) {
    if ($h[$k] -match ',') {
      $preview = if ($k.Length -gt 60) { $k.Substring(0,60) } else { $k }
      Write-Host ("UC-{0} activities [{1}] share identical body: {2}..." -f $ucNum, $h[$k], $preview)
    }
  }
}
