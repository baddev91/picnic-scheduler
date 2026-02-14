import React, { useState } from 'react';
import { X, AlertTriangle, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from './Button';
import bcrypt from 'bcryptjs';

interface DeleteStaffConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  staffName: string;
  superAdminPin: string;
  currentUserPin?: string;
  currentUserPassword?: string;
}

export const DeleteStaffConfirmModal: React.FC<DeleteStaffConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  staffName,
  superAdminPin,
  currentUserPin,
  currentUserPassword
}) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleVerify = async () => {
    setError('');
    setIsVerifying(true);

    try {
      let isValid = false;

      // Check if user has personal credentials
      if (currentUserPin) {
        // Verify against hashed personal PIN
        isValid = await bcrypt.compare(inputValue, currentUserPin);
      } else if (currentUserPassword) {
        // Verify against hashed personal password
        isValid = await bcrypt.compare(inputValue, currentUserPassword);
      } else {
        // Fallback to shared super admin PIN
        isValid = inputValue === superAdminPin;
      }

      if (isValid) {
        onConfirm();
        setInputValue('');
        onClose();
      } else {
        setError('Invalid PIN/Password. Please try again.');
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setInputValue('');
    setError('');
    onClose();
  };

  const authLabel = currentUserPassword ? 'Password' : 'PIN';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-red-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Confirm Deletion</h2>
              <p className="text-xs text-gray-600">This action requires verification</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Warning Message */}
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
            <p className="text-sm text-gray-800">
              You are about to remove <span className="font-bold text-red-600">{staffName}</span> from the staff list.
            </p>
            <p className="text-xs text-gray-600 mt-2">
              The staff member will be archived and can be recovered later if needed.
            </p>
          </div>

          {/* PIN/Password Input */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">
              <Lock className="w-4 h-4 inline mr-1" />
              Enter your {authLabel} to confirm
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all"
                placeholder={`Enter your ${authLabel}`}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5 text-gray-400" />
                ) : (
                  <Eye className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>
            {error && (
              <p className="text-xs text-red-600 font-medium">{error}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200">
          <Button
            onClick={handleClose}
            variant="secondary"
            className="flex-1 py-3"
            disabled={isVerifying}
          >
            Cancel
          </Button>
          <Button
            onClick={handleVerify}
            className="flex-1 py-3 bg-red-600 hover:bg-red-700"
            disabled={isVerifying || !inputValue}
          >
            {isVerifying ? 'Verifying...' : 'Confirm Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
};

