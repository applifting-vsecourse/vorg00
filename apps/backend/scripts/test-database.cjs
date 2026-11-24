const { Client } = require('pg');

function testDatabaseUrl() {
  // Never fall back to DATABASE_URL or the development .env.
  const value =
    process.env.TEST_DATABASE_URL ??
    'postgresql://quacker:quacker@localhost:5433/quacker_test';
  const url = new URL(value);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.pathname !== '/quacker_test' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'TEST_DATABASE_URL must point to quacker_test without query parameters',
    );
  }
  return value;
}

async function prepareDatabase() {
  const url = new URL(testDatabaseUrl());
  url.pathname = '/postgres';
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'quacker_test'",
    );
    if (result.rowCount === 0)
      await client.query('CREATE DATABASE quacker_test');
  } finally {
    await client.end();
  }
}

module.exports = { testDatabaseUrl, prepareDatabase };
