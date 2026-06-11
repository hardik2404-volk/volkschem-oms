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
  if (isFactoryView) {
    return generateFactoryProductTable(doc, quotationData, startY);
  }

  const margin = 10;
  let currentY = startY;

  // Gather dynamic components for the "Per PCS Cost" merged header
  const dynamicComponents = new Set();
  quotationData.rows.forEach(row => {
    (row.components || []).forEach(comp => {
      if (comp.is_checked && !comp.isBulkMaterial && !comp.component_name.toLowerCase().includes('bulk material')) {
        dynamicComponents.add(comp.component_name);
      }
    });
  });

  const orderedComps = ['TRAY', 'FBB BOX', 'INNER BOX', 'OUTER BOX', 'JOB WORK', 'AMPOULE', 'BOTTLE', 'CAP', 'LABEL', 'CARTON'];
  const compArray = Array.from(dynamicComponents);
  compArray.sort((a, b) => {
    const idxA = orderedComps.indexOf(a.toUpperCase());
    const idxB = orderedComps.indexOf(b.toUpperCase());
    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
  });

  const compCols = compArray.map(compName => {
    let shortName = compName.charAt(0).toUpperCase() + compName.slice(1).toLowerCase();
    if (shortName.toLowerCase().includes('ampoule')) shortName = 'Ampoule';
    return { label: shortName, key: `comp_${compName}`, width: 30 };
  });

  // Define Columns
  let columns = [
    { label: 'Sr', key: 'sr', width: 15 },
    { label: 'PRODUCT NAME\n[PRODUCT CODE]', key: 'product_name', width: 75 },
    { label: 'BRAND\nNAME', key: 'brand_name', width: 45 },
    { label: 'MRP', key: 'mrp', width: 25 },
    { label: 'NO.OF\nPCS\nPER\nCARTON', key: 'carton_pcs', width: 35 },
    { label: 'PACKAGING\nTYPE', key: 'packaging_type', width: 50 },
    { label: 'BULK\nMAT.\nRATE\nLTR/KG', key: 'bulk_rate', width: 35 },
    { label: 'PACKING\nSIZE', key: 'pack_size', width: 35 },
    { label: 'USED\nPM', key: 'used_labels', width: 30 },
  ];

  const subColStartX = columns.reduce((s, c) => s + c.width, 0);

  columns = columns.concat(compCols);

  columns.push({ label: 'COST\nOF\nPRODUCT\nPER PCS.', key: 'cost_per_pcs', width: 45 });
  columns.push({ label: 'TOTAL\nQUANTITY\nPCS.', key: 'total_qty', width: 45 });
  columns.push({ label: 'AMOUNT', key: 'amount', width: 50 });
  columns.push({ label: 'GST', key: 'gst', width: 40 });
  columns.push({ label: 'TOTAL\nAMOUNT\n(WITH\nGST)', key: 'total_amount', width: 50 });

  const pageWidth = doc.page.width - (margin * 2);
  const totalDesiredWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const scale = pageWidth / totalDesiredWidth;

  columns.forEach(col => col.width = col.width * scale);

  if (currentY > doc.page.height - 150) {
    doc.addPage();
    currentY = 40;
  }

  // Draw Header
  const headerHeight = 50;
  doc.rect(margin, currentY, pageWidth, headerHeight).fill('#1B5E20');
  doc.fillColor('#FFFFFF').font('NotoSans-Bold').fontSize(6);
  let currentX = margin;

  // Draw Merged Header for "Per PCS Cost"
  const compTotalWidth = compCols.reduce((sum, c) => sum + c.width, 0);

  columns.forEach((col, idx) => {
    const isCompCol = col.key.startsWith('comp_');
    if (isCompCol) {
      if (idx === columns.findIndex(c => c.key.startsWith('comp_'))) {
        doc.text('Per PCS Cost', currentX, currentY + 5, { width: compTotalWidth, align: 'center' });
        doc.moveTo(currentX, currentY + 20).lineTo(currentX + compTotalWidth, currentY + 20).strokeColor('#FFFFFF').lineWidth(0.5).stroke();
      }
      doc.text(col.label, currentX, currentY + 25, { width: col.width, align: 'center' });
    } else {
      doc.text(col.label, currentX + 2, currentY + 10, { width: col.width - 4, align: 'center' });
    }

    if (!isCompCol || idx === columns.length - 1 || !columns[idx+1].key.startsWith('comp_')) {
      doc.moveTo(currentX + col.width, currentY).lineTo(currentX + col.width, currentY + headerHeight).strokeColor('#FFFFFF').lineWidth(0.5).stroke();
    }
    
    if (isCompCol && idx !== columns.length - 1 && columns[idx+1].key.startsWith('comp_')) {
        doc.moveTo(currentX + col.width, currentY + 20).lineTo(currentX + col.width, currentY + headerHeight).strokeColor('#FFFFFF').lineWidth(0.5).stroke();
    }
    
    // Draw left vertical separator for the very first column
    if (idx === 0) {
        doc.moveTo(currentX, currentY).lineTo(currentX, currentY + headerHeight).strokeColor('#FFFFFF').lineWidth(0.5).stroke();
    }

    currentX += col.width;
  });

  currentY += headerHeight;

  // Draw Rows
  doc.font('NotoSans').fontSize(7);

  quotationData.rows.forEach((row, index) => {
    const rowData = {};
    rowData['sr'] = index + 1;
    
    const productName = row.products?.product_name || row.product?.product_name || row.product_name || '-';
    const productCode = row.products?.product_code || row.product?.product_code || '-';
    rowData['product_name'] = `${productName}\n(${productCode})`;
    
    rowData['brand_name'] = quotationData.name_on_label || row.product?.brand_name || productName || '-';
    rowData['mrp'] = row.mrp || '-';
    
    if (row.total_cases > 0 && row.total_pcs > 0) {
        rowData['carton_pcs'] = Math.round(row.total_pcs / row.total_cases);
    } else if (row.outerBoxCount > 0 && row.total_pcs > 0) {
        rowData['carton_pcs'] = Math.round(row.total_pcs / row.outerBoxCount);
    } else {
        rowData['carton_pcs'] = '-';
    }

    rowData['packaging_type'] = row.packing_type || '-';
    
    const packLtrKg = (row.pack_size_value || 0) * parseUnitMultiplier(row.pack_size_unit);
    const bulkRateLtrKg = packLtrKg > 0 ? (row.bulk_material_cost_per_pcs / packLtrKg) : 0;
    rowData['bulk_rate'] = bulkRateLtrKg > 0 ? bulkRateLtrKg.toFixed(2) : '-';
    
    rowData['pack_size'] = `${row.pack_size_value || ''} ${row.pack_size_unit || ''}`.trim();
    
    // USED PM
    const globalRowIndex = index;
    const pmSnapshot = row.pm_snapshot || row.label_snapshot;
    if (pmSnapshot && !pmSnapshot.withoutPM) {
        rowData['used_labels'] = row.total_pcs;
    } else {
        rowData['used_labels'] = '-';
    }

    // Components
    let compTotal = 0;
    (row.components || []).forEach(c => {
      rowData[`comp_${c.component_name}`] = c.cost_per_pcs > 0 ? c.cost_per_pcs.toFixed(2) : '-';
      if (c.is_checked && !c.isBulkMaterial && !c.component_name.toLowerCase().includes('bulk material')) {
          compTotal += c.cost_per_pcs;
      }
    });
    
    // If there is PM cost, we need to map it if they chose it? The old table had USED LABELS but didn't have PM cost under Per PCS?
    // Oh wait, in the screenshot they have "Ampoule" 2.40 under "Per PCS Cost", which is a component! The PM system is separate!
    // PM cost is added to row_amount in the engine.
    
    const costPerPcs = row.bulk_material_cost_per_pcs + compTotal;
    rowData['cost_per_pcs'] = costPerPcs > 0 ? costPerPcs.toFixed(2) : '-';
    rowData['total_qty'] = row.total_pcs || '-';
    
    rowData['amount'] = row.row_amount ? row.row_amount.toFixed(2) : '-';
    rowData['gst'] = row.gst_amount ? row.gst_amount.toFixed(2) : '-';
    rowData['total_amount'] = row.row_total_with_gst ? row.row_total_with_gst.toFixed(2) : '-';

    let rowHeight = 35;
    if (rowData['product_name'].includes('\n') || rowData['product_name'].length > 20) {
      rowHeight = 45;
    }

    if (currentY + rowHeight > doc.page.height - 50) {
      doc.addPage();
      currentY = 40;
    }

    if (index % 2 === 0) {
      doc.rect(margin, currentY, pageWidth, rowHeight).fill('#FFFFFF');
    } else {
      doc.rect(margin, currentY, pageWidth, rowHeight).fill('#F5F5F5');
    }
    
    doc.fillColor('#333333');

    let x = margin;
    columns.forEach((col, idx) => {
      let val = rowData[col.key] != null ? rowData[col.key] : '-';
      
      const align = (col.key === 'product_name' || col.key === 'brand_name') ? 'left' : 'center';
      const textX = (align === 'left') ? x + 5 : x + 2;
      const textW = (align === 'left') ? col.width - 10 : col.width - 4;

      doc.text(String(val), textX, currentY + 10, {
        width: textW,
        align: align,
      });

      doc.moveTo(x + col.width, currentY).lineTo(x + col.width, currentY + rowHeight).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
      if (idx === 0) {
          doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
      }
      x += col.width;
    });
    
    doc.moveTo(margin, currentY + rowHeight).lineTo(margin + pageWidth, currentY + rowHeight).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
    currentY += rowHeight;
  });

  return currentY;
}

