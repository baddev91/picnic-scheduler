import React from 'react';
import { format, isWeekend } from 'date-fns';
import { Lock, Star, Check } from 'lucide-react';
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
  const CheckCircleIcon = (props: any) => (
      <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
  );

  return (
    <div className="space-y-4 pb-20">
      {daysToList.map((day) => {
         const dateKey = formatDateKey(day);
         const isDisabled = isDateDisabledForShopper(day);
         
         // Skip past/disabled days in Shopper Mode list view to reduce scrolling
         if (isDisabled && mode === 'SHOPPER') return null;

         const status = getShopperDayStatus(day);
         const isFWD = status.isFirstWorkingDay;

         // FWD LOCK: If we are in Step 2 (Standard Selection) and this day IS the First Working Day, 
         // we should prevent interaction or visually indicate it is locked.
         const isLockedFWD = mode === 'SHOPPER' && !isFWDSelection && step === 2 && isFWD;

         return (
           <div key={dateKey} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Mobile Card Header */}
              <div className={`p-3 flex justify-between items-center ${isWeekend(day) ? 'bg-red-50' : 'bg-gray-50'}`}>
                 <div className="flex items-center gap-3">
                    <div className={`text-center px-3 py-1 rounded-lg ${isWeekend(day) ? 'bg-white text-red-600 font-bold shadow-sm' : 'bg-white text-gray-700 font-bold border'}`}>
                        <div className="text-xs uppercase">{format(day, 'EEE')}</div>
                        <div className="text-lg leading-none">{format(day, 'd')}</div>
                    </div>
                    <div className="text-sm text-gray-500">
                        {format(day, 'MMMM yyyy')}
                    </div>
                 </div>
              </div>

              {/* Mobile Shift Grid */}
              <div className="p-3 grid grid-cols-2 gap-2">
                 {SHIFT_TIMES.map((shift) => {
                    const aaAvailable = isTypeAvailable(dateKey, shift, ShiftType.AA);
                    const stdAvailable = isTypeAvailable(dateKey, shift, ShiftType.STANDARD);
                    
                    const shiftEntries = currentShopperShifts.filter(s => s.date === dateKey && s.time === shift);
                    const isSelectedAA = shiftEntries.some(s => s.type === ShiftType.AA);
                    const isSelectedStd = shiftEntries.some(s => s.type === ShiftType.STANDARD);
                    
                    const label = shift.split(' ')[0]; // Opening, Morning...
                    const time = shift.match(/\((.*?)\)/)?.[1];

                    // FWD Mode Logic: Only show Morning/Afternoon buttons
                    const isFWDAllowed = shift === ShiftTime.MORNING || shift === ShiftTime.AFTERNOON;
                    if (isFWDSelection && !isFWDAllowed) return null;
                    
                    // HIDE unavailable shifts in FWD mode
                    if (isFWDSelection && !stdAvailable) return null;

                    // Only show Standard options in Step 1 or 2
                    if (mode === 'SHOPPER' && !isFWDSelection && step >= 1 && !stdAvailable && !isSelectedStd) {
                        return null; 
                    }
                    
                    // MAX 5 Logic for FWD Selection
                    const fwdKey = `${dateKey}_${shift}`;
                    const currentFWDCount = fwdCounts[fwdKey] || 0;
                    const isFull = isFWDSelection && currentFWDCount >= 5;

                    // Identify if this specific button is the selected First Working Day shift
                    const isTheFWDSelection = isFWD && shiftEntries.length > 0;

                    return (
                      <button
                        key={shift}
                        // FWD Mode: Disable if not Morning/Afternoon or not available OR FULL
                        // Standard Mode: Disable if FWD Locked, OR not available. 
                        disabled={
                            (mode === 'SHOPPER' && !stdAvailable) || 
                            (isFull && !isTheFWDSelection) ||
                            (isLockedFWD)
                        }
                        onClick={() => {
                           if (mode === 'SHOPPER' && onShopperToggle && stdAvailable && !isFull && !isLockedFWD) {
                              onShopperToggle(dateKey, shift, ShiftType.STANDARD);
                           }
                        }}
                        className={`
                          relative flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all
                          ${isTheFWDSelection 
                              ? 'bg-yellow-50 border-yellow-400 ring-2 ring-yellow-400 text-yellow-800 shadow-md transform scale-[1.02] z-10'
                              : isSelectedAA 
                                  ? 'bg-red-50 border-red-200 text-red-700' 
                                  : isSelectedStd 
                                      ? 'bg-green-100 border-green-500 text-green-800 ring-1 ring-green-500 shadow-md' 
                                      : 'bg-white border-gray-100 text-gray-600 hover:border-green-300 hover:bg-green-50'}
                          ${(mode === 'SHOPPER' && !stdAvailable) ? 'opacity-50 cursor-not-allowed' : ''}
                          ${isFull && !isTheFWDSelection ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}
                          ${isLockedFWD ? 'cursor-not-allowed opacity-90' : ''}
                        `}
                      >
                          <span className="text-sm font-bold">{label}</span>
                          <span className="text-[10px] opacity-70">{time}</span>
                          
                          {/* Star Icon for FWD */}
                          {(isFWDSelection && isTheFWDSelection) || (isTheFWDSelection && isLockedFWD) ? (
                              <span className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-sm border border-yellow-200 z-20">
                                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                              </span>
                          ) : null}

                          {/* FWD Locked Indicator */}
                          {isLockedFWD && !isTheFWDSelection && (
                              <span className="absolute inset-0 flex items-center justify-center bg-gray-100/50">
                                 <Lock className="w-4 h-4 text-gray-400" />
                              </span>
                          )}
                          
                          {/* FULL Indicator */}
                          {isFull && !isTheFWDSelection && (
                              <span className="absolute inset-0 flex items-center justify-center bg-gray-100/80 font-bold text-gray-500 text-xs rounded-lg uppercase">
                                  Full
                              </span>
                          )}
                          
                          {/* Generic Selection Indicators (Non-FWD) */}
                          {isSelectedAA && !isFWDSelection && <span className="absolute top-1 right-1 text-[9px] font-bold bg-white/50 px-1 rounded text-red-600">AA</span>}
                          {isSelectedStd && !isFWDSelection && !isLockedFWD && <CheckCircleIcon className="absolute top-1 right-1 w-3 h-3 text-green-600" />}
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