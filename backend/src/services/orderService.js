// ============================================================================
// VOLKSCHEM OMS — Order Service
// ============================================================================

const supabase = require('../config/db');

/**
 * Get all orders.
 * Factory role: stripped view (no financial data).
 * Admin/Employee: full view.
 */
async function getOrders(userRole, filters = {}) {
    const selectFields = userRole === 'factory_admin'
    ? `
        id, current_status, factory_note, dispatch_note, dispatched_at,
        created_at, updated_at, lr_attachments ( id, file_url ),
        quotations!inner (
          id, quotation_number, order_type, customer_name, name_on_label, billing_name,
          employee_name, product_order_type, admin_note, status,
          quotation_rows (
            id, packing_type, pack_size_value, pack_size_unit,
            total_pcs, total_ltr_kg, total_cases, nos_per_carton,
            products ( id, product_name, technical_combination )
          )
        )
      `
    : `
        id, current_status, factory_note, dispatch_note, dispatched_at,
        created_at, updated_at, lr_attachments ( id, file_url ),
        quotations (
          id, quotation_number, order_type, product_order_type,
          customer_name, employee_name, grand_total, subtotal, total_gst,
          status, billing_address, destination, transport_name, admin_note, name_on_label, billing_name,
          quotation_rows (
            id, packing_type, pack_size_value, pack_size_unit,
            total_pcs, total_ltr_kg, total_cases, nos_per_carton,
            cost_per_pcs, mrp, row_amount, row_total_with_gst, gst_amount, bulk_rate_per_ltr_kg, bulk_material_cost_per_pcs,
            products ( id, product_name, technical_combination )
          )
        )
      `;

  let query = supabase
    .from('orders')
    .select(selectFields)
    .order('created_at', { ascending: false });

  if (userRole === 'factory_admin') {
    // Explicitly filter out draft/pending from joined quotations just in case
    query = query.in('quotations.status', ['approved']);
    query = query.in('current_status', ['confirmed', 'in_production', 'quality_check', 'packing', 'ready_to_dispatch', 'dispatched']);
  }

  if (filters.status) query = query.eq('current_status', filters.status);
  if (filters.from_date) query = query.gte('created_at', filters.from_date);
  if (filters.to_date) query = query.lte('created_at', filters.to_date);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Update order status (factory_admin).
 * Valid transitions: confirmed → in_production → ready_to_dispatch → dispatched
 */
async function updateOrderStatus(orderId, newStatus, note, updatedBy) {
  const validStatuses = ['confirmed', 'in_production', 'quality_check', 'packing', 'ready_to_dispatch', 'dispatched'];
  if (!validStatuses.includes(newStatus)) {
    throw Object.assign(new Error(`Invalid status: ${newStatus}`), { statusCode: 400 });
  }

  // Fetch current order
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, current_status')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) {
    throw Object.assign(new Error('Order not found.'), { statusCode: 404 });
  }

  // Validate status transition
  const currentIdx = validStatuses.indexOf(order.current_status);
  const newIdx = validStatuses.indexOf(newStatus);

  if (newIdx <= currentIdx) {
    throw Object.assign(
      new Error(`Cannot move from "${order.current_status}" to "${newStatus}". Status can only move forward.`),
      { statusCode: 400 }
    );
  }

  // Update order
  const updateData = { current_status: newStatus };
  if (newStatus === 'dispatched') {
    updateData.dispatched_at = new Date().toISOString();
    updateData.dispatch_note = note || null;
  } else {
    updateData.factory_note = note || null;
  }

  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .select('id, current_status, factory_note, dispatch_note, dispatched_at, quotation_id')
    .single();

  if (updateError) throw updateError;

  // Deduct label inventory if dispatched
  if (newStatus === 'dispatched' && updated.quotation_id) {
    const pmService = require('./pmService');
    const { data: quotation } = await supabase.from('quotations').select('customer_id').eq('id', updated.quotation_id).single();
    
    if (quotation && quotation.customer_id) {
      const { data: rows } = await supabase.from('quotation_rows').select('id, product_id, pack_size_value, pack_size_unit, total_pcs, packing_type').eq('quotation_id', updated.quotation_id);
      
      if (rows && rows.length > 0) {
        for (const row of rows) {
          // Deduct regardless of whether the label was checked in this specific quotation
          const packSizeStr = `${row.pack_size_value}${row.pack_size_unit}`;
          try {
            await pmService.deductPMStock(
              quotation.customer_id, 
              row.product_id, 
              packSizeStr, 
              row.total_pcs
            );
          } catch (err) {
            console.error(`Failed to deduct label inventory for order ${orderId}, row ${row.id}:`, err);
          }
        }
      }
    }
  }

  // Log progress
  await supabase.from('order_progress').insert({
    order_id: orderId,
    status: newStatus,
    updated_by: updatedBy,
    notes: note || null,
  });

  return updated;
}

