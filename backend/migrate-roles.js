/**
 * Migration Script: Role Restructure
 * Renames 'data_controller' → 'potraz_assessor'
 * Creates 'assessor_comments' table
 * Run once: node backend/migrate-roles.js
 */
'use strict';
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'cdpa_system',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASS     || 'masie*03e',
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('🔄 Starting role migration...\n');

    // 1. Drop old CHECK constraint on users.role
    console.log('  Step 1: Dropping old role CHECK constraint...');
    await client.query(`
      ALTER TABLE users 
      DROP CONSTRAINT IF EXISTS users_role_check
    `);
    console.log('  ✅ Old constraint dropped\n');

    // 2. Rename existing data_controller users → potraz_assessor
    console.log('  Step 2: Renaming data_controller → potraz_assessor in users table...');
    const updateResult = await client.query(`
      UPDATE users SET role = 'potraz_assessor' WHERE role = 'data_controller'
      RETURNING id, username
    `);
    console.log(`  ✅ Migrated ${updateResult.rowCount} user(s): ${updateResult.rows.map(u => u.username).join(', ') || 'none'}\n`);

    // 3. Add new CHECK constraint
    console.log('  Step 3: Adding new role CHECK constraint...');
    await client.query(`
      ALTER TABLE users 
      ADD CONSTRAINT users_role_check 
      CHECK (role IN ('potraz_assessor','data_protection_officer','system_administrator'))
    `);
    console.log('  ✅ New constraint added\n');

    // 4. Add controller_license_number and controller_contact_number if they don't exist
    console.log('  Step 4: Ensuring users table has all required columns...');
    await client.query(`
      ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS controller_license_number VARCHAR(100),
        ADD COLUMN IF NOT EXISTS controller_contact_number VARCHAR(100)
    `);
    console.log('  ✅ Users columns verified\n');

    // 5. Create assessor_comments table
    console.log('  Step 5: Creating assessor_comments table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS assessor_comments (
        id                  SERIAL PRIMARY KEY,
        assessor_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
        organization_name   VARCHAR(255),
        target_dpo_username VARCHAR(50),
        comment_text        TEXT NOT NULL,
        comment_type        VARCHAR(20) DEFAULT 'general' CHECK (comment_type IN ('general','compliance','dpo','risk')),
        is_visible_to_dpo   BOOLEAN DEFAULT TRUE,
        created_at          TIMESTAMP DEFAULT NOW(),
        updated_at          TIMESTAMP DEFAULT NOW()
      )
    `);

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_assessor_comments_org ON assessor_comments(organization_name)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_assessor_comments_assessor ON assessor_comments(assessor_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_assessor_comments_dpo ON assessor_comments(target_dpo_username)`);
    console.log('  ✅ assessor_comments table created with indexes\n');

    await client.query('COMMIT');

    console.log('╔══════════════════════════════════════════╗');
    console.log('║   ✅ Migration completed successfully!   ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('\nNew roles in system:');
    console.log('  • system_administrator  — Full access + user management');
    console.log('  • data_protection_officer — Data capture + reports');
    console.log('  • potraz_assessor       — View-only + leave comments\n');

    const users = await pool.query('SELECT username, role, is_active FROM users ORDER BY role');
    console.log('Current users after migration:');
    console.table(users.rows);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed (rolled back):', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
