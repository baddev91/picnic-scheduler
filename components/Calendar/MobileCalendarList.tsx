import React from 'react';
import { format, isWeekend } from 'date-fns';
import { Lock, Star, Check, Sun, Moon, Sunrise, Sunset } from 'lucide-react';
import { ShiftTime, ShiftType, ShopperShift } from '../../types';
import { SHIFT_TIMES, formatDateKey } from '../../constants';

interface MobileCalendarListProps {
  daysToList: Date[];
  mode: 'ADMIN' | 'SHOPPER';
  step: number;
  isFWDSelection: boolean;
  currentShopperShifts: ShopperShift[];
  fwdCounts: Record<string, number>;
  getShopperDayStatus: (date: Date) => any;
  isDateDisabledForShopper: (date: Date) => boolean;
  isTypeAvailable: (dateKey: string, time: ShiftTime, type: ShiftType) => boolean;
  onShopperToggle?: (date: string, shift: ShiftTime, type: ShiftType) => void;
}

export const MobileCalendarList: React.FC<MobileCalendarListProps> = ({
  daysToList,
  mode,
  step,
  isFWDSelection,
  currentShopperShifts,
  fwdCounts,
  getShopperDayStatus,
  isDateDisabledForShopper,
  isTypeAvailable,
  onShopperToggle
}) => {
  
  // Helper for icons
  const getShiftIcon = (time: string) => {
      if (time.includes('Opening')) return <Sunrise className="w-4 h-4" />;
      if (time.includes('Morning')) return <Sun className="w-4 h-4" />;
      if (time.includes('Noon')) return <Sun className="w-4 h-4 rotate-45" />;
      return <Moon className="w-4 h-4" />;
  };

  return (
    <div className="space-y-4 pb-20">
      {daysToList.map((day) => {
         const dateKey = formatDateKey(day);
         const isDisabled = isDateDisabledForShopper(day);
         
         if (isDisabled && mode === 'SHOPPER') return null;

         const status = getShopperDayStatus(day);
         const isFWD = status.isFirstWorkingDay;
         const isLockedFWD = mode === 'SHOPPER' && !isFWDSelection && step === 2 && isFWD;

         return (
           <div key={dateKey} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Header */}
              <div className={`px-4 py-3 flex justify-between items-center ${isWeekend(day) ? 'bg-red-50/50' : 'bg-gray-50/50'}`}>
                 <div className="flex items-center gap-3">
                    <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl border shadow-sm ${isWeekend(day) ? 'bg-white border-red-100 text-red-600' : 'bg-white border-gray-200 text-gray-700'}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider">{format(day, 'EEE')}</div>
                        <div className="text-xl font-black leading-none">{format(day, 'd')}</div>
                    </div>
                    <div>
                        <div className="text-sm font-bold text-gray-900">{format(day, 'MMMM yyyy')}</div>
                        {isFWD && <div className="text-[10px] font-bold text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full w-fit mt-1 flex items-center gap-1"><Star className="w-3 h-3 fill-yellow-600" /> First Working Day</div>}
                    </div>
                 </div>
              </div>

              {/* Grid */}
              <div className="p-3 grid grid-cols-2 gap-3">
                 {SHIFT_TIMES.map((shift) => {
                    const stdAvailable = isTypeAvailable(dateKey, shift, ShiftType.STANDARD);
                    const shiftEntries = currentShopperShifts.filter(s => s.date === dateKey && s.time === shift);
                    const isSelectedAA = shiftEntries.some(s => s.type === ShiftType.AA);
                    const isSelectedStd = shiftEntries.some(s => s.type === ShiftType.STANDARD);
                    
                    const label = shift.split(' ')[0];
                    const time = shift.match(/\((.*?)\)/)?.[1];
                    const isFWDAllowed = shift === ShiftTime.MORNING || shift === ShiftTime.AFTERNOON;

                    // Rendering Logic
                    if (isFWDSelection && !isFWDAllowed) return null;
                    if (isFWDSelection && !stdAvailable) return null;
                    if (mode === 'SHOPPER' && !isFWDSelection && step >= 1 && !stdAvailable && !isSelectedStd) return null;

                    const fwdKey = `${dateKey}_${shift}`;
                    const currentFWDCount = fwdCounts[fwdKey] || 0;
                    const isFull = isFWDSelection && currentFWDCount >= 5;
                    const isTheFWDSelection = isFWD && shiftEntries.length > 0;

                    // Styles Calculation
                    let buttonClass = "bg-white border-gray-200 text-gray-500 hover:border-gray-300"; // Default
                    let iconClass = "text-gray-400 bg-gray-100";
                    
                    // 1. AA Style (Red)
                    if (isSelectedAA && !isFWDSelection) {
                        buttonClass = "bg-red-500 border-red-600 text-white shadow-md shadow-red-200 ring-2 ring-red-500 ring-offset-1";
                        iconClass = "bg-white/20 text-white";
                    } 
                    // 2. FWD Style (Yellow)
                    else if (isTheFWDSelection) {
                         buttonClass = "bg-yellow-400 border-yellow-500 text-yellow-900 shadow-md shadow-yellow-200 ring-2 ring-yellow-400 ring-offset-1";
                         iconClass = "bg-white/40 text-yellow-900";
                    }
                    // 3. Standard Style (Green)
                    else if (isSelectedStd) {
                        buttonClass = "bg-green-600 border-green-700 text-white shadow-md shadow-green-200 ring-2 ring-green-600 ring-offset-1";
                        iconClass = "bg-white/20 text-white";
                    }

                    // Disabled/Locked States
                    const isDisabled = (mode === 'SHOPPER' && !stdAvailable) || (isFull && !isTheFWDSelection) || isLockedFWD;
                    if (isDisabled) {
                        buttonClass = "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed opacity-80";
                        iconClass = "bg-gray-100 text-gray-300";
                    }

                    return (
                      <button
                        key={shift}
                        disabled={isDisabled}
                        onClick={() => {
                           if (mode === 'SHOPPER' && onShopperToggle && stdAvailable && !isFull && !isLockedFWD) {
                              onShopperToggle(dateKey, shift, ShiftType.STANDARD);
                           }
                        }}
                        className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 active:scale-[0.98] text-left ${buttonClass}`}
                      >
                          <div className={`p-2 rounded-lg ${iconClass}`}>
                              {getShiftIcon(shift)}
                          </div>
                          
                          <div className="flex-1">
                              <div className="text-sm font-bold leading-tight">{label}</div>
                              <div className="text-[10px] opacity-80 font-medium">{time}</div>
                          </div>

                          {/* Status Icons */}
                          {isTheFWDSelection && <Star className="w-5 h-5 fill-white text-white absolute top-2 right-2 opacity-50" />}
                          {isSelectedStd && !isTheFWDSelection && <Check className="w-5 h-5 text-white absolute top-2 right-2 opacity-50" />}
                          {isLockedFWD && !isTheFWDSelection && <Lock className="w-4 h-4 absolute top-1/2 right-3 -translate-y-1/2" />}
                          
                          {isFull && !isTheFWDSelection && (
                              <span className="absolute inset-0 flex items-center justify-center bg-gray-100/90 font-bold text-gray-500 text-xs rounded-xl uppercase">
                                  Full
                              </span>
                          )}
                      </button>
                    );
                 })}
              </div>
           </div>
         );
      })}
    </div>
  );
};