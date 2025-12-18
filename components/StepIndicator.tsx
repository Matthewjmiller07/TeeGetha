import React from 'react';
import { AppStep } from '../types';
import { Check, User, Image as ImageIcon, Paintbrush, ShoppingBag } from 'lucide-react';

interface Props {
  currentStep: AppStep;
}

export const StepIndicator: React.FC<Props> = ({ currentStep }) => {
  const steps = [
    { id: AppStep.UPLOAD, icon: ImageIcon, label: 'Upload' },
    { id: AppStep.ROSTER, icon: User, label: 'Roster' },
    { id: AppStep.DESIGN, icon: Paintbrush, label: 'Design' },
    { id: AppStep.SHOP, icon: ShoppingBag, label: 'Shop' },
  ];

  const stepOrder = [AppStep.LANDING, ...steps.map(s => s.id), AppStep.CHECKOUT];
  const currentIndex = stepOrder.indexOf(currentStep);

  if (currentStep === AppStep.LANDING) return null;

  return (
    <div className="w-full max-w-3xl mx-auto mb-8 px-4">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-100 -z-10 rounded-full" />
        
        {steps.map((step, idx) => {
          // Adjust index because LANDING is 0 in stepOrder
          const actualIdx = idx + 1;
          const isActive = step.id === currentStep;
          const isCompleted = currentIndex > actualIdx;

          return (
            <div key={step.id} className="flex flex-col items-center bg-white px-2">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300
                  ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110' : 
                    isCompleted ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}
              >
                {isCompleted ? <Check size={20} /> : <step.icon size={20} />}
              </div>
              <span className={`text-xs mt-2 font-medium ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};