import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  BookOpen,
  Library,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HardDrive,
  FolderOpen,
  Eye,
  EyeOff,
  User,
  Shield,
  Layers
} from 'lucide-react';
import {
  UpcomingClass,
  CNENursingReferenceDriveFile
} from '../../types';
import { ApiService } from '../../services/api';
import { useToast } from '../Toast';

interface AddResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialType?: 'CNE_LEARNING_MATERIAL' | 'NURSING_REFERENCE_LIB';
}

export const AddResourceModal: React.FC<AddResourceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialType = 'CNE_LEARNING_MATERIAL'
}) => {
  const [resourceType, setResourceType] = useState<'CNE_LEARNING_MATERIAL' | 'NURSING_REFERENCE_LIB'>(initialType);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visibleToUsers, setVisibleToUsers] = useState<boolean>(true);

  // --- CNE Learning Material State ---
  const [upcomingClasses, setUpcomingClasses] = useState<UpcomingClass[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [selectedCneId, setSelectedCneId] = useState<string>('');
  const [resourcePerson, setResourcePerson] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // --- Nursing Reference Library State ---
  const [refMode, setRefMode] = useState<'upload' | 'drive'>('upload');
  const [driveFiles, setDriveFiles] = useState<CNENursingReferenceDriveFile[]>([]);
  const [loadingDriveFiles, setLoadingDriveFiles] = useState(false);
  const [selectedDriveFileId, setSelectedDriveFileId] = useState<string>('');
  const [resourceTitle, setResourceTitle] = useState<string>('');
  const [authorOrg, setAuthorOrg] = useState<string>('Open RN Project / Chippewa Valley Technical College');
  const [license, setLicense] = useState<string>('CC BY 4.0');
  const [version, setVersion] = useState<string>('2nd Edition');

  // --- File Selection State ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { success, error, warning } = useToast();

  useEffect(() => {
    if (isOpen) {
      setResourceType(initialType);
      setVisibleToUsers(true);
      setSelectedFile(null);
      loadCneClasses();
      loadDriveFiles();
    }
  }, [isOpen, initialType]);

  const loadCneClasses = async () => {
    setLoadingClasses(true);
    try {
      const res = await ApiService.getUpcomingClasses();
      if (res.success && Array.isArray(res.data)) {
        setUpcomingClasses(res.data);
      }
    } catch {
      // Non-critical background fetch
    } finally {
      setLoadingClasses(false);
    }
  };

  const loadDriveFiles = async () => {
    setLoadingDriveFiles(true);
    try {
      const res = await ApiService.listNursingReferenceResources();
      if (res.success && res.data?.driveFiles) {
        setDriveFiles(res.data.driveFiles);
      }
    } catch {
      // Non-critical
    } finally {
      setLoadingDriveFiles(false);
    }
  };

  const handleSelectCneClass = (cneId: string) => {
    setSelectedCneId(cneId);
    const matched = upcomingClasses.find(
      (c) => (c.cneId || c.classId) === cneId
    );
    if (matched) {
      if (!resourcePerson || resourcePerson.trim() === '') {
        setResourcePerson(matched.resourcePersonName || matched.instructor || '');
      }
    }
  };

  const handleFileSelect = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (resourceType === 'CNE_LEARNING_MATERIAL') {
      const allowedExts = ['pdf', 'docx', 'doc', 'ppt', 'pptx'];
      if (!allowedExts.includes(ext)) {
        error('Invalid file format. Only PDF, DOCX, and PPT/PPTX presentations are supported.');
        return;
      }
      const MAX_SIZE = 10 * 1024 * 1024; // 10MB
      if (file.size > MAX_SIZE) {
        error(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 10 MB limit for CNE materials.`);
        return;
      }
    } else {
      const allowedExts = ['pdf', 'docx', 'txt', 'md'];
      if (!allowedExts.includes(ext)) {
        error('Invalid reference file format. Supported: PDF, DOCX, TXT, MD.');
        return;
      }
      const MAX_SIZE = 25 * 1024 * 1024; // 25MB for reference textbooks
      if (file.size > MAX_SIZE) {
        error(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 25 MB limit for reference books.`);
        return;
      }
      if (!resourceTitle || resourceTitle.trim() === '') {
        setResourceTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (resourceType === 'CNE_LEARNING_MATERIAL') {
      if (!selectedCneId) {
        error('Please select a CNE session or topic.');
        return;
      }
      if (!selectedFile) {
        error('Please select a document file to upload for this CNE session.');
        return;
      }

      setIsSubmitting(true);
      try {
        const base64 = await fileToBase64(selectedFile);
        const res = await ApiService.uploadLearningResource({
          cneId: selectedCneId,
          base64Data: base64,
          fileName: selectedFile.name,
          fileType: selectedFile.type || 'application/octet-stream',
          resourcePersonName: resourcePerson.trim() || undefined,
          unifiedContent: notes.trim() || undefined,
          visibleToUsers: visibleToUsers
        });

        if (res.success) {
          success(`CNE Material uploaded successfully: ${selectedFile.name}`);
          if (res.data?.indexingStatus === 'FAILED') {
            warning(res.data?.indexingMessage || 'The file was uploaded, but text indexing could not be completed.');
          }
          onSuccess();
          onClose();
        } else {
          error(res.message || 'Failed to upload CNE learning material.');
        }
      } catch (err: any) {
        error(err?.message || 'Error occurred while uploading learning material.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Nursing Reference Library
      if (refMode === 'upload') {
        if (!selectedFile) {
          error('Please select a reference textbook or document file to upload.');
          return;
        }
        if (!resourceTitle.trim()) {
          error('Please enter a Resource Title.');
          return;
        }

        setIsSubmitting(true);
        try {
          const base64 = await fileToBase64(selectedFile);
          const res = await ApiService.uploadNursingReferenceResource({
            fileName: selectedFile.name,
            base64Data: base64,
            resourceTitle: resourceTitle.trim(),
            authorOrganization: authorOrg.trim() || undefined,
            license: license.trim() || undefined,
            version: version.trim() || undefined,
            visibleToUsers: visibleToUsers
          });

          if (res.success) {
            success(`Reference resource uploaded and indexed: ${res.data?.chunksCount || 0} AI chunks created.`);
            onSuccess();
            onClose();
          } else {
            error(res.message || 'Failed to upload reference library resource.');
          }
        } catch (err: any) {
          error(err?.message || 'Error occurred while uploading reference resource.');
        } finally {
          setIsSubmitting(false);
        }
      } else {
        // Drive folder indexing
        if (!selectedDriveFileId) {
          error('Please select an unindexed file from the Open RN Drive folder.');
          return;
        }

        setIsSubmitting(true);
        try {
          const res = await ApiService.indexNursingReferenceResource({
            driveFileId: selectedDriveFileId,
            resourceTitle: resourceTitle.trim() || undefined,
            authorOrganization: authorOrg.trim() || undefined,
            license: license.trim() || undefined,
            version: version.trim() || undefined,
            visibleToUsers: visibleToUsers,
            reindex: false
          });

          if (res.success) {
            success(`Drive resource indexed: ${res.data?.chunksCount || 0} chunks added to local index.`);
            onSuccess();
            onClose();
          } else {
            error(res.message || 'Failed to index reference resource from Drive.');
          }
        } catch (err: any) {
          error(err?.message || 'Error indexing reference file.');
        } finally {
          setIsSubmitting(false);
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Add Learning Resource
              </h2>
              <p className="text-[11px] text-slate-400">
                Upload CNE session material or clinical reference library textbooks
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Resource Type Selection Tabs */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Resource Category
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setResourceType('CNE_LEARNING_MATERIAL');
                  setSelectedFile(null);
                }}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  resourceType === 'CNE_LEARNING_MATERIAL'
                    ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-500/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    resourceType === 'CNE_LEARNING_MATERIAL'
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Learning Materials
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Attach slides, guidelines, or handouts to a scheduled CNE topic
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setResourceType('NURSING_REFERENCE_LIB');
                  setSelectedFile(null);
                }}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  resourceType === 'NURSING_REFERENCE_LIB'
                    ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    resourceType === 'NURSING_REFERENCE_LIB'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Library className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Library
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Open RN textbook or standard clinical reference for AI grounding
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Form Content: CNE Material */}
          {resourceType === 'CNE_LEARNING_MATERIAL' && (
            <div className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select CNE Session / Topic <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedCneId}
                  onChange={(e) => handleSelectCneClass(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                >
                  <option value="">-- Choose scheduled CNE session --</option>
                  {upcomingClasses.map((c) => {
                    const id = c.cneId || c.classId || '';
                    return (
                      <option key={id} value={id}>
                        {c.topic} {c.date ? `(${new Date(c.date).toLocaleDateString()})` : ''} - {c.area || 'All Hospital'}
                      </option>
                    );
                  })}
                </select>
                {loadingClasses && (
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading available CNE sessions...
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Resource Person / Instructor Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={resourcePerson}
                    onChange={(e) => setResourcePerson(e.target.value)}
                    placeholder="e.g., Dr. Ananya Sharma / Clinical Instructor"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes & Reference Syllabus (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Key clinical objectives, procedural highlights, or syllabus points..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none"
                />
              </div>
            </div>
          )}

          {/* Form Content: Nursing Reference Library */}
          {resourceType === 'NURSING_REFERENCE_LIB' && (
            <div className="space-y-4 pt-1">
              {/* Mode switch */}
              <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setRefMode('upload')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    refMode === 'upload'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Upload New Reference File
                </button>
                <button
                  type="button"
                  onClick={() => setRefMode('drive')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    refMode === 'drive'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Select from Drive Folder ({driveFiles.filter((f) => !f.isIndexed).length} Unindexed)
                </button>
              </div>

              {refMode === 'drive' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Unindexed Drive File <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedDriveFileId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedDriveFileId(id);
                      const f = driveFiles.find((df) => df.driveFileId === id);
                      if (f) {
                        setResourceTitle(f.fileName.replace(/\.[^/.]+$/, ''));
                      }
                    }}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  >
                    <option value="">-- Choose unindexed file in Open RN folder --</option>
                    {driveFiles
                      .filter((f) => !f.isIndexed)
                      .map((f) => (
                        <option key={f.driveFileId} value={f.driveFileId}>
                          {f.fileName} ({(f.fileSize / (1024 * 1024)).toFixed(1)} MB)
                        </option>
                      ))}
                  </select>
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Resource / Textbook Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={resourceTitle}
                    onChange={(e) => setResourceTitle(e.target.value)}
                    required
                    placeholder="e.g., Nursing Fundamentals - Open RN"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Author / Organization
                  </label>
                  <input
                    type="text"
                    value={authorOrg}
                    onChange={(e) => setAuthorOrg(e.target.value)}
                    placeholder="e.g., Open RN / CVTC"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    License & Version
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={license}
                      onChange={(e) => setLicense(e.target.value)}
                      placeholder="CC BY 4.0"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                    <input
                      type="text"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="2nd Edition"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* File Upload Dropzone (for CNE or Ref Library Upload mode) */}
          {(resourceType === 'CNE_LEARNING_MATERIAL' || (resourceType === 'NURSING_REFERENCE_LIB' && refMode === 'upload')) && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Upload File <span className="text-rose-500">*</span>
              </label>
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
                  dragActive
                    ? 'border-teal-500 bg-teal-50/50'
                    : selectedFile
                    ? 'border-emerald-400 bg-emerald-50/30'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                  accept={
                    resourceType === 'CNE_LEARNING_MATERIAL'
                      ? '.pdf,.docx,.doc,.ppt,.pptx'
                      : '.pdf,.docx,.txt,.md'
                  }
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-slate-800 truncate max-w-sm">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to upload & index
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                      className="ml-auto text-xs text-rose-600 hover:underline p-1 cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <Upload className="w-6 h-6 text-slate-400 mb-1.5" />
                    <p className="text-xs font-semibold text-slate-700">
                      Drag & drop your file here, or{' '}
                      <span className="text-teal-600 hover:underline">browse</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {resourceType === 'CNE_LEARNING_MATERIAL'
                        ? 'Supported: PDF, DOCX, PPT, PPTX (Max 10 MB)'
                        : 'Supported: PDF, DOCX, TXT, MD (Max 25 MB)'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Visibility Toggle Switch (for Admins) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  visibleToUsers ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {visibleToUsers ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">
                  User Visibility: {visibleToUsers ? 'Visible to Users' : 'Hidden from Users'}
                </div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  {visibleToUsers
                    ? 'Staff and participants can view, preview, and download this resource.'
                    : 'Only Admins can see and access this resource. (AI retrieval remains active).'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setVisibleToUsers(!visibleToUsers)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                visibleToUsers ? 'bg-teal-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  visibleToUsers ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing & Indexing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>
                    {resourceType === 'CNE_LEARNING_MATERIAL' ? 'Upload CNE Material' : 'Register Reference Book'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
