import React from 'react';
import { format } from 'date-fns';
import { X, Lock, Check, Star, Sun, Moon, Sunrise } from 'lucide-react';
import { ShiftTime, ShiftType, ShopperShift } from '../../types';
import { SHIFT_TIMES, formatDateKey } from '../../constants';

interface DesktopDayPanelProps {
  selectedDay: Date | null;
  mode: 'ADMIN' | 'SHOPPER';
  step: number;
  isFWDSelection: boolean;
  firstWorkingDay?: string;
  currentShopperShifts: ShopperShift[];
  fwdCounts: Record<string, number>;
  isDateDisabledForShopper: (date: Date) => boolean;
  isTypeAvailable: (dateKey: string, time: ShiftTime, type: ShiftType) => boolean;
  onAdminToggle?: (date: string, shift: ShiftTime, type: ShiftType) => void;
  onShopperToggle?: (date: string, shift: ShiftTime, type: ShiftType) => void;
  setSelectedDay: (date: Date | null) => void;
}

export const DesktopDayPanel: React.FC<DesktopDayPanelProps> = ({
  selectedDay,
  mode,
  step,
  isFWDSelection,
  firstWorkingDay,
  currentShopperShifts,
  fwdCounts,
  isDateDisabledForShopper,
  isTypeAvailable,
  onAdminToggle,
  onShopperToggle,
  setSelectedDay
}) => {
  if (!selectedDay) return null;
  const dateKey = formatDateKey(selectedDay);
  const isFWD = firstWorkingDay === dateKey;
  
  if (mode === 'SHOPPER' && isDateDisabledForShopper(selectedDay)) return null;

  const isLockedFWD = mode === 'SHOPPER' && !isFWDSelection && step === 2 && isFWD;

  // Header Color Logic
  let headerBg = "bg-gray-50";
  let headerText = "text-gray-900";
  if (isFWDSelection) { headerBg = "bg-yellow-50 border-b-yellow-100"; headerText = "text-yellow-900"; }
  else if (step === 0 && mode === 'SHOPPER') { headerBg = "bg-red-50 border-b-red-100"; headerText = "text-red-900"; }
  else if (step === 2 && mode === 'SHOPPER') { headerBg = "bg-green-50 border-b-green-100"; headerText = "text-green-900"; }

  const getShiftIcon = (time: string) => {
    if (time.includes('Opening')) return <Sunrise className="w-4 h-4" />;
    if (time.includes('Morning')) return <Sun className="w-4 h-4" />;
    if (time.includes('Noon')) return <Sun className="w-4 h-4 rotate-45" />;
    return <Moon className="w-4 h-4" />;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        
        {/* Styled Header */}
        <div className={`${headerBg} p-6 border-b flex justify-between items-center shrink-0`}>
          <div>
            <h3 className={`text-xl font-black ${headerText}`}>{format(selectedDay, 'EEEE, MMM do')}</h3>
            <p className="text-sm text-gray-500 font-medium opacity-80">
              {mode === 'ADMIN' 
                ? 'Configure Availability' 
                : isFWDSelection 
                  ? 'Select your Start Date' 
                  : isLockedFWD 
                      ? 'First Working Day (Locked)'
                      : step === 0 
                          ? 'Select AA Pattern' 
                          : 'Select Standard Shifts'
              }
            </p>
          </div>
          <button onClick={() => setSelectedDay(null)} className="bg-white/50 hover:bg-white p-2 rounded-full transition-colors shadow-sm">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto bg-white">
          {isLockedFWD && (
             <div className="p-4 bg-yellow-50 text-yellow-800 text-sm rounded-xl border border-yellow-200 flex items-center gap-3 font-medium">
                 <Lock className="w-5 h-5" /> This is your First Working Day. <br/>Go back to Step 2 to change it.
             </div>
          )}
          
          {SHIFT_TIMES.map((shift) => {
            const aaAvailable = isTypeAvailable(dateKey, shift, ShiftType.AA);
            const stdAvailable = isTypeAvailable(dateKey, shift, ShiftType.STANDARD);
            
            const shiftEntries = currentShopperShifts.filter(s => s.date === dateKey && s.time === shift);
            const isSelectedAA = shiftEntries.some(s => s.type === ShiftType.AA);
            const isSelectedStd = shiftEntries.some(s => s.type === ShiftType.STANDARD);

            const isFWDAllowed = shift === ShiftTime.MORNING || shift === ShiftTime.AFTERNOON;
            const isFWDButtonDisabled = isFWDSelection && !isFWDAllowed;

            if (mode === 'SHOPPER' && !isFWDSelection && step >= 1 && !stdAvailable && !isSelectedStd) return null;
            if (isFWDSelection && !stdAvailable) return null;

            const fwdKey = `${dateKey}_${shift}`;
            const currentFWDCount = fwdCounts[fwdKey] || 0;
            const isFull = isFWDSelection && currentFWDCount >= 5;

            return (
              <div key={shift} className="w-full">
                {/* Header for the Shift Row */}
                <div className="flex justify-between items-center mb-2 px-1">
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                        {getShiftIcon(shift)} {shift.split('(')[0]}
                    </div>
                    {isFWDButtonDisabled && <span className="text-xs text-red-400 font-medium">Not allowed for Day 1</span>}
                    {isFull && isFWDSelection && !isFWDButtonDisabled && <span className="text-xs text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded">FULL</span>}
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {/* AA BUTTON (Red Theme) */}
                  {(mode === 'ADMIN' || (step === 0 && !isFWDSelection)) && (
                    <button
                      onClick={() => {
                        if (mode === 'ADMIN' && onAdminToggle) onAdminToggle(dateKey, shift, ShiftType.AA);
                        if (mode === 'SHOPPER' && onShopperToggle && aaAvailable) onShopperToggle(dateKey, shift, ShiftType.AA);
                      }}
                      disabled={mode === 'SHOPPER' && !aaAvailable}
                      className={`relative w-full flex items-center justify-between px-4 py-4 rounded-2xl text-sm font-bold border-2 transition-all duration-200 active:scale-[0.98] ${
                        isSelectedAA
                          ? 'bg-red-500 border-red-600 text-white shadow-lg shadow-red-100 ring-2 ring-red-500 ring-offset-2' 
                          : aaAvailable
                            ? 'bg-white border-gray-100 text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                            : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                      }`}
                    >
                      <span className="flex items-center gap-2">Always Available</span>
                      {isSelectedAA && <div className="bg-white/20 p-1 rounded-full"><Check className="w-4 h-4" /></div>}
                    </button>
                  )}

                  {/* STANDARD BUTTON (Green Theme normally, Yellow for FWD) */}
                  {(mode === 'ADMIN' || step >= 1 || isFWDSelection) && (
                    <button
                      onClick={() => {
                        if (mode === 'ADMIN' && onAdminToggle) onAdminToggle(dateKey, shift, ShiftType.STANDARD);
                        if (mode === 'SHOPPER' && onShopperToggle && stdAvailable && !isFull && !isLockedFWD) onShopperToggle(dateKey, shift, ShiftType.STANDARD);
                      }}
                      disabled={mode === 'SHOPPER' && (isFWDButtonDisabled || !stdAvailable || (isFull && isFWDSelection) || isLockedFWD)}
                      className={`relative w-full flex items-center justify-between px-4 py-4 rounded-2xl text-sm font-bold border-2 transition-all duration-200 active:scale-[0.98] ${
                        // Case 1: FWD Selected (Yellow)
                        (isFWDSelection && isSelectedAA && isFWD) 
                          ? 'bg-yellow-400 border-yellow-500 text-yellow-900 shadow-lg shadow-yellow-100 ring-2 ring-yellow-400 ring-offset-2'
                          : // Case 2: Standard Selected (Green)
                            isSelectedStd 
                             ? 'bg-green-600 border-green-700 text-white shadow-lg shadow-green-100 ring-2 ring-green-600 ring-offset-2'
                             : // Case 3: Available
                               stdAvailable && (!isSelectedAA || isFWD) && !isFull && !isLockedFWD
                               ? `bg-white border-gray-100 text-gray-600 hover:bg-gray-50 ${isFWDSelection ? 'hover:border-yellow-300 hover:text-yellow-700' : 'hover:border-green-300 hover:text-green-700'}`
                               : // Case 4: Disabled
                                 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                      }`}
                    >
                       <span className="flex items-center gap-2">
                         {isFWDSelection ? 'Confirm Start Date' : 'Standard Shift'}
                       </span>
                       {(isSelectedStd || (isFWDSelection && isSelectedAA && isFWD)) && (
                           <div className="bg-white/20 p-1 rounded-full">
                               {isFWDSelection ? <Star className="w-4 h-4 fill-current" /> : <Check className="w-4 h-4" />}
                           </div>
                       )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="p-4 bg-gray-50 border-t flex justify-end shrink-0">
          <button 
            onClick={() => setSelectedDay(null)}
            className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors shadow-lg active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};