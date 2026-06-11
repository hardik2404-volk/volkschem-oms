const { AMPOULE_PACKAGING } = require('../constants');

function parseUnitMultiplier(unit) {
  if (!unit) return 1;
  const u = unit.toLowerCase().trim();
  if (u === 'ml' || u === 'gm') return 0.001;
  if (u === 'ltr' || u === 'kg') return 1;
  return 1;
}

function generateProductionTable(doc, quotationData, startY) {
  const margin = 30;
  let currentY = startY;

  // LAYOUT 3: PURE BULK MATERIAL
  if (quotationData.order_type === 'bulk_material') {
    return drawPureBulkTable(doc, quotationData, currentY, margin);
  }

  // Determine if this is a RETAIL order (needs checklist) or BULK BRAND (no checklist)
  // We check if any row has components like BOTTLE, LABEL, CAP, CARTON, TRAY, etc.
  const dynamicComponents = new Set();
  quotationData.rows.forEach(row => {
    (row.components || []).forEach(comp => {
      if (comp.is_checked && !comp.isBulkMaterial && !comp.component_name.toLowerCase().includes('bulk material')) {
        dynamicComponents.add(comp.component_name.toUpperCase());
      }
    });
    if (row.label_snapshot) {
      dynamicComponents.add('LABEL');
    }
  });

  const checklistItems = ['AMPOULE', 'BOTTLE', 'LABEL', 'TRAY', 'FBB BOX', 'INNER BOX', 'OUTER BOX', 'SHRIK', 'M.CAP', 'CARTOON'];
  const hasChecklist = Array.from(dynamicComponents).some(c => checklistItems.includes(c));

  if (hasChecklist) {
    // LAYOUT 1: STANDARD RETAIL
    return drawRetailTable(doc, quotationData, currentY, margin, Array.from(dynamicComponents));
  } else {
    // LAYOUT 2: BULK BRAND (E.g. 50L Carboy)
    return drawBulkBrandTable(doc, quotationData, currentY, margin);
  }
}

function drawRetailTable(doc, quotationData, startY, margin, dynamicComponents) {
  let currentY = startY;
  
  const cols = [
    { label: 'PRODUCT NAME', key: 'product_name', width: 100 },
    { label: 'BRAND NAME', key: 'brand_name', width: 70 },
    { label: 'DOSE', key: 'dose', width: 40 },
    { label: 'MRP', key: 'mrp', width: 35 },
    { label: 'NO.OF PCS\nPER CARTON', key: 'nos_per_carton', width: 50 },
    { label: 'PACKIGING\nTYPE', key: 'packing_type', width: 65 },
    { label: 'PACKING\nSIZE', key: 'pack_size', width: 45 },
  ];

  // Dynamically add checklist columns based on what's used
  const orderedComps = ['AMPOULE', 'BOTTLE', 'LABEL', 'TRAY', 'FBB BOX', 'INNER BOX', 'OUTER BOX', 'SHRIK', 'M.CAP', 'CARTOON', 'OUTER CTN'];
  
  // We treat OUTER BOX and CARTOON as dynamic components if they are in the array
  const compArray = Array.from(dynamicComponents).filter(c => c !== 'JOB WORK');
  compArray.sort((a, b) => {
    const idxA = orderedComps.indexOf(a);
    const idxB = orderedComps.indexOf(b);
    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
  });

  compArray.forEach(comp => {
    cols.push({ label: comp, key: `chk_${comp}`, width: 40 });
  });
  
  // Totals
  cols.push({ label: 'TOTAL\nQUANTITY', key: 'total_pcs', width: 50 });
  cols.push({ label: 'PACK WISE\nLTR / KG', key: 'pack_wise', width: 50 });
  cols.push({ label: 'TOTAL\nLTR / KG', key: 'total_ltr', width: 50 });
  cols.push({ label: 'TOTAL\nCASE', key: 'total_cases', width: 40 });

  return renderTableGrid(doc, quotationData, currentY, margin, cols, true, compArray);
}

