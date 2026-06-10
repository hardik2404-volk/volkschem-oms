const supabase = require('../config/db');

async function getAllCustomers(filters = {}) {
  let query = supabase.from('customers').select('*').order('customer_name');
  if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function getCustomerById(id) {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function createCustomer(customerData, userId) {
  const { data, error } = await supabase
    .from('customers')
    .insert({ ...customerData, created_by: userId })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function updateCustomer(id, updates) {
  const { data, error } = await supabase
    .from('customers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function deleteCustomer(id) {
  const { error } = await supabase.from('customers').update({ is_active: false }).eq('id', id);
  if (error) throw error;
}

async function getCustomerHistory(customerId) {
  // Fetch quotations and their rows for this customer (only approved/active orders)
  const { data: quotations, error } = await supabase
    .from('quotations')
    .select(`
      id, quotation_number, quotation_date, created_at, status, order_type,
      quotation_rows (
        id, pack_size_value, pack_size_unit, total_quantity_ltr_kg,
        products ( product_name, product_code )
      )
    `)
    .eq('customer_id', customerId)
    .not('status', 'in', '("draft","pending","rejected")')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const history = [];
  
  for (const q of quotations) {
    if (q.quotation_rows && q.quotation_rows.length > 0) {
      for (const row of q.quotation_rows) {
        history.push({
          id: row.id,
          quotation_id: q.id,
          date: q.quotation_date || q.created_at,
          quotation_number: q.quotation_number,
          status: q.status,
          product_name: row.products?.product_name || (q.order_type === 'bulk' ? 'Bulk Order' : 'Unknown Product'),
          product_code: row.products?.product_code || '-',
          quantity: row.total_quantity_ltr_kg || row.pack_size_value || '-',
          quantity_unit: row.total_quantity_ltr_kg ? (row.pack_size_unit === 'gm' || row.pack_size_unit === 'kg' ? 'KG' : 'LTR') : (row.pack_size_unit || '')
        });
      }
    } else {
      history.push({
        id: q.id,
        quotation_id: q.id,
        date: q.quotation_date || q.created_at,
        quotation_number: q.quotation_number,
        status: q.status,
        product_name: q.order_type === 'bulk' ? 'Bulk Order' : 'Unknown Product',
        product_code: '-',
        quantity: '-',
        quantity_unit: ''
      });
    }
  }

  return history;
}

module.exports = {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerHistory,
};
