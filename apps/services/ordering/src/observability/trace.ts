/**
 * Minimal tracing shim for the Ordering service.
 *
 * The monolith wires OpenTelemetry spans here; the extracted service keeps the
 * same `runObserved` surface so domain code is unchanged, but executes the work
 * directly. A real OTel exporter can be reintroduced later without touching
 * callers.
 */
export async function runObserved<T>(
  _name: string,
  _attributes: Record<string, string | number | boolean | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  return fn();
}
