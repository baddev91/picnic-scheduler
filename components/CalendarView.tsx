import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isWeekend, startOfWeek, endOfWeek, isWithinInterval, isAfter, startOfToday, isBefore, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Check, Ban, Lock, X, Plus, Star } from 'lucide-react';
import { ShiftTime, ShiftType, ShopperShift, AdminAvailabilityMap } from '../types';
import { SHIFT_TIMES, formatDateKey, getShopperAllowedRange, getShopperMinDate } from '../constants';

interface CalendarViewProps {
  mode: 'ADMIN' | 'SHOPPER';
  step?: number; // 0 for AA, 1 for Standard
  adminAvailability: AdminAvailabilityMap;
  currentShopperShifts?: ShopperShift[];
  firstWorkingDay?: string; // YYYY-MM-DD
  onAdminToggle?: (date: string, shift: ShiftTime, type: ShiftType) => void;
  onShopperToggle?: (date: string, shift: ShiftTime, type: ShiftType) => void;
  onSetFirstWorkingDay?: (date: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  mode,
  step = 1,
  adminAvailability,
  currentShopperShifts = [],
  firstWorkingDay,
  onAdminToggle,
  onShopperToggle,
  onSetFirstWorkingDay,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Get allowed range for Shoppers
  const allowedRange = useMemo(() => getShopperAllowedRange(), []);
  const minShopperDate = useMemo(() => getShopperMinDate(), []);
  const today = startOfToday();

  const daysInMonth = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }); // Start on Monday
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const getShopperDayStatus = (date: Date) => {
    const key = formatDateKey(date);
    const shifts = currentShopperShifts.filter(s => s.date === key);
    
    const aaShift = shifts.find(s => s.type === ShiftType.AA);
    const stdShift = shifts.find(s => s.type === ShiftType.STANDARD);
    
    return { 
      hasShift: shifts.length > 0, 
      aaShift,
      stdShift,
      isFirstWorkingDay: firstWorkingDay === key
    };
  };

  const isTypeAvailable = (dateKey: string, time: ShiftTime, type: ShiftType) => {
    if (!adminAvailability[dateKey]) return true;
    const dayConfig = adminAvailability[dateKey];
    if (!dayConfig || !dayConfig[time]) return true;
    return dayConfig[time]?.includes(type) ?? true;
  };

  const isDateDisabledForShopper = (date: Date) => {
    if (mode === 'ADMIN') return false;
    // Must be within general allowed range AND after the minimum start date (Today + 3)
    return !isWithinInterval(date, allowedRange) || isBefore(date, minShopperDate);
  };

  // Helper to get short labels for mobile
  const getShiftLabel = (fullTimeStr: string) => {
    const main = fullTimeStr.split(' ')[0]; // "Morning", "Opening" etc.
    const map: Record<string, string> = {
      'Opening': 'Open',
      'Morning': 'Morn',
      'Noon': 'Noon',
      'Afternoon': 'Aft'
    };
    return { desktop: main, mobile: map[main] || main };
  };

  const renderDayPanel = () => {
    if (!selectedDay) return null;
    const dateKey = formatDateKey(selectedDay);
    const isFWD = firstWorkingDay === dateKey;
    
    // Safety check: ensure panel doesn't open for disabled days in Shopper mode
    if (mode === 'SHOPPER' && isDateDisabledForShopper(selectedDay)) {
        return null;
    }

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
          <div className="bg-gray-50 p-6 border-b flex justify-between items-center shrink-0">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{format(selectedDay, 'EEEE, MMM do')}</h3>
              <p className="text-sm text-gray-500">
                {mode === 'ADMIN' ? 'Configure Availability' : (step === 0 ? 'Select AA Shift' : 'Select Standard Shift')}
              </p>
            </div>
            <button onClick={() => setSelectedDay(null)} className="bg-gray-200 hover:bg-gray-300 p-2 rounded-full transition-colors">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="p-4 md:p-6 space-y-3 overflow-y-auto bg-gray-50/50">
            {/* First Working Day Toggle (Only in Shopper Mode) */}
            {mode === 'SHOPPER' && onSetFirstWorkingDay && (
                 <button
                   onClick={() => onSetFirstWorkingDay(dateKey)}
                   className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border transition-all shadow-sm mb-2 ${
                     isFWD 
                      ? 'bg-yellow-100 border-yellow-300 text-yellow-800 ring-1 ring-yellow-300' 
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-yellow-50 hover:border-yellow-200 hover:text-yellow-700'
                   }`}
                 >
                   <Star className={`w-5 h-5 ${isFWD ? 'fill-yellow-500 text-yellow-500' : 'text-current'}`} />
                   {isFWD ? 'First Working Day Selected' : 'Set as First Working Day'}
                 </button>
            )}

            {SHIFT_TIMES.map((shift) => {
              const aaAvailable = isTypeAvailable(dateKey, shift, ShiftType.AA);
              const stdAvailable = isTypeAvailable(dateKey, shift, ShiftType.STANDARD);
              
              const shiftEntries = currentShopperShifts.filter(s => s.date === dateKey && s.time === shift);
              const isSelectedAA = shiftEntries.some(s => s.type === ShiftType.AA);
              const isSelectedStd = shiftEntries.some(s => s.type === ShiftType.STANDARD);

              // In Standard step (step 1), hide unavailable options
              if (mode === 'SHOPPER' && step === 1 && !stdAvailable && !isSelectedStd) return null;

              return (
                <div key={shift} className={`w-full flex flex-col gap-2 md:gap-3 p-3 md:p-4 border rounded-xl bg-white shadow-sm transition-all ${isSelectedAA || isSelectedStd ? 'ring-2 ring-purple-500 border-transparent' : 'border-gray-200'}`}>
                  <div className="text-sm md:text-base font-bold text-gray-800">{shift}</div>
                  
                  <div className="grid grid-cols-1 gap-2 md:gap-3">
                    {/* AA BUTTON - Only active in Step 0 or Admin */}
                    {(mode === 'ADMIN' || step === 0) && (
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

                    {/* STANDARD BUTTON - Only active in Step 1 or Admin */}
                    {(mode === 'ADMIN' || step === 1) && (
                      <button
                        onClick={() => {
                          if (mode === 'ADMIN' && onAdminToggle) onAdminToggle(dateKey, shift, ShiftType.STANDARD);
                          if (mode === 'SHOPPER' && onShopperToggle && stdAvailable) onShopperToggle(dateKey, shift, ShiftType.STANDARD);
                        }}
                        // In Shopper mode, cannot select Standard if AA is already selected for this slot
                        disabled={mode === 'SHOPPER' && (!stdAvailable || isSelectedAA)}
                        className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-semibold border transition-all ${
                          isSelectedStd
                            ? 'bg-green-600 text-white border-green-600 shadow-md transform scale-[1.02]' 
                            : stdAvailable && !isSelectedAA
                              ? 'bg-white border-green-200 text-green-700 hover:bg-green-50'
                              : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                         <span className="flex items-center gap-2">
                           {isSelectedStd && <Check className="w-4 h-4" />} 
                           Standard Shift
                         </span>
                         {isSelectedAA && mode === 'SHOPPER' && <span className="text-xs">AA Selected</span>}
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

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="w-full max-w-5xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-white p-4 md:p-6 border-b flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
           {format(currentDate, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-2">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-gray-600" />
          </button>
          <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Grid Header */}
      <div className="grid grid-cols-7 border-b bg-gray-50">
        {weekDays.map(day => (
          <div key={day} className={`py-3 md:py-4 text-center text-[10px] md:text-xs font-bold uppercase tracking-widest ${['Sat', 'Sun'].includes(day) ? 'text-red-500' : 'text-gray-400'}`}>
            {day}
          </div>
        ))}
      </div>

      {/* Grid Body */}
      <div className="grid grid-cols-7 auto-rows-fr bg-gray-200 gap-px border-b">
        {daysInMonth.map((day) => {
          const dateKey = formatDateKey(day);
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isWeekendDay = isWeekend(day);
          const status = getShopperDayStatus(day);
          const isDisabled = isDateDisabledForShopper(day);
          const isTooSoon = mode === 'SHOPPER' && isDisabled && isAfter(day, today) && isBefore(day, minShopperDate);
          
          const aaLabel = status.aaShift ? getShiftLabel(status.aaShift.time) : null;
          const stdLabel = status.stdShift ? getShiftLabel(status.stdShift.time) : null;

          return (
            <div 
              key={day.toISOString()} 
              className={`min-h-[80px] md:min-h-[120px] relative transition-all flex flex-col p-1 md:p-2
                ${isDisabled ? 'bg-gray-100' : 'bg-white hover:bg-blue-50 cursor-pointer active:bg-blue-100'}
                ${!isCurrentMonth ? 'opacity-40' : ''}
              `}
              onClick={() => {
                if (!isDisabled) setSelectedDay(day);
              }}
            >
              {/* First Working Day Indicator */}
              {status.isFirstWorkingDay && (
                <div className="absolute top-1 right-1 md:top-2 md:left-2 md:right-auto z-10 pointer-events-none" title="First Working Day">
                   <Star className="w-3 h-3 md:w-5 md:h-5 text-yellow-500 fill-yellow-500 drop-shadow-sm" />
                </div>
              )}

              {/* Day Number */}
              <div className={`text-sm md:text-lg font-semibold mb-1 md:mb-2 ${isWeekendDay ? 'text-red-500' : 'text-gray-700'} ${isDisabled ? 'opacity-40' : ''} ${status.isFirstWorkingDay ? 'mr-3 md:mr-0 md:ml-6' : ''}`}>
                {format(day, 'd')}
              </div>
              
              {/* Cell Content - Responsive View */}
              <div className="flex flex-col gap-1 flex-1">
                {status.aaShift && aaLabel && (
                  <div className="p-0.5 md:px-2 md:py-1.5 bg-red-100 border border-red-200 text-red-800 rounded md:rounded-lg text-[9px] md:text-xs font-bold shadow-sm flex items-center justify-center md:justify-between">
                     <span className="hidden md:inline">AA</span>
                     {/* Show abbreviated on mobile, full on desktop */}
                     <span className="md:hidden">{aaLabel.mobile}</span>
                     <span className="hidden md:inline">{aaLabel.desktop}</span>
                  </div>
                )}
                
                {status.stdShift && stdLabel && (
                  <div className="p-0.5 md:px-2 md:py-1.5 bg-green-100 border border-green-200 text-green-800 rounded md:rounded-lg text-[9px] md:text-xs font-bold shadow-sm flex items-center justify-center md:justify-between">
                     <span className="hidden md:inline">Std</span>
                     <span className="md:hidden">{stdLabel.mobile}</span>
                     <span className="hidden md:inline">{stdLabel.desktop}</span>
                  </div>
                )}

                {/* Empty State Call to Action (Only for active steps - Desktop only) */}
                {!isDisabled && !status.aaShift && !status.stdShift && mode === 'SHOPPER' && step === 1 && (
                  <div className="mt-auto text-center opacity-0 group-hover:opacity-40 transition-opacity hidden md:block">
                    <Plus className="w-6 h-6 text-gray-300 mx-auto" />
                  </div>
                )}
                
                {/* Admin Indicator */}
                {mode === 'ADMIN' && adminAvailability[dateKey] && (
                   <div className="mt-auto flex gap-1 justify-end">
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-orange-400" title="Custom Settings"></div>
                   </div>
                )}
                
                {/* Too Soon Label */}
                {isTooSoon && (
                     <div className="mt-auto text-center">
                        <span className="text-[9px] text-gray-400 font-medium bg-gray-200 px-1 rounded">Too Soon</span>
                     </div>
                )}
              </div>
              
              {isDisabled && mode === 'SHOPPER' && (
                 <div className="absolute top-2 right-2 opacity-10 hidden md:block">
                   <Lock className="w-5 h-5" />
                 </div>
              )}
            </div>
          );
        })}
      </div>

      {renderDayPanel()}
    </div>
  );
};