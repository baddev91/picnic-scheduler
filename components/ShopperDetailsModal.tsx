
import React, { useState, useEffect } from 'react';
import { X, Bus, Shirt, Heart, AlertCircle, User, ArrowRight, Lock, MapPin, Search, Sparkles, ExternalLink, Check } from 'lucide-react';
import { Button } from './Button';
import { ShopperDetails } from '../types';
import { calculateGloveSize } from '../utils/validation';
import { GoogleGenAI } from "@google/genai";

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
  
  // Address Verification State
  const [isVerifying, setIsVerifying] = useState(false);
  const [suggestedAddress, setSuggestedAddress] = useState<string | null>(null);
  const [mapsLink, setMapsLink] = useState<string | null>(null);

  if (!showDetailsModal) return null;

  const isPermitWaiting = tempDetails.workPermitStatus === 'WAITING';

  // Helper to calculate glove size live
  const updateClothing = (size: string) => {
      setTempDetails(prev => ({
          ...prev,
          clothingSize: size,
          gloveSize: calculateGloveSize(size)
      }));
  };

  const verifyAddressWithGenAI = async (addressToVerify?: string) => {
      const inputAddr = (addressToVerify || tempDetails.address || '').trim();
      if (!inputAddr || inputAddr.length < 5) return;
      
      setIsVerifying(true);
      setSuggestedAddress(null);
      setMapsLink(null);
      setError(null);

      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: `Verify and format this address in the Netherlands: "${inputAddr}". 
                         1. If the address is valid, return the official formatted string (Street + Number + City).
                         2. If the user input is partial but likely matches a real place, suggest the full address.
                         3. If it's completely invalid, return nothing.
                         Return ONLY the address string. No other text.`,
              config: {
                  tools: [{ googleMaps: {} }],
              },
          });

          const resultText = response.text?.trim();
          
          // Extract Maps Link if available
          const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
          let uri = null;
          if (chunks) {
              const mapChunk = chunks.find((c: any) => c.web?.uri || c.maps?.uri); 
              if (mapChunk) {
                  uri = mapChunk.maps?.uri || mapChunk.web?.uri;
              }
          }

          if (resultText && resultText.length > 5) {
              // Normalize to compare
              const normalizedInput = inputAddr.toLowerCase().replace(/\s+/g, '');
              const normalizedResult = resultText.toLowerCase().replace(/\s+/g, '');

              // If suggestion is different (meaning better formatted or corrected), show it
              if (normalizedInput !== normalizedResult) {
                  setSuggestedAddress(resultText);
                  setMapsLink(uri);
              }
          }
      } catch (e) {
          console.error("Address verification failed", e);
      } finally {
          setIsVerifying(false);
      }
  };

  // Debounced Auto-Verification
  useEffect(() => {
      if (tempDetails.address && tempDetails.address.length > 8 && tempDetails.isRandstad) {
          const timer = setTimeout(() => {
              verifyAddressWithGenAI(tempDetails.address);
          }, 1000); // Wait 1 second after typing stops
          return () => clearTimeout(timer);
      }
  }, [tempDetails.address]);

  const applySuggestion = () => {
      if (suggestedAddress) {
          setTempDetails(prev => ({ ...prev, address: suggestedAddress }));
          setSuggestedAddress(null);
          setMapsLink(null);
      }
  };

  const validateAndSubmit = () => {
      setError(null);
      
      // 1. Bus Check
      if (tempDetails.usePicnicBus === null) {
          setError("Please select how you will travel to work.");
          return;
      }
      
      // 2. Civil Status Check
      if (!tempDetails.civilStatus) {
          setError("Please select your Civil Status.");
          return;
      }
      
      // 3. Gender Check
      if (!tempDetails.gender) {
          setError("Please select your Gender.");
          return;
      }

      // 4. Address Validation (Randstad Only)
      if (tempDetails.isRandstad) {
          const addr = (tempDetails.address || '').trim();
          
          if (!addr) {
              setError("Address is required for Randstad candidates.");
              return;
          }

          const isLongEnough = addr.length >= 3;

          if (!isLongEnough) {
              setError("Address is too short.");
              return;
          }
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
                   <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-2 animate-pulse">
                       <div className="flex items-center gap-2 text-sm text-red-600 font-medium">
                           <AlertCircle className="w-4 h-4 shrink-0" /> <span>{error}</span>
                       </div>
                       {/* Subtle Bypass Button */}
                       <button 
                           onClick={handleDetailsSubmit}
                           className="text-[10px] text-red-300 hover:text-red-500 underline whitespace-nowrap shrink-0"
                           title="Force save without validation"
                       >
                           Skip check
                       </button>
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
                        <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-100 relative group focus-within:ring-2 focus-within:ring-orange-200">
                            <label className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-2 block">Home Address</label>
                            
                            <div className="relative">
                                <input 
                                    value={tempDetails.address}
                                    onChange={(e) => {
                                        setTempDetails(prev => ({ ...prev, address: e.target.value }));
                                        setSuggestedAddress(null); // Reset suggestion on type
                                        if (error) setError(null);
                                    }}
                                    onBlur={() => verifyAddressWithGenAI()} // Verify on blur
                                    onKeyDown={(e) => e.key === 'Enter' && verifyAddressWithGenAI()}
                                    placeholder="Street + Number + City"
                                    className="w-full p-3 pr-20 bg-white border-2 border-orange-100 rounded-xl outline-none focus:border-orange-500 transition-all text-sm font-medium"
                                />
                                
                                {/* Verify Button inside input */}
                                <button 
                                    onClick={() => verifyAddressWithGenAI()}
                                    disabled={isVerifying || !tempDetails.address}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                                    title="Check Address with Google Maps"
                                >
                                    {isVerifying ? <Sparkles className="w-4 h-4 animate-spin" /> : (
                                        <div className="flex items-center gap-1">
                                            <Search className="w-4 h-4" />
                                            <span className="text-[10px] font-bold uppercase hidden group-hover/btn:inline">Check</span>
                                        </div>
                                    )}
                                </button>
                            </div>

                            <p className="text-[10px] text-orange-600 mt-2 flex items-start gap-1">
                                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                Please include your Street, <strong>House Number</strong> and City.
                            </p>
                        </div>

                        {/* Suggestion Box */}
                        {suggestedAddress && (
                            <div className="bg-white border border-green-200 rounded-xl p-3 shadow-md animate-in zoom-in-95 flex flex-col gap-2 ring-2 ring-green-100">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2 text-green-700 font-bold text-xs uppercase tracking-wider">
                                        <Sparkles className="w-3 h-3" /> Did you mean?
                                    </div>
                                    {mapsLink && (
                                        <a href={mapsLink} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center gap-1">
                                            View Map <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                                
                                <div className="flex gap-3 items-center">
                                    <button 
                                        onClick={applySuggestion}
                                        className="flex-1 bg-green-50 hover:bg-green-100 p-2 rounded-lg text-sm font-medium text-green-900 border border-green-200 text-left transition-colors flex items-center justify-between group/suggestion"
                                    >
                                        <span>{suggestedAddress}</span>
                                        <span className="bg-green-600 text-white text-[10px] px-2 py-1 rounded font-bold group-hover/suggestion:bg-green-700">USE THIS</span>
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-400">Google Maps Verified Address</p>
                            </div>
                        )}
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
