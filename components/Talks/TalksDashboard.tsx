
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { ShopperRecord } from '../../types';
import { Search, MessageSquare, ArrowLeft, RefreshCw, User, CalendarCheck, CloudDownload, Filter, Layers, X, Settings2, Check, Users } from 'lucide-react';
import { Button } from '../Button';
import { TalkModal } from './TalkModal';
import { useGoogleSheetSync } from '../../hooks/useGoogleSheetSync';
import { SyncResultModal } from '../SyncResultModal';

interface TalksDashboardProps {
  onBack: () => void;
}

interface ShopperItemProps {
  shopper: ShopperRecord;
  onSelect: (s: ShopperRecord) => void;
  visibleColumns: string[];
}

// --- COLUMN DEFINITIONS ---
const AVAILABLE_COLUMNS = [
    { id: 'LATE', label: 'Late', group: 'Attendance' },
    { id: 'ABSENCE', label: 'Absence', group: 'Attendance' },
    { id: 'ABSENCE_AA', label: 'Abs. AA', group: 'Attendance' },
    { id: 'NSNC', label: 'NSNC', group: 'Attendance' },
    { id: 'NSWC', label: 'NSWC', group: 'Attendance' },
    { id: 'OW', label: 'Warnings', group: 'Discipline' },
    { id: 'BEHAVIOR', label: 'Behavior', group: 'Discipline' },
    { id: 'SPEED_AM', label: 'Speed AM', group: 'Performance' },
    { id: 'SPEED_CH', label: 'Speed CH', group: 'Performance' },
    { id: 'PICKING_SCORE', label: 'Pick %', group: 'Performance' },
    { id: 'REPS', label: 'Reps', group: 'Performance' },
    { id: 'MODULES', label: 'Modules', group: 'Performance' },
    { id: 'PIPELINE', label: 'Pipeline', group: 'Onboarding' },
    { id: 'TODAY', label: 'Checked In', group: 'Onboarding' },
];

const DEFAULT_COLUMNS = ['LATE', 'ABSENCE', 'SPEED_AM', 'PIPELINE', 'TODAY'];

// --- SUB-COMPONENT: Skeleton Row ---
const SkeletonRow = () => (
    <div className="flex items-center gap-4 p-4 border-b border-gray-100 animate-pulse">
        <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0"></div>
        <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-3 bg-gray-100 rounded w-1/4"></div>
        </div>
        <div className="w-16 h-6 bg-gray-100 rounded"></div>
    </div>
);

