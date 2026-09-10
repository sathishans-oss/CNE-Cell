import React, { useState, useEffect } from 'react';
import { BookOpen, X, FileText, CheckCircle2, Loader2, Save, Info } from 'lucide-react';
import { UpcomingClass } from '../../types';
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
  const [unifiedContent, setUnifiedContent] = useState('');
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
        let content = res.data.unifiedContent || res.data.referenceText || '';

        // Backward compatibility: seamlessly merge legacy syllabus or reference links if not already present
        const legacyAdditions: string[] = [];
        if (res.data.syllabus && res.data.syllabus.trim() && !content.includes(res.data.syllabus.trim())) {
          legacyAdditions.push(`### Curriculum Coverage & Syllabus:\n${res.data.syllabus.trim()}`);
        }
        if (res.data.linkUrl && res.data.linkUrl.trim() && !content.includes(res.data.linkUrl.trim())) {
          legacyAdditions.push(`### Reference Links & Document URLs:\n${res.data.linkUrl.trim()}`);
        }

        if (legacyAdditions.length > 0) {
          content = content ? `${content}\n\n${legacyAdditions.join('\n\n')}` : legacyAdditions.join('\n\n');
        }

        if (!content && cne.description) {
          content = cne.description;
        }

        setUnifiedContent(content);
        setUpdatedBy(res.data.updatedBy);
        setUpdatedAt(res.data.updatedAt);
      } else if (cne.description) {
        setUnifiedContent(cne.description);
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

    if (!unifiedContent.trim()) {
      error('Please enter CNE Class Content / Learning Material before saving.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await ApiService.saveReferenceMaterial({
        cneId: cne.classId,
        unifiedContent: unifiedContent.trim(),
        referenceText: unifiedContent.trim()
      });

      if (res.success) {
        success('CNE Class Content / Learning Material saved successfully.');
        if (onUpdated) onUpdated();
        onClose();
      } else {
        error(res.message || 'Failed to save learning material.');
      }
    } catch (e: any) {
      error(e?.message || 'Error occurred while saving learning material.');
    } finally {
      setIsSaving(false);
    }
  };

  const charCount = unifiedContent.length;
  const wordCount = unifiedContent.trim() ? unifiedContent.trim().split(/\s+/).length : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl w-[92vw] max-w-[1300px] max-h-[88vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
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
                {cne.topic} &mdash; CNE Class Content &amp; Learning Material
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
          <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
            <span className="text-xs font-medium">Loading CNE learning material...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
            {/* Guidance Banner */}
            <div className="px-6 py-3 bg-teal-50/70 border-b border-teal-100/80 flex items-start gap-2.5 text-xs text-teal-900 shrink-0">
              <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                Enter or paste the complete educational content, clinical guidelines, and notes below.
                The AI Question Synthesizer reads this material directly to generate standardized clinical MCQs.
              </div>
            </div>

            {/* Spacious Unified Content Area */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-2 bg-slate-50/40">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-teal-600" />
                  CNE Class Content / Learning Material
                </label>
                <div className="text-[11px] text-slate-500 flex items-center gap-3">
                  <span>Words: <strong>{wordCount}</strong></span>
                  <span>Characters: <strong>{charCount}</strong></span>
                </div>
              </div>

              <textarea
                value={unifiedContent}
                onChange={(e) => setUnifiedContent(e.target.value)}
                disabled={!isAuthorized || isSaving}
                placeholder={`Enter or paste the complete educational content for this CNE session:

• Learning Objectives & Core Competencies
• Clinical Concepts, Protocols & Procedural Steps
• Medication Administration, Dosages & Monitoring Parameters
• Emergency Escalation & Nursing Interventions
• High-Yield Clinical Takeaways & Standards of Care
• Reference URLs / Document Links (Google Drive slides, hospital guidelines, etc.)`}
                className="w-full flex-1 min-h-[360px] p-4 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 leading-relaxed focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:opacity-60 shadow-xs resize-y font-sans"
              />

              {(updatedBy || updatedAt) && (
                <div className="px-3 py-2 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between shadow-2xs mt-1">
                  <span>Last updated by: <strong className="text-slate-700">{updatedBy || 'Coordinator'}</strong></span>
                  <span>{updatedAt ? new Date(updatedAt).toLocaleString() : ''}</span>
                </div>
              )}
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
                  disabled={isSaving || !unifiedContent.trim()}
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
                      <span>Save Learning Material</span>
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
