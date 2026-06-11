const fs = require('fs');
const execSync = require('child_process').execSync;

// 1. Reset file to HEAD
execSync('git checkout -- sections/productTableSection.js', { cwd: 'd:/volkschem-oms/pdf-generator' });

let code = fs.readFileSync('d:/volkschem-oms/pdf-generator/sections/productTableSection.js', 'utf8');

// 2. Rename original to Supervisor
code = code.replace(
  'function generateProductTable(doc, quotationData, startY, isFactoryView = false)',
  'function generateSupervisorTable(doc, quotationData, startY, isFactoryView = true)'
);

// 3. Inject new code before module.exports
const injectionCode = `
function generateCustomerTable(doc, quotationData, startY) {
  const margin = 30;
  let currentY = startY;

  let columns = [
    { label: 'Sr', key: 'sr', width: 20 },
    { label: 'PRODUCT NAME\\n[PRODUCT CODE]', key: 'product_name', width: 100 },
    { label: 'BRAND NAME', key: 'brand_name', width: 60 },
    { label: 'MRP', key: 'mrp', width: 35 },
    { label: 'NO.OF PCS\\nPER CARTON', key: 'nos_per_carton', width: 45 },
    { label: 'PACKIGING\\nTYPE', key: 'packing_type', width: 80 },
    { label: 'BULK MAT.\\nRATE LTR/KG', key: 'bulk_rate', width: 45 },
    { label: 'PACKING\\nSIZE', key: 'pack_size', width: 40 },
    { label: 'USED\\nLABELS', key: 'used_labels', width: 35 }
  ];

  const dynamicComponents = new Set();
  quotationData.rows.forEach(row => {
    (row.components || []).forEach(comp => {
      if (comp.is_checked && !comp.isBulkMaterial && !comp.component_name.toLowerCase().includes('bulk material')) {
        if (comp.component_name.toUpperCase() !== 'LABEL') {
          dynamicComponents.add(comp.component_name);
        }
      }
    });
  });

  const orderedComps = ['AMPOULE', 'BOTTLE', 'TRAY', 'FBB BOX', 'INNER BOX', 'OUTER BOX', 'JOB WORK'];
  const compArray = Array.from(dynamicComponents);
  compArray.sort((a, b) => {
    const idxA = orderedComps.indexOf(a.toUpperCase());
    const idxB = orderedComps.indexOf(b.toUpperCase());
    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
  });

  compArray.forEach(compName => {
    let shortName = compName.charAt(0).toUpperCase() + compName.slice(1).toLowerCase();
    if (shortName.toLowerCase().includes('ampoule')) shortName = 'Ampoule';
    columns.push({ label: shortName, key: \`comp_\${compName.toUpperCase()}\`, width: 35 });
  });

  columns.push(
    { label: 'COST OF\\nPRODUCT\\nPER PCS.', key: 'cost_per_pcs', width: 45 },
    { label: 'TOTAL\\nQUANTITY\\nPCS.', key: 'total_pcs', width: 45 },
    { label: 'AMOUNT', key: 'amount', width: 50 },
    { label: 'GST', key: 'gst', width: 40 },
    { label: 'TOTAL\\nAMOUNT\\n(WITH GST)', key: 'total_amount', width: 50 }
  );

  const materialCols = columns.filter(c => c.key.startsWith('comp_'));

  const pageWidth = doc.page.width - (margin * 2);
  const totalDesiredWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const scale = pageWidth / totalDesiredWidth;
  columns.forEach(col => col.width = col.width * scale);

  const headerHeight = 45;
  doc.rect(margin, currentY, pageWidth, headerHeight).fillAndStroke('#1B5E20', '#1B5E20');
  doc.fillColor('#FFFFFF').font('NotoSans-Bold').fontSize(5);
  let currentX = margin;

  if (materialCols.length > 0) {
    columns.forEach(col => {
      const isMaterialCol = materialCols.includes(col);
      const h = doc.heightOfString(col.label, { width: col.width - 4 });
      if (isMaterialCol) {
        const yOffset = 18 + (27 - h) / 2;
        doc.text(col.label, currentX + 2, currentY + yOffset, { width: col.width - 4, align: 'center' });
      } else {
        const yOffset = (45 - h) / 2;
        doc.text(col.label, currentX + 2, currentY + yOffset, { width: col.width - 4, align: 'center' });
      }
      currentX += col.width;
    });

    const startMatX = margin + columns.slice(0, columns.indexOf(materialCols[0])).reduce((sum, c) => sum + c.width, 0);
    const matTotalW = materialCols.reduce((sum, c) => sum + c.width, 0);
    doc.text('Per PCS Cost', startMatX, currentY + 6, { width: matTotalW, align: 'center' });
    doc.moveTo(startMatX, currentY + 20).lineTo(startMatX + matTotalW, currentY + 20).strokeColor('#FFFFFF').lineWidth(0.5).stroke();
    
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
    columns.forEach(col => {
      const h = doc.heightOfString(col.label, { width: col.width - 4 });
      const yOffset = (45 - h) / 2;
      doc.text(col.label, currentX + 2, currentY + yOffset, { width: col.width - 4, align: 'center' });
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
  doc.font('NotoSans').fontSize(6);

  quotationData.rows.forEach((row, index) => {
    const rowData = {};
    rowData['sr'] = index + 1;
    
    const pCode = row.products?.product_code || quotationData.products?.product_code || '-';
    const pName = row.products?.product_name || quotationData.products?.product_name || quotationData.material_name || '-';
    rowData['product_name'] = \`\${pName}\\n(\${pCode})\`;
    
    let brandName = quotationData.name_on_label || quotationData.brand_name || row.brand_name || row.products?.brand_name || '';
    if (!brandName || brandName === '-') brandName = pName;
    rowData['brand_name'] = brandName;
    
    rowData['mrp'] = row.mrp || '-';
    let nosPerCarton = row.nos_per_carton || row.nosPerCarton || '-';
    let packTypeLower = (row.packing_type || '').toLowerCase();
    if (packTypeLower.includes('ampoule') && (nosPerCarton === '-' || !nosPerCarton)) {
      const pSize = (row.pack_size_value && row.pack_size_unit) ? \`\${row.pack_size_value}\${row.pack_size_unit}\`.toUpperCase().replace(/\\s/g, '') : '';
      const amp = { '20ML': 200, '15ML': 200, '10ML': 200, '5ML': 500, '2ML': 500 };
      if (amp[pSize]) nosPerCarton = amp[pSize];
    }
    rowData['nos_per_carton'] = nosPerCarton;
    
    rowData['packing_type'] = row.packing_type || '-';
    rowData['bulk_rate'] = row.bulk_rate_per_ltr_kg ? row.bulk_rate_per_ltr_kg.toFixed(2) : '-';
    rowData['pack_size'] = (row.pack_size_value && row.pack_size_unit) ? \`\${row.pack_size_value} \${row.pack_size_unit}\` : '-';
    rowData['used_labels'] = (row.pm_snapshot && !row.pm_snapshot.without_label) ? row.total_pcs : '-';
    
    compArray.forEach(c => {
      let val = 0;
      const match = (row.components || []).find(comp => comp.component_name.toUpperCase() === c.toUpperCase() && comp.is_checked);
      if (match) val = match.cost_per_pcs || 0;
      rowData[\`comp_\${c.toUpperCase()}\`] = val ? val.toFixed(2) : '-';
    });
    
    rowData['cost_per_pcs'] = row.cost_per_pcs ? row.cost_per_pcs.toFixed(2) : '-';
    rowData['total_pcs'] = row.total_pcs || 0;
    rowData['amount'] = row.row_amount ? row.row_amount.toFixed(2) : '-';
    rowData['gst'] = row.gst_amount ? row.gst_amount.toFixed(2) : '-';
    rowData['total_amount'] = row.row_total_with_gst ? row.row_total_with_gst.toFixed(2) : '-';

    let maxRowHeight = 20;
    let tempX = margin;
    columns.forEach(col => {
      const text = String(rowData[col.key] || '');
      const h = doc.heightOfString(text, { width: col.width - 4 });
      if (h + 10 > maxRowHeight) maxRowHeight = h + 10;
    });

    if (currentY + maxRowHeight > doc.page.height - margin) {
      doc.addPage();
      currentY = margin;
    }

    doc.rect(margin, currentY, doc.page.width - (margin * 2), maxRowHeight).stroke('#dddddd');

    tempX = margin;
    columns.forEach(col => {
      doc.rect(tempX, currentY, col.width, maxRowHeight).stroke('#dddddd');
      doc.fillColor('#333333').text(String(rowData[col.key] || ''), tempX + 2, currentY + 5, {
        width: col.width - 4,
        align: col.key === 'product_name' || col.key === 'packing_type' ? 'left' : 'center'
      });
      tempX += col.width;
    });

    currentY += maxRowHeight;
  });

  const grandTotalAmt = quotationData.rows.reduce((sum, r) => sum + (r.row_total_with_gst || 0), 0);
  if (currentY + 25 > doc.page.height - margin) {
    doc.addPage();
    currentY = margin;
  }
  
  const totalAmountCol = columns.find(c => c.key === 'total_amount');
  const gstCol = columns.find(c => c.key === 'gst');
  
  const boxWidth = totalAmountCol.width + (gstCol ? gstCol.width : 50);
  const startX = doc.page.width - margin - boxWidth;
  
  doc.rect(startX, currentY, boxWidth, 20).fillAndStroke('#D1E7DD', '#1b5e20');
  doc.fillColor('#000000').font('NotoSans-Bold').fontSize(8);
  doc.text('Total Production Amount:', startX - 120, currentY + 6, { width: 110, align: 'right' });
  doc.text(grandTotalAmt.toFixed(2), startX, currentY + 6, { width: boxWidth, align: 'center' });
  currentY += 25;

  return currentY;
}

function generateProductTable(doc, quotationData, startY, isFactoryView = false) {
  if (isFactoryView) {
    return generateSupervisorTable(doc, quotationData, startY, isFactoryView);
  } else {
    return generateCustomerTable(doc, quotationData, startY);
  }
}
`;

code = code.replace('module.exports = { generateProductTable, formatCurrency };', injectionCode + '\nmodule.exports = { generateProductTable, formatCurrency };');

fs.writeFileSync('d:/volkschem-oms/pdf-generator/sections/productTableSection.js', code);
console.log('Successfully rebuilt productTableSection.js');
