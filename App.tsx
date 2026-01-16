
import React, { useState, useEffect, useCallback } from 'react';
import { AppMode, ShiftTime, ShiftType, AdminAvailabilityMap, WeeklyTemplate, AdminWizardStep, BusConfig } from './types';
import { SHIFT_TIMES, formatDateKey, DEFAULT_BUS_CONFIG } from './constants';
import { Button } from './components/Button';
import { Shield, RefreshCw } from 'lucide-react';
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

const STORAGE_KEYS = {
  TEMPLATE: 'picnic_admin_template',
  SHOPPER_SESSION: 'picnic_shopper_session',
};

export default function App() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(false);
  
  // Admin Auth Config
  const [adminPin, setAdminPin] = useState('7709'); 
  
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

  // Shopper Session State
  const [tempNameInput, setTempNameInput] = useState('');
  
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

  const loadRemoteConfig = useCallback(async () => {
    try {
        const { data: authData } = await supabase.from('app_settings').select('value').eq('id', 'admin_auth').single();
        if (authData?.value?.pin) setAdminPin(authData.value.pin);

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

        const { data: busData } = await supabase.from('app_settings').select('value').eq('id', 'bus_config').single();
        if (busData?.value) {
             let parsed = busData.value;
             if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch(e) {} }
             setBusConfig(parsed);
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
            // Verify if data seems valid and has a name
            if (parsed.selections?.[0]?.name) {
                setTempNameInput(parsed.selections[0].name);
                // If the URL didn't explicitly ask for admin, restore shopper mode
                const params = new URLSearchParams(window.location.search);
                if (params.get('mode') !== 'admin') {
                    setMode(AppMode.SHOPPER_FLOW);
                    setIsShopperVerified(true); // Assuming if they have local data, they passed auth previously
                }
            }
        } catch(e) {
            console.error("Failed to restore session", e);
            localStorage.removeItem(STORAGE_KEYS.SHOPPER_SESSION);
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
      if (shopperPinConfig && isShopperAuthEnabled && !isShopperVerified) setShowShopperAuth(true);
      else {
          setMode(AppMode.SHOPPER_FLOW);
          setShowShopperAuth(false);
      }
  };

  const handleClearSession = () => {
    // Clear Local Storage
    localStorage.removeItem(STORAGE_KEYS.SHOPPER_SESSION);
    
    // Reset State
    setIsShopperVerified(false); 
    setShowShopperAuth(false); 
    setTempNameInput(''); 
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
      // Calculate next Monday manually
      const startDate = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1);
      
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
  const handleLogin = (pwd: string) => { if (pwd === adminPin) { setIsAuthenticated(true); setAuthError(false); } else setAuthError(true); };

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
            />
        )}
        
        {/* SHOPPER FLOW (Refactored into dedicated component) */}
        {(mode === AppMode.SHOPPER_FLOW || mode === AppMode.SUMMARY) && (
            <ShopperApp 
                shopperName={tempNameInput}
                adminAvailability={adminAvailability}
                savedCloudTemplate={savedCloudTemplate}
                busConfig={busConfig}
                onExit={handleClearSession}
            />
        )}
        
        {/* ADMIN LOGIN */}
        {mode === AppMode.ADMIN && !isAuthenticated && (
            <AdminLogin onLogin={handleLogin} onCancel={() => setMode(AppMode.SHOPPER_SETUP)} authError={authError} />
        )}
        
        {/* ADMIN PANEL */}
        {mode === AppMode.ADMIN && isAuthenticated && (
            <div className="min-h-screen bg-gray-100 pb-20 flex flex-col">
              <div className="bg-white border-b sticky top-0 z-20 px-6 py-4 shadow-sm flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 rounded-lg text-orange-600"><Shield className="w-6 h-6" /></div>
                      <div>
                          <h2 className="text-lg font-bold text-gray-800 leading-none">Admin Panel</h2>
                          <span className="text-xs text-gray-400 font-medium">
                              {adminWizardStep === AdminWizardStep.VIEW_SUBMISSIONS ? 'Data Viewer' : 
                               adminWizardStep === AdminWizardStep.BUS_CONFIG ? 'Bus Manager' : 
                               adminWizardStep === AdminWizardStep.VIEW_LOGS ? 'Audit Logs' : 'Wizard Mode'}
                          </span>
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
                          adminPin={adminPin} updateAdminPin={updateAdminPin}
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
              </div>
            </div>
        )}
    </div>
  );
}
