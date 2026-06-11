// ============================================================================
// VOLKSCHEM OMS — Quotation Service
// ============================================================================

const supabase = require('../config/db');

// ── Quotation Number Generator ──────────────────────────────────────────────

async function generateQuotationNumber() {
  const year = new Date().getFullYear();
  const prefix = `VCS-${year}-`;

  // Get the latest quotation number for this year
  const { data } = await supabase
    .from('quotations')
    .select('quotation_number')
    .like('quotation_number', `${prefix}%`)
    .order('quotation_number', { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (data && data.length > 0) {
    const lastNum = parseInt(data[0].quotation_number.replace(prefix, ''), 10);
    nextNum = lastNum + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

// ── Get Quotations ──────────────────────────────────────────────────────────

async function getQuotations(userId, userRole, filters = {}) {
  let query = supabase
    .from('quotations')
    .select(`
      id, quotation_number, version, order_type, product_order_type,
      status, employee_name, customer_name, customer_contact,
      quotation_date, grand_total, subtotal, total_gst,
      admin_note, rejection_comment, created_at, updated_at,
      orders ( id, current_status, dispatched_at, lr_attachments ( id, file_url ) ),
      quotation_rows ( product_id, packing_type, products ( product_name, product_code ) )
    `)
    .order('created_at', { ascending: false });

  // Employee sees only their own quotations
  if (userRole === 'employee') {
    query = query.eq('created_by', userId);
  } else if (userRole === 'admin') {
    // Admins see all quotations except drafts created by others
    query = query.or(`status.neq.draft,created_by.eq.${userId}`);
  }

  // Apply filters
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.order_type) query = query.eq('order_type', filters.order_type);
  if (filters.product_order_type) query = query.eq('product_order_type', filters.product_order_type);
  if (filters.from_date) query = query.gte('created_at', filters.from_date);
  if (filters.to_date) query = query.lte('created_at', filters.to_date);
  if (filters.customer_name) query = query.ilike('customer_name', `%${filters.customer_name}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ── Get Quotation Detail ────────────────────────────────────────────────────

async function getQuotationById(id, userId, userRole) {
  const { data: quotation, error } = await supabase
    .from('quotations')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !quotation) {
    throw Object.assign(new Error('Quotation not found.'), { statusCode: 404 });
  }

  // Employee can only see own quotations
  if (userRole === 'employee' && quotation.created_by !== userId) {
    throw Object.assign(new Error('Access denied.'), { statusCode: 403 });
  }

  // Fetch rows
  const { data: rows } = await supabase
    .from('quotation_rows')
    .select('*, products(*)')
    .eq('quotation_id', id)
    .order('row_number');

  // Fetch components and label data for each row
  const rowsWithComponents = [];
  for (const row of (rows || [])) {
    const { data: components } = await supabase
      .from('quotation_components')
      .select('*')
      .eq('row_id', row.id)
      .order('sort_order');

    let labelData = null;
    if (row.product_id && row.packing_type) {
      const { data: labelSnap } = await supabase
        .from('label_quotation_snapshots')
        .select('*')
        .eq('quotation_id', id)
        .eq('product_id', row.product_id)
        .eq('pack_size', row.pack_size_value + row.pack_size_unit)
        .maybeSingle();
      if (labelSnap) {
        // Map snapshot fields to the legacy structure so PDF generation works without rewriting everything
        labelData = {
          brand_name: labelSnap.brand_name,
          pack_type: labelSnap.pack_type,
          pack_size: labelSnap.pack_size,
          open_stock: labelSnap.open_stock,
          make_quantity: labelSnap.make_quantity,
          total_stock: labelSnap.total_stock,
          used_to_date: labelSnap.used_pcs,
          closing_stock: labelSnap.closing_stock_after,
          rate_per_label: labelSnap.rate_per_label,
          total_amount: labelSnap.total_amount,
          gst_amount: labelSnap.gst_amount,
          current_batch_amount: labelSnap.amount,
          current_batch_gst: labelSnap.gst_amount,
          current_batch_total: labelSnap.total_amount,
          current_total_stock: labelSnap.total_stock,
          is_new_batch: labelSnap.is_new_batch,
          include_in_quotation: labelSnap.include_in_quotation,
          withoutLabel: labelSnap.without_label
        };
      }
    }

    rowsWithComponents.push({ ...row, components: components || [], label_snapshot: labelData });
  }

  return { ...quotation, rows: rowsWithComponents };
}

// ── Create Quotation ────────────────────────────────────────────────────────

async function createQuotation(quotationData, userId) {
  const quotation_number = await generateQuotationNumber();

  let finalCustomerId = quotationData.customer_id || null;

  if (quotationData.save_to_directory && !finalCustomerId) {
    const { data: newCust, error: custErr } = await supabase.from('customers').insert({
      customer_name: quotationData.customer_name,
      contact_number: quotationData.customer_contact || null,
      gst_pan: quotationData.gst_pan || null,
      billing_address: quotationData.billing_address || null,
      billing_name: quotationData.billing_name || null,
      transport_name: quotationData.transport_name || null,
      destination: quotationData.destination || null,
      label_company_name: quotationData.label_company_name || null,
      created_by: userId
    }).select('id').single();
    if (custErr) console.error('Failed to save customer:', custErr);
    else finalCustomerId = newCust.id;
  }

  // Insert quotation header
  const { data: quotation, error } = await supabase
    .from('quotations')
    .insert({
      quotation_number,
      order_type: quotationData.order_type,
      product_order_type: quotationData.product_order_type || null,
      status: quotationData.status || 'draft',
      created_by: userId,
      customer_id: finalCustomerId,
      product_id: quotationData.product_id || null,
      employee_name: quotationData.employee_name || null,
      customer_name: quotationData.customer_name,
      customer_contact: quotationData.customer_contact || null,
      gst_pan: quotationData.gst_pan || null,
      billing_address: quotationData.billing_address || null,
      billing_name: quotationData.billing_name || null,
      transport_name: quotationData.transport_name || null,
      destination: quotationData.destination || null,
      label_company_name: quotationData.label_company_name || null,
      name_on_label: quotationData.name_on_label || null,
      quotation_date: quotationData.quotation_date || new Date().toISOString().split('T')[0],
      notes: quotationData.notes || null,
      subtotal: quotationData.subtotal || 0,
      total_gst: quotationData.total_gst || 0,
      grand_total: quotationData.grand_total || 0,
    })
    .select('*')
    .single();

  if (error) throw error;

  // Insert rows if provided
  if (quotationData.rows && quotationData.rows.length > 0) {
    for (const rowData of quotationData.rows) {
      const { data: row, error: rowError } = await supabase
        .from('quotation_rows')
        .insert({
          quotation_id: quotation.id,
          product_id: rowData.product_id || quotationData.product_id || null,
          row_number: rowData.row_number,
          packing_type: rowData.packing_type,
          container_variant: rowData.container_variant || null,
          pack_size_value: rowData.pack_size_value,
          pack_size_unit: rowData.pack_size_unit,
          bulk_rate_per_ltr_kg: rowData.bulk_rate_per_ltr_kg,
          bulk_material_cost_per_pcs: rowData.bulk_material_cost_per_pcs,
          total_quantity_ltr_kg: rowData.total_quantity_ltr_kg,
          total_pcs: rowData.total_pcs,
          nos_per_carton: rowData.nos_per_carton || null,
          total_cases: rowData.total_cases || null,
          mrp: rowData.mrp || null,
          gst_rate: rowData.gst_rate,
          cost_per_pcs: rowData.cost_per_pcs,
          row_amount: rowData.row_amount,
          gst_amount: rowData.gst_amount,
          row_total_with_gst: rowData.row_total_with_gst,
          pack_wise_ltr_kg: rowData.pack_wise_ltr_kg || null,
          total_ltr_kg: rowData.total_ltr_kg || null,
        })
        .select('id')
        .single();

      if (rowError) throw rowError;

      // Insert components for this row
      if (rowData.components && rowData.components.length > 0) {
        const components = rowData.components.map((c, idx) => ({
          row_id: row.id,
          component_name: c.component_name,
          is_checked: c.is_checked !== undefined ? c.is_checked : true,
          is_custom: c.is_custom || false,
          default_rate: c.default_rate || null,
          applied_rate: c.applied_rate,
          cost_per_pcs: c.cost_per_pcs,
          label_quantity: c.label_quantity || null,
          sort_order: c.sort_order || idx + 1,
        }));

        const { error: compError } = await supabase
          .from('quotation_components')
          .insert(components);

        if (compError) throw compError;
      }
    }
  }

  // --- LABEL INVENTORY INTEGRATION ---

  const labelService = require('./labelService');

  for (const labelData of quotationData.labelDataArray || []) {
    if (!labelData.customerId || !labelData.productId) continue;
    
    let snapshot;
    
    if (labelData.isNewBatch) {
      // Calculate snapshot without mutating DB
      snapshot = await labelService.calculateLabelSnapshot({
        customerId: labelData.customerId,
        productId: labelData.productId,
        packSize: labelData.packSize,
        packType: labelData.packType,
        brandName: labelData.brandName,
        batchQuantity: labelData.batchQuantity,
        ratePerLabel: labelData.ratePerLabel,
        usedPcs: labelData.usedPcs
      });
    } else {
      // No new batch — just get current stock for snapshot
      const stockInfo = await labelService.checkLabelStock(
        labelData.customerId, labelData.productId, 
        labelData.packSize, labelData.usedPcs
      );
      snapshot = {
        openStock: stockInfo.currentStock,
        make: 0,
        totalStock: stockInfo.currentStock,
        used: labelData.usedPcs,
        closingStock: stockInfo.currentStock - labelData.usedPcs,
        rate: 0, amount: 0, gst: 0, totalAmount: 0
      };
    }
    
    // Save snapshot for PDF generation
    await supabase.from('label_quotation_snapshots').insert({
      quotation_id: quotation.id,
      row_index: labelData.rowIndex,
      customer_id: labelData.customerId,
      product_id: labelData.productId,
      pack_size: labelData.packSize,
      pack_type: labelData.packType,
      brand_name: labelData.brandName,
      open_stock: snapshot.openStock,
      make_quantity: snapshot.make,
      total_stock: snapshot.totalStock,
      used_pcs: snapshot.used,
      closing_stock_after: snapshot.closingStock,
      rate_per_label: snapshot.rate,
      amount: snapshot.amount,
      gst_amount: snapshot.gst,
      total_amount: snapshot.totalAmount,
      is_new_batch: labelData.isNewBatch,
      include_in_quotation: labelData.includeInQuotation,
      without_label: labelData.withoutLabel || false
    });
    
    // The frontend payload already includes the label cost in subtotal, totalGst, and grandTotal.
    // We do NOT add it again to prevent double counting.
  }

  return { ...quotation, quotation_number };
}

// ── Update Quotation ────────────────────────────────────────────────────────

async function updateQuotation(id, updates, userId, userRole) {
  // Fetch existing
  const { data: existing, error: fetchError } = await supabase
    .from('quotations')
    .select('id, status, created_by, version')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    throw Object.assign(new Error('Quotation not found.'), { statusCode: 404 });
  }

  // Only draft or rejected quotations can be edited
  if (!['draft', 'rejected'].includes(existing.status)) {
    throw Object.assign(
      new Error(`Cannot edit quotation in "${existing.status}" status.`),
      { statusCode: 400 }
    );
  }

  // Employee can only edit own
  if (userRole === 'employee' && existing.created_by !== userId) {
    throw Object.assign(new Error('Access denied.'), { statusCode: 403 });
  }

  // Increment version
  const newVersion = existing.version + 1;

  // Build header update
  const headerFields = [
    'customer_name', 'customer_contact', 'gst_pan', 'billing_address',
    'billing_name', 'transport_name', 'destination', 'label_company_name',
    'name_on_label', 'quotation_date', 'notes', 'employee_name',
    'product_id', 'product_order_type', 'subtotal', 'total_gst', 'grand_total', 'customer_id'
  ];
  const headerUpdate = { version: newVersion, status: updates.status || existing.status };
  
  let finalCustomerId = updates.customer_id || existing.customer_id || null;
  if (updates.save_to_directory && !finalCustomerId) {
    const { data: newCust, error: custErr } = await supabase.from('customers').insert({
      customer_name: updates.customer_name || existing.customer_name,
      contact_number: updates.customer_contact || existing.customer_contact || null,
      gst_pan: updates.gst_pan || existing.gst_pan || null,
      billing_address: updates.billing_address || existing.billing_address || null,
      billing_name: updates.billing_name || existing.billing_name || null,
      transport_name: updates.transport_name || existing.transport_name || null,
      destination: updates.destination || existing.destination || null,
      label_company_name: updates.label_company_name || existing.label_company_name || null,
      created_by: userId
    }).select('id').single();
    if (!custErr) finalCustomerId = newCust.id;
  }
  
  if (finalCustomerId) headerUpdate.customer_id = finalCustomerId;

  for (const key of headerFields) {
    if (updates[key] !== undefined) headerUpdate[key] = updates[key];
  }

  const { data: quotation, error: updateError } = await supabase
    .from('quotations')
    .update(headerUpdate)
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) throw updateError;

  // Replace rows if provided
  if (updates.rows) {
    // Delete old rows (cascades to components)
    await supabase
      .from('quotation_rows')
      .delete()
      .eq('quotation_id', id);

    // Insert new rows
    for (const rowData of updates.rows) {
      const { data: row, error: rowError } = await supabase
        .from('quotation_rows')
        .insert({
          quotation_id: id,
          product_id: rowData.product_id || updates.product_id || null,
          row_number: rowData.row_number,
          packing_type: rowData.packing_type,
          container_variant: rowData.container_variant || null,
          pack_size_value: rowData.pack_size_value,
          pack_size_unit: rowData.pack_size_unit,
          bulk_rate_per_ltr_kg: rowData.bulk_rate_per_ltr_kg,
          bulk_material_cost_per_pcs: rowData.bulk_material_cost_per_pcs,
          total_quantity_ltr_kg: rowData.total_quantity_ltr_kg,
          total_pcs: rowData.total_pcs,
          nos_per_carton: rowData.nos_per_carton || null,
          total_cases: rowData.total_cases || null,
          mrp: rowData.mrp || null,
          gst_rate: rowData.gst_rate,
          cost_per_pcs: rowData.cost_per_pcs,
          row_amount: rowData.row_amount,
          gst_amount: rowData.gst_amount,
          row_total_with_gst: rowData.row_total_with_gst,
          pack_wise_ltr_kg: rowData.pack_wise_ltr_kg || null,
          total_ltr_kg: rowData.total_ltr_kg || null,
        })
        .select('id')
        .single();

      if (rowError) throw rowError;

      if (rowData.components && rowData.components.length > 0) {
        const components = rowData.components.map((c, idx) => ({
          row_id: row.id,
          component_name: c.component_name,
          is_checked: c.is_checked !== undefined ? c.is_checked : true,
          is_custom: c.is_custom || false,
          default_rate: c.default_rate || null,
          applied_rate: c.applied_rate,
          cost_per_pcs: c.cost_per_pcs,
          label_quantity: c.label_quantity || null,
          sort_order: c.sort_order || idx + 1,
        }));

        await supabase.from('quotation_components').insert(components);
      }

      // --- LABEL INVENTORY INTEGRATION ---
      if (finalCustomerId && rowData.labelData) {
        const ld = rowData.labelData;
        if (ld.isNewBatch || ld.includeInQuotation) {
          const labelService = require('./labelService');
          let snapshot;

          if (ld.isNewBatch) {
            snapshot = await labelService.calculateLabelSnapshot({
              customerId: finalCustomerId,
              productId: rowData.product_id || updates.product_id,
              packSize: rowData.pack_size_value + rowData.pack_size_unit,
              packType: rowData.packing_type,
              brandName: ld.brandName || updates.brand_name || updates.name_on_label || '-',
              batchQuantity: ld.batchQuantity,
              ratePerLabel: ld.ratePerLabel,
              usedPcs: rowData.total_pcs
            });
          } else {
            const stockInfo = await labelService.checkLabelStock(
              finalCustomerId, rowData.product_id || updates.product_id,
              rowData.pack_size_value + rowData.pack_size_unit, rowData.total_pcs
            );
            snapshot = {
              openStock: stockInfo.currentStock,
              make: 0,
              totalStock: stockInfo.currentStock,
              used: rowData.total_pcs,
              closingStock: stockInfo.currentStock - rowData.total_pcs,
              rate: 0, amount: 0, gst: 0, totalAmount: 0
            };
          }

          await supabase.from('label_quotation_snapshots').insert({
            quotation_id: id,
            row_index: updates.rows.indexOf(rowData),
            customer_id: finalCustomerId,
            product_id: rowData.product_id || updates.product_id,
            pack_size: rowData.pack_size_value + rowData.pack_size_unit,
            pack_type: rowData.packing_type,
            brand_name: ld.brandName || updates.brand_name || updates.name_on_label || '-',
            open_stock: snapshot.openStock,
            make_quantity: snapshot.make,
            total_stock: snapshot.totalStock,
            used_pcs: snapshot.used,
            closing_stock_after: snapshot.closingStock,
            rate_per_label: snapshot.rate,
            amount: snapshot.amount,
            gst_amount: snapshot.gst,
            total_amount: snapshot.totalAmount,
            is_new_batch: ld.isNewBatch || false,
            include_in_quotation: ld.includeInQuotation || false
          });
        }
      }
    }
  }

  return quotation;
}

// ── Status Transitions ──────────────────────────────────────────────────────

async function submitQuotation(id, userId, userRole) {
  const { data: q, error: fe } = await supabase
    .from('quotations')
    .select('id, status, created_by')
    .eq('id', id)
    .single();

  if (fe || !q) throw Object.assign(new Error('Quotation not found.'), { statusCode: 404 });
  if (q.status !== 'draft') {
    throw Object.assign(new Error(`Cannot submit quotation in "${q.status}" status. Must be "draft".`), { statusCode: 400 });
  }
  if (userRole === 'employee' && q.created_by !== userId) {
    throw Object.assign(new Error('Access denied.'), { statusCode: 403 });
  }

  const { data, error } = await supabase
    .from('quotations')
    .update({ status: 'pending' })
    .eq('id', id)
    .select('id, quotation_number, status')
    .single();

  if (error) throw error;
  return data;
}

async function approveQuotation(id, adminNote, adminUserId) {
  const { data: q, error: fe } = await supabase
    .from('quotations')
    .select('id, status')
    .eq('id', id)
    .single();

  if (fe || !q) throw Object.assign(new Error('Quotation not found.'), { statusCode: 404 });
  if (q.status !== 'pending' && q.status !== 'draft') {
    throw Object.assign(new Error(`Cannot approve quotation in "${q.status}" status. Must be "pending" or "draft".`), { statusCode: 400 });
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('quotations')
    .update({
      status: 'approved',
      admin_note: adminNote || null,
      confirmed_by: adminUserId,
      confirmed_at: now,
    })
    .eq('id', id)
    .select('id, quotation_number, status')
    .single();

  if (error) throw error;

  // Create order record
  const { error: orderError } = await supabase
    .from('orders')
    .insert({
      quotation_id: id,
      confirmed_by: adminUserId,
      confirmed_at: now,
      current_status: 'confirmed',
    });

  if (orderError) throw orderError;

  // --- APPLY LABEL INVENTORY MUTATIONS ---
  const { data: snapshots } = await supabase.from('label_quotation_snapshots').select('*').eq('quotation_id', id);
  if (snapshots && snapshots.length > 0) {
    const labelService = require('./labelService');
    for (const snap of snapshots) {
      if (snap.is_new_batch) {
        await labelService.createOrUpdateLabelInventory({
          customerId: snap.customer_id,
          productId: snap.product_id,
          packSize: snap.pack_size,
          packType: snap.pack_type,
          brandName: snap.brand_name,
          batchQuantity: snap.make_quantity,
          ratePerLabel: snap.rate_per_label,
          usedPcs: snap.used_pcs
        });
      } else {
        await labelService.deductLabelStock(
          snap.customer_id,
          snap.product_id,
          snap.pack_size,
          snap.used_pcs
        );
      }
    }
  }

  // Log order progress
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('quotation_id', id)
    .single();

  if (order) {
    await supabase.from('order_progress').insert({
      order_id: order.id,
      status: 'confirmed',
      updated_by: adminUserId,
      notes: 'Quotation approved and order created.',
    });
  }

  return data;
}

async function rejectQuotation(id, rejectionComment, adminUserId) {
  const { data: q, error: fe } = await supabase
    .from('quotations')
    .select('id, status')
    .eq('id', id)
    .single();

  if (fe || !q) throw Object.assign(new Error('Quotation not found.'), { statusCode: 404 });
  if (q.status !== 'pending') {
    throw Object.assign(new Error(`Cannot reject quotation in "${q.status}" status. Must be "pending".`), { statusCode: 400 });
  }

  const { data, error } = await supabase
    .from('quotations')
    .update({
      status: 'rejected',
      rejection_comment: rejectionComment,
      confirmed_by: adminUserId,
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, quotation_number, status, rejection_comment')
    .single();

  if (error) throw error;
  return data;
}

// ── Preview ─────────────────────────────────────────────────────────────────

async function getQuotationPreview(id, userId, userRole) {
  // Reuse getQuotationById which already fetches full detail
  return getQuotationById(id, userId, userRole);
}

async function deleteQuotation(quotationId, userId, userRole) {
  if (userRole === 'employee') {
    const { data: q, error: fetchErr } = await supabase.from('quotations').select('created_by, status').eq('id', quotationId).single();
    if (fetchErr) {
      throw Object.assign(new Error(`Error fetching quotation: ${fetchErr.message}`), { statusCode: 500 });
    }
    if (!q) {
      throw Object.assign(new Error('Quotation not found. It may have already been deleted.'), { statusCode: 404 });
    }
    if (String(q.created_by) !== String(userId)) {
      throw Object.assign(new Error(`Access denied. You can only delete your own quotations.`), { statusCode: 403 });
    }
    if (q.status !== 'draft' && q.status !== 'pending' && q.status !== 'rejected') {
      throw Object.assign(new Error(`Employees can only delete draft, pending, or rejected quotations. This quotation is ${q.status}.`), { statusCode: 403 });
    }
  }

  // Delete associated order first (to avoid FK violation)
  await supabase.from('orders').delete().eq('quotation_id', quotationId);

  // Delete quotation (cascades to quotation_rows and quotation_components)
  const { error } = await supabase.from('quotations').delete().eq('id', quotationId);

  if (error) throw error;
  return { success: true };
}

module.exports = {
  generateQuotationNumber,
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  submitQuotation,
  approveQuotation,
  rejectQuotation,
  deleteQuotation,
  getQuotationPreview,
};
