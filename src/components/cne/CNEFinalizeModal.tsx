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
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CNEParticipantsSummary | null>(null);
  const [actionType, setActionType] = useState<'FINALIZE' | 'CANCEL'>('FINALIZE');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { success, error } = useToast();

  useEffect(() => {
    loadSummary();
  }, [cne.classId]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getCNEParticipants(cne.classId);
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
      const res = await ApiService.finalizeCNE(cne.classId, remarks.trim());
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
      const res = await ApiService.cancelCNE(cne.classId, remarks.trim());
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative text-xs">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tab Switcher: Finalize vs Cancel */}
        <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setActionType('FINALIZE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-colors ${
              actionType === 'FINALIZE'
                ? 'bg-emerald-100 text-emerald-900'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Complete & Finalize CNE</span>
          </button>

          <button
            type="button"
            onClick={() => setActionType('CANCEL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-colors ${
              actionType === 'CANCEL'
                ? 'bg-rose-100 text-rose-900'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Cancel Programme</span>
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            <span>Loading CNE metrics...</span>
          </div>
        ) : actionType === 'FINALIZE' ? (
          <div className="space-y-4">
            <div>
              <h4 className="text-base font-bold text-slate-900 leading-snug">
                {cne.topic}
              </h4>
              <p className="text-slate-500 mt-0.5">
                {cne.area} • {formatCneDateRangeDisplay(cne.date, cne.toDate)}
              </p>
            </div>

            {/* Attendance & Score Preview */}
            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-2">
              <span className="font-bold text-emerald-950 uppercase tracking-wider text-[10px]">
                Consolidated Session Metrics
              </span>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="bg-white p-2 rounded-lg border border-emerald-100">
                  <div className="text-[10px] text-slate-500">Total Participants</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {summary?.totalParticipants || 0}
                  </div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-emerald-100">
                  <div className="text-[10px] text-slate-500">Evaluated</div>
                  <div className="text-base font-bold text-indigo-700 mt-0.5">
                    {summary?.postTestCount || 0}
                  </div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-emerald-100">
                  <div className="text-[10px] text-slate-500">Avg Score</div>
                  <div className="text-base font-bold text-emerald-700 mt-0.5">
                    {summary?.averageScore ? `${summary.averageScore}%` : '—'}
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Finalizing will update the session status to <strong>COMPLETED</strong> and permanently record all participant staff IDs, scores, and hours in the institutional <strong>CNE Data Master</strong>.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Final Remarks / Observations
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional notes on participant engagement, clinical outcomes, or follow-up training..."
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
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
                    <span>Finalize & Record CNE</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Cancel CNE View */
          <div className="space-y-4">
            <div>
              <h4 className="text-base font-bold text-slate-900 leading-snug">
                Cancel CNE: {cne.topic}
              </h4>
              <p className="text-slate-500 mt-0.5">
                Mark this planned session as cancelled.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-rose-800 uppercase tracking-wider mb-1">
                Cancellation Reason *
              </label>
              <textarea
                rows={3}
                required
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Specify the reason for cancellation (e.g., faculty unavailable, ward emergency)..."
                className="w-full p-2 bg-rose-50/50 border border-rose-300 rounded-xl text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
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
        )}
      </div>
    </div>
  );
};
