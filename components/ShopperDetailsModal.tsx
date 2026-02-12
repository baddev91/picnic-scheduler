
import React, { useState } from 'react';
import { X, Bus, Shirt, Heart, AlertCircle, ArrowRight, Lock, MapPin, Hash } from 'lucide-react';
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

  if (!showDetailsModal || !tempDetails) return null;

  const isPermitWaiting = tempDetails.workPermitStatus === 'WAITING';

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

      if (tempDetails.isRandstad) {
          const addr = (tempDetails.address || '').trim();
          if (!addr) {
              setError("Address is required for Randstad candidates.");
              return;
          }
          if (addr.length < 8) {
              setError("Address is too short. Please write: Street + Number + City.");
              return;
          }
          // Basic check for number in address (House number)
          if (!/\d/.test(addr)) {
              setError("Address must include a House Number (e.g. 42).");
              return;
          }
      }

      handleDetailsSubmit();
  };

  const GLOVE_SIZES = ['6 (XS)', '7 (S)', '8 (M)', '9 (L)', '10 (XL)', '11 (XXL)', '12 (3XL)', '12 (4XL)'];
  const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', '6XL'];

  // Check if the current error is related to the address field
  const isAddressError = error && (error.toLowerCase().includes('address') || error.toLowerCase().includes('house number'));

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
            
            {/* PN Number removed from this modal (kept in other forms) */}

            {/* Bus */}
            <div className="space-y-3">
               <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Bus className="w-4 h-4" /> Transport
               </label>
               
               {error && !isAddressError && (
                   <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-2 animate-pulse">
                       <div className="flex items-center gap-2 text-sm text-red-600 font-medium">
                           <AlertCircle className="w-4 h-4 shrink-0" /> <span>{error}</span>
                       </div>
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
                <div className={`flex items-center gap-3 ${isPermitWaiting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input 
                       type="checkbox" 
                       id="randstad"
                       checked={tempDetails.isRandstad}
                       disabled={isPermitWaiting}
                       onChange={(e) => setTempDetails(prev => ({ ...prev, isRandstad: e.target.checked }))}
                       className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <label htmlFor="randstad" className={`font-bold text-gray-800 select-none ${isPermitWaiting ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                       Registered via Randstad Employment Agency?
                    </label>
                    {isPermitWaiting && <Lock className="w-3 h-3 text-gray-400" />}
                </div>
                
                {isPermitWaiting && (
                    <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-100 flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3" />
                        Required for candidates waiting for work permit.
                    </p>
                )}
                
                {tempDetails.isRandstad && (
                    <div className="space-y-2 animate-in slide-in-from-top-2">
                        <div className={`p-4 rounded-xl border relative group transition-all duration-300 ${
                            isAddressError 
                            ? 'bg-red-50 border-red-300 ring-2 ring-red-100' 
                            : 'bg-orange-50/50 border-orange-100 focus-within:ring-2 focus-within:ring-orange-200'
                        }`}>
                            <label className={`text-xs font-bold uppercase tracking-wider mb-2 block ${isAddressError ? 'text-red-600' : 'text-orange-700'}`}>
                                Home Address {isAddressError && '*'}
                            </label>
                            
                            <div className="relative">
                                <input 
                                    value={tempDetails.address}
                                    onChange={(e) => {
                                        setTempDetails(prev => ({ ...prev, address: e.target.value }));
                                        if (isAddressError) setError(null);
                                    }}
                                    placeholder="Street + House Nr, Postal Code + City"
                                    className={`w-full p-3 rounded-xl outline-none transition-all text-sm font-medium border-2 ${
                                        isAddressError 
                                        ? 'bg-white border-red-300 text-red-900 placeholder:text-red-300' 
                                        : 'bg-white border-orange-100 focus:border-orange-500'
                                    }`}
                                />
                            </div>

                            {/* Specific Error Message Area */}
                            {isAddressError && (
                                <div className="flex items-start gap-2 mt-2 text-xs font-bold text-red-600 animate-in slide-in-from-top-1">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {!isAddressError && (
                                <div className="flex gap-2 mt-3 text-[11px] text-orange-700 bg-orange-100/50 p-2 rounded-lg items-start">
                                    <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                                    <p className="leading-snug">
                                        <strong>Important:</strong> Type your full address exactly as it appears on official documents.
                                        <br/>
                                        <span className="inline-block mt-1 font-mono text-xs bg-white px-2 py-0.5 rounded border border-orange-200 text-orange-800 shadow-sm">
                                            Street Name 12, 1234AB City
                                        </span>
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
         </div>

         <div className="p-4 border-t bg-gray-50">
            <Button onClick={validateAndSubmit} fullWidth className="py-4 text-base font-bold flex items-center justify-center gap-2">
               Save & Preview <ArrowRight className="w-4 h-4" />
            </Button>
         </div>
      </div>
    </div>
  );
};
