import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { format, eachDayOfInterval, addDays } from 'date-fns';
import parseISO from 'date-fns/parseISO';
import startOfDay from 'date-fns/startOfDay';
import { ShiftType, ShopperRecord } from '../types';
import { SHIFT_TIMES } from '../constants';

interface AdminHeatmapProps {
  data: ShopperRecord[];
}

export const AdminHeatmap: React.FC<AdminHeatmapProps> = ({ data }) => {
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

    const days = eachDayOfInterval({ start: startDate, end: endDate });
    return { map, maxCount, days };
  }, [data]);

  const getOpacity = (count: number, max: number) => {
    if (count === 0) return 0;
    const safeMax = max === 0 ? 1 : max;
    return Math.min(1, (count / safeMax) + 0.3);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2"><Activity className="w-4 h-4 text-green-600" /> Density Map</h3>
            <div className="flex items-center gap-3 text-xs text-gray-400">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div><span>AA Shift</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-sm"></div><span>Standard Shift</span></div>
                <span className="ml-2 text-[10px] text-gray-300">Darker = More People</span>
            </div>
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
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 bg-gray-900 text-white text-[10px] py-1.5 px-3 rounded shadow-lg whitespace-nowrap border border-gray-700">
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
  );
};