import React from 'react';
import { CalendarRange, Sun, Star, Ban, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { ShiftTime, ShiftType, WeeklyTemplate } from '../types';
import { SHIFT_TIMES } from '../constants';

interface ShopperAAWizardProps {
  savedCloudTemplate: WeeklyTemplate | null;
  aaSelection: {
    weekday: { dayIndex: number | null, time: ShiftTime | null },
    weekend: { dayIndex: number | null, time: ShiftTime | null }
  };
  setAaSelection: React.Dispatch<React.SetStateAction<{
    weekday: { dayIndex: number | null, time: ShiftTime | null },
    weekend: { dayIndex: number | null, time: ShiftTime | null }
  }>>;
  handleAAWizardSubmit: () => void;
}

export const ShopperAAWizard: React.FC<ShopperAAWizardProps> = ({
  savedCloudTemplate,
  aaSelection,
  setAaSelection,
  handleAAWizardSubmit
}) => {
  const WEEKDAYS = [
      { index: 1, name: 'Monday' }, { index: 2, name: 'Tuesday' }, { index: 3, name: 'Wednesday' },
      { index: 4, name: 'Thursday' }, { index: 5, name: 'Friday' }
  ];
  const WEEKENDS = [
      { index: 6, name: 'Saturday' }, { index: 0, name: 'Sunday' }
  ];
  
  // 1. Check if the entire DAY is valid (has at least one AA slot)
  const isDayValid = (dayIndex: number) => {
      if (!savedCloudTemplate || Object.keys(savedCloudTemplate).length === 0) return true; // Default open if no config
      const dayConfig = savedCloudTemplate[dayIndex];
      if (!dayConfig) return false; // Should exist if template is populated
      
      // Check if ANY shift in this day has 'Always Available'
      return SHIFT_TIMES.some(time => dayConfig[time]?.includes(ShiftType.AA));
  };

  // 2. Check if a specific TIME is valid for the selected day
  const isShiftValidForDay = (dayIndex: number | null, shift: ShiftTime) => {
      if (dayIndex === null) return false; // Can't pick time if no day selected
      if (!savedCloudTemplate || Object.keys(savedCloudTemplate).length === 0) return true;
      
      const dayConfig = savedCloudTemplate[dayIndex];
      if (!dayConfig) return false;

      const allowedTypes = dayConfig[shift];
      return allowedTypes?.includes(ShiftType.AA);
  };

  return (
      <div className="bg-gray-50 p-4 md:p-6">
          <div className="max-w-3xl mx-auto space-y-6">
              {/* Instructions */}
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex gap-3">
                  <div className="bg-white p-2 rounded-lg h-fit text-red-600 shadow-sm">
                      <CalendarRange className="w-5 h-5" />
                  </div>
                  <div>
                      <h3 className="font-bold text-red-800">Required: Pick your "Always Available" Shifts</h3>
                      <p className="text-sm text-red-600 mt-1">
                          You must select <strong>1 Weekday</strong> and <strong>1 Weekend day</strong> that you can guarantee every week.
                      </p>
                  </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                  {/* Weekday Selection */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
                      <h4 className="font-bold text-gray-900 flex items-center gap-2">
                          <Sun className="w-5 h-5 text-orange-500" /> 1. Select a Weekday
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-2">
                          {WEEKDAYS.map(d => {
                              const enabled = isDayValid(d.index);
                              return (
                                <button
                                    key={d.index}
                                    disabled={!enabled}
                                    onClick={() => setAaSelection(prev => ({ 
                                        ...prev, 
                                        weekday: { dayIndex: d.index, time: null } // Reset time when day changes
                                    }))}
                                    className={`py-2 px-3 rounded-lg text-sm font-medium border-2 transition-all ${
                                        !enabled 
                                        ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed decoration-slice' 
                                        : aaSelection.weekday.dayIndex === d.index 
                                            ? 'border-purple-600 bg-purple-50 text-purple-700' 
                                            : 'border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {d.name} {!enabled && <Ban className="w-3 h-3 inline ml-1 opacity-50" />}
                                </button>
                              );
                          })}
                      </div>

                      <div className="space-y-2 pt-2 border-t">
                           <p className="text-xs font-bold text-gray-400 uppercase">Preferred Time</p>
                           <div className="grid grid-cols-1 gap-2">
                              {SHIFT_TIMES.map(t => {
                                  const isEnabled = isShiftValidForDay(aaSelection.weekday.dayIndex, t);
                                  return (
                                      <button
                                          key={t}
                                          disabled={!isEnabled}
                                          onClick={() => setAaSelection(prev => ({ ...prev, weekday: { ...prev.weekday, time: t } }))}
                                          className={`py-2 px-3 rounded-lg text-sm text-left font-medium border-2 transition-all ${
                                              !isEnabled 
                                              ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed opacity-60'
                                              : aaSelection.weekday.time === t
                                                  ? 'border-purple-600 bg-purple-50 text-purple-700'
                                                  : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                                          }`}
                                      >
                                          <div className="flex justify-between w-full items-center">
                                              <span>{t.split('(')[0]} <span className="text-xs font-normal block">{t.match(/\((.*?)\)/)?.[1]}</span></span>
                                              {!isEnabled && <Ban className="w-4 h-4 text-gray-300" />}
                                          </div>
                                      </button>
                                  );
                              })}
                           </div>
                      </div>
                  </div>

                  {/* Weekend Selection */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
                      <h4 className="font-bold text-gray-900 flex items-center gap-2">
                          <Star className="w-5 h-5 text-yellow-500" /> 2. Select a Weekend
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-2">
                          {WEEKENDS.map(d => {
                              const enabled = isDayValid(d.index);
                              return (
                                <button
                                    key={d.index}
                                    disabled={!enabled}
                                    onClick={() => setAaSelection(prev => ({ 
                                        ...prev, 
                                        weekend: { dayIndex: d.index, time: null } // Reset time when day changes
                                    }))}
                                    className={`py-2 px-3 rounded-lg text-sm font-medium border-2 transition-all ${
                                        !enabled 
                                        ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed decoration-slice' 
                                        : aaSelection.weekend.dayIndex === d.index 
                                            ? 'border-purple-600 bg-purple-50 text-purple-700' 
                                            : 'border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {d.name} {!enabled && <Ban className="w-3 h-3 inline ml-1 opacity-50" />}
                                </button>
                              );
                          })}
                      </div>

                      <div className="space-y-2 pt-2 border-t">
                           <p className="text-xs font-bold text-gray-400 uppercase">Preferred Time</p>
                           <div className="grid grid-cols-1 gap-2">
                              {SHIFT_TIMES.map(t => {
                                  const isEnabled = isShiftValidForDay(aaSelection.weekend.dayIndex, t);
                                  return (
                                      <button
                                          key={t}
                                          disabled={!isEnabled}
                                          onClick={() => setAaSelection(prev => ({ ...prev, weekend: { ...prev.weekend, time: t } }))}
                                          className={`py-2 px-3 rounded-lg text-sm text-left font-medium border-2 transition-all ${
                                              !isEnabled 
                                              ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed opacity-60'
                                              : aaSelection.weekend.time === t
                                                  ? 'border-purple-600 bg-purple-50 text-purple-700'
                                                  : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                                          }`}
                                      >
                                          <div className="flex justify-between w-full items-center">
                                              <span>{t.split('(')[0]} <span className="text-xs font-normal block">{t.match(/\((.*?)\)/)?.[1]}</span></span>
                                              {!isEnabled && <Ban className="w-4 h-4 text-gray-300" />}
                                          </div>
                                      </button>
                                  );
                              })}
                           </div>
                      </div>
                  </div>
              </div>
              
              <div className="pt-6">
                  <Button 
                      fullWidth 
                      onClick={handleAAWizardSubmit}
                      className="py-4 text-lg shadow-xl"
                  >
                      Confirm & Continue <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <p className="text-center text-xs text-gray-400 mt-2">
                      * Actual dates will be generated based on admin availability.
                  </p>
              </div>
          </div>
      </div>
  );
};