import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Library,
  Search,
  Filter,
  FileText,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Calendar,
  User,
  Building2,
  RefreshCw,
  X,
  AlertCircle,
  Plus,
  Trash2,
  CheckCircle2,
  Layers,
  ChevronRight,
  ShieldCheck,
  HardDrive
} from 'lucide-react';
import {
  SessionUser,
  CNELearningResourceMetadata,
  CNENursingReferenceResource,
  CNENursingReferenceDriveFile
} from '../../types';
import { ApiService } from '../../services/api';
import { useToast } from '../Toast';
import { AddResourceModal } from './AddResourceModal';

interface LearningResourcesPageProps {
  user: SessionUser | null;
  onNavigateToSchedule?: () => void;
}

export type CategoryFilter = 'ALL' | 'CNE_LEARNING_MATERIAL' | 'NURSING_REFERENCE_LIB';

export interface UnifiedResourceItem {
  id: string; // Unique row ID
  sourceType: 'CNE_LEARNING_MATERIAL' | 'NURSING_REFERENCE_LIB';
  title: string;
  subtitle?: string;
  authorOrSpeaker: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  uploadedAt?: string;
  updatedAt?: string;
  updatedBy?: string;
  visibleToUsers: boolean;
  // Specific IDs
  cneId?: string;
  driveFileId?: string;
  resourceId?: string;
  // Metadata
  license?: string;
  version?: string;
  active?: boolean;
  chunksCount?: number;
}

