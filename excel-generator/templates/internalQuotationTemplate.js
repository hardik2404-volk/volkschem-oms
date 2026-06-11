// ============================================================================
// VOLKSCHEM OMS — Internal Quotation Excel Template (Single Sheet Match)
// ============================================================================

const ExcelJS = require('exceljs');
const { formatIndianDate } = require('../../pdf-generator/utils/dateFormatter');
const { AMPOULE_PACKAGING } = require('../../quotation-engine/constants/ampoulePackagingStructure');

const INR_FORMAT = '[$₹-en-IN] #,##0.00';

function parseUnitMultiplier(unit) {
  if (!unit) return 1;
  const u = unit.toLowerCase().trim();
  if (u === 'ml' || u === 'gm') return 0.001;
  if (u === 'ltr' || u === 'kg') return 1;
  return 1;
}

async function generateInternalExcel(quotationData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Volkschem OMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Quotation');
  
  // Basic grid setup
  sheet.properties.defaultColWidth = 15;

  // ── Helper functions for styling ──
  const setBold = (cell) => { cell.font = { ...cell.font, bold: true }; };
  const setBg = (cell, argb) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }; };
  const setBorder = (cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  };

  // ── TOP CUSTOMER INFO SECTION ──
  const customerRows = [
    ['QUOTATION BY:', quotationData.employee_name || 'ADMIN', '', '', '', '', '', '', '', '', '', ''],
    ['GST NO. / PAN NO. :', quotationData.gst_pan || '', '', '', '', '', '', '', '', '', '', ''],
    ['CUSTOMER NAME:', quotationData.customer_name || '', '', '', '', '', '', '', '', '', '', ''],
    ['COMPANY NAME:', quotationData.billing_name || quotationData.customer_name || '', '', '', '', '', '', '', '', '', '', ''],
    ['CONTACT NO.', quotationData.customer_contact || '', '', '', '', '', '', '', '', '', '', ''],
    ['BILLING ADDRESS', quotationData.billing_address || '', '', '', '', '', '', '', '', '', '', ''],
    ['TRANSPORTS NAME :', quotationData.transport_name || '', '', '', '', '', '', '', '', '', '', ''],
    ['DELIVERY DESTINATION (WITH PIN CODE)', quotationData.destination || '', '', '', '', '', '', '', '', '', '', '']
  ];

  customerRows.forEach((rowData, i) => {
    const row = sheet.addRow(rowData);
    // Style the first column
    const cellA = row.getCell(1);
    setBold(cellA);
    setBorder(cellA);
    // Style second column
    const cellB = row.getCell(2);
    setBold(cellB);
    setBorder(cellB);
    sheet.mergeCells(i + 1, 2, i + 1, 4); // Merge value cells
  });

  // Adjust column 1 width
  sheet.getColumn(1).width = 35;

  // Has ampoule check
  const hasAmpoule = quotationData.rows.some(r => r.packing_type && r.packing_type.toLowerCase().includes('ampoule'));

  // ── DYNAMIC COLUMNS DISCOVERY ──
  const dynamicComponents = new Set();
  quotationData.rows.forEach(row => {
    row.components.forEach(comp => {
      if (comp.is_checked && !comp.isBulkMaterial && !comp.component_name.toLowerCase().includes('bulk material')) {
        dynamicComponents.add(comp.component_name);
      }
    });
  });

  const orderedComps = ['AMPOULE', 'BOTTLE', 'LABEL', 'TRAY', 'FBB BOX', 'INNER BOX', 'OUTER BOX', 'SHRIK', 'M.CAP', 'CARTOON', 'JOB WORK'];
  const compArray = Array.from(dynamicComponents);
  compArray.sort((a, b) => {
    const idxA = orderedComps.indexOf(a.toUpperCase());
    const idxB = orderedComps.indexOf(b.toUpperCase());
    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
  });

  // ── MID COLORED ROW ──
  const midRowData = [];
  midRowData[1] = 'BILLING NAME:';
  
  const midRow = sheet.addRow(midRowData);
  setBg(midRow.getCell(1), 'FFE0A890'); // Peach
  setBold(midRow.getCell(1));
  setBorder(midRow.getCell(1));

  // Determine positions for GST NAME / LABEL CO.NAME / DATE based on total columns
  // Base cols before components = 9
  // Comp cols = compArray.length
  // Trailing cols = 8
  const totalCols = 9 + compArray.length + 8;
  
  // Fill peach across middle
  for (let c = 2; c <= totalCols - 3; c++) {
    const cell = midRow.getCell(c);
    if (c === 6) {
      cell.value = 'LABEL CO.NAME';
      setBold(cell);
      cell.alignment = { horizontal: 'center' };
    }
    setBg(cell, 'FFE0A890');
    setBorder(cell);
  }
  
  // Date cells
  midRow.getCell(totalCols - 2).value = 'DATE:';
  setBg(midRow.getCell(totalCols - 2), 'FFFFFF00'); // Yellow
  setBold(midRow.getCell(totalCols - 2));
  setBorder(midRow.getCell(totalCols - 2));

  midRow.getCell(totalCols - 1).value = formatIndianDate(quotationData.quotation_date);
  setBg(midRow.getCell(totalCols - 1), 'FFFFFF00'); // Yellow
  setBold(midRow.getCell(totalCols - 1));
  setBorder(midRow.getCell(totalCols - 1));

  // ── PRODUCT HEADER ROW ──
  const headerRow = sheet.addRow([]);
  let colIdx = 1;

  const addHeader = (title, bg, width) => {
    const cell = headerRow.getCell(colIdx);
    cell.value = title;
    setBg(cell, bg);
    setBold(cell);
    setBorder(cell);
    cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
    sheet.getColumn(colIdx).width = width;
    colIdx++;
  };

  const cGreen = 'FF9CCC65';
  const cGold = 'FFFFB300';
  const cLightGreen = 'FFC5E1A5';

  addHeader('PRODUCT NAME OR (CODE NO.)', cGreen, 20);
  addHeader('PRODUCT ID', cGreen, 15);
  addHeader('BRAND NAME', cGreen, 15);
  addHeader('DOSE', cGreen, 12);
  addHeader('MRP', cGreen, 12);
  addHeader('NO.OF PCS PER CARTON', cGreen, 15);
  addHeader('PACKAGING TYPE (PM NAME WISE)', cGreen, 25);
  
  const bulkColor = hasAmpoule ? cGold : cLightGreen;
  addHeader('BULK MATERIAL RATE LTR/KG', bulkColor, 15);
  addHeader('PACKING SIZE', bulkColor, 15);
  addHeader('USED PM', bulkColor, 15);
  addHeader('BULK MATERIAL RATE PER UNIT', bulkColor, 15);

  compArray.forEach(compName => {
    addHeader(`${compName} COST PER PCS.`, cLightGreen, 12);
  });

  addHeader('COST OF PRODUCT PER PCS. (Without GST)', cGold, 18);
  addHeader('TOTAL QUANTITY PCS.', cLightGreen, 15);
  addHeader('AMOUNT', cLightGreen, 15);
  addHeader('GST', cLightGreen, 12);
  
  const totalColor = hasAmpoule ? cGold : cLightGreen;
  addHeader('TOTAL AMOUNT (WITH GST)', totalColor, 18);
  
  addHeader('PACK WISE LTR / KG', cLightGreen, 15);
  addHeader('TOTAL LTR / KG', cLightGreen, 15);
  addHeader('TOTAL CASE', cLightGreen, 12);

  headerRow.height = 60; // Make room for wrapped text

  // ── DATA ROWS ──
  const startRowIdx = sheet.lastRow.number;
  
  const productTotals = {};
  quotationData.rows.forEach(row => {
    const pCode = row.products?.product_code || row.product?.product_code || quotationData.products?.product_code || '-';
    const pName = row.products?.product_name || row.product?.product_name || quotationData.products?.product_name || quotationData.material_name || '-';
    const key = pCode !== '-' ? pCode : pName;
    if (!productTotals[key]) productTotals[key] = 0;
    productTotals[key] += (row.total_quantity_ltr_kg || 0);
  });

  quotationData.rows.forEach(row => {
    const dataRow = sheet.addRow([]);
    let cIdx = 1;

    const addCell = (val, isFinance = false) => {
      const cell = dataRow.getCell(cIdx);
      cell.value = val;
      setBorder(cell);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (isFinance) cell.numFmt = INR_FORMAT;
      cIdx++;
    };

    let nosPerCarton = row.nos_per_carton || 0;
    const isAmpoule = row.packing_type && row.packing_type.toLowerCase().includes('ampoule');
    if (isAmpoule) {
      const pSize = `${row.pack_size_value}${row.pack_size_unit?.toLowerCase()}`;
      const spec = AMPOULE_PACKAGING[pSize] || AMPOULE_PACKAGING['10ml'];
      nosPerCarton = spec.outerBoxPcs;
    }

    const packWise = row.total_quantity_ltr_kg || 0;
    const pCode = row.products?.product_code || row.product?.product_code || quotationData.products?.product_code || '-';
    const pName = row.products?.product_name || row.product?.product_name || quotationData.products?.product_name || quotationData.material_name || '-';
    const key = pCode !== '-' ? pCode : pName;
    const productTotalLtrKg = productTotals[key] || 0;

    let prodName = row.products?.product_name || quotationData.product_name || quotationData.material_name || (quotationData.order_type === 'bulk' ? row.packing_type : null) || '';
    if (quotationData.order_type === 'bulk' && row.container_variant) {
      prodName += `\nPacking: ${row.container_variant}`;
    }
    addCell(prodName);
    
    addCell(row.products?.product_code || row.product?.product_code || quotationData.products?.product_code || '-');
    addCell(quotationData.name_on_label || row.product?.brand_name || prodName || '-');
    addCell(row.products?.technical_combination || quotationData.technical_combination || '-');
    addCell(row.mrp || 0, true);
    addCell(nosPerCarton);
    addCell(row.packing_type || '');
    addCell(row.bulk_rate_per_ltr_kg || 0, true);
    addCell(quotationData.order_type === 'bulk' ? 'Bulk' : `${row.pack_size_value || ''} ${row.pack_size_unit || ''}`.trim());
    
    const pmSnapshot = row.pm_snapshot || row.label_snapshot;
    if (pmSnapshot && !pmSnapshot.withoutPM) {
        addCell(row.total_pcs);
    } else {
        addCell('-');
    }
    
    addCell(row.bulk_material_cost_per_pcs || 0, true);

    compArray.forEach(compName => {
      const comp = row.components.find(c => c.component_name === compName && c.is_checked);
      addCell(comp ? comp.cost_per_pcs : 0, true);
    });

    addCell(row.cost_per_pcs || 0, true);
    let qty = row.total_pcs || 0;
    if (quotationData.order_type === 'bulk') {
      const bQty = row.total_quantity_ltr_kg || 0;
      const u = (row.pack_size_unit === 'ml' || row.pack_size_unit === 'ltr') ? 'Ltr' : 'Kg';
      qty = `${bQty} ${u}`;
    }
    
    addCell(qty);
    addCell(row.row_amount || 0, true);
    addCell(row.gst_amount || 0, true);
    addCell(row.row_total_with_gst || 0, true);
    
    if (quotationData.order_type === 'bulk' || quotationData.order_type === 'bulk_material') {
      addCell(packWise ? Number(packWise.toFixed(4)) : '-');
      addCell(productTotalLtrKg ? Number(productTotalLtrKg.toFixed(4)) : '-');
      addCell(row.total_pcs || '-');
    } else {
      addCell(packWise ? Number(packWise.toFixed(4)) : '-');
      addCell(productTotalLtrKg ? Number(productTotalLtrKg.toFixed(4)) : '-');
      addCell(row.total_cases || 0);
    }
  });

  const endRowIdx = sheet.lastRow.number;

  // ── VERTICAL TEXT ON THE RIGHT (If not ampoule, e.g. HDPE BOTTLE) ──
  if (!hasAmpoule) {
    const vertText = 'HDPE BOTTLE'; // Could be dynamic based on general packing type
    const vertColIdx = totalCols;
    sheet.mergeCells(startRowIdx + 1, vertColIdx, endRowIdx, vertColIdx);
    const vCell = sheet.getCell(startRowIdx + 1, vertColIdx);
    vCell.value = vertText;
    vCell.alignment = { textRotation: -90, horizontal: 'center', vertical: 'middle' };
    setBg(vCell, 'FFFFB300'); // Orange/Gold
    setBold(vCell);
    setBorder(vCell);
  }

  // ── SUBTOTAL ROW ──
  const subTotalRow = sheet.addRow([]);
  // Let's place "TOTAL" next to Total Amount
  const totalAmountColIdx = 10 + compArray.length + 5;
  const tCellLabel = subTotalRow.getCell(totalAmountColIdx - 1);
  tCellLabel.value = 'TOTAL';
  setBg(tCellLabel, 'FFFFFF00'); // Yellow
  setBold(tCellLabel);
  setBorder(tCellLabel);
  tCellLabel.alignment = { horizontal: 'right' };

  const tCellVal = subTotalRow.getCell(totalAmountColIdx);
  // This is the subtotal (without labels)
  tCellVal.value = quotationData.subtotal + (quotationData.total_gst || 0);
  setBg(tCellVal, 'FFFFFF00');
  setBold(tCellVal);
  setBorder(tCellVal);
  tCellVal.numFmt = INR_FORMAT;

  // ── LABEL INVENTORY STRUCTURE ──
  let totalLabelPayable = 0;
  
  if (quotationData.rows && quotationData.rows.length > 0) {
    const labelRows = quotationData.rows.filter(r => {
      const snap = r.pm_snapshot || r.label_snapshot;
      return snap && !snap.withoutLabel && !snap.without_label;
    });
    if (labelRows.length > 0) {
      // Shift so that Label 'AMOUNT' aligns with Product 'AMOUNT' (which is 10 + length + 3)
      // Label 'AMOUNT' is offset + 10. So offset + 10 = 13 + compArray.length.
      const offset = 3 + compArray.length;

      // Title
      const invTitleRowData = new Array(offset).fill('');
      invTitleRowData.push('Packing Materials Stock Inventory Payment');
      const invTitle = sheet.addRow(invTitleRowData);
      const titleCell = invTitle.getCell(offset + 1);
      setBg(titleCell, 'FFE0A890'); // Peach background like the image
      setBold(titleCell);
      setBorder(titleCell);
      titleCell.alignment = { horizontal: 'center' };
      sheet.mergeCells(invTitle.number, offset + 1, invTitle.number, offset + 11);
      
      // Header
      const lHeaderData = new Array(offset).fill('');
      const labelHeaders = [
        'BRAND NAME', 'PACK TYPE', 'PACK SIZE', 'Available Stock', 
        'LABEL MADE', 'TOTAL STOCK', 'LABEL USED', 'CLO. STOCK', 
        'RATE', 'AMOUNT', 'GST'
      ];
      lHeaderData.push(...labelHeaders);
      const lHeader = sheet.addRow(lHeaderData);
      
      for (let i = 1; i <= 11; i++) {
        const cell = lHeader.getCell(offset + i);
        setBg(cell, 'FFE0A890'); // Peach
        setBold(cell);
        setBorder(cell);
        cell.alignment = { horizontal: 'center' };
      }

      labelRows.forEach(row => {
        const snap = row.pm_snapshot || row.label_snapshot;
        const brandName = quotationData.name_on_label || quotationData.brand_name || row.products?.product_name || '';
        
        let rate = 0, amount = 0, gst = 0;
        if (snap.is_new_batch) {
          rate = snap.rate_per_label || 0;
          amount = snap.amount || 0;
          gst = snap.gst_amount || 0;
          totalLabelPayable += parseFloat(snap.total_amount || snap.current_batch_total || 0);
        }

        const rowData = new Array(offset).fill('');
        rowData.push(
          brandName,
          snap.pack_type || row.packing_type || '',
          snap.pack_size || row.pack_size || '',
          snap.open_stock || 0,
          snap.is_new_batch ? (snap.make_quantity || 0) : 0,
          snap.total_stock || 0,
          snap.used_pcs || 0,
          snap.closing_stock_after || 0,
          rate,
          amount,
          gst
        );
        const lRow = sheet.addRow(rowData);

        for (let i = 1; i <= 11; i++) {
          const cell = lRow.getCell(offset + i);
          setBorder(cell);
          cell.alignment = { horizontal: 'center' };
          setBg(cell, 'FFE0A890'); // Peach background for the rows too!
        }
      });
      
      if (totalLabelPayable > 0) {
        const lTotalData = new Array(offset).fill('');
        lTotalData.push('TOTAL PAYABLE AMOUNT Rs.');
        const lTotal = sheet.addRow(lTotalData);
        
        const totalTextCell = lTotal.getCell(offset + 1);
        setBg(totalTextCell, 'FFE0A890'); // Peach
        setBold(totalTextCell);
        setBorder(totalTextCell);
        totalTextCell.alignment = { horizontal: 'right' };
        sheet.mergeCells(lTotal.number, offset + 1, lTotal.number, offset + 11);

        // Put the value in the next column (which is TOTAL AMOUNT WITH GST)
        const totalValCell = lTotal.getCell(totalAmountColIdx);
        totalValCell.value = totalLabelPayable;
        setBg(totalValCell, 'FFE0A890'); // Peach
        setBold(totalValCell);
        setBorder(totalValCell);
        totalValCell.numFmt = INR_FORMAT;
      }
    }
  }

  // ── GRAND TOTAL ROW ──
  const grandTotalRow = sheet.addRow([]);
  const gtCellLabel = grandTotalRow.getCell(totalAmountColIdx - 1);
  gtCellLabel.value = 'GRAND TOTAL';
  setBg(gtCellLabel, 'FFFFFF00'); // Yellow
  setBold(gtCellLabel);
  setBorder(gtCellLabel);
  gtCellLabel.alignment = { horizontal: 'right' };

  const gtCellVal = grandTotalRow.getCell(totalAmountColIdx);
  gtCellVal.value = quotationData.grand_total;
  setBg(gtCellVal, 'FFFFFF00'); // Yellow
  setBold(gtCellVal);
  setBorder(gtCellVal);
  gtCellVal.numFmt = INR_FORMAT;

  // ── AMPOULE PACKAGING STRUCTURE (If Applicable) ──
  if (hasAmpoule) {
    sheet.addRow([]); // Blank
    sheet.addRow([]); // Blank

    const aHeader = sheet.addRow(['INNER BOX FOR AMPOULES', 'OUTER BOX', 'FBB BOX', 'TRAY']);
    aHeader.eachCell((cell, colNumber) => {
      if(colNumber <= 4) {
        setBold(cell);
        setBorder(cell);
        cell.alignment = { horizontal: 'center' };
      }
    });

    const ampouleRows = quotationData.rows.filter(r => r.packing_type && r.packing_type.toLowerCase().includes('ampoule'));
    const sizes = [...new Set(ampouleRows.map(r => `${r.pack_size_value}${r.pack_size_unit.toLowerCase()}`))];

    sizes.forEach(size => {
      const spec = AMPOULE_PACKAGING[size];
      if (spec) {
        const pSize = size.toUpperCase();
        const innersInOuter = spec.outerBoxPcs / spec.innerBoxPcs;
        const innerText = `${pSize} x ${spec.innerBoxPcs} NOS= 1 INNER x ${innersInOuter} INNER=1 BOX`;
        const outerText = `${spec.outerBoxPcs} NOS`;
        const fbbText = `${pSize} x ${spec.fbbBoxPcs} NOS`;
        const trayText = `${pSize} x ${spec.trayPcs} NOS`;

        const aRow = sheet.addRow([innerText, outerText, fbbText, trayText]);
        aRow.eachCell((cell, colNumber) => {
          if(colNumber <= 4) {
            setBorder(cell);
            cell.alignment = { horizontal: 'center' };
          }
        });
      }
    });

    sheet.addRow([]);
    const n1 = sheet.addRow(['NOTE: FBB BOX PLAIN WHITE (WITHOUT PRINT)']);
    setBold(n1.getCell(1));
    const n2 = sheet.addRow(['NOTE: MOQ (Minimum Order Quantity) EACH PACK SIZE 1000 NOS']);
    setBold(n2.getCell(1));
  }

  return await workbook.xlsx.writeBuffer();
}

module.exports = { generateInternalExcel };
