import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const SRC_ROOT = resolve(__dirname, '..');
const MODULE_ROOT = join(SRC_ROOT, 'module');

const ALLOWED_CROSS_CONTEXT_IMPORTS: Record<string, ReadonlySet<string>> = {
  'restaurant-catalog': new Set([
    '@/module/auth/identity.module',
    '@/module/image/image.module',
  ]),
  ordering: new Set([
    '@/module/payment/payment.module',
    '@/module/promotion/promotion.module',
  ]),
  review: new Set([
    '@/module/ordering/ordering-contracts.module',
    '@/module/restaurant-catalog/catalog-contracts.module',
  ]),
  notification: new Set(['@/module/auth/identity.module']),
  promotion: new Set(['@/module/restaurant-catalog/catalog-contracts.module']),
  // Reporting is a deliberately read-only query composition boundary.
  'admin-analytics': new Set([
    '@/module/ordering/order/order.schema',
    '@/module/restaurant-catalog/restaurant/restaurant.schema',
  ]),
};

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function productionTypescriptFiles(directory: string): string[] {
  return walk(directory).filter(
    (file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'),
  );
}

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)].map(
    (match) => match[1],
  );
}

function contextForModulePath(path: string): string | null {
  const normalized = relative(MODULE_ROOT, path).split(sep);
  return normalized[0] && normalized[0] !== '..' ? normalized[0] : null;
}

function targetContext(importer: string, specifier: string): string | null {
  const aliasMatch = specifier.match(/^@\/module\/([^/]+)/);
  if (aliasMatch) return aliasMatch[1];
  if (!specifier.startsWith('.')) return null;

  const candidate = resolve(dirname(importer), specifier);
  return candidate.startsWith(MODULE_ROOT)
    ? contextForModulePath(candidate)
    : null;
}

describe('modular-monolith boundaries', () => {
  it('keeps cross-context imports on the explicit allowlist', () => {
    const violations: string[] = [];

    for (const file of productionTypescriptFiles(MODULE_ROOT)) {
      const sourceContext = contextForModulePath(file);
      if (!sourceContext) continue;

      for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
        const target = targetContext(file, specifier);
        if (!target || target === sourceContext) continue;

        if (!ALLOWED_CROSS_CONTEXT_IMPORTS[sourceContext]?.has(specifier)) {
          violations.push(
            `${relative(SRC_ROOT, file)}: ${sourceContext} -> ${target} via ${specifier}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('reserves the unified Drizzle schema barrel for infrastructure', () => {
    const violations = productionTypescriptFiles(MODULE_ROOT).filter((file) =>
      importSpecifiers(readFileSync(file, 'utf8')).includes('@/drizzle/schema'),
    );

    expect(violations.map((file) => relative(SRC_ROOT, file))).toEqual([]);
  });

  it('keeps shared contracts independent from business contexts', () => {
    const sharedRoot = join(SRC_ROOT, 'shared');
    const violations = productionTypescriptFiles(sharedRoot).filter((file) =>
      importSpecifiers(readFileSync(file, 'utf8')).some((specifier) =>
        specifier.startsWith('@/module/'),
      ),
    );

    expect(violations.map((file) => relative(SRC_ROOT, file))).toEqual([]);
  });

  it('does not hide dependencies behind global application modules', () => {
    const roots = [MODULE_ROOT, join(SRC_ROOT, 'lib')];
    const violations = roots
      .flatMap(productionTypescriptFiles)
      .filter((file) => /@Global\s*\(/.test(readFileSync(file, 'utf8')));

    expect(violations.map((file) => relative(SRC_ROOT, file))).toEqual([]);
  });

  it('keeps catalog-owned capabilities inside Restaurant Catalog', () => {
    for (const formerContext of ['nutrition', 'dietary-tags', 'ai']) {
      expect(existsSync(join(MODULE_ROOT, formerContext))).toBe(false);
    }
  });
});
