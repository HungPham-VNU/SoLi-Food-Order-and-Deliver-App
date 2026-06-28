/**
 * Minimal domain-metrics shim for the Catalog service until service-level
 * OpenTelemetry meters are wired.
 */
export function recordSearch(..._args: unknown[]): void {}
export function recordAiSearch(..._args: unknown[]): void {}
export function recordAiSearchBranch(..._args: unknown[]): void {}
export function recordAiSearchRanking(..._args: unknown[]): void {}
export function recordAiSearchBackfill(..._args: unknown[]): void {}
export function recordAiSearchEmbeddingJob(..._args: unknown[]): void {}
export function recordAiSearchStaleEmbeddings(..._args: unknown[]): void {}
export function recordAiSearchSemanticFallback(..._args: unknown[]): void {}
