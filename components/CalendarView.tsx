import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isWeekend, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { ChevronLeft, ChevronRight, Check, Ban, Lock, X } from 'lucide-react';
import { ShiftTime, ShiftType, ShopperShift, AdminAvailabilityMap } from '../types';
import { SHIFT_TIMES, formatDateKey, getShopperAllowedRange } from '../constants';

interface CalendarViewProps {
  mode: 'ADMIN' | 'SHOPPER';
  adminAvailability: AdminAvailabilityMap;
  currentShopperShifts?: ShopperShift[];
  onAdminToggle?: (date: string, shift: ShiftTime, type: ShiftType) => void;
  onShopperToggle?: (date: string, shift: ShiftTime, type: ShiftType) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  mode,
  adminAvailability,
  currentShopperShifts = [],
  onAdminToggle,
  onShopperToggle,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Get allowed range for Shoppers
  const allowedRange = useMemo(() => getShopperAllowedRange(), []);

  const daysInMonth = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }); // Start on Monday
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  // Visual feedback for grid cells
  const getShopperDayStatus = (date: Date) => {
    const key = formatDateKey(date);
    const shifts = currentShopperShifts.filter(s => s.date === key);
    
    const isAA = shifts.some(s => s.type === ShiftType.AA);
    const isStandard = shifts.some(s => s.type === ShiftType.STANDARD);
    
    const time = shifts.length > 0 ? shifts[0].time : undefined;

    return { 
      hasShift: shifts.length > 0, 
      isAA,
      isStandard,
      time
    };
  };

  const isTypeAvailable = (dateKey: string, time: ShiftTime, type: ShiftType) => {
    if (!adminAvailability[dateKey]) return true;
    if (!adminAvailability[dateKey][time]) return true;
    return adminAvailability[dateKey][time].includes(type);
  };

  const isDateDisabledForShopper = (date: Date) => {
    if (mode === 'ADMIN') return false;
    return !isWithinInterval(date, allowedRange);
  };

  const renderDayPanel = () => {
    if (!selectedDay) return null;
    const dateKey = formatDateKey(selectedDay);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
          <div className="bg-gray-100 p-4 border-b flex justify-between items-center shrink-0">
            <div>
              <h3 className="text-lg font-bold text-gray-800">{format(selectedDay, 'EEEE, MMMM do')}</h3>
              <p className="text-sm text-gray-500">{mode === 'ADMIN' ? 'Configure Availability' : 'Select Your Shift'}</p>
            </div>
            <button onClick={() => setSelectedDay(null)} className="text-gray-500 hover:text-gray-800 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto">
            {SHIFT_TIMES.map((shift) => {
              const aaAvailable = isTypeAvailable(dateKey, shift, ShiftType.AA);
              const stdAvailable = isTypeAvailable(dateKey, shift, ShiftType.STANDARD);
              
              const shiftEntries = currentShopperShifts.filter(s => s.date === dateKey && s.time === shift);
              const isSelectedAA = shiftEntries.some(s => s.type === ShiftType.AA);
              const isSelectedStd = shiftEntries.some(s => s.type === ShiftType.STANDARD);

              if (mode === 'SHOPPER' && !aaAvailable && !stdAvailable) return null;

              return (
                <div key={shift} className="w-full flex flex-col gap-2 p-3 border rounded-xl bg-gray-50">
                  <div className="text-sm font-bold text-gray-700">{shift}</div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {/* AA BUTTON */}
                    {mode === 'ADMIN' ? (
                      <button
                        onClick={() => onAdminToggle && onAdminToggle(dateKey, shift, ShiftType.AA)}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold border transition-all ${
                          aaAvailable 
                            ? 'bg-red-100 border-red-300 text-red-800 hover:bg-red-200' 
                            : 'bg-gray-100 border-gray-300 text-gray-400 opacity-60'
                        }`}
                      >
                        {aaAvailable ? <Check className="w-4 h-4"/> : <Ban className="w-4 h-4"/>}
                        AA {aaAvailable ? 'Available' : 'Blocked'}
                      </button>
                    ) : (
                      aaAvailable && (
                        <button
                          onClick={() => onShopperToggle && onShopperToggle(dateKey, shift, ShiftType.AA)}
                          className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1 shadow-sm ${
                            isSelectedAA 
                             ? 'bg-red-600 text-white ring-2 ring-red-300 ring-offset-1' 
                             : 'bg-white border-gray-200 text-gray-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700'
                          }`}
                        >
                           AA
                           {isSelectedAA && <Check className="w-3 h-3 ml-1"/>}
                        </button>
                      )
                    )}

                    {/* STANDARD BUTTON */}
                    {mode === 'ADMIN' ? (
                      <button
                        onClick={() => onAdminToggle && onAdminToggle(dateKey, shift, ShiftType.STANDARD)}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold border transition-all ${
                          stdAvailable 
                            ? 'bg-green-100 border-green-300 text-green-800 hover:bg-green-200' 
                            : 'bg-gray-100 border-gray-300 text-gray-400 opacity-60'
                        }`}
                      >
                         {stdAvailable ? <Check className="w-4 h-4"/> : <Ban className="w-4 h-4"/>}
                         Standard {stdAvailable ? 'Available' : 'Blocked'}
                      </button>
                    ) : (
                      stdAvailable && (
                        <button
                          onClick={() => onShopperToggle && onShopperToggle(dateKey, shift, ShiftType.STANDARD)}
                          className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1 shadow-sm ${
                            isSelectedStd 
                             ? 'bg-green-600 text-white ring-2 ring-green-300 ring-offset-1' 
                             : 'bg-white border-gray-200 text-gray-700 hover:bg-green-50 hover:border-green-200 hover:text-green-700'
                          }`}
                        >
                          Standard
                          {isSelectedStd && <Check className="w-3 h-3 ml-1"/>}
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}

             {mode === 'SHOPPER' && SHIFT_TIMES.every(s => !isTypeAvailable(dateKey, s, ShiftType.AA) && !isTypeAvailable(dateKey, s, ShiftType.STANDARD)) && (
               <div className="text-center py-6 text-gray-500">
                 <Lock className="w-10 h-10 mx-auto mb-2 opacity-20" />
                 No shifts available for this day.
               </div>
             )}
          </div>
          
          <div className="p-4 border-t bg-gray-50 flex justify-end shrink-0">
            <button 
              onClick={() => setSelectedDay(null)}
              className="px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
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
    <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-white p-6 border-b flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
           {format(currentDate, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-2">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronRight className="w-6 h-6 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Grid Header */}
      <div className="grid grid-cols-7 border-b bg-gray-50">
        {weekDays.map(day => (
          <div key={day} className={`py-3 text-center text-xs font-bold uppercase tracking-wider ${['Sat', 'Sun'].includes(day) ? 'text-red-500' : 'text-gray-500'}`}>
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
          
          // Simplified visual indicator for admin: Are there ANY blocks?
          const hasBlocks = mode === 'ADMIN' && adminAvailability[dateKey] && Object.values(adminAvailability[dateKey]).some((types: ShiftType[]) => types.length < 2);
          
          // Render Status Badge
          const renderStatusBadge = () => {
             if (!status.hasShift) return null;

             const baseClasses = "text-xs px-2 py-1 rounded-md border font-semibold truncate";
             const timeLabel = status.time?.split('(')[0];

             if (status.isAA && status.isStandard) {
                return (
                  <div className={`${baseClasses} bg-gradient-to-r from-red-100 to-green-100 text-gray-800 border-gray-200`}>
                     AA + Std
                     <div className="text-[10px] font-normal opacity-80">{timeLabel}</div>
                  </div>
                );
             } else if (status.isAA) {
                return (
                  <div className={`${baseClasses} bg-red-100 text-red-700 border-red-200`}>
                     AA
                     <div className="text-[10px] font-normal opacity-80">{timeLabel}</div>
                  </div>
                );
             } else if (status.isStandard) {
                 return (
                  <div className={`${baseClasses} bg-green-100 text-green-700 border-green-200`}>
                     Std
                     <div className="text-[10px] font-normal opacity-80">{timeLabel}</div>
                  </div>
                );
             }
             return null;
          };

          return (
            <div 
              key={day.toISOString()} 
              className={`min-h-[100px] relative group transition-colors 
                ${isDisabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white cursor-pointer hover:bg-gray-50'}
                ${!isCurrentMonth && !isDisabled ? 'bg-gray-50/50 text-gray-400' : ''}
              `}
              onClick={() => {
                if (!isDisabled) setSelectedDay(day);
              }}
            >
              {/* Day Number */}
              <div className={`absolute top-2 left-2 text-sm font-semibold ${isWeekendDay ? 'text-red-500' : 'text-gray-700'} ${isDisabled ? 'opacity-40' : ''}`}>
                {format(day, 'd')}
              </div>
              
              {/* Disabled Lock Icon */}
              {isDisabled && mode === 'SHOPPER' && (
                 <div className="absolute top-2 right-2 opacity-10">
                   <Lock className="w-4 h-4" />
                 </div>
              )}

              {/* Indicators */}
              <div className={`absolute top-8 left-2 right-2 bottom-2 flex flex-col gap-1 overflow-hidden ${isDisabled ? 'opacity-50 grayscale' : ''}`}>
                {mode === 'ADMIN' && hasBlocks && (
                   <div className="absolute bottom-1 right-1">
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                   </div>
                )}
                {mode === 'SHOPPER' && renderStatusBadge()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="p-4 bg-white text-xs text-gray-500 flex flex-wrap gap-4 items-center justify-center">
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> AA Shift</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Standard Shift</div>
        {mode === 'ADMIN' && <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Has Restrictions</div>}
        {mode === 'SHOPPER' && <div className="flex items-center gap-2"><div className="w-3 h-3 bg-gray-200 rounded-sm"></div> Unavailable Date</div>}
      </div>

      {renderDayPanel()}
    </div>
  );
};