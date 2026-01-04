import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Download, Search, Trash2, ChevronDown, ChevronUp, User, Calendar, MapPin, Bus, AlertCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ShiftType } from '../types';

interface ShopperRecord {
  id: string;
  created_at: string;
  name: string;
  details: any;
  shifts: any[];
}

export const AdminDataView: React.FC = () => {
  const [data, setData] = useState<ShopperRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
  // Track which row is in "Confirm Delete" state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data: shoppers, error } = await supabase
      .from('shoppers')
      .select('*, shifts(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching data:', error);
    } else {
      setData(shoppers || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    // If not in confirm state, set it
    if (deleteConfirmId !== id) {
        setDeleteConfirmId(id);
        // Auto-reset after 3 seconds if not clicked
        setTimeout(() => {
            setDeleteConfirmId(prev => (prev === id ? null : prev));
        }, 3000);
        return;
    }

    // Proceed to delete
    try {
      // 1. Delete associated Shifts first (Manual Cascade)
      // We don't verify count here because there might be 0 shifts.
      const { error: shiftsError } = await supabase
        .from('shifts')
        .delete()
        .eq('shopper_id', id);

      if (shiftsError) throw new Error(`Failed to delete shifts: ${shiftsError.message}`);

      // 2. Delete the Shopper
      // IMPORTANT: count: 'exact' ensures we know if a row was ACTUALLY deleted
      const { error: shopperError, count } = await supabase
        .from('shoppers')
        .delete({ count: 'exact' })
        .eq('id', id);

      if (shopperError) throw new Error(`Failed to delete shopper: ${shopperError.message}`);

      // Check if anything was actually deleted
      if (count === 0) {
          alert("Error: Database reported success but 0 records were deleted.\n\nThis usually means Supabase RLS (Row Level Security) is enabled and blocking the delete.\n\nPlease go to Supabase > Authentication > Policies and enable DELETE for public/anon users.");
          setDeleteConfirmId(null);
          return;
      }

      // 3. Update UI only if DB confirmed deletion
      setData(prev => prev.filter(item => item.id !== id));
      setDeleteConfirmId(null);
      
    } catch (err: any) {
      console.error('Delete flow error:', err);
      alert(`Error deleting record: ${err.message}`);
    }
  };

  const filteredData = data.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const downloadCSV = () => {
    const headers = ['Name', 'Registered At', 'First Working Day', 'Bus', 'Randstad', 'Address', 'Total Shifts', 'Shift Details'];
    const rows = filteredData.map(item => {
      const shiftSummary = item.shifts
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(s => `${s.date} (${s.time.split('(')[0].trim()} - ${s.type})`)
        .join('; ');

      return [
        `"${item.name}"`,
        `"${format(new Date(item.created_at), 'yyyy-MM-dd HH:mm')}"`,
        `"${item.details?.firstWorkingDay || ''}"`,
        item.details?.usePicnicBus ? 'Yes' : 'No',
        item.details?.isRandstad ? 'Yes' : 'No',
        `"${item.details?.address || ''}"`,
        item.shifts.length,
        `"${shiftSummary}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `shoppers_export_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDateDisplay = (dateStr: string) => {
      if(!dateStr) return 'N/A';
      try {
          return format(new Date(dateStr), 'MMM do, yyyy');
      } catch (e) { return dateStr; }
  };

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
              <p>Loading records from database...</p>
          </div>
      );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in">
      
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by name..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none transition-all"
          />
        </div>
        
        <div className="flex gap-2">
            <button onClick={fetchData} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors" title="Refresh">
                <RefreshCw className="w-5 h-5" />
            </button>
            <button 
                onClick={downloadCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
            >
                <Download className="w-4 h-4" /> Export CSV
            </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><User className="w-6 h-6" /></div>
              <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Total Shoppers</p>
                  <p className="text-2xl font-bold text-gray-900">{data.length}</p>
              </div>
          </div>
          <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-lg"><Calendar className="w-6 h-6" /></div>
              <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Total Shifts</p>
                  <p className="text-2xl font-bold text-gray-900">{data.reduce((acc, curr) => acc + curr.shifts.length, 0)}</p>
              </div>
          </div>
          <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4">
              <div className="p-3 bg-orange-100 text-orange-600 rounded-lg"><Bus className="w-6 h-6" /></div>
              <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Bus Users</p>
                  <p className="text-2xl font-bold text-gray-900">{data.filter(d => d.details?.usePicnicBus).length}</p>
              </div>
          </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-500">
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Registration Date</th>
                <th className="px-6 py-4 font-semibold">First Work Day</th>
                <th className="px-6 py-4 font-semibold text-center">Info</th>
                <th className="px-6 py-4 font-semibold text-center">Shifts</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.length === 0 ? (
                  <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                          No records found.
                      </td>
                  </tr>
              ) : (
                  filteredData.map((item) => (
                    <React.Fragment key={item.id}>
                      <tr 
                        className={`hover:bg-purple-50 transition-colors cursor-pointer ${expandedRow === item.id ? 'bg-purple-50/50' : ''}`}
                        onClick={() => setExpandedRow(expandedRow === item.id ? null : item.id)}
                      >
                        <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-600 font-bold text-xs">
                                {item.name.substring(0,2).toUpperCase()}
                            </div>
                            {item.name}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                            {format(new Date(item.created_at), 'MMM d, HH:mm')}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                            {formatDateDisplay(item.details?.firstWorkingDay)}
                        </td>
                        <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-2">
                                {item.details?.usePicnicBus && (
                                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-[10px] font-bold border border-green-200" title="Uses Bus">BUS</span>
                                )}
                                {item.details?.isRandstad && (
                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold border border-blue-200" title="Randstad Agency">RND</span>
                                )}
                            </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                             <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-bold">
                                {item.shifts.length}
                             </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={(e) => handleDelete(e, item.id)}
                            className={`p-2 rounded-lg transition-all border ${
                                deleteConfirmId === item.id 
                                ? 'bg-red-600 text-white border-red-700 hover:bg-red-700 w-24 text-center' 
                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50 border-transparent'
                            }`}
                            title="Delete Record"
                          >
                            {deleteConfirmId === item.id ? (
                                <span className="text-xs font-bold">Confirm?</span>
                            ) : (
                                <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                      {expandedRow === item.id && (
                          <tr className="bg-gray-50/50">
                              <td colSpan={6} className="px-6 py-4">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2">
                                      {/* Details Column */}
                                      <div className="space-y-3 text-sm text-gray-600 border-r pr-6">
                                          <h4 className="font-bold text-gray-900 flex items-center gap-2">
                                              <User className="w-4 h-4" /> Personal Details
                                          </h4>
                                          <div className="grid grid-cols-2 gap-2">
                                              <span>Clothing: <strong>{item.details?.clothingSize}</strong></span>
                                              <span>Shoes: <strong>{item.details?.shoeSize}</strong></span>
                                              <span>Gloves: <strong>{item.details?.gloveSize}</strong></span>
                                              <span>Status: <strong>{item.details?.civilStatus}</strong></span>
                                          </div>
                                          {item.details?.isRandstad && (
                                              <div className="mt-2 pt-2 border-t">
                                                  <div className="flex items-start gap-2 text-xs">
                                                      <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                                                      {item.details?.address || 'No address provided'}
                                                  </div>
                                              </div>
                                          )}
                                      </div>

                                      {/* Shifts Column */}
                                      <div className="col-span-2">
                                          <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                                              <Calendar className="w-4 h-4" /> Selected Shifts
                                          </h4>
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                              {item.shifts.length > 0 ? (
                                                  item.shifts
                                                  .sort((a, b) => a.date.localeCompare(b.date))
                                                  .map((shift, idx) => (
                                                      <div key={idx} className={`p-2 rounded border text-xs ${
                                                          shift.type === 'Always Available' 
                                                          ? 'bg-red-50 border-red-100 text-red-700' 
                                                          : 'bg-green-50 border-green-100 text-green-700'
                                                      }`}>
                                                          <div className="font-bold">{formatDateDisplay(shift.date)}</div>
                                                          <div className="truncate" title={shift.time}>{shift.time.split('(')[0]}</div>
                                                      </div>
                                                  ))
                                              ) : (
                                                  <span className="text-gray-400 italic text-sm">No shifts selected</span>
                                              )}
                                          </div>
                                      </div>
                                  </div>
                              </td>
                          </tr>
                      )}
                    </React.Fragment>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};