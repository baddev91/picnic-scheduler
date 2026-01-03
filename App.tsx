import React, { useState, useEffect, useCallback } from 'react';
import { AppMode, ShiftTime, ShiftType, ShopperData, ShopperShift, AdminAvailabilityMap, ShopperDetails, WeeklyTemplate, ShopperStep, AdminWizardStep } from './types';
import { SHIFT_TIMES, formatDateKey, getShopperAllowedRange, getShopperMinDate } from './constants';
import { Button } from './components/Button';
import { CalendarView } from './components/CalendarView';
import { Users, Shield, Download, ArrowRight, UserPlus, CheckCircle, AlertCircle, Save, Trash2, History, XCircle, Lock, Bus, Heart, Shirt, Footprints, Hand, MapPin, Building2, Settings2, CalendarDays, Undo2, PlayCircle, Plus, Check, User, Ban, CloudUpload, Link, Share2, LogIn, RefreshCw, FileDown, Copy, CalendarRange, ChevronRight, ChevronLeft, Star, Table, Sun, Moon, Sunrise, Sunset, Coffee } from 'lucide-react';
import { isWeekend, startOfWeek, addDays, subDays, getDay, isSameDay, format, isWithinInterval, addWeeks, endOfWeek, nextMonday, startOfToday, isBefore, isAfter } from 'date-fns';
import { supabase } from './supabaseClient';
import { AdminDataView } from './components/AdminDataView';

const STORAGE_KEYS = {
  ADMIN: 'picnic_admin_availability',
  TEMPLATE: 'picnic_admin_template',
  SHOPPERS: 'picnic_shopper_names',
  SELECTIONS: 'picnic_selections',
  INDEX: 'picnic_current_index',
  MODE: 'picnic_app_mode',
  STEP: 'picnic_shopper_step',
  GOOGLE_URL: 'picnic_google_script_url',         // For POST (Writing selections)
  GOOGLE_CONFIG_URL: 'picnic_google_config_url'   // For GET (Reading availability)
};

