import React from 'react';
import { CheckCircle, PlayCircle, CalendarRange } from 'lucide-react';
import { Button } from './Button';

interface MobileInstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: React.ReactNode;
  step: 'AA' | 'FWD' | 'STANDARD';
}

export const MobileInstructionModal: React.FC<MobileInstructionModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  step
}) => {
  if (!isOpen) return null;

  let Icon = CheckCircle;
  let bgClass = 'bg-green-50';
  let iconBgClass = 'bg-green-100 text-green-600';

  if (step === 'FWD') {
      Icon = PlayCircle;
      bgClass = 'bg-yellow-50';
      iconBgClass = 'bg-yellow-100 text-yellow-600';
  } else if (step === 'AA') {
      Icon = CalendarRange;
      bgClass = 'bg-red-50';
      iconBgClass = 'bg-red-100 text-red-600';
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6 md:hidden animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
        <div className={`p-4 flex justify-center ${bgClass}`}>
          <div className={`p-4 rounded-full ${iconBgClass}`}>
             <Icon className="w-8 h-8" />
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