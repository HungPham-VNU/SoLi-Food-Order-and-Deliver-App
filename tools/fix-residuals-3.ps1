$path = "d:\SoLi-Food-Order-and-Deliver-App\apps\api\docs\Final_Documents\SRS_FoodDelivery.md"
$utf8 = [System.Text.UTF8Encoding]::new($false)
$text = [System.IO.File]::ReadAllText($path, $utf8)
$d = [char]0x2756 + " "

$pairs = @(
  @{
    Old = "| _(14)_ | _BR-15.9_ | **Atomicity & Concurrency Rules (T-08):**<br>" + $d + "Status update and audit log insert run in a single DB transaction.<br>" + $d + "Optimistic locking on ``version`` rejects concurrent updates with HTTP 409 referencing ``MSG-LCYC-06``. |"
    New = "| _(14)_ | _BR-15.9_ | **T-08 Transactional Boundary Rules:**<br>" + $d + "The ``preparing`` -> ``ready_for_pickup`` status update and its ``order_status_logs`` audit row are committed in a single DB transaction; the restaurant snapshot read and the ``OrderReadyForPickupEvent`` dispatch are explicitly post-commit side effects (not part of the transaction).<br>" + $d + "Optimistic locking on ``version`` serialises the T-08 transition against any other lifecycle writer; conflict returns HTTP 409 referencing ``MSG-LCYC-06`` and the in-flight dispatch notification is abandoned. |"
  },
  @{
    Old = "| _(14)_ | _BR-19.7_ | **Atomicity & Concurrency Rules:**<br>" + $d + "Each transition runs the status update plus audit-log insert in a single DB transaction.<br>" + $d + "Optimistic locking on ``version`` rejects concurrent updates with HTTP 409 referencing ``MSG-LCYC-06``. |"
    New = "| _(14)_ | _BR-19.7_ | **T-11 Transactional Boundary Rules:**<br>" + $d + "The ``delivering`` -> ``delivered`` status update and the ``order_status_logs`` audit row are committed in a single DB transaction; ``delivered`` is the terminal happy-path status, so no follow-on lifecycle scheduler claims this order after commit.<br>" + $d + "Optimistic locking on ``version`` blocks any concurrent writer (e.g. an admin-initiated T-12 refund attempt racing with the shipper completing the order); conflict returns HTTP 409 referencing ``MSG-LCYC-06`` and the request is rejected without re-issuing the audit row. |"
  }
)

$applied = 0
$failed = @()
foreach ($p in $pairs) {
  if ($text.Contains($p.Old)) {
    $text = $text.Replace($p.Old, $p.New)
    $applied++
  } else {
    $failed += ($p.Old.Substring(0, [Math]::Min(80, $p.Old.Length)))
  }
}
Write-Host "Applied: $applied / $($pairs.Count)"
foreach ($f in $failed) { Write-Host "FAILED: $f" }

[System.IO.File]::WriteAllText($path, $text, $utf8)
Write-Host "Saved."
