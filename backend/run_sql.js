const fs = require('fs');
const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', port:5432, database:'cdpa_system', user:'postgres', password:'masie*03e' });

async function run() {
  const sql = fs.readFileSync('add_tables.sql', 'utf8');
  await pool.query(sql);
  console.log('Tables added successfully');
  await pool.end();
}
run().catch(console.error);
