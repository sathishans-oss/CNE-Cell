import React, { useState, useEffect } from 'react';
import {
  Images,
  PlusCircle,
  Calendar,
  X,
  Upload,
  Eye,
  Trash2,
  Edit2,
  CheckCircle2,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { GalleryItem, SessionUser } from '../types';
import { ApiService } from '../services/api';
import { useToast } from './Toast';

interface GalleryProps {
  user: SessionUser | null;
}

export const Gallery: React.FC<GalleryProps> = ({ user }) => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLightbox, setActiveLightbox] = useState<GalleryItem | null>(null);

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { success, error } = useToast();
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    loadGallery();
  }, []);

  const loadGallery = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getGallery();
      if (res.success && res.data) {
        setItems(res.data);
      }
    } catch (e: any) {
      error('Failed to load gallery items.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePhoto = async (id: string) => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await ApiService.deleteGalleryItem(id);
      if (res.success) {
        success('Activity photo removed from gallery.', 'Photo Deleted');
        setItems((prev) => prev.filter((p) => p.id !== id));
        setDeletingPhotoId(null);
      } else {
        error(res.message || 'Failed to delete photo.');
      }
    } catch (e: any) {
      error('Error deleting photo.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      error('Image size must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewImage || !newTitle.trim()) {
      error('Please select an image and enter a title.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await ApiService.uploadImage(
        previewImage,
        newTitle.trim(),
        newDescription.trim(),
        newDate
      );

      if (res.success && res.data) {
        success('CNE activity image uploaded successfully.', 'Upload Complete');
        setItems((prev) => [res.data!, ...prev]);
        setIsUploadOpen(false);
        setPreviewImage(null);
        setNewTitle('');
        setNewDescription('');
      } else {
        error(res.message || 'Upload failed.');
      }
    } catch (err: any) {
      error(err?.message || 'Error uploading image.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Recent CNE Activity Highlights</h1>
          <p className="text-xs text-slate-500 mt-1">
            Photo gallery documenting simulation workshops, clinical skills stations, and academic forums.
          </p>
        </div>

        {isAdmin && (
          <button
            id="btn-upload-gallery-image"
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>Upload Activity Photo</span>
          </button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading activity photographs...</div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 space-y-2">
          <Images className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No activity photos yet</h3>
          <p className="text-xs text-slate-500">
            {isAdmin ? 'Click "Upload Activity Photo" to publish workshop pictures.' : 'Photos will appear here once uploaded by the CNE In-charge.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveLightbox(item)}
              className="group bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col"
            >
              <div className="h-48 overflow-hidden bg-slate-100 relative">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2.5 right-2.5 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-md">
                  {item.date}
                </div>
                <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <div className="p-2 bg-slate-900/80 rounded-full">
                    <Eye className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-emerald-700">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>AIIMS Rishikesh</span>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingPhotoId(item.id);
                      }}
                      className="text-rose-500 hover:text-rose-700 font-semibold p-1 hover:bg-rose-50 rounded"
                    >
                      Delete
                    </button>
                  ) : (
                    <span>Click to expand</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {activeLightbox && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveLightbox(null)}
        >
          <div
            className="bg-slate-900 text-white rounded-2xl max-w-3xl w-full overflow-hidden border border-slate-800 relative shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveLightbox(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg z-10 bg-slate-900/60"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="max-h-[65vh] overflow-hidden bg-black flex items-center justify-center">
              <img
                src={activeLightbox.imageUrl}
                alt={activeLightbox.title}
                referrerPolicy="no-referrer"
                className="max-h-[65vh] w-auto object-contain"
              />
            </div>

            <div className="p-6 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{activeLightbox.title}</h3>
                <span className="text-xs text-emerald-400 font-semibold">{activeLightbox.date}</span>
              </div>
              {activeLightbox.description && (
                <p className="text-sm text-slate-300 leading-relaxed">
                  {activeLightbox.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 relative">
            <button
              onClick={() => setIsUploadOpen(false)}
              disabled={isSubmitting}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 disabled:opacity-40 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Upload Activity Photo</h3>
                <p className="text-xs text-slate-500">Add to CNE Highlights & Google Drive</p>
              </div>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              {/* File Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Select Photo *
                </label>
                <input
                  type="file"
                  accept="image/*"
                  required
                  onChange={handleFileSelect}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
                />
              </div>

              {previewImage && (
                <div className="h-36 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                  <img
                    src={previewImage}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Photo Title / Activity Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PICU Resuscitation Skills Station"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Activity Date *
                </label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Description / Session Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Briefly describe participants or training outcomes..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !previewImage}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Uploading to Drive...</span>
                    </>
                  ) : (
                    <span>Save & Publish</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingPhotoId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete Photo?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to remove this photograph from the highlights gallery?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingPhotoId(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeletePhoto(deletingPhotoId)}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Photo</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