function drawBulkBrandTable(doc, quotationData, startY, margin) {
  let currentY = startY;
  const cols = [
    { label: 'Sr', key: 'sr', width: 25 },
    { label: 'Product Name', key: 'product_name', width: 140 },
    { label: 'Product ID', key: 'product_code', width: 70 },
    { label: 'Brand Name', key: 'brand_name', width: 80 },
    { label: 'Dose', key: 'dose', width: 60 },
    { label: 'Packaging Type', key: 'packing_type', width: 90 },
    { label: 'Packing Size', key: 'pack_size', width: 60 },
    { label: 'Total Qty (Pcs)', key: 'total_pcs', width: 60 },
    { label: 'Pack Wise Ltr/Kg', key: 'pack_wise', width: 60 },
    { label: 'Total Ltr/Kg', key: 'total_ltr', width: 60 },
    { label: 'Total Case', key: 'total_cases', width: 55 }
  ];

  return renderTableGrid(doc, quotationData, currentY, margin, cols, false);
}

function drawPureBulkTable(doc, quotationData, startY, margin) {
  let currentY = startY;
  const cols = [
    { label: 'Sr. No', key: 'sr', width: 40 },
    { label: 'PRODUCT', key: 'product_name', width: 250 },
    { label: 'CODE NO.', key: 'product_code', width: 100 },
    { label: 'Packing Size', key: 'pack_size', width: 100 },
    { label: 'NO.OF DRUMS/BAGs', key: 'total_cases', width: 120 },
    { label: 'Qty. IN LTRs/KGs', key: 'total_ltr', width: 150 }
  ];

  return renderTableGrid(doc, quotationData, currentY, margin, cols, false);
}

function renderTableGrid(doc, quotationData, currentY, margin, columns, isRetail, compArray = []) {
  const pageWidth = doc.page.width - (margin * 2);
  const totalDesiredWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const scale = pageWidth / totalDesiredWidth;

  // Scale widths proportionally
  columns.forEach(col => col.width = col.width * scale);

  // HEADER
  const headerHeight = 45;
  doc.rect(margin, currentY, pageWidth, headerHeight).fill('#E3F2FD'); // Light Blue for Production
  
  doc.fillColor('#000000').font('NotoSans-Bold').fontSize(8);
  let currentX = margin;
  
  columns.forEach(col => {
    // Vertically center header text by checking string height
    const textHeight = doc.heightOfString(col.label, { width: col.width - 4, align: 'center' });
    const textYOffset = (headerHeight - textHeight) / 2;
    doc.text(col.label, currentX + 2, currentY + textYOffset, { width: col.width - 4, align: 'center' });
    doc.moveTo(currentX, currentY).lineTo(currentX, currentY + headerHeight).strokeColor('#B0BEC5').lineWidth(0.5).stroke();
    currentX += col.width;
  });
  doc.moveTo(currentX, currentY).lineTo(currentX, currentY + headerHeight).strokeColor('#B0BEC5').lineWidth(0.5).stroke();
  currentY += headerHeight;

  // ROWS
  doc.font('NotoSans').fontSize(8);

  quotationData.rows.forEach((row, index) => {
    if (currentY > doc.page.height - 100) {
      doc.addPage();
      currentY = 40;
    }

    const rowData = {};
    const packLtrKg = row.pack_size_value * parseUnitMultiplier(row.pack_size_unit);
    const totalLtrKg = row.total_pcs * packLtrKg;
    
    rowData['sr'] = index + 1;
    rowData['product_code'] = row.products?.product_code || quotationData.products?.product_code || '-';
    
    let prodName = row.products?.product_name || quotationData.products?.product_name || quotationData.material_name || (quotationData.order_type === 'bulk' ? row.packing_type : null) || '-';
    if (quotationData.order_type === 'bulk' && row.container_variant) {
      prodName += `\nPacking: ${row.container_variant}`;
    }
    
    // Brand Name Fix
    let brandName = '-';
    if (quotationData.order_type === 'gujarat_brand') brandName = 'Volkschem';
    else if (quotationData.name_on_label) brandName = quotationData.name_on_label;
    else if (quotationData.brand_name) brandName = quotationData.brand_name;
    else if (row.brand_name) brandName = row.brand_name;
    else if (row.products?.brand_name) brandName = row.products?.brand_name;
    else brandName = quotationData.billing_name || '-';
    
    if (isRetail) {
      rowData['product_name'] = prodName;
      rowData['brand_name'] = brandName;
    } else {
      rowData['product_name'] = prodName;
      rowData['brand_name'] = brandName;
    }

    rowData['dose'] = row.products?.technical_combination || '-';
    rowData['mrp'] = row.mrp || '-';
    
    // Set nos_per_carton based on ampoule or standard
    const isAmpoule = row.packing_type && row.packing_type.toLowerCase() === 'ampoule';
    let spec = null;
    let computedTotalCases = row.total_cases || '-';
    
    if (isAmpoule) {
      const pSize = `${row.pack_size_value}${row.pack_size_unit?.toLowerCase()}`;
      spec = AMPOULE_PACKAGING[pSize] || AMPOULE_PACKAGING['10ml'];
      rowData['nos_per_carton'] = spec.outerBoxPcs;
      computedTotalCases = Math.ceil(row.total_pcs / spec.outerBoxPcs);
    } else {
      rowData['nos_per_carton'] = row.nos_per_carton || '-';
    }
    
    rowData['packing_type'] = row.packing_type || '-';
    rowData['pack_size'] = `${row.pack_size_value || ''} ${row.pack_size_unit || ''}`.trim();
    
    // Dynamically evaluate each component for this specific row
    compArray.forEach(comp => {
      let isChecked = (row.components || []).some(c => c.component_name.toUpperCase() === comp && c.is_checked);
      
      if (comp === 'LABEL' && row.label_snapshot) {
        if (row.label_snapshot.withoutLabel || row.label_snapshot.without_label) {
          rowData[`chk_${comp}`] = 'NO';
          return;
        } else {
          isChecked = true;
        }
      }

      if (isChecked) {
        if (isAmpoule && comp === 'INNER BOX' && spec) {
          rowData[`chk_${comp}`] = `YES (${Math.ceil(row.total_pcs / spec.innerBoxPcs)})`;
        } else if (isAmpoule && comp === 'OUTER BOX' && spec) {
          rowData[`chk_${comp}`] = `YES (${computedTotalCases})`;
        } else {
          rowData[`chk_${comp}`] = 'YES';
        }
      } else {
        rowData[`chk_${comp}`] = '';
      }
    });

    rowData['total_pcs'] = row.total_pcs || '-';
    rowData['pack_wise'] = packLtrKg ? Number(packLtrKg.toFixed(4)) : '-';
    rowData['total_ltr'] = totalLtrKg ? Number(totalLtrKg.toFixed(4)) : '-';
    
    // Total Cases for Pure Bulk is DRUMS/BAGS count, which is total_pcs here (e.g. 7 drums of 25kg)
    if (quotationData.order_type === 'bulk' || quotationData.order_type === 'bulk_material') {
      rowData['total_cases'] = row.total_pcs || '-';
      rowData['total_ltr'] = row.total_quantity_ltr_kg || totalLtrKg || '-';
    } else {
      rowData['total_cases'] = computedTotalCases;
    }

    // Determine max height for this row
    let maxRowHeight = 25;
    columns.forEach(col => {
      const text = String(rowData[col.key] || '');
      const textHeight = doc.heightOfString(text, { width: col.width - 4, align: 'center' });
      if (textHeight + 10 > maxRowHeight) maxRowHeight = textHeight + 10;
    });

    // Draw cell text and borders
    currentX = margin;
    columns.forEach(col => {
      const text = String(rowData[col.key] || '');
      doc.text(text, currentX + 2, currentY + (maxRowHeight / 2) - (doc.heightOfString(text, { width: col.width - 4, align: 'center' }) / 2), {
        width: col.width - 4,
        align: 'center'
      });
      doc.moveTo(currentX, currentY).lineTo(currentX, currentY + maxRowHeight).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
      currentX += col.width;
    });
    doc.moveTo(currentX, currentY).lineTo(currentX, currentY + maxRowHeight).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
    
    // Bottom border
    doc.moveTo(margin, currentY + maxRowHeight).lineTo(pageWidth + margin, currentY + maxRowHeight).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
    
    currentY += maxRowHeight;
  });

  return currentY + 20;
}

module.exports = { generateProductionTable };
