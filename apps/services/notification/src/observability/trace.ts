export async function runObserved<T>(
  _name: string,
  _attributes: Record<string, string | number | boolean | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  return fn();
}
