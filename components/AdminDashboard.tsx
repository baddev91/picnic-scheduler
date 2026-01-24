
import React, { useState } from 'react';
import { Settings2, RefreshCw, Save, Share2, CalendarRange, Table, Bus, ArrowRight, ShieldCheck, UserCog, Info, AlertTriangle, Clock, CalendarCheck, Zap, ChevronDown, ChevronUp, History, Snowflake, AlertCircle, ShieldAlert, Lock } from 'lucide-react';
import { Button } from './Button';
import { AdminWizardStep, WeeklyTemplate } from '../types';
import { MIN_DAYS_TO_START } from '../constants';

interface AdminDashboardProps {
  isShopperAuthEnabled: boolean;
  setIsShopperAuthEnabled: (enabled: boolean) => void;
  adminShopperPinInput: string;
  setAdminShopperPinInput: (val: string) => void;
  generateRandomPin: () => void;
  saveShopperAuthSettings: (pin: string, enabled: boolean, silent?: boolean) => void;
  handleCopyMagicLink: () => void;
  setAdminWizardStep: (step: AdminWizardStep) => void;
  setWizardDayIndex: (idx: number) => void;
  savedCloudTemplate: WeeklyTemplate | null;
  setTempTemplate: (t: WeeklyTemplate) => void;
  tempTemplate: WeeklyTemplate;
  adminPin: string;
  updateAdminPin: (pin: string) => void;
  frozenPin: string;
  updateFrozenPin: (pin: string) => void;
  onGoToFrozen: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isShopperAuthEnabled,
  setIsShopperAuthEnabled,
  adminShopperPinInput,
  setAdminShopperPinInput,
  generateRandomPin,
  saveShopperAuthSettings,
  handleCopyMagicLink,
  setAdminWizardStep,
  setWizardDayIndex,
  savedCloudTemplate,
  setTempTemplate,
  tempTemplate,
  adminPin,
  updateAdminPin,
  frozenPin,
  updateFrozenPin,
  onGoToFrozen
}) => {
  const [newAdminPin, setNewAdminPin] = useState(adminPin);
  const [newFrozenPin, setNewFrozenPin] = useState(frozenPin);
  const [showRules, setShowRules] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const handleEditPattern = () => {
    if (savedCloudTemplate) {
         setTempTemplate(savedCloudTemplate);
    } else if (Object.keys(tempTemplate).length === 0) {
        setTempTemplate({});
    }
    setWizardDayIndex(1); // Mon
    setAdminWizardStep(AdminWizardStep.WIZARD_DAYS);
  };

  const toggleAuth = () => {
      const newValue = !isShopperAuthEnabled;
      setIsShopperAuthEnabled(newValue);
      saveShopperAuthSettings(adminShopperPinInput, newValue, true);
  };

  // --- VALIDATION LOGIC ---
  const handleUpdateAdminPin = () => {
      if (newAdminPin === frozenPin) {
          setPinError("Admin PIN cannot be the same as Frozen PIN.");
          return;
      }
      if (newAdminPin.length < 4) {
          setPinError("PIN too short.");
          return;
      }
      setPinError(null);
      updateAdminPin(newAdminPin);
  };

  const handleUpdateFrozenPin = () => {
      if (newFrozenPin === adminPin) {
          setPinError("Frozen PIN cannot be the same as Admin PIN.");
          return;
      }
      if (newFrozenPin.length < 4) {
          setPinError("PIN too short.");
          return;
      }
      setPinError(null);
      updateFrozenPin(newFrozenPin);
  };

  return (
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
          
          {/* HEADER SECTION */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                  <h1 className="text-3xl font-black text-gray-900 tracking-tight">Dashboard</h1>
                  <p className="text-gray-500 mt-1">Manage schedules, settings and view submissions.</p>
              </div>
              <div className="flex gap-2">
                 <button 
                    onClick={onGoToFrozen}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-50 text-cyan-700 font-bold hover:bg-cyan-100 transition-colors border border-cyan-200 text-xs shadow-sm"
                 >
                     <Snowflake className="w-3 h-3" /> Frozen List View
                 </button>
                 <Button 
                    variant="secondary" 
                    onClick={() => setAdminWizardStep(AdminWizardStep.VIEW_LOGS)}
                    className="flex items-center gap-2 border-gray-300 hover:border-black transition-colors text-xs"
                 >
                     <History className="w-3 h-3" /> Audit Logs
                 </Button>
                 {/* NEW SECURITY LOGS BUTTON */}
                 <Button 
                    variant="secondary" 
                    onClick={() => setAdminWizardStep(AdminWizardStep.VIEW_ACCESS_LOGS)}
                    className="flex items-center gap-2 border-gray-300 hover:border-red-500 hover:text-red-600 transition-colors text-xs bg-red-50/50"
                 >
                     <ShieldAlert className="w-3 h-3" /> Security
                 </Button>
              </div>
          </div>

          {/* ACTIONS GRID (Moved to Top) */}
          <div className="grid md:grid-cols-2 gap-6">
              
              {/* Primary Action: Edit Pattern */}
              <button 
                onClick={handleEditPattern}
                className="group relative overflow-hidden bg-[#E31837] rounded-3xl p-8 text-left transition-all hover:shadow-xl hover:shadow-red-900/20 hover:-translate-y-1"
              >
                  <div className="relative z-10 flex flex-col h-full">
                      <div className="bg-white/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm group-hover:scale-110 transition-transform">
                          <CalendarRange className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-2xl font-black text-white mb-2">Weekly Pattern</h3>
                      <p className="text-red-100 text-sm font-medium mb-8 max-w-[80%]">
                          Configure AA & Standard slots. This is your starting point.
                      </p>
                      
                      <div className="mt-auto flex items-center text-white font-bold text-sm gap-2 group-hover:gap-4 transition-all">
                          Open Wizard <ArrowRight className="w-4 h-4" />
                      </div>
                  </div>
                  
                  {/* Decorative Background Elements */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/10 transition-colors"></div>
                  <div className="absolute bottom-0 right-0 w-32 h-32 bg-black/10 rounded-full -mr-8 -mb-8 blur-xl"></div>
              </button>

              <div className="flex flex-col gap-6">
                {/* View Submissions */}
                <button 
                    onClick={() => setAdminWizardStep(AdminWizardStep.VIEW_SUBMISSIONS)}
                    className="group flex-1 bg-white border border-gray-200 p-6 rounded-3xl text-left hover:border-black transition-all hover:shadow-lg relative overflow-hidden"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="bg-gray-100 group-hover:bg-black group-hover:text-white transition-colors w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                                <Table className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">View Submissions</h3>
                            <p className="text-gray-500 text-xs mt-1">Manage submitted shopper data.</p>
                        </div>
                        <div className="bg-gray-50 rounded-full p-2 group-hover:bg-gray-100 transition-colors">
                            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-black" />
                        </div>
                    </div>
                </button>

                {/* Manage Bus */}
                <button 
                    onClick={() => setAdminWizardStep(AdminWizardStep.BUS_CONFIG)}
                    className="group flex-1 bg-white border border-gray-200 p-6 rounded-3xl text-left hover:border-black transition-all hover:shadow-lg relative overflow-hidden"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="bg-gray-100 group-hover:bg-black group-hover:text-white transition-colors w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                                <Bus className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Bus Schedule</h3>
                            <p className="text-gray-500 text-xs mt-1">Update stops and times.</p>
                        </div>
                        <div className="bg-gray-50 rounded-full p-2 group-hover:bg-gray-100 transition-colors">
                            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-black" />
                        </div>
                    </div>
                </button>
              </div>
          </div>

          {/* ACTIVE RULES INFO SECTION (Collapsible) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
             <button 
                onClick={() => setShowRules(!showRules)}
                className="w-full p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
             >
                 <div className="flex items-center gap-3">
                     <ShieldCheck className="w-5 h-5 text-gray-500" />
                     <h2 className="font-bold text-gray-900">Active System Constraints</h2>
                 </div>
                 {showRules ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
             </button>
             
             {showRules && (
                 <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 animate-in slide-in-from-top-2 duration-200">
                     {/* Rule 1: First Day */}
                     <div className="p-6 space-y-3">
                         <div className="flex items-center gap-2 text-yellow-600 font-bold text-sm uppercase tracking-wider">
                             <CalendarCheck className="w-4 h-4" /> First Day Rules
                         </div>
                         <ul className="space-y-2 text-sm text-gray-600">
                             <li className="flex items-start gap-2">
                                 <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                                 <span>Earliest Start: <strong>Today + {MIN_DAYS_TO_START} days</strong></span>
                             </li>
                             <li className="flex items-start gap-2">
                                 <AlertTriangle className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                                 <span>Must be <strong>Morning</strong> or <strong>Afternoon</strong> shift only.</span>
                             </li>
                             <li className="flex items-start gap-2">
                                 <Clock className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                                 <span>Planning Horizon: 2 Weeks from First Day.</span>
                             </li>
                         </ul>
                     </div>

                     {/* Rule 2: AA Rules */}
                     <div className="p-6 space-y-3">
                         <div className="flex items-center gap-2 text-red-600 font-bold text-sm uppercase tracking-wider">
                             <Zap className="w-4 h-4" /> AA Config
                         </div>
                         <ul className="space-y-2 text-sm text-gray-600">
                             <li className="flex items-start gap-2">
                                 <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                                 <span>Requirement: <strong>1 Weekday</strong> + <strong>1 Weekend</strong>.</span>
                             </li>
                             <li className="flex items-start gap-2">
                                 <Lock className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                                 <span>AA shifts are recurring and locked.</span>
                             </li>
                             <li className="flex items-start gap-2">
                                 <AlertTriangle className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                                 <span>Cannot swap AA for Standard on same day.</span>
                             </li>
                         </ul>
                     </div>

                     {/* Rule 3: Standard Rules */}
                     <div className="p-6 space-y-3">
                         <div className="flex items-center gap-2 text-green-600 font-bold text-sm uppercase tracking-wider">
                             <CalendarRange className="w-4 h-4" /> Standard Limits
                         </div>
                         <ul className="space-y-2 text-sm text-gray-600">
                             <li className="flex items-start gap-2">
                                 <Clock className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                                 <span><strong>11h Rest Rule</strong> enforced between shifts.</span>
                             </li>
                             <li className="flex items-start gap-2">
                                 <AlertTriangle className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                                 <span>Max <strong>5 Consecutive</strong> days (FWD+AA+Std).</span>
                             </li>
                             <li className="flex items-start gap-2">
                                 <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                                 <span><strong>OPENING Shift:</strong> Allowed only after completing 2 shifts.</span>
                             </li>
                         </ul>
                     </div>
                 </div>
             )}
          </div>

          {/* COMPACT CONFIGURATION SECTION (Moved to Bottom) */}
          <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider px-1">Access Control & Configuration</h3>
              
              {pinError && (
                  <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 animate-pulse">
                      <AlertCircle className="w-4 h-4" /> {pinError}
                  </div>
              )}

              <div className="grid md:grid-cols-3 gap-4">
                  {/* 1. Shopper Access */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col justify-between gap-4">
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-gray-800 font-bold text-sm">
                              <Settings2 className="w-4 h-4 text-gray-500" />
                              Shopper Access
                          </div>
                          {/* Toggle */}
                          <button 
                              onClick={toggleAuth}
                              className={`relative w-10 h-5 rounded-full transition-colors duration-300 focus:outline-none ${isShopperAuthEnabled ? 'bg-green-500' : 'bg-gray-200'}`}
                          >
                              <span className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full shadow-sm transform transition-transform duration-300 ${isShopperAuthEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                      </div>
                      
                      <div className="flex gap-2">
                          <div className="relative flex-1">
                              <input 
                                  value={adminShopperPinInput} 
                                  onChange={e => setAdminShopperPinInput(e.target.value.replace(/[^0-9]/g, '').slice(0,6))}
                                  className={`w-full border rounded-lg py-1.5 px-2 text-center text-sm font-mono outline-none ${isShopperAuthEnabled ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-100 text-gray-400 border-transparent'}`}
                                  placeholder="PIN"
                                  disabled={!isShopperAuthEnabled}
                              />
                              <button onClick={generateRandomPin} disabled={!isShopperAuthEnabled} className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600"><RefreshCw className="w-3 h-3" /></button>
                          </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                          <Button onClick={() => saveShopperAuthSettings(adminShopperPinInput, isShopperAuthEnabled, false)} disabled={!isShopperAuthEnabled} className="text-xs py-1.5 h-auto">Save</Button>
                          <Button variant="secondary" onClick={handleCopyMagicLink} className="text-xs py-1.5 h-auto">Link</Button>
                      </div>
                  </div>

                  {/* 2. Admin Access */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col justify-between gap-4">
                      <div className="flex items-center gap-2 text-gray-800 font-bold text-sm">
                          <UserCog className="w-4 h-4 text-purple-600" />
                          Admin PIN
                      </div>
                      <input 
                          type="text"
                          value={newAdminPin}
                          onChange={e => { setNewAdminPin(e.target.value); setPinError(null); }}
                          className="w-full border rounded-lg py-1.5 px-2 text-center text-sm font-mono outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-300"
                          placeholder="Admin PIN"
                      />
                      <Button onClick={handleUpdateAdminPin} disabled={!newAdminPin || newAdminPin === adminPin} className="text-xs py-1.5 h-auto bg-purple-600 hover:bg-purple-700">
                          Update Admin
                      </Button>
                  </div>

                  {/* 3. Frozen Access */}
                  <div className="bg-cyan-50 rounded-xl shadow-sm border border-cyan-200 p-4 flex flex-col justify-between gap-4">
                      <div className="flex items-center gap-2 text-cyan-900 font-bold text-sm">
                          <Snowflake className="w-4 h-4 text-cyan-600" />
                          Frozen List PIN
                      </div>
                      <input 
                          type="text"
                          value={newFrozenPin}
                          onChange={e => { setNewFrozenPin(e.target.value); setPinError(null); }}
                          className="w-full border border-cyan-200 rounded-lg py-1.5 px-2 text-center text-sm font-mono outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-300 bg-white"
                          placeholder="Frozen PIN"
                      />
                      <Button onClick={handleUpdateFrozenPin} disabled={!newFrozenPin || newFrozenPin === frozenPin} className="text-xs py-1.5 h-auto bg-cyan-600 hover:bg-cyan-700 shadow-cyan-200">
                          Update Frozen
                      </Button>
                  </div>
              </div>
          </div>
      </div>
  );
};
