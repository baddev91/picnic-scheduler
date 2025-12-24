import React, { useState, useEffect } from 'react';
import { AppMode, ShiftTime, ShiftType, ShopperData, ShopperShift, AdminAvailabilityMap } from './types';
import { SHIFT_TIMES, formatDateKey, getShopperAllowedRange } from './constants';
import { Button } from './components/Button';
import { CalendarView } from './components/CalendarView';
import { Users, Shield, Download, ArrowRight, UserPlus, CheckCircle, AlertCircle, Save, Trash2, History, XCircle } from 'lucide-react';
import { isWeekend, startOfWeek, addDays, subDays, getDay, isSameDay, format, isWithinInterval } from 'date-fns';

const STORAGE_KEYS = {
  ADMIN: 'picnic_admin_availability',
  SHOPPERS: 'picnic_shopper_names',
  SELECTIONS: 'picnic_selections',
  INDEX: 'picnic_current_index',
  MODE: 'picnic_app_mode'
};

function App() {
  // State
  const [mode, setMode] = useState<AppMode>(AppMode.HOME);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  
  // Admin Availability: DateKey -> ShiftTime -> Array[Type]
  const [adminAvailability, setAdminAvailability] = useState<AdminAvailabilityMap>({});
  
  // Shopper Data
  const [shopperNames, setShopperNames] = useState<string[]>([]);
  const [currentShopperIndex, setCurrentShopperIndex] = useState(0);
  const [selections, setSelections] = useState<ShopperData[]>([]);
  
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
  // This avoids UTC conversions that `new Date(string)` might perform, ensuring
  // "2023-10-28" is always treated as that day, regardless of timezone.
  const getSafeDateFromKey = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const getDayFromKey = (dateStr: string): number => {
    return getDay(getSafeDateFromKey(dateStr));
  };

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  const handleAdminToggle = (date: string, shift: ShiftTime, type: ShiftType) => {
    setAdminAvailability(prev => {
      const dayConfig = prev[date] || {};
      
      // If specific shift config doesn't exist, it means ALL types were allowed by default.
      // So we initialize it with both AA and STANDARD, then toggle the target one.
      const currentTypesForShift = dayConfig[shift] || [ShiftType.AA, ShiftType.STANDARD];
      
      let newTypes: ShiftType[];
      if (currentTypesForShift.includes(type)) {
        // Remove it
        newTypes = currentTypesForShift.filter(t => t !== type);
      } else {
        // Add it back
        newTypes = [...currentTypesForShift, type];
      }

      return {
        ...prev,
        [date]: {
          ...dayConfig,
          [shift]: newTypes
        }
      };
    });
  };

  const isRestViolation = (dateStr: string, newTime: ShiftTime, currentShifts: ShopperShift[]): boolean => {
    const earlyShifts = [ShiftTime.OPENING, ShiftTime.MORNING];
    const lateShifts = [ShiftTime.NOON, ShiftTime.AFTERNOON];

    const isNewEarly = earlyShifts.includes(newTime);
    const isNewLate = lateShifts.includes(newTime);

    // Use safe parsing for date math
    const date = getSafeDateFromKey(dateStr);
    const prevDateKey = formatDateKey(subDays(date, 1));
    const nextDateKey = formatDateKey(addDays(date, 1));

    const prevShift = currentShifts.find(s => s.date === prevDateKey);
    const nextShift = currentShifts.find(s => s.date === nextDateKey);

    // Rule: Cannot do Early if Prev day was Late
    if (isNewEarly && prevShift && lateShifts.includes(prevShift.time)) {
      return true;
    }

    // Rule: Cannot do Late if Next day is Early
    if (isNewLate && nextShift && earlyShifts.includes(nextShift.time)) {
      return true;
    }

    return false;
  };

  const handleShopperToggle = (dateStr: string, shift: ShiftTime, type: ShiftType) => {
    const currentName = shopperNames[currentShopperIndex];
    const prevData = selections.find(s => s.name === currentName) || { name: currentName, shifts: [] };
    let newShifts = [...prevData.shifts];
    const targetDate = getSafeDateFromKey(dateStr); // Use safe date
    const allowedRange = getShopperAllowedRange();

    if (type === ShiftType.AA) {
      // ----------------------------------------------------------------------
      // AA LOGIC (Recurring within valid range)
      // ----------------------------------------------------------------------
      
      // 1. Generate potential recurring dates (Current week + Next week)
      // We only project forward one week because the range is limited to 2 weeks.
      const potentialDates = [
        targetDate,
        addDays(targetDate, 7),
      ];
      
      // Filter dates to ensure they fall within the allowed window
      const recurringDates = potentialDates
        .filter(d => isWithinInterval(d, allowedRange))
        .map(d => formatDateKey(d));

      // 2. Check current state (Are we adding or removing?)
      const isCurrentlySelected = newShifts.some(s => s.date === dateStr && s.time === shift && s.type === ShiftType.AA);
      
      if (isCurrentlySelected) {
        // REMOVING: Remove AA pattern for these dates
        newShifts = newShifts.filter(s => {
          // Only remove if it's one of the recurring dates calculated from this interaction
          const isTargetDate = recurringDates.includes(s.date);
          if (isTargetDate && s.type === ShiftType.AA) {
             return s.time !== shift;
          }
          return true;
        });
      } else {
        // ADDING: Enforce Max 2 AA rules (1 Weekday, 1 Weekend)
        
        // Check 1: Rest Violation
        if (isRestViolation(dateStr, shift, newShifts)) {
          alert("Rest Constraint: You cannot work an Opening/Morning shift after a Noon/Afternoon shift, or vice versa.");
          return;
        }

        // Check 2: Pattern Constraints
        const targetDayIndex = getDayFromKey(dateStr);
        const isTargetWeekend = targetDayIndex === 0 || targetDayIndex === 6;
        
        // Find existing AA patterns based on Day of Week
        const uniqueAADaysOfWeek = new Set<number>();
        newShifts.forEach(s => {
          if (s.type === ShiftType.AA) {
             uniqueAADaysOfWeek.add(getDayFromKey(s.date));
          }
        });

        // Determine if we have Weekday or Weekend patterns already
        let hasWeekdayPattern = false;
        let hasWeekendPattern = false;

        uniqueAADaysOfWeek.forEach(dayIndex => {
          if (dayIndex === 0 || dayIndex === 6) hasWeekendPattern = true; // 0=Sun, 6=Sat
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

        // Check 3: Time Conflict
        const hasTimeConflict = recurringDates.some(rDate => {
           return newShifts.some(s => s.date === rDate && s.time !== shift);
        });
        if (hasTimeConflict) {
           alert("You have a shift selected at a different time on one of these days. Please remove it before setting this AA pattern.");
           return;
        }

        // Apply Add
        recurringDates.forEach(rDate => {
           // Clear existing AA for this date/time just in case
           newShifts = newShifts.filter(s => !(s.date === rDate && s.time === shift && s.type === ShiftType.AA));
           
           newShifts.push({
             date: rDate,
             time: shift,
             type: ShiftType.AA
           });
        });
      }

    } else {
      // ----------------------------------------------------------------------
      // STANDARD LOGIC (Single day)
      // ----------------------------------------------------------------------
      
      if (isRestViolation(dateStr, shift, newShifts)) {
        alert("Rest Constraint: You cannot work an Opening/Morning shift after a Noon/Afternoon shift, or vice versa.");
        return;
      }

      const existingAA = newShifts.find(s => s.date === dateStr && s.type === ShiftType.AA);
      if (existingAA) {
        if (existingAA.time !== shift) {
          alert(`You have an AA shift at ${existingAA.time}. Your Standard shift must match the AA time for this day.`);
          return;
        }
      } else {
        newShifts = newShifts.filter(s => s.date !== dateStr || s.time === shift);
      }

      const existingIndex = newShifts.findIndex(s => s.date === dateStr && s.time === shift && s.type === ShiftType.STANDARD);
      if (existingIndex >= 0) {
        newShifts.splice(existingIndex, 1);
      } else {
        newShifts.push({ date: dateStr, time: shift, type: ShiftType.STANDARD });
      }
    }

    // Update State
    const newSelections = [...selections];
    const existingSelectionIndex = newSelections.findIndex(s => s.name === currentName);
    if (existingSelectionIndex >= 0) {
      newSelections[existingSelectionIndex] = { name: currentName, shifts: newShifts };
    } else {
      newSelections.push({ name: currentName, shifts: newShifts });
    }
    setSelections(newSelections);
  };

  const getExportCSV = () => {
    const header = ['Shopper Name', 'Date', 'Day of Week', 'Shift Time', 'Shift Type'];
    
    const rows = selections.flatMap(shopper => {
      // 1. Group shifts by Date + Time to identify overlaps (AA + Standard)
      const shiftMap = new Map<string, { date: string; time: string; types: Set<ShiftType> }>();

      shopper.shifts.forEach(s => {
        const key = `${s.date}|${s.time}`;
        if (!shiftMap.has(key)) {
          shiftMap.set(key, { date: s.date, time: s.time, types: new Set() });
        }
        shiftMap.get(key)!.types.add(s.type);
      });

      // 2. Convert to array and sort by date
      const uniqueSlots = Array.from(shiftMap.values());
      uniqueSlots.sort((a, b) => a.date.localeCompare(b.date));

      // 3. Generate CSV rows
      return uniqueSlots.map(slot => {
        const d = getSafeDateFromKey(slot.date);
        const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' });
        
        let typeLabel = '';
        if (slot.types.has(ShiftType.AA) && slot.types.has(ShiftType.STANDARD)) {
          typeLabel = 'AA + Standard'; // Explicitly show it's both
        } else if (slot.types.has(ShiftType.AA)) {
          typeLabel = 'AA';
        } else if (slot.types.has(ShiftType.STANDARD)) {
          typeLabel = 'Standard';
        }

        return [
          `"${shopper.name}"`,
          slot.date,
          dayOfWeek,
          `"${slot.time}"`,
          typeLabel
        ].join(',');
      });
    });

    return [header.join(','), ...rows].join('\n');
  };

  const downloadCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," + getExportCSV();
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "picnic_shifts_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

    // Validation: Exactly 1 Weekday Pattern and 1 Weekend Pattern
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

  const handleNextShopper = () => {
    const validation = validateCurrentShopper();
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    if (currentShopperIndex < shopperNames.length - 1) {
      setCurrentShopperIndex(prev => prev + 1);
    } else {
      downloadCSV(); // Auto download
      setMode(AppMode.SUMMARY);
    }
  };

  // --------------------------------------------------------------------------
  // Views
  // --------------------------------------------------------------------------

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
              // Automatically add any pending name in the input field when starting
              let finalNames = [...shopperNames];
              if (tempNameInput.trim()) {
                const name = tempNameInput.trim();
                // Only add if not already in the list
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

    // Check AA Coverage status for UI feedback
    const uniqueDays = new Set<number>();
    aaShifts.forEach(s => uniqueDays.add(getDayFromKey(s.date)));
    let hasWeekday = false;
    let hasWeekend = false;
    uniqueDays.forEach(d => {
      if (d === 0 || d === 6) hasWeekend = true;
      else hasWeekday = true;
    });

    // Determine if shopper is valid to proceed
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
                {/* Visual Status Indicators */}
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
                onClick={handleNextShopper} 
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
      {showRestorePrompt && renderRestorePrompt()}
      {!showRestorePrompt && (
        <>
          {mode === AppMode.HOME && renderHome()}
          {mode === AppMode.ADMIN && renderAdmin()}
          {mode === AppMode.SHOPPER_SETUP && renderShopperSetup()}
          {mode === AppMode.SHOPPER_FLOW && renderShopperFlow()}
          {mode === AppMode.SUMMARY && renderSummary()}
        </>
      )}
    </>
  );
}

export default App;