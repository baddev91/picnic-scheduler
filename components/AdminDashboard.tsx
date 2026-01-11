import React, { useState } from 'react';
import { Settings2, KeyRound, RefreshCw, Save, Share2, CalendarRange, Table, Bus, ArrowRight, ShieldCheck, Lock, UserCog } from 'lucide-react';
import { Button } from './Button';
import { AdminWizardStep, WeeklyTemplate } from '../types';

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
  updateAdminPin
}) => {
  const [newAdminPin, setNewAdminPin] = useState(adminPin);

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

  return (
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
          
          {/* HEADER SECTION */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                  <h1 className="text-3xl font-black text-gray-900 tracking-tight">Dashboard</h1>
                  <p className="text-gray-500 mt-1">Manage schedules, settings and view submissions.</p>
              </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
              {/* SYSTEM CONFIG CARD (Shopper Auth) */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                 <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gray-900 text-white rounded-lg">
                            <Settings2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Shopper Access</h2>
                            <p className="text-xs text-gray-500">PIN for new hires</p>
                        </div>
                    </div>
                    {/* Custom Toggle */}
                    <button 
                        onClick={toggleAuth}
                        className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none ${isShopperAuthEnabled ? 'bg-green-500' : 'bg-gray-200'}`}
                    >
                        <span 
                            className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform duration-300 ${isShopperAuthEnabled ? 'translate-x-7' : 'translate-x-0'}`}
                        />
                    </button>
                 </div>
                 
                 <div className="p-6 bg-gray-50/50">
                    <div className="flex flex-col gap-4">
                        <div className="w-full space-y-2">
                            <div className="flex gap-2">
                                <div className="relative w-full">
                                    <input 
                                        value={adminShopperPinInput} 
                                        onChange={e => setAdminShopperPinInput(e.target.value.replace(/[^0-9]/g, '').slice(0,6))}
                                        className={`w-full border-2 rounded-xl py-3 px-4 text-lg font-mono tracking-widest text-center outline-none transition-all ${
                                            isShopperAuthEnabled 
                                            ? 'border-gray-300 focus:border-red-500 focus:ring-4 focus:ring-red-50 bg-white text-gray-900' 
                                            : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                        }`}
                                        placeholder="000000"
                                        disabled={!isShopperAuthEnabled}
                                    />
                                </div>
                                
                                <button 
                                    onClick={generateRandomPin}
                                    className="px-4 bg-white border-2 border-gray-200 hover:border-gray-400 hover:text-gray-900 rounded-xl text-gray-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Generate Random PIN"
                                    disabled={!isShopperAuthEnabled}
                                >
                                    <RefreshCw className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-2">
                             <Button 
                                onClick={() => saveShopperAuthSettings(adminShopperPinInput, isShopperAuthEnabled, false)} 
                                disabled={isShopperAuthEnabled && adminShopperPinInput.length !== 6}
                                className="bg-black hover:bg-gray-800 text-white border-none flex-1 py-3"
                            >
                                <Save className="w-4 h-4 mr-2" /> Save
                            </Button>
                             <Button onClick={handleCopyMagicLink} variant="secondary" className="bg-white border-2 border-gray-200 text-gray-700 hover:border-black flex-1 py-3">
                                 <Share2 className="w-4 h-4 mr-2" /> Link
                             </Button>
                        </div>
                    </div>
                 </div>
              </div>

              {/* ADMIN AUTH CONFIG CARD */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                 <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-purple-600 text-white rounded-lg">
                            <UserCog className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Admin Access</h2>
                            <p className="text-xs text-gray-500">Password for this panel</p>
                        </div>
                    </div>
                 </div>
                 
                 <div className="p-6 bg-gray-50/50 h-full">
                    <div className="flex flex-col gap-4">
                        <div className="w-full space-y-2">
                            <div className="relative w-full">
                                <input 
                                    type="text"
                                    value={newAdminPin}
                                    onChange={e => setNewAdminPin(e.target.value)}
                                    className="w-full border-2 border-gray-300 rounded-xl py-3 px-4 text-lg font-mono tracking-widest text-center outline-none transition-all focus:border-purple-500 focus:ring-4 focus:ring-purple-50 bg-white text-gray-900"
                                    placeholder="Enter new password"
                                />
                            </div>
                        </div>

                        <Button 
                            onClick={() => updateAdminPin(newAdminPin)}
                            disabled={!newAdminPin}
                            className="bg-purple-600 hover:bg-purple-700 text-white border-none w-full py-3"
                        >
                            <Save className="w-4 h-4 mr-2" /> Update Admin Password
                        </Button>
                    </div>
                 </div>
              </div>
          </div>

          {/* ACTIONS GRID */}
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
      </div>
  );
};