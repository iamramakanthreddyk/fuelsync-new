const { Client } = require('pg');
const bcrypt = require('bcryptjs');

(async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  const email = 'admin@fuelsync.com';
  const passwordPlain = 'admin123';
  const name = 'System Administrator';

  try {
    const existing = await client.query('SELECT id FROM users WHERE email=$1 LIMIT 1', [email]);
    if (existing.rows.length) {
      console.log('Superadmin already exists with id', existing.rows[0].id);
      await client.end();
      return;
    }

    const hash = await bcrypt.hash(passwordPlain, 12);
    const insert = await client.query(
      `INSERT INTO users (id, name, email, password, role, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'super_admin', true, NOW(), NOW())
       RETURNING id;`,
      [name, email, hash]
    );
    console.log('Created superadmin with id', insert.rows[0].id);
  } catch (err) {
    console.error('Error creating superadmin', err);
  } finally {
    await client.end();
  }
})();
