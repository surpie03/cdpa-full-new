/**
 * =====================================================
 * Database Initialization Module
 * Runs automatically on server startup
 * Replaces all individual migration scripts
 * =====================================================
 */

'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'cdpa_system',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASS     || 'masie*03e',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// ─── UTILITIES ───────────────────────────────────────
function generatePassword(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// ─── INITIALIZATION FUNCTIONS ───────────────────────

/**
 * Initialize database schema from SQL file
 */
async function initializeSchema() {
  console.log('  ➜ Checking database schema...');
  
  try {
    // Check if tables exist
    const result = await pool.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const tableCount = parseInt(result.rows[0].count);
    
    if (tableCount === 0) {
      console.log('  📝 Running database schema initialization...');
      const sqlPath = path.join(__dirname, 'cdpa_system.sql');
      const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
      
      await pool.query(sqlContent);
      console.log('  ✅ Database schema created');
    } else {
      console.log(`  ✅ Database schema exists (${tableCount} tables)`);
    }
  } catch (err) {
    console.error('  ❌ Schema initialization error:', err.message);
    throw err;
  }
}

/**
 * Add license_number column to module tables
 */
async function addLicenseNumberFields() {
  console.log('  ➜ Checking license_number fields...');
  
  try {
    const tables = [
      'compliance_assessments',
      'gap_analysis',
      'ropa_records',
      'dpia_assessments',
      'security_gap_analysis',
      'controller_validations'
    ];

    for (const table of tables) {
      const check = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='${table}' AND column_name='license_number'
      `);

      if (!check.rows[0]) {
        await pool.query(`
          ALTER TABLE ${table} 
          ADD COLUMN license_number VARCHAR(100) DEFAULT NULL
        `);
        console.log(`    ✅ Added license_number to ${table}`);
      }
    }
    
    console.log('  ✅ License number fields verified');
  } catch (err) {
    console.error('  ⚠️  License fields error:', err.message);
  }
}

/**
 * Add controller details fields to users table
 */
async function addControllerDetailsFields() {
  console.log('  ➜ Checking controller details fields...');
  
  try {
    const fields = [
      { name: 'controller_license_number', type: 'VARCHAR(100)' },
      { name: 'controller_contact', type: 'VARCHAR(100)' },
      { name: 'controller_address', type: 'TEXT' },
      { name: 'contract_details', type: 'TEXT' }
    ];

    for (const field of fields) {
      const check = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='users' AND column_name='${field.name}'
      `);

      if (!check.rows[0]) {
        await pool.query(`
          ALTER TABLE users ADD COLUMN ${field.name} ${field.type}
        `);
        console.log(`    ✅ Added ${field.name} to users`);
      }
    }
    
    console.log('  ✅ Controller details fields verified');
  } catch (err) {
    console.error('  ⚠️  Controller fields error:', err.message);
  }
}

/**
 * Add created_at column to controller_validations
 */
async function addCreatedAtColumn() {
  console.log('  ➜ Checking created_at column...');
  
  try {
    const check = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='controller_validations' AND column_name='created_at'
    `);

    if (!check.rows[0]) {
      await pool.query(`
        ALTER TABLE controller_validations 
        ADD COLUMN created_at TIMESTAMP DEFAULT NOW()
      `);
      console.log('    ✅ Added created_at to controller_validations');
    }
    
    console.log('  ✅ Created_at column verified');
  } catch (err) {
    console.error('  ⚠️  Created_at column error:', err.message);
  }
}

/**
 * Add license management fields to organizations
 */
async function addLicenseManagementFields() {
  console.log('  ➜ Checking license management fields...');
  
  try {
    // Check and add fields to organizations
    const checkFields = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='organizations' AND column_name='license_locked'
    `);

    if (!checkFields.rows[0]) {
      await pool.query(`
        ALTER TABLE organizations 
        ADD COLUMN license_locked BOOLEAN DEFAULT FALSE,
        ADD COLUMN license_created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN license_locked_at TIMESTAMP,
        ADD COLUMN license_edit_allowed BOOLEAN DEFAULT TRUE
      `);
      console.log('    ✅ Added license management fields to organizations');
    }

    // Create license_number_requests table if it doesn't exist
    const checkRequests = await pool.query(`
      SELECT to_regclass('public.license_number_requests')
    `);

    if (!checkRequests.rows[0].to_regclass) {
      await pool.query(`
        CREATE TABLE license_number_requests (
          id                  SERIAL PRIMARY KEY,
          organization_id     INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
          organization_name   VARCHAR(255) NOT NULL,
          requested_license   VARCHAR(100) NOT NULL,
          requested_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
          requested_at        TIMESTAMP DEFAULT NOW(),
          status              VARCHAR(20) DEFAULT 'pending',
          approved_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
          approved_at         TIMESTAMP,
          rejection_reason    TEXT,
          is_locked           BOOLEAN DEFAULT FALSE,
          locked_at           TIMESTAMP,
          created_at          TIMESTAMP DEFAULT NOW(),
          updated_at          TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX idx_license_req_org ON license_number_requests(organization_id);
        CREATE INDEX idx_license_req_status ON license_number_requests(status);
      `);
      console.log('    ✅ Created license_number_requests table');
    }
    
    console.log('  ✅ License management fields verified');
  } catch (err) {
    console.error('  ⚠️  License management fields error:', err.message);
  }
}

