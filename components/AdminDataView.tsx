
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Download, Search, RefreshCw, SaveAll, Copy, FileSpreadsheet, Check, Sun, Sunset, Bell, ArrowUpCircle, Pencil, Trash2, ChevronDown, ChevronUp, CalendarRange, Clock, AlertCircle } from 'lucide-react';
import { format, startOfWeek, parseISO, isValid } from 'date-fns';
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

type ViewMode = 'SESSION' | 'START_DATE';

// Helper to determine session key based on 12:30 cutoff (Submission Time)
const getSessionGroupKey = (createdAt: string) => {
    const date = new Date(createdAt);
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Calculate minutes from midnight
    const minutes = date.getHours() * 60 + date.getMinutes();
    // 12:30 PM = 12 * 60 + 30 = 750 minutes
    const suffix = minutes < 750 ? '0_MORNING' : '1_AFTERNOON';
    
    return `${dateStr}_${suffix}`;
};

// Helper to determine start week key (Start Date)
const getStartDateGroupKey = (firstWorkingDay?: string) => {
    if (!firstWorkingDay) return '9999-99-99_NO_DATE'; // Fallback for missing dates
    
    try {
        const date = parseISO(firstWorkingDay);
        if (!isValid(date)) return '9999-99-99_INVALID';

        // Get the Monday of that week
        const monday = startOfWeek(date, { weekStartsOn: 1 });
        return format(monday, 'yyyy-MM-dd');
    } catch (e) {
        return '9999-99-99_ERROR';
    }
};

