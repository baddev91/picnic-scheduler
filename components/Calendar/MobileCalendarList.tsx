
import React from 'react';
import { format, isWeekend } from 'date-fns';
import { Lock, Star, Sun, Moon, Sunrise, Ban, AlertCircle, Clock, CalendarX, Plus, CheckCircle2, Info } from 'lucide-react';
import { ShiftTime, ShiftType, ShopperShift } from '../../types';
import { SHIFT_TIMES, formatDateKey } from '../../constants';
import { isRestViolation, isConsecutiveDaysViolation, isOpeningShiftViolation } from '../../utils/validation';

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
  firstWorkingDay?: string; // Added Prop
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
  onShopperToggle,
  firstWorkingDay
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
         
         // Check if ANY shift is selected for this day
         const selectedShift = currentShopperShifts.find(s => s.date === dateKey);
         const dayHasSelection = !!selectedShift;

         // --- CALCULATE SHIFT STATES BEFORE RENDERING ---
         const visibleShifts = SHIFT_TIMES.filter(shift => {
             const stdAvailable = isTypeAvailable(dateKey, shift, ShiftType.STANDARD);
             const isFWDAllowed = shift === ShiftTime.MORNING || shift === ShiftTime.AFTERNOON;

             if (isFWDSelection && !isFWDAllowed) return false;
             if (isFWDSelection && !stdAvailable) return false;
             if (!isFWDSelection && mode === 'SHOPPER' && !stdAvailable) return false;

             return true;
         });

         const hasVisibleOptions = visibleShifts.length > 0;

         // Pre-calculate state for all visible shifts to decide Layout Mode
         const shiftData = visibleShifts.map(shift => {
            const shiftEntries = currentShopperShifts.filter(s => s.date === dateKey && s.time === shift);
            const isSelectedAA = shiftEntries.some(s => s.type === ShiftType.AA);
            const isSelectedStd = shiftEntries.some(s => s.type === ShiftType.STANDARD);
            const isTheFWDSelection = isFWD && shiftEntries.length > 0;
            
            const isFWDAllowed = shift === ShiftTime.MORNING || shift === ShiftTime.AFTERNOON;
            const fwdKey = `${dateKey}_${shift}`;
            const currentFWDCount = fwdCounts[fwdKey] || 0;
            const isFull = isFWDSelection && currentFWDCount >= 5;

            let disabledReason: { text: string; colorClass: string; icon: React.ReactNode } | null = null;
            let isActionDisabled = false;

            if (mode === 'SHOPPER') {
                if (isFWDSelection) {
                    if (!isFWDAllowed) { isActionDisabled = true; disabledReason = { text: 'Not for Day 1', colorClass: 'text-orange-600', icon: <AlertCircle className="w-3 h-3" /> }; }
                    else if (isFull) { isActionDisabled = true; disabledReason = { text: 'Full', colorClass: 'text-purple-600', icon: <Ban className="w-3 h-3" /> }; }
                } else {
                    if (!isSelectedStd && !isSelectedAA) {
                        if (isRestViolation(dateKey, shift, currentShopperShifts)) {
                            isActionDisabled = true;
                            disabledReason = { text: 'Rest Rule (11h)', colorClass: 'text-gray-500', icon: <Clock className="w-3 h-3" /> };
                        } else if (isConsecutiveDaysViolation(dateKey, currentShopperShifts)) {
                            isActionDisabled = true;
                            disabledReason = { text: 'Max 5 Days', colorClass: 'text-gray-500', icon: <CalendarX className="w-3 h-3" /> };
                        } else if (isOpeningShiftViolation(dateKey, shift, currentShopperShifts, firstWorkingDay)) { // Passed firstWorkingDay
                            isActionDisabled = true;
                            disabledReason = { text: 'Needs 2 prior shifts', colorClass: 'text-orange-600', icon: <AlertCircle className="w-3 h-3" /> };
                        }
                    }
                }
                if (isLockedFWD) isActionDisabled = true;
            }

            const isSelected = isSelectedAA || isSelectedStd || isTheFWDSelection;
            
            return {
                shift,
                isSelected,
                isSelectedAA,
                isSelectedStd,
                isTheFWDSelection,
                isActionDisabled,
                disabledReason,
                label: shift.split(' ')[0],
                time: shift.match(/\((.*?)\)/)?.[1]
            };
         });

         const hasSelectableOptions = shiftData.some(s => !s.isActionDisabled);
         const selections = shiftData.filter(s => s.isSelected);
         const blockedShifts = shiftData.filter(s => !s.isSelected && s.isActionDisabled);

         // --- COMPACT MODE DECISION ---
         // Use compact mode if there are NO selectable options for the user to click.
         // This saves space by collapsing disabled rows.
         const useCompactMode = !hasSelectableOptions && mode === 'SHOPPER';

         // Header Styles (Cleaned up - Removed Green Selection Tint)
         let headerBgClass = isWeekend(day) ? 'bg-red-50/40' : 'bg-gray-50/60';
         let borderColor = 'border-gray-200';
         let cardShadow = 'shadow-sm';

         if (dayHasSelection) {
             // Subtle active state instead of strong green
             borderColor = 'border-gray-300';
             cardShadow = 'shadow-md';
         }

         return (
           <div key={dateKey} className={`bg-white rounded-3xl ${cardShadow} border overflow-hidden transition-all duration-300 ${borderColor}`}>
              {/* Header */}
              <div className={`px-5 py-3 flex justify-between items-center border-b border-gray-100 ${headerBgClass}`}>
                 <div className="flex items-center gap-4">
                    <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-xl border shadow-sm 
                        ${isWeekend(day) ? 'bg-white border-red-100 text-red-600' : 'bg-white border-gray-200 text-gray-800'}`}>
                        <div className="text-[8px] font-bold uppercase tracking-wider opacity-60">{format(day, 'EEE')}</div>
                        <div className="text-lg font-black leading-none">{format(day, 'd')}</div>
                    </div>
                    <div>
                        <div className="text-sm font-bold text-gray-900">{format(day, 'MMMM')}</div>
                        
                        {isFWD && (
                            <div className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                                <Star className="w-3 h-3 fill-amber-500" /> First Working Day
                            </div>
                        )}
                        {status.aaShift && step === 2 && !isFWD && (
                             <div className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                 <Lock className="w-3 h-3" /> AA Pattern
                             </div>
                        )}
                    </div>
                 </div>
                 
                 {/* Right Side Pill (Still colored for clarity, but small) */}
                 {dayHasSelection && (
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-600 bg-white px-2.5 py-1 rounded-full border border-gray-200 shadow-sm">
                          <CheckCircle2 className="w-3 h-3 fill-gray-100" />
                          {selections.map(s => s.label).join(', ')}
                      </div>
                 )}
              </div>

              {/* Body */}
              <div className="p-3">
                 
                 {/* EMPTY STATE */}
                 {!hasVisibleOptions && (
                     <div className="py-2 text-center">
                         <p className="text-xs font-bold text-gray-300">No shifts available</p>
                     </div>
                 )}

                 {/* COMPACT MODE: Show only selections + summary of disabled */}
                 {useCompactMode && hasVisibleOptions && (
                     <div className="space-y-2">
                         {selections.length > 0 ? (
                            selections.map(data => (
                                <div key={data.shift} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl opacity-80">
                                     <div className="p-2 bg-white rounded-lg text-gray-400">
                                         {getShiftIcon(data.shift)}
                                     </div>
                                     <div className="flex-1">
                                         <div className="text-sm font-bold text-gray-600">{data.label}</div>
                                         <div className="text-[10px] font-medium text-gray-400">Locked Selection</div>
                                     </div>
                                     <Lock className="w-4 h-4 text-gray-400" />
                                </div>
                            ))
                         ) : (
                             <div className="py-3 px-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center">
                                 <p className="text-xs text-gray-400 font-medium">No shifts available to select.</p>
                             </div>
                         )}

                         {/* Footer summary for blocked shifts */}
                         {blockedShifts.length > 0 && (
                             <div className="px-2 pt-1">
                                 {blockedShifts.map(b => (
                                     <div key={b.shift} className="flex items-center gap-2 text-[10px] text-gray-400 mb-1 last:mb-0">
                                         <Ban className="w-3 h-3 opacity-50" />
                                         <span>
                                             <strong className="font-medium">{b.label}</strong> unavailable: {b.disabledReason?.text}
                                         </span>
                                     </div>
                                 ))}
                             </div>
                         )}
                     </div>
                 )}

                 {/* EXPANDED MODE: Show interactive buttons */}
                 {!useCompactMode && (
                     <div className="space-y-2">
                         {shiftData.map((data) => {
                            // Determine Gradient & Styles
                            let btnClass = "border bg-white";
                            let iconClass = "bg-gray-50 text-gray-400";
                            let textClass = "text-gray-700";
                            let subTextClass = "text-gray-400";
                            
                            if (data.isSelected) {
                                const theme = data.isSelectedAA ? 'red' : (data.isTheFWDSelection ? 'amber' : 'green');
                                btnClass = `bg-gradient-to-r from-${theme}-50 to-${theme}-100/30 border-${theme}-500 shadow-sm`;
                                iconClass = `bg-white text-${theme}-600 shadow-sm ring-1 ring-${theme}-100`;
                                textClass = `text-${theme}-900`;
                                subTextClass = `text-${theme}-700`;
                            } else if (data.isActionDisabled) {
                                btnClass = "bg-gray-50 border-gray-100 border-dashed opacity-60";
                                iconClass = "bg-gray-100 text-gray-300";
                                textClass = "text-gray-400";
                            } else {
                                // Available & Clickable
                                btnClass = "bg-gradient-to-r from-white to-gray-50/30 border-gray-200 hover:to-green-50 hover:border-green-300 hover:shadow-md transition-all group";
                                iconClass = "bg-gray-50 text-gray-500 group-hover:bg-white group-hover:text-green-600 transition-colors";
                            }

                            return (
                                <button
                                    key={data.shift}
                                    disabled={data.isActionDisabled}
                                    onClick={() => {
                                        if (mode === 'SHOPPER' && onShopperToggle && !data.isActionDisabled) {
                                            onShopperToggle(dateKey, data.shift, ShiftType.STANDARD);
                                        }
                                    }}
                                    className={`w-full relative flex items-center gap-4 p-3 rounded-2xl text-left active:scale-[0.99] transition-all duration-200 ${btnClass}`}
                                >
                                    <div className={`p-2.5 rounded-xl transition-all duration-300 ${iconClass}`}>
                                        {getShiftIcon(data.shift)}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-sm font-bold leading-tight ${textClass}`}>{data.label}</div>
                                        
                                        {data.isActionDisabled && data.disabledReason ? (
                                            <div className={`text-[10px] font-bold uppercase mt-1 flex items-center gap-1 ${data.disabledReason.colorClass}`}>
                                                {data.disabledReason.icon} {data.disabledReason.text}
                                            </div>
                                        ) : (
                                            <div className={`text-[11px] font-medium mt-0.5 ${subTextClass}`}>
                                                {step === 2 && data.isSelectedAA ? 'Locked Selection' : data.time}
                                            </div>
                                        )}
                                    </div>

                                    <div className="shrink-0">
                                        {data.isSelected ? (
                                            <CheckCircle2 className={`w-6 h-6 ${data.isSelectedAA ? 'text-red-500' : (data.isTheFWDSelection ? 'text-amber-500' : 'text-green-500')}`} />
                                        ) : !data.isActionDisabled ? (
                                            <div className="bg-gray-50 p-1.5 rounded-lg border border-gray-200 group-hover:border-green-200 group-hover:bg-green-50 transition-colors">
                                                <Plus className="w-4 h-4 text-gray-300 group-hover:text-green-600" />
                                            </div>
                                        ) : null}
                                    </div>
                                </button>
                            );
                         })}
                     </div>
                 )}
              </div>
           </div>
         );
      })}
    </div>
  );
};
