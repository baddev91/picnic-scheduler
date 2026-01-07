import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppMode, ShiftTime, ShiftType, ShopperData, ShopperShift, AdminAvailabilityMap, ShopperDetails, WeeklyTemplate, ShopperStep, AdminWizardStep } from './types';
import { SHIFT_TIMES, formatDateKey, getShopperAllowedRange, getShopperMinDate } from './constants';
import { Button } from './components/Button';
import { CalendarView } from './components/CalendarView';
import { MobileInstructionModal } from './components/MobileInstructionModal';
import { Shield, Download, ArrowRight, UserPlus, CheckCircle, AlertCircle, Save, Trash2, History, XCircle, Lock, Bus, Heart, Shirt, Footprints, Hand, MapPin, Building2, Settings2, CalendarDays, Undo2, PlayCircle, Plus, Check, User, Ban, CloudUpload, Link, Share2, LogIn, RefreshCw, FileDown, Copy, CalendarRange, ChevronRight, ChevronLeft, Star, Table, Sun, Moon, Sunrise, Sunset, Coffee, KeyRound, X, ClipboardList, Clock, ToggleLeft, ToggleRight, Camera } from 'lucide-react';
import { isWeekend, addDays, getDay, isSameDay, format, isWithinInterval, addWeeks, endOfWeek, isBefore, isAfter } from 'date-fns';
import startOfWeek from 'date-fns/startOfWeek';
import subDays from 'date-fns/subDays';
import nextMonday from 'date-fns/nextMonday';
import startOfToday from 'date-fns/startOfToday';
import { supabase } from './supabaseClient';
import { AdminDataView } from './components/AdminDataView';

const STORAGE_KEYS = {
  TEMPLATE: 'picnic_admin_template',
  // Removed legacy keys
};

function App() {
  // Auth State (Admin)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(false);

  // Auth State (Shopper)
  const [shopperPinConfig, setShopperPinConfig] = useState<string | null>(null); // The PIN stored in DB
  const [isShopperAuthEnabled, setIsShopperAuthEnabled] = useState(true); // Is PIN check active?
  const [enteredShopperPin, setEnteredShopperPin] = useState('');
  const [isShopperVerified, setIsShopperVerified] = useState(false);
  const [showShopperAuth, setShowShopperAuth] = useState(false); // Controls visibility of PIN screen
  const [adminShopperPinInput, setAdminShopperPinInput] = useState(''); // For Admin input

  // App State - DEFAULT TO SHOPPER_SETUP (Auto-start)
  const [mode, setMode] = useState<AppMode>(AppMode.SHOPPER_SETUP);
  
  // Admin Wizard State
  const [adminWizardStep, setAdminWizardStep] = useState<AdminWizardStep>(AdminWizardStep.DASHBOARD);
  const [wizardDayIndex, setWizardDayIndex] = useState<number>(1); // 1 = Monday
  const [tempTemplate, setTempTemplate] = useState<WeeklyTemplate>({});
  const [savedCloudTemplate, setSavedCloudTemplate] = useState<WeeklyTemplate | null>(null); // New: Store loaded template
  const [applyWeeks, setApplyWeeks] = useState<number>(4);

  // Shopper State
  const [shopperStep, setShopperStep] = useState<ShopperStep>(ShopperStep.AA_SELECTION);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSelfService, setIsSelfService] = useState(false);
  
  // Mobile Popup State
  const [showMobileInstructions, setShowMobileInstructions] = useState(false);

  // Scroll Ref for Mobile UX
  const flowScrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Data State
  const [adminAvailability, setAdminAvailability] = useState<AdminAvailabilityMap>({});
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Shopper Data
  const [shopperNames, setShopperNames] = useState<string[]>([]);
  const [currentShopperIndex, setCurrentShopperIndex] = useState(0);
  const [selections, setSelections] = useState<ShopperData[]>([]);
  
  // Wizard State (Shopper) - STRICT 1 Weekday + 1 Weekend
  const [aaSelection, setAaSelection] = useState<{
    weekday: { dayIndex: number | null, time: ShiftTime | null },
    weekend: { dayIndex: number | null, time: ShiftTime | null }
  }>({
    weekday: { dayIndex: null, time: null },
    weekend: { dayIndex: null, time: null }
  });

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
  
  const [tempNameInput, setTempNameInput] = useState('');

  // --------------------------------------------------------------------------
  // Configuration Fetching (GET) - From Supabase
  // --------------------------------------------------------------------------

  const saveConfigToSupabase = async (config: AdminAvailabilityMap) => {
      try {
          const { error } = await supabase
              .from('app_settings')
              .upsert({ id: 'admin_availability', value: config });
          if (error) console.error("Failed to save config to Supabase:", error);
      } catch (e) {
          console.error("Error saving config to Supabase:", e);
      }
  };

  const saveTemplateToSupabase = async (template: WeeklyTemplate) => {
      try {
          const { error } = await supabase
              .from('app_settings')
              .upsert({ id: 'weekly_template', value: template });
          if (error) console.error("Failed to save template to Supabase:", error);
          else setSavedCloudTemplate(template);
      } catch (e) {
          console.error("Error saving template to Supabase:", e);
      }
  };

  const saveShopperAuthSettings = async (pin: string, enabled: boolean) => {
    try {
        const { error } = await supabase
            .from('app_settings')
            .upsert({ id: 'shopper_auth', value: { pin, enabled } });
        if (error) alert("Error saving Auth Settings");
        else {
            setShopperPinConfig(pin);
            setIsShopperAuthEnabled(enabled);
            alert("Security settings updated successfully!");
        }
    } catch (e) { console.error(e); }
  };

  const loadRemoteConfig = useCallback(async () => {
    try {
        const { data: availData } = await supabase.from('app_settings').select('value').eq('id', 'admin_availability').single();
        if (availData?.value) {
            let parsedValue = availData.value;
            if (typeof parsedValue === 'string') { try { parsedValue = JSON.parse(parsedValue); } catch (e) {} }
            setAdminAvailability(parsedValue);
        }

        const { data: templateData } = await supabase.from('app_settings').select('value').eq('id', 'weekly_template').single();
        if (templateData?.value) {
            let parsedTemplate = templateData.value;
            if (typeof parsedTemplate === 'string') { try { parsedTemplate = JSON.parse(parsedTemplate); } catch(e) {} }
            setSavedCloudTemplate(parsedTemplate);
            setTempTemplate(parsedTemplate);
        } else {
            try {
              const savedTemplate = JSON.parse(localStorage.getItem(STORAGE_KEYS.TEMPLATE) || '{}');
              if (Object.keys(savedTemplate).length > 0) setTempTemplate(savedTemplate);
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
    } catch (err) { console.error("Error loading remote config:", err); }
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
  }, [mode, loadRemoteConfig]);

  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem(STORAGE_KEYS.TEMPLATE, JSON.stringify(tempTemplate));
  }, [tempTemplate, isInitialized]);

  // Scroll to top when step changes (For Mobile UX)
  // Also TRIGGER MOBILE POPUP
  useEffect(() => {
      if (mode === AppMode.SHOPPER_FLOW) {
          // Use setTimeout to ensure the DOM update has happened
          setTimeout(() => {
              if (flowScrollContainerRef.current) {
                  flowScrollContainerRef.current.scrollTop = 0;
              }
              // Also force window scroll just in case
              window.scrollTo(0, 0);
          }, 50);
          
          // Trigger Popup logic
          if (shopperStep === ShopperStep.FWD_SELECTION || shopperStep === ShopperStep.STANDARD_SELECTION) {
              setShowMobileInstructions(true);
          } else {
              setShowMobileInstructions(false);
          }
      }
  }, [shopperStep, mode]);

  // --------------------------------------------------------------------------
  // Core Logic
  // --------------------------------------------------------------------------

  const generateRandomPin = () => {
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      setAdminShopperPinInput(pin);
  };

  const startShopperSession = () => {
      const minDate = getShopperMinDate();
      // Initially, we do NOT set First Working Day. It will be set explicitly in step 2.
      const newShopper: ShopperData = {
          name: tempNameInput.trim(),
          shifts: [],
          details: { ...tempDetails, firstWorkingDay: undefined } 
      };
      setSelections([newShopper]);
      setShopperNames([tempNameInput.trim()]);
      setMode(AppMode.SHOPPER_FLOW);
      setShopperStep(ShopperStep.AA_SELECTION);
      setShowShopperAuth(false);
  };

  const handleVerifyShopperPin = () => {
      if (enteredShopperPin === shopperPinConfig) {
          setIsShopperVerified(true);
          startShopperSession();
      } else {
          alert("Incorrect PIN");
          setEnteredShopperPin('');
      }
  };

  const handleStartShopperClick = () => {
      if (!tempNameInput.trim()) return;
      if (shopperPinConfig && isShopperAuthEnabled && !isShopperVerified) {
          setShowShopperAuth(true);
      } else {
          startShopperSession();
      }
  };

  const handleSubmitData = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
        for (const shopper of selections) {
            const { data: shopperData, error: shopperError } = await supabase
                .from('shoppers')
                .insert([{ name: shopper.name, details: shopper.details || {} }])
                .select().single();
            if (shopperError) throw new Error(`DB Error: ${shopperError.message}`);
            
            const shopperId = shopperData.id;

            // FILTER SHIFTS: Only save shifts from FWD up to Sunday of the following week
            let finalShifts = shopper.shifts;
            if (shopper.details?.firstWorkingDay) {
                const fwd = shopper.details.firstWorkingDay;
                const fwdDate = getSafeDateFromKey(fwd);
                // Limit: Sunday of the week following the FWD week
                const limitDate = endOfWeek(addWeeks(fwdDate, 1), { weekStartsOn: 1 });
                const limitKey = formatDateKey(limitDate);
        
                finalShifts = finalShifts.filter(s => s.date >= fwd && s.date <= limitKey);
            }

            const shiftsPayload = finalShifts.map(s => ({
                shopper_id: shopperId, date: s.date, time: s.time, type: s.type
            }));
            
            if (shiftsPayload.length > 0) {
                const { error: shiftsError } = await supabase.from('shifts').insert(shiftsPayload);
                if (shiftsError) throw new Error(`DB Error: ${shiftsError.message}`);
            }
        }
        setSyncStatus('success');
    } catch (error: any) {
        console.error("Sync error", error);
        setSyncStatus('error');
        alert(`Failed to save: ${error.message || 'Unknown error'}`);
    } finally { setIsSyncing(false); }
  };

  const handleClearSession = () => {
    setShopperNames([]);
    setSelections([]);
    setCurrentShopperIndex(0);
    setShopperStep(ShopperStep.AA_SELECTION);
    setAaSelection({ weekday: { dayIndex: null, time: null }, weekend: { dayIndex: null, time: null } });
    setIsShopperVerified(false);
    setShowShopperAuth(false);
    setSyncStatus('idle');
    setTempNameInput('');
    setMode(AppMode.SHOPPER_SETUP);
  };

  // --------------------------------------------------------------------------
  // Admin Logic
  // --------------------------------------------------------------------------

  const handleAdminToggle = (date: string, shift: ShiftTime, type: ShiftType) => {
    setAdminAvailability(prev => {
      const dayConfig = prev[date] || {};
      const currentTypesForShift = dayConfig[shift] || [ShiftType.AA, ShiftType.STANDARD];
      let newTypes: ShiftType[];
      if (currentTypesForShift.includes(type)) newTypes = currentTypesForShift.filter(t => t !== type);
      else newTypes = [...currentTypesForShift, type];
      const newState = { ...prev, [date]: { ...dayConfig, [shift]: newTypes } };
      saveConfigToSupabase(newState);
      return newState;
    });
  };

  const toggleWizardTemplate = (shift: ShiftTime, type: ShiftType) => {
      setTempTemplate(prev => {
          const dayConfig = prev[wizardDayIndex] || {};
          const currentTypes = dayConfig[shift] || [];
          let newTypes;
          if (currentTypes.includes(type)) newTypes = currentTypes.filter(t => t !== type);
          else newTypes = [...currentTypes, type];
          return { ...prev, [wizardDayIndex]: { ...dayConfig, [shift]: newTypes } };
      });
  };

  const resetWizardTemplate = () => {
    const code = window.prompt("⚠️ DANGER ZONE ⚠️\n\nThis will clear the entire weekly pattern configuration.\n\nEnter Admin PIN to confirm reset:");
    if (code === '7709') {
        const initial: WeeklyTemplate = {};
        [1,2,3,4,5,6,0].forEach(d => {
            initial[d] = { [ShiftTime.OPENING]: [], [ShiftTime.MORNING]: [], [ShiftTime.NOON]: [], [ShiftTime.AFTERNOON]: [] };
        });
        setTempTemplate(initial);
        saveTemplateToSupabase(initial);
        alert("Pattern reset successfully.");
    } else if (code !== null) alert("Incorrect PIN. Reset cancelled.");
  };

  const copyPreviousDay = () => {
      if (wizardDayIndex === 1) return;
      const prevDayIndex = wizardDayIndex === 0 ? 6 : wizardDayIndex - 1;
      const prevConfig = tempTemplate[prevDayIndex];
      if (prevConfig) setTempTemplate(prev => ({ ...prev, [wizardDayIndex]: JSON.parse(JSON.stringify(prevConfig)) }));
  };

  const applyTemplate = () => {
      const startDate = nextMonday(new Date());
      const newAvailability = { ...adminAvailability };
      const safeTemplate = JSON.parse(JSON.stringify(tempTemplate));
      for (let i = 0; i < applyWeeks * 7; i++) {
         const currentLoopDate = addDays(startDate, i);
         const dateKey = formatDateKey(currentLoopDate);
         const dayOfWeek = getDay(currentLoopDate); 
         const templateDayConfig = safeTemplate[dayOfWeek];
         if (templateDayConfig) newAvailability[dateKey] = templateDayConfig;
      }
      setAdminAvailability(newAvailability);
      saveConfigToSupabase(newAvailability);
      saveTemplateToSupabase(safeTemplate);
      alert(`Schedule generated successfully for ${applyWeeks} weeks! Saved to Cloud.`);
      setAdminWizardStep(AdminWizardStep.DASHBOARD);
  };

  const handleCopyMagicLink = () => {
      const link = `${window.location.origin}/?mode=shopper`;
      navigator.clipboard.writeText(link).then(() => {
          alert("Shopper Link Copied!\n\n" + link + "\n\nUse this link on the iPad/Kiosk. It will require the PIN to enter.");
      });
  };

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  const getSafeDateFromKey = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const formatDateDisplay = (dateStr: string) => {
      if(!dateStr) return 'N/A';
      try {
          // dateStr is typically YYYY-MM-DD
          return format(new Date(dateStr), 'EEE, MMM do, yyyy');
      } catch (e) { return dateStr; }
  };

  const calculateGloveSize = (clothingSize: string): string => {
    const map: Record<string, string> = {
      'XS': '6 (XS)', 'S': '7 (S)', 'M': '8 (M)', 'L': '9 (L)',
      'XL': '10 (XL)', 'XXL': '11 (XXL)', '3XL': '12 (3XL)', '4XL': '12 (4XL)'
    };
    return map[clothingSize] || '8 (M)';
  };

  const handleLogin = () => {
    if (password === '7709') { setIsAuthenticated(true); setAuthError(false); } 
    else setAuthError(true);
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

  const isConsecutiveDaysViolation = (dateStr: string, currentShifts: ShopperShift[]): boolean => {
      const targetDate = getSafeDateFromKey(dateStr);
      const shiftDates = new Set(currentShifts.map(s => s.date));
      let consecutiveBefore = 0;
      let checkDate = subDays(targetDate, 1);
      while (shiftDates.has(formatDateKey(checkDate))) { consecutiveBefore++; checkDate = subDays(checkDate, 1); }
      let consecutiveAfter = 0;
      checkDate = addDays(targetDate, 1);
      while (shiftDates.has(formatDateKey(checkDate))) { consecutiveAfter++; checkDate = addDays(checkDate, 1); }
      return (consecutiveBefore + 1 + consecutiveAfter) > 5;
  };

  // --- NEW RULE: Range Validation (Max 2 Weeks from SPECIFIC First Day) ---
  const validateShopperRange = (proposedShifts: ShopperShift[], firstWorkingDay: string | undefined): { valid: boolean, message?: string } => {
     // If no First Working Day set, we cannot validly check range yet (but this shouldn't happen in Standard step)
     if (!firstWorkingDay) return { valid: true };

     const fwdDate = getSafeDateFromKey(firstWorkingDay);
     // Allowed End Date: Sunday of the week FOLLOWING the FWD's week
     const allowedEndDate = endOfWeek(addWeeks(fwdDate, 1), { weekStartsOn: 1 });

     const standardShifts = proposedShifts.filter(s => s.type === ShiftType.STANDARD);
     const lateShifts = standardShifts.filter(s => isAfter(getSafeDateFromKey(s.date), allowedEndDate));

     if (lateShifts.length > 0) {
         return {
             valid: false,
             message: `Range Limit Exceeded.\n\nBased on your Start Date (${format(fwdDate, 'MMM do')}), you can only select shifts up to ${format(allowedEndDate, 'MMM do')}.`
         };
     }
     return { valid: true };
  };

  // Handle Logic for the specific "First Working Day Selection" Step
  const handleFWDSelection = (dateStr: string, shift: ShiftTime) => {
      // 1. Validate Time (Morning/Afternoon Only) - Although UI also blocks this
      if (shift === ShiftTime.OPENING || shift === ShiftTime.NOON) {
          alert("Invalid First Day Shift. Must be Morning or Afternoon.");
          return;
      }

      const currentName = shopperNames[currentShopperIndex];
      const newSelections = [...selections];
      const idx = newSelections.findIndex(s => s.name === currentName);
      
      const existing = idx >= 0 ? newSelections[idx] : { name: currentName, shifts: [], details: {} };
      
      // 2. Set FWD in details
      const updatedDetails = { ...existing.details, firstWorkingDay: dateStr } as ShopperDetails;
      
      // 3. Add this as a Standard Shift (OVERRIDING any existing AA on this day if present)
      let currentShifts = [...existing.shifts];
      
      // Remove any existing AA on this date to avoid conflict
      currentShifts = currentShifts.filter(s => s.date !== dateStr);
      
      // Add the chosen start shift
      currentShifts.push({ date: dateStr, time: shift, type: ShiftType.STANDARD });

      // Update State
      if (idx >= 0) newSelections[idx] = { ...existing, shifts: currentShifts, details: updatedDetails };
      else newSelections.push({ name: currentName, shifts: currentShifts, details: updatedDetails });
      
      setSelections(newSelections);
      
      // 4. Move to next step
      setShopperStep(ShopperStep.STANDARD_SELECTION);
  };

  const handleStandardShiftToggle = (dateStr: string, shift: ShiftTime, type: ShiftType) => {
    const currentName = shopperNames[currentShopperIndex];
    const prevData = selections.find(s => s.name === currentName) || { name: currentName, shifts: [] };
    let newShifts = [...prevData.shifts];
    const fwd = prevData.details?.firstWorkingDay;
    
    // Safety check: Shopper should not be here without FWD
    if (!fwd) {
        alert("Error: First Working Day not set. Please go back.");
        setShopperStep(ShopperStep.FWD_SELECTION);
        return;
    }

    if (type === ShiftType.STANDARD) {
      const existingIndex = newShifts.findIndex(s => s.date === dateStr && s.time === shift && s.type === ShiftType.STANDARD);
      
      // ADDING
      if (existingIndex === -1) {
          // 1. Check if trying to add BEFORE FWD (Strict Rule)
          if (isBefore(getSafeDateFromKey(dateStr), getSafeDateFromKey(fwd))) {
              alert(`Cannot select a shift before your First Working Day (${format(getSafeDateFromKey(fwd), 'MMM do')}).`);
              return;
          }

          // 2. Check Rest
          if (isRestViolation(dateStr, shift, newShifts)) {
            alert("Rest Constraint Violation: Not enough rest between shifts.");
            return;
          }
          
          // 3. Check 5-Day limit
          if (isConsecutiveDaysViolation(dateStr, newShifts)) {
              alert("Limit reached: You cannot work more than 5 consecutive days.");
              return;
          }

          // 4. Check if AA exists -> Override logic
          const existingAA = newShifts.find(s => s.date === dateStr && s.type === ShiftType.AA);
          if (existingAA) {
             // Simply allow override. User is explicitly clicking standard.
             newShifts = newShifts.filter(s => s !== existingAA);
         }

         // 5. Check Range (based on FWD)
         const simulatedShifts = [...newShifts, { date: dateStr, time: shift, type: ShiftType.STANDARD }];
         const rangeCheck = validateShopperRange(simulatedShifts, fwd);
         if (!rangeCheck.valid) {
             alert(rangeCheck.message);
             return;
         }

         newShifts.push({ date: dateStr, time: shift, type: ShiftType.STANDARD });
      } else {
         // REMOVING
         const shiftToRemove = newShifts[existingIndex];
         
         // Prevent removing the FWD shift itself here? 
         // Optional: Maybe allow removing but warn they need to pick a new start?
         // For now, let's block removing the exact shift that corresponds to FWD to avoid invalid state.
         if (shiftToRemove.date === fwd) {
             if (!confirm("You are removing your First Working Day shift. You will need to select a new First Working Day. Continue?")) {
                 return;
             }
             // If they continue, we might need to reset FWD? 
             // Simpler: Allow removal, but don't reset FWD variable automatically to avoid complex state.
             // OR: Just send them back to step 1.
             // Best UX: Block it. "To change your first day, click 'Reset Start Date' below."
             alert("To change your First Working Day, please click 'Change Start Date' at the bottom.");
             return;
         }

         newShifts.splice(existingIndex, 1);
      }
    }
    
    // Update State
    const newSelections = [...selections];
    const idx = newSelections.findIndex(s => s.name === currentName);
    if (idx >= 0) newSelections[idx] = { ...prevData, shifts: newShifts };
    setSelections(newSelections);
  };

  const handleAAWizardSubmit = () => {
      const { weekday, weekend } = aaSelection;

      // NEW: Check if selection is complete
      if (weekday.dayIndex === null || weekday.time === null || weekend.dayIndex === null || weekend.time === null) {
          alert("⚠️ Missing Selection!\n\nPlease select one Weekday shift AND one Weekend shift to continue.");
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
          const checkAvailability = (t: ShiftTime) => {
              const dayConfig = adminAvailability[dateStr];
              if (!dayConfig) return true;
              if (!dayConfig[t]) return true;
              return dayConfig[t]?.includes(ShiftType.AA) ?? true;
          };
          if (dayIndex === weekday.dayIndex && weekday.time && checkAvailability(weekday.time)) {
             newShifts.push({ date: dateStr, time: weekday.time, type: ShiftType.AA });
          }
          if (dayIndex === weekend.dayIndex && weekend.time && checkAvailability(weekend.time)) {
             newShifts.push({ date: dateStr, time: weekend.time, type: ShiftType.AA });
          }
          currentDate = addDays(currentDate, 1);
      }

      // Basic Validation that shifts were generated
      const hasWeekdayAA = newShifts.some(s => { const d = getDay(getSafeDateFromKey(s.date)); return d >= 1 && d <= 5; });
      const hasWeekendAA = newShifts.some(s => { const d = getDay(getSafeDateFromKey(s.date)); return d === 0 || d === 6; });

      if (!hasWeekdayAA) { alert("Selection Invalid: No available dates found for your selected Weekday."); return; }
      if (!hasWeekendAA) { alert("Selection Invalid: No available dates found for your selected Weekend."); return; }

      // Update State & Move to FWD Selection
      const currentName = shopperNames[currentShopperIndex];
      const newSelections = [...selections];
      const idx = newSelections.findIndex(s => s.name === currentName);
      const existingDetails = idx >= 0 ? newSelections[idx].details || {} : { usePicnicBus: false, civilStatus: 'Single', clothingSize: 'M', shoeSize: '40', gloveSize: '8 (M)', isRandstad: false, address: '' };
      
      const newShopperData = { name: currentName, shifts: newShifts, details: existingDetails };
      if (idx >= 0) newSelections[idx] = newShopperData;
      else newSelections.push(newShopperData);
      
      setSelections(newSelections);
      setShopperStep(ShopperStep.FWD_SELECTION); // NEW STEP
  };

  const handleNextShopperClick = () => setShowDetailsModal(true);
  const handleDetailsSubmit = () => {
    const currentName = shopperNames[currentShopperIndex];
    const newSelections = [...selections];
    const idx = newSelections.findIndex(s => s.name === currentName);
    const existing = idx >= 0 ? newSelections[idx] : { name: currentName, shifts: [], details: {} };
    const updated = { ...existing, details: { ...(existing.details || {}), ...tempDetails } };
    if (idx >= 0) newSelections[idx] = updated;
    else newSelections.push(updated);
    setSelections(newSelections);
    setShowDetailsModal(false);
    setMode(AppMode.SUMMARY);
  };

  // --------------------------------------------------------------------------
  // Renderers
  // --------------------------------------------------------------------------

  // ... (Admin Renderers Unchanged) ...
  const renderAdminDashboard = () => (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
             <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-purple-100 rounded-xl text-purple-600">
                    <Settings2 className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">System Configuration</h2>
                    <p className="text-gray-500 text-sm">Manage access settings.</p>
                </div>
             </div>
             
             {/* Shopper Access Control */}
             <div className="mt-6 pt-6 border-t">
                <div className="flex justify-between items-center mb-4">
                     <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2">
                        <KeyRound className="w-4 h-4" /> Shopper Access Control
                    </h3>
                    <div className="flex items-center gap-3">
                         <span className={`text-xs font-bold ${isShopperAuthEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                             {isShopperAuthEnabled ? 'PIN REQUIRED' : 'PIN DISABLED'}
                         </span>
                         <button 
                             onClick={() => setIsShopperAuthEnabled(!isShopperAuthEnabled)}
                             className={`p-1 rounded-full w-12 flex transition-all duration-300 ${isShopperAuthEnabled ? 'bg-green-500 justify-end' : 'bg-gray-300 justify-start'}`}
                         >
                             <div className="w-5 h-5 bg-white rounded-full shadow-md"></div>
                         </button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-end bg-gray-50 p-4 rounded-xl border">
                    <div className="flex-1 space-y-2 w-full">
                        <label className="text-xs text-gray-500 font-medium">6-Digit Access PIN</label>
                        <div className="flex gap-2">
                            <input 
                                value={adminShopperPinInput} 
                                onChange={e => setAdminShopperPinInput(e.target.value.replace(/[^0-9]/g, '').slice(0,6))}
                                className={`w-full border rounded-lg p-2 text-sm font-mono tracking-widest text-center outline-none transition-all ${isShopperAuthEnabled ? 'focus:ring-2 focus:ring-purple-500 bg-white' : 'bg-gray-100 text-gray-400'}`}
                                placeholder="000000"
                                disabled={!isShopperAuthEnabled}
                            />
                            <button 
                                onClick={generateRandomPin}
                                className="p-2 bg-white border hover:bg-gray-50 rounded-lg text-gray-600 disabled:opacity-50"
                                title="Generate Random PIN"
                                disabled={!isShopperAuthEnabled}
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                            <Button 
                                onClick={() => saveShopperAuthSettings(adminShopperPinInput, isShopperAuthEnabled)} 
                                disabled={isShopperAuthEnabled && adminShopperPinInput.length !== 6}
                                className="whitespace-nowrap"
                            >
                                <Save className="w-4 h-4 mr-2" /> Save Settings
                            </Button>
                        </div>
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                    {isShopperAuthEnabled 
                     ? "Shoppers will be asked for this PIN when starting a session." 
                     : "Security disabled. Shoppers can start immediately without a PIN."}
                </p>
             </div>

             <div className="mt-4 pt-4 border-t flex justify-end">
                 <Button onClick={handleCopyMagicLink} variant="outline" className="text-sm">
                     <Share2 className="w-4 h-4 mr-2" /> Copy Shopper Link
                 </Button>
             </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
              <button 
                onClick={() => {
                    // Force load from cloud template if available, otherwise check local
                    if (savedCloudTemplate) {
                         setTempTemplate(savedCloudTemplate);
                    } else if (Object.keys(tempTemplate).length === 0) {
                        // Initialize empty only if strictly nothing exists
                        const initial: WeeklyTemplate = {};
                        [1,2,3,4,5,6,0].forEach(d => {
                            initial[d] = {
                                [ShiftTime.OPENING]: [],
                                [ShiftTime.MORNING]: [],
                                [ShiftTime.NOON]: [],
                                [ShiftTime.AFTERNOON]: []
                            };
                        });
                        setTempTemplate(initial);
                    }
                    
                    setWizardDayIndex(1); // Mon
                    setAdminWizardStep(AdminWizardStep.WIZARD_DAYS);
                }}
                className="group p-6 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl shadow-lg text-left hover:scale-[1.02] transition-all relative overflow-hidden"
              >
                  <div className="relative z-10">
                      <CalendarRange className="w-10 h-10 text-white mb-4 opacity-90" />
                      <h3 className="text-2xl font-bold text-white mb-2">Edit Weekly Pattern</h3>
                      <p className="text-purple-100 text-sm">Guided wizard to set AA & Standard slots. Loads from Cloud if available.</p>
                  </div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl"></div>
              </button>

              <button 
                onClick={() => setAdminWizardStep(AdminWizardStep.VIEW_SUBMISSIONS)}
                className="group p-6 bg-white border-2 border-gray-100 rounded-2xl shadow-sm text-left hover:border-green-200 hover:bg-green-50 transition-all"
              >
                  <Table className="w-10 h-10 text-green-600 mb-4" />
                  <h3 className="text-xl font-bold text-gray-800 mb-2">View Submissions</h3>
                  <p className="text-gray-500 text-sm">View, search, and manage data submitted by shoppers.</p>
              </button>
          </div>
      </div>
  );

  const renderAdminWizardDays = () => {
      const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = WEEK_DAYS[wizardDayIndex];
      const isWeekendDay = wizardDayIndex === 0 || wizardDayIndex === 6;

      const handleNext = () => {
          if (wizardDayIndex === 0) setAdminWizardStep(AdminWizardStep.WIZARD_APPLY); // Sun is last
          else setWizardDayIndex(prev => prev === 6 ? 0 : prev + 1);
      };

      const handleBack = () => {
          if (wizardDayIndex === 1) setAdminWizardStep(AdminWizardStep.DASHBOARD); // Mon is first
          else setWizardDayIndex(prev => prev === 0 ? 6 : prev - 1);
      };

      const isShiftEnabled = (shift: ShiftTime, type: ShiftType) => {
          return tempTemplate[wizardDayIndex]?.[shift]?.includes(type);
      };

      return (
          <div className="max-w-3xl mx-auto h-full flex flex-col">
              {/* Progress */}
              <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                       <span className="text-xs font-bold uppercase text-gray-400">Step 1: Define Pattern</span>
                  </div>
                  <div className="flex gap-1">
                      {[1,2,3,4,5,6,0].map(d => (
                          <div key={d} className={`h-1.5 w-6 rounded-full ${d === wizardDayIndex ? 'bg-purple-600' : tempTemplate[d] ? 'bg-purple-200' : 'bg-gray-200'}`} />
                      ))}
                  </div>
              </div>

              {/* Card */}
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col flex-1 animate-in slide-in-from-right duration-300 border border-gray-100">
                  <div className={`p-6 border-b flex justify-between items-center ${isWeekendDay ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <div>
                          <h2 className={`text-3xl font-extrabold ${isWeekendDay ? 'text-red-600' : 'text-gray-800'}`}>{dayName}</h2>
                          <p className="text-gray-500 font-medium mt-1">Configure available shifts</p>
                      </div>
                      <div className="flex gap-2">
                         {/* Clear Template Button */}
                         <button onClick={resetWizardTemplate} className="flex items-center gap-2 text-sm font-bold text-gray-500 bg-white px-3 py-2 rounded-lg shadow-sm hover:bg-gray-100 hover:text-red-500 transition-all border">
                              <Trash2 className="w-4 h-4" /> Reset Pattern
                          </button>
                         {wizardDayIndex !== 1 && (
                              <button onClick={copyPreviousDay} className="flex items-center gap-2 text-sm font-bold text-purple-600 bg-white px-3 py-2 rounded-lg shadow-sm hover:bg-purple-50 transition-all border border-purple-100">
                                  <Copy className="w-4 h-4" /> Copy Previous Day
                              </button>
                          )}
                      </div>
                  </div>

                  <div className="p-6 overflow-y-auto space-y-4">
                      {SHIFT_TIMES.map(shift => (
                          <div key={shift} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border border-gray-100 hover:border-purple-100 hover:shadow-md transition-all gap-4">
                              <div className="flex items-center gap-3">
                                  <div className="p-2 bg-gray-100 rounded-lg text-gray-500 font-bold">
                                      {shift.split('(')[0]}
                                  </div>
                                  <span className="text-xs text-gray-400 font-mono">{shift.match(/\((.*?)\)/)?.[1]}</span>
                              </div>
                              
                              <div className="flex gap-3">
                                  <button
                                      onClick={() => toggleWizardTemplate(shift, ShiftType.AA)}
                                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                                          isShiftEnabled(shift, ShiftType.AA)
                                          ? 'bg-red-500 border-red-500 text-white shadow-red-200 shadow-lg'
                                          : 'bg-white border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-400'
                                      }`}
                                  >
                                      {isShiftEnabled(shift, ShiftType.AA) ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                      AA
                                  </button>

                                  <button
                                      onClick={() => toggleWizardTemplate(shift, ShiftType.STANDARD)}
                                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                                          isShiftEnabled(shift, ShiftType.STANDARD)
                                          ? 'bg-green-500 border-green-500 text-white shadow-green-200 shadow-lg'
                                          : 'bg-white border-gray-200 text-gray-400 hover:border-green-300 hover:text-green-400'
                                      }`}
                                  >
                                      {isShiftEnabled(shift, ShiftType.STANDARD) ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                      Standard
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>

                  <div className="p-6 bg-gray-50 border-t mt-auto flex justify-between items-center">
                      <Button variant="secondary" onClick={handleBack} className="w-32">
                          <ChevronLeft className="w-4 h-4 mr-2" /> Back
                      </Button>
                      <Button onClick={handleNext} className="w-32 bg-gray-900 text-white hover:bg-black">
                          {wizardDayIndex === 0 ? 'Review' : 'Next Day'} <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                  </div>
              </div>
          </div>
      );
  };

  const renderAdminWizardApply = () => (
      <div className="max-w-2xl mx-auto h-full flex flex-col justify-center animate-in zoom-in-95 duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl text-center space-y-8 border border-purple-100">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-purple-600" />
              </div>
              
              <div>
                  <h2 className="text-3xl font-extrabold text-gray-900">Pattern Ready!</h2>
                  <p className="text-gray-500 mt-2 text-lg">How far into the future should we generate this schedule?</p>
              </div>

              <div className="bg-gray-50 p-6 rounded-2xl max-w-sm mx-auto">
                  <div className="flex justify-between items-end mb-2">
                      <span className="text-gray-500 font-bold uppercase text-xs">Duration</span>
                      <span className="text-3xl font-bold text-purple-600">{applyWeeks} <span className="text-base text-gray-400 font-medium">Weeks</span></span>
                  </div>
                  <input 
                      type="range" 
                      min="1" 
                      max="12" 
                      value={applyWeeks} 
                      onChange={(e) => setApplyWeeks(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <div className="flex justify-between mt-2 text-xs text-gray-400 font-medium">
                      <span>1 Week</span>
                      <span>12 Weeks</span>
                  </div>
              </div>

              <div className="flex gap-4 pt-4">
                  <Button variant="secondary" onClick={() => setAdminWizardStep(AdminWizardStep.WIZARD_DAYS)} fullWidth>
                      Edit Pattern
                  </Button>
                  <Button onClick={applyTemplate} fullWidth className="py-4 text-lg bg-gradient-to-r from-purple-600 to-indigo-600">
                      Generate Schedule
                  </Button>
              </div>
              <p className="text-xs text-gray-400">Note: This will overwrite local settings starting from next Monday.</p>
          </div>
      </div>
  );

  const renderAdmin = () => (
    <div className="min-h-screen bg-gray-100 pb-20 flex flex-col">
      {/* Admin Header */}
      <div className="bg-white border-b sticky top-0 z-20 px-6 py-4 shadow-sm flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                  <Shield className="w-6 h-6" />
              </div>
              <div>
                  <h2 className="text-lg font-bold text-gray-800 leading-none">Admin Panel</h2>
                  <span className="text-xs text-gray-400 font-medium">
                    {adminWizardStep === AdminWizardStep.VIEW_SUBMISSIONS ? 'Data Viewer' : 'Wizard Mode'}
                  </span>
              </div>
          </div>
          <div className="flex gap-2">
              {adminWizardStep !== AdminWizardStep.DASHBOARD && (
                  <Button variant="secondary" onClick={() => setAdminWizardStep(AdminWizardStep.DASHBOARD)} className="text-sm">
                      Back
                  </Button>
              )}
              <Button onClick={() => setMode(AppMode.SHOPPER_SETUP)} className="bg-gray-800 text-white hover:bg-gray-900 text-sm">
                  Log Out
              </Button>
          </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
          {adminWizardStep === AdminWizardStep.DASHBOARD && renderAdminDashboard()}
          {adminWizardStep === AdminWizardStep.WIZARD_DAYS && renderAdminWizardDays()}
          {adminWizardStep === AdminWizardStep.WIZARD_APPLY && renderAdminWizardApply()}
          
          {adminWizardStep === AdminWizardStep.VIEW_SUBMISSIONS && <AdminDataView />}
      </div>
    </div>
  );

  const renderShopperSetup = () => {
    // If PIN is configured and user tried to start (showShopperAuth is true) -> Show PIN Screen
    if (showShopperAuth) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center space-y-6 animate-in zoom-in-95">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                        <KeyRound className="w-8 h-8 text-purple-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Protected Session</h2>
                        <p className="text-gray-500 text-sm mt-1">Please enter the PIN to continue.</p>
                    </div>
                    <div className="space-y-4">
                        <input 
                            type="text" 
                            inputMode="numeric"
                            maxLength={6}
                            value={enteredShopperPin}
                            onChange={(e) => setEnteredShopperPin(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleVerifyShopperPin()}
                            className="w-full text-center text-2xl tracking-[0.5em] font-mono py-3 border-b-2 border-gray-300 focus:border-purple-600 outline-none bg-transparent transition-colors"
                            placeholder="••••••"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <Button onClick={() => setShowShopperAuth(false)} variant="secondary" className="flex-1">
                                Back
                            </Button>
                            <Button onClick={handleVerifyShopperPin} className="flex-[2] bg-purple-600 hover:bg-purple-700">
                                Verify PIN
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Default View: Homepage
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-between p-6">
         
         <div className="w-full flex justify-center pt-8">
             <h1 className="text-5xl font-extrabold text-[#E31837] tracking-tight">Picnic</h1>
         </div>

         <div className="w-full max-w-sm animate-in zoom-in duration-300 space-y-8">
            <div className="text-center space-y-2">
               <h1 className="text-3xl font-extrabold text-gray-900">Welcome!</h1>
               <p className="text-gray-500">Enter your name to start selecting your shifts.</p>
            </div>
            
            <div className="space-y-4">
               <input 
                 value={tempNameInput}
                 onChange={(e) => setTempNameInput(e.target.value)}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter' && tempNameInput.trim()) {
                     handleStartShopperClick();
                   }
                 }}
                 placeholder="Your Full Name"
                 className="w-full border-b-2 border-gray-200 py-4 text-center text-2xl font-medium outline-none focus:border-[#E31837] transition-colors placeholder:text-gray-300"
                 autoFocus
               />

               <Button 
                 disabled={!tempNameInput.trim()} 
                 onClick={handleStartShopperClick}
                 fullWidth
                 className="py-4 text-lg bg-[#E31837] hover:bg-red-700 shadow-lg rounded-full"
               >
                 Start <ArrowRight className="w-5 h-5 ml-2" />
               </Button>
            </div>
         </div>

         <div className="w-full pb-4 text-center">
             <button 
                onClick={() => setMode(AppMode.ADMIN)}
                className="text-xs font-bold text-gray-300 hover:text-gray-500 transition-colors uppercase tracking-widest"
             >
                Staff Login
             </button>
         </div>
      </div>
    );
  };

  const renderLogin = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-gray-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Access</h2>
          <p className="text-gray-500 mt-1">Enter password to continue</p>
        </div>

        <div className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-gray-500 focus:ring-4 focus:ring-gray-100 outline-none transition-all"
            placeholder="Password"
            autoFocus
          />
          
          {authError && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Incorrect password
            </div>
          )}

          <div className="flex gap-2">
              <Button onClick={() => setMode(AppMode.SHOPPER_SETUP)} variant="secondary" className="flex-1 py-3">
                Cancel
              </Button>
              <Button onClick={handleLogin} className="flex-[2] py-3 bg-gray-900 hover:bg-black">
                Unlock
              </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderHome = () => null; // Deprecated view

  const renderAAWizard = () => {
      const WEEKDAYS = [
          { index: 1, name: 'Monday' }, { index: 2, name: 'Tuesday' }, { index: 3, name: 'Wednesday' },
          { index: 4, name: 'Thursday' }, { index: 5, name: 'Friday' }
      ];
      const WEEKENDS = [
          { index: 6, name: 'Saturday' }, { index: 0, name: 'Sunday' }
      ];
      
      const isComplete = aaSelection.weekday.dayIndex !== null && aaSelection.weekday.time !== null &&
                         aaSelection.weekend.dayIndex !== null && aaSelection.weekend.time !== null;

      // 1. Check if the entire DAY is valid (has at least one AA slot)
      const isDayValid = (dayIndex: number) => {
          if (!savedCloudTemplate || Object.keys(savedCloudTemplate).length === 0) return true; // Default open if no config
          const dayConfig = savedCloudTemplate[dayIndex];
          if (!dayConfig) return false; // Should exist if template is populated
          
          // Check if ANY shift in this day has 'Always Available'
          return SHIFT_TIMES.some(time => dayConfig[time]?.includes(ShiftType.AA));
      };

      // 2. Check if a specific TIME is valid for the selected day
      const isShiftValidForDay = (dayIndex: number | null, shift: ShiftTime) => {
          if (dayIndex === null) return false; // Can't pick time if no day selected
          if (!savedCloudTemplate || Object.keys(savedCloudTemplate).length === 0) return true;
          
          const dayConfig = savedCloudTemplate[dayIndex];
          if (!dayConfig) return false;

          const allowedTypes = dayConfig[shift];
          return allowedTypes?.includes(ShiftType.AA);
      };

      return (
          <div className="bg-gray-50 p-4 md:p-6">
              <div className="max-w-3xl mx-auto space-y-6">
                  {/* Instructions */}
                  <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex gap-3">
                      <div className="bg-white p-2 rounded-lg h-fit text-red-600 shadow-sm">
                          <CalendarRange className="w-5 h-5" />
                      </div>
                      <div>
                          <h3 className="font-bold text-red-800">Required: Pick your "Always Available" Shifts</h3>
                          <p className="text-sm text-red-600 mt-1">
                              You must select <strong>1 Weekday</strong> and <strong>1 Weekend day</strong> that you can guarantee every week.
                          </p>
                      </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                      {/* Weekday Selection */}
                      <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
                          <h4 className="font-bold text-gray-900 flex items-center gap-2">
                              <Sun className="w-5 h-5 text-orange-500" /> 1. Select a Weekday
                          </h4>
                          
                          <div className="grid grid-cols-2 gap-2">
                              {WEEKDAYS.map(d => {
                                  const enabled = isDayValid(d.index);
                                  return (
                                    <button
                                        key={d.index}
                                        disabled={!enabled}
                                        onClick={() => setAaSelection(prev => ({ 
                                            ...prev, 
                                            weekday: { dayIndex: d.index, time: null } // Reset time when day changes
                                        }))}
                                        className={`py-2 px-3 rounded-lg text-sm font-medium border-2 transition-all ${
                                            !enabled 
                                            ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed decoration-slice' 
                                            : aaSelection.weekday.dayIndex === d.index 
                                                ? 'border-purple-600 bg-purple-50 text-purple-700' 
                                                : 'border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {d.name} {!enabled && <Ban className="w-3 h-3 inline ml-1 opacity-50" />}
                                    </button>
                                  );
                              })}
                          </div>

                          <div className="space-y-2 pt-2 border-t">
                               <p className="text-xs font-bold text-gray-400 uppercase">Preferred Time</p>
                               <div className="grid grid-cols-1 gap-2">
                                  {SHIFT_TIMES.map(t => {
                                      const isEnabled = isShiftValidForDay(aaSelection.weekday.dayIndex, t);
                                      return (
                                          <button
                                              key={t}
                                              disabled={!isEnabled}
                                              onClick={() => setAaSelection(prev => ({ ...prev, weekday: { ...prev.weekday, time: t } }))}
                                              className={`py-2 px-3 rounded-lg text-sm text-left font-medium border-2 transition-all ${
                                                  !isEnabled 
                                                  ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed opacity-60'
                                                  : aaSelection.weekday.time === t
                                                      ? 'border-purple-600 bg-purple-50 text-purple-700'
                                                      : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                                              }`}
                                          >
                                              <div className="flex justify-between w-full items-center">
                                                  <span>{t.split('(')[0]} <span className="text-xs font-normal block">{t.match(/\((.*?)\)/)?.[1]}</span></span>
                                                  {!isEnabled && <Ban className="w-4 h-4 text-gray-300" />}
                                              </div>
                                          </button>
                                      );
                                  })}
                               </div>
                          </div>
                      </div>

                      {/* Weekend Selection */}
                      <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
                          <h4 className="font-bold text-gray-900 flex items-center gap-2">
                              <Star className="w-5 h-5 text-yellow-500" /> 2. Select a Weekend
                          </h4>
                          
                          <div className="grid grid-cols-2 gap-2">
                              {WEEKENDS.map(d => {
                                  const enabled = isDayValid(d.index);
                                  return (
                                    <button
                                        key={d.index}
                                        disabled={!enabled}
                                        onClick={() => setAaSelection(prev => ({ 
                                            ...prev, 
                                            weekend: { dayIndex: d.index, time: null } // Reset time when day changes
                                        }))}
                                        className={`py-2 px-3 rounded-lg text-sm font-medium border-2 transition-all ${
                                            !enabled 
                                            ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed decoration-slice' 
                                            : aaSelection.weekend.dayIndex === d.index 
                                                ? 'border-purple-600 bg-purple-50 text-purple-700' 
                                                : 'border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {d.name} {!enabled && <Ban className="w-3 h-3 inline ml-1 opacity-50" />}
                                    </button>
                                  );
                              })}
                          </div>

                          <div className="space-y-2 pt-2 border-t">
                               <p className="text-xs font-bold text-gray-400 uppercase">Preferred Time</p>
                               <div className="grid grid-cols-1 gap-2">
                                  {SHIFT_TIMES.map(t => {
                                      const isEnabled = isShiftValidForDay(aaSelection.weekend.dayIndex, t);
                                      return (
                                          <button
                                              key={t}
                                              disabled={!isEnabled}
                                              onClick={() => setAaSelection(prev => ({ ...prev, weekend: { ...prev.weekend, time: t } }))}
                                              className={`py-2 px-3 rounded-lg text-sm text-left font-medium border-2 transition-all ${
                                                  !isEnabled 
                                                  ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed opacity-60'
                                                  : aaSelection.weekend.time === t
                                                      ? 'border-purple-600 bg-purple-50 text-purple-700'
                                                      : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                                              }`}
                                          >
                                              <div className="flex justify-between w-full items-center">
                                                  <span>{t.split('(')[0]} <span className="text-xs font-normal block">{t.match(/\((.*?)\)/)?.[1]}</span></span>
                                                  {!isEnabled && <Ban className="w-4 h-4 text-gray-300" />}
                                              </div>
                                          </button>
                                      );
                                  })}
                               </div>
                          </div>
                      </div>
                  </div>
                  
                  <div className="pt-6">
                      <Button 
                          fullWidth 
                          onClick={handleAAWizardSubmit}
                          className="py-4 text-lg shadow-xl"
                      >
                          Confirm & Continue <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                      <p className="text-center text-xs text-gray-400 mt-2">
                          * Actual dates will be generated based on admin availability.
                      </p>
                  </div>
              </div>
          </div>
      );
  };

  const renderShopperFlow = () => {
    const currentName = shopperNames[currentShopperIndex];
    const isStepAA = shopperStep === ShopperStep.AA_SELECTION;
    const isStepFWD = shopperStep === ShopperStep.FWD_SELECTION;
    const isStepStd = shopperStep === ShopperStep.STANDARD_SELECTION;
    
    const currentShopperData = selections.find(s => s.name === currentName);
    const aaCount = currentShopperData?.shifts.filter(s => s.type === ShiftType.AA).length || 0;
    const stdCount = currentShopperData?.shifts.filter(s => s.type === ShiftType.STANDARD).length || 0;

    return (
      <div className="h-[100dvh] bg-gray-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white px-6 py-4 shadow-sm border-b sticky top-0 z-20 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5 text-gray-400" /> {currentName}
            </h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
               <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${isStepAA ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>
                 1. AA Shifts
               </span>
               <ChevronRight className="w-3 h-3" />
               <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${isStepFWD ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100'}`}>
                 2. Start Date
               </span>
               <ChevronRight className="w-3 h-3" />
               <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${isStepStd ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
                 3. Standard
               </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden md:flex gap-4 text-xs font-medium text-gray-500">
                <span>Selected AA: <strong className="text-red-600">{aaCount}</strong></span>
                <span>Selected Standard: <strong className="text-green-600">{stdCount}</strong></span>
             </div>
             {/* Hide Details button until later steps */}
             {isStepStd && (
                 <Button variant="outline" onClick={() => setShowDetailsModal(true)} className="text-sm">
                    Details
                 </Button>
             )}
          </div>
        </div>

        {/* Content - CONDITIONAL RENDERING */}
        <div ref={flowScrollContainerRef} className="flex-1 overflow-y-auto">
          {isStepAA && renderAAWizard()}
          
          {isStepFWD && (
              <div className="p-4 md:p-6">
                  <div className="max-w-5xl mx-auto mb-6">
                     <div className="p-4 rounded-xl border flex gap-4 bg-yellow-50 border-yellow-100">
                        <div className="p-2 rounded-lg h-fit bg-white text-yellow-600">
                           <PlayCircle className="w-5 h-5" />
                        </div>
                        <div>
                           <h3 className="font-bold text-yellow-800">
                              When is your First Day?
                           </h3>
                           <p className="text-sm mt-1 text-yellow-700">
                              Please select the exact day you will start working. 
                              <strong> Must be a Morning or Afternoon shift.</strong>
                           </p>
                        </div>
                     </div>
                  </div>
                  
                  <CalendarView 
                    mode="SHOPPER"
                    step={1}
                    isFWDSelection={true} // Special mode
                    adminAvailability={adminAvailability}
                    currentShopperShifts={currentShopperData?.shifts}
                    firstWorkingDay={currentShopperData?.details?.firstWorkingDay}
                    onShopperToggle={handleFWDSelection} // Specific handler
                  />
              </div>
          )}

          {isStepStd && (
              <div className="p-4 md:p-6">
                  <div className="max-w-5xl mx-auto mb-6">
                     <div className="p-4 rounded-xl border flex gap-4 bg-green-50 border-green-100 flex-col md:flex-row items-start md:items-center justify-between">
                        <div className="flex gap-4">
                            <div className="p-2 rounded-lg h-fit bg-white text-green-600">
                               <CheckCircle className="w-5 h-5" />
                            </div>
                            <div>
                               <h3 className="font-bold text-green-800">
                                  Select Standard Shifts
                               </h3>
                               <p className="text-sm mt-1 text-green-600">
                                  Select shifts for your first 2 weeks based on your start date.
                               </p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setShopperStep(ShopperStep.FWD_SELECTION)}
                            className="text-xs font-bold text-green-600 underline hover:text-green-800 mt-2 md:mt-0"
                        >
                            Change Start Date
                        </button>
                     </div>
                  </div>

                  <CalendarView 
                    mode="SHOPPER"
                    step={2}
                    adminAvailability={adminAvailability}
                    currentShopperShifts={currentShopperData?.shifts}
                    firstWorkingDay={currentShopperData?.details?.firstWorkingDay}
                    onShopperToggle={handleStandardShiftToggle} // Standard handler
                  />
              </div>
          )}
        </div>

        {/* Footer Actions */}
        {isStepStd && (
            <div className="bg-white p-4 border-t sticky bottom-0 z-20 pb-8 md:pb-4">
               <div className="max-w-5xl mx-auto flex justify-between items-center">
                  <Button 
                    variant="secondary" 
                    onClick={() => setShopperStep(ShopperStep.FWD_SELECTION)}
                  >
                     Back
                  </Button>
                  
                  <Button 
                     onClick={() => setShowDetailsModal(true)} 
                     className="px-8"
                  >
                     Review & Finish <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
               </div>
            </div>
        )}

        {/* MOBILE POPUP INSTRUCTION */}
        <MobileInstructionModal 
            isOpen={showMobileInstructions}
            onClose={() => setShowMobileInstructions(false)}
            step={shopperStep === ShopperStep.FWD_SELECTION ? 'FWD' : 'STANDARD'}
            title={shopperStep === ShopperStep.FWD_SELECTION ? 'When do you start?' : 'Select Your Shifts'}
            message={shopperStep === ShopperStep.FWD_SELECTION 
                ? "Please select the exact day you will have your first shift. It must be a Morning or Afternoon shift."
                : (<span>Please select your standard shifts for the <strong>first 2 working weeks</strong> starting from your selected First Day.</span>)
            }
        />
      </div>
    );
  };

  const renderSummary = () => {
    const shopper = selections[currentShopperIndex];
    if (!shopper) return null;

    let shifts = [...shopper.shifts];

    // Filter shifts to show only relevant range (FWD -> End of next week)
    // This prevents generating a huge list of AA shifts for future weeks in the recap
    if (shopper.details?.firstWorkingDay) {
        const fwdDate = getSafeDateFromKey(shopper.details.firstWorkingDay);
        // Limit: Sunday of the week following the FWD week
        const limitDate = endOfWeek(addWeeks(fwdDate, 1), { weekStartsOn: 1 });
        const limitKey = formatDateKey(limitDate);
        
        shifts = shifts.filter(s => s.date >= shopper.details!.firstWorkingDay! && s.date <= limitKey);
    }

    shifts.sort((a, b) => a.date.localeCompare(b.date));

    // Helper to get short time + hours for display
    // e.g., "Afternoon (14:55 - 00:00)" -> { name: "Afternoon", hours: "14:55 - 00:00" }
    const getShiftDetails = (t: string) => {
        const parts = t.match(/(.*?)\s\((.*?)\)/);
        if (parts) {
            return { name: parts[1], hours: parts[2] };
        }
        return { name: t.split(' ')[0], hours: '' };
    };

    return (
        <div className="h-[100dvh] bg-gray-50 flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col h-full max-h-[900px] border border-gray-100 overflow-hidden">
                
                {/* 1. Header (Updated with Screenshot Instruction) */}
                <div className="bg-gray-900 px-4 py-4 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                            <Camera className="w-6 h-6 text-yellow-400" />
                            Take a Screenshot!
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">Save your schedule now.</p>
                    </div>
                    {isSyncing ? <RefreshCw className="w-5 h-5 animate-spin text-gray-400" /> : 
                     syncStatus === 'success' ? <span className="text-xs bg-green-900/50 text-green-400 px-2 py-1 rounded font-bold border border-green-800">SAVED</span> : 
                     <span className="text-xs text-gray-400 font-mono bg-gray-800 px-2 py-1 rounded">{shifts.length} SHIFTS</span>}
                </div>

                {/* 2. Identity Section (Horizontal & Dense) */}
                <div className="bg-white p-3 border-b flex items-center justify-between gap-2 shrink-0">
                    <div className="flex flex-col min-w-0">
                        <h3 className="font-bold text-gray-900 truncate text-lg leading-tight">{shopper.name}</h3>
                        <div className="flex flex-wrap gap-1.5 mt-1 text-[10px] font-bold text-gray-600">
                             <span className="bg-gray-100 px-1.5 py-0.5 rounded flex items-center gap-1"><Shirt className="w-3 h-3" /> {shopper.details?.clothingSize} / {shopper.details?.shoeSize}</span>
                             <span className="bg-gray-100 px-1.5 py-0.5 rounded flex items-center gap-1"><Hand className="w-3 h-3" /> {shopper.details?.gloveSize}</span>
                             {shopper.details?.usePicnicBus && <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded flex items-center gap-1"><Bus className="w-3 h-3" /> Bus</span>}
                             {shopper.details?.isRandstad && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex items-center gap-1"><Building2 className="w-3 h-3" /> Randstad</span>}
                        </div>
                    </div>
                    <button onClick={() => setShowDetailsModal(true)} className="p-2 bg-gray-50 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-all shrink-0">
                         <Settings2 className="w-5 h-5" />
                    </button>
                </div>

                {/* 3. Shifts Grid (The core fix for no-scroll) */}
                <div className="flex-1 overflow-y-auto p-2 bg-gray-50/50">
                    {shifts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2 opacity-50">
                             <CalendarDays className="w-12 h-12" />
                             <p className="text-sm">No shifts selected</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {shifts.map((s, i) => {
                                const dateObj = new Date(s.date);
                                const isAA = s.type === ShiftType.AA;
                                const { name, hours } = getShiftDetails(s.time);
                                
                                return (
                                    <div key={i} className={`relative flex flex-col items-center justify-center p-2 rounded-xl border shadow-sm text-center transition-all ${
                                        isAA 
                                        ? 'bg-white border-red-200 shadow-red-100/50' 
                                        : 'bg-white border-green-200 shadow-green-100/50'
                                    }`}>
                                        {/* Status Line */}
                                        <div className={`absolute top-0 left-0 w-full h-1 rounded-t-xl ${isAA ? 'bg-red-500' : 'bg-green-500'}`} />
                                        
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-1">
                                            {format(dateObj, 'EEE')}
                                        </div>
                                        <div className="text-sm font-black text-gray-800 leading-none mb-1">
                                            {format(dateObj, 'd')}
                                        </div>
                                        
                                        {/* Shift Name */}
                                        <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full truncate max-w-full mb-0.5 ${
                                            isAA ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                                        }`}>
                                            {name}
                                        </div>

                                        {/* Hours Display */}
                                        <div className="text-[8px] font-medium text-gray-500">
                                            {hours}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 4. Footer Actions (Fixed) */}
                <div className="p-3 bg-white border-t shrink-0">
                    {syncStatus === 'success' ? (
                        <div className="space-y-2">
                            <div className="bg-green-50 text-green-800 p-2 rounded-lg text-center text-xs font-bold border border-green-100">
                                Selection Confirmed!
                            </div>
                            <Button onClick={handleClearSession} fullWidth className="py-3 text-sm">
                                Start New Session
                            </Button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                             <Button 
                                onClick={() => setMode(AppMode.SHOPPER_FLOW)} 
                                variant="secondary"
                                className="flex-1 py-3 text-sm"
                                disabled={isSyncing}
                             >
                                Back
                             </Button>
                             <Button 
                                onClick={handleSubmitData} 
                                disabled={isSyncing}
                                className="flex-[2] py-3 text-sm bg-gray-900 hover:bg-black shadow-lg"
                             >
                                {isSyncing ? 'Saving...' : 'Confirm'}
                             </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
  };

  const renderDetailsModal = () => {
    if (!showDetailsModal) return null;

    // Helper to calculate glove size live
    const updateClothing = (size: string) => {
        setTempDetails(prev => ({
            ...prev,
            clothingSize: size,
            gloveSize: calculateGloveSize(size)
        }));
    };

    return (
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10">
           <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800">Complete Profile</h3>
              <button onClick={() => setShowDetailsModal(false)} className="p-2 hover:bg-gray-200 rounded-full">
                  <X className="w-5 h-5 text-gray-500" />
              </button>
           </div>

           <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Bus */}
              <div className="space-y-3">
                 <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Bus className="w-4 h-4" /> Transport
                 </label>
                 <div className="grid grid-cols-2 gap-4">
                    <button 
                       onClick={() => setTempDetails(prev => ({ ...prev, usePicnicBus: true }))}
                       className={`p-4 rounded-xl border-2 transition-all text-sm font-bold ${
                           tempDetails.usePicnicBus ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                       }`}
                    >
                       I need the Picnic Bus
                    </button>
                    <button 
                       onClick={() => setTempDetails(prev => ({ ...prev, usePicnicBus: false }))}
                       className={`p-4 rounded-xl border-2 transition-all text-sm font-bold ${
                           !tempDetails.usePicnicBus ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                       }`}
                    >
                       I have my own transport
                    </button>
                 </div>
              </div>

              {/* Sizes */}
              <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                     <Shirt className="w-4 h-4" /> Sizes
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs text-gray-500 mb-1 block">Clothing Size</label>
                        <select 
                            value={tempDetails.clothingSize}
                            onChange={(e) => updateClothing(e.target.value)}
                            className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            {['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="text-xs text-gray-500 mb-1 block">Shoe Size</label>
                        <select 
                            value={tempDetails.shoeSize}
                            onChange={(e) => setTempDetails(prev => ({ ...prev, shoeSize: e.target.value }))}
                            className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            {Array.from({length: 15}, (_, i) => 35 + i).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                     </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center text-sm">
                      <span className="text-gray-500">Calculated Glove Size:</span>
                      <span className="font-bold text-gray-900">{tempDetails.gloveSize}</span>
                  </div>
              </div>

              {/* Civil Status */}
              <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                     <Heart className="w-4 h-4" /> Civil Status
                  </label>
                  <select 
                      value={tempDetails.civilStatus}
                      onChange={(e) => setTempDetails(prev => ({ ...prev, civilStatus: e.target.value }))}
                      className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                  >
                      <option value="Cohabit">Cohabit</option>
                      <option value="Divorced">Divorced</option>
                      <option value="Engaged">Engaged</option>
                      <option value="Legal separation">Legal separation</option>
                      <option value="Married">Married</option>
                      <option value="Registered partnership">Registered partnership</option>
                      <option value="Single">Single</option>
                      <option value="Unknown">Unknown</option>
                      <option value="Widowed">Widowed</option>
                  </select>
              </div>

              {/* Randstad */}
              <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center gap-3">
                      <input 
                         type="checkbox" 
                         id="randstad"
                         checked={tempDetails.isRandstad}
                         onChange={(e) => setTempDetails(prev => ({ ...prev, isRandstad: e.target.checked }))}
                         className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <label htmlFor="randstad" className="font-bold text-gray-800">
                         Registered via Randstad?
                      </label>
                  </div>
                  
                  {tempDetails.isRandstad && (
                      <div className="animate-in slide-in-from-top-2">
                          <label className="text-xs text-gray-500 mb-1 block">Home Address (Required for Taxi)</label>
                          <input 
                              value={tempDetails.address}
                              onChange={(e) => setTempDetails(prev => ({ ...prev, address: e.target.value }))}
                              placeholder="Street, Number, City"
                              className="w-full p-3 bg-white border-2 border-orange-100 rounded-xl outline-none focus:border-orange-500"
                          />
                      </div>
                  )}
              </div>
           </div>

           <div className="p-4 border-t bg-gray-50">
              <Button onClick={handleDetailsSubmit} fullWidth disabled={tempDetails.isRandstad && !tempDetails.address}>
                 Save Profile
              </Button>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="font-sans text-gray-900 selection:bg-purple-100 selection:text-purple-900">
        {mode === AppMode.SHOPPER_SETUP && renderShopperSetup()}
        
        {mode === AppMode.SHOPPER_FLOW && renderShopperFlow()}
        
        {mode === AppMode.SUMMARY && renderSummary()}
        
        {mode === AppMode.ADMIN && (!isAuthenticated ? renderLogin() : renderAdmin())}

        {/* Details Modal Overlay */}
        {renderDetailsModal()}
    </div>
  );
}

export default App;