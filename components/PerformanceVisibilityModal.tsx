import React, { useState, useMemo } from 'react';
import { X, Lock, Eye, EyeOff, Check } from 'lucide-react';
import { StaffMember } from '../types';

interface PerformanceVisibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffMember[];
  onSave: (updatedStaffList: StaffMember[]) => void;
}

export const PerformanceVisibilityModal: React.FC<PerformanceVisibilityModalProps> = ({
  isOpen,
  onClose,
  staffList,
  onSave,
}) => {
  const [visibilitySettings, setVisibilitySettings] = useState<Record<string, boolean>>(
    staffList.reduce((acc, member) => ({
      ...acc,
      [member.name]: member.isVisibleInPerformance !== false, // Default to true if not set
    }), {})
  );

  const visibleCount = useMemo(() => {
    return Object.values(visibilitySettings).filter(v => v).length;
  }, [visibilitySettings]);

  const handleToggleVisibility = (name: string) => {
    setVisibilitySettings(prev => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const handleSelectAll = () => {
    setVisibilitySettings(
      staffList.reduce((acc, member) => ({
        ...acc,
        [member.name]: true,
      }), {})
    );
  };

  const handleDeselectAll = () => {
    setVisibilitySettings(
      staffList.reduce((acc, member) => ({
        ...acc,
        [member.name]: false,
      }), {})
    );
  };

  const handleSave = () => {
    const updatedStaffList = staffList.map(member => ({
      ...member,
      isVisibleInPerformance: visibilitySettings[member.name] ?? true,
    }));
    onSave(updatedStaffList);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-transparent">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-purple-600" />
              Performance Visibility
            </h2>
            <p className="text-xs text-gray-500 mt-1">Select who appears in the recruitment stats section</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
          {staffList.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <p className="text-sm italic">No staff members to configure</p>
            </div>
          ) : (
            <>
              {/* Stats Summary */}
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 mb-2">
                <p className="text-xs font-bold text-blue-900">
                  Showing {visibleCount} of {staffList.length} recruiters
                </p>
              </div>

              {/* Staff List */}
              <div className="space-y-2">
                {staffList.map(member => (
                  <button
                    key={member.name}
                    onClick={() => handleToggleVisibility(member.name)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left group ${
                      visibilitySettings[member.name]
                        ? 'bg-gradient-to-r from-purple-50 to-white border-purple-200 hover:border-purple-400 hover:shadow-md'
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300 opacity-60'
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`flex-shrink-0 w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                        visibilitySettings[member.name]
                          ? 'bg-purple-600 border-purple-600'
                          : 'border-gray-300 group-hover:border-gray-400'
                      }`}
                    >
                      {visibilitySettings[member.name] && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>

                    {/* Name and Role */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm transition-colors ${
                        visibilitySettings[member.name]
                          ? 'text-gray-900'
                          : 'text-gray-600'
                      }`}>
                        {member.name}
                      </p>
                      {member.isSuperAdmin && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Lock className="w-3 h-3 text-purple-600" />
                          <span className="text-[10px] text-purple-600 font-bold">Super Admin</span>
                        </div>
                      )}
                    </div>

                    {/* Visibility Indicator */}
                    <div className={`flex-shrink-0 transition-all ${
                      visibilitySettings[member.name]
                        ? 'text-purple-600 opacity-100'
                        : 'text-gray-400 opacity-50'
                    }`}>
                      {visibilitySettings[member.name] ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 pt-3 border-t border-gray-200">
                <button
                  onClick={handleSelectAll}
                  className="flex-1 py-2 px-3 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="flex-1 py-2 px-3 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition-colors"
                >
                  Deselect All
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 px-4 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors shadow-sm"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
