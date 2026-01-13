import React, { useState } from 'react';
import { X, Bus, Shirt, Heart, AlertCircle, User } from 'lucide-react';
import { Button } from './Button';
import { ShopperDetails } from '../types';
import { calculateGloveSize } from '../utils/validation';

interface ShopperDetailsModalProps {
  showDetailsModal: boolean;
  setShowDetailsModal: (show: boolean) => void;
  tempDetails: ShopperDetails;
  setTempDetails: React.Dispatch<React.SetStateAction<ShopperDetails>>;
  handleDetailsSubmit: () => void;
}

export const ShopperDetailsModal: React.FC<ShopperDetailsModalProps> = ({
  showDetailsModal,
  setShowDetailsModal,
  tempDetails,
  setTempDetails,
  handleDetailsSubmit
}) => {
  const [error, setError] = useState<string | null>(null);

  if (!showDetailsModal) return null;

  // Helper to calculate glove size live
  const updateClothing = (size: string) => {
      setTempDetails(prev => ({
          ...prev,
          clothingSize: size,
          gloveSize: calculateGloveSize(size)
      }));
  };

  const validateAndSubmit = () => {
      setError(null);
      if (tempDetails.usePicnicBus === null) {
          setError("Please select how you will travel to work.");
          return;
      }
      if (!tempDetails.civilStatus) {
          setError("Please select your Civil Status.");
          return;
      }
      if (!tempDetails.gender) {
          setError("Please select your Gender.");
          return;
      }
      handleDetailsSubmit();
  };

  const GLOVE_SIZES = ['6 (XS)', '7 (S)', '8 (M)', '9 (L)', '10 (XL)', '11 (XXL)', '12 (3XL)', '12 (4XL)'];
  const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', '6XL'];

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10">
         <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-lg text-gray-800">Complete Profile</h3>
            <button onClick={() => setShowDetailsModal(false)} className="p-2 hover:bg-gray-200 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
            </button>
         </div>

         <div className="p-6 overflow-y-auto space-y-6">
            
            {/* Bus */}
            <div className="space-y-3">
               <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Bus className="w-4 h-4" /> Transport
               </label>
               
               {error && (
                   <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-600 font-medium">
                       <AlertCircle className="w-4 h-4" /> {error}
                   </div>
               )}

               <div className="grid grid-cols-2 gap-4">
                  <button 
                     onClick={() => { setTempDetails(prev => ({ ...prev, usePicnicBus: true })); setError(null); }}
                     className={`p-4 rounded-xl border-2 transition-all text-sm font-bold ${
                         tempDetails.usePicnicBus === true 
                         ? 'border-purple-600 bg-purple-50 text-purple-700' 
                         : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
                     }`}
                  >
                     I need the Picnic Bus
                  </button>
                  <button 
                     onClick={() => { setTempDetails(prev => ({ ...prev, usePicnicBus: false })); setError(null); }}
                     className={`p-4 rounded-xl border-2 transition-all text-sm font-bold ${
                         tempDetails.usePicnicBus === false 
                         ? 'border-purple-600 bg-purple-50 text-purple-700' 
                         : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
                     }`}
                  >
                     I have my own transport
                  </button>
               </div>
            </div>

            {/* Sizes */}
            <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                   <Shirt className="w-4 h-4" /> Sizes
                </label>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="text-xs text-gray-500 mb-1 block">Clothing Size</label>
                      <select 
                          value={tempDetails.clothingSize}
                          onChange={(e) => updateClothing(e.target.value)}
                          className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                      >
                          {CLOTHING_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                   </div>
                   <div>
                      <label className="text-xs text-gray-500 mb-1 block">Shoe Size</label>
                      <select 
                          value={tempDetails.shoeSize}
                          onChange={(e) => setTempDetails(prev => ({ ...prev, shoeSize: e.target.value }))}
                          className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                      >
                          {Array.from({length: 15}, (_, i) => 35 + i).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                   </div>
                </div>
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Glove Size</label>
                    <select
                        value={tempDetails.gloveSize}
                        onChange={(e) => setTempDetails(prev => ({ ...prev, gloveSize: e.target.value }))}
                        className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        {GLOVE_SIZES.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Civil Status & Gender */}
            <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                   <Heart className="w-4 h-4" /> Personal Info
                </label>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Civil Status</label>
                        <select 
                            value={tempDetails.civilStatus || ''}
                            onChange={(e) => setTempDetails(prev => ({ ...prev, civilStatus: e.target.value }))}
                            className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="" disabled>Select...</option>
                            <option value="Single">Single</option>
                            <option value="Married">Married</option>
                            <option value="Cohabit">Cohabit</option>
                            <option value="Divorced">Divorced</option>
                            <option value="Legal separation">Legal separation</option>
                            <option value="Registered partnership">Registered partnership</option>
                            <option value="widowed">widowed</option>
                            <option value="Engaged">Engaged</option>
                            <option value="unknown">unknown</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Gender</label>
                        <select 
                            value={tempDetails.gender || ''}
                            onChange={(e) => setTempDetails(prev => ({ ...prev, gender: e.target.value }))}
                            className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="" disabled>Select...</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="N/D">N/D</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Randstad */}
            <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-3">
                    <input 
                       type="checkbox" 
                       id="randstad"
                       checked={tempDetails.isRandstad}
                       onChange={(e) => setTempDetails(prev => ({ ...prev, isRandstad: e.target.checked }))}
                       className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <label htmlFor="randstad" className="font-bold text-gray-800">
                       Registered via Randstad?
                    </label>
                </div>
                
                {tempDetails.isRandstad && (
                    <div className="animate-in slide-in-from-top-2">
                        <label className="text-xs text-gray-500 mb-1 block">Home Address (Required for Taxi)</label>
                        <input 
                            value={tempDetails.address}
                            onChange={(e) => setTempDetails(prev => ({ ...prev, address: e.target.value }))}
                            placeholder="Street, Number, City"
                            className="w-full p-3 bg-white border-2 border-orange-100 rounded-xl outline-none focus:border-orange-500"
                        />
                    </div>
                )}
            </div>
         </div>

         <div className="p-4 border-t bg-gray-50">
            <Button onClick={validateAndSubmit} fullWidth disabled={tempDetails.isRandstad && !tempDetails.address}>
               Save Profile
            </Button>
         </div>
      </div>
    </div>
  );
};