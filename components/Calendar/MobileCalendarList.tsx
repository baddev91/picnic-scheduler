
import React from 'react';
import { format, isWeekend } from 'date-fns';
import { Lock, Star, Sun, Moon, Sunrise, Ban, AlertCircle, Clock, CalendarX, Plus, CheckCircle2, Coffee, Briefcase, MinusCircle } from 'lucide-react';
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
      if (time.includes('Opening')) return <Sunrise className="w-5 h-5" />;
      if (time.includes('Morning')) return <Sun className="w-5 h-5" />;
      if (time.includes('Noon')) return <Sun className="w-5 h-5 rotate-45" />;
      return <Moon className="w-5 h-5" />;
  };

  return (
    <div className="space-y-4 pb-24">
      {daysToList.map((day) => {
         const dateKey = formatDateKey(day);
         const isDisabled = isDateDisabledForShopper(day);
         
         if (isDisabled && mode === 'SHOPPER') return null;

         const status = getShopperDayStatus(day);
         const isFWD = status.isFirstWorkingDay;
         const isLockedFWD = mode === 'SHOPPER' && !isFWDSelection && step === 2 && isFWD;
         
         // Visual distinction for days that have AA or are FWD during Standard Step
         const isLockedDayContainer = mode === 'SHOPPER' && step === 2 && (status.aaShift || isFWD);

         // Check if ANY shift is selected for this day
         const selectedShift = currentShopperShifts.find(s => s.date === dateKey);
         const dayHasSelection = !!selectedShift;

         // --- FILTER VISIBLE SHIFTS ---
         const visibleShifts = SHIFT_TIMES.filter(shift => {
             const stdAvailable = isTypeAvailable(dateKey, shift, ShiftType.STANDARD);
             const isFWDAllowed = shift === ShiftTime.MORNING || shift === ShiftTime.AFTERNOON;

             if (isFWDSelection && !isFWDAllowed) return false;
             if (isFWDSelection && !stdAvailable) return false;
             
             // UX IMPROVEMENT: Completely hide shifts that are not available in Admin Config
             if (!isFWDSelection && mode === 'SHOPPER' && !stdAvailable) return false;

             return true;
         });

         const hasVisibleOptions = visibleShifts.length > 0;

         // Header Styles
         let headerBgClass = isWeekend(day) ? 'bg-red-50/30' : 'bg-gray-50';
         let borderColor = 'border-gray-200';
         let statusPill = null;
         
         // --- HEADER STATUS PILL LOGIC ---
         if (isLockedDayContainer) {
             headerBgClass = 'bg-gray-100';
             statusPill = (
                 <div className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">
                     <Lock className="w-3 h-3" /> Locked
                 </div>
             );
         } else if (dayHasSelection) {
             borderColor = 'border-green-200';
             headerBgClass = 'bg-green-50/50';
             // Show Selected Shift Name in Header
             const shiftName = selectedShift.time.split('(')[0];
             statusPill = (
                 <div className="flex items-center gap-1.5 text-xs font-black text-green-700 bg-white px-3 py-1.5 rounded-full border border-green-200 shadow-sm">
                     <CheckCircle2 className="w-3.5 h-3.5 fill-green-100" />
                     {shiftName}
                 </div>
             );
         } else {
             // NO SELECTION - "Rest Day" or "No Start Date"
             if (isFWDSelection) {
                statusPill = (
                     <div className="flex items-center gap-1 text-xs font-medium text-gray-400">
                         Select to start
                     </div>
                );
             } else if (!hasVisibleOptions) {
                statusPill = (
                     <div className="flex items-center gap-1 text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                         <Ban className="w-3 h-3" /> Unavailable
                     </div>
                );
             } else {
                // Neutral state: No pill displayed
                statusPill = null;
             }
         }

         return (
           <div key={dateKey} className={`bg-white rounded-3xl shadow-sm border overflow-hidden transition-all duration-300 ${borderColor} ${dayHasSelection ? 'ring-1 ring-green-100 shadow-green-50' : ''}`}>
              {/* Header */}
              <div className={`px-5 py-4 flex justify-between items-center border-b border-gray-100 ${headerBgClass}`}>
                 <div className="flex items-center gap-4">
                    <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl border shadow-sm 
                        ${isLockedDayContainer 
                            ? 'bg-gray-50 border-gray-200 text-gray-400' 
                            : isWeekend(day) ? 'bg-white border-red-100 text-red-600' : 'bg-white border-gray-200 text-gray-800'
                        }`}>
                        <div className="text-[9px] font-bold uppercase tracking-wider opacity-60">{format(day, 'EEE')}</div>
                        <div className="text-xl font-black leading-none">{format(day, 'd')}</div>
                    </div>
                    <div>
                        <div className={`text-base font-bold ${isLockedDayContainer ? 'text-gray-500' : 'text-gray-900'}`}>{format(day, 'MMMM')}</div>
                        
                        {isFWD && (
                            <div className="text-[10px] font-bold text-amber-600 flex items-center gap-1 mt-0.5">
                                <Star className="w-3 h-3 fill-amber-500" /> First Working Day
                            </div>
                        )}
                        {status.aaShift && step === 2 && (
                             <div className="text-[10px] font-bold text-gray-400 flex items-center gap-1 mt-0.5">
                                 <Lock className="w-3 h-3" /> AA Pattern
                             </div>
                        )}
                    </div>
                 </div>
                 
                 {/* Status Pill (Right Side) */}
                 <div>
                     {statusPill}
                 </div>
              </div>

              {/* Shifts List */}
              <div className="p-3 space-y-2">
                 
                 {/* UX: EMPTY STATE if no shifts available */}
                 {!hasVisibleOptions && !isLockedDayContainer && (
                     <div className="flex flex-col items-center justify-center py-4 px-4 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 text-center">
                         <p className="text-xs font-bold text-gray-400">No shifts available</p>
                     </div>
                 )}

                 {visibleShifts.map((shift) => {
                    const shiftEntries = currentShopperShifts.filter(s => s.date === dateKey && s.time === shift);
                    const isSelectedAA = shiftEntries.some(s => s.type === ShiftType.AA);
                    const isSelectedStd = shiftEntries.some(s => s.type === ShiftType.STANDARD);
                    
                    const label = shift.split(' ')[0];
                    const time = shift.match(/\((.*?)\)/)?.[1];
                    const isFWDAllowed = shift === ShiftTime.MORNING || shift === ShiftTime.AFTERNOON;

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
                            if (!isSelectedStd && !isSelectedAA) {
                                if (isRestViolation(dateKey, shift, currentShopperShifts)) {
                                    isActionDisabled = true;
                                    disabledReason = { text: '11h Rest Rule', colorClass: 'text-gray-400 bg-gray-50 border-gray-200', icon: <Clock className="w-3 h-3" /> };
                                } else if (isConsecutiveDaysViolation(dateKey, currentShopperShifts)) {
                                    isActionDisabled = true;
                                    disabledReason = { text: 'Max 5 Days', colorClass: 'text-gray-400 bg-gray-50 border-gray-200', icon: <CalendarX className="w-3 h-3" /> };
                                }
                            }
                        }
                        if (isLockedFWD) isActionDisabled = true;
                    }

                    // --- STYLE CALCULATION ---
                    let containerClass = "bg-white border border-gray-200";
                    let textClass = "text-gray-700";
                    let subTextClass = "text-gray-400";
                    let iconBg = "bg-gray-50 text-gray-400";
                    // Default to PLUS icon for unselected (Optional feel)
                    let rightIcon = <div className="bg-gray-50 p-1.5 rounded-lg border border-gray-200 group-hover:border-blue-300 group-hover:bg-blue-50 transition-colors"><Plus className="w-4 h-4 text-gray-400 group-hover:text-blue-500" /></div>;

                    // Locked State (Step 2 AA/FWD)
                    if (isLockedDayContainer && (isSelectedAA || isTheFWDSelection)) {
                        containerClass = "bg-gray-50 border-gray-200 opacity-75";
                        textClass = "text-gray-500";
                        rightIcon = <Lock className="w-5 h-5 text-gray-400" />;
                    }
                    // Selected State (Active)
                    else if (isSelectedAA || isSelectedStd || isTheFWDSelection) {
                        const baseColor = isSelectedAA ? 'rose' : (isTheFWDSelection ? 'amber' : 'green');
                        containerClass = `bg-${baseColor}-50 border-${baseColor}-500 ring-1 ring-${baseColor}-200 shadow-sm`;
                        textClass = `text-${baseColor}-900`;
                        subTextClass = `text-${baseColor}-700`;
                        iconBg = `bg-${baseColor}-200 text-${baseColor}-700`;
                        rightIcon = <CheckCircle2 className={`w-6 h-6 text-${baseColor}-600 fill-${baseColor}-100`} />;
                    }
                    // Disabled State
                    else if (isActionDisabled) {
                        containerClass = "bg-gray-50 border-gray-100 border-dashed opacity-60 cursor-not-allowed";
                        iconBg = "bg-gray-100 text-gray-300";
                        rightIcon = null;
                    }
                    // Available (Hover)
                    else if (!isActionDisabled) {
                        containerClass = "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/30";
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
                        className={`w-full relative flex items-center gap-4 p-3 rounded-2xl transition-all duration-200 active:scale-[0.98] text-left group ${containerClass}`}
                      >
                          <div className={`p-2.5 rounded-xl ${iconBg} transition-colors`}>
                              {getShiftIcon(shift)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                              <div className={`text-sm font-bold leading-tight ${textClass}`}>{label}</div>
                              
                              {mode === 'SHOPPER' && disabledReason ? (
                                  <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border flex items-center gap-1 w-fit mt-1 ${disabledReason.colorClass}`}>
                                      {disabledReason.icon} {disabledReason.text}
                                  </div>
                              ) : (
                                  <div className={`text-[11px] font-medium mt-0.5 ${subTextClass}`}>
                                      {step === 2 && (isSelectedAA || isTheFWDSelection) ? 'Locked Selection' : time}
                                  </div>
                              )}
                          </div>

                          {/* Right Side Status Indicator */}
                          <div className="shrink-0">
                              {rightIcon}
                          </div>
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
