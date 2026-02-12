
import React, { useState, useEffect } from 'react';
import { X, Pencil, User, MapPin, Save, Calendar, AlertCircle, Trash2, Plus, Hash, Check, Star, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../supabaseClient';
import { Button } from './Button';
import { ShopperRecord, ShiftTime, ShiftType } from '../types';
import { SHIFT_TIMES } from '../constants';

interface EditShopperModalProps {
  shopper: ShopperRecord | null;
  onClose: () => void;
  onUpdate: (updatedShopper: ShopperRecord) => void;
  onRefresh?: () => void;
}

const GLOVE_SIZES = ['6 (XS)', '7 (S)', '8 (M)', '9 (L)', '10 (XL)', '11 (XXL)', '12 (3XL)', '12 (4XL)'];
const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', '6XL'];

export const EditShopperModal: React.FC<EditShopperModalProps> = ({ shopper, onClose, onUpdate, onRefresh }) => {
  const [details, setDetails] = useState<any>({});
  const [shifts, setShifts] = useState<any[]>([]);
  const [newShiftDate, setNewShiftDate] = useState('');
  const [newShiftTime, setNewShiftTime] = useState<ShiftTime>(SHIFT_TIMES[0]);
  const [newShiftType, setNewShiftType] = useState<ShiftType>(ShiftType.STANDARD);
  const [hasUnsavedShiftChanges, setHasUnsavedShiftChanges] = useState(false);
  
  // Feedback State
  const [showSuccessFeedback, setShowSuccessFeedback] = useState(false);

  useEffect(() => {
    if (shopper) {
        setDetails({ ...shopper.details, name: shopper.name });
        setShifts(JSON.parse(JSON.stringify(shopper.shifts)));
        setHasUnsavedShiftChanges(false);
        setShowSuccessFeedback(false);
        resetShiftForm();
    }
  }, [shopper]);

  if (!shopper) return null;

  const resetShiftForm = () => {
    setNewShiftDate('');
    setNewShiftTime(SHIFT_TIMES[0]);
    setNewShiftType(ShiftType.STANDARD);
  };

  // --- AUTO SYNC FWD HELPER ---
  const syncFWDWithShifts = async (currentShifts: any[]) => {
      if (!currentShifts || currentShifts.length === 0) return;

      // Find the earliest shift date
      const sorted = [...currentShifts].sort((a, b) => a.date.localeCompare(b.date));
      const earliestDate = sorted[0].date;

      // FIX: Compare against the SAVED database state (shopper.details), not just local state.
      // This ensures that if the DB is out of sync with the actual shifts, we force an update.
      const savedFWD = shopper.details?.firstWorkingDay;

      if (earliestDate !== savedFWD) {
          try {
              const newDetails = { ...details, firstWorkingDay: earliestDate };
              
              // 1. Update Database
              const { error } = await supabase
                  .from('shoppers')
                  .update({ details: newDetails })
                  .eq('id', shopper.id);
              
              if (error) throw error;

              // 2. Update Local State (so UI turns yellow immediately)
              setDetails(newDetails);

              // 3. Propagate to Parent (so Admin Table updates immediately)
              onUpdate({ ...shopper, details: newDetails, shifts: currentShifts });
              
              console.log(`Auto-synced First Working Day: ${savedFWD} -> ${earliestDate}`);
          } catch (err) {
              console.error("Failed to auto-sync FWD", err);
          }
      }
  };

  const handleSaveDetails = async () => {
    try {
        const { name, ...restDetails } = details;
        const { error } = await supabase
            .from('shoppers')
            .update({ name, details: restDetails })
            .eq('id', shopper.id);

        if (error) throw error;
        
        onUpdate({ ...shopper, name, details: restDetails });
        
        // Visual Feedback
        setShowSuccessFeedback(true);
        setTimeout(() => setShowSuccessFeedback(false), 2000);
        
    } catch (e: any) {
        alert("Error saving details: " + e.message);
    }
  };

  const handleLocalShiftUpdate = (shiftId: string, field: 'date' | 'time' | 'type', value: any) => {
    setShifts(prev => prev.map(s => 
        s.id === shiftId ? { ...s, [field]: value } : s
    ));
    setHasUnsavedShiftChanges(true);
  };

  const handleSaveShiftConfiguration = async () => {
    try {
        const updates = shifts.map(s => ({
            id: s.id,
            date: s.date,
            time: s.time,
            type: s.type,
            shopper_id: shopper.id
        }));
        const { error } = await supabase.from('shifts').upsert(updates);
        if (error) throw error;

        // Perform FWD Sync (This now reliably updates DB FWD)
        await syncFWDWithShifts(shifts);

        if (onRefresh) onRefresh();
        else onUpdate({ ...shopper, shifts: shifts });
        
        setHasUnsavedShiftChanges(false);
        alert("Shift configuration saved successfully!");
    } catch (e: any) {
        alert("Error saving shifts: " + e.message);
    }
  };

  const handleRemoveShift = async (shiftId: string) => {
    if (!window.confirm("Are you sure you want to remove this shift? This action is immediate.")) return;
    try {
        const { error } = await supabase.from('shifts').delete().eq('id', shiftId);
        if (error) throw error;
        
        const updatedShifts = shifts.filter(s => s.id !== shiftId);
        setShifts(updatedShifts);
        
        // Perform FWD Sync
        await syncFWDWithShifts(updatedShifts);

        onUpdate({ ...shopper, shifts: updatedShifts });
    } catch (e: any) {
        alert("Error removing shift: " + e.message);
    }
  };

  const handleAddShift = async () => {
    if (!newShiftDate) return;
    try {
        const payload = {
            date: newShiftDate,
            time: newShiftTime,
            type: newShiftType,
            shopper_id: shopper.id
        };
        const { data: newShift, error } = await supabase.from('shifts').insert([payload]).select().single();
        if (error) throw error;
        
        const updatedShifts = [...shifts, newShift];
        setShifts(updatedShifts);
        
        // Perform FWD Sync
        await syncFWDWithShifts(updatedShifts);

        if (onRefresh) {
            onRefresh(); 
        } else {
            onUpdate({ ...shopper, shifts: updatedShifts });
        }
        
        resetShiftForm();
    } catch (e: any) {
        alert("Error adding shift: " + e.message);
    }
  };

  // Helper to display day name for new shift
  let newShiftDayName = '';
  if (newShiftDate) {
      const [y, m, d] = newShiftDate.split('-').map(Number);
      if (y && m && d) {
          newShiftDayName = format(new Date(y, m - 1, d), 'EEEE');
      }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4 animate-in fade-in">
        <div className="bg-white md:rounded-2xl rounded-t-2xl shadow-2xl w-full max-w-5xl h-[95vh] md:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                <div>
                    <h3 className="font-bold text-lg md:text-xl text-gray-800 flex items-center gap-2">
                        <Pencil className="w-5 h-5 text-purple-600" /> Edit Record
                    </h3>
                    <p className="text-sm text-gray-500">{shopper.name}</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                    <X className="w-5 h-5 text-gray-500" />
                </button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                
                {/* LEFT: PERSONAL DETAILS */}
                <div className="w-full md:w-1/3 border-r bg-gray-50 p-6 overflow-y-auto space-y-4 shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                       <User className="w-4 h-4 text-gray-500" />
                       <h4 className="font-bold text-gray-700 uppercase text-xs tracking-wider">Personal Details</h4>
                    </div>
                    <div className="space-y-3 p-4 bg-white rounded-xl border shadow-sm">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500">Full Name</label>
                            <input 
                                value={details.name || ''}
                                onChange={e => setDetails({...details, name: e.target.value})}
                                className="w-full p-2 rounded border border-gray-300 focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                            />
                        </div>

                        {/* PN NUMBER INPUT */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                                <Hash className="w-3 h-3" /> PN Number
                            </label>
                            <input
                                value={details.pnNumber || ''}
                                onChange={e => setDetails({...details, pnNumber: e.target.value})}
                                placeholder="PN123456"
                                className="w-full p-2 rounded border border-gray-300 focus:ring-2 focus:ring-purple-500 outline-none text-sm font-mono placeholder:text-gray-300 uppercase"
                            />
                        </div>

                        {/* EMAIL INPUT */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                                <Mail className="w-3 h-3" /> Email Address
                            </label>
                            <input
                                type="email"
                                value={details.email || ''}
                                onChange={e => setDetails({...details, email: e.target.value})}
                                placeholder="shopper@example.com"
                                className="w-full p-2 rounded border border-gray-300 focus:ring-2 focus:ring-purple-500 outline-none text-sm placeholder:text-gray-300"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500">Clothing</label>
                                <select 
                                    value={details.clothingSize || 'M'}
                                    onChange={e => setDetails({...details, clothingSize: e.target.value})}
                                    className="w-full p-2 rounded border border-gray-300 text-sm"
                                >
                                    {CLOTHING_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500">Shoes</label>
                                <input 
                                    value={details.shoeSize || ''}
                                    onChange={e => setDetails({...details, shoeSize: e.target.value})}
                                    className="w-full p-2 rounded border border-gray-300 text-sm"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500">Gloves</label>
                                <select 
                                    value={details.gloveSize || '8 (M)'}
                                    onChange={e => setDetails({...details, gloveSize: e.target.value})}
                                    className="w-full p-2 rounded border border-gray-300 text-sm"
                                >
                                    {GLOVE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500">Civil Status</label>
                                <select 
                                    value={details.civilStatus || 'Single'}
                                    onChange={e => setDetails({...details, civilStatus: e.target.value})}
                                    className="w-full p-2 rounded border border-gray-300 text-sm"
                                >
                                    <option value="Single">Single</option>
                                    <option value="Married">Married</option>
                                    <option value="Cohabit">Cohabit</option>
                                    <option value="Student">Student</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>
                        
                        {/* Gender Input for Admin */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500">Gender</label>
                            <select 
                                value={details.gender || 'N/D'}
                                onChange={e => setDetails({...details, gender: e.target.value})}
                                className="w-full p-2 rounded border border-gray-300 text-sm"
                            >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="N/D">N/D</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500">First Work Day</label>
                            <input 
                                type="date"
                                value={details.firstWorkingDay || ''}
                                onChange={e => setDetails({...details, firstWorkingDay: e.target.value})}
                                className="w-full p-2 rounded border border-gray-300 text-sm"
                            />
                        </div>

                        <div className="space-y-2 pt-2 border-t mt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox"
                                    checked={details.usePicnicBus || false}
                                    onChange={e => setDetails({...details, usePicnicBus: e.target.checked})}
                                    className="rounded text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Uses Picnic Bus</span>
                            </label>

                            {/* Randstad Checkbox */}
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox"
                                    checked={details.isRandstad || false}
                                    onChange={e => setDetails({...details, isRandstad: e.target.checked})}
                                    className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Randstad Agency</span>
                            </label>
                        </div>

                        {/* Conditional Address Field */}
                        {details.isRandstad && (
                            <div className="space-y-1 mt-2 p-2 bg-blue-50 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-1">
                                <label className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> Address
                                </label>
                                <input 
                                    value={details.address || ''}
                                    onChange={e => setDetails({...details, address: e.target.value})}
                                    placeholder="Full Address..."
                                    className="w-full p-2 rounded border border-blue-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                />
                            </div>
                        )}
                        
                        <div className="pt-4 mt-2">
                            <Button 
                                onClick={handleSaveDetails} 
                                fullWidth 
                                disabled={showSuccessFeedback}
                                className={`transform transition-all duration-300 py-2.5 text-xs font-bold uppercase tracking-wide border-none shadow-md ${
                                    showSuccessFeedback 
                                    ? 'bg-green-600 hover:bg-green-700 text-white scale-95' 
                                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 hover:shadow-lg text-white'
                                }`}
                            >
                                {showSuccessFeedback ? (
                                    <div className="flex items-center justify-center gap-2 animate-in fade-in zoom-in">
                                        <Check className="w-4 h-4" /> Saved!
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-2">
                                        <Save className="w-4 h-4" /> Save Personal Info
                                    </div>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* RIGHT: SHIFT CONFIGURATION */}
                <div className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col bg-white">
                    <div className="flex justify-between items-center mb-4 shrink-0">
                        <h4 className="font-bold text-gray-700 uppercase text-xs tracking-wider flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Shift Configuration
                        </h4>
                        {hasUnsavedShiftChanges && (
                          <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full animate-pulse flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Unsaved Changes
                          </span>
                        )}
                    </div>
                    
                    {/* Desktop Header */}
                    <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] uppercase font-bold text-gray-400 mb-2 px-3 shrink-0">
                        <div className="col-span-3">Date</div>
                        <div className="col-span-3">Time</div>
                        <div className="col-span-4 text-center">Type Assignment</div>
                        <div className="col-span-2 text-right">Actions</div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 mb-4">
                        {shifts.length === 0 ? (
                            <div className="text-center py-12 text-gray-400 text-sm italic border-2 border-dashed rounded-xl bg-gray-50">
                                No shifts assigned. Add one below.
                            </div>
                        ) : (
                          shifts
                              .sort((a, b) => a.date.localeCompare(b.date))
                              .map((shift, idx) => {
                                  // Safe parsing to ensure local time for day name
                                  let dayName = '';
                                  if (shift.date) {
                                      const [y, m, d] = shift.date.split('-').map(Number);
                                      if (y && m && d) {
                                          dayName = format(new Date(y, m - 1, d), 'EEEE');
                                      }
                                  }

                                  // Dynamic Check for First Working Day (using potentially updated details state)
                                  const isFWD = details.firstWorkingDay === shift.date;
                                  // Robust AA Check
                                  const isAA = shift.type === ShiftType.AA || shift.type === 'AA';

                                  let rowBg = 'bg-white border-gray-100';
                                  if (isFWD) {
                                      rowBg = 'bg-yellow-50 border-yellow-300 ring-1 ring-yellow-200 shadow-sm';
                                  } else if (isAA) {
                                      rowBg = 'bg-red-50/30 border-red-100';
                                  }
                                  
                                  const rowHover = 'hover:border-gray-300';

                                  return (
                                    <div key={shift.id || idx} className={`p-3 rounded-lg border transition-all ${rowBg} ${rowHover} flex flex-col md:grid md:grid-cols-12 md:gap-2 md:items-center relative`}>
                                        
                                        {isFWD && (
                                            <div className="absolute top-2 right-2 text-yellow-500 animate-in fade-in zoom-in md:hidden">
                                                <Star className="w-4 h-4 fill-yellow-500" />
                                            </div>
                                        )}

                                        {/* Date Field */}
                                        <div className="md:col-span-3 mb-2 md:mb-0 relative">
                                            {dayName && (
                                                <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-0.5 block">
                                                    {dayName}
                                                </div>
                                            )}
                                            {/* FWD Star for Desktop */}
                                            {isFWD && (
                                                <div className="absolute -left-5 top-1.5 hidden md:block text-yellow-500" title="First Working Day">
                                                    <Star className="w-3.5 h-3.5 fill-yellow-500" />
                                                </div>
                                            )}
                                            <input 
                                                type="date"
                                                value={shift.date}
                                                onChange={(e) => handleLocalShiftUpdate(shift.id, 'date', e.target.value)}
                                                className="w-full text-sm md:text-xs font-bold text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-purple-500 outline-none p-1"
                                            />
                                        </div>
                                        
                                        {/* Time Field */}
                                        <div className="md:col-span-3 mb-3 md:mb-0">
                                            <select
                                                value={shift.time}
                                                onChange={(e) => handleLocalShiftUpdate(shift.id, 'time', e.target.value)}
                                                className="w-full text-sm md:text-xs text-gray-500 bg-transparent border-b border-dashed border-gray-300 focus:border-purple-500 outline-none p-1"
                                            >
                                                {SHIFT_TIMES.map(t => (
                                                    <option key={t} value={t}>{t.split('(')[0]}</option>
                                                ))}
                                            </select>
                                        </div>
                                        
                                        {/* Type Toggles */}
                                        <div className="md:col-span-4 flex justify-between md:justify-center items-center mb-2 md:mb-0">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase md:hidden">Type</span>
                                            <div className="flex bg-white rounded-lg border shadow-sm p-1">
                                                <button onClick={() => handleLocalShiftUpdate(shift.id, 'type', ShiftType.STANDARD)} className={`px-4 md:px-3 py-1.5 md:py-1 rounded text-xs md:text-[10px] font-bold transition-all ${shift.type === ShiftType.STANDARD ? 'bg-green-100 text-green-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Normal</button>
                                                <button onClick={() => handleLocalShiftUpdate(shift.id, 'type', ShiftType.AA)} className={`px-4 md:px-3 py-1.5 md:py-1 rounded text-xs md:text-[10px] font-bold transition-all ${isAA ? 'bg-red-100 text-red-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>AA</button>
                                            </div>
                                        </div>
                                        
                                        {/* Delete Action */}
                                        <div className="md:col-span-2 text-right border-t md:border-t-0 pt-2 md:pt-0 mt-1 md:mt-0 flex justify-end">
                                            <button onClick={() => handleRemoveShift(shift.id)} className="p-2 md:p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all flex items-center gap-1" title="Remove Shift">
                                                <span className="md:hidden text-xs font-bold">Remove</span> <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                  );
                              })
                        )}
                    </div>
                    
                    <div className="space-y-4 shrink-0">
                        <div className={`transition-all duration-300 ${hasUnsavedShiftChanges ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none absolute bottom-0'}`}>
                            <Button onClick={handleSaveShiftConfiguration} fullWidth className="py-3 bg-orange-600 hover:bg-orange-700 shadow-lg text-white">
                                <Save className="w-4 h-4 mr-2" /> Save Shift Configuration
                            </Button>
                        </div>
                        <div className="pt-4 border-t bg-gray-50/50 p-4 rounded-xl border border-dashed border-gray-200">
                            <h5 className="text-xs font-bold uppercase text-gray-400 mb-2 flex items-center gap-2"><Plus className="w-3 h-3" /> Add New Shift</h5>
                            <div className="flex flex-col md:flex-row gap-2">
                                <div className="flex-1 flex flex-col">
                                    {newShiftDayName && (
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">
                                            {newShiftDayName}
                                        </span>
                                    )}
                                    <input type="date" value={newShiftDate} onChange={(e) => setNewShiftDate(e.target.value)} className="w-full p-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white" />
                                </div>
                                <div className="flex-1 flex flex-col justify-end">
                                    <select value={newShiftTime} onChange={(e) => setNewShiftTime(e.target.value as ShiftTime)} className="w-full p-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white h-[38px]">
                                        {SHIFT_TIMES.map(t => (<option key={t} value={t}>{t.split('(')[0]}</option>))}
                                    </select>
                                </div>
                                <div className="w-full md:w-24 flex flex-col justify-end">
                                    <select value={newShiftType} onChange={(e) => setNewShiftType(e.target.value as ShiftType)} className="w-full p-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white h-[38px]">
                                        <option value={ShiftType.STANDARD}>Normal</option>
                                        <option value={ShiftType.AA}>AA</option>
                                    </select>
                                </div>
                                <div className="flex flex-col justify-end">
                                    <Button onClick={handleAddShift} disabled={!newShiftDate} variant="secondary" className="px-4 py-2 text-xs h-[38px]">Add</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
