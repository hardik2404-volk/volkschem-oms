import { useState, useEffect } from 'react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { adminService } from '../../services/dataService';
import { Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

function formatINR(a) { return a == null ? '₹0' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(a); }

export default function EmployeePerformanceModal({ isOpen, onClose, employee }) {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (isOpen && employee) {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      
      setLoading(true);
      adminService.getAllOrders({ 
        salesman: employee.full_name,
        from_date: firstDay,
        to_date: lastDay
      })
      .then(({ data }) => setOrders(data.data || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
    }
  }, [isOpen, employee]);

  const totalRevenue = orders.reduce((sum, o) => sum + (o.quotations?.grand_total || 0), 0);

  const downloadExcel = () => {
    const headers = ['Date', 'Quotation Number', 'Customer', 'Destination', 'Status', 'Grand Total (INR)'];
    const rows = orders.map(o => [
      new Date(o.created_at).toLocaleDateString('en-IN'),
      o.quotations?.quotation_number || '-',
      o.quotations?.customer_name || '-',
      o.quotations?.destination || '-',
      o.current_status || '-',
      o.quotations?.grand_total || 0
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${employee.full_name}_Performance_${new Date().toLocaleString('default', { month: 'short', year: 'numeric' })}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!employee) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${employee.full_name}'s Performance - Current Month`} size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button icon={Download} onClick={downloadExcel} disabled={orders.length === 0}>Download Report</Button>
        </>
      }
    >
      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : (
        <div className="space-y-4">
          <div className="bg-primary-50 p-4 rounded-xl border border-primary/20 flex justify-between items-center">
            <div>
              <p className="text-sm text-text-secondary">Total Orders This Month</p>
              <p className="text-2xl font-bold text-primary">{orders.length}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-text-secondary">Total Revenue Generated</p>
              <p className="text-2xl font-bold text-primary">{formatINR(totalRevenue)}</p>
            </div>
          </div>
          
          <div className="max-h-96 overflow-y-auto border border-border rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-surface-alt sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 font-semibold text-text-secondary">Date</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary">Quote #</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary">Customer</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary">Status</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.length === 0 ? (
                  <tr><td colSpan="5" className="px-4 py-6 text-center text-text-muted">No orders found for the current month.</td></tr>
                ) : (
                  orders.map(o => (
                    <tr key={o.id} className="hover:bg-surface-alt transition-colors">
                      <td className="px-4 py-3">{new Date(o.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-3 font-medium text-primary">{o.quotations?.quotation_number || '-'}</td>
                      <td className="px-4 py-3">{o.quotations?.customer_name || '-'}</td>
                      <td className="px-4 py-3 uppercase text-xs font-semibold">{o.current_status}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatINR(o.quotations?.grand_total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
