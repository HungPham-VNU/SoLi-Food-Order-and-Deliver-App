const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const servicesDir = path.join(rootDir, 'apps', 'services');
const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const drizzleArgs = args.filter((arg) => arg !== '--' && arg !== '--dry-run');

const rootEnv = readEnvFile(path.join(rootDir, '.env'));

const serviceDirs = fs
  .readdirSync(servicesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(servicesDir, entry.name))
  .filter((serviceDir) =>
    fs.existsSync(path.join(serviceDir, 'drizzle.config.ts')),
  )
  .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

if (serviceDirs.length === 0) {
  console.error('No Drizzle configs found under apps/services.');
  process.exit(1);
}

for (const serviceDir of serviceDirs) {
  const serviceName = path.basename(serviceDir);
  const databaseUrl = resolveDatabaseUrl(serviceName);

  console.log(
    `\n> Pushing ${serviceName} schema to ${redactDatabaseUrl(databaseUrl)}`,
  );

  if (dryRun) {
    console.log(
      `  ${pnpmBin} exec drizzle-kit push --config=drizzle.config.ts ${drizzleArgs.join(
        ' ',
      )}`.trimEnd(),
    );
    continue;
  }

  const result = spawnSync(
    pnpmBin,
    [
      'exec',
      'drizzle-kit',
      'push',
      '--config=drizzle.config.ts',
      ...drizzleArgs,
    ],
    {
      cwd: serviceDir,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  );

  if (result.error) {
    console.error(`Failed to run drizzle-kit for ${serviceName}:`);
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('\nDrizzle push completed for all service databases.');

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

      if (!trimmed || trimmed.startsWith('#')) {
        return env;
      }

      const assignment = trimmed.replace(/^export\s+/, '');
      const equalsIndex = assignment.indexOf('=');

      if (equalsIndex === -1) {
        return env;
      }

      const key = assignment.slice(0, equalsIndex).trim();
      const value = assignment.slice(equalsIndex + 1).trim();

      if (!key) {
        return env;
      }

      env[key] = unquote(value);
      return env;
    }, {});
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
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
