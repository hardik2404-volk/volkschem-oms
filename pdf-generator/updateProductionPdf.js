const fs = require('fs');

const newFunc = `function drawRetailTable(doc, quotationData, startY, margin, dynamicComponentsArray) {
  let currentY = startY;

  let columns = [
    { label: 'Sr', key: 'sr', width: 20 },
    { label: 'PRODUCT NAME\\n(PRODUCT CODE)', key: 'product_name', width: 70 },
    { label: 'BRAND NAME', key: 'brand_name', width: 50 },
    { label: 'MRP', key: 'mrp', width: 35 },
    { label: 'NO.OF PCS\\nPER CARTON', key: 'nos_per_carton', width: 45 },
    { label: 'PACKIGING TYPE', key: 'packing_type', width: 60 },
    { label: 'BULK MATERIAL\\nRATE LTR/KG', key: 'bulk_rate', width: 45 },
    { label: 'PACKING SIZE', key: 'pack_size', width: 40 }
  ];

  const orderedComps = ['AMPOULE', 'BOTTLE', 'LABEL', 'TRAY', 'FBB BOX', 'INNER BOX', 'OUTER BOX', 'SHRIK', 'M.CAP', 'CARTOON', 'JOB WORK'];
  const compArray = Array.from(dynamicComponentsArray);
  compArray.sort((a, b) => {
    const idxA = orderedComps.indexOf(a.toUpperCase());
    const idxB = orderedComps.indexOf(b.toUpperCase());
    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
  });

  compArray.forEach(compName => {
    let shortName = compName.charAt(0).toUpperCase() + compName.slice(1).toLowerCase();
    if (shortName.toLowerCase().includes('ampoule')) shortName = 'Ampoule';
    columns.push({ label: \`\${shortName}\\nCOST PER PCS.\`, key: \`comp_\${compName.toUpperCase()}\`, width: 35 });
  });

  columns.push({ label: 'COST OF PRODUCT\\nPER PCS.\\n(Without GST)', key: 'cost_per_pcs', width: 45 });
  columns.push({ label: 'TOTAL\\nQUANTITY PCS.', key: 'total_pcs', width: 45 });
  columns.push({ label: 'AMOUNT', key: 'amount', width: 45 });
  columns.push({ label: 'GST', key: 'gst', width: 35 });
  columns.push({ label: 'TOTAL AMOUNT\\n(WITH GST)', key: 'total_amount', width: 50 });
  
  // Factory specifics
  columns.push({ label: 'PACK WISE\\nLTR / KG', key: 'pack_wise', width: 45 });
  columns.push({ label: 'TOTAL\\nLTR / KG', key: 'total_ltr', width: 45 });
  columns.push({ label: 'TOTAL\\nCASE', key: 'total_cases', width: 35 });

  const pageWidth = doc.page.width - (margin * 2);
  const totalDesiredWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const scale = pageWidth / totalDesiredWidth;
  columns.forEach(col => col.width = col.width * scale);

  const headerHeight = 45;

  doc.font('NotoSans-Bold').fontSize(5).fillColor('#ffffff');
  let currentX = margin;
  
  doc.rect(margin, currentY, doc.page.width - (margin * 2), headerHeight).fill('#1b5e20');
  
  columns.forEach(col => {
    doc.fillColor('#ffffff').text(col.label, currentX + 2, currentY + 5, {
      width: col.width - 4,
      align: 'center'
    });
    currentX += col.width;
  });

  currentY += headerHeight;
  doc.font('NotoSans').fontSize(6);
  
  let overallTotalLtrKg = 0;

  quotationData.rows.forEach((row, index) => {
    if (currentY > doc.page.height - 80) {
      doc.addPage();
      currentY = 40;
    }

    const rowData = {};
    rowData['sr'] = index + 1;
    
    const pCode = row.products?.product_code || quotationData.products?.product_code || '-';
    const pName = row.products?.product_name || quotationData.products?.product_name || quotationData.material_name || '-';
    rowData['product_name'] = \`\${pName}\\n(\${pCode})\`;
    
    let brandName = '-';
    if (quotationData.order_type === 'gujarat_brand') brandName = 'Volkschem';
    else if (quotationData.name_on_label) brandName = quotationData.name_on_label;
    else if (quotationData.brand_name) brandName = quotationData.brand_name;
    else if (row.brand_name) brandName = row.brand_name;
    else if (row.products?.brand_name) brandName = row.products?.brand_name;
    rowData['brand_name'] = brandName;
    
    rowData['mrp'] = row.mrp || '-';
    rowData['nos_per_carton'] = row.nos_per_carton || '-';
    
    let packTypeStr = row.packing_type || '-';
    if (compArray.length > 0) {
      packTypeStr += \` + \${compArray.join(' + ')}\`;
    }
    rowData['packing_type'] = packTypeStr;
    
    rowData['bulk_rate'] = row.bulk_rate_per_ltr_kg ? row.bulk_rate_per_ltr_kg.toFixed(2) : '-';
    rowData['pack_size'] = (row.pack_size_value && row.pack_size_unit) ? \`\${row.pack_size_value} \${row.pack_size_unit}\` : '-';
    
    compArray.forEach(c => {
      let val = 0;
      if (c.toUpperCase() === 'LABEL' && row.pm_snapshot) {
        val = row.pm_snapshot.rate_per_pm || 0;
      } else {
        const match = (row.components || []).find(comp => comp.component_name.toUpperCase() === c.toUpperCase() && comp.is_checked);
        if (match) val = match.cost_per_pcs || 0;
      }
      rowData[\`comp_\${c.toUpperCase()}\`] = val ? val.toFixed(2) : '-';
    });
    
    rowData['cost_per_pcs'] = row.cost_per_pcs ? row.cost_per_pcs.toFixed(2) : '-';
    rowData['total_pcs'] = row.total_pcs || 0;
    rowData['amount'] = row.row_amount ? row.row_amount.toFixed(2) : '-';
    rowData['gst'] = row.gst_amount ? row.gst_amount.toFixed(2) : '-';
    rowData['total_amount'] = row.row_total_with_gst ? row.row_total_with_gst.toFixed(2) : '-';

    // FACTORY CALCULATIONS
    const packWise = row.total_quantity_ltr_kg || 0;
    overallTotalLtrKg += packWise;
    
    rowData['pack_wise'] = packWise;
    rowData['total_ltr'] = overallTotalLtrKg;
    rowData['total_cases'] = row.total_cases || '-';

    let maxRowHeight = 15;
    let tempX = margin;
    columns.forEach(col => {
      const text = String(rowData[col.key] || '');
      const h = doc.heightOfString(text, { width: col.width - 2 });
      if (h + 8 > maxRowHeight) maxRowHeight = h + 8;
    });

    if (currentY + maxRowHeight > doc.page.height - margin) {
      doc.addPage();
      currentY = margin;
    }

    doc.rect(margin, currentY, doc.page.width - (margin * 2), maxRowHeight).stroke('#dddddd');

    tempX = margin;
    columns.forEach(col => {
      doc.rect(tempX, currentY, col.width, maxRowHeight).stroke('#dddddd');
      doc.fillColor('#333333').text(String(rowData[col.key] || ''), tempX + 1, currentY + 4, {
        width: col.width - 2,
        align: col.key === 'product_name' || col.key === 'packing_type' ? 'left' : 'center'
      });
      tempX += col.width;
    });

    currentY += maxRowHeight;
  });

  return currentY;
}
`;

let code = fs.readFileSync('sections/productionTableSection.js', 'utf8');
code = code.replace(/function drawRetailTable[\s\S]*?return renderTableGrid[\s\S]*?\n\}/, newFunc + '\n');
fs.writeFileSync('sections/productionTableSection.js', code);
console.log('productionTableSection.js updated.');
