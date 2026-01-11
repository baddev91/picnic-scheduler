import React from 'react';
import { KeyRound, ArrowRight, User, Sparkles } from 'lucide-react';
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
  // PIN Verification Screen
  if (showShopperAuth) {
      return (
          <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden">
              {/* Decorative Blurs */}
              <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-200/30 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-red-200/30 rounded-full blur-3xl pointer-events-none"></div>

              <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 w-full max-w-sm text-center space-y-6 animate-in zoom-in-95 duration-300 relative z-10">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-50 to-purple-100 rounded-full flex items-center justify-center mx-auto shadow-inner">
                      <KeyRound className="w-8 h-8 text-purple-600" />
                  </div>
                  <div>
                      <h2 className="text-2xl font-black text-gray-900 tracking-tight">Security Check</h2>
                      <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                          This session is protected. <br/>Please enter the PIN to continue.
                      </p>
                  </div>
                  <div className="space-y-4">
                      <input 
                          type="text" 
                          inputMode="numeric"
                          maxLength={6}
                          value={enteredShopperPin}
                          onChange={(e) => setEnteredShopperPin(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleVerifyShopperPin()}
                          className="w-full text-center text-3xl tracking-[0.5em] font-mono py-4 border-2 border-gray-100 rounded-2xl focus:border-purple-500 focus:ring-4 focus:ring-purple-50 outline-none bg-gray-50 focus:bg-white transition-all text-gray-800 placeholder:text-gray-300"
                          placeholder="••••••"
                          autoFocus
                      />
                      <div className="flex gap-3 pt-2">
                          <Button onClick={() => setShowShopperAuth(false)} variant="secondary" className="flex-1 py-3 rounded-xl border-gray-200">
                              Back
                          </Button>
                          <Button onClick={handleVerifyShopperPin} className="flex-[2] py-3 bg-gray-900 hover:bg-black text-white rounded-xl shadow-lg shadow-gray-200">
                              Verify
                          </Button>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  // Default View: Homepage
  return (
    <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
       
       {/* Decorative Background Elements */}
       <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-50/50 rounded-full blur-[100px] pointer-events-none opacity-60 translate-x-1/3 -translate-y-1/3"></div>
       <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-green-50/50 rounded-full blur-[100px] pointer-events-none opacity-60 -translate-x-1/3 translate-y-1/3"></div>

       <div className="w-full max-w-sm animate-in slide-in-from-bottom-4 duration-500 space-y-8 relative z-10">
          
          {/* Logo Section */}
          <div className="text-center space-y-6">
             <h1 className="text-6xl font-black tracking-tighter text-[#E31837] select-none drop-shadow-sm">
               PICNIC
             </h1>
             
             <div className="relative inline-block">
                 <div className="w-24 h-24 bg-gradient-to-b from-red-50 to-white rounded-full flex items-center justify-center mx-auto border border-red-100 shadow-sm relative z-10">
                    <User className="w-10 h-10 text-[#E31837]" strokeWidth={2.5} />
                 </div>
                 <div className="absolute -top-1 -right-1 z-20 bg-yellow-400 rounded-full p-1.5 border-2 border-white shadow-sm animate-pulse">
                     <Sparkles className="w-4 h-4 text-yellow-900" />
                 </div>
             </div>

             <div className="space-y-2">
                <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Welcome!</h2>
                <p className="text-gray-500 text-sm font-medium">
                    Let's get you started.<br/>Please enter your <strong>Full Name</strong> below.
                </p>
             </div>
          </div>
          
          {/* Input Section */}
          <div className="space-y-4 pt-2">
             <div className="relative group">
                 <input 
                   value={tempNameInput}
                   onChange={(e) => setTempNameInput(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' && tempNameInput.trim()) {
                       handleStartShopperClick();
                     }
                   }}
                   placeholder="e.g. John Doe"
                   className="w-full text-center text-xl font-bold py-5 px-6 rounded-2xl bg-gray-50 border-2 border-transparent focus:bg-white focus:border-[#E31837] outline-none transition-all duration-300 placeholder:text-gray-300 placeholder:font-medium shadow-sm group-hover:bg-gray-100/80 focus:shadow-xl focus:shadow-red-100/50"
                   autoFocus
                 />
             </div>

             <button 
               disabled={!tempNameInput.trim() || tempNameInput.trim().split(' ').length < 2} 
               onClick={handleStartShopperClick}
               className="w-full py-5 text-lg font-bold rounded-2xl text-white shadow-xl shadow-green-200 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
             >
               Start Scheduling <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
             </button>

             <div className="h-6">
                {tempNameInput.trim() && tempNameInput.trim().split(' ').length < 2 && (
                    <p className="text-xs text-center text-orange-500 font-bold bg-orange-50 py-1 px-3 rounded-full w-fit mx-auto animate-in fade-in slide-in-from-top-1">
                        Please enter both First and Last name.
                    </p>
                )}
             </div>
          </div>
       </div>

       {/* Footer */}
       <div className="absolute bottom-6 w-full text-center z-10">
           <button 
              onClick={() => setMode(AppMode.ADMIN)}
              className="px-4 py-2 rounded-full text-[10px] font-bold text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-all uppercase tracking-widest"
           >
              Staff Login
           </button>
       </div>
    </div>
  );
};