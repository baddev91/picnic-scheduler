import React, { useState, useEffect, useRef } from 'react';
import { ShiftTime, ShiftType, ShopperData, AdminAvailabilityMap, ShopperDetails, ShopperStep, BusConfig, ShopperShift, AppMode } from '../types';
import { SHIFT_TIMES, formatDateKey, getShopperAllowedRange, getShopperMinDate } from '../constants';
import { Button } from './Button';
import { CalendarView } from './CalendarView';
import { MobileInstructionModal } from './MobileInstructionModal';
import { User, PlayCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { addDays, getDay, endOfWeek, addWeeks, isBefore } from 'date-fns';
import { supabase } from '../supabaseClient';
import { ShopperAAWizard } from './ShopperAAWizard';
import { ShopperSummary } from './ShopperSummary';
import { ShopperDetailsModal } from './ShopperDetailsModal';
import { FWDConfirmationModal } from './FWDConfirmationModal';
import { getSafeDateFromKey, isRestViolation, isConsecutiveDaysViolation, validateShopperRange } from '../utils/validation';

interface ShopperAppProps {
  shopperName: string;
  adminAvailability: AdminAvailabilityMap;
  savedCloudTemplate: any;
  busConfig: BusConfig;
  onExit: () => void;
}

export const ShopperApp: React.FC<ShopperAppProps> = ({
  shopperName,
  adminAvailability,
  savedCloudTemplate,
  busConfig,
  onExit
}) => {
  // State
  const [step, setStep] = useState<ShopperStep>(ShopperStep.AA_SELECTION);
  const [selections, setSelections] = useState<ShopperData[]>([{ 
      name: shopperName, 
      shifts: [], 
      details: { 
          usePicnicBus: null, civilStatus: '', gender: '', clothingSize: 'M', 
          shoeSize: '40', gloveSize: '8 (M)', isRandstad: false, address: '' 
      } 
  }]);
  
  const [aaSelection, setAaSelection] = useState<{
    weekday: { dayIndex: number | null, time: ShiftTime | null },
    weekend: { dayIndex: number | null, time: ShiftTime | null }
  }>({ weekday: { dayIndex: null, time: null }, weekend: { dayIndex: null, time: null } });

  const [fwdCounts, setFwdCounts] = useState<Record<string, number>>({});
  const [showFWDConfirmModal, setShowFWDConfirmModal] = useState(false);
  const [pendingFWD, setPendingFWD] = useState<{ date: string; shift: ShiftTime } | null>(null);
  
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [tempDetails, setTempDetails] = useState<ShopperDetails>(selections[0].details!);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showMobileInstructions, setShowMobileInstructions] = useState(false);
  const [viewMode, setViewMode] = useState<'FLOW' | 'SUMMARY'>('FLOW');

  const flowScrollContainerRef = useRef<HTMLDivElement>(null);
  const currentShopperIndex = 0; // Simplified for single shopper flow

  // Effects
  useEffect(() => {
    fetchFWDCounts();
    // Scroll reset on step change
    setTimeout(() => { if (flowScrollContainerRef.current) flowScrollContainerRef.current.scrollTop = 0; window.scrollTo(0, 0); }, 50);
    if (viewMode === 'FLOW') setShowMobileInstructions(true);
  }, [step, viewMode]);

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

      const existingDetails = selections[0].details;
      const newShopperData = { name: shopperName, shifts: newShifts, details: existingDetails };
      
      setSelections([newShopperData]);
      setStep(ShopperStep.FWD_SELECTION);
  };

  const handleFWDSelection = (dateStr: string, shift: ShiftTime) => {
      if (shift === ShiftTime.OPENING || shift === ShiftTime.NOON) { alert("Invalid First Day Shift."); return; }
      setPendingFWD({ date: dateStr, shift });
      setShowFWDConfirmModal(true);
  };

  const confirmFWDSelection = () => {
      if (!pendingFWD) return;
      const { date: dateStr, shift } = pendingFWD;
      const existing = selections[0];
      const previousFWD = existing.details?.firstWorkingDay;
      const wasAA = existing.shifts.some(s => s.date === dateStr && s.time === shift && s.type === ShiftType.AA);
      
      const newShifts = existing.shifts.filter(s => {
          if (s.date === dateStr) return false;
          if (previousFWD && s.date === previousFWD && s.type === ShiftType.STANDARD) return false;
          if (s.type === ShiftType.STANDARD && s.date < dateStr) return false;
          return true;
      });
      
      newShifts.push({ date: dateStr, time: shift, type: wasAA ? ShiftType.AA : ShiftType.STANDARD });
      setSelections([{ ...existing, shifts: newShifts, details: { ...existing.details, firstWorkingDay: dateStr } as ShopperDetails }]);
      setStep(ShopperStep.STANDARD_SELECTION);
      setShowFWDConfirmModal(false);
      setPendingFWD(null);
  };

  const handleStandardShiftToggle = (dateStr: string, shift: ShiftTime, type: ShiftType) => {
    const prevData = selections[0];
    let newShifts = [...prevData.shifts];
    const fwd = prevData.details?.firstWorkingDay;
    if (!fwd) { alert("First Working Day not set."); setStep(ShopperStep.FWD_SELECTION); return; }

    if (dateStr === fwd) { alert("You cannot change your First Working Day in this step."); return; }

    if (type === ShiftType.STANDARD) {
      const isAlreadyAA = newShifts.some(s => s.date === dateStr && s.time === shift && s.type === ShiftType.AA);
      if (isAlreadyAA) { alert("This shift is marked as Always Available."); return; }
      
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
          const rangeCheck = validateShopperRange(testShifts, fwd);
          if (!rangeCheck.valid) { alert(rangeCheck.message); return; }

          if (existingShiftIndex !== -1) newShifts.splice(existingShiftIndex, 1);
          newShifts.push(proposedShift);
      }
    }
    setSelections([{ ...prevData, shifts: newShifts }]);
  };

  const handleDetailsSubmit = () => {
    const updated = { ...selections[0], details: { ...selections[0].details, ...tempDetails } };
    setSelections([updated]);
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
    } catch (error: any) { setSyncStatus('error'); alert(`Failed: ${error.message}`); } finally { setIsSyncing(false); }
  };

  // Render Logic
  const data = selections[0];

  if (viewMode === 'SUMMARY') {
      return (
          <ShopperSummary 
              shopper={data} isSyncing={isSyncing} syncStatus={syncStatus}
              setShowDetailsModal={setShowDetailsModal} handleSubmitData={handleSubmitData}
              handleClearSession={onExit} setMode={(m) => { if (m === AppMode.SHOPPER_FLOW) setViewMode('FLOW'); }}
              busConfig={busConfig}
          />
      );
  }

  // Helper for Badge
  const getStepBadgeClass = (s: number) => {
      if (step === s) return "bg-gray-900 text-white shadow-md scale-105";
      if (step > s) return "bg-green-100 text-green-700";
      return "bg-gray-100 text-gray-400";
  };
  const aaCount = data.shifts.filter(s => s.type === ShiftType.AA).length;
  const stdCount = data.shifts.filter(s => s.type === ShiftType.STANDARD).length;

  return (
    <div className="h-[100dvh] bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white px-6 py-4 shadow-sm border-b sticky top-0 z-20 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><User className="w-5 h-5 text-gray-400" /> {shopperName}</h2>
          <div className="flex items-center gap-2 text-xs font-bold mt-1">
             <span className={`px-3 py-1 rounded-full transition-all ${getStepBadgeClass(0)}`}>1. AA Shifts</span>
             <div className="w-4 h-0.5 bg-gray-200"></div>
             <span className={`px-3 py-1 rounded-full transition-all ${getStepBadgeClass(1)}`}>2. Start Date</span>
             <div className="w-4 h-0.5 bg-gray-200"></div>
             <span className={`px-3 py-1 rounded-full transition-all ${getStepBadgeClass(2)}`}>3. Standard</span>
          </div>
        </div>
        <div className="hidden md:flex gap-4 text-xs font-medium text-gray-500">
             <span>Selected AA: <strong className="text-red-600">{aaCount}</strong></span>
             <span>Selected Standard: <strong className="text-green-600">{stdCount}</strong></span>
        </div>
      </div>

      <div ref={flowScrollContainerRef} className="flex-1 overflow-y-auto">
          {step === ShopperStep.AA_SELECTION && (
              <ShopperAAWizard savedCloudTemplate={savedCloudTemplate} aaSelection={aaSelection} setAaSelection={setAaSelection} handleAAWizardSubmit={handleAAWizardSubmit} />
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
                  <CalendarView mode="SHOPPER" step={1} isFWDSelection={true} adminAvailability={adminAvailability} currentShopperShifts={data.shifts} firstWorkingDay={data.details?.firstWorkingDay} onShopperToggle={handleFWDSelection} fwdCounts={fwdCounts} />
              </div>
          )}
          {step === ShopperStep.STANDARD_SELECTION && (
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
                  <CalendarView mode="SHOPPER" step={2} adminAvailability={adminAvailability} currentShopperShifts={data.shifts} firstWorkingDay={data.details?.firstWorkingDay} onShopperToggle={handleStandardShiftToggle} />
              </div>
          )}
      </div>

      {step === ShopperStep.STANDARD_SELECTION && (
            <div className="bg-white p-4 border-t sticky bottom-0 z-20 pb-8 md:pb-4 shadow-[0_-5px_10px_rgba(0,0,0,0.05)]">
               <div className="max-w-5xl mx-auto flex justify-between items-center">
                  <Button variant="secondary" onClick={() => setStep(ShopperStep.FWD_SELECTION)}>Back</Button>
                  <Button onClick={() => setShowDetailsModal(true)} className="px-8 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">Review & Finish <ArrowRight className="w-4 h-4 ml-2" /></Button>
               </div>
            </div>
      )}

      {/* Modals */}
      <MobileInstructionModal 
          isOpen={showMobileInstructions} 
          onClose={() => setShowMobileInstructions(false)} 
          step={step === 0 ? 'AA' : step === 1 ? 'FWD' : 'STANDARD'} 
          title={step === 0 ? 'Always Available (AA)' : step === 1 ? 'When do you start?' : 'Select Your Shifts'} 
          message={step === 0 
              ? <span>These are recurring shifts you commit to every week. Please select <strong>1 Weekday</strong> and <strong>1 Weekend</strong> shift.</span> 
              : step === 1 ? "Please select the exact day you will have your first shift. It must be a Morning or Afternoon shift." 
              : <span>Please select your standard shifts for the <strong>first 2 working weeks</strong> starting from your selected First Day.</span>
          } 
      />

      <FWDConfirmationModal 
          isOpen={showFWDConfirmModal}
          onClose={() => setShowFWDConfirmModal(false)}
          onConfirm={confirmFWDSelection}
          date={pendingFWD?.date || null}
          shift={pendingFWD?.shift || null}
      />

      <ShopperDetailsModal 
          showDetailsModal={showDetailsModal} setShowDetailsModal={setShowDetailsModal}
          tempDetails={tempDetails} setTempDetails={setTempDetails}
          handleDetailsSubmit={handleDetailsSubmit}
      />
    </div>
  );
};