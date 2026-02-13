
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { ShopperRecord } from '../types';
import { Snowflake, RefreshCw, LogOut, Search, Save, CheckCircle, CheckSquare, Square, Info, ArrowLeft, Check, X, Calendar, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';

interface FrozenListProps {
  onLogout: () => void;
  isSuperAdmin?: boolean;
}

export const FrozenList: React.FC<FrozenListProps> = ({ onLogout, isSuperAdmin = false }) => {
  const [shoppers, setShoppers] = useState<ShopperRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  
  // Confirmation State
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  // Help Popover State
  const [activeHelpId, setActiveHelpId] = useState<string | null>(null);

  const fetchFrozenShoppers = async () => {
    setLoading(true);
    // Fetch shoppers where details->isFrozenEligible is true
    const { data, error } = await supabase
      .from('shoppers')
      .select('*, shifts(*)')
      .eq('details->>isFrozenEligible', 'true')
      .order('created_at', { ascending: false });

    if (error) {
      alert("Error fetching frozen list");
      console.error(error);
    } else {
      setShoppers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFrozenShoppers();
  }, []);

  const initiateToggle = (id: string) => {
      setPendingToggleId(id);
  };

  const cancelToggle = () => {
      setPendingToggleId(null);
  };

  const confirmToggle = async (shopper: ShopperRecord) => {
    setPendingToggleId(null);
    const newVal = !shopper.details?.frozenAddedToSystem;
    const newDetails = { ...shopper.details, frozenAddedToSystem: newVal };
    
    // Optimistic Update
    setShoppers(prev => prev.map(s => s.id === shopper.id ? { ...s, details: newDetails } : s));

    const { error } = await supabase
        .from('shoppers')
        .update({ details: newDetails })
        .eq('id', shopper.id);
    
    if (error) {
        alert("Update failed");
        fetchFrozenShoppers(); // Revert
    }
  };

  const startEditingNote = (shopper: ShopperRecord) => {
      setEditingNoteId(shopper.id);
      setNoteText(shopper.details?.frozenNotes || '');
  };

  const saveNote = async (id: string) => {
      const shopper = shoppers.find(s => s.id === id);
      if (!shopper) return;

      const newDetails = { ...shopper.details, frozenNotes: noteText };
      
      const { error } = await supabase
          .from('shoppers')
          .update({ details: newDetails })
          .eq('id', id);

      if (error) {
          alert("Failed to save note");
      } else {
          setShoppers(prev => prev.map(s => s.id === id ? { ...s, details: newDetails } : s));
          setEditingNoteId(null);
      }
  };

  const filteredShoppers = shoppers.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="min-h-screen bg-cyan-50 font-sans text-gray-900">
        
        {/* Header */}
        <div className="bg-white border-b border-cyan-100 sticky top-0 z-20 shadow-sm px-4 md:px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
                <img
                  src="/staffya-logo.jpg"
                  alt="Staffya Logo"
                  className="w-12 h-12 rounded-lg shadow-sm object-cover shrink-0"
                />
                <div>
                    <h1 className="text-xl font-black text-cyan-900 tracking-tight leading-none">FROZEN <span className="text-cyan-600/60 font-medium">DEPT</span></h1>
                    <p className="text-xs text-cyan-600 font-bold">Eligible Candidates List</p>
                </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto justify-end">
                <button onClick={fetchFrozenShoppers} className="p-2 hover:bg-cyan-50 rounded-lg text-cyan-600 transition-colors border border-transparent hover:border-cyan-100">
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black font-bold text-sm shadow-sm transition-all active:scale-95 whitespace-nowrap">
                    {isSuperAdmin ? <ArrowLeft className="w-4 h-4" /> : <LogOut className="w-4 h-4" />} 
                    {isSuperAdmin ? 'Back to Dashboard' : 'Logout'}
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto p-4 md:p-8">
            
            {/* Search */}
            <div className="mb-6 relative w-full md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Search candidate..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-cyan-400 outline-none"
                />
            </div>

            {loading ? (
                <div className="text-center py-20 text-cyan-800 opacity-50 flex flex-col items-center">
                    <Snowflake className="w-12 h-12 animate-spin mb-4" />
                    <p>Loading cool people...</p>
                </div>
            ) : filteredShoppers.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-cyan-100">
                    <p className="text-gray-400 font-bold">No eligible shoppers found.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredShoppers.map(shopper => {
                        // Format First Working Day
                        const fwdDate = shopper.details?.firstWorkingDay 
                            ? format(new Date(shopper.details.firstWorkingDay), 'MMM d, yyyy')
                            : 'N/A';

                        return (
                            <div key={shopper.id} className="bg-white rounded-xl p-5 shadow-sm border border-cyan-100/50 hover:shadow-md transition-all flex flex-col md:flex-row gap-6">
                                
                                {/* Left: Info */}
                                <div className="flex-1 flex flex-col gap-4">
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 flex items-center flex-wrap gap-2">
                                                {shopper.name}
                                                {shopper.details?.pnNumber && (
                                                    <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded border">
                                                        {shopper.details.pnNumber}
                                                    </span>
                                                )}
                                            </h3>
                                            <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-3 items-center">
                                                <span className="flex items-center gap-1 bg-yellow-50 text-yellow-800 px-2 py-1 rounded border border-yellow-100 font-medium">
                                                    <Calendar className="w-3 h-3" /> 
                                                    First Day: <strong>{fwdDate}</strong>
                                                </span>
                                                {shopper.details?.nationality && (
                                                    <span className="font-bold text-cyan-700 px-2 py-1 bg-cyan-50 rounded border border-cyan-100">
                                                        {shopper.details.nationality}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Toggle with Confirmation - Responsive Alignment */}
                                        <div className="shrink-0 self-start sm:self-auto w-full sm:w-auto relative">
                                            <div className="flex items-center gap-2 w-full">
                                                <div className="flex-1 sm:flex-none">
                                                    {pendingToggleId === shopper.id ? (
                                                        <div className="flex items-center justify-between sm:justify-start gap-2 bg-white border border-yellow-300 p-1.5 rounded-lg shadow-sm animate-in slide-in-from-right-2 w-full sm:w-auto">
                                                            <span className="text-[10px] font-bold text-yellow-700 uppercase px-1">
                                                                Confirm?
                                                            </span>
                                                            <div className="flex gap-1">
                                                                <button 
                                                                    onClick={() => confirmToggle(shopper)}
                                                                    className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                                                                    title="Confirm"
                                                                >
                                                                    <Check className="w-4 h-4" />
                                                                </button>
                                                                <button 
                                                                    onClick={cancelToggle}
                                                                    className="p-1.5 bg-gray-100 text-gray-500 rounded hover:bg-gray-200 transition-colors"
                                                                    title="Cancel"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            onClick={() => initiateToggle(shopper.id)}
                                                            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-all shadow-sm ${
                                                                shopper.details?.frozenAddedToSystem 
                                                                ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
                                                                : 'bg-white border-gray-200 text-gray-500 hover:border-cyan-300 hover:text-cyan-600'
                                                            }`}
                                                        >
                                                            {shopper.details?.frozenAddedToSystem ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                                            <span className="text-xs font-bold uppercase tracking-wide">
                                                                {shopper.details?.frozenAddedToSystem ? 'ADDED TO SYSTEM' : 'MARK AS ADDED'}
                                                            </span>
                                                        </button>
                                                    )}
                                                </div>

                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setActiveHelpId(activeHelpId === shopper.id ? null : shopper.id); }}
                                                    className={`p-2 rounded-full transition-colors shrink-0 ${activeHelpId === shopper.id ? 'bg-cyan-100 text-cyan-600' : 'text-gray-400 hover:text-cyan-600 hover:bg-cyan-50'}`}
                                                >
                                                    <HelpCircle className="w-5 h-5" />
                                                </button>
                                            </div>

                                            {/* Help Popover */}
                                            {activeHelpId === shopper.id && (
                                                <div className="absolute top-full right-0 mt-3 z-50 w-64 p-4 bg-gray-900 text-white text-xs rounded-xl shadow-2xl border border-gray-700 animate-in slide-in-from-top-2 fade-in">
                                                    <div className="absolute -top-1.5 right-3 w-3 h-3 bg-gray-900 border-t border-l border-gray-700 transform rotate-45"></div>
                                                    <div className="relative z-10 space-y-2">
                                                        <div className="flex items-center gap-2 text-cyan-400 font-bold border-b border-gray-700 pb-2">
                                                            <Info className="w-3 h-3" />
                                                            <span>Functionality Guide</span>
                                                        </div>
                                                        <p className="leading-relaxed opacity-90 text-gray-300">
                                                            <strong className="text-white">Internal Tracker:</strong> This checkbox is for Loek's personal tracking to know if this candidate has been manually entered into the <span className="text-cyan-300">Frozen Department</span> system.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 text-xs font-bold">
                                        <span className="bg-gray-50 text-gray-600 px-3 py-1.5 rounded border border-gray-200">
                                            Clothing: {shopper.details?.clothingSize || '-'}
                                        </span>
                                        <span className="bg-gray-50 text-gray-600 px-3 py-1.5 rounded border border-gray-200">
                                            Shoes: {shopper.details?.shoeSize || '-'}
                                        </span>
                                    </div>
                                </div>

                                {/* Right: Notes (Responsive Fixed) */}
                                <div className="w-full md:w-72 bg-gray-50 rounded-lg p-3 border border-gray-100 flex flex-col shrink-0 min-h-[100px]">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                            <Info className="w-3 h-3" /> Frozen Notes
                                        </span>
                                        {editingNoteId !== shopper.id && (
                                            <button onClick={() => startEditingNote(shopper)} className="text-[10px] text-cyan-600 font-bold hover:underline">
                                                Edit
                                            </button>
                                        )}
                                    </div>

                                    {editingNoteId === shopper.id ? (
                                        <div className="flex flex-col gap-2 h-full">
                                            <textarea 
                                                value={noteText}
                                                onChange={(e) => setNoteText(e.target.value)}
                                                className="w-full text-sm p-2 rounded border focus:border-cyan-400 outline-none h-24 resize-none bg-white"
                                                placeholder="Internal notes..."
                                                autoFocus
                                            />
                                            <div className="flex gap-2">
                                                <button onClick={() => setEditingNoteId(null)} className="flex-1 py-1.5 text-xs text-gray-500 font-bold border rounded bg-white hover:bg-gray-50">Cancel</button>
                                                <button onClick={() => saveNote(shopper.id)} className="flex-1 py-1.5 text-xs text-white font-bold border border-cyan-600 bg-cyan-600 rounded flex items-center justify-center gap-1 hover:bg-cyan-700">
                                                    <Save className="w-3 h-3" /> Save
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div 
                                            onClick={() => startEditingNote(shopper)}
                                            className="text-sm text-gray-600 italic cursor-pointer flex-1 whitespace-pre-wrap break-words"
                                        >
                                            {shopper.details?.frozenNotes || 'No notes added.'}
                                        </div>
                                    )}
                                </div>

                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    </div>
  );
};
