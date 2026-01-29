
import React from 'react';
import { CheckCircle2, Sparkles, X, AlertCircle, ArrowRight, RefreshCw, Users } from 'lucide-react';
import { Button } from './Button';

export interface SyncResultData {
  isOpen: boolean;
  updatedCount: number;
  createdCount: number;
  totalRowsProcessed: number;
  isError?: boolean;
  errorMessage?: string;
}

interface SyncResultModalProps {
  result: SyncResultData | null;
  onClose: () => void;
}

export const SyncResultModal: React.FC<SyncResultModalProps> = ({ result, onClose }) => {
  if (!result || !result.isOpen) return null;

  const hasChanges = result.updatedCount > 0 || result.createdCount > 0;
  const isZeroState = !hasChanges && !result.isError;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm md:max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-white/20">
        
        {/* Header Graphic */}
        <div className={`h-32 w-full flex items-center justify-center relative overflow-hidden ${
            result.isError ? 'bg-red-50' : 
            hasChanges ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gray-100'
        }`}>
            {/* Background Patterns */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
            
            <div className={`p-4 rounded-full shadow-lg relative z-10 ${
                result.isError ? 'bg-white text-red-500' : 
                hasChanges ? 'bg-white text-green-600' : 'bg-white text-gray-400'
            }`}>
                {result.isError ? <AlertCircle className="w-10 h-10" /> : 
                 hasChanges ? <CheckCircle2 className="w-10 h-10" /> : <RefreshCw className="w-10 h-10" />}
            </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 text-center space-y-6">
            
            {/* Title Section */}
            <div>
                <h3 className="text-2xl font-black text-gray-900 leading-tight">
                    {result.isError ? 'Sync Failed' : 
                     hasChanges ? 'Sync Complete!' : 'Up to Date'}
                </h3>
                <p className="text-sm text-gray-500 mt-2 font-medium">
                    {result.isError ? result.errorMessage : 
                     hasChanges ? 'The database has been successfully updated.' : 
                     'No new changes found in the spreadsheet.'}
                </p>
            </div>

            {/* Stats Grid - Only show if not error and has activity */}
            {!result.isError && (
                <div className="grid grid-cols-2 gap-4">
                    {/* Updated Card */}
                    <div className={`p-4 rounded-2xl border transition-all ${
                        result.updatedCount > 0 
                        ? 'bg-blue-50 border-blue-200 shadow-sm' 
                        : 'bg-gray-50 border-transparent opacity-50'
                    }`}>
                        <div className="flex flex-col items-center">
                            <span className={`text-3xl font-black ${result.updatedCount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                                {result.updatedCount}
                            </span>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1 flex items-center gap-1">
                                <Users className="w-3 h-3" /> Updated
                            </span>
                        </div>
                    </div>

                    {/* Created Card */}
                    <div className={`p-4 rounded-2xl border transition-all ${
                        result.createdCount > 0 
                        ? 'bg-purple-50 border-purple-200 shadow-sm' 
                        : 'bg-gray-50 border-transparent opacity-50'
                    }`}>
                        <div className="flex flex-col items-center">
                            <span className={`text-3xl font-black ${result.createdCount > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                                {result.createdCount}
                            </span>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Created
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Debug Info for Zero State */}
            {isZeroState && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-left text-xs text-orange-800">
                    <p className="font-bold mb-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Troubleshooting:
                    </p>
                    <ul className="list-disc pl-4 space-y-1 opacity-80">
                        <li>We checked <strong>{result.totalRowsProcessed} rows</strong>.</li>
                        <li>Verify "Name" is in Column C (Index 2).</li>
                        <li>Ensure names in sheet match database exactly.</li>
                    </ul>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t flex justify-center">
            <Button onClick={onClose} className="w-full py-3 text-base shadow-lg bg-gray-900 hover:bg-black text-white rounded-xl">
                {result.isError ? 'Close' : 'Awesome, Thanks!'}
            </Button>
        </div>
      </div>
    </div>
  );
};
