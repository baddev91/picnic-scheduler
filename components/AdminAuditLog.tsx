
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { AuditLogRecord } from '../types';
import { format } from 'date-fns';
import { History, RefreshCw, RotateCcw, Trash2, PlusCircle, Pencil, AlertCircle, ArrowLeft, CheckCircle2, CalendarDays, Clock, FileText } from 'lucide-react';
import { Button } from './Button';

interface AdminAuditLogProps {
  onBack: () => void;
}

// --- Micro Component for Hold Interaction ---
const HoldToRestoreButton: React.FC<{ onConfirm: () => void; isLoading: boolean; className?: string }> = ({ onConfirm, isLoading, className }) => {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const isComplete = useRef(false);

  const startCounter = () => {
    if (isLoading) return;
    isComplete.current = false;
    
    // 1500ms duration (approx 1.5s hold time)
    // Update every 15ms -> 100 steps
    let current = 0;
    intervalRef.current = window.setInterval(() => {
      current += 1; 
      setProgress(current);
      
      if (current >= 100) {
        clearInterval(intervalRef.current!);
        isComplete.current = true;
        onConfirm();
      }
    }, 15);
  };

  const stopCounter = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // Only reset visually if we haven't completed the action
    if (!isComplete.current) {
      setProgress(0);
    }
  };

  return (
    <button
      onMouseDown={startCounter}
      onMouseUp={stopCounter}
      onMouseLeave={stopCounter}
      onTouchStart={startCounter}
      onTouchEnd={stopCounter}
      disabled={isLoading}
      className={`relative overflow-hidden inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-all shadow-sm disabled:opacity-50 group select-none ${className}`}
    >
      {/* Progress Fill Background */}
      <div 
        className="absolute left-0 top-0 bottom-0 bg-red-600 transition-all duration-[15ms] ease-linear opacity-80" 
        style={{ width: `${progress}%` }}
      />
      
      {/* Content Layer (z-index to stay on top of fill) */}
      <span className="relative z-10 flex items-center gap-1.5">
        {isLoading ? (
           <RefreshCw className="w-3 h-3 animate-spin" />
        ) : progress >= 100 ? (
           <CheckCircle2 className="w-3 h-3 animate-bounce" />
        ) : (
           <RotateCcw className={`w-3 h-3 transition-transform duration-200 ${progress > 0 ? '-rotate-180' : ''}`} />
        )}
        
        {isLoading ? 'Restoring...' : progress > 0 ? 'Hold...' : 'Hold to Restore'}
      </span>
    </button>
  );
};

