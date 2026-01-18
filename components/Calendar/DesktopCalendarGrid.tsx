
import React from 'react';
import { format, isWeekend, isAfter, isBefore } from 'date-fns';
import { ChevronLeft, ChevronRight, Lock, Star, CheckCircle2, Plus } from 'lucide-react';
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
          
          // Step 3 Logic: Standard Selection Mode
          const isStandardSelectionStep = mode === 'SHOPPER' && !isFWDSelection;
          const isLockedForStandard = isStandardSelectionStep && !isDisabled && (status.aaShift || status.isFirstWorkingDay);
          const isAvailableForStandard = isStandardSelectionStep && !isDisabled && !isLockedForStandard;
          
          let cellBgClass = 'bg-white';
          
          if (isDisabled) {
              cellBgClass = 'bg-gray-100 cursor-default';
          } else if (isFWDSelection && status.isFirstWorkingDay) {
              cellBgClass = 'bg-yellow-50 ring-2 ring-inset ring-yellow-400';
          } else if (isLockedForStandard) {
             cellBgClass = 'bg-gray-50/80 cursor-default';
          } else if (isAvailableForStandard) {
             // ENHANCED VISIBILITY FOR CLICKABLE DAYS
             // White background + Emerald Border + Shadow to suggest "Click me to fill"
             cellBgClass = 'bg-white ring-inset ring-2 ring-emerald-100/70 hover:ring-emerald-300 shadow-sm cursor-pointer hover:bg-emerald-50/30 transition-all z-10';
          } else {
             // Default available (e.g. Admin or Step 1)
             cellBgClass = 'bg-white hover:bg-blue-50 cursor-pointer';
          }

          return (
            <div 
              key={day.toISOString()} 
              className={`min-h-[80px] md:min-h-[120px] relative flex flex-col p-1 md:p-2 transition-all
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
                  {isStandardSelectionStep ? (
                      <Star className="w-3 h-3 md:w-4 md:h-4 text-gray-400 fill-gray-400" />
                  ) : (
                      <Star className="w-3 h-3 md:w-5 md:h-5 text-yellow-500 fill-yellow-500 drop-shadow-sm" />
                  )}
                </div>
              )}
              
              {/* Locked Indicator for Standard Step */}
              {isLockedForStandard && (
                  <div className="absolute top-1 right-1 md:top-2 md:right-2 z-10">
                      <Lock className="w-3 h-3 md:w-4 md:h-4 text-gray-400 opacity-60" />
                  </div>
              )}

              {/* Day Number */}
              <div className={`text-sm md:text-lg font-semibold mb-1 md:mb-2 
                  ${isWeekendDay && !isLockedForStandard ? 'text-red-500' : 'text-gray-700'} 
                  ${isDisabled ? 'opacity-40' : ''} 
                  ${status.isFirstWorkingDay ? 'mr-3 md:mr-0 md:ml-6' : ''}
                  ${isLockedForStandard ? 'text-gray-400' : ''}
              `}>
                {format(day, 'd')}
              </div>
              
              {/* Cell Content - Responsive View */}
              <div className="flex flex-col gap-1 flex-1">
                {status.aaShift && aaLabel && !isFWDSelection && (
                  <div className={`p-0.5 md:px-2 md:py-1.5 border rounded md:rounded-lg text-[9px] md:text-xs font-bold shadow-sm flex items-center justify-center md:justify-between
                      ${isStandardSelectionStep 
                          ? 'bg-gray-100 border-gray-200 text-gray-500' // Neutral style for Step 3
                          : 'bg-red-100 border-red-200 text-red-800' // Red style for Step 1
                      }
                  `}>
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

                {/* Available Indicator Hint (Only on hover/desktop for Step 3) */}
                {isAvailableForStandard && !status.stdShift && (
                    <div className="mt-auto text-center hidden md:flex items-center justify-center opacity-0 hover:opacity-100 text-emerald-400 transition-opacity">
                        <Plus className="w-5 h-5" />
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
