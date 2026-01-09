import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppMode, ShiftTime, ShiftType, ShopperData, ShopperShift, AdminAvailabilityMap, ShopperDetails, WeeklyTemplate, ShopperStep, AdminWizardStep } from './types';
import { SHIFT_TIMES, formatDateKey, getShopperAllowedRange, getShopperMinDate } from './constants';
import { Button } from './components/Button';
import { CalendarView } from './components/CalendarView';
import { MobileInstructionModal } from './components/MobileInstructionModal';
import { Shield, ArrowRight, CheckCircle, User, PlayCircle, ChevronRight, Share2, RefreshCw, Save, KeyRound } from 'lucide-react';
import { addDays, getDay, addWeeks, endOfWeek, isBefore } from 'date-fns';
import nextMonday from 'date-fns/nextMonday';
import { supabase } from './supabaseClient';
import { AdminDataView } from './components/AdminDataView';

// Imported Components
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminWizardDays, AdminWizardApply } from './components/AdminWizard';
import { ShopperSetup } from './components/ShopperSetup';
import { ShopperAAWizard } from './components/ShopperAAWizard';
import { ShopperSummary } from './components/ShopperSummary';
import { ShopperDetailsModal } from './components/ShopperDetailsModal';
import { getSafeDateFromKey, isRestViolation, isConsecutiveDaysViolation, validateShopperRange } from './utils/validation';

const STORAGE_KEYS = {
  TEMPLATE: 'picnic_admin_template',
};

