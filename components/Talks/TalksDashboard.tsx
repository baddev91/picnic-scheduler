
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ShopperRecord } from '../../types';
import { Search, MessageSquare, ArrowLeft, RefreshCw, User, CalendarCheck, CloudDownload, Filter, Layers, X } from 'lucide-react';
import { Button } from '../Button';
import { TalkModal } from './TalkModal';
import { useGoogleSheetSync } from '../../hooks/useGoogleSheetSync';
import { SyncResultModal } from '../SyncResultModal'; // New Import

interface TalksDashboardProps {
  onBack: () => void;
}

interface ShopperItemProps {
  shopper: ShopperRecord;
  onSelect: (s: ShopperRecord) => void;
}

// --- SUB-COMPONENT: Skeleton Row (Loading State) ---
const SkeletonRow = () => (
    <div className="flex items-center gap-4 p-4 border-b border-gray-100 animate-pulse">
        <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0"></div>
        <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-3 bg-gray-100 rounded w-1/4"></div>
        </div>
        <div className="w-16 h-6 bg-gray-100 rounded"></div>
        <div className="w-16 h-6 bg-gray-100 rounded"></div>
    </div>
);

// --- SUB-COMPONENT: Shopper Card (Mobile/Tablet) ---
const ShopperCard: React.FC<ShopperItemProps> = ({ shopper, onSelect }) => {
    const p = shopper.details?.performance || {};
    const tp = shopper.details?.talkProgress || {};
    const logs = shopper.details?.talkLogs || [];
    const lastTalk = logs.length > 0 ? logs[logs.length - 1] : null;

    // Status Indicator Logic
    const hasIssues = (p.late || 0) + (p.absence || 0) + (p.nsnc || 0) > 0;
    
    return (
        <div 
          onClick={() => onSelect(shopper)}
          className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm active:scale-[0.98] transition-all hover:border-blue-300 hover:shadow-md cursor-pointer flex flex-col gap-3"
        >
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white ${hasIssues ? 'bg-red-500' : 'bg-blue-500'}`}>
                        {shopper.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900 leading-tight">{shopper.name}</h4>
                        <span className="text-xs text-gray-500 font-mono">{shopper.details?.pnNumber || 'No PN'}</span>
                    </div>
                </div>
                {tp.checkInToday && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold uppercase rounded-full flex items-center gap-1">
                        <CalendarCheck className="w-3 h-3" /> Checked In
                    </span>
                )}
            </div>

            {/* Stats Mini Bar */}
            <div className="flex gap-2 text-xs border-t pt-3 mt-1">
                <div className="flex-1 bg-gray-50 rounded p-1.5 text-center">
                    <span className="block text-gray-400 text-[9px] uppercase font-bold">Absence</span>
                    <span className={`font-bold ${p.absence ? 'text-red-600' : 'text-gray-700'}`}>{p.absence || 0}</span>
                </div>
                <div className="flex-1 bg-gray-50 rounded p-1.5 text-center">
                    <span className="block text-gray-400 text-[9px] uppercase font-bold">Late</span>
                    <span className={`font-bold ${p.late ? 'text-orange-600' : 'text-gray-700'}`}>{p.late || 0}</span>
                </div>
                <div className="flex-1 bg-gray-50 rounded p-1.5 text-center">
                    <span className="block text-gray-400 text-[9px] uppercase font-bold">Speed</span>
                    <span className="font-bold text-gray-700">{p.speedAM || '-'}</span>
                </div>
            </div>

            {/* Last Talk Footer */}
            <div className="text-xs text-gray-500 flex items-center gap-2">
                <MessageSquare className="w-3 h-3" />
                <span className="truncate">
                    {lastTalk 
                      ? `Last: ${lastTalk.type} by ${lastTalk.leadShopper.split(' ')[0]}` 
                      : 'No talks recorded yet'}
                </span>
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: Table Row (Desktop) ---
const ShopperRow: React.FC<ShopperItemProps> = ({ shopper, onSelect }) => {
    const p = shopper.details?.performance || {};
    const tp = shopper.details?.talkProgress || {};
    
    const getProgressColor = (status: string | undefined) => {
        if (status === 'DONE' || status === 'YES') return 'bg-green-500';
        if (status === 'SKIPPED' || status === 'NO') return 'bg-gray-300';
        if (status === 'HOLD') return 'bg-orange-400';
        return 'bg-gray-100 border border-gray-300';
    };

    return (
        <tr 
          onClick={() => onSelect(shopper)}
          className="hover:bg-blue-50/50 cursor-pointer transition-colors border-b border-gray-100 last:border-0"
        >
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                        {shopper.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <div className="font-bold text-gray-900 text-sm">{shopper.name}</div>
                        <div className="text-xs text-gray-400 font-mono">{shopper.details?.pnNumber}</div>
                    </div>
                </div>
            </td>
            
            {/* Performance Columns */}
            <td className="px-4 py-3 text-center">
                <span className={`text-xs font-bold px-2 py-1 rounded ${p.late ? 'bg-orange-100 text-orange-700' : 'text-gray-400 bg-gray-50'}`}>{p.late || '-'}</span>
            </td>
            <td className="px-4 py-3 text-center">
                <span className={`text-xs font-bold px-2 py-1 rounded ${p.absence ? 'bg-red-100 text-red-700' : 'text-gray-400 bg-gray-50'}`}>{p.absence || '-'}</span>
            </td>
            <td className="px-4 py-3 text-center">
                <span className="text-xs font-mono text-gray-600 font-bold">{p.speedAM || '-'}</span>
            </td>

            {/* Progress Pipeline */}
            <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                    {/* 1. Welcome */}
                    <div className={`w-3 h-3 rounded-full ${getProgressColor(tp.welcomeTalk)}`} title="Welcome Talk"></div>
                    <div className="w-4 h-0.5 bg-gray-200"></div>
                    
                    {/* 2. Mid Term */}
                    <div className={`w-3 h-3 rounded-full ${getProgressColor(tp.midTermEval)}`} title="Mid-Term"></div>
                    <div className="w-4 h-0.5 bg-gray-200"></div>
                    
                    {/* 3. Promo */}
                    <div className={`w-3 h-3 rounded-full ${getProgressColor(tp.promotionDecision)}`} title="Promotion"></div>
                    <div className="w-4 h-0.5 bg-gray-200"></div>
                    
                    {/* 4. End Trial */}
                    <div className={`w-3 h-3 rounded-full ${getProgressColor(tp.endOfTrialTalk)}`} title="End Trial"></div>
                </div>
            </td>

            {/* Check In Status */}
            <td className="px-4 py-3 text-right">
                {tp.checkInToday ? (
                    <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-lg font-bold">Today OK</span>
                ) : (
                    <span className="text-[10px] text-gray-400 font-medium">Pending</span>
                )}
            </td>
        </tr>
    );
};

export const TalksDashboard: React.FC<TalksDashboardProps> = ({ onBack }) => {
  const [shoppers, setShoppers] = useState<ShopperRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShopper, setSelectedShopper] = useState<ShopperRecord | null>(null);
  
  // VIEW MODE: 'SHEET' = Only synced shoppers, 'ALL' = Everyone in DB
  const [viewMode, setViewMode] = useState<'SHEET' | 'ALL'>('SHEET');
  
  // Updated Hook usage
  const { isSyncing, syncShoppers, syncResult, closeSyncModal } = useGoogleSheetSync();

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

  useEffect(() => {
    fetchShoppers();
  }, []);

  const handleUpdateShopper = (updated: ShopperRecord) => {
      setShoppers(prev => prev.map(s => s.id === updated.id ? updated : s));
      setSelectedShopper(updated); 
  };

  const handleSyncClick = () => {
      syncShoppers(shoppers, () => {
          // NOTE: This runs after the sync logic completes inside the hook
          fetchShoppers();
          setViewMode('SHEET'); 
      });
  };

  const handleModalClose = () => {
      closeSyncModal();
      // Double check: Refresh data again when modal closes to ensure UI is up to date
      fetchShoppers();
  };

  const clearFilters = () => {
      setSearchTerm('');
      setViewMode('ALL');
  };

  // FILTER LOGIC
  const filteredShoppers = shoppers.filter(s => {
      // 1. Search Filter
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            s.details?.pnNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      // 2. View Mode Filter
      if (viewMode === 'SHEET') {
          // Ensure we handle potential null details safely
          return s.details?.isOnSheet === true;
      }
      return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 pb-safe">
        
        {/* Loading Bar (Top of Screen) */}
        {(loading || isSyncing) && (
            <div className="fixed top-0 left-0 w-full h-1 z-50 bg-gray-200 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-loading-bar w-full"></div>
            </div>
        )}

        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 md:px-6 py-4 shadow-sm">
            <div className="max-w-7xl mx-auto flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div className="flex items-center gap-3 w-full xl:w-auto">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors md:hidden">
                        <ArrowLeft className="w-5 h-5 text-gray-500" />
                    </button>
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg hidden md:block">
                        <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-900 tracking-tight leading-none">Shopper Talks</h1>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">Manage conversations & performance.</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto items-center">
                    
                    {/* View Toggle */}
                    <div className="bg-gray-100 p-1 rounded-xl flex shrink-0 w-full md:w-auto">
                        <button 
                            onClick={() => setViewMode('SHEET')}
                            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                                viewMode === 'SHEET' 
                                ? 'bg-white text-blue-600 shadow-sm' 
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <CloudDownload className="w-3 h-3" />
                            Active Shoppers
                        </button>
                        <button 
                            onClick={() => setViewMode('ALL')}
                            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                                viewMode === 'ALL' 
                                ? 'bg-white text-gray-900 shadow-sm' 
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Layers className="w-3 h-3" />
                            All Shoppers
                        </button>
                    </div>

                    <div className="relative flex-1 w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Search name or PN..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all shadow-sm"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                    
                    {/* GOOGLE SYNC BUTTON */}
                    <button 
                        onClick={handleSyncClick}
                        disabled={isSyncing}
                        className={`p-2.5 rounded-xl border transition-all shadow-sm flex items-center justify-center gap-2 shrink-0 ${
                            isSyncing 
                            ? 'bg-gray-100 text-gray-400 border-gray-200' 
                            : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                        }`}
                        title="Sync with Google Sheets (Login Required)"
                    >
                        {isSyncing ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                            <CloudDownload className="w-5 h-5" />
                        )}
                        <span className="hidden lg:inline font-bold text-xs">{isSyncing ? 'Syncing...' : 'Sync Sheet'}</span>
                    </button>

                    <button 
                        onClick={fetchShoppers}
                        className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm shrink-0"
                        title="Refresh List"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="hidden xl:block">
                        <Button variant="secondary" onClick={onBack} className="h-full">Exit</Button>
                    </div>
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 overflow-y-auto">
            {loading ? (
                // SKELETON LOADING STATE
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex gap-4">
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                    </div>
                    {[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}
                </div>
            ) : filteredShoppers.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 animate-in fade-in zoom-in-95">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                        {viewMode === 'SHEET' ? <CloudDownload className="w-8 h-8" /> : <User className="w-8 h-8" />}
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">No shoppers found</h3>
                    <p className="text-gray-500 text-sm mt-1 max-w-xs mx-auto">
                        {viewMode === 'SHEET' 
                            ? "Try syncing with the spreadsheet to populate the active list." 
                            : "No records found in the database matching your search."}
                    </p>
                    <div className="flex justify-center gap-3 mt-4">
                        {viewMode === 'SHEET' && (
                            <button 
                                onClick={handleSyncClick}
                                className="text-blue-600 font-bold text-sm hover:underline flex items-center gap-1"
                            >
                                Sync Now <ArrowLeft className="w-3 h-3 rotate-180" />
                            </button>
                        )}
                        <button 
                            onClick={clearFilters}
                            className="text-gray-500 font-bold text-sm hover:text-gray-700 flex items-center gap-1 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-all"
                        >
                            Reset Filters
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="mb-4 text-xs font-bold text-gray-400 uppercase tracking-wider flex justify-between items-center px-2">
                        <span>Showing {filteredShoppers.length} Records ({viewMode === 'SHEET' ? 'Active Shoppers' : 'All Shoppers'})</span>
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3">Identity</th>
                                    <th className="px-4 py-3 text-center">Late</th>
                                    <th className="px-4 py-3 text-center">Absence</th>
                                    <th className="px-4 py-3 text-center">Speed (AM)</th>
                                    <th className="px-4 py-3">Talk Pipeline</th>
                                    <th className="px-4 py-3 text-right">Today</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredShoppers.map(shopper => (
                                    <ShopperRow key={shopper.id} shopper={shopper} onSelect={setSelectedShopper} />
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Grid View */}
                    <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in">
                        {filteredShoppers.map(shopper => (
                            <ShopperCard key={shopper.id} shopper={shopper} onSelect={setSelectedShopper} />
                        ))}
                    </div>
                </>
            )}
        </div>

        {/* Detail Modal */}
        {selectedShopper && (
            <TalkModal 
                shopper={selectedShopper} 
                onClose={() => setSelectedShopper(null)}
                onUpdate={handleUpdateShopper}
            />
        )}

        {/* New Sync Result Modal */}
        <SyncResultModal 
            result={syncResult}
            onClose={handleModalClose}
        />
        
        {/* Custom Animation Style */}
        <style>{`
            @keyframes loading-bar {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
            .animate-loading-bar {
                animation: loading-bar 1.5s infinite linear;
            }
        `}</style>
    </div>
  );
};