/**
 * Add registration_number column to all relevant tables
 */
async function addRegistrationNumberFields() {
  console.log('  ➜ Checking registration_number fields...');
  
  try {
    // Check organizations table first
    const orgCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='organizations' AND column_name='registration_number'
    `);

    if (!orgCheck.rows[0]) {
      await pool.query(`
        ALTER TABLE organizations 
        ADD COLUMN registration_number VARCHAR(100)
      `);
      console.log('    ✅ Added registration_number to organizations');
    }

    // Check all module tables
    const tables = [
      'compliance_assessments', 'gap_analysis', 'ropa_records', 'dpia_assessments',
      'security_gap_analysis', 'controller_validations'
    ];

    for (const table of tables) {
      const check = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='${table}' AND column_name='registration_number'
      `);

      if (!check.rows[0]) {
        await pool.query(`
          ALTER TABLE ${table} 
          ADD COLUMN registration_number VARCHAR(100) DEFAULT NULL
        `);
        console.log(`    ✅ Added registration_number to ${table}`);
      }
    }
    
    console.log('  ✅ Registration number fields verified');
  } catch (err) {
    console.error('  ⚠️  Registration fields error:', err.message);
  }
}

/**
 * Add ropa_controller_registration_number to ropa_records
 */
async function addROPAControllerFields() {
  console.log('  ➜ Checking ROPA controller fields...');
  
  try {
    const check = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='ropa_records' AND column_name='ropa_controller_registration_number'
    `);

    if (!check.rows[0]) {
      await pool.query(`
        ALTER TABLE ropa_records 
        ADD COLUMN ropa_controller_registration_number VARCHAR(100)
      `);
      console.log('    ✅ Added ropa_controller_registration_number to ropa_records');
    }
    
    console.log('  ✅ ROPA controller fields verified');
  } catch (err) {
    console.error('  ⚠️  ROPA controller fields error:', err.message);
  }
}

/**
 * Add controller details fields to controller_validations table
 */
async function addControllerDetailsToValidations() {
  console.log('  ➜ Checking controller details in validations...');
  
  try {
    const fields = [
      { name: 'controller_name', type: 'VARCHAR(255)' },
      { name: 'controller_address', type: 'TEXT' },
      { name: 'controller_contact', type: 'VARCHAR(100)' }
    ];

    for (const field of fields) {
      const check = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='controller_validations' AND column_name='${field.name}'
      `);

      if (!check.rows[0]) {
        try {
          await pool.query(`
            ALTER TABLE controller_validations 
            ADD COLUMN ${field.name} ${field.type}
          `);
          console.log(`    ✅ Added ${field.name} to controller_validations`);
        } catch (e) {
          // Field might already exist
        }
      }
    }
    
    console.log('  ✅ Controller details fields verified');
  } catch (err) {
    console.error('  ⚠️  Controller details fields error:', err.message);
  }
}

/**
 * Add DPO (Data Protection Officer) fields across all modules
 */
