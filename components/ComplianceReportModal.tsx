
import React from 'react';
import { ShieldAlert, CheckCircle2, XCircle, AlertTriangle, EyeOff, Eye, Check } from 'lucide-react';
import { Button } from './Button';
import { ShopperRecord } from '../types';

interface ComplianceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  issues: Record<string, string[]>; // Map of ShopperID -> Array of Issues
  shoppers: ShopperRecord[];
  onToggleIgnore: (shopper: ShopperRecord) => void;
}

export const ComplianceReportModal: React.FC<ComplianceReportModalProps> = ({
  isOpen,
  onClose,
  issues,
  shoppers,
  onToggleIgnore
}) => {
  if (!isOpen) return null;

  // Filter shoppers to only those who have issues recorded
  const affectedShoppers = shoppers.filter(s => issues[s.id] && issues[s.id].length > 0);
  
  // Sort: Active issues first, Ignored issues last
  const sortedShoppers = [...affectedShoppers].sort((a, b) => {
      const aIgnored = a.details?.ignoreCompliance ? 1 : 0;
      const bIgnored = b.details?.ignoreCompliance ? 1 : 0;
      return aIgnored - bIgnored;
  });

  const activeIssueCount = affectedShoppers.filter(s => !s.details?.ignoreCompliance).length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className={`p-6 border-b flex justify-between items-center shrink-0 ${activeIssueCount > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${activeIssueCount > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    {activeIssueCount > 0 ? <ShieldAlert className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                </div>
                <div>
                    <h3 className={`text-xl font-bold ${activeIssueCount > 0 ? 'text-red-900' : 'text-green-900'}`}>
                        {activeIssueCount > 0 ? 'Compliance Issues Found' : 'All Clear!'}
                    </h3>
                    <p className={`text-sm ${activeIssueCount > 0 ? 'text-red-700' : 'text-green-700'} opacity-80`}>
                        {activeIssueCount > 0 
                            ? `${activeIssueCount} candidates require attention.` 
                            : 'No active violations found.'}
                    </p>
                </div>
            </div>
            <div className="text-right">
                <span className="text-2xl font-black text-gray-800">{activeIssueCount}</span>
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active</span>
            </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6 space-y-4">
            {sortedShoppers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                    <CheckCircle2 className="w-12 h-12 mb-2 text-green-200" />
                    <p className="font-medium">No rule violations detected.</p>
                </div>
            ) : (
                sortedShoppers.map(shopper => {
                    const isIgnored = shopper.details?.ignoreCompliance;
                    const shopperIssues = issues[shopper.id];

                    return (
                        <div 
                            key={shopper.id} 
                            className={`rounded-xl border transition-all duration-300 overflow-hidden ${
                                isIgnored 
                                ? 'bg-gray-100 border-gray-200 opacity-70' 
                                : 'bg-white border-red-100 shadow-sm'
                            }`}
                        >
                            <div className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                                        isIgnored ? 'bg-gray-200 text-gray-500' : 'bg-red-100 text-red-600'
                                    }`}>
                                        {shopper.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className={`font-bold text-base ${isIgnored ? 'text-gray-500 line-through decoration-gray-300' : 'text-gray-900'}`}>
                                            {shopper.name}
                                        </h4>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {shopperIssues.map((issue, idx) => (
                                                <span key={idx} className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded border ${
                                                    isIgnored 
                                                    ? 'bg-gray-200 text-gray-500 border-gray-300' 
                                                    : 'bg-red-50 text-red-700 border-red-100'
                                                }`}>
                                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                                    {issue}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => onToggleIgnore(shopper)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all border shrink-0 ${
                                        isIgnored
                                        ? 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                        : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                    }`}
                                >
                                    {isIgnored ? (
                                        <>
                                            <Eye className="w-3.5 h-3.5" /> Re-Include
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-3.5 h-3.5" /> Mark Exception
                                        </>
                                    )}
                                </button>
                            </div>
                            
                            {isIgnored && (
                                <div className="bg-gray-200 px-4 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1">
                                    <EyeOff className="w-3 h-3" /> Marked as Exception (Ignored)
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t flex justify-end">
            <Button onClick={onClose} className="px-8 bg-gray-900 text-white hover:bg-black">
                Done
            </Button>
        </div>
      </div>
    </div>
  );
};
