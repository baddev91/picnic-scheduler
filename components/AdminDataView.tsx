
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Download, Search, RefreshCw, SaveAll, Copy, FileSpreadsheet, Check, Sun, Sunset, Bell, ArrowUpCircle, Pencil, Trash2, ChevronDown, ChevronUp, CalendarRange, Clock, AlertCircle, Users, ArrowRight, Calendar, Sunrise, Moon, Stethoscope, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { format, startOfWeek, parseISO, isValid, addWeeks, addDays } from 'date-fns';
import { ShopperRecord, ShiftType } from '../types';
import { AdminHeatmap } from './AdminHeatmap';
import { EditShopperModal } from './EditShopperModal';
import { ShopperTableRow } from './Admin/ShopperTableRow';
import { ShopperExpandedDetails } from './Admin/ShopperExpandedDetails';
import { validateShopperSchedule } from '../utils/validation';
import { 
    generateSpreadsheetRow, 
    generateBulkHRSpreadsheetRow
} from '../utils/clipboardExport';

type ViewMode = 'SESSION' | 'FWD_SHIFT';

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

// Helper to determine FWD + Shift Key
const getFWDGroupKey = (shopper: ShopperRecord) => {
    const fwd = shopper.details?.firstWorkingDay;
    if (!fwd) return '9999-99-99_NO_DATE';
    
    // Find the shift object corresponding to the First Working Day
    const fwdShift = shopper.shifts.find(s => s.date === fwd);
    
    if (!fwdShift) return `${fwd}_UNKNOWN_SHIFT`;

    // Extract shift name (e.g., "Morning", "Afternoon") and normalize
    // We add a numeric prefix to ensure Morning sorts before Afternoon in standard string sort if needed
    // Opening (04:00) -> 0
    // Morning (06:00) -> 1
    // Noon (12:55) -> 2
    // Afternoon (14:55) -> 3
    let sortIndex = 9;
    const timeStr = fwdShift.time;
    
    if (timeStr.includes('Opening')) sortIndex = 0;
    else if (timeStr.includes('Morning')) sortIndex = 1;
    else if (timeStr.includes('Noon')) sortIndex = 2;
    else if (timeStr.includes('Afternoon')) sortIndex = 3;

    const simpleName = timeStr.split('(')[0].trim().toUpperCase().replace(' ', '_');
    
    return `${fwd}_${sortIndex}_${simpleName}`;
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

  // Compliance Check State
  const [complianceIssues, setComplianceIssues] = useState<Record<string, string[]>>({});
  const [checkStatus, setCheckStatus] = useState<'IDLE' | 'CHECKING' | 'SUCCESS' | 'ISSUES'>('IDLE');
  const [issueCount, setIssueCount] = useState(0);

  // Refs for Scroll to Today Logic
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Use a ref to track the ID of the shopper currently being edited
  // This allows fetchData to update the modal content without stale closures
  const editingShopperIdRef = useRef<string | null>(null);
  useEffect(() => { editingShopperIdRef.current = editingShopper?.id || null; }, [editingShopper]);

  const fetchData = async () => {
    setLoading(true);
    const { data: shoppers, error } = await supabase
      .from('shoppers')
      .select('*, shifts(*)')
      .order('rank', { ascending: true }) 
      .order('created_at', { ascending: false });

    if (!error && shoppers) {
        setData(shoppers);
        // If we are currently editing someone, update their record in the modal to match DB
        if (editingShopperIdRef.current) {
            const current = shoppers.find(s => s.id === editingShopperIdRef.current);
            if (current) setEditingShopper(current);
        }
        // If we previously ran compliance check, re-run it on new data
        if (Object.keys(complianceIssues).length > 0) {
            runComplianceCheck(shoppers, true); // Silent run
        }
    }
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

  // --- COMPLIANCE CHECKER ---
  const runComplianceCheck = (dataSet = data, silent = false) => {
      if (!silent) setCheckStatus('CHECKING');
      
      const newIssues: Record<string, string[]> = {};
      
      dataSet.forEach(shopper => {
          const issues = validateShopperSchedule(shopper.shifts);
          if (issues.length > 0) {
              newIssues[shopper.id] = issues;
          }
      });
      
      const count = Object.keys(newIssues).length;
      
      // Artificial delay for UX "heft" if manual click
      const delay = silent ? 0 : 600;

      setTimeout(() => {
          setComplianceIssues(newIssues);
          setIssueCount(count);

          if (!silent) {
            setCheckStatus(count > 0 ? 'ISSUES' : 'SUCCESS');
            // Auto hide success toast after 3s
            if (count === 0) {
                setTimeout(() => setCheckStatus('IDLE'), 3000);
            } else {
                 // For issues, keep it visible longer (5s)
                setTimeout(() => setCheckStatus('IDLE'), 5000);
            }
          }
      }, delay);
  };

  // --- ATTENDANCE STATUS UPDATE ---
  const handleStatusUpdate = async (id: string, status: 'PENDING' | 'SHOWED_UP' | 'NO_SHOW') => {
      // Optimistic Update
      setData(prev => prev.map(s => {
          if (s.id === id) {
              return { ...s, details: { ...s.details, firstDayStatus: status } };
          }
          return s;
      }));

      // Supabase Update
      const shopper = data.find(s => s.id === id);
      if (shopper) {
          const newDetails = { ...shopper.details, firstDayStatus: status };
          await supabase.from('shoppers').update({ details: newDetails }).eq('id', id);
      }
  };

  // --- UPDATE SHOPPER GENERIC (Used for Notes) ---
  const handleUpdateShopper = (updatedShopper: ShopperRecord) => {
      setData(prev => prev.map(s => s.id === updatedShopper.id ? updatedShopper : s));
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
          return getFWDGroupKey(d) !== groupKey;
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

  // NEW: Smart Calendar Export
  // This aggregates mixed start dates into unified calendar weeks
  const handleSmartCalendarExport = (
      entries: { shopper: ShopperRecord, offset: number }[],
      feedbackKey: string
  ) => {
      try {
          // Sort entries by name for consistency inside the copy
          entries.sort((a, b) => a.shopper.name.localeCompare(b.shopper.name));

          const rows = entries.map(entry => {
              // Reuse existing logic: generate row for this shopper at this specific offset (W1 or W2)
              return generateSpreadsheetRow(entry.shopper, entry.offset);
          }).join('\n');
          
          navigator.clipboard.writeText(rows);
          triggerFeedback(feedbackKey);
      } catch (e: any) { alert("Bulk copy failed: " + e.message); }
  };

  const handleBulkCopyLSInflow = async (shoppers: ShopperRecord[], feedbackKey: string) => {
      try {
          // Use PLAIN TEXT to allow spreadsheets to auto-detect booleans (1/0)
          const text = generateBulkHRSpreadsheetRow(shoppers);
          await navigator.clipboard.writeText(text);
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
      // 1. Snapshot the shifts before deleting!
      const shopperToDelete = data.find(s => s.id === id);
      
      if (shopperToDelete && shopperToDelete.shifts && shopperToDelete.shifts.length > 0) {
          await supabase.from('shoppers').update({ 
             details: { 
                 ...shopperToDelete.details, 
                 _archived_shifts: shopperToDelete.shifts 
             }
          }).eq('id', id);
      }

      await supabase.from('shifts').delete().eq('shopper_id', id);
      await supabase.from('shoppers').delete().eq('id', id);

      setData(prev => prev.filter(item => item.id !== id));
      setDeleteConfirmId(null);
    } catch (err: any) { alert(`Error: ${err.message}`); }
  };

  // --- CSV Export ---
  const downloadCSV = () => {
    const headers = ['Name', 'PN Number', 'Registered At', 'First Working Day', 'Attendance Status', 'Bus', 'Randstad', 'Address', 'AA Pattern', 'Notes', 'Shift Details'];
    const rows = filteredData.map(item => {
      const shiftSummary = item.shifts.map(s => {
          // Replace internal enum 'Always Available' with 'Agreed Availability' for display
          const displayType = s.type === ShiftType.AA ? 'Agreed Availability' : s.type;
          return `${s.date} (${s.time.split('(')[0].trim()} - ${displayType})`;
      }).join('; ');
      
      const aaShifts = item.shifts.filter(s => s.type === ShiftType.AA);
      const aaPattern = aaShifts.length ? Array.from(new Set(aaShifts.map(s => `${format(new Date(s.date), 'EEE')} ${s.time.split('(')[0]}`))).join(' & ') : 'None';
      
      // Escape quotes in notes
      const notes = item.details?.notes ? item.details.notes.replace(/"/g, '""') : '';

      return [
        `"${item.name}"`, `"${item.details?.pnNumber || ''}"`, `"${format(new Date(item.created_at), 'yyyy-MM-dd HH:mm')}"`,
        `"${item.details?.firstWorkingDay || ''}"`, `"${item.details?.firstDayStatus || 'PENDING'}"`, item.details?.usePicnicBus ? 'Yes' : 'No', item.details?.isRandstad ? 'Yes' : 'No',
        `"${item.details?.address || ''}"`, `"${aaPattern}"`, `"${notes}"`, `"${shiftSummary}"`
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
            key = getFWDGroupKey(item);
        }

        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });
    return groups;
  }, [filteredData, viewMode]);

  // --- AUTO SCROLL TO TODAY EFFECT ---
  useEffect(() => {
    if (viewMode === 'FWD_SHIFT') {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        // Get all keys available in the view
        const keys = Object.keys(groupedData);
        
        // Find keys that are today or in the future
        // Keys start with YYYY-MM-DD
        const futureKeys = keys.filter(k => k.substring(0, 10) >= todayStr);
        
        // Sort them ascending (closest to today first) to find the nearest upcoming group
        futureKeys.sort();
        
        // Pick the closest one
        const targetKey = futureKeys[0];

        if (targetKey && groupRefs.current[targetKey]) {
            setTimeout(() => {
                groupRefs.current[targetKey]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300); // 300ms delay to ensure rendering is stable
        }
    }
  }, [viewMode, groupedData]);

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
              bgClass: isMorning ? 'bg-orange-50/50' : 'bg-indigo-50/50',
              chipDateBase: isMorning ? 'bg-orange-100/50 text-orange-900 border-orange-200' : 'bg-indigo-100/50 text-indigo-900 border-indigo-200',
              chipCount: isMorning ? 'bg-white text-orange-700 border-orange-200' : 'bg-white text-indigo-700 border-indigo-200'
          };
      } else {
          // FWD_SHIFT View
          // Format: YYYY-MM-DD_INDEX_SHIFTNAME
          
          if (groupKey.includes('NO_DATE')) {
              return { title: 'No Start Date Set', subtitle: 'Pending setup', icon: <Clock className="w-5 h-5" />, colorClass: 'bg-gray-200 text-gray-600', bgClass: 'bg-gray-100', chipDateBase: 'bg-gray-100 text-gray-700 border-gray-200', chipCount: 'bg-white text-gray-500' };
          }

          const parts = groupKey.split('_');
          const datePart = parts[0];
          const shiftIndex = parts[1];
          const shiftName = parts.slice(2).join(' '); // Handle names with underscores if any
          
          const dateDisplay = isValid(parseISO(datePart)) ? format(parseISO(datePart), 'EEE, MMM do') : datePart;
          
          let icon = <CalendarRange className="w-5 h-5" />;
          let colorClass = 'bg-gray-100 text-gray-600';
          let bgClass = 'bg-gray-50';
          
          if (shiftName.includes('MORNING')) {
              icon = <Sun className="w-5 h-5" />;
              colorClass = 'bg-yellow-100 text-yellow-700';
              bgClass = 'bg-yellow-50/50';
          } else if (shiftName.includes('AFTERNOON')) {
              icon = <Sunset className="w-5 h-5" />;
              colorClass = 'bg-indigo-100 text-indigo-700';
              bgClass = 'bg-indigo-50/50';
          } else if (shiftName.includes('OPENING')) {
              icon = <Sunrise className="w-5 h-5" />;
              colorClass = 'bg-orange-100 text-orange-700';
              bgClass = 'bg-orange-50/50';
          } else if (shiftName.includes('NOON')) {
              icon = <Moon className="w-5 h-5" />;
              colorClass = 'bg-blue-100 text-blue-700';
              bgClass = 'bg-blue-50/50';
          }

          return {
              title: dateDisplay,
              subtitle: `${shiftName} SHIFT`,
              icon: icon,
              colorClass: colorClass,
              bgClass: bgClass,
              chipDateBase: '', 
              chipCount: ''
          };
      }
  };

  // HELPER TO GENERATE SMART CALENDAR BUTTONS
  const getSmartCalendarBuckets = (items: ShopperRecord[]) => {
      const buckets: Record<string, { shopper: ShopperRecord, offset: number }[]> = {};

      items.forEach(shopper => {
          if (!shopper.details?.firstWorkingDay) return;
          const fwd = parseISO(shopper.details.firstWorkingDay);
          if (!isValid(fwd)) return;

          // Bucket 1: The Week of Start (W1)
          const w1Monday = startOfWeek(fwd, { weekStartsOn: 1 });
          const w1Key = format(w1Monday, 'yyyy-MM-dd');
          
          if (!buckets[w1Key]) buckets[w1Key] = [];
          buckets[w1Key].push({ shopper, offset: 0 }); // offset 0 = W1

          // Bucket 2: The Week After (W2)
          const w2Monday = addWeeks(w1Monday, 1);
          const w2Key = format(w2Monday, 'yyyy-MM-dd');
          
          if (!buckets[w2Key]) buckets[w2Key] = [];
          buckets[w2Key].push({ shopper, offset: 1 }); // offset 1 = W2
      });

      return buckets;
  };

  if (loading && !data.length) return <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-3"><RefreshCw className="w-8 h-8 animate-spin text-purple-600" /><p>Loading records...</p></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in relative">
      
      {/* TOAST NOTIFICATION AREA (Fixed Bottom Center) */}
      {(checkStatus === 'SUCCESS' || checkStatus === 'ISSUES') && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
               {checkStatus === 'SUCCESS' ? (
                   <div className="bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-bold border-2 border-green-500">
                       <CheckCircle2 className="w-5 h-5" />
                       All Clear! No issues found.
                   </div>
               ) : (
                   <div className="bg-red-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-bold border-2 border-red-500">
                       <AlertCircle className="w-5 h-5" />
                       Found {issueCount} Shopper{issueCount > 1 ? 's' : ''} with issues.
                   </div>
               )}
          </div>
      )}

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

      {/* CONTROLS BAR - Responsive Update */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
            <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none transition-all" />
            </div>
            
            {/* VIEW MODE TOGGLE */}
            <div className="flex bg-gray-100 p-1 rounded-lg shrink-0 w-full sm:w-auto">
                <button 
                    onClick={() => setViewMode('SESSION')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap text-center ${viewMode === 'SESSION' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    By Session
                </button>
                <button 
                    onClick={() => setViewMode('FWD_SHIFT')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap text-center ${viewMode === 'FWD_SHIFT' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    By Start Date
                </button>
            </div>
        </div>

        <div className="flex gap-2 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 no-scrollbar">
            <button 
                onClick={() => runComplianceCheck(data, false)}
                disabled={checkStatus === 'CHECKING'}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium shadow-sm whitespace-nowrap shrink-0 group transition-all"
                title="Check for Rest/Pattern violations"
            >
                {checkStatus === 'CHECKING' ? (
                     <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                ) : (
                     <Stethoscope className={`w-4 h-4 ${issueCount > 0 ? 'text-red-500' : 'text-gray-500'} group-hover:scale-110`} />
                )}
                
                <span className="text-xs font-bold">
                    {checkStatus === 'CHECKING' ? 'Checking...' : 'Check Rules'}
                </span>
            </button>

            {isSavingOrder && <div className="flex items-center gap-2 text-xs font-bold text-green-600 bg-green-50 px-3 py-2 rounded-lg animate-pulse whitespace-nowrap shrink-0"><SaveAll className="w-4 h-4" /> Saving Order...</div>}
            
            <button onClick={fetchData} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors shrink-0 border border-gray-200"><RefreshCw className="w-5 h-5" /></button>
            <button onClick={downloadCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm whitespace-nowrap shrink-0"><Download className="w-4 h-4" /> Export CSV</button>
        </div>
      </div>

      <AdminHeatmap data={data} />

      <div className="space-y-6">
        {Object.entries(groupedData).sort((a,b) => b[0].localeCompare(a[0])).map(([fullGroupKey, items]: [string, ShopperRecord[]]) => {
            const headerInfo = formatHeaderDisplay(fullGroupKey);
            
            // GENERATE SMART CALENDAR BUCKETS
            const calendarBuckets = getSmartCalendarBuckets(items);
            const calendarKeys = Object.keys(calendarBuckets).sort();

            return (
            <div 
                key={fullGroupKey} 
                ref={(el) => { groupRefs.current[fullGroupKey] = el; }}
                className="bg-white rounded-xl shadow-sm border overflow-hidden"
            >
                <div className={`border-b px-4 md:px-6 py-4 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 ${headerInfo.bgClass}`}>
                    
                    {/* LEFT: TITLE & META */}
                    <div className="flex items-center gap-3 w-full xl:w-auto">
                        <div className={`p-2 rounded-lg shadow-sm ${headerInfo.colorClass}`}>
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

                    {/* RIGHT: REDESIGNED EXPORT TOOLBAR */}
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full xl:w-auto xl:justify-end">
                        
                        {/* 1. Global Action: Copy LS (Primary Button) */}
                        <button 
                            onClick={() => handleBulkCopyLSInflow(items, `${fullGroupKey}-LS`)} 
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md group whitespace-nowrap ${
                                copyFeedback[`${fullGroupKey}-LS`] 
                                ? 'bg-blue-700 text-white shadow-blue-200' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100 hover:shadow-blue-200'
                            }`}
                            title="Copy HR Data for everyone in this session"
                        >
                            {copyFeedback[`${fullGroupKey}-LS`] ? <Check className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4 group-hover:scale-110 transition-transform" />} 
                            {copyFeedback[`${fullGroupKey}-LS`] ? 'LS Data Copied!' : 'Copy LS Data'}
                        </button>
                        
                        {/* Vertical Separator (Hidden on Mobile) */}
                        <div className="hidden md:block w-px h-8 bg-gray-300/50 mx-2"></div>

                        {/* 2. SMART CALENDAR EXPORT BUTTONS */}
                        <div className="flex flex-wrap gap-2 items-center">
                             {calendarKeys.length === 0 ? (
                                <span className="text-xs text-gray-400 italic px-2">No dates set</span>
                             ) : (
                                calendarKeys.map((mondayKey) => {
                                   const entries = calendarBuckets[mondayKey];
                                   const mondayDate = parseISO(mondayKey);
                                   const sundayDate = addDays(mondayDate, 6);
                                   
                                   const label = `Week of ${format(mondayDate, 'MMM d')}`;
                                   const rangeLabel = `${format(mondayDate, 'd')} - ${format(sundayDate, 'd MMM')}`;
                                   const btnId = `${fullGroupKey}-${mondayKey}-SMART`;

                                   return (
                                       <button
                                           key={mondayKey}
                                           onClick={() => handleSmartCalendarExport(entries, btnId)}
                                           className={`flex flex-col items-center justify-center px-4 py-1.5 rounded-lg border shadow-sm transition-all group ${
                                              copyFeedback[btnId]
                                              ? 'bg-green-50 border-green-200 text-green-700'
                                              : 'bg-white border-gray-200 hover:border-purple-300 hover:shadow-md'
                                           }`}
                                           title={`Copy shifts for ${entries.length} shoppers for ${rangeLabel}`}
                                       >
                                           <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-gray-400 group-hover:text-purple-500">
                                              {copyFeedback[btnId] ? <Check className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                                              {label}
                                           </div>
                                           <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
                                               <span>{entries.length} People</span>
                                               {copyFeedback[btnId] && <span className="text-green-600">Copied!</span>}
                                           </div>
                                       </button>
                                   );
                                })
                             )}
                        </div>
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
                                        issues={complianceIssues[item.id]} // PASS ISSUES
                                    />
                                    {expandedRow === item.id && (
                                        <tr>
                                            <td colSpan={6}>
                                                <ShopperExpandedDetails 
                                                    shopper={item} 
                                                    onStatusUpdate={handleStatusUpdate}
                                                    onUpdateShopper={handleUpdateShopper} // NEW CALLBACK
                                                />
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
                                         <h4 className="font-bold text-gray-900 flex items-center gap-2">
                                             {item.name}
                                             {complianceIssues[item.id] && <AlertCircle className="w-4 h-4 text-red-500" />}
                                         </h4>
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
                             
                             {/* Mobile Issues Display */}
                             {complianceIssues[item.id] && (
                                 <div className="bg-red-50 p-2 rounded text-xs text-red-600 font-medium">
                                     <ul className="list-disc pl-4 space-y-1">
                                         {complianceIssues[item.id].map((issue, idx) => (
                                             <li key={idx}>{issue}</li>
                                         ))}
                                     </ul>
                                 </div>
                             )}
                             
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
                                     <ShopperExpandedDetails 
                                        shopper={item} 
                                        onStatusUpdate={handleStatusUpdate}
                                        onUpdateShopper={handleUpdateShopper}
                                     />
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

      <EditShopperModal 
          shopper={editingShopper} 
          onClose={() => setEditingShopper(null)} 
          onUpdate={(updated) => setData(prev => prev.map(i => i.id === updated.id ? updated : i))} 
          onRefresh={fetchData}
      />
    </div>
  );
};
