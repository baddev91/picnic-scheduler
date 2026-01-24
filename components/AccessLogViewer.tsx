
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { AccessLogEntry } from '../types';
import { ShieldAlert, ShieldCheck, ShieldBan, ArrowLeft, RefreshCw, Smartphone, Monitor } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from './Button';

interface AccessLogViewerProps {
  onBack: () => void;
}

export const AccessLogViewer: React.FC<AccessLogViewerProps> = ({ onBack }) => {
  const [logs, setLogs] = useState<AccessLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('access_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching access logs', error);
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS': return <ShieldCheck className="w-5 h-5 text-green-600" />;
      case 'FAILURE': return <ShieldAlert className="w-5 h-5 text-red-600" />;
      case 'LOCKOUT': return <ShieldBan className="w-5 h-5 text-orange-600" />;
      default: return <ShieldAlert className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'SUCCESS': return 'bg-green-50 border-green-200';
      case 'FAILURE': return 'bg-red-50 border-red-200';
      case 'LOCKOUT': return 'bg-orange-50 border-orange-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getDeviceIcon = (info: string) => {
      if (info.toLowerCase().includes('mobile') || info.toLowerCase().includes('android') || info.toLowerCase().includes('iphone')) {
          return <Smartphone className="w-3 h-3 text-gray-400" />;
      }
      return <Monitor className="w-3 h-3 text-gray-400" />;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 md:p-6 rounded-2xl shadow-sm border gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gray-900 rounded-xl text-white">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Security Access Logs</h2>
            <p className="text-gray-500 text-sm">Track login attempts and lockouts.</p>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b text-gray-500 uppercase text-xs">
                    <tr>
                        <th className="px-6 py-4 font-bold">Timestamp</th>
                        <th className="px-6 py-4 font-bold">Status</th>
                        <th className="px-6 py-4 font-bold">Target Role</th>
                        <th className="px-6 py-4 font-bold">Device Info</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {logs.map((log) => (
                        <tr key={log.id} className={`hover:bg-gray-50 transition-colors ${log.status === 'LOCKOUT' ? 'bg-orange-50/30' : ''}`}>
                            <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                <div className="font-bold text-gray-800">{format(new Date(log.created_at), 'MMM dd')}</div>
                                <div className="text-xs">{format(new Date(log.created_at), 'HH:mm:ss')}</div>
                            </td>
                            <td className="px-6 py-4">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border w-fit font-bold text-xs ${getStatusStyles(log.status)}`}>
                                    {getStatusIcon(log.status)}
                                    {log.status}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`font-mono text-xs px-2 py-1 rounded ${log.target_role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-cyan-100 text-cyan-700'}`}>
                                    {log.target_role}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-500 max-w-[200px] truncate" title={log.device_info}>
                                <div className="flex items-center gap-2">
                                    {getDeviceIcon(log.device_info)}
                                    {log.device_info}
                                </div>
                            </td>
                        </tr>
                    ))}
                    {logs.length === 0 && !loading && (
                        <tr>
                            <td colSpan={4} className="text-center py-12 text-gray-400">No logs found.</td>
                        </tr>
                    )}
                </tbody>
            </table>
          </div>
      </div>
    </div>
  );
};