async function addDPOFields() {
  console.log('  ➜ Checking DPO name and contact fields...');
  
  try {
    const tables = [
      'compliance_assessments',
      'gap_analysis',
      'ropa_records',
      'dpia_assessments',
      'security_gap_analysis',
      'controller_validations',
      'department_assessments',
      'assets',
      'kpi_tracking',
      'cia_data',
      'department_remediation_plans',
      'raci_matrix'
    ];

    for (const table of tables) {
      // Check and add dpo_name
      const dpoNameCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='${table}' AND column_name='dpo_name'
      `);

      if (!dpoNameCheck.rows[0]) {
        try {
          await pool.query(`
            ALTER TABLE ${table} 
            ADD COLUMN dpo_name VARCHAR(255) DEFAULT NULL
          `);
          console.log(`    ✅ Added dpo_name to ${table}`);
        } catch (e) {
          // Table might not exist, skip
        }
      }

      // Check and add dpo_contact
      const dpoContactCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='${table}' AND column_name='dpo_contact'
      `);

      if (!dpoContactCheck.rows[0]) {
        try {
          await pool.query(`
            ALTER TABLE ${table} 
            ADD COLUMN dpo_contact VARCHAR(100) DEFAULT NULL
          `);
          console.log(`    ✅ Added dpo_contact to ${table}`);
        } catch (e) {
          // Table might not exist, skip
        }
      }
    }

    // Also add to organizations table
    const orgDpoNameCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='organizations' AND column_name='dpo_name'
    `);

    if (!orgDpoNameCheck.rows[0]) {
      try {
        await pool.query(`
          ALTER TABLE organizations 
          ADD COLUMN dpo_name VARCHAR(255),
          ADD COLUMN dpo_contact VARCHAR(100)
        `);
        console.log('    ✅ Added DPO fields to organizations');
      } catch (e) {
        // Table might not exist
      }
    }

    // Also add to users table
    const userDpoNameCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='dpo_name'
    `);

    if (!userDpoNameCheck.rows[0]) {
      try {
        await pool.query(`
          ALTER TABLE users 
          ADD COLUMN dpo_name VARCHAR(255),
          ADD COLUMN dpo_contact VARCHAR(100)
        `);
        console.log('    ✅ Added DPO fields to users');
      } catch (e) {
        // Field might already exist
      }
    }
    
    console.log('  ✅ DPO fields verified');
  } catch (err) {
    console.error('  ⚠️  DPO fields error:', err.message);
  }
}

/**
 * Add attempt_number field to compliance_assessments for tracking retakes
 */
async function addComplianceAttemptTracking() {
  console.log('  ➜ Checking compliance assessment attempt tracking...');
  
  try {
    const check = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='compliance_assessments' AND column_name='attempt_number'
    `);

    if (!check.rows[0]) {
      await pool.query(`
        ALTER TABLE compliance_assessments 
        ADD COLUMN attempt_number INTEGER DEFAULT 1
      `);
      console.log('    ✅ Added attempt_number to compliance_assessments');
    }
    
    console.log('  ✅ Compliance attempt tracking verified');
  } catch (err) {
    console.error('  ⚠️  Compliance attempt tracking error:', err.message);
  }
}

/**
 * Add assessment_type field to compliance_assessments for assessment type
 */
async function addAssessmentTypeField() {
  console.log('  ➜ Checking assessment type field...');
  
  try {
    const check = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='compliance_assessments' AND column_name='assessment_type'
    `);

    if (!check.rows[0]) {
      await pool.query(`
        ALTER TABLE compliance_assessments 
        ADD COLUMN assessment_type VARCHAR(50) DEFAULT 'self_assessment'
      `);
      console.log('    ✅ Added assessment_type to compliance_assessments');
    }
    
    console.log('  ✅ Assessment type field verified');
  } catch (err) {
    console.error('  ⚠️  Assessment type field error:', err.message);
  }
}

