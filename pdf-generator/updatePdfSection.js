const fs = require('fs');

const newFunc = `function generateProductTable(doc, quotationData, startY) {
  const margin = 30;
  let currentY = startY;

  let columns = [
    { label: 'Sr', key: 'sr', width: 20 },
    { label: 'PRODUCT NAME\\n(PRODUCT CODE)', key: 'product_name', width: 80 },
    { label: 'BRAND NAME', key: 'brand_name', width: 60 },
    { label: 'MRP', key: 'mrp', width: 35 },
    { label: 'NO.OF PCS\\nPER CARTON', key: 'nos_per_carton', width: 45 },
    { label: 'PACKIGING TYPE', key: 'packing_type', width: 70 },
    { label: 'BULK MATERIAL\\nRATE LTR/KG', key: 'bulk_rate', width: 50 },
    { label: 'PACKING SIZE', key: 'pack_size', width: 50 }
  ];

  const dynamicComponents = new Set();
  quotationData.rows.forEach(row => {
    (row.components || []).forEach(comp => {
      if (comp.is_checked && !comp.isBulkMaterial && !comp.component_name.toLowerCase().includes('bulk material')) {
        dynamicComponents.add(comp.component_name);
      }
    });
    if (row.pm_snapshot && !row.pm_snapshot.without_label) dynamicComponents.add('LABEL');
  });

  const orderedComps = ['AMPOULE', 'BOTTLE', 'LABEL', 'TRAY', 'FBB BOX', 'INNER BOX', 'OUTER BOX', 'SHRIK', 'M.CAP', 'CARTOON', 'JOB WORK'];
  const compArray = Array.from(dynamicComponents);
  compArray.sort((a, b) => {
    const idxA = orderedComps.indexOf(a.toUpperCase());
    const idxB = orderedComps.indexOf(b.toUpperCase());
    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
  });

  compArray.forEach(compName => {
    let shortName = compName.charAt(0).toUpperCase() + compName.slice(1).toLowerCase();
    if (shortName.toLowerCase().includes('ampoule')) shortName = 'Ampoule';
    columns.push({ label: \`\${shortName}\\nCOST PER PCS.\`, key: \`comp_\${compName.toUpperCase()}\`, width: 40 });
  });

  columns.push({ label: 'COST OF PRODUCT\\nPER PCS.\\n(Without GST)', key: 'cost_per_pcs', width: 60 });
  columns.push({ label: 'TOTAL\\nQUANTITY PCS.', key: 'total_pcs', width: 50 });
  columns.push({ label: 'AMOUNT', key: 'amount', width: 50 });
  columns.push({ label: 'GST', key: 'gst', width: 40 });
  columns.push({ label: 'TOTAL AMOUNT\\n(WITH GST)', key: 'total_amount', width: 60 });

  const pageWidth = doc.page.width - (margin * 2);
  const totalDesiredWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const scale = pageWidth / totalDesiredWidth;
  columns.forEach(col => col.width = col.width * scale);

  if (currentY > doc.page.height - 150) {
    doc.addPage();
    currentY = 40;
  }

  const headerHeight = 45;

  doc.font('NotoSans-Bold').fontSize(6).fillColor('#ffffff');
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
  doc.font('NotoSans').fontSize(7);

  quotationData.rows.forEach((row, index) => {
    if (currentY > doc.page.height - 100) {
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

  return currentY;
}
`;

let code = fs.readFileSync('sections/productTableSection.js', 'utf8');
code = code.replace(/function generateProductTable[\s\S]*?(?=module\.exports)/, newFunc + '\n\n');
fs.writeFileSync('sections/productTableSection.js', code);
console.log('productTableSection.js updated.');
