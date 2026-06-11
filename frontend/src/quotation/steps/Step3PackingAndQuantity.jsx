import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuotation } from '../../context/QuotationContext';
import { costSheetService } from '../../services/dataService';
import PackingTypeSelector from '../components/PackingTypeSelector';
import Input from '../../components/common/Input';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { AMPOULE_PACKAGING } from '../../utils/constants';
import PMManagementBlock from '../components/PMManagementBlock';

// ── Variants & Sizes ─────────────────────────────────────────────────────────
const BOTTLE_VARIANTS = [
  'IMIDA Bottle', 'Coragan Bottle', 'CO-EX Bottle SI-01 Shape', 'SQ Biswin Golden Bottle',
  'SQ White Round Golden', 'Diamond Rivet Octagon Syngenta', 'Nocil Shape Green',
  'Glypho Green', 'SI-01 Shape', 'Tween Neck', 'Hexa Shape Total Shape',
  'PET Regular Shape', 'PET V Shape', 'Aluminium SD-SS Shape', 'Aluminium Indoxa Shape',
];
const BOTTLE_SIZES = ['1ltr', '500ml', '250ml', '100ml', '50ml', '25ml', '10ml'];
const AMPOULE_SIZES = ['20ml', '15ml', '10ml', '5ml', '2ml'];
const POUCH_TYPES = ['Common Pouch', 'Printing Pouch for Powder', 'Printing Pouch for Granules'];
const POUCH_SIZES = ['1kg', '500gm', '250gm', '100gm'];
const JAR_VARIANTS = ['Proclame Dabba Benzowin', 'JAR Denfen Om Shanti', 'Thayo Dabba Harsh', 'HY-MAX Dabba Parth'];
const JAR_SIZES = ['1kg', '500gm', '250gm'];
const BUCKET_SIZES = ['20Kg', '15Kg', '10Kg', '5Kg'];
const DRUM_SIZES = ['200Ltr', '50Ltr', '35Ltr', '25Ltr', '15Ltr', '10Ltr', '5Ltr'];


// Unit label for quantity input based on packing type
function getQtyUnit(packingType) {
  if (['Pouch', 'Jar/Dabba', 'Bucket'].includes(packingType)) return 'Kg';
  return 'Ltr';
}

