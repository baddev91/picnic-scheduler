import React from 'react';
import { X, Info, CheckCircle, PlayCircle } from 'lucide-react';
import { Button } from './Button';

interface MobileInstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: React.ReactNode;
  step: 'FWD' | 'STANDARD';
}

export const MobileInstructionModal: React.FC<MobileInstructionModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  step
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6 md:hidden animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
        <div className={`p-4 flex justify-center ${step === 'FWD' ? 'bg-yellow-50' : 'bg-green-50'}`}>
          <div className={`p-4 rounded-full ${step === 'FWD' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'}`}>
             {step === 'FWD' ? <PlayCircle className="w-8 h-8" /> : <CheckCircle className="w-8 h-8" />}
          </div>
        </div>
        
        <div className="p-6 text-center space-y-4">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <div className="text-gray-600 text-sm leading-relaxed">
            {message}
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50">
          <Button onClick={onClose} fullWidth className="py-3 text-base shadow-lg">
            Got it, let's start!
          </Button>
        </div>
      </div>
    </div>
  );
};