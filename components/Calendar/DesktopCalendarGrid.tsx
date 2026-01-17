
import React from 'react';
import { format, isWeekend, isAfter, isBefore } from 'date-fns';
import { ChevronLeft, ChevronRight, Lock, Star } from 'lucide-react';
import { formatDateKey } from '../../constants';
import { AdminAvailabilityMap } from '../../types';

interface DesktopCalendarGridProps {
  currentDate: Date;
  daysInMonth: Date[];
  today: Date;
  minShopperDate: Date;
  mode: 'ADMIN' | 'SHOPPER';
  isFWDSelection: boolean;
  adminAvailability: AdminAvailabilityMap;
  getShopperDayStatus: (date: Date) => any;
  isDateDisabledForShopper: (date: Date) => boolean;
  getShiftLabel: (fullTime: string) => { desktop: string; mobile: string };
  handlePrevMonth: () => void;
  handleNextMonth: () => void;
  setSelectedDay: (date: Date) => void;
}

export const DesktopCalendarGrid: React.FC<DesktopCalendarGridProps> = ({
  currentDate,
  daysInMonth,
  today,
  minShopperDate,
  mode,
  isFWDSelection,
  adminAvailability,
  getShopperDayStatus,
  isDateDisabledForShopper,
  getShiftLabel,
  handlePrevMonth,
  handleNextMonth,
  setSelectedDay
}) => {
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
          
          // Determine if this day is effectively "Locked" for Standard Selection because it's AA or FWD
          const isLockedForStandard = mode === 'SHOPPER' && !isFWDSelection && !isDisabled && (status.aaShift || status.isFirstWorkingDay);
          
          let cellBgClass = 'bg-white hover:bg-blue-50 cursor-pointer active:bg-blue-100';
          if (isDisabled) cellBgClass = 'bg-gray-100';
          else if (isFWDSelection && status.isFirstWorkingDay) cellBgClass = 'bg-yellow-50 ring-2 ring-inset ring-yellow-400';
          else if (isLockedForStandard) {
             // Distinct style for locked days in Standard Mode
             if (status.isFirstWorkingDay) cellBgClass = 'bg-yellow-50/60 ring-2 ring-inset ring-yellow-200 cursor-default';
             else if (status.aaShift) cellBgClass = 'bg-red-50/50 cursor-default ring-inset ring-1 ring-red-100';
          }

          return (
            <div 
              key={day.toISOString()} 
              className={`min-h-[80px] md:min-h-[120px] relative transition-all flex flex-col p-1 md:p-2
                ${cellBgClass}
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
              
              {/* Locked Indicator for Standard Step */}
              {isLockedForStandard && (
                  <div className="absolute top-1 right-1 md:top-2 md:right-2 z-10 opacity-30">
                      <Lock className="w-3 h-3 md:w-4 md:h-4 text-gray-500" />
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
