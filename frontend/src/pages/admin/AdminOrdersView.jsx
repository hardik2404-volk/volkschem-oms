import { useState, useEffect } from 'react';
import { adminService, orderService } from '../../services/dataService';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { format } from 'date-fns';
import { Download, Edit, RefreshCw, Copy, Eye, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminOrdersView() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editStatusOpen, setEditStatusOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  const handleRepeatOrder = () => {
    if (selectedOrder.quotations?.order_type === 'product') {
      window.location.href = `/admin/create-quotation?repeatId=${selectedOrder.quotations.id}`;
    } else {
      window.location.href = `/admin/create-bulk?repeatId=${selectedOrder.quotations.id}`;
    }
  };

  const fetchOrders = () => {
    setLoading(true);
    adminService.getAllOrders()
      .then(({ data }) => setOrders(data.data || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const openDetail = (row) => {
    setSelectedOrder(row);
    setDetailOpen(true);
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

  const columns = [
    { key: 'order_number', header: 'Order ID', render: (r) => <span className="font-bold">{r.id.substring(r.id.length - 8).toUpperCase()}</span> },
    { key: 'quotation_number', header: 'Quotation ID', render: (r) => r.quotations?.quotation_number || '-' },
    { key: 'product', header: 'Product', render: (r) => {
      const q = r.quotations;
      if (!q || !q.quotation_rows || q.quotation_rows.length === 0) return '-';
      return (
        <div className="flex flex-col gap-0.5">
          {q.quotation_rows.map((row, idx) => {
            const prodName = row.products?.product_name || row.packing_type || 'N/A';
            const prodCode = row.products?.product_code ? ` (${row.products.product_code})` : '';
            return <span key={idx} className="whitespace-nowrap" title={`${prodName}${prodCode}`}>{prodName}{prodCode}</span>;
          })}
        </div>
      );
    } },
    { key: 'customer_name', header: 'Customer', render: (r) => r.quotations?.customer_name || '-' },
    { key: 'salesman', header: 'Salesman', render: (r) => r.quotations?.employee_name || '-' },
    { key: 'status', header: 'Status', render: (r) => <Badge status={r.current_status} /> },
    { key: 'confirmed_date', header: 'Confirmed Date', render: (r) => r.created_at ? format(new Date(r.created_at), 'dd MMM yyyy') : '-' },
    { key: 'dispatched_date', header: 'Dispatched Date', render: (r) => r.dispatched_at ? format(new Date(r.dispatched_at), 'dd MMM yyyy') : '-' },
    { key: 'actions', header: 'Actions', sortable: false, render: (r) => {
      const lrUrl = r.lr_attachments?.[0]?.file_url;
      return (
        <div className="flex items-center gap-3">
          {lrUrl ? (
            <a href={lrUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <Button variant="primary" size="sm" icon={Download}>Download LR</Button>
            </a>
          ) : <span className="text-text-muted">-</span>}
          <button 
            onClick={(e) => handleDelete(e, r.id)}
            className="text-error/80 hover:text-error hover:bg-error/10 p-1 rounded transition-colors"
            title="Delete Order"
          >
            <Trash2 size={18} />
          </button>
        </div>
      );
    }},
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">All Orders</h1>
        <p className="text-sm text-text-secondary mt-0.5">Track production and dispatch status</p>
      </div>

      <Table 
        columns={columns} 
        data={orders} 
        loading={loading} 
        onRowClick={openDetail}
        searchPlaceholder="Search orders..."
      />

      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title={`Order #${selectedOrder?.order_number || ''}`} size="lg"
        footer={
          <>
            <Button variant="secondary" icon={Copy} onClick={handleRepeatOrder}>Repeat Order</Button>
            <Button variant="secondary" onClick={() => setDetailOpen(false)}>Close</Button>
          </>
        }
      >
        {selectedOrder && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Badge status={selectedOrder.current_status} />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm bg-surface-alt p-4 rounded-lg">
              <div><span className="text-text-secondary">Quotation:</span> <span className="font-medium">{selectedOrder.quotations?.quotation_number}</span></div>
              <div><span className="text-text-secondary">Customer:</span> <span className="font-medium">{selectedOrder.quotations?.customer_name}</span></div>
              <div><span className="text-text-secondary">Destination:</span> <span className="font-medium">{selectedOrder.quotations?.destination || '-'}</span></div>
              <div><span className="text-text-secondary">Transport:</span> <span className="font-medium">{selectedOrder.quotations?.transport_name || '-'}</span></div>
            </div>

            {selectedOrder.current_status === 'dispatched' && selectedOrder.lr_attachments?.[0]?.file_url && (
              <div className="mt-4">
                <a href={selectedOrder.lr_attachments[0].file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline">
                  <Download size={16} /> Download LR Document
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