// --- SUB-COMPONENT: Table Row (Desktop) ---
const ShopperRow: React.FC<ShopperItemProps> = ({ shopper, onSelect, visibleColumns }) => {
    const p = shopper.details?.performance || {};
    const tp = shopper.details?.talkProgress || {};
    
    const getProgressColor = (status: string | undefined) => {
        if (status === 'DONE' || status === 'YES') return 'bg-green-500';
        if (status === 'SKIPPED' || status === 'NO') return 'bg-gray-300';
        if (status === 'HOLD') return 'bg-orange-400';
        return 'bg-gray-100 border border-gray-300';
    };

    const renderCell = (colId: string) => {
        switch (colId) {
            case 'LATE': return <span className={`font-bold px-2 py-1 rounded ${p.late ? 'bg-orange-100 text-orange-700' : 'text-gray-400'}`}>{p.late ?? '-'}</span>;
            case 'ABSENCE': return <span className={`font-bold px-2 py-1 rounded ${p.absence ? 'bg-red-100 text-red-700' : 'text-gray-400'}`}>{p.absence ?? '-'}</span>;
            case 'ABSENCE_AA': return <span className={`font-bold px-2 py-1 rounded ${p.absenceAA ? 'bg-red-50 text-red-600' : 'text-gray-400'}`}>{p.absenceAA ?? '-'}</span>;
            case 'NSNC': return <span className={`font-bold px-2 py-1 rounded ${p.nsnc ? 'bg-red-200 text-red-900' : 'text-gray-400'}`}>{p.nsnc ?? '-'}</span>;
            case 'NSWC': return <span className={`font-bold px-2 py-1 rounded ${p.nswc ? 'bg-orange-50 text-orange-600' : 'text-gray-400'}`}>{p.nswc ?? '-'}</span>;
            case 'OW': return <span className={`font-bold px-2 py-1 rounded ${p.officialWarnings ? 'bg-purple-100 text-purple-700' : 'text-gray-400'}`}>{p.officialWarnings ?? '-'}</span>;
            case 'BEHAVIOR': return <span className={`font-bold ${p.behaviorScore !== undefined ? 'text-blue-600' : 'text-gray-400'}`}>{p.behaviorScore ?? '-'}</span>;
            
            // Performance Columns
            case 'SPEED_AM': return <span className="font-mono text-gray-700 font-bold">{p.speedAM ?? '-'}</span>;
            case 'SPEED_CH': return <span className="font-mono text-gray-700 font-bold">{p.speedCH ?? '-'}</span>;
            case 'PICKING_SCORE': return <span className="font-bold text-gray-700">{p.pickingScore !== undefined ? `${p.pickingScore}%` : '-'}</span>;
            case 'REPS': return <span className="font-bold text-gray-600">{p.reps ?? '-'}</span>;
            case 'MODULES': return <span className="text-[10px] text-gray-500 font-medium truncate max-w-[120px] block mx-auto" title={p.modules}>{p.modules || '-'}</span>;

            case 'PIPELINE': return (
                <div className="flex items-center gap-1 justify-center">
                    <div className={`w-2.5 h-2.5 rounded-full ${getProgressColor(tp.welcomeTalk)}`} title="Welcome"></div>
                    <div className={`w-2.5 h-2.5 rounded-full ${getProgressColor(tp.midTermEval)}`} title="Mid-Term"></div>
                    <div className={`w-2.5 h-2.5 rounded-full ${getProgressColor(tp.promotionDecision)}`} title="Promotion"></div>
                    <div className={`w-2.5 h-2.5 rounded-full ${getProgressColor(tp.endOfTrialTalk)}`} title="End Trial"></div>
                </div>
            );
            case 'TODAY': return (
                tp.checkInToday ? (
                    <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-black">OK</span>
                ) : <span className="text-[10px] text-gray-300 font-medium">PENDING</span>
            );
            default: return null;
        }
    };

    return (
        <tr 
          onClick={() => onSelect(shopper)}
          className="hover:bg-blue-50/50 cursor-pointer transition-colors border-b border-gray-100 last:border-0"
        >
            <td className="px-4 py-3 sticky left-0 bg-white group-hover:bg-blue-50/50 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                        {shopper.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <div className="font-bold text-gray-900 text-sm truncate">{shopper.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{shopper.details?.pnNumber}</div>
                    </div>
                </div>
            </td>
            
            {visibleColumns.map(colId => (
                <td key={colId} className="px-4 py-3 text-center text-sm">
                    {renderCell(colId)}
                </td>
            ))}
        </tr>
    );
};

