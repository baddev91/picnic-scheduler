import React from 'react';
import { Camera, RefreshCw, CalendarDays, Shirt, Hand, Bus, Building2, Settings2 } from 'lucide-react';
import { format, endOfWeek, addWeeks } from 'date-fns';
import { Button } from './Button';
import { AppMode, ShiftType, ShopperData } from '../types';
import { getSafeDateFromKey } from '../utils/validation';
import { formatDateKey } from '../constants';

interface ShopperSummaryProps {
  shopper: ShopperData | undefined;
  isSyncing: boolean;
  syncStatus: 'idle' | 'success' | 'error';
  setShowDetailsModal: (show: boolean) => void;
  handleSubmitData: () => void;
  handleClearSession: () => void;
  setMode: (mode: AppMode) => void;
}

export const ShopperSummary: React.FC<ShopperSummaryProps> = ({
  shopper,
  isSyncing,
  syncStatus,
  setShowDetailsModal,
  handleSubmitData,
  handleClearSession,
  setMode
}) => {
  if (!shopper) return null;

  let shifts = [...shopper.shifts];

  // Filter shifts to show only relevant range (FWD -> End of next week)
  if (shopper.details?.firstWorkingDay) {
      const fwdDate = getSafeDateFromKey(shopper.details.firstWorkingDay);
      // Limit: Sunday of the week following the FWD week
      const limitDate = endOfWeek(addWeeks(fwdDate, 1), { weekStartsOn: 1 });
      const limitKey = formatDateKey(limitDate);
      
      shifts = shifts.filter(s => s.date >= shopper.details!.firstWorkingDay! && s.date <= limitKey);
  }

  shifts.sort((a, b) => a.date.localeCompare(b.date));

  const getShiftDetails = (t: string) => {
      const parts = t.match(/(.*?)\s\((.*?)\)/);
      if (parts) {
          return { name: parts[1], hours: parts[2] };
      }
      return { name: t.split(' ')[0], hours: '' };
  };

  const gridClassName = shifts.length <= 10 
      ? "grid-cols-2" 
      : "grid-cols-3 sm:grid-cols-4";

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
                      <div className={`grid ${gridClassName} gap-2`}>
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