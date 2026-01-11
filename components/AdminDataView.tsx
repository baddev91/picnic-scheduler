import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Download, Search, Trash2, User, Calendar, MapPin, RefreshCw, Pencil, GripVertical, Clock, SaveAll, Copy, Sheet, FileSpreadsheet, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ShopperRecord, ShiftType } from '../types';
import { AdminHeatmap } from './AdminHeatmap';
import { EditShopperModal } from './EditShopperModal';
import { 
    generateSpreadsheetRow, 
    generateHRSpreadsheetRow, 
    generateHRSpreadsheetHTML,
    generateBulkHRSpreadsheetHTML,
    generateBulkHRSpreadsheetRow
} from '../utils/clipboardExport';

export const AdminDataView: React.FC = () => {
  const [data, setData] = useState<ShopperRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
  // Drag and Drop State & Refs
  const dragItem = useRef<{ index: number; group: string } | null>(null);
  const dragOverItem = useRef<{ index: number; group: string } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  
  // Edit Mode State
  const [editingShopper, setEditingShopper] = useState<ShopperRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Copy Feedback State: tracks which button in which group is showing "Success"
  // Key format: `${groupKey}-${type}` e.g., "2023-10-27-W1"
  const [copyFeedback, setCopyFeedback] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    setLoading(true);
    // Fetch order by Rank (primary) then created_at (secondary fallback)
    const { data: shoppers, error } = await supabase
      .from('shoppers')
      .select('*, shifts(*)')
      .order('rank', { ascending: true }) 
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

  // --- DRAG AND DROP HANDLERS ---
  const onDragStart = (e: React.DragEvent, index: number, group: string, id: string) => {
      dragItem.current = { index, group };
      setDraggingId(id);
      e.dataTransfer.effectAllowed = "move";
  };

  const onDragEnter = (e: React.DragEvent, index: number, group: string) => {
      if (!dragItem.current || dragItem.current.group !== group) return;
      
      dragOverItem.current = { index, group };
      
      const draggedIdx = dragItem.current.index;
      const overIdx = index;

      if (draggedIdx === overIdx) return;

      const groupKey = group;
      const groupItems = groupedData[groupKey]; 
      
      if (!groupItems) return;

      const newGroupItems = [...groupItems];
      const draggedItemContent = newGroupItems[draggedIdx];
      
      newGroupItems.splice(draggedIdx, 1);
      newGroupItems.splice(overIdx, 0, draggedItemContent);
      
      // Update local state immediately for visual feedback
      const itemsNotInGroup = data.filter(d => {
         const itemKey = format(new Date(d.created_at), 'yyyy-MM-dd');
         return itemKey !== groupKey;
      });
      
      const newData = [...itemsNotInGroup, ...newGroupItems];
      setData(newData);
      
      dragItem.current.index = overIdx;
  };

  const onDragEnd = async () => {
      const groupKey = dragItem.current?.group;
      
      dragItem.current = null;
      dragOverItem.current = null;
      setDraggingId(null);

      if (groupKey) {
          await saveNewOrder(groupKey);
      }
  };

  // Smart Save: Update ID and Rank
  const saveNewOrder = async (groupKey: string) => {
      setIsSavingOrder(true);
      try {
          // groupedData is derived from 'data', which has been updated by onDragEnter
          const itemsInGroup = groupedData[groupKey];
          if (!itemsInGroup) return;

          const updates = itemsInGroup.map((item, index) => ({
              id: item.id,
              rank: index,
              name: item.name,
              details: item.details
          }));

          const { error } = await supabase
              .from('shoppers')
              .upsert(updates, { onConflict: 'id' });

          if (error) {
              console.error('Supabase Upsert Error:', JSON.stringify(error));
              throw error;
          }
      } catch (e: any) {
          console.error("Error saving order:", e);
          alert(`Failed to save new order: ${e.message || JSON.stringify(e)}`);
          fetchData(); // Revert to server state on error
      } finally {
          setIsSavingOrder(false);
      }
  };

  // --- EXPORT TO CLIPBOARD HANDLERS ---
  
  // Single Copy
  const handleCopyForSheet = (shopper: ShopperRecord, weekOffset: number) => {
      try {
          const rowString = generateSpreadsheetRow(shopper, weekOffset);
          navigator.clipboard.writeText(rowString);
          const whichWeek = weekOffset === 0 ? "Week 1" : "Week 2";
          alert(`Copied ${whichWeek} data for ${shopper.name}!\n\nPN: ${shopper.details?.pnNumber || 'Not Set'}\n\nReady to paste into spreadsheet.`);
      } catch (e: any) {
          alert(e.message);
      }
  };

  const handleCopyLSInflow = async (shopper: ShopperRecord) => {
      try {
          const text = generateHRSpreadsheetRow(shopper);
          const html = generateHRSpreadsheetHTML(shopper);

          if (navigator.clipboard && typeof navigator.clipboard.write === 'function') {
             try {
                 const textBlob = new Blob([text], { type: 'text/plain' });
                 const htmlBlob = new Blob([html], { type: 'text/html' });
                 await navigator.clipboard.write([
                     new ClipboardItem({ 
                         'text/plain': textBlob, 
                         'text/html': htmlBlob 
                     })
                 ]);
             } catch (err) {
                 await navigator.clipboard.writeText(text);
             }
          } else {
             await navigator.clipboard.writeText(text);
          }
          alert(`Copied LS Inflow Data for ${shopper.name}!\n\nReady to paste.`);
      } catch(e: any) {
          alert("Clipboard error: " + e.message);
      }
  };

  // Trigger visual feedback
  const triggerFeedback = (groupKey: string, type: string) => {
      const key = `${groupKey}-${type}`;
      setCopyFeedback(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
          setCopyFeedback(prev => ({ ...prev, [key]: false }));
      }, 2000);
  };

  // Bulk Copy Handlers
  const handleBulkCopyWeek = (shoppers: ShopperRecord[], weekOffset: number, groupKey: string) => {
      try {
          const rows = shoppers.map(s => generateSpreadsheetRow(s, weekOffset)).join('\n');
          navigator.clipboard.writeText(rows);
          triggerFeedback(groupKey, weekOffset === 0 ? 'W1' : 'W2');
      } catch (e: any) {
          alert("Bulk copy failed: " + e.message);
      }
  };

  const handleBulkCopyLSInflow = async (shoppers: ShopperRecord[], groupKey: string) => {
      try {
          const text = generateBulkHRSpreadsheetRow(shoppers);
          const html = generateBulkHRSpreadsheetHTML(shoppers);

          if (navigator.clipboard && typeof navigator.clipboard.write === 'function') {
             try {
                 const textBlob = new Blob([text], { type: 'text/plain' });
                 const htmlBlob = new Blob([html], { type: 'text/html' });
                 await navigator.clipboard.write([
                     new ClipboardItem({ 
                         'text/plain': textBlob, 
                         'text/html': htmlBlob 
                     })
                 ]);
             } catch (err) {
                 await navigator.clipboard.writeText(text);
             }
          } else {
             await navigator.clipboard.writeText(text);
          }
          triggerFeedback(groupKey, 'LS');
      } catch (e: any) {
          alert("Bulk copy failed: " + e.message);
      }
  };

  // --- DELETE LOGIC ---
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deleteConfirmId !== id) {
        setDeleteConfirmId(id);
        setTimeout(() => setDeleteConfirmId(prev => (prev === id ? null : prev)), 3000);
        return;
    }

    try {
      const { error: shiftsError } = await supabase.from('shifts').delete().eq('shopper_id', id);
      if (shiftsError) throw new Error(shiftsError.message);

      const { error: shopperError, count } = await supabase.from('shoppers').delete({ count: 'exact' }).eq('id', id);
      if (shopperError) throw new Error(shopperError.message);

      if (count === 0) {
          alert("Error: Database reported success but 0 records were deleted.");
          setDeleteConfirmId(null);
          return;
      }
      setData(prev => prev.filter(item => item.id !== id));
      setDeleteConfirmId(null);
    } catch (err: any) {
      alert(`Error deleting record: ${err.message}`);
    }
  };

  // --- FILTER & GROUPING ---
  const filteredData = data.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedData = useMemo(() => {
    const groups: Record<string, ShopperRecord[]> = {};
    filteredData.forEach(item => {
        const dateObj = new Date(item.created_at);
        const key = format(dateObj, 'yyyy-MM-dd'); // Grouping Key
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });
    return groups;
  }, [filteredData]);

  // --- EXPORT CSV ---
  const getAAPatternString = (shifts: any[]) => {
      const aaShifts = shifts.filter(s => s.type === ShiftType.AA);
      if (aaShifts.length === 0) return 'None';
      const uniquePatterns = new Set<string>();
      aaShifts.forEach((s: any) => {
          try {
              const dayName = format(new Date(s.date), 'EEE');
              const timeShort = s.time.split('(')[0].trim();
              uniquePatterns.add(`${dayName} ${timeShort}`);
          } catch(e) {}
      });
      return Array.from(uniquePatterns).join(' & ');
  };

  const downloadCSV = () => {
    const headers = ['Name', 'PN Number', 'Registered At', 'First Working Day', 'Bus', 'Randstad', 'Address', 'AA Pattern', 'Shift Details'];
    const rows = filteredData.map(item => {
      const shiftSummary = item.shifts
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(s => `${s.date} (${s.time.split('(')[0].trim()} - ${s.type})`)
        .join('; ');

      const aaPattern = getAAPatternString(item.shifts);

      return [
        `"${item.name}"`,
        `"${item.details?.pnNumber || ''}"`,
        `"${format(new Date(item.created_at), 'yyyy-MM-dd HH:mm')}"`,
        `"${item.details?.firstWorkingDay || ''}"`,
        item.details?.usePicnicBus ? 'Yes' : 'No',
        item.details?.isRandstad ? 'Yes' : 'No',
        `"${item.details?.address || ''}"`,
        `"${aaPattern}"`,
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
      try { return format(new Date(dateStr), 'EEE, MMM do, yyyy'); } catch (e) { return dateStr; }
  };

  const renderAAPatternCell = (shifts: any[]) => {
      const patternString = getAAPatternString(shifts);
      if (patternString === 'None') return <span className="text-gray-300">-</span>;
      const parts = patternString.split(' & ');
      return (
          <div className="flex flex-col gap-1 items-start">
              {parts.map(p => (
                  <span key={p} className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded whitespace-nowrap">
                      {p}
                  </span>
              ))}
          </div>
      );
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
          <input type="text" placeholder="Search by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none transition-all" />
        </div>
        <div className="flex gap-2">
            {isSavingOrder && (
                <div className="flex items-center gap-2 text-xs font-bold text-green-600 bg-green-50 px-3 py-2 rounded-lg animate-pulse">
                    <SaveAll className="w-4 h-4" /> Saving Order...
                </div>
            )}
            <button onClick={fetchData} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors" title="Refresh"><RefreshCw className="w-5 h-5" /></button>
            <button onClick={downloadCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"><Download className="w-4 h-4" /> Export CSV</button>
        </div>
      </div>

      <AdminHeatmap data={data} />

      {/* GROUPED TABLES */}
      <div className="space-y-6">
        {Object.entries(groupedData).sort((a,b) => b[0].localeCompare(a[0])).map(([dateKey, items]: [string, ShopperRecord[]]) => (
            <div key={dateKey} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="bg-gray-50 border-b px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap">
                            <Clock className="w-5 h-5 text-purple-600" />
                            SER: {formatDateDisplay(dateKey)}
                        </h3>
                        <span className="text-xs font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                            {items.length} Shoppers
                        </span>
                    </div>
                    
                    {/* BULK ACTIONS */}
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        <button 
                            onClick={() => handleBulkCopyWeek(items, 0, dateKey)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm border ${
                                copyFeedback[`${dateKey}-W1`] 
                                ? 'bg-green-100 text-green-700 border-green-300' 
                                : 'bg-white border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300'
                            }`}
                            title="Copy Week 1 for ALL shoppers in this group"
                        >
                            {copyFeedback[`${dateKey}-W1`] ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} 
                            {copyFeedback[`${dateKey}-W1`] ? 'Copied' : 'W1'}
                        </button>
                        <button 
                            onClick={() => handleBulkCopyWeek(items, 1, dateKey)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm border ${
                                copyFeedback[`${dateKey}-W2`] 
                                ? 'bg-green-100 text-green-700 border-green-300' 
                                : 'bg-white border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300'
                            }`}
                            title="Copy Week 2 for ALL shoppers in this group"
                        >
                            {copyFeedback[`${dateKey}-W2`] ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} 
                            {copyFeedback[`${dateKey}-W2`] ? 'Copied' : 'W2'}
                        </button>
                        <button 
                            onClick={() => handleBulkCopyLSInflow(items, dateKey)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm border ${
                                copyFeedback[`${dateKey}-LS`] 
                                ? 'bg-blue-100 text-blue-700 border-blue-300' 
                                : 'bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300'
                            }`}
                            title="Copy LS Inflow for ALL shoppers in this group"
                        >
                            {copyFeedback[`${dateKey}-LS`] ? <Check className="w-3 h-3" /> : <FileSpreadsheet className="w-3 h-3" />} 
                            {copyFeedback[`${dateKey}-LS`] ? 'Copied' : 'LS'}
                        </button>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-white border-b text-gray-500 text-xs uppercase tracking-wider">
                                <th className="w-10"></th>
                                <th className="px-6 py-3 font-semibold">Name</th>
                                <th className="px-6 py-3 font-semibold">First Work Day</th>
                                <th className="px-6 py-3 font-semibold text-center">Info</th>
                                <th className="px-6 py-3 font-semibold">AA Pattern</th>
                                <th className="px-6 py-3 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {items.map((item, index) => (
                                <React.Fragment key={item.id}>
                                    <tr 
                                        className={`transition-all duration-200 cursor-grab active:cursor-grabbing ${
                                            expandedRow === item.id ? 'bg-purple-50/50' : ''
                                        } ${
                                            draggingId === item.id 
                                            ? 'opacity-50 bg-blue-50 border-2 border-dashed border-blue-300 scale-[0.98]' 
                                            : 'hover:bg-purple-50'
                                        }`}
                                        onClick={() => setExpandedRow(expandedRow === item.id ? null : item.id)}
                                        draggable={!searchTerm} // Disable drag when filtering
                                        onDragStart={(e) => onDragStart(e, index, dateKey, item.id)}
                                        onDragEnter={(e) => onDragEnter(e, index, dateKey)}
                                        onDragEnd={onDragEnd}
                                        onDragOver={(e) => e.preventDefault()}
                                    >
                                        <td className="px-2 text-center text-gray-300" onClick={(e) => e.stopPropagation()}>
                                            <GripVertical className={`w-4 h-4 mx-auto ${draggingId === item.id ? 'text-blue-500' : ''}`} />
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-600 font-bold text-xs">
                                                {item.name.substring(0,2).toUpperCase()}
                                            </div>
                                            {item.name}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {item.details?.firstWorkingDay ? format(new Date(item.details.firstWorkingDay), 'EEE, MMM d') : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                {item.details?.usePicnicBus && (
                                                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-[10px] font-bold border border-green-200" title="Uses Bus">BUS</span>
                                                )}
                                                {item.details?.isRandstad && (
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold border border-blue-200" title="Randstad Agency">RND</span>
                                                )}
                                                {item.details?.pnNumber && (
                                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-[10px] font-mono border border-gray-200" title={`PN: ${item.details.pnNumber}`}>PN</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {renderAAPatternCell(item.shifts)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); setEditingShopper(item); }} className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all" title="Edit Shopper"><Pencil className="w-4 h-4" /></button>
                                                <button onClick={(e) => handleDelete(e, item.id)} className={`p-2 rounded-lg transition-all border ${deleteConfirmId === item.id ? 'bg-red-600 text-white border-red-700 hover:bg-red-700 w-24 text-center' : 'text-gray-400 hover:text-red-600 hover:bg-red-50 border-transparent'}`} title="Delete Record">{deleteConfirmId === item.id ? <span className="text-xs font-bold">Confirm?</span> : <Trash2 className="w-4 h-4" />}</button>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedRow === item.id && (
                                        <tr className="bg-gray-50/50">
                                            <td colSpan={6} className="px-6 py-4">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2">
                                                    <div className="space-y-3 text-sm text-gray-600 border-r pr-6">
                                                        <h4 className="font-bold text-gray-900 flex items-center gap-2"><User className="w-4 h-4" /> Personal Details</h4>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <span>Clothing: <strong>{item.details?.clothingSize}</strong></span>
                                                            <span>Shoes: <strong>{item.details?.shoeSize}</strong></span>
                                                            <span>Gloves: <strong>{item.details?.gloveSize}</strong></span>
                                                            <span>Status: <strong>{item.details?.civilStatus}</strong></span>
                                                            <span>Gender: <strong>{item.details?.gender || 'N/D'}</strong></span>
                                                            {item.details?.pnNumber && (
                                                                <span className="col-span-2 font-mono text-xs bg-gray-100 px-2 py-1 rounded w-fit mt-1">
                                                                    PN: <strong>{item.details.pnNumber}</strong>
                                                                </span>
                                                            )}
                                                        </div>
                                                        {item.details?.isRandstad && (
                                                            <div className="mt-2 pt-2 border-t">
                                                                <div className="flex items-start gap-2 text-xs"><MapPin className="w-3 h-3 mt-0.5 shrink-0" />{item.details?.address || 'No address provided'}</div>
                                                            </div>
                                                        )}
                                                        <div className="mt-4 pt-4 border-t space-y-3">
                                                            <h5 className="font-bold text-gray-900 text-xs uppercase flex items-center gap-2"><Sheet className="w-3 h-3 text-green-600" /> Google Sheets Export</h5>
                                                            <div className="grid grid-cols-3 gap-3">
                                                                <button 
                                                                    onClick={() => handleCopyForSheet(item, 0)}
                                                                    className="flex flex-col items-center justify-center p-3 bg-white border border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50/30 hover:shadow-md transition-all group text-center"
                                                                >
                                                                    <div className="mb-2 p-2 rounded-full bg-gray-100 group-hover:bg-green-100 text-gray-500 group-hover:text-green-600 transition-colors">
                                                                        <Copy className="w-4 h-4" />
                                                                    </div>
                                                                    <span className="text-xs font-bold text-gray-700 group-hover:text-green-800">Copy Week 1</span>
                                                                </button>

                                                                <button 
                                                                    onClick={() => handleCopyForSheet(item, 1)}
                                                                    className="flex flex-col items-center justify-center p-3 bg-white border border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50/30 hover:shadow-md transition-all group text-center"
                                                                >
                                                                    <div className="mb-2 p-2 rounded-full bg-gray-100 group-hover:bg-green-100 text-gray-500 group-hover:text-green-600 transition-colors">
                                                                        <Copy className="w-4 h-4" />
                                                                    </div>
                                                                    <span className="text-xs font-bold text-gray-700 group-hover:text-green-800">Copy Week 2</span>
                                                                </button>

                                                                <button 
                                                                    onClick={() => handleCopyLSInflow(item)}
                                                                    className="flex flex-col items-center justify-center p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/30 hover:shadow-md transition-all group text-center"
                                                                >
                                                                    <div className="mb-2 p-2 rounded-full bg-gray-100 group-hover:bg-blue-100 text-gray-500 group-hover:text-blue-600 transition-colors">
                                                                        <FileSpreadsheet className="w-4 h-4" />
                                                                    </div>
                                                                    <span className="text-xs font-bold text-gray-700 group-hover:text-blue-800">Copy LS Inflow</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Calendar className="w-4 h-4" /> All Selected Shifts ({(item.shifts || []).length})</h4>
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                            {(item.shifts || []).length > 0 ? (
                                                                [...(item.shifts || [])].sort((a: any, b: any) => a.date.localeCompare(b.date)).map((shift: any, idx: number) => (
                                                                    <div key={idx} className={`p-2 rounded border text-xs ${shift.type === 'Always Available' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-green-50 border-green-100 text-green-700'}`}>
                                                                        <div className="font-bold">{formatDateDisplay(shift.date)}</div>
                                                                        <div className="truncate" title={shift.time}>{shift.time.split('(')[0]}</div>
                                                                    </div>
                                                                ))
                                                            ) : <span className="text-gray-400 italic text-sm">No shifts selected</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        ))}
        {Object.keys(groupedData).length === 0 && (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed">
                No submissions found matching your search.
            </div>
        )}
      </div>

      <EditShopperModal 
        shopper={editingShopper} 
        onClose={() => setEditingShopper(null)}
        onUpdate={(updatedShopper) => {
            setData(prev => prev.map(item => item.id === updatedShopper.id ? updatedShopper : item));
        }}
      />
    </div>
  );
};