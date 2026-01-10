import React from 'react';
import { Bus, Save, MapPin, Clock } from 'lucide-react';
import { BusConfig, ShiftTime } from '../types';
import { Button } from './Button';
import { SHIFT_TIMES } from '../constants';

interface AdminBusConfigProps {
  busConfig: BusConfig;
  setBusConfig: (config: BusConfig) => void;
  onSave: () => void;
  onBack: () => void;
}

export const AdminBusConfig: React.FC<AdminBusConfigProps> = ({
  busConfig,
  setBusConfig,
  onSave,
  onBack
}) => {
  const handleTimeChange = (stopId: string, shift: ShiftTime, field: 'departure' | 'return', value: string) => {
    const updatedConfig = busConfig.map(stop => {
      if (stop.id !== stopId) return stop;
      return {
        ...stop,
        schedules: {
          ...stop.schedules,
          [shift]: {
            ...stop.schedules[shift],
            [field]: value
          }
        }
      };
    });
    setBusConfig(updatedConfig);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-xl text-purple-600">
            <Bus className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Bus Schedule Manager</h2>
            <p className="text-gray-500 text-sm">Configure pickup and drop-off times for each stop.</p>
          </div>
        </div>
        <div className="flex gap-2">
            <Button variant="secondary" onClick={onBack}>Back</Button>
            <Button onClick={onSave} className="bg-green-600 hover:bg-green-700">
                <Save className="w-4 h-4 mr-2" /> Save Schedules
            </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {busConfig.map(stop => (
          <div key={stop.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
             <div className="bg-gray-50 border-b px-6 py-4 flex justify-between items-start md:items-center flex-col md:flex-row gap-2">
                 <div>
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        {stop.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <MapPin className="w-3 h-3" />
                        <span className="font-mono">{stop.coordinates}</span>
                        <a href={stop.googleMapsLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">View Map</a>
                    </div>
                 </div>
                 <span className="text-xs font-bold uppercase bg-purple-100 text-purple-700 px-2 py-1 rounded">
                     {stop.locationName}
                 </span>
             </div>

             <div className="p-6">
                 <div className="grid grid-cols-12 gap-4 mb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                     <div className="col-span-4 md:col-span-3">Shift Type</div>
                     <div className="col-span-4 md:col-span-3 text-center">Departure To Work</div>
                     <div className="col-span-4 md:col-span-3 text-center">Return From Work</div>
                 </div>
                 
                 <div className="space-y-3">
                     {SHIFT_TIMES.map(shift => (
                         <div key={shift} className="grid grid-cols-12 gap-4 items-center py-2 border-b border-gray-50 last:border-0">
                             <div className="col-span-12 md:col-span-3 font-medium text-sm text-gray-700 flex items-center gap-2">
                                 <Clock className="w-4 h-4 text-gray-300" />
                                 {shift.split('(')[0]}
                             </div>
                             
                             <div className="col-span-6 md:col-span-3">
                                 <input 
                                     type="time" 
                                     value={stop.schedules[shift]?.departure || ''}
                                     onChange={(e) => handleTimeChange(stop.id, shift, 'departure', e.target.value)}
                                     className="w-full p-2 border rounded-lg text-center font-mono text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                 />
                             </div>

                             <div className="col-span-6 md:col-span-3">
                                 <input 
                                     type="time" 
                                     value={stop.schedules[shift]?.return || ''}
                                     onChange={(e) => handleTimeChange(stop.id, shift, 'return', e.target.value)}
                                     className="w-full p-2 border rounded-lg text-center font-mono text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                 />
                             </div>
                             
                             <div className="hidden md:block col-span-3 text-xs text-gray-400 text-right italic">
                                 {shift.match(/\((.*?)\)/)?.[1]}
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};