export const AdminDataView: React.FC = () => {
  const [data, setData] = useState<ShopperRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('SESSION');
  
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
      const channel = supabase
        .channel('shoppers_changes')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'shoppers' },
            async (payload) => {
                const newId = (payload.new as any).id;
                setTimeout(async () => {
                    const { data: fullRecord } = await supabase
                        .from('shoppers')
                        .select('*, shifts(*)')
                        .eq('id', newId)
                        .single();
                    
                    if (fullRecord) {
                        setPendingShoppers(prev => {
                            if (prev.find(p => p.id === fullRecord.id)) return prev;
                            return [fullRecord, ...prev];
                        });
                    }
                }, 1000);
            }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
  }, []);

  const handleMergePending = () => {
      setData(prev => [...pendingShoppers, ...prev]);
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
      
      const itemsNotInGroup = data.filter(d => {
          if (viewMode === 'SESSION') return getSessionGroupKey(d.created_at) !== groupKey;
          return getStartDateGroupKey(d.details?.firstWorkingDay) !== groupKey;
      });
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
  const triggerFeedback = (key: string) => {
      setCopyFeedback(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setCopyFeedback(prev => ({ ...prev, [key]: false })), 2000);
  };

  const handleBulkCopyWeek = (shoppers: ShopperRecord[], weekOffset: number, feedbackKey: string) => {
      try {
          const rows = shoppers.map(s => generateSpreadsheetRow(s, weekOffset)).join('\n');
          navigator.clipboard.writeText(rows);
          triggerFeedback(feedbackKey);
      } catch (e: any) { alert("Bulk copy failed: " + e.message); }
  };

  const handleBulkCopyLSInflow = async (shoppers: ShopperRecord[], feedbackKey: string) => {
      try {
          const text = generateBulkHRSpreadsheetRow(shoppers);
          const html = generateBulkHRSpreadsheetHTML(shoppers);
          if (navigator.clipboard && typeof navigator.clipboard.write === 'function') {
             try {
                 await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) })]);
             } catch (err) { await navigator.clipboard.writeText(text); }
          } else { await navigator.clipboard.writeText(text); }
          triggerFeedback(feedbackKey);
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
  
  const groupedData = useMemo(() => {
    const groups: Record<string, ShopperRecord[]> = {};
    filteredData.forEach(item => {
        let key: string;
        if (viewMode === 'SESSION') {
            key = getSessionGroupKey(item.created_at);
        } else {
            key = getStartDateGroupKey(item.details?.firstWorkingDay);
        }

        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });
    return groups;
  }, [filteredData, viewMode]);

  const formatHeaderDisplay = (groupKey: string) => {
      if (viewMode === 'SESSION') {
          const datePart = groupKey.substring(0, 10);
          const isMorning = groupKey.includes('0_MORNING');
          const dateDisplay = isValid(parseISO(datePart)) ? format(parseISO(datePart), 'EEE, MMM do') : datePart;
          return {
              title: dateDisplay,
              subtitle: isMorning ? 'Morning Session' : 'Afternoon Session',
              icon: isMorning ? <Sun className="w-5 h-5" /> : <Sunset className="w-5 h-5" />,
              colorClass: isMorning ? 'bg-orange-100 text-orange-600' : 'bg-indigo-100 text-indigo-600',
              bgClass: isMorning ? 'bg-orange-50/50' : 'bg-indigo-50/50'
          };
      } else {
          // START_DATE View
          if (groupKey.includes('NO_DATE')) {
              return { title: 'No Start Date Set', subtitle: 'Pending setup', icon: <Clock className="w-5 h-5" />, colorClass: 'bg-gray-200 text-gray-600', bgClass: 'bg-gray-100' };
          }
          const dateDisplay = isValid(parseISO(groupKey)) ? format(parseISO(groupKey), 'MMM do') : groupKey;
          let rangeString = dateDisplay;
          if (isValid(parseISO(groupKey))) {
             const end = new Date(parseISO(groupKey));
             end.setDate(end.getDate() + 6);
             rangeString = `${dateDisplay} - ${format(end, 'MMM do')}`;
          }

          return {
              title: `Week of ${dateDisplay}`,
              subtitle: `Starting Week Group`,
              icon: <CalendarRange className="w-5 h-5" />,
              colorClass: 'bg-emerald-100 text-emerald-600',
              bgClass: 'bg-emerald-50/50'
          };
      }
  };

  // HELPER TO SUB-GROUP SHOPPERS BY START WEEK
  const getSubGroupsByStartWeek = (items: ShopperRecord[]) => {
      const subGroups: Record<string, ShopperRecord[]> = {};
      items.forEach(item => {
          let key = 'Unknown Start';
          if (item.details?.firstWorkingDay) {
              const date = parseISO(item.details.firstWorkingDay);
              if (isValid(date)) {
                  // Group by Monday of that week
                  const monday = startOfWeek(date, { weekStartsOn: 1 });
                  key = format(monday, 'yyyy-MM-dd');
              }
          }
          if (!subGroups[key]) subGroups[key] = [];
          subGroups[key].push(item);
      });
      return subGroups;
  };

  if (loading) return <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-3"><RefreshCw className="w-8 h-8 animate-spin text-purple-600" /><p>Loading records...</p></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in relative">
      
      {/* REALTIME NOTIFICATION PILL */}
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

      {/* CONTROLS BAR */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none transition-all" />
            </div>
            
            {/* VIEW MODE TOGGLE */}
            <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
                <button 
                    onClick={() => setViewMode('SESSION')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'SESSION' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    By Session
                </button>
                <button 
                    onClick={() => setViewMode('START_DATE')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'START_DATE' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    By Start Date
                </button>
            </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {isSavingOrder && <div className="flex items-center gap-2 text-xs font-bold text-green-600 bg-green-50 px-3 py-2 rounded-lg animate-pulse whitespace-nowrap"><SaveAll className="w-4 h-4" /> Saving Order...</div>}
            <button onClick={fetchData} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors shrink-0"><RefreshCw className="w-5 h-5" /></button>
            <button onClick={downloadCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm whitespace-nowrap shrink-0"><Download className="w-4 h-4" /> Export CSV</button>
        </div>
      </div>

      <AdminHeatmap data={data} />

      <div className="space-y-6">
        {Object.entries(groupedData).sort((a,b) => b[0].localeCompare(a[0])).map(([fullGroupKey, items]: [string, ShopperRecord[]]) => {
            const headerInfo = formatHeaderDisplay(fullGroupKey);
            
            // ANALYZE SUB-GROUPS (for Intelligent Export)
            const subGroups = getSubGroupsByStartWeek(items);
            const subGroupKeys = Object.keys(subGroups).sort();
            const hasMultipleCohorts = subGroupKeys.length > 1;

            return (
            <div key={fullGroupKey} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className={`border-b px-4 md:px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4 ${headerInfo.bgClass}`}>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className={`p-2 rounded-lg ${headerInfo.colorClass}`}>
                             {headerInfo.icon}
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap text-sm md:text-base">
                                {headerInfo.title}
                            </h3>
                            <div className="flex items-center gap-2 text-xs font-medium opacity-70 flex-wrap">
                                {headerInfo.subtitle}
                                <span className="bg-white px-2 py-0.5 rounded-full border shadow-sm text-gray-900 font-bold whitespace-nowrap">{items.length} Shoppers</span>
                            </div>
                        </div>
                    </div>

                    {/* INTELLIGENT EXPORT SECTION */}
                    <div className="flex flex-col w-full md:w-auto items-end gap-2">
                         {subGroupKeys.map((subKey) => {
                             const cohort = subGroups[subKey];
                             // If only 1 group exists, show simple buttons. If multiple, show labels.
                             const showLabel = hasMultipleCohorts;
                             const dateLabel = isValid(parseISO(subKey)) ? `Start Week: ${format(parseISO(subKey), 'MMM do')}` : subKey;
                             
                             return (
                                 <div key={subKey} className={`flex items-center gap-3 ${showLabel ? 'bg-white/60 p-1.5 rounded-lg border border-gray-100 shadow-sm' : ''}`}>
                                     {showLabel && (
                                         <div className="text-[10px] font-bold text-gray-500 flex items-center gap-1.5 pl-1 border-r pr-2 mr-1">
                                             <CalendarRange className="w-3 h-3 text-purple-500" />
                                             <span className="whitespace-nowrap">{dateLabel} <span className="text-gray-400">({cohort.length})</span></span>
                                         </div>
                                     )}
                                     
                                     <div className="flex gap-1.5 overflow-x-auto">
                                        <button 
                                            onClick={() => handleBulkCopyWeek(cohort, 0, `${fullGroupKey}-${subKey}-W1`)} 
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border whitespace-nowrap ${copyFeedback[`${fullGroupKey}-${subKey}-W1`] ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white border-green-200 text-green-700 hover:bg-green-50'}`}
                                        >
                                            {copyFeedback[`${fullGroupKey}-${subKey}-W1`] ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copyFeedback[`${fullGroupKey}-${subKey}-W1`] ? 'Copied' : 'W1'}
                                        </button>
                                        <button 
                                            onClick={() => handleBulkCopyWeek(cohort, 1, `${fullGroupKey}-${subKey}-W2`)} 
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border whitespace-nowrap ${copyFeedback[`${fullGroupKey}-${subKey}-W2`] ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white border-green-200 text-green-700 hover:bg-green-50'}`}
                                        >
                                            {copyFeedback[`${fullGroupKey}-${subKey}-W2`] ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copyFeedback[`${fullGroupKey}-${subKey}-W2`] ? 'Copied' : 'W2'}
                                        </button>
                                        <button 
                                            onClick={() => handleBulkCopyLSInflow(cohort, `${fullGroupKey}-${subKey}-LS`)} 
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border whitespace-nowrap ${copyFeedback[`${fullGroupKey}-${subKey}-LS`] ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white border-blue-200 text-blue-700 hover:bg-blue-50'}`}
                                        >
                                            {copyFeedback[`${fullGroupKey}-${subKey}-LS`] ? <Check className="w-3 h-3" /> : <FileSpreadsheet className="w-3 h-3" />} {copyFeedback[`${fullGroupKey}-${subKey}-LS`] ? 'Copied' : 'LS'}
                                        </button>
                                     </div>
                                 </div>
                             );
                         })}
                    </div>
                </div>

                {/* DESKTOP VIEW TABLE */}
                <div className="hidden md:block overflow-x-auto">
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
                                    {expandedRow === item.id && (
                                        <tr>
                                            <td colSpan={6}>
                                                <ShopperExpandedDetails shopper={item} />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* MOBILE VIEW LIST (Cards) */}
                <div className="md:hidden bg-gray-50/50 p-3 space-y-3">
                    {items.map((item) => (
                         <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3">
                             <div className="flex justify-between items-start">
                                 <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-600 font-bold text-xs">
                                         {item.name.substring(0,2).toUpperCase()}
                                     </div>
                                     <div>
                                         <h4 className="font-bold text-gray-900">{item.name}</h4>
                                         <div className="text-xs text-gray-500">
                                            FWD: {item.details?.firstWorkingDay ? format(new Date(item.details.firstWorkingDay), 'MMM d') : '-'}
                                         </div>
                                     </div>
                                 </div>
                                 
                                 <div className="flex gap-2">
                                     <button 
                                         onClick={(e) => { e.stopPropagation(); setEditingShopper(item); }} 
                                         className="p-2 text-gray-400 bg-gray-50 rounded-lg"
                                     >
                                         <Pencil className="w-4 h-4" />
                                     </button>
                                     <button 
                                         onClick={(e) => handleDelete(e, item.id)} 
                                         className={`p-2 rounded-lg transition-all ${deleteConfirmId === item.id ? 'bg-red-600 text-white' : 'bg-gray-50 text-gray-400'}`} 
                                     >
                                         {deleteConfirmId === item.id ? '?' : <Trash2 className="w-4 h-4" />}
                                     </button>
                                 </div>
                             </div>
                             
                             <div className="flex gap-2 text-[10px] font-bold">
                                 {item.details?.usePicnicBus && (
                                     <span className="px-2 py-1 bg-green-100 text-green-700 rounded border border-green-200">BUS</span>
                                 )}
                                 {item.details?.isRandstad && (
                                     <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded border border-blue-200">RND</span>
                                 )}
                                 {item.details?.pnNumber && (
                                     <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded border border-gray-200 font-mono">PN</span>
                                 )}
                             </div>

                             <button 
                                 onClick={() => setExpandedRow(expandedRow === item.id ? null : item.id)}
                                 className="w-full py-2 bg-gray-50 text-xs font-bold text-gray-500 rounded-lg flex items-center justify-center gap-1 hover:bg-gray-100"
                             >
                                 {expandedRow === item.id ? 'Hide Details' : 'Show Details'}
                                 {expandedRow === item.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                             </button>

                             {expandedRow === item.id && (
                                 <div className="border-t pt-3 mt-1">
                                     <ShopperExpandedDetails shopper={item} />
                                 </div>
                             )}
                         </div>
                    ))}
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
