
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ShiftTime, ShiftType, ShopperData, AdminAvailabilityMap, ShopperDetails, ShopperStep, BusConfig, ShopperShift, AppMode } from '../types';
import { SHIFT_TIMES, formatDateKey, getShopperAllowedRange, getShopperMinDate } from '../constants';
import { Button } from './Button';
import { CalendarView } from './CalendarView';
import { MobileInstructionModal } from './MobileInstructionModal';
import { User, PlayCircle, CheckCircle, ArrowRight, Layers, CalendarCheck, Globe2 } from 'lucide-react';
import { addDays, getDay, endOfWeek, addWeeks, isBefore } from 'date-fns';
import { supabase } from '../supabaseClient';
import { ShopperAAWizard } from './ShopperAAWizard';
import { ShopperSummary } from './ShopperSummary';
import { ShopperDetailsModal } from './ShopperDetailsModal';
import { FWDConfirmationModal } from './FWDConfirmationModal';
import { getSafeDateFromKey, isRestViolation, isConsecutiveDaysViolation, isOpeningShiftViolation, validateShopperRange, calculateMinStartDate } from '../utils/validation';

interface ShopperAppProps {
  shopperName: string;
  adminAvailability: AdminAvailabilityMap;
  savedCloudTemplate: any;
  busConfig: BusConfig;
  onExit: () => void;
}

const STORAGE_KEY = 'picnic_shopper_session';

