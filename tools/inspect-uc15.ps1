$t = [System.IO.File]::ReadAllText("apps\api\docs\Final_Documents\SRS_FoodDelivery.md", [System.Text.UTF8Encoding]::new($false)) -replace "`r`n","`n"
$rows = [regex]::Matches($t, '(?m)^\| _\((\d+)\)_ \| _BR-15\.([0-9]+)_ \| (.+?) \|\s*$')
foreach ($r in $rows) {
  $body = $r.Groups[3].Value
  Write-Host ("BR-15.{0} act({1}) len={2}" -f $r.Groups[2].Value, $r.Groups[1].Value, $body.Length)
}
