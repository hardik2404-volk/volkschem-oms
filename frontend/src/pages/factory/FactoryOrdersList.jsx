import { useState, useEffect } from 'react';
import { orderService, quotationService } from '../../services/dataService';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import ProgressUpdater from './ProgressUpdater';
import LRUpload from './LRUpload';
import OrderDetailsModal from './OrderDetailsModal';
import { Download, ChevronDown, Package, FileText, CheckCircle2, Box, Truck, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { AMPOULE_PACKAGING } from '../../utils/constants';

export default function FactoryOrdersList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchOrders = () => {
    setLoading(true);
    orderService.getAll(statusFilter ? { status: statusFilter } : {})
      .then(({ data }) => {
        const d = data.data || [];
        setOrders(statusFilter ? d : d.filter(o => o.current_status !== 'dispatched'));
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const handleOpenUpdate = (order) => {
    setSelectedOrder(order);
    setUpdateModalOpen(true);
  };

  const handleOpenDetails = (order) => {
    setSelectedOrder(order);
    setDetailsModalOpen(true);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to completely delete this order and its quotation? This cannot be undone.')) {
      try {
        await orderService.delete(id);
        toast.success('Order deleted successfully.');
        fetchOrders();
      } catch {
        toast.error('Failed to delete order.');
      }
    }
  };

  const handleDownloadPdf = async (e, r, type) => {
    e.stopPropagation();
    try {
      const { data } = await quotationService.downloadPDF(r.quotations?.id, type);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${r.quotations?.quotation_number}_${type === 'factory' ? 'supervisor' : type}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { 
      toast.error('Download failed.'); 
    }
  };

  const handleUpdateComplete = () => {
    setUpdateModalOpen(false);
    fetchOrders();
  };

  const columns = [
    { key: 'order_number', header: 'Order ID', accessor: (r) => r.id + ' ' + r.quotations?.customer_name + ' ' + r.quotations?.products?.product_name, render: (r) => (
      <button onClick={() => handleOpenDetails(r)} className="font-bold text-primary hover:underline text-left">
        {r.id.substring(r.id.length - 8).toUpperCase()}
      </button>
    )},
    { key: 'product_id', header: 'Product ID', render: (r) => {
      const rows = r.quotations?.quotation_rows || [];
      const productIds = Array.from(new Set(rows.map(row => row.products?.product_code).filter(Boolean)));
      return productIds.length > 0 ? productIds.join(', ') : '-';
    }},
    { key: 'product', header: 'Product & Brand', render: (r) => {
      const rows = r.quotations?.quotation_rows || [];
      const productNames = Array.from(new Set(rows.map(row => row.products?.product_name).filter(Boolean)));
      return (
        <div>
          <p className="font-semibold text-text-primary">{productNames.length > 0 ? productNames.join(', ') : '-'}</p>
          <p className="text-xs text-text-muted">{r.quotations?.order_type === 'gujarat_brand' ? 'Volkschem' : (r.quotations?.name_on_label || r.quotations?.billing_name || '-')}</p>
        </div>
      );
    }},
    { key: 'packing', header: 'Packing Type & Size', render: (r) => (
      <div className="flex flex-col gap-1">
        {r.quotations?.quotation_rows?.map((row, i) => (
          <div key={i} className="flex items-center gap-1.5 text-sm">
            <Package size={14} className="text-text-muted flex-shrink-0" />
            <span className="whitespace-nowrap">{row.packing_type} — {row.pack_size_value}{row.pack_size_unit}</span>
          </div>
        ))}
      </div>
    )},
    { key: 'total_volume', header: 'Total Volume', render: (r) => {
      const rows = r.quotations?.quotation_rows || [];
      let displayUnit = 'Ltr/Kg';
      if (rows.length > 0) {
        const u = (rows[0].pack_size_unit || '').toLowerCase().trim();
        if (u === 'ml' || u === 'ltr') displayUnit = 'Ltr';
        else if (u === 'gm' || u === 'kg') displayUnit = 'Kg';
      }

      const totalVolume = rows.reduce((sum, row) => {
        let vol = Number(row.total_ltr_kg) || 0;
        if (!vol && row.pack_size_value && row.total_pcs) {
          const unit = (row.pack_size_unit || '').toLowerCase().trim();
          let multiplier = 1;
          if (unit === 'ml' || unit === 'gm') multiplier = 0.001;
          vol = row.pack_size_value * multiplier * row.total_pcs;
        }
        return sum + vol;
      }, 0);
      return <span className="font-semibold text-primary">{totalVolume.toFixed(2)} {displayUnit}</span>;
    }},
    { key: 'qty_breakdown', header: 'Production Breakdown', render: (r) => (
      <div className="flex flex-col gap-3">
        {r.quotations?.quotation_rows?.map((row, i) => {
          let vol = Number(row.total_ltr_kg) || 0;
          if (!vol && row.pack_size_value && row.total_pcs) {
            const unit = (row.pack_size_unit || '').toLowerCase().trim();
            let multiplier = 1;
            if (unit === 'ml' || unit === 'gm') multiplier = 0.001;
            vol = row.pack_size_value * multiplier * row.total_pcs;
          }
          const displayUnit = ['ml', 'ltr'].includes((row.pack_size_unit || '').toLowerCase().trim()) ? 'Ltr' : 'Kg';

          const productName = row.products?.product_name || row.product?.product_name || row.product_name || r.quotations?.products?.product_name || r.quotations?.material_name || 'N/A';
          const technical = row.products?.technical_combination || row.product?.technical_combination || row.technical_combination || r.quotations?.products?.technical_combination || 'No Technical Data';

          return (
            <div key={i} className="bg-surface-alt rounded-lg p-3 text-xs border border-border">
              <div className="mb-2 pb-2 border-b border-border">
                <p className="font-bold text-primary text-sm">{productName}</p>
                <p className="text-text-muted font-medium">{technical}</p>
                <p className="text-success-dark font-bold mt-1">Batch Volume: {vol > 0 ? vol.toFixed(2) : '-'} {displayUnit}</p>
              </div>

              <p className="font-bold text-text-primary mb-1">{row.total_pcs} Pcs ({row.packing_type}s) — {row.pack_size_value}{row.pack_size_unit}</p>
              {row.packing_type?.toLowerCase() === 'ampoule' && (
                (() => {
                  const pSize = `${row.pack_size_value}${row.pack_size_unit?.toLowerCase()}`;
                  const spec = AMPOULE_PACKAGING[pSize] || AMPOULE_PACKAGING['10ml'];
                  return (
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-text-muted mt-1.5">
                      <div>Trays / FBB: <span className="font-semibold text-text-primary">{Math.ceil(row.total_pcs / spec.fbbBoxPcs)}</span></div>
                      <div>Inner Boxes: <span className="font-semibold text-text-primary">{Math.ceil(row.total_pcs / spec.innerBoxPcs)}</span></div>
                      <div>Outer Boxes (Cases): <span className="font-semibold text-text-primary">{row.total_cases}</span></div>
                    </div>
                  );
                })()
              )}
              {row.packing_type?.toLowerCase() !== 'ampoule' && (
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-text-muted mt-1.5">
                  <div>Outer Boxes (Cases): <span className="font-semibold text-text-primary">{row.total_cases}</span></div>
                  <div>Items / Carton: <span className="font-semibold text-text-primary">{row.nos_per_carton}</span></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    )},
    { key: 'admin_note', header: 'Notes', render: (r) => (
      <div className="flex flex-col gap-1 max-w-[200px]">
        {r.quotations?.admin_note && (
          <div className="bg-warning-light border border-warning/30 text-warning-dark text-xs px-2 py-1 rounded truncate" title={`Admin: ${r.quotations.admin_note}`}>
            <span className="font-semibold">Admin:</span> {r.quotations.admin_note}
          </div>
        )}
        {r.factory_note && (
          <div className="bg-action-light border border-action/30 text-action-dark text-xs px-2 py-1 rounded truncate" title={`Factory: ${r.factory_note}`}>
            <span className="font-semibold">Factory:</span> {r.factory_note}
          </div>
        )}
        {!r.quotations?.admin_note && !r.factory_note && '-'}
      </div>
    )},
    { key: 'status', header: 'Status', render: (r) => (
      <div className="flex flex-col gap-1 items-start">
        <Badge status={r.current_status} />
        {r.current_status === 'dispatched' && !r.lr_document_url && (
          <span className="text-xs text-action font-medium flex items-center gap-1">
            <Download size={12} /> LR Pending
          </span>
        )}
      </div>
    )},
    { key: 'actions', header: 'Action', sortable: false, render: (r) => (
      <div className="flex flex-col gap-1 items-end">
        <Button 
          variant={r.current_status === 'dispatched' ? 'ghost' : 'primary'} 
          size="sm" 
          onClick={(e) => { e.stopPropagation(); handleOpenUpdate(r); }}
        >
          {r.current_status === 'dispatched' ? 'View Status' : 'Update Status'}
        </Button>
        <div className="flex gap-1 mt-1">
          <button 
            onClick={(e) => handleDownloadPdf(e, r, 'production')}
            className="text-action/80 hover:text-action hover:bg-action/10 p-1.5 rounded transition-colors"
            title="Download Production PDF"
          >
            <FileText size={16} />
          </button>
          <button 
            onClick={(e) => handleDownloadPdf(e, r, 'factory')}
            className="text-primary/80 hover:text-primary hover:bg-primary/10 p-1.5 rounded transition-colors"
            title="Download Supervisor PDF"
          >
            <Download size={16} />
          </button>
          <button 
            onClick={(e) => handleDelete(e, r.id)}
            className="text-error/70 hover:text-error hover:bg-error/10 p-1.5 rounded transition-colors"
            title="Delete Order"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    )},
  ];

  const summaryCounts = {
    total: orders.length,
    in_production: orders.filter(o => o.current_status === 'in_production').length,
    quality_check: orders.filter(o => o.current_status === 'quality_check').length,
    packing: orders.filter(o => o.current_status === 'packing').length,
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-text-primary">Confirmed Production Orders</h1>
        <p className="text-sm text-text-secondary mt-0.5">Manage production flow</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-primary-50 text-primary p-2 rounded-lg"><FileText size={20} /></div>
            <div>
              <p className="text-xs text-text-muted font-medium">Total Active</p>
              <p className="text-xl font-bold text-text-primary">{summaryCounts.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-info-light text-info-dark p-2 rounded-lg"><Box size={20} /></div>
            <div>
              <p className="text-xs text-text-muted font-medium">In Production</p>
              <p className="text-xl font-bold text-text-primary">{summaryCounts.in_production}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-warning-light text-warning-dark p-2 rounded-lg"><CheckCircle2 size={20} /></div>
            <div>
              <p className="text-xs text-text-muted font-medium">Quality Check</p>
              <p className="text-xl font-bold text-text-primary">{summaryCounts.quality_check}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-action-light text-action p-2 rounded-lg"><Package size={20} /></div>
            <div>
              <p className="text-xs text-text-muted font-medium">Packing</p>
              <p className="text-xl font-bold text-text-primary">{summaryCounts.packing}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters based on design */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'All', value: '' },
          { label: 'In Production', value: 'in_production' },
          { label: 'Quality Check', value: 'quality_check' }, // Optional based on design
          { label: 'Packing', value: 'packing' }, // Based on design img
          { label: 'Ready', value: 'ready_to_dispatch' },
        ].map(f => (
          <button
            key={f.label}
            onClick={() => setStatusFilter(f.value)}
            className={`px-4 py-1.5 text-sm font-medium rounded-full border transition-colors ${
              statusFilter === f.value 
                ? 'bg-primary text-white border-primary' 
                : 'bg-white text-text-secondary border-border hover:border-primary-lighter'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Table 
        columns={columns} 
        data={orders} 
        loading={loading} 
        searchPlaceholder="Search by Order ID, Product or Brand..." 
      />

      {/* Status Update Modal */}
      <Modal 
        isOpen={updateModalOpen} 
        onClose={() => setUpdateModalOpen(false)} 
        title={`Update Order: ${selectedOrder?.id?.substring(selectedOrder?.id?.length - 8).toUpperCase()}`}
        size="md"
      >
        <ProgressUpdater 
          order={selectedOrder} 
          onUpdate={handleUpdateComplete} 
          onCancel={() => setUpdateModalOpen(false)} 
        />
      </Modal>

      {/* Order Details Modal */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={`Order Details: ${selectedOrder?.id?.substring(selectedOrder?.id?.length - 8).toUpperCase()}`}
        size="lg"
      >
        <OrderDetailsModal order={selectedOrder} />
      </Modal>
    </div>
  );
}
