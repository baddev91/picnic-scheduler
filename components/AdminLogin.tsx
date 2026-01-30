
import React, { useState, useEffect } from 'react';
import { Lock, AlertCircle, Clock, UserCheck, ChevronRight, ShieldCheck } from 'lucide-react';
import { Button } from './Button';
import { StaffMember } from '../types';

interface AdminLoginProps {
  onLogin: (password: string, staffName?: string) => void;
  onCancel: () => void;
  authError: boolean;
  lockoutTime: number | null; // New Prop
  staffList?: StaffMember[]; // Changed prop type
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin, onCancel, authError, lockoutTime, staffList = [] }) => {
  const [password, setPassword] = useState('');
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [selectedStaffName, setSelectedStaffName] = useState('');

  useEffect(() => {
      let interval: number;
      if (lockoutTime) {
          interval = window.setInterval(() => {
              const now = Date.now();
              const diff = lockoutTime - now;
              
              if (diff <= 0) {
                  setTimeLeft('');
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
  // If staff list is provided, user must select a name unless it's empty
  const isStaffSelectionRequired = staffList.length > 0;
  const canEnterPin = !isStaffSelectionRequired || selectedStaffName !== '';

  const selectedMember = staffList.find(s => s.name === selectedStaffName);
  const isSuperAdmin = selectedMember?.isSuperAdmin;

  const handleLoginClick = () => {
      onLogin(password, selectedStaffName || undefined);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors ${isLocked ? 'bg-red-100' : (isSuperAdmin ? 'bg-purple-100' : 'bg-gray-100')}`}>
            {isLocked ? <Clock className="w-8 h-8 text-red-600 animate-pulse" /> : (
                isSuperAdmin ? <ShieldCheck className="w-8 h-8 text-purple-600" /> : <Lock className="w-8 h-8 text-gray-600" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
              {isLocked ? 'System Locked' : (isSuperAdmin ? 'Super Admin Access' : 'Staff Access')}
          </h2>
          <p className="text-gray-500 mt-1">
              {isLocked ? 'Too many failed attempts.' : 'Identify yourself to continue'}
          </p>
        </div>

        <div className="space-y-4">
          
          {/* STAFF SELECTOR (If available) */}
          {isStaffSelectionRequired && (
             <div className="relative">
                 <UserCheck className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isSuperAdmin ? 'text-purple-500' : 'text-gray-400'}`} />
                 <select 
                     value={selectedStaffName}
                     onChange={(e) => setSelectedStaffName(e.target.value)}
                     className="w-full pl-10 pr-8 py-3 rounded-xl border-2 border-gray-200 focus:border-gray-500 focus:ring-4 focus:ring-gray-100 outline-none transition-all appearance-none cursor-pointer bg-white text-gray-800 font-medium"
                     disabled={isLocked}
                 >
                     <option value="" disabled>Select your name...</option>
                     {staffList.map(member => (
                         <option key={member.name} value={member.name}>
                             {member.name}
                         </option>
                     ))}
                 </select>
                 <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 rotate-90 pointer-events-none" />
             </div>
          )}

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLocked && canEnterPin && handleLoginClick()}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-gray-500 focus:ring-4 focus:ring-gray-100 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            placeholder={isLocked ? `Try again in ${timeLeft}` : (isSuperAdmin ? "Enter Super Admin PIN" : "Enter PIN Code")}
            disabled={isLocked || !canEnterPin}
            autoFocus={!isStaffSelectionRequired}
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
                onClick={handleLoginClick} 
                disabled={isLocked || !password || !canEnterPin}
                className={`flex-[2] py-3 ${isLocked || !password || !canEnterPin ? 'bg-gray-400 cursor-not-allowed' : (isSuperAdmin ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-900 hover:bg-black')}`}
              >
                {isLocked ? 'Locked' : 'Unlock'}
              </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
