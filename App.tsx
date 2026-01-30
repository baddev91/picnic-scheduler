
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppMode, ShiftTime, ShiftType, AdminAvailabilityMap, WeeklyTemplate, AdminWizardStep, BusConfig, StaffMember } from './types';
import { SHIFT_TIMES, formatDateKey, DEFAULT_BUS_CONFIG } from './constants';
import { Button } from './components/Button';
import { Shield, RefreshCw, UserCheck, Heart, Sparkles } from 'lucide-react';
import { addDays, getDay, addWeeks } from 'date-fns';
import startOfWeek from 'date-fns/startOfWeek';
import { supabase } from './supabaseClient';
import { AdminDataView } from './components/AdminDataView';

// Imported Components
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminWizardDays, AdminWizardApply } from './components/AdminWizard';
import { ShopperSetup } from './components/ShopperSetup';
import { AdminBusConfig } from './components/AdminBusConfig';
import { ShopperApp } from './components/ShopperApp';
import { AdminAuditLog } from './components/AdminAuditLog';
import { AccessLogViewer } from './components/AccessLogViewer'; // NEW
import { FrozenList } from './components/FrozenList';
import { CalendarView } from './components/CalendarView'; // NEW IMPORT FOR ADMIN PREVIEW
import { TalksDashboard } from './components/Talks/TalksDashboard'; // NEW IMPORT

const STORAGE_KEYS = {
  TEMPLATE: 'picnic_admin_template',
  SHOPPER_SESSION: 'picnic_shopper_session',
  LOGIN_ATTEMPTS: 'picnic_login_attempts', // NEW KEY
};

const WELCOME_MESSAGES = [
  "You make a difference today, {name}!",
  "Great to see you, {name}!",
  "{name}, ready to find some great talent?",
  "You are the heart of Picnic, {name}!",
  "Let's build a dream team, {name}!",
  "{name}, your energy is contagious!",
  "Thanks for all your hard work, {name}.",
  "{name}, you're doing an amazing job!",
  "Time to change some lives, {name}!",
  "We appreciate you so much, {name}.",
  "{name}, you are unstoppable today!",
  "Sending you positive vibes, {name}!",
  "Hiring hero {name} in the house!",
  "{name} handles it with grace.",
  "Keep up the fantastic work, {name}!",
  "{name} is a recruitment rockstar!",
  "{name}, making magic happen daily.",
  "Your smile lights up the office, {name}!",
  "Simply the best recruiter: {name}!",
  "Building the future, one hire at a time, {name}.",
  "You've got this, {name}!",
  "Thanks for being awesome, {name}.",
  "{name}, your effort really matters.",
  "Creating opportunities every day, {name}.",
  "{name} is a valued member of the team.",
  "Excellence looks good on you, {name}!",
  "Ready to crush some goals, {name}?",
  "{name} makes it look easy!",
  "Pure professionalism, {name}.",
  "{name} is a true team player!",
  "Making dreams come true today, {name}.",
  "Positive vibes only, {name}!",
  "We are lucky to have you, {name}.",
  "Shining bright today, {name}!",
  "Master of connections: {name}.",
  "Delivering happiness, {name}!",
  "Have a wonderful shift, {name}!",
  "{name}, you inspire us all.",
  "The team wouldn't be the same without {name}.",
  "Let's make today great, {name}!"
];

const NAME_COLORS = [
  'text-pink-600', 
  'text-purple-600', 
  'text-indigo-600', 
  'text-blue-600', 
  'text-cyan-600', 
  'text-teal-600', 
  'text-emerald-600', 
  'text-orange-600', 
  'text-rose-600',
  'text-fuchsia-600'
];

