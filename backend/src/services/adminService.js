// ============================================================================
// VOLKSCHEM OMS — Admin Service
// ============================================================================

const bcrypt = require('bcryptjs');
const supabase = require('../config/db');

const SALT_ROUNDS = 12;

// ── Staff Management ────────────────────────────────────────────────────────

async function getAllStaff() {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, role, full_name, phone, joining_date, is_active, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

async function createStaff({ username, password, role, full_name, phone, joining_date }, createdBy) {
  // Check duplicate username
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (existing) {
    throw Object.assign(new Error('Username already exists.'), { statusCode: 409 });
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const { data, error } = await supabase
    .from('users')
    .insert({
      username,
      password_hash,
      role,
      full_name,
      phone: phone || null,
      joining_date: joining_date || new Date().toISOString().split('T')[0],
      created_by: createdBy,
    })
    .select('id, username, role, full_name, phone, joining_date, is_active, created_at')
    .single();

  if (error) throw error;
  return data;
}

async function updateStaff(id, updates) {
  const allowed = ['full_name', 'phone', 'role', 'joining_date'];
  const cleaned = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) cleaned[key] = updates[key];
  }

  if (Object.keys(cleaned).length === 0) {
    throw Object.assign(new Error('No valid fields to update.'), { statusCode: 400 });
  }

  const { data, error } = await supabase
    .from('users')
    .update(cleaned)
    .eq('id', id)
    .select('id, username, role, full_name, phone, joining_date, is_active, updated_at')
    .single();

  if (error) throw error;
  if (!data) throw Object.assign(new Error('User not found.'), { statusCode: 404 });
  return data;
}

async function resetPassword(id, newPassword) {
  const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  const { data, error } = await supabase
    .from('users')
    .update({ password_hash })
    .eq('id', id)
    .select('id, username, full_name')
    .single();

  if (error) throw error;
  if (!data) throw Object.assign(new Error('User not found.'), { statusCode: 404 });
  return data;
}

async function toggleStatus(id) {
  // Get current status
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id, is_active, role')
    .eq('id', id)
    .single();

  if (fetchError || !user) {
    throw Object.assign(new Error('User not found.'), { statusCode: 404 });
  }

  // Prevent deactivating the last admin
  if (user.is_active && user.role === 'admin') {
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .eq('is_active', true);

    if (admins && admins.length <= 1) {
      throw Object.assign(new Error('Cannot deactivate the last active admin.'), { statusCode: 400 });
    }
  }

  const { data, error } = await supabase
    .from('users')
    .update({ is_active: !user.is_active })
    .eq('id', id)
    .select('id, username, full_name, is_active')
    .single();

  if (error) throw error;
  return data;
}

async function deleteStaff(id, adminId) {
  // Prevent deleting the last admin
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', id)
    .single();

  if (fetchError || !user) {
    throw Object.assign(new Error('User not found.'), { statusCode: 404 });
  }

  if (user.role === 'admin') {
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin');

    if (admins && admins.length <= 1) {
      throw Object.assign(new Error('Cannot delete the last admin.'), { statusCode: 400 });
    }
  }

  // To forcefuly delete, we must reassign all their historical records (quotations, orders, etc.)
  // to the admin performing the deletion to prevent foreign key constraint failures.
  if (adminId && adminId !== id) {
    const tablesAndCols = [
      { table: 'users', col: 'created_by' },
      { table: 'products', col: 'created_by' },
      { table: 'bulk_prices', col: 'updated_by' },
      { table: 'cost_sheet_rates', col: 'updated_by' },
      { table: 'quotations', col: 'created_by' },
      { table: 'quotations', col: 'confirmed_by' },
      { table: 'pm_transactions', col: 'created_by' },
      { table: 'orders', col: 'confirmed_by' },
      { table: 'order_progress', col: 'updated_by' },
      { table: 'lr_attachments', col: 'uploaded_by' },
      { table: 'login_logs', col: 'user_id' }
    ];

    for (const { table, col } of tablesAndCols) {
      await supabase.from(table).update({ [col]: adminId }).eq(col, id);
    }
  }

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);

  if (error) {
    throw error;
  }
  
  return { id };
}

