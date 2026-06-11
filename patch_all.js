const fs = require('fs');

function patchExcel() {
  const file = 'd:/volkschem-oms/excel-generator/templates/internalQuotationTemplate.js';
  let code = fs.readFileSync(file, 'utf8');
  
  // Patch nos_per_carton
  code = code.replace(
    /rData\['nos_per_carton'\] = row\.nos_per_carton \|\| row\.nosPerCarton \|\| '-';/,
    \`let nosPerCarton = row.nos_per_carton || row.nosPerCarton || '-';
    let packTypeLower = (row.packing_type || '').toLowerCase();
    if (packTypeLower.includes('ampoule') && (nosPerCarton === '-' || !nosPerCarton)) {
      const pSize = (row.pack_size_value && row.pack_size_unit) ? \`\\$\\{row.pack_size_value\\}\\$\\{row.pack_size_unit\\}\`.toUpperCase().replace(/\\s/g, '') : '';
      const amp = { '1ML': 200, '2ML': 200, '5ML': 150, '10ML': 150, '25ML': 150 };
      if (amp[pSize]) nosPerCarton = amp[pSize];
    }
    rData['nos_per_carton'] = nosPerCarton;\`
  );

  // Add Total Production Amount row at the end
  code = code.replace(
    /return await workbook\.xlsx\.writeBuffer\(\);/,
    \`const gtRow = sheet.addRow([]);
  gtRow.height = 25;
  
  // Find total amount column index (it's the 'total_amount' key)
  const totalAmountColIdx = sheet.columns.findIndex(c => c.key === 'total_amount') + 1;
  const labelColIdx = totalAmountColIdx - 1;
  
  const gtCellLabel = gtRow.getCell(labelColIdx);
  gtCellLabel.value = 'Total Production Amount';
  setBold(gtCellLabel);
  setBorder(gtCellLabel);
  gtCellLabel.alignment = { horizontal: 'right', vertical: 'middle' };
  
  const gtCellVal = gtRow.getCell(totalAmountColIdx);
  gtCellVal.value = quotationData.rows.reduce((s, r) => s + (r.row_total_with_gst || 0), 0);
  gtCellVal.numFmt = '₹#,##0.00';
  setBg(gtCellVal, 'FFFFFF00');
  setBold(gtCellVal);
  setBorder(gtCellVal);
  
  return await workbook.xlsx.writeBuffer();\`
  );

  fs.writeFileSync(file, code);
  console.log('Patched excel');
}

function patchProductTable() {
  const file = 'd:/volkschem-oms/pdf-generator/sections/productTableSection.js';
  let code = fs.readFileSync(file, 'utf8');

  // Patch headers centering
  code = code.replace(
    /if \(isMaterialCol\) \{\s*doc\.text\(col\.label, currentX, currentY \+ 23, \{ width: col\.width, align: 'center' \}\);\s*\} else \{\s*doc\.text\(col\.label, currentX, currentY \+ 16, \{ width: col\.width, align: 'center' \}\);\s*\}/g,
    \`const h = doc.heightOfString(col.label, { width: col.width - 4 });
      if (isMaterialCol) {
        const yOffset = 18 + (27 - h) / 2;
        doc.text(col.label, currentX + 2, currentY + yOffset, { width: col.width - 4, align: 'center' });
      } else {
        const yOffset = (45 - h) / 2;
        doc.text(col.label, currentX + 2, currentY + yOffset, { width: col.width - 4, align: 'center' });
      }\`
  );
  
  code = code.replace(
    /doc\.text\(col\.label, currentX \+ 2, currentY \+ 5, \{ width: col\.width - 4, align: 'center' \}\);/g,
    \`const h = doc.heightOfString(col.label, { width: col.width - 4 });
      const yOffset = (45 - h) / 2;
      doc.text(col.label, currentX + 2, currentY + yOffset, { width: col.width - 4, align: 'center' });\`
  );

  // Patch nos_per_carton
  code = code.replace(
    /rowData\['nos_per_carton'\] = row\.nos_per_carton \|\| row\.nosPerCarton \|\| '-';/,
    \`let nosPerCarton = row.nos_per_carton || row.nosPerCarton || '-';
    let packTypeLower = (row.packing_type || '').toLowerCase();
    if (packTypeLower.includes('ampoule') && (nosPerCarton === '-' || !nosPerCarton)) {
      const pSize = (row.pack_size_value && row.pack_size_unit) ? \`\\$\\{row.pack_size_value\\}\\$\\{row.pack_size_unit\\}\`.toUpperCase().replace(/\\s/g, '') : '';
      const amp = { '1ML': 200, '2ML': 200, '5ML': 150, '10ML': 150, '25ML': 150 };
      if (amp[pSize]) nosPerCarton = amp[pSize];
    }
    rowData['nos_per_carton'] = nosPerCarton;\`
  );

  // Add Total Production Amount
  code = code.replace(
    /return currentY;/,
    \`
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

  return currentY;\`
  );

  fs.writeFileSync(file, code);
  console.log('Patched productTableSection');
}

function patchProductionTable() {
  const file = 'd:/volkschem-oms/pdf-generator/sections/productionTableSection.js';
  let code = fs.readFileSync(file, 'utf8');

  // Patch headers centering
  code = code.replace(
    /if \(isMaterialCol\) \{\s*doc\.text\(col\.label, currentX, currentY \+ 23, \{ width: col\.width, align: 'center' \}\);\s*\} else \{\s*doc\.text\(col\.label, currentX, currentY \+ 16, \{ width: col\.width, align: 'center' \}\);\s*\}/g,
    \`const h = doc.heightOfString(col.label, { width: col.width - 4 });
      if (isMaterialCol) {
        const yOffset = 18 + (27 - h) / 2;
        doc.text(col.label, currentX + 2, currentY + yOffset, { width: col.width - 4, align: 'center' });
      } else {
        const yOffset = (45 - h) / 2;
        doc.text(col.label, currentX + 2, currentY + yOffset, { width: col.width - 4, align: 'center' });
      }\`
  );
  
  code = code.replace(
    /doc\.text\(col\.label, currentX \+ 2, currentY \+ 5, \{ width: col\.width - 4, align: 'center' \}\);/g,
    \`const h = doc.heightOfString(col.label, { width: col.width - 4 });
      const yOffset = (45 - h) / 2;
      doc.text(col.label, currentX + 2, currentY + yOffset, { width: col.width - 4, align: 'center' });\`
  );

  // Patch nos_per_carton
  code = code.replace(
    /rowData\['nos_per_carton'\] = row\.nos_per_carton \|\| row\.nosPerCarton \|\| '-';/,
    \`let nosPerCarton = row.nos_per_carton || row.nosPerCarton || '-';
    let packTypeLower = (row.packing_type || '').toLowerCase();
    if (packTypeLower.includes('ampoule') && (nosPerCarton === '-' || !nosPerCarton)) {
      const pSize = (row.pack_size_value && row.pack_size_unit) ? \`\\$\\{row.pack_size_value\\}\\$\\{row.pack_size_unit\\}\`.toUpperCase().replace(/\\s/g, '') : '';
      const amp = { '1ML': 200, '2ML': 200, '5ML': 150, '10ML': 150, '25ML': 150 };
      if (amp[pSize]) nosPerCarton = amp[pSize];
    }
    rowData['nos_per_carton'] = nosPerCarton;\`
  );

  // Add Total Production Amount
  code = code.replace(
    /return currentY;/,
    \`
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

  return currentY;\`
  );

  fs.writeFileSync(file, code);
  console.log('Patched productionTableSection');
}

patchExcel();
patchProductTable();
patchProductionTable();
