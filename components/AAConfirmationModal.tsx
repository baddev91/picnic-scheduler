
import React from 'react';
import { CalendarRange, Repeat, Edit2, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { ShiftTime } from '../types';

interface AASelectionItem {
    dayIndex: number;
    time: ShiftTime | null;
}

interface AAConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void; // Triggered by "Edit"
  onConfirm: () => void; // Triggered by "Confirm"
  selections: AASelectionItem[];
}

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const AAConfirmationModal: React.FC<AAConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selections
}) => {
  if (!isOpen) return null;

  // Sort selections: Mon (1) -> Sat (6) -> Sun (0) visually
  const sortedSelections = [...selections].sort((a, b) => {
      // Adjust indices so Monday (1) is first and Sunday (0) is last for sorting comparison
      const idxA = a.dayIndex === 0 ? 7 : a.dayIndex;
      const idxB = b.dayIndex === 0 ? 7 : b.dayIndex;
      return idxA - idxB;
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100">
        
        {/* Header with Animation - Fixed */}
        <div className="shrink-0 bg-gradient-to-br from-red-500 to-red-600 p-6 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-white/10 opacity-30 pattern-grid-lg"></div>
            <div className="relative z-10 flex flex-col items-center">
                <div className="bg-white/20 p-4 rounded-full mb-3 backdrop-blur-md shadow-inner">
                    <Repeat className="w-8 h-8 text-white animate-spin-slow" style={{ animationDuration: '3s' }} />
                </div>
                <h3 className="text-2xl font-black tracking-tight">Recurring Schedule</h3>
                <p className="text-red-100 font-medium text-sm mt-1">Please confirm your commitment.</p>
            </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
            
            {/* The Explanation */}
            <div className="text-center space-y-2">
                <p className="text-gray-600 text-sm leading-relaxed">
                    You are choosing these 2 days to work <strong className="text-gray-900 bg-red-50 px-1 rounded">EVERY WEEK</strong>.
                    <br/>This will be your fixed roster pattern.
                </p>
            </div>

            {/* The Selection Cards */}
            <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                {sortedSelections.map((sel) => {
                    const dayName = WEEK_DAYS[sel.dayIndex];
                    const shiftName = sel.time?.split('(')[0] || 'Unknown';
                    const hours = sel.time?.match(/\((.*?)\)/)?.[1] || '';

                    return (
                        <div key={sel.dayIndex} className="flex items-center gap-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                            <div className="w-1.5 absolute left-0 top-0 bottom-0 bg-red-500"></div>
                            
                            <div className="flex flex-col items-center justify-center w-12 h-12 bg-red-50 rounded-lg shrink-0">
                                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">{dayName.substring(0,3)}</span>
                                <CalendarRange className="w-5 h-5 text-red-600" />
                            </div>
                            
                            <div>
                                <h4 className="font-bold text-gray-900 text-lg leading-none">{dayName}</h4>
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mt-1">
                                    <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-bold">{shiftName}</span>
                                    <span>• {hours}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 leading-tight">
                    By confirming, you agree to be available for these shifts on a weekly basis starting from your first day.
                </p>
            </div>
        </div>

        {/* Footer Actions - Fixed - Side by Side */}
        <div className="shrink-0 p-4 bg-gray-50 border-t flex flex-row gap-3 z-10">
            <Button 
                onClick={onClose} 
                variant="secondary" 
                className="flex-1 py-3 border-gray-200 text-gray-600 hover:bg-white text-xs sm:text-sm"
            >
                <Edit2 className="w-4 h-4 mr-1.5" /> Change
            </Button>
            <Button 
                onClick={onConfirm} 
                className="flex-[2] py-3 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 text-white text-xs sm:text-sm"
            >
                Confirm <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
        </div>
      </div>
    </div>
  );
};
