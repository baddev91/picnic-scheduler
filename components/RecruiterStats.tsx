
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { StaffMember } from '../types';
import { Users, TrendingUp, Award, CalendarCheck, Loader2, Filter, UserCheck, Briefcase, Settings2, Clock, Zap } from 'lucide-react';
import { endOfWeek, format, isSameWeek } from 'date-fns';
import startOfWeek from 'date-fns/startOfWeek';
import parseISO from 'date-fns/parseISO';
import { PerformanceVisibilityModal } from './PerformanceVisibilityModal';

interface RecruiterStatsProps {
  staffList: StaffMember[];
  isSuperAdmin?: boolean;
  onSaveVisibility?: (updatedStaffList: StaffMember[]) => void;
}

interface RecruiterMetric {
  name: string;
  hires: number; // Submissions
  shiftsFilled: number; // Impact
  lastActive: string | null;
  activeSessions: number; // Number of distinct days with hires
  avgHiresPerSession: number; // Average hires per session (per day)
  avgSessionDuration: number; // Average session duration in hours
  efficiencyScore: number; // Hires per hour (C-Score)
}

interface RawShopperData {
    created_at: string;
    details: {
        recruiter?: string;
    };
    shifts: { id: string }[];
}

export const RecruiterStats: React.FC<RecruiterStatsProps> = ({ staffList, isSuperAdmin = false, onSaveVisibility }) => {
  const [loading, setLoading] = useState(true);
  const [rawShoppers, setRawShoppers] = useState<RawShopperData[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('ALL'); // 'ALL' or 'YYYY-MM-DD' (start of week)
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [sessionEndTimes, setSessionEndTimes] = useState<Record<string, string>>({});
  const [sessionStartTimes, setSessionStartTimes] = useState<Record<string, string>>({});

  // 1. Fetch Data Once
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch shoppers
      const { data: shoppers, error } = await supabase
        .from('shoppers')
        .select('created_at, details, shifts(id)')
        .order('created_at', { ascending: false });

      if (!error && shoppers) {
          setRawShoppers(shoppers);
      }

      // Fetch session end times
      const { data: endTimesData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('id', 'session_end_times')
        .maybeSingle();

      if (endTimesData?.value) {
        setSessionEndTimes(endTimesData.value);
      }

      // Fetch session start times
      const { data: startTimesData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('id', 'session_start_times')
        .maybeSingle();

      if (startTimesData?.value) {
        setSessionStartTimes(startTimesData.value);
      } else {
        // Initialize with empty object if not found
        setSessionStartTimes({});
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  // Helper function to calculate session duration in hours
  const calculateSessionDuration = (sessionType: 'MORNING' | 'AFTERNOON', endTime: string, customStartTime?: string): number => {
      // Use custom start time if provided, otherwise use defaults
      let startHour: number;
      let startMinute: number = 0;

      if (customStartTime) {
        // Parse custom start time (format: "HH:MM")
        [startHour, startMinute] = customStartTime.split(':').map(Number);
      } else {
        // Default start times: Morning = 09:00, Afternoon = 14:00
        startHour = sessionType === 'MORNING' ? 9 : 14;
        startMinute = 0;
      }

      // Parse end time (format: "HH:MM")
      const [endHour, endMinute] = endTime.split(':').map(Number);

      // Calculate duration in hours
      const duration = (endHour + endMinute / 60) - (startHour + startMinute / 60);

      return duration > 0 ? duration : 0;
  };

  // 2. Compute Available Weeks for Dropdown
  const availableWeeks = useMemo(() => {
      const weeks = new Set<string>();
      rawShoppers.forEach(s => {
          if (!s.created_at) return;
          const start = startOfWeek(parseISO(s.created_at), { weekStartsOn: 1 });
          weeks.add(format(start, 'yyyy-MM-dd'));
      });
      return Array.from(weeks).sort().reverse(); // Newest first
  }, [rawShoppers]);

  // Helper to determine session key based on 12:30 cutoff (Submission Time)
  const getSessionGroupKey = (createdAt: string) => {
      const date = new Date(createdAt);
      const dateStr = format(date, 'yyyy-MM-dd');

      // Calculate minutes from midnight
      const minutes = date.getHours() * 60 + date.getMinutes();
      // 12:30 PM = 12 * 60 + 30 = 750 minutes
      const suffix = minutes < 750 ? '0_MORNING' : '1_AFTERNOON';

      return `${dateStr}_${suffix}`;
  };

  // 3. Filter & Aggregate Data based on Selection
  const stats = useMemo(() => {
      // Initialize map with current staff that are VISIBLE (so they appear even with 0 stats)
      const map: Record<string, RecruiterMetric> = {};
      const dayMaps: Record<string, Set<string>> = {}; // Track distinct days per recruiter for session counting
      const hiresWithEndTime: Record<string, number> = {}; // Track hires that have session end times

      staffList.forEach(member => {
          // Only include staff members that should be visible in performance section
          const isVisible = member.isVisibleInPerformance !== false; // Default to true if not set
          if (isVisible) {
              map[member.name] = {
                  name: member.name,
                  hires: 0,
                  shiftsFilled: 0,
                  lastActive: null,
                  activeSessions: 0,
                  avgHiresPerSession: 0,
                  avgSessionDuration: 0,
                  efficiencyScore: 0
              };
              dayMaps[member.name] = new Set<string>();
              hiresWithEndTime[member.name] = 0;
          }
      });

      // Filter Data - but we'll still track all weeks for avg calculation
      const filteredShoppers = rawShoppers.filter(s => {
          if (selectedWeek === 'ALL') return true;
          if (!s.created_at) return false;
          const sDate = parseISO(s.created_at);
          const filterDate = parseISO(selectedWeek);
          return isSameWeek(sDate, filterDate, { weekStartsOn: 1 });
      });

      // Aggregate
      filteredShoppers.forEach(s => {
          const rawName = s.details?.recruiter;
          if (!rawName) return;

          // Normalize name match
          let matchKey = Object.keys(map).find(k => k.toLowerCase() === rawName.trim().toLowerCase());
          
          if (!matchKey) {
              // If recruiter not in staff list, only add if visible in settings
              // Since they're not in staff list, we'll check if there's a matching visible member
              const visibleMember = staffList.find(m => m.name.toLowerCase() === rawName.trim().toLowerCase() && m.isVisibleInPerformance !== false);
              if (visibleMember) {
                  matchKey = visibleMember.name;
              } else {
                  // Don't add recruiters not in staff list or not marked as visible
                  return;
              }
          }

          const entry = map[matchKey];
          if (!entry) return; // Skip if not visible

          entry.hires += 1;
          entry.shiftsFilled += s.shifts?.length || 0;

          // Update last active (only if it's the most recent seen in this filter context)
          if (!entry.lastActive || new Date(s.created_at) > new Date(entry.lastActive)) {
              entry.lastActive = s.created_at;
          }

          // Track day for session count (each distinct day = 1 session, even if multiple times that day)
          if (s.created_at) {
              const dayKey = format(parseISO(s.created_at), 'yyyy-MM-dd');
              dayMaps[matchKey].add(dayKey);

              // Check if this hire has a session end time (for C-Score calculation)
              const sessionKey = getSessionGroupKey(s.created_at);
              if (sessionEndTimes[sessionKey]) {
                  hiresWithEndTime[matchKey] = (hiresWithEndTime[matchKey] || 0) + 1;
              }
          }
      });

      // Calculate activeSessions, avgHiresPerSession, avgSessionDuration, and efficiencyScore
      Object.keys(map).forEach(key => {
          const entry = map[key];
          const activeSessions = dayMaps[key].size || 1; // Each distinct day is a session
          entry.activeSessions = activeSessions;
          entry.avgHiresPerSession = activeSessions > 0 ? entry.hires / activeSessions : 0;

          // Calculate average session duration from session end times
          const sessionDurations: number[] = [];
          dayMaps[key].forEach(dayKey => {
              // Check both morning and afternoon sessions for this day
              const morningKey = `${dayKey}_0_MORNING`;
              const afternoonKey = `${dayKey}_1_AFTERNOON`;

              if (sessionEndTimes[morningKey]) {
                  const endTime = sessionEndTimes[morningKey];
                  const startTime = sessionStartTimes?.[morningKey];
                  const duration = calculateSessionDuration('MORNING', endTime, startTime);
                  if (duration > 0) sessionDurations.push(duration);
              }

              if (sessionEndTimes[afternoonKey]) {
                  const endTime = sessionEndTimes[afternoonKey];
                  const startTime = sessionStartTimes?.[afternoonKey];
                  const duration = calculateSessionDuration('AFTERNOON', endTime, startTime);
                  if (duration > 0) sessionDurations.push(duration);
              }
          });

          // Calculate average duration
          if (sessionDurations.length > 0) {
              const totalDuration = sessionDurations.reduce((sum, d) => sum + d, 0);
              entry.avgSessionDuration = totalDuration / sessionDurations.length;

              // Calculate efficiency score (hires per hour) - ONLY for sessions with end times
              const totalHours = totalDuration * sessionDurations.length;
              const hiresForCScore = hiresWithEndTime[key] || 0;
              entry.efficiencyScore = totalHours > 0 ? hiresForCScore / totalHours : 0;
          }
      });

      // Convert to array and sort by efficiency score (C-Score)
      return Object.values(map)
        .filter(item => item.hires > 0 || staffList.some(s => s.name === item.name && s.isVisibleInPerformance !== false))
        .sort((a, b) => b.efficiencyScore - a.efficiencyScore); // Sort by Efficiency Score Descending

  }, [rawShoppers, staffList, selectedWeek, sessionEndTimes, sessionStartTimes]);

  // 4. Calculate Total Hires for current view
  const totalHires = useMemo(() => {
      return stats.reduce((sum, recruiter) => sum + recruiter.hires, 0);
  }, [stats]);

  if (loading) return (
      <div className="flex items-center justify-center p-8 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
  );

  const maxHires = Math.max(...stats.map(s => s.hires), 1);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* HEADER */}
        <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-gray-50/50">
            {/* Title Section */}
            <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg shrink-0">
                    <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Performance</h3>
                    <p className="text-xs text-gray-500">Recruitment velocity & impact</p>
                </div>
            </div>
            
            {/* Controls & Stats Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 w-full xl:w-auto">
                
                {/* METRICS BADGES */}
                <div className="flex items-center gap-2 w-full md:w-auto">
                    {/* Active Recruiters Badge */}
                    <div className="flex-1 md:flex-none flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg shadow-sm text-gray-600">
                        <UserCheck className="w-3.5 h-3.5 text-gray-400" />
                        <div className="flex flex-col leading-none">
                            <span className="text-[9px] font-bold uppercase text-gray-400">Team</span>
                            <span className="text-sm font-bold text-gray-800">{stats.filter(s => s.hires > 0).length} <span className="text-[10px] font-normal text-gray-400">Active</span></span>
                        </div>
                    </div>

                    {/* TOTAL HIRES BADGE - VISUALLY PROMINENT */}
                    <div className="flex-1 md:flex-none flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg shadow-sm text-emerald-800">
                        <div className="bg-emerald-500 text-white p-1 rounded-full">
                            <Briefcase className="w-3 h-3" />
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className="text-[9px] font-bold uppercase text-emerald-600">Total Hires</span>
                            <span className="text-sm font-black text-emerald-900">{totalHires}</span>
                        </div>
                    </div>
                </div>

                {/* Filter Dropdown */}
                <div className="flex items-center gap-2 w-full md:w-auto bg-white p-1 rounded-lg border shadow-sm h-[42px]">
                    <Filter className="w-4 h-4 text-gray-400 ml-2 shrink-0" />
                    <select 
                        value={selectedWeek}
                        onChange={(e) => setSelectedWeek(e.target.value)}
                        className="bg-transparent text-xs font-bold text-gray-700 outline-none py-1.5 pr-2 cursor-pointer w-full md:w-48 h-full"
                    >
                        <option value="ALL">All Time</option>
                        {availableWeeks.map(dateStr => {
                            const start = parseISO(dateStr);
                            const end = endOfWeek(start, { weekStartsOn: 1 });
                            const label = `Week of ${format(start, 'MMM d')}`;
                            const isCurrent = isSameWeek(new Date(), start, { weekStartsOn: 1 });
                            return (
                                <option key={dateStr} value={dateStr}>
                                    {isCurrent ? 'Current Week' : label} ({format(start, 'd')} - {format(end, 'd MMM')})
                                </option>
                            );
                        })}
                    </select>
                </div>

                {/* Settings Button - Super Admin Only */}
                {isSuperAdmin && (
                    <button
                        onClick={() => setShowVisibilityModal(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-lg border border-purple-200 shadow-sm transition-all hover:shadow-md text-xs"
                    >
                        <Settings2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Settings</span>
                    </button>
                )}
            </div>
        </div>

        {/* LIST */}
        <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stats.map((recruiter, index) => {
                    const isTop = index === 0 && recruiter.hires > 0;
                    const percentage = maxHires > 0 ? (recruiter.hires / maxHires) * 100 : 0;
                    
                    return (
                        <div key={recruiter.name} className={`relative flex flex-col p-4 rounded-xl border transition-all hover:shadow-md ${isTop ? 'bg-gradient-to-br from-yellow-50 to-white border-yellow-200 ring-1 ring-yellow-100' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                            {isTop && (
                                <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                                    <Award className="w-3 h-3" /> #1
                                </div>
                            )}
                            
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${isTop ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {recruiter.name.substring(0,2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-sm">{recruiter.name}</h4>
                                        <span className="text-[10px] text-gray-400 font-medium block">
                                            {recruiter.lastActive ? `Last submission: ${format(parseISO(recruiter.lastActive), 'MMM d')}` : 'No activity in period'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {/* Hires Bar */}
                                <div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="font-bold text-gray-500 flex items-center gap-1"><Users className="w-3 h-3" /> Hires</span>
                                        <span className="font-black text-gray-900">{recruiter.hires}</span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-1000 ${isTop ? 'bg-yellow-400' : 'bg-purple-600'}`} 
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Detailed Stats Row */}
                                <div className="flex items-center gap-2 pt-2 border-t border-gray-50 flex-wrap">
                                    <div className="flex-1 min-w-[120px] bg-gray-50 rounded px-2 py-1.5 flex items-center justify-between">
                                        <span className="text-[9px] font-bold text-gray-400 uppercase">Impact</span>
                                        <div className="flex items-center gap-1 text-xs font-bold text-gray-700">
                                            <CalendarCheck className="w-3 h-3 text-green-500" />
                                            {recruiter.shiftsFilled} <span className="text-[9px] font-normal text-gray-400">shifts</span>
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-[120px] bg-blue-50 rounded px-2 py-1.5 flex items-center justify-between">
                                        <span className="text-[9px] font-bold text-blue-400 uppercase">Avg/Day</span>
                                        <div className="flex items-center gap-1 text-xs font-bold text-blue-700">
                                            <Users className="w-3 h-3 text-blue-500" />
                                            {recruiter.avgHiresPerSession.toFixed(1)} <span className="text-[9px] font-normal text-blue-400">hires</span>
                                        </div>
                                    </div>

                                    {/* Average Session Duration */}
                                    {recruiter.avgSessionDuration > 0 && (
                                        <div className="flex-1 min-w-[120px] bg-orange-50 rounded px-2 py-1.5 flex items-center justify-between">
                                            <span className="text-[9px] font-bold text-orange-400 uppercase">Avg Time</span>
                                            <div className="flex items-center gap-1 text-xs font-bold text-orange-700">
                                                <Clock className="w-3 h-3 text-orange-500" />
                                                {recruiter.avgSessionDuration.toFixed(1)} <span className="text-[9px] font-normal text-orange-400">hrs</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Efficiency Score (C-Score) */}
                                    {recruiter.efficiencyScore > 0 && (
                                        <div className="flex-1 min-w-[120px] bg-purple-50 rounded px-2 py-1.5 flex items-center justify-between">
                                            <span className="text-[9px] font-bold text-purple-400 uppercase">C-Score</span>
                                            <div className="flex items-center gap-1 text-xs font-bold text-purple-700">
                                                <Zap className="w-3 h-3 text-purple-500" />
                                                {recruiter.efficiencyScore.toFixed(2)} <span className="text-[9px] font-normal text-purple-400">h/hr</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {stats.length === 0 && (
                    <div className="col-span-full py-10 text-center text-gray-400 italic">
                        No recruitment data found for this period.
                    </div>
                )}
            </div>
        </div>

        {/* Visibility Modal */}
        <PerformanceVisibilityModal
            isOpen={showVisibilityModal}
            onClose={() => setShowVisibilityModal(false)}
            staffList={staffList}
            onSave={(updatedStaffList) => {
                onSaveVisibility?.(updatedStaffList);
            }}
        />
    </div>
  );
};
