
import React, { useState, useEffect } from 'react';
import { ShopperRecord, TalkLogEntry, TalkType, PerformanceMetrics } from '../../types';
import { X, User, Save, Clock, Calendar, MessageSquare, Check, AlertTriangle, TrendingUp, MoreHorizontal, Send, Zap, Target, Box, AlertOctagon, Heart, Flag, Briefcase, Star, Trash2 } from 'lucide-react';
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
  const [leadName, setLeadName] = useState('');

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

  const deleteLog = async (logId: string) => {
      if (!window.confirm("Are you sure you want to delete this log entry? This cannot be undone.")) return;

      const updatedLogs = (shopper.details?.talkLogs || []).filter((l: TalkLogEntry) => l.id !== logId);
      const updatedDetails = {
          ...shopper.details,
          talkLogs: updatedLogs
      };

      const { error } = await supabase.from('shoppers').update({ details: updatedDetails }).eq('id', shopper.id);

      if (!error) {
          onUpdate({ ...shopper, details: updatedDetails });
      } else {
          alert("Error deleting log entry");
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

  // Helper Input Component for the grid
  const MetricInput = ({ label, field, icon, placeholder = "0", type = "number", className = "" }: { label: string; field: keyof PerformanceMetrics; icon?: React.ReactNode; placeholder?: string; type?: string; className?: string }) => (
      <div className="flex flex-col">
          <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 flex items-center gap-1">
              {icon} {label}
          </label>
          <input 
              type={type}
              value={metrics[field] || ''}
              onChange={(e) => handleMetricChange(field, type === 'number' ? Number(e.target.value) : e.target.value)}
              className={`w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-gray-800 outline-none focus:bg-white focus:border-blue-400 transition-all ${className}`}
              placeholder={placeholder}
          />
      </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200">
        <div className="bg-white w-full md:max-w-4xl h-[95vh] md:h-[90vh] md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="px-6 py-4 border-b flex justify-between items-center bg-white shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-blue-200 shadow-lg">
                        {shopper.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-900 leading-none">{shopper.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">{shopper.details?.pnNumber}</span>
                            {metrics.currentZone && <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{metrics.currentZone}</span>}
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-gray-400" />
                </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="px-6 py-3 border-b bg-gray-50 flex gap-3 overflow-x-auto no-scrollbar shrink-0 items-center">
                <button 
                    onClick={toggleCheckInToday}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap shadow-sm active:scale-[0.98] ${
                        shopper.details?.talkProgress?.checkInToday 
                        ? 'bg-green-100 border-green-200 text-green-700' 
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                >
                    {shopper.details?.talkProgress?.checkInToday ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    Checked In
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1"></div>
                <button 
                    onClick={() => { setActiveTab('LOG_TALK'); setNewLogType('WELCOME'); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white shadow-blue-200 shadow-md hover:bg-blue-700 active:scale-95 transition-all whitespace-nowrap ml-auto md:ml-0"
                >
                    <MessageSquare className="w-4 h-4" /> Log Talk
                </button>
                {hasMetricChanges && (
                    <button onClick={saveMetrics} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gray-900 text-white shadow-lg animate-in zoom-in ml-auto">
                        <Save className="w-4 h-4" /> Save Changes
                    </button>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto bg-gray-100">
                
                {/* TABS */}
                <div className="flex bg-white px-6 sticky top-0 z-20 shadow-sm">
                    <button 
                        onClick={() => setActiveTab('OVERVIEW')}
                        className={`py-4 text-sm font-bold border-b-2 px-4 transition-colors ${activeTab === 'OVERVIEW' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                    >
                        Dashboard
                    </button>
                    <button 
                        onClick={() => setActiveTab('LOG_TALK')}
                        className={`py-4 text-sm font-bold border-b-2 px-4 transition-colors ${activeTab === 'LOG_TALK' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                    >
                        Talk History
                    </button>
                </div>

                {activeTab === 'OVERVIEW' && (
                    <div className="p-4 md:p-6 space-y-6">
                        
                        {/* 1. General & Operational Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            
                            {/* GENERAL INFO CARD */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Briefcase className="w-4 h-4" /> General Info
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <MetricInput label="Active Weeks" field="activeWeeks" icon={<Calendar className="w-3 h-3"/>} />
                                    <MetricInput label="Total Shifts" field="shiftsCount" icon={<Clock className="w-3 h-3"/>} />
                                    <div className="col-span-2">
                                        <MetricInput label="Current Zone" field="currentZone" type="text" placeholder="e.g. ZONE_PICKING - AM" />
                                    </div>
                                </div>
                            </div>

                            {/* PRODUCTIVITY CARD */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-full -mr-10 -mt-10 z-0"></div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2 relative z-10">
                                    <Zap className="w-4 h-4 text-blue-500" /> Productivity
                                </h4>
                                <div className="grid grid-cols-3 gap-3 relative z-10">
                                    <MetricInput label="Speed (AM)" field="speedAM" className="text-blue-600" />
                                    <MetricInput label="Speed (CH)" field="speedCH" className="text-blue-600" />
                                    <MetricInput label="Pick %" field="pickingScore" />
                                    <MetricInput label="Reps" field="reps" icon={<Target className="w-3 h-3"/>} />
                                    <div className="col-span-2">
                                        <MetricInput label="Modules" field="modules" type="text" placeholder="e.g. Safe, Quality..." />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Attendance & Discipline (RED ZONE) */}
                        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-5 relative overflow-hidden">
                             <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                             <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <AlertOctagon className="w-4 h-4" /> Attendance & Discipline
                             </h4>
                             <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <MetricInput label="Late" field="late" className="bg-red-50 text-red-700 border-red-100" />
                                <MetricInput label="Absence" field="absence" className="bg-red-50 text-red-700 border-red-100" />
                                <MetricInput label="Absence (AA)" field="absenceAA" className="bg-red-50 text-red-700 border-red-100" />
                                <MetricInput label="No Show (Call)" field="nswc" className="bg-red-50 text-red-700 border-red-100" />
                                <MetricInput label="No Show (No Call)" field="nsnc" className="bg-red-50 text-red-700 border-red-100" />
                             </div>
                        </div>

                        {/* 3. Behaviour & Warnings */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                             <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                                <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Flag className="w-4 h-4" /> Warnings & Scores
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <MetricInput label="Official Warnings" field="officialWarnings" className="text-orange-600 bg-orange-50 border-orange-100" />
                                    <MetricInput label="Behaviour Score" field="behaviorScore" />
                                </div>
                             </div>

                             <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                                <h4 className="text-xs font-bold text-green-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Heart className="w-4 h-4" /> Positives
                                </h4>
                                <div className="grid grid-cols-1">
                                    <MetricInput label="Compliments" field="compliments" icon={<Star className="w-3 h-3 text-yellow-400 fill-yellow-400"/>} className="text-green-700 bg-green-50 border-green-100" />
                                </div>
                             </div>
                        </div>

                    </div>
                )}

                {activeTab === 'LOG_TALK' && (
                    <div className="p-4 md:p-6 space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            
                            {/* LEFT: FORM */}
                            <div className="lg:col-span-1 space-y-6">
                                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                                    <h3 className="text-sm font-bold text-gray-800 mb-4">New Entry</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Talk Type</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {TALK_TYPES.map(t => (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => setNewLogType(t.id)}
                                                        className={`p-2 rounded-lg text-[10px] font-bold border text-center transition-all ${
                                                            newLogType === t.id 
                                                            ? `ring-2 ring-offset-1 ring-blue-500 ${t.color} border-transparent` 
                                                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                                                        }`}
                                                    >
                                                        {t.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Lead Shopper</label>
                                            <input 
                                                value={leadName}
                                                onChange={(e) => setLeadName(e.target.value)}
                                                placeholder="Name..."
                                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Notes</label>
                                            <textarea 
                                                value={newLogNotes}
                                                onChange={(e) => setNewLogNotes(e.target.value)}
                                                placeholder="Summary of conversation..."
                                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm min-h-[120px] resize-none font-medium"
                                            />
                                        </div>

                                        <Button onClick={submitLog} fullWidth className="py-3 text-sm bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
                                            <Send className="w-4 h-4 mr-2" /> Save Log
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT: HISTORY */}
                            <div className="lg:col-span-2">
                                <h3 className="text-sm font-bold text-gray-800 mb-4 px-2">History ({logs.length})</h3>
                                {logs.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                                        <p className="text-sm">No talks recorded yet.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {logs.map((log: TalkLogEntry) => (
                                            <div key={log.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3 hover:shadow-md transition-shadow relative group">
                                                <button 
                                                    onClick={() => deleteLog(log.id)}
                                                    className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all md:opacity-0 md:group-hover:opacity-100"
                                                    title="Delete log entry"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                                <div className="flex justify-between items-start pr-8">
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${TALK_TYPES.find(t => t.id === log.type)?.color || 'bg-gray-100'}`}>
                                                        {TALK_TYPES.find(t => t.id === log.type)?.label || log.type}
                                                    </span>
                                                    <span className="text-xs text-gray-400 font-medium">{format(new Date(log.date), 'MMM d, HH:mm')}</span>
                                                </div>
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{log.notes}</p>
                                                <div className="pt-2 border-t border-gray-50 text-xs text-gray-400 flex items-center gap-1 font-medium">
                                                    <User className="w-3 h-3" /> By: <span className="text-gray-900">{log.leadShopper}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