/**
 * Upload LR attachment.
 */
async function uploadLR(orderId, file, uploadedBy) {
  // Verify order exists
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) {
    throw Object.assign(new Error('Order not found.'), { statusCode: 404 });
  }

  // Upload file to Supabase Storage
  const fileName = `lr/${orderId}/${Date.now()}_${file.originalname}`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('attachments')
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw Object.assign(new Error(`File upload failed: ${uploadError.message}`), { statusCode: 500 });
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('attachments')
    .getPublicUrl(fileName);

  const fileUrl = urlData?.publicUrl || fileName;

  // Save record
  const { data: attachment, error: insertError } = await supabase
    .from('lr_attachments')
    .insert({
      order_id: orderId,
      file_name: file.originalname,
      file_url: fileUrl,
      file_type: file.mimetype,
      uploaded_by: uploadedBy,
    })
    .select('*')
    .single();

  if (insertError) throw insertError;
  return attachment;
}

/**
 * Get LR attachments for an order.
 */
async function getLRAttachments(orderId, userId, userRole) {
  // Verify access — admin can see all, employee only if it's their quotation's order
  if (userRole === 'employee') {
    const { data: order } = await supabase
      .from('orders')
      .select('quotations (created_by)')
      .eq('id', orderId)
      .single();

    if (!order || order.quotations?.created_by !== userId) {
      throw Object.assign(new Error('Access denied.'), { statusCode: 403 });
    }
  }

  const { data, error } = await supabase
    .from('lr_attachments')
    .select('*')
    .eq('order_id', orderId)
    .order('uploaded_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

async function deleteLRAttachments(orderId) {
  // Fetch attachments to get file URLs
  const { data: attachments } = await supabase
    .from('lr_attachments')
    .select('id, file_url')
    .eq('order_id', orderId);

  if (attachments && attachments.length > 0) {
    const filePaths = attachments.map(a => {
      const parts = a.file_url.split('/attachments/');
      return parts.length > 1 ? parts[1] : null;
    }).filter(Boolean);

    if (filePaths.length > 0) {
      await supabase.storage.from('attachments').remove(filePaths);
    }
  }

  // Delete records from database
  const { error } = await supabase
    .from('lr_attachments')
    .delete()
    .eq('order_id', orderId);

  if (error) throw error;

  return { success: true };
}

async function updateOrderNote(orderId, note) {
  const { data, error } = await supabase
    .from('orders')
    .update({ factory_note: note || null })
    .eq('id', orderId)
    .select('id, factory_note')
    .single();

  if (error) throw error;
  return data;
}

async function getOrderProgress(orderId) {
  const { data, error } = await supabase
    .from('order_progress')
    .select(`
      id, status, note, created_at,
      users:updated_by ( full_name )
    `)
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  // Format response
  return (data || []).map(p => ({
    id: p.id,
    status: p.status,
    note: p.note,
    created_at: p.created_at,
    updated_by_name: p.users?.full_name || 'System'
  }));
}

async function deleteOrder(orderId) {
  // Fetch quotation_id and lr_attachments before deleting
  const { data: order } = await supabase
    .from('orders')
    .select('quotation_id, lr_attachments(file_url)')
    .eq('id', orderId)
    .single();

  if (order && order.lr_attachments && order.lr_attachments.length > 0) {
    const filePaths = order.lr_attachments.map(a => {
      const parts = a.file_url.split('/attachments/');
      return parts.length > 1 ? parts[1] : null;
    }).filter(Boolean);

    if (filePaths.length > 0) {
      await supabase.storage.from('attachments').remove(filePaths);
    }
  }

  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId);

  if (error) throw error;

  // Cascade delete quotation
  if (order && order.quotation_id) {
    await supabase.from('quotations').delete().eq('id', order.quotation_id);
  }

  return { success: true };
}

module.exports = {
  getOrders,
  updateOrderStatus,
  uploadLR,
  getLRAttachments,
  updateOrderNote,
  getOrderProgress,
  deleteOrder,
  deleteLRAttachments,
};
