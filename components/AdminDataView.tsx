import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Download, Search, RefreshCw, SaveAll, Copy, FileSpreadsheet, Check, Sun, Sunset, Bell, ArrowUpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ShopperRecord, ShiftType } from '../types';
import { AdminHeatmap } from './AdminHeatmap';
import { EditShopperModal } from './EditShopperModal';
import { ShopperTableRow } from './Admin/ShopperTableRow';
import { ShopperExpandedDetails } from './Admin/ShopperExpandedDetails';
import { 
    generateSpreadsheetRow, 
    generateBulkHRSpreadsheetHTML,
    generateBulkHRSpreadsheetRow
} from '../utils/clipboardExport';

// Helper to determine session key based on 12:30 cutoff
const getSessionGroupKey = (createdAt: string) => {
    const date = new Date(createdAt);
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Calculate minutes from midnight
    const minutes = date.getHours() * 60 + date.getMinutes();
    // 12:30 PM = 12 * 60 + 30 = 750 minutes
    // We use numeric prefixes to ensure correct sorting (Afternoon > Morning)
    const suffix = minutes < 750 ? '0_MORNING' : '1_AFTERNOON';
    
    return `${dateStr}_${suffix}`;
};

export const AdminDataView: React.FC = () => {
  const [data, setData] = useState<ShopperRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
  // Realtime State
  const [pendingShoppers, setPendingShoppers] = useState<ShopperRecord[]>([]);
  
  // Drag and Drop State & Refs
  const dragItem = useRef<{ index: number; group: string } | null>(null);
  const dragOverItem = useRef<{ index: number; group: string } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  
  // Edit/Delete State
  const [editingShopper, setEditingShopper] = useState<ShopperRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Copy Feedback State
  const [copyFeedback, setCopyFeedback] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    setLoading(true);
    const { data: shoppers, error } = await supabase
      .from('shoppers')
      .select('*, shifts(*)')
      .order('rank', { ascending: true }) 
      .order('created_at', { ascending: false });

    if (!error) setData(shoppers || []);
    setLoading(false);
  };

  useEffect(() => { 
      fetchData(); 

      // --- REALTIME SUBSCRIPTION ---
      // This sets up the listener for new rows in the 'shoppers' table
      const channel = supabase
        .channel('shoppers_changes')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'shoppers' },
            async (payload) => {
                const newId = (payload.new as any).id;
                
                // We wait 1 second to ensure the 'shifts' (which are inserted after the shopper)
                // are fully committed to the DB before we fetch the full record.
                setTimeout(async () => {
                    const { data: fullRecord } = await supabase
                        .from('shoppers')
                        .select('*, shifts(*)')
                        .eq('id', newId)
                        .single();
                    
                    if (fullRecord) {
                        setPendingShoppers(prev => {
                            // Avoid duplicates if multiple events fire
                            if (prev.find(p => p.id === fullRecord.id)) return prev;
                            return [fullRecord, ...prev];
                        });
                    }
                }, 1000);
            }
        )
        .subscribe();

      // Cleanup listener on unmount
      return () => { supabase.removeChannel(channel); };
  }, []);

  const handleMergePending = () => {
      // Merge pending items into the main list
      setData(prev => [...pendingShoppers, ...prev]);
      // Clear the pending queue
      setPendingShoppers([]);
  };

  // --- DRAG AND DROP ---
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
      
      // Update global data: Keep items NOT in this specific session group, and append the reordered group
      const itemsNotInGroup = data.filter(d => getSessionGroupKey(d.created_at) !== groupKey);
      setData([...itemsNotInGroup, ...newGroupItems]);
      dragItem.current.index = overIdx;
  };

  const onDragEnd = async () => {
      const groupKey = dragItem.current?.group;
      dragItem.current = null;
      dragOverItem.current = null;
      setDraggingId(null);
      if (groupKey) await saveNewOrder(groupKey);
  };

  const saveNewOrder = async (groupKey: string) => {
      setIsSavingOrder(true);
      try {
          const itemsInGroup = groupedData[groupKey];
          if (!itemsInGroup) return;
          const updates = itemsInGroup.map((item, index) => ({
              id: item.id,
              rank: index,
              name: item.name,
              details: item.details
          }));
          await supabase.from('shoppers').upsert(updates, { onConflict: 'id' });
      } catch (e) { fetchData(); } 
      finally { setIsSavingOrder(false); }
  };

  // --- BULK COPY HANDLERS ---
  const triggerFeedback = (groupKey: string, type: string) => {
      const key = `${groupKey}-${type}`;
      setCopyFeedback(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setCopyFeedback(prev => ({ ...prev, [key]: false })), 2000);
  };

  const handleBulkCopyWeek = (shoppers: ShopperRecord[], weekOffset: number, groupKey: string) => {
      try {
          const rows = shoppers.map(s => generateSpreadsheetRow(s, weekOffset)).join('\n');
          navigator.clipboard.writeText(rows);
          triggerFeedback(groupKey, weekOffset === 0 ? 'W1' : 'W2');
      } catch (e: any) { alert("Bulk copy failed: " + e.message); }
  };

  const handleBulkCopyLSInflow = async (shoppers: ShopperRecord[], groupKey: string) => {
      try {
          const text = generateBulkHRSpreadsheetRow(shoppers);
          const html = generateBulkHRSpreadsheetHTML(shoppers);
          if (navigator.clipboard && typeof navigator.clipboard.write === 'function') {
             try {
                 await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) })]);
             } catch (err) { await navigator.clipboard.writeText(text); }
          } else { await navigator.clipboard.writeText(text); }
          triggerFeedback(groupKey, 'LS');
      } catch (e: any) { alert("Bulk copy failed: " + e.message); }
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
      await supabase.from('shifts').delete().eq('shopper_id', id);
      await supabase.from('shoppers').delete().eq('id', id);
      setData(prev => prev.filter(item => item.id !== id));
      setDeleteConfirmId(null);
    } catch (err: any) { alert(`Error: ${err.message}`); }
  };

  // --- CSV Export ---
  const downloadCSV = () => {
    const headers = ['Name', 'PN Number', 'Registered At', 'First Working Day', 'Bus', 'Randstad', 'Address', 'AA Pattern', 'Shift Details'];
    const rows = filteredData.map(item => {
      const shiftSummary = item.shifts.map(s => `${s.date} (${s.time.split('(')[0].trim()} - ${s.type})`).join('; ');
      const aaShifts = item.shifts.filter(s => s.type === ShiftType.AA);
      const aaPattern = aaShifts.length ? Array.from(new Set(aaShifts.map(s => `${format(new Date(s.date), 'EEE')} ${s.time.split('(')[0]}`))).join(' & ') : 'None';
      
      return [
        `"${item.name}"`, `"${item.details?.pnNumber || ''}"`, `"${format(new Date(item.created_at), 'yyyy-MM-dd HH:mm')}"`,
        `"${item.details?.firstWorkingDay || ''}"`, item.details?.usePicnicBus ? 'Yes' : 'No', item.details?.isRandstad ? 'Yes' : 'No',
        `"${item.details?.address || ''}"`, `"${aaPattern}"`, `"${shiftSummary}"`
      ].join(',');
    });
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `shoppers_export_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  const filteredData = data.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  
  // Updated Grouping Logic: Date + Session (Morning/Afternoon)
  const groupedData = useMemo(() => {
    const groups: Record<string, ShopperRecord[]> = {};
    filteredData.forEach(item => {
        const key = getSessionGroupKey(item.created_at);
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });
    return groups;
  }, [filteredData]);

  const formatDateDisplay = (dateStr: string) => {
      try { return format(new Date(dateStr), 'EEE, MMM do, yyyy'); } catch (e) { return dateStr; }
  };

  if (loading) return <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-3"><RefreshCw className="w-8 h-8 animate-spin text-purple-600" /><p>Loading records...</p></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in relative">
      
      {/* REALTIME NOTIFICATION PILL */}
      {/* This only appears when there are new shoppers in the pending queue */}
      {pendingShoppers.length > 0 && (
          <div className="sticky top-2 z-30 flex justify-center animate-in slide-in-from-top-4 duration-500">
              <button 
                onClick={handleMergePending}
                className="bg-gray-900 text-white pl-4 pr-3 py-2.5 rounded-full shadow-2xl flex items-center gap-3 hover:bg-black transition-all hover:scale-105 active:scale-95 group"
              >
                  <div className="relative">
                      <Bell className="w-4 h-4 text-yellow-400" />
                      <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                  </div>
                  <div className="flex flex-col text-left">
                      <span className="text-sm font-bold leading-none">{pendingShoppers.length} New Submission{pendingShoppers.length > 1 ? 's' : ''}</span>
                      <span className="text-[10px] text-gray-400 font-medium">Click to update list</span>
                  </div>
                  <div className="bg-gray-800 rounded-full p-1 group-hover:bg-gray-700 ml-2">
                     <ArrowUpCircle className="w-5 h-5 text-green-400" />
                  </div>
              </button>
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none transition-all" />
        </div>
        <div className="flex gap-2">
            {isSavingOrder && <div className="flex items-center gap-2 text-xs font-bold text-green-600 bg-green-50 px-3 py-2 rounded-lg animate-pulse"><SaveAll className="w-4 h-4" /> Saving Order...</div>}
            <button onClick={fetchData} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"><RefreshCw className="w-5 h-5" /></button>
            <button onClick={downloadCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm"><Download className="w-4 h-4" /> Export CSV</button>
        </div>
      </div>

      <AdminHeatmap data={data} />

      <div className="space-y-6">
        {Object.entries(groupedData).sort((a,b) => b[0].localeCompare(a[0])).map(([fullGroupKey, items]) => {
            // Extract Date and Session from Key "yyyy-MM-dd_SUFFIX"
            const datePart = fullGroupKey.substring(0, 10);
            const isMorning = fullGroupKey.includes('0_MORNING');
            
            return (
            <div key={fullGroupKey} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className={`border-b px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4 ${isMorning ? 'bg-orange-50/50' : 'bg-indigo-50/50'}`}>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className={`p-2 rounded-lg ${isMorning ? 'bg-orange-100 text-orange-600' : 'bg-indigo-100 text-indigo-600'}`}>
                             {isMorning ? <Sun className="w-5 h-5" /> : <Sunset className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap">
                                {formatDateDisplay(datePart)}
                            </h3>
                            <div className="flex items-center gap-2 text-xs font-medium opacity-70">
                                {isMorning ? 'Morning Session (< 12:30)' : 'Afternoon Session (≥ 12:30)'}
                                <span className="bg-white px-2 py-0.5 rounded-full border shadow-sm text-gray-900 font-bold">{items.length} Shoppers</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        <button onClick={() => handleBulkCopyWeek(items, 0, fullGroupKey)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${copyFeedback[`${fullGroupKey}-W1`] ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white border-green-200 text-green-700 hover:bg-green-50'}`}>
                            {copyFeedback[`${fullGroupKey}-W1`] ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copyFeedback[`${fullGroupKey}-W1`] ? 'Copied' : 'W1'}
                        </button>
                        <button onClick={() => handleBulkCopyWeek(items, 1, fullGroupKey)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${copyFeedback[`${fullGroupKey}-W2`] ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white border-green-200 text-green-700 hover:bg-green-50'}`}>
                            {copyFeedback[`${fullGroupKey}-W2`] ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copyFeedback[`${fullGroupKey}-W2`] ? 'Copied' : 'W2'}
                        </button>
                        <button onClick={() => handleBulkCopyLSInflow(items, fullGroupKey)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${copyFeedback[`${fullGroupKey}-LS`] ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white border-blue-200 text-blue-700 hover:bg-blue-50'}`}>
                            {copyFeedback[`${fullGroupKey}-LS`] ? <Check className="w-3 h-3" /> : <FileSpreadsheet className="w-3 h-3" />} {copyFeedback[`${fullGroupKey}-LS`] ? 'Copied' : 'LS'}
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-white border-b text-gray-500 text-xs uppercase tracking-wider">
                                <th className="w-10"></th><th className="px-6 py-3 font-semibold">Name</th>
                                <th className="px-6 py-3 font-semibold">First Work Day</th><th className="px-6 py-3 font-semibold text-center">Info</th>
                                <th className="px-6 py-3 font-semibold">AA Pattern</th><th className="px-6 py-3 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {items.map((item, index) => (
                                <React.Fragment key={item.id}>
                                    <ShopperTableRow 
                                        shopper={item} index={index} groupKey={fullGroupKey} expandedRow={expandedRow} setExpandedRow={setExpandedRow}
                                        draggingId={draggingId} deleteConfirmId={deleteConfirmId} searchTerm={searchTerm}
                                        onDragStart={onDragStart} onDragEnter={onDragEnter} onDragEnd={onDragEnd}
                                        onEdit={setEditingShopper} onDelete={handleDelete}
                                    />
                                    {expandedRow === item.id && <ShopperExpandedDetails shopper={item} />}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            );
        })}
        {Object.keys(groupedData).length === 0 && <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed">No submissions found.</div>}
      </div>

      <EditShopperModal shopper={editingShopper} onClose={() => setEditingShopper(null)} onUpdate={(updated) => setData(prev => prev.map(i => i.id === updated.id ? updated : i))} />
    </div>
  );
};