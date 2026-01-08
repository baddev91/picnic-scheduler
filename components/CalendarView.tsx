import React, { useState, useMemo } from 'react';
import { 
  format, endOfMonth, eachDayOfInterval, addMonths, isWeekend, endOfWeek, isWithinInterval, 
  isAfter, isBefore, addDays, addWeeks, startOfToday 
} from 'date-fns';
import startOfMonth from 'date-fns/startOfMonth';
import subMonths from 'date-fns/subMonths';
import startOfWeek from 'date-fns/startOfWeek';
import parseISO from 'date-fns/parseISO';
import { ChevronLeft, ChevronRight, Check, Ban, Lock, X, Plus, Star, Calendar as CalendarIcon, Clock, PlayCircle } from 'lucide-react';
import { ShiftTime, ShiftType, ShopperShift, AdminAvailabilityMap } from '../types';
import { SHIFT_TIMES, formatDateKey, getShopperAllowedRange, getShopperMinDate } from '../constants';

interface CalendarViewProps {
  mode: 'ADMIN' | 'SHOPPER';
  step?: number; // 0 for AA, 1 for FWD, 2 for Standard
  isFWDSelection?: boolean; // New Prop for specific styling/logic
  adminAvailability: AdminAvailabilityMap;
  currentShopperShifts?: ShopperShift[];
  firstWorkingDay?: string; // YYYY-MM-DD
  fwdCounts?: Record<string, number>; // New Prop: counts of existing FWD bookings per slot
  onAdminToggle?: (date: string, shift: ShiftTime, type: ShiftType) => void;
  onShopperToggle?: (date: string, shift: ShiftTime, type: ShiftType) => void;
  onSetFirstWorkingDay?: (date: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  mode,
  step = 1,
  isFWDSelection = false,
  adminAvailability,
  currentShopperShifts = [],
  firstWorkingDay,
  fwdCounts = {},
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
    
    const dateKey = formatDateKey(date);

    // 1. If First Working Day is selected (Step 2+), enforce Strict Range
    if (step >= 2 && firstWorkingDay) {
        // Block dates BEFORE the start date
        if (dateKey < firstWorkingDay) return true;

        // Block dates AFTER the allowed window (Sunday of the following week)
        const fwdDate = parseISO(firstWorkingDay);
        // Calculate: Start Date -> +1 Week -> End of that Week (Sunday)
        const limitDate = endOfWeek(addWeeks(fwdDate, 1), { weekStartsOn: 1 });
        
        if (isAfter(date, limitDate)) return true;
    } 
    // 2. Otherwise use generic min date (Today+3) for earlier steps
    else {
        if (isBefore(date, minShopperDate)) return true;
    }

    // 3. General Global Range Check (Max 8 weeks out) - failsafe
    if (!isWithinInterval(date, allowedRange)) return true;

    return false;
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

  // --- RENDERERS ---

  const renderMobileListView = () => {
    // In mobile list view for Shoppers, we only show relevant days (within range)
    let daysToList: Date[] = [];
    
    if (mode === 'SHOPPER') {
       let rangeStart = allowedRange.start;
       let rangeEnd = allowedRange.end;

       // If FWD is selected (Step 2), TIGHTEN the list range
       if (step >= 2 && firstWorkingDay) {
           const fwdDate = parseISO(firstWorkingDay);
           
           // Start exactly on FWD
           if (isAfter(fwdDate, rangeStart)) {
               rangeStart = fwdDate;
           }

           // End exactly on the Sunday of the following week
           const limitDate = endOfWeek(addWeeks(fwdDate, 1), { weekStartsOn: 1 });
           if (isBefore(limitDate, rangeEnd)) {
               rangeEnd = limitDate;
           }
       }

       // Generate dates
       // Safety: Ensure start isn't after end
       if (!isAfter(rangeStart, rangeEnd)) {
           daysToList = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
       }
    } else {
       // Fallback for Admin or non-shopper mode (though logic handles Shopper mostly)
       daysToList = daysInMonth; 
    }

    return (
      <div className="space-y-4 pb-20">
        {daysToList.map((day) => {
           const dateKey = formatDateKey(day);
           const isDisabled = isDateDisabledForShopper(day);
           
           // Skip past/disabled days in Shopper Mode list view to reduce scrolling
           if (isDisabled && mode === 'SHOPPER') return null;

           const status = getShopperDayStatus(day);
           const isFWD = status.isFirstWorkingDay;

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
                   
                   {/* Remove Star from header, moved to button */}
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
                      // It is if: The Day matches FWD (isFWD) AND this specific shift time is selected as Standard
                      const isTheFWDSelection = isFWD && isSelectedStd;

                      return (
                        <button
                          key={shift}
                          // FWD Mode: Disable if not Morning/Afternoon or not available OR FULL
                          // Standard Mode: Generally allow clicking to handle logic in App.tsx
                          disabled={(mode === 'SHOPPER' && !stdAvailable) || (isFull && !isTheFWDSelection)}
                          onClick={() => {
                             if (mode === 'SHOPPER' && onShopperToggle && stdAvailable && !isFull) {
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
                          `}
                        >
                            <span className="text-sm font-bold">{label}</span>
                            <span className="text-[10px] opacity-70">{time}</span>
                            
                            {/* Star Icon for FWD */}
                            {isFWDSelection && isTheFWDSelection && (
                                <span className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-sm border border-yellow-200">
                                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
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
                            {isSelectedStd && !isFWDSelection && <CheckCircleIcon className="absolute top-1 right-1 w-3 h-3 text-green-600" />}
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

  const renderDesktopGridView = () => {
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
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
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
                  ${isFWDSelection && status.isFirstWorkingDay ? 'bg-yellow-50 ring-2 ring-inset ring-yellow-400' : ''}
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
                  {status.aaShift && aaLabel && !isFWDSelection && (
                    <div className="p-0.5 md:px-2 md:py-1.5 bg-red-100 border border-red-200 text-red-800 rounded md:rounded-lg text-[9px] md:text-xs font-bold shadow-sm flex items-center justify-center md:justify-between">
                      <span className="hidden md:inline">AA</span>
                      <span className="md:hidden">{aaLabel.mobile}</span>
                      <span className="hidden md:inline">{aaLabel.desktop}</span>
                    </div>
                  )}
                  
                  {status.stdShift && stdLabel && !isFWDSelection && (
                    <div className="p-0.5 md:px-2 md:py-1.5 bg-green-100 border border-green-200 text-green-800 rounded md:rounded-lg text-[9px] md:text-xs font-bold shadow-sm flex items-center justify-center md:justify-between">
                      <span className="hidden md:inline">Std</span>
                      <span className="md:hidden">{stdLabel.mobile}</span>
                      <span className="hidden md:inline">{stdLabel.desktop}</span>
                    </div>
                  )}

                  {/* FWD Selection Mode Indicators */}
                  {isFWDSelection && !status.isFirstWorkingDay && !isDisabled && (
                      <div className="mt-auto text-center opacity-0 group-hover:opacity-60 transition-opacity hidden md:block">
                          <span className="text-xs text-purple-600 font-bold bg-purple-50 px-2 py-1 rounded">Select Start</span>
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
      </div>
    );
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
                {mode === 'ADMIN' 
                  ? 'Configure Availability' 
                  : isFWDSelection 
                    ? 'Confirm First Day' 
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
                <div key={shift} className={`w-full flex flex-col gap-2 md:gap-3 p-3 md:p-4 border rounded-xl bg-white shadow-sm transition-all ${isSelectedAA || isSelectedStd ? 'ring-2 ring-purple-500 border-transparent' : 'border-gray-200'} ${isFWDButtonDisabled ? 'opacity-50' : ''}`}>
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
                          if (mode === 'SHOPPER' && onShopperToggle && stdAvailable && !isFull) onShopperToggle(dateKey, shift, ShiftType.STANDARD);
                        }}
                        disabled={mode === 'SHOPPER' && (isFWDButtonDisabled || !stdAvailable || (isFull && isFWDSelection))}
                        className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-semibold border transition-all ${
                          isSelectedStd
                            ? 'bg-green-600 text-white border-green-600 shadow-md transform scale-[1.02]' 
                            : stdAvailable && (!isSelectedAA || isFWD) && !isFull
                              ? 'bg-white border-green-200 text-green-700 hover:bg-green-50'
                              : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                         <span className="flex items-center gap-2">
                           {isSelectedStd && <Check className="w-4 h-4" />} 
                           {isFWDSelection ? 'Start Here' : 'Standard Shift'}
                         </span>
                         {isSelectedAA && !isFWD && mode === 'SHOPPER' && !isFWDSelection && <span className="text-xs">AA Selected</span>}
                         {isSelectedAA && isFWD && mode === 'SHOPPER' && <span className="text-xs text-orange-500 font-bold">Override AA?</span>}
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

  const CheckCircleIcon = (props: any) => (
      <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
  );

  return (
    <>
        {/* Mobile View: Vertical List */}
        <div className="md:hidden">
            {renderMobileListView()}
        </div>

        {/* Desktop View: Grid Calendar */}
        <div className="hidden md:block">
            {renderDesktopGridView()}
            {renderDayPanel()}
        </div>
    </>
  );
};