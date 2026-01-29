
import React, { useState, useEffect } from 'react';
import { ShopperRecord, TalkLogEntry, TalkType, PerformanceMetrics } from '../../types';
import { X, User, Save, Clock, Calendar, MessageSquare, Check, AlertTriangle, TrendingUp, MoreHorizontal, Send } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../supabaseClient';
import { Button } from '../Button';

interface TalkModalProps {
  shopper: ShopperRecord;
  onClose: () => void;
  onUpdate: (shopper: ShopperRecord) => void;
}

const TALK_TYPES: { id: TalkType; label: string; color: string }[] = [
    { id: 'WELCOME', label: 'Welcome Talk', color: 'bg-green-100 text-green-700' },
    { id: 'MID_TERM', label: 'Mid-Term Eval', color: 'bg-blue-100 text-blue-700' },
    { id: 'PROMOTION', label: 'Promotion', color: 'bg-purple-100 text-purple-700' },
    { id: 'END_TRIAL', label: 'End of Trial', color: 'bg-orange-100 text-orange-700' },
    { id: 'CHECK_IN', label: 'Quick Check-in', color: 'bg-gray-100 text-gray-700' },
    { id: 'OTHER', label: 'Ad-hoc / Other', color: 'bg-yellow-100 text-yellow-700' },
];