// ── Login Logs ──────────────────────────────────────────────────────────────

async function getLoginLogs(filters = {}) {
  let query = supabase
    .from('login_logs')
    .select('id, username_attempted, user_id, ip_address, success, failure_reason, created_at, users(role)')
    .order('created_at', { ascending: false })
    .limit(filters.limit || 100);

  if (filters.username) {
    query = query.eq('username_attempted', filters.username);
  }
  if (filters.success !== undefined) {
    query = query.eq('success', filters.success);
  }
  if (filters.from_date) {
    query = query.gte('created_at', filters.from_date);
  }
  if (filters.to_date) {
    query = query.lte('created_at', filters.to_date);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function clearLoginLogs() {
  const { error } = await supabase.from('login_logs').delete().not('id', 'is', null);
  if (error) throw error;
}

// ── Dashboard ───────────────────────────────────────────────────────────────

async function getDashboardStats() {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.substring(0, 8) + '01';

  // Quotations created today
  const { count: quotationsToday } = await supabase
    .from('quotations')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', today + 'T00:00:00')
    .lte('created_at', today + 'T23:59:59');

  // Pending approvals
  const { count: pendingApprovals } = await supabase
    .from('quotations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  // Month revenue (sum of grand_total for approved quotations this month)
  const { data: revenueData } = await supabase
    .from('quotations')
    .select('grand_total')
    .eq('status', 'approved')
    .gte('created_at', monthStart + 'T00:00:00');

  const monthRevenue = (revenueData || []).reduce(
    (sum, q) => sum + (parseFloat(q.grand_total) || 0), 0
  );

  // Active salesmen (employees)
  const { count: activeSalesmen } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'employee')
    .eq('is_active', true);

  // Recent quotations
  const { data: recentQuotations } = await supabase
    .from('quotations')
    .select('id, quotation_number, customer_name, status, grand_total, order_type, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  // Order pipeline
  const statuses = ['confirmed', 'in_production', 'ready_to_dispatch', 'dispatched'];
  const pipeline = {};
  for (const status of statuses) {
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('current_status', status);
    pipeline[status] = count || 0;
  }

  return {
    quotations_today: quotationsToday || 0,
    pending_approvals: pendingApprovals || 0,
    month_revenue: monthRevenue,
    active_salesmen: activeSalesmen || 0,
    recent_quotations: recentQuotations || [],
    order_pipeline: pipeline,
  };
}

// ── All Orders (Admin View) ─────────────────────────────────────────────────

async function getAllOrders(filters = {}) {
  let query = supabase
    .from('orders')
    .select(`
      id, current_status, factory_note, dispatch_note, dispatched_at, created_at, updated_at,
      quotations (
        id, quotation_number, order_type, product_order_type, customer_name,
        employee_name, grand_total, subtotal, total_gst, status, transport_name, destination, created_at,
        quotation_rows ( product_id, packing_type, products ( product_name, product_code ) )
      ),
      lr_attachments ( id, file_url )
    `)
    .order('created_at', { ascending: false });

  if (filters.status) {
    query = query.eq('current_status', filters.status);
  }
  if (filters.from_date) {
    query = query.gte('created_at', filters.from_date);
  }
  if (filters.to_date) {
    query = query.lte('created_at', filters.to_date);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Filter by salesman name or order type client-side (Supabase nested filter limitation)
  let results = data || [];
  if (filters.salesman) {
    results = results.filter((o) =>
      o.quotations?.employee_name?.toLowerCase().includes(filters.salesman.toLowerCase())
    );
  }
  if (filters.order_type) {
    results = results.filter((o) => o.quotations?.order_type === filters.order_type);
  }

  return results;
}

module.exports = {
  getAllStaff,
  createStaff,
  updateStaff,
  resetPassword,
  toggleStatus,
  deleteStaff,
  getLoginLogs,
  clearLoginLogs,
  getDashboardStats,
  getAllOrders,
};