function generateFactoryProductTable(doc, quotationData, startY) {
  // Simple factory table implementation to ensure it works
  const margin = 30;
  let currentY = startY;
  
  let columns = [
    { label: 'Sr', key: 'sr', width: 20 },
    { label: 'Product ID', key: 'product_code', width: 60 },
    { label: 'Product', key: 'product_name', width: 100 },
    { label: 'Packing Size', key: 'pack_size', width: 50 },
    { label: 'Pack Ltr/KG', key: 'pack_wise_ltr_kg', width: 50 },
    { label: 'Total Ltr/KG', key: 'total_ltr_kg', width: 50 },
    { label: 'Total Cases', key: 'total_cases', width: 50 }
  ];

  const pageWidth = doc.page.width - (margin * 2);
  const totalDesiredWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const scale = pageWidth / totalDesiredWidth;
  columns.forEach(col => col.width = col.width * scale);

  const headerHeight = 35;
  doc.rect(margin, currentY, pageWidth, headerHeight).fill('#1B5E20');
  doc.fillColor('#FFFFFF').font('NotoSans-Bold').fontSize(8);
  let currentX = margin;
  columns.forEach(col => {
    doc.text(col.label, currentX + 2, currentY + 12, { width: col.width - 4, align: 'center' });
    doc.moveTo(currentX, currentY).lineTo(currentX, currentY + headerHeight).strokeColor('#FFFFFF').lineWidth(0.5).stroke();
    currentX += col.width;
  });
  doc.moveTo(currentX, currentY).lineTo(currentX, currentY + headerHeight).strokeColor('#FFFFFF').lineWidth(0.5).stroke();
  currentY += headerHeight;

  doc.font('NotoSans').fontSize(8);
  quotationData.rows.forEach((row, index) => {
    const rowData = {};
    const packLtrKg = row.pack_size_value * parseUnitMultiplier(row.pack_size_unit);
    rowData['sr'] = index + 1;
    rowData['product_code'] = row.products?.product_code || '-';
    rowData['product_name'] = row.products?.product_name || '-';
    rowData['pack_size'] = `${row.pack_size_value || ''} ${row.pack_size_unit || ''}`.trim();
    rowData['pack_wise_ltr_kg'] = packLtrKg.toFixed(2);
    rowData['total_ltr_kg'] = (row.total_pcs * packLtrKg).toFixed(2);
    rowData['total_cases'] = row.total_cases || 0;

    let rowHeight = 30;
    if (currentY + rowHeight > doc.page.height - 50) {
      doc.addPage();
      currentY = 40;
    }

    if (index % 2 === 0) doc.rect(margin, currentY, pageWidth, rowHeight).fill('#FFFFFF');
    else doc.rect(margin, currentY, pageWidth, rowHeight).fill('#F5F5F5');
    
    doc.fillColor('#333333');
    let x = margin;
    columns.forEach(col => {
      let val = rowData[col.key] != null ? rowData[col.key] : '-';
      doc.text(String(val), x + 2, currentY + 8, { width: col.width - 4, align: 'center' });
      doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
      x += col.width;
    });
    doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
    doc.moveTo(margin, currentY + rowHeight).lineTo(margin + pageWidth, currentY + rowHeight).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
    currentY += rowHeight;
  });

  return currentY;
}

module.exports = { generateProductTable, formatCurrency };
