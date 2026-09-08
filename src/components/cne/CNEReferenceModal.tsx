import React, { useState, useEffect } from 'react';
import { BookOpen, X, Link as LinkIcon, FileText, CheckCircle2, Loader2, Save } from 'lucide-react';
import { UpcomingClass, CNEReferenceMaterial } from '../../types';
import { ApiService } from '../../services/api';
import { useToast } from '../Toast';

interface CNEReferenceModalProps {
  cne: UpcomingClass;
  isAuthorized: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export const CNEReferenceModal: React.FC<CNEReferenceModalProps> = ({
  cne,
  isAuthorized,
  onClose,
  onUpdated
}) => {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [referenceText, setReferenceText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [syllabus, setSyllabus] = useState('');
  const [updatedBy, setUpdatedBy] = useState<string | undefined>(undefined);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>(undefined);

  const { success, error } = useToast();

  useEffect(() => {
    loadReference();
  }, [cne.classId]);

  const loadReference = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getReferenceMaterial(cne.classId);
      if (res.success && res.data) {
        setReferenceText(res.data.referenceText || '');
        setLinkUrl(res.data.linkUrl || '');
        setSyllabus(res.data.syllabus || '');
        setUpdatedBy(res.data.updatedBy);
        setUpdatedAt(res.data.updatedAt);
      } else {
        // Default with CNE description if available
        if (cne.description) {
          setSyllabus(cne.description);
        }
      }
    } catch (e: any) {
      console.warn('Failed to load reference material:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || !isAuthorized) return;

    setIsSaving(true);
    try {
      const res = await ApiService.saveReferenceMaterial({
        cneId: cne.classId,
        referenceText: referenceText.trim(),
        linkUrl: linkUrl.trim(),
        syllabus: syllabus.trim()
      });

      if (res.success) {
        success('Topic reference material saved successfully.');
        if (onUpdated) onUpdated();
        onClose();
      } else {
        error(res.message || 'Failed to save reference material.');
      }
    } catch (e: any) {
      error(e?.message || 'Error occurred while saving reference material.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl w-[90vw] max-w-[1300px] max-h-[85vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                  {cne.cneType || 'CNE'}
                </span>
                <span className="text-[11px] font-semibold text-slate-600">
                  {cne.area}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  ({cne.classId})
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 leading-snug line-clamp-1">
                {cne.topic} &mdash; Reference Material &amp; Clinical Syllabus
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 disabled:opacity-40 cursor-pointer transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
            <span className="text-xs">Loading reference material...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
            {/* 2-Column Wide Body */}
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs bg-slate-50/40">
              {/* Left Column: Syllabus and Links */}
              <div className="space-y-4 flex flex-col">
                <div className="flex-1 flex flex-col">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-teal-600" />
                    Syllabus &amp; Curriculum Coverage
                  </label>
                  <textarea
                    rows={7}
                    value={syllabus}
                    onChange={(e) => setSyllabus(e.target.value)}
                    disabled={!isAuthorized || isSaving}
                    placeholder="List core objectives, procedural skills, and clinical subtopics covered during this CNE session..."
                    className="w-full flex-1 min-h-[160px] p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:opacity-60 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-teal-600" />
                    External Guidelines / Slides Document URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      disabled={!isAuthorized || isSaving}
                      placeholder="https://drive.google.com/... or guideline link"
                      className="flex-1 p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:opacity-60 shadow-xs"
                    />
                    {linkUrl && (
                      <a
                        href={linkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        Open Link
                      </a>
                    )}
                  </div>
                </div>

                {(updatedBy || updatedAt) && (
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between shadow-xs mt-auto">
                    <span>Last updated by: <strong className="text-slate-700">{updatedBy || 'Coordinator'}</strong></span>
                    <span>{updatedAt || ''}</span>
                  </div>
                )}
              </div>

              {/* Right Column: Reference Text for AI Generation */}
              <div className="space-y-2 flex flex-col">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-teal-600" />
                  Clinical Reference Text &amp; Key Takeaways
                </label>
                <div className="flex-1 flex flex-col">
                  <textarea
                    rows={12}
                    value={referenceText}
                    onChange={(e) => setReferenceText(e.target.value)}
                    disabled={!isAuthorized || isSaving}
                    placeholder="Enter clinical notes, protocols, drug calculations, procedural steps, or high-yield reference points..."
                    className="w-full flex-1 min-h-[240px] p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:opacity-60 font-mono text-[11px] shadow-xs"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    This material is used by the Question Bank and AI Generator to formulate standardized post-test MCQs.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium text-xs disabled:opacity-40 cursor-pointer transition-colors"
              >
                Close
              </button>
              {isAuthorized && (
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Material...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Reference Material</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
