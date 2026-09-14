import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  X,
  FileText,
  CheckCircle2,
  Loader2,
  Save,
  Info,
  Upload,
  User,
  ArrowRight,
  HardDrive,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { UpcomingClass, CNELearningResourceMetadata } from '../../types';
import { ApiService } from '../../services/api';
import { useToast } from '../Toast';

interface CNEReferenceModalProps {
  cne: UpcomingClass;
  isAuthorized: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  onNavigateToQuestions?: () => void;
}

export const CNEReferenceModal: React.FC<CNEReferenceModalProps> = ({
  cne,
  isAuthorized,
  onClose,
  onUpdated,
  onNavigateToQuestions
}) => {
  const cneId = cne.cneId || cne.classId || '';
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  // Content & Resource Person
  const [unifiedContent, setUnifiedContent] = useState('');
  const [resourcePerson, setResourcePerson] = useState(cne.resourcePersonName || cne.instructor || '');
  const [updatedBy, setUpdatedBy] = useState<string | undefined>(undefined);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>(undefined);

  // Existing Uploaded File Metadata
  const [existingResource, setExistingResource] = useState<CNELearningResourceMetadata | null>(null);

  // Newly Selected File for Upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Secure Delete State
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { success, error, warning } = useToast();

  useEffect(() => {
    loadAllReferenceData();
  }, [cneId]);

  const loadAllReferenceData = async () => {
    setLoading(true);
    try {
      const [refRes, resourceRes] = await Promise.all([
        ApiService.getReferenceMaterial(cneId),
        ApiService.getLearningResource(cneId)
      ]);

      if (refRes.success && refRes.data) {
        let content = refRes.data.unifiedContent || refRes.data.referenceText || '';
        if (!content && cne.description) {
          content = cne.description;
        }
        setUnifiedContent(content);
        setUpdatedBy(refRes.data.updatedBy);
        setUpdatedAt(refRes.data.updatedAt);
      } else if (cne.description) {
        setUnifiedContent(cne.description);
      }

      if (resourceRes.success && resourceRes.data) {
        if (resourceRes.data.hasFile || resourceRes.data.driveFileId) {
          setExistingResource(resourceRes.data);
          if (resourceRes.data.resourcePersonName && !resourcePerson) {
            setResourcePerson(resourceRes.data.resourcePersonName);
          }
        }
      }
    } catch (e: any) {
      console.warn('Failed to load reference material or learning resource:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteResource = async () => {
    if (isDeleting || isSaving || !isAuthorized) return;
    setIsDeleting(true);
    try {
      const res = await ApiService.deleteLearningResource(cneId);
      if (res.success) {
        success('Learning resource deleted successfully.');
        setShowDeleteConfirm(false);
        setExistingResource(null);
        setSelectedFile(null);
        if (onUpdated) onUpdated();
        await loadAllReferenceData();
      } else {
        error(res.message || 'Failed to delete learning resource.');
      }
    } catch (e: any) {
      error(e?.message || 'Error occurred while deleting learning resource.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFileSelect = (file: File) => {
    const validExtensions = ['.pdf', '.docx', '.ppt', '.pptx'];
    const lowerName = file.name.toLowerCase();
    const isValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isValidExt) {
      error('Invalid file format. Only PDF (.pdf), Word (.docx), and PowerPoint (.ppt, .pptx) files are supported.');
      return;
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      error(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed limit of 5 MB.`);
      return;
    }

    setSelectedFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes <= 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  /**
   * Core persistence handler
   * returns true on success, false on failure
   */
  const performSave = async (): Promise<boolean> => {
    if (savingRef.current || isSaving || !isAuthorized) return false;

    const hasAnyFile = selectedFile !== null || (existingResource && existingResource.hasFile);
    const hasAnyText = unifiedContent.trim().length > 0;

    if (!hasAnyFile && !hasAnyText) {
      error('Please upload a CNE learning resource file (PDF, DOCX, PPT) or enter educational notes.');
      return false;
    }

    savingRef.current = true;
    setIsSaving(true);

    try {
      // 1. Upload newly selected file if provided
      if (selectedFile) {
        const base64Data = await fileToBase64(selectedFile);
        const uploadRes = await ApiService.uploadLearningResource({
          cneId: cneId,
          base64Data: base64Data,
          fileName: selectedFile.name,
          fileType: selectedFile.type || 'application/octet-stream',
          resourcePersonName: resourcePerson.trim() || undefined,
          unifiedContent: unifiedContent.trim() || undefined
        });

        if (!uploadRes.success) {
          error(uploadRes.message || 'Failed to upload learning resource file to Drive.');
          return false;
        }

        setExistingResource(uploadRes.data || null);
        setSelectedFile(null);
      }

      // 2. Save unified textual content if entered
      if (hasAnyText) {
        const textRes = await ApiService.saveReferenceMaterial({
          cneId: cneId,
          unifiedContent: unifiedContent.trim(),
          referenceText: unifiedContent.trim()
        });

        if (!textRes.success && !selectedFile) {
          error(textRes.message || 'Failed to save reference material notes.');
          return false;
        }
      }

      if (onUpdated) onUpdated();
      return true;
    } catch (e: any) {
      error(e?.message || 'Error occurred while saving learning resource.');
      return false;
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  /**
   * Bottom button: Save
   * Stays on Material page. Does NOT move forward.
   */
  const handleSaveOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    const successResult = await performSave();
    if (successResult) {
      success('Learning resource saved successfully.');
      loadAllReferenceData();
    }
  };

  /**
   * Bottom button: Save & Next
   * Moves forward to Questions only after successful backend persistence.
   */
  const handleSaveAndNext = async (e: React.FormEvent) => {
    e.preventDefault();
    const successResult = await performSave();
    if (successResult) {
      success('Learning resource saved. Advancing to Questions stage.');
      if (onNavigateToQuestions) {
        onNavigateToQuestions();
      }
    }
  };

  const charCount = unifiedContent.length;
  const wordCount = unifiedContent.trim() ? unifiedContent.trim().split(/\s+/).length : 0;

  const isEmployeeId = (val?: string) => {
    if (!val) return false;
    const clean = val.trim();
    return /^RSN/i.test(clean) || /^[A-Z]{2,}\d{3,}$/i.test(clean);
  };
  const displayUpdatedBy = updatedBy && !isEmployeeId(updatedBy) ? updatedBy : 'Coordinator';

  return (
    <div id="cne-material-modal" className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl w-[94vw] max-w-[1280px] max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/80">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug line-clamp-1 truncate">
              {cne.topic}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 disabled:opacity-40 cursor-pointer transition-colors shrink-0"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
            <span className="text-xs font-medium">Loading CNE learning resource...</span>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Guidance Banner */}
            <div className="px-6 py-2.5 bg-teal-50/70 border-b border-teal-100/80 flex items-start gap-2.5 text-xs text-teal-900 shrink-0">
              <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                Upload the authoritative presentation slides, PDF guideline, or document (PDF, DOCX, PPT, PPTX up to 5MB).
                The AI Question Synthesizer reads the uploaded document as primary grounding to generate 5 standardized clinical MCQs.
              </div>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5 bg-slate-50/40">
              {/* Resource Person Input */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <User className="w-3.5 h-3.5 text-teal-600" />
                  Resource Person / Speaker
                </label>
                <input
                  type="text"
                  value={resourcePerson}
                  onChange={(e) => setResourcePerson(e.target.value)}
                  disabled={!isAuthorized || isSaving}
                  placeholder="e.g. Dr. A. Sharma / Sister In-Charge / Clinical Specialist"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:opacity-60"
                />
              </div>

              {/* Upload Learning Resource File Section */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-teal-600" />
                    Upload Learning Resource File (PDF, DOCX, PPT, PPTX &le; 5MB)
                  </label>
                  <span className="text-[11px] text-slate-400">Max size: 5 MB</span>
                </div>

                {/* Existing Stored Resource Card */}
                {existingResource && existingResource.hasFile && (
                  <div className="p-3.5 bg-teal-50/50 border border-teal-200 rounded-xl flex flex-col gap-2.5 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 font-bold text-[10px]">
                          {(existingResource.fileType || 'FILE').toUpperCase().slice(0, 4)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 truncate" title={existingResource.fileName}>
                            {existingResource.fileName}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>Size: <strong>{formatFileSize(existingResource.fileSize)}</strong></span>
                            <span>&bull;</span>
                            <span>Attached by: <strong>{existingResource.updatedBy || 'Coordinator'}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          Attached
                        </span>
                        {isAuthorized && (
                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={isDeleting || isSaving}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
                            title="Delete this uploaded file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Delete Confirmation Box */}
                    {showDeleteConfirm && (
                      <div className="mt-1 p-3 bg-rose-50 border border-rose-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 text-rose-800 text-xs font-medium">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Are you sure you want to delete this resource file? This will remove the file from Google Drive.</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(false)}
                            disabled={isDeleting}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteResource}
                            disabled={isDeleting}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-2xs cursor-pointer transition-colors disabled:opacity-50"
                          >
                            {isDeleting ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Deleting...</span>
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-3 h-3" />
                                <span>Confirm Delete</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Dropzone / File Picker */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.ppt,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-1.5 ${
                    dragActive
                      ? 'border-teal-500 bg-teal-50/50'
                      : 'border-slate-300 hover:border-teal-400 bg-slate-50/60'
                  }`}
                >
                  <Upload className="w-6 h-6 text-teal-600 mb-0.5" />
                  <p className="text-xs font-semibold text-slate-800">
                    {selectedFile ? (
                      <span className="text-teal-700 font-bold">
                        Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                      </span>
                    ) : (
                      <span>
                        Drag and drop your file here, or <span className="text-teal-600 underline">browse</span>
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Supported: PDF (.pdf), Word (.docx), PowerPoint (.ppt, .pptx)
                  </p>
                </div>

                {selectedFile && (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 rounded-lg text-xs text-slate-600">
                    <span>Ready for upload on Save</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Text Notes / Guidelines Section */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-teal-600" />
                    Educational Notes / Clinical Guidelines (Optional / Supplementary)
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
                  placeholder={`Optional supplementary notes, key takeaways, or clinical references:
• Learning Objectives & Core Competencies
• Procedural Steps & Nursing Escalations
• References and Hospital Guidelines`}
                  className="w-full min-h-[140px] p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 leading-relaxed focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:opacity-60 resize-y"
                />

                {(updatedBy || updatedAt) && (
                  <div className="px-3 py-1.5 bg-slate-50 rounded-lg text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Last updated by: <strong className="text-slate-600">{displayUpdatedBy}</strong></span>
                    <span>{updatedAt ? new Date(updatedAt).toLocaleString() : ''}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer with Save and Save & Next */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-500">
                {selectedFile ? (
                  <span className="text-teal-700 font-medium">
                    1 new file ready to be saved
                  </span>
                ) : existingResource?.hasFile ? (
                  <span className="text-slate-600">
                    Current file: <strong>{existingResource.fileName}</strong>
                  </span>
                ) : (
                  <span className="text-slate-400">
                    Attach a document or notes to proceed
                  </span>
                )}
              </div>

              {isAuthorized && (
                <div className="flex items-center gap-2.5">
                  {/* Button 1: Save (stays on Material) */}
                  <button
                    type="button"
                    onClick={handleSaveOnly}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5 text-slate-600" />
                        <span>Save</span>
                      </>
                    )}
                  </button>

                  {/* Button 2: Save & Next (moves to Questions only after save) */}
                  <button
                    type="button"
                    onClick={handleSaveAndNext}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving &amp; Moving...</span>
                      </>
                    ) : (
                      <>
                        <span>Save &amp; Next</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
