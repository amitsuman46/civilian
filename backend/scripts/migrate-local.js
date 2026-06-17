/**
 * Local schema migration — adds formation/unit columns.
 * Usage: node scripts/migrate-local.js
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const isProd = process.env.NODE_ENV === 'production';
const dbHost = process.env.DB_HOST === 'localhost' && isProd
  ? '127.0.0.1'
  : (process.env.DB_HOST || '127.0.0.1');

const config = {
  host: dbHost,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || process.env.DB_PASSWORD || 'root@123',
  database: process.env.DB_NAME || 'civilian_db',
  multipleStatements: true,
};

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [config.database, table, column]
  );
  return rows.length > 0;
}

async function addColumn(conn, table, column, definition) {
  if (await columnExists(conn, table, column)) {
    console.log(`  skip ${table}.${column} (already exists)`);
    return;
  }
  await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
  console.log(`  added ${table}.${column}`);
}

async function main() {
  console.log(`Connecting to ${config.user}@${config.host}/${config.database} ...`);
  const conn = await mysql.createConnection(config);
  console.log('Connected.\n');

  console.log('users table:');
  await addColumn(conn, 'users', 'formation', 'formation VARCHAR(255) DEFAULT NULL AFTER full_name');
  await addColumn(conn, 'users', 'unit', 'unit VARCHAR(255) DEFAULT NULL AFTER formation');

  console.log('\ncivilians table:');
  await addColumn(conn, 'civilians', 'formation', 'formation VARCHAR(255) DEFAULT NULL AFTER village');
  await addColumn(conn, 'civilians', 'unit', 'unit VARCHAR(255) DEFAULT NULL AFTER formation');
  await addColumn(conn, 'civilians', 'created_by', 'created_by VARCHAR(64) DEFAULT NULL');

  const [r2] = await conn.query(
    `UPDATE civilians SET created_by = unit
     WHERE (created_by IS NULL OR created_by = '') AND unit IS NOT NULL AND unit != ''`
  );
  if (r2.affectedRows) console.log(`\nBackfilled created_by on ${r2.affectedRows} civilian row(s).`);

  const [r1] = await conn.query(
    `UPDATE users SET unit = user_id WHERE unit IS NULL OR unit = ''`
  );
  console.log(`\nUpdated unit on ${r1.affectedRows} user row(s).`);

  const [users] = await conn.query(
    'SELECT id, user_id, full_name, formation, unit FROM users LIMIT 5'
  );
  console.log('\nSample users:');
  console.table(users);

  await conn.end();
  console.log('\nMigration complete.');
}

main().catch(err => {
  console.error('\nMigration failed:', err.message);
  if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('Check DB_USER / DB_PASS in .env or use root/root@123 for local MySQL.');
  }
  if (err.code === 'ER_BAD_DB_ERROR') {
    console.error(`Database "${config.database}" does not exist. Create it first.`);
  }
  process.exit(1);
});