function App() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(false);

  // App State
  const [mode, setMode] = useState<AppMode>(AppMode.HOME);
  
  // Admin Wizard State
  const [adminWizardStep, setAdminWizardStep] = useState<AdminWizardStep>(AdminWizardStep.DASHBOARD);
  const [wizardDayIndex, setWizardDayIndex] = useState<number>(1); // 1 = Monday
  const [tempTemplate, setTempTemplate] = useState<WeeklyTemplate>({});
  const [applyWeeks, setApplyWeeks] = useState<number>(4);

  // Shopper State
  const [shopperStep, setShopperStep] = useState<ShopperStep>(ShopperStep.AA_SELECTION);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [isSelfService, setIsSelfService] = useState(false);
  
  // Data State
  const [adminAvailability, setAdminAvailability] = useState<AdminAvailabilityMap>({});
  
  // Google Sheets Config
  const [googleSheetUrl, setGoogleSheetUrl] = useState(''); // POST URL
  const [googleConfigUrl, setGoogleConfigUrl] = useState(''); // GET URL
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isFetchingConfig, setIsFetchingConfig] = useState(false);

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
    civilStatus: 'Unmarried (Ongehuwd)',
    clothingSize: 'M',
    shoeSize: '40',
    gloveSize: '8 (M)',
    isRandstad: false,
    address: ''
  });
  
  const [tempNameInput, setTempNameInput] = useState('');

  // --------------------------------------------------------------------------
  // Configuration Fetching (GET)
  // --------------------------------------------------------------------------

  const fetchAvailabilityConfig = useCallback(async (url: string) => {
      if (!url) return;
      setIsFetchingConfig(true);
      try {
          const response = await fetch(url);
          const data = await response.json();
          
          if (data && typeof data === 'object' && !data.error) {
              const mappedAvailability: AdminAvailabilityMap = {};
              
              Object.keys(data).forEach(dateKey => {
                  mappedAvailability[dateKey] = {};
                  const sheetDayData = data[dateKey];
                  
                  Object.keys(sheetDayData).forEach(sheetShiftName => {
                      const matchedShift = SHIFT_TIMES.find(st => st.startsWith(sheetShiftName));
                      if (matchedShift) {
                          const types = Array.isArray(sheetDayData[sheetShiftName]) 
                             ? sheetDayData[sheetShiftName] 
                             : [sheetDayData[sheetShiftName]];
                             
                          mappedAvailability[dateKey][matchedShift] = types;
                      }
                  });
              });
              
              setAdminAvailability(mappedAvailability);
              localStorage.setItem(STORAGE_KEYS.ADMIN, JSON.stringify(mappedAvailability));
          }
      } catch (e) {
          console.error("Failed to fetch availability config", e);
      } finally {
          setIsFetchingConfig(false);
      }
  }, []);

  // --------------------------------------------------------------------------
  // Persistence & Initialization
  // --------------------------------------------------------------------------

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const magicConfig = params.get('cfg');
    const legacySheet = params.get('sheet');
    const urlMode = params.get('mode');
    
    let initialSheetUrl = '';
    let initialConfigUrl = '';
    let autoStartShopper = false;

    if (magicConfig) {
        try {
            const decoded = JSON.parse(atob(magicConfig));
            initialSheetUrl = decoded.out || '';
            initialConfigUrl = decoded.src || '';
            
            localStorage.setItem(STORAGE_KEYS.GOOGLE_URL, initialSheetUrl);
            localStorage.setItem(STORAGE_KEYS.GOOGLE_CONFIG_URL, initialConfigUrl);
            
            setGoogleSheetUrl(initialSheetUrl);
            setGoogleConfigUrl(initialConfigUrl);
        } catch(e) {}
    } else if (legacySheet) {
        try {
            const url = atob(legacySheet);
            initialSheetUrl = url;
            localStorage.setItem(STORAGE_KEYS.GOOGLE_URL, url);
            setGoogleSheetUrl(url);
        } catch(e) {}
    } else {
        initialSheetUrl = localStorage.getItem(STORAGE_KEYS.GOOGLE_URL) || '';
        initialConfigUrl = localStorage.getItem(STORAGE_KEYS.GOOGLE_CONFIG_URL) || '';
        setGoogleSheetUrl(initialSheetUrl);
        setGoogleConfigUrl(initialConfigUrl);
    }

    if (urlMode === 'shopper') {
      autoStartShopper = true;
      setIsSelfService(true);
      setIsAuthenticated(true); 
      setMode(AppMode.SHOPPER_SETUP);
      if (initialConfigUrl) fetchAvailabilityConfig(initialConfigUrl);
    }
    
    if (magicConfig || legacySheet || urlMode) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    try {
      const savedAdmin = JSON.parse(localStorage.getItem(STORAGE_KEYS.ADMIN) || '{}');
      if (Object.keys(savedAdmin).length > 0) setAdminAvailability(savedAdmin);

      const savedTemplate = JSON.parse(localStorage.getItem(STORAGE_KEYS.TEMPLATE) || '{}');
      if (Object.keys(savedTemplate).length > 0) setTempTemplate(savedTemplate);
    } catch (e) {
      console.error("Failed to load settings", e);
    }

    const hasShopperData = !!localStorage.getItem(STORAGE_KEYS.SHOPPERS);
    
    if (hasShopperData && !autoStartShopper) {
      setShowRestorePrompt(true);
    } else {
      setIsInitialized(true);
    }
  }, [fetchAvailabilityConfig]);

  useEffect(() => {
    if (!isInitialized) return;
    
    localStorage.setItem(STORAGE_KEYS.ADMIN, JSON.stringify(adminAvailability));
    localStorage.setItem(STORAGE_KEYS.TEMPLATE, JSON.stringify(tempTemplate));
    localStorage.setItem(STORAGE_KEYS.GOOGLE_URL, googleSheetUrl);
    localStorage.setItem(STORAGE_KEYS.GOOGLE_CONFIG_URL, googleConfigUrl);

    localStorage.setItem(STORAGE_KEYS.SHOPPERS, JSON.stringify(shopperNames));
    localStorage.setItem(STORAGE_KEYS.SELECTIONS, JSON.stringify(selections));
    localStorage.setItem(STORAGE_KEYS.INDEX, JSON.stringify(currentShopperIndex));
    
    if (mode === AppMode.SHOPPER_FLOW || mode === AppMode.SHOPPER_SETUP) {
       localStorage.setItem(STORAGE_KEYS.MODE, mode);
       localStorage.setItem(STORAGE_KEYS.STEP, JSON.stringify(shopperStep));
    }
  }, [adminAvailability, tempTemplate, googleSheetUrl, googleConfigUrl, shopperNames, selections, currentShopperIndex, mode, shopperStep, isInitialized]);

  // --------------------------------------------------------------------------
  // Core Logic
  // --------------------------------------------------------------------------

  const downloadCSV = () => {
    const staticHeaders = ['Name', 'First Working Day', 'Bus', 'Civil Status', 'Clothing', 'Shoe', 'Glove', 'Randstad', 'Address'];
    const shiftHeaders = Array.from({length: 12}, (_, i) => `Shift ${i+1}`);
    const headers = [...staticHeaders, ...shiftHeaders];
    
    const rows: string[] = [];
    
    selections.forEach(shopper => {
      const sortedShifts = [...shopper.shifts].sort((a, b) => a.date.localeCompare(b.date));
      const rowData = [
          shopper.name,
          shopper.details?.firstWorkingDay || 'Not Set',
          shopper.details?.usePicnicBus ? 'Yes' : 'No',
          shopper.details?.civilStatus || '',
          shopper.details?.clothingSize || '',
          shopper.details?.shoeSize || '',
          shopper.details?.gloveSize || '',
          shopper.details?.isRandstad ? 'Yes' : 'No',
          shopper.details?.address || ''
      ];

      for (let i = 0; i < 12; i++) {
        const s = sortedShifts[i];
        if (s) {
            const shortTime = s.time.split('(')[0].trim();
            rowData.push(`${s.date} | ${shortTime} | ${s.type}`);
        } else {
            rowData.push('');
        }
      }
      rows.push(rowData.map(f => `"${f}"`).join(','));
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `picnic_shifts_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSubmitData = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');

    try {
        // 1. Supabase Sync (Primary)
        for (const shopper of selections) {
            const { data: shopperData, error: shopperError } = await supabase
                .from('shoppers')
                .insert([{ 
                    name: shopper.name, 
                    details: shopper.details || {}
                }])
                .select()
                .single();
            
            if (shopperError) throw new Error(`DB Error: ${shopperError.message}`);
            
            const shopperId = shopperData.id;
            const shiftsPayload = shopper.shifts.map(s => ({
                shopper_id: shopperId,
                date: s.date,
                time: s.time,
                type: s.type
            }));
            
            if (shiftsPayload.length > 0) {
                const { error: shiftsError } = await supabase
                    .from('shifts')
                    .insert(shiftsPayload);
                if (shiftsError) throw new Error(`DB Error: ${shiftsError.message}`);
            }
        }

        // 2. Google Sheets Sync (Backup - Optional)
        if (googleSheetUrl) {
            const formattedData = selections.map(shopper => {
                const sortedShifts = [...shopper.shifts].sort((a, b) => a.date.localeCompare(b.date));
                const rowObj: any = {
                    name: shopper.name,
                    firstWorkingDay: shopper.details?.firstWorkingDay || 'Not Set',
                    bus: shopper.details?.usePicnicBus ? 'Yes' : 'No',
                    civilStatus: shopper.details?.civilStatus || '',
                    clothing: shopper.details?.clothingSize || '',
                    shoe: shopper.details?.shoeSize || '',
                    glove: shopper.details?.gloveSize || '',
                    randstad: shopper.details?.isRandstad ? 'Yes' : 'No',
                    address: shopper.details?.address || ''
                };
                for (let i = 0; i < 12; i++) {
                    const s = sortedShifts[i];
                    const key = `shift_${i+1}`;
                    rowObj[key] = s ? `${s.date} | ${s.time.split('(')[0].trim()} | ${s.type}` : '';
                }
                return rowObj;
            });

            await fetch(googleSheetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ data: formattedData }),
            });
        }

        setSyncStatus('success');
    } catch (error: any) {
        console.error("Sync error", error);
        setSyncStatus('error');
        alert(`Failed to save: ${error.message || 'Unknown error'}`);
    } finally {
        setIsSyncing(false);
    }
  };

  const handleRestoreSession = () => {
    try {
      const savedShoppers = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOPPERS) || '[]');
      const savedSelections = JSON.parse(localStorage.getItem(STORAGE_KEYS.SELECTIONS) || '[]');
      const savedIndex = JSON.parse(localStorage.getItem(STORAGE_KEYS.INDEX) || '0');
      const savedMode = localStorage.getItem(STORAGE_KEYS.MODE) as AppMode;
      const savedStep = Number(localStorage.getItem(STORAGE_KEYS.STEP) || 0);

      setShopperNames(savedShoppers);
      setSelections(savedSelections);
      setCurrentShopperIndex(savedIndex);
      
      if (savedMode === AppMode.SHOPPER_FLOW && savedShoppers.length > 0) {
        setMode(AppMode.SHOPPER_FLOW);
        setShopperStep(savedStep);
      } else if (savedMode === AppMode.SHOPPER_SETUP) {
        setMode(AppMode.SHOPPER_SETUP);
      } else {
        setMode(AppMode.HOME);
      }
    } catch (e) {
      handleClearSession();
    } finally {
      setShowRestorePrompt(false);
      setIsInitialized(true);
    }
  };

  const handleClearSession = () => {
    localStorage.removeItem(STORAGE_KEYS.SHOPPERS);
    localStorage.removeItem(STORAGE_KEYS.SELECTIONS);
    localStorage.removeItem(STORAGE_KEYS.INDEX);
    localStorage.removeItem(STORAGE_KEYS.MODE);
    localStorage.removeItem(STORAGE_KEYS.STEP);

    setShopperNames([]);
    setSelections([]);
    setCurrentShopperIndex(0);
    setShopperStep(ShopperStep.AA_SELECTION);
    
    if (isSelfService) {
        setMode(AppMode.SHOPPER_SETUP);
        if(googleConfigUrl) fetchAvailabilityConfig(googleConfigUrl);
    } else {
        setMode(AppMode.HOME);
    }
    
    setShowRestorePrompt(false);
    setIsInitialized(true);
  };

  // --------------------------------------------------------------------------
  // Admin Logic
  // --------------------------------------------------------------------------

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

  const toggleWizardTemplate = (shift: ShiftTime, type: ShiftType) => {
      setTempTemplate(prev => {
          const dayConfig = prev[wizardDayIndex] || {};
          const currentTypes = dayConfig[shift] || []; // If empty, means disabled
          
          let newTypes;
          if (currentTypes.includes(type)) {
              newTypes = currentTypes.filter(t => t !== type);
          } else {
              newTypes = [...currentTypes, type];
          }
          
          return {
              ...prev,
              [wizardDayIndex]: {
                  ...dayConfig,
                  [shift]: newTypes
              }
          };
      });
  };

  const copyPreviousDay = () => {
      if (wizardDayIndex === 1) return; // Can't copy on Monday
      const prevDayIndex = wizardDayIndex === 0 ? 6 : wizardDayIndex - 1; // Logic for Sun (0) coming after Sat (6)
      const prevConfig = tempTemplate[prevDayIndex];
      
      if (prevConfig) {
          setTempTemplate(prev => ({
              ...prev,
              [wizardDayIndex]: JSON.parse(JSON.stringify(prevConfig))
          }));
      }
  };

  const applyTemplate = () => {
      // Apply starting from NEXT Monday
      const startDate = nextMonday(new Date());
      const newAvailability = { ...adminAvailability };
      
      for (let i = 0; i < applyWeeks * 7; i++) {
         const currentLoopDate = addDays(startDate, i);
         const dateKey = formatDateKey(currentLoopDate);
         const dayOfWeek = getDay(currentLoopDate); 
         
         const templateDayConfig = tempTemplate[dayOfWeek];
         if (templateDayConfig) {
            newAvailability[dateKey] = templateDayConfig;
         }
      }
      setAdminAvailability(newAvailability);
      alert(`Schedule generated successfully for ${applyWeeks} weeks!`);
      setAdminWizardStep(AdminWizardStep.DASHBOARD);
  };

  const handleCopyMagicLink = () => {
      if (!googleSheetUrl) {
          alert("Please configure the OUTPUT URL first.");
          return;
      }
      const baseUrl = window.location.origin + window.location.pathname;
      const configPayload = JSON.stringify({
          out: googleSheetUrl,
          src: googleConfigUrl || googleSheetUrl
      });
      const encodedConfig = btoa(configPayload);
      const magicLink = `${baseUrl}?cfg=${encodedConfig}&mode=shopper`;
      navigator.clipboard.writeText(magicLink).then(() => {
          alert("Shopper Link Copied!\n\nThis link contains your configuration.");
      });
  };

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  const getSafeDateFromKey = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const calculateGloveSize = (clothingSize: string): string => {
    const map: Record<string, string> = {
      'XS': '6 (XS)', 'S': '7 (S)', 'M': '8 (M)', 'L': '9 (L)',
      'XL': '10 (XL)', 'XXL': '11 (XXL)', '3XL': '12 (3XL)', '4XL': '12 (4XL)'
    };
    return map[clothingSize] || '8 (M)';
  };

  const checkPatternAvailability = (dayIndex: number, time: ShiftTime): boolean => {
      const range = getShopperAllowedRange();
      let currentDate = range.start;
      
      while (currentDate <= range.end) {
          if (getDay(currentDate) === dayIndex) {
              const key = formatDateKey(currentDate);
              const dayConfig = adminAvailability[key];
              if (dayConfig && dayConfig[time] && !dayConfig[time].includes(ShiftType.AA)) return false;
          }
          currentDate = addDays(currentDate, 1);
      }
      return true;
  };

  const handleLogin = () => {
    if (password === '7709') {
      setIsAuthenticated(true);
      setAuthError(false);
    } else setAuthError(true);
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
    
    if (type === ShiftType.STANDARD) {
      if (isRestViolation(dateStr, shift, newShifts)) {
        alert("Rest Constraint Violation");
        return;
      }
      const existingIndex = newShifts.findIndex(s => s.date === dateStr && s.time === shift && s.type === ShiftType.STANDARD);
      if (existingIndex >= 0) newShifts.splice(existingIndex, 1);
      else {
         if (newShifts.some(s => s.date === dateStr && s.type === ShiftType.AA)) {
             alert("Already covered by AA");
             return;
         }
         newShifts.push({ date: dateStr, time: shift, type: ShiftType.STANDARD });
      }
    }
    updateShopperSelections(newShifts);
  };
  
  const updateShopperSelections = (newShifts: ShopperShift[]) => {
      const currentName = shopperNames[currentShopperIndex];
      const newSelections = [...selections];
      const idx = newSelections.findIndex(s => s.name === currentName);
      
      // Auto-calculate First Working Day based on selection logic
      const minDate = getShopperMinDate();
      
      // Default: Keep existing or use Min Date
      const existingDetails = idx >= 0 ? newSelections[idx].details || {} : { usePicnicBus: false, civilStatus: 'Unmarried (Ongehuwd)', clothingSize: 'M', shoeSize: '40', gloveSize: '8 (M)', isRandstad: false, address: '' };
      let finalFWD = existingDetails.firstWorkingDay || formatDateKey(minDate);

      // FORCE FWD to be the earliest shift selected
      if (newShifts.length > 0) {
          const sorted = [...newShifts].sort((a, b) => a.date.localeCompare(b.date));
          const earliestShiftDate = getSafeDateFromKey(sorted[0].date);
          
          // Ensure FWD is not before minDate
          if (isBefore(earliestShiftDate, minDate)) {
             finalFWD = formatDateKey(minDate);
          } else {
             finalFWD = sorted[0].date;
          }
      }

      const updatedDetails = { ...existingDetails, firstWorkingDay: finalFWD } as ShopperDetails;

      if (idx >= 0) newSelections[idx] = { ...newSelections[idx], shifts: newShifts, details: updatedDetails };
      else newSelections.push({ name: currentName, shifts: newShifts, details: updatedDetails });
      
      setSelections(newSelections);
  };
  
  const handleSetFirstWorkingDay = (dateStr: string) => {
      const selectedDate = getSafeDateFromKey(dateStr);
      const minDate = getShopperMinDate();
      
      if (isBefore(selectedDate, minDate)) {
         alert(`First working day must be after ${format(subDays(minDate, 1), 'MMM do')}.`);
         return;
      }

      const currentName = shopperNames[currentShopperIndex];
      const newSelections = [...selections];
      const idx = newSelections.findIndex(s => s.name === currentName);
      const details = idx >= 0 ? newSelections[idx].details || {} : { usePicnicBus: false, civilStatus: 'Unmarried (Ongehuwd)', clothingSize: 'M', shoeSize: '40', gloveSize: '8 (M)', isRandstad: false, address: '' };
      const newDetails = { ...details, firstWorkingDay: dateStr } as ShopperDetails;
      
      if (idx >= 0) newSelections[idx] = { ...newSelections[idx], details: newDetails };
      else newSelections.push({ name: currentName, shifts: [], details: newDetails });
      setSelections(newSelections);
  };

  const handleAAWizardSubmit = () => {
      const { weekday, weekend } = aaSelection;
      const range = getShopperAllowedRange();
      const newShifts: ShopperShift[] = [];
      let currentDate = range.start;
      const minDate = getShopperMinDate();
      
      while (currentDate <= range.end) {
          // SKIP if too soon
          if (isBefore(currentDate, minDate)) {
             currentDate = addDays(currentDate, 1);
             continue;
          }

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
      updateShopperSelections(newShifts);
      setShopperStep(ShopperStep.STANDARD_SELECTION);
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
  // Admin Renderers
  // --------------------------------------------------------------------------

  const renderAdminDashboard = () => (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
             <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-purple-100 rounded-xl text-purple-600">
                    <Settings2 className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">System Configuration</h2>
                    <p className="text-gray-500 text-sm">Connect your Google Sheet to sync data.</p>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                        <CloudUpload className="w-3 h-3" /> Output URL (Write)
                    </label>
                    <input 
                        value={googleSheetUrl} 
                        onChange={e => setGoogleSheetUrl(e.target.value)} 
                        className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        placeholder="Apps Script URL..."
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                        <FileDown className="w-3 h-3" /> Source URL (Read)
                    </label>
                    <div className="flex gap-2">
                        <input 
                            value={googleConfigUrl} 
                            onChange={e => setGoogleConfigUrl(e.target.value)} 
                            className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder="Apps Script URL..."
                        />
                        {googleConfigUrl && (
                             <button onClick={() => fetchAvailabilityConfig(googleConfigUrl)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600">
                                 <RefreshCw className={`w-4 h-4 ${isFetchingConfig ? 'animate-spin' : ''}`} />
                             </button>
                        )}
                    </div>
                </div>
             </div>
             {googleSheetUrl && (
                 <div className="mt-4 pt-4 border-t flex justify-end">
                     <Button onClick={handleCopyMagicLink} variant="outline" className="text-sm">
                         <Share2 className="w-4 h-4 mr-2" /> Copy Shopper Link
                     </Button>
                 </div>
             )}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <button 
                onClick={() => {
                    // Reset template to empty defaults
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
                    setWizardDayIndex(1); // Mon
                    setAdminWizardStep(AdminWizardStep.WIZARD_DAYS);
                }}
                className="group p-6 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl shadow-lg text-left hover:scale-[1.02] transition-all relative overflow-hidden"
              >
                  <div className="relative z-10">
                      <CalendarRange className="w-10 h-10 text-white mb-4 opacity-90" />
                      <h3 className="text-2xl font-bold text-white mb-2">Create Weekly Schedule</h3>
                      <p className="text-purple-100 text-sm">Guided wizard to set AA & Standard slots for each day of the week.</p>
                  </div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl"></div>
              </button>

              <button 
                onClick={() => setAdminWizardStep(AdminWizardStep.CALENDAR_EDIT)}
                className="group p-6 bg-white border-2 border-gray-100 rounded-2xl shadow-sm text-left hover:border-orange-200 hover:bg-orange-50 transition-all"
              >
                  <CalendarDays className="w-10 h-10 text-orange-500 mb-4" />
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Manual Calendar Edit</h3>
                  <p className="text-gray-500 text-sm">Fine-tune specific dates or handle holidays manually.</p>
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
                      {wizardDayIndex !== 1 && (
                          <button onClick={copyPreviousDay} className="flex items-center gap-2 text-sm font-bold text-purple-600 bg-white px-3 py-2 rounded-lg shadow-sm hover:bg-purple-50 transition-all">
                              <Copy className="w-4 h-4" /> Copy Previous Day
                          </button>
                      )}
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
                    {adminWizardStep === AdminWizardStep.CALENDAR_EDIT ? 'Manual Mode' : 
                     adminWizardStep === AdminWizardStep.VIEW_SUBMISSIONS ? 'Data Viewer' : 'Wizard Mode'}
                  </span>
              </div>
          </div>
          <div className="flex gap-2">
              {adminWizardStep !== AdminWizardStep.DASHBOARD && (
                  <Button variant="secondary" onClick={() => setAdminWizardStep(AdminWizardStep.DASHBOARD)} className="text-sm">
                      Exit
                  </Button>
              )}
              <Button onClick={() => setMode(AppMode.HOME)} className="bg-gray-800 text-white hover:bg-gray-900 text-sm">
                  Log Out
              </Button>
          </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
          {adminWizardStep === AdminWizardStep.DASHBOARD && renderAdminDashboard()}
          {adminWizardStep === AdminWizardStep.WIZARD_DAYS && renderAdminWizardDays()}
          {adminWizardStep === AdminWizardStep.WIZARD_APPLY && renderAdminWizardApply()}
          
          {adminWizardStep === AdminWizardStep.CALENDAR_EDIT && (
              <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in">
                  <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex gap-3 text-orange-800 text-sm">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <p>Manual Mode: Click on specific days to override the generated pattern.</p>
                  </div>
                  <CalendarView 
                      mode="ADMIN" 
                      adminAvailability={adminAvailability}
                      onAdminToggle={handleAdminToggle}
                  />
              </div>
          )}

          {adminWizardStep === AdminWizardStep.VIEW_SUBMISSIONS && <AdminDataView />}
      </div>
    </div>
  );

  const renderShopperSetup = () => {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4 md:p-6">
         <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col animate-in zoom-in duration-300">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-8 text-center text-white">
               <div className="mx-auto w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4">
                  <UserPlus className="w-8 h-8 text-white" />
               </div>
               <h2 className="text-2xl font-bold">Welcome!</h2>
               <p className="text-green-50 mt-1">Picnic Shift Scheduler</p>
            </div>
            
            <div className="p-8 space-y-6">
               <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Your Full Name</label>
                  <input 
                    value={tempNameInput}
                    onChange={(e) => setTempNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tempNameInput.trim()) {
                        setShopperNames([tempNameInput.trim()]);
                        setMode(AppMode.SHOPPER_FLOW);
                        setShopperStep(ShopperStep.AA_SELECTION);
                      }
                    }}
                    placeholder="e.g. John Doe"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg outline-none focus:border-green-500 focus:ring-4 focus:ring-green-50 transition-all"
                  />
               </div>

               <Button 
                 disabled={!tempNameInput.trim()} 
                 onClick={() => {
                   // Calculate STRICT First Working Day (Today + 3 days)
                   const minDate = getShopperMinDate();
                   const calculatedFWD = formatDateKey(minDate);
                   
                   // Initialize Shopper Data immediately with auto-calculated First Working Day
                   const newShopper: ShopperData = {
                       name: tempNameInput.trim(),
                       shifts: [],
                       details: { ...tempDetails, firstWorkingDay: calculatedFWD }
                   };
                   
                   setSelections([newShopper]);
                   setShopperNames([tempNameInput.trim()]);
                   setMode(AppMode.SHOPPER_FLOW);
                   setShopperStep(ShopperStep.AA_SELECTION);
                 }}
                 fullWidth
                 className="py-4 text-lg shadow-lg"
               >
                 Start Scheduling <ArrowRight className="w-5 h-5 ml-2" />
               </Button>
               
               {isFetchingConfig && (
                   <div className="text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                       <RefreshCw className="w-3 h-3 animate-spin" /> Updating availability...
                   </div>
               )}
            </div>
            
            {!isSelfService && (
                <div className="p-4 bg-gray-50 border-t text-center">
                    <button onClick={() => setMode(AppMode.HOME)} className="text-sm text-gray-500 hover:text-gray-800">
                        Back to Admin Menu
                    </button>
                </div>
            )}
            
            {isSelfService && (
                <div className="pb-4 text-center">
                     <button onClick={() => {
                         setIsAuthenticated(false);
                         setIsSelfService(false);
                         setMode(AppMode.HOME);
                     }} className="text-xs text-gray-300 hover:text-gray-400 flex items-center justify-center gap-1 mx-auto">
                        <LogIn className="w-3 h-3" /> Admin Login
                     </button>
                </div>
            )}
         </div>
      </div>
    );
  };

  const renderDetailsModal = () => {
    if (!showDetailsModal) return null;
    
    // Auto-calculate glove size based on clothing size if not manually set
    const handleClothingChange = (size: string) => {
        setTempDetails(prev => ({
            ...prev,
            clothingSize: size,
            gloveSize: calculateGloveSize(size)
        }));
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
         <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 md:p-6 border-b bg-green-50 flex justify-between items-center">
               <div>
                  <h3 className="text-lg md:text-xl font-bold text-green-900">Shopper Details</h3>
                  <p className="text-green-700 text-sm">Finalize info for {shopperNames[currentShopperIndex]}</p>
               </div>
               <button onClick={() => setShowDetailsModal(false)} className="p-2 hover:bg-green-100 rounded-full text-green-800 transition-colors">
                 <XCircle className="w-6 h-6" />
               </button>
            </div>

            <div className="p-4 md:p-8 overflow-y-auto space-y-4 md:space-y-6">
               {/* Transport */}
               <div className="space-y-2 md:space-y-3">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 uppercase tracking-wide">
                     <Bus className="w-4 h-4" /> Transport
                  </label>
                  <label className="flex items-center gap-3 p-3 md:p-4 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                     <div className={`w-5 h-5 rounded border flex items-center justify-center ${tempDetails.usePicnicBus ? 'bg-green-500 border-green-500' : 'border-gray-300 bg-white'}`}>
                        {tempDetails.usePicnicBus && <Check className="w-3 h-3 text-white" />}
                     </div>
                     <input 
                       type="checkbox" 
                       className="hidden" 
                       checked={tempDetails.usePicnicBus}
                       onChange={(e) => setTempDetails({...tempDetails, usePicnicBus: e.target.checked})}
                     />
                     <span className="font-medium text-gray-800">Use Picnic Bus Service</span>
                  </label>
               </div>

               {/* Personal Info Grid */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-2">
                     <label className="flex items-center gap-2 text-sm font-bold text-gray-700 uppercase">
                        <Heart className="w-4 h-4" /> Civil Status (Dutch)
                     </label>
                     <select 
                       value={tempDetails.civilStatus}
                       onChange={(e) => setTempDetails({...tempDetails, civilStatus: e.target.value})}
                       className="w-full border rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-green-500"
                     >
                       <option value="Unmarried (Ongehuwd)">Unmarried (Ongehuwd)</option>
                       <option value="Married (Gehuwd)">Married (Gehuwd)</option>
                       <option value="Registered Partnership (Geregistreerd partnerschap)">Registered Partnership (Geregistreerd partnerschap)</option>
                       <option value="Divorced (Gescheiden)">Divorced (Gescheiden)</option>
                       <option value="Widowed (Weduwe/Weduwnaar)">Widowed (Weduwe/Weduwnaar)</option>
                     </select>
                  </div>

                  <div className="space-y-2">
                     <label className="flex items-center gap-2 text-sm font-bold text-gray-700 uppercase">
                        <Building2 className="w-4 h-4" /> Agency
                     </label>
                     <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer">
                        <input 
                           type="checkbox" 
                           checked={tempDetails.isRandstad}
                           onChange={(e) => setTempDetails({...tempDetails, isRandstad: e.target.checked})}
                           className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                        />
                        <span className="font-medium text-gray-800">Is Randstad?</span>
                     </label>
                  </div>
               </div>

               {/* Sizes */}
               <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 uppercase border-b pb-2">Equipment Sizes</h4>
                  <div className="grid grid-cols-3 gap-3 md:gap-4">
                      <div>
                         <label className="text-[10px] md:text-xs text-gray-500 mb-1 block flex items-center gap-1"><Shirt className="w-3 h-3"/> Clothing</label>
                         <select 
                            value={tempDetails.clothingSize}
                            onChange={(e) => handleClothingChange(e.target.value)}
                            className="w-full border rounded-lg px-2 py-2 text-sm"
                         >
                            {['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'].map(s => <option key={s} value={s}>{s}</option>)}
                         </select>
                      </div>
                      <div>
                         <label className="text-[10px] md:text-xs text-gray-500 mb-1 block flex items-center gap-1"><Footprints className="w-3 h-3"/> Shoes</label>
                         <select 
                            value={tempDetails.shoeSize}
                            onChange={(e) => setTempDetails({...tempDetails, shoeSize: e.target.value})}
                            className="w-full border rounded-lg px-2 py-2 text-sm"
                         >
                            {Array.from({length: 15}, (_, i) => 35 + i).map(s => <option key={s} value={s.toString()}>{s}</option>)}
                         </select>
                      </div>
                      <div>
                         <label className="text-[10px] md:text-xs text-gray-500 mb-1 block flex items-center gap-1"><Hand className="w-3 h-3"/> Gloves</label>
                         <input 
                            value={tempDetails.gloveSize}
                            readOnly
                            className="w-full border rounded-lg px-2 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                         />
                      </div>
                  </div>
               </div>

               {/* Address (Conditional) */}
               {tempDetails.isRandstad && (
                   <div className="space-y-2 animate-in slide-in-from-top-2">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 uppercase">
                         <MapPin className="w-4 h-4" /> Full Address
                      </label>
                      <textarea 
                         value={tempDetails.address}
                         onChange={(e) => setTempDetails({...tempDetails, address: e.target.value})}
                         placeholder="Street, Number, Postcode, City"
                         className="w-full border rounded-xl px-4 py-3 min-h-[80px] outline-none focus:ring-2 focus:ring-green-500"
                      />
                   </div>
               )}

            </div>

            <div className="p-4 md:p-6 border-t bg-gray-50 flex justify-end gap-3">
               <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>Cancel</Button>
               <Button onClick={handleDetailsSubmit} disabled={tempDetails.isRandstad && !tempDetails.address?.trim()}>
                  Save & Continue
               </Button>
            </div>
         </div>
      </div>
    );
  };

  const renderSummary = () => {
    const currentShopperName = shopperNames[currentShopperIndex];
    // Fallback if data is missing, though flow guarantees it exists
    const shopperData = selections.find(s => s.name === currentShopperName) || { 
        name: currentShopperName, 
        shifts: [], 
        details: { 
            usePicnicBus: false, 
            civilStatus: '-', 
            clothingSize: '-', 
            shoeSize: '-', 
            gloveSize: '-', 
            isRandstad: false,
            address: ''
        } 
    };

    const details = shopperData.details || {};
    const sortedShifts = [...shopperData.shifts].sort((a, b) => a.date.localeCompare(b.date));

    return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
       
       <div className="mb-4 text-center">
          <h2 className="text-xl font-bold text-gray-800">Registration Complete!</h2>
          <p className="text-sm text-gray-500">Please take a screenshot of this ticket.</p>
       </div>

       {/* THE TICKET / RECEIPT CARD */}
       <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200 relative">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-700 p-6 text-white relative overflow-hidden">
             <div className="relative z-10">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-green-100 text-xs font-bold uppercase tracking-wider mb-1">Shopper Name</p>
                        <h1 className="text-2xl font-extrabold truncate pr-2">{shopperData.name}</h1>
                    </div>
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-white" />
                    </div>
                </div>
                
                <div className="mt-6 p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20 flex items-center gap-3">
                    <div className="bg-white text-green-700 p-2 rounded-lg">
                        <Star className="w-5 h-5 fill-current" />
                    </div>
                    <div>
                        <p className="text-[10px] text-green-100 uppercase font-bold">First Working Day</p>
                        <p className="text-lg font-bold">
                            {details.firstWorkingDay ? format(getSafeDateFromKey(details.firstWorkingDay), 'EEEE, MMM do') : 'Not Set'}
                        </p>
                    </div>
                </div>
             </div>
             
             {/* Decorative circles */}
             <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
             <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          </div>

          {/* Details Grid */}
          <div className="p-5 bg-gray-50 border-b border-dashed border-gray-300 grid grid-cols-3 gap-2 text-center">
             <div className="bg-white p-2 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-1">
                <Shirt className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-bold text-gray-700">{details.clothingSize}</span>
                <span className="text-[9px] text-gray-400 uppercase">Size</span>
             </div>
             <div className="bg-white p-2 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-1">
                <Footprints className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-bold text-gray-700">{details.shoeSize}</span>
                <span className="text-[9px] text-gray-400 uppercase">Shoe</span>
             </div>
             <div className="bg-white p-2 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-1">
                <Bus className={`w-4 h-4 ${details.usePicnicBus ? 'text-green-500' : 'text-gray-400'}`} />
                <span className="text-xs font-bold text-gray-700">{details.usePicnicBus ? 'Yes' : 'No'}</span>
                <span className="text-[9px] text-gray-400 uppercase">Bus</span>
             </div>
          </div>

          {/* Shifts List */}
          <div className="p-5 bg-white">
             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CalendarDays className="w-4 h-4" /> Selected Shifts
             </h3>
             
             <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {sortedShifts.length === 0 ? (
                    <div className="text-center py-4 text-gray-400 text-sm italic">No shifts selected</div>
                ) : (
                    sortedShifts.map((shift, idx) => {
                        const dateObj = getSafeDateFromKey(shift.date);
                        const isAA = shift.type === ShiftType.AA;
                        return (
                            <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`w-1.5 h-8 rounded-full ${isAA ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">{format(dateObj, 'EEE, MMM do')}</p>
                                        <p className="text-[10px] text-gray-500 font-medium">{shift.time.split('(')[0].trim()}</p>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                                    isAA ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                }`}>
                                    {isAA ? 'AA' : 'Std'}
                                </span>
                            </div>
                        );
                    })
                )}
             </div>
          </div>

          {/* Footer Receipt Cut */}
          <div className="relative h-4 bg-gray-100">
             <div className="absolute -top-2 left-0 w-full h-4 bg-white" 
                  style={{clipPath: 'polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 0%, 85% 100%, 90% 0%, 95% 100%, 100% 0%)'}}>
             </div>
          </div>
       </div>

       {/* Actions */}
       <div className="mt-6 flex flex-col w-full max-w-sm gap-3">
          <Button 
            onClick={handleSubmitData} 
            disabled={isSyncing || syncStatus === 'success'}
            className={`flex items-center justify-center gap-2 text-white py-3 shadow-lg rounded-xl font-bold ${
                syncStatus === 'success' ? 'bg-green-600' : 
                syncStatus === 'error' ? 'bg-red-600' : 'bg-gray-900 hover:bg-black'
            }`}
            fullWidth
          >
            {isSyncing ? 'Saving...' : syncStatus === 'success' ? 'Saved!' : 'Submit Schedule'}
          </Button>

          <div className="grid grid-cols-2 gap-3">
              {!isSelfService && (
                <Button onClick={downloadCSV} variant="secondary" className="text-xs">
                   <Download className="w-3 h-3 mr-1 inline" /> CSV
                </Button>
              )}
              
              <Button onClick={handleClearSession} variant="secondary" className={`text-xs ${isSelfService ? 'col-span-2' : ''}`}>
                 {isSelfService ? 'Exit / New User' : 'New Session'}
              </Button>
          </div>
       </div>
    </div>
  );
  };

  const renderLogin = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center space-y-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Access</h2>
          <p className="text-gray-500 text-sm mt-1">Please enter the access code.</p>
        </div>
        <div className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-green-500 text-center text-lg tracking-widest"
            placeholder="••••"
            autoFocus
          />
          {authError && <p className="text-red-500 text-sm font-medium animate-pulse">Incorrect access code</p>}
          <Button onClick={handleLogin} fullWidth className="shadow-lg">
            Unlock
          </Button>
        </div>
      </div>
    </div>
  );

  const renderRestorePrompt = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center space-y-6 animate-in zoom-in-95">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
          <History className="w-8 h-8 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Previous Session Found</h2>
          <p className="text-gray-500 text-sm mt-1">Would you like to continue where you left off?</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Button variant="secondary" onClick={handleClearSession}>
            Start New
          </Button>
          <Button onClick={handleRestoreSession}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );

  const renderHome = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8">
        
        {/* Admin Card */}
        <button 
          onClick={() => setMode(AppMode.ADMIN)}
          className="group bg-white p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all text-left border border-gray-100 relative overflow-hidden"
        >
          <div className="relative z-10 space-y-4">
            <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Shield className="w-7 h-7 text-orange-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Admin Panel</h2>
              <p className="text-gray-500 mt-2">Configure availability patterns, manage settings, and generate schedules.</p>
            </div>
            <div className="flex items-center text-orange-600 font-bold mt-4">
              Enter Dashboard <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-orange-100 transition-colors"></div>
        </button>

        {/* Shopper Card */}
        <button 
          onClick={() => setMode(AppMode.SHOPPER_SETUP)}
          className="group bg-gradient-to-br from-green-600 to-emerald-700 p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all text-left relative overflow-hidden"
        >
          <div className="relative z-10 space-y-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <UserPlus className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Shopper Flow</h2>
              <p className="text-green-100 mt-2">Start the registration process for new shoppers (Kiosk Mode).</p>
            </div>
            <div className="flex items-center text-white font-bold mt-4">
              Start Session <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl"></div>
        </button>

      </div>
      
      <div className="mt-12 text-center">
         <p className="text-sm text-gray-400 font-medium">Picnic Shift Scheduler v2.0</p>
      </div>
    </div>
  );

  const renderAAWizardStep = () => {
    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-300">
         <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-sm mb-6">
            <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                    <CalendarRange className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Weekly Availability Pattern</h3>
                    <p className="text-sm text-gray-500">Please select exactly <strong className="text-purple-600">1 Weekday</strong> and <strong className="text-purple-600">1 Weekend Day</strong>.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Weekday Selection */}
                <div className="p-4 rounded-xl border-2 border-gray-100 hover:border-purple-200 transition-all bg-gray-50">
                    <h4 className="text-sm font-bold text-gray-700 uppercase mb-3 flex items-center gap-2">
                        <Sun className="w-4 h-4 text-orange-500" /> Weekday Preference
                    </h4>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1 block">Day</label>
                            <select 
                                className="w-full p-2 rounded-lg border outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                                value={aaSelection.weekday.dayIndex ?? ""}
                                onChange={(e) => setAaSelection(prev => ({...prev, weekday: { ...prev.weekday, dayIndex: Number(e.target.value) }}))}
                            >
                                <option value="">Select Day...</option>
                                {[1,2,3,4,5].map(d => <option key={d} value={d}>{format(new Date(2024, 0, d), 'EEEE')}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1 block">Shift</label>
                            <select 
                                className="w-full p-2 rounded-lg border outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                                value={aaSelection.weekday.time ?? ""}
                                onChange={(e) => setAaSelection(prev => ({...prev, weekday: { ...prev.weekday, time: e.target.value as ShiftTime }}))}
                            >
                                <option value="">Select Shift...</option>
                                {SHIFT_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Weekend Selection */}
                <div className="p-4 rounded-xl border-2 border-gray-100 hover:border-purple-200 transition-all bg-gray-50">
                    <h4 className="text-sm font-bold text-gray-700 uppercase mb-3 flex items-center gap-2">
                        <Coffee className="w-4 h-4 text-red-500" /> Weekend Preference
                    </h4>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1 block">Day</label>
                            <select 
                                className="w-full p-2 rounded-lg border outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                                value={aaSelection.weekend.dayIndex ?? ""}
                                onChange={(e) => setAaSelection(prev => ({...prev, weekend: { ...prev.weekend, dayIndex: Number(e.target.value) }}))}
                            >
                                <option value="">Select Day...</option>
                                {[6,0].map(d => <option key={d} value={d}>{d === 0 ? 'Sunday' : 'Saturday'}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1 block">Shift</label>
                            <select 
                                className="w-full p-2 rounded-lg border outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                                value={aaSelection.weekend.time ?? ""}
                                onChange={(e) => setAaSelection(prev => ({...prev, weekend: { ...prev.weekend, time: e.target.value as ShiftTime }}))}
                            >
                                <option value="">Select Shift...</option>
                                {SHIFT_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 flex justify-end items-center gap-4 border-t pt-6">
                <div className="text-sm text-gray-500">
                    {(aaSelection.weekday.dayIndex !== null && aaSelection.weekday.time && aaSelection.weekend.dayIndex !== null && aaSelection.weekend.time) 
                        ? <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle className="w-4 h-4"/> Ready to apply</span> 
                        : "Select 1 Weekday & 1 Weekend option to continue"}
                </div>
                <button 
                    onClick={handleAAWizardSubmit}
                    disabled={!(aaSelection.weekday.dayIndex !== null && aaSelection.weekday.time && aaSelection.weekend.dayIndex !== null && aaSelection.weekend.time)}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-transform active:scale-95 flex items-center gap-2"
                >
                    Apply Pattern <ArrowRight className="w-5 h-5" />
                </button>
            </div>
         </div>
      </div>
    );
  };

  const renderShopperFlow = () => {
    const currentName = shopperNames[currentShopperIndex];
    const currentData = selections.find(s => s.name === currentName);
    const currentShifts = currentData ? currentData.shifts : [];
    
    const steps = ['AA Pattern', 'Extra Shifts', 'Details'];
    const progress = ((shopperStep + 1) / 3) * 100;

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header with Progress */}
        <div className="bg-white border-b sticky top-0 z-30 px-4 md:px-8 py-4 shadow-sm">
           <div className="max-w-5xl mx-auto">
              <div className="flex justify-between items-center mb-4">
                 <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {shopperStep === ShopperStep.AA_SELECTION ? 'Step 1: Set Weekly AA' : 'Step 2: Add Extra Shifts'}
                    </h2>
                    <p className="text-sm text-gray-500">Shopper: <span className="font-bold text-purple-600">{currentName}</span></p>
                 </div>
                 <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => {
                        if (shopperStep === ShopperStep.STANDARD_SELECTION) setShopperStep(ShopperStep.AA_SELECTION);
                        else setMode(AppMode.SHOPPER_SETUP);
                    }} className="text-sm">
                      <Undo2 className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Back</span>
                    </Button>
                    
                    {shopperStep === ShopperStep.STANDARD_SELECTION && (
                        <Button onClick={handleNextShopperClick} className="text-sm shadow-md bg-green-600 hover:bg-green-700">
                          Finish & Details <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    )}
                 </div>
              </div>
              
              {/* Progress Bar */}
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                 <div className="h-full bg-gradient-to-r from-purple-500 to-green-500 transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
           </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
           <div className="max-w-5xl mx-auto space-y-6">
              
              {/* Instructions Banner */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 text-blue-800 rounded-xl text-sm border border-blue-100">
                 <div className="p-1 bg-blue-100 rounded-full mt-0.5"><CheckCircle className="w-3 h-3" /></div>
                 <div>
                    <p className="font-bold">{shopperStep === ShopperStep.AA_SELECTION ? 'Select your recurring AA shifts' : 'Review and add extra days'}</p>
                    <p className="opacity-80 mt-1">
                        {shopperStep === ShopperStep.AA_SELECTION 
                          ? "You must select exactly one weekday (Mon-Fri) and one weekend day (Sat-Sun) to be Always Available." 
                          : "Your AA shifts are set. Now, tap any open date below if you want to add extra 'Standard' shifts."}
                    </p>
                 </div>
              </div>

              {/* STEP 0: NEW AA WIZARD (No Calendar) */}
              {shopperStep === ShopperStep.AA_SELECTION && renderAAWizardStep()}

              {/* STEP 1: CALENDAR (For Standard Shifts) */}
              {shopperStep === ShopperStep.STANDARD_SELECTION && (
                 <CalendarView 
                    mode="SHOPPER" 
                    step={shopperStep}
                    adminAvailability={adminAvailability}
                    currentShopperShifts={currentShifts}
                    firstWorkingDay={currentData?.details?.firstWorkingDay}
                    onShopperToggle={handleShopperToggle}
                    onSetFirstWorkingDay={handleSetFirstWorkingDay}
                 />
              )}
           </div>
        </div>
      </div>
    );
  };

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