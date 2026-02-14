
import React, { useState, useEffect } from 'react';
import { X, FileText, Users, CheckCircle, XCircle, Clock, ClipboardCheck, AlertTriangle, Copy, Check, Settings, Plus, Trash2, RefreshCw } from 'lucide-react';
import { ShopperRecord } from '../types';
import { format } from 'date-fns';
import { supabase } from '../supabaseClient';

interface SERReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  shoppers: ShopperRecord[];
  sessionDate: string; // e.g., "2026-02-13"
  sessionType: 'MORNING' | 'AFTERNOON';
  totalHiredThisWeek: number;
  prefilledEndTime?: string;
  isSuperAdmin?: boolean;
}

interface RejectedCandidate {
  name: string;
  reason: string;
}

interface RescheduledCandidate {
  name: string;
  reason: string;
}

export const SERReportModal: React.FC<SERReportModalProps> = ({
  isOpen,
  onClose,
  shoppers,
  sessionDate,
  sessionType,
  totalHiredThisWeek,
  prefilledEndTime = '',
  isSuperAdmin = false
}) => {
  const [scheduled, setScheduled] = useState<number>(0);
  const [showedUp, setShowedUp] = useState<number>(0);
  const [rejectedCandidates, setRejectedCandidates] = useState<RejectedCandidate[]>([]);
  const [rescheduledCandidates, setRescheduledCandidates] = useState<RescheduledCandidate[]>([]);
  const [endTime, setEndTime] = useState<string>('');
  const [additionalNotes, setAdditionalNotes] = useState<string>('');
  const [tasksDone, setTasksDone] = useState<string[]>([]);
  const [tasksPostponed, setTasksPostponed] = useState<string[]>([]);
  const [selectedItProblems, setSelectedItProblems] = useState<string[]>([]);
  const [customItProblem, setCustomItProblem] = useState<string>('');
  const [submissionNotes, setSubmissionNotes] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Custom options state
  const [customTasks, setCustomTasks] = useState<string[]>([]);
  const [customItProblems, setCustomItProblems] = useState<string[]>([]);
  const [customRejectionReasons, setCustomRejectionReasons] = useState<string[]>([]);
  const [customRescheduleReasons, setCustomRescheduleReasons] = useState<string[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [newTaskInput, setNewTaskInput] = useState('');
  const [newItProblemInput, setNewItProblemInput] = useState('');
  const [newRejectionReasonInput, setNewRejectionReasonInput] = useState('');
  const [newRescheduleReasonInput, setNewRescheduleReasonInput] = useState('');

  const hired = shoppers.length;

  // Default tasks + custom tasks
  const defaultTasks = ['Bags', 'Tags', 'Scorecards', 'Admin', 'Callshift'];
  const availableTasks = [...defaultTasks, ...customTasks];

  // Common IT problems + custom problems
  const defaultItProblems = [
    'Unable to login on Slack',
    'Didn\'t receive Datachecker email',
    'Didn\'t receive emails to create Slack and Teamwork account',
    'Didn\'t receive email to join Slack workspace'
  ];
  const commonItProblems = [...defaultItProblems, ...customItProblems];

  // Default rejection reasons + custom reasons
  const defaultRejectionReasons = [
    'Availability',
    'Behavioural',
    'No Motivation',
    'Hard Skills - Driving / Languages / Physical',
    'Legal requirements',
    'Location Accessibility',
    'Not Eligible for rehire',
    'Process Abandoned Without Reason',
    'Rejected us - Compensation',
    '30 day backlog',
    'Accepted Another offer'
  ];
  const availableRejectionReasons = [...defaultRejectionReasons, ...customRejectionReasons];

  // Default reschedule reasons + custom reasons
  const defaultRescheduleReasons = [
    'Candidate requested different date',
    'Scheduling conflict',
    'Incomplete documentation',
    'Need more time',
    'Language barrier'
  ];
  const availableRescheduleReasons = [...defaultRescheduleReasons, ...customRescheduleReasons];

  // Get day of week
  const dayOfWeek = format(new Date(sessionDate), 'EEEE');

  // Load custom options from Supabase
  useEffect(() => {
    const loadCustomOptions = async () => {
      const { data: tasksData, error: tasksError } = await supabase
        .from('app_settings')
        .select('value')
        .eq('id', 'custom_ser_tasks')
        .maybeSingle();

      if (!tasksError && tasksData?.value && Array.isArray(tasksData.value)) {
        setCustomTasks(tasksData.value);
      }

      const { data: itProblemsData, error: itProblemsError } = await supabase
        .from('app_settings')
        .select('value')
        .eq('id', 'custom_it_problems')
        .maybeSingle();

      if (!itProblemsError && itProblemsData?.value && Array.isArray(itProblemsData.value)) {
        setCustomItProblems(itProblemsData.value);
      }

      const { data: rejectionReasonsData, error: rejectionReasonsError } = await supabase
        .from('app_settings')
        .select('value')
        .eq('id', 'custom_rejection_reasons')
        .maybeSingle();

      if (!rejectionReasonsError && rejectionReasonsData?.value && Array.isArray(rejectionReasonsData.value)) {
        setCustomRejectionReasons(rejectionReasonsData.value);
      }

      const { data: rescheduleReasonsData, error: rescheduleReasonsError } = await supabase
        .from('app_settings')
        .select('value')
        .eq('id', 'custom_reschedule_reasons')
        .maybeSingle();

      if (!rescheduleReasonsError && rescheduleReasonsData?.value && Array.isArray(rescheduleReasonsData.value)) {
        setCustomRescheduleReasons(rescheduleReasonsData.value);
      }
    };

    loadCustomOptions();
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setScheduled(0);
      setShowedUp(0);
      setRejectedCandidates([]);
      setRescheduledCandidates([]);
      setEndTime(prefilledEndTime); // Use prefilled end time if available
      setAdditionalNotes('');
      setTasksDone([]);
      setTasksPostponed([]);
      setSelectedItProblems([]);
      setCustomItProblem('');
      setCopied(false);

      // Auto-collect notes from submissions with names
      const notes = shoppers
        .map(s => {
          const note = s.details?.notes?.trim();
          return note ? `${s.name}: ${note}` : '';
        })
        .filter(note => note !== '')
        .join('\n');
      setSubmissionNotes(notes);
    }
  }, [isOpen, shoppers, prefilledEndTime]);

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

  const toggleItProblem = (problem: string) => {
    setSelectedItProblems(prev =>
      prev.includes(problem) ? prev.filter(p => p !== problem) : [...prev, problem]
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

  const addRescheduledCandidate = () => {
    setRescheduledCandidates(prev => [...prev, { name: '', reason: '' }]);
  };

  const updateRescheduledCandidate = (index: number, field: 'name' | 'reason', value: string) => {
    setRescheduledCandidates(prev =>
      prev.map((candidate, i) =>
        i === index ? { ...candidate, [field]: value } : candidate
      )
    );
  };

  const removeRescheduledCandidate = (index: number) => {
    setRescheduledCandidates(prev => prev.filter((_, i) => i !== index));
  };

  // Custom options management
  const handleAddTask = async () => {
    if (!newTaskInput.trim()) return;
    const updated = [...customTasks, newTaskInput.trim()];
    setCustomTasks(updated);
    await supabase.from('app_settings').upsert({ id: 'custom_ser_tasks', value: updated });
    setNewTaskInput('');
  };

  const handleRemoveTask = async (task: string) => {
    const updated = customTasks.filter(t => t !== task);
    setCustomTasks(updated);
    await supabase.from('app_settings').upsert({ id: 'custom_ser_tasks', value: updated });
  };

  const handleAddItProblem = async () => {
    if (!newItProblemInput.trim()) return;
    const updated = [...customItProblems, newItProblemInput.trim()];
    setCustomItProblems(updated);
    await supabase.from('app_settings').upsert({ id: 'custom_it_problems', value: updated });
    setNewItProblemInput('');
  };

  const handleRemoveItProblem = async (problem: string) => {
    const updated = customItProblems.filter(p => p !== problem);
    setCustomItProblems(updated);
    await supabase.from('app_settings').upsert({ id: 'custom_it_problems', value: updated });
  };

  const handleAddRejectionReason = async () => {
    if (!newRejectionReasonInput.trim()) return;
    const updated = [...customRejectionReasons, newRejectionReasonInput.trim()];
    setCustomRejectionReasons(updated);
    await supabase.from('app_settings').upsert({ id: 'custom_rejection_reasons', value: updated });
    setNewRejectionReasonInput('');
  };

  const handleRemoveRejectionReason = async (reason: string) => {
    const updated = customRejectionReasons.filter(r => r !== reason);
    setCustomRejectionReasons(updated);
    await supabase.from('app_settings').upsert({ id: 'custom_rejection_reasons', value: updated });
  };

  const handleAddRescheduleReason = async () => {
    if (!newRescheduleReasonInput.trim()) return;
    const updated = [...customRescheduleReasons, newRescheduleReasonInput.trim()];
    setCustomRescheduleReasons(updated);
    await supabase.from('app_settings').upsert({ id: 'custom_reschedule_reasons', value: updated });
    setNewRescheduleReasonInput('');
  };

  const handleRemoveRescheduleReason = async (reason: string) => {
    const updated = customRescheduleReasons.filter(r => r !== reason);
    setCustomRescheduleReasons(updated);
    await supabase.from('app_settings').upsert({ id: 'custom_reschedule_reasons', value: updated });
  };

  const generateReport = () => {
    const shift = sessionType === 'MORNING' ? 'Morning' : 'Afternoon';

    // Slack usa *testo* per bold, ma dobbiamo assicurarci che sia su una riga separata
    let report = `📋 *END OF SHIFT REPORT ${shift.toUpperCase()} - ${dayOfWeek.toUpperCase()}*\n\n`;

    // Candidates Section
    report += `👥 *Candidates:*\n`;
    report += `• Scheduled: ${scheduled}\n`;
    report += `• Showed Up: ${showedUp}\n`;
    report += `• Hired (Session): ${hired}\n`;
    report += `• Total Hired (Week): ${totalHiredThisWeek}\n\n`;

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

    // Rescheduled Candidates
    if (rescheduledCandidates.length > 0 && rescheduledCandidates.some(c => c.name.trim())) {
      report += `🔄 *Rescheduled Candidates:*\n`;
      rescheduledCandidates
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
    const allItProblems = [...selectedItProblems];
    if (customItProblem.trim()) {
      allItProblems.push(customItProblem.trim());
    }

    if (allItProblems.length > 0) {
      report += `⚠️ *IT Issues:*\n`;
      allItProblems.forEach(problem => {
        report += `• ${problem}\n`;
      });
      report += `\n`;
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
            <div className="flex items-center gap-2">
              {isSuperAdmin && (
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors shrink-0"
                  title="Manage custom options"
                >
                  <Settings className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-full transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
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
                <label className="block text-xs font-bold text-gray-500 mb-2">Hired (Session)</label>
                <div className="w-full p-2.5 sm:p-3 bg-green-50 border border-green-200 rounded-xl text-sm font-bold text-green-700 flex items-center justify-center gap-1.5 sm:gap-2">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>{hired}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">Total Hired (Week)</label>
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
                  <div key={index} className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={candidate.name}
                      onChange={(e) => updateRejectedCandidate(index, 'name', e.target.value)}
                      placeholder="Candidate name"
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                    />
                    <div className="flex gap-2">
                      <select
                        value={candidate.reason}
                        onChange={(e) => updateRejectedCandidate(index, 'reason', e.target.value)}
                        className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                      >
                        <option value="">Select reason or type custom...</option>
                        {availableRejectionReasons.map(reason => (
                          <option key={reason} value={reason}>{reason}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeRejectedCandidate(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Allow custom reason input if not in dropdown */}
                    {candidate.reason && !availableRejectionReasons.includes(candidate.reason) && (
                      <input
                        type="text"
                        value={candidate.reason}
                        onChange={(e) => updateRejectedCandidate(index, 'reason', e.target.value)}
                        placeholder="Custom reason"
                        className="w-full p-2 bg-red-50 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rescheduled Candidates */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h4 className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-orange-600" /> Rescheduled
              </h4>
              <button
                onClick={addRescheduledCandidate}
                className="px-2.5 sm:px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold hover:bg-orange-100 transition-colors border border-orange-200"
              >
                + Add
              </button>
            </div>
            {rescheduledCandidates.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No rescheduled candidates</p>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {rescheduledCandidates.map((candidate, index) => (
                  <div key={index} className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={candidate.name}
                      onChange={(e) => updateRescheduledCandidate(index, 'name', e.target.value)}
                      placeholder="Candidate name"
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                    />
                    <div className="flex gap-2">
                      <select
                        value={candidate.reason}
                        onChange={(e) => updateRescheduledCandidate(index, 'reason', e.target.value)}
                        className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                      >
                        <option value="">Select reason or type custom...</option>
                        {availableRescheduleReasons.map(reason => (
                          <option key={reason} value={reason}>{reason}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeRescheduledCandidate(index)}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Allow custom reason input if not in dropdown */}
                    {candidate.reason && !availableRescheduleReasons.includes(candidate.reason) && (
                      <input
                        type="text"
                        value={candidate.reason}
                        onChange={(e) => updateRescheduledCandidate(index, 'reason', e.target.value)}
                        placeholder="Custom reason"
                        className="w-full p-2 bg-orange-50 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                      />
                    )}
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
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {commonItProblems.map(problem => {
                  const isSelected = selectedItProblems.includes(problem);
                  return (
                    <button
                      key={problem}
                      onClick={() => toggleItProblem(problem)}
                      className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all border ${
                        isSelected
                          ? 'bg-red-100 text-red-700 border-red-300 shadow-sm'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {problem}
                    </button>
                  );
                })}
              </div>
              <textarea
                value={customItProblem}
                onChange={(e) => setCustomItProblem(e.target.value)}
                placeholder="Other IT problems (optional)..."
                className="w-full p-2.5 sm:p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm min-h-[60px] resize-none"
              />
            </div>
          </div>

          {/* Submission Notes (Editable) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
            <h4 className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" /> Submission Notes
            </h4>
            <textarea
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              placeholder="Notes from hired candidates..."
              className="w-full p-2.5 sm:p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm min-h-[100px] resize-none"
            />
          </div>

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

      {/* Settings Modal for Super Admin */}
      {showSettingsModal && isSuperAdmin && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Settings Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings className="w-6 h-6" />
                  <h3 className="text-2xl font-black">Custom Options</h3>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-indigo-100 text-sm mt-2">Manage custom tasks, IT problems, rejection reasons, and reschedule reasons for SER reports</p>
            </div>

            {/* Settings Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">

              {/* Custom Tasks Section */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-green-600" /> Custom Tasks
                </h4>

                {/* Add New Task */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newTaskInput}
                    onChange={(e) => setNewTaskInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                    placeholder="Enter new task name..."
                    className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm"
                  />
                  <button
                    onClick={handleAddTask}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>

                {/* Default Tasks (Read-only) */}
                <div className="mb-3">
                  <p className="text-xs font-bold text-gray-500 mb-2">Default Tasks (cannot be removed):</p>
                  <div className="flex flex-wrap gap-2">
                    {defaultTasks.map(task => (
                      <div key={task} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium border border-gray-200">
                        {task}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Tasks (Removable) */}
                {customTasks.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-2">Custom Tasks:</p>
                    <div className="flex flex-wrap gap-2">
                      {customTasks.map(task => (
                        <div key={task} className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium border border-green-200">
                          {task}
                          <button
                            onClick={() => handleRemoveTask(task)}
                            className="p-0.5 hover:bg-green-200 rounded transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Custom IT Problems Section */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" /> Custom IT Problems
                </h4>

                {/* Add New IT Problem */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newItProblemInput}
                    onChange={(e) => setNewItProblemInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddItProblem()}
                    placeholder="Enter new IT problem..."
                    className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                  />
                  <button
                    onClick={handleAddItProblem}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>

                {/* Default IT Problems (Read-only) */}
                <div className="mb-3">
                  <p className="text-xs font-bold text-gray-500 mb-2">Default IT Problems (cannot be removed):</p>
                  <div className="flex flex-wrap gap-2">
                    {defaultItProblems.map(problem => (
                      <div key={problem} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium border border-gray-200">
                        {problem}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom IT Problems (Removable) */}
                {customItProblems.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-2">Custom IT Problems:</p>
                    <div className="flex flex-wrap gap-2">
                      {customItProblems.map(problem => (
                        <div key={problem} className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-200">
                          {problem}
                          <button
                            onClick={() => handleRemoveItProblem(problem)}
                            className="p-0.5 hover:bg-red-200 rounded transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Custom Rejection Reasons Section */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" /> Rejection Reasons
                </h4>

                {/* Add New Rejection Reason */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newRejectionReasonInput}
                    onChange={(e) => setNewRejectionReasonInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddRejectionReason()}
                    placeholder="Enter new rejection reason..."
                    className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                  />
                  <button
                    onClick={handleAddRejectionReason}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>

                {/* Default Rejection Reasons (Read-only) */}
                <div className="mb-3">
                  <p className="text-xs font-bold text-gray-500 mb-2">Default Reasons (cannot be removed):</p>
                  <div className="flex flex-wrap gap-2">
                    {defaultRejectionReasons.map(reason => (
                      <div key={reason} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium border border-gray-200">
                        {reason}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Rejection Reasons (Removable) */}
                {customRejectionReasons.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-2">Custom Reasons:</p>
                    <div className="flex flex-wrap gap-2">
                      {customRejectionReasons.map(reason => (
                        <div key={reason} className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-200">
                          {reason}
                          <button
                            onClick={() => handleRemoveRejectionReason(reason)}
                            className="p-0.5 hover:bg-red-200 rounded transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Custom Reschedule Reasons Section */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-orange-600" /> Reschedule Reasons
                </h4>

                {/* Add New Reschedule Reason */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newRescheduleReasonInput}
                    onChange={(e) => setNewRescheduleReasonInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddRescheduleReason()}
                    placeholder="Enter new reschedule reason..."
                    className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                  />
                  <button
                    onClick={handleAddRescheduleReason}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>

                {/* Default Reschedule Reasons (Read-only) */}
                <div className="mb-3">
                  <p className="text-xs font-bold text-gray-500 mb-2">Default Reasons (cannot be removed):</p>
                  <div className="flex flex-wrap gap-2">
                    {defaultRescheduleReasons.map(reason => (
                      <div key={reason} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium border border-gray-200">
                        {reason}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Reschedule Reasons (Removable) */}
                {customRescheduleReasons.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-2">Custom Reasons:</p>
                    <div className="flex flex-wrap gap-2">
                      {customRescheduleReasons.map(reason => (
                        <div key={reason} className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-sm font-medium border border-orange-200">
                          {reason}
                          <button
                            onClick={() => handleRemoveRescheduleReason(reason)}
                            className="p-0.5 hover:bg-orange-200 rounded transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Settings Footer */}
            <div className="p-4 bg-gray-100 border-t border-gray-200">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

