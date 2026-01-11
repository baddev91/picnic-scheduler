import React, { useState } from 'react';
import { Camera, RefreshCw, CalendarDays, Shirt, Hand, Bus, Building2, Settings2, AlertTriangle, CheckCircle2, ArrowUp, Info, Star } from 'lucide-react';
import { format, endOfWeek, addWeeks } from 'date-fns';
import { Button } from './Button';
import { AppMode, ShiftType, ShopperData, BusConfig } from '../types';
import { getSafeDateFromKey } from '../utils/validation';
import { formatDateKey } from '../constants';
import { BusInfoModal } from './BusInfoModal';

interface ShopperSummaryProps {
  shopper: ShopperData | undefined;
  isSyncing: boolean;
  syncStatus: 'idle' | 'success' | 'error';
  setShowDetailsModal: (show: boolean) => void;
  handleSubmitData: () => void;
  handleClearSession: () => void;
  setMode: (mode: AppMode) => void;
  busConfig: BusConfig;
}

export const ShopperSummary: React.FC<ShopperSummaryProps> = ({
  shopper,
  isSyncing,
  syncStatus,
  setShowDetailsModal,
  handleSubmitData,
  handleClearSession,
  setMode,
  busConfig
}) => {
  const [showBusModal, setShowBusModal] = useState(false);

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

  // Changed to 3 columns by default to fit more items
  const gridClassName = "grid-cols-3";

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
                  <div className="flex items-center gap-3 min-w-0">
                      {/* Text Logo */}
                      <span className="text-2xl font-black tracking-tighter text-[#E31837] select-none shrink-0">
                        PICNIC
                      </span>
                      <div className="flex flex-col min-w-0">
                          <h3 className="font-bold text-gray-900 truncate text-lg leading-tight">{shopper.name}</h3>
                          <div className="flex flex-wrap gap-1.5 mt-1 text-[10px] font-bold text-gray-600">
                               <span className="bg-gray-100 px-1.5 py-0.5 rounded flex items-center gap-1"><Shirt className="w-3 h-3" /> {shopper.details?.clothingSize} / {shopper.details?.shoeSize}</span>
                               <span className="bg-gray-100 px-1.5 py-0.5 rounded flex items-center gap-1"><Hand className="w-3 h-3" /> {shopper.details?.gloveSize}</span>
                               {shopper.details?.usePicnicBus && <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded flex items-center gap-1"><Bus className="w-3 h-3" /> Bus</span>}
                               {shopper.details?.isRandstad && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex items-center gap-1"><Building2 className="w-3 h-3" /> Randstad</span>}
                          </div>
                      </div>
                  </div>
                  <button onClick={() => setShowDetailsModal(true)} className="p-2 bg-gray-50 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-all shrink-0">
                       <Settings2 className="w-5 h-5" />
                  </button>
              </div>

              {/* Legend Section */}
              <div className="px-4 py-2 bg-gray-50/80 border-b flex items-center justify-center gap-4 sm:gap-6 shrink-0 backdrop-blur-sm flex-wrap">
                  <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-sm ring-2 ring-yellow-100"></div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">First Day</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm ring-2 ring-red-100"></div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">AA Shift</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm ring-2 ring-green-100"></div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Standard</span>
                  </div>
              </div>

              {/* 3. Shifts Grid (The core fix for no-scroll) */}
              <div className="flex-1 overflow-y-auto p-2 bg-gray-50/50">
                  {shifts.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2 opacity-50">
                           <CalendarDays className="w-12 h-12" />
                           <p className="text-sm">No shifts selected</p>
                      </div>
                  ) : (
                      <div className={`grid ${gridClassName} gap-1.5`}>
                          {shifts.map((s, i) => {
                              const dateObj = new Date(s.date);
                              const isFWD = shopper.details?.firstWorkingDay === s.date;
                              const isAA = s.type === ShiftType.AA;
                              const { name, hours } = getShiftDetails(s.time);
                              
                              // Logic for visual style
                              // Priority: FWD (Yellow) > AA (Red) > Standard (Green)
                              let containerClass = '';
                              let barClass = '';
                              let badgeClass = '';
                              
                              if (isFWD) {
                                  containerClass = 'bg-white border-yellow-400 shadow-yellow-100/50 ring-1 ring-yellow-200';
                                  barClass = 'bg-yellow-400';
                                  badgeClass = 'bg-yellow-50 text-yellow-800';
                              } else if (isAA) {
                                  containerClass = 'bg-white border-red-200 shadow-red-100/50';
                                  barClass = 'bg-red-500';
                                  badgeClass = 'bg-red-50 text-red-700';
                              } else {
                                  containerClass = 'bg-white border-green-200 shadow-green-100/50';
                                  barClass = 'bg-green-500';
                                  badgeClass = 'bg-green-50 text-green-700';
                              }

                              return (
                                  <div key={i} className={`relative flex flex-col items-center justify-center p-1.5 rounded-xl border shadow-sm text-center transition-all ${containerClass}`}>
                                      {/* Status Line */}
                                      <div className={`absolute top-0 left-0 w-full h-1 rounded-t-xl ${barClass}`} />
                                      
                                      {/* FWD Star Icon */}
                                      {isFWD && <div className="absolute top-1.5 right-1.5 text-yellow-500"><Star className="w-3 h-3 fill-yellow-500" /></div>}

                                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-1">
                                          {format(dateObj, 'EEE')}
                                      </div>
                                      <div className="text-sm font-black text-gray-800 leading-none mb-1">
                                          {format(dateObj, 'd')}
                                      </div>
                                      
                                      {/* Shift Name */}
                                      <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full truncate max-w-full mb-0.5 ${badgeClass}`}>
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

              {/* 4. Footer Actions (Redesigned) */}
              <div className="p-4 bg-white border-t shrink-0 relative z-20">
                  {syncStatus === 'success' ? (
                      <div className="bg-green-600 rounded-xl p-6 text-center text-white shadow-2xl animate-in zoom-in-95 duration-300">
                          <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                              <CheckCircle2 className="w-10 h-10 text-white" />
                          </div>
                          <h3 className="text-2xl font-black mb-2">All Done!</h3>
                          <p className="text-green-50 mb-4 font-medium text-lg">
                              You can now close this page.
                          </p>
                          
                          {/* Bus Info Button - Only if user uses bus */}
                          {shopper.details?.usePicnicBus && (
                              <button 
                                  onClick={() => setShowBusModal(true)}
                                  className="w-full bg-white text-purple-600 font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-sm hover:bg-gray-50 transition-all mb-4"
                              >
                                  <Bus className="w-5 h-5" /> View Picnic Bus Stops
                              </button>
                          )}

                          <div className="bg-white/10 rounded-lg p-4 border border-white/20">
                              <p className="text-xs font-bold uppercase tracking-widest text-green-200 mb-2">What's Next?</p>
                              <p className="font-bold text-white text-lg leading-tight">
                                  Please proceed with the next step on your paper sheet.
                              </p>
                          </div>
                      </div>
                  ) : (
                      <div className="space-y-3">
                           {/* Warning Box */}
                           <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-3 animate-pulse">
                                <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-yellow-800 text-sm">Action Required</h4>
                                    <p className="text-xs text-yellow-700 leading-tight">
                                        You <u>must</u> press the button below to send your schedule.
                                    </p>
                                </div>
                           </div>

                           <div className="flex gap-3">
                               <Button 
                                  onClick={() => setMode(AppMode.SHOPPER_FLOW)} 
                                  variant="secondary"
                                  className="px-4 py-3 text-sm font-bold border-gray-300"
                                  disabled={isSyncing}
                               >
                                  Edit
                               </Button>
                               <Button 
                                  onClick={handleSubmitData} 
                                  disabled={isSyncing}
                                  className={`flex-1 py-4 text-base font-black uppercase tracking-wide shadow-xl transition-all ${
                                      isSyncing ? 'bg-gray-400' : 'bg-gradient-to-r from-green-600 to-green-500 hover:to-green-400 hover:scale-[1.02]'
                                  }`}
                               >
                                  {isSyncing ? 'Sending...' : 'Submit Schedule'}
                                  {!isSyncing && <ArrowUp className="w-5 h-5 ml-2" />}
                               </Button>
                           </div>
                      </div>
                  )}
              </div>

              <BusInfoModal 
                 isOpen={showBusModal} 
                 onClose={() => setShowBusModal(false)} 
                 busConfig={busConfig}
              />
          </div>
      </div>
  );
};