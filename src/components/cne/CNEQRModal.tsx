import React, { useState, useEffect } from 'react';
import { QrCode, X, Copy, Check, Loader2, AlertCircle, Save } from 'lucide-react';
import QRCode from 'qrcode';
import { CNERecord } from '../../types';
import { ApiService } from '../../services/api';
import { useToast } from '../Toast';
import { formatCneDateTimeDisplay } from '../../utils';

interface CNEQRModalProps {
  cne: CNERecord;
  onClose: () => void;
  onSaveSuccess?: (cneId: string) => void;
  onOpenPostTest?: (token: string) => void;
}

export const CNEQRModal: React.FC<CNEQRModalProps> = ({
  cne,
  onClose,
  onSaveSuccess
}) => {
  const cneId = cne.cneId || cne.classId || '';
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasQR, setHasQR] = useState(false);
  const [qrToken, setQrToken] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [postTestUrl, setPostTestUrl] = useState('');
  const [finalizedCount, setFinalizedCount] = useState<number>(0);

  const { success, error } = useToast();

  useEffect(() => {
    checkExistingQR();
  }, [cneId]);

  // Check whether a QR code/token already exists for the CNE without generating a new one
  const checkExistingQR = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getQRToken(cneId, { checkOnly: true });
      if (res.success && res.data) {
        setFinalizedCount(res.data.finalizedCount || 0);
        if (res.data.hasQR && res.data.qrToken) {
          const token = res.data.qrToken;
          setHasQR(true);
          setQrToken(token);

          // Formulate target URL with query params
          const url = `${window.location.origin}/?postTest=${encodeURIComponent(token)}`;
          setPostTestUrl(url);

          // Generate QR Code data URL
          const dataUrl = await QRCode.toDataURL(url, {
            width: 280,
            margin: 2,
            color: {
              dark: '#1e1b4b', // deep indigo/purple
              light: '#ffffff'
            }
          });
          setQrDataUrl(dataUrl);
        } else {
          setHasQR(false);
          setQrToken('');
          setQrDataUrl('');
          setPostTestUrl('');
        }
      } else {
        setHasQR(false);
      }
    } catch (e: any) {
      console.warn('Error checking existing QR token:', e);
      setHasQR(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (isSaving || loading) return;
    setIsSaving(true);
    try {
      // Authoritatively generate or reuse QR token and persist state
      const res = await ApiService.getQRToken(cneId, { checkOnly: false });
      if (res.success && res.data) {
        success('Evaluation QR code saved successfully.');
        if (onSaveSuccess) {
          onSaveSuccess(cneId);
        } else {
          onClose();
        }
      } else {
        error(res.message || 'Failed to save QR token for CNE.');
      }
    } catch (e: any) {
      error(e?.message || 'Error occurred while saving QR code.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = () => {
    if (!postTestUrl) return;
    navigator.clipboard.writeText(postTestUrl);
    setCopied(true);
    success('Post-test link copied to clipboard.');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl w-[90vw] max-w-[1050px] max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-end shrink-0 bg-slate-50/70">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 cursor-pointer transition-colors shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="text-xs">Checking QR status for CNE session...</span>
          </div>
        ) : (
          <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-50/40 items-center">
            {/* Left Column: QR Code Display or Ungenerated State */}
            <div className="md:col-span-5 flex flex-col items-center justify-center p-5 bg-white rounded-2xl border border-slate-200 shadow-xs text-center min-h-[280px]">
              {hasQR && qrDataUrl ? (
                <>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
                    <img
                      src={qrDataUrl}
                      alt={`Post-Test QR for ${cne.topic}`}
                      className="w-52 h-52 mx-auto rounded-xl shadow-xs"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-3 font-medium">
                    Scan with any mobile camera or scanner
                  </p>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="w-20 h-20 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500">
                    <QrCode className="w-10 h-10 stroke-[1.5]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">QR Code Not Yet Generated</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                      This CNE session does not have an active QR code. Click <span className="font-semibold text-slate-700">Save</span> below to generate and activate the evaluation QR code.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Information, Status, and Link */}
            <div className="md:col-span-7 space-y-4">
              {finalizedCount < 5 ? (
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block mb-0.5">Question Bank Pending:</strong>
                    <span>At least 5 finalized questions are required before QR code activation. Currently finalized: {finalizedCount}/5.</span>
                  </div>
                </div>
              ) : hasQR ? (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  <span><strong>{finalizedCount} questions</strong> are active and post-test evaluation is live.</span>
                </div>
              ) : (
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-xs text-indigo-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                  <span><strong>{finalizedCount} questions</strong> are finalized and ready for QR activation.</span>
                </div>
              )}

              {/* Meta details */}
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Topic:</span>
                  <span className="font-bold text-slate-800 text-right max-w-xs truncate">{cne.topic}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Department / Area:</span>
                  <span className="font-semibold text-slate-700">{cne.area}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Schedule:</span>
                  <span className="font-semibold text-slate-700">{formatCneDateTimeDisplay(cne.date, cne.toDate, cne.time)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Resource Person:</span>
                  <span className="font-semibold text-slate-700">{cne.resourcePersonName || cne.resourcePersonEmpId || 'Department Faculty'}</span>
                </div>
              </div>

              {/* Direct Link - only if QR token exists */}
              {hasQR && postTestUrl && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Direct Participant Evaluation URL
                  </label>
                  <div className="flex items-center gap-2 p-1.5 bg-white rounded-xl border border-slate-300 shadow-xs">
                    <input
                      type="text"
                      readOnly
                      value={postTestUrl}
                      className="flex-1 bg-transparent text-xs text-slate-700 px-2 truncate outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-colors shrink-0"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer with ONLY Save button */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/70 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || loading || (!hasQR && finalizedCount < 5)}
            className="flex items-center gap-1.5 px-5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
            title="Save QR code and return to CNE details"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
