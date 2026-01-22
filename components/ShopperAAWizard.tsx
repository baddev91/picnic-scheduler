
import React, { useState, useEffect } from 'react';
import { CalendarRange, CheckCircle2, Circle, Lock, AlertCircle, Clock } from 'lucide-react';
import { Button } from './Button';
import { ShiftTime, ShiftType, WeeklyTemplate } from '../types';
import { SHIFT_TIMES } from '../constants';

interface AASelectionItem {
    dayIndex: number;
    time: ShiftTime | null;
}

interface ShopperAAWizardProps {
  savedCloudTemplate: WeeklyTemplate | null;
  aaSelections: AASelectionItem[];
  setAaSelections: React.Dispatch<React.SetStateAction<AASelectionItem[]>>;
  handleAAWizardSubmit: () => void;
}

export const ShopperAAWizard: React.FC<ShopperAAWizardProps> = ({
  savedCloudTemplate,
  aaSelections,
  setAaSelections,
  handleAAWizardSubmit
}) => {
  
  // Logic helpers
  const currentWeekdayCount = aaSelections.filter(s => s.dayIndex >= 1 && s.dayIndex <= 5).length;
  
  // UX FIX: Count only fully completed selections (Day + Time)
  const completedCount = aaSelections.filter(s => s.time !== null).length;
  
  // We still track total 'cards' open to enforce the max 2 limit for picking days
  const activeCardsCount = aaSelections.length;

  // Animation State
  const [animateHeader, setAnimateHeader] = useState(false);

  // Trigger animation when count changes
  useEffect(() => {
      if (completedCount > 0) {
          setAnimateHeader(true);
          const timer = setTimeout(() => setAnimateHeader(false), 300);
          return () => clearTimeout(timer);
      }
  }, [completedCount]);

  const isDayDisabled = (dayIndex: number) => {
      // 1. Check Cloud Template availability first
      if (savedCloudTemplate && Object.keys(savedCloudTemplate).length > 0) {
          const dayConfig = savedCloudTemplate[dayIndex];
          const hasAA = dayConfig && SHIFT_TIMES.some(time => dayConfig[time]?.includes(ShiftType.AA));
          if (!hasAA) return true;
      }

      // 2. Check Selection Rules
      const isSelected = aaSelections.some(s => s.dayIndex === dayIndex);
      if (isSelected) return false; // Always allow deselecting
      
      // Rule: Max 2 Days Total
      if (activeCardsCount >= 2) return true;

      // Rule: Max 1 Weekday
      const isWeekday = dayIndex >= 1 && dayIndex <= 5;
      if (isWeekday && currentWeekdayCount >= 1) return true;

      return false;
  };

  const isShiftDisabled = (dayIndex: number, shift: ShiftTime) => {
      if (!savedCloudTemplate || Object.keys(savedCloudTemplate).length === 0) return false;
      const dayConfig = savedCloudTemplate[dayIndex];
      if (!dayConfig) return true;
      return !dayConfig[shift]?.includes(ShiftType.AA);
  };

  const handleToggleDay = (dayIndex: number) => {
      setAaSelections(prev => {
          const exists = prev.find(s => s.dayIndex === dayIndex);
          if (exists) {
              return prev.filter(s => s.dayIndex !== dayIndex);
          } else {
              if (isDayDisabled(dayIndex)) return prev;
              // Add day with default time null
              return [...prev, { dayIndex, time: null }];
          }
      });
  };

  const handleSetTime = (dayIndex: number, time: ShiftTime) => {
      setAaSelections(prev => prev.map(s => s.dayIndex === dayIndex ? { ...s, time } : s));
  };

  const renderDayCard = (dayIndex: number, label: string, isWeekend: boolean) => {
      const selection = aaSelections.find(s => s.dayIndex === dayIndex);
      const isSelected = !!selection;
      const isTimeSelected = !!selection?.time;
      const disabled = isDayDisabled(dayIndex);

      return (
          <div 
            key={dayIndex}
            className={`
                relative rounded-2xl border transition-all duration-300 flex flex-col overflow-hidden group
                ${isSelected 
                    ? 'border-red-400 bg-white shadow-xl shadow-red-100/50 ring-1 ring-red-100 scale-[1.01] z-10' 
                    : disabled
                        ? 'border-gray-100 bg-gray-50/50 opacity-60 grayscale cursor-not-allowed'
                        : 'border-gray-200 bg-white hover:border-red-300 hover:shadow-md cursor-pointer'
                }
            `}
          >
              {/* Card Header (Clickable to toggle day) */}
              <button 
                  onClick={() => handleToggleDay(dayIndex)}
                  disabled={disabled}
                  className="w-full text-left p-4 flex justify-between items-center outline-none"
              >
                  <div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest block mb-1 ${isWeekend ? 'text-red-400' : 'text-gray-400'}`}>
                          {isWeekend ? 'Weekend' : 'Weekday'}
                      </span>
                      <span className={`text-xl font-black tracking-tight ${isSelected ? 'text-red-600' : 'text-gray-800'}`}>
                          {label}
                      </span>
                  </div>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all duration-300 ${
                      isTimeSelected 
                        ? 'bg-red-500 border-red-500 text-white shadow-md shadow-red-200' 
                        : isSelected 
                            ? 'bg-white border-red-200' 
                            : 'bg-white border-gray-200 group-hover:border-red-300'
                  }`}>
                      {isTimeSelected && <CheckCircle2 className="w-4 h-4" />}
                      {isSelected && !isTimeSelected && <div className="w-2 h-2 rounded-full bg-red-200 animate-pulse" />}
                  </div>
              </button>

              {/* Time Selection (Visible only if selected) */}
              {isSelected && (
                  <div className="px-4 pb-4 animate-in slide-in-from-top-2 pt-0">
                      <div className="w-full h-px bg-gradient-to-r from-red-50 to-transparent mb-4"></div>
                      <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Select Time:
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                          {SHIFT_TIMES.map(shift => {
                              const shiftDisabled = isShiftDisabled(dayIndex, shift);
                              const isShiftChosen = selection.time === shift;
                              const shiftName = shift.split('(')[0].trim();
                              const shiftHours = shift.match(/\((.*?)\)/)?.[1] || '';
                              
                              return (
                                  <button
                                      key={shift}
                                      disabled={shiftDisabled}
                                      onClick={() => handleSetTime(dayIndex, shift)}
                                      className={`
                                          w-full text-left px-3 py-3 rounded-xl border transition-all flex items-center justify-between group/btn
                                          ${isShiftChosen 
                                              ? 'bg-red-500 text-white border-red-500 shadow-md shadow-red-200' 
                                              : shiftDisabled
                                                  ? 'hidden' // Hide disabled AA shifts in wizard to reduce clutter
                                                  : 'bg-white text-gray-600 border-gray-100 hover:border-red-300 hover:bg-red-50/50'
                                          }
                                      `}
                                  >
                                      <div className="flex flex-col">
                                          <span className={`text-sm font-bold leading-none ${isShiftChosen ? 'text-white' : 'text-gray-800'}`}>
                                              {shiftName}
                                          </span>
                                          <span className={`text-[10px] font-medium mt-1 tracking-wide ${isShiftChosen ? 'text-red-100' : 'text-gray-400'}`}>
                                              {shiftHours}
                                          </span>
                                      </div>
                                      
                                      {isShiftChosen && <div className="bg-white/20 p-1 rounded-full"><CheckCircle2 className="w-3.5 h-3.5 text-white" /></div>}
                                      {!isShiftChosen && <Circle className="w-3.5 h-3.5 text-gray-200 group-hover/btn:text-red-300" />}
                                  </button>
                              );
                          })}
                      </div>
                  </div>
              )}

              {/* Disabled Overlay Icon */}
              {!isSelected && disabled && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Lock className="w-5 h-5 text-gray-300 opacity-50" />
                  </div>
              )}
          </div>
      );
  };

  return (
      <div className="bg-white min-h-full flex flex-col">
          
          {/* Progress Header */}
          <div className="bg-white border-b sticky top-0 z-20 px-6 py-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <div className="max-w-5xl mx-auto flex justify-between items-center">
                  <div>
                      <h2 className="text-xl font-black text-gray-900 tracking-tight">AA Pattern</h2>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">Select exactly 2 days.</p>
                  </div>
                  
                  {/* ANIMATED COUNTER BADGE */}
                  <div className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all duration-300 shadow-sm border ${
                      animateHeader 
                        ? 'scale-110 bg-red-100 text-red-800 border-red-300 ring-4 ring-red-100' // Pop Effect
                        : completedCount === 2 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-gray-50 text-gray-500 border-gray-200'
                  }`}>
                      <CalendarRange className={`w-4 h-4 ${animateHeader ? 'animate-pulse' : ''}`} />
                      {completedCount} / 2 Selected
                  </div>
              </div>
          </div>

          <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-gray-50/50">
              <div className="max-w-5xl mx-auto">
                  
                  {/* Info Banner - Softer Look */}
                  {(completedCount < 2) && (
                     <div className="mb-8 bg-blue-50/80 border border-blue-100 p-5 rounded-2xl flex gap-4 text-blue-900 text-sm animate-in fade-in shadow-sm">
                        <div className="bg-blue-100 p-2 rounded-lg h-fit text-blue-600">
                           <AlertCircle className="w-5 h-5" />
                        </div>
                        <div className="leading-relaxed">
                           <strong className="block mb-1 text-blue-700">Recurring Schedule ("AA")</strong>
                           You are choosing 2 fixed days to work <strong>every week</strong>. 
                           <br/>Select either: <strong>1 Weekday + 1 Weekend</strong> OR <strong>Sat + Sun</strong>.
                        </div>
                     </div>
                  )}

                  {/* The Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                      {/* Weekdays */}
                      {[1, 2, 3, 4, 5].map(idx => {
                          const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                          return renderDayCard(idx, names[idx-1], false);
                      })}
                      
                      {/* Divider for Mobile */}
                      <div className="sm:hidden col-span-1 h-px bg-gray-200 my-2"></div>

                      {/* Weekends */}
                      {[6, 0].map(idx => {
                          return renderDayCard(idx, idx === 6 ? 'Saturday' : 'Sunday', true);
                      })}
                  </div>
              </div>
          </div>

          {/* Footer Action */}
          <div className="bg-white border-t p-4 md:p-6 sticky bottom-0 z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.03)]">
              <div className="max-w-5xl mx-auto flex justify-center">
                  <Button 
                      onClick={handleAAWizardSubmit}
                      disabled={completedCount !== 2}
                      className={`w-full md:w-auto md:min-w-[320px] py-4 text-lg shadow-xl hover:-translate-y-1 transition-all duration-300 font-bold ${
                        completedCount === 2
                        ? 'shadow-red-200 hover:shadow-red-300' 
                        : 'opacity-50 cursor-not-allowed'
                      }`}
                  >
                      Confirm AA Pattern
                  </Button>
              </div>
          </div>
      </div>
  );
};