export const LearningResourcesPage: React.FC<LearningResourcesPageProps> = ({
  user,
  onNavigateToSchedule
}) => {
  const isAdmin = user?.role === 'ADMIN';

  const [cneResources, setCneResources] = useState<CNELearningResourceMetadata[]>([]);
  const [nursingResources, setNursingResources] = useState<CNENursingReferenceResource[]>([]);
  const [driveFiles, setDriveFiles] = useState<CNENursingReferenceDriveFile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileType, setSelectedFileType] = useState<string>('ALL');
  const [visibilityFilter, setVisibilityFilter] = useState<'ALL' | 'VISIBLE' | 'HIDDEN'>('ALL');

  // Operation states
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [togglingVisibilityId, setTogglingVisibilityId] = useState<string | null>(null);
  const [reindexingId, setReindexingId] = useState<string | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<UnifiedResourceItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // PDF In-App Preview Modal State
  const [previewItem, setPreviewItem] = useState<{
    id: string;
    title: string;
    fileName: string;
    blobUrl: string;
  } | null>(null);

  const { success, error, warning, info } = useToast();

  useEffect(() => {
    loadAllResources();
  }, []);

  const loadAllResources = async () => {
    setLoading(true);
    try {
      const [cneRes, nursingRes] = await Promise.all([
        ApiService.listLearningResources(),
        ApiService.listNursingReferenceResources()
      ]);

      if (cneRes.success && Array.isArray(cneRes.data)) {
        setCneResources(cneRes.data);
      } else if (cneRes.message) {
        console.warn('CNE resources load notice:', cneRes.message);
      }

      if (nursingRes.success && nursingRes.data) {
        setNursingResources(nursingRes.data.resources || []);
        setDriveFiles(nursingRes.data.driveFiles || []);
      } else if (nursingRes.message) {
        console.warn('Nursing reference library load notice:', nursingRes.message);
      }
    } catch (e: any) {
      error(e?.message || 'Error occurred while loading resources.');
    } finally {
      setLoading(false);
    }
  };

  // Convert raw records into a unified list
  const unifiedResources: UnifiedResourceItem[] = [
    // 1. CNE Learning Materials
    ...cneResources.map((item) => ({
      id: `cne_${item.cneId}`,
      sourceType: 'CNE_LEARNING_MATERIAL' as const,
      title: item.topic || 'CNE Session Material',
      subtitle: `CNE ID: ${item.cneId}`,
      authorOrSpeaker: item.resourcePersonName || 'Department Faculty',
      fileName: item.fileName || `CNE_${item.cneId}_Material`,
      fileType: item.fileType || 'application/pdf',
      fileSize: item.fileSize,
      uploadedAt: item.uploadedAt || item.updatedAt,
      updatedAt: item.updatedAt,
      updatedBy: item.updatedBy,
      visibleToUsers: item.visibleToUsers !== false,
      cneId: item.cneId,
      driveFileId: item.driveFileId,
      chunksCount: item.chunksCount
    })),

    // 2. Nursing Reference Library
    ...nursingResources.map((item) => {
      const matchedDrive = driveFiles.find((df) => df.driveFileId === item.driveFileId);
      const fileName = matchedDrive?.fileName || `${item.resourceTitle}.${(item.fileType || 'pdf').toLowerCase()}`;
      return {
        id: `ref_${item.resourceId || item.driveFileId}`,
        sourceType: 'NURSING_REFERENCE_LIB' as const,
        title: item.resourceTitle || 'Clinical Reference Textbook',
        subtitle: `${item.license || 'Open Access'} • ${item.version || '1st Ed.'}`,
        authorOrSpeaker: item.authorOrganization || 'Open RN Project',
        fileName: fileName,
        fileType: item.fileType || 'application/pdf',
        fileSize: matchedDrive?.fileSize,
        uploadedAt: item.indexedAt || item.updatedAt,
        updatedAt: item.updatedAt,
        visibleToUsers: item.visibleToUsers !== false,
        driveFileId: item.driveFileId,
        resourceId: item.resourceId,
        license: item.license,
        version: item.version,
        active: item.active
      };
    })
  ];

  // Helper formatting
  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes <= 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileTypeBadge = (fileType?: string, fileName?: string) => {
    const ft = (fileType || '').toLowerCase();
    const fn = (fileName || '').toLowerCase();

    if (ft.includes('pdf') || fn.endsWith('.pdf')) {
      return {
        label: 'PDF',
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        iconColor: 'text-rose-600'
      };
    }
    if (ft.includes('word') || ft.includes('docx') || fn.endsWith('.docx') || fn.endsWith('.doc')) {
      return {
        label: 'DOCX',
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
        iconColor: 'text-blue-600'
      };
    }
    if (fn.endsWith('.pptx') || ft.includes('presentationml') || (ft.includes('presentation') && !fn.endsWith('.ppt')) || ft.includes('pptx')) {
      return {
        label: 'PPTX',
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        iconColor: 'text-amber-600'
      };
    }
    if (fn.endsWith('.ppt') || ft.includes('ms-powerpoint') || ft.includes('ppt')) {
      return {
        label: 'PPT',
        bg: 'bg-orange-50 text-orange-700 border-orange-200',
        iconColor: 'text-orange-600'
      };
    }
    if (ft.includes('text') || fn.endsWith('.txt') || fn.endsWith('.md')) {
      return {
        label: 'TXT',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        iconColor: 'text-emerald-600'
      };
    }
    return {
      label: 'DOC',
      bg: 'bg-slate-50 text-slate-700 border-slate-200',
      iconColor: 'text-slate-600'
    };
  };

  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteArrays: Uint8Array[] = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: mimeType });
  };

  // Download Handler (works for both CNE and Nursing Reference)
  const handleDownload = async (item: UnifiedResourceItem) => {
    if (downloadingId) return;
    setDownloadingId(item.id);

    try {
      if (item.sourceType === 'CNE_LEARNING_MATERIAL' && item.cneId) {
        const res = await ApiService.downloadLearningResource(item.cneId);
        if (res.success && res.data?.fileBase64) {
          const mimeType = res.data.mimeType || 'application/octet-stream';
          const blob = base64ToBlob(res.data.fileBase64, mimeType);
          const url = URL.createObjectURL(blob);

          const a = document.createElement('a');
          a.href = url;
          a.download = res.data.fileName || item.fileName || `CNE_${item.cneId}_Resource`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          setTimeout(() => URL.revokeObjectURL(url), 60000);
          success(`Downloaded: ${res.data.fileName || item.fileName}`);
        } else {
          error(res.message || 'Failed to download learning resource.');
        }
      } else if (item.sourceType === 'NURSING_REFERENCE_LIB') {
        const res = await ApiService.downloadNursingReferenceResource({
          driveFileId: item.driveFileId,
          resourceId: item.resourceId
        });
        if (res.success && res.data?.fileBase64) {
          const mimeType = res.data.mimeType || 'application/octet-stream';
          const blob = base64ToBlob(res.data.fileBase64, mimeType);
          const url = URL.createObjectURL(blob);

          const a = document.createElement('a');
          a.href = url;
          a.download = res.data.fileName || item.fileName || `Reference_${item.resourceId || 'Resource'}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          setTimeout(() => URL.revokeObjectURL(url), 60000);
          success(`Downloaded: ${res.data.fileName || item.fileName}`);
        } else {
          error(res.message || 'Failed to download reference textbook.');
        }
      }
    } catch (e: any) {
      error(e?.message || 'Error downloading file.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Preview Handler (for PDF files)
  const handlePreview = async (item: UnifiedResourceItem) => {
    if (downloadingId) return;
    setDownloadingId(item.id);

    try {
      if (item.sourceType === 'CNE_LEARNING_MATERIAL' && item.cneId) {
        const res = await ApiService.downloadLearningResource(item.cneId);
        if (res.success && res.data?.fileBase64) {
          const mimeType = res.data.mimeType || 'application/pdf';
          const blob = base64ToBlob(res.data.fileBase64, mimeType);
          const blobUrl = URL.createObjectURL(blob);

          setPreviewItem({
            id: item.id,
            title: item.title,
            fileName: res.data.fileName || item.fileName || 'Resource.pdf',
            blobUrl: blobUrl
          });
        } else {
          error(res.message || 'Failed to load PDF preview.');
        }
      } else if (item.sourceType === 'NURSING_REFERENCE_LIB') {
        const res = await ApiService.downloadNursingReferenceResource({
          driveFileId: item.driveFileId,
          resourceId: item.resourceId
        });
        if (res.success && res.data?.fileBase64) {
          const mimeType = res.data.mimeType || 'application/pdf';
          const blob = base64ToBlob(res.data.fileBase64, mimeType);
          const blobUrl = URL.createObjectURL(blob);

          setPreviewItem({
            id: item.id,
            title: item.title,
            fileName: res.data.fileName || item.fileName || 'Reference.pdf',
            blobUrl: blobUrl
          });
        } else {
          error(res.message || 'Failed to load reference preview.');
        }
      }
    } catch (e: any) {
      error(e?.message || 'Error loading preview.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleClosePreview = () => {
    if (previewItem?.blobUrl) {
      URL.revokeObjectURL(previewItem.blobUrl);
    }
    setPreviewItem(null);
  };

  // Admin: Toggle Visibility
  const handleToggleVisibility = async (item: UnifiedResourceItem) => {
    if (!isAdmin) return;
    const newVisibility = !item.visibleToUsers;
    setTogglingVisibilityId(item.id);

    try {
      const targetId = item.sourceType === 'CNE_LEARNING_MATERIAL' ? (item.cneId || '') : (item.driveFileId || item.resourceId || '');
      const res = await ApiService.setResourceVisibility({
        resourceType: item.sourceType,
        id: targetId,
        visibleToUsers: newVisibility
      });

      if (res.success) {
        success(
          `Resource is now ${newVisibility ? 'Visible to Users' : 'Hidden from Users'}`,
          'Visibility Updated'
        );
        // Optimistically update local state
        if (item.sourceType === 'CNE_LEARNING_MATERIAL') {
          setCneResources((prev) =>
            prev.map((c) =>
              c.cneId === item.cneId ? { ...c, visibleToUsers: newVisibility } : c
            )
          );
        } else {
          setNursingResources((prev) =>
            prev.map((r) =>
              (r.driveFileId === item.driveFileId || r.resourceId === item.resourceId)
                ? { ...r, visibleToUsers: newVisibility }
                : r
            )
          );
        }
      } else {
        error(res.message || 'Failed to update resource visibility.');
      }
    } catch (e: any) {
      error(e?.message || 'Error updating visibility.');
    } finally {
      setTogglingVisibilityId(null);
    }
  };

  // Admin: Re-Index Nursing Reference Resource
  const handleReindex = async (item: UnifiedResourceItem) => {
    if (!isAdmin || item.sourceType !== 'NURSING_REFERENCE_LIB' || !item.driveFileId) return;
    setReindexingId(item.id);

    try {
      const res = await ApiService.indexNursingReferenceResource({
        driveFileId: item.driveFileId,
        resourceTitle: item.title,
        authorOrganization: item.authorOrSpeaker,
        license: item.license,
        version: item.version,
        visibleToUsers: item.visibleToUsers,
        reindex: true
      });

      if (res.success) {
        success(`Re-indexed ${res.data?.chunksCount || 0} chunks successfully for "${item.title}".`);
        loadAllResources();
      } else {
        error(res.message || 'Failed to re-index reference textbook.');
      }
    } catch (e: any) {
      error(e?.message || 'Error re-indexing resource.');
    } finally {
      setReindexingId(null);
    }
  };

  // Admin: Delete confirmation and execution
  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);

    try {
      if (itemToDelete.sourceType === 'CNE_LEARNING_MATERIAL' && itemToDelete.cneId) {
        const res = await ApiService.deleteLearningResource(itemToDelete.cneId);
        if (res.success) {
          success(`CNE Material "${itemToDelete.fileName}" removed.`);
          setCneResources((prev) => prev.filter((c) => c.cneId !== itemToDelete.cneId));
          setItemToDelete(null);
        } else {
          error(res.message || 'Failed to delete CNE learning resource.');
        }
      } else if (itemToDelete.sourceType === 'NURSING_REFERENCE_LIB' && itemToDelete.driveFileId) {
        const res = await ApiService.deleteNursingReferenceResource({
          driveFileId: itemToDelete.driveFileId
        });
        if (res.success) {
          success(`Reference library resource unindexed and removed (${res.data?.deletedChunksCount || 0} chunks deleted).`);
          setNursingResources((prev) => prev.filter((r) => r.driveFileId !== itemToDelete.driveFileId));
          setItemToDelete(null);
        } else {
          error(res.message || 'Failed to delete reference resource.');
        }
      }
    } catch (e: any) {
      error(e?.message || 'Error deleting resource.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtering Logic
  const filteredResources = unifiedResources.filter((item) => {
    // 1. Non-admin visibility filter (regular users NEVER see hidden items)
    if (!isAdmin && !item.visibleToUsers) {
      return false;
    }

    // 2. Admin visibility filter
    if (isAdmin && visibilityFilter === 'VISIBLE' && !item.visibleToUsers) {
      return false;
    }
    if (isAdmin && visibilityFilter === 'HIDDEN' && item.visibleToUsers) {
      return false;
    }

    // 3. Category Filter
    if (activeCategory !== 'ALL' && item.sourceType !== activeCategory) {
      return false;
    }

    // 4. Search Filter
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const matchSearch =
        (item.title || '').toLowerCase().includes(q) ||
        (item.subtitle || '').toLowerCase().includes(q) ||
        (item.authorOrSpeaker || '').toLowerCase().includes(q) ||
        (item.fileName || '').toLowerCase().includes(q) ||
        (item.cneId || '').toLowerCase().includes(q);
      if (!matchSearch) return false;
    }

    // 5. File Format Filter
    if (selectedFileType !== 'ALL') {
      const ft = (item.fileType || '').toLowerCase();
      const fn = (item.fileName || '').toLowerCase();

      if (selectedFileType === 'PDF') {
        return ft.includes('pdf') || fn.endsWith('.pdf');
      }
      if (selectedFileType === 'DOCX') {
        return ft.includes('word') || ft.includes('docx') || fn.endsWith('.docx') || fn.endsWith('.doc');
      }
      if (selectedFileType === 'PPT') {
        return fn.endsWith('.ppt') || (ft.includes('ms-powerpoint') || (ft.includes('ppt') && !ft.includes('presentation') && !ft.includes('pptx') && !fn.endsWith('.pptx')));
      }
      if (selectedFileType === 'PPTX') {
        return fn.endsWith('.pptx') || ft.includes('presentationml') || ft.includes('presentation') || ft.includes('pptx');
      }
      if (selectedFileType === 'TXT') {
        return ft.includes('text') || fn.endsWith('.txt') || fn.endsWith('.md');
      }
    }

    return true;
  });

  const cneCount = unifiedResources.filter((r) => r.sourceType === 'CNE_LEARNING_MATERIAL' && (isAdmin || r.visibleToUsers)).length;
  const libraryCount = unifiedResources.filter((r) => r.sourceType === 'NURSING_REFERENCE_LIB' && (isAdmin || r.visibleToUsers)).length;
  const totalVisibleCount = unifiedResources.filter((r) => isAdmin || r.visibleToUsers).length;

  return (
    <div id="cne-unified-learning-resources-page" className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-700 mb-1">
            <BookOpen className="w-4 h-4 text-teal-600" />
            <span>Clinical Nursing Education Repository</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Learning Resources
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Consolidated clinical curriculum repository — browse CNE session handouts, presentation slides, and accredited Open RN clinical reference textbooks.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={loadAllResources}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer transition-colors disabled:opacity-50"
            title="Refresh repository"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Resource</span>
            </button>
          )}

          {onNavigateToSchedule && (
            <button
              type="button"
              onClick={onNavigateToSchedule}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs cursor-pointer transition-colors"
            >
              <span>View CNE Schedule</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Admin Information Note */}
      {isAdmin && (
        <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-teal-900">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
            <span>
              <strong>Admin Control Active:</strong> Manage CNE learning materials and Open RN nursing reference textbooks from this single screen. Hiding a resource removes it from user view but preserves full AI index grounding.
            </span>
          </div>
        </div>
      )}

      {/* Category Tabs Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory('ALL')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategory === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Resources</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                activeCategory === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {totalVisibleCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('CNE_LEARNING_MATERIAL')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategory === 'CNE_LEARNING_MATERIAL'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>CNE Learning Materials</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                activeCategory === 'CNE_LEARNING_MATERIAL'
                  ? 'bg-teal-800 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {cneCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('NURSING_REFERENCE_LIB')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategory === 'NURSING_REFERENCE_LIB'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Library className="w-3.5 h-3.5" />
            <span>Nursing Reference Library</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                activeCategory === 'NURSING_REFERENCE_LIB'
                  ? 'bg-emerald-800 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {libraryCount}
            </span>
          </button>
        </div>

        {/* Visibility Filter for Admins */}
        {isAdmin && (
          <div className="flex items-center gap-1.5 shrink-0 text-xs">
            <span className="text-slate-400 font-semibold hidden sm:inline">Visibility:</span>
            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:bg-white focus:ring-1 focus:ring-teal-500"
            >
              <option value="ALL">All Visibility States</option>
              <option value="VISIBLE">Visible to Users Only</option>
              <option value="HIDDEN">Hidden from Users Only</option>
            </select>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, speaker/author, or file name..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* File Type Filter Chips */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
          <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1 shrink-0">
            <Filter className="w-3 h-3" /> Format:
          </span>
          {[
            { id: 'ALL', label: 'All Formats' },
            { id: 'PDF', label: 'PDF' },
            { id: 'DOCX', label: 'DOCX' },
            { id: 'PPTX', label: 'PPT/PPTX' },
            { id: 'TXT', label: 'TXT/MD' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedFileType(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 ${
                selectedFileType === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Content Section */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-16 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          <p className="text-xs font-medium text-slate-500">Loading resources from centralized repository...</p>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-16 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Learning Resources Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {searchQuery || selectedFileType !== 'ALL' || (isAdmin && visibilityFilter !== 'ALL')
              ? 'No resources match your active search or filter criteria. Try resetting the filters.'
              : 'No learning resources currently registered. Use "Add Resource" to upload curriculum materials or index Open RN reference textbooks.'}
          </p>
          {(searchQuery || selectedFileType !== 'ALL' || (isAdmin && visibilityFilter !== 'ALL')) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedFileType('ALL');
                setVisibilityFilter('ALL');
                setActiveCategory('ALL');
              }}
              className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3.5 px-4 sm:px-6">Resource Title & Category</th>
                  <th className="py-3.5 px-4">Instructor / Author</th>
                  <th className="py-3.5 px-4">File Format & Size</th>
                  {isAdmin && <th className="py-3.5 px-4">User Visibility</th>}
                  <th className="py-3.5 px-4">Uploaded / Updated</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredResources.map((item) => {
                  const badge = getFileTypeBadge(item.fileType, item.fileName);
                  const isPdf =
                    (item.fileType || '').toLowerCase().includes('pdf') ||
                    (item.fileName || '').toLowerCase().endsWith('.pdf');
                  const isBusyDownload = downloadingId === item.id;
                  const isBusyToggle = togglingVisibilityId === item.id;
                  const isBusyReindex = reindexingId === item.id;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Title & Category */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-2 mb-1">
                          {item.sourceType === 'CNE_LEARNING_MATERIAL' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                              <BookOpen className="w-3 h-3" />
                              <span>CNE Material</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Library className="w-3 h-3" />
                              <span>Reference Library</span>
                            </span>
                          )}
                          {item.subtitle && (
                            <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                              {item.subtitle}
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-slate-900 line-clamp-2 max-w-md">
                          {item.title}
                        </div>
                      </td>

                      {/* Instructor / Author */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          {item.sourceType === 'CNE_LEARNING_MATERIAL' ? (
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          ) : (
                            <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                          <span className="truncate max-w-[180px]" title={item.authorOrSpeaker}>
                            {item.authorOrSpeaker}
                          </span>
                        </div>
                      </td>

                      {/* File Format & Size */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0 ${badge.bg}`}
                          >
                            {badge.label}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 truncate max-w-[180px]" title={item.fileName}>
                              {item.fileName}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {formatFileSize(item.fileSize)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* User Visibility (Admin Only) */}
                      {isAdmin && (
                        <td className="py-4 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleVisibility(item)}
                            disabled={isBusyToggle}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border ${
                              item.visibleToUsers
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                            }`}
                            title="Click to toggle user visibility for this resource"
                          >
                            {isBusyToggle ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : item.visibleToUsers ? (
                              <Eye className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                            )}
                            <span>{item.visibleToUsers ? 'Visible to Users' : 'Hidden from Users'}</span>
                          </button>
                        </td>
                      )}

                      {/* Uploaded / Updated */}
                      <td className="py-4 px-4 text-slate-500">
                        <div className="flex items-center gap-1 text-[11px]">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.uploadedAt ? new Date(item.uploadedAt).toLocaleDateString() : '—'}</span>
                        </div>
                        {item.updatedBy && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            by {item.updatedBy}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPdf && (
                            <button
                              type="button"
                              onClick={() => handlePreview(item)}
                              disabled={isBusyDownload}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
                              title="Preview PDF document in app"
                            >
                              {isBusyDownload ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                              <span>Preview</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDownload(item)}
                            disabled={isBusyDownload}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
                            title="Download resource file"
                          >
                            {isBusyDownload ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            <span>Download</span>
                          </button>

                          {/* Admin Specific Operations: Re-index and Delete */}
                          {isAdmin && (
                            <>
                              {item.sourceType === 'NURSING_REFERENCE_LIB' && (
                                <button
                                  type="button"
                                  onClick={() => handleReindex(item)}
                                  disabled={isBusyReindex}
                                  className="inline-flex items-center gap-1 p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg text-xs cursor-pointer transition-colors disabled:opacity-50"
                                  title="Re-index text chunks for AI"
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${isBusyReindex ? 'animate-spin' : ''}`} />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setItemToDelete(item)}
                                className="inline-flex items-center gap-1 p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs cursor-pointer transition-colors"
                                title="Delete this resource"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer Summary */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
            <span>
              Showing <strong>{filteredResources.length}</strong> of <strong>{unifiedResources.length}</strong> total resources
              ({cneCount} CNE materials, {libraryCount} reference textbooks)
            </span>
            <span className="text-[11px] text-slate-400">
              Authenticated AIIMS CNE Resource Repository & Reference Library
            </span>
          </div>
        </div>
      )}

      {/* Admin Add Resource Unified Modal */}
      {isAdmin && (
        <AddResourceModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={loadAllResources}
          initialType={activeCategory === 'NURSING_REFERENCE_LIB' ? 'NURSING_REFERENCE_LIB' : 'CNE_LEARNING_MATERIAL'}
        />
      )}

      {/* PDF In-App Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-[70] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0 pr-4">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white uppercase tracking-wider">
                  PDF Preview
                </span>
                <span className="font-bold text-xs sm:text-sm truncate">
                  {previewItem.title}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewItem.blobUrl}
                  download={previewItem.fileName}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  title="Download PDF"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer transition-colors"
                  title="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Embedded PDF Viewer */}
            <div className="flex-1 w-full h-full bg-slate-100 relative">
              <iframe
                src={previewItem.blobUrl}
                title={previewItem.fileName}
                className="w-full h-full border-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[80] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Delete Learning Resource
                </h3>
                <p className="text-xs text-slate-500">
                  Confirm permanent removal from repository
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete{' '}
              <strong>"{itemToDelete.title}"</strong> (
              <span className="font-mono">{itemToDelete.fileName}</span>)?
              {itemToDelete.sourceType === 'NURSING_REFERENCE_LIB' && (
                <span className="block mt-1 text-rose-600 font-semibold">
                  This will also unindex and remove all associated AI evidence chunks from CNE_Reference_Index.
                </span>
              )}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
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
