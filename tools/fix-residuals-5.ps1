$path = "d:\SoLi-Food-Order-and-Deliver-App\apps\api\docs\Final_Documents\SRS_FoodDelivery.md"
$utf8 = [System.Text.UTF8Encoding]::new($false)
$text = [System.IO.File]::ReadAllText($path, $utf8)
$d = [char]0x2756 + " "

# Differentiate BR-19.4 (T-10) and BR-19.5 (T-11) vocabulary
$old4 = "| _(6)_ | _BR-19.4_ | **Picked-Up State Gate (T-10):**<br>" + $d + "T-10 requires ``order.status = 'picked_up'``; any other source state returns HTTP 422 referencing ``MSG-LCYC-01``.<br>" + $d + "Idempotent re-issue: if already ``delivering``, returns unchanged without duplicate audit row. |"
$new4 = "| _(6)_ | _BR-19.4_ | **T-10 Pickup-to-Delivering Source-State Precondition:**<br>" + $d + "Transition T-10 (``picked_up`` -> ``delivering``) is only admitted when the shipper-owned order presents source status ``picked_up``; any non-``picked_up`` source (``ready_for_pickup``, ``delivered``, ``cancelled``) is rejected with HTTP 422 + ``MSG-LCYC-01`` and no audit row is appended.<br>" + $d + "Idempotency contract for T-10: a repeat call against an order that has already advanced to ``delivering`` returns the current snapshot (HTTP 200) without writing a second ``order_status_logs`` entry, allowing the shipper mobile client to retry safely after network loss while the bike is moving. |"

$old5 = "| _(13)_ | _BR-19.5_ | **Delivering State Gate (T-11):**<br>" + $d + "T-11 requires ``order.status = 'delivering'``; any other source state returns HTTP 422 referencing ``MSG-LCYC-01``.<br>" + $d + "Idempotent re-issue: if already ``delivered``, returns unchanged without duplicate audit row. |"
$new5 = "| _(13)_ | _BR-19.5_ | **T-11 Delivery-Completion Source-State Precondition:**<br>" + $d + "Transition T-11 (``delivering`` -> ``delivered``) is admitted only when the order is currently in ``delivering``; calls against ``picked_up`` (shipper skipped the start-delivery handshake) or against the terminal ``delivered`` (replay) are rejected with HTTP 422 + ``MSG-LCYC-01`` and produce no audit row.<br>" + $d + "Idempotency contract for T-11: because ``delivered`` is the happy-path terminal status, a duplicate completion call returns the persisted completion snapshot (HTTP 200, including ``delivered_at`` + proof-of-delivery photo URL) without writing a second ``order_status_logs`` entry or re-triggering payout settlement. |"

$ok = 0
if ($text.Contains($old4)) { $text = $text.Replace($old4, $new4); $ok++ } else { Write-Host "BR-19.4 no match" }
if ($text.Contains($old5)) { $text = $text.Replace($old5, $new5); $ok++ } else { Write-Host "BR-19.5 no match" }

[System.IO.File]::WriteAllText($path, $text, $utf8)
Write-Host "Applied: $ok/2"
