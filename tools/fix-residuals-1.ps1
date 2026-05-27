$path = "d:\SoLi-Food-Order-and-Deliver-App\apps\api\docs\Final_Documents\SRS_FoodDelivery.md"
$utf8 = [System.Text.UTF8Encoding]::new($false)
$text = [System.IO.File]::ReadAllText($path, $utf8)

$pairs = @(
  @{
    Old = "| _(17)_ | _BR-9.12_ | **Timeout Enforcement Rules:**<br>" + [char]0x2756 + " At scheduled intervals, expired payment sessions are identified by the payment timeout scheduler and marked as failed. |"
    New = "| _(17)_ | _BR-9.12_ | **Timeout Enforcement Rules:**<br>" + [char]0x2756 + " The ``PaymentTimeoutTask`` runs periodically (every 60 seconds) to identify expired payment sessions and mark them as failed; no manual intervention is required. |"
  },
  @{
    Old = "| _(12)_ | _BR-15.7_ | **Authorization & Ownership Re-check Rules:**<br>" + [char]0x2756 + " T-08 re-validates actor role (``restaurant`` or ``admin``) and restaurant ownership before advancing to ``ready_for_pickup``.<br>" + [char]0x2756 + " Same role and ownership constraints apply as BR-15.1 and BR-15.2. |"
    New = "| _(12)_ | _BR-15.7_ | **T-08 Authorization Re-check Rules:**<br>" + [char]0x2756 + " T-08 re-validates that the actor holds role ``restaurant`` or ``admin`` before advancing the order to ``ready_for_pickup``; other roles return HTTP 403 referencing ``MSG-LCYC-02``.<br>" + [char]0x2756 + " For role ``restaurant``, the order's ``restaurantId`` must match the actor's restaurant id resolved via the ACL snapshot; mismatch returns HTTP 403 referencing ``MSG-LCYC-03``. For role ``admin``, ownership verification is bypassed. |"
  },
  @{
    Old = "| _(12)_ | _BR-19.3_ | **Ownership Re-verification on T-11:**<br>" + [char]0x2756 + " T-11 re-checks that the same shipper still owns the order; same constraints as BR-19.2. |"
    New = "| _(12)_ | _BR-19.3_ | **Ownership Re-verification on T-11:**<br>" + [char]0x2756 + " T-11 re-verifies that ``orders.shipperId = session.user.id`` for role ``shipper``; mismatch returns HTTP 403 referencing ``MSG-DEL-03``. For role ``admin``, the assigned-shipper check is bypassed. |"
  },
  @{
    Old = "| _(5)_ | _BR-20.2_ | **Timeline Ownership Enforcement:**<br>" + [char]0x2756 + " ``GET /orders/:id/timeline`` enforces the same ownership constraint as BR-20.1.<br>" + [char]0x2756 + " Non-owners return HTTP 404 referencing ``MSG-HIST-01``. |"
    New = "| _(5)_ | _BR-20.2_ | **Timeline Ownership Enforcement:**<br>" + [char]0x2756 + " ``GET /orders/:id/timeline`` enforces ``orders.customerId = session.user.id`` for role ``user``; non-owners receive HTTP 404 referencing ``MSG-HIST-01`` (uniform 404 prevents ownership disclosure). |"
  },
  @{
    Old = "| _(11)_ | _BR-20.10_ | **Cross-Channel Convergence Rules:**<br>" + [char]0x2756 + " When a client receives an update via WebSocket and subsequently polls the read endpoint, the polled response MUST contain the same or newer state (monotonic causality).<br>" + [char]0x2756 + " Polling interval and eventual consistency SLA (recommended < 60s) ensure convergence between channels. |"
    New = "| _(11)_ | _BR-20.10_ | **Cross-Channel Convergence Rules:**<br>" + [char]0x2756 + " When a client receives an update via WebSocket and subsequently polls the read endpoint, the polled response MUST contain the same or newer state (monotonic causality).<br>" + [char]0x2756 + " A polling interval of at most 60 seconds is required so the polled channel converges with the WebSocket channel within the convergence SLA. |"
  },
  @{
    Old = "| _(15)_ | _BR-25.17_ | **Gateway Failure & Retry Scheduling:**<br>" + [char]0x2756 + " Gateway failures (timeout, 5xx, network error) increment ``refundRetryCount`` and leave the row in ``refund_pending``.<br>" + [char]0x2756 + " ``PaymentRefundRetryTask`` re-issues the call with exponential backoff using existing schema columns (``refundRetryCount``, ``refundInitiatedAt``).<br>" + [char]0x2756 + " The task is scheduled automatically on failure; no manual intervention required. |"
    New = "| _(15)_ | _BR-25.17_ | **Gateway Failure & Retry Orchestration:**<br>" + [char]0x2756 + " Gateway failures (timeout, 5xx, network error) increment ``refundRetryCount`` and leave the row in ``refund_pending``.<br>" + [char]0x2756 + " ``PaymentRefundRetryTask`` re-issues the call with exponential backoff using existing schema columns (``refundRetryCount``, ``refundInitiatedAt``).<br>" + [char]0x2756 + " The task runs automatically on failure; no manual intervention is required. |"
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