async function addControllerDetailsToOrganizations() {
  console.log('  ➜ Checking controller details in organizations...');
  
  try {
    const fields = [
      { name: 'controller_name', type: 'VARCHAR(255)' },
      { name: 'controller_address', type: 'TEXT' },
      { name: 'controller_contact', type: 'VARCHAR(100)' }
    ];

    for (const field of fields) {
      const check = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='organizations' AND column_name='${field.name}'
      `);
      if (!check.rows[0]) {
        await pool.query(`
          ALTER TABLE organizations ADD COLUMN ${field.name} ${field.type}
        `);
        console.log(`    ✅ Added ${field.name} to organizations`);
      }
    }
    
    console.log('  ✅ Controller details in organizations verified');
  } catch (err) {
    console.error('  ⚠️  Controller details in organizations error:', err.message);
  }
}

async function updateUserRoleCheckConstraint() {
  console.log('  ➜ Checking user role check constraint...');
  
  try {
    // Check if constraint exists and is the old one
    const checkResult = await pool.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'users'::regclass AND contype = 'c';
    `);

    for (const row of checkResult.rows) {
      // Drop the old constraint
      await pool.query(`ALTER TABLE users DROP CONSTRAINT ${row.conname}`);
      console.log(`    ✅ Dropped old role constraint: ${row.conname}`);
    }

    // Add the new constraint with data_controller included
    await pool.query(`
      ALTER TABLE users 
      ADD CONSTRAINT users_role_check 
      CHECK (role IN ('potraz_assessor','data_protection_officer','system_administrator','data_controller'));
    `);
    console.log('  ✅ Updated user role check constraint');
  } catch (err) {
    // Ignore error if constraint is already correct
    if (err.message && err.message.includes('already exists')) {
      console.log('  ✅ User role check constraint already correct');
    } else {
      console.error('  ⚠️  Update user role check error:', err.message);
    }
  }
}

/**
 * Normalize organization names (trim, remove extra spaces)
 */
async function normalizeOrganizationNames() {
  console.log('  ➜ Normalizing organization names...');
  
  try {
    const tables = [
      'compliance_assessments', 'gap_analysis', 'ropa_records', 'dpia_assessments',
      'security_gap_analysis', 'controller_validations', 'department_assessments',
      'assets', 'kpi_tracking', 'cia_data', 'department_remediation_plans', 'raci_matrix'
    ];
    
    let totalUpdated = 0;
    for (const table of tables) {
      try {
        const result = await pool.query(`
          UPDATE ${table} 
          SET organization_name = TRIM(REGEXP_REPLACE(organization_name, '\\s+', ' ', 'g'))
          WHERE organization_name IS NOT NULL AND organization_name LIKE '%  %' OR organization_name LIKE ' %' OR organization_name LIKE '% '
        `);
        if (result.rowCount > 0) {
          totalUpdated += result.rowCount;
        }
      } catch (e) {
        // Table might not exist yet, skip
      }
    }
    
    if (totalUpdated > 0) {
      console.log(`    ✅ Normalized ${totalUpdated} organization names`);
    }
    console.log('  ✅ Organization names verified');
  } catch (err) {
    console.error('  ⚠️  Normalize org names error:', err.message);
  }
}

/**
 * Sync organization names across all modules
 */
async function syncOrganizationNames() {
  console.log('  ➜ Syncing organization names across modules...');
  
  try {
    // Get distinct org names from assessments
    const distinctOrgs = await pool.query(`
      SELECT DISTINCT LOWER(organization_name) as org_lower, organization_name 
      FROM compliance_assessments 
      WHERE organization_name IS NOT NULL
    `);
    
    if (distinctOrgs.rows.length === 0) {
      console.log('  ✅ No organizations to sync');
      return;
    }
    
    const tables = [
      'gap_analysis', 'ropa_records', 'dpia_assessments', 'security_gap_analysis',
      'controller_validations', 'department_assessments', 'assets', 'kpi_tracking',
      'cia_data', 'department_remediation_plans', 'raci_matrix'
    ];
    
    let totalSynced = 0;
    for (const org of distinctOrgs.rows) {
      for (const table of tables) {
        try {
          const result = await pool.query(
            `UPDATE ${table} SET organization_name = $1 
             WHERE LOWER(organization_name) = $2 AND organization_name != $1`,
            [org.organization_name, org.org_lower]
          );
          totalSynced += result.rowCount;
        } catch (e) {
          // Table might not exist
        }
      }
    }
    
    if (totalSynced > 0) {
      console.log(`    ✅ Synced ${totalSynced} records`);
    }
    console.log('  ✅ Organization names synced');
  } catch (err) {
    console.error('  ⚠️  Sync org names error:', err.message);
  }
}

