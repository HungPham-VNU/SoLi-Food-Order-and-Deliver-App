$path = "d:\SoLi-Food-Order-and-Deliver-App\apps\api\docs\Final_Documents\SRS_FoodDelivery.md"
$utf8 = [System.Text.UTF8Encoding]::new($false)
$text = [System.IO.File]::ReadAllText($path, $utf8)
$d = [char]0x2756 + " "

$old = "| _(14)_ | _BR-19.7_ | **Atomicity & Concurrency (T-11):**<br>" + $d + "Status update and audit-log insert execute in a single DB transaction.<br>" + $d + "Optimistic locking on ``version`` rejects concurrent updates with HTTP 409 referencing ``MSG-LCYC-06``. |"
$new = "| _(14)_ | _BR-19.7_ | **T-11 Transactional Boundary Rules:**<br>" + $d + "The ``delivering`` -> ``delivered`` status update and the ``order_status_logs`` audit row are committed in a single DB transaction; ``delivered`` is the terminal happy-path status, so no follow-on lifecycle scheduler claims this order after commit.<br>" + $d + "Optimistic locking on ``version`` blocks any concurrent writer (e.g. an admin-initiated T-12 refund attempt racing with the shipper completing the order); conflict returns HTTP 409 referencing ``MSG-LCYC-06`` and the request is rejected without re-issuing the audit row. |"

if ($text.Contains($old)) {
  $text = $text.Replace($old, $new)
  [System.IO.File]::WriteAllText($path, $text, $utf8)
  Write-Host "Applied BR-19.7."
} else {
  Write-Host "Still no match."
}
