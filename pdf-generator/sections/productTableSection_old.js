const { AMPOULE_PACKAGING } = require('../constants');

function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}

function parseUnitMultiplier(unit) {
  if (!unit) return 1;
  const u = unit.toLowerCase().trim();
  if (u === 'ml' || u === 'gm') return 0.001;
  if (u === 'ltr' || u === 'kg') return 1;
  return 1;
}

function generateProductTable(doc, quotationData, startY, isFactoryView = false) {
  const margin = 30;
  let currentY = startY;

  // Has ampoule check
  const hasAmpoule = quotationData.rows.some(r => r.packing_type && r.packing_type.toLowerCase().includes('ampoule'));

  // 1. Base Columns
  let columns = [
    { label: 'Sr', key: 'sr', width: 20 },
    { label: 'Product', key: 'product_name', width: 115 },
    { label: 'Packing Size', key: 'pack_size', width: 50 },
    { label: 'Qty', key: 'total_pcs', width: 35 },
  ];

  if (!isFactoryView) {
    columns.push({ label: 'Rate (Γé╣)', key: 'bulk_material_cost_per_pcs', width: 40 });

    // Dynamic Components
    const dynamicComponents = new Set();
    quotationData.rows.forEach(row => {
      (row.components || []).forEach(comp => {
        if (comp.is_checked && !comp.isBulkMaterial && !comp.component_name.toLowerCase().includes('bulk material')) {
          dynamicComponents.add(comp.component_name);
        }
      });
    });

    // We'll prioritize common terms based on the screenshot (Label, Bottle, Cap, Carton, Labour, Freight)
    const orderedComps = ['LABEL', 'BOTTLE', 'CAP', 'CARTON', 'LABOUR', 'FREIGHT', 'AMPOULE', 'TRAY', 'FBB BOX', 'INNER BOX', 'OUTER BOX'];
    const compArray = Array.from(dynamicComponents);
    compArray.sort((a, b) => {
      const idxA = orderedComps.indexOf(a.toUpperCase());
      const idxB = orderedComps.indexOf(b.toUpperCase());
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });

    compArray.forEach(compName => {
      // Shorten names for table header
      let shortName = compName.charAt(0).toUpperCase() + compName.slice(1).toLowerCase();
      columns.push({ label: `${shortName} (Γé╣)`, key: `comp_${compName}`, width: 35 });
    });

    columns.push({ label: 'Amount (Γé╣)', key: 'row_amount', width: 55 });
  } else {
    // Factory view specific columns if needed
    columns.push(
      { label: 'Pack Ltr/KG', key: 'pack_wise_ltr_kg', width: 50 },
      { label: 'Total Ltr/KG', key: 'total_ltr_kg', width: 50 },
      { label: 'Total Cases', key: 'total_cases', width: 50 }
    );
    
    if (hasAmpoule) {
      columns.push(
        { label: 'Total Trays', key: 'total_trays', width: 40 },
        { label: 'Total FBB', key: 'total_fbb', width: 40 },
        { label: 'Total Inner', key: 'total_inner', width: 40 },
        { label: 'Total Outer', key: 'total_outer', width: 40 }
      );
    }
  }

  const pageWidth = doc.page.width - (margin * 2);
  const totalDesiredWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const scale = pageWidth / totalDesiredWidth;

  // Scale widths
  columns.forEach(col => col.width = col.width * scale);

  // Pagination Check
  if (currentY > doc.page.height - 150) {
    doc.addPage();
    currentY = 40;
  }

  // ΓöÇΓöÇ DRAW HEADER ΓöÇΓöÇ
  const headerHeight = 35;
  doc.rect(margin, currentY, pageWidth, headerHeight).fill('#1B5E20'); // Dark Green
  
  doc.fillColor('#FFFFFF').font('NotoSans-Bold').fontSize(8);
  let currentX = margin;
  
  columns.forEach(col => {
    // Center align text vertically and horizontally
    doc.text(col.label, currentX + 2, currentY + 12, {
      width: col.width - 4,
      align: 'center',
    });
    // Draw vertical separator
    doc.moveTo(currentX, currentY).lineTo(currentX, currentY + headerHeight).strokeColor('#FFFFFF').lineWidth(0.5).stroke();
    currentX += col.width;
  });
  // Rightmost border
  doc.moveTo(currentX, currentY).lineTo(currentX, currentY + headerHeight).strokeColor('#FFFFFF').lineWidth(0.5).stroke();

  currentY += headerHeight;

  // ΓöÇΓöÇ DRAW ROWS ΓöÇΓöÇ
  doc.font('NotoSans').fontSize(8);

  quotationData.rows.forEach((row, index) => {
    // Prepare row data
    const rowData = {};
    const packLtrKg = row.pack_size_value * parseUnitMultiplier(row.pack_size_unit);
    
    rowData['sr'] = index + 1;
    const productName = row.products?.product_name || row.product?.product_name || row.product_name || quotationData.products?.product_name || quotationData.material_name || 'N/A';
    const technical = row.products?.technical_combination || row.product?.technical_combination || row.technical_combination || quotationData.products?.technical_combination || '';

    let productNameText = productName;
    if (isFactoryView && technical) {
      productNameText += `\n(${technical})`;
    }
    rowData['product_name'] = productNameText;
    
    rowData['hsn'] = row.products?.hsn_code || '3808';
    rowData['pack_size'] = `${row.pack_size_value || ''} ${row.pack_size_unit || ''}`.trim();
    
    // Display total bulk quantity (Ltr/Kg) instead of pieces
    const bulkQty = row.total_quantity_ltr_kg || 0;
    const unit = (row.pack_size_unit === 'ml' || row.pack_size_unit === 'ltr') ? 'Ltr' : 'Kg';
    rowData['total_pcs'] = `${bulkQty} ${unit}`;
    
    if (!isFactoryView) {
      rowData['bulk_material_cost_per_pcs'] = row.bulk_material_cost_per_pcs || 0;
      (row.components || []).forEach(c => {
        rowData[`comp_${c.component_name}`] = c.applied_rate || 0;
      });
      rowData['row_amount'] = row.row_amount || 0;
    } else {
      rowData['pack_wise_ltr_kg'] = packLtrKg.toFixed(2);
      rowData['total_ltr_kg'] = (row.total_pcs * packLtrKg).toFixed(2);
      rowData['total_cases'] = row.total_cases || 0;
      
      if (hasAmpoule && row.packing_type && row.packing_type.toLowerCase().includes('ampoule')) {
        const sizeStr = `${row.pack_size_value}${row.pack_size_unit.toLowerCase()}`;
        const spec = AMPOULE_PACKAGING[sizeStr];
        if (spec) {
          rowData['total_trays'] = Math.ceil(row.total_pcs / spec.trayPcs);
          rowData['total_fbb'] = Math.ceil(row.total_pcs / spec.fbbBoxPcs);
          rowData['total_inner'] = Math.ceil(row.total_pcs / spec.innerBoxPcs);
          rowData['total_outer'] = Math.ceil(row.total_pcs / spec.outerBoxPcs);
        }
      }
    }

    // Determine row height (based on product text which can be multiline)
    const productName = row.products?.product_name || row.product?.product_name || row.product_name || quotationData.products?.product_name || quotationData.material_name || 'N/A';
    let rowHeight = 30;
    if (prodText.includes('\n') || prodText.length > 25) {
      rowHeight = 40;
    }

    if (currentY + rowHeight > doc.page.height - 50) {
      doc.addPage();
      currentY = 40;
    }

    // Alternating background
    if (index % 2 === 0) {
      doc.rect(margin, currentY, pageWidth, rowHeight).fill('#FFFFFF');
    } else {
      doc.rect(margin, currentY, pageWidth, rowHeight).fill('#F5F5F5');
    }
    
    doc.fillColor('#333333');

    let x = margin;
    columns.forEach(col => {
      let val = rowData[col.key] != null ? rowData[col.key] : '-';
      
      // format financials
      if (!isFactoryView && ['bulk_material_cost_per_pcs', 'row_amount'].includes(col.key) || String(col.key).startsWith('comp_')) {
        if (val !== '-') {
          val = Number(val).toFixed(2);
        }
      }

      // Format with commas for Amount
      if (col.key === 'row_amount') {
         if (val !== '-') {
           val = new Intl.NumberFormat('en-IN').format(val);
         }
      }

      const align = (col.key === 'product_name') ? 'left' : 'center';
      const textX = (align === 'left') ? x + 5 : x + 2;
      const textW = (align === 'left') ? col.width - 10 : col.width - 4;

      doc.text(String(val), textX, currentY + 8, {
        width: textW,
        align: align,
      });

      // Vertical border
      doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
      x += col.width;
    });
    // Rightmost border
    doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
    
    // Bottom border
    doc.moveTo(margin, currentY + rowHeight).lineTo(margin + pageWidth, currentY + rowHeight).strokeColor('#CCCCCC').lineWidth(0.5).stroke();

    currentY += rowHeight;
  });

  return currentY;
}

module.exports = { generateProductTable, formatCurrency };
