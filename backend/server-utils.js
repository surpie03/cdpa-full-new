/**
 * Server Utilities - Shared across backend modules
 * Exports database pool and audit logging function
 */

const { Pool } = require('pg');

// Database connection pool
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

// Audit logging function
const auditLog = async (userId, action, resource, details = {}, ip = null) => {
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, resource, details, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [userId, action, resource, JSON.stringify(details), ip]
    );
  } catch (e) {
    console.error('Audit log write error:', e.message);
  }
};

module.exports = {
  pool,
  auditLog
};
