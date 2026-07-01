const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const servicesDir = path.join(rootDir, 'apps', 'services');
const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const rootEnv = readEnvFile(path.join(rootDir, '.env'));

const serviceDirs = fs
  .readdirSync(servicesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(servicesDir, entry.name))
  .filter((serviceDir) =>
    fs.existsSync(path.join(serviceDir, 'src', 'drizzle', 'seeds')),
  )
  .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

if (serviceDirs.length === 0) {
  console.error('No seed directories found under apps/services/*/src/drizzle/seeds.');
  process.exit(1);
}

// Catalog database is needed by multiple seeds
const catalogDatabaseUrl = resolveDatabaseUrl('catalog');

for (const serviceDir of serviceDirs) {
  const serviceName = path.basename(serviceDir);
  const databaseUrl = resolveDatabaseUrl(serviceName);
  const seedsDir = path.join(serviceDir, 'src', 'drizzle', 'seeds');
  
  const seedFiles = fs
    .readdirSync(seedsDir)
    .filter(file => file.endsWith('.seed.ts'))
    .map(file => path.join(seedsDir, file));

  if (seedFiles.length === 0) continue;

  console.log(`\n> Seeding ${serviceName} database at ${redactDatabaseUrl(databaseUrl)}`);

  for (const seedFile of seedFiles) {
    console.log(`  Running ${path.basename(seedFile)}...`);
    
    // We use tsx to execute the seed
    const result = spawnSync(
      pnpmBin,
      ['exec', 'tsx', `"${seedFile}"`],
      {
        cwd: serviceDir,
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          CATALOG_DATABASE_URL: catalogDatabaseUrl,
        },
        stdio: 'inherit',
        shell: true,
      },
    );

    if (result.error) {
      console.error(`Failed to run seed script ${seedFile}:`);
      console.error(result.error.message);
      process.exit(1);
    }

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

console.log('\nSeeding completed for all service databases.');

function resolveDatabaseUrl(serviceName) {
  const serviceKey = `${serviceName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')}_DATABASE_URL`;

  return (
    process.env[serviceKey] ||
    rootEnv[serviceKey] ||
    defaultLocalDatabaseUrl(serviceName)
  );
}

function defaultLocalDatabaseUrl(serviceName) {
  const host =
    process.env.DB_PUSH_POSTGRES_HOST ||
    rootEnv.DB_PUSH_POSTGRES_HOST ||
    process.env.POSTGRES_HOST ||
    rootEnv.POSTGRES_HOST ||
    'localhost';
  const port =
    process.env.DB_PUSH_POSTGRES_PORT ||
    rootEnv.DB_PUSH_POSTGRES_PORT ||
    process.env.POSTGRES_PORT ||
    rootEnv.POSTGRES_PORT ||
    '5432';
  const user = `uitfood_${serviceName}`;
  const password = `${serviceName}_secret`;
  const database = `uitfood_${serviceName}`;

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return env;
      const assignment = trimmed.replace(/^export\s+/, '');
      const equalsIndex = assignment.indexOf('=');
      if (equalsIndex === -1) return env;
      const key = assignment.slice(0, equalsIndex).trim();
      const value = assignment.slice(equalsIndex + 1).trim();
      if (!key) return env;
      
      env[key] = value;
      return env;
    }, {});
}

function redactDatabaseUrl(value) {
  try {
    const url = new URL(value);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    return '<invalid DATABASE_URL>';
  }
}
