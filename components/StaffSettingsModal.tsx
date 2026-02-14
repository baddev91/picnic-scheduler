import React, { useState } from 'react';
import { X, Lock, Key, Shield, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from './Button';
import { StaffMember } from '../types';
import bcrypt from 'bcryptjs';

interface StaffSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: StaffMember;
  onSave: (updatedUser: StaffMember) => Promise<void>;
}

export const StaffSettingsModal: React.FC<StaffSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSave
}) => {
  const [authType, setAuthType] = useState<'PIN' | 'PASSWORD'>(
    currentUser.password ? 'PASSWORD' : 'PIN'
  );
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const hasPersonalCredentials = !!(currentUser.pin || currentUser.password);

  const handleSave = async () => {
    setError(null);
    setSuccess(false);

    // Validation
    if (authType === 'PIN') {
      if (!newPin || newPin.length < 4 || newPin.length > 6) {
        setError('PIN must be 4-6 digits');
        return;
      }
      if (!/^\d+$/.test(newPin)) {
        setError('PIN must contain only numbers');
        return;
      }
      if (newPin !== confirmPin) {
        setError('PINs do not match');
        return;
      }
    } else {
      if (!newPassword || newPassword.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setIsSaving(true);
    try {
      // Hash the PIN or password before saving
      let hashedPin: string | undefined = undefined;
      let hashedPassword: string | undefined = undefined;

      if (authType === 'PIN') {
        // Hash the PIN with bcrypt (10 rounds)
        hashedPin = await bcrypt.hash(newPin, 10);
      } else {
        // Hash the password with bcrypt (10 rounds)
        hashedPassword = await bcrypt.hash(newPassword, 10);
      }

      const updatedUser: StaffMember = {
        ...currentUser,
        pin: hashedPin,
        password: hashedPassword,
      };

      await onSave(updatedUser);
      setSuccess(true);
      setNewPin('');
      setConfirmPin('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Lock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">My Settings</h2>
              <p className="text-xs text-gray-500">Manage your security</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Profile Section */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${currentUser.isSuperAdmin ? 'bg-purple-100' : 'bg-gray-200'}`}>
                {currentUser.isSuperAdmin ? (
                  <Shield className="w-6 h-6 text-purple-600" />
                ) : (
                  <span className="text-lg font-bold text-gray-600">
                    {currentUser.name.charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <p className="font-bold text-gray-900">{currentUser.name}</p>
                <p className={`text-xs font-bold ${currentUser.isSuperAdmin ? 'text-purple-600' : 'text-gray-500'}`}>
                  {currentUser.isSuperAdmin ? 'Super Admin' : 'Recruiter'}
                </p>
              </div>
            </div>
          </div>

          {/* Current Status */}
          <div className="flex items-center gap-2 text-sm">
            <Key className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">
              Current: {hasPersonalCredentials ? (
                <span className="font-bold text-green-600">Personal {currentUser.password ? 'Password' : 'PIN'}</span>
              ) : (
                <span className="font-bold text-orange-600">Shared PIN</span>
              )}
            </span>
          </div>

          {/* Auth Type Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setAuthType('PIN')}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                authType === 'PIN'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Use PIN
            </button>
            <button
              onClick={() => setAuthType('PASSWORD')}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                authType === 'PASSWORD'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Use Password
            </button>
          </div>

          {/* Input Fields */}
          {authType === 'PIN' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  New PIN (4-6 digits)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-center text-2xl tracking-widest"
                  placeholder="••••"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Confirm PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-center text-2xl tracking-widest"
                  placeholder="••••"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  New Password (min 6 characters)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                  placeholder="Confirm password"
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 animate-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg border border-green-200 animate-in slide-in-from-top-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">Settings saved successfully!</span>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              <strong>Note:</strong> Your personal {authType === 'PIN' ? 'PIN' : 'password'} will be used for login instead of the shared credentials.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200">
          <Button
            onClick={onClose}
            variant="secondary"
            className="flex-1 py-3"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700"
            disabled={isSaving || (!newPin && !newPassword)}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
};
