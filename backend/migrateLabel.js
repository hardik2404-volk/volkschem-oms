require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();

    const sql = `
      -- 1. Update label_inventory
      ALTER TABLE label_inventory 
        ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id),
        ADD COLUMN IF NOT EXISTS brand_name VARCHAR(100),
        ADD COLUMN IF NOT EXISTS rate_per_label DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS open_stock INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS make_quantity INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS gst_amount DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT 0;
        
      -- 2. Update quotations
      ALTER TABLE quotations
        ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
        
      -- 3. Update quotation_components
      ALTER TABLE quotation_components
        ADD COLUMN IF NOT EXISTS label_quantity INTEGER DEFAULT 0;

      -- 4. Update quotation_rows
      ALTER TABLE quotation_rows
        ADD COLUMN IF NOT EXISTS label_snapshot JSONB;
    `;

    await client.query(sql);
    console.log('Migration successful.');
  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    await client.end();
  }
}

run();
