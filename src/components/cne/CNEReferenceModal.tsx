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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 relative">
        <button
          onClick={onClose}
          disabled={isSaving}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer transition-colors"
          title="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {cne.cneType || 'CNE'}
              </span>
              <span className="text-[10px] font-semibold text-slate-500">
                {cne.area}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-0.5 leading-snug">
              {cne.topic}
            </h3>
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
            <span className="text-xs">Loading reference material...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-600" />
                Syllabus & Curriculum Coverage
              </label>
              <textarea
                rows={3}
                value={syllabus}
                onChange={(e) => setSyllabus(e.target.value)}
                disabled={!isAuthorized || isSaving}
                placeholder="List core objectives, skills, and subtopics covered during this session..."
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-teal-600" />
                Clinical Reference Text & Key Takeaways
              </label>
              <textarea
                rows={5}
                value={referenceText}
                onChange={(e) => setReferenceText(e.target.value)}
                disabled={!isAuthorized || isSaving}
                placeholder="Enter clinical notes, protocols, drug calculations, procedural steps, or high-yield reference points..."
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:opacity-60 font-mono text-[11px]"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                This material is used by the AI Question Generator to formulate post-test MCQs.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-teal-600" />
                External Document / Guidelines URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  disabled={!isAuthorized || isSaving}
                  placeholder="https://drive.google.com/... or guideline link"
                  className="flex-1 p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:opacity-60"
                />
                {linkUrl && (
                  <a
                    href={linkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer"
                  >
                    Open
                  </a>
                )}
              </div>
            </div>

            {(updatedBy || updatedAt) && (
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Last updated by: <strong>{updatedBy || 'Coordinator'}</strong></span>
                <span>{updatedAt || ''}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium text-xs disabled:opacity-40 cursor-pointer"
              >
                Close
              </button>
              {isAuthorized && (
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
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
