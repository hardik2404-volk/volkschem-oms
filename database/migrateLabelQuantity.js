require('dotenv').config({ path: require('path').resolve(__dirname, '../backend/.env') });
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const DB_HOST = process.env.DB_HOST;
const DB_PORT = process.env.DB_PORT;
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;

const poolConfig = DATABASE_URL
  ? { connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } }
  : {
      host: DB_HOST, port: parseInt(DB_PORT, 10) || 6543,
      database: DB_NAME || 'postgres', user: DB_USER, password: DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
    };

const pool = new Pool(poolConfig);

async function migrate() {
  console.log('🔌 Connecting to database...');
  try {
    const sql = `
      ALTER TABLE quotation_components 
      ADD COLUMN IF NOT EXISTS label_quantity INTEGER;
    `;
    
    await pool.query(sql);
    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Failed to apply migration:', error);
  } finally {
    await pool.end();
  }
}

migrate();
