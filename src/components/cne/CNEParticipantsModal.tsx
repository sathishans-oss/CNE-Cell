import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  X,
  Plus,
  Minus,
  UserCheck,
  Award,
  Calendar,
  Loader2,
  FileCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  FileDown
} from 'lucide-react';
import { UpcomingClass, CNEParticipant, CNEParticipantsSummary, Employee } from '../../types';
import { ApiService } from '../../services/api';
import { useToast } from '../Toast';
import { generateCNESessionPdf } from '../../services/pdfGenerator';
import { getCachedOfficers, loadOfficersSingleFlight } from '../../services/officerLoader';

interface CNEParticipantsModalProps {
  cne: UpcomingClass;
  isAuthorized: boolean;
  officersList?: Employee[];
  onClose: () => void;
  onUpdated?: () => void;
}

export const CNEParticipantsModal: React.FC<CNEParticipantsModalProps> = ({
  cne,
  isAuthorized,
  officersList = [],
  onClose,
  onUpdated
}) => {
  const cneId = cne.cneId || cne.classId || '';
  const [summary, setSummary] = useState<CNEParticipantsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Multi-Select Participant State (based on AdminCNEData.tsx pattern)
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // Officer list state & loading
  const [internalOfficers, setInternalOfficers] = useState<Employee[]>(() => {
    if (officersList && officersList.length > 0) return officersList;
    const cached = getCachedOfficers();
    return cached && cached.length > 0 ? cached : [];
  });
  const [isOfficersLoading, setIsOfficersLoading] = useState(false);
  const [officersLoadError, setOfficersLoadError] = useState<string | null>(null);

  // Internal Staff Multi-Select
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');

  // External Participants
  const [externalStaffList, setExternalStaffList] = useState<string[]>([]);
  const [externalStaffInput, setExternalStaffInput] = useState('');

  const { success, error, warning } = useToast();

  useEffect(() => {
    loadParticipants();
  }, [cneId]);

  // Sync or lazy load officers when the Add In-Person Attendee form is opened
  useEffect(() => {
    if (officersList && officersList.length > 0) {
      setInternalOfficers(officersList);
      setIsOfficersLoading(false);
      setOfficersLoadError(null);
      return;
    }

    const cached = getCachedOfficers();
    if (cached && cached.length > 0) {
      setInternalOfficers(cached);
      setIsOfficersLoading(false);
      setOfficersLoadError(null);
      return;
    }

    // Only load if form is opened and officers are not loaded yet
    if (isAddingManual) {
      let cancelled = false;
      setIsOfficersLoading(true);
      setOfficersLoadError(null);

      loadOfficersSingleFlight()
        .then((officers) => {
          if (!cancelled) {
            if (officers && officers.length > 0) {
              setInternalOfficers(officers);
              setOfficersLoadError(null);
            } else {
              setOfficersLoadError('Unable to load staff directory.');
            }
          }
        })
        .catch((err) => {
          if (!cancelled) {
            console.error('Error loading officers in CNEParticipantsModal:', err);
            setOfficersLoadError('Failed to load staff directory. Please try again.');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsOfficersLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }
  }, [isAddingManual, officersList]);

  const effectiveOfficers = (officersList && officersList.length > 0)
    ? officersList
    : (internalOfficers.length > 0 ? internalOfficers : (getCachedOfficers() || []));

  const loadParticipants = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getCNEParticipants(cneId);
      if (res.success && res.data) {
        setSummary(res.data);
      }
    } catch (e: any) {
      console.warn('Failed to load participants:', e);
    } finally {
      setLoading(false);
    }
  };

  const existingEmpIds = new Set(
    (summary?.participants || [])
      .map((p) => (p.employeeId || '').trim().toUpperCase())
      .filter(Boolean)
  );

  const existingExternalNames = new Set(
    (summary?.participants || [])
      .filter((p) => !p.employeeId)
      .map((p) => (p.name || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const filteredStaffOptions = effectiveOfficers.filter((o) => {
    if (!staffSearchQuery.trim()) return true;
    const q = staffSearchQuery.toLowerCase();
    return (
      (o.employeeId || '').toLowerCase().includes(q) ||
      (o.name || '').toLowerCase().includes(q) ||
      (o.designation || '').toLowerCase().includes(q) ||
      (o.department || '').toLowerCase().includes(q)
    );
  });

  const toggleStaffSelection = (empId: string) => {
    if (existingEmpIds.has(empId.toUpperCase())) return;
    setSelectedStaffIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleAddExternalStaff = () => {
    const trimmed = externalStaffInput.trim();
    if (!trimmed) return;
    if (
      externalStaffList.some((s) => s.toLowerCase() === trimmed.toLowerCase()) ||
      existingExternalNames.has(trimmed.toLowerCase())
    ) {
      warning(`Participant "${trimmed}" is already added.`);
      return;
    }
    setExternalStaffList((prev) => [...prev, trimmed]);
    setExternalStaffInput('');
  };

  const handleRemoveExternalStaff = (index: number) => {
    setExternalStaffList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveParticipants = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting || !isAuthorized) return;

    if (selectedStaffIds.length === 0 && externalStaffList.length === 0) {
      warning('Please select at least one internal staff member or add an external participant.');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    let addedCount = 0;
    let failedCount = 0;

    try {
      // 1. Add internal staff
      for (const empId of selectedStaffIds) {
        const off = effectiveOfficers.find((o) => o.employeeId === empId);
        try {
          const res = await ApiService.addManualParticipant({
            cneId,
            employeeId: empId,
            name: off ? off.name : empId,
            designation: off?.designation || 'Staff Nurse',
            department: off?.department || cne.area || '',
            remarks: 'In-person attendee'
          });
          if (res.success) {
            addedCount++;
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }
      }

      // 2. Add external participants
      for (const extName of externalStaffList) {
        try {
          const res = await ApiService.addManualParticipant({
            cneId,
            name: extName,
            designation: 'Guest / External Participant',
            department: cne.area || '',
            remarks: 'External attendee'
          });
          if (res.success) {
            addedCount++;
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }
      }

      if (addedCount > 0) {
        success(`Successfully recorded ${addedCount} participant${addedCount > 1 ? 's' : ''}.`);
        setSelectedStaffIds([]);
        setExternalStaffList([]);
        setExternalStaffInput('');
        setIsAddingManual(false);
        await loadParticipants();
        if (onUpdated) onUpdated();
      } else if (failedCount > 0) {
        error('Failed to record participants. Please verify if they were already recorded.');
      }
    } catch (e: any) {
      error(e?.message || 'Error occurred while saving attendance.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const filteredParticipants = (summary?.participants || []).filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.employeeId?.toLowerCase().includes(term) ||
      p.name?.toLowerCase().includes(term) ||
      p.department?.toLowerCase().includes(term) ||
      p.designation?.toLowerCase().includes(term)
    );
  });

  const handleDownloadPdf = () => {
    try {
      generateCNESessionPdf(cne, summary?.participants || [], summary?.averageScore ?? null);
      success('CNE session report PDF generated successfully.');
    } catch (e: any) {
      error(e?.message || 'Failed to generate PDF report.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl w-[92vw] max-w-[1440px] max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 relative overflow-hidden">
        {/* Header - simplified without Ward/Area and Class ID/CNE ID */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  Attendance &amp; Evaluation Roster
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 truncate max-w-2xl">
                {cne.topic}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs shrink-0">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] text-slate-500 font-medium">Total Attendees</span>
            <p className="text-lg font-bold text-slate-900 mt-0.5">
              {summary?.totalParticipants || 0}
            </p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] text-slate-500 font-medium">Post-Test Evaluated</span>
            <p className="text-lg font-bold text-indigo-700 mt-0.5">
              {summary?.postTestCount || 0}
            </p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] text-slate-500 font-medium">Manual Attendance</span>
            <p className="text-lg font-bold text-teal-700 mt-0.5">
              {summary?.manualCount || 0}
            </p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] text-slate-500 font-medium">Average Score</span>
            <p className="text-lg font-bold text-emerald-700 mt-0.5">
              {summary && summary.averageScore ? `${summary.averageScore}%` : '—'}
            </p>
          </div>
        </div>

        {/* Action & Filter Bar */}
        <div className="px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-white">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Employee ID, staff name, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {isAuthorized && (
            <button
              type="button"
              onClick={() => setIsAddingManual(!isAddingManual)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
            >
              {isAddingManual ? (
                <>
                  <Minus className="w-3.5 h-3.5" />
                  <span>Close Form</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add In-Person Attendee</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Form: Add Participants (Multi-Select Staff & External) */}
        {isAddingManual && isAuthorized && (
          <form
            onSubmit={handleSaveParticipants}
            className="px-6 py-4 bg-teal-50/60 border-b border-teal-100 text-xs space-y-3.5 shrink-0 max-h-[380px] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <div className="font-bold text-teal-950 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-teal-700" />
                <span>Add In-Person Attendees to Roster</span>
              </div>
              <span className="text-[11px] font-medium text-slate-500">
                {selectedStaffIds.length + externalStaffList.length} participant{selectedStaffIds.length + externalStaffList.length === 1 ? '' : 's'} selected
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Internal Staff Multi-Select */}
              <div className="space-y-2 flex flex-col">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <span>Internal Faculty &amp; Staff</span>
                    {isOfficersLoading && (
                      <Loader2 className="w-3 h-3 text-teal-600 animate-spin" />
                    )}
                  </label>
                  <span className="text-[10px] text-slate-500">
                    {selectedStaffIds.length} selected
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filter staff by name or employee ID..."
                    value={staffSearchQuery}
                    onChange={(e) => setStaffSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                {/* Selected staff chips */}
                {selectedStaffIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-1.5 bg-white rounded-lg border border-slate-200">
                    {selectedStaffIds.map((id) => {
                      const off = effectiveOfficers.find((o) => o.employeeId === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 text-[11px] font-medium bg-teal-50 text-teal-900 px-2 py-0.5 rounded-md border border-teal-200"
                        >
                          <span>{off ? off.name : id} <span className="text-[10px] text-teal-600 font-mono">({id})</span></span>
                          <button
                            type="button"
                            onClick={() => toggleStaffSelection(id)}
                            className="hover:text-rose-600 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Staff Selection List */}
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white flex-1">
                  {isOfficersLoading ? (
                    <div className="p-4 flex flex-col items-center justify-center text-center space-y-2 text-slate-500">
                      <Loader2 className="w-5 h-5 text-teal-600 animate-spin" />
                      <span className="text-xs font-medium">Loading staff directory...</span>
                    </div>
                  ) : officersLoadError && effectiveOfficers.length === 0 ? (
                    <div className="p-4 text-center text-rose-500 text-xs flex flex-col items-center justify-center space-y-1">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>{officersLoadError}</span>
                    </div>
                  ) : filteredStaffOptions.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 text-xs">No matching staff found</div>
                  ) : (
                    filteredStaffOptions.slice(0, 60).map((o) => {
                      const isSelected = selectedStaffIds.includes(o.employeeId);
                      const isAlreadyRecorded = existingEmpIds.has((o.employeeId || '').toUpperCase());
                      return (
                        <div
                          key={o.employeeId}
                          onClick={() => {
                            if (!isAlreadyRecorded) toggleStaffSelection(o.employeeId);
                          }}
                          className={`p-2 flex items-center justify-between text-xs transition-colors ${
                            isAlreadyRecorded
                              ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-60'
                              : isSelected
                              ? 'bg-teal-50/70 font-semibold cursor-pointer'
                              : 'hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          <div className="truncate mr-2">
                            <span className="font-mono text-slate-600">{o.employeeId}</span>
                            <span className="mx-1.5">•</span>
                            <span className={isAlreadyRecorded ? 'text-slate-400 line-through' : 'text-slate-900'}>{o.name}</span>
                            {o.designation && <span className="text-slate-400 text-[10px] ml-1">({o.designation})</span>}
                            {isAlreadyRecorded && (
                              <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-200 text-slate-600">
                                Recorded
                              </span>
                            )}
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isAlreadyRecorded}
                            onChange={() => {}}
                            className="rounded text-teal-600 focus:ring-teal-500 pointer-events-none shrink-0"
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* External Participants */}
              <div className="space-y-2 flex flex-col">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    External Participants
                  </label>
                  <span className="text-[10px] text-slate-400">No Employee ID required</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Sneha Patel (Guest Trainee)..."
                    value={externalStaffInput}
                    onChange={(e) => setExternalStaffInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddExternalStaff();
                      }
                    }}
                    className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddExternalStaff}
                    className="px-3 py-1.5 bg-teal-100 hover:bg-teal-200 text-teal-900 font-bold rounded-lg text-xs cursor-pointer transition-colors"
                  >
                    + Add
                  </button>
                </div>

                {/* External staff chips list */}
                <div className="flex-1 min-h-[100px] max-h-44 p-2 bg-white rounded-lg border border-slate-200 overflow-y-auto">
                  {externalStaffList.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs italic text-center p-3">
                      Type participant name above and click "+ Add" or press Enter
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {externalStaffList.map((staff, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200"
                        >
                          <span>{staff}</span>
                          <span className="text-[9px] text-amber-600 font-semibold">(External)</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveExternalStaff(idx)}
                            className="hover:text-rose-600 cursor-pointer ml-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-teal-100">
              <button
                type="button"
                onClick={() => setIsAddingManual(false)}
                disabled={isSubmitting}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (selectedStaffIds.length === 0 && externalStaffList.length === 0)}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Participants...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Save Participants</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Table Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/40">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
              <span>Loading attendance roster...</span>
            </div>
          ) : filteredParticipants.length === 0 ? (
            <div className="py-16 text-center p-8 bg-white rounded-2xl border border-dashed border-slate-300 space-y-2 max-w-md mx-auto my-8">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="text-xs font-bold text-slate-800">No Participant Records Yet</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Staff can complete the post-test via the QR code or link, or coordinators can manually log in-person attendees above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="p-3">Sr.</th>
                    <th className="p-3">Staff Details</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Evaluation Score</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Date / Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredParticipants.map((p, idx) => {
                    const isPostTest = p.participantType === 'POST_TEST';
                    return (
                      <tr key={p.id || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{p.name || p.employeeId}</div>
                          <div className="text-[11px] text-slate-500">
                            {p.employeeId ? `ID: ${p.employeeId}` : 'External / Guest'}
                            {p.designation ? ` • ${p.designation}` : ''}
                          </div>
                        </td>
                        <td className="p-3 text-slate-600">{p.department || '—'}</td>
                        <td className="p-3">
                          {isPostTest ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                              <Award className="w-2.5 h-2.5" />
                              Online Post-Test
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                              <UserCheck className="w-2.5 h-2.5" />
                              In-Person Manual
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-medium">
                          {isPostTest && p.score !== null ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 font-mono">
                                {p.score}/{p.totalQuestions}
                              </span>
                              <span className="text-[11px] text-slate-500 font-semibold">
                                ({p.percentage}%)
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Attended (No Test)</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              p.status === 'PASSED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.status === 'FAILED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {p.status || 'ATTENDED'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 text-[11px] whitespace-nowrap">
                          {p.submittedAt || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            Showing {filteredParticipants.length} attendee records
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl font-bold text-xs cursor-pointer shadow-xs transition-colors"
            >
              <FileDown className="w-4 h-4" />
              <span>Download Session Report (PDF)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
