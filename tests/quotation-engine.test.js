// ============================================================================
// VOLKSCHEM OMS — Quotation Engine Tests
// ============================================================================
// Tests all calculators, generators, and validators with exact business cases.
// ============================================================================

const {
  calculateBulkMaterialCost,
  calculateTotalPcs,
  calculateComponentCost,
  calculateRowTotal,
  calculateGST,
  getDefaultGstRate,
  calculateQuotationTotal,
  generateQuotationId,
  getNextVersion,
  formatVersionLabel,
  shouldIncrementVersion,
  validateQuotation,
  validateComponents,
} = require('../quotation-engine');

// ════════════════════════════════════════════════════════════════════════════
// BULK MATERIAL CALCULATOR
// ════════════════════════════════════════════════════════════════════════════

describe('calculateBulkMaterialCost', () => {
  test('500ml pack at ₹500/Ltr should give ₹250.0000', () => {
    const result = calculateBulkMaterialCost({
      packSizeValue: 500,
      packSizeUnit: 'ml',
      bulkRatePerLtrKg: 500,
    });
    expect(result).toBe(250.0);
  });

  test('1 Ltr pack at ₹500/Ltr should give ₹500.0000', () => {
    const result = calculateBulkMaterialCost({
      packSizeValue: 1,
      packSizeUnit: 'ltr',
      bulkRatePerLtrKg: 500,
    });
    expect(result).toBe(500.0);
  });

  test('250ml pack at ₹400/Ltr should give ₹100.0000', () => {
    const result = calculateBulkMaterialCost({
      packSizeValue: 250,
      packSizeUnit: 'ml',
      bulkRatePerLtrKg: 400,
    });
    expect(result).toBe(100.0);
  });

  test('100gm pack at ₹800/Kg should give ₹80.0000', () => {
    const result = calculateBulkMaterialCost({
      packSizeValue: 100,
      packSizeUnit: 'gm',
      bulkRatePerLtrKg: 800,
    });
    expect(result).toBe(80.0);
  });

  test('5 Kg pack at ₹200/Kg should give ₹1000.0000', () => {
    const result = calculateBulkMaterialCost({
      packSizeValue: 5,
      packSizeUnit: 'kg',
      bulkRatePerLtrKg: 200,
    });
    expect(result).toBe(1000.0);
  });

  test('should throw on invalid packSizeValue', () => {
    expect(() =>
      calculateBulkMaterialCost({ packSizeValue: -1, packSizeUnit: 'ml', bulkRatePerLtrKg: 500 })
    ).toThrow('packSizeValue must be a positive number');
  });

  test('should throw on unknown unit', () => {
    expect(() =>
      calculateBulkMaterialCost({ packSizeValue: 500, packSizeUnit: 'oz', bulkRatePerLtrKg: 500 })
    ).toThrow('Unknown pack size unit');
  });

  test('should round to 4 decimal places', () => {
    // 333ml at ₹100/Ltr = 0.333 * 100 = 33.3
    const result = calculateBulkMaterialCost({
      packSizeValue: 333,
      packSizeUnit: 'ml',
      bulkRatePerLtrKg: 100,
    });
    expect(result).toBe(33.3);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PACKING QUANTITY CALCULATOR
// ════════════════════════════════════════════════════════════════════════════

describe('calculateTotalPcs', () => {
  test('200 Ltr order with 500ml packs should give 400 pieces', () => {
    const result = calculateTotalPcs({
      totalQuantityLtrKg: 200,
      packSizeValue: 500,
      packSizeUnit: 'ml',
    });
    expect(result).toBe(400);
  });

  test('100 Ltr order with 1 Ltr packs should give 100 pieces', () => {
    const result = calculateTotalPcs({
      totalQuantityLtrKg: 100,
      packSizeValue: 1,
      packSizeUnit: 'ltr',
    });
    expect(result).toBe(100);
  });

  test('50 Kg order with 250gm packs should give 200 pieces', () => {
    const result = calculateTotalPcs({
      totalQuantityLtrKg: 50,
      packSizeValue: 250,
      packSizeUnit: 'gm',
    });
    expect(result).toBe(200);
  });

  test('should round up with Math.ceil (never round down)', () => {
    // 10 Ltr / 3 Ltr packs = 3.333... → should be 4
    const result = calculateTotalPcs({
      totalQuantityLtrKg: 10,
      packSizeValue: 3,
      packSizeUnit: 'ltr',
    });
    expect(result).toBe(4);
  });

  test('should throw on zero totalQuantityLtrKg', () => {
    expect(() =>
      calculateTotalPcs({ totalQuantityLtrKg: 0, packSizeValue: 500, packSizeUnit: 'ml' })
    ).toThrow('totalQuantityLtrKg must be a positive number');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT COST CALCULATOR
// ════════════════════════════════════════════════════════════════════════════

describe('calculateComponentCost', () => {
  test('should sum only checked components', () => {
    const result = calculateComponentCost([
      { componentName: 'Bulk Material', isChecked: true, appliedRate: 250 },
      { componentName: 'Bottle', isChecked: true, appliedRate: 5.50 },
      { componentName: 'Cap', isChecked: true, appliedRate: 1.20 },
      { componentName: 'Label', isChecked: false, appliedRate: 2.00 },
    ]);
    expect(result).toBe(256.7);
  });

  test('should return 0 if no components checked', () => {
    const result = calculateComponentCost([
      { componentName: 'Bottle', isChecked: false, appliedRate: 5.50 },
    ]);
    expect(result).toBe(0);
  });

  test('should handle all components checked', () => {
    const result = calculateComponentCost([
      { componentName: 'Bulk Material', isChecked: true, appliedRate: 250 },
      { componentName: 'Bottle', isChecked: true, appliedRate: 5.50 },
      { componentName: 'Cap', isChecked: true, appliedRate: 1.20 },
      { componentName: 'Label', isChecked: true, appliedRate: 2.00 },
      { componentName: 'Carton', isChecked: true, appliedRate: 8.80 },
    ]);
    expect(result).toBe(267.5);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ROW TOTAL CALCULATOR
// ════════════════════════════════════════════════════════════════════════════

describe('calculateRowTotal', () => {
  test('400 pieces at ₹267.50/pc should give ₹107000.00', () => {
    const result = calculateRowTotal({ costPerPcs: 267.50, totalPcs: 400 });
    expect(result).toBe(107000.0);
  });

  test('1000 pieces at ₹50.25/pc should give ₹50250.00', () => {
    const result = calculateRowTotal({ costPerPcs: 50.25, totalPcs: 1000 });
    expect(result).toBe(50250.0);
  });

  test('should round to 2 decimal places', () => {
    const result = calculateRowTotal({ costPerPcs: 33.333, totalPcs: 3 });
    expect(result).toBe(100.0);
  });

  test('should throw on negative costPerPcs', () => {
    expect(() => calculateRowTotal({ costPerPcs: -10, totalPcs: 100 })).toThrow(
      'costPerPcs must be a non-negative number'
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GST CALCULATOR
// ════════════════════════════════════════════════════════════════════════════

describe('calculateGST', () => {
  test('₹107000 at 18% GST should give ₹19260 GST and ₹126260 total', () => {
    const result = calculateGST({ rowAmount: 107000, gstRate: 18 });
    expect(result.gstAmount).toBe(19260.0);
    expect(result.rowTotalWithGst).toBe(126260.0);
  });

  test('₹50000 at 5% GST should give ₹2500 GST and ₹52500 total', () => {
    const result = calculateGST({ rowAmount: 50000, gstRate: 5 });
    expect(result.gstAmount).toBe(2500.0);
    expect(result.rowTotalWithGst).toBe(52500.0);
  });

  test('₹0 at 18% GST should give ₹0', () => {
    const result = calculateGST({ rowAmount: 0, gstRate: 18 });
    expect(result.gstAmount).toBe(0);
    expect(result.rowTotalWithGst).toBe(0);
  });

  test('should round to 2 decimal places', () => {
    const result = calculateGST({ rowAmount: 99.99, gstRate: 18 });
    expect(result.gstAmount).toBe(18.0);
    expect(result.rowTotalWithGst).toBe(117.99);
  });
});

describe('getDefaultGstRate', () => {
  test('granules should return 5%', () => {
    expect(getDefaultGstRate('granules')).toBe(5);
  });

  test('agricultural should return 5%', () => {
    expect(getDefaultGstRate('agricultural')).toBe(5);
  });

  test('insecticide should return 18%', () => {
    expect(getDefaultGstRate('insecticide')).toBe(18);
  });

  test('null should return 18%', () => {
    expect(getDefaultGstRate(null)).toBe(18);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// QUOTATION TOTAL CALCULATOR
// ════════════════════════════════════════════════════════════════════════════

describe('calculateQuotationTotal', () => {
  test('should sum multiple rows correctly', () => {
    const result = calculateQuotationTotal([
      { rowAmount: 107000, gstAmount: 19260, rowTotalWithGst: 126260 },
      { rowAmount: 50000, gstAmount: 9000, rowTotalWithGst: 59000 },
    ]);
    expect(result.subtotal).toBe(157000.0);
    expect(result.totalGst).toBe(28260.0);
    expect(result.grandTotal).toBe(185260.0);
  });

  test('should handle single row', () => {
    const result = calculateQuotationTotal([
      { rowAmount: 107000, gstAmount: 19260, rowTotalWithGst: 126260 },
    ]);
    expect(result.subtotal).toBe(107000.0);
    expect(result.totalGst).toBe(19260.0);
    expect(result.grandTotal).toBe(126260.0);
  });

  test('should throw on empty array', () => {
    expect(() => calculateQuotationTotal([])).toThrow('rows must be a non-empty array');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// QUOTATION ID GENERATOR
// ════════════════════════════════════════════════════════════════════════════

describe('generateQuotationId', () => {
  test('first quotation of year should be VCS-2025-0001', () => {
    expect(generateQuotationId(2025, 0)).toBe('VCS-2025-0001');
  });

  test('42nd quotation should be VCS-2025-0042', () => {
    expect(generateQuotationId(2025, 41)).toBe('VCS-2025-0042');
  });

  test('100th quotation should be VCS-2025-0100', () => {
    expect(generateQuotationId(2025, 99)).toBe('VCS-2025-0100');
  });

  test('should handle year 2026', () => {
    expect(generateQuotationId(2026, 0)).toBe('VCS-2026-0001');
  });

  test('should pad beyond 4 digits if needed', () => {
    expect(generateQuotationId(2025, 9999)).toBe('VCS-2025-10000');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// VERSION MANAGER
// ════════════════════════════════════════════════════════════════════════════

describe('versionManager', () => {
  test('getNextVersion should increment by 1', () => {
    expect(getNextVersion(1)).toBe(2);
    expect(getNextVersion(5)).toBe(6);
  });

  test('formatVersionLabel should format correctly', () => {
    expect(formatVersionLabel(1)).toBe('v1');
    expect(formatVersionLabel(3)).toBe('v3');
  });

  test('shouldIncrementVersion returns true when re-editing after rejection', () => {
    expect(shouldIncrementVersion('rejected', 'draft')).toBe(true);
  });

  test('shouldIncrementVersion returns true when re-editing after pending', () => {
    expect(shouldIncrementVersion('pending', 'draft')).toBe(true);
  });

  test('shouldIncrementVersion returns false for draft to pending', () => {
    expect(shouldIncrementVersion('draft', 'pending')).toBe(false);
  });

  test('shouldIncrementVersion returns false for pending to approved', () => {
    expect(shouldIncrementVersion('pending', 'approved')).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// QUOTATION VALIDATOR
// ════════════════════════════════════════════════════════════════════════════

describe('validateQuotation', () => {
  const validQuotation = {
    customer_name: 'Test Customer',
    quotation_date: '2025-06-01',
    order_type: 'product',
    product_id: 'some-uuid',
    product_order_type: 'gujarat_brand',
    rows: [
      {
        packing_type: 'bottle',
        pack_size_value: 500,
        pack_size_unit: 'ml',
        total_quantity_ltr_kg: 200,
        total_pcs: 400,
        gst_rate: 18,
        cost_per_pcs: 267.50,
        row_amount: 107000,
      },
    ],
  };

  test('valid quotation should pass', () => {
    const result = validateQuotation(validQuotation);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('missing customer_name should fail', () => {
    const result = validateQuotation({ ...validQuotation, customer_name: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Customer name is required.');
  });

  test('missing rows should fail', () => {
    const result = validateQuotation({ ...validQuotation, rows: [] });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('At least one quotation row is required.');
  });

  test('product type without product_id should fail', () => {
    const result = validateQuotation({
      ...validQuotation,
      product_id: null,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Product Code is required for product quotations.');
  });

  test('null quotation should fail', () => {
    const result = validateQuotation(null);
    expect(result.isValid).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT VALIDATOR
// ════════════════════════════════════════════════════════════════════════════

describe('validateComponents', () => {
  test('valid bottle components should pass', () => {
    const result = validateComponents(
      [
        { componentName: 'Bulk Material', isChecked: true, isBulkMaterial: true, appliedRate: 250 },
        { componentName: 'Bottle', isChecked: true, appliedRate: 5.50 },
        { componentName: 'Cap', isChecked: true, appliedRate: 1.20 },
      ],
      'bottle'
    );
    expect(result.isValid).toBe(true);
  });

  test('missing bulk material should fail', () => {
    const result = validateComponents(
      [{ componentName: 'Bottle', isChecked: true, appliedRate: 5.50 }],
      'bottle'
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Bulk material'))).toBe(true);
  });

  test('bottle packing with ampoule component should fail', () => {
    const result = validateComponents(
      [
        { componentName: 'Bulk Material', isChecked: true, isBulkMaterial: true, appliedRate: 250 },
        { componentName: 'Ampoule Glass', isChecked: true, appliedRate: 3.00 },
      ],
      'bottle'
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('not compatible'))).toBe(true);
  });

  test('negative applied rate should fail', () => {
    const result = validateComponents(
      [
        { componentName: 'Bulk Material', isChecked: true, isBulkMaterial: true, appliedRate: 250 },
        { componentName: 'Bottle', isChecked: true, appliedRate: -5 },
      ],
      'bottle'
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('non-negative'))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// END-TO-END: Full row calculation pipeline
// ════════════════════════════════════════════════════════════════════════════

describe('End-to-End: Full quotation row pipeline', () => {
  test('500ml IMIDA bottle at ₹500/Ltr, 200 Ltr order, full component stack', () => {
    // Step 1: Bulk material cost
    const bulkCost = calculateBulkMaterialCost({
      packSizeValue: 500,
      packSizeUnit: 'ml',
      bulkRatePerLtrKg: 500,
    });
    expect(bulkCost).toBe(250);

    // Step 2: Total pieces
    const totalPcs = calculateTotalPcs({
      totalQuantityLtrKg: 200,
      packSizeValue: 500,
      packSizeUnit: 'ml',
    });
    expect(totalPcs).toBe(400);

    // Step 3: Component cost (bulk + bottle + cap + label + carton)
    const costPerPcs = calculateComponentCost([
      { componentName: 'Bulk Material', isChecked: true, appliedRate: 250, isBulkMaterial: true },
      { componentName: 'Bottle', isChecked: true, appliedRate: 5.50 },
      { componentName: 'Cap', isChecked: true, appliedRate: 1.20 },
      { componentName: 'Label', isChecked: true, appliedRate: 2.00 },
      { componentName: 'Carton', isChecked: true, appliedRate: 8.80 },
    ]);
    expect(costPerPcs).toBe(267.5);

    // Step 4: Row total
    const rowAmount = calculateRowTotal({ costPerPcs, totalPcs });
    expect(rowAmount).toBe(107000);

    // Step 5: GST
    const gst = calculateGST({ rowAmount, gstRate: 18 });
    expect(gst.gstAmount).toBe(19260);
    expect(gst.rowTotalWithGst).toBe(126260);

    // Step 6: Quotation total (single row)
    const quotationTotal = calculateQuotationTotal([
      { rowAmount, gstAmount: gst.gstAmount, rowTotalWithGst: gst.rowTotalWithGst },
    ]);
    expect(quotationTotal.subtotal).toBe(107000);
    expect(quotationTotal.totalGst).toBe(19260);
    expect(quotationTotal.grandTotal).toBe(126260);
  });
});
