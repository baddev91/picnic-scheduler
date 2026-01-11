import React from 'react';
import { KeyRound, ArrowRight, UserCheck } from 'lucide-react';
import { Button } from './Button';
import { AppMode } from '../types';

interface ShopperSetupProps {
  showShopperAuth: boolean;
  setShowShopperAuth: (show: boolean) => void;
  enteredShopperPin: string;
  setEnteredShopperPin: (pin: string) => void;
  handleVerifyShopperPin: () => void;
  tempNameInput: string;
  setTempNameInput: (name: string) => void;
  handleStartShopperClick: () => void;
  setMode: (mode: AppMode) => void;
}

export const ShopperSetup: React.FC<ShopperSetupProps> = ({
  showShopperAuth,
  setShowShopperAuth,
  enteredShopperPin,
  setEnteredShopperPin,
  handleVerifyShopperPin,
  tempNameInput,
  setTempNameInput,
  handleStartShopperClick,
  setMode
}) => {
  // If PIN is configured and user tried to start (showShopperAuth is true) -> Show PIN Screen
  if (showShopperAuth) {
      return (
          <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center space-y-6 animate-in zoom-in-95">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                      <KeyRound className="w-8 h-8 text-purple-600" />
                  </div>
                  <div>
                      <h2 className="text-xl font-bold text-gray-900">Protected Session</h2>
                      <p className="text-gray-500 text-sm mt-1">Please enter the PIN to continue.</p>
                  </div>
                  <div className="space-y-4">
                      <input 
                          type="text" 
                          inputMode="numeric"
                          maxLength={6}
                          value={enteredShopperPin}
                          onChange={(e) => setEnteredShopperPin(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleVerifyShopperPin()}
                          className="w-full text-center text-2xl tracking-[0.5em] font-mono py-3 border-b-2 border-gray-300 focus:border-purple-600 outline-none bg-transparent transition-colors"
                          placeholder="••••••"
                          autoFocus
                      />
                      <div className="flex gap-2">
                          <Button onClick={() => setShowShopperAuth(false)} variant="secondary" className="flex-1">
                              Back
                          </Button>
                          <Button onClick={handleVerifyShopperPin} className="flex-[2] bg-purple-600 hover:bg-purple-700">
                              Verify PIN
                          </Button>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  // Default View: Homepage
  return (
    <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-between p-6">
       
       <div className="w-full flex justify-center pt-10 pb-4">
           {/* Used a high-availability PNG version of the logo */}
           <img 
             src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Picnic_logo.svg/2560px-Picnic_logo.svg.png" 
             alt="Picnic" 
             className="h-16 w-auto object-contain" 
           />
       </div>

       <div className="w-full max-w-sm animate-in zoom-in duration-300 space-y-8">
          <div className="text-center space-y-2">
             <div className="inline-block p-3 bg-red-50 text-[#E31837] rounded-full mb-2">
                <UserCheck className="w-8 h-8" />
             </div>
             <h1 className="text-3xl font-extrabold text-gray-900">Welcome!</h1>
             <p className="text-gray-500">Please enter your <strong>Full Name</strong> (First & Last Name) to start.</p>
          </div>
          
          <div className="space-y-4">
             <input 
               value={tempNameInput}
               onChange={(e) => setTempNameInput(e.target.value)}
               onKeyDown={(e) => {
                 if (e.key === 'Enter' && tempNameInput.trim()) {
                   handleStartShopperClick();
                 }
               }}
               placeholder="e.g. John Doe"
               className="w-full border-b-2 border-gray-200 py-4 text-center text-2xl font-medium outline-none focus:border-[#E31837] transition-colors placeholder:text-gray-300"
               autoFocus
             />

             <Button 
               disabled={!tempNameInput.trim() || tempNameInput.trim().split(' ').length < 2} 
               onClick={handleStartShopperClick}
               fullWidth
               className="py-4 text-lg bg-[#E31837] hover:bg-red-700 shadow-lg rounded-full"
             >
               Start <ArrowRight className="w-5 h-5 ml-2" />
             </Button>
             {tempNameInput.trim() && tempNameInput.trim().split(' ').length < 2 && (
                 <p className="text-xs text-center text-orange-500 font-medium animate-pulse">
                     Please enter both First and Last name.
                 </p>
             )}
          </div>
       </div>

       <div className="w-full pb-4 text-center">
           <button 
              onClick={() => setMode(AppMode.ADMIN)}
              className="text-xs font-bold text-gray-300 hover:text-gray-500 transition-colors uppercase tracking-widest"
           >
              Staff Login
           </button>
       </div>
    </div>
  );
};