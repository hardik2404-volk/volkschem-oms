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

  let columns = [
    { label: 'Sr', key: 'sr', width: 20 },
    { label: 'Product', key: 'product_name', width: 100 },
    { label: 'Packing Size', key: 'pack_size', width: 50 }
  ];

  if (isFactoryView) {
    columns.splice(1, 0, { label: 'Product ID', key: 'product_code', width: 60 });
  }

  if (!isFactoryView) {
    columns.push({ label: 'Qty', key: 'total_pcs', width: 35 });
    columns.push({ label: 'Rate (₹)', key: 'bulk_material_cost_per_pcs', width: 40 });

    // Dynamic Components
    const dynamicComponents = new Set();
    quotationData.rows.forEach(row => {
      (row.components || []).forEach(comp => {
        if (comp.is_checked && !comp.isBulkMaterial && !comp.component_name.toLowerCase().includes('bulk material')) {
          dynamicComponents.add(comp.component_name);
        }
      });
    });

    // We'll prioritize common terms based on the screenshot (Bottle, Cap, Carton, Labour, Freight)
    const orderedComps = ['BOTTLE', 'CAP', 'CARTON', 'LABOUR', 'FREIGHT', 'AMPOULE', 'TRAY', 'FBB BOX', 'INNER BOX', 'OUTER BOX'];
    const compArray = Array.from(dynamicComponents).filter(c => c.toUpperCase() !== 'LABEL');
    compArray.sort((a, b) => {
      const idxA = orderedComps.indexOf(a.toUpperCase());
      const idxB = orderedComps.indexOf(b.toUpperCase());
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });

    compArray.forEach(compName => {
      // Shorten names for table header
      let shortName = compName.charAt(0).toUpperCase() + compName.slice(1).toLowerCase();
      if (shortName.toLowerCase().includes('ampoule')) shortName = 'Ampoule';
      columns.push({ label: `${shortName} (₹)`, key: `comp_${compName}`, width: 35 });
    });

    columns.push({ label: 'Amount (₹)', key: 'row_amount', width: 55 });
  } else {
    // Factory view specific columns if needed
    columns.push(
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

  // ── DRAW HEADER ──
  const materialCols = columns.filter(c => c.key.startsWith('comp_'));
  const headerHeight = (!isFactoryView && materialCols.length > 0) ? 45 : 25;
  
  doc.rect(margin, currentY, pageWidth, headerHeight).fillAndStroke('#1B5E20', '#1B5E20');
  
  doc.fillColor('#FFFFFF').font('NotoSans-Bold').fontSize(8);
  let currentX = margin;
  
  if (!isFactoryView && materialCols.length > 0) {
    // 2-tier header
    columns.forEach(col => {
      const isMaterialCol = materialCols.includes(col);
      if (isMaterialCol) {
        doc.text(col.label, currentX, currentY + 23, { width: col.width, align: 'center' });
      } else {
        doc.text(col.label, currentX, currentY + 16, { width: col.width, align: 'center' });
      }
      currentX += col.width;
    });

    const startMatX = margin + columns.slice(0, columns.indexOf(materialCols[0])).reduce((sum, c) => sum + c.width, 0);
    const matTotalW = materialCols.reduce((sum, c) => sum + c.width, 0);
    doc.text('Packing Material Costs', startMatX, currentY + 6, { width: matTotalW, align: 'center' });
    
    // Subheader divider
    doc.moveTo(startMatX, currentY + 20).lineTo(startMatX + matTotalW, currentY + 20).strokeColor('#FFFFFF').lineWidth(0.5).stroke();
    
    // Vertical dividers in header
    let lineX = margin;
    columns.forEach(col => {
      if (col !== columns[0]) {
        if (materialCols.includes(col) && col !== materialCols[0]) {
          doc.moveTo(lineX, currentY + 20).lineTo(lineX, currentY + headerHeight).strokeColor('#FFFFFF').lineWidth(0.5).stroke();
        } else {
          doc.moveTo(lineX, currentY).lineTo(lineX, currentY + headerHeight).strokeColor('#FFFFFF').lineWidth(0.5).stroke();
        }
      }
      lineX += col.width;
    });
  } else {
    // Standard 1-tier header
    columns.forEach(col => {
      doc.text(col.label, currentX, currentY + 8, { width: col.width, align: 'center' });
      currentX += col.width;
    });
    let lineX = margin;
    columns.forEach(col => {
      if (col !== columns[0]) {
        doc.moveTo(lineX, currentY).lineTo(lineX, currentY + headerHeight).strokeColor('#FFFFFF').lineWidth(0.5).stroke();
      }
      lineX += col.width;
    });
  }
  
  currentY += headerHeight;

  // ── DRAW ROWS ──
  quotationData.rows.forEach((row, index) => {
    // Check if we need a new page
    if (currentY > doc.page.height - 100) {
      doc.addPage();
      currentY = 40;
      doc.rect(margin, currentY, pageWidth, headerHeight).fill('#204938');
      doc.fillColor('#FFFFFF').font('NotoSans-Bold').fontSize(8);
      // Redraw header (simplified for pagination)
      let tempX = margin;
      columns.forEach(col => {
        doc.text(col.label, tempX, currentY + (headerHeight === 35 && !col.key.startsWith('comp_') ? 12 : 6), { width: col.width, align: 'center' });
        tempX += col.width;
      });
      currentY += headerHeight;
    }

    // Prepare row data
    const rowData = {};
    const packLtrKg = row.pack_size_value * parseUnitMultiplier(row.pack_size_unit);
    
    rowData['sr'] = index + 1;
    rowData['product_code'] = row.products?.product_code || row.product?.product_code || quotationData.products?.product_code || '-';
    const productName = row.products?.product_name || row.product?.product_name || row.product_name || quotationData.products?.product_name || quotationData.material_name || (quotationData.order_type === 'bulk' ? row.packing_type : null) || 'N/A';
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
      rowData['pack_wise_ltr_kg'] = Number(packLtrKg.toFixed(4));
      rowData['total_ltr_kg'] = Number((row.total_pcs * packLtrKg).toFixed(4));
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

    // Determine row height (based on product text which can be multiline )
    const prodText = (row.products?.product_name || row.product?.product_name || row.product_name || 'Product');
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
