import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { quotationService } from '../../services/dataService';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { format } from 'date-fns';
import { Eye, Send, Edit, Download, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MyOrders() {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchMine = () => {
    setLoading(true);
    quotationService.getAll({ mine: true })
      .then(({ data }) => setQuotations(data.data || []))
      .catch(() => setQuotations([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchMine(); }, []);

  const handleSubmit = async (id) => {
    try {
      await quotationService.submit(id);
      toast.success('Quotation submitted for approval.');
      fetchMine();
    } catch { /* handled */ }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to completely delete this quotation? This cannot be undone.')) {
      try {
        await quotationService.delete(id);
        toast.success('Quotation deleted successfully.');
        fetchMine();
      } catch {
        toast.error('Failed to delete quotation.');
      }
    }
  };

  const handleDownload = async (id, type, filename) => {
    try {
      const { data } = await quotationService.downloadPDF(id, type);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Download failed.'); }
  };

  const handleDownloadExcel = async (id, filename) => {
    try {
      const { data } = await quotationService.downloadExcel(id);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed.');
    }
  };

  const columns = [
    { key: 'quotation_number', header: 'Quotation Number', accessor: 'quotation_number' },
    { key: 'product', header: 'Product', render: (r) => {
      if (!r.quotation_rows || r.quotation_rows.length === 0) return '-';
      return (
        <div className="flex flex-col gap-0.5">
          {r.quotation_rows.map((row, idx) => {
            const prodName = row.products?.product_name || row.packing_type || 'N/A';
            const prodCode = row.products?.product_code ? ` (${row.products.product_code})` : '';
            return <span key={idx} className="whitespace-nowrap" title={`${prodName}${prodCode}`}>{prodName}{prodCode}</span>;
          })}
        </div>
      );
    } },
    { key: 'customer_name', header: 'Customer Name', accessor: 'customer_name' },
    { key: 'order_type', header: 'Order Type', render: (r) => <Badge status={r.order_type} /> },
    { key: 'status', header: 'Status', render: (r) => <Badge status={r.orders?.current_status || r.status} /> },
    { key: 'created_at', header: 'Created Date', render: (r) => r.created_at ? format(new Date(r.created_at), 'dd MMM yyyy') : '-' },
    { key: 'actions', header: 'Actions', sortable: false, render: (r) => {
      const prodStatus = r.orders?.current_status || r.status;
      const lrUrl = r.orders?.lr_attachments?.[0]?.file_url;
      return (
        <div className="flex flex-wrap gap-1">
          {r.status === 'draft' && (
            <>
              <Button variant="ghost" size="sm" icon={Edit} onClick={(e) => { e.stopPropagation(); navigate(`/employee/${r.order_type === 'bulk' ? 'create-bulk' : 'create-quotation'}?id=${r.id}`); }}>Edit</Button>
              <Button variant="ghost" size="sm" icon={Download} onClick={(e) => { e.stopPropagation(); handleDownload(r.id, 'draft', `${r.quotation_number}_draft.pdf`); }}>Draft PDF</Button>
              <Button variant="warning" size="sm" icon={Send} onClick={(e) => { e.stopPropagation(); handleSubmit(r.id); }}>Submit</Button>
            </>
          )}
          {r.status === 'pending' && (
            <>
              <Button variant="ghost" size="sm" icon={Eye} onClick={(e) => { e.stopPropagation(); navigate(`/employee/${r.order_type === 'bulk' ? 'create-bulk' : 'create-quotation'}?id=${r.id}&view=true`); }}>View</Button>
              <Button variant="ghost" size="sm" icon={Download} onClick={(e) => { e.stopPropagation(); handleDownload(r.id, 'draft', `${r.quotation_number}_draft.pdf`); }}>Draft PDF</Button>
            </>
          )}
          {(r.status === 'approved' || r.status === 'confirmed') && (
            <>
              <Button variant="ghost" size="sm" icon={Download} onClick={(e) => { e.stopPropagation(); handleDownload(r.id, 'customer', `${r.quotation_number}_customer.pdf`); }}>Customer PDF</Button>
              <Button variant="ghost" size="sm" icon={Download} onClick={(e) => { e.stopPropagation(); handleDownloadExcel(r.id, `${r.quotation_number}_excel.xlsx`); }}>Excel</Button>
            </>
          )}
          {prodStatus === 'dispatched' && lrUrl && (
            <a href={lrUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <Button variant="primary" size="sm" icon={Download}>Download LR</Button>
            </a>
          )}
          {['draft', 'pending', 'rejected'].includes(r.status) && (
            <button 
              onClick={(e) => handleDelete(e, r.id)}
              className="text-error/80 hover:text-error hover:bg-error/10 p-1.5 ml-1 rounded transition-colors"
              title="Delete Quotation"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      );
    }},
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">My Orders</h1>
        <p className="text-sm text-text-secondary mt-0.5">Track all your quotations and orders</p>
      </div>
      <Table columns={columns} data={quotations} loading={loading} searchPlaceholder="Search your orders..." />
    </div>
  );
}
