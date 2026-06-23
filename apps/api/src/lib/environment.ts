/**
 * Single source of truth for environment-gating decisions.
 *
 * Phase 0 (microservices migration): all "is this dev/test?" and
 * "is this production?" checks must funnel through here so that security-
 * sensitive capabilities (synthetic auth, test endpoints) cannot be enabled
 * by an inconsistent or accidental check scattered across the codebase.
 *
 * FAIL-CLOSED PRINCIPLE:
 *   Dev/test-only capabilities are enabled ONLY for an explicit allowlist of
 *   NODE_ENV values. Any unknown, empty, or unset value — including a
 *   misconfigured production deployment — disables them. We never enable a
 *   privileged bypass by default.
 */

/** True only when NODE_ENV is exactly 'production'. */
export function isProductionEnv(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'production';
}

/**
 * True only for the explicit dev/test allowlist. Returns false for any other
 * value (production, staging, undefined, '', or any typo) so that a
 * misconfigured environment fails safe with the bypass DISABLED.
 */
export function isDevOrTestEnv(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'development' || nodeEnv === 'test';
}
