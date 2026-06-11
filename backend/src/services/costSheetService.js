// ============================================================================
// VOLKSCHEM OMS — Cost Sheet Service
// ============================================================================

const supabase = require('../config/db');

/**
 * Get all cost sheet rates, organized by category.
 */
async function getAllRates() {
  const { data, error } = await supabase
    .from('cost_sheet_rates')
    .select('*')
    .order('category')
    .order('item_name')
    .order('size');

  if (error) throw error;

  // Group by category
  const grouped = {};
  for (const rate of data) {
    if (!grouped[rate.category]) grouped[rate.category] = [];
    grouped[rate.category].push(rate);
  }

  return { rates: data, grouped };
}

/**
 * Get rates for a specific category.
 */
async function getRatesByCategory(category) {
  const { data, error } = await supabase
    .from('cost_sheet_rates')
    .select('*')
    .eq('category', category)
    .order('item_name')
    .order('size');

  if (error) throw error;
  return data;
}

/**
 * Lookup a specific rate by category, item_name, and size.
 */
async function lookupRate(category, itemName, size) {
  let query = supabase
    .from('cost_sheet_rates')
    .select('*')
    .eq('category', category);

  if (itemName) {
    query = query.ilike('item_name', `%${itemName}%`);
  }
  if (size) {
    query = query.ilike('size', `%${size}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (!data || data.length === 0) {
    throw Object.assign(new Error('Rate not found for the given criteria.'), { statusCode: 404 });
  }

  return data;
}

/**
 * Update a single rate by ID.
 * Only affects future quotations; existing quotations keep their saved rates.
 */
async function updateRate(id, newRate, updatedBy) {
  const { data, error } = await supabase
    .from('cost_sheet_rates')
    .update({
      rate: newRate,
      updated_by: updatedBy,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  if (!data) throw Object.assign(new Error('Rate not found.'), { statusCode: 404 });
  return data;
}

/**
 * Create a new cost sheet rate entry.
 */
async function createRate({ category, item_name, size, rate }, createdBy) {
  const { data, error } = await supabase
    .from('cost_sheet_rates')
    .insert({
      category: category.toLowerCase(),
      item_name,
      size,
      rate,
      updated_by: createdBy,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a cost sheet rate entry by ID.
 */
async function deleteRate(id, deletedBy) {
  const { data, error } = await supabase
    .from('cost_sheet_rates')
    .delete()
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  if (!data) throw Object.assign(new Error('Rate entry not found.'), { statusCode: 404 });
  return data;
}

module.exports = {
  getAllRates,
  getRatesByCategory,
  lookupRate,
  updateRate,
  createRate,
  deleteRate,
};
