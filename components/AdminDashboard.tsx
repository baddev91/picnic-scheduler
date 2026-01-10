import React from 'react';
import { Settings2, KeyRound, RefreshCw, Save, Share2, CalendarRange, Table, Bus } from 'lucide-react';
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
  tempTemplate
}) => {
  const handleEditPattern = () => {
    // Force load from cloud template if available, otherwise check local
    if (savedCloudTemplate) {
         setTempTemplate(savedCloudTemplate);
    } else if (Object.keys(tempTemplate).length === 0) {
        setTempTemplate({}); // Clean init handled by component if needed
    }
    setWizardDayIndex(1); // Mon
    setAdminWizardStep(AdminWizardStep.WIZARD_DAYS);
  };

  const toggleAuth = () => {
      const newValue = !isShopperAuthEnabled;
      setIsShopperAuthEnabled(newValue);
      // Auto-save silently when toggling
      saveShopperAuthSettings(adminShopperPinInput, newValue, true);
  };

  return (
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
                             onClick={toggleAuth}
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
                                onClick={() => saveShopperAuthSettings(adminShopperPinInput, isShopperAuthEnabled, false)} 
                                disabled={isShopperAuthEnabled && adminShopperPinInput.length !== 6}
                                className="whitespace-nowrap"
                            >
                                <Save className="w-4 h-4 mr-2" /> Update PIN
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
                onClick={handleEditPattern}
                className="group p-6 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl shadow-lg text-left hover:scale-[1.02] transition-all relative overflow-hidden"
              >
                  <div className="relative z-10">
                      <CalendarRange className="w-10 h-10 text-white mb-4 opacity-90" />
                      <h3 className="text-2xl font-bold text-white mb-2">Edit Weekly Pattern</h3>
                      <p className="text-purple-100 text-sm">Guided wizard to set AA & Standard slots. Loads from Cloud if available.</p>
                  </div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl"></div>
              </button>

              <div className="space-y-6">
                <button 
                    onClick={() => setAdminWizardStep(AdminWizardStep.VIEW_SUBMISSIONS)}
                    className="w-full group p-6 bg-white border-2 border-gray-100 rounded-2xl shadow-sm text-left hover:border-green-200 hover:bg-green-50 transition-all"
                >
                    <Table className="w-10 h-10 text-green-600 mb-4" />
                    <h3 className="text-xl font-bold text-gray-800 mb-2">View Submissions</h3>
                    <p className="text-gray-500 text-sm">View, search, and manage data submitted by shoppers.</p>
                </button>

                <button 
                    onClick={() => setAdminWizardStep(AdminWizardStep.BUS_CONFIG)}
                    className="w-full group p-6 bg-white border-2 border-gray-100 rounded-2xl shadow-sm text-left hover:border-orange-200 hover:bg-orange-50 transition-all"
                >
                    <Bus className="w-10 h-10 text-orange-600 mb-4" />
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Manage Bus Schedule</h3>
                    <p className="text-gray-500 text-sm">Update pickup locations and times.</p>
                </button>
              </div>
          </div>
      </div>
  );
};