export default function App() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCurrentSuperAdmin, setIsCurrentSuperAdmin] = useState(false); // NEW PERMISSION STATE
  const [authError, setAuthError] = useState(false);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  
  // Admin Auth Config
  const [adminPin, setAdminPin] = useState('7709'); 
  const [superAdminPin, setSuperAdminPin] = useState('9999'); // Default Super Admin PIN
  const [frozenPin, setFrozenPin] = useState('0000'); // Default Frozen PIN
  
  // Shopper Auth Config
  const [shopperPinConfig, setShopperPinConfig] = useState<string | null>(null);
  const [isShopperAuthEnabled, setIsShopperAuthEnabled] = useState(true);
  const [enteredShopperPin, setEnteredShopperPin] = useState('');
  const [isShopperVerified, setIsShopperVerified] = useState(false);
  const [showShopperAuth, setShowShopperAuth] = useState(false);
  const [adminShopperPinInput, setAdminShopperPinInput] = useState('');

  // App State
  const [mode, setMode] = useState<AppMode>(AppMode.SHOPPER_SETUP);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Admin State
  const [adminWizardStep, setAdminWizardStep] = useState<AdminWizardStep>(AdminWizardStep.DASHBOARD);
  const [wizardDayIndex, setWizardDayIndex] = useState<number>(1);
  const [tempTemplate, setTempTemplate] = useState<WeeklyTemplate>({});
  const [savedCloudTemplate, setSavedCloudTemplate] = useState<WeeklyTemplate | null>(null);
  const [applyWeeks, setApplyWeeks] = useState<number>(4);
  const [adminAvailability, setAdminAvailability] = useState<AdminAvailabilityMap>({});
  const [busConfig, setBusConfig] = useState<BusConfig>(DEFAULT_BUS_CONFIG);
  
  // Staff List State
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  // Shopper Session State
  const [tempNameInput, setTempNameInput] = useState('');
  const [selectedRecruiter, setSelectedRecruiter] = useState('');

  // Random Welcome Message & Color State (Memoized)
  const welcomeConfig = useMemo(() => {
      const template = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
      const color = NAME_COLORS[Math.floor(Math.random() * NAME_COLORS.length)];
      return { template, color };
  }, [isAuthenticated]); // Regenerate on login

  const displayName = useMemo(() => {
      if (selectedRecruiter) return selectedRecruiter.split(' ')[0];
      if (isAuthenticated) return "Recruiter";
      return "Friend";
  }, [selectedRecruiter, isAuthenticated]);
  
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

  const saveBusConfigToSupabase = async () => {
    try {
        const { error } = await supabase.from('app_settings').upsert({ id: 'bus_config', value: busConfig });
        if (error) alert("Error saving bus configuration");
        else alert("Bus schedule updated successfully!");
    } catch (e) { console.error(e); }
  };

  const saveStaffListToSupabase = async (list: StaffMember[]) => {
      try {
          const { error } = await supabase.from('app_settings').upsert({ id: 'staff_list', value: list });
          if (!error) setStaffList(list);
          else alert("Error saving staff list");
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

  const updateAdminPin = async (newPin: string) => {
      try {
          const { error } = await supabase.from('app_settings').upsert({ id: 'admin_auth', value: { pin: newPin } });
          if (error) {
              alert("Error updating Admin PIN");
          } else {
              setAdminPin(newPin);
              alert("Admin PIN updated successfully!");
          }
      } catch (e) { console.error(e); }
  };

  const updateSuperAdminPin = async (newPin: string) => {
      try {
          const { error } = await supabase.from('app_settings').upsert({ id: 'super_admin_auth', value: { pin: newPin } });
          if (error) {
              alert("Error updating Super Admin PIN");
          } else {
              setSuperAdminPin(newPin);
              alert("Super Admin PIN updated successfully!");
          }
      } catch (e) { console.error(e); }
  };

  const updateFrozenPin = async (newPin: string) => {
      try {
          const { error } = await supabase.from('app_settings').upsert({ id: 'frozen_auth', value: { pin: newPin } });
          if (error) {
              alert("Error updating Frozen PIN");
          } else {
              setFrozenPin(newPin);
              alert("Frozen List PIN updated successfully!");
          }
      } catch (e) { console.error(e); }
  };

  const loadRemoteConfig = useCallback(async () => {
    try {
        const { data: authData } = await supabase.from('app_settings').select('value').eq('id', 'admin_auth').single();
        if (authData?.value?.pin) setAdminPin(authData.value.pin);

        const { data: superAuthData } = await supabase.from('app_settings').select('value').eq('id', 'super_admin_auth').single();
        if (superAuthData?.value?.pin) setSuperAdminPin(superAuthData.value.pin);

        const { data: frozenAuthData } = await supabase.from('app_settings').select('value').eq('id', 'frozen_auth').single();
        if (frozenAuthData?.value?.pin) setFrozenPin(frozenAuthData.value.pin);

        const { data: availData } = await supabase.from('app_settings').select('value').eq('id', 'admin_availability').single();
        if (availData?.value) {
            let parsed = availData.value;
            if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch (e) {} }
            setAdminAvailability(parsed);
        }

        const { data: templateData } = await supabase.from('app_settings').select('value').eq('id', 'weekly_template').single();
        if (templateData?.value) {
            let parsed = templateData.value;
            if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch (e) {} }
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

        const { data: busData } = await supabase.from('app_settings').select('value').eq('id', 'bus_config').single();
        if (busData?.value) {
             let parsed = busData.value;
             if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch (e) {} }
             setBusConfig(parsed);
        }

        const { data: staffData } = await supabase.from('app_settings').select('value').eq('id', 'staff_list').single();
        if (staffData?.value && Array.isArray(staffData.value)) {
            // Backward compatibility: If array of strings, convert to objects
            const list: any[] = staffData.value;
            const parsedList: StaffMember[] = list.map(item => {
                if (typeof item === 'string') {
                    return { name: item, isSuperAdmin: false };
                }
                return item;
            });
            setStaffList(parsedList);
        }

    } catch (err) { console.error("Config load error:", err); }
  }, []);

  // --- RESTORE SESSION LOGIC ---
  useEffect(() => {
    // Check for saved shopper session on mount
    const savedSession = localStorage.getItem(STORAGE_KEYS.SHOPPER_SESSION);
    if (savedSession) {
        try {
            const parsed = JSON.parse(savedSession);
            if (parsed.selections?.[0]?.name) {
                setTempNameInput(parsed.selections[0].name);
                if (parsed.selections[0].details?.recruiter) {
                    setSelectedRecruiter(parsed.selections[0].details.recruiter);
                }
                const params = new URLSearchParams(window.location.search);
                if (!params.get('mode')) {
                    setMode(AppMode.SHOPPER_FLOW);
                    setIsShopperVerified(true);
                }
            }
        } catch(e) {
            console.error("Failed to restore session", e);
            localStorage.removeItem(STORAGE_KEYS.SHOPPER_SESSION);
        }
    }

    // CHECK FOR LOCKOUT ON MOUNT
    const attemptsData = localStorage.getItem(STORAGE_KEYS.LOGIN_ATTEMPTS);
    if (attemptsData) {
        const { lockoutUntil } = JSON.parse(attemptsData);
        if (lockoutUntil && Date.now() < lockoutUntil) {
            setLockoutTime(lockoutUntil);
        } else if (lockoutUntil) {
            // Lockout expired, clear it
            localStorage.removeItem(STORAGE_KEYS.LOGIN_ATTEMPTS);
        }
    }

  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get('mode');
    if (urlMode === 'shopper') { setMode(AppMode.SHOPPER_SETUP); } 
    else if (urlMode === 'admin') { setMode(AppMode.ADMIN); }
    if (urlMode) window.history.replaceState({}, '', window.location.pathname);
    loadRemoteConfig();
    setIsInitialized(true);
  }, [loadRemoteConfig]);

  useEffect(() => { 
      if (mode === AppMode.SHOPPER_SETUP) loadRemoteConfig(); 
  }, [mode, loadRemoteConfig]);

  // --- ACTIONS ---
  const generateRandomPin = () => setAdminShopperPinInput(Math.floor(100000 + Math.random() * 900000).toString());

  const handleVerifyShopperPin = () => {
      if (enteredShopperPin === shopperPinConfig) { 
          setIsShopperVerified(true); 
          setMode(AppMode.SHOPPER_FLOW);
          setShowShopperAuth(false);
      } else { 
          alert("Incorrect PIN"); 
          setEnteredShopperPin(''); 
      }
  };

  const handleStartShopperClick = () => {
      if (!tempNameInput.trim()) return;
      
      // Save Recruiter to initial session state immediately so it persists
      const initialData = {
          name: tempNameInput,
          selections: [{ 
              name: tempNameInput, 
              shifts: [], 
              details: { 
                  nationality: '',
                  usePicnicBus: null, civilStatus: '', gender: '', clothingSize: 'M', 
                  shoeSize: '40', gloveSize: '8 (M)', isRandstad: false, address: '',
                  recruiter: selectedRecruiter // Pass recruiter
              } 
          }]
      };
      localStorage.setItem(STORAGE_KEYS.SHOPPER_SESSION, JSON.stringify(initialData));

      if (shopperPinConfig && isShopperAuthEnabled && !isShopperVerified) setShowShopperAuth(true);
      else {
          setMode(AppMode.SHOPPER_FLOW);
          setShowShopperAuth(false);
      }
  };

  const handleClearSession = () => {
    localStorage.removeItem(STORAGE_KEYS.SHOPPER_SESSION);
    setIsShopperVerified(false); 
    setShowShopperAuth(false); 
    setTempNameInput(''); 
    // We DO NOT clear selectedRecruiter here, as it persists for the session of the staff member
    setMode(AppMode.SHOPPER_SETUP);
  };

  const handleAdminLogout = () => {
      setIsAuthenticated(false);
      setIsCurrentSuperAdmin(false);
      setMode(AppMode.SHOPPER_SETUP);
  };

  const toggleWizardTemplate = (shift: ShiftTime, type: ShiftType) => {
      setTempTemplate(prev => {
          const currentTypes = prev[wizardDayIndex]?.[shift] || [];
          const newTypes = currentTypes.includes(type) ? currentTypes.filter(t => t !== type) : [...currentTypes, type];
          return { ...prev, [wizardDayIndex]: { ...prev[wizardDayIndex], [shift]: newTypes } };
      });
  };

  const resetWizardTemplate = () => {
    if (window.prompt("Enter Admin PIN to confirm reset:") === adminPin) {
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
      saveTemplateToSupabase(tempTemplate);
      setAdminWizardStep(AdminWizardStep.DASHBOARD);
      alert("Standard Weekly Pattern updated successfully! This will now be the default availability for all dates.");
  };

  const handleAdminToggle = (date: string, shift: ShiftTime, type: ShiftType) => {
      const currentMap = adminAvailability[date] || {};
      const currentList = currentMap[shift] || [];
      
      let newList: ShiftType[] = [];
      
      if (currentMap[shift]) {
          newList = currentList.includes(type) ? currentList.filter(t => t !== type) : [...currentList, type];
      } else {
          const dayIndex = getDay(new Date(date));
          const templateTypes = savedCloudTemplate?.[dayIndex]?.[shift];
          const effectiveCurrent = templateTypes || [ShiftType.AA, ShiftType.STANDARD]; 
          
          if (effectiveCurrent.includes(type)) {
              newList = effectiveCurrent.filter(t => t !== type);
          } else {
              newList = [...effectiveCurrent, type];
          }
      }

      const newMap = {
          ...adminAvailability,
          [date]: {
              ...adminAvailability[date],
              [shift]: newList
          }
      };
      setAdminAvailability(newMap);
      saveConfigToSupabase(newMap);
  };
  
  // --- SECURE LOGIN HANDLER WITH LOGGING ---
  const logAccessAttempt = async (status: 'SUCCESS' | 'FAILURE' | 'LOCKOUT', role: 'ADMIN' | 'FROZEN' | 'UNKNOWN') => {
      try {
          const info = navigator.userAgent; // Basic client info
          await supabase.from('access_logs').insert([{
              status,
              target_role: role,
              device_info: info
          }]);
      } catch(e) {
          console.error("Logging failed", e);
      }
  };

  const handleLogin = async (pwd: string, staffName?: string) => { 
      if (lockoutTime && Date.now() < lockoutTime) {
          return;
      } else if (lockoutTime && Date.now() >= lockoutTime) {
          setLockoutTime(null);
          localStorage.removeItem(STORAGE_KEYS.LOGIN_ATTEMPTS);
      }

      let targetRole: 'ADMIN' | 'FROZEN' | 'UNKNOWN' = 'UNKNOWN';
      
      // Determine expected PIN based on selected staff role
      let requiredAdminPin = adminPin;
      if (staffName) {
          const member = staffList.find(s => s.name === staffName);
          if (member && member.isSuperAdmin) {
              requiredAdminPin = superAdminPin;
          }
      }

      if (pwd === requiredAdminPin) targetRole = 'ADMIN';
      else if (pwd === frozenPin) targetRole = 'FROZEN';

      if (targetRole !== 'UNKNOWN') { 
          localStorage.removeItem(STORAGE_KEYS.LOGIN_ATTEMPTS);
          setLockoutTime(null);
          setAuthError(false); 
          await logAccessAttempt('SUCCESS', targetRole);

          if (targetRole === 'ADMIN') {
              setIsAuthenticated(true);
              // DETERMINE IF SUPER ADMIN
              // If staffList is empty, we treat as super admin to allow setup.
              // Otherwise, rely on the selected staff member's role.
              let isSuper = staffList.length === 0;
              if (staffName) {
                  const member = staffList.find(s => s.name === staffName);
                  if (member?.isSuperAdmin) isSuper = true;
              }
              setIsCurrentSuperAdmin(isSuper);

              setMode(AppMode.ADMIN);
              if (staffName) setSelectedRecruiter(staffName);
          } else {
              setIsAuthenticated(false);
              setMode(AppMode.FROZEN_LIST);
          }
      } else { 
          setAuthError(true); 
          const storage = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOGIN_ATTEMPTS) || '{"count": 0}');
          const newCount = storage.count + 1;

          if (newCount >= 3) {
              const lockoutUntil = Date.now() + (30 * 60 * 1000); 
              setLockoutTime(lockoutUntil);
              localStorage.setItem(STORAGE_KEYS.LOGIN_ATTEMPTS, JSON.stringify({ count: newCount, lockoutUntil }));
              await logAccessAttempt('LOCKOUT', 'UNKNOWN');
          } else {
              localStorage.setItem(STORAGE_KEYS.LOGIN_ATTEMPTS, JSON.stringify({ count: newCount, lockoutUntil: null }));
              await logAccessAttempt('FAILURE', 'UNKNOWN');
          }
      }
  };
  
  // --- MAIN RENDER ---
  return (
    <div className="font-sans text-gray-900 selection:bg-purple-100 selection:text-purple-900">
        
        {/* SHOPPER SETUP */}
        {mode === AppMode.SHOPPER_SETUP && (
            <ShopperSetup 
                showShopperAuth={showShopperAuth} setShowShopperAuth={setShowShopperAuth}
                enteredShopperPin={enteredShopperPin} setEnteredShopperPin={setEnteredShopperPin}
                handleVerifyShopperPin={handleVerifyShopperPin} tempNameInput={tempNameInput}
                setTempNameInput={setTempNameInput} handleStartShopperClick={handleStartShopperClick}
                setMode={setMode}
                selectedRecruiter={selectedRecruiter} // Pass display only
                // Removed Staff List props to revert manual selection
            />
        )}
        
        {/* SHOPPER FLOW */}
        {(mode === AppMode.SHOPPER_FLOW || mode === AppMode.SUMMARY) && (
            <ShopperApp 
                shopperName={tempNameInput}
                adminAvailability={adminAvailability}
                savedCloudTemplate={savedCloudTemplate}
                busConfig={busConfig}
                onExit={handleClearSession}
                recruiterName={selectedRecruiter} // Pass recruiter name if known
            />
        )}
        
        {/* UNIFIED STAFF LOGIN SCREEN */}
        {mode === AppMode.ADMIN && !isAuthenticated && (
            <AdminLogin 
                onLogin={handleLogin} 
                onCancel={() => setMode(AppMode.SHOPPER_SETUP)} 
                authError={authError} 
                lockoutTime={lockoutTime} // Pass lockout state
                staffList={staffList} // Pass Staff List
            />
        )}

        {/* FROZEN LIST */}
        {mode === AppMode.FROZEN_LIST && (
            <FrozenList 
                onLogout={() => {
                    if (isAuthenticated) setMode(AppMode.ADMIN);
                    else setMode(AppMode.SHOPPER_SETUP);
                }} 
                isSuperAdmin={isAuthenticated}
            />
        )}

        {/* NEW TALKS SECTION */}
        {mode === AppMode.TALKS_DASHBOARD && (
            <TalksDashboard 
                onBack={() => setMode(AppMode.ADMIN)} 
            />
        )}
        
        {/* ADMIN PANEL */}
        {mode === AppMode.ADMIN && isAuthenticated && (
            <div className="min-h-screen bg-gray-100 pb-20 flex flex-col">
              <div className="bg-white border-b sticky top-0 z-20 px-4 sm:px-6 py-3 sm:py-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="p-2 bg-rose-100 rounded-lg text-rose-600 shrink-0"><Heart className="w-6 h-6" /></div>
                      <div>
                          <h2 className="text-xl font-bold text-gray-800 leading-none">
                              {welcomeConfig.template.split('{name}').map((part, i, arr) => (
                                  <React.Fragment key={i}>
                                      {part}
                                      {i < arr.length - 1 && (
                                          <span className={`${welcomeConfig.color} font-black`}>{displayName}</span>
                                      )}
                                  </React.Fragment>
                              ))}
                          </h2>
                          <div className="flex items-center gap-2 mt-0.5">
                              {/* LABEL REMOVED AS REQUESTED */}
                              <span className="text-xs text-gray-400 font-medium">
                                  {adminWizardStep === AdminWizardStep.VIEW_SUBMISSIONS ? 'Data Viewer' : 
                                   adminWizardStep === AdminWizardStep.BUS_CONFIG ? 'Bus Manager' : 
                                   adminWizardStep === AdminWizardStep.VIEW_LOGS ? 'Audit Logs' : 
                                   adminWizardStep === AdminWizardStep.VIEW_ACCESS_LOGS ? 'Security Logs' : null}
                              </span>
                          </div>
                      </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                      {adminWizardStep !== AdminWizardStep.DASHBOARD && <Button variant="secondary" onClick={() => setAdminWizardStep(AdminWizardStep.DASHBOARD)} className="text-sm flex-1 sm:flex-none justify-center">Back</Button>}
                      <Button onClick={handleAdminLogout} className="bg-gray-800 text-white hover:bg-gray-900 text-sm flex-1 sm:flex-none justify-center">Log Out</Button>
                  </div>
              </div>
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
                  {adminWizardStep === AdminWizardStep.DASHBOARD && (
                      <AdminDashboard 
                          isSuperAdmin={isCurrentSuperAdmin} // PASS PERMISSION
                          isShopperAuthEnabled={isShopperAuthEnabled} setIsShopperAuthEnabled={setIsShopperAuthEnabled}
                          adminShopperPinInput={adminShopperPinInput} setAdminShopperPinInput={setAdminShopperPinInput}
                          generateRandomPin={generateRandomPin} saveShopperAuthSettings={saveShopperAuthSettings}
                          setAdminWizardStep={setAdminWizardStep}
                          setWizardDayIndex={setWizardDayIndex} savedCloudTemplate={savedCloudTemplate}
                          setTempTemplate={setTempTemplate} tempTemplate={tempTemplate}
                          adminPin={adminPin} updateAdminPin={updateAdminPin}
                          superAdminPin={superAdminPin} updateSuperAdminPin={updateSuperAdminPin}
                          frozenPin={frozenPin} updateFrozenPin={updateFrozenPin} 
                          onGoToFrozen={() => setMode(AppMode.FROZEN_LIST)}
                          onGoToTalks={() => setMode(AppMode.TALKS_DASHBOARD)}
                          staffList={staffList} // Pass staff list
                          saveStaffList={saveStaffListToSupabase} // Pass save handler
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
                  
                  {/* PASS currentUser TO ADMIN DATA VIEW */}
                  {adminWizardStep === AdminWizardStep.VIEW_SUBMISSIONS && <AdminDataView currentUser={selectedRecruiter} />}
                  
                  {adminWizardStep === AdminWizardStep.BUS_CONFIG && (
                      <AdminBusConfig 
                          busConfig={busConfig}
                          setBusConfig={setBusConfig}
                          onSave={saveBusConfigToSupabase}
                          onBack={() => setAdminWizardStep(AdminWizardStep.DASHBOARD)}
                      />
                  )}
                  {adminWizardStep === AdminWizardStep.VIEW_LOGS && (
                      <AdminAuditLog onBack={() => setAdminWizardStep(AdminWizardStep.DASHBOARD)} />
                  )}
                  {adminWizardStep === AdminWizardStep.VIEW_ACCESS_LOGS && (
                      <AccessLogViewer onBack={() => setAdminWizardStep(AdminWizardStep.DASHBOARD)} />
                  )}
              </div>
            </div>
        )}
    </div>
  );
}