/**
 * Ensure all admin users exist
 */
async function ensureAdminUsers() {
  console.log('  ➜ Checking admin users...');
  
  try {
    // Define fixed credentials from admin_credentials.txt
    const credentials = [
      { username: 'sysadmin', password: 'Admin123!', role: 'system_administrator', email: 'admin@cdpa.local' },
      { username: 'dpo', password: 'Dpo123!', role: 'data_protection_officer', email: 'dpo@cdpa.local' },
      { username: 'assessor', password: 'Assess123!', role: 'potraz_assessor', email: 'assessor@cdpa.local' },
      { username: 'controller', password: 'Controller123!', role: 'data_controller', email: 'controller@cdpa.local' }
    ];

    for (const cred of credentials) {
      // Check if user exists
      const userCheck = await pool.query(
        "SELECT id, password_hash FROM users WHERE username = $1 LIMIT 1",
        [cred.username]
      );

      if (userCheck.rows.length === 0) {
        // User doesn't exist, create them
        console.log(`    📝 Creating ${cred.role.replace(/_/g, ' ')} account...`);
        const hash = await bcrypt.hash(cred.password, 12);
        
        await pool.query(
          `INSERT INTO users (username, password_hash, role, email, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           ON CONFLICT (username) DO NOTHING`,
          [cred.username, hash, cred.role, cred.email, true]
        );
        
        console.log(`    ✅ ${cred.role.replace(/_/g, ' ')} created (username: ${cred.username}, password: ${cred.password})`);
      } else {
        // User exists, verify password is correct
        const valid = await bcrypt.compare(cred.password, userCheck.rows[0].password_hash);
        if (!valid) {
          // Password is incorrect, update it
          console.log(`    🔄 Updating password for ${cred.username}...`);
          const hash = await bcrypt.hash(cred.password, 12);
          await pool.query(
            "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE username = $2",
            [hash, cred.username]
          );
          console.log(`    ✅ Password updated for ${cred.username}`);
        } else {
          console.log(`    ✅ ${cred.role.replace(/_/g, ' ')} exists and password is correct`);
        }
      }
    }
    
    console.log('  ✅ Admin users verified');
  } catch (err) {
    console.error('  ⚠️  Admin users error:', err.message);
  }
}

/**
 * Main initialization function
 */
async function initializeDatabase() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  CDPA System - Database Initialization                     ║');
  console.log('║  (Runs automatically on server startup)                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n  Starting initialization checks...\n');
  
  try {
    // PHASE 1: Schema initialization
    await initializeSchema();
    
    // PHASE 2: Add missing columns
    await addLicenseNumberFields();
    await addControllerDetailsFields();
    await addCreatedAtColumn();
    await addLicenseManagementFields();
    await addROPAControllerFields();
    await addRegistrationNumberFields();
    await addControllerDetailsToValidations();
    await addDPOFields();
    await addComplianceAttemptTracking();
    await addAssessmentTypeField();
    await addControllerDetailsToOrganizations();
    await updateUserRoleCheckConstraint();
    
    // PHASE 3: Ensure admin users
    await ensureAdminUsers();
    
    // PHASE 4: Data cleanup and normalization
    await normalizeOrganizationNames();
    await syncOrganizationNames();
    
    console.log('\n  ✅ Database initialization complete\n');
    return true;
  } catch (err) {
    console.error('\n  ❌ Database initialization failed:', err.message);
    console.error('\n  Please check your database connection settings in .env file\n');
    return false;
  }
}

/**
 * Health check - ensure database connection works
 */
async function healthCheck() {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    return false;
  }
}

/**
 * Cleanup pool on shutdown
 */
async function shutdown() {
  await pool.end();
}

// ─── EXPORTS ─────────────────────────────────────────
module.exports = {
  initializeDatabase,
  healthCheck,
  shutdown,
  pool
};
