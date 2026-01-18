
import React from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { ShiftTime } from '../types';

interface FWDConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  date: string | null;
  shift: ShiftTime | null;
  isChecking?: boolean;
}

export const FWDConfirmationModal: React.FC<FWDConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  date,
  shift,
  isChecking = false
}) => {
  if (!isOpen || !date || !shift) return null;

  const dateObj = new Date(date);
  const shiftName = shift.split('(')[0].trim();
  const shiftTime = shift.match(/\((.*?)\)/)?.[1] || '';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
        
        <div className="bg-yellow-50 p-6 text-center border-b border-yellow-100">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-600 shadow-sm">
                <Calendar className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 leading-tight">Confirm Start Date</h3>
            <p className="text-sm text-gray-500 mt-2">
                Is this your definitive first working day?
            </p>
        </div>

        <div className="p-6 space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col items-center gap-2">
                <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">Selected Date</div>
                <div className="text-2xl font-black text-gray-800">
                    {format(dateObj, 'EEEE, MMM do')}
                </div>
                <div className="flex flex-col items-center gap-1 mt-1">
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-700 bg-white px-4 py-1.5 rounded-full border shadow-sm">
                        <Clock className="w-4 h-4 text-purple-500" />
                        {shiftName}
                    </div>
                    {shiftTime && (
                        <div className="text-xs font-medium text-gray-500">
                            {shiftTime}
                        </div>
                    )}
                </div>
            </div>

            <div className="text-xs text-center text-gray-400 px-4">
                By confirming, you will proceed to select your shifts for the next 2 weeks starting from this date.
            </div>
        </div>

        <div className="p-4 bg-gray-50 border-t flex gap-3">
            <Button onClick={onClose} variant="secondary" className="flex-1" disabled={isChecking}>
                Cancel
            </Button>
            <Button 
                onClick={onConfirm} 
                disabled={isChecking}
                className="flex-[2] bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white border-none shadow-lg"
            >
                {isChecking ? (
                    <>Checking... <Loader2 className="w-4 h-4 ml-2 animate-spin" /></>
                ) : (
                    <>Confirm <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
            </Button>
        </div>
      </div>
    </div>
  );
};
