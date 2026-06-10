const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
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

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('Migration failed via exec_sql:', error.message);
    console.log('Ensure you have exec_sql RPC function created, or run this SQL manually in Supabase SQL editor.');
  } else {
    console.log('Migration successful.');
  }
}

run();
