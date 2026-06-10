import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QuotationProvider, useQuotation } from '../context/QuotationContext';
import Step1BrandAndProduct from './steps/Step1BrandAndProduct';
import Step2CustomerDetails from './steps/Step2CustomerDetails';
import Step3PackingAndQuantity from './steps/Step3PackingAndQuantity';
import Step4CostBuilder from './steps/Step4CostBuilder';
import Step5ReviewSubmit from './steps/Step5ReviewSubmit';
import Button from '../components/common/Button';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const STEPS = [
  { num: 1, label: 'Brand & Product' },
  { num: 2, label: 'Customer' },
  { num: 3, label: 'Packing & Qty' },
  { num: 4, label: 'Cost Builder' },
  { num: 5, label: 'Review' },
];

function WizardContent() {
  const { currentStep, goBack, goNext, goToStep, state, loadQuotation } = useQuotation();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  const id = searchParams.get('id');
  const repeatId = searchParams.get('repeatId');

  useEffect(() => {
    const targetId = id || repeatId;
    if (targetId) {
      setIsLoading(true);
      loadQuotation(targetId).then((success) => {
        if (success) goToStep(5);
      }).finally(() => setIsLoading(false));
    }
  }, [id, repeatId, loadQuotation, goToStep]);

  const canNext = () => {
    switch (currentStep) {
      case 1: return !!state.orderType && !!state.product;
      case 2: return !!state.header.customer_name && !!state.header.employee_name;
      case 3: {
        const hasBase = !!state.packingType && !!state.packSize && state.rows?.length > 0 && state.rows.every((r) => r.totalPcs > 0);
        if (!hasBase) return false;
        
        const NO_LABEL_TYPES = ['Bucket', 'Drum', 'Pouch'];
        const customerId = state.customer_id || state.header?.customer_id;
        if (!NO_LABEL_TYPES.includes(state.packingType) && customerId) {
          return state.rows.every((_, i) => {
            const globalRowIndex = state.lineItems.length + i;
            const ld = state.labelDataArray?.[globalRowIndex];
            if (!ld) return false;
            if (ld.isNewBatch) {
              return ld.batchQuantity >= 1000 && parseFloat(ld.ratePerLabel) > 0;
            }
            return true;
          });
        }
        return true;
      }
      case 4: return state.components?.length > 0;
      default: return true;
    }
  };

  const handleNext = () => {
    if (!canNext()) {
      toast.error('Please complete all required fields.');
      return;
    }
    goNext();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <Step1BrandAndProduct />;
      case 2: return <Step2CustomerDetails />;
      case 3: return <Step3PackingAndQuantity />;
      case 4: return <Step4CostBuilder />;
      case 5: return <Step5ReviewSubmit />;
      default: return null;
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64 text-text-muted">Loading quotation data...</div>;
  }

  return (
    <div className="animate-fade-in">
      {/* Progress Bar */}
      <div className="flex items-center justify-center mb-8 overflow-x-auto pb-2">
        {STEPS.map((step, i) => (
          <div key={step.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                currentStep === step.num ? 'bg-primary text-white shadow-md' :
                currentStep > step.num ? 'bg-primary-lighter text-white' :
                'bg-border text-text-muted'
              }`}>
                {currentStep > step.num ? <Check size={16} /> : step.num}
              </div>
              <span className={`text-xs mt-1 whitespace-nowrap ${
                currentStep === step.num ? 'text-primary font-semibold' : 'text-text-muted'
              }`}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-12 sm:w-20 h-0.5 mx-1 ${currentStep > step.num ? 'bg-primary-lighter' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {renderStep()}
      </div>

      {/* Navigation Buttons */}
      {currentStep < 5 && (
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
          <div>
            {currentStep > 1 && (
              <Button variant="secondary" icon={ArrowLeft} onClick={goBack}>Back</Button>
            )}
          </div>
          <Button variant="primary" onClick={handleNext} disabled={!canNext()}>
            Next <ArrowRight size={16} className="ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function ProductQuotationWizard() {
  return (
    <QuotationProvider>
      <WizardContent />
    </QuotationProvider>
  );
}
