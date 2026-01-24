
import React, { useState, useEffect } from 'react';
import { Lock, AlertCircle, Clock } from 'lucide-react';
import { Button } from './Button';

interface AdminLoginProps {
  onLogin: (password: string) => void;
  onCancel: () => void;
  authError: boolean;
  lockoutTime: number | null; // New Prop
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin, onCancel, authError, lockoutTime }) => {
  const [password, setPassword] = useState('');
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
      let interval: number;
      if (lockoutTime) {
          interval = window.setInterval(() => {
              const now = Date.now();
              const diff = lockoutTime - now;
              
              if (diff <= 0) {
                  setTimeLeft('');
                  // Optional: Trigger parent to clear lockout logic if strictly needed, 
                  // but parent handles it on next click anyway.
              } else {
                  const minutes = Math.floor(diff / 60000);
                  const seconds = Math.floor((diff % 60000) / 1000);
                  setTimeLeft(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
              }
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [lockoutTime]);

  const isLocked = !!lockoutTime && timeLeft !== '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors ${isLocked ? 'bg-red-100' : 'bg-gray-100'}`}>
            {isLocked ? <Clock className="w-8 h-8 text-red-600 animate-pulse" /> : <Lock className="w-8 h-8 text-gray-600" />}
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
              {isLocked ? 'System Locked' : 'Admin Access'}
          </h2>
          <p className="text-gray-500 mt-1">
              {isLocked ? 'Too many failed attempts.' : 'Enter password to continue'}
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLocked && onLogin(password)}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-gray-500 focus:ring-4 focus:ring-gray-100 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-400"
            placeholder={isLocked ? `Try again in ${timeLeft}` : "Password"}
            disabled={isLocked}
            autoFocus
          />
          
          {authError && !isLocked && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 animate-pulse">
              <AlertCircle className="w-4 h-4" /> Incorrect password
            </div>
          )}

          {isLocked && (
             <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex flex-col items-center gap-1 border border-red-100">
                 <span className="font-bold flex items-center gap-2"><Clock className="w-4 h-4" /> Wait {timeLeft}</span>
                 <span className="text-xs opacity-80">Security lockout active</span>
             </div>
          )}

          <div className="flex gap-2">
              <Button onClick={onCancel} variant="secondary" className="flex-1 py-3">
                Cancel
              </Button>
              <Button 
                onClick={() => onLogin(password)} 
                disabled={isLocked}
                className={`flex-[2] py-3 ${isLocked ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-900 hover:bg-black'}`}
              >
                {isLocked ? 'Locked' : 'Unlock'}
              </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
