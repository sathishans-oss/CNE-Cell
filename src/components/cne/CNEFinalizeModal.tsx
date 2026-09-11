import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, X, Loader2, Award, Users, Calendar } from 'lucide-react';
import { UpcomingClass, CNEParticipantsSummary } from '../../types';
import { ApiService } from '../../services/api';
import { useToast } from '../Toast';
import { formatCneDateRangeDisplay } from '../../utils';

interface CNEFinalizeModalProps {
  cne: UpcomingClass;
  isAuthorized: boolean;
  onClose: () => void;
  onCompleted: () => void;
}

export const CNEFinalizeModal: React.FC<CNEFinalizeModalProps> = ({
  cne,
  isAuthorized,
  onClose,
  onCompleted
}) => {
  const cneId = cne.cneId || cne.classId || '';
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CNEParticipantsSummary | null>(null);
  const [actionType, setActionType] = useState<'FINALIZE' | 'CANCEL'>('FINALIZE');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { success, error } = useToast();

  useEffect(() => {
    loadSummary();
  }, [cneId]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getCNEParticipants(cneId);
      if (res.success && res.data) {
        setSummary(res.data);
      }
    } catch (e: any) {
      console.warn('Failed to load participant summary:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (isSubmitting || !isAuthorized) return;

    setIsSubmitting(true);
    try {
      const res = await ApiService.finalizeCNE(cneId, remarks.trim());
      if (res.success) {
        success(`CNE successfully finalized! Master record created with ID: ${res.data?.dataId || 'Data Master'}`);
        onCompleted();
        onClose();
      } else {
        error(res.message || 'Failed to finalize CNE.');
      }
    } catch (e: any) {
      error(e?.message || 'Error occurred while finalizing CNE.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (isSubmitting || !isAuthorized) return;

    if (!remarks.trim()) {
      error('Please provide a reason for cancellation.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await ApiService.cancelCNE(cneId, remarks.trim());
      if (res.success) {
        success('CNE session marked as Cancelled.');
        onCompleted();
        onClose();
      } else {
        error(res.message || 'Failed to cancel CNE.');
      }
    } catch (e: any) {
      error(e?.message || 'Error occurred while cancelling CNE.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl w-[90vw] max-w-[1050px] max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 relative text-xs overflow-hidden">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActionType('FINALIZE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-colors ${
                  actionType === 'FINALIZE'
                    ? 'bg-emerald-100 text-emerald-900 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Complete &amp; Finalize CNE</span>
              </button>

              <button
                type="button"
                onClick={() => setActionType('CANCEL')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-colors ${
                  actionType === 'CANCEL'
                    ? 'bg-rose-100 text-rose-900 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Cancel Programme</span>
              </button>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              ({cneId})
            </span>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 disabled:opacity-40 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            <span>Loading CNE metrics...</span>
          </div>
        ) : actionType === 'FINALIZE' ? (
          <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-50/40">
            {/* Left Column: Consolidated Session Metrics & Details */}
            <div className="md:col-span-6 space-y-4">
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Target CNE Program
                </span>
                <h4 className="text-base font-bold text-slate-900 leading-snug">
                  {cne.topic}
                </h4>
                <p className="text-slate-500 text-xs">
                  {cne.area} &bull; {formatCneDateRangeDisplay(cne.date, cne.toDate)}
                </p>
                {cne.resourcePersonName && (
                  <p className="text-xs text-slate-600 pt-1 border-t border-slate-100">
                    Resource Person: <strong>{cne.resourcePersonName}</strong>
                  </p>
                )}
              </div>

              {/* Attendance & Score Preview */}
              <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-2">
                <span className="font-bold text-emerald-950 uppercase tracking-wider text-[10px]">
                  Consolidated Session Metrics
                </span>
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-xs">
                    <div className="text-[10px] text-slate-500">Total Participants</div>
                    <div className="text-lg font-bold text-slate-900 mt-0.5">
                      {summary?.totalParticipants || 0}
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-xs">
                    <div className="text-[10px] text-slate-500">Evaluated</div>
                    <div className="text-lg font-bold text-indigo-700 mt-0.5">
                      {summary?.postTestCount || 0}
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-xs">
                    <div className="text-[10px] text-slate-500">Avg Score</div>
                    <div className="text-lg font-bold text-emerald-700 mt-0.5">
                      {summary?.averageScore ? `${summary.averageScore}%` : '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Guidance & Remarks Form */}
            <div className="md:col-span-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200 text-slate-700 text-xs leading-relaxed">
                  <strong>Master Record Generation:</strong> Finalizing will update the session status to <strong className="text-emerald-700">COMPLETED</strong> and permanently record all participant staff IDs, evaluation scores, and contact hours in the institutional <strong>CNE Data Master</strong>.
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Final Remarks / Clinical Observations
                  </label>
                  <textarea
                    rows={4}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optional notes on participant engagement, clinical outcomes, or follow-up training recommendations..."
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFinalize}
                  disabled={isSubmitting || !isAuthorized}
                  className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Archiving into Master...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Finalize &amp; Record CNE</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Cancel CNE View */
          <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-50/40">
            <div className="md:col-span-5 space-y-3">
              <div className="p-4 bg-white rounded-xl border border-rose-200 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                  Target Program for Cancellation
                </span>
                <h4 className="text-base font-bold text-slate-900 leading-snug mt-1">
                  {cne.topic}
                </h4>
                <p className="text-slate-500 text-xs mt-1">
                  {cne.area} &bull; {formatCneDateRangeDisplay(cne.date, cne.toDate)}
                </p>
              </div>
              <p className="text-slate-500 text-xs leading-relaxed">
                Marking this session as cancelled will update its institutional status. It will remain in the schedule logs with the specified reason for audit and reporting compliance.
              </p>
            </div>

            <div className="md:col-span-7 flex flex-col justify-between space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-rose-800 uppercase tracking-wider mb-1.5">
                  Cancellation Reason *
                </label>
                <textarea
                  rows={4}
                  required
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Specify the reason for cancellation (e.g., faculty emergency, clinical ward surge, rescheduled)..."
                  className="w-full p-2.5 bg-white border border-rose-300 rounded-xl text-xs focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSubmitting || !isAuthorized}
                  className="flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Cancelling Session...</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Confirm Cancellation</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
