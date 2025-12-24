import React, { useState, useEffect } from 'react';
import { AppMode, ShiftTime, ShiftType, ShopperData, ShopperShift, AdminAvailabilityMap, ShopperDetails } from './types';
import { SHIFT_TIMES, formatDateKey, getShopperAllowedRange } from './constants';
import { Button } from './components/Button';
import { CalendarView } from './components/CalendarView';
import { Users, Shield, Download, ArrowRight, UserPlus, CheckCircle, AlertCircle, Save, Trash2, History, XCircle, Lock, Bus, Heart, Shirt, Footprints, Hand, MapPin, Building2 } from 'lucide-react';
import { isWeekend, startOfWeek, addDays, subDays, getDay, isSameDay, format, isWithinInterval } from 'date-fns';

const STORAGE_KEYS = {
  ADMIN: 'picnic_admin_availability',
  SHOPPERS: 'picnic_shopper_names',
  SELECTIONS: 'picnic_selections',
  INDEX: 'picnic_current_index',
  MODE: 'picnic_app_mode'
};

function App() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(false);

  // App State
  const [mode, setMode] = useState<AppMode>(AppMode.HOME);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  
  // Admin Availability: DateKey -> ShiftTime -> Array[Type]
  const [adminAvailability, setAdminAvailability] = useState<AdminAvailabilityMap>({});
  
  // Shopper Data
  const [shopperNames, setShopperNames] = useState<string[]>([]);
  const [currentShopperIndex, setCurrentShopperIndex] = useState(0);
  const [selections, setSelections] = useState<ShopperData[]>([]);
  
  // Modal State for Shopper Details
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [tempDetails, setTempDetails] = useState<ShopperDetails>({
    usePicnicBus: false,
    civilStatus: 'Single',
    clothingSize: 'M',
    shoeSize: '40',
    gloveSize: '8 (M)',
    isRandstad: false,
    address: ''
  });
  
  // Temporary Inputs
  const [tempNameInput, setTempNameInput] = useState('');

  // --------------------------------------------------------------------------
  // Persistence Logic
  // --------------------------------------------------------------------------

  // 1. On Mount: Check for existing data
  useEffect(() => {
    const hasSavedData = !!localStorage.getItem(STORAGE_KEYS.ADMIN) || !!localStorage.getItem(STORAGE_KEYS.SHOPPERS);
    
    if (hasSavedData) {
      setShowRestorePrompt(true);
    } else {
      setIsInitialized(true);
    }
  }, []);

  // 2. Auto-save effects (Only run after initialization to prevent overwriting with empty state)
  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem(STORAGE_KEYS.ADMIN, JSON.stringify(adminAvailability));
    localStorage.setItem(STORAGE_KEYS.SHOPPERS, JSON.stringify(shopperNames));
    localStorage.setItem(STORAGE_KEYS.SELECTIONS, JSON.stringify(selections));
    localStorage.setItem(STORAGE_KEYS.INDEX, JSON.stringify(currentShopperIndex));
    // We optionally save mode, but usually HOME is safer to return to unless deep in flow
    if (mode === AppMode.SHOPPER_FLOW || mode === AppMode.SHOPPER_SETUP) {
       localStorage.setItem(STORAGE_KEYS.MODE, mode);
    }
  }, [adminAvailability, shopperNames, selections, currentShopperIndex, mode, isInitialized]);

  // 3. Auto-download on Summary
  useEffect(() => {
    if (mode === AppMode.SUMMARY) {
      const timer = setTimeout(() => {
        downloadCSV();
      }, 500); // Short delay to ensure state is settled and UI is rendered
      return () => clearTimeout(timer);
    }
  }, [mode]);

  const handleRestoreSession = () => {
    try {
      const savedAdmin = JSON.parse(localStorage.getItem(STORAGE_KEYS.ADMIN) || '{}');
      const savedShoppers = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOPPERS) || '[]');
      const savedSelections = JSON.parse(localStorage.getItem(STORAGE_KEYS.SELECTIONS) || '[]');
      const savedIndex = JSON.parse(localStorage.getItem(STORAGE_KEYS.INDEX) || '0');
      const savedMode = localStorage.getItem(STORAGE_KEYS.MODE) as AppMode;

      setAdminAvailability(savedAdmin);
      setShopperNames(savedShoppers);
      setSelections(savedSelections);
      setCurrentShopperIndex(savedIndex);
      
      // If we were in the middle of shopper flow, verify data integrity before jumping there
      if (savedMode === AppMode.SHOPPER_FLOW && savedShoppers.length > 0) {
        setMode(AppMode.SHOPPER_FLOW);
      } else if (savedMode === AppMode.SHOPPER_SETUP) {
        setMode(AppMode.SHOPPER_SETUP);
      } else {
        setMode(AppMode.HOME);
      }
    } catch (e) {
      console.error("Failed to restore session", e);
      alert("Error restoring session data. Starting fresh.");
      handleClearSession();
    } finally {
      setShowRestorePrompt(false);
      setIsInitialized(true);
    }
  };

  const handleClearSession = () => {
    localStorage.clear();
    setAdminAvailability({});
    setShopperNames([]);
    setSelections([]);
    setCurrentShopperIndex(0);
    setMode(AppMode.HOME);
    setShowRestorePrompt(false);
    setIsInitialized(true);
  };

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  // Safely parse a "YYYY-MM-DD" string into a Date object at 00:00:00 LOCAL time.
  const getSafeDateFromKey = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const getDayFromKey = (dateStr: string): number => {
    return getDay(getSafeDateFromKey(dateStr));
  };

  const calculateGloveSize = (clothingSize: string): string => {
    // Mapping Logic: XS=6, S=7, M=8, L=9, XL=10, XXL=11, 3XL+=12
    const map: Record<string, string> = {
      'XS': '6 (XS)',
      'S': '7 (S)',
      'M': '8 (M)',
      'L': '9 (L)',
      'XL': '10 (XL)',
      'XXL': '11 (XXL)',
      '3XL': '12 (3XL)',
      '4XL': '12 (4XL)'
    };
    return map[clothingSize] || '8 (M)';
  };

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  const handleLogin = () => {
    if (password === '7709') {
      setIsAuthenticated(true);
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  const handleAdminToggle = (date: string, shift: ShiftTime, type: ShiftType) => {
    setAdminAvailability(prev => {
      const dayConfig = prev[date] || {};
      const currentTypesForShift = dayConfig[shift] || [ShiftType.AA, ShiftType.STANDARD];
      let newTypes: ShiftType[];
      if (currentTypesForShift.includes(type)) {
        newTypes = currentTypesForShift.filter(t => t !== type);
      } else {
        newTypes = [...currentTypesForShift, type];
      }
      return {
        ...prev,
        [date]: { ...dayConfig, [shift]: newTypes }
      };
    });
  };

  const isRestViolation = (dateStr: string, newTime: ShiftTime, currentShifts: ShopperShift[]): boolean => {
    const earlyShifts = [ShiftTime.OPENING, ShiftTime.MORNING];
    const lateShifts = [ShiftTime.NOON, ShiftTime.AFTERNOON];
    const isNewEarly = earlyShifts.includes(newTime);
    const isNewLate = lateShifts.includes(newTime);

    const date = getSafeDateFromKey(dateStr);
    const prevDateKey = formatDateKey(subDays(date, 1));
    const nextDateKey = formatDateKey(addDays(date, 1));
    const prevShift = currentShifts.find(s => s.date === prevDateKey);
    const nextShift = currentShifts.find(s => s.date === nextDateKey);

    if (isNewEarly && prevShift && lateShifts.includes(prevShift.time)) return true;
    if (isNewLate && nextShift && earlyShifts.includes(nextShift.time)) return true;
    return false;
  };

  const handleShopperToggle = (dateStr: string, shift: ShiftTime, type: ShiftType) => {
    const currentName = shopperNames[currentShopperIndex];
    const prevData = selections.find(s => s.name === currentName) || { name: currentName, shifts: [] };
    let newShifts = [...prevData.shifts];
    const targetDate = getSafeDateFromKey(dateStr); 
    const allowedRange = getShopperAllowedRange();

    if (type === ShiftType.AA) {
      const potentialDates = [targetDate, addDays(targetDate, 7)];
      const recurringDates = potentialDates.filter(d => isWithinInterval(d, allowedRange)).map(d => formatDateKey(d));
      const isCurrentlySelected = newShifts.some(s => s.date === dateStr && s.time === shift && s.type === ShiftType.AA);
      
      if (isCurrentlySelected) {
        newShifts = newShifts.filter(s => {
          const isTargetDate = recurringDates.includes(s.date);
          if (isTargetDate && s.type === ShiftType.AA) return s.time !== shift;
          return true;
        });
      } else {
        if (isRestViolation(dateStr, shift, newShifts)) {
          alert("Rest Constraint: You cannot work an Opening/Morning shift after a Noon/Afternoon shift, or vice versa.");
          return;
        }

        const targetDayIndex = getDayFromKey(dateStr);
        const isTargetWeekend = targetDayIndex === 0 || targetDayIndex === 6;
        const uniqueAADaysOfWeek = new Set<number>();
        newShifts.forEach(s => { if (s.type === ShiftType.AA) uniqueAADaysOfWeek.add(getDayFromKey(s.date)); });

        let hasWeekdayPattern = false;
        let hasWeekendPattern = false;
        uniqueAADaysOfWeek.forEach(dayIndex => {
          if (dayIndex === 0 || dayIndex === 6) hasWeekendPattern = true;
          else hasWeekdayPattern = true;
        });

        if (isTargetWeekend && hasWeekendPattern) {
          alert("You have already selected a Weekend AA pattern. You can only choose 1 Weekend slot.");
          return;
        }
        if (!isTargetWeekend && hasWeekdayPattern) {
          alert("You have already selected a Weekday AA pattern. You must select a Weekend day (Saturday or Sunday) for your second AA slot.");
          return;
        }

        const hasTimeConflict = recurringDates.some(rDate => newShifts.some(s => s.date === rDate && s.time !== shift));
        if (hasTimeConflict) {
           alert("You have a shift selected at a different time on one of these days. Please remove it before setting this AA pattern.");
           return;
        }

        recurringDates.forEach(rDate => {
           newShifts = newShifts.filter(s => !(s.date === rDate && s.time === shift && s.type === ShiftType.AA));
           newShifts.push({ date: rDate, time: shift, type: ShiftType.AA });
        });
      }
    } else {
      if (isRestViolation(dateStr, shift, newShifts)) {
        alert("Rest Constraint: You cannot work an Opening/Morning shift after a Noon/Afternoon shift, or vice versa.");
        return;
      }
      const existingAA = newShifts.find(s => s.date === dateStr && s.type === ShiftType.AA);
      if (existingAA && existingAA.time !== shift) {
        alert(`You have an AA shift at ${existingAA.time}. Your Standard shift must match the AA time for this day.`);
        return;
      } else if (!existingAA) {
        newShifts = newShifts.filter(s => s.date !== dateStr || s.time === shift);
      }

      const existingIndex = newShifts.findIndex(s => s.date === dateStr && s.time === shift && s.type === ShiftType.STANDARD);
      if (existingIndex >= 0) newShifts.splice(existingIndex, 1);
      else newShifts.push({ date: dateStr, time: shift, type: ShiftType.STANDARD });
    }

    const newSelections = [...selections];
    const existingSelectionIndex = newSelections.findIndex(s => s.name === currentName);
    const existingDetails = existingSelectionIndex >= 0 ? newSelections[existingSelectionIndex].details : undefined;
    
    if (existingSelectionIndex >= 0) {
      newSelections[existingSelectionIndex] = { name: currentName, shifts: newShifts, details: existingDetails };
    } else {
      newSelections.push({ name: currentName, shifts: newShifts });
    }
    setSelections(newSelections);
  };

  const getExportCSV = () => {
    const header = [
      'Shopper Name', 'Date', 'Day of Week', 'Shift Time', 'Shift Type', 
      'Picnic Bus', 'Civil Status', 'Clothes Size', 'Shoe Size', 'Glove Size', 'Agency (Randstad)', 'Address'
    ];
    
    const rows = selections.flatMap(shopper => {
      // Get details safe access
      const d = shopper.details || {
        usePicnicBus: false, civilStatus: '-', clothingSize: '-', shoeSize: '-', gloveSize: '-', isRandstad: false, address: '-'
      };

      const shiftMap = new Map<string, { date: string; time: string; types: Set<ShiftType> }>();
      shopper.shifts.forEach(s => {
        const key = `${s.date}|${s.time}`;
        if (!shiftMap.has(key)) shiftMap.set(key, { date: s.date, time: s.time, types: new Set() });
        shiftMap.get(key)!.types.add(s.type);
      });

      const uniqueSlots = Array.from(shiftMap.values());
      uniqueSlots.sort((a, b) => a.date.localeCompare(b.date));

      return uniqueSlots.map(slot => {
        const dateObj = getSafeDateFromKey(slot.date);
        const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        
        let typeLabel = '';
        if (slot.types.has(ShiftType.AA) && slot.types.has(ShiftType.STANDARD)) typeLabel = 'AA + Standard';
        else if (slot.types.has(ShiftType.AA)) typeLabel = 'AA';
        else if (slot.types.has(ShiftType.STANDARD)) typeLabel = 'Standard';

        return [
          `"${shopper.name}"`,
          slot.date,
          dayOfWeek,
          `"${slot.time}"`,
          typeLabel,
          d.usePicnicBus ? 'Yes' : 'No',
          d.civilStatus,
          d.clothingSize,
          d.shoeSize,
          d.gloveSize,
          d.isRandstad ? 'Yes' : 'No',
          `"${d.address || ''}"`
        ].join(',');
      });
    });

    return [header.join(','), ...rows].join('\n');
  };

  const downloadCSV = () => {
    try {
      const csvContent = "data:text/csv;charset=utf-8," + getExportCSV();
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "picnic_shifts_export.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Export failed", e);
      alert("Failed to generate CSV export. Please try again.");
    }
  };

  // --------------------------------------------------------------------------
  // Validators
  // --------------------------------------------------------------------------
  
  const validateCurrentShopper = (): { valid: boolean; error?: string } => {
    const currentName = shopperNames[currentShopperIndex];
    const data = selections.find(s => s.name === currentName);
    if (!data) return { valid: false, error: "Please select at least AA shifts." };

    const aaShifts = data.shifts.filter(s => s.type === ShiftType.AA);
    if (aaShifts.length === 0) return { valid: false, error: "You must select AA shifts." };

    const uniqueDays = new Set<number>();
    aaShifts.forEach(s => uniqueDays.add(getDayFromKey(s.date)));
    let hasWeekday = false;
    let hasWeekend = false;
    uniqueDays.forEach(d => {
      if (d === 0 || d === 6) hasWeekend = true;
      else hasWeekday = true;
    });

    if (!hasWeekday) return { valid: false, error: "You are missing a Weekday AA pattern." };
    if (!hasWeekend) return { valid: false, error: "You are missing a Weekend AA pattern." };
    return { valid: true };
  };

  const handleNextShopperClick = () => {
    const validation = validateCurrentShopper();
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    
    // Initialize modal with existing details or defaults
    const currentName = shopperNames[currentShopperIndex];
    const existing = selections.find(s => s.name === currentName)?.details;
    
    if (existing) {
      setTempDetails({
        ...existing,
        address: existing.address || '' // Ensure address is never undefined
      });
    } else {
      setTempDetails({
        usePicnicBus: false,
        civilStatus: 'Single',
        clothingSize: 'M',
        shoeSize: '40',
        gloveSize: '8 (M)',
        isRandstad: false,
        address: ''
      });
    }
    
    setShowDetailsModal(true);
  };

  const handleDetailsSubmit = () => {
    if (tempDetails.isRandstad && !tempDetails.address?.trim()) {
      alert("Address is required if registered with Randstad.");
      return;
    }

    try {
      // Save details
      const currentName = shopperNames[currentShopperIndex];
      const newSelections = [...selections];
      const idx = newSelections.findIndex(s => s.name === currentName);
      if (idx >= 0) {
        newSelections[idx].details = tempDetails;
        setSelections(newSelections);
      }

      // Close modal immediately
      setShowDetailsModal(false);

      // Proceed state transition
      // We rely on the useEffect hook to handle the download if we transition to SUMMARY
      if (currentShopperIndex < shopperNames.length - 1) {
        setCurrentShopperIndex(prev => prev + 1);
      } else {
        setMode(AppMode.SUMMARY);
      }
    } catch (error) {
      console.error("Error submitting details:", error);
      alert("An error occurred while saving details. Please try again.");
    }
  };

  // --------------------------------------------------------------------------
  // Views
  // --------------------------------------------------------------------------

  const renderDetailsModal = () => {
    if (!showDetailsModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
         <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">Additional Details</h3>
              <div className="text-sm text-gray-500">{shopperNames[currentShopperIndex]}</div>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
               {/* 1. Picnic Bus */}
               <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                       <Bus className="w-5 h-5" />
                     </div>
                     <span className="font-medium text-gray-700">Use Free Picnic Bus?</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={tempDetails.usePicnicBus}
                      onChange={(e) => setTempDetails({...tempDetails, usePicnicBus: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
               </div>

               {/* 2. Civil Status */}
               <div className="space-y-2">
                 <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Heart className="w-4 h-4 text-pink-500" /> Civil Status
                 </label>
                 <select 
                   value={tempDetails.civilStatus}
                   onChange={(e) => setTempDetails({...tempDetails, civilStatus: e.target.value})}
                   className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-pink-500 outline-none"
                 >
                   <option value="Single">Single (Alleenstaand)</option>
                   <option value="Married">Married (Gehuwd)</option>
                   <option value="Cohabiting">Cohabiting (Samenwonend)</option>
                   <option value="Registered Partnership">Registered Partnership (Geregistreerd partnerschap)</option>
                   <option value="Divorced">Divorced (Gescheiden)</option>
                 </select>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  {/* 3. Clothing Size */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                       <Shirt className="w-4 h-4 text-indigo-500" /> Clothes Size
                    </label>
                    <select 
                      value={tempDetails.clothingSize}
                      onChange={(e) => {
                        const newSize = e.target.value;
                        setTempDetails({
                          ...tempDetails, 
                          clothingSize: newSize,
                          gloveSize: calculateGloveSize(newSize) // Auto update gloves
                        });
                      }}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* 4. Shoe Size */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                       <Footprints className="w-4 h-4 text-orange-500" /> Shoe Size
                    </label>
                    <select 
                      value={tempDetails.shoeSize}
                      onChange={(e) => setTempDetails({...tempDetails, shoeSize: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 outline-none"
                    >
                      {Array.from({length: 16}, (_, i) => i + 35).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
               </div>

               {/* 5. Glove Size (Auto) */}
               <div className="space-y-2">
                 <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Hand className="w-4 h-4 text-teal-500" /> Glove Size (Auto)
                 </label>
                 <div className="w-full bg-gray-100 border border-gray-200 rounded-lg px-4 py-2 text-gray-600 font-medium">
                   {tempDetails.gloveSize}
                 </div>
                 <p className="text-xs text-gray-400">Calculated based on clothing size.</p>
               </div>

               <hr className="border-gray-200" />

               {/* 6. Randstad */}
               <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-yellow-100 text-yellow-600 rounded-lg">
                         <Building2 className="w-5 h-5" />
                       </div>
                       <span className="font-medium text-gray-700">Hired via Randstad?</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={tempDetails.isRandstad}
                        onChange={(e) => setTempDetails({...tempDetails, isRandstad: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                    </label>
                 </div>
                 
                 {tempDetails.isRandstad && (
                   <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                     <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <MapPin className="w-4 h-4 text-red-500" /> Full Address <span className="text-red-500">*</span>
                     </label>
                     <input 
                       type="text" 
                       value={tempDetails.address || ''} 
                       onChange={(e) => setTempDetails({...tempDetails, address: e.target.value})}
                       placeholder="Street, Number, Postcode, City"
                       className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-yellow-500 outline-none"
                     />
                   </div>
                 )}
               </div>

            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>Cancel</Button>
              <Button onClick={handleDetailsSubmit}>Confirm & Continue</Button>
            </div>
         </div>
      </div>
    );
  };

  const renderLogin = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full border border-gray-100 text-center space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <Lock className="w-8 h-8 text-red-600" />
            </div>
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Welcome</h2>
                <p className="text-gray-500 mt-2">Please enter the access code to continue.</p>
            </div>
            <div>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setAuthError(false); }}
                    className={`w-full px-4 py-3 rounded-lg border ${authError ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300 focus:ring-2 focus:ring-green-500'} outline-none transition-all`}
                    placeholder="Password"
                    autoFocus
                />
                {authError && <p className="text-red-500 text-sm mt-2 text-left flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Incorrect password</p>}
            </div>
            <Button fullWidth onClick={(e) => { e.preventDefault(); handleLogin(); }}>
                Enter
            </Button>
        </form>
    </div>
  );

  const renderRestorePrompt = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-gray-100 animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <History className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Restore Session?</h2>
          <p className="text-gray-500">
            We found saved data from a previous session (Admin settings or Shopper list). 
            Would you like to continue where you left off?
          </p>
        </div>
        <div className="flex flex-col gap-3 mt-8">
          <Button onClick={handleRestoreSession} className="flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" /> Yes, Restore Data
          </Button>
          <Button onClick={handleClearSession} variant="secondary" className="flex items-center justify-center gap-2">
            <Trash2 className="w-4 h-4" /> No, Start Fresh
          </Button>
        </div>
      </div>
    </div>
  );

  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-8 bg-gray-50">
      <div className="text-center space-y-4 max-w-lg">
        <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight">Picnic <span className="text-red-500">Scheduler</span></h1>
        <p className="text-gray-500 text-lg">Manage shift availability and onboard new shoppers efficiently.</p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6 w-full max-w-2xl">
        <button 
          onClick={() => setMode(AppMode.ADMIN)}
          className="group relative flex flex-col items-center p-8 bg-white rounded-2xl shadow-sm border border-gray-200 hover:border-red-300 hover:shadow-lg transition-all duration-300"
        >
          <div className="p-4 bg-red-100 rounded-full mb-4 group-hover:scale-110 transition-transform">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">Admin Mode</h3>
          <p className="text-sm text-gray-500 mt-2 text-center">Set global shift availability for the upcoming period.</p>
        </button>

        <button 
          onClick={() => setMode(AppMode.SHOPPER_SETUP)}
          className="group relative flex flex-col items-center p-8 bg-white rounded-2xl shadow-sm border border-gray-200 hover:border-green-300 hover:shadow-lg transition-all duration-300"
        >
          <div className="p-4 bg-green-100 rounded-full mb-4 group-hover:scale-110 transition-transform">
            <Users className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">SER Mode</h3>
          <p className="text-sm text-gray-500 mt-2 text-center">Start the shift selection process for new shoppers.</p>
        </button>
      </div>
    </div>
  );

  const renderAdmin = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b sticky top-0 z-20 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-red-500" />
          <h1 className="font-bold text-xl text-gray-800">Admin Configuration</h1>
        </div>
        <Button variant="secondary" onClick={() => setMode(AppMode.HOME)}>Back to Home</Button>
      </header>
      <main className="flex-1 p-6 overflow-auto">
         <div className="max-w-4xl mx-auto mb-6">
           <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-semibold text-blue-800">Admin Controls</h4>
                <p className="text-blue-700 text-sm mt-1">
                  Click on a date to configure availability. For each time slot, you can toggle <span className="font-bold text-red-600">AA</span> and <span className="font-bold text-green-600">Standard</span> availability independently.
                  <br/>
                  <span className="text-xs text-blue-500 mt-1 inline-block">Changes are saved automatically.</span>
                </p>
              </div>
           </div>
         </div>
        <CalendarView 
          mode="ADMIN"
          adminAvailability={adminAvailability}
          onAdminToggle={handleAdminToggle}
        />
      </main>
    </div>
  );

  const renderShopperSetup = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <UserPlus className="w-8 h-8 text-green-600" />
          <h2 className="text-2xl font-bold text-gray-800">Add Shoppers</h2>
        </div>
        
        <div className="space-y-4 mb-8">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={tempNameInput}
              onChange={(e) => setTempNameInput(e.target.value)}
              onKeyDown={(e) => {
                if(e.key === 'Enter' && tempNameInput.trim()) {
                   const name = tempNameInput.trim();
                   if (shopperNames.includes(name)) {
                     alert("Name already exists!");
                     return;
                   }
                  setShopperNames([...shopperNames, name]);
                  setTempNameInput('');
                }
              }}
              placeholder="Enter shopper name"
              className="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
            <Button 
              onClick={() => {
                if(tempNameInput.trim()) {
                  const name = tempNameInput.trim();
                   if (shopperNames.includes(name)) {
                     alert("Name already exists!");
                     return;
                   }
                  setShopperNames([...shopperNames, name]);
                  setTempNameInput('');
                }
              }}
              disabled={!tempNameInput.trim()}
            >Add</Button>
          </div>
          
          <div className="max-h-60 overflow-y-auto space-y-2">
            {shopperNames.map((name, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg animate-in slide-in-from-left-2 duration-300">
                <span className="font-medium text-gray-700">{name}</span>
                <button 
                  onClick={() => setShopperNames(shopperNames.filter((_, i) => i !== idx))}
                  className="text-red-400 hover:text-red-600 px-2"
                >
                  &times;
                </button>
              </div>
            ))}
            {shopperNames.length === 0 && (
              <div className="text-center text-gray-400 py-4 italic">No shoppers added yet.</div>
            )}
            {shopperNames.length > 0 && (
              <div className="text-right text-xs text-gray-500 mt-2">
                Total: {shopperNames.length} shoppers
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <Button variant="secondary" onClick={() => setMode(AppMode.HOME)} className="flex-1">Cancel</Button>
          <Button 
            fullWidth 
            disabled={shopperNames.length === 0 && !tempNameInput.trim()}
            onClick={() => {
              let finalNames = [...shopperNames];
              if (tempNameInput.trim()) {
                const name = tempNameInput.trim();
                if (!finalNames.includes(name)) {
                  finalNames.push(name);
                  setShopperNames(finalNames);
                  setTempNameInput('');
                }
              }

              if (finalNames.length === 0) {
                 return;
              }

              setCurrentShopperIndex(0);
              setMode(AppMode.SHOPPER_FLOW);
            }}
            className="flex-1"
          >
            Start Session
          </Button>
        </div>
      </div>
    </div>
  );

  const renderShopperFlow = () => {
    const currentName = shopperNames[currentShopperIndex];
    const currentData = selections.find(s => s.name === currentName);
    const aaShifts = currentData?.shifts.filter(s => s.type === ShiftType.AA) || [];
    const stdCount = currentData?.shifts.filter(s => s.type === ShiftType.STANDARD).length || 0;

    const uniqueDays = new Set<number>();
    aaShifts.forEach(s => uniqueDays.add(getDayFromKey(s.date)));
    let hasWeekday = false;
    let hasWeekend = false;
    uniqueDays.forEach(d => {
      if (d === 0 || d === 6) hasWeekend = true;
      else hasWeekday = true;
    });

    const validation = validateCurrentShopper();

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
         <header className="bg-white border-b sticky top-0 z-20 px-6 py-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                 <div className="text-xs font-bold text-green-600 uppercase tracking-wider">Current Shopper</div>
                 <div className="text-xs font-medium text-gray-400">({currentShopperIndex + 1} of {shopperNames.length})</div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{currentName}</h1>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden md:flex gap-3 text-sm">
                <div className={`px-3 py-1 rounded-full font-medium border flex items-center gap-2 ${hasWeekday ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                   <span>Weekday AA</span>
                   {hasWeekday ? <CheckCircle className="w-4 h-4"/> : <XCircle className="w-4 h-4"/>}
                </div>
                <div className={`px-3 py-1 rounded-full font-medium border flex items-center gap-2 ${hasWeekend ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                   <span>Weekend AA</span>
                   {hasWeekend ? <CheckCircle className="w-4 h-4"/> : <XCircle className="w-4 h-4"/>}
                </div>
                
                <div className="w-px h-6 bg-gray-200 mx-1"></div>

                <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium border border-blue-100">
                  Standard Shifts: {stdCount}
                </div>
              </div>
              <Button 
                onClick={handleNextShopperClick} 
                disabled={!validation.valid}
                className="flex items-center gap-2"
              >
                {currentShopperIndex === shopperNames.length - 1 ? 'Finish & Export' : 'Next Shopper'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
         </header>

         <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-start">
                 <div className="bg-green-100 p-2 rounded-lg text-green-700 shrink-0">
                   <Users className="w-6 h-6" />
                 </div>
                 <div className="flex-1">
                   <h3 className="font-semibold text-gray-800">Shift Selection Rules</h3>
                   <ul className="list-disc list-inside text-sm text-gray-600 mt-2 space-y-1">
                     <li>You must select <span className="font-bold text-red-600">AA (Always Available)</span> shifts.</li>
                     <li>AA Requirement: <span className="font-medium">1 Weekday</span> + <span className="font-medium">1 Weekend</span> day.</li>
                     <li><span className="font-medium text-purple-600">Recurring:</span> Selecting an AA day applies it to both the current and next week automatically.</li>
                     <li><span className="font-bold text-green-600">Standard</span> shifts are specific to the date selected.</li>
                     <li>If you select Standard on an AA day, it must match the AA time.</li>
                     <li><span className="font-medium text-orange-600">Rest Policy:</span> No Opening/Morning after Noon/Afternoon the previous day.</li>
                   </ul>
                 </div>
              </div>

              <CalendarView 
                key={currentShopperIndex}
                mode="SHOPPER"
                adminAvailability={adminAvailability}
                currentShopperShifts={currentData?.shifts}
                onShopperToggle={handleShopperToggle}
              />
            </div>
         </main>
      </div>
    );
  };

  const renderSummary = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
       <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl p-8 text-center space-y-6">
         <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
           <CheckCircle className="w-10 h-10 text-green-600" />
         </div>
         
         <div>
           <h2 className="text-3xl font-bold text-gray-900">All Done!</h2>
           <p className="text-gray-500 mt-2">The session is complete. The shift file has been downloaded automatically.</p>
         </div>

         <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-left">
           <h4 className="font-semibold text-gray-700 mb-2 border-b pb-2">Session Summary</h4>
           <div className="space-y-2 text-sm text-gray-600">
             {selections.map((s, i) => (
               <div key={i} className="flex justify-between">
                 <span>{s.name}</span>
                 <span className="font-medium text-gray-900">{s.shifts.length} shifts selected</span>
               </div>
             ))}
           </div>
         </div>

         <div className="flex flex-col gap-3">
            <Button onClick={downloadCSV} variant="outline" className="flex items-center justify-center gap-2">
               <Download className="w-4 h-4" /> Download Again
            </Button>
            <Button onClick={handleClearSession} className="flex items-center justify-center gap-2">
               Start New Session
            </Button>
         </div>
       </div>
    </div>
  );

  return (
    <>
      {!isAuthenticated && renderLogin()}
      {isAuthenticated && showRestorePrompt && renderRestorePrompt()}
      {isAuthenticated && !showRestorePrompt && (
        <>
          {mode === AppMode.HOME && renderHome()}
          {mode === AppMode.ADMIN && renderAdmin()}
          {mode === AppMode.SHOPPER_SETUP && renderShopperSetup()}
          {mode === AppMode.SHOPPER_FLOW && renderShopperFlow()}
          {mode === AppMode.SUMMARY && renderSummary()}
          {renderDetailsModal()}
        </>
      )}
    </>
  );
}

export default App;