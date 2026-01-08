import React, { useState } from 'react';
import { Lock, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { AppMode } from '../types';

interface AdminLoginProps {
  onLogin: (password: string) => void;
  onCancel: () => void;
  authError: boolean;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin, onCancel, authError }) => {
  const [password, setPassword] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-gray-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Access</h2>
          <p className="text-gray-500 mt-1">Enter password to continue</p>
        </div>

        <div className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onLogin(password)}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-gray-500 focus:ring-4 focus:ring-gray-100 outline-none transition-all"
            placeholder="Password"
            autoFocus
          />
          
          {authError && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Incorrect password
            </div>
          )}

          <div className="flex gap-2">
              <Button onClick={onCancel} variant="secondary" className="flex-1 py-3">
                Cancel
              </Button>
              <Button onClick={() => onLogin(password)} className="flex-[2] py-3 bg-gray-900 hover:bg-black">
                Unlock
              </Button>
          </div>
        </div>
      </div>
    </div>
  );
};