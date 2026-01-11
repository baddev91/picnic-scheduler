import React, { useMemo, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, BarChart3, Bus, TrendingUp } from 'lucide-react';
import { format, eachDayOfInterval, addDays } from 'date-fns';
import parseISO from 'date-fns/parseISO';
import startOfDay from 'date-fns/startOfDay';
import { ShiftType, ShopperRecord } from '../types';
import { SHIFT_TIMES } from '../constants';

interface AdminHeatmapProps {
  data: ShopperRecord[];
}

export const AdminHeatmap: React.FC<AdminHeatmapProps> = ({ data }) => {
  const [isOpen, setIsOpen] = useState(false);

  // --- ANALYTICS METRICS ---
  const metrics = useMemo(() => {
      const totalShoppers = data.length;
      if (totalShoppers === 0) return null;

      let totalShifts = 0;
      let busUsers = 0;
      const shiftTypeCounts: Record<string, number> = {};

      data.forEach(shopper => {
          totalShifts += shopper.shifts.length;
          
          // Count Bus Usage
          if (shopper.details?.usePicnicBus) {
              busUsers++;
          }

          shopper.shifts.forEach(shift => {
              // Count popularity by Time (Morning, Noon, etc.)
              const timeLabel = shift.time.split('(')[0].trim();
              shiftTypeCounts[timeLabel] = (shiftTypeCounts[timeLabel] || 0) + 1;
          });
      });

      // 1. Average Shifts per Shopper
      const avgShifts = (totalShifts / totalShoppers).toFixed(1);

      // 2. Bus Usage Rate (Logistics Metric)
      const busRate = Math.round((busUsers / totalShoppers) * 100);

      // 3. Most Popular Shift
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

  // --- HEATMAP LOGIC ---
  const heatmapData = useMemo(() => {
    const map: Record<string, { aa: number; std: number; total: number }> = {};
    let maxCount = 0;
    const allDates: Date[] = [];

    data.forEach(shopper => {
        shopper.shifts.forEach(shift => {
            const key = `${shift.date}_${shift.time}`;
            if (!map[key]) map[key] = { aa: 0, std: 0, total: 0 };
            if (shift.type === ShiftType.AA) map[key].aa += 1;
            else map[key].std += 1;
            map[key].total += 1;
            if (map[key].total > maxCount) maxCount = map[key].total;
            allDates.push(parseISO(shift.date));
        });
    });

    let startDate = startOfDay(new Date());
    let endDate = addDays(startOfDay(new Date()), 14);

    if (allDates.length > 0) {
        startDate = new Date(Math.min(...allDates.map(d => d.getTime())));
        endDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    }

    // Ensure we don't try to render an invalid interval
    let days: Date[] = [];
    try {
        days = eachDayOfInterval({ start: startDate, end: endDate });
    } catch (e) {
        days = [];
    }
    
    return { map, maxCount, days };
  }, [data]);

  const getOpacity = (count: number, max: number) => {
    if (count === 0) return 0;
    const safeMax = max === 0 ? 1 : max;
    return Math.min(1, (count / safeMax) + 0.3);
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
                    <p className="text-xs text-gray-500">View distribution and key performance metrics</p>
                </div>
            </div>
            {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>

        {isOpen && (
            <div className="border-t animate-in slide-in-from-top-2 duration-300">
                {/* 1. METRICS SECTION */}
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border-b bg-gray-50/50">
                    {/* Metric 1 */}
                    <div className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                            <BarChart3 className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Avg. Shifts / Shopper</p>
                            <p className="text-2xl font-black text-gray-900">{metrics?.avgShifts || '0'}</p>
                            <p className="text-xs text-gray-500">Based on {metrics?.totalShifts} total shifts</p>
                        </div>
                    </div>

                    {/* Metric 2 - BUS USAGE */}
                    <div className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-purple-100 text-purple-600 rounded-full">
                            <Bus className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Bus Usage</p>
                            <p className="text-2xl font-black text-gray-900">{metrics?.busRate || '0'}%</p>
                            <p className="text-xs text-gray-500">{metrics?.busUsers} shoppers require transport</p>
                        </div>
                    </div>

                    {/* Metric 3 - PEAK TIME */}
                    <div className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-orange-100 text-orange-600 rounded-full">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Peak Shift Time</p>
                            <p className="text-2xl font-black text-gray-900">{metrics?.popularShift || '-'}</p>
                            <p className="text-xs text-gray-500">Highest demand slot</p>
                        </div>
                    </div>
                </div>

                {/* 2. HEATMAP SECTION */}
                <div className="p-4 md:p-6">
                    <div className="flex items-center justify-end gap-3 text-xs text-gray-400 mb-4">
                        <span className="font-semibold text-gray-500">Legend:</span>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div><span>AA</span></div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-sm"></div><span>Standard</span></div>
                        <span className="ml-2 text-[10px] text-gray-300">Opacity = Volume</span>
                    </div>

                    <div className="overflow-x-auto pb-2">
                        <div className="min-w-max">
                            <div className="grid grid-rows-[auto_repeat(4,1fr)] gap-1">
                                <div className="flex gap-1 ml-20 md:ml-24">
                                    {heatmapData.days.map((day, i) => (
                                        <div key={i} className="w-8 text-center">
                                            <div className="text-[10px] text-gray-400 uppercase font-bold">{format(day, 'EEE')}</div>
                                            <div className="text-xs text-gray-600 font-bold">{format(day, 'd')}</div>
                                        </div>
                                    ))}
                                </div>
                                {SHIFT_TIMES.map(shift => (
                                    <div key={shift} className="flex gap-1 items-center">
                                        <div className="w-20 md:w-24 text-right pr-3 text-[10px] md:text-xs font-bold text-gray-500 truncate" title={shift}>{shift.split('(')[0]}</div>
                                        {heatmapData.days.map((day, i) => {
                                            const dateKey = format(day, 'yyyy-MM-dd');
                                            const key = `${dateKey}_${shift}`;
                                            const data = heatmapData.map[key] || { aa: 0, std: 0, total: 0 };
                                            return (
                                                <div key={i} className="w-8 h-8 rounded border border-gray-100 bg-gray-50 flex flex-col overflow-hidden group relative">
                                                    <div className="flex-1 w-full bg-red-500 transition-all" style={{ opacity: getOpacity(data.aa, heatmapData.maxCount) }}></div>
                                                    <div className="flex-1 w-full bg-green-500 transition-all" style={{ opacity: getOpacity(data.std, heatmapData.maxCount) }}></div>
                                                    {(data.total > 0) && (
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 bg-gray-900 text-white text-[10px] py-1.5 px-3 rounded shadow-lg whitespace-nowrap border border-gray-700 pointer-events-none">
                                                            <div className="font-bold text-center mb-1">{dateKey}</div>
                                                            <div className="flex gap-3"><span className="text-red-300 font-bold">{data.aa} AA</span><span className="text-green-300 font-bold">{data.std} Std</span></div>
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