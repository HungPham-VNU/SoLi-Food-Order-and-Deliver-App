/**
 * Minimal tracing shim for the Ordering service.
 *
 * Keeps the `runObserved` surface so domain code can add tracing without
 * changing callers. It currently executes the work directly.
 */
export async function runObserved<T>(
  _name: string,
  _attributes: Record<string, string | number | boolean | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  return fn();
}
