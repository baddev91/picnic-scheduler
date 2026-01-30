
import React, { useState, useEffect } from 'react';
import { ShiftTime, ShiftType, WeeklyTemplate } from '../types';
import { SHIFT_TIMES } from '../constants';
import { Button } from './Button';
import { Check, Ban, CalendarDays, Copy, Save, X, CalendarClock, ArrowRight, Settings2, CalendarRange } from 'lucide-react';
import { addWeeks, format } from 'date-fns';
import startOfWeek from 'date-fns/startOfWeek';

interface WeeklyTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedTemplate: WeeklyTemplate;
  onSaveAndApply: (template: WeeklyTemplate, weeks: number, startDate: Date) => void;
}

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const WeeklyTemplateModal: React.FC<WeeklyTemplateModalProps> = ({
  isOpen,
  onClose,
  savedTemplate,
  onSaveAndApply,
}) => {
  const [currentTemplate, setCurrentTemplate] = useState<WeeklyTemplate>({});
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(1); // Start with Monday
  
  // Custom Settings State
  const [showCustomSettings, setShowCustomSettings] = useState(false);
  const [customWeeks, setCustomWeeks] = useState<number>(4);
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Load template when modal opens
  useEffect(() => {
    if (isOpen) {
      if (Object.keys(savedTemplate).length > 0) {
        setCurrentTemplate(savedTemplate);
      } else {
        // Initialize with everything OPEN (Default state)
        const initial: WeeklyTemplate = {};
        [0, 1, 2, 3, 4, 5, 6].forEach(day => {
          initial[day] = {} as Record<ShiftTime, ShiftType[]>;
          SHIFT_TIMES.forEach(shift => {
            initial[day][shift] = [ShiftType.AA, ShiftType.STANDARD];
          });
        });
        setCurrentTemplate(initial);
      }
    }
  }, [isOpen, savedTemplate]);

  if (!isOpen) return null;

  const toggleAvailability = (dayIndex: number, shift: ShiftTime, type: ShiftType) => {
    setCurrentTemplate(prev => {
      // Create a default complete object to satisfy Record<ShiftTime, ShiftType[]> type
      const defaultDayConfig = {
          [ShiftTime.OPENING]: [],
          [ShiftTime.MORNING]: [],
          [ShiftTime.NOON]: [],
          [ShiftTime.AFTERNOON]: [],
      } as Record<ShiftTime, ShiftType[]>;

      const dayConfig = prev[dayIndex] || defaultDayConfig;
      const currentTypes = dayConfig[shift] || [];
      
      let newTypes;
      if (currentTypes.includes(type)) {
        newTypes = currentTypes.filter(t => t !== type);
      } else {
        newTypes = [...currentTypes, type];
      }

      return {
        ...prev,
        [dayIndex]: {
          ...dayConfig,
          [shift]: newTypes
        }
      };
    });
  };

  const isAvailable = (dayIndex: number, shift: ShiftTime, type: ShiftType) => {
    return currentTemplate[dayIndex]?.[shift]?.includes(type);
  };

  const copyDayToAllWeekdays = () => {
    const sourceConfig = currentTemplate[selectedDayIndex];
    if (!sourceConfig) return;

    setCurrentTemplate(prev => {
      const next = { ...prev };
      [1, 2, 3, 4, 5].forEach(d => {
        if (d !== selectedDayIndex) {
            next[d] = JSON.parse(JSON.stringify(sourceConfig)) as Record<ShiftTime, ShiftType[]>;
        }
      });
      return next;
    });
  };

  // --- Quick Apply Handlers ---

  const handleApplyNow = () => {
    // Current week + Next 2 weeks (Total 3 weeks, starting from beginning of current week)
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    onSaveAndApply(currentTemplate, 3, start);
  };

  const handleApplyNextMonth = () => {
    // Starting next Monday, for 4 weeks
    const start = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1);
    onSaveAndApply(currentTemplate, 4, start);
  };

  const handleCustomApply = () => {
    onSaveAndApply(currentTemplate, customWeeks, new Date(customDate));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Weekly Pattern Manager</h3>
              <p className="text-sm text-gray-500">Define your ideal week structure once, then apply it in bulk.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar: Days */}
          <div className="w-48 bg-gray-50 border-r overflow-y-auto shrink-0 hidden md:block">
            {WEEK_DAYS.map((day, index) => {
              // Reorder to start with Monday (index 1) visually
              const displayOrder = [1, 2, 3, 4, 5, 6, 0]; 
              const actualDayIndex = displayOrder[index];
              const dayName = WEEK_DAYS[actualDayIndex];
              const isWeekend = actualDayIndex === 0 || actualDayIndex === 6;

              return (
                <button
                  key={actualDayIndex}
                  onClick={() => setSelectedDayIndex(actualDayIndex)}
                  className={`w-full text-left px-4 py-3 text-sm font-medium border-l-4 transition-all ${
                    selectedDayIndex === actualDayIndex
                      ? 'bg-white border-purple-500 text-purple-700 shadow-sm'
                      : 'border-transparent text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className={isWeekend ? 'text-red-500' : ''}>{dayName}</span>
                </button>
              );
            })}
          </div>

          {/* Mobile Tab Select (Visible only on small screens) */}
          <div className="md:hidden w-full overflow-x-auto border-b flex shrink-0">
             {WEEK_DAYS.map((day, index) => {
                const displayOrder = [1, 2, 3, 4, 5, 6, 0]; 
                const actualDayIndex = displayOrder[index];
                return (
                  <button
                    key={actualDayIndex}
                    onClick={() => setSelectedDayIndex(actualDayIndex)}
                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 ${
                      selectedDayIndex === actualDayIndex
                        ? 'border-purple-500 text-purple-700'
                        : 'border-transparent text-gray-500'
                    }`}
                  >
                    {WEEK_DAYS[actualDayIndex].substring(0,3)}
                  </button>
                )
             })}
          </div>

          {/* Content: Shift Config */}
          <div className="flex-1 p-6 overflow-y-auto bg-gray-50/30">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <span className="text-purple-600 bg-purple-50 px-2 py-1 rounded text-base">
                   {WEEK_DAYS[selectedDayIndex]}
                </span> 
                Settings
              </h4>
              {selectedDayIndex >= 1 && selectedDayIndex <= 5 && (
                <button 
                  onClick={copyDayToAllWeekdays}
                  className="text-xs flex items-center gap-1 bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-gray-600 hover:text-purple-600 hover:border-purple-200 transition-all shadow-sm font-medium"
                >
                  <Copy className="w-3 h-3" /> Apply to Mon-Fri
                </button>
              )}
            </div>

            <div className="grid gap-4">
              {SHIFT_TIMES.map(shift => (
                <div key={shift} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 group">
                  <div className="text-sm font-bold text-gray-700 mb-3 group-hover:text-purple-700 transition-colors">{shift}</div>
                  <div className="flex gap-4">
                    {/* AA Toggle */}
                    <button
                      onClick={() => toggleAvailability(selectedDayIndex, shift, ShiftType.AA)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                        isAvailable(selectedDayIndex, shift, ShiftType.AA)
                          ? 'bg-red-50 border-red-200 text-red-700 ring-1 ring-red-200 shadow-sm'
                          : 'bg-gray-50 border-gray-100 text-gray-400 opacity-60 hover:opacity-100 hover:bg-gray-100'
                      }`}
                    >
                      {isAvailable(selectedDayIndex, shift, ShiftType.AA) ? <Check className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      AA
                    </button>
                    {/* Std Toggle */}
                    <button
                      onClick={() => toggleAvailability(selectedDayIndex, shift, ShiftType.STANDARD)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                        isAvailable(selectedDayIndex, shift, ShiftType.STANDARD)
                          ? 'bg-green-50 border-green-200 text-green-700 ring-1 ring-green-200 shadow-sm'
                          : 'bg-gray-50 border-gray-100 text-gray-400 opacity-60 hover:opacity-100 hover:bg-gray-100'
                      }`}
                    >
                      {isAvailable(selectedDayIndex, shift, ShiftType.STANDARD) ? <Check className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      Normal
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Smart Footer - UX Improvement */}
        <div className="bg-white border-t p-4 md:p-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
           
           {!showCustomSettings ? (
             <div className="space-y-3">
               <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Quick Apply Presets</span>
                  <button 
                    onClick={() => setShowCustomSettings(true)}
                    className="text-xs text-purple-600 font-medium hover:underline flex items-center gap-1"
                  >
                    Custom Range <Settings2 className="w-3 h-3" />
                  </button>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Preset 1: Short Term */}
                  <button 
                    onClick={handleApplyNow}
                    className="flex items-center justify-between px-4 py-3 bg-white border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50 rounded-xl transition-all group text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 text-purple-600 rounded-lg group-hover:bg-purple-200">
                        <CalendarClock className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-800 text-sm">Apply: 3 Week Horizon</div>
                        <div className="text-xs text-gray-500">Immediate update (3 weeks)</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-purple-300 group-hover:text-purple-600 transform group-hover:translate-x-1 transition-all" />
                  </button>

                  {/* Preset 2: Medium Term */}
                  <button 
                    onClick={handleApplyNextMonth}
                    className="flex items-center justify-between px-4 py-3 bg-white border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl transition-all group text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-200">
                        <CalendarRange className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-800 text-sm">Apply: 4 Weeks (Next Mon)</div>
                        <div className="text-xs text-gray-500">Standard monthly plan</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-blue-300 group-hover:text-blue-600 transform group-hover:translate-x-1 transition-all" />
                  </button>
               </div>
             </div>
           ) : (
             <div className="space-y-4 animate-in slide-in-from-bottom-2">
                <div className="flex justify-between items-center">
                    <h4 className="font-bold text-gray-700">Custom Range Application</h4>
                    <button onClick={() => setShowCustomSettings(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
                
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="text-xs font-semibold text-gray-500 block mb-1">Start Date</label>
                        <input 
                            type="date" 
                            value={customDate}
                            onChange={(e) => setCustomDate(e.target.value)}
                            className="w-full p-2 border rounded-lg text-sm"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-semibold text-gray-500 block mb-1">Duration (Weeks)</label>
                        <input 
                            type="number" 
                            min="1" 
                            max="12" 
                            value={customWeeks}
                            onChange={(e) => setCustomWeeks(Number(e.target.value))}
                            className="w-full p-2 border rounded-lg text-sm"
                        />
                    </div>
                </div>

                <Button fullWidth onClick={handleCustomApply}>
                    Apply Custom Pattern
                </Button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
