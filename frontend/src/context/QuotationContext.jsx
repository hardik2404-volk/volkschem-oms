import { createContext, useContext, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { quotationService, productService } from '../services/dataService';

const QuotationContext = createContext(null);

const initialState = {
  // Window 1 — Brand Type + Product
  orderType: '',        // 'gujarat_brand' or 'third_party'
  product: null,        // full product object from API
  productBulkRate: 0,   // product.bulk_rate_per_ltr_kg — stored separately for clarity
  rateUnit: '',         // 'ltr' or 'kg'

  // Window 2 — Customer Details
  header: {
    customer_id: null,
    employee_name: '',
    customer_name: '',
    customer_contact: '',
    gst_pan: '',
    billing_address: '',
    billing_name: '',
    transport_name: '',
    destination: '',
    pin_code: '',
    label_company_name: '',
    name_on_label: '',
    quotation_date: new Date().toISOString().split('T')[0],
  },

  // Window 3 — Packing + Quantity
  packingType: '',       // 'Bottle', 'Ampoule', 'Pouch', 'Jar/Dabba', 'Bucket', 'Drum'
  packingVariant: '',    // selected container variant name
  packSize: '',          // selected pack size string e.g. '5ml'
  packSizeValue: 0,      // numeric value e.g. 5
  packSizeUnit: '',      // 'ml', 'ltr', 'gm', 'kg'
  rows: [],              // each row = { packingType, packingVariant, packSize, packSizeValue, packSizeUnit, totalPcs, nosPerCarton, mrp, totalCases, costPerPcs, rowAmount, gstAmount, rowTotal, totalQuantityLtrKg }
  
  // Window 4 — Cost Builder
  components: [],
  customLines: [],

  // Aggregates
  subtotal: 0,
  totalGst: 0,
  grandTotal: 0,
  
  // Multi-product support
  lineItems: [], // Array of { product, packingType, packingVariant, packSize, packSizeValue, packSizeUnit, rows, components }
  labelDataArray: [],    // global array of label management objects (one entry per global row across all products)
};

export function QuotationProvider({ children }) {
  const [state, setState] = useState({ ...initialState });
  const [currentStep, setCurrentStep] = useState(1);

  const updateField = useCallback((field, value) => {
    setState((prev) => {
      const nextState = { ...prev, [field]: value };
      if (field === 'rows') {
        return recalcTotals(nextState);
      }
      return nextState;
    });
  }, []);

  const updateHeader = useCallback((field, value) => {
    setState((prev) => ({
      ...prev,
      header: { ...prev.header, [field]: value },
    }));
  }, []);

  const addRow = useCallback((row) => {
    setState((prev) => {
      const rows = [...prev.rows, row];
      return recalcTotals({ ...prev, rows });
    });
  }, []);

  const updateRow = useCallback((index, row) => {
    setState((prev) => {
      const rows = [...prev.rows];
      rows[index] = row;
      return recalcTotals({ ...prev, rows });
    });
  }, []);

  const removeRow = useCallback((index) => {
    setState((prev) => {
      const rows = prev.rows.filter((_, i) => i !== index);
      return recalcTotals({ ...prev, rows });
    });
  }, []);

  const resetWizard = useCallback(() => {
    setState({ ...initialState, header: { ...initialState.header, quotation_date: new Date().toISOString().split('T')[0] } });
    setCurrentStep(1);
  }, []);

  const resetProductState = useCallback(() => {
    setState((prev) => ({
      ...prev,
      orderType: '',
      product: null,
      productBulkRate: 0,
      rateUnit: '',
      packingType: '',
      packingVariant: '',
      packSize: '',
      packSizeValue: 0,
      packSizeUnit: '',
      rows: [],
      components: [],
    }));
  }, []);

  const addLineItem = useCallback(() => {
    setState((prev) => {
      if (!prev.product || prev.rows.length === 0) return prev;
      
      const newItem = {
        product: prev.product,
        orderType: prev.orderType,
        productBulkRate: prev.productBulkRate,
        packingType: prev.packingType,
        packingVariant: prev.packingVariant,
        packSize: prev.packSize,
        packSizeValue: prev.packSizeValue,
        packSizeUnit: prev.packSizeUnit,
        rows: prev.rows,
        components: prev.components,
      };

      const lineItems = [...prev.lineItems, newItem];
      return recalcTotals({ ...prev, lineItems });
    });
  }, []);

  const updateLabelDataForRow = useCallback((rowIndex, labelData) => {
    setState((prev) => {
      const updatedArray = [...prev.labelDataArray];
      updatedArray[rowIndex] = labelData;
      return { ...prev, labelDataArray: updatedArray };
    });
  }, []);

  const getLabelDataForRow = useCallback((rowIndex) => {
    return state.labelDataArray[rowIndex] || null;
  }, [state.labelDataArray]);

  const removeLineItem = useCallback((index) => {
    setState((prev) => {
      const lineItems = prev.lineItems.filter((_, i) => i !== index);
      const labelDataArray = prev.labelDataArray.filter((_, i) => i !== index);
      return recalcTotals({ ...prev, lineItems, labelDataArray });
    });
  }, []);

  const editLineItem = useCallback((index) => {
    setState((prev) => {
      const itemToEdit = prev.lineItems[index];
      if (!itemToEdit) return prev;

      const lineItems = prev.lineItems.filter((_, i) => i !== index);
      const labelDataArray = prev.labelDataArray.filter((_, i) => i !== index);
      
      // Load the item's label data into the current active state if needed,
      // but actually the active state's label gets recalculated in Step 4.
      // We just need to make sure the array is kept in sync!

      return recalcTotals({
        ...prev,
        orderType: itemToEdit.orderType,
        product: itemToEdit.product,
        productBulkRate: itemToEdit.productBulkRate,
        packingType: itemToEdit.packingType,
        packingVariant: itemToEdit.packingVariant,
        packSize: itemToEdit.packSize,
        packSizeValue: itemToEdit.packSizeValue,
        packSizeUnit: itemToEdit.packSizeUnit,
        rows: itemToEdit.rows,
        components: itemToEdit.components,
        labelBatch: itemToEdit.labelBatch,
        lineItems,
        labelDataArray,
      });
    });
  }, []);

  const loadQuotation = useCallback(async (id) => {
    try {
      const { data } = await quotationService.getById(id);
      const q = data.data;
      if (!q) return false;

      // Multi-product mapping
      let lineItems = [];
      let labelDataArray = [];
      if (q.rows && q.rows.length > 0) {
        lineItems = q.rows.map((r, index) => {
          if (r.label_snapshot) {
            labelDataArray[index] = {
              isNewBatch: r.label_snapshot.is_new_batch,
              includeInQuotation: r.label_snapshot.include_in_quotation,
              packSize: r.label_snapshot.pack_size,
              openStock: r.label_snapshot.open_stock,
              batchQuantity: r.label_snapshot.make_quantity,
              totalStock: r.label_snapshot.total_stock,
              usedPcs: r.label_snapshot.used_to_date,
              closingStockAfter: r.label_snapshot.closing_stock,
              ratePerLabel: r.label_snapshot.rate_per_label,
              totalLabelCost: r.label_snapshot.total_amount,
            };
          }

          return {
            product: r.products || null,
            orderType: q.product_order_type || 'gujarat_brand',
            productBulkRate: r.products?.bulk_rate_per_ltr_kg || 0,
            packingType: r.packing_type,
            packingVariant: r.container_variant,
            packSize: r.pack_size_value ? `${r.pack_size_value}${r.pack_size_unit}` : '',
            packSizeValue: r.pack_size_value,
            packSizeUnit: r.pack_size_unit,
            rows: [{
              packingType: r.packing_type,
              packingVariant: r.container_variant,
              packSize: r.pack_size_value ? `${r.pack_size_value}${r.pack_size_unit}` : '',
              packSizeValue: r.pack_size_value,
              packSizeUnit: r.pack_size_unit,
              totalPcs: r.total_pcs,
              nosPerCarton: r.nos_per_carton,
              mrp: r.mrp,
              totalCases: r.total_cases,
              costPerPcs: r.cost_per_pcs,
              rowAmount: r.row_amount,
              gstAmount: r.gst_amount,
              rowTotal: r.row_total_with_gst,
              totalQuantityLtrKg: r.total_quantity_ltr_kg,
            }],
            components: r.components || [],
            labelBatch: null, // Edit label batch not fully supported per line item yet
          };
        });
      }

      setState({
        ...initialState,
        header: {
          ...initialState.header,
          employee_name: q.employee_name || '',
          customer_name: q.customer_name || '',
          customer_contact: q.customer_contact || '',
          gst_pan: q.gst_pan || '',
          billing_address: q.billing_address || '',
          billing_name: q.billing_name || '',
          transport_name: q.transport_name || '',
          destination: q.destination || '',
          label_company_name: q.label_company_name || '',
          name_on_label: q.name_on_label || '',
          quotation_date: q.quotation_date || new Date().toISOString().split('T')[0],
        },
        lineItems,
        labelDataArray,
      });
      return true;
    } catch (err) {
      console.error(err);
      toast.error('Failed to load quotation.');
      return false;
    }
  }, []);

  const goNext = useCallback(() => setCurrentStep((s) => Math.min(s + 1, 5)), []);
  const goBack = useCallback(() => setCurrentStep((s) => Math.max(s - 1, 1)), []);
  const goToStep = useCallback((step) => setCurrentStep(step), []);

  return (
    <QuotationContext.Provider value={{
      state,
      setState,
      currentStep,
      setCurrentStep,
      updateField,
      updateHeader,
      addRow,
      updateRow,
      removeRow,
      resetWizard,
      resetProductState,
      addLineItem,
      removeLineItem,
      editLineItem,
      updateLabelDataForRow,
      getLabelDataForRow,
      loadQuotation,
      goNext,
      goBack,
      goToStep,
    }}>
      {children}
    </QuotationContext.Provider>
  );
}

function recalcTotals(s) {
  let subtotal = 0;
  let totalGst = 0;
  s.rows.forEach((r) => {
    subtotal += r.rowAmount || 0;
    totalGst += r.gstAmount || 0;
  });
  return { ...s, subtotal, totalGst, grandTotal: subtotal + totalGst };
}

export function useQuotation() {
  const ctx = useContext(QuotationContext);
  if (!ctx) throw new Error('useQuotation must be used within QuotationProvider');
  return ctx;
}
