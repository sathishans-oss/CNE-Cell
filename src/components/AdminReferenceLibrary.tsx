import React, { useState, useEffect, useRef } from 'react';
import {
  Library,
  BookOpen,
  Upload,
  RefreshCw,
  Search,
  Filter,
  FileText,
  Trash2,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  X,
  Shield,
  ShieldAlert,
  Loader2,
  HardDrive,
  Info,
  Calendar,
  Layers,
  FileUp,
  Tag,
  Building
} from 'lucide-react';
import { SessionUser, CNENursingReferenceResource, CNENursingReferenceDriveFile } from '../types';
import { ApiService } from '../services/api';
import { useToast } from './Toast';

interface AdminReferenceLibraryProps {
  user: SessionUser;
}

export const AdminReferenceLibrary: React.FC<AdminReferenceLibraryProps> = ({ user }) => {
  const [resources, setResources] = useState<CNENursingReferenceResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadAuthor, setUploadAuthor] = useState('Open RN Project / Chippewa Valley Technical College');
  const [uploadLicense, setUploadLicense] = useState('CC BY 4.0');
  const [uploadVersion, setUploadVersion] = useState('2.0');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');

  // Delete Modal State
  const [resourceToDelete, setResourceToDelete] = useState<CNENursingReferenceResource | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Re-index Modal State
  const [resourceToReindex, setResourceToReindex] = useState<CNENursingReferenceResource | null>(null);
  const [isReindexing, setIsReindexing] = useState(false);

  const { success, error, warning, info } = useToast();

  useEffect(() => {
    if (user && user.role === 'ADMIN') {
      loadReferenceLibrary();
    }
  }, [user]);

  // Enforce authoritative Admin check on frontend
  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="bg-white p-8 rounded-2xl border border-rose-200 text-center max-w-lg mx-auto my-12 shadow-xs">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500 mt-1">
          Only authorized CNE Administrators can access and manage the Nursing Reference Library.
        </p>
      </div>
    );
  }

  const loadReferenceLibrary = async () => {
    setLoading(true);
    try {
      const res = await ApiService.listNursingReferenceResources();
      if (res.success && res.data) {
        setResources(res.data.resources || []);
      } else {
        error(res.message || 'Failed to load nursing reference resources.');
      }
    } catch (e: any) {
      error(e?.message || 'Error occurred while loading reference library.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenUploadModal = () => {
    setSelectedFile(null);
    setUploadTitle('');
    setUploadAuthor('Open RN Project / Chippewa Valley Technical College');
    setUploadLicense('CC BY 4.0');
    setUploadVersion('2.0');
    setUploadStatusText('');
    setIsUploadModalOpen(true);
  };

  const handleCloseUploadModal = () => {
    if (isUploading) return;
    setIsUploadModalOpen(false);
    setSelectedFile(null);
    setUploadTitle('');
    setUploadStatusText('');
  };

  const handleFileSelect = (file: File) => {
    const validExtensions = ['.pdf', '.docx', '.ppt', '.pptx'];
    const lowerName = file.name.toLowerCase();
    const isValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isValidExt) {
      error('Invalid file format. Only PDF (.pdf), Word (.docx), and PowerPoint (.ppt, .pptx) files are supported.');
      return;
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_FILE_SIZE) {
      error(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed limit of 5 MB.`);
      return;
    }

    setSelectedFile(file);
    if (!uploadTitle.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setUploadTitle(baseName);
    }
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

  const formatDateDisplay = (dateString?: string): string => {
    if (!dateString) return '—';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getFileTypeBadge = (fileType?: string) => {
    const ft = (fileType || '').toUpperCase();
    if (ft === 'PDF') {
      return {
        label: 'PDF',
        classes: 'bg-rose-50 text-rose-700 border-rose-200'
      };
    }
    if (ft === 'DOCX' || ft === 'DOC') {
      return {
        label: ft,
        classes: 'bg-blue-50 text-blue-700 border-blue-200'
      };
    }
    if (ft === 'PPT' || ft === 'PPTX') {
      return {
        label: ft,
        classes: 'bg-amber-50 text-amber-700 border-amber-200'
      };
    }
    return {
      label: ft || 'DOC',
      classes: 'bg-slate-50 text-slate-700 border-slate-200'
    };
  };

  // Perform upload to existing backend
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;

    if (!selectedFile) {
      error('Please select a reference material file (PDF, DOCX, PPT, PPTX up to 5 MB).');
      return;
    }

    if (!uploadTitle.trim()) {
      error('Please enter a Resource Title for this reference material.');
      return;
    }

    setIsUploading(true);
    setUploadStatusText('Preparing reference document...');

    try {
      setUploadStatusText('Encoding file payload...');
      const base64Data = await fileToBase64(selectedFile);

      setUploadStatusText('Storing in approved library and indexing content into local reference chunks...');
      const res = await ApiService.uploadNursingReferenceResource({
        fileName: selectedFile.name,
        base64Data,
        resourceTitle: uploadTitle.trim(),
        authorOrganization: uploadAuthor.trim() || undefined,
        license: uploadLicense.trim() || undefined,
        version: uploadVersion.trim() || undefined
      });

      if (res.success) {
        const chunks = res.data?.chunksCount || 0;
        success(
          `"${uploadTitle.trim()}" uploaded and indexed successfully (${chunks} clinical evidence chunks created).`,
          'Resource Indexed'
        );
        handleCloseUploadModal();
        await loadReferenceLibrary();
      } else {
        error(res.message || 'Failed to upload and index reference resource.');
      }
    } catch (err: any) {
      error(err?.message || 'An unexpected error occurred during upload.');
    } finally {
      setIsUploading(false);
      setUploadStatusText('');
    }
  };

  // Delete action
  const handleDeleteConfirm = async () => {
    if (!resourceToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await ApiService.deleteNursingReferenceResource({
        driveFileId: resourceToDelete.driveFileId
      });
      if (res.success) {
        const delCount = res.data?.deletedChunksCount || 0;
        success(
          `"${resourceToDelete.resourceTitle}" removed from library (${delCount} indexed chunks deleted).`,
          'Resource Deleted'
        );
        setResourceToDelete(null);
        await loadReferenceLibrary();
      } else {
        error(res.message || 'Failed to delete reference resource.');
      }
    } catch (err: any) {
      error(err?.message || 'Error occurred while deleting reference resource.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Re-index action
  const handleReindexConfirm = async () => {
    if (!resourceToReindex || isReindexing) return;
    setIsReindexing(true);
    try {
      const res = await ApiService.indexNursingReferenceResource({
        driveFileId: resourceToReindex.driveFileId,
        resourceTitle: resourceToReindex.resourceTitle,
        authorOrganization: resourceToReindex.authorOrganization,
        license: resourceToReindex.license,
        version: resourceToReindex.version,
        reindex: true
      });
      if (res.success) {
        const chunkCount = res.data?.chunksCount || 0;
        success(
          `"${resourceToReindex.resourceTitle}" re-indexed successfully (${chunkCount} evidence chunks refreshed).`,
          'Re-index Complete'
        );
        setResourceToReindex(null);
        await loadReferenceLibrary();
      } else {
        error(res.message || 'Failed to re-index reference resource.');
      }
    } catch (err: any) {
      error(err?.message || 'Error occurred while re-indexing reference resource.');
    } finally {
      setIsReindexing(false);
    }
  };

  // Filtered resources
  const filteredResources = resources.filter((res) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      res.resourceTitle.toLowerCase().includes(q) ||
      (res.authorOrganization && res.authorOrganization.toLowerCase().includes(q)) ||
      (res.license && res.license.toLowerCase().includes(q)) ||
      (res.version && res.version.toLowerCase().includes(q));

    const matchesType =
      filterType === 'ALL' ||
      (res.fileType && res.fileType.toUpperCase() === filterType);

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Nursing Reference Library</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                Phase 4B Open RN Repository
              </span>
            </div>
            <p className="text-xs text-slate-500 max-w-3xl">
              Upload, index, and manage authoritative nursing textbooks and clinical reference guidelines (Open RN, hospital protocols).
              Indexed contents serve as authoritative, local evidence for CNE question generation and clinical topic retrieval.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              id="btn-refresh-reference-library"
              onClick={loadReferenceLibrary}
              disabled={loading}
              title="Refresh Library"
              className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              id="btn-upload-reference-material"
              onClick={handleOpenUploadModal}
              className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-md cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Reference Material</span>
            </button>
          </div>
        </div>

        {/* Feature Summary Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
            <div className="text-[11px] font-medium text-slate-500">Active Resources</div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              {loading ? '...' : resources.filter((r) => r.active).length}
            </div>
            <div className="text-[10px] text-teal-700 font-semibold mt-0.5">Ready for Retrieval</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
            <div className="text-[11px] font-medium text-slate-500">Source Priority</div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">Local Level 2</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Follows CNE Topic Material</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
            <div className="text-[11px] font-medium text-slate-500">Supported Formats</div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">PDF • DOCX • PPT</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Max 5 MB per file</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
            <div className="text-[11px] font-medium text-slate-500">Repository Mode</div>
            <div className="text-lg font-bold text-purple-900 mt-0.5">Air-Gapped Local</div>
            <div className="text-[10px] text-purple-700 font-semibold mt-0.5">Zero External API Calls</div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            id="input-search-reference-library"
            type="text"
            placeholder="Search by title, author, organization, or license..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-500 font-medium">Format:</span>
          <select
            id="select-filter-filetype"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
          >
            <option value="ALL">All Formats</option>
            <option value="PDF">PDF Documents</option>
            <option value="DOCX">DOCX Documents</option>
            <option value="PPTX">PowerPoint (PPT / PPTX)</option>
          </select>
        </div>
      </div>

      {/* Main Reference Resources Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            <span className="text-xs font-medium">Loading nursing reference library...</span>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3">
              <Library className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {searchQuery || filterType !== 'ALL'
                ? 'No matching reference resources found'
                : 'No reference materials uploaded yet'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {searchQuery || filterType !== 'ALL'
                ? 'Try adjusting your search terms or filter selection.'
                : 'Upload Open RN textbooks (Skills, Pharmacology, Med-Surg) or local clinical protocols to enable local evidence retrieval for CNE questions.'}
            </p>
            {(!searchQuery && filterType === 'ALL') && (
              <button
                onClick={handleOpenUploadModal}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                <Upload className="w-4 h-4" />
                <span>Upload First Reference Resource</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="py-3 px-4">Resource Title</th>
                  <th className="py-3 px-4">Author / Organization</th>
                  <th className="py-3 px-4">Format</th>
                  <th className="py-3 px-4">License</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Indexed At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResources.map((res) => {
                  const badge = getFileTypeBadge(res.fileType);
                  return (
                    <tr key={res.resourceId || res.driveFileId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-purple-600 shrink-0" />
                          <span className="font-bold text-slate-900">{res.resourceTitle}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{res.authorOrganization || 'Open RN Project'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${badge.classes}`}>
                          {badge.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="flex items-center gap-1">
                          <Tag className="w-3 h-3 text-slate-400" />
                          <span>{res.license || 'CC BY 4.0'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                          v{res.version || '1.0'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {res.active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <span>Inactive</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{formatDateDisplay(res.indexedAt || res.updatedAt)}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`btn-reindex-${res.resourceId}`}
                            onClick={() => setResourceToReindex(res)}
                            title="Re-index this resource"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-purple-800 hover:bg-purple-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                          >
                            <RotateCw className="w-3 h-3 text-slate-500 hover:text-purple-700" />
                            <span>Re-index</span>
                          </button>

                          <button
                            id={`btn-delete-${res.resourceId}`}
                            onClick={() => setResourceToDelete(res)}
                            title="Delete this resource"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:text-rose-900 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3 text-rose-600" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Reference Material Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <FileUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload Reference Material</h3>
                  <p className="text-[11px] text-slate-500">
                    Approved formats: PDF, DOCX, PPT, PPTX (Maximum 5 MB)
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseUploadModal}
                disabled={isUploading}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="mt-4 space-y-4">
              {/* File Dropzone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Reference File <span className="text-rose-500">*</span>
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                    dragActive
                      ? 'border-purple-500 bg-purple-50/50'
                      : selectedFile
                      ? 'border-emerald-400 bg-emerald-50/30'
                      : 'border-slate-300 hover:border-purple-400 bg-slate-50 hover:bg-purple-50/20'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.ppt,.pptx"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  {selectedFile ? (
                    <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-emerald-200">
                      <div className="flex items-center gap-2.5 truncate">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div className="text-left truncate">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {selectedFile.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formatFileSize(selectedFile.size)} • {selectedFile.name.split('.').pop()?.toUpperCase()}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                        title="Remove selected file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Upload className="w-7 h-7 text-purple-600 mx-auto" />
                      <div className="text-xs font-semibold text-slate-700">
                        Drag and drop your reference file here, or{' '}
                        <span className="text-purple-700 underline">browse</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Supported: PDF, DOCX, PPT, PPTX (up to 5 MB)
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Resource Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-upload-title"
                    type="text"
                    required
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g. Open RN Clinical Nursing Skills"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Author / Organization
                    </label>
                    <input
                      id="input-upload-author"
                      type="text"
                      value={uploadAuthor}
                      onChange={(e) => setUploadAuthor(e.target.value)}
                      placeholder="Open RN Project"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      License
                    </label>
                    <input
                      id="input-upload-license"
                      type="text"
                      value={uploadLicense}
                      onChange={(e) => setUploadLicense(e.target.value)}
                      placeholder="CC BY 4.0"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Version / Edition
                  </label>
                  <input
                    id="input-upload-version"
                    type="text"
                    value={uploadVersion}
                    onChange={(e) => setUploadVersion(e.target.value)}
                    placeholder="2.0"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Informational callout */}
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 text-[11px] text-purple-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                <div>
                  The file will be securely stored in the approved reference folder and automatically indexed into clinical evidence chunks for local procedural retrieval.
                </div>
              </div>

              {/* Loading / Status indication */}
              {isUploading && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-center gap-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600 shrink-0" />
                  <span className="font-medium">{uploadStatusText || 'Uploading and indexing...'}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseUploadModal}
                  disabled={isUploading}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-upload-reference"
                  type="submit"
                  disabled={isUploading || !selectedFile || !uploadTitle.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Indexing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload & Index</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {resourceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Delete Reference Resource</h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to delete <strong className="text-slate-900">{resourceToDelete.resourceTitle}</strong> and all of its indexed material from the local nursing reference library?
                </p>
                <p className="text-[11px] text-rose-600 font-medium mt-2">
                  This will deactivate the resource and surgically remove all of its associated clinical evidence chunks from the search index.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResourceToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-reference"
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Resource</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Re-index Confirmation Modal */}
      {resourceToReindex && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <RotateCw className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Re-index Reference Resource</h3>
                <p className="text-xs text-slate-500">
                  Re-index <strong className="text-slate-900">{resourceToReindex.resourceTitle}</strong>?
                </p>
                <p className="text-[11px] text-slate-500 mt-2">
                  The server will re-read the file from the approved reference library, re-extract text, and refresh all clinical evidence chunks in the reference index.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResourceToReindex(null)}
                disabled={isReindexing}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-reindex-reference"
                type="button"
                onClick={handleReindexConfirm}
                disabled={isReindexing}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isReindexing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Re-indexing...</span>
                  </>
                ) : (
                  <>
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Re-index Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
