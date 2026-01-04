import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isWeekend, startOfWeek, endOfWeek, isWithinInterval, isAfter, startOfToday, isBefore, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Check, Ban, Lock, X, Plus, Star, Calendar as CalendarIcon, Clock } from 'lucide-react';
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

  // --- RENDERERS ---

  const renderMobileListView = () => {
    // In mobile list view for Shoppers, we only show relevant days (within range)
    // We iterate through the allowed range instead of the calendar month to show a continuous list
    
    let daysToList = daysInMonth;
    
    if (mode === 'SHOPPER') {
       const rangeStart = allowedRange.start;
       const rangeEnd = allowedRange.end;
       daysToList = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
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
                   
                   {/* FWD Toggle Mobile */}
                   {mode === 'SHOPPER' && onSetFirstWorkingDay && (
                      <button 
                        onClick={() => onSetFirstWorkingDay(dateKey)}
                        className={`p-2 rounded-full transition-all ${isFWD ? 'bg-yellow-100 text-yellow-600 ring-2 ring-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`}
                      >
                         <Star className={`w-5 h-5 ${isFWD ? 'fill-current' : ''}`} />
                      </button>
                   )}
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

                      // Only show Standard options in Step 1
                      if (mode === 'SHOPPER' && step === 1 && !stdAvailable && !isSelectedStd) {
                          return null; 
                      }

                      return (
                        <button
                          key={shift}
                          disabled={mode === 'SHOPPER' && ((step === 1 && isSelectedAA) || (step === 1 && !stdAvailable))}
                          onClick={() => {
                             if (mode === 'SHOPPER' && onShopperToggle && step === 1 && stdAvailable) {
                                onShopperToggle(dateKey, shift, ShiftType.STANDARD);
                             }
                          }}
                          className={`
                            relative flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all
                            ${isSelectedAA 
                                ? 'bg-red-50 border-red-200 text-red-700' 
                                : isSelectedStd 
                                    ? 'bg-green-100 border-green-500 text-green-800 ring-1 ring-green-500 shadow-md' 
                                    : 'bg-white border-gray-100 text-gray-600 hover:border-green-300 hover:bg-green-50'}
                            ${(step === 1 && isSelectedAA) ? 'opacity-50 cursor-not-allowed' : ''}
                          `}
                        >
                            <span className="text-sm font-bold">{label}</span>
                            <span className="text-[10px] text-gray-400">{time}</span>
                            
                            {isSelectedAA && <span className="absolute top-1 right-1 text-[9px] font-bold bg-white/50 px-1 rounded text-red-600">AA</span>}
                            {isSelectedStd && <CheckCircleIcon className="absolute top-1 right-1 w-3 h-3 text-green-600" />}
                        </button>
                      );
                   })}
                   
                   {/* Empty State for Grid layout stability */}
                   {currentShopperShifts.filter(s => s.date === dateKey).length === 0 && (
                       <div className="col-span-2 text-center py-2 text-xs text-gray-300 italic">
                           Tap a shift to select
                       </div>
                   )}
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