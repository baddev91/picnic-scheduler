
import React from 'react';
import { format, isWeekend } from 'date-fns';
import { Lock, Star, Check, Sun, Moon, Sunrise, Sunset, Ban, AlertCircle, Clock, CalendarX, Plus } from 'lucide-react';
import { ShiftTime, ShiftType, ShopperShift } from '../../types';
import { SHIFT_TIMES, formatDateKey } from '../../constants';
import { isRestViolation, isConsecutiveDaysViolation } from '../../utils/validation';

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
         
         // Visual distinction for days that have AA or are FWD during Standard Step
         const isLockedDayContainer = mode === 'SHOPPER' && step === 2 && (status.aaShift || isFWD);

         // Muted styles for headers in Step 3 if day is locked
         let headerBgClass = isWeekend(day) ? 'bg-red-50/50' : 'bg-gray-50/50';
         let borderColor = 'border-gray-100';
         let shadowColor = 'shadow-sm';

         if (isLockedDayContainer) {
             // In Step 3, make locked containers look neutral/finished
             headerBgClass = 'bg-gray-100 text-gray-500'; 
             borderColor = 'border-gray-200';
             shadowColor = 'shadow-sm grayscale'; 
         }

         return (
           <div key={dateKey} className={`bg-white rounded-2xl ${shadowColor} border overflow-hidden ${borderColor}`}>
              {/* Header */}
              <div className={`px-4 py-3 flex justify-between items-center ${headerBgClass}`}>
                 <div className="flex items-center gap-3">
                    <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl border shadow-sm 
                        ${isLockedDayContainer 
                            ? 'bg-gray-50 border-gray-200 text-gray-400' 
                            : isWeekend(day) ? 'bg-white border-red-100 text-red-600' : 'bg-white border-gray-200 text-gray-700'
                        }`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider">{format(day, 'EEE')}</div>
                        <div className="text-xl font-black leading-none">{format(day, 'd')}</div>
                    </div>
                    <div>
                        <div className={`text-sm font-bold ${isLockedDayContainer ? 'text-gray-500' : 'text-gray-900'}`}>{format(day, 'MMMM yyyy')}</div>
                        
                        {isFWD && (
                            <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit mt-1 flex items-center gap-1
                                ${isLockedDayContainer ? 'bg-gray-200 text-gray-600' : 'text-yellow-600 bg-yellow-100'}
                            `}>
                                <Star className={`w-3 h-3 ${isLockedDayContainer ? 'fill-gray-600' : 'fill-yellow-600'}`} /> First Working Day
                            </div>
                        )}
                        {status.aaShift && step === 2 && (
                             <div className="text-[10px] font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full w-fit mt-1 flex items-center gap-1">
                                 <Lock className="w-3 h-3" /> AA Day
                             </div>
                        )}
                    </div>
                 </div>
                 {isLockedDayContainer && (
                     <div className="text-gray-300">
                         <Lock className="w-5 h-5" />
                     </div>
                 )}
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

                    const fwdKey = `${dateKey}_${shift}`;
                    const currentFWDCount = fwdCounts[fwdKey] || 0;
                    const isFull = isFWDSelection && currentFWDCount >= 5;
                    const isTheFWDSelection = isFWD && shiftEntries.length > 0;

                    // --- VALIDATION REASONING ---
                    let disabledReason: { text: string; colorClass: string; icon: React.ReactNode } | null = null;
                    let isActionDisabled = false;

                    if (mode === 'SHOPPER') {
                        if (isFWDSelection) {
                            if (!isFWDAllowed) { isActionDisabled = true; disabledReason = { text: 'Not for Day 1', colorClass: 'text-orange-600 bg-orange-50 border-orange-100', icon: <AlertCircle className="w-3 h-3" /> }; }
                            else if (isFull) { isActionDisabled = true; disabledReason = { text: 'Full', colorClass: 'text-purple-600 bg-purple-50 border-purple-100', icon: <Ban className="w-3 h-3" /> }; }
                        } else {
                            if (!stdAvailable) {
                                isActionDisabled = true;
                                disabledReason = { text: 'Unavailable', colorClass: 'text-gray-400 bg-gray-50 border-gray-100', icon: <Ban className="w-3 h-3" /> };
                            } else if (!isSelectedStd && !isSelectedAA) {
                                if (isRestViolation(dateKey, shift, currentShopperShifts)) {
                                    isActionDisabled = true;
                                    disabledReason = { text: '11h Rule', colorClass: 'text-gray-400 bg-gray-50 border-gray-200', icon: <Clock className="w-3 h-3" /> };
                                } else if (isConsecutiveDaysViolation(dateKey, currentShopperShifts)) {
                                    isActionDisabled = true;
                                    disabledReason = { text: 'Max 5 Days', colorClass: 'text-gray-400 bg-gray-50 border-gray-200', icon: <CalendarX className="w-3 h-3" /> };
                                }
                            }
                        }
                        if (isLockedFWD) isActionDisabled = true;
                    }

                    // Styles Calculation
                    let buttonClass = "bg-white border-gray-200 text-gray-500 hover:border-gray-300"; // Default
                    let iconClass = "text-gray-400 bg-gray-100";
                    let contentOpacity = "opacity-100";
                    
                    if (isSelectedAA && !isFWDSelection) {
                        if (step === 2) {
                            // Grey out AA in Step 3
                            buttonClass = "bg-gray-100 border-gray-200 text-gray-500 cursor-default shadow-inner";
                            iconClass = "bg-gray-200 text-gray-400";
                        } else {
                            // Bright Red in Step 1
                            buttonClass = "bg-red-500 border-red-600 text-white shadow-md shadow-red-200 ring-2 ring-red-500 ring-offset-1";
                            iconClass = "bg-white/20 text-white";
                        }
                    } else if (isTheFWDSelection) {
                         if (step === 2) {
                             // Grey out FWD in Step 3
                             buttonClass = "bg-gray-100 border-gray-200 text-gray-500 cursor-default shadow-inner";
                             iconClass = "bg-gray-200 text-gray-400";
                         } else {
                             // Bright Yellow in Step 2
                             buttonClass = "bg-yellow-400 border-yellow-500 text-yellow-900 shadow-md shadow-yellow-200 ring-2 ring-yellow-400 ring-offset-1";
                             iconClass = "bg-white/40 text-yellow-900";
                         }
                    } else if (isSelectedStd) {
                        buttonClass = "bg-green-600 border-green-700 text-white shadow-md shadow-green-200 ring-2 ring-green-600 ring-offset-1";
                        iconClass = "bg-white/20 text-white";
                    } else if (isActionDisabled) {
                        buttonClass = "bg-white border-dashed border-gray-200 cursor-not-allowed";
                        contentOpacity = "opacity-40 grayscale";
                    } else {
                        // ** AVAILABLE AND CLICKABLE **
                        // Make border slightly more visible and text clearly actionable
                        buttonClass = "bg-white border-2 border-emerald-200 text-emerald-800 shadow-sm hover:border-emerald-400 hover:bg-emerald-50 active:scale-[0.98]";
                        iconClass = "bg-emerald-50 text-emerald-600";
                    }

                    return (
                      <button
                        key={shift}
                        disabled={isActionDisabled}
                        onClick={() => {
                           if (mode === 'SHOPPER' && onShopperToggle && !isActionDisabled) {
                              onShopperToggle(dateKey, shift, ShiftType.STANDARD);
                           }
                        }}
                        className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 active:scale-[0.98] text-left overflow-hidden ${buttonClass}`}
                      >
                          <div className={`p-2 rounded-lg ${iconClass} ${contentOpacity}`}>
                              {step === 2 && (isSelectedAA || isTheFWDSelection) ? <Lock className="w-4 h-4" /> : getShiftIcon(shift)}
                          </div>
                          
                          <div className="flex-1 min-w-0 z-10">
                              <div className={`text-sm font-bold leading-tight truncate ${contentOpacity}`}>{label}</div>
                              
                              {mode === 'SHOPPER' && disabledReason ? (
                                  <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border flex items-center gap-1 w-fit mt-1 shadow-sm ${disabledReason.colorClass}`}>
                                      {disabledReason.icon} {disabledReason.text}
                                  </div>
                              ) : (
                                  <div className={`text-[10px] opacity-80 font-medium truncate ${contentOpacity}`}>
                                      {step === 2 && (isSelectedAA || isTheFWDSelection) ? 'Locked' : time}
                                  </div>
                              )}
                          </div>

                          {/* Status Icons */}
                          {isTheFWDSelection && step !== 2 && <Star className="w-5 h-5 fill-white text-white absolute top-2 right-2 opacity-50" />}
                          {isSelectedStd && !isTheFWDSelection && <Check className="w-5 h-5 text-white absolute top-2 right-2 opacity-50" />}
                          
                          {/* AVAILABLE ICON (Plus) for Step 3 Available slots */}
                          {!isSelectedStd && !isSelectedAA && !isActionDisabled && !isLockedDayContainer && step === 2 && (
                              <div className="absolute top-1/2 right-3 -translate-y-1/2 opacity-20 text-emerald-600">
                                  <Plus className="w-5 h-5" />
                              </div>
                          )}
                          
                          {/* Lock Icon Overlay for Step 3 */}
                          {step === 2 && (isSelectedAA || isTheFWDSelection) && (
                              <Lock className="w-4 h-4 absolute top-2 right-2 text-gray-400 opacity-50" />
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
