import React from 'react';
import { Shield, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from './Button';

interface SecurityUpdateModalProps {
  isOpen: boolean;
  onContinue: () => void;
  userName: string;
}

export const SecurityUpdateModal: React.FC<SecurityUpdateModalProps> = ({
  isOpen,
  onContinue,
  userName
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4 md:p-6 backdrop-blur-sm">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto animate-in fade-in zoom-in duration-300">
        {/* Header with Icon */}
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-4 sm:p-6 md:p-8 rounded-t-xl sm:rounded-t-2xl text-white">
          <div className="flex items-center justify-center mb-3 sm:mb-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-center">Security Update</h2>
          <p className="text-blue-100 text-center mt-1 sm:mt-2 text-xs sm:text-sm">
            Important changes to keep your account safe
          </p>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
          {/* Welcome Message */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
            <p className="text-sm sm:text-base text-gray-800 font-medium">
              Welcome back, <span className="font-bold text-blue-700">{userName}</span>! 👋
            </p>
          </div>

          {/* What Changed */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-1">
                <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-0.5 sm:mb-1">Enhanced Security</h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  We've upgraded our security system. All passwords and PINs are now encrypted using industry-standard bcrypt hashing.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-1">
                <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-0.5 sm:mb-1">Action Required</h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  To continue using the system, you need to set up your personal PIN or password. This will replace the shared PIN for your account.
                </p>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-purple-200">
            <h4 className="font-bold text-gray-900 mb-2 sm:mb-3 text-xs sm:text-sm">Why this matters:</h4>
            <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold mt-0.5">✓</span>
                <span>Your credentials are now encrypted and secure</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold mt-0.5">✓</span>
                <span>Each staff member has their own unique login</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold mt-0.5">✓</span>
                <span>Better accountability and access control</span>
              </li>
            </ul>
          </div>

          {/* Instructions */}
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs sm:text-sm text-gray-800 font-medium">
                  After clicking continue, look for the <span className="font-bold text-blue-600">"My Settings"</span> button in the dashboard header to set up your personal PIN or password.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 md:p-6 bg-gray-50 rounded-b-xl sm:rounded-b-2xl border-t border-gray-200">
          <Button
            onClick={onContinue}
            className="w-full py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-base sm:text-lg shadow-lg"
          >
            Continue to Dashboard
          </Button>
          <p className="text-[10px] sm:text-xs text-gray-500 text-center mt-2 sm:mt-3">
            You can set up your credentials anytime from the dashboard
          </p>
        </div>
      </div>
    </div>
  );
};

