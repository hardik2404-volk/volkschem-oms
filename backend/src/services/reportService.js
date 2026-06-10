const supabase = require('../config/db');
const ExcelJS = require('exceljs');

async function generateOrdersExcel(range) {
  const now = new Date();
  let startDate, endDate;

  if (range === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (range === 'monthly') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  }

  // Fetch orders in date range, strictly sorted oldest to newest
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id, created_at,
      quotations!inner (
        quotation_number, name_on_label, billing_name, employee_name, customer_name, product_order_type,
        quotation_rows (
          packing_type, pack_size_value, pack_size_unit, total_pcs,
          products ( product_code, product_name )
        )
      )
    `)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true });

  if (error) throw error;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Orders');

  sheet.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Order ID / Quote No', key: 'order_id', width: 25 },
    { header: 'Product ID / Code', key: 'product_code', width: 20 },
    { header: 'Product Name', key: 'product_name', width: 35 },
    { header: 'Brand Name', key: 'brand_name', width: 25 },
    { header: 'Packing Type', key: 'packing_type', width: 20 },
    { header: 'Packing Size', key: 'packing_size', width: 15 },
    { header: 'Quantity (Pcs)', key: 'quantity', width: 15 },
    { header: 'Total Volume', key: 'total_volume', width: 15 },
    { header: 'Employee Name', key: 'employee_name', width: 25 }
  ];

  // Header Styling
  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E5631' } // Dark Forest Green
    };
    cell.font = {
      color: { argb: 'FFFFFFFF' },
      bold: true
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
      left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
      bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
      right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
    };
  });

  sheet.autoFilter = {
    from: 'A1',
    to: 'J1'
  };

  function applyDataRowStyling(row, i) {
    const isZebra = i % 2 === 1; // row 2 is even (not zebra), row 3 is odd (zebra)
    row.eachCell((cell, colNumber) => {
      // Alignment
      if ([1, 3, 7].includes(colNumber)) { // Date, Code, Size
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if ([8, 9].includes(colNumber)) { // Quantity, Total Volume
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }

      // Borders
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
        left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
        bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
        right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
      };

      // Zebra
      if (isZebra) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0FDF4' } // Soft green
        };
      }
    });
  }

  // Populate data
  let rowIndex = 2;
  for (const order of orders || []) {
    const q = order.quotations;
    const dateObj = new Date(order.created_at);
    const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${dateObj.getFullYear()}`;
    const orderId = `${order.id.substring(order.id.length - 8).toUpperCase()} / ${q.quotation_number}`;
    const employeeName = q.employee_name || '-';
    
    if (!q.quotation_rows || q.quotation_rows.length === 0) {
      const row = sheet.addRow({
        date: dateStr,
        order_id: orderId,
        product_code: '-',
        product_name: q.product_order_type === 'bulk' ? 'Bulk Material' : (q.customer_name || '-'),
        brand_name: q.name_on_label || q.billing_name || '-',
        packing_type: 'Bulk',
        packing_size: '-',
        quantity: 0,
        total_volume: '-',
        employee_name: employeeName
      });
      applyDataRowStyling(row, rowIndex++);
      continue;
    }

    for (const r of q.quotation_rows) {
      let vol = Number(r.total_ltr_kg) || 0;
      if (!vol && r.pack_size_value && r.total_pcs) {
        const unit = (r.pack_size_unit || '').toLowerCase().trim();
        let multiplier = 1;
        if (unit === 'ml' || unit === 'gm') multiplier = 0.001;
        vol = r.pack_size_value * multiplier * r.total_pcs;
      }
      const displayUnit = ['ml', 'ltr'].includes((r.pack_size_unit || '').toLowerCase().trim()) ? 'Ltr' : 'Kg';

      const row = sheet.addRow({
        date: dateStr,
        order_id: orderId,
        product_code: r.products?.product_code || '-',
        product_name: r.products?.product_name || '-',
        brand_name: q.name_on_label || q.billing_name || '-',
        packing_type: r.packing_type || '-',
        packing_size: `${r.pack_size_value || ''}${r.pack_size_unit || ''}`,
        quantity: r.total_pcs || 0,
        total_volume: vol ? `${vol.toFixed(2)} ${displayUnit}` : '-',
        employee_name: employeeName
      });
      applyDataRowStyling(row, rowIndex++);
    }
  }

  // Summary Row
  if (rowIndex > 2) {
    const totalRow = sheet.addRow({
      date: '', order_id: '', product_code: '', product_name: '', brand_name: '', packing_type: '',
      packing_size: 'Total:', quantity: { formula: `SUM(H2:H${rowIndex - 1})` }, total_volume: '', employee_name: ''
    });
    totalRow.font = { bold: true };
    totalRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
        left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
        bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
        right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
      };
      if (cell.col === 7 || cell.col === 8) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });
  }

  const rangePrefix = range === 'today' ? 'daily' : 'monthly';
  const dateSuffix = range === 'today' ? startDate.toISOString().split('T')[0] : startDate.toISOString().slice(0, 7);
  const filename = `volkschem_orders_${rangePrefix}_${dateSuffix}.xlsx`;

  return { workbook, filename };
}

module.exports = { generateOrdersExcel };