export default function App() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [shopperPinConfig, setShopperPinConfig] = useState<string | null>(null);
  const [isShopperAuthEnabled, setIsShopperAuthEnabled] = useState(true);
  const [enteredShopperPin, setEnteredShopperPin] = useState('');
  const [isShopperVerified, setIsShopperVerified] = useState(false);
  const [showShopperAuth, setShowShopperAuth] = useState(false);
  const [adminShopperPinInput, setAdminShopperPinInput] = useState('');

  // App State
  const [mode, setMode] = useState<AppMode>(AppMode.SHOPPER_SETUP);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSelfService, setIsSelfService] = useState(false);
  
  // Admin State
  const [adminWizardStep, setAdminWizardStep] = useState<AdminWizardStep>(AdminWizardStep.DASHBOARD);
  const [wizardDayIndex, setWizardDayIndex] = useState<number>(1);
  const [tempTemplate, setTempTemplate] = useState<WeeklyTemplate>({});
  const [savedCloudTemplate, setSavedCloudTemplate] = useState<WeeklyTemplate | null>(null);
  const [applyWeeks, setApplyWeeks] = useState<number>(4);
  const [adminAvailability, setAdminAvailability] = useState<AdminAvailabilityMap>({});

  // Shopper State
  const [shopperStep, setShopperStep] = useState<ShopperStep>(ShopperStep.AA_SELECTION);
  const [showMobileInstructions, setShowMobileInstructions] = useState(false);
  const flowScrollContainerRef = useRef<HTMLDivElement>(null);
  const [shopperNames, setShopperNames] = useState<string[]>([]);
  const [currentShopperIndex, setCurrentShopperIndex] = useState(0);
  const [selections, setSelections] = useState<ShopperData[]>([]);
  const [tempNameInput, setTempNameInput] = useState('');
  
  // Limit State
  const [fwdCounts, setFwdCounts] = useState<Record<string, number>>({});
  
  const [aaSelection, setAaSelection] = useState<{
    weekday: { dayIndex: number | null, time: ShiftTime | null },
    weekend: { dayIndex: number | null, time: ShiftTime | null }
  }>({
    weekday: { dayIndex: null, time: null },
    weekend: { dayIndex: null, time: null }
  });

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [tempDetails, setTempDetails] = useState<ShopperDetails>({
    usePicnicBus: null, // Initialize as null to force selection
    civilStatus: 'Single',
    clothingSize: 'M',
    shoeSize: '40',
    gloveSize: '8 (M)',
    isRandstad: false,
    address: ''
  });
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // --- CONFIG LOADING ---
  const saveConfigToSupabase = async (config: AdminAvailabilityMap) => {
      try { await supabase.from('app_settings').upsert({ id: 'admin_availability', value: config }); } catch (e) { console.error(e); }
  };

  const saveTemplateToSupabase = async (template: WeeklyTemplate) => {
      try {
          const { error } = await supabase.from('app_settings').upsert({ id: 'weekly_template', value: template });
          if (!error) setSavedCloudTemplate(template);
      } catch (e) { console.error(e); }
  };

  const saveShopperAuthSettings = async (pin: string, enabled: boolean, silent: boolean = false) => {
    try {
        const { error } = await supabase.from('app_settings').upsert({ id: 'shopper_auth', value: { pin, enabled } });
        if (error) {
           if (!silent) alert("Error saving Auth Settings");
        } else {
            setShopperPinConfig(pin);
            setIsShopperAuthEnabled(enabled);
            if (!silent) alert("Security settings updated successfully!");
        }
    } catch (e) { console.error(e); }
  };

  const fetchFWDCounts = async () => {
      // 1. Fetch all shoppers who have a firstWorkingDay set
      const { data: shoppers, error: sErr } = await supabase
          .from('shoppers')
          .select('id, details');
      
      if (sErr || !shoppers) return;

      const firstDayMap: Record<string, string> = {}; // shopperId -> firstWorkingDayDate
      const relevantShopperIds: string[] = [];

      shoppers.forEach((s: any) => {
          if (s.details && s.details.firstWorkingDay) {
              firstDayMap[s.id] = s.details.firstWorkingDay;
              relevantShopperIds.push(s.id);
          }
      });

      if (relevantShopperIds.length === 0) {
          setFwdCounts({});
          return;
      }

      // 2. Fetch shifts for these shoppers
      const { data: shifts, error: shErr } = await supabase
          .from('shifts')
          .select('shopper_id, date, time')
          .in('shopper_id', relevantShopperIds);

      if (shErr || !shifts) return;

      const counts: Record<string, number> = {};

      // 3. Count how many people have a shift on their First Working Day
      shifts.forEach((shift) => {
          const shoppersFWD = firstDayMap[shift.shopper_id];
          // Check if this shift matches the shopper's FWD date
          if (shoppersFWD && shift.date === shoppersFWD) {
              const key = `${shift.date}_${shift.time}`;
              counts[key] = (counts[key] || 0) + 1;
          }
      });

      setFwdCounts(counts);
  };

  const loadRemoteConfig = useCallback(async () => {
    try {
        const { data: availData } = await supabase.from('app_settings').select('value').eq('id', 'admin_availability').single();
        if (availData?.value) {
            let parsed = availData.value;
            if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch (e) {} }
            setAdminAvailability(parsed);
        }

        const { data: templateData } = await supabase.from('app_settings').select('value').eq('id', 'weekly_template').single();
        if (templateData?.value) {
            let parsed = templateData.value;
            if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch(e) {} }
            setSavedCloudTemplate(parsed);
            setTempTemplate(parsed);
        } else {
            try {
              const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.TEMPLATE) || '{}');
              if (Object.keys(local).length > 0) setTempTemplate(local);
            } catch (e) { console.error(e); }
        }

        const { data: pinData } = await supabase.from('app_settings').select('value').eq('id', 'shopper_auth').single();
        if (pinData?.value) {
            if (pinData.value.pin) {
                setShopperPinConfig(pinData.value.pin);
                setAdminShopperPinInput(pinData.value.pin);
            }
            setIsShopperAuthEnabled(pinData.value.enabled !== false);
        }
    } catch (err) { console.error("Config load error:", err); }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get('mode');
    if (urlMode === 'shopper') { setIsSelfService(true); setMode(AppMode.SHOPPER_SETUP); } 
    else if (urlMode === 'admin') { setMode(AppMode.ADMIN); }
    if (urlMode) window.history.replaceState({}, '', window.location.pathname);
    loadRemoteConfig();
    setIsInitialized(true);
  }, [loadRemoteConfig]);

  useEffect(() => { 
      if (mode === AppMode.SHOPPER_SETUP) loadRemoteConfig(); 
      // Refresh FWD counts when entering flow to get latest availability
      if (mode === AppMode.SHOPPER_FLOW) fetchFWDCounts();
  }, [mode, loadRemoteConfig]);

  useEffect(() => { if (isInitialized) localStorage.setItem(STORAGE_KEYS.TEMPLATE, JSON.stringify(tempTemplate)); }, [tempTemplate, isInitialized]);

  useEffect(() => {
      if (mode === AppMode.SHOPPER_FLOW) {
          setTimeout(() => { if (flowScrollContainerRef.current) flowScrollContainerRef.current.scrollTop = 0; window.scrollTo(0, 0); }, 50);
          setShowMobileInstructions(shopperStep === ShopperStep.FWD_SELECTION || shopperStep === ShopperStep.STANDARD_SELECTION);
      }
  }, [shopperStep, mode]);

  // --- ACTIONS ---
  const generateRandomPin = () => setAdminShopperPinInput(Math.floor(100000 + Math.random() * 900000).toString());

  const startShopperSession = () => {
      setSelections([{ name: tempNameInput.trim(), shifts: [], details: { ...tempDetails, firstWorkingDay: undefined } }]);
      setShopperNames([tempNameInput.trim()]);
      setMode(AppMode.SHOPPER_FLOW);
      setShopperStep(ShopperStep.AA_SELECTION);
      setShowShopperAuth(false);
  };

  const handleVerifyShopperPin = () => {
      if (enteredShopperPin === shopperPinConfig) { setIsShopperVerified(true); startShopperSession(); } 
      else { alert("Incorrect PIN"); setEnteredShopperPin(''); }
  };

  const handleStartShopperClick = () => {
      if (!tempNameInput.trim()) return;
      if (shopperPinConfig && isShopperAuthEnabled && !isShopperVerified) setShowShopperAuth(true);
      else startShopperSession();
  };

  const handleSubmitData = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
        for (const shopper of selections) {
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
        }
        setSyncStatus('success');
    } catch (error: any) { setSyncStatus('error'); alert(`Failed: ${error.message}`); } finally { setIsSyncing(false); }
  };

  const handleClearSession = () => {
    setShopperNames([]); setSelections([]); setCurrentShopperIndex(0); setShopperStep(ShopperStep.AA_SELECTION);
    setAaSelection({ weekday: { dayIndex: null, time: null }, weekend: { dayIndex: null, time: null } });
    setIsShopperVerified(false); setShowShopperAuth(false); setSyncStatus('idle'); setTempNameInput(''); setMode(AppMode.SHOPPER_SETUP);
    // Reset temp details to ensure next user MUST select transport
    setTempDetails({
        usePicnicBus: null, 
        civilStatus: 'Single',
        clothingSize: 'M',
        shoeSize: '40',
        gloveSize: '8 (M)',
        isRandstad: false,
        address: ''
    });
  };

  const toggleWizardTemplate = (shift: ShiftTime, type: ShiftType) => {
      setTempTemplate(prev => {
          const currentTypes = prev[wizardDayIndex]?.[shift] || [];
          const newTypes = currentTypes.includes(type) ? currentTypes.filter(t => t !== type) : [...currentTypes, type];
          return { ...prev, [wizardDayIndex]: { ...prev[wizardDayIndex], [shift]: newTypes } };
      });
  };

  const resetWizardTemplate = () => {
    if (window.prompt("Enter Admin PIN to confirm reset:") === '7709') {
        const initial: WeeklyTemplate = {};
        [1,2,3,4,5,6,0].forEach(d => { initial[d] = { [ShiftTime.OPENING]: [], [ShiftTime.MORNING]: [], [ShiftTime.NOON]: [], [ShiftTime.AFTERNOON]: [] }; });
        setTempTemplate(initial); saveTemplateToSupabase(initial);
    }
  };

  const copyPreviousDay = () => {
      if (wizardDayIndex === 1) return;
      const prevConfig = tempTemplate[wizardDayIndex === 0 ? 6 : wizardDayIndex - 1];
      if (prevConfig) setTempTemplate(prev => ({ ...prev, [wizardDayIndex]: JSON.parse(JSON.stringify(prevConfig)) as Record<ShiftTime, ShiftType[]> }));
  };

  const applyTemplate = () => {
      const startDate = nextMonday(new Date());
      const newAvailability = { ...adminAvailability };
      for (let i = 0; i < applyWeeks * 7; i++) {
         const date = addDays(startDate, i);
         const template = tempTemplate[getDay(date)];
         if (template) newAvailability[formatDateKey(date)] = template;
      }
      setAdminAvailability(newAvailability); saveConfigToSupabase(newAvailability); saveTemplateToSupabase(tempTemplate);
      setAdminWizardStep(AdminWizardStep.DASHBOARD);
  };

  const handleCopyMagicLink = () => navigator.clipboard.writeText(`${window.location.origin}/?mode=shopper`).then(() => alert("Link Copied!"));
  
  const handleLogin = (pwd: string) => { if (pwd === '7709') { setIsAuthenticated(true); setAuthError(false); } else setAuthError(true); };

  // --- SHOPPER LOGIC ---
  const handleFWDSelection = (dateStr: string, shift: ShiftTime) => {
      if (shift === ShiftTime.OPENING || shift === ShiftTime.NOON) { alert("Invalid First Day Shift."); return; }
      
      const newSelections = [...selections];
      const existing = newSelections[currentShopperIndex];
      const previousFWD = existing.details?.firstWorkingDay;

      // Check if this slot was previously marked as AA (from Step 0)
      const wasAA = existing.shifts.some(s => s.date === dateStr && s.time === shift && s.type === ShiftType.AA);
      
      // Remove any existing shifts on this day (clean start for FWD on this day)
      // AND remove any Standard shifts that are BEFORE this new FWD (since they would be invalid)
      // AND remove the PREVIOUS FWD shift if it was Standard (to ensure single selection)
      const newShifts = existing.shifts.filter(s => {
          if (s.date === dateStr) return false; // Remove current day shifts to replace with new FWD
          if (previousFWD && s.date === previousFWD && s.type === ShiftType.STANDARD) return false; // Remove previous FWD if standard
          if (s.type === ShiftType.STANDARD && s.date < dateStr) return false; // Remove older standard shifts
          return true;
      });
      
      // Add FWD shift. If it matched an AA shift, keep it as AA so it shows Red in summary.
      newShifts.push({ 
          date: dateStr, 
          time: shift, 
          type: wasAA ? ShiftType.AA : ShiftType.STANDARD 
      });
      
      newSelections[currentShopperIndex] = { ...existing, shifts: newShifts, details: { ...existing.details, firstWorkingDay: dateStr } as ShopperDetails };
      setSelections(newSelections);
      setShopperStep(ShopperStep.STANDARD_SELECTION);
  };

  const handleStandardShiftToggle = (dateStr: string, shift: ShiftTime, type: ShiftType) => {
    const prevData = selections[currentShopperIndex];
    let newShifts = [...prevData.shifts];
    const fwd = prevData.details?.firstWorkingDay;
    if (!fwd) { alert("First Working Day not set."); setShopperStep(ShopperStep.FWD_SELECTION); return; }

    // 1. Block FWD Modification in this step
    if (dateStr === fwd) {
        alert("You cannot change your First Working Day in this step. Go back if you need to change it.");
        return;
    }

    if (type === ShiftType.STANDARD) {
      // 2. Block AA Modification
      const isAlreadyAA = newShifts.some(s => s.date === dateStr && s.time === shift && s.type === ShiftType.AA);
      if (isAlreadyAA) {
          alert("This shift is marked as Always Available and cannot be changed here.");
          return;
      }
      
      // 3. Block adding Standard shift if day already has an AA shift
      const dayHasAA = newShifts.some(s => s.date === dateStr && s.type === ShiftType.AA);
      if (dayHasAA) {
           alert("You cannot add a Standard shift on a day that already has an AA shift.");
           return;
      }

      const existingShiftIndex = newShifts.findIndex(s => s.date === dateStr && s.type === ShiftType.STANDARD);
      const isClickingSameShift = existingShiftIndex !== -1 && newShifts[existingShiftIndex].time === shift;

      if (isClickingSameShift) {
          // Deselecting the exact same shift
          newShifts.splice(existingShiftIndex, 1);
      } else {
          // Selecting a new shift (or switching)
          
          // Construct a temporary array to test validation with the NEW configuration
          // First, remove any existing standard shift on this day (Single Shift Policy)
          const testShifts = newShifts.filter(s => s.date !== dateStr);
          
          // Add the new proposed shift
          const proposedShift = { date: dateStr, time: shift, type: ShiftType.STANDARD };
          testShifts.push(proposedShift);

          // Run validations on the PROPOSED state
          if (isBefore(getSafeDateFromKey(dateStr), getSafeDateFromKey(fwd))) { alert("Cannot select before First Day."); return; }
          if (isRestViolation(dateStr, shift, testShifts)) { alert("Rest Violation (11h rule)."); return; }
          if (isConsecutiveDaysViolation(dateStr, testShifts)) { alert("Max 5 consecutive days."); return; }
          const rangeCheck = validateShopperRange(testShifts, fwd);
          if (!rangeCheck.valid) { alert(rangeCheck.message); return; }

          // If valid, apply changes to actual state
          if (existingShiftIndex !== -1) {
              newShifts.splice(existingShiftIndex, 1); // Remove old shift
          }
          newShifts.push(proposedShift); // Add new shift
      }
    }
    const newSelections = [...selections];
    newSelections[currentShopperIndex] = { ...prevData, shifts: newShifts };
    setSelections(newSelections);
  };

  const handleAAWizardSubmit = () => {
      const { weekday, weekend } = aaSelection;
      if (weekday.dayIndex === null || !weekday.time || weekend.dayIndex === null || !weekend.time) { alert("Missing Selection!"); return; }

      const range = getShopperAllowedRange();
      const newShifts: ShopperShift[] = [];
      let currentDate = range.start;
      const minDate = getShopperMinDate();
      
      while (currentDate <= range.end) {
          if (isBefore(currentDate, minDate)) { currentDate = addDays(currentDate, 1); continue; }
          const dayIndex = getDay(currentDate);
          const dateStr = formatDateKey(currentDate);
          const checkAvailability = (t: ShiftTime) => {
              const config = adminAvailability[dateStr];
              return (!config || !config[t] || config[t]?.includes(ShiftType.AA));
          };
          if (dayIndex === weekday.dayIndex && weekday.time && checkAvailability(weekday.time)) newShifts.push({ date: dateStr, time: weekday.time, type: ShiftType.AA });
          if (dayIndex === weekend.dayIndex && weekend.time && checkAvailability(weekend.time)) newShifts.push({ date: dateStr, time: weekend.time, type: ShiftType.AA });
          currentDate = addDays(currentDate, 1);
      }

      if (!newShifts.some(s => { const d = getDay(getSafeDateFromKey(s.date)); return d >= 1 && d <= 5; })) { alert("No valid Weekday dates found."); return; }
      if (!newShifts.some(s => { const d = getDay(getSafeDateFromKey(s.date)); return d === 0 || d === 6; })) { alert("No valid Weekend dates found."); return; }

      const existingDetails = selections[currentShopperIndex]?.details || { 
          usePicnicBus: null, // Ensure fresh start for new sessions if data missing
          civilStatus: 'Single', 
          clothingSize: 'M', 
          shoeSize: '40', 
          gloveSize: '8 (M)', 
          isRandstad: false, 
          address: '' 
      };
      const newShopperData = { name: shopperNames[currentShopperIndex], shifts: newShifts, details: existingDetails };
      
      const newSelections = [...selections];
      newSelections[currentShopperIndex] = newShopperData;
      setSelections(newSelections);
      setShopperStep(ShopperStep.FWD_SELECTION);
  };

  const handleDetailsSubmit = () => {
    const updated = { ...selections[currentShopperIndex], details: { ...selections[currentShopperIndex].details, ...tempDetails } };
    const newSelections = [...selections];
    newSelections[currentShopperIndex] = updated;
    setSelections(newSelections);
    setShowDetailsModal(false);
    setMode(AppMode.SUMMARY);
  };

  // --- RENDERS ---
  const renderShopperFlow = () => {
    const currentName = shopperNames[currentShopperIndex];
    const data = selections[currentShopperIndex];
    const aaCount = data?.shifts.filter(s => s.type === ShiftType.AA).length || 0;
    const stdCount = data?.shifts.filter(s => s.type === ShiftType.STANDARD).length || 0;

    return (
      <div className="h-[100dvh] bg-gray-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white px-6 py-4 shadow-sm border-b sticky top-0 z-20 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><User className="w-5 h-5 text-gray-400" /> {currentName}</h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
               <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${shopperStep === 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>1. AA Shifts</span>
               <ChevronRight className="w-3 h-3" />
               <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${shopperStep === 1 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100'}`}>2. Start Date</span>
               <ChevronRight className="w-3 h-3" />
               <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${shopperStep === 2 ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>3. Standard</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex gap-4 text-xs font-medium text-gray-500">
                <span>Selected AA: <strong className="text-red-600">{aaCount}</strong></span>
                <span>Selected Standard: <strong className="text-green-600">{stdCount}</strong></span>
             </div>
             {shopperStep === 2 && <Button variant="outline" onClick={() => setShowDetailsModal(true)} className="text-sm">Details</Button>}
          </div>
        </div>

        <div ref={flowScrollContainerRef} className="flex-1 overflow-y-auto">
          {shopperStep === ShopperStep.AA_SELECTION && (
              <ShopperAAWizard 
                  savedCloudTemplate={savedCloudTemplate} 
                  aaSelection={aaSelection} 
                  setAaSelection={setAaSelection} 
                  handleAAWizardSubmit={handleAAWizardSubmit} 
              />
          )}
          
          {shopperStep === ShopperStep.FWD_SELECTION && (
              <div className="p-4 md:p-6">
                  <div className="max-w-5xl mx-auto mb-6">
                     <div className="p-4 rounded-xl border flex gap-4 bg-yellow-50 border-yellow-100">
                        <div className="p-2 rounded-lg h-fit bg-white text-yellow-600"><PlayCircle className="w-5 h-5" /></div>
                        <div>
                           <h3 className="font-bold text-yellow-800">When is your First Day?</h3>
                           <p className="text-sm mt-1 text-yellow-700">Please select the exact day you will start working. <strong>Must be a Morning or Afternoon shift.</strong></p>
                        </div>
                     </div>
                  </div>
                  <CalendarView mode="SHOPPER" step={1} isFWDSelection={true} adminAvailability={adminAvailability} currentShopperShifts={data?.shifts} firstWorkingDay={data?.details?.firstWorkingDay} onShopperToggle={handleFWDSelection} fwdCounts={fwdCounts} />
              </div>
          )}

          {shopperStep === ShopperStep.STANDARD_SELECTION && (
              <div className="p-4 md:p-6">
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
                             <button onClick={() => setShopperStep(ShopperStep.FWD_SELECTION)} className="text-xs font-bold text-green-700 underline hover:text-green-900">Change Start Date</button>
                             <button onClick={() => setShopperStep(ShopperStep.AA_SELECTION)} className="text-xs font-bold text-red-600 underline hover:text-red-800">Modify AA Pattern</button>
                        </div>
                     </div>
                  </div>
                  <CalendarView mode="SHOPPER" step={2} adminAvailability={adminAvailability} currentShopperShifts={data?.shifts} firstWorkingDay={data?.details?.firstWorkingDay} onShopperToggle={handleStandardShiftToggle} />
              </div>
          )}
        </div>

        {shopperStep === ShopperStep.STANDARD_SELECTION && (
            <div className="bg-white p-4 border-t sticky bottom-0 z-20 pb-8 md:pb-4">
               <div className="max-w-5xl mx-auto flex justify-between items-center">
                  <Button variant="secondary" onClick={() => setShopperStep(ShopperStep.FWD_SELECTION)}>Back</Button>
                  <Button onClick={() => setShowDetailsModal(true)} className="px-8">Review & Finish <ArrowRight className="w-4 h-4 ml-2" /></Button>
               </div>
            </div>
        )}

        <MobileInstructionModal isOpen={showMobileInstructions} onClose={() => setShowMobileInstructions(false)} step={shopperStep === ShopperStep.FWD_SELECTION ? 'FWD' : 'STANDARD'} title={shopperStep === ShopperStep.FWD_SELECTION ? 'When do you start?' : 'Select Your Shifts'} message={shopperStep === ShopperStep.FWD_SELECTION ? "Please select the exact day you will have your first shift. It must be a Morning or Afternoon shift." : (<span>Please select your standard shifts for the <strong>first 2 working weeks</strong> starting from your selected First Day.</span>)} />
      </div>
    );
  };

  // --- MAIN RENDER ---
  return (
    <div className="font-sans text-gray-900 selection:bg-purple-100 selection:text-purple-900">
        {mode === AppMode.SHOPPER_SETUP && (
            <ShopperSetup 
                showShopperAuth={showShopperAuth} setShowShopperAuth={setShowShopperAuth}
                enteredShopperPin={enteredShopperPin} setEnteredShopperPin={setEnteredShopperPin}
                handleVerifyShopperPin={handleVerifyShopperPin} tempNameInput={tempNameInput}
                setTempNameInput={setTempNameInput} handleStartShopperClick={handleStartShopperClick}
                setMode={setMode}
            />
        )}
        
        {mode === AppMode.SHOPPER_FLOW && renderShopperFlow()}
        
        {mode === AppMode.SUMMARY && (
            <ShopperSummary 
                shopper={selections[currentShopperIndex]} isSyncing={isSyncing} syncStatus={syncStatus}
                setShowDetailsModal={setShowDetailsModal} handleSubmitData={handleSubmitData}
                handleClearSession={handleClearSession} setMode={setMode}
            />
        )}
        
        {mode === AppMode.ADMIN && !isAuthenticated && <AdminLogin onLogin={handleLogin} onCancel={() => setMode(AppMode.SHOPPER_SETUP)} authError={authError} />}
        
        {mode === AppMode.ADMIN && isAuthenticated && (
            <div className="min-h-screen bg-gray-100 pb-20 flex flex-col">
              <div className="bg-white border-b sticky top-0 z-20 px-6 py-4 shadow-sm flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 rounded-lg text-orange-600"><Shield className="w-6 h-6" /></div>
                      <div>
                          <h2 className="text-lg font-bold text-gray-800 leading-none">Admin Panel</h2>
                          <span className="text-xs text-gray-400 font-medium">{adminWizardStep === AdminWizardStep.VIEW_SUBMISSIONS ? 'Data Viewer' : 'Wizard Mode'}</span>
                      </div>
                  </div>
                  <div className="flex gap-2">
                      {adminWizardStep !== AdminWizardStep.DASHBOARD && <Button variant="secondary" onClick={() => setAdminWizardStep(AdminWizardStep.DASHBOARD)} className="text-sm">Back</Button>}
                      <Button onClick={() => setMode(AppMode.SHOPPER_SETUP)} className="bg-gray-800 text-white hover:bg-gray-900 text-sm">Log Out</Button>
                  </div>
              </div>
              <div className="flex-1 p-6 overflow-y-auto">
                  {adminWizardStep === AdminWizardStep.DASHBOARD && (
                      <AdminDashboard 
                          isShopperAuthEnabled={isShopperAuthEnabled} setIsShopperAuthEnabled={setIsShopperAuthEnabled}
                          adminShopperPinInput={adminShopperPinInput} setAdminShopperPinInput={setAdminShopperPinInput}
                          generateRandomPin={generateRandomPin} saveShopperAuthSettings={saveShopperAuthSettings}
                          handleCopyMagicLink={handleCopyMagicLink} setAdminWizardStep={setAdminWizardStep}
                          setWizardDayIndex={setWizardDayIndex} savedCloudTemplate={savedCloudTemplate}
                          setTempTemplate={setTempTemplate} tempTemplate={tempTemplate}
                      />
                  )}
                  {adminWizardStep === AdminWizardStep.WIZARD_DAYS && (
                      <AdminWizardDays 
                          wizardDayIndex={wizardDayIndex} setWizardDayIndex={setWizardDayIndex}
                          setAdminWizardStep={setAdminWizardStep} tempTemplate={tempTemplate}
                          toggleWizardTemplate={toggleWizardTemplate} resetWizardTemplate={resetWizardTemplate}
                          copyPreviousDay={copyPreviousDay}
                      />
                  )}
                  {adminWizardStep === AdminWizardStep.WIZARD_APPLY && (
                      <AdminWizardApply 
                          applyWeeks={applyWeeks} setApplyWeeks={setApplyWeeks}
                          setAdminWizardStep={setAdminWizardStep} applyTemplate={applyTemplate}
                      />
                  )}
                  {adminWizardStep === AdminWizardStep.VIEW_SUBMISSIONS && <AdminDataView />}
              </div>
            </div>
        )}

        <ShopperDetailsModal 
            showDetailsModal={showDetailsModal} setShowDetailsModal={setShowDetailsModal}
            tempDetails={tempDetails} setTempDetails={setTempDetails}
            handleDetailsSubmit={handleDetailsSubmit}
        />
    </div>
  );
}