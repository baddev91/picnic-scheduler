import React from 'react';
import { format } from 'date-fns';
import { X, Lock, Check } from 'lucide-react';
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
  
  // Safety check: ensure panel doesn't open for disabled days in Shopper mode
  if (mode === 'SHOPPER' && isDateDisabledForShopper(selectedDay)) {
      return null;
  }

  const isLockedFWD = mode === 'SHOPPER' && !isFWDSelection && step === 2 && isFWD;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gray-50 p-6 border-b flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{format(selectedDay, 'EEEE, MMM do')}</h3>
            <p className="text-sm text-gray-500">
              {mode === 'ADMIN' 
                ? 'Configure Availability' 
                : isFWDSelection 
                  ? 'Confirm First Day' 
                  : isLockedFWD 
                      ? 'First Day (Locked)'
                      : step === 0 
                          ? 'Select AA Shift' 
                          : 'Select Standard Shift'
              }
            </p>
          </div>
          <button onClick={() => setSelectedDay(null)} className="bg-gray-200 hover:bg-gray-300 p-2 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-3 overflow-y-auto bg-gray-50/50">
          {isLockedFWD && (
             <div className="p-3 bg-yellow-50 text-yellow-800 text-sm rounded-lg border border-yellow-200 flex items-center gap-2">
                 <Lock className="w-4 h-4" /> This is your First Working Day. Go back to Step 2 to change it.
             </div>
          )}
          
          {SHIFT_TIMES.map((shift) => {
            const aaAvailable = isTypeAvailable(dateKey, shift, ShiftType.AA);
            const stdAvailable = isTypeAvailable(dateKey, shift, ShiftType.STANDARD);
            
            const shiftEntries = currentShopperShifts.filter(s => s.date === dateKey && s.time === shift);
            const isSelectedAA = shiftEntries.some(s => s.type === ShiftType.AA);
            const isSelectedStd = shiftEntries.some(s => s.type === ShiftType.STANDARD);

            // In FWD Selection mode, disable Opening and Noon
            const isFWDAllowed = shift === ShiftTime.MORNING || shift === ShiftTime.AFTERNOON;
            const isFWDButtonDisabled = isFWDSelection && !isFWDAllowed;

            // Hide completely if not allowed in Standard step (unless it's the AA override scenario)
            if (mode === 'SHOPPER' && !isFWDSelection && step >= 1 && !stdAvailable && !isSelectedStd) return null;
            
            // HIDE unavailable shifts in FWD mode (Desktop Panel)
            if (isFWDSelection && !stdAvailable) return null;

            // MAX 5 Logic for FWD Selection
            const fwdKey = `${dateKey}_${shift}`;
            const currentFWDCount = fwdCounts[fwdKey] || 0;
            const isFull = isFWDSelection && currentFWDCount >= 5;

            return (
              <div key={shift} className={`w-full flex flex-col gap-2 md:gap-3 p-3 md:p-4 border rounded-xl bg-white shadow-sm transition-all ${isSelectedAA || isSelectedStd ? 'ring-2 ring-purple-500 border-transparent' : 'border-gray-200'} ${isFWDButtonDisabled || isLockedFWD ? 'opacity-60' : ''}`}>
                <div className="text-sm md:text-base font-bold text-gray-800 flex justify-between">
                    {shift}
                    {isFWDButtonDisabled && <span className="text-xs text-red-500 font-normal">Not allowed for 1st day</span>}
                    {isFull && isFWDSelection && !isFWDButtonDisabled && <span className="text-xs text-red-600 font-bold bg-red-100 px-2 rounded">FULL (5/5)</span>}
                </div>
                
                <div className="grid grid-cols-1 gap-2 md:gap-3">
                  {/* AA BUTTON - Only active in Step 0 or Admin */}
                  {(mode === 'ADMIN' || (step === 0 && !isFWDSelection)) && (
                    <button
                      onClick={() => {
                        if (mode === 'ADMIN' && onAdminToggle) onAdminToggle(dateKey, shift, ShiftType.AA);
                        if (mode === 'SHOPPER' && onShopperToggle && aaAvailable) onShopperToggle(dateKey, shift, ShiftType.AA);
                      }}
                      disabled={mode === 'SHOPPER' && !aaAvailable}
                      className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-semibold border transition-all ${
                        isSelectedAA
                          ? 'bg-red-600 text-white border-red-600 shadow-md transform scale-[1.02]' 
                          : aaAvailable
                            ? 'bg-white border-red-200 text-red-700 hover:bg-red-50'
                            : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                         {isSelectedAA && <Check className="w-4 h-4" />} 
                         AA (Always Available)
                      </span>
                      {!aaAvailable && mode === 'SHOPPER' && <span className="text-xs uppercase">Full</span>}
                    </button>
                  )}

                  {/* STANDARD BUTTON - Active in Step 2 (Std) OR FWD Selection */}
                  {(mode === 'ADMIN' || step >= 1 || isFWDSelection) && (
                    <button
                      onClick={() => {
                        if (mode === 'ADMIN' && onAdminToggle) onAdminToggle(dateKey, shift, ShiftType.STANDARD);
                        if (mode === 'SHOPPER' && onShopperToggle && stdAvailable && !isFull && !isLockedFWD) onShopperToggle(dateKey, shift, ShiftType.STANDARD);
                      }}
                      disabled={mode === 'SHOPPER' && (isFWDButtonDisabled || !stdAvailable || (isFull && isFWDSelection) || isLockedFWD)}
                      className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-semibold border transition-all ${
                        isSelectedStd || (isFWDSelection && isSelectedAA && isFWD)
                          ? 'bg-green-600 text-white border-green-600 shadow-md transform scale-[1.02]' 
                          : stdAvailable && (!isSelectedAA || isFWD) && !isFull && !isLockedFWD
                            ? 'bg-white border-green-200 text-green-700 hover:bg-green-50'
                            : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                       <span className="flex items-center gap-2">
                         {(isSelectedStd || (isFWDSelection && isSelectedAA && isFWD)) && <Check className="w-4 h-4" />} 
                         {isFWDSelection ? 'Start Here' : 'Standard Shift'}
                       </span>
                       {isSelectedAA && !isFWD && mode === 'SHOPPER' && !isFWDSelection && <span className="text-xs">AA Selected</span>}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="p-4 border-t bg-gray-50 flex justify-end shrink-0">
          <button 
            onClick={() => setSelectedDay(null)}
            className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};