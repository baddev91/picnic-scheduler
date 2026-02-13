
import React, { useState, useEffect } from 'react';
import { X, FileText, Users, CheckCircle, XCircle, Clock, ClipboardCheck, AlertTriangle, Copy, Check } from 'lucide-react';
import { ShopperRecord } from '../types';
import { format } from 'date-fns';

interface SERReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  shoppers: ShopperRecord[];
  sessionDate: string; // e.g., "2026-02-13"
  sessionType: 'MORNING' | 'AFTERNOON';
  totalHiredThisWeek: number;
}

interface RejectedCandidate {
  name: string;
  reason: string;
}

export const SERReportModal: React.FC<SERReportModalProps> = ({
  isOpen,
  onClose,
  shoppers,
  sessionDate,
  sessionType,
  totalHiredThisWeek
}) => {
  const [scheduled, setScheduled] = useState<number>(0);
  const [showedUp, setShowedUp] = useState<number>(0);
  const [rejectedCandidates, setRejectedCandidates] = useState<RejectedCandidate[]>([]);
  const [endTime, setEndTime] = useState<string>('');
  const [additionalNotes, setAdditionalNotes] = useState<string>('');
  const [tasksDone, setTasksDone] = useState<string[]>([]);
  const [tasksPostponed, setTasksPostponed] = useState<string[]>([]);
  const [itProblems, setItProblems] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const hired = shoppers.length;
  const availableTasks = ['Bags', 'Tags', 'Scorecards', 'Admin', 'Callshift'];

  // Auto-collect notes from submissions
  const submissionNotes = shoppers
    .map(s => s.details?.notes)
    .filter(note => note && note.trim() !== '')
    .join('\n');

  // Get day of week
  const dayOfWeek = format(new Date(sessionDate), 'EEEE');

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setScheduled(0);
      setShowedUp(0);
      setRejectedCandidates([]);
      setEndTime('');
      setAdditionalNotes('');
      setTasksDone([]);
      setTasksPostponed([]);
      setItProblems('');
      setCopied(false);
    }
  }, [isOpen]);

  const toggleTask = (task: string) => {
    setTasksDone(prev =>
      prev.includes(task) ? prev.filter(t => t !== task) : [...prev, task]
    );
  };

  const togglePostponedTask = (task: string) => {
    setTasksPostponed(prev =>
      prev.includes(task) ? prev.filter(t => t !== task) : [...prev, task]
    );
  };

  const addRejectedCandidate = () => {
    setRejectedCandidates(prev => [...prev, { name: '', reason: '' }]);
  };

  const updateRejectedCandidate = (index: number, field: 'name' | 'reason', value: string) => {
    setRejectedCandidates(prev =>
      prev.map((candidate, i) =>
        i === index ? { ...candidate, [field]: value } : candidate
      )
    );
  };

  const removeRejectedCandidate = (index: number) => {
    setRejectedCandidates(prev => prev.filter((_, i) => i !== index));
  };

  const generateReport = () => {
    const shift = sessionType === 'MORNING' ? 'Morning' : 'Afternoon';

    // Slack usa *testo* per bold, ma dobbiamo assicurarci che sia su una riga separata
    let report = `📋 *END OF SHIFT REPORT ${shift.toUpperCase()} - ${dayOfWeek.toUpperCase()}*\n\n`;

    // Candidates Section
    report += `👥 *Candidates:*\n`;
    report += `• Scheduled: ${scheduled}\n`;
    report += `• Showed Up: ${showedUp}\n`;
    report += `• Hired (Session): ${hired} ✅\n`;
    report += `• Total Hired (Week): ${totalHiredThisWeek} ✅\n\n`;

    // Rejected Candidates
    if (rejectedCandidates.length > 0 && rejectedCandidates.some(c => c.name.trim())) {
      report += `❌ *Rejected Candidates:*\n`;
      rejectedCandidates
        .filter(c => c.name.trim())
        .forEach(candidate => {
          report += `• ${candidate.name}${candidate.reason ? ` - ${candidate.reason}` : ''}\n`;
        });
      report += `\n`;
    }

    // End Time
    if (endTime) {
      report += `⏰ *End Time:* ${endTime}\n\n`;
    }

    // Tasks Done
    if (tasksDone.length > 0) {
      report += `✅ *Tasks Completed:*\n`;
      tasksDone.forEach(task => {
        report += `• ${task}\n`;
      });
      report += `\n`;
    }

    // Tasks Postponed
    if (tasksPostponed.length > 0) {
      report += `⏸️ *Tasks Postponed:*\n`;
      tasksPostponed.forEach(task => {
        report += `• ${task}\n`;
      });
      report += `\n`;
    }

    // IT Problems
    if (itProblems.trim()) {
      report += `⚠️ *IT Issues:*\n${itProblems}\n\n`;
    }

    // Notes from Submissions
    if (submissionNotes.trim()) {
      report += `📝 *Submission Notes:*\n${submissionNotes}\n\n`;
    }

    // Additional Notes
    if (additionalNotes.trim()) {
      report += `💬 *Additional Notes:*\n${additionalNotes}\n`;
    }

    return report;
  };

  const handleCopyReport = async () => {
    const report = generateReport();
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert('Failed to copy report to clipboard');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 sm:p-6 text-white relative overflow-hidden shrink-0">
          <div className="absolute top-0 left-0 w-full h-full bg-white/10 opacity-30 pattern-grid-lg"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-white/20 p-2 sm:p-3 rounded-full backdrop-blur-md shadow-inner ring-4 ring-white/10">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h3 className="text-lg sm:text-2xl font-black tracking-tight">SER Report Builder</h3>
                <p className="text-purple-100 font-medium text-xs sm:text-sm mt-0.5">
                  {sessionType === 'MORNING' ? '🌅 Morning' : '🌆 Afternoon'} Shift - {dayOfWeek}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 bg-gray-50">

          {/* Candidates Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
            <h4 className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" /> Candidates Overview
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">Scheduled</label>
                <input
                  type="number"
                  min="0"
                  value={scheduled}
                  onChange={(e) => setScheduled(parseInt(e.target.value) || 0)}
                  className="w-full p-2.5 sm:p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">Showed Up</label>
                <input
                  type="number"
                  min="0"
                  value={showedUp}
                  onChange={(e) => setShowedUp(parseInt(e.target.value) || 0)}
                  className="w-full p-2.5 sm:p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">Hired (Session) ✅</label>
                <div className="w-full p-2.5 sm:p-3 bg-green-50 border border-green-200 rounded-xl text-sm font-bold text-green-700 flex items-center justify-center gap-1.5 sm:gap-2">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>{hired}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">Total Hired (Week) ✅</label>
                <div className="w-full p-2.5 sm:p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm font-bold text-blue-700 flex items-center justify-center gap-1.5 sm:gap-2">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>{totalHiredThisWeek}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Rejected Candidates */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h4 className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" /> Rejected
              </h4>
              <button
                onClick={addRejectedCandidate}
                className="px-2.5 sm:px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors border border-red-200"
              >
                + Add
              </button>
            </div>
            {rejectedCandidates.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No rejected candidates</p>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {rejectedCandidates.map((candidate, index) => (
                  <div key={index} className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={candidate.name}
                      onChange={(e) => updateRejectedCandidate(index, 'name', e.target.value)}
                      placeholder="Candidate name"
                      className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={candidate.reason}
                        onChange={(e) => updateRejectedCandidate(index, 'reason', e.target.value)}
                        placeholder="Reason (optional)"
                        className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                      />
                      <button
                        onClick={() => removeRejectedCandidate(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* End Time */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
            <h4 className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" /> End Time
            </h4>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full p-2.5 sm:p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
            />
          </div>

          {/* Tasks Done */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
            <h4 className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-green-600" /> Tasks Completed
            </h4>
            <div className="flex flex-wrap gap-2">
              {availableTasks.map(task => {
                const isSelected = tasksDone.includes(task);
                const emoji = task === 'Bags' ? '🎒' : task === 'Tags' ? '🏷️' : task === 'Scorecards' ? '📊' : task === 'Admin' ? '📝' : '📞';
                return (
                  <button
                    key={task}
                    onClick={() => toggleTask(task)}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all border ${
                      isSelected
                        ? 'bg-green-100 text-green-700 border-green-300 shadow-sm'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {emoji} {task}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tasks Postponed */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
            <h4 className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" /> Any Tasks Postponed?
            </h4>
            <div className="flex flex-wrap gap-2">
              {availableTasks.map(task => {
                const isSelected = tasksPostponed.includes(task);
                const emoji = task === 'Bags' ? '🎒' : task === 'Tags' ? '🏷️' : task === 'Scorecards' ? '📊' : task === 'Admin' ? '📝' : '📞';
                return (
                  <button
                    key={task}
                    onClick={() => togglePostponedTask(task)}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all border ${
                      isSelected
                        ? 'bg-orange-100 text-orange-700 border-orange-300 shadow-sm'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {emoji} {task}
                  </button>
                );
              })}
            </div>
          </div>

          {/* IT Problems */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
            <h4 className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" /> IT Issues
            </h4>
            <textarea
              value={itProblems}
              onChange={(e) => setItProblems(e.target.value)}
              placeholder="Describe any IT problems encountered..."
              className="w-full p-2.5 sm:p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm min-h-[80px] resize-none"
            />
          </div>

          {/* Submission Notes (Auto-collected) */}
          {submissionNotes.trim() && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 sm:p-5">
              <h4 className="text-xs sm:text-sm font-bold text-blue-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Submission Notes (Auto-collected)
              </h4>
              <div className="text-xs sm:text-sm text-blue-900 whitespace-pre-wrap bg-white p-2.5 sm:p-3 rounded-lg border border-blue-100">
                {submissionNotes}
              </div>
            </div>
          )}

          {/* Additional Notes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
            <h4 className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600" /> Additional Notes
            </h4>
            <textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Add any additional observations or notes..."
              className="w-full p-2.5 sm:p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm min-h-[100px] resize-none"
            />
          </div>
        </div>

        {/* Footer - Action Buttons */}
        <div className="p-3 sm:p-4 bg-gray-50 border-t flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 sm:py-3 px-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCopyReport}
            className={`flex-1 sm:flex-[2] py-2.5 sm:py-3 px-4 rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 ${
              copied
                ? 'bg-green-600 text-white'
                : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Copied to Clipboard!</span>
                <span className="sm:hidden">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Copy Report for Slack</span>
                <span className="sm:hidden">Copy Report</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