export const AdminAuditLog: React.FC<AdminAuditLogProps> = ({ onBack }) => {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    // Fetch last 50 logs. Assuming table name is 'shoppers_audit'
    const { data, error } = await supabase
      .from('shoppers_audit')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching logs:', error);
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleRestore = async (log: AuditLogRecord) => {
    if (!log.old_data) return;
    
    setRestoringId(log.id);
    
    try {
      // 1. DATA RECOVERY
      const oldData = log.old_data;
      let shiftsToRestore = oldData.shifts || oldData.details?._archived_shifts || [];
      
      // 2. CLEANUP
      const cleanDetails = { ...oldData.details };
      delete cleanDetails._archived_shifts;

      const shopperPayload = {
          ...oldData,
          details: cleanDetails
      };
      delete shopperPayload.shifts; 

      // 3. INSERT SHOPPER
      const { error: insertError } = await supabase
        .from('shoppers')
        .insert(shopperPayload); 

      if (insertError) throw insertError;
      
      // 4. INSERT SHIFTS
      if (Array.isArray(shiftsToRestore) && shiftsToRestore.length > 0) {
          const shiftsPayload = shiftsToRestore.map((s: any) => ({
              shopper_id: shopperPayload.id,
              date: s.date,
              time: s.time,
              type: s.type
          }));

          const { error: shiftError } = await supabase
              .from('shifts')
              .insert(shiftsPayload);
          
          if (shiftError) console.error("Error restoring shifts:", shiftError);
      }
      
      alert(`${shopperPayload.name} restored successfully with ${shiftsToRestore.length} shifts!`);
      fetchLogs();
    } catch (err: any) {
      alert(`Restore failed: ${err.message}. The ID might already exist.`);
    } finally {
      setRestoringId(null);
    }
  };

  const getOpBadge = (op: string) => {
    switch (op) {
      case 'INSERT': return <span className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] md:text-xs font-bold border border-green-200"><PlusCircle className="w-3 h-3" /> CREATED</span>;
      case 'UPDATE': return <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] md:text-xs font-bold border border-blue-200"><Pencil className="w-3 h-3" /> EDITED</span>;
      case 'DELETE': return <span className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] md:text-xs font-bold border border-red-200"><Trash2 className="w-3 h-3" /> DELETED</span>;
      default: return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-[10px] md:text-xs font-bold">{op}</span>;
    }
  };

  const renderDiff = (log: AuditLogRecord) => {
      const name = log.new_data?.name || log.old_data?.name || 'Unknown';
      const pn = log.new_data?.details?.pnNumber || log.old_data?.details?.pnNumber || '';
      
      let shiftBackupCount = 0;
      if (log.operation_type === 'DELETE') {
          if (log.old_data?.shifts?.length) shiftBackupCount = log.old_data.shifts.length;
          else if (log.old_data?.details?._archived_shifts?.length) shiftBackupCount = log.old_data.details._archived_shifts.length;
      }
      
      return (
          <div className="flex flex-col">
              <span className="font-bold text-gray-800 flex items-center gap-2 text-sm md:text-base">
                  {name}
                  {shiftBackupCount > 0 && (
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded flex items-center gap-1 font-normal border border-purple-200" title="Includes archived shifts">
                          <CalendarDays className="w-3 h-3" /> {shiftBackupCount}
                      </span>
                  )}
              </span>
              {pn && <span className="text-xs font-mono text-gray-400">{pn}</span>}
              
              <div className="mt-1 text-xs text-gray-500">
                  {log.operation_type === 'UPDATE' && log.old_data && log.new_data && (
                      <div className="flex flex-col md:flex-row gap-1 md:gap-2">
                           {log.old_data.name !== log.new_data.name && <span>Name changed.</span>}
                           {JSON.stringify(log.old_data.details) !== JSON.stringify(log.new_data.details) && <span>Details updated.</span>}
                      </div>
                  )}
              </div>
          </div>
      );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6 animate-in fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 md:p-6 rounded-2xl shadow-sm border gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gray-100 rounded-xl text-gray-600">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Audit Logs</h2>
            <p className="text-gray-500 text-sm">View history and restore deleted records.</p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
           <Button variant="secondary" onClick={onBack} className="flex-1 md:flex-none">
               <ArrowLeft className="w-4 h-4 mr-2" /> Back
           </Button>
           <button onClick={fetchLogs} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors bg-gray-50 md:bg-transparent border md:border-none">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        {logs.length === 0 && !loading ? (
            <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-2">
                <History className="w-12 h-12 opacity-20" />
                <p>No audit logs found.</p>
            </div>
        ) : (
            <>
                {/* DESKTOP TABLE VIEW */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b text-gray-500 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-3 font-bold">Time</th>
                                <th className="px-6 py-3 font-bold">Action</th>
                                <th className="px-6 py-3 font-bold">Record</th>
                                <th className="px-6 py-3 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                        <div className="font-medium text-gray-900">
                                            {format(new Date(log.changed_at), 'MMM dd')}
                                        </div>
                                        <div className="text-xs">
                                            {format(new Date(log.changed_at), 'HH:mm:ss')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {getOpBadge(log.operation_type)}
                                    </td>
                                    <td className="px-6 py-4">
                                        {renderDiff(log)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {log.operation_type === 'DELETE' && log.old_data && (
                                            <HoldToRestoreButton 
                                                onConfirm={() => handleRestore(log)}
                                                isLoading={restoringId === log.id}
                                            />
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* MOBILE CARD VIEW */}
                <div className="md:hidden divide-y divide-gray-100">
                    {logs.map((log) => (
                        <div key={log.id} className="p-4 flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <Clock className="w-3 h-3" />
                                    <span>{format(new Date(log.changed_at), 'MMM dd, HH:mm')}</span>
                                </div>
                                {getOpBadge(log.operation_type)}
                            </div>
                            
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                {renderDiff(log)}
                            </div>

                            {log.operation_type === 'DELETE' && log.old_data && (
                                <div className="flex justify-end pt-1">
                                    <HoldToRestoreButton 
                                        onConfirm={() => handleRestore(log)}
                                        isLoading={restoringId === log.id}
                                        className="w-full justify-center py-2"
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </>
        )}
      </div>
      
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-sm text-blue-800">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
              <strong>Deep Restore Enabled:</strong>
              <p className="mt-1 opacity-90 leading-relaxed text-xs md:text-sm">
                  Hold button for 1.5s to restore. The system recovers <strong>Profile + Shifts</strong>.
              </p>
          </div>
      </div>
    </div>
  );
};
