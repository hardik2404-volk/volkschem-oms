import { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle2, User, Download } from 'lucide-react';
import { orderService, quotationService } from '../../services/dataService';
import dayjs from 'dayjs';
import { AMPOULE_PACKAGING } from '../../utils/constants';
import Button from '../../components/common/Button';
import toast from 'react-hot-toast';

export default function OrderDetailsModal({ order }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!order?.id) return;
    setLoading(true);
    orderService.getProgress(order.id)
      .then(({ data }) => setTimeline(data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [order]);

  if (!order) return null;

  return (
    <div className="space-y-6">
      {/* Overview Section */}
      <div className="grid grid-cols-2 gap-4 bg-surface-alt p-4 rounded-xl border border-border">
        <div>
          <p className="text-xs text-text-muted">Customer</p>
          <p className="font-semibold text-text-primary">{order.quotations?.customer_name}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Brand & Product</p>
          <p className="font-semibold text-text-primary">{order.quotations?.products?.product_name}</p>
          <p className="text-xs text-text-secondary">
            {order.quotations?.order_type === 'gujarat_brand' ? 'Volkschem' : (order.quotations?.name_on_label || order.quotations?.billing_name || 'Third Party')}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Order Placed</p>
          <p className="text-sm font-medium text-text-primary">{dayjs(order.created_at).format('DD MMM YYYY, hh:mm A')}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Handled By</p>
          <p className="text-sm font-medium text-text-primary">{order.quotations?.employee_name || 'Admin'}</p>
        </div>
      </div>

      {/* Production Specs */}
      <div>
        <h3 className="text-sm font-bold text-text-primary mb-3 uppercase tracking-wider flex items-center gap-2">
          <Package size={16} className="text-primary" /> Production Specs
        </h3>
        <div className="space-y-3">
          {order.quotations?.quotation_rows?.map((row, i) => {
            const packSize = `${row.pack_size_value}${row.pack_size_unit}`;
            const isAmpoule = row.packing_type === 'Ampoule' && AMPOULE_PACKAGING[packSize];

            return (
              <div key={i} className="bg-white border border-border rounded-lg p-3">
                <div className="flex justify-between items-center border-b border-border/50 pb-2 mb-2">
                  <span className="font-bold text-text-primary">{row.packing_type} — {packSize}</span>
                  <span className="text-sm font-semibold bg-primary-50 text-primary px-2 py-0.5 rounded">
                    {row.total_pcs} Pieces
                  </span>
                </div>
                
                {isAmpoule ? (
                  <div className="grid grid-cols-3 gap-4 text-sm text-center bg-surface-alt p-2 rounded">
                    <div>
                      <p className="text-xs text-text-muted">Trays / FBB</p>
                      <p className="font-semibold">{Math.ceil(row.total_pcs / AMPOULE_PACKAGING[packSize].trayPcs)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Inner Boxes</p>
                      <p className="font-semibold">{Math.ceil(row.total_pcs / AMPOULE_PACKAGING[packSize].innerBoxPcs)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Outer Boxes</p>
                      <p className="font-semibold">{row.total_cases || Math.ceil(row.total_pcs / AMPOULE_PACKAGING[packSize].outerBoxPcs)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-text-secondary">
                    Total Volume: <span className="font-medium text-text-primary">{row.total_ltr_kg} {row.pack_size_unit === 'ml' || row.pack_size_unit === 'ltr' ? 'Ltr' : 'Kg'}</span>
                    <span className="mx-2">•</span>
                    Total Cases: <span className="font-medium text-text-primary">{row.total_cases}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress Timeline */}
      <div>
        <h3 className="text-sm font-bold text-text-primary mb-3 uppercase tracking-wider flex items-center gap-2">
          <Clock size={16} className="text-info" /> Status Timeline
        </h3>
        
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-surface-dark rounded w-full"></div>
            <div className="h-10 bg-surface-dark rounded w-3/4"></div>
          </div>
        ) : timeline.length === 0 ? (
          <p className="text-sm text-text-muted">No timeline events recorded.</p>
        ) : (
          <div className="relative pl-4 space-y-6 before:absolute before:inset-y-2 before:left-[11px] before:w-0.5 before:bg-border">
            {timeline.map((event, i) => (
              <div key={event.id} className="relative">
                <div className={`absolute -left-[21px] w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${i === 0 ? 'bg-primary' : 'bg-border'}`}>
                  {i === 0 && <CheckCircle2 size={10} className="text-white" />}
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-bold capitalize ${i === 0 ? 'text-primary' : 'text-text-secondary'}`}>
                      {event.status.replace(/_/g, ' ')}
                    </p>
                    <span className="text-xs text-text-muted">{dayjs(event.created_at).format('DD MMM, HH:mm')}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-text-muted">
                    <User size={12} /> {event.updated_by_name}
                  </div>
                  {event.note && (
                    <div className="mt-2 text-sm bg-surface-alt p-2 rounded border border-border text-text-secondary">
                      {event.note}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Download Actions */}
      <div className="flex gap-2 pt-4 border-t border-border mt-6">
        <Button variant="secondary" icon={Download} onClick={async () => {
          try {
            const { data } = await quotationService.downloadPDF(order.quotations?.id, 'factory');
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${order.quotations?.quotation_number}_supervisor.pdf`;
            a.click();
            URL.revokeObjectURL(url);
          } catch { toast.error('Download failed.'); }
        }}>Supervisor PDF</Button>
        <Button variant="secondary" icon={Download} onClick={async () => {
          try {
            const { data } = await quotationService.downloadPDF(order.quotations?.id, 'production');
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${order.quotations?.quotation_number}_production.pdf`;
            a.click();
            URL.revokeObjectURL(url);
          } catch { toast.error('Download failed.'); }
        }}>Production PDF</Button>
      </div>
    </div>
  );
}
