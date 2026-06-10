import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuotation } from '../../context/QuotationContext';
import { quotationService } from '../../services/dataService';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { Send, Save, CheckCircle2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

function formatINR(a) {
  return a == null ? '-' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(a);
}

function SectionCard({ title, children, action }) {
  return (
    <div className="bg-white border border-border rounded-xl mb-5">
      <div className="px-5 py-3 border-b border-border flex justify-between items-center">
        <h3 className="text-sm font-bold text-text-primary">{title}</h3>
        {action && <div>{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function Step5ReviewSubmit() {
  const { state, resetWizard, resetProductState, addLineItem, removeLineItem, editLineItem, goToStep } = useQuotation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const isViewMode = searchParams.get('view') === 'true';
  const [saving, setSaving] = useState(false);

  const allItems = useMemo(() => {
    let items = state.lineItems.map((item, i) => ({ ...item, isActive: false, lineItemIndex: i }));
    if (state.product && state.rows.length > 0) {
      items.push({
        product: state.product,
        orderType: state.orderType,
        productBulkRate: state.productBulkRate,
        packingType: state.packingType,
        packingVariant: state.packingVariant,
        packSize: state.packSize,
        packSizeValue: state.packSizeValue,
        packSizeUnit: state.packSizeUnit,
        rows: state.rows,
        components: state.components,
        labelData: state.labelData,
        isActive: true,
        lineItemIndex: -1,
      });
    }
    return items;
  }, [state]);

  const overallSubtotal = allItems.reduce((acc, item) => acc + (item.rows[0]?.rowAmount || 0), 0);
  const overallGst = allItems.reduce((acc, item) => acc + (item.rows[0]?.gstAmount || 0), 0);
  const overallLabels = (state.labelDataArray || []).reduce((acc, ld) => {
    return acc + (ld?.isNewBatch ? (ld.totalLabelCost || 0) : 0);
  }, 0);
  const grandTotal = overallSubtotal + overallGst + overallLabels;

  const buildPayload = (status) => ({
    order_type: 'product',
    product_order_type: allItems[0]?.orderType || 'gujarat_brand',
    status,
    ...state.header,
    rows: allItems.map((item, index) => {
      const r = item.rows[0];
      return {
        product_id: item.product?.id,
        row_number: index + 1,
        packing_type: r.packingType,
        container_variant: r.packingVariant,
        pack_size: r.packSize,
        pack_size_value: r.packSizeValue,
        pack_size_unit: r.packSizeUnit,
        bulk_rate_per_ltr_kg: item.productBulkRate,
        bulk_material_cost_per_pcs: r.costPerPcs || 0,
        cost_per_pcs: r.costPerPcs,
        total_quantity_ltr_kg: parseFloat(r.totalQuantityLtrKg) || 0,
        total_pcs: r.totalPcs,
        nos_per_carton: parseInt(r.nosPerCarton) || 0,
        mrp: parseFloat(r.mrp) || 0,
        total_cases: r.outerBoxCount || r.totalCases,
        row_amount: r.rowAmount,
        gst_rate: item.product?.gst_rate || 18,
        gst_amount: r.gstAmount,
        row_total_with_gst: r.rowTotal,
        components: item.components,
      };
    }),
    subtotal: overallSubtotal,
    total_gst: overallGst,
    grand_total: grandTotal,
    labelDataArray: state.labelDataArray || [],
  });

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      if (editId) {
        await quotationService.update(editId, buildPayload('draft'));
      } else {
        await quotationService.create(buildPayload('draft'));
      }
      toast.success('Quotation saved as draft.');
      resetWizard();
      navigate(-1);
    } catch { /* handled by api interceptor */ }
    finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    if (allItems.length === 0) {
      toast.error('No products added to the quotation.');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await quotationService.update(editId, buildPayload('pending'));
      } else {
        await quotationService.create(buildPayload('pending'));
      }
      toast.success('Quotation submitted for admin approval!');
      resetWizard();
      navigate(-1);
    } catch { /* handled */ }
    finally { setSaving(false); }
  };

  const handleAddAnotherProduct = () => {
    if (state.product && state.rows.length > 0) {
      addLineItem(); // Save current product to lineItems
    }
    resetProductState(); // Reset product selections
    goToStep(1); // Jump to Step 1 (Brand & Product)
  };

  const handleEditProduct = (isActive, lineItemIndex) => {
    if (isActive) {
      goToStep(1);
    } else {
      if (state.product && state.rows.length > 0) {
        addLineItem();
      }
      editLineItem(lineItemIndex);
      goToStep(1);
    }
  };

  const handleDeleteProduct = (isActive, lineItemIndex) => {
    if (isActive) {
      resetProductState();
    } else {
      removeLineItem(lineItemIndex);
    }
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-text-primary">Review & Submit</h2>
        {!isViewMode && (
          <Button variant="outline" icon={Plus} onClick={handleAddAnotherProduct}>
            Add Another Product
          </Button>
        )}
      </div>

      {/* ── Order Header ── */}
      <SectionCard title="Customer Details">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-4 text-sm">
          <div><span className="text-text-muted">Date:</span> <span className="font-medium">{state.header?.quotation_date}</span></div>
          <div><span className="text-text-muted">Customer:</span> <span className="font-medium">{state.header?.customer_name}</span></div>
          <div><span className="text-text-muted">Contact:</span> <span className="font-medium">{state.header?.customer_contact || '—'}</span></div>
          <div><span className="text-text-muted">Destination:</span> <span className="font-medium">{state.header?.destination || '—'}</span></div>
          <div><span className="text-text-muted">Transport:</span> <span className="font-medium">{state.header?.transport_name || '—'}</span></div>
          <div><span className="text-text-muted">GST/PAN:</span> <span className="font-medium">{state.header?.gst_pan || '—'}</span></div>
        </div>
      </SectionCard>

      {/* ── Products List ── */}
      {allItems.map((item, index) => {
        const totalPcs = parseInt(item.rows?.[0]?.totalPcs) || 0;
        const gstRate = parseFloat(item.product?.gst_rate) || 18;
        const costPP = parseFloat(item.rows?.[0]?.costPerPcs) || 0;
        const totalCases = parseInt(item.rows?.[0]?.totalCases) || 0;
        
        return (
          <SectionCard 
            key={index} 
            title={`Product ${index + 1}: ${item.product?.product_name} (${item.packingType} - ${item.packSize})`}
            action={
              !isViewMode && (
                <div className="flex gap-4">
                  <button onClick={() => handleEditProduct(item.isActive, item.lineItemIndex)} className="text-primary hover:underline text-xs font-medium">Edit</button>
                  <button onClick={() => handleDeleteProduct(item.isActive, item.lineItemIndex)} className="text-danger hover:underline text-xs font-medium">Remove</button>
                </div>
              )
            }
          >
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
               <div><p className="text-text-muted text-xs">Total Qty</p><p className="font-semibold text-text-primary">{item.rows?.[0]?.totalQuantityLtrKg || '—'} Ltr/Kg</p></div>
               <div><p className="text-text-muted text-xs">Total Pieces</p><p className="font-semibold text-text-primary">{totalPcs.toLocaleString('en-IN')}</p></div>
               <div><p className="text-text-muted text-xs">Total Cases</p><p className="font-semibold text-text-primary">{totalCases.toLocaleString('en-IN')}</p></div>
               <div><p className="text-text-muted text-xs">Cost/Piece (Ex-GST)</p><p className="font-semibold text-primary">₹ {costPP.toFixed(2)}</p></div>
               <div><p className="text-text-muted text-xs">Total Row Amount</p><p className="font-semibold text-text-primary">{formatINR(item.rows?.[0]?.rowTotal)}</p></div>
             </div>
             
             {(() => {
               const ld = state.labelDataArray[index];
               if (!ld) return null;
               if (!ld.isNewBatch && !ld.includeInQuotation) return null;
               
               return (
                 <div className={`mt-4 p-4 border rounded-lg ${ld.isNewBatch ? 'border-warning bg-warning-light/10' : 'border-success bg-success-light/10'}`}>
                   <div className="flex justify-between items-center mb-2">
                     <h4 className="font-semibold text-sm">{ld.isNewBatch ? 'New Label Batch Required' : 'Label Inventory Status'}</h4>
                     {ld.isNewBatch && <span className="font-bold text-primary">+ {formatINR(ld.totalLabelCost)}</span>}
                   </div>
                   <table className="w-full text-xs text-left">
                     <thead>
                       <tr className="text-text-muted border-b">
                         <th className="pb-1 font-medium">Pack Size</th>
                         <th className="pb-1 font-medium text-right">Printed (Make)</th>
                         <th className="pb-1 font-medium text-right">Used</th>
                         <th className="pb-1 font-medium text-right">Closing Stock</th>
                         {ld.isNewBatch && <th className="pb-1 font-medium text-right">Rate</th>}
                       </tr>
                     </thead>
                     <tbody>
                       <tr>
                         <td className="py-1">{ld.packSize}</td>
                         <td className="py-1 text-right">{ld.isNewBatch ? ld.batchQuantity?.toLocaleString() : '0'}</td>
                         <td className="py-1 text-right text-error">{ld.usedPcs?.toLocaleString()}</td>
                         <td className="py-1 text-right font-medium">{ld.closingStockAfter?.toLocaleString()}</td>
                         {ld.isNewBatch && <td className="py-1 text-right">₹{ld.ratePerLabel}</td>}
                       </tr>
                     </tbody>
                   </table>
                 </div>
               );
             })()}
          </SectionCard>
        );
      })}

      {/* ── Grand Total ── */}
      <div className="flex justify-end mb-6">
        <div className="w-80 bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Subtotal:</span>
            <span className="font-semibold">{formatINR(overallSubtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Total GST:</span>
            <span className="font-semibold">{formatINR(overallGst)}</span>
          </div>
          {overallLabels > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Labels Total:</span>
              <span className="font-semibold">{formatINR(overallLabels)}</span>
            </div>
          )}
          <hr className="border-primary/20" />
          <div className="flex justify-between text-lg font-bold text-primary">
            <span>Grand Total:</span>
            <span>{formatINR(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      {!isViewMode && (
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button variant="secondary" icon={Save} onClick={handleSaveDraft} loading={saving}>
            Save as Draft
          </Button>
          <Button variant="warning" icon={Send} onClick={handleSubmit} loading={saving}>
            Submit to Admin
          </Button>
        </div>
      )}
    </div>
  );
}
