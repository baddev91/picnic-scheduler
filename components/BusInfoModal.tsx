import React, { useState, useRef, useEffect } from 'react';
import { Bus, X, MapPin, Clock, ExternalLink, ChevronRight, Navigation } from 'lucide-react';
import { BusConfig, BusStop, ShiftTime } from '../types';
import { SHIFT_TIMES } from '../constants';
import { Button } from './Button';

interface BusInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  busConfig: BusConfig;
}

export const BusInfoModal: React.FC<BusInfoModalProps> = ({
  isOpen,
  onClose,
  busConfig
}) => {
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<ShiftTime | null>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to schedule details when a shift is selected
  useEffect(() => {
    if (selectedShift && scheduleRef.current) {
        // Small timeout to ensure DOM render before scroll
        setTimeout(() => {
            scheduleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
  }, [selectedShift]);

  if (!isOpen) return null;

  const selectedStop = busConfig.find(s => s.id === selectedStopId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
       <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
           
           {/* Header */}
           <div className="p-4 bg-purple-600 text-white flex justify-between items-center shrink-0">
               <div className="flex items-center gap-2">
                   <Bus className="w-6 h-6" />
                   <h3 className="font-bold text-lg">Picnic Bus Stops</h3>
               </div>
               <button onClick={onClose} className="p-2 hover:bg-purple-700 rounded-full transition-colors">
                   <X className="w-5 h-5" />
               </button>
           </div>

           <div className="flex-1 overflow-y-auto p-6 bg-gray-50 scroll-smooth">
               {!selectedStop ? (
                   /* VIEW 1: SELECT STOP */
                   <div className="space-y-4">
                       <p className="text-gray-600 font-medium text-center mb-6">
                           Please select your pickup location to view exact details and schedule.
                       </p>
                       {busConfig.map(stop => (
                           <button 
                                key={stop.id}
                                onClick={() => setSelectedStopId(stop.id)}
                                className="w-full bg-white p-4 rounded-xl shadow-sm border-2 border-transparent hover:border-purple-500 hover:shadow-md transition-all flex justify-between items-center group text-left"
                           >
                               <div className="flex items-center gap-4">
                                   <div className="bg-purple-100 p-3 rounded-full text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                       <MapPin className="w-6 h-6" />
                                   </div>
                                   <div>
                                       <h4 className="font-bold text-gray-800 text-lg leading-tight">{stop.name}</h4>
                                       <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Click to view info</span>
                                   </div>
                               </div>
                               <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-purple-600" />
                           </button>
                       ))}
                   </div>
               ) : (
                   /* VIEW 2: STOP DETAILS */
                   <div className="space-y-6 animate-in slide-in-from-right duration-300 pb-4">
                       <button 
                           onClick={() => { setSelectedStopId(null); setSelectedShift(null); }}
                           className="text-xs font-bold text-gray-500 hover:text-purple-600 flex items-center gap-1 mb-2"
                       >
                           <ChevronRight className="w-3 h-3 rotate-180" /> Back to list
                       </button>

                       <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 text-center space-y-3">
                           <h2 className="text-2xl font-black text-gray-900 leading-tight">{selectedStop.name}</h2>
                           
                           <div className="bg-orange-50 inline-block px-3 py-1 rounded-lg border border-orange-100">
                               <p className="text-orange-800 text-xs font-bold uppercase tracking-wider">{selectedStop.locationName}</p>
                           </div>

                           <div className="flex justify-center items-center gap-2 text-xs text-gray-400 font-mono">
                                <Navigation className="w-3 h-3" />
                                {selectedStop.coordinates}
                           </div>

                           <a 
                               href={selectedStop.googleMapsLink}
                               target="_blank"
                               rel="noreferrer"
                               className="flex items-center justify-center gap-2 w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg mt-2"
                           >
                               <ExternalLink className="w-4 h-4" /> Open in Google Maps
                           </a>
                       </div>

                       <div className="space-y-3">
                           <h4 className="font-bold text-gray-700 flex items-center gap-2">
                               <Clock className="w-4 h-4" /> Check Timetable
                           </h4>
                           <p className="text-xs text-gray-500">Select your shift type to see departure times.</p>
                           
                           <div className="grid grid-cols-2 gap-2">
                               {SHIFT_TIMES.map(shift => {
                                   const isSelected = selectedShift === shift;
                                   const shortName = shift.split('(')[0];
                                   return (
                                       <button 
                                            key={shift}
                                            onClick={() => setSelectedShift(shift)}
                                            className={`py-3 px-2 rounded-lg text-sm font-bold border-2 transition-all ${
                                                isSelected 
                                                ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                                            }`}
                                       >
                                           {shortName}
                                       </button>
                                   );
                               })}
                           </div>

                           {selectedShift && (
                               <div ref={scheduleRef} className="bg-purple-50 border border-purple-100 p-5 rounded-xl mt-4 animate-in zoom-in duration-200">
                                   <h5 className="text-center font-bold text-purple-900 mb-4 uppercase tracking-widest text-xs">
                                       Schedule for {selectedShift.split('(')[0]} Shift
                                   </h5>
                                   <div className="flex justify-between items-center divide-x divide-purple-200">
                                       <div className="flex-1 text-center pr-4">
                                            <span className="block text-[10px] text-purple-600 uppercase font-bold mb-1">Departure to Work</span>
                                            <span className="text-3xl font-black text-gray-900">
                                                {selectedStop.schedules[selectedShift]?.departure || '--:--'}
                                            </span>
                                       </div>
                                       <div className="flex-1 text-center pl-4">
                                            <span className="block text-[10px] text-purple-600 uppercase font-bold mb-1">Return from Work</span>
                                            <span className="text-3xl font-black text-gray-900">
                                                {selectedStop.schedules[selectedShift]?.return || '--:--'}
                                            </span>
                                       </div>
                                   </div>
                               </div>
                           )}
                       </div>
                   </div>
               )}
           </div>

           <div className="p-4 bg-white border-t">
               <Button variant="secondary" fullWidth onClick={onClose}>
                   Close
               </Button>
           </div>
       </div>
    </div>
  );
};