const { Client } = require('pg');
const connectionString = 'postgresql://postgres.ktdoqvxwuapgcbzygaqc:Volkschem2024!@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres';

async function addColumn() {
  const client = new Client({ connectionString });
  await client.connect();
  
  try {
    await client.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name TEXT;`);
    console.log('Successfully added company_name column to customers table.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

addColumn();
