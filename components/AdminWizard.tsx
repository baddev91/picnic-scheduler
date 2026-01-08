import React from 'react';
import { Trash2, Copy, CheckCircle, Ban, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { AdminWizardStep, ShiftTime, ShiftType, WeeklyTemplate } from '../types';
import { SHIFT_TIMES } from '../constants';

interface AdminWizardDaysProps {
  wizardDayIndex: number;
  setWizardDayIndex: React.Dispatch<React.SetStateAction<number>>;
  setAdminWizardStep: (step: AdminWizardStep) => void;
  tempTemplate: WeeklyTemplate;
  toggleWizardTemplate: (shift: ShiftTime, type: ShiftType) => void;
  resetWizardTemplate: () => void;
  copyPreviousDay: () => void;
}

export const AdminWizardDays: React.FC<AdminWizardDaysProps> = ({
  wizardDayIndex,
  setWizardDayIndex,
  setAdminWizardStep,
  tempTemplate,
  toggleWizardTemplate,
  resetWizardTemplate,
  copyPreviousDay
}) => {
  const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = WEEK_DAYS[wizardDayIndex];
  const isWeekendDay = wizardDayIndex === 0 || wizardDayIndex === 6;

  const handleNext = () => {
      if (wizardDayIndex === 0) setAdminWizardStep(AdminWizardStep.WIZARD_APPLY); // Sun is last
      else setWizardDayIndex(prev => prev === 6 ? 0 : prev + 1);
  };

  const handleBack = () => {
      if (wizardDayIndex === 1) setAdminWizardStep(AdminWizardStep.DASHBOARD); // Mon is first
      else setWizardDayIndex(prev => prev === 0 ? 6 : prev - 1);
  };

  const isShiftEnabled = (shift: ShiftTime, type: ShiftType) => {
      return tempTemplate[wizardDayIndex]?.[shift]?.includes(type);
  };

  return (
      <div className="max-w-3xl mx-auto h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                   <span className="text-xs font-bold uppercase text-gray-400">Step 1: Define Pattern</span>
              </div>
              <div className="flex gap-1">
                  {[1,2,3,4,5,6,0].map(d => (
                      <div key={d} className={`h-1.5 w-6 rounded-full ${d === wizardDayIndex ? 'bg-purple-600' : tempTemplate[d] ? 'bg-purple-200' : 'bg-gray-200'}`} />
                  ))}
              </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col flex-1 animate-in slide-in-from-right duration-300 border border-gray-100">
              <div className={`p-6 border-b flex justify-between items-center ${isWeekendDay ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <div>
                      <h2 className={`text-3xl font-extrabold ${isWeekendDay ? 'text-red-600' : 'text-gray-800'}`}>{dayName}</h2>
                      <p className="text-gray-500 font-medium mt-1">Configure available shifts</p>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={resetWizardTemplate} className="flex items-center gap-2 text-sm font-bold text-gray-500 bg-white px-3 py-2 rounded-lg shadow-sm hover:bg-gray-100 hover:text-red-500 transition-all border">
                          <Trash2 className="w-4 h-4" /> Reset Pattern
                      </button>
                     {wizardDayIndex !== 1 && (
                          <button onClick={copyPreviousDay} className="flex items-center gap-2 text-sm font-bold text-purple-600 bg-white px-3 py-2 rounded-lg shadow-sm hover:bg-purple-50 transition-all border border-purple-100">
                              <Copy className="w-4 h-4" /> Copy Previous Day
                          </button>
                      )}
                  </div>
              </div>

              <div className="p-6 overflow-y-auto space-y-4">
                  {SHIFT_TIMES.map(shift => (
                      <div key={shift} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border border-gray-100 hover:border-purple-100 hover:shadow-md transition-all gap-4">
                          <div className="flex items-center gap-3">
                              <div className="p-2 bg-gray-100 rounded-lg text-gray-500 font-bold">
                                  {shift.split('(')[0]}
                              </div>
                              <span className="text-xs text-gray-400 font-mono">{shift.match(/\((.*?)\)/)?.[1]}</span>
                          </div>
                          
                          <div className="flex gap-3">
                              <button
                                  onClick={() => toggleWizardTemplate(shift, ShiftType.AA)}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                                      isShiftEnabled(shift, ShiftType.AA)
                                      ? 'bg-red-500 border-red-500 text-white shadow-red-200 shadow-lg'
                                      : 'bg-white border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-400'
                                  }`}
                              >
                                  {isShiftEnabled(shift, ShiftType.AA) ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                  AA
                              </button>

                              <button
                                  onClick={() => toggleWizardTemplate(shift, ShiftType.STANDARD)}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                                      isShiftEnabled(shift, ShiftType.STANDARD)
                                      ? 'bg-green-500 border-green-500 text-white shadow-green-200 shadow-lg'
                                      : 'bg-white border-gray-200 text-gray-400 hover:border-green-300 hover:text-green-400'
                                  }`}
                              >
                                  {isShiftEnabled(shift, ShiftType.STANDARD) ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                  Standard
                              </button>
                          </div>
                      </div>
                  ))}
              </div>

              <div className="p-6 bg-gray-50 border-t mt-auto flex justify-between items-center">
                  <Button variant="secondary" onClick={handleBack} className="w-32">
                      <ChevronLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button onClick={handleNext} className="w-32 bg-gray-900 text-white hover:bg-black">
                      {wizardDayIndex === 0 ? 'Review' : 'Next Day'} <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
              </div>
          </div>
      </div>
  );
};

interface AdminWizardApplyProps {
  applyWeeks: number;
  setApplyWeeks: (w: number) => void;
  setAdminWizardStep: (step: AdminWizardStep) => void;
  applyTemplate: () => void;
}

export const AdminWizardApply: React.FC<AdminWizardApplyProps> = ({
  applyWeeks,
  setApplyWeeks,
  setAdminWizardStep,
  applyTemplate
}) => {
  return (
      <div className="max-w-2xl mx-auto h-full flex flex-col justify-center animate-in zoom-in-95 duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl text-center space-y-8 border border-purple-100">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-purple-600" />
              </div>
              
              <div>
                  <h2 className="text-3xl font-extrabold text-gray-900">Pattern Ready!</h2>
                  <p className="text-gray-500 mt-2 text-lg">How far into the future should we generate this schedule?</p>
              </div>

              <div className="bg-gray-50 p-6 rounded-2xl max-w-sm mx-auto">
                  <div className="flex justify-between items-end mb-2">
                      <span className="text-gray-500 font-bold uppercase text-xs">Duration</span>
                      <span className="text-3xl font-bold text-purple-600">{applyWeeks} <span className="text-base text-gray-400 font-medium">Weeks</span></span>
                  </div>
                  <input 
                      type="range" 
                      min="1" 
                      max="12" 
                      value={applyWeeks} 
                      onChange={(e) => setApplyWeeks(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <div className="flex justify-between mt-2 text-xs text-gray-400 font-medium">
                      <span>1 Week</span>
                      <span>12 Weeks</span>
                  </div>
              </div>

              <div className="flex gap-4 pt-4">
                  <Button variant="secondary" onClick={() => setAdminWizardStep(AdminWizardStep.WIZARD_DAYS)} fullWidth>
                      Edit Pattern
                  </Button>
                  <Button onClick={applyTemplate} fullWidth className="py-4 text-lg bg-gradient-to-r from-purple-600 to-indigo-600">
                      Generate Schedule
                  </Button>
              </div>
              <p className="text-xs text-gray-400">Note: This will overwrite local settings starting from next Monday.</p>
          </div>
      </div>
  );
};