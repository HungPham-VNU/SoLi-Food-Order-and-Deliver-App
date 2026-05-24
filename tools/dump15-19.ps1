$path = "apps\api\docs\Final_Documents\SRS_FoodDelivery.md"
$utf8 = [System.Text.UTF8Encoding]::new($false)
$text = [System.IO.File]::ReadAllText($path, $utf8)
$lines = [regex]::Split($text, "`r`n|`n")
$want = @{ 15 = $true; 19 = $true }
$currentUC = $null
foreach ($line in $lines) {
  if ($line -match '^### UC-(\d+):') { $currentUC = [int]$matches[1]; continue }
  if ($currentUC -ne $null -and $want.ContainsKey($currentUC) -and $line -match '^\| _\((\d+)\)_ \| _BR-(\d+)\.(\d+)_ \|') {
    if ([int]$matches[2] -eq $currentUC) { Write-Host $line }
  }
}