export const TalkModal: React.FC<TalkModalProps> = ({ shopper, onClose, onUpdate }) => {
  // State for Tabs
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LOG_TALK'>('OVERVIEW');
  
  // State for Metrics Editing
  const [metrics, setMetrics] = useState<PerformanceMetrics>(shopper.details?.performance || {});
  const [hasMetricChanges, setHasMetricChanges] = useState(false);

  // State for New Log
  const [newLogType, setNewLogType] = useState<TalkType>('CHECK_IN');
  const [newLogNotes, setNewLogNotes] = useState('');
  const [leadName, setLeadName] = useState(''); // Could default to logged in user if auth was strict

  const logs = (shopper.details?.talkLogs || []).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // --- ACTIONS ---

  const saveMetrics = async () => {
      const updatedDetails = {
          ...shopper.details,
          performance: metrics
      };
      
      const { error } = await supabase.from('shoppers').update({ details: updatedDetails }).eq('id', shopper.id);
      
      if (!error) {
          onUpdate({ ...shopper, details: updatedDetails });
          setHasMetricChanges(false);
      }
  };

  const handleMetricChange = (key: keyof PerformanceMetrics, val: any) => {
      setMetrics(prev => ({ ...prev, [key]: val }));
      setHasMetricChanges(true);
  };

  const submitLog = async () => {
      if (!leadName.trim()) { alert("Please enter Lead Name"); return; }
      
      const newEntry: TalkLogEntry = {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          leadShopper: leadName,
          type: newLogType,
          notes: newLogNotes
      };

      // Also update progress flags based on type
      const currentProgress = shopper.details?.talkProgress || {};
      const updatedProgress = { ...currentProgress };
      
      if (newLogType === 'WELCOME') updatedProgress.welcomeTalk = 'DONE';
      if (newLogType === 'MID_TERM') updatedProgress.midTermEval = 'DONE';
      if (newLogType === 'END_TRIAL') updatedProgress.endOfTrialTalk = 'DONE';
      if (newLogType === 'CHECK_IN') updatedProgress.checkInToday = true;

      const updatedDetails = {
          ...shopper.details,
          talkProgress: updatedProgress,
          talkLogs: [...(shopper.details?.talkLogs || []), newEntry]
      };

      const { error } = await supabase.from('shoppers').update({ details: updatedDetails }).eq('id', shopper.id);

      if (!error) {
          onUpdate({ ...shopper, details: updatedDetails });
          setNewLogNotes('');
          setActiveTab('OVERVIEW'); // Go back to history
      } else {
          alert("Error saving log");
      }
  };

  const toggleCheckInToday = async () => {
      const currentVal = shopper.details?.talkProgress?.checkInToday;
      const updatedDetails = {
          ...shopper.details,
          talkProgress: { ...shopper.details?.talkProgress, checkInToday: !currentVal }
      };
      const { error } = await supabase.from('shoppers').update({ details: updatedDetails }).eq('id', shopper.id);
      if (!error) onUpdate({ ...shopper, details: updatedDetails });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200">
        <div className="bg-white w-full md:max-w-2xl h-[95vh] md:h-[85vh] md:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                        {shopper.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 leading-none">{shopper.name}</h2>
                        <p className="text-xs text-gray-500 font-mono mt-1">{shopper.details?.pnNumber}</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                    <X className="w-5 h-5 text-gray-500" />
                </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="px-6 py-3 border-b bg-white flex gap-2 overflow-x-auto no-scrollbar shrink-0">
                <button 
                    onClick={toggleCheckInToday}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border transition-all whitespace-nowrap ${
                        shopper.details?.talkProgress?.checkInToday 
                        ? 'bg-green-100 border-green-200 text-green-700' 
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    {shopper.details?.talkProgress?.checkInToday ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    Check-In Today
                </button>
                <div className="w-px h-8 bg-gray-200 mx-1"></div>
                <button 
                    onClick={() => { setActiveTab('LOG_TALK'); setNewLogType('WELCOME'); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 whitespace-nowrap"
                >
                    <MessageSquare className="w-3 h-3" /> Log Talk
                </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto bg-gray-50/50">
                
                {/* TABS */}
                <div className="flex border-b bg-white sticky top-0 z-10">
                    <button 
                        onClick={() => setActiveTab('OVERVIEW')}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'OVERVIEW' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                    >
                        Overview & History
                    </button>
                    <button 
                        onClick={() => setActiveTab('LOG_TALK')}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'LOG_TALK' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                    >
                        New Entry
                    </button>
                </div>

                {activeTab === 'OVERVIEW' && (
                    <div className="p-6 space-y-6">
                        
                        {/* 1. Editable Metrics Card */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4" /> Performance Snapshot
                                </h4>
                                {hasMetricChanges && (
                                    <button onClick={saveMetrics} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full font-bold shadow-sm hover:bg-blue-700 animate-in fade-in">
                                        Save Changes
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="text-[10px] text-gray-500 font-bold block mb-1">Active Weeks</label>
                                    <input 
                                        type="number" 
                                        value={metrics.activeWeeks || ''}
                                        onChange={(e) => handleMetricChange('activeWeeks', Number(e.target.value))}
                                        className="w-full bg-gray-50 border rounded p-1.5 text-sm font-bold text-center"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 font-bold block mb-1">Absence</label>
                                    <input 
                                        type="number" 
                                        value={metrics.absence || ''}
                                        onChange={(e) => handleMetricChange('absence', Number(e.target.value))}
                                        className={`w-full bg-gray-50 border rounded p-1.5 text-sm font-bold text-center ${metrics.absence ? 'text-red-600 border-red-200 bg-red-50' : ''}`}
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 font-bold block mb-1">Late</label>
                                    <input 
                                        type="number" 
                                        value={metrics.late || ''}
                                        onChange={(e) => handleMetricChange('late', Number(e.target.value))}
                                        className={`w-full bg-gray-50 border rounded p-1.5 text-sm font-bold text-center ${metrics.late ? 'text-orange-600 border-orange-200 bg-orange-50' : ''}`}
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 font-bold block mb-1">Speed (AM)</label>
                                    <input 
                                        type="number" 
                                        value={metrics.speedAM || ''}
                                        onChange={(e) => handleMetricChange('speedAM', Number(e.target.value))}
                                        className="w-full bg-gray-50 border rounded p-1.5 text-sm font-bold text-center text-blue-700"
                                        placeholder="-"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. Timeline / History */}
                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Calendar className="w-4 h-4" /> Conversation Log
                            </h4>
                            
                            {logs.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                                    <p className="text-sm">No talks recorded yet.</p>
                                    <button onClick={() => setActiveTab('LOG_TALK')} className="text-blue-600 text-xs font-bold mt-2 hover:underline">Log the first one</button>
                                </div>
                            ) : (
                                <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
                                    {logs.map((log: TalkLogEntry) => (
                                        <div key={log.id} className="relative pl-6">
                                            {/* Dot */}
                                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-4 border-blue-200"></div>
                                            
                                            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${TALK_TYPES.find(t => t.id === log.type)?.color || 'bg-gray-100'}`}>
                                                        {TALK_TYPES.find(t => t.id === log.type)?.label || log.type}
                                                    </span>
                                                    <span className="text-xs text-gray-400">{format(new Date(log.date), 'MMM d, HH:mm')}</span>
                                                </div>
                                                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{log.notes}</p>
                                                <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400 flex items-center gap-1">
                                                    <User className="w-3 h-3" /> Logged by: <strong className="text-gray-600">{log.leadShopper}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'LOG_TALK' && (
                    <div className="p-6 space-y-6 animate-in slide-in-from-right-4">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Talk Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {TALK_TYPES.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setNewLogType(t.id)}
                                            className={`p-3 rounded-lg text-xs font-bold border text-left transition-all ${
                                                newLogType === t.id 
                                                ? `ring-2 ring-offset-1 ring-blue-500 ${t.color} border-transparent` 
                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                            }`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Lead Shopper Name</label>
                                <input 
                                    value={leadName}
                                    onChange={(e) => setLeadName(e.target.value)}
                                    placeholder="Who is conducting this talk?"
                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Notes & Outcome</label>
                                <textarea 
                                    value={newLogNotes}
                                    onChange={(e) => setNewLogNotes(e.target.value)}
                                    placeholder="Write summary here..."
                                    className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm min-h-[150px] resize-none"
                                />
                            </div>

                            <Button onClick={submitLog} fullWidth className="py-4 text-base bg-blue-600 hover:bg-blue-700">
                                <Send className="w-4 h-4 mr-2" /> Save Log Entry
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
