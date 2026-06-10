import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService, reportService } from '../../services/dataService';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { TableSkeleton } from '../../components/common/Loader';
import {
  ShoppingCart, Clock, IndianRupee, UsersRound,
  CheckCircle2, Cog, Package, Truck, CircleCheckBig,
  ArrowRight, MoreVertical, ChevronRight, Download
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

function formatINR(amount) {
  if (amount == null) return '₹0';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

const summaryCards = [
  { key: 'quotations_today',   label: 'Total Orders Today', icon: ShoppingCart,  color: 'text-primary',      bg: 'bg-primary-50',   border: 'border-primary/20',   spark: 'text-primary-lighter' },
  { key: 'pending_approvals',  label: 'Pending Approvals',  icon: Clock,         color: 'text-action',       bg: 'bg-action-light', border: 'border-action/20',    spark: 'text-action' },
  { key: 'month_revenue',    label: 'Revenue This Month', icon: IndianRupee,   color: 'text-info',         bg: 'bg-info-light',   border: 'border-info/20',      spark: 'text-info', isCurrency: true },
  { key: 'active_salesmen',    label: 'Active Salesmen',    icon: UsersRound,    color: 'text-[#00897B]',    bg: 'bg-[#E0F2F1]',   border: 'border-[#00897B]/20', spark: 'text-[#00897B]' },
];

const pipelineSteps = [
  { key: 'confirmed',     label: 'Confirmed',     icon: CheckCircle2, color: 'bg-primary',     text: 'text-primary' },
  { key: 'in_production', label: 'In Production', icon: Cog,          color: 'bg-action',      text: 'text-action' },
  { key: 'packing',       label: 'Packing',       icon: Package,      color: 'bg-info',        text: 'text-info' },
  { key: 'dispatched',    label: 'Dispatched',    icon: Truck,        color: 'bg-[#5C6BC0]',  text: 'text-[#5C6BC0]' },
];

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    adminService.getDashboard()
      .then(({ data }) => setDashboard(data.data))
      .catch(() => {
        // Use fallback data for display
        setDashboard({
          quotations_today: 0, pending_approvals: 0, month_revenue: 0, active_salesmen: 0,
          recent_quotations: [], order_pipeline: { confirmed: 0, in_production: 0, packing: 0, dispatched: 0 },
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const [downloading, setDownloading] = useState('');

  const handleDownloadReport = async (range) => {
    try {
      setDownloading(range);
      const { data } = await reportService.downloadOrdersExcel(range);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      
      const dateSuffix = range === 'today' ? new Date().toISOString().split('T')[0] : new Date().toISOString().slice(0, 7);
      a.download = `volkschem_orders_${range === 'today' ? 'daily' : 'monthly'}_${dateSuffix}.xlsx`;
      
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded successfully!');
    } catch (err) {
      toast.error('Failed to download report.');
    } finally {
      setDownloading('');
    }
  };

  const today = format(new Date(), 'EEEE, dd MMMM yyyy');

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-secondary mt-0.5">{today}</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            icon={Download} 
            loading={downloading === 'today'}
            onClick={() => handleDownloadReport('today')}
          >
            Download Today's Orders
          </Button>
          <Button 
            variant="primary" 
            icon={Download} 
            loading={downloading === 'monthly'}
            onClick={() => handleDownloadReport('monthly')}
          >
            Download Monthly Orders
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {summaryCards.map((card) => (
          <div
            key={card.key}
            className={`bg-white rounded-xl border ${card.border} p-5 shadow-card hover:shadow-card-hover transition-shadow duration-200`}
          >
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon size={20} className={card.color} />
              </div>
              <p className="text-xs text-text-muted font-medium">{card.label}</p>
            </div>
            <p className={`text-3xl font-bold mt-3 ${card.color}`}>
              {loading ? '—' : card.isCurrency ? formatINR(dashboard?.[card.key]) : dashboard?.[card.key] || 0}
            </p>
            {/* Sparkline placeholder */}
            <svg className="w-full h-6 mt-2" viewBox="0 0 120 20">
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className={card.spark}
                points="0,15 15,12 30,14 45,8 60,10 75,6 90,9 105,4 120,7"
              />
            </svg>
          </div>
        ))}
      </div>

      {/* Recent Quotations */}
      <div className="bg-white rounded-xl border border-border shadow-card mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-text-primary">Recent Quotations</h2>
          <button
            onClick={() => navigate('/admin/quotations')}
            className="text-primary text-sm font-medium hover:underline"
          >
            View All
          </button>
        </div>

        {loading ? (
          <TableSkeleton rows={5} cols={7} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Quote ID', 'Customer', 'Salesman', 'Amount', 'Status', 'Date', 'Actions'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(dashboard?.recent_quotations || []).slice(0, 5).map((q, i) => (
                  <tr key={q.id || i} className="border-b border-border last:border-b-0 hover:bg-primary-50/30 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-text-primary">{q.quotation_number}</td>
                    <td className="px-5 py-3 text-sm text-text-primary">{q.customer_name}</td>
                    <td className="px-5 py-3 text-sm text-text-secondary">{q.employee_name || '-'}</td>
                    <td className="px-5 py-3 text-sm font-medium text-text-primary">{formatINR(q.grand_total)}</td>
                    <td className="px-5 py-3"><Badge status={q.status} /></td>
                    <td className="px-5 py-3 text-sm text-text-secondary">
                      {q.quotation_date ? format(new Date(q.quotation_date), 'dd MMM yyyy') : '-'}
                    </td>
                    <td className="px-5 py-3">
                      <button className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-surface-alt">
                        <MoreVertical size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {(!dashboard?.recent_quotations || dashboard.recent_quotations.length === 0) && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-text-muted text-sm">No recent quotations</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-3 border-t border-border">
          <button
            onClick={() => navigate('/admin/quotations')}
            className="text-primary text-sm font-medium hover:underline inline-flex items-center gap-1"
          >
            View All Quotations <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Order Pipeline */}
      <div className="bg-white rounded-xl border border-border shadow-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-text-primary">Order Pipeline</h2>
          <button
            onClick={() => navigate('/admin/orders')}
            className="text-primary text-sm font-medium hover:underline"
          >
            View All Orders
          </button>
        </div>
        <div className="flex items-center justify-around px-5 py-8 flex-wrap gap-4">
          {pipelineSteps.map((step, i) => (
            <div key={step.key} className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <div className={`w-14 h-14 rounded-full ${step.color}/10 flex items-center justify-center`}>
                  <step.icon size={24} className={step.text} />
                </div>
                <p className="text-xs font-medium text-text-secondary">{step.label}</p>
                <p className={`text-xl font-bold ${step.text}`}>
                  {loading ? '—' : dashboard?.order_pipeline?.[step.key] || 0}
                </p>
              </div>
              {i < pipelineSteps.length - 1 && (
                <ArrowRight size={20} className="text-border-dark mt-[-20px]" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
