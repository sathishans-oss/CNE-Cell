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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center mx-auto mb-3">
          <QrCode className="w-6 h-6" />
        </div>

        <h3 className="text-base font-bold text-slate-900 leading-snug mb-1">
          Participant Post-Test QR Code
        </h3>
        <p className="text-xs text-slate-500 mb-4 truncate px-4" title={cne.topic}>
          {cne.topic}
        </p>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="text-xs">Generating secure evaluation QR token...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {finalizedCount === 0 && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Notice:</strong> No finalized questions have been published yet for this CNE. Please finalize questions in the Question Bank before participants can submit.
                </span>
              </div>
            )}

            {/* QR Code Graphic */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block shadow-inner mx-auto">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`Post-Test QR for ${cne.topic}`}
                  className="w-56 h-56 mx-auto rounded-xl shadow-xs"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs">
                  Failed to load QR
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500">
              Scan with any smartphone camera to open the instant post-test evaluation form.
            </p>

            {/* Direct Link & Actions */}
            <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-xl border border-slate-200 text-left">
              <input
                type="text"
                readOnly
                value={postTestUrl}
                className="flex-1 bg-transparent text-[11px] text-slate-700 px-2 truncate outline-none font-mono"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold shadow-xs cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print QR Poster</span>
              </button>

              {onOpenPostTest && qrToken && (
                <button
                  type="button"
                  onClick={() => onOpenPostTest(qrToken)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Post-Test Now</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
