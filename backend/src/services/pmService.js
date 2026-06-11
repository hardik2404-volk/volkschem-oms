// ============================================================================
// VOLKSCHEM OMS — PM Inventory Service
// ============================================================================

const supabase = require('../config/db');

async function calculatePMSnapshot(params) {
  const { customerId, productId, packSize } = params;
  const batchQuantity = parseInt(params.batchQuantity) || 0;
  const ratePerPM = parseFloat(params.ratePerPM) || 0;
  const usedPcs = parseInt(params.usedPcs) || 0;

  const existing = await supabase
    .from('pm_inventory')
    .select('*')
    .eq('customer_id', customerId)
    .eq('product_id', productId)
    .eq('pack_size', packSize)
    .single();

  if (existing.data) {
    const currentClosing = existing.data.closing_stock;
    const newTotalStock = currentClosing + batchQuantity;
    const newClosingStock = newTotalStock - usedPcs;
    const amount = batchQuantity * ratePerPM;
    const gst = amount * 0.18;
    return { openStock: currentClosing, make: batchQuantity, totalStock: newTotalStock, used: usedPcs, closingStock: newClosingStock, rate: ratePerPM, amount, gst, totalAmount: amount + gst, exists: true, existingId: existing.data.id, totalPrinted: existing.data.total_printed, usedToDate: existing.data.used_to_date };
  } else {
    const closingStock = batchQuantity - usedPcs;
    const amount = batchQuantity * ratePerPM;
    const gst = amount * 0.18;
    return { openStock: 0, make: batchQuantity, totalStock: batchQuantity, used: usedPcs, closingStock, rate: ratePerPM, amount, gst, totalAmount: amount + gst, exists: false };
  }
}

async function createOrUpdatePMInventory(params) {
  const { customerId, productId, packSize, packType, brandName } = params;
  const snap = await calculatePMSnapshot(params);

  if (snap.exists) {
    await supabase.from('pm_inventory').update({
      open_stock: snap.openStock,
      make_quantity: snap.make,
      total_printed: snap.totalPrinted + snap.make,
      used_to_date: snap.usedToDate + snap.used,
      closing_stock: snap.closingStock,
      rate_per_pm: snap.rate,
      gst_amount: snap.gst,
      total_amount: snap.totalAmount,
      last_updated: new Date().toISOString()
    }).eq('id', snap.existingId);
  } else {
    if (snap.make < 1000) throw new Error('Minimum pm batch is 1000 (MOQ)');
    await supabase.from('pm_inventory').insert({
      customer_id: customerId,
      product_id: productId,
      pack_size: packSize,
      pack_type: packType,
      brand_name: brandName,
      open_stock: 0,
      make_quantity: snap.make,
      total_printed: snap.make,
      used_to_date: snap.used,
      closing_stock: snap.closingStock,
      rate_per_pm: snap.rate,
      gst_amount: snap.gst,
      total_amount: snap.totalAmount,
      last_updated: new Date().toISOString()
    });
  }

  return snap;
}

async function deductPMStock(customerId, productId, packSize, pcsDispatched) {
  const { data: record } = await supabase
    .from('pm_inventory')
    .select('*')
    .eq('customer_id', customerId)
    .eq('product_id', productId)
    .eq('pack_size', packSize)
    .single();

  if (!record) return; // no inventory to deduct from, skip silently

  const newClosing = Math.max(0, record.closing_stock - pcsDispatched);
  const newUsed = record.used_to_date + pcsDispatched;

  await supabase.from('pm_inventory').update({
    closing_stock: newClosing,
    used_to_date: newUsed,
    last_updated: new Date().toISOString()
  }).eq('id', record.id);
}

async function checkPMStock(customerId, productId, packSize, requiredPcs) {
  const { data: record } = await supabase
    .from('pm_inventory')
    .select('*')
    .eq('customer_id', customerId)
    .eq('product_id', productId)
    .eq('pack_size', packSize)
    .single();

  if (!record) {
    return { exists: false, currentStock: 0, sufficient: false, 
             isFirstOrder: true, shortfall: requiredPcs };
  }

  const sufficient = record.closing_stock >= requiredPcs;
  return { 
    exists: true, 
    currentStock: record.closing_stock,
    sufficient,
    isFirstOrder: false,
    shortfall: sufficient ? 0 : requiredPcs - record.closing_stock,
    record 
  };
}

/**
 * Fetch all pm inventory for a customer.
 */
async function getPMInventoryForCustomer(customerId) {
  const { data, error } = await supabase
    .from('pm_inventory')
    .select('*, products(product_name)')
    .eq('customer_id', customerId)
    .order('products(product_name)')
    .order('pack_size');

  if (error) throw error;
  return data;
}

module.exports = {
  calculatePMSnapshot,
  createOrUpdatePMInventory,
  deductPMStock,
  checkPMStock,
  getPMInventoryForCustomer
};
