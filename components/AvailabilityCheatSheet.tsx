
import React from 'react';
import { format, addDays, eachDayOfInterval, isWeekend } from 'date-fns';
import { X, Check, Calendar, Info, Ban } from 'lucide-react';
import { AdminAvailabilityMap, ShiftTime, ShiftType } from '../types';
import { SHIFT_TIMES, formatDateKey } from '../constants';

interface AvailabilityCheatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  adminAvailability: AdminAvailabilityMap;
}

export const AvailabilityCheatSheet: React.FC<AvailabilityCheatSheetProps> = ({
  isOpen,
  onClose,
  adminAvailability
}) => {
  if (!isOpen) return null;

  // Analyze next 14 days
  const today = new Date();
  const nextTwoWeeks = eachDayOfInterval({
    start: today,
    end: addDays(today, 13)
  });

  const getStatus = (dateKey: string, shift: ShiftTime) => {
    // Default is OPEN if no config exists
    if (!adminAvailability[dateKey]) return 'OPEN';
    const dayConfig = adminAvailability[dateKey];
    
    // Default is OPEN if shift config doesn't exist
    if (!dayConfig || !dayConfig[shift]) return 'OPEN';

    // Check if STANDARD is allowed
    const types = dayConfig[shift] || [];
    return types.includes(ShiftType.STANDARD) ? 'OPEN' : 'CLOSED';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 shrink-0 flex justify-between items-center text-white">
            <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                    <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h3 className="font-bold text-lg leading-tight">Quick Availability View</h3>
                    <p className="text-xs text-blue-100 opacity-90">Overview for the next 14 days</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Legend */}
        <div className="bg-gray-50 border-b px-5 py-3 flex gap-4 text-xs font-bold text-gray-500 uppercase tracking-wide justify-center shrink-0">
            <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div> Open
            </div>
            <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-300"></div> Full / Closed
            </div>
        </div>

        {/* Content List */}
        <div className="overflow-y-auto p-4 space-y-3 bg-gray-100/50">
            {nextTwoWeeks.map((day) => {
                const dateKey = formatDateKey(day);
                const isWknd = isWeekend(day);
                
                return (
                    <div key={dateKey} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
                        {/* Date Column */}
                        <div className={`flex sm:flex-col items-center sm:items-start gap-2 sm:gap-0 w-24 shrink-0 ${isWknd ? 'text-red-600' : 'text-gray-700'}`}>
                            <span className="text-xs font-bold uppercase tracking-wider">{format(day, 'EEE')}</span>
                            <span className="text-lg font-black leading-none">{format(day, 'd MMM')}</span>
                        </div>

                        {/* Shifts Grid */}
                        <div className="flex-1 grid grid-cols-4 gap-2">
                            {SHIFT_TIMES.map(shift => {
                                const status = getStatus(dateKey, shift);
                                const isOpen = status === 'OPEN';
                                const shortName = shift.split('(')[0]; // e.g. "Morning"

                                return (
                                    <div 
                                        key={shift} 
                                        className={`
                                            flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all
                                            ${isOpen 
                                                ? 'bg-green-50 border-green-200 text-green-800' 
                                                : 'bg-gray-50 border-gray-100 text-gray-300'
                                            }
                                        `}
                                    >
                                        <span className="text-[9px] font-bold uppercase mb-0.5">{shortName}</span>
                                        {isOpen ? <Check className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>

        {/* Footer Info */}
        <div className="p-4 bg-white border-t text-xs text-gray-500 flex gap-2 items-start">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
            <p>
                This view shows shifts available for <strong>Standard Selection</strong>. 
                AA shifts follow strictly your chosen pattern.
            </p>
        </div>
      </div>
    </div>
  );
};
