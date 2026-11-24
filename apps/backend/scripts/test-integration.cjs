const { spawnSync } = require('node:child_process');
const { globSync } = require('node:fs');
const { testDatabaseUrl, prepareDatabase } = require('./test-database.cjs');

async function main() {
  process.env.DATABASE_URL = testDatabaseUrl();
  Object.assign(process.env, {
    NODE_ENV: 'test',
    BETTER_AUTH_SECRET: 'integration-test-secret-at-least-32-characters',
    BACKEND_URL: 'http://localhost:4051',
    FRONTEND_URL: 'http://localhost:3051',
    RESEND_API_KEY: '',
    SMTP_HOST: '',
    SMTP_USERNAME: '',
    SMTP_PASSWORD: '',
  });
  await prepareDatabase();
  const run = (args) => {
    const result = spawnSync(process.execPath, args, {
      stdio: 'inherit',
      env: process.env,
    });
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(`Command failed (${result.status}): ${args.join(' ')}`);
  };
  run([process.env.npm_execpath, 'exec', 'prisma', 'migrate', 'deploy']);
  run([process.env.npm_execpath, 'exec', 'prisma', 'generate']);
  if (process.argv.includes('--prepare-only')) return;
  const files = globSync('src/**/*.int-spec.ts');
  if (!files.length) throw new Error('No integration tests found');
  run([
    '--require',
    'ts-node/register',
    '--require',
    'tsconfig-paths/register',
    '--test',
    '--test-concurrency=1',
    ...files,
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
