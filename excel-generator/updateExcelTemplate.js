const fs = require('fs');

const newFunc = `async function generateInternalQuotationTemplate(workbook, quotationData) {
  const sheet = workbook.addWorksheet('Quotation Internal', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
    views: [{ showGridLines: false }]
  });

  const titleFormat = { font: { name: 'Calibri', bold: true, size: 10 }, alignment: { vertical: 'middle', horizontal: 'right' } };
  const valueFormat = { font: { name: 'Calibri', size: 10 }, alignment: { vertical: 'middle', horizontal: 'left' } };

  const addHeaderRow = (rNum, title, val) => {
    sheet.getCell(\`B\${rNum}\`).value = title;
    sheet.getCell(\`B\${rNum}\`).style = titleFormat;
    sheet.getCell(\`C\${rNum}\`).value = val || '';
    sheet.getCell(\`C\${rNum}\`).style = valueFormat;
    sheet.mergeCells(\`C\${rNum}:I\${rNum}\`);
    sheet.getRow(rNum).height = 18;
  };

  addHeaderRow(2, 'QUATATION BY:', quotationData.created_by_name || '-');
  addHeaderRow(3, 'GST NO. / PAN NO. :', quotationData.gst_pan || '-');
  addHeaderRow(4, 'BILLING NAME:', quotationData.billing_name || '-');
  addHeaderRow(5, 'CUSTOMER NAME:', quotationData.customer_name || '-');
  addHeaderRow(6, 'CONTACT NO.', quotationData.customer_contact || '-');
  addHeaderRow(7, 'BILLING ADDRESS:', quotationData.billing_address || '-');
  addHeaderRow(8, 'TRANSPORTS NAME :', quotationData.transport_name || '-');
  addHeaderRow(9, 'DELIVERY DESTINATION (WITH PIN CODE):', quotationData.destination || '-');

  // Top color bars
  sheet.mergeCells('B10:E10');
  sheet.getCell('B10').value = 'BILLING NAME:';
  sheet.getCell('B10').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFA07A' } };
  sheet.getCell('B10').font = { bold: true, size: 12 };
  
  sheet.mergeCells('F10:J10');
  sheet.getCell('F10').value = 'GST NAME';
  sheet.getCell('F10').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFDAB9' } };
  sheet.getCell('F10').font = { bold: true, size: 12 };
  sheet.getCell('F10').alignment = { horizontal: 'center' };

  sheet.mergeCells('K10:N10');
  sheet.getCell('K10').value = 'LABEL CO.NAME';
  sheet.getCell('K10').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFDAB9' } };
  sheet.getCell('K10').font = { bold: true, size: 12 };
  sheet.getCell('K10').alignment = { horizontal: 'center' };
  
  sheet.mergeCells('O10:V10');
  sheet.getCell('O10').value = 'NAME ON LABEL';
  sheet.getCell('O10').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFDAB9' } };
  sheet.getCell('O10').font = { bold: true, size: 12 };
  sheet.getCell('O10').alignment = { horizontal: 'center' };
  
  sheet.mergeCells('W10:Y10');
  sheet.getCell('W10').value = 'DATE:';
  sheet.getCell('W10').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  sheet.getCell('W10').font = { bold: true, size: 12 };
  sheet.getCell('W10').alignment = { horizontal: 'center' };

  // Dynamic Components detection
  const dynamicComponents = new Set();
  quotationData.rows.forEach(row => {
    (row.components || []).forEach(comp => {
      if (comp.is_checked && !comp.isBulkMaterial && !comp.component_name.toLowerCase().includes('bulk material')) {
        dynamicComponents.add(comp.component_name);
      }
    });
    if (row.pm_snapshot) dynamicComponents.add('LABEL');
  });

  const orderedComps = ['BOTTLE', 'LABEL', 'SHRIK', 'MEASURING CAP', 'CARTOON', 'JOB WORK', 'AMPOULE', 'TRAY', 'FBB BOX', 'INNER BOX', 'OUTER BOX'];
  const compArray = Array.from(dynamicComponents);
  compArray.sort((a, b) => {
    const idxA = orderedComps.indexOf(a.toUpperCase());
    const idxB = orderedComps.indexOf(b.toUpperCase());
    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
  });

  // Table Headers
  const baseHeaders = [
    { header: 'PRODUCT NAME\\n[PRODUCT CODE]', key: 'product_name', width: 20 },
    { header: 'BRAND NAME', key: 'brand_name', width: 15 },
    { header: 'MRP', key: 'mrp', width: 10 },
    { header: 'NO.OF PCS\\nPER CARTON', key: 'nos_per_carton', width: 12 },
    { header: 'PACKIGING TYPE\\n(BOTTLE NAME +\\nALL PM NAME)', key: 'packing_type', width: 20 },
    { header: 'BULK MATERIAL\\nRATE LTR/KG', key: 'bulk_rate', width: 15 },
    { header: 'PACKING SIZE', key: 'pack_size', width: 12 }
  ];

  const compHeaders = compArray.map(c => {
    let name = c.toUpperCase();
    if (name === 'MEASURING CAP') name = 'M.CAP';
    return { header: \`\${name}\\nCOST PER PCS.\`, key: \`comp_\${c.toUpperCase()}\`, width: 12 };
  });

  const endHeaders = [
    { header: 'COST OF PRODUCT\\nPER PCS.\\n(Without GST)', key: 'cost_per_pcs', width: 18 },
    { header: 'TOTAL QUANTITY\\nPCS.', key: 'total_pcs', width: 15 },
    { header: 'AMOUNT', key: 'amount', width: 15 },
    { header: 'GST', key: 'gst', width: 12 },
    { header: 'TOTAL AMOUNT\\n(WITH GST)', key: 'total_amount', width: 18 },
    { header: 'PACK WISE\\nLTR / KG', key: 'pack_wise', width: 12 },
    { header: 'TOTAL LTR / KG', key: 'total_ltr', width: 12 },
    { header: 'TOTAL CASE', key: 'total_cases', width: 12 }
  ];

  sheet.columns = [
    { header: '', key: 'emptyA', width: 2 },
    ...baseHeaders,
    ...compHeaders,
    ...endHeaders
  ];

  const headerRow = sheet.getRow(11);
  headerRow.height = 60;
  
  sheet.columns.forEach((col, idx) => {
    if (idx === 0) return;
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };
    cell.font = { name: 'Calibri', bold: true, size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' }
    };
  });

  let overallTotalLtrKg = 0;

  quotationData.rows.forEach(row => {
    const rData = { emptyA: '' };
    
    const pCode = row.products?.product_code || quotationData.products?.product_code || '-';
    const pName = row.products?.product_name || quotationData.products?.product_name || quotationData.material_name || '-';
    rData['product_name'] = \`\${pName}\\n[\${pCode}]\`;
    
    let brandName = '-';
    if (quotationData.order_type === 'gujarat_brand') brandName = 'Volkschem';
    else if (quotationData.name_on_label) brandName = quotationData.name_on_label;
    else if (quotationData.brand_name) brandName = quotationData.brand_name;
    else if (row.brand_name) brandName = row.brand_name;
    else if (row.products?.brand_name) brandName = row.products?.brand_name;
    rData['brand_name'] = brandName;
    
    rData['mrp'] = row.mrp || '-';
    rData['nos_per_carton'] = row.nos_per_carton || '-';
    
    let packTypeStr = row.packing_type || '-';
    if (compArray.length > 0) packTypeStr += \` + \${compArray.join(' + ')}\`;
    rData['packing_type'] = packTypeStr;
    
    rData['bulk_rate'] = row.bulk_rate_per_ltr_kg || 0;
    rData['pack_size'] = (row.pack_size_value && row.pack_size_unit) ? \`\${row.pack_size_value} \${row.pack_size_unit}\` : '-';
    
    compArray.forEach(c => {
      let val = 0;
      if (c.toUpperCase() === 'LABEL' && row.pm_snapshot) val = row.pm_snapshot.rate_per_pm || 0;
      else {
        const match = (row.components || []).find(comp => comp.component_name.toUpperCase() === c.toUpperCase() && comp.is_checked);
        if (match) val = match.cost_per_pcs || 0;
      }
      rData[\`comp_\${c.toUpperCase()}\`] = val;
    });
    
    rData['cost_per_pcs'] = row.cost_per_pcs || 0;
    rData['total_pcs'] = row.total_pcs || 0;
    rData['amount'] = row.row_amount || 0;
    rData['gst'] = row.gst_amount || 0;
    rData['total_amount'] = row.row_total_with_gst || 0;
    
    const packWise = row.total_quantity_ltr_kg || 0;
    overallTotalLtrKg += packWise;
    rData['pack_wise'] = packWise;
    rData['total_ltr'] = overallTotalLtrKg;
    rData['total_cases'] = row.total_cases || '-';

    const addedRow = sheet.addRow(rData);
    addedRow.height = 25;
    
    addedRow.eachCell((cell, colNumber) => {
      if (colNumber > 1) {
        cell.font = { name: 'Calibri', size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        
        const colKey = sheet.getColumn(colNumber).key;
        if (['mrp', 'bulk_rate', 'cost_per_pcs', 'amount', 'gst', 'total_amount'].includes(colKey) || colKey.startsWith('comp_')) {
          cell.numFmt = '₹#,##0.00';
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // Yellow for numbers
        } else if (['total_pcs', 'pack_wise', 'total_ltr', 'total_cases'].includes(colKey)) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }; // Grey for totals
        }
      }
    });
  });

  return workbook;
}
`;

let code = fs.readFileSync('templates/internalQuotationTemplate.js', 'utf8');
code = code.replace(/async function generateInternalQuotationTemplate[\s\S]*?(?=module\.exports)/, newFunc + '\n\n');
fs.writeFileSync('templates/internalQuotationTemplate.js', code);
console.log('internalQuotationTemplate.js updated.');
