import React, { useMemo, useState, useEffect } from 'react';
import { Activity, ChevronDown, ChevronUp, BarChart3, Bus, TrendingUp, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, eachDayOfInterval, addDays, endOfWeek, addWeeks, isSameDay } from 'date-fns';
import parseISO from 'date-fns/parseISO';
import startOfDay from 'date-fns/startOfDay';
import startOfWeek from 'date-fns/startOfWeek';
import subWeeks from 'date-fns/subWeeks';
import { ShiftType, ShopperRecord } from '../types';
import { SHIFT_TIMES } from '../constants';

interface AdminHeatmapProps {
  data: ShopperRecord[];
}

export const AdminHeatmap: React.FC<AdminHeatmapProps> = ({ data }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Set initial week to current week
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  // --- ANALYTICS METRICS ---
  const metrics = useMemo(() => {
      const totalShoppers = data.length;
      if (totalShoppers === 0) return null;

      let totalShifts = 0;
      let busUsers = 0;
      const shiftTypeCounts: Record<string, number> = {};

      data.forEach(shopper => {
          totalShifts += shopper.shifts.length;
          if (shopper.details?.usePicnicBus) busUsers++;

          shopper.shifts.forEach(shift => {
              const timeLabel = shift.time.split('(')[0].trim();
              shiftTypeCounts[timeLabel] = (shiftTypeCounts[timeLabel] || 0) + 1;
          });
      });

      const avgShifts = (totalShifts / totalShoppers).toFixed(1);
      const busRate = Math.round((busUsers / totalShoppers) * 100);

      let maxCount = 0;
      let popularShift = 'N/A';
      Object.entries(shiftTypeCounts).forEach(([key, val]) => {
          if (val > maxCount) {
              maxCount = val;
              popularShift = key;
          }
      });

      return { avgShifts, busRate, busUsers, popularShift, totalShifts };
  }, [data]);

  // --- HEATMAP DATA CALCULATION ---
  const heatmapData = useMemo(() => {
    const map: Record<string, { aa: number; std: number; total: number }> = {};
    let globalMax = 0;

    data.forEach(shopper => {
        shopper.shifts.forEach(shift => {
            const key = `${shift.date}_${shift.time}`;
            if (!map[key]) map[key] = { aa: 0, std: 0, total: 0 };
            
            if (shift.type === ShiftType.AA) map[key].aa += 1;
            else map[key].std += 1;
            
            map[key].total += 1;
            
            if (map[key].total > globalMax) globalMax = map[key].total;
        });
    });
    
    return { map, globalMax };
  }, [data]);

  // --- WEEKLY NAVIGATION ---
  const daysInCurrentWeek = useMemo(() => {
      const start = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
      const end = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
  }, [currentWeekStart]);

  const handlePrevWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const handleNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
  const handleToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const getOpacity = (count: number, max: number) => {
    if (count === 0) return 0;
    const safeMax = max === 0 ? 1 : max;
    // Base opacity 0.2, scales up to 1.0
    return Math.min(1, (count / safeMax) * 0.8 + 0.2);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden transition-all duration-300">
        {/* Accordion Header */}
        <button 
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between p-4 md:p-6 bg-white hover:bg-gray-50 transition-colors"
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg transition-colors ${isOpen ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                    <Activity className="w-5 h-5" />
                </div>
                <div className="text-left">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Density Map & Analytics</h3>
                    <p className="text-xs text-gray-500">View shift distribution week by week</p>
                </div>
            </div>
            {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>

        {isOpen && (
            <div className="border-t animate-in slide-in-from-top-2 duration-300">
                {/* 1. METRICS SECTION */}
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border-b bg-gray-50/50">
                    <div className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                            <BarChart3 className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Avg. Shifts</p>
                            <p className="text-2xl font-black text-gray-900">{metrics?.avgShifts || '0'}</p>
                            <p className="text-xs text-gray-500">Per shopper</p>
                        </div>
                    </div>

                    <div className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-purple-100 text-purple-600 rounded-full">
                            <Bus className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Bus Usage</p>
                            <p className="text-2xl font-black text-gray-900">{metrics?.busRate || '0'}%</p>
                            <p className="text-xs text-gray-500">{metrics?.busUsers} shoppers</p>
                        </div>
                    </div>

                    <div className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-orange-100 text-orange-600 rounded-full">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Peak Shift</p>
                            <p className="text-2xl font-black text-gray-900">{metrics?.popularShift || '-'}</p>
                            <p className="text-xs text-gray-500">Most requested</p>
                        </div>
                    </div>
                </div>

                {/* 2. HEATMAP SECTION */}
                <div className="p-4 md:p-6">
                    {/* Navigation Controls */}
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                            <button onClick={handlePrevWeek} className="p-1 hover:bg-white rounded shadow-sm transition-all text-gray-600">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button onClick={handleToday} className="px-3 py-1 text-xs font-bold text-gray-600 hover:bg-white rounded transition-all">
                                Today
                            </button>
                            <button onClick={handleNextWeek} className="p-1 hover:bg-white rounded shadow-sm transition-all text-gray-600">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                             <Calendar className="w-4 h-4 text-purple-600" />
                             <span className="text-sm font-bold text-gray-900">
                                 Week of {format(currentWeekStart, 'MMM do, yyyy')}
                             </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="font-semibold text-gray-500">Key:</span>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div><span>AA</span></div>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-sm"></div><span>Std</span></div>
                        </div>
                    </div>

                    <div className="overflow-x-auto pb-6">
                        <div className="min-w-[600px]">
                            <div className="grid grid-rows-[auto_repeat(4,1fr)] gap-2">
                                {/* Header Row (Days) */}
                                <div className="flex gap-2 ml-24">
                                    {daysInCurrentWeek.map((day, i) => {
                                        const isToday = isSameDay(day, new Date());
                                        return (
                                            <div key={i} className={`flex-1 text-center p-2 rounded-lg ${isToday ? 'bg-purple-50 ring-1 ring-purple-200' : ''}`}>
                                                <div className={`text-[10px] uppercase font-bold ${isToday ? 'text-purple-600' : 'text-gray-400'}`}>{format(day, 'EEE')}</div>
                                                <div className={`text-sm font-bold ${isToday ? 'text-purple-900' : 'text-gray-600'}`}>{format(day, 'd')}</div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Shift Rows */}
                                {SHIFT_TIMES.map(shift => (
                                    <div key={shift} className="flex gap-2 items-center h-16">
                                        {/* Row Label */}
                                        <div className="w-24 text-right pr-4">
                                            <div className="text-xs font-bold text-gray-700">{shift.split('(')[0]}</div>
                                            <div className="text-[10px] text-gray-400">{shift.match(/\((.*?)\)/)?.[1]}</div>
                                        </div>

                                        {/* Cells */}
                                        {daysInCurrentWeek.map((day, i) => {
                                            const dateKey = format(day, 'yyyy-MM-dd');
                                            const key = `${dateKey}_${shift}`;
                                            const cellData = heatmapData.map[key] || { aa: 0, std: 0, total: 0 };
                                            
                                            // Determine dominance color (AA vs Std) for mixed visual
                                            // We use a simplified gradient-like approach: 
                                            // If mainly AA -> Red base. If mainly Std -> Green base.
                                            
                                            return (
                                                <div key={i} className="flex-1 h-full relative group">
                                                    <div className="w-full h-full rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex flex-col relative">
                                                        {cellData.total > 0 && (
                                                            <>
                                                                <div 
                                                                    className="flex-1 w-full bg-red-500 transition-all duration-500" 
                                                                    style={{ opacity: getOpacity(cellData.aa, heatmapData.globalMax) }}
                                                                ></div>
                                                                <div 
                                                                    className="flex-1 w-full bg-green-500 transition-all duration-500" 
                                                                    style={{ opacity: getOpacity(cellData.std, heatmapData.globalMax) }}
                                                                ></div>
                                                                
                                                                {/* Simple Count Badge on top for quick view */}
                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                    <span className="text-xs font-bold text-gray-900 bg-white/80 backdrop-blur-[1px] px-1.5 py-0.5 rounded shadow-sm">
                                                                        {cellData.total}
                                                                    </span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* HOVER TOOLTIP */}
                                                    {cellData.total > 0 && (
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 w-48">
                                                            <div className="bg-gray-900 text-white text-xs rounded-xl shadow-xl p-3 border border-gray-700 animate-in zoom-in-95 duration-200">
                                                                <div className="font-bold text-center border-b border-gray-700 pb-2 mb-2 text-gray-300">
                                                                    {format(day, 'EEEE, MMM do')}
                                                                    <div className="text-[10px] font-normal opacity-70">{shift.split('(')[0]} Shift</div>
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"></div> AA Shifts</span>
                                                                        <span className="font-bold font-mono text-red-400">{cellData.aa}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500"></div> Standard</span>
                                                                        <span className="font-bold font-mono text-green-400">{cellData.std}</span>
                                                                    </div>
                                                                    <div className="border-t border-gray-700 mt-2 pt-1 flex justify-between items-center font-bold text-sm">
                                                                        <span>Total</span>
                                                                        <span>{cellData.total}</span>
                                                                    </div>
                                                                </div>
                                                                {/* Little arrow */}
                                                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 border-b border-r border-gray-700"></div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};