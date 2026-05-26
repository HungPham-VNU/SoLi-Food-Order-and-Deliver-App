$path = "apps\api\docs\Final_Documents\SRS_FoodDelivery.md"
$utf8 = [System.Text.UTF8Encoding]::new($false)
$text = [System.IO.File]::ReadAllText($path, $utf8)
$lines = [regex]::Split($text, "`r`n|`n")
$ucNum = 20
$inUC = $false
foreach ($line in $lines) {
  if ($line -match '^### UC-(\d+):') { $inUC = ([int]$matches[1] -eq $ucNum); continue }
  if ($inUC -and $line -match '^\| _\((\d+)\)_ \| _BR-(\d+)\.(\d+)_ \|') {
    Write-Host ("Line len {0}: {1}" -f $line.Length, $line.Substring(0, [Math]::Min(120, $line.Length)))
  }
}
