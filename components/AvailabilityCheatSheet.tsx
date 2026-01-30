
import React from 'react';
import { X, Calendar, Clock, Lock, CheckCircle2, Ban, Info } from 'lucide-react';
import { WeeklyTemplate, ShiftType } from '../types';
import { SHIFT_TIMES } from '../constants';

interface AvailabilityCheatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  weeklyTemplate: WeeklyTemplate | null;
}

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0]; // Map visual column to data key

export const AvailabilityCheatSheet: React.FC<AvailabilityCheatSheetProps> = ({
  isOpen,
  onClose,
  weeklyTemplate
}) => {
  if (!isOpen) return null;

  const getShiftLabel = (fullShiftName: string) => {
      const name = fullShiftName.split('(')[0].trim();
      const time = fullShiftName.match(/\((.*?)\)/)?.[1] || '';
      return { name, time };
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-2 md:p-6 animate-in fade-in duration-200">
      {/* Container expands to use most of the screen */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[1600px] h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-200">
        
        {/* Header */}
        <div className="bg-gray-900 px-6 py-4 md:px-8 md:py-5 shrink-0 flex justify-between items-center text-white border-b border-gray-800">
            <div className="flex items-center gap-4 md:gap-6">
                <div className="bg-white/10 p-2.5 md:p-3 rounded-2xl backdrop-blur-md border border-white/10 shadow-inner">
                    <Calendar className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <div>
                    <h3 className="font-black text-xl md:text-3xl tracking-tight leading-none">Shift Pattern</h3>
                    <p className="text-gray-400 font-medium text-xs md:text-sm mt-1">Weekly availability overview</p>
                </div>
            </div>
            
            <div className="flex items-center gap-4 md:gap-6">
                {/* Legend - Desktop */}
                <div className="hidden md:flex items-center gap-6 bg-gray-800/50 px-6 py-3 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
                        <span className="text-sm font-bold text-gray-300 uppercase tracking-wide">AA (Required)</span>
                    </div>
                    <div className="w-px h-5 bg-gray-700"></div>
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                        <span className="text-sm font-bold text-gray-300 uppercase tracking-wide">Normal</span>
                    </div>
                </div>

                <button onClick={onClose} className="p-2 md:p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white">
                    <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
            </div>
        </div>

        {/* Content Area - Flex Row Structure */}
        <div className="flex-1 flex overflow-hidden bg-gray-100">
            
            {/* 1. SIDEBAR (Time Labels) - ENLARGED */}
            <div className="w-32 md:w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col z-20 shadow-[4px_0_24px_rgba(0,0,0,0.04)]">
                {/* Top Left Corner */}
                <div className="h-16 md:h-24 border-b border-gray-200 flex items-center justify-center bg-gray-50/50">
                    <span className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest flex flex-col items-center gap-1.5">
                        <Clock className="w-5 h-5 md:w-6 md:h-6 opacity-50" />
                        Shift Times
                    </span>
                </div>
                
                {/* Shift Label Rows */}
                {SHIFT_TIMES.map((shift) => {
                    const { name, time } = getShiftLabel(shift);
                    return (
                        <div key={shift} className="flex-1 border-b border-gray-100 flex flex-col justify-center px-4 md:px-8 relative group hover:bg-gray-50 transition-colors">
                            {/* Shift Name - MUCH BIGGER */}
                            <span className="text-sm md:text-2xl font-black text-gray-900 leading-none tracking-tight uppercase">
                                {name}
                            </span>
                            
                            {/* Time - BIGGER & STYLED */}
                            <div className="flex items-center gap-2 mt-2 md:mt-3">
                                <div className="hidden md:flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-500">
                                    <Clock className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-[10px] md:text-sm font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">
                                    {time}
                                </span>
                            </div>

                            {/* Hover Indicator Line */}
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                    );
                })}
            </div>

            {/* 2. MAIN COLUMNS (Days) */}
            <div className="flex-1 grid grid-cols-7 divide-x divide-gray-200 overflow-x-auto md:overflow-hidden bg-white">
                {WEEK_DAYS.map((dayName, index) => {
                    const dayIndex = DAY_INDICES[index];
                    const isWeekend = index >= 5; // Sat, Sun
                    
                    // Column Background Logic
                    let colBg = "bg-white";
                    if (isWeekend) colBg = "bg-red-50/30"; // Subtle red tint for weekend
                    else if (index % 2 !== 0) colBg = "bg-gray-50/30"; // Zebra striping for weekdays

                    return (
                        <div key={dayName} className={`flex flex-col min-w-[100px] relative group hover:bg-gray-50 transition-colors ${colBg}`}>
                            
                            {/* Day Header - Enlarged */}
                            <div className={`h-16 md:h-24 border-b border-gray-200 flex flex-col items-center justify-center p-2 text-center z-10 transition-colors group-hover:bg-white ${isWeekend ? 'bg-red-50/50 border-b-red-100' : 'bg-white'}`}>
                                <span className={`text-lg md:text-3xl font-black uppercase tracking-tighter leading-none mb-1 ${isWeekend ? 'text-red-500' : 'text-gray-900'}`}>
                                    {dayName.substring(0,3)}
                                </span>
                                <span className={`text-[9px] md:text-xs font-bold uppercase tracking-widest hidden md:block ${isWeekend ? 'text-red-400' : 'text-gray-400'}`}>
                                    {dayName}
                                </span>
                            </div>

                            {/* Shift Cells Stacked Vertically */}
                            {SHIFT_TIMES.map((shift) => {
                                const dayConfig = weeklyTemplate?.[dayIndex] || {};
                                const types = dayConfig[shift] || [];
                                const hasAA = types.includes(ShiftType.AA);
                                const hasStd = types.includes(ShiftType.STANDARD);
                                const isEmpty = !hasAA && !hasStd;

                                return (
                                    <div key={`${dayName}-${shift}`} className={`flex-1 border-b border-gray-100 p-2 md:p-3 relative flex flex-col justify-center items-center gap-2 transition-all duration-200 group-hover:border-gray-200`}>
                                        
                                        {isEmpty ? (
                                            // CLOSED STATE
                                            <div className="w-full h-full rounded-xl bg-gray-100/50 border border-transparent flex flex-col items-center justify-center opacity-30">
                                                <div className="w-full h-full absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(0,0,0,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:8px_8px]"></div>
                                                <Ban className="w-6 h-6 md:w-8 md:h-8 text-gray-400 relative z-10" />
                                            </div>
                                        ) : (
                                            // OPEN STATE (AA / STD / BOTH)
                                            <div className="w-full h-full flex flex-col gap-1.5 md:gap-2">
                                                {hasAA && (
                                                    <div className="w-full flex-1 min-h-[32px] bg-red-500 rounded-lg md:rounded-xl shadow-sm shadow-red-200 flex items-center justify-center relative overflow-hidden group/item hover:scale-[1.02] transition-transform">
                                                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                                                        <span className="text-xs md:text-lg font-black text-white uppercase tracking-tighter relative z-10 drop-shadow-sm">AA</span>
                                                    </div>
                                                )}
                                                {hasStd && (
                                                    <div className="w-full flex-1 min-h-[32px] bg-emerald-500 rounded-lg md:rounded-xl shadow-sm shadow-emerald-200 flex items-center justify-center relative overflow-hidden group/item hover:scale-[1.02] transition-transform">
                                                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                                                        <span className="text-xs md:text-lg font-black text-white uppercase tracking-tighter relative z-10 drop-shadow-sm">STD</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
        
        {/* Mobile Legend Footer */}
        <div className="md:hidden bg-white p-4 border-t flex justify-center gap-6 text-xs font-bold uppercase text-gray-500 shrink-0">
             <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-500"></div> AA</div>
             <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-emerald-500"></div> Normal</div>
             <div className="flex items-center gap-2 opacity-50"><div className="w-3 h-3 rounded bg-gray-300"></div> Closed</div>
        </div>

      </div>
    </div>
  );
};
