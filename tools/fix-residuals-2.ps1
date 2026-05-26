$path = "d:\SoLi-Food-Order-and-Deliver-App\apps\api\docs\Final_Documents\SRS_FoodDelivery.md"
$utf8 = [System.Text.UTF8Encoding]::new($false)
$text = [System.IO.File]::ReadAllText($path, $utf8)

# Rename repeated concern headers per BR row (only header changes; bodies preserved).
# Form: replace the row's old "BR-X.Y | **OldHeader:**" with new header.
# Using full prefix to ensure uniqueness.

$rename = @(
  # UC-8 Message Rules x7 -> distinct headers
  @{ BR = "BR-8.2";  Old = "**Message Rules:**";  New = "**Input Validation Error Response Rules:**" },
  @{ BR = "BR-8.6";  Old = "**Message Rules:**";  New = "**Concurrency Lock Error Response Rules:**" },
  @{ BR = "BR-8.8";  Old = "**Message Rules:**";  New = "**Cart Validation Error Response Rules:**" },
  @{ BR = "BR-8.10"; Old = "**Message Rules:**";  New = "**Item Validation Error Response Rules:**" },
  @{ BR = "BR-8.12"; Old = "**Message Rules:**";  New = "**Out-of-Zone Error Response Rules:**" },
  @{ BR = "BR-8.15"; Old = "**Message Rules:**";  New = "**Pricing Validation Error Response Rules:**" },
  @{ BR = "BR-8.17"; Old = "**Message Rules:**";  New = "**Persistence Error Response Rules:**" },
  # UC-8 Response Rules x2 -> distinct
  @{ BR = "BR-8.4";  Old = "**Response Rules:**"; New = "**Idempotency Replay Response Rules:**" },
  @{ BR = "BR-8.22"; Old = "**Response Rules:**"; New = "**Order Confirmation Response Rules:**" },
  # UC-9 Message Rules x3
  @{ BR = "BR-9.2";  Old = "**Message Rules:**";  New = "**Signature Verification Response Rules:**" },
  @{ BR = "BR-9.4";  Old = "**Message Rules:**";  New = "**Missing Transaction Response Rules:**" },
  @{ BR = "BR-9.8";  Old = "**Message Rules:**";  New = "**Amount Mismatch Response Rules:**" },
  # UC-10 Message Rules x2
  @{ BR = "BR-10.2"; Old = "**Message Rules:**";  New = "**Filter Validation Error Response Rules:**" },
  @{ BR = "BR-10.6"; Old = "**Message Rules:**";  New = "**Order Not Found Response Rules:**" },
  # UC-10 Response Rules x2
  @{ BR = "BR-10.8"; Old = "**Response Rules:**"; New = "**Order Detail Response Rules:**" },
  @{ BR = "BR-10.10";Old = "**Response Rules:**"; New = "**Reorder Payload Response Rules:**" }
)

$applied = 0
$failed = @()
foreach ($r in $rename) {
  # Anchor on "_BR-X.Y_ | " prefix to make match unique
  $anchor = "_" + $r.BR + "_ | " + $r.Old
  $replacement = "_" + $r.BR + "_ | " + $r.New
  if ($text.Contains($anchor)) {
    $text = $text.Replace($anchor, $replacement)
    $applied++
  } else {
    $failed += $r.BR
  }
}
Write-Host "Renamed headers: $applied / $($rename.Count)"
foreach ($f in $failed) { Write-Host "FAILED: $f" }

[System.IO.File]::WriteAllText($path, $text, $utf8)
Write-Host "Saved."
