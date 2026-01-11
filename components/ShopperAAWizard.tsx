import React from 'react';
import { CalendarRange, Sun, Moon, Sunrise, Sunset, CheckCircle2, Circle } from 'lucide-react';
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
  
  // Helper for Shift Icons
  const getShiftIcon = (time: string) => {
      if (time.includes('Opening')) return <Sunrise className="w-4 h-4" />;
      if (time.includes('Morning')) return <Sun className="w-4 h-4" />;
      if (time.includes('Noon')) return <Sun className="w-4 h-4 rotate-45" />;
      return <Moon className="w-4 h-4" />;
  };

  const isDayValid = (dayIndex: number) => {
      if (!savedCloudTemplate || Object.keys(savedCloudTemplate).length === 0) return true;
      const dayConfig = savedCloudTemplate[dayIndex];
      if (!dayConfig) return false;
      return SHIFT_TIMES.some(time => dayConfig[time]?.includes(ShiftType.AA));
  };

  const isShiftValidForDay = (dayIndex: number | null, shift: ShiftTime) => {
      if (dayIndex === null) return false;
      if (!savedCloudTemplate || Object.keys(savedCloudTemplate).length === 0) return true;
      
      const dayConfig = savedCloudTemplate[dayIndex];
      if (!dayConfig) return false;

      const allowedTypes = dayConfig[shift];
      return allowedTypes?.includes(ShiftType.AA);
  };

  return (
      <div className="bg-gray-50/50 p-4 md:p-8 animate-in fade-in duration-500">
          <div className="max-w-4xl mx-auto space-y-8">
              
              {/* Instructions Banner - Improved UX: Less alarming, more informative */}
              <div className="bg-white border border-red-100 p-5 rounded-2xl flex gap-4 shadow-sm items-start">
                  <div className="bg-red-50 p-3 rounded-xl text-red-600 shrink-0">
                      <CalendarRange className="w-6 h-6" />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900 text-lg">Define your AA Pattern</h3>
                      <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                          "Always Available" (AA) shifts are recurring shifts you commit to working <strong>every week</strong>. 
                          Please select <strong>1 Weekday</strong> and <strong>1 Weekend day</strong>.
                      </p>
                  </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
                  {/* Weekday Selection */}
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col h-full hover:shadow-md transition-shadow duration-300">
                      <div className="mb-4 pb-4 border-b border-gray-50">
                        <h4 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
                            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-black">1</div>
                            Select a Weekday
                        </h4>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mb-6">
                          {WEEKDAYS.map(d => {
                              const enabled = isDayValid(d.index);
                              const isSelected = aaSelection.weekday.dayIndex === d.index;
                              return (
                                <button
                                    key={d.index}
                                    disabled={!enabled}
                                    onClick={() => setAaSelection(prev => ({ 
                                        ...prev, 
                                        weekday: { dayIndex: d.index, time: null } 
                                    }))}
                                    className={`py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 transform active:scale-95 ${
                                        !enabled 
                                        ? 'bg-gray-50 text-gray-300 cursor-not-allowed border border-transparent' 
                                        : isSelected
                                            ? 'bg-red-600 text-white shadow-lg shadow-red-200 ring-2 ring-red-600 ring-offset-2' 
                                            : 'bg-white border border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50'
                                    }`}
                                >
                                    {d.name}
                                </button>
                              );
                          })}
                      </div>

                      <div className="space-y-3 mt-auto">
                           <p className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Preferred Time</p>
                           <div className="flex flex-col gap-2">
                              {SHIFT_TIMES.map(t => {
                                  const isEnabled = isShiftValidForDay(aaSelection.weekday.dayIndex, t);
                                  const isSelected = aaSelection.weekday.time === t;
                                  return (
                                      <button
                                          key={t}
                                          disabled={!isEnabled}
                                          onClick={() => setAaSelection(prev => ({ ...prev, weekday: { ...prev.weekday, time: t } }))}
                                          className={`group relative p-3 rounded-xl text-sm text-left font-medium border transition-all duration-200 ${
                                              !isEnabled 
                                              ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                                              : isSelected
                                                  ? 'border-red-600 bg-red-50 text-red-900 ring-1 ring-red-600'
                                                  : 'border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:shadow-sm'
                                          }`}
                                      >
                                          <div className="flex justify-between items-center">
                                              <div className="flex items-center gap-3">
                                                  <div className={`p-2 rounded-lg transition-colors ${isSelected ? 'bg-red-200 text-red-700' : 'bg-gray-100 text-gray-400 group-hover:bg-red-100 group-hover:text-red-500'}`}>
                                                      {getShiftIcon(t)}
                                                  </div>
                                                  <div>
                                                      <span className="block font-bold">{t.split('(')[0]}</span>
                                                      <span className="text-xs opacity-70 font-normal">{t.match(/\((.*?)\)/)?.[1]}</span>
                                                  </div>
                                              </div>
                                              {isSelected 
                                                ? <CheckCircle2 className="w-5 h-5 text-red-600" />
                                                : <Circle className="w-5 h-5 text-gray-200 group-hover:text-gray-300" />
                                              }
                                          </div>
                                      </button>
                                  );
                              })}
                           </div>
                      </div>
                  </div>

                  {/* Weekend Selection */}
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col h-full hover:shadow-md transition-shadow duration-300">
                      <div className="mb-4 pb-4 border-b border-gray-50">
                        <h4 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
                            <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center text-sm font-black">2</div>
                            Select a Weekend
                        </h4>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mb-6">
                          {WEEKENDS.map(d => {
                              const enabled = isDayValid(d.index);
                              const isSelected = aaSelection.weekend.dayIndex === d.index;
                              return (
                                <button
                                    key={d.index}
                                    disabled={!enabled}
                                    onClick={() => setAaSelection(prev => ({ 
                                        ...prev, 
                                        weekend: { dayIndex: d.index, time: null } 
                                    }))}
                                    className={`py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 transform active:scale-95 ${
                                        !enabled 
                                        ? 'bg-gray-50 text-gray-300 cursor-not-allowed border border-transparent' 
                                        : isSelected
                                            ? 'bg-red-600 text-white shadow-lg shadow-red-200 ring-2 ring-red-600 ring-offset-2' 
                                            : 'bg-white border border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50'
                                    }`}
                                >
                                    {d.name}
                                </button>
                              );
                          })}
                      </div>

                      <div className="space-y-3 mt-auto">
                           <p className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Preferred Time</p>
                           <div className="flex flex-col gap-2">
                              {SHIFT_TIMES.map(t => {
                                  const isEnabled = isShiftValidForDay(aaSelection.weekend.dayIndex, t);
                                  const isSelected = aaSelection.weekend.time === t;
                                  return (
                                      <button
                                          key={t}
                                          disabled={!isEnabled}
                                          onClick={() => setAaSelection(prev => ({ ...prev, weekend: { ...prev.weekend, time: t } }))}
                                          className={`group relative p-3 rounded-xl text-sm text-left font-medium border transition-all duration-200 ${
                                              !isEnabled 
                                              ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                                              : isSelected
                                                  ? 'border-red-600 bg-red-50 text-red-900 ring-1 ring-red-600'
                                                  : 'border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:shadow-sm'
                                          }`}
                                      >
                                          <div className="flex justify-between items-center">
                                              <div className="flex items-center gap-3">
                                                  <div className={`p-2 rounded-lg transition-colors ${isSelected ? 'bg-red-200 text-red-700' : 'bg-gray-100 text-gray-400 group-hover:bg-red-100 group-hover:text-red-500'}`}>
                                                      {getShiftIcon(t)}
                                                  </div>
                                                  <div>
                                                      <span className="block font-bold">{t.split('(')[0]}</span>
                                                      <span className="text-xs opacity-70 font-normal">{t.match(/\((.*?)\)/)?.[1]}</span>
                                                  </div>
                                              </div>
                                              {isSelected 
                                                ? <CheckCircle2 className="w-5 h-5 text-red-600" />
                                                : <Circle className="w-5 h-5 text-gray-200 group-hover:text-gray-300" />
                                              }
                                          </div>
                                      </button>
                                  );
                              })}
                           </div>
                      </div>
                  </div>
              </div>
              
              <div className="pt-4 pb-8 flex justify-center">
                  <Button 
                      fullWidth 
                      onClick={handleAAWizardSubmit}
                      className="py-4 text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 max-w-md"
                  >
                      Confirm Pattern
                  </Button>
              </div>
          </div>
      </div>
  );
};