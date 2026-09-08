import React, { useState, useEffect } from 'react';
import { QrCode, X, Copy, Check, Printer, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { UpcomingClass } from '../../types';
import { ApiService } from '../../services/api';
import { useToast } from '../Toast';

interface CNEQRModalProps {
  cne: UpcomingClass;
  onClose: () => void;
  onOpenPostTest?: (token: string) => void;
}

export const CNEQRModal: React.FC<CNEQRModalProps> = ({
  cne,
  onClose,
  onOpenPostTest
}) => {
  const [loading, setLoading] = useState(true);
  const [qrToken, setQrToken] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [postTestUrl, setPostTestUrl] = useState('');
  const [finalizedCount, setFinalizedCount] = useState<number>(0);

  const { success, error } = useToast();

  useEffect(() => {
    loadQR();
  }, [cne.classId]);

  const loadQR = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getQRToken(cne.classId);
      if (res.success && res.data) {
        const token = res.data.qrToken;
        setQrToken(token);
        setFinalizedCount(res.data.finalizedCount || 0);

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
        error(res.message || 'Failed to generate QR token for CNE.');
      }
    } catch (e: any) {
      error(e?.message || 'Error creating QR code.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!postTestUrl) return;
    navigator.clipboard.writeText(postTestUrl);
    setCopied(true);
    success('Post-test link copied to clipboard.');
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl w-[90vw] max-w-[1050px] max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                  QR Evaluation Access
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  ({cne.classId})
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 truncate max-w-xl">
                {cne.topic} &mdash; Participant Post-Test QR
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

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="text-xs">Generating secure evaluation QR token...</span>
          </div>
        ) : (
          <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-50/40 items-center">
            {/* Left Column: QR Code Display */}
            <div className="md:col-span-5 flex flex-col items-center justify-center p-5 bg-white rounded-2xl border border-slate-200 shadow-xs text-center">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`Post-Test QR for ${cne.topic}`}
                    className="w-52 h-52 mx-auto rounded-xl shadow-xs"
                  />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center text-slate-400 text-xs">
                    Failed to load QR
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-3 font-medium">
                Scan with any mobile camera or scanner
              </p>
            </div>

            {/* Right Column: Information, Link, and Actions */}
            <div className="md:col-span-7 space-y-4">
              {finalizedCount === 0 ? (
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block mb-0.5">Question Bank Pending:</strong>
                    <span>No finalized questions have been published yet for this CNE. Finalize questions in the Question Bank before participants can submit responses.</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span><strong>{finalizedCount} questions</strong> are active and ready for participant post-test submission.</span>
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
                  <span className="text-slate-500">Schedule Date:</span>
                  <span className="font-semibold text-slate-700">{cne.date} {cne.time ? `• ${cne.time}` : ''}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Resource Person:</span>
                  <span className="font-semibold text-slate-700">{cne.resourcePersonName || cne.resourcePersonEmpId || 'Department Faculty'}</span>
                </div>
              </div>

              {/* Direct Link */}
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

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>Print QR Poster</span>
                </button>

                {onOpenPostTest && qrToken && (
                  <button
                    type="button"
                    onClick={() => onOpenPostTest(qrToken)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Post-Test Preview</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium text-xs cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
