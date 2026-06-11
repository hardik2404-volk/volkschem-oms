require('dotenv').config({ path: '../backend/.env' });
const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();

    const sql = `
      -- 1. Rename tables
      ALTER TABLE IF EXISTS label_inventory RENAME TO pm_inventory;
      ALTER TABLE IF EXISTS label_transactions RENAME TO pm_transactions;
      ALTER TABLE IF EXISTS label_quotation_snapshots RENAME TO pm_quotation_snapshots;

      -- 2. Rename columns in pm_inventory
      DO $$
      BEGIN
        IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='pm_inventory' AND column_name='rate_per_label') THEN
          ALTER TABLE pm_inventory RENAME COLUMN rate_per_label TO rate_per_pm;
        END IF;
      END $$;

      -- 3. Rename columns in quotation_components (if exists)
      DO $$
      BEGIN
        IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='quotation_components' AND column_name='label_quantity') THEN
          ALTER TABLE quotation_components RENAME COLUMN label_quantity TO pm_quantity;
        END IF;
      END $$;

      -- 4. Rename columns in quotation_rows (if exists)
      DO $$
      BEGIN
        IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='quotation_rows' AND column_name='label_snapshot') THEN
          ALTER TABLE quotation_rows RENAME COLUMN label_snapshot TO pm_snapshot;
        END IF;
      END $$;
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
