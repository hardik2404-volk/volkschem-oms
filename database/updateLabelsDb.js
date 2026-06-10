require('dotenv').config({ path: require('path').resolve(__dirname, '../backend/.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10) || 6543,
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  console.log('Connected. Running Label Inventory DB updates...');
  
  try {
    await client.query('BEGIN');
    
    // 1. Add missing columns
    await client.query(`
      ALTER TABLE label_inventory 
      ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id),
      ADD COLUMN IF NOT EXISTS brand_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS rate_per_label DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS open_stock INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS make_quantity INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS gst_amount DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT 0;
    `);
    console.log('Columns added to label_inventory.');

    // 2. Fix closing_stock
    await client.query(`
      UPDATE label_inventory 
      SET closing_stock = total_printed - used_to_date
      WHERE closing_stock > total_printed OR closing_stock < 0;
    `);
    console.log('Fixed closing_stock.');

    // 3. Delete corrupted
    const res = await client.query(`DELETE FROM label_inventory WHERE closing_stock > 100000;`);
    console.log(`Deleted ${res.rowCount} corrupted records.`);

    // 4. Create label_quotation_snapshots
    await client.query(`
      CREATE TABLE IF NOT EXISTS label_quotation_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
        row_index INTEGER NOT NULL DEFAULT 0,
        customer_id UUID REFERENCES customers(id),
        product_id UUID REFERENCES products(id),
        pack_size VARCHAR(20) NOT NULL,
        pack_type VARCHAR(50),
        brand_name VARCHAR(100),
        open_stock INTEGER DEFAULT 0,
        make_quantity INTEGER DEFAULT 0,
        total_stock INTEGER DEFAULT 0,
        used_pcs INTEGER DEFAULT 0,
        closing_stock_after INTEGER DEFAULT 0,
        rate_per_label DECIMAL(10,2) DEFAULT 0,
        amount DECIMAL(10,2) DEFAULT 0,
        gst_amount DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) DEFAULT 0,
        is_new_batch BOOLEAN DEFAULT false,
        include_in_quotation BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Table label_quotation_snapshots verified/created.');

    // Wait, the disableRLS script also disabled RLS on some tables. Let's make sure it's disabled for label_quotation_snapshots.
    await client.query(`ALTER TABLE label_quotation_snapshots DISABLE ROW LEVEL SECURITY`);

    await client.query('COMMIT');
    console.log('SUCCESS!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
