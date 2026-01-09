import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Download, Search, Trash2, User, Calendar, MapPin, Bus, RefreshCw, Activity, Pencil, X, Plus, Save, AlertCircle, Sun, Star, GripVertical, Clock, SaveAll, Loader2 } from 'lucide-react';
import { format, eachDayOfInterval, addDays } from 'date-fns';
import min from 'date-fns/min';
import max from 'date-fns/max';
import parseISO from 'date-fns/parseISO';
import startOfDay from 'date-fns/startOfDay';
import { ShiftType, ShiftTime } from '../types';
import { SHIFT_TIMES, getShopperAllowedRange } from '../constants';
import { Button } from './Button';

interface ShopperRecord {
  id: string;
  created_at: string;
  name: string;
  details: any;
  shifts: any[];
  rank?: number;
}

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
  const [editFormDetails, setEditFormDetails] = useState<any>({});
  const [editFormShifts, setEditFormShifts] = useState<any[]>([]); 
  const [hasUnsavedShiftChanges, setHasUnsavedShiftChanges] = useState(false);
  
  // AA Quick Config State
  const [aaConfig, setAaConfig] = useState<{
    weekday: { day: string, time: ShiftTime | '' },
    weekend: { day: string, time: ShiftTime | '' }
  }>({
    weekday: { day: '', time: '' },
    weekend: { day: '', time: '' }
  });
  const [isApplyingPattern, setIsApplyingPattern] = useState(false);
  
  // Shift Management State
  const [newShiftDate, setNewShiftDate] = useState('');
  const [newShiftTime, setNewShiftTime] = useState<ShiftTime>(SHIFT_TIMES[0]);
  const [newShiftType, setNewShiftType] = useState<ShiftType>(ShiftType.STANDARD);
  
  // Track delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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

  // Smart Save: Update ID and Rank, and include Name/Details to satisfy constraints
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

  // --- HEATMAP LOGIC ---
  const heatmapData = useMemo(() => {
      const map: Record<string, { aa: number; std: number; total: number }> = {};
      let maxCount = 0;
      const allDates: Date[] = [];

      data.forEach(shopper => {
          shopper.shifts.forEach(shift => {
              const key = `${shift.date}_${shift.time}`;
              if (!map[key]) map[key] = { aa: 0, std: 0, total: 0 };
              if (shift.type === ShiftType.AA) map[key].aa += 1;
              else map[key].std += 1;
              map[key].total += 1;
              if (map[key].total > maxCount) maxCount = map[key].total;
              allDates.push(parseISO(shift.date));
          });
      });

      let startDate = startOfDay(new Date());
      let endDate = addDays(startOfDay(new Date()), 14);

      if (allDates.length > 0) {
          startDate = min(allDates);
          endDate = max(allDates);
      }

      const days = eachDayOfInterval({ start: startDate, end: endDate });
      return { map, maxCount, days };
  }, [data]);

  const getOpacity = (count: number, max: number) => {
      if (count === 0) return 0;
      const safeMax = max === 0 ? 1 : max;
      return Math.min(1, (count / safeMax) + 0.3);
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

  // --- EDIT MODAL LOGIC ---
  const analyzeAAPattern = (shifts: any[]) => {
      const aaShifts = shifts.filter((s: any) => s.type === ShiftType.AA);
      
      let wdDay = '', wdTime: ShiftTime | '' = '';
      let weDay = '', weTime: ShiftTime | '' = '';

      // Simple heuristic: Take the first occurrence
      for (const s of aaShifts) {
          const date = new Date(s.date);
          const day = date.getDay(); // 0-6
          const dayName = format(date, 'EEEE');
          
          if (day === 0 || day === 6) {
               if (!weDay) { weDay = dayName; weTime = s.time; }
          } else {
               if (!wdDay) { wdDay = dayName; wdTime = s.time; }
          }
      }
      setAaConfig({
          weekday: { day: wdDay, time: wdTime },
          weekend: { day: weDay, time: weTime }
      });
  };

  const openEditModal = (e: React.MouseEvent, shopper: ShopperRecord) => {
      e.stopPropagation();
      setEditingShopper(shopper);
      setEditFormDetails({ ...shopper.details, name: shopper.name }); 
      setEditFormShifts(JSON.parse(JSON.stringify(shopper.shifts)));
      analyzeAAPattern(shopper.shifts);
      setHasUnsavedShiftChanges(false);
      resetShiftForm();
  };

  const resetShiftForm = () => {
      setNewShiftDate('');
      setNewShiftTime(SHIFT_TIMES[0]);
      setNewShiftType(ShiftType.STANDARD);
  };

  const handleApplyAAPattern = async () => {
    if ((!aaConfig.weekday.day || !aaConfig.weekday.time) && (!aaConfig.weekend.day || !aaConfig.weekend.time)) {
        alert("Please select at least one pattern (Weekday or Weekend).");
        return;
    }
    
    if (!confirm("This will IMMEDIATELY update the database: deleting existing future AA shifts and adding the new pattern. Continue?")) return;

    setIsApplyingPattern(true);

    try {
        const { start, end } = getShopperAllowedRange();
        const startDateStr = format(start, 'yyyy-MM-dd');
        const shopperId = editingShopper!.id;
        
        // 1. Delete ALL AA shifts in the future range for this shopper
        const { error: delError } = await supabase
            .from('shifts')
            .delete()
            .eq('shopper_id', shopperId)
            .eq('type', ShiftType.AA)
            .gte('date', startDateStr);
        
        if (delError) throw delError;

        // 2. Generate new shifts
        const newShiftsPayload = [];
        let curr = start;
        while (curr <= end) {
            const dayName = format(curr, 'EEEE');
            const dateStr = format(curr, 'yyyy-MM-dd');
            
            if (dayName === aaConfig.weekday.day && aaConfig.weekday.time) {
                newShiftsPayload.push({ date: dateStr, time: aaConfig.weekday.time, type: ShiftType.AA, shopper_id: shopperId });
            }
            else if (dayName === aaConfig.weekend.day && aaConfig.weekend.time) {
                newShiftsPayload.push({ date: dateStr, time: aaConfig.weekend.time, type: ShiftType.AA, shopper_id: shopperId });
            }
            curr = addDays(curr, 1);
        }

        // 3. Insert new shifts
        if (newShiftsPayload.length > 0) {
            const { data: insertedShifts, error: insError } = await supabase
                .from('shifts')
                .insert(newShiftsPayload)
                .select();
            
            if (insError) throw insError;

            // 4. Update local state to reflect DB changes
            // Keep Standard shifts and past AA shifts
            const keptShifts = editFormShifts.filter(s => {
                if (s.type !== ShiftType.AA) return true;
                if (s.date < startDateStr) return true;
                return false;
            });

            // Merge
            const updatedShifts = [...keptShifts, ...insertedShifts];
            setEditFormShifts(updatedShifts);
            
            // Also update the main list in background
            setData(prev => prev.map(item => 
              item.id === shopperId ? { ...item, shifts: updatedShifts } : item
            ));
        } else {
             // If we just deleted everything and added nothing
             const keptShifts = editFormShifts.filter(s => {
                if (s.type !== ShiftType.AA) return true;
                if (s.date < startDateStr) return true;
                return false;
            });
            setEditFormShifts(keptShifts);
             setData(prev => prev.map(item => 
              item.id === shopperId ? { ...item, shifts: keptShifts } : item
            ));
        }

        alert("Pattern applied and saved successfully!");

    } catch (e: any) {
        console.error(e);
        alert("Error applying pattern: " + e.message);
    } finally {
        setIsApplyingPattern(false);
    }
  };

  const handleSaveDetails = async () => {
      if (!editingShopper) return;
      try {
          const { name, ...details } = editFormDetails;
          const { error } = await supabase
              .from('shoppers')
              .update({ name, details })
              .eq('id', editingShopper.id);

          if (error) throw error;
          
          setData(prev => prev.map(item => 
              item.id === editingShopper.id ? { ...item, name, details } : item
          ));
          alert("Details updated successfully");
      } catch (e: any) {
          alert("Error saving details: " + e.message);
      }
  };

  // Updates Date, Time, or Type locally
  const handleLocalShiftUpdate = (shiftId: string, field: 'date' | 'time' | 'type', value: any) => {
      setEditFormShifts(prev => prev.map(s => 
          s.id === shiftId ? { ...s, [field]: value } : s
      ));
      setHasUnsavedShiftChanges(true);
  };

  const handleSaveShiftConfiguration = async () => {
      if (!editingShopper) return;
      try {
          const updates = editFormShifts.map(s => ({
              id: s.id,
              date: s.date,
              time: s.time,
              type: s.type,
              shopper_id: editingShopper.id
          }));
          const { error } = await supabase.from('shifts').upsert(updates);
          if (error) throw error;

          setData(prev => prev.map(item => item.id === editingShopper.id ? { ...item, shifts: editFormShifts } : item));
          setHasUnsavedShiftChanges(false);
          alert("Shift configuration saved successfully!");
      } catch (e: any) {
          alert("Error saving shifts: " + e.message);
      }
  };

  const handleRemoveShift = async (shiftId: string) => {
      if (!editingShopper) return;
      if (!window.confirm("Are you sure you want to remove this shift? This action is immediate.")) return;
      try {
          const { error } = await supabase.from('shifts').delete().eq('id', shiftId);
          if (error) throw error;
          const updatedShifts = editFormShifts.filter(s => s.id !== shiftId);
          setEditFormShifts(updatedShifts);
          const newMainShifts = editingShopper.shifts.filter(s => s.id !== shiftId);
          setEditingShopper({...editingShopper, shifts: newMainShifts});
          setData(prev => prev.map(item => item.id === editingShopper.id ? { ...item, shifts: newMainShifts } : item));
      } catch (e: any) {
          alert("Error removing shift: " + e.message);
      }
  };

  const handleAddShift = async () => {
      if (!editingShopper || !newShiftDate) return;
      try {
          const payload = {
              date: newShiftDate,
              time: newShiftTime,
              type: newShiftType,
              shopper_id: editingShopper.id
          };
          const { data: newShift, error } = await supabase.from('shifts').insert([payload]).select().single();
          if (error) throw error;
          const updatedShifts = [...editFormShifts, newShift];
          setEditFormShifts(updatedShifts);
          setEditingShopper({ ...editingShopper, shifts: updatedShifts });
          setData(prev => prev.map(item => item.id === editingShopper.id ? { ...item, shifts: updatedShifts } : item));
          resetShiftForm();
      } catch (e: any) {
          alert("Error adding shift: " + e.message);
      }
  };

  // --- FILTER & GROUPING ---
  const filteredData = data.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group by Registration Date (created_at)
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

  const getDistinctAAPatterns = (shifts: any[]) => {
      const aaShifts = shifts.filter(s => s.type === ShiftType.AA);
      const weekdays = new Set<string>();
      const weekends = new Set<string>();

      aaShifts.forEach(s => {
          const date = new Date(s.date);
          const dayIndex = date.getDay(); // 0 Sun, 6 Sat
          const timeLabel = s.time.split('(')[0].trim();
          const dayName = format(date, 'EEEE');
          const entry = `${dayName} ${timeLabel}`;
          if (dayIndex === 0 || dayIndex === 6) weekends.add(entry);
          else weekdays.add(entry);
      });

      return { weekdays: Array.from(weekdays), weekends: Array.from(weekends) };
  };

  const downloadCSV = () => {
    const headers = ['Name', 'Registered At', 'First Working Day', 'Bus', 'Randstad', 'Address', 'AA Pattern', 'Shift Details'];
    const rows = filteredData.map(item => {
      const shiftSummary = item.shifts
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(s => `${s.date} (${s.time.split('(')[0].trim()} - ${s.type})`)
        .join('; ');

      const aaPattern = getAAPatternString(item.shifts);

      return [
        `"${item.name}"`,
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

  const renderEditModal = () => {
      if (!editingShopper) return null;
      return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
                  <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                      <div>
                          <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                              <Pencil className="w-5 h-5 text-purple-600" /> Edit Shopper Record
                          </h3>
                          <p className="text-sm text-gray-500">{editingShopper.name}</p>
                      </div>
                      <button onClick={() => setEditingShopper(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                          <X className="w-5 h-5 text-gray-500" />
                      </button>
                  </div>
                  <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                      <div className="w-full md:w-1/3 border-r bg-gray-50 p-6 overflow-y-auto space-y-4">
                          <div className="flex items-center gap-2 mb-2">
                             <User className="w-4 h-4 text-gray-500" />
                             <h4 className="font-bold text-gray-700 uppercase text-xs tracking-wider">Personal Details</h4>
                          </div>
                          <div className="space-y-3 p-4 bg-white rounded-xl border shadow-sm">
                              <div className="space-y-1">
                                  <label className="text-xs font-semibold text-gray-500">Full Name</label>
                                  <input 
                                      value={editFormDetails.name || ''}
                                      onChange={e => setEditFormDetails({...editFormDetails, name: e.target.value})}
                                      className="w-full p-2 rounded border border-gray-300 focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                                  />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                      <label className="text-xs font-semibold text-gray-500">Clothing</label>
                                      <select 
                                          value={editFormDetails.clothingSize || 'M'}
                                          onChange={e => setEditFormDetails({...editFormDetails, clothingSize: e.target.value})}
                                          className="w-full p-2 rounded border border-gray-300 text-sm"
                                      >
                                          {['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'].map(s => <option key={s} value={s}>{s}</option>)}
                                      </select>
                                  </div>
                                  <div className="space-y-1">
                                      <label className="text-xs font-semibold text-gray-500">Shoes</label>
                                      <input 
                                          value={editFormDetails.shoeSize || ''}
                                          onChange={e => setEditFormDetails({...editFormDetails, shoeSize: e.target.value})}
                                          className="w-full p-2 rounded border border-gray-300 text-sm"
                                      />
                                  </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                      <label className="text-xs font-semibold text-gray-500">Civil Status</label>
                                      <select 
                                          value={editFormDetails.civilStatus || 'Single'}
                                          onChange={e => setEditFormDetails({...editFormDetails, civilStatus: e.target.value})}
                                          className="w-full p-2 rounded border border-gray-300 text-sm"
                                      >
                                          <option value="Single">Single</option>
                                          <option value="Married">Married</option>
                                          <option value="Cohabit">Cohabit</option>
                                          <option value="Student">Student</option>
                                          <option value="Other">Other</option>
                                      </select>
                                  </div>
                                  <div className="space-y-1">
                                      <label className="text-xs font-semibold text-gray-500">First Work Day</label>
                                      <input 
                                          type="date"
                                          value={editFormDetails.firstWorkingDay || ''}
                                          onChange={e => setEditFormDetails({...editFormDetails, firstWorkingDay: e.target.value})}
                                          className="w-full p-2 rounded border border-gray-300 text-sm"
                                      />
                                  </div>
                              </div>
                              <div className="space-y-2 pt-2 border-t mt-2">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                      <input 
                                          type="checkbox"
                                          checked={editFormDetails.usePicnicBus || false}
                                          onChange={e => setEditFormDetails({...editFormDetails, usePicnicBus: e.target.checked})}
                                          className="rounded text-purple-600 focus:ring-purple-500"
                                      />
                                      <span className="text-sm font-medium text-gray-700">Uses Picnic Bus</span>
                                  </label>
                              </div>
                              <Button onClick={handleSaveDetails} variant="secondary" fullWidth className="mt-2 text-xs h-8">
                                  <Save className="w-3 h-3 mr-2" /> Save Info
                              </Button>
                          </div>
                          
                          {/* AA Config Section */}
                          <div className="mt-6 pt-6 border-t space-y-4">
                              <div className="flex items-center gap-2 mb-2">
                                  <Sun className="w-4 h-4 text-orange-500" />
                                  <h4 className="font-bold text-gray-700 uppercase text-xs tracking-wider">AA Pattern (Quick Set)</h4>
                              </div>
                              
                              {/* Weekday Config */}
                              <div className="space-y-2">
                                  <label className="text-xs font-bold text-gray-400">Weekday (Mon-Fri)</label>
                                  <div className="flex gap-2">
                                      <select 
                                          value={aaConfig.weekday.day}
                                          onChange={e => setAaConfig({...aaConfig, weekday: { ...aaConfig.weekday, day: e.target.value }})}
                                          className="flex-1 p-2 bg-white border rounded-lg text-xs"
                                      >
                                          <option value="">Day...</option>
                                          {['Monday','Tuesday','Wednesday','Thursday','Friday'].map(d => <option key={d} value={d}>{d}</option>)}
                                      </select>
                                      <select 
                                          value={aaConfig.weekday.time}
                                          onChange={e => setAaConfig({...aaConfig, weekday: { ...aaConfig.weekday, time: e.target.value as ShiftTime }})}
                                          className="flex-1 p-2 bg-white border rounded-lg text-xs"
                                      >
                                          <option value="">Time...</option>
                                          {SHIFT_TIMES.map(t => <option key={t} value={t}>{t.split('(')[0]}</option>)}
                                      </select>
                                  </div>
                              </div>

                              {/* Weekend Config */}
                              <div className="space-y-2">
                                  <label className="text-xs font-bold text-gray-400">Weekend (Sat-Sun)</label>
                                  <div className="flex gap-2">
                                      <select 
                                          value={aaConfig.weekend.day}
                                          onChange={e => setAaConfig({...aaConfig, weekend: { ...aaConfig.weekend, day: e.target.value }})}
                                          className="flex-1 p-2 bg-white border rounded-lg text-xs"
                                      >
                                          <option value="">Day...</option>
                                          {['Saturday','Sunday'].map(d => <option key={d} value={d}>{d}</option>)}
                                      </select>
                                      <select 
                                          value={aaConfig.weekend.time}
                                          onChange={e => setAaConfig({...aaConfig, weekend: { ...aaConfig.weekend, time: e.target.value as ShiftTime }})}
                                          className="flex-1 p-2 bg-white border rounded-lg text-xs"
                                      >
                                          <option value="">Time...</option>
                                          {SHIFT_TIMES.map(t => <option key={t} value={t}>{t.split('(')[0]}</option>)}
                                      </select>
                                  </div>
                              </div>

                              <Button onClick={handleApplyAAPattern} disabled={isApplyingPattern} variant="outline" fullWidth className="text-xs h-8 border-dashed border-gray-300 hover:border-purple-500 hover:text-purple-600">
                                  {isApplyingPattern ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Apply Pattern (Auto-Save)'}
                              </Button>
                              <p className="text-[10px] text-gray-400 text-center leading-tight">
                                  Adds AA shifts for next 8 weeks. Existing future AA shifts will be replaced immediately.
                              </p>
                          </div>
                      </div>
                      <div className="flex-1 p-6 overflow-hidden flex flex-col bg-white">
                          <div className="flex justify-between items-center mb-4">
                              <h4 className="font-bold text-gray-700 uppercase text-xs tracking-wider flex items-center gap-2">
                                  <Calendar className="w-4 h-4" /> Shift Configuration
                              </h4>
                              {hasUnsavedShiftChanges && (
                                <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full animate-pulse flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> Unsaved Changes
                                </span>
                              )}
                          </div>
                          <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-bold text-gray-400 mb-2 px-3">
                              <div className="col-span-3">Date</div>
                              <div className="col-span-3">Time</div>
                              <div className="col-span-4 text-center">Type Assignment</div>
                              <div className="col-span-2 text-right">Actions</div>
                          </div>
                          <div className="flex-1 overflow-y-auto space-y-2 pr-2 mb-4">
                              {editFormShifts.length === 0 ? (
                                  <div className="text-center py-12 text-gray-400 text-sm italic border-2 border-dashed rounded-xl bg-gray-50">
                                      No shifts assigned. Add one below.
                                  </div>
                              ) : (
                                editFormShifts
                                    .sort((a, b) => a.date.localeCompare(b.date))
                                    .map((shift, idx) => {
                                        return (
                                          <div key={shift.id || idx} className={`grid grid-cols-12 gap-2 items-center p-3 rounded-lg border transition-all ${shift.type === ShiftType.AA ? 'bg-red-50/30 border-red-100' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                                              {/* Date Input */}
                                              <div className="col-span-3">
                                                  <input 
                                                      type="date"
                                                      value={shift.date}
                                                      onChange={(e) => handleLocalShiftUpdate(shift.id, 'date', e.target.value)}
                                                      className="w-full text-xs font-bold text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-purple-500 outline-none p-1"
                                                  />
                                              </div>
                                              
                                              {/* Time Select */}
                                              <div className="col-span-3">
                                                  <select
                                                      value={shift.time}
                                                      onChange={(e) => handleLocalShiftUpdate(shift.id, 'time', e.target.value)}
                                                      className="w-full text-xs text-gray-500 bg-transparent border-b border-dashed border-gray-300 focus:border-purple-500 outline-none p-1"
                                                  >
                                                      {SHIFT_TIMES.map(t => (
                                                          <option key={t} value={t}>{t.split('(')[0]}</option>
                                                      ))}
                                                  </select>
                                              </div>
                                              
                                              {/* Type Toggles */}
                                              <div className="col-span-4 flex justify-center">
                                                  <div className="flex bg-white rounded-lg border shadow-sm p-1">
                                                      <button onClick={() => handleLocalShiftUpdate(shift.id, 'type', ShiftType.STANDARD)} className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${shift.type === ShiftType.STANDARD ? 'bg-green-100 text-green-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Std</button>
                                                      <button onClick={() => handleLocalShiftUpdate(shift.id, 'type', ShiftType.AA)} className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${shift.type === ShiftType.AA ? 'bg-red-100 text-red-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>AA</button>
                                                  </div>
                                              </div>
                                              
                                              {/* Delete */}
                                              <div className="col-span-2 text-right">
                                                  <button onClick={() => handleRemoveShift(shift.id)} className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded transition-all" title="Remove Shift"><Trash2 className="w-4 h-4" /></button>
                                              </div>
                                          </div>
                                        );
                                    })
                              )}
                          </div>
                          <div className="space-y-4">
                              <div className={`transition-all duration-300 ${hasUnsavedShiftChanges ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none absolute bottom-0'}`}>
                                  <Button onClick={handleSaveShiftConfiguration} fullWidth className="py-3 bg-orange-600 hover:bg-orange-700 shadow-lg text-white">
                                      <Save className="w-4 h-4 mr-2" /> Save Shift Configuration
                                  </Button>
                              </div>
                              <div className="pt-4 border-t bg-gray-50/50 p-4 rounded-xl border border-dashed border-gray-200">
                                  <h5 className="text-xs font-bold uppercase text-gray-400 mb-2 flex items-center gap-2"><Plus className="w-3 h-3" /> Add New Shift</h5>
                                  <div className="flex flex-col md:flex-row gap-2">
                                      <input type="date" value={newShiftDate} onChange={(e) => setNewShiftDate(e.target.value)} className="flex-1 p-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white" />
                                      <select value={newShiftTime} onChange={(e) => setNewShiftTime(e.target.value as ShiftTime)} className="flex-1 p-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white">
                                          {SHIFT_TIMES.map(t => (<option key={t} value={t}>{t.split('(')[0]}</option>))}
                                      </select>
                                      <select value={newShiftType} onChange={(e) => setNewShiftType(e.target.value as ShiftType)} className="w-24 p-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white">
                                          <option value={ShiftType.STANDARD}>Std</option>
                                          <option value={ShiftType.AA}>AA</option>
                                      </select>
                                      <Button onClick={handleAddShift} disabled={!newShiftDate} variant="secondary" className="px-4 py-2 text-xs">Add</Button>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
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

      {/* HEATMAP */}
      <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2"><Activity className="w-4 h-4 text-green-600" /> Density Map</h3>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                  <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div><span>AA Shift</span></div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-sm"></div><span>Standard Shift</span></div>
                  <span className="ml-2 text-[10px] text-gray-300">Darker = More People</span>
              </div>
          </div>
          <div className="overflow-x-auto pb-2">
              <div className="min-w-max">
                  <div className="grid grid-rows-[auto_repeat(4,1fr)] gap-1">
                      <div className="flex gap-1 ml-20 md:ml-24">
                          {heatmapData.days.map((day, i) => (
                              <div key={i} className="w-8 text-center">
                                  <div className="text-[10px] text-gray-400 uppercase font-bold">{format(day, 'EEE')}</div>
                                  <div className="text-xs text-gray-600 font-bold">{format(day, 'd')}</div>
                              </div>
                          ))}
                      </div>
                      {SHIFT_TIMES.map(shift => (
                          <div key={shift} className="flex gap-1 items-center">
                              <div className="w-20 md:w-24 text-right pr-3 text-[10px] md:text-xs font-bold text-gray-500 truncate" title={shift}>{shift.split('(')[0]}</div>
                              {heatmapData.days.map((day, i) => {
                                  const dateKey = format(day, 'yyyy-MM-dd');
                                  const key = `${dateKey}_${shift}`;
                                  const data = heatmapData.map[key] || { aa: 0, std: 0, total: 0 };
                                  return (
                                      <div key={i} className="w-8 h-8 rounded border border-gray-100 bg-gray-50 flex flex-col overflow-hidden group relative">
                                          <div className="flex-1 w-full bg-red-500 transition-all" style={{ opacity: getOpacity(data.aa, heatmapData.maxCount) }}></div>
                                          <div className="flex-1 w-full bg-green-500 transition-all" style={{ opacity: getOpacity(data.std, heatmapData.maxCount) }}></div>
                                          {(data.total > 0) && (
                                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 bg-gray-900 text-white text-[10px] py-1.5 px-3 rounded shadow-lg whitespace-nowrap border border-gray-700">
                                                  <div className="font-bold text-center mb-1">{dateKey}</div>
                                                  <div className="flex gap-3"><span className="text-red-300 font-bold">{data.aa} AA</span><span className="text-green-300 font-bold">{data.std} Std</span></div>
                                              </div>
                                          )}
                                      </div>
                                  );
                              })}
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      </div>

      {/* GROUPED TABLES */}
      <div className="space-y-6">
        {Object.entries(groupedData).sort((a,b) => b[0].localeCompare(a[0])).map(([dateKey, items]) => (
            <div key={dateKey} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="bg-gray-50 border-b px-6 py-3 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-purple-600" />
                        SER: {formatDateDisplay(dateKey)}
                    </h3>
                    <span className="text-xs font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                        {items.length} Shoppers
                    </span>
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
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {renderAAPatternCell(item.shifts)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={(e) => openEditModal(e, item)} className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all" title="Edit Shopper"><Pencil className="w-4 h-4" /></button>
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
                                                        </div>
                                                        {item.details?.isRandstad && (
                                                            <div className="mt-2 pt-2 border-t">
                                                                <div className="flex items-start gap-2 text-xs"><MapPin className="w-3 h-3 mt-0.5 shrink-0" />{item.details?.address || 'No address provided'}</div>
                                                            </div>
                                                        )}
                                                        <div className="mt-4 pt-4 border-t">
                                                            <h5 className="font-bold text-gray-900 text-xs uppercase mb-2"><span className="text-red-600">AA</span> Recurring Pattern</h5>
                                                            {(() => {
                                                                const patterns = getDistinctAAPatterns(item.shifts);
                                                                return (
                                                                    <div className="space-y-2">
                                                                        <div><span className="text-[10px] font-bold text-gray-400 uppercase block">Weekday</span><span className="text-sm font-medium text-gray-900">{patterns.weekdays.length > 0 ? patterns.weekdays.join(', ') : <span className="text-gray-300 italic">None</span>}</span></div>
                                                                        <div><span className="text-[10px] font-bold text-gray-400 uppercase block">Weekend</span><span className="text-sm font-medium text-gray-900">{patterns.weekends.length > 0 ? patterns.weekends.join(', ') : <span className="text-gray-300 italic">None</span>}</span></div>
                                                                    </div>
                                                                );
                                                            })()}
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

      {renderEditModal()}
    </div>
  );
};