import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Filter,
  FileText,
  Download,
  Eye,
  Loader2,
  Calendar,
  User,
  HardDrive,
  RefreshCw,
  X,
  AlertCircle,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { SessionUser, CNELearningResourceMetadata } from '../../types';
import { ApiService } from '../../services/api';
import { useToast } from '../Toast';

interface LearningResourcesPageProps {
  user: SessionUser | null;
  onNavigateToSchedule?: () => void;
}

export const LearningResourcesPage: React.FC<LearningResourcesPageProps> = ({
  user,
  onNavigateToSchedule
}) => {
  const [resources, setResources] = useState<CNELearningResourceMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileType, setSelectedFileType] = useState<string>('ALL');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // PDF In-App Preview Modal State
  const [previewItem, setPreviewItem] = useState<{
    cneId: string;
    topic: string;
    fileName: string;
    blobUrl: string;
  } | null>(null);

  const { success, error, info } = useToast();

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    setLoading(true);
    try {
      const res = await ApiService.listLearningResources();
      if (res.success && res.data) {
        setResources(res.data);
      } else {
        error(res.message || 'Failed to load learning resources.');
      }
    } catch (e: any) {
      error(e?.message || 'Error occurred while loading learning resources.');
    } finally {
      setLoading(false);
    }
  };

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

  const handleDownload = async (item: CNELearningResourceMetadata) => {
    if (downloadingId) return;
    setDownloadingId(item.cneId);

    try {
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
    } catch (e: any) {
      error(e?.message || 'Error downloading file.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = async (item: CNELearningResourceMetadata) => {
    if (downloadingId) return;
    setDownloadingId(item.cneId);

    try {
      const res = await ApiService.downloadLearningResource(item.cneId);
      if (res.success && res.data?.fileBase64) {
        const mimeType = res.data.mimeType || 'application/pdf';
        const blob = base64ToBlob(res.data.fileBase64, mimeType);
        const blobUrl = URL.createObjectURL(blob);

        setPreviewItem({
          cneId: item.cneId,
          topic: item.topic || 'CNE Learning Resource',
          fileName: res.data.fileName || item.fileName || 'Resource.pdf',
          blobUrl: blobUrl
        });
      } else {
        error(res.message || 'Failed to load preview.');
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

  // Filtering
  const filteredResources = resources.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      (item.topic || '').toLowerCase().includes(q) ||
      (item.resourcePersonName || '').toLowerCase().includes(q) ||
      (item.fileName || '').toLowerCase().includes(q) ||
      (item.cneId || '').toLowerCase().includes(q);

    if (!matchSearch) return false;

    if (selectedFileType === 'ALL') return true;
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

    return true;
  });

  return (
    <div id="cne-learning-resources-page" className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-700 mb-1">
            <BookOpen className="w-4 h-4 text-teal-600" />
            <span>Clinical Nursing Education Repository</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Learning Resources Library
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl">
            Access, preview, and download authoritative curriculum documents, presentation decks, and clinical guidelines attached to CNE sessions.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadResources}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer transition-colors disabled:opacity-50"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {onNavigateToSchedule && (
            <button
              type="button"
              onClick={onNavigateToSchedule}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs cursor-pointer transition-colors"
            >
              <span>View CNE Schedule</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
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
            placeholder="Search by topic, speaker, or file name..."
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
            <Filter className="w-3 h-3" /> Type:
          </span>
          {[
            { id: 'ALL', label: 'All Files' },
            { id: 'PDF', label: 'PDF' },
            { id: 'DOCX', label: 'DOCX' },
            { id: 'PPT', label: 'PPT' },
            { id: 'PPTX', label: 'PPTX' }
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

      {/* Content Section */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-16 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          <p className="text-xs font-medium text-slate-500">Loading learning resources from repository...</p>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-16 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Learning Resources Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {searchQuery || selectedFileType !== 'ALL'
              ? 'No learning resources match your search or filter criteria. Try resetting the filters.'
              : 'Learning resources uploaded for CNE classes will appear in this centralized library once attached via the Material page.'}
          </p>
          {(searchQuery || selectedFileType !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedFileType('ALL');
              }}
              className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3.5 px-4 sm:px-6">CNE Topic & Subject</th>
                  <th className="py-3.5 px-4">Resource Person</th>
                  <th className="py-3.5 px-4">Attached Resource File</th>
                  <th className="py-3.5 px-4">Size</th>
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
                  const isBusy = downloadingId === item.cneId;

                  return (
                    <tr key={item.cneId} className="hover:bg-slate-50/60 transition-colors">
                      {/* Topic & Subject */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="font-bold text-slate-900 line-clamp-2 max-w-md">
                          {item.topic || 'Untitled CNE Session'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>ID: <strong>{item.cneId}</strong></span>
                        </div>
                      </td>

                      {/* Resource Person */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.resourcePersonName || 'Department Faculty'}</span>
                        </div>
                      </td>

                      {/* Attached Resource File */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0 ${badge.bg}`}
                          >
                            {badge.label}
                          </span>
                          <span className="font-medium text-slate-800 truncate max-w-[220px]" title={item.fileName}>
                            {item.fileName || 'Learning_Resource'}
                          </span>
                        </div>
                      </td>

                      {/* Size */}
                      <td className="py-4 px-4 text-slate-500 font-mono text-[11px]">
                        {formatFileSize(item.fileSize)}
                      </td>

                      {/* Uploaded / Updated */}
                      <td className="py-4 px-4 text-slate-500">
                        <div className="flex items-center gap-1 text-[11px]">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '—'}</span>
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
                              disabled={isBusy}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
                              title="Preview PDF in application"
                            >
                              {isBusy ? (
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
                            disabled={isBusy}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
                            title="Download resource file"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            <span>Download</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer Summary */}
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing <strong>{filteredResources.length}</strong> of <strong>{resources.length}</strong> learning resources
            </span>
            <span className="text-[11px] text-slate-400">
              Authenticated AIIMS CNE Resource Repository
            </span>
          </div>
        </div>
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
                  {previewItem.topic}
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
    </div>
  );
};
