
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ShopperRecord } from '../../types';
import { Search, MessageSquare, ArrowLeft, RefreshCw, User, CalendarCheck, CloudDownload } from 'lucide-react';
import { Button } from '../Button';
import { TalkModal } from './TalkModal';
import { useGoogleSheetSync } from '../../hooks/useGoogleSheetSync';

interface TalksDashboardProps {
  onBack: () => void;
}

interface ShopperItemProps {
  shopper: ShopperRecord;
  onSelect: (s: ShopperRecord) => void;
}

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
        return 'bg-gray-100 border border-gray-300'; // TODO
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
  
  // Use the rewritten hook
  const { isSyncing, syncShoppers } = useGoogleSheetSync();

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
          fetchShoppers();
      });
  };

  const filteredShoppers = shoppers.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.details?.pnNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 pb-safe">
        
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 md:px-6 py-4 shadow-sm">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
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

                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Search name or PN..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all shadow-sm"
                        />
                    </div>
                    
                    {/* GOOGLE SYNC BUTTON */}
                    <button 
                        onClick={handleSyncClick}
                        disabled={isSyncing}
                        className={`p-2.5 rounded-xl border transition-all shadow-sm flex items-center justify-center gap-2 ${
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
                        <span className="hidden lg:inline font-bold text-xs">{isSyncing ? 'Logging in...' : 'Sync Sheet'}</span>
                    </button>

                    <button 
                        onClick={fetchShoppers}
                        className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm"
                        title="Refresh List"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="hidden md:block">
                        <Button variant="secondary" onClick={onBack} className="h-full">Exit</Button>
                    </div>
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 overflow-y-auto">
            {loading ? (
                <div className="text-center py-20 text-gray-400 flex flex-col items-center">
                    <RefreshCw className="w-8 h-8 animate-spin mb-3 text-blue-500" />
                    <p className="text-sm font-medium">Loading shoppers...</p>
                </div>
            ) : filteredShoppers.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                    <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No shoppers found.</p>
                </div>
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
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
                    <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
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
    </div>
  );
};
