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
      CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_name VARCHAR(100) NOT NULL,
        company_name VARCHAR(100),
        contact_number VARCHAR(15),
        gst_pan VARCHAR(20),
        billing_address TEXT,
        billing_name VARCHAR(100),
        transport_name VARCHAR(100),
        destination TEXT,
        label_company_name VARCHAR(100),
        created_by UUID REFERENCES users(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE label_inventory 
      ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id),
      ADD COLUMN IF NOT EXISTS brand_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS rate_per_label DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS gst_amount DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT 0;

      ALTER TABLE quotations 
      ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
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