// Common nationalities for quick selection
const TOP_NATIONALITIES = [
    { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
    { code: 'PL', name: 'Poland', flag: '🇵🇱' },
    { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
    { code: 'RO', name: 'Romania', flag: '🇷🇴' },
    { code: 'BG', name: 'Bulgaria', flag: '🇧🇬' },
    { code: 'ES', name: 'Spain', flag: '🇪🇸' },
    { code: 'IT', name: 'Italy', flag: '🇮🇹' },
    { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
    { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
];

const ALL_COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
    "Bangladesh", "Belarus", "Belgium", "Bosnia and Herzegovina", "Brazil", "Bulgaria",
    "Canada", "China", "Colombia", "Croatia", "Cyprus", "Czech Republic",
    "Denmark", "Egypt", "Estonia", "Ethiopia", "Finland", "France",
    "Georgia", "Germany", "Ghana", "Greece", "Hungary", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
    "Japan", "Jordan", "Kazakhstan", "Kenya", "Latvia", "Lebanon", "Lithuania", "Luxembourg",
    "Malaysia", "Malta", "Mexico", "Moldova", "Morocco",
    "Netherlands", "New Zealand", "Nigeria", "North Macedonia", "Norway",
    "Pakistan", "Philippines", "Poland", "Portugal",
    "Romania", "Russia",
    "Saudi Arabia", "Serbia", "Singapore", "Slovakia", "Slovenia", "Somalia", "South Africa", "South Korea", "Spain", "Sri Lanka", "Sudan", "Sweden", "Switzerland", "Syria",
    "Thailand", "Tunisia", "Turkey",
    "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uzbekistan",
    "Venezuela", "Vietnam", "Yemen"
];

export const ShopperApp: React.FC<ShopperAppProps> = ({
  shopperName,
  adminAvailability,
  savedCloudTemplate,
  busConfig,
  onExit
}) => {
  // State Initialization with LocalStorage check
  const [step, setStep] = useState<ShopperStep>(() => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
          try { return JSON.parse(saved).step ?? ShopperStep.NATIONALITY_SELECTION; } catch(e) {}
      }
      return ShopperStep.NATIONALITY_SELECTION;
  });

  const [selections, setSelections] = useState<ShopperData[]>(() => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
          try { 
              const parsed = JSON.parse(saved);
              if (parsed.selections) return parsed.selections;
          } catch(e) {}
      }
      return [{ 
          name: shopperName, 
          shifts: [], 
          details: { 
              nationality: '', // Initialize empty
              usePicnicBus: null, civilStatus: '', gender: '', clothingSize: 'M', 
              shoeSize: '40', gloveSize: '8 (M)', isRandstad: false, address: '' 
          } 
      }];
  });
  
  // Refactored AA State: Array of selected days/times
  const [aaSelections, setAaSelections] = useState<{ dayIndex: number; time: ShiftTime | null }[]>(() => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
          try { return JSON.parse(saved).aaSelections || []; } catch(e) {}
      }
      return [];
  });

  const [fwdCounts, setFwdCounts] = useState<Record<string, number>>({});
  const [showFWDConfirmModal, setShowFWDConfirmModal] = useState(false);
  const [pendingFWD, setPendingFWD] = useState<{ date: string; shift: ShiftTime } | null>(null);
  const [isCheckingFWD, setIsCheckingFWD] = useState(false); // New Loading State
  
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [tempDetails, setTempDetails] = useState<ShopperDetails>(selections[0].details!);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showMobileInstructions, setShowMobileInstructions] = useState(false);
  const [viewMode, setViewMode] = useState<'FLOW' | 'SUMMARY'>(() => {
      // Logic: If user was in details step (3), show summary
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
         try {
             const parsed = JSON.parse(saved);
             if (parsed.step === ShopperStep.DETAILS) return 'SUMMARY';
         } catch(e) {}
      }
      return 'FLOW';
  });

  // Animation State for Counter
  const [countAnim, setCountAnim] = useState(false);

  const flowScrollContainerRef = useRef<HTMLDivElement>(null);

  // --- AUTO SAVE EFFECT ---
  useEffect(() => {
    const sessionData = {
        name: selections[0].name, // Top level for App.tsx to verify
        step,
        selections,
        aaSelections
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
  }, [step, selections, aaSelections]);

  // Effects
  useEffect(() => {
    fetchFWDCounts();
    // Scroll reset on step change
    setTimeout(() => { if (flowScrollContainerRef.current) flowScrollContainerRef.current.scrollTop = 0; window.scrollTo(0, 0); }, 50);
    if (viewMode === 'FLOW' && step > 0) setShowMobileInstructions(true);
  }, [step, viewMode]);

  // --- SAFETY CHECK: Force Nationality Selection if missing ---
  useEffect(() => {
      if (step > ShopperStep.NATIONALITY_SELECTION) {
          const currentNat = selections[0].details?.nationality;
          if (!currentNat) {
              setStep(ShopperStep.NATIONALITY_SELECTION);
          }
      }
  }, [step, selections]);

  // --- LOGIC: Calculate Total Shifts (FWD + AA + Standard) in the valid 2-week range ---
  const currentData = selections[0];
  const fwdDateStr = currentData.details?.firstWorkingDay;
  let totalShiftCount = 0;

  if (fwdDateStr) {
      const fwdDate = getSafeDateFromKey(fwdDateStr);
      // Range: FWD -> Sunday of the *next* week (Total 2 working weeks roughly)
      const limitDateKey = formatDateKey(endOfWeek(addWeeks(fwdDate, 1), { weekStartsOn: 1 }));
      
      totalShiftCount = currentData.shifts.filter(s => 
          s.date >= fwdDateStr && s.date <= limitDateKey
      ).length;
  } else {
      // If FWD is not set yet, just show current selection count (likely just AA generated ones)
      totalShiftCount = currentData.shifts.length;
  }

  const aaCount = currentData.shifts.filter(s => s.type === ShiftType.AA).length;
  const stdCount = currentData.shifts.filter(s => s.type === ShiftType.STANDARD).length; // Kept for header debug only

  // Trigger animation when TOTAL shift count changes
  useEffect(() => {
      if (step === ShopperStep.STANDARD_SELECTION) {
          setCountAnim(true);
          const t = setTimeout(() => setCountAnim(false), 300);
          return () => clearTimeout(t);
      }
  }, [totalShiftCount, step]);

  // Logic
  const fetchFWDCounts = async () => {
      const { data: shoppers } = await supabase.from('shoppers').select('id, details');
      if (!shoppers) return;

      const firstDayMap: Record<string, string> = {};
      const relevantShopperIds: string[] = [];
      shoppers.forEach((s: any) => {
          if (s.details && s.details.firstWorkingDay) {
              firstDayMap[s.id] = s.details.firstWorkingDay;
              relevantShopperIds.push(s.id);
          }
      });

      if (relevantShopperIds.length === 0) { setFwdCounts({}); return; }

      const { data: shifts } = await supabase.from('shifts').select('shopper_id, date, time').in('shopper_id', relevantShopperIds);
      if (!shifts) return;

      const counts: Record<string, number> = {};
      shifts.forEach((shift) => {
          const shoppersFWD = firstDayMap[shift.shopper_id];
          if (shoppersFWD && shift.date === shoppersFWD) {
              const key = `${shift.date}_${shift.time}`;
              counts[key] = (counts[key] || 0) + 1;
          }
      });
      setFwdCounts(counts);
  };

  const handleNationalitySubmit = (nationality: string) => {
      const existing = selections[0];
      setSelections([{ ...existing, details: { ...existing.details, nationality } as ShopperDetails }]);
      setStep(ShopperStep.AA_SELECTION);
  };

  const handleAAWizardSubmit = () => {
      // Validation: Must select exactly 2 days
      if (aaSelections.length !== 2) { 
          alert("Please select exactly 2 days for your AA pattern."); 
          return; 
      }
      
      // Validation: Must select time for all days
      if (aaSelections.some(s => !s.time)) {
          alert("Please select a shift time for every selected day.");
          return;
      }

      // Validation: Rule Logic (0 WD + 2 WE) OR (1 WD + 1 WE)
      const weekdays = aaSelections.filter(s => s.dayIndex >= 1 && s.dayIndex <= 5);
      const weekends = aaSelections.filter(s => s.dayIndex === 0 || s.dayIndex === 6);

      if (weekdays.length > 1) {
          alert("You can select a maximum of 1 Weekday (Mon-Fri).");
          return;
      }
      
      // Implicitly check weekend requirement (since total is 2 and max weekday is 1, at least 1 MUST be weekend)
      if (weekends.length === 0) {
           alert("You must select at least 1 Weekend day.");
           return;
      }

      const range = getShopperAllowedRange();
      const newShifts: ShopperShift[] = [];
      let currentDate = range.start;
      const minDate = getShopperMinDate();
      
      while (currentDate <= range.end) {
          if (isBefore(currentDate, minDate)) { currentDate = addDays(currentDate, 1); continue; }
          const dayIndex = getDay(currentDate);
          const dateStr = formatDateKey(currentDate);
          
          const selectionForDay = aaSelections.find(s => s.dayIndex === dayIndex);

          if (selectionForDay && selectionForDay.time) {
              const checkAvailability = (t: ShiftTime) => {
                  const config = adminAvailability[dateStr];
                  return (!config || !config[t] || config[t]?.includes(ShiftType.AA));
              };
              
              if (checkAvailability(selectionForDay.time)) {
                  newShifts.push({ date: dateStr, time: selectionForDay.time, type: ShiftType.AA });
              }
          }
          currentDate = addDays(currentDate, 1);
      }

      const existingDetails = selections[0].details;
      // Preserve nationality, reset FWD
      const newDetails = { ...existingDetails, firstWorkingDay: undefined };

      const newShopperData = { name: shopperName, shifts: newShifts, details: newDetails };
      
      setSelections([newShopperData]);
      setStep(ShopperStep.FWD_SELECTION);
  };

  const handleFWDSelection = (dateStr: string, shift: ShiftTime) => {
      if (shift === ShiftTime.OPENING || shift === ShiftTime.NOON) { alert("Invalid First Day Shift."); return; }
      setPendingFWD({ date: dateStr, shift });
      setShowFWDConfirmModal(true);
  };

  const confirmFWDSelection = async () => {
      if (!pendingFWD) return;
      
      setIsCheckingFWD(true);
      const { date: dateStr, shift } = pendingFWD;

      // --- 1. LOCAL RULE CHECK: 11h REST VIOLATION ---
      const currentShifts = selections[0].shifts;
      
      if (isRestViolation(dateStr, shift, currentShifts)) {
          alert("Rest Rule Violation: The shift you selected is too close to your next AA shift (less than 11 hours break). Please select a different start time or day.");
          setIsCheckingFWD(false);
          setShowFWDConfirmModal(false);
          return;
      }

      try {
          // --- 2. REMOTE CHECK: CAPACITY ---
          const { data: potentialConflicts } = await supabase
              .from('shoppers')
              .select('id')
              .eq('details->>firstWorkingDay', dateStr);

          if (potentialConflicts && potentialConflicts.length > 0) {
              const conflictingIds = potentialConflicts.map(c => c.id);
              
              const { count } = await supabase
                  .from('shifts')
                  .select('*', { count: 'exact', head: true })
                  .in('shopper_id', conflictingIds)
                  .eq('date', dateStr)
                  .eq('time', shift);

              if (count !== null && count >= 5) {
                  alert("Oops! This slot was just filled by another user. Please select a different time or day.");
                  fetchFWDCounts(); // Refresh the UI counters
                  setIsCheckingFWD(false);
                  setShowFWDConfirmModal(false);
                  return;
              }
          }
      } catch (err) {
          console.error("Availability check failed", err);
      }

      // Proceed with local selection if check passed
      const existing = selections[0];
      const previousFWD = existing.details?.firstWorkingDay;
      const wasAA = existing.shifts.some(s => s.date === dateStr && s.time === shift && s.type === ShiftType.AA);
      
      // Filter existing shifts
      const shiftsBuffer = existing.shifts.filter(s => {
          if (s.date === dateStr) return false;
          if (previousFWD && s.date === previousFWD && s.type === ShiftType.STANDARD) return false;
          if (s.date < dateStr) return false;
          return true;
      });
      
      // Add the FWD
      shiftsBuffer.push({ date: dateStr, time: shift, type: wasAA ? ShiftType.AA : ShiftType.STANDARD });
      
      // --- CRITICAL FIX: AUTOMATIC OPENING SHIFT CORRECTION ---
      // Sort shifts chronologically to determine 1st and 2nd shift position
      shiftsBuffer.sort((a, b) => a.date.localeCompare(b.date));

      // Map over shifts and force "Morning" if it's the 1st or 2nd shift and current time is "Opening"
      // This handles cases where an AA shift falls on the 2nd day and was set to Opening
      const correctedShifts = shiftsBuffer.map((s, index) => {
          if (index < 2 && s.time === ShiftTime.OPENING) {
              return { ...s, time: ShiftTime.MORNING };
          }
          return s;
      });

      setSelections([{ 
          ...existing, 
          shifts: correctedShifts, 
          details: { ...existing.details, firstWorkingDay: dateStr } as ShopperDetails 
      }]);
      
      setStep(ShopperStep.STANDARD_SELECTION);
      setShowFWDConfirmModal(false);
      setPendingFWD(null);
      setIsCheckingFWD(false);
  };

  const handleStandardShiftToggle = (dateStr: string, shift: ShiftTime, type: ShiftType) => {
    const prevData = selections[0];
    let newShifts = [...prevData.shifts];
    const fwd = prevData.details?.firstWorkingDay;
    if (!fwd) { alert("First Working Day not set."); setStep(ShopperStep.FWD_SELECTION); return; }

    if (dateStr === fwd) { alert("You cannot change your First Working Day in this step."); return; }

    if (type === ShiftType.STANDARD) {
      const isAlreadyAA = newShifts.some(s => s.date === dateStr && s.time === shift && s.type === ShiftType.AA);
      if (isAlreadyAA) { alert("This shift is marked as Agreed Availability."); return; }
      
      const dayHasAA = newShifts.some(s => s.date === dateStr && s.type === ShiftType.AA);
      if (dayHasAA) { alert("Day already has an AA shift."); return; }

      const existingShiftIndex = newShifts.findIndex(s => s.date === dateStr && s.type === ShiftType.STANDARD);
      const isClickingSameShift = existingShiftIndex !== -1 && newShifts[existingShiftIndex].time === shift;

      if (isClickingSameShift) {
          newShifts.splice(existingShiftIndex, 1);
      } else {
          const testShifts = newShifts.filter(s => s.date !== dateStr);
          const proposedShift = { date: dateStr, time: shift, type: ShiftType.STANDARD };
          testShifts.push(proposedShift);

          if (isBefore(getSafeDateFromKey(dateStr), getSafeDateFromKey(fwd))) { alert("Cannot select before First Day."); return; }
          if (isRestViolation(dateStr, shift, testShifts)) { alert("Rest Violation (11h rule)."); return; }
          if (isConsecutiveDaysViolation(dateStr, testShifts)) { alert("Max 5 consecutive days."); return; }
          
          // NEW RULE: OPENING Shift Check
          // Pass 'fwd' to ensure validation only considers shifts from start date onwards
          if (isOpeningShiftViolation(dateStr, shift, testShifts, fwd)) {
              alert("You can only select an OPENING shift after you have worked at least 2 shifts.");
              return;
          }

          const rangeCheck = validateShopperRange(testShifts, fwd);
          if (!rangeCheck.valid) { alert(rangeCheck.message); return; }

          if (existingShiftIndex !== -1) newShifts.splice(existingShiftIndex, 1);
          newShifts.push(proposedShift);
      }
    }
    setSelections([{ ...prevData, shifts: newShifts }]);
  };

  const handleDetailsSubmit = () => {
    // Preserve existing details (including nationality) and merge with tempDetails
    const updated = { 
        ...selections[0], 
        details: { 
            ...selections[0].details, 
            ...tempDetails 
        } 
    };
    setSelections([updated]);
    setStep(ShopperStep.DETAILS); // Track internal step
    setShowDetailsModal(false);
    setViewMode('SUMMARY');
  };

  const handleSubmitData = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
        const shopper = selections[0];
        const { data: shopperData, error: shopperError } = await supabase.from('shoppers').insert([{ name: shopper.name, details: shopper.details || {} }]).select().single();
        if (shopperError) throw new Error(shopperError.message);
        
        let finalShifts = shopper.shifts;
        if (shopper.details?.firstWorkingDay) {
            const limitKey = formatDateKey(endOfWeek(addWeeks(getSafeDateFromKey(shopper.details.firstWorkingDay), 1), { weekStartsOn: 1 }));
            finalShifts = finalShifts.filter(s => s.date >= shopper.details!.firstWorkingDay! && s.date <= limitKey);
        }
        if (finalShifts.length > 0) {
            const { error: shiftsError } = await supabase.from('shifts').insert(finalShifts.map(s => ({ shopper_id: shopperData.id, date: s.date, time: s.time, type: s.type })));
            if (shiftsError) throw new Error(shiftsError.message);
        }
        setSyncStatus('success');
        
        // --- CLEAR LOCAL SESSION ON SUCCESS ---
        localStorage.removeItem(STORAGE_KEY);
        
    } catch (error: any) { setSyncStatus('error'); alert(`Failed: ${error.message}`); } finally { setIsSyncing(false); }
  };

  // Helper to safely open details modal with fresh state
  const openDetailsModal = () => {
      // CRITICAL: Refresh tempDetails with the most recent selections before opening
      // This ensures 'nationality' and other fields saved in previous steps are present in the form state
      if (selections[0].details) {
          setTempDetails(selections[0].details);
      }
      setShowDetailsModal(true);
  };

  // Dynamic Date Constraint Calculation
  const computedMinDate = useMemo(() => {
      return calculateMinStartDate(selections[0].details?.nationality);
  }, [selections[0].details?.nationality]);

  // Render Logic
  const data = selections[0];

  if (viewMode === 'SUMMARY') {
      return (
          <ShopperSummary 
              shopper={data} isSyncing={isSyncing} syncStatus={syncStatus}
              setShowDetailsModal={(show) => {
                  if (show) openDetailsModal();
                  else setShowDetailsModal(false);
              }} 
              handleSubmitData={handleSubmitData}
              handleClearSession={onExit} 
              setMode={(m) => { 
                  if (m === AppMode.SHOPPER_FLOW) {
                      setViewMode('FLOW');
                      // Fix for White Screen on Edit: 
                      // If we are currently at DETAILS step (which has no UI in Flow mode),
                      // revert to STANDARD_SELECTION so the user sees the calendar.
                      if (step === ShopperStep.DETAILS) {
                          setStep(ShopperStep.STANDARD_SELECTION);
                      }
                  } 
              }}
              busConfig={busConfig}
          />
      );
  }

  // Helper for Badge
  const getStepBadgeClass = (s: number) => {
      if (step === s) return "bg-gray-900 text-white shadow-md scale-105 cursor-default ring-2 ring-gray-100";
      if (step > s) return "bg-green-100 text-green-700 hover:bg-green-200 hover:scale-105 cursor-pointer active:scale-95";
      return "bg-gray-100 text-gray-400 cursor-default";
  };

  const handleStepClick = (targetStep: number) => {
      if (targetStep < step) setStep(targetStep);
  };

  return (
    <div className="h-[100dvh] bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white px-6 py-4 shadow-sm border-b sticky top-0 z-20 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            {/* Hidden Exit Button on Icon */}
            <button onClick={onExit} className="hover:text-red-500 transition-colors outline-none cursor-default active:scale-95" title="Exit to Setup">
                <User className="w-5 h-5 text-gray-400" />
            </button>
            {shopperName}
          </h2>
          
          {/* STEPPER NAV (Hidden in Step 0) */}
          {step > 0 && (
              <div className="flex items-center gap-2 text-xs font-bold mt-1 animate-in slide-in-from-top-1 fade-in">
                 <button 
                    onClick={() => handleStepClick(1)} 
                    disabled={step <= 1}
                    className={`px-3 py-1 rounded-full transition-all ${getStepBadgeClass(1)}`}
                 >
                    1. AA Shifts
                 </button>
                 <div className="w-4 h-0.5 bg-gray-200"></div>
                 <button 
                    onClick={() => handleStepClick(2)} 
                    disabled={step <= 2}
                    className={`px-3 py-1 rounded-full transition-all ${getStepBadgeClass(2)}`}
                 >
                    2. Start Date
                 </button>
                 <div className="w-4 h-0.5 bg-gray-200"></div>
                 <button 
                    onClick={() => handleStepClick(3)} 
                    disabled={step <= 3}
                    className={`px-3 py-1 rounded-full transition-all ${getStepBadgeClass(3)}`}
                 >
                    3. Standard
                 </button>
              </div>
          )}
          {step === 0 && (
              <div className="flex items-center gap-2 text-xs font-bold mt-1 text-gray-400">
                  Setup Profile
              </div>
          )}
        </div>
        
        {step > 0 && (
            <div className="flex gap-3">
                <div className="hidden md:flex gap-4 text-xs font-medium text-gray-500 items-center border-l pl-4">
                     <span>Selected AA: <strong className="text-red-600">{aaSelections.length}</strong></span>
                     <span>Selected Standard: <strong className="text-green-600">{stdCount}</strong></span>
                </div>
            </div>
        )}
      </div>

      <div ref={flowScrollContainerRef} className="flex-1 overflow-y-auto">
          {/* STEP 0: NATIONALITY SELECTION */}
          {step === ShopperStep.NATIONALITY_SELECTION && (
              <div className="p-4 md:p-8 animate-in slide-in-from-right duration-300">
                  <div className="max-w-2xl mx-auto space-y-8">
                      <div className="text-center space-y-2">
                          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Globe2 className="w-8 h-8 text-blue-600" />
                          </div>
                          <h2 className="text-2xl font-black text-gray-900">Where are you from?</h2>
                          <p className="text-gray-500">Please select your nationality to proceed.</p>
                      </div>

                      {/* QUICK PICK GRID */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {TOP_NATIONALITIES.map((nation) => (
                              <button
                                  key={nation.code}
                                  onClick={() => handleNationalitySubmit(nation.name)}
                                  className="flex flex-col items-center justify-center p-6 bg-white border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50 hover:shadow-lg rounded-2xl transition-all group"
                              >
                                  <span className="text-4xl mb-2 filter drop-shadow-sm group-hover:scale-110 transition-transform duration-200">{nation.flag}</span>
                                  <span className="font-bold text-gray-700 group-hover:text-blue-700">{nation.name}</span>
                              </button>
                          ))}
                      </div>

                      {/* DIVIDER */}
                      <div className="relative">
                          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                          <div className="relative flex justify-center"><span className="bg-gray-50 px-2 text-xs text-gray-400 font-bold uppercase">Or select other</span></div>
                      </div>

                      {/* DROPDOWN */}
                      <div className="bg-white p-4 rounded-xl border shadow-sm">
                           <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">All Countries</label>
                           <select 
                              onChange={(e) => {
                                  if (e.target.value) handleNationalitySubmit(e.target.value);
                              }}
                              className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-xl font-bold text-gray-700 outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none cursor-pointer"
                              defaultValue=""
                           >
                               <option value="" disabled>Tap to select country...</option>
                               {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                           </select>
                      </div>
                  </div>
              </div>
          )}

          {step === ShopperStep.AA_SELECTION && (
              <ShopperAAWizard 
                  savedCloudTemplate={savedCloudTemplate} 
                  aaSelections={aaSelections} 
                  setAaSelections={setAaSelections} 
                  handleAAWizardSubmit={handleAAWizardSubmit} 
              />
          )}
          {step === ShopperStep.FWD_SELECTION && (
              <div className="p-4 md:p-6 animate-in slide-in-from-right duration-300">
                  <div className="max-w-5xl mx-auto mb-6">
                     <div className="p-4 rounded-xl border flex gap-4 bg-yellow-50 border-yellow-100">
                        <div className="p-2 rounded-lg h-fit bg-white text-yellow-600"><PlayCircle className="w-5 h-5" /></div>
                        <div>
                           <h3 className="font-bold text-yellow-800">When is your First Day?</h3>
                           <p className="text-sm mt-1 text-yellow-700">Please select the exact day you will start working. <strong>Must be a Morning or Afternoon shift.</strong></p>
                        </div>
                     </div>
                  </div>
                  <CalendarView 
                      mode="SHOPPER" 
                      step={1} 
                      isFWDSelection={true} 
                      adminAvailability={adminAvailability} 
                      currentShopperShifts={data.shifts} 
                      firstWorkingDay={data.details?.firstWorkingDay} 
                      onShopperToggle={handleFWDSelection} 
                      fwdCounts={fwdCounts}
                      minDate={computedMinDate} // Pass calculated min date
                  />
              </div>
          )}
          {(step === ShopperStep.STANDARD_SELECTION || step === ShopperStep.DETAILS) && (
              <div className="p-4 md:p-6 animate-in slide-in-from-right duration-300">
                  <div className="max-w-5xl mx-auto mb-6">
                     <div className="p-4 rounded-xl border flex gap-4 bg-green-50 border-green-100 flex-col md:flex-row items-start md:items-center justify-between">
                        <div className="flex gap-4">
                            <div className="p-2 rounded-lg h-fit bg-white text-green-600"><CheckCircle className="w-5 h-5" /></div>
                            <div>
                               <h3 className="font-bold text-green-800">Select Standard Shifts</h3>
                               <p className="text-sm mt-1 text-green-600">Select shifts for your first 2 weeks based on your start date.</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-start md:items-end gap-1 mt-2 md:mt-0 shrink-0">
                             <button onClick={() => setStep(ShopperStep.FWD_SELECTION)} className="text-xs font-bold text-green-700 underline hover:text-green-900">Change Start Date</button>
                             <button onClick={() => setStep(ShopperStep.AA_SELECTION)} className="text-xs font-bold text-red-600 underline hover:text-red-800">Modify AA Pattern</button>
                        </div>
                     </div>
                  </div>
                  <CalendarView 
                      mode="SHOPPER" 
                      step={2} 
                      adminAvailability={adminAvailability} 
                      currentShopperShifts={data.shifts} 
                      firstWorkingDay={data.details?.firstWorkingDay} 
                      onShopperToggle={handleStandardShiftToggle}
                      minDate={computedMinDate} // Pass calculated min date
                  />
              </div>
          )}
      </div>

      {(step === ShopperStep.STANDARD_SELECTION || step === ShopperStep.DETAILS) && (
            <div className="bg-white px-4 py-3 border-t sticky bottom-0 z-20 shadow-[0_-5px_15px_rgba(0,0,0,0.06)]">
               <div className="max-w-5xl mx-auto space-y-3">
                  {/* Dynamic Shift Counter UI */}
                  <div className="flex items-center justify-between px-2">
                       <div className="flex items-center gap-2 text-gray-400">
                           <Layers className="w-4 h-4" />
                           <span className="text-[10px] font-bold uppercase tracking-widest">Total Selection</span>
                       </div>
                       
                       <div className={`flex items-center gap-3 transition-all duration-300 ${countAnim ? 'scale-110' : 'scale-100'}`}>
                           <div className={`text-3xl font-black leading-none transition-colors duration-300 ${countAnim ? 'text-green-500' : 'text-gray-900'}`}>
                               {totalShiftCount}
                           </div>
                           <div className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md transition-colors duration-300 ${countAnim ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                               Total Shifts
                           </div>
                       </div>
                  </div>

                  <div className="flex justify-between items-center gap-3">
                      <Button variant="secondary" onClick={() => setStep(ShopperStep.FWD_SELECTION)} className="px-6 border-gray-200">
                          Back
                      </Button>
                      <Button onClick={openDetailsModal} className="flex-1 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all bg-gray-900 hover:bg-black text-white py-3.5 rounded-xl flex items-center justify-center gap-2">
                          <CalendarCheck className="w-5 h-5" /> Review & Finish <ArrowRight className="w-4 h-4" />
                      </Button>
                  </div>
               </div>
            </div>
      )}

      {/* Modals */}
      <MobileInstructionModal 
          isOpen={showMobileInstructions} 
          onClose={() => setShowMobileInstructions(false)} 
          step={step === 1 ? 'AA' : step === 2 ? 'FWD' : 'STANDARD'} 
          title={step === 1 ? 'Set your 2 Fixed Days (AA)' : step === 2 ? 'When do you start?' : 'Select Your Shifts'} 
          message={step === 1 
              ? <div className="space-y-4 text-left">
                  <div>
                      <p className="font-bold text-gray-900">What are AA Shifts?</p>
                      <p className="text-gray-600 text-sm mt-1 leading-relaxed">"AA" stands for <strong>Agreed Availability</strong>. These are the 2 specific days <u>every week</u> where you guarantee you can work.</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                      <p className="text-xs font-bold text-red-800 uppercase tracking-wider mb-3">Allowed Combinations:</p>
                      <ul className="space-y-3 text-sm text-gray-800">
                          <li className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-white border border-red-200 text-red-600 flex items-center justify-center font-bold text-xs shadow-sm shrink-0">A</div>
                              <span><strong>1 Weekday</strong> (Mon-Fri) <br/>+ <strong>1 Weekend</strong> (Sat/Sun)</span>
                          </li>
                          <li className="flex items-center gap-3">
                               <div className="w-6 h-6 rounded-full bg-white border border-red-200 text-red-600 flex items-center justify-center font-bold text-xs shadow-sm shrink-0">B</div>
                              <span><strong>Both Weekend Days</strong> (Sat + Sun)</span>
                          </li>
                      </ul>
                      <p className="text-xs text-red-500 mt-3 font-medium border-t border-red-100 pt-2">
                          ❌ You cannot choose 2 Weekdays.
                      </p>
                  </div>
              </div>
              : step === 2 ? "Please select the exact day you will have your first shift. It must be a Morning or Afternoon shift." 
              : <div className="space-y-4 text-left">
                  <div>
                      <p className="font-bold text-gray-900 text-lg">Fill in the gaps!</p>
                      <p className="text-sm text-gray-600 mt-1 leading-relaxed">Your <strong>First Working Day</strong> and your <strong>AA Shifts</strong> (Fixed Days) are already set and locked.</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-sm text-green-800 leading-relaxed shadow-sm">
                      <strong className="block mb-1 text-green-900 uppercase text-xs tracking-wider">Goal:</strong> 
                      Please select your remaining <strong>Standard Shifts</strong> to complete your schedule for the <strong>first 2 weeks</strong> of work.
                  </div>
                </div>
          } 
      />

      <FWDConfirmationModal 
          isOpen={showFWDConfirmModal}
          onClose={() => !isCheckingFWD && setShowFWDConfirmModal(false)}
          onConfirm={confirmFWDSelection}
          date={pendingFWD?.date || null}
          shift={pendingFWD?.shift || null}
          isChecking={isCheckingFWD}
      />

      <ShopperDetailsModal 
          showDetailsModal={showDetailsModal} setShowDetailsModal={setShowDetailsModal}
          tempDetails={tempDetails} setTempDetails={setTempDetails}
          handleDetailsSubmit={handleDetailsSubmit}
      />
    </div>
  );
};