export default function Step3PackingAndQuantity() {
  const { state, updateField, addRow, updateRow } = useQuotation();
  const initialized = useRef(false);

  // Local state to prevent cursor jumps and value resets
  const [localQty, setLocalQty] = useState(state.rows[0]?.totalQuantityLtrKg || '');
  const [localMrp, setLocalMrp] = useState(state.rows[0]?.mrp || '');
  const [localCarton, setLocalCarton] = useState(state.rows[0]?.nosPerCarton || '');

  // Reset local state when packing type changes
  useEffect(() => {
    setLocalQty('');
    setLocalMrp('');
    setLocalCarton('');
  }, [state.packingType]);

  // Sync back from global if returning to this step and local is empty
  useEffect(() => {
    if (state.rows[0]) {
      if (localQty === '' && state.rows[0].totalQuantityLtrKg) setLocalQty(state.rows[0].totalQuantityLtrKg);
      if (localMrp === '' && state.rows[0].mrp) setLocalMrp(state.rows[0].mrp);
      if (localCarton === '' && state.rows[0].nosPerCarton) setLocalCarton(state.rows[0].nosPerCarton);
    }
  }, [state.rows]);

  const available = state.product?.available_packing_types?.length > 0
    ? state.product.available_packing_types
    : ['Bottle', 'Ampoule', 'Pouch', 'Jar/Dabba', 'Bucket', 'Drum'];

  const handleTypeSelect = (type) => {
    updateField('packingType', type);
    updateField('packingVariant', '');
    updateField('packSize', '');
    updateField('packSizeValue', 0);
    updateField('packSizeUnit', '');
    // Reset rows when packing type changes
    updateField('rows', []);
    initialized.current = false;
  };

  const parsePackSize = (sizeStr) => {
    const match = sizeStr?.match(/^(\d+\.?\d*)\s*(ml|ltr|gm|kg|l)$/i);
    if (match) {
      updateField('packSizeValue', parseFloat(match[1]));
      updateField('packSizeUnit', match[2].toLowerCase());
    }
    updateField('packSize', sizeStr);
  };

  // Initialize the row when pack size is selected
  useEffect(() => {
    if (state.packingType && state.packSize && state.packSizeValue > 0 && state.rows.length === 0 && !initialized.current) {
      initialized.current = true;
      addRow({
        packingType: state.packingType,
        packingVariant: state.packingVariant,
        packSize: state.packSize,
        packSizeValue: state.packSizeValue,
        packSizeUnit: state.packSizeUnit,
        costPerPcs: 0,
        totalQuantityLtrKg: '',
        totalPcs: 0,
        nosPerCarton: '',
        mrp: '',
        totalCases: 0,
        innerBoxCount: 0,
        outerBoxCount: 0,
        rowAmount: 0,
        gstAmount: 0,
        rowTotal: 0,
      });
    }
  }, [state.packSize, state.packSizeValue]);

  const handleRowChange = (field, value) => {
    if (state.rows.length === 0) return;
    const row = { ...state.rows[0], [field]: value };
    const packSizeValue = row.packSizeValue || state.packSizeValue || 0;
    const packSizeUnit = row.packSizeUnit || state.packSizeUnit || '';

    // Calculate Total Pcs
    let totalPcs = 0;
    if (row.totalQuantityLtrKg && packSizeValue > 0) {
      const totalInBase = parseFloat(row.totalQuantityLtrKg);
      let packInBase = packSizeValue;
      const u = packSizeUnit.toLowerCase();
      if (u === 'ml') packInBase = packSizeValue / 1000;
      else if (u === 'gm') packInBase = packSizeValue / 1000;
      totalPcs = Math.floor(totalInBase / packInBase);
    }

    const nosPerCarton = parseInt(row.nosPerCarton) || 0;
    const totalCases = nosPerCarton > 0 ? Math.ceil(totalPcs / nosPerCarton) : 0;
    
    let innerBoxCount = 0;
    let outerBoxCount = 0;
    
    if (state.packingType === 'Ampoule' && state.packSize) {
      const spec = AMPOULE_PACKAGING[state.packSize];
      if (spec) {
        innerBoxCount = Math.ceil(totalPcs / spec.innerBoxPcs);
        outerBoxCount = Math.ceil(totalPcs / spec.outerBoxPcs);
      }
    }

    updateRow(0, {
      ...row,
      packingType: state.packingType,
      packingVariant: state.packingVariant,
      packSize: state.packSize,
      packSizeValue: state.packSizeValue,
      packSizeUnit: state.packSizeUnit,
      totalPcs,
      totalCases,
      innerBoxCount,
      outerBoxCount,
      rowAmount: 0,
      gstAmount: 0,
      rowTotal: 0,
    });
  };

  const row0 = state.rows[0];

  // Calculated summary
  const bulkCostPerPcs = useMemo(() => {
    if (!state.packSizeValue || !state.productBulkRate) return 0;
    let v = state.packSizeValue;
    const u = state.packSizeUnit?.toLowerCase();
    if (u === 'ml') v /= 1000;
    else if (u === 'gm') v /= 1000;
    return parseFloat((v * state.productBulkRate).toFixed(4));
  }, [state.packSizeValue, state.packSizeUnit, state.productBulkRate]);

  // ── Render packing variant/size selectors ──────────────────────────────────
  const renderPackConfig = () => {
    switch (state.packingType) {
      case 'Bottle':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Bottle Variant" type="select" value={state.packingVariant}
              onChange={(e) => updateField('packingVariant', e.target.value)}
              placeholder="Select bottle variant"
              options={BOTTLE_VARIANTS.map((v) => ({ value: v, label: v }))} />
            <Input label="Pack Size" type="select" value={state.packSize}
              onChange={(e) => parsePackSize(e.target.value)}
              placeholder="Select size"
              options={BOTTLE_SIZES.map((s) => ({ value: s, label: s }))} />
          </div>
        );
      case 'Ampoule':
        return (
          <Input label="Ampoule Size" type="select" value={state.packSize}
            onChange={(e) => { updateField('packingVariant', 'Ampoule Glass'); parsePackSize(e.target.value); }}
            placeholder="Select ampoule size"
            options={AMPOULE_SIZES.map((s) => ({ value: s, label: s }))} />
        );
      case 'Pouch':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Pouch Type" type="select" value={state.packingVariant}
              onChange={(e) => updateField('packingVariant', e.target.value)}
              placeholder="Select pouch type"
              options={POUCH_TYPES.map((v) => ({ value: v, label: v }))} />
            <Input label="Pack Size" type="select" value={state.packSize}
              onChange={(e) => parsePackSize(e.target.value)}
              placeholder="Select size"
              options={POUCH_SIZES.map((s) => ({ value: s, label: s }))} />
          </div>
        );
      case 'Jar/Dabba':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Jar Variant" type="select" value={state.packingVariant}
              onChange={(e) => updateField('packingVariant', e.target.value)}
              placeholder="Select jar variant"
              options={JAR_VARIANTS.map((v) => ({ value: v, label: v }))} />
            <Input label="Pack Size" type="select" value={state.packSize}
              onChange={(e) => parsePackSize(e.target.value)}
              placeholder="Select size"
              options={JAR_SIZES.map((s) => ({ value: s, label: s }))} />
          </div>
        );
      case 'Bucket':
        return (
          <Input label="Bucket Size" type="select" value={state.packSize}
            onChange={(e) => { updateField('packingVariant', 'Bucket'); parsePackSize(e.target.value); }}
            placeholder="Select size"
            options={BUCKET_SIZES.map((s) => ({ value: s, label: s }))} />
        );
      case 'Drum':
        return (
          <Input label="Drum Size" type="select" value={state.packSize}
            onChange={(e) => { updateField('packingVariant', 'Drum'); parsePackSize(e.target.value); }}
            placeholder="Select size"
            options={DRUM_SIZES.map((s) => ({ value: s, label: s }))} />
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <h2 className="text-xl font-bold text-text-primary mb-2">Packing & Quantity</h2>
      <p className="text-sm text-text-secondary mb-6">Select packing type, pack size, and enter order quantity</p>

      {/* ── Selection 1: Packing Type ── */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-text-primary mb-3">1. Packing Type</h3>
        <PackingTypeSelector availableTypes={available} selectedType={state.packingType} onSelect={handleTypeSelect} />
      </div>

      {/* ── Selection 2: Pack Size ── */}
      {state.packingType && (
        <div className="mb-6 p-5 bg-white border border-border rounded-xl animate-fade-in">
          <h3 className="text-sm font-bold text-text-primary mb-4">2. Pack Size</h3>
          {renderPackConfig()}
        </div>
      )}

      {/* ── Selection 3: Quantity ── */}
      {state.packSize && row0 && (
        <div className="p-5 bg-white border border-border rounded-xl animate-fade-in">
          <h3 className="text-sm font-bold text-text-primary mb-4">3. Order Quantity</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">
                Total Qty ({getQtyUnit(state.packingType)}) <span className="text-error">*</span>
              </label>
              <input
                type="number"
                value={localQty}
                onChange={(e) => {
                  setLocalQty(e.target.value);
                  handleRowChange('totalQuantityLtrKg', e.target.value);
                }}
                onWheel={(e) => e.target.blur()}
                placeholder="e.g. 50"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-lighter/40 focus:border-primary-lighter"
              />
            </div>
            
            {state.packingType !== 'Ampoule' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-primary">
                  Nos Per Carton <span className="text-error">*</span>
                </label>
                <input
                  type="number"
                  value={localCarton}
                  onChange={(e) => {
                    setLocalCarton(e.target.value);
                    handleRowChange('nosPerCarton', e.target.value);
                  }}
                  onWheel={(e) => e.target.blur()}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-lighter/40 focus:border-primary-lighter"
                  required
                />
              </div>
            )}
            
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">
                MRP (₹) <span className="text-error">*</span>
              </label>
              <input
                type="number"
                value={localMrp}
                onChange={(e) => {
                  setLocalMrp(e.target.value);
                  handleRowChange('mrp', e.target.value);
                }}
                onWheel={(e) => e.target.blur()}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-lighter/40 focus:border-primary-lighter"
                required
              />
            </div>
          </div>

          {state.packingType === 'Ampoule' && state.packSize && AMPOULE_PACKAGING[state.packSize] && (
            <div className="bg-bg-secondary border border-border p-4 rounded-lg mt-4 mb-4">
              <h4 className="text-sm font-semibold text-text-primary mb-2">Packaging Structure for {state.packSize} Ampoules</h4>
              <ul className="text-sm text-text-secondary space-y-1">
                <li>• <span className="font-medium">Tray:</span> {AMPOULE_PACKAGING[state.packSize].trayPcs} ampoules per tray</li>
                <li>• <span className="font-medium">FBB Box:</span> 1 tray per FBB Box ({AMPOULE_PACKAGING[state.packSize].trayPcs} ampoules)</li>
                <li>• <span className="font-medium">Inner Box:</span> {AMPOULE_PACKAGING[state.packSize].innerBoxPcs / AMPOULE_PACKAGING[state.packSize].fbbBoxPcs} FBB Boxes per Inner Box ({AMPOULE_PACKAGING[state.packSize].innerBoxPcs} ampoules)</li>
                <li>• <span className="font-medium">Outer Box:</span> {AMPOULE_PACKAGING[state.packSize].outerBoxPcs / AMPOULE_PACKAGING[state.packSize].innerBoxPcs} Inner Boxes per Outer Box ({AMPOULE_PACKAGING[state.packSize].outerBoxPcs} ampoules)</li>
              </ul>
            </div>
          )}

          {/* Live Summary Bar */}
          {row0.totalPcs > 0 && (
            <div className={`grid gap-3 bg-surface-alt p-3 rounded-lg text-sm mb-4 ${state.packingType === 'Ampoule' ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}>
              <div>
                <span className="text-text-muted">Total Pcs:</span>{' '}
                <span className="font-bold text-primary">{row0.totalPcs?.toLocaleString('en-IN')}</span>
              </div>
              
              {state.packingType === 'Ampoule' ? (
                <>
                  <div>
                    <span className="text-text-muted">Inner Boxes:</span>{' '}
                    <span className="font-bold">{row0.innerBoxCount?.toLocaleString('en-IN') || 0}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Outer Boxes:</span>{' '}
                    <span className="font-bold text-action">{row0.outerBoxCount?.toLocaleString('en-IN') || 0}</span>
                  </div>
                </>
              ) : (
                <div>
                  <span className="text-text-muted">Total Cases:</span>{' '}
                  <span className="font-bold">{row0.totalCases?.toLocaleString('en-IN') || 0}</span>
                </div>
              )}
              <div>
                <span className="text-text-muted">Pack Size:</span>{' '}
                <span className="font-bold">{row0.packSize}</span>
              </div>
              <div>
                <span className="text-text-muted">Bulk Cost/Pc:</span>{' '}
                <span className="font-bold text-primary">₹{bulkCostPerPcs.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Label Management Section(s) */}
      {state.rows.map((row, index) => {
        const globalRowIndex = state.lineItems.length + index;
        return <PMManagementBlock key={index} rowIndex={globalRowIndex} row={row} />;
      })}
    </div>
  );
}
