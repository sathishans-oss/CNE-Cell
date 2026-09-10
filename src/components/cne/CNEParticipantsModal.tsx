import React, { useState, useEffect } from 'react';
import {
  Users,
  X,
  Plus,
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

  // Add Manual Participant State
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [empName, setEmpName] = useState('');
  const [empDesignation, setEmpDesignation] = useState('');
  const [empDepartment, setEmpDepartment] = useState(cne.area || '');
  const [remarks, setRemarks] = useState('In-person attendee');

  const { success, error, warning } = useToast();

  useEffect(() => {
    loadParticipants();
  }, [cneId]);

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

  const handleOfficerSelect = (empId: string) => {
    setSelectedEmpId(empId);
    const found = officersList.find((o) => o.employeeId === empId);
    if (found) {
      setEmpName(found.name);
      setEmpDesignation(found.designation || '');
    }
  };

  const handleAddManualAttendee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !isAuthorized) return;

    if (!selectedEmpId.trim() && !empName.trim()) {
      warning('Please enter an Employee ID or Name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await ApiService.addManualParticipant({
        cneId: cneId,
        employeeId: selectedEmpId.trim(),
        name: empName.trim(),
        designation: empDesignation.trim(),
        department: empDepartment.trim(),
        remarks: remarks.trim()
      });

      if (res.success) {
        success('Manual participant attendance recorded.');
        setSelectedEmpId('');
        setEmpName('');
        setEmpDesignation('');
        setIsAddingManual(false);
        await loadParticipants();
        if (onUpdated) onUpdated();
      } else {
        error(res.message || 'Failed to record participant.');
      }
    } catch (e: any) {
      error(e?.message || 'Error occurred while saving attendance.');
    } finally {
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl w-[92vw] max-w-[1440px] max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 relative overflow-hidden">
        {/* Header */}
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
                <span className="text-[11px] font-semibold text-slate-600">
                  {cne.area}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  ({cneId})
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
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingManual ? 'Close Form' : '+ Add In-Person Attendee'}</span>
            </button>
          )}
        </div>

        {/* Form: Add Manual Attendee */}
        {isAddingManual && isAuthorized && (
          <form
            onSubmit={handleAddManualAttendee}
            className="px-6 py-3.5 bg-teal-50/60 border-b border-teal-100 text-xs space-y-3 shrink-0"
          >
            <div className="font-bold text-teal-950 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-teal-700" />
              <span>Record In-Person / Offline Participant</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Employee ID:
                </label>
                <input
                  type="text"
                  placeholder="e.g. EMP1024"
                  value={selectedEmpId}
                  onChange={(e) => handleOfficerSelect(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Staff Name *:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Designation:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Staff Nurse / Sr. MO"
                  value={empDesignation}
                  onChange={(e) => setEmpDesignation(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Ward / Department:
                </label>
                <input
                  type="text"
                  placeholder="e.g. ICU / OT"
                  value={empDepartment}
                  onChange={(e) => setEmpDepartment(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
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
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Attendee...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Add to Attendance Roster</span>
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
