import { useState, useEffect } from 'react';
import { useQuotation } from '../../context/QuotationContext';
import api from '../../services/api';
import { PackageSearch, CheckCircle2, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import Input from '../../components/common/Input';

export default function LabelManagementBlock({ rowIndex, row }) {
  const { state, getLabelDataForRow, updateLabelDataForRow } = useQuotation();
  const labelData = getLabelDataForRow(rowIndex) || {};
  
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const customerId = state.header?.customer_id;
  const productId = state.product?.id;
  const packSize = `${row?.packSizeValue}${row?.packSizeUnit}`;
  const packType = row?.packingType;
  const totalPcs = row?.totalPcs || 0;

  useEffect(() => {
    if (!customerId || !productId || !packSize || !packType || totalPcs === 0) return;
    
    let isMounted = true;
    const fetchInventory = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/labels/inventory/${customerId}/${productId}/${packSize}?packType=${packType}&requiredPcs=${totalPcs}`);
        if (isMounted) {
          const inv = res.data.data;
          setData(inv);
          
          const isNewBatch = inv.isFirstOrder || !inv.sufficient;
          const shortfall = inv.shortfall || 0;
          const minQty = isNewBatch ? Math.max(1000, shortfall) : 0;
          
          let defaultRate = 0;
          try {
            const rateRes = await api.get('/cost-sheet');
            const allRates = rateRes.data.data.rates || [];
            const labelRates = allRates.filter(r => r.category.includes('label'));
            const norm = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '');
            const nSize = norm(packSize);
            const variantLabel = state.packingVariant || '';
            
            let match = labelRates.find(r => norm(r.size) === nSize && 
                (norm(r.item_name) === norm(variantLabel) || norm(variantLabel).includes(norm(r.item_name)) || norm(r.item_name) === 'label'));
            
            if (!match && labelRates.length > 0) match = labelRates.find(r => norm(r.size) === nSize);
            if (!match && labelRates.length > 0) match = labelRates[0];
            if (match) defaultRate = match.rate;
          } catch (err) {
            console.error("Failed to fetch default label rate:", err);
          }

          const currentData = getLabelDataForRow(rowIndex) || {};
          const initialRate = currentData.ratePerLabel !== undefined && currentData.ratePerLabel !== '' ? currentData.ratePerLabel : defaultRate;
          const initialGstRate = currentData.gstRate !== undefined ? currentData.gstRate : 18;
          
          const amount = (isNewBatch ? minQty : 0) * (parseFloat(initialRate) || 0);
          const gst = amount * (initialGstRate / 100);

          const newLabelData = {
            rowIndex,
            customerId,
            productId,
            packSize,
            packType,
            brandName: state.product?.brand_name || '',
            isNewBatch,
            batchQuantity: currentData.batchQuantity || (isNewBatch ? minQty : 0),
            ratePerLabel: initialRate,
            gstRate: initialGstRate,
            usedPcs: totalPcs,
            includeInQuotation: currentData.includeInQuotation !== undefined ? currentData.includeInQuotation : !isNewBatch,
            currentStock: inv.currentStock,
            closingStockAfter: isNewBatch ? (inv.currentStock + minQty - totalPcs) : (inv.currentStock - totalPcs),
            amount,
            gst,
            totalLabelCost: amount + gst,
          };
          
          updateLabelDataForRow(rowIndex, newLabelData);
        }
      } catch (err) {
        console.error("Label inventory fetch error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    fetchInventory();
    return () => { isMounted = false; };
  }, [customerId, productId, packSize, packType, totalPcs]);

  const handleInputChange = (field, value) => {
    let val = value;
    if (field === 'batchQuantity') {
      val = parseInt(value) || 0;
      if (val < 1000) {
        setErrorMsg('Minimum 1000 labels required');
      } else {
        setErrorMsg('');
      }
    }
    
    const qty = field === 'batchQuantity' ? val : (parseInt(labelData.batchQuantity) || 0);
    const rate = field === 'ratePerLabel' ? (parseFloat(value) || 0) : (parseFloat(labelData.ratePerLabel) || 0);
    const gstRate = field === 'gstRate' ? (parseFloat(value) || 0) : (parseFloat(labelData.gstRate) || 0);
    const amount = qty * rate;
    const gst = amount * (gstRate / 100);
    
    updateLabelDataForRow(rowIndex, {
      ...labelData,
      [field]: value,
      amount,
      gst,
      totalLabelCost: amount + gst,
      closingStockAfter: labelData.isNewBatch ? ((data ? (data.currentStock || 0) : 0) + qty - totalPcs) : (data ? (data.currentStock || 0) - totalPcs : 0),
    });
  };

  const NO_LABEL_TYPES = ['Bucket', 'Drum', 'Pouch'];
  if (NO_LABEL_TYPES.includes(packType)) return null;
  if (!totalPcs) return null; // Only show after quantity is entered

  if (!customerId) {
    return (
      <div className="mt-6 p-4 bg-surface-alt border border-border rounded-xl">
        <div className="flex items-center gap-2 text-text-muted mb-2">
          <PackageSearch size={18} />
          <h3 className="font-bold">Label Management</h3>
        </div>
        <p className="text-sm">Link customer to directory in Step 2 to enable label tracking.</p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="mt-6 p-5 border border-border rounded-xl animate-pulse flex items-center gap-3 text-text-secondary">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Checking label inventory...
      </div>
    );
  }

  const { isFirstOrder, sufficient, currentStock, shortfall, history } = data;

  return (
    <div className="mt-6 animate-fade-in">
      <div className="flex items-center gap-2 text-primary-dark mb-3">
        <PackageSearch size={20} />
        <h3 className="font-bold text-lg">Label Management</h3>
      </div>

      <div className="mb-4 bg-white p-3 border border-border rounded-lg flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-sm">Order Without Label</h4>
          <p className="text-xs text-text-muted">Check this if the customer does not require a label for this product.</p>
        </div>
        <input 
          type="checkbox" 
          checked={labelData.withoutLabel || false}
          onChange={(e) => {
            updateLabelDataForRow(rowIndex, { ...labelData, withoutLabel: e.target.checked, includeInQuotation: !e.target.checked });
            if (!e.target.checked && data) {
               setErrorMsg(labelData.batchQuantity < 1000 ? 'Minimum 1000 labels required' : '');
            } else {
               setErrorMsg('');
            }
          }}
          className="w-5 h-5 accent-primary cursor-pointer"
        />
      </div>

      {labelData.withoutLabel ? (
        <div className="p-4 bg-surface-alt border border-border rounded-xl text-text-secondary text-sm">
          Label inventory checks and costs are bypassed. This product will be shipped without a label.
        </div>
      ) : (
        <>
          {/* STATE A: SUFFICIENT LABELS */}
          {sufficient && !isFirstOrder && (
            <div className="p-5 border-2 border-success/40 bg-success-light/20 rounded-xl">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={24} className="text-success flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-success-dark text-lg">Label Stock Available</h4>
              <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-text-muted">Current Stock</p>
                  <p className="font-bold text-text-primary">{(currentStock || 0).toLocaleString()} labels</p>
                </div>
                <div>
                  <p className="text-text-muted">This order needs</p>
                  <p className="font-bold text-text-primary">{(totalPcs || 0).toLocaleString()} labels</p>
                </div>
                <div>
                  <p className="text-text-muted">Remaining after dispatch</p>
                  <p className="font-bold text-success">{(labelData.closingStockAfter || 0).toLocaleString()} labels</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-success/20 flex items-center gap-3">
                <input
                  type="checkbox"
                  id={`includeLabel_${rowIndex}`}
                  checked={labelData.includeInQuotation ?? true}
                  onChange={(e) => updateLabelDataForRow(rowIndex, { ...labelData, includeInQuotation: e.target.checked })}
                  className="w-4 h-4 accent-success cursor-pointer"
                />
                <label htmlFor={`includeLabel_${rowIndex}`} className="text-sm font-medium cursor-pointer text-success-dark select-none">
                  Show Label Details in Quotation
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE B & C: NEW PRODUCT OR INSUFFICIENT LABELS */}
      {(!sufficient || isFirstOrder) && (
        <div className={`p-5 border-2 rounded-xl ${isFirstOrder ? 'border-warning/40 bg-warning-light/20' : 'border-error/40 bg-error-light/20'}`}>
          <div className="flex items-start gap-3">
            {isFirstOrder ? (
              <Info size={24} className="text-warning flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={24} className="text-error flex-shrink-0 mt-0.5" />
            )}
            
            <div className="flex-1">
              <h4 className={`font-bold text-lg ${isFirstOrder ? 'text-warning-dark' : 'text-error-dark'}`}>
                {isFirstOrder ? 'New Label Inventory — First Order' : 'Insufficient Labels'}
              </h4>
              
              {isFirstOrder ? (
                <p className="text-sm mt-1 text-warning-dark">No labels found for this product. Minimum order: 1000 labels (MOQ).</p>
              ) : (
                <div className="mt-2 grid grid-cols-3 gap-4 text-sm text-error-dark">
                  <div>
                    <p className="opacity-80">Current Stock</p>
                    <p className="font-bold">{(currentStock || 0).toLocaleString()} labels</p>
                  </div>
                  <div>
                    <p className="opacity-80">This order needs</p>
                    <p className="font-bold">{(totalPcs || 0).toLocaleString()} labels</p>
                  </div>
                  <div>
                    <p className="opacity-80">Shortfall</p>
                    <p className="font-bold">{(shortfall || 0).toLocaleString()} labels</p>
                  </div>
                </div>
              )}
              
              {(!isFirstOrder) && (
                <p className="text-sm mt-3 font-medium text-error">You must add a new label batch to continue.</p>
              )}

              {/* Label Batch Form */}
              <div className="mt-5 p-4 bg-white rounded-lg border border-border">
                <h5 className="font-semibold text-sm mb-3">Order New Label Batch</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Label Quantity *</label>
                    <input
                      type="number"
                      min="1000"
                      value={labelData.batchQuantity || ''}
                      onChange={(e) => handleInputChange('batchQuantity', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 ${errorMsg ? 'border-error focus:ring-error' : 'border-border focus:ring-primary'}`}
                    />
                    {errorMsg && <p className="text-xs text-error mt-1">{errorMsg}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Rate per Label (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={labelData.ratePerLabel || ''}
                      onChange={(e) => handleInputChange('ratePerLabel', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">GST Rate (%) *</label>
                    <input
                      type="number"
                      min="0"
                      value={labelData.gstRate !== undefined ? labelData.gstRate : 18}
                      onChange={(e) => handleInputChange('gstRate', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                
                {/* Live Preview */}
                <div className="mt-4 p-3 bg-surface-alt rounded border border-border text-sm flex flex-col gap-1">
                  <div className="flex justify-between text-text-secondary">
                    <span>Amount ({labelData.batchQuantity || 0} × ₹{labelData.ratePerLabel || 0})</span>
                    <span>₹{(labelData.amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-text-secondary">
                    <span>GST ({labelData.gstRate !== undefined ? labelData.gstRate : 18}%)</span>
                    <span>₹{(labelData.gst || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-text-primary mt-1 pt-1 border-t border-border">
                    <span>Total Label Cost</span>
                    <span>₹{(labelData.totalLabelCost || 0).toFixed(2)}</span>
                  </div>
                </div>
                <p className="text-xs text-text-muted mt-2 text-center">This cost will be added to quotation total.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INVENTORY REFERENCE CARD (ALL STATES) */}
      <div className="mt-3 border border-border rounded-lg overflow-hidden bg-white">
        <button 
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-2 flex items-center justify-between bg-surface-alt hover:bg-surface transition-colors"
        >
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Inventory Reference</span>
          {expanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
        </button>
        {expanded && (
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-xs text-text-muted border-b border-border">
                  <th className="pb-2 font-medium">Customer</th>
                  <th className="pb-2 font-medium">Company</th>
                  <th className="pb-2 font-medium">Code</th>
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium">Pack Size</th>
                  <th className="pb-2 font-medium text-right">Total Printed</th>
                  <th className="pb-2 font-medium text-right">Used to Date</th>
                  <th className="pb-2 font-medium text-right">Closing Stock</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50 last:border-0">
                  <td className="py-2 text-text-primary">{state.header?.customer_name || '-'}</td>
                  <td className="py-2 text-text-secondary">{state.header?.billing_name || '-'}</td>
                  <td className="py-2 text-text-secondary">{state.product?.product_code || '-'}</td>
                  <td className="py-2 text-text-primary font-medium">{state.product?.product_name || '-'}</td>
                  <td className="py-2 text-text-secondary">{packSize}</td>
                  <td className="py-2 text-right font-medium">{history?.total_printed?.toLocaleString() || 0}</td>
                  <td className="py-2 text-right font-medium text-warning-dark">{history?.used_to_date?.toLocaleString() || 0}</td>
                  <td className="py-2 text-right font-bold text-primary">{currentStock.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )}
</div>
);
}
