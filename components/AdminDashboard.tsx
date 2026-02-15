
import React, { useState } from 'react';
import { Settings2, RefreshCw, Save, Share2, CalendarRange, Table, Bus, ArrowRight, ShieldCheck, UserCog, Info, AlertTriangle, Clock, CalendarCheck, Zap, ChevronDown, ChevronUp, History, Snowflake, AlertCircle, ShieldAlert, Lock, MessageSquare, Hammer, Construction, Eye, Users, Trash2, Plus, Shield, Box } from 'lucide-react';
import { Button } from './Button';
import { AdminWizardStep, WeeklyTemplate, StaffMember } from '../types';
import { MIN_DAYS_TO_START } from '../constants';
import { AvailabilityCheatSheet } from './AvailabilityCheatSheet';
import { RecruiterStats } from './RecruiterStats';
import { StaffSettingsModal } from './StaffSettingsModal';
import { DeleteStaffConfirmModal } from './DeleteStaffConfirmModal';

interface AdminDashboardProps {
  isSuperAdmin: boolean; // NEW PROP
  currentUserName?: string; // NEW: Current logged-in user name
  isShopperAuthEnabled: boolean;
  setIsShopperAuthEnabled: (enabled: boolean) => void;
  adminShopperPinInput: string;
  setAdminShopperPinInput: (val: string) => void;
  generateRandomPin: () => void;
  saveShopperAuthSettings: (pin: string, enabled: boolean, silent?: boolean) => void;
  setAdminWizardStep: (step: AdminWizardStep) => void;
  setWizardDayIndex: (idx: number) => void;
  savedCloudTemplate: WeeklyTemplate | null;
  setTempTemplate: (t: WeeklyTemplate) => void;
  tempTemplate: WeeklyTemplate;
  adminPin: string;
  updateAdminPin: (pin: string) => void;
  superAdminPin: string;
  updateSuperAdminPin: (pin: string) => void;
  frozenPin: string;
  updateFrozenPin: (pin: string) => void;
  onGoToFrozen: () => void;
  onGoToTalks: () => void;
  staffList: StaffMember[]; // Updated type
  saveStaffList: (list: StaffMember[]) => void; // Updated type
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isSuperAdmin,
  currentUserName,
  isShopperAuthEnabled,
  setIsShopperAuthEnabled,
  adminShopperPinInput,
  setAdminShopperPinInput,
  generateRandomPin,
  saveShopperAuthSettings,
  setAdminWizardStep,
  setWizardDayIndex,
  savedCloudTemplate,
  setTempTemplate,
  tempTemplate,
  adminPin,
  updateAdminPin,
  superAdminPin,
  updateSuperAdminPin,
  frozenPin,
  updateFrozenPin,
  onGoToFrozen,
  onGoToTalks,
  staffList,
  saveStaffList
}) => {
  const [newAdminPin, setNewAdminPin] = useState(adminPin);
  const [newSuperAdminPin, setNewSuperAdminPin] = useState(superAdminPin);
  const [newFrozenPin, setNewFrozenPin] = useState(frozenPin);
  const [showRules, setShowRules] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Staff List local state
  const [newStaffName, setNewStaffName] = useState('');
  const [isNewStaffSuper, setIsNewStaffSuper] = useState(false);

  // Cheat Sheet Modal State
  const [showCheatSheet, setShowCheatSheet] = useState(false);

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Delete Staff Confirmation Modal State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);

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
      if (newAdminPin === frozenPin || newAdminPin === superAdminPin) {
          setPinError("Admin PIN cannot match other PINs.");
          return;
      }
      if (newAdminPin.length < 4) {
          setPinError("PIN too short.");
          return;
      }
      setPinError(null);
      updateAdminPin(newAdminPin);
  };

  const handleUpdateSuperAdminPin = () => {
      if (newSuperAdminPin === adminPin || newSuperAdminPin === frozenPin) {
          setPinError("Super Admin PIN cannot match other PINs.");
          return;
      }
      if (newSuperAdminPin.length < 4) {
          setPinError("PIN too short.");
          return;
      }
      setPinError(null);
      updateSuperAdminPin(newSuperAdminPin);
  };

  const handleUpdateFrozenPin = () => {
      if (newFrozenPin === adminPin || newFrozenPin === superAdminPin) {
          setPinError("Frozen PIN cannot match other PINs.");
          return;
      }
      if (newFrozenPin.length < 4) {
          setPinError("PIN too short.");
          return;
      }
      setPinError(null);
      updateFrozenPin(newFrozenPin);
  };

  const handleAddStaff = () => {
      const name = newStaffName.trim();
      if (!name) return;
      if (staffList.some(s => s.name === name)) { alert("Name already exists"); return; }
      
      const newList = [...staffList, { name, isSuperAdmin: isNewStaffSuper, isVisibleInPerformance: true }].sort((a, b) => a.name.localeCompare(b.name));
      saveStaffList(newList);
      setNewStaffName('');
      setIsNewStaffSuper(false);
  };

  const handleRemoveStaff = (member: StaffMember) => {
      // Open confirmation modal
      setStaffToDelete(member);
      setShowDeleteConfirm(true);
  };

  const confirmDeleteStaff = () => {
      if (!staffToDelete || !currentUserName) return;

      // Soft delete: mark as deleted instead of removing
      const newList = staffList.map(s => {
          if (s.name === staffToDelete.name) {
              return {
                  ...s,
                  isDeleted: true,
                  deletedAt: new Date().toISOString(),
                  deletedBy: currentUserName
              };
          }
          return s;
      });

      saveStaffList(newList);
      setShowDeleteConfirm(false);
      setStaffToDelete(null);
  };

  const toggleStaffRole = (member: StaffMember) => {
      const newList = staffList.map(s => {
          if (s.name === member.name) return { ...s, isSuperAdmin: !s.isSuperAdmin };
          return s;
      });
      saveStaffList(newList);
  };

  return (
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">

          {/* HEADER SECTION */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-4">
                  <img
                    src="/staffya-logo.jpg"
                    alt="Staffya Logo"
                    className="w-16 h-16 rounded-xl shadow-md object-cover"
                  />
                  <div>
                      <h1 className="text-3xl font-black text-gray-900 tracking-tight">Dashboard</h1>
                      <p className="text-gray-500 mt-1">
                          {isSuperAdmin ? 'Full Access: Manage schedules, settings and staff.' : 'Manage schedules and view submissions.'}
                      </p>
                  </div>
              </div>
              <div className="flex gap-2">
                 {/* My Settings Button - Only show if user is logged in with a name */}
                 {currentUserName && (
                     <button
                        onClick={() => setShowSettingsModal(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 transition-colors border border-blue-200 text-xs shadow-sm"
                     >
                         <Settings2 className="w-4 h-4" /> My Settings
                     </button>
                 )}
                 {isSuperAdmin && (
                     <button
                        onClick={onGoToFrozen}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-50 text-cyan-700 font-bold hover:bg-cyan-100 transition-colors border border-cyan-200 text-xs shadow-sm"
                     >
                         <Snowflake className="w-3 h-3" /> Frozen List View
                     </button>
                 )}
                 <Button
                    variant="secondary"
                    onClick={() => setAdminWizardStep(AdminWizardStep.VIEW_LOGS)}
                    className="flex items-center gap-2 border-gray-300 hover:border-black transition-colors text-xs"
                 >
                     <History className="w-3 h-3" /> Audit Logs
                 </Button>
                 {/* NEW SECURITY LOGS BUTTON */}
                 {isSuperAdmin && (
                     <Button
                        variant="secondary"
                        onClick={() => setAdminWizardStep(AdminWizardStep.VIEW_ACCESS_LOGS)}
                        className="flex items-center gap-2 border-gray-300 hover:border-red-500 hover:text-red-600 transition-colors text-xs bg-red-50/50"
                     >
                         <ShieldAlert className="w-3 h-3" /> Security
                     </Button>
                 )}
              </div>
          </div>

          {/* NEW LAYOUT: PRIMARY ACTIONS */}
          <div className="space-y-6">

              {/* PRIMARY ACTION: RECRUITMENT */}
              <button
                onClick={() => setAdminWizardStep(AdminWizardStep.VIEW_SUBMISSIONS)}
                className="group relative w-full bg-white border-2 border-gray-100 hover:border-blue-500 rounded-3xl p-6 sm:p-8 text-left transition-all hover:shadow-xl overflow-hidden"
              >
                  <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div className="flex items-center gap-5">
                          <div className="bg-blue-50 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-blue-100 group-hover:bg-blue-600 group-hover:border-blue-600">
                              <Table className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600 group-hover:text-white transition-colors" />
                          </div>
                          <div>
                              <h3 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight group-hover:text-blue-700 transition-colors">
                                  RECRUITMENT
                              </h3>
                              <p className="text-gray-500 text-sm sm:text-base font-medium mt-1 max-w-xl">
                                  Access the main data table, manage shopper shifts, edit profiles, and export reports.
                              </p>
                          </div>
                      </div>
                      <div className="bg-gray-50 rounded-full p-3 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all self-end md:self-center">
                          <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-blue-600" />
                      </div>
                  </div>
                  {/* Subtle Background Decoration */}
                  <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-50 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              </button>

              {/* PRIMARY ACTION: ONBOARDING */}
              <button
                onClick={onGoToTalks}
                className="group relative w-full bg-white border-2 border-gray-100 hover:border-indigo-500 rounded-3xl p-6 sm:p-8 text-left transition-all hover:shadow-xl overflow-hidden"
              >
                  <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div className="flex items-center gap-5">
                          <div className="bg-indigo-50 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-indigo-100 group-hover:bg-indigo-600 group-hover:border-indigo-600">
                              <Users className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-600 group-hover:text-white transition-colors" />
                          </div>
                          <div>
                              <h3 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight group-hover:text-indigo-700 transition-colors">
                                  ONBOARDING
                              </h3>
                              <p className="text-gray-500 text-sm sm:text-base font-medium mt-1 max-w-xl">
                                  Track shopper progress, log check-ins, monitor performance metrics, and manage onboarding sessions.
                              </p>
                          </div>
                      </div>
                      <div className="bg-gray-50 rounded-full p-3 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all self-end md:self-center">
                          <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-indigo-600" />
                      </div>
                  </div>
                  {/* Subtle Background Decoration */}
                  <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-50 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              </button>

              {/* SECONDARY ACTIONS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                  {/* 1. WEEKLY PATTERN (LOCKED for Regular Admins) */}
                  <div className={`flex flex-col h-full bg-white border border-gray-200 rounded-2xl overflow-hidden transition-all group ${isSuperAdmin ? 'hover:border-red-500 hover:shadow-lg' : 'opacity-80'}`}>
                      <div className={`p-5 flex-1 relative z-10 ${isSuperAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`} onClick={isSuperAdmin ? handleEditPattern : undefined}>
                          <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg transition-colors ${isSuperAdmin ? 'bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white' : 'bg-gray-100 text-gray-400'}`}>
                                      <CalendarRange className="w-5 h-5" />
                                  </div>
                                  <h3 className={`font-bold transition-colors ${isSuperAdmin ? 'text-gray-900 group-hover:text-red-700' : 'text-gray-500'}`}>Weekly Pattern</h3>
                              </div>
                              {!isSuperAdmin && <Lock className="w-4 h-4 text-gray-400" />}
                          </div>
                          <p className="text-xs text-gray-500 font-medium">Configure base availability rules.</p>
                      </div>
                      {/* ACTION BUTTONS */}
                      <div className="px-5 pb-4">
                          <button
                              onClick={(e) => { e.stopPropagation(); setShowCheatSheet(true); }}
                              className="w-full flex items-center justify-center gap-2 py-2 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-xl text-xs font-bold transition-colors border border-gray-200 hover:border-red-200"
                          >
                              <Eye className="w-3.5 h-3.5" /> Candidate View
                          </button>
                      </div>
                  </div>

                  {/* 2. BUS SCHEDULE */}
                  <button
                    onClick={() => setAdminWizardStep(AdminWizardStep.BUS_CONFIG)}
                    className="flex flex-col justify-between h-full bg-white border border-gray-200 p-5 rounded-2xl text-left hover:border-purple-500 hover:shadow-lg transition-all group"
                  >
                      <div>
                          <div className="flex items-center gap-3 mb-3">
                              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                  <Bus className="w-5 h-5" />
                              </div>
                              <h3 className="font-bold text-gray-900 group-hover:text-purple-700 transition-colors">Bus Schedule</h3>
                          </div>
                          <p className="text-xs text-gray-500 font-medium">Manage stops & times.</p>
                      </div>
                  </button>

                  {/* 3. BOXES CHECK (VISIBLE TO ALL, DISABLED FOR REGULAR) */}
                  <button
                    disabled={!isSuperAdmin}
                    onClick={() => {}}
                    className={`flex flex-col justify-between h-full bg-white border border-gray-200 p-5 rounded-2xl text-left transition-all group ${isSuperAdmin ? 'hover:border-teal-500 hover:shadow-lg' : 'opacity-60 cursor-not-allowed bg-gray-50'}`}
                  >
                      <div>
                          <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg transition-colors ${isSuperAdmin ? 'bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white' : 'bg-gray-100 text-gray-400'}`}>
                                      <Box className="w-5 h-5" />
                                  </div>
                                  <h3 className={`font-bold transition-colors ${isSuperAdmin ? 'text-gray-900 group-hover:text-teal-700' : 'text-gray-500'}`}>Boxes Check</h3>
                              </div>
                              {!isSuperAdmin && <Lock className="w-4 h-4 text-gray-400" />}
                          </div>
                          <p className="text-xs text-gray-500 font-medium">Inventory & Compliance.</p>
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
                                 <AlertTriangle className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                                 <span>Max <strong>5 Days Per Week</strong> (FWD + AA + Standard shifts combined).</span>
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

          {/* STAFF MANAGEMENT SECTION - SUPER ADMIN ONLY */}
          {isSuperAdmin && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden p-6 animate-in slide-in-from-bottom-2">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" /> Staff Management
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">Manage the list of Recruiters/Staff. Assign "Super Admin" for advanced access.</p>
                  
                  <div className="flex flex-col sm:flex-row gap-2 mb-4">
                      <input 
                          type="text"
                          value={newStaffName}
                          onChange={(e) => setNewStaffName(e.target.value)}
                          placeholder="Enter Staff Name (e.g. John D.)"
                          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          onKeyDown={(e) => e.key === 'Enter' && handleAddStaff()}
                      />
                      <label className={`flex items-center gap-2 px-3 rounded-lg border cursor-pointer select-none transition-all ${isNewStaffSuper ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                          <input 
                              type="checkbox" 
                              checked={isNewStaffSuper} 
                              onChange={(e) => setIsNewStaffSuper(e.target.checked)} 
                              className="hidden"
                          />
                          <Shield className="w-4 h-4" />
                          <span className="text-xs font-bold">Super</span>
                      </label>
                      <Button onClick={handleAddStaff} className="bg-blue-600 hover:bg-blue-700 h-auto py-2">
                          <Plus className="w-4 h-4 mr-1" /> Add
                      </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                      {staffList.filter(m => !m.isDeleted).length === 0 ? (
                          <span className="text-xs text-gray-400 italic">No staff members added.</span>
                      ) : (
                          staffList.filter(m => !m.isDeleted).map(member => (
                              <div key={member.name} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${member.isSuperAdmin ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                  <button
                                      onClick={() => toggleStaffRole(member)}
                                      className={`p-0.5 rounded-full transition-colors ${member.isSuperAdmin ? 'hover:bg-purple-200' : 'hover:bg-gray-300 text-gray-400'}`}
                                      title="Toggle Super Admin"
                                  >
                                      <Shield className={`w-3 h-3 ${member.isSuperAdmin ? 'fill-purple-700' : ''}`} />
                                  </button>
                                  {member.name}
                                  <button onClick={() => handleRemoveStaff(member)} className="ml-1 p-0.5 hover:bg-black/10 rounded-full transition-colors text-current opacity-60 hover:opacity-100">
                                      <Trash2 className="w-3 h-3" />
                                  </button>
                              </div>
                          ))
                      )}
                  </div>

                  {/* DELETED STAFF SECTION (Super Admin Only) */}
                  {staffList.filter(m => m.isDeleted).length > 0 && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mt-4">
                          <div className="flex items-center gap-2 mb-3">
                              <Box className="w-4 h-4 text-gray-500" />
                              <h4 className="text-sm font-bold text-gray-700">Archived Staff</h4>
                              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                                  {staffList.filter(m => m.isDeleted).length}
                              </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                              {staffList.filter(m => m.isDeleted).map(member => (
                                  <div key={member.name} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border bg-gray-100 text-gray-500 border-gray-300">
                                      {member.name}
                                      <span className="text-[10px] opacity-60">
                                          (deleted {member.deletedAt ? new Date(member.deletedAt).toLocaleDateString() : ''})
                                      </span>
                                      <button
                                          onClick={() => {
                                              if (!confirm(`Restore ${member.name}?\n\nAll their associated data (shoppers, statistics, etc.) will become visible again.`)) return;

                                              // Restore staff member
                                              const newList = staffList.map(s => {
                                                  if (s.name === member.name) {
                                                      const { isDeleted, deletedAt, deletedBy, ...rest } = s;
                                                      return rest;
                                                  }
                                                  return s;
                                              });
                                              saveStaffList(newList);
                                          }}
                                          className="ml-1 p-0.5 hover:bg-green-100 rounded-full transition-colors text-green-600 opacity-60 hover:opacity-100"
                                          title="Restore staff member"
                                      >
                                          <RefreshCw className="w-3 h-3" />
                                      </button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
              </div>
          )}

          {/* RECRUITER STATS (Available to All Admins) */}
          <div className="animate-in slide-in-from-bottom-3">
              <RecruiterStats 
                  staffList={staffList}
                  isSuperAdmin={isSuperAdmin}
                  onSaveVisibility={saveStaffList}
              />
          </div>

          {/* CONFIGURATION SECTION - HYBRID ACCESS */}
          <div className="space-y-3 animate-in slide-in-from-bottom-3">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider px-1">Access Control & Configuration</h3>
              
              {pinError && (
                  <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 animate-pulse">
                      <AlertCircle className="w-4 h-4" /> {pinError}
                  </div>
              )}

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* 1. Shopper Access - VISIBLE TO ALL ADMINS */}
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
                      
                      {/* MAGIC LINK REMOVED */}
                      <Button onClick={() => saveShopperAuthSettings(adminShopperPinInput, isShopperAuthEnabled, false)} disabled={!isShopperAuthEnabled} className="text-xs py-1.5 h-auto w-full">Save</Button>
                  </div>

                  {/* SENSITIVE PIN SETTINGS - SUPER ADMIN ONLY */}
                  {isSuperAdmin && (
                    <>
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

                      {/* 3. SUPER Admin Access */}
                      <div className="bg-purple-50 rounded-xl shadow-sm border border-purple-200 p-4 flex flex-col justify-between gap-4">
                          <div className="flex items-center gap-2 text-purple-900 font-bold text-sm">
                              <ShieldCheck className="w-4 h-4 text-purple-600" />
                              Super Admin PIN
                          </div>
                          <input 
                              type="text"
                              value={newSuperAdminPin}
                              onChange={e => { setNewSuperAdminPin(e.target.value); setPinError(null); }}
                              className="w-full border border-purple-200 rounded-lg py-1.5 px-2 text-center text-sm font-mono outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-300 bg-white"
                              placeholder="Super PIN"
                          />
                          <Button onClick={handleUpdateSuperAdminPin} disabled={!newSuperAdminPin || newSuperAdminPin === superAdminPin} className="text-xs py-1.5 h-auto bg-purple-800 hover:bg-purple-900 shadow-purple-200">
                              Update Super
                          </Button>
                      </div>

                      {/* 4. Frozen Access */}
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
                    </>
                  )}
              </div>
          </div>

          <AvailabilityCheatSheet
              isOpen={showCheatSheet}
              onClose={() => setShowCheatSheet(false)}
              weeklyTemplate={savedCloudTemplate || tempTemplate}
          />

          {/* Staff Settings Modal */}
          {currentUserName && (() => {
              const currentUser = staffList.find(s => s.name === currentUserName);
              return currentUser ? (
                  <StaffSettingsModal
                      isOpen={showSettingsModal}
                      onClose={() => setShowSettingsModal(false)}
                      currentUser={currentUser}
                      onSave={async (updatedUser) => {
                          const updatedList = staffList.map(s =>
                              s.name === updatedUser.name ? updatedUser : s
                          );
                          await saveStaffList(updatedList);
                      }}
                  />
              ) : null;
          })()}

          {/* Delete Staff Confirmation Modal */}
          {currentUserName && staffToDelete && (() => {
              const currentUser = staffList.find(s => s.name === currentUserName);
              return currentUser ? (
                  <DeleteStaffConfirmModal
                      isOpen={showDeleteConfirm}
                      onClose={() => {
                          setShowDeleteConfirm(false);
                          setStaffToDelete(null);
                      }}
                      onConfirm={confirmDeleteStaff}
                      staffName={staffToDelete.name}
                      superAdminPin={superAdminPin}
                      currentUserPin={currentUser.pin}
                      currentUserPassword={currentUser.password}
                  />
              ) : null;
          })()}
      </div>
  );
};
