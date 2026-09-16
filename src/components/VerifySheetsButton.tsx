import React, { useState, useRef } from 'react';
import {
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { SessionUser, SheetAuditItem } from '../types';
import { ApiService } from '../services/api';
import { useToast } from './Toast';

interface VerifySheetsButtonProps {
  user: SessionUser;
  className?: string;
}

export const VerifySheetsButton: React.FC<VerifySheetsButtonProps> = ({
  user,
  className = ''
}) => {
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const verifyingRef = useRef(false);
  const [verifyReport, setVerifyReport] = useState<SheetAuditItem[] | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const { success, error } = useToast();

  if (user.role !== 'ADMIN') {
    return null;
  }

  const handleExecuteVerifySheets = async () => {
    if (user.role !== 'ADMIN') return;
    if (verifyingRef.current || isVerifying) return;

    verifyingRef.current = true;
    setIsVerifying(true);
    setVerifyError(null);
    setVerifyReport(null);

    try {
      const res = await ApiService.setupAndVerifyCNESheets();
      if (res.success) {
        const report: SheetAuditItem[] =
          (res as any).auditReport ||
          (res.data as any)?.auditReport ||
          [];
        setVerifyReport(report);
        success('CNE Sheets verification completed successfully.');
      } else {
        const errMsg = res.message || 'Failed to verify CNE Sheets.';
        setVerifyError(errMsg);
        error(errMsg);
      }
    } catch (e: any) {
      const errMsg = e?.message || 'Unexpected network error during verification.';
      setVerifyError(errMsg);
      error(errMsg);
    } finally {
      verifyingRef.current = false;
      setIsVerifying(false);
    }
  };

  return (
    <>
      <button
        id="btn-admin-verify-sheets"
        type="button"
        onClick={() => {
          setVerifyReport(null);
          setVerifyError(null);
          setIsVerifyModalOpen(true);
        }}
        disabled={isVerifying}
        className={`flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${className}`}
        title="Verify or create missing CNE tabs and headers in CNE Sheets"
      >
        {isVerifying ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Verifying...</span>
          </>
        ) : (
          <>
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Verify / Initialize CNE Sheets</span>
          </>
        )}
      </button>

      {/* Verify / Initialize CNE Sheets Modal (Admin Only) */}
      {isVerifyModalOpen && user.role === 'ADMIN' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          {isVerifying ? (
            <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-xl border border-slate-200 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Verifying...</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Verifying configured CNE Google Spreadsheet tabs and headers. Please wait...
                </p>
              </div>
            </div>
          ) : verifyReport !== null ? (
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-slate-900">
                    CNE Sheets verification completed successfully.
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    All 13 authoritative CNE tabs and required headers were verified. Existing records remained completely untouched.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsVerifyModalOpen(false);
                    setVerifyReport(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Audit Report Table */}
              <div className="flex-1 overflow-y-auto min-h-0 border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px] sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5">Tab Name</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Row Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {verifyReport.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-slate-400">
                          No audit entries returned.
                        </td>
                      </tr>
                    ) : (
                      verifyReport.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                            {item.tab}
                          </td>
                          <td className="px-3 py-2.5">
                            {item.error ? (
                              <span className="text-amber-600 font-medium">{item.status} ({item.error})</span>
                            ) : item.status.toLowerCase().includes('created') ? (
                              <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-md text-[11px]">{item.status}</span>
                            ) : item.status.toLowerCase().includes('appended') ? (
                              <span className="text-blue-700 font-medium bg-blue-50 px-2 py-0.5 rounded-md text-[11px]">{item.status}</span>
                            ) : (
                              <span className="text-slate-700">{item.status}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums">
                            {item.rowCount !== undefined ? item.rowCount : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400">
                  {verifyReport.length} tab{verifyReport.length === 1 ? '' : 's'} reported
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsVerifyModalOpen(false);
                    setVerifyReport(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : verifyError !== null ? (
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Verification Failed</h3>
                  <p className="text-xs text-slate-500 mt-0.5">The backend reported an error during verification:</p>
                </div>
              </div>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 whitespace-pre-wrap font-mono">
                {verifyError}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsVerifyModalOpen(false);
                    setVerifyError(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* Confirmation Dialog */
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Verify / Initialize CNE Sheets</h3>
                  <p className="text-xs text-slate-500">Sheet Structure Check</p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed space-y-2">
                <p className="font-semibold text-slate-900">Verify / Initialize CNE Sheets?</p>
                <p>
                  This will verify the configured CNE Sheets and create any missing tabs or required headers.
                </p>
                <p className="text-slate-600">
                  Existing sheet data will not be deleted, cleared, reordered, or replaced.
                </p>
                <p className="font-semibold text-slate-900 pt-1">
                  Continue?
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsVerifyModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-admin-confirm-verify"
                  type="button"
                  onClick={handleExecuteVerifySheets}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer transition-colors shadow-xs"
                >
                  <span>Continue</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
