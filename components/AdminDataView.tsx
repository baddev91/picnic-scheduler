import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Download, Search, Trash2, User, Calendar, MapPin, Bus, RefreshCw, Activity, Pencil, X, Plus, Save, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { format, eachDayOfInterval, min, max, parseISO, isSameDay, startOfToday, addDays } from 'date-fns';
import { ShiftType, ShiftTime } from '../types';
import { SHIFT_TIMES } from '../constants';
import { Button } from './Button';

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
  
  // Edit Mode State
  const [editingShopper, setEditingShopper] = useState<ShopperRecord | null>(null);
  const [editFormDetails, setEditFormDetails] = useState<any>({});
  
  // Shift Management State
  const [newShiftDate, setNewShiftDate] = useState('');
  const [newShiftTime, setNewShiftTime] = useState<ShiftTime>(SHIFT_TIMES[0]);
  const [newShiftType, setNewShiftType] = useState<ShiftType>(ShiftType.STANDARD);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null); // Track if we are editing a specific shift
  
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

  // --- HEATMAP LOGIC ---
  const heatmapData = useMemo(() => {
      // Map structure: "YYYY-MM-DD_ShiftTime" -> { aa: number, std: number, total: number }
      const map: Record<string, { aa: number; std: number; total: number }> = {};
      let maxCount = 0;
      const allDates: Date[] = [];

      data.forEach(shopper => {
          shopper.shifts.forEach(shift => {
              const key = `${shift.date}_${shift.time}`;
              
              if (!map[key]) map[key] = { aa: 0, std: 0, total: 0 };
              
              if (shift.type === ShiftType.AA) {
                  map[key].aa += 1;
              } else {
                  map[key].std += 1;
              }
              map[key].total += 1;

              if (map[key].total > maxCount) maxCount = map[key].total;
              allDates.push(parseISO(shift.date));
          });
      });

      // Define date range for the graph
      let startDate = startOfToday();
      let endDate = addDays(startOfToday(), 14); // Default 2 weeks view if empty

      if (allDates.length > 0) {
          startDate = min(allDates);
          endDate = max(allDates);
      }

      // Generate continuous days
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
          alert("Error: Database reported success but 0 records were deleted. Check RLS policies.");
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
  const openEditModal = (e: React.MouseEvent, shopper: ShopperRecord) => {
      e.stopPropagation();
      setEditingShopper(shopper);
      setEditFormDetails({ ...shopper.details, name: shopper.name }); 
      resetShiftForm();
  };

  const resetShiftForm = () => {
      setNewShiftDate('');
      setNewShiftTime(SHIFT_TIMES[0]);
      setNewShiftType(ShiftType.STANDARD);
      setEditingShiftId(null);
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

  // --- SHIFT MANAGEMENT LOGIC ---
  const handleRemoveShift = async (shiftId: string) => {
      if (!editingShopper) return;
      
      // If we are currently editing this shift, cancel edit mode
      if (editingShiftId === shiftId) {
          resetShiftForm();
      }

      try {
          const { error } = await supabase.from('shifts').delete().eq('id', shiftId);
          if (error) throw error;

          const updatedShifts = editingShopper.shifts.filter(s => s.id !== shiftId);
          setEditingShopper({ ...editingShopper, shifts: updatedShifts });
          setData(prev => prev.map(item => 
            item.id === editingShopper.id ? { ...item, shifts: updatedShifts } : item
          ));
      } catch (e: any) {
          alert("Error removing shift: " + e.message);
      }
  };

  const handleEditShiftClick = (shift: any) => {
      setEditingShiftId(shift.id);
      setNewShiftDate(shift.date);
      setNewShiftTime(shift.time);
      setNewShiftType(shift.type);
  };

  const handleAddOrUpdateShift = async () => {
      if (!editingShopper || !newShiftDate) return;

      try {
          const payload = {
              date: newShiftDate,
              time: newShiftTime,
              type: newShiftType
          };

          if (editingShiftId) {
              // UPDATE EXISTING SHIFT
              const { data: updatedShift, error } = await supabase
                  .from('shifts')
                  .update(payload)
                  .eq('id', editingShiftId)
                  .select()
                  .single();

              if (error) throw error;

              // Update State
              const updatedShifts = editingShopper.shifts.map(s => s.id === editingShiftId ? updatedShift : s);
              setEditingShopper({ ...editingShopper, shifts: updatedShifts });
              setData(prev => prev.map(item => 
                  item.id === editingShopper.id ? { ...item, shifts: updatedShifts } : item
              ));
              
              // Reset
              resetShiftForm();

          } else {
              // CREATE NEW SHIFT
              const insertPayload = { ...payload, shopper_id: editingShopper.id };
              const { data: newShift, error } = await supabase
                  .from('shifts')
                  .insert([insertPayload])
                  .select()
                  .single();

              if (error) throw error;

              // Update State
              const updatedShifts = [...editingShopper.shifts, newShift];
              setEditingShopper({ ...editingShopper, shifts: updatedShifts });
              setData(prev => prev.map(item => 
                  item.id === editingShopper.id ? { ...item, shifts: updatedShifts } : item
              ));
              
              // Reset
              setNewShiftDate('');
          }

      } catch (e: any) {
          alert(`Error ${editingShiftId ? 'updating' : 'adding'} shift: ` + e.message);
      }
  };

  const filteredData = data.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      try {
          return format(new Date(dateStr), 'EEE, MMM do, yyyy');
      } catch (e) { return dateStr; }
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

  // --- RENDER EDIT MODAL ---
  const renderEditModal = () => {
      if (!editingShopper) return null;

      return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                  
                  {/* Modal Header */}
                  <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                      <div>
                          <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                              <Pencil className="w-5 h-5 text-purple-600" /> Edit Shopper
                          </h3>
                          <p className="text-sm text-gray-500">{editingShopper.name}</p>
                      </div>
                      <button onClick={() => setEditingShopper(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                          <X className="w-5 h-5 text-gray-500" />
                      </button>
                  </div>

                  {/* Modal Body */}
                  <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                      
                      {/* Left: Details Form */}
                      <div className="w-full md:w-1/3 border-r bg-gray-50 p-6 overflow-y-auto space-y-4">
                          <h4 className="font-bold text-gray-700 uppercase text-xs tracking-wider mb-2">Personal Details</h4>
                          
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
                                      {['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'].map(s => <option key={s} value={s}>{s}</option>)}
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

                          <div className="space-y-1">
                              <label className="text-xs font-semibold text-gray-500">First Work Day</label>
                              <input 
                                  type="date"
                                  value={editFormDetails.firstWorkingDay || ''}
                                  onChange={e => setEditFormDetails({...editFormDetails, firstWorkingDay: e.target.value})}
                                  className="w-full p-2 rounded border border-gray-300 text-sm"
                              />
                          </div>

                          <div className="space-y-2 pt-2 border-t">
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                      type="checkbox"
                                      checked={editFormDetails.usePicnicBus || false}
                                      onChange={e => setEditFormDetails({...editFormDetails, usePicnicBus: e.target.checked})}
                                      className="rounded text-purple-600 focus:ring-purple-500"
                                  />
                                  <span className="text-sm font-medium text-gray-700">Uses Picnic Bus</span>
                              </label>

                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                      type="checkbox"
                                      checked={editFormDetails.isRandstad || false}
                                      onChange={e => setEditFormDetails({...editFormDetails, isRandstad: e.target.checked})}
                                      className="rounded text-purple-600 focus:ring-purple-500"
                                  />
                                  <span className="text-sm font-medium text-gray-700">Via Randstad</span>
                              </label>
                          </div>
                          
                          {editFormDetails.isRandstad && (
                             <div className="space-y-1">
                                  <label className="text-xs font-semibold text-gray-500">Address</label>
                                  <textarea 
                                      value={editFormDetails.address || ''}
                                      onChange={e => setEditFormDetails({...editFormDetails, address: e.target.value})}
                                      rows={2}
                                      className="w-full p-2 rounded border border-gray-300 text-sm"
                                  />
                             </div>
                          )}

                          <Button onClick={handleSaveDetails} variant="secondary" fullWidth className="mt-4 text-xs h-9">
                              <Save className="w-3 h-3 mr-2" /> Save Details
                          </Button>
                      </div>

                      {/* Right: Shifts Manager */}
                      <div className="flex-1 p-6 overflow-hidden flex flex-col bg-white">
                          <h4 className="font-bold text-gray-700 uppercase text-xs tracking-wider mb-4 flex justify-between">
                              <span>Manage Shifts ({editingShopper.shifts.length})</span>
                          </h4>

                          <div className="flex-1 overflow-y-auto space-y-2 pr-2 mb-4">
                              {editingShopper.shifts.length === 0 ? (
                                  <div className="text-center py-8 text-gray-400 text-sm italic border-2 border-dashed rounded-xl">
                                      No shifts assigned. Add one below.
                                  </div>
                              ) : (
                                  editingShopper.shifts
                                    .sort((a, b) => a.date.localeCompare(b.date))
                                    .map((shift, idx) => {
                                        const isEditing = editingShiftId === shift.id;
                                        return (
                                          <div 
                                              key={idx} 
                                              className={`flex items-center justify-between p-3 rounded-lg border transition-all group ${
                                                  isEditing ? 'bg-orange-50 border-orange-300 ring-1 ring-orange-200' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                              }`}
                                          >
                                              <div className="flex items-center gap-3">
                                                  <div className={`w-2 h-8 rounded-full ${shift.type === ShiftType.AA ? 'bg-red-500' : 'bg-green-500'}`} />
                                                  <div>
                                                      <div className="font-bold text-sm text-gray-800">{formatDateDisplay(shift.date)}</div>
                                                      <div className="text-xs text-gray-500 flex gap-2">
                                                          <span>{shift.time}</span>
                                                          <span className={`font-bold px-1.5 rounded-full ${shift.type === ShiftType.AA ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                              {shift.type === ShiftType.AA ? 'AA' : 'Std'}
                                                          </span>
                                                      </div>
                                                  </div>
                                              </div>
                                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <button 
                                                      onClick={() => handleEditShiftClick(shift)}
                                                      className={`p-2 rounded-lg transition-all ${isEditing ? 'text-orange-600 bg-orange-100' : 'text-gray-400 hover:text-orange-600 hover:bg-orange-50'}`}
                                                      title="Edit Shift"
                                                  >
                                                      <Pencil className="w-4 h-4" />
                                                  </button>
                                                  <button 
                                                      onClick={() => handleRemoveShift(shift.id)}
                                                      className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                      title="Remove Shift"
                                                  >
                                                      <Trash2 className="w-4 h-4" />
                                                  </button>
                                              </div>
                                          </div>
                                        );
                                    })
                              )}
                          </div>

                          {/* Quick Add / Edit Form */}
                          <div className={`pt-4 border-t -mx-6 -mb-6 p-6 transition-colors ${editingShiftId ? 'bg-orange-50 border-orange-200' : 'bg-gray-50'}`}>
                              <div className="flex justify-between items-center mb-2">
                                  <h5 className={`text-xs font-bold uppercase flex items-center gap-2 ${editingShiftId ? 'text-orange-600' : 'text-gray-500'}`}>
                                      {editingShiftId ? <><Pencil className="w-3 h-3" /> Edit Shift Mode</> : 'Quick Add Shift'}
                                  </h5>
                                  {editingShiftId && (
                                      <button onClick={resetShiftForm} className="text-xs font-bold text-gray-500 hover:text-gray-800 flex items-center gap-1">
                                          <RotateCcw className="w-3 h-3" /> Cancel
                                      </button>
                                  )}
                              </div>
                              
                              <div className="flex flex-col md:flex-row gap-2">
                                  <input 
                                      type="date" 
                                      value={newShiftDate}
                                      onChange={(e) => setNewShiftDate(e.target.value)}
                                      className="flex-1 p-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-green-500"
                                  />
                                  <select
                                      value={newShiftTime}
                                      onChange={(e) => setNewShiftTime(e.target.value as ShiftTime)}
                                      className="flex-1 p-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-green-500"
                                  >
                                      {SHIFT_TIMES.map(t => (
                                          <option key={t} value={t}>{t.split('(')[0]}</option>
                                      ))}
                                  </select>
                                  <select
                                      value={newShiftType}
                                      onChange={(e) => setNewShiftType(e.target.value as ShiftType)}
                                      className="w-24 p-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-green-500"
                                  >
                                      <option value={ShiftType.STANDARD}>Std</option>
                                      <option value={ShiftType.AA}>AA</option>
                                  </select>
                                  <Button 
                                      onClick={handleAddOrUpdateShift} 
                                      disabled={!newShiftDate}
                                      className={`px-4 py-2 text-sm flex items-center gap-2 ${editingShiftId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}
                                  >
                                      {editingShiftId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                      {editingShiftId ? 'Update' : 'Add'}
                                  </Button>
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

      {/* HEATMAP GRAPH */}
      <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2">
                  <Activity className="w-4 h-4 text-green-600" /> Density Map
              </h3>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                      <span>AA Shift</span>
                  </div>
                  <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                      <span>Standard Shift</span>
                  </div>
                  <span className="ml-2 text-[10px] text-gray-300">Darker = More People</span>
              </div>
          </div>
          
          <div className="overflow-x-auto pb-2">
              <div className="min-w-max">
                  {/* Grid Container */}
                  <div className="grid grid-rows-[auto_repeat(4,1fr)] gap-1">
                      
                      {/* 1. Header Row (Dates) */}
                      <div className="flex gap-1 ml-20 md:ml-24">
                          {heatmapData.days.map((day, i) => (
                              <div key={i} className="w-8 text-center">
                                  <div className="text-[10px] text-gray-400 uppercase font-bold">{format(day, 'EEE')}</div>
                                  <div className="text-xs text-gray-600 font-bold">{format(day, 'd')}</div>
                              </div>
                          ))}
                      </div>

                      {/* 2. Rows for each Shift Time */}
                      {SHIFT_TIMES.map(shift => (
                          <div key={shift} className="flex gap-1 items-center">
                              {/* Row Header */}
                              <div className="w-20 md:w-24 text-right pr-3 text-[10px] md:text-xs font-bold text-gray-500 truncate" title={shift}>
                                  {shift.split('(')[0]}
                              </div>
                              
                              {/* Cells */}
                              {heatmapData.days.map((day, i) => {
                                  const dateKey = format(day, 'yyyy-MM-dd');
                                  const key = `${dateKey}_${shift}`;
                                  const data = heatmapData.map[key] || { aa: 0, std: 0, total: 0 };
                                  
                                  return (
                                      <div 
                                          key={i} 
                                          className="w-8 h-8 rounded border border-gray-100 bg-gray-50 flex flex-col overflow-hidden group relative"
                                      >
                                          {/* Top Half: AA (Red) */}
                                          <div 
                                              className="flex-1 w-full bg-red-500 transition-all"
                                              style={{ opacity: getOpacity(data.aa, heatmapData.maxCount) }}
                                          ></div>
                                          
                                          {/* Bottom Half: Standard (Green) */}
                                          <div 
                                              className="flex-1 w-full bg-green-500 transition-all"
                                              style={{ opacity: getOpacity(data.std, heatmapData.maxCount) }}
                                          ></div>

                                          {/* Tooltip */}
                                          {(data.total > 0) && (
                                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 bg-gray-900 text-white text-[10px] py-1.5 px-3 rounded shadow-lg whitespace-nowrap border border-gray-700">
                                                  <div className="font-bold text-center mb-1">{dateKey}</div>
                                                  <div className="flex gap-3">
                                                      <span className="text-red-300 font-bold">{data.aa} AA</span>
                                                      <span className="text-green-300 font-bold">{data.std} Std</span>
                                                  </div>
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
                <th className="px-6 py-4 font-semibold">AA Pattern</th>
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
                        <td className="px-6 py-4">
                            {renderAAPatternCell(item.shifts)}
                        </td>
                        <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                                <button 
                                    onClick={(e) => openEditModal(e, item)}
                                    className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                                    title="Edit Shopper"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
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
                            </div>
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
                                              <Calendar className="w-4 h-4" /> All Selected Shifts ({item.shifts.length})
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

      {/* Edit Modal */}
      {renderEditModal()}

    </div>
  );
};