export const TalksDashboard: React.FC<TalksDashboardProps> = ({ onBack }) => {
  const [shoppers, setShoppers] = useState<ShopperRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShopper, setSelectedShopper] = useState<ShopperRecord | null>(null);
  const [viewMode, setViewMode] = useState<'SHEET' | 'ALL'>('SHEET');
  const [showColSettings, setShowColSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  
  // Columns State - Persisted in LocalStorage
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
      const saved = localStorage.getItem('onboarding_visible_columns');
      return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
  });

  const { isSyncing, syncShoppers, syncResult, closeSyncModal } = useGoogleSheetSync();

  useEffect(() => {
      localStorage.setItem('onboarding_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
              setShowColSettings(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchShoppers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('shoppers')
      .select('*, shifts(*)')
      .order('name', { ascending: true });

    if (error) console.error(error);
    else setShoppers(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchShoppers(); }, []);

  // --- ADDED: handleUpdateShopper logic to fix missing name error ---
  const handleUpdateShopper = (updated: ShopperRecord) => {
    setShoppers(prev => prev.map(s => s.id === updated.id ? updated : s));
    // CRITICAL: Update the selected shopper state as well so the Modal re-renders with fresh data
    if (selectedShopper && selectedShopper.id === updated.id) {
        setSelectedShopper(updated);
    }
  };

  const handleSyncClick = () => {
      syncShoppers(shoppers, () => {
          fetchShoppers();
          setViewMode('SHEET'); 
      });
  };

  const toggleColumn = (colId: string) => {
      setVisibleColumns(prev => 
          prev.includes(colId) 
          ? prev.filter(id => id !== colId) 
          : [...prev, colId]
      );
  };

  const filteredShoppers = shoppers.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            s.details?.pnNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      return viewMode === 'SHEET' ? s.details?.isOnSheet === true : true;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 pb-safe">
        
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 md:px-6 py-4 shadow-sm">
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors lg:hidden"><ArrowLeft className="w-5 h-5 text-gray-500" /></button>
                    <div className="p-2 bg-indigo-600 text-white rounded-lg hidden md:block shadow-md"><Users className="w-6 h-6" /></div>
                    <div>
                        <h1 className="text-xl font-black text-gray-900 tracking-tight leading-none">Shopper Onboarding</h1>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">Track Progress & Performance</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-3 w-full lg:w-auto items-center">
                    <div className="bg-gray-100 p-1 rounded-xl flex shrink-0 w-full md:w-auto">
                        <button onClick={() => setViewMode('SHEET')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'SHEET' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Sheet</button>
                        <button onClick={() => setViewMode('ALL')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'ALL' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>All</button>
                    </div>

                    <div className="relative flex-1 w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" placeholder="Filter shoppers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all" />
                    </div>
                    
                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative" ref={settingsRef}>
                            <button 
                                onClick={() => setShowColSettings(!showColSettings)}
                                className={`p-2.5 rounded-xl border transition-all shadow-sm flex items-center justify-center gap-2 ${showColSettings ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                            >
                                <Settings2 className="w-5 h-5" />
                            </button>
                            {showColSettings && (
                                <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 p-4 animate-in slide-in-from-top-2">
                                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-4 border-b pb-2">Toggle Columns</h4>
                                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        {['Attendance', 'Discipline', 'Performance', 'Onboarding'].map(group => (
                                            <div key={group} className="space-y-1.5">
                                                <div className="text-[9px] font-bold text-blue-600/60 uppercase">{group}</div>
                                                {AVAILABLE_COLUMNS.filter(c => c.group === group).map(col => (
                                                    <button
                                                        key={col.id}
                                                        onClick={() => toggleColumn(col.id)}
                                                        className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                                                    >
                                                        <span className={`text-xs font-bold ${visibleColumns.includes(col.id) ? 'text-gray-900' : 'text-gray-400'}`}>{col.label}</span>
                                                        {visibleColumns.includes(col.id) && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                                    </button>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 pt-3 border-t">
                                        <button 
                                            onClick={() => setVisibleColumns(DEFAULT_COLUMNS)}
                                            className="text-[10px] font-bold text-blue-600 hover:underline"
                                        >
                                            Reset to Default
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button onClick={handleSyncClick} disabled={isSyncing} className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl border transition-all shadow-sm flex items-center justify-center gap-2 ${isSyncing ? 'bg-gray-100 text-gray-400' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}>
                            {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                            <span className="font-bold text-xs">Sync</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 overflow-hidden">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden animate-in fade-in">
                <div className="overflow-x-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left table-fixed min-w-[800px]">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-20">
                            <tr>
                                <th className="px-4 py-4 w-64 text-xs font-bold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">Identity</th>
                                {visibleColumns.map(colId => (
                                    <th key={colId} className="px-4 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        {AVAILABLE_COLUMNS.find(c => c.id === colId)?.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? [1,2,3,4,5,6,7,8].map(i => <tr key={i}><td colSpan={visibleColumns.length + 1}><SkeletonRow /></td></tr>) : 
                             filteredShoppers.map(shopper => (
                                <ShopperRow 
                                    key={shopper.id} 
                                    shopper={shopper} 
                                    onSelect={setSelectedShopper} 
                                    visibleColumns={visibleColumns}
                                />
                             ))}
                        </tbody>
                    </table>
                    {!loading && filteredShoppers.length === 0 && (
                        <div className="py-20 text-center text-gray-400 italic">No shoppers found matching your filters.</div>
                    )}
                </div>
            </div>
        </div>

        {selectedShopper && (
            <TalkModal 
                shopper={selectedShopper} 
                onClose={() => setSelectedShopper(null)}
                onUpdate={handleUpdateShopper}
            />
        )}

        <SyncResultModal result={syncResult} onClose={closeSyncModal} />
        
        <style>{`
            .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #D1D5DB; }
        `}</style>
    </div>
  );
};
