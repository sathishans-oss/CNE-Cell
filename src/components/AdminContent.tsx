import React, { useState, useEffect } from 'react';
import {
  FileText,
  Bell,
  HeartHandshake,
  ExternalLink,
  Images,
  PlusCircle,
  Search,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  Upload,
  Mail,
  Users,
  Eye,
  Link2
} from 'lucide-react';
import {
  CoordinatorDeskInfo,
  GalleryItem,
  NewsEventItem,
  QuickLinkItem,
  SessionUser
} from '../types';
import { ApiService } from '../services/api';
import { INITIAL_COORDINATOR_DESK, INITIAL_QUICK_LINKS } from '../services/initialData';
import { useToast } from './Toast';

interface AdminContentProps {
  user: SessionUser;
  defaultTab?: 'news' | 'desk' | 'links' | 'moments';
}

export const AdminContent: React.FC<AdminContentProps> = ({
  user,
  defaultTab = 'news'
}) => {
  const [activeTab, setActiveTab] = useState<'news' | 'desk' | 'links' | 'moments'>(defaultTab);

  // -------------------------------------------------------------
  // Tab 1: News & Circulars State
  // -------------------------------------------------------------
  const [newsList, setNewsList] = useState<NewsEventItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsSearch, setNewsSearch] = useState('');
  const [isAddNewsOpen, setIsAddNewsOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<NewsEventItem | null>(null);
  const [deletingNewsId, setDeletingNewsId] = useState<string | null>(null);
  const [newsSubmitting, setNewsSubmitting] = useState(false);
  const [newsForm, setNewsForm] = useState<{
    title: string;
    date: string;
    category: 'Circular' | 'Workshop' | 'Conference' | 'Training' | 'Update' | 'Notice';
    summary: string;
    content: string;
    venue: string;
    speaker: string;
    isImportant: boolean;
  }>({
    title: '',
    date: new Date().toISOString().split('T')[0],
    category: 'Circular',
    summary: '',
    content: '',
    venue: '',
    speaker: '',
    isImportant: false
  });

  // -------------------------------------------------------------
  // Tab 2: Coordinator Desk State
  // -------------------------------------------------------------
  const [deskInfo, setDeskInfo] = useState<CoordinatorDeskInfo>(INITIAL_COORDINATOR_DESK);
  const [deskLoading, setDeskLoading] = useState(false);
  const [deskSaving, setDeskSaving] = useState(false);
  const [deskForm, setDeskForm] = useState<{
    note: string;
    coordinatorsText: string;
    email: string;
  }>({
    note: INITIAL_COORDINATOR_DESK.note,
    coordinatorsText: INITIAL_COORDINATOR_DESK.coordinators.join(', '),
    email: INITIAL_COORDINATOR_DESK.email
  });

  // -------------------------------------------------------------
  // Tab 3: Quick Links State
  // -------------------------------------------------------------
  const [linksList, setLinksList] = useState<QuickLinkItem[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<QuickLinkItem | null>(null);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkForm, setLinkForm] = useState<{
    title: string;
    description: string;
    iconName: string;
    target: string;
    badge: string;
    actionType: 'navigate' | 'modal' | 'external';
  }>({
    title: '',
    description: '',
    iconName: 'BookOpen',
    target: '',
    badge: '',
    actionType: 'external'
  });

  // -------------------------------------------------------------
  // Tab 4: Moments / Gallery State
  // -------------------------------------------------------------
  const [galleryList, setGalleryList] = useState<GalleryItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<GalleryItem | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [photoSubmitting, setPhotoSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [photoForm, setPhotoForm] = useState<{
    title: string;
    description: string;
    date: string;
  }>({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const { success, error } = useToast();

  useEffect(() => {
    loadNews();
    loadDesk();
    loadLinks();
    loadGallery();
  }, []);

  // -------------------------------------------------------------
  // Data Loaders
  // -------------------------------------------------------------
  const loadNews = async () => {
    setNewsLoading(true);
    try {
      const res = await ApiService.getNewsEvents();
      if (res.success && res.data) {
        setNewsList(res.data);
      }
    } catch {
      error('Failed to load news & circulars.');
    } finally {
      setNewsLoading(false);
    }
  };

  const loadDesk = async () => {
    setDeskLoading(true);
    try {
      const res = await ApiService.getCoordinatorDesk();
      if (res.success && res.data) {
        setDeskInfo(res.data);
        setDeskForm({
          note: res.data.note || '',
          coordinatorsText: (res.data.coordinators || []).join(', '),
          email: res.data.email || ''
        });
      }
    } catch {
      error('Failed to load Coordinator Desk info.');
    } finally {
      setDeskLoading(false);
    }
  };

  const loadLinks = async () => {
    setLinksLoading(true);
    try {
      const res = await ApiService.getQuickLinks();
      if (res.success && res.data) {
        setLinksList(res.data);
      }
    } catch {
      error('Failed to load quick links.');
    } finally {
      setLinksLoading(false);
    }
  };

  const loadGallery = async () => {
    setGalleryLoading(true);
    try {
      const res = await ApiService.getGallery();
      if (res.success && res.data) {
        setGalleryList(res.data);
      }
    } catch {
      error('Failed to load gallery moments.');
    } finally {
      setGalleryLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Tab 1: News Handlers
  // -------------------------------------------------------------
  const openAddNews = () => {
    setNewsForm({
      title: '',
      date: new Date().toISOString().split('T')[0],
      category: 'Circular',
      summary: '',
      content: '',
      venue: '',
      speaker: '',
      isImportant: false
    });
    setEditingNews(null);
    setIsAddNewsOpen(true);
  };

  const openEditNews = (news: NewsEventItem) => {
    setEditingNews(news);
    setNewsForm({
      title: news.title || '',
      date: news.date || new Date().toISOString().split('T')[0],
      category: (news.category as any) || 'Circular',
      summary: news.summary || '',
      content: news.content || '',
      venue: news.venue || '',
      speaker: news.speaker || '',
      isImportant: !!news.isImportant
    });
    setIsAddNewsOpen(true);
  };

  const handleSaveNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsForm.title.trim() || !newsForm.date.trim() || newsSubmitting) return;

    setNewsSubmitting(true);
    try {
      if (editingNews) {
        const res = await ApiService.updateNewsEvent(editingNews.id, newsForm);
        if (res.success) {
          success(`Circular "${newsForm.title}" updated.`, 'News Updated');
          setIsAddNewsOpen(false);
          setEditingNews(null);
          await loadNews();
        } else {
          error(res.message || 'Failed to update news.');
        }
      } else {
        const res = await ApiService.addNewsEvent(newsForm);
        if (res.success) {
          success(`Circular "${newsForm.title}" published.`, 'News Published');
          setIsAddNewsOpen(false);
          await loadNews();
        } else {
          error(res.message || 'Failed to publish news.');
        }
      }
    } catch (err: any) {
      error(err?.message || 'Error saving news item.');
    } finally {
      setNewsSubmitting(false);
    }
  };

  const handleDeleteNews = async (id: string) => {
    if (newsSubmitting) return;
    setNewsSubmitting(true);
    try {
      const res = await ApiService.deleteNewsEvent(id);
      if (res.success) {
        success('Circular deleted successfully.', 'News Deleted');
        setDeletingNewsId(null);
        await loadNews();
      } else {
        error(res.message || 'Failed to delete news.');
      }
    } catch (err: any) {
      error(err?.message || 'Error deleting news.');
    } finally {
      setNewsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // Tab 2: Coordinator Desk Handlers
  // -------------------------------------------------------------
  const handleSaveDesk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deskSaving) return;

    const coords = deskForm.coordinatorsText
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    setDeskSaving(true);
    try {
      const res = await ApiService.updateCoordinatorDesk({
        note: deskForm.note.trim(),
        coordinators: coords,
        email: deskForm.email.trim()
      });
      if (res.success) {
        success('CNE Coordinator Desk information updated.', 'Desk Updated');
        if (res.data) setDeskInfo(res.data);
      } else {
        error(res.message || 'Failed to update Coordinator Desk.');
      }
    } catch (err: any) {
      error(err?.message || 'Error updating Coordinator Desk.');
    } finally {
      setDeskSaving(false);
    }
  };

  // -------------------------------------------------------------
  // Tab 3: Quick Links Handlers
  // -------------------------------------------------------------
  const openAddLink = () => {
    setLinkForm({
      title: '',
      description: '',
      iconName: 'BookOpen',
      target: '',
      badge: '',
      actionType: 'external'
    });
    setEditingLink(null);
    setIsAddLinkOpen(true);
  };

  const openEditLink = (link: QuickLinkItem) => {
    setEditingLink(link);
    setLinkForm({
      title: link.title || '',
      description: link.description || '',
      iconName: link.iconName || 'BookOpen',
      target: link.target || (link as any).url || '',
      badge: link.badge || '',
      actionType: link.actionType || 'external'
    });
    setIsAddLinkOpen(true);
  };

  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkForm.title.trim() || linkSubmitting) return;

    setLinkSubmitting(true);
    try {
      if (editingLink) {
        const res = await ApiService.updateQuickLink(editingLink.id, linkForm);
        if (res.success) {
          success(`Quick Link "${linkForm.title}" updated.`, 'Link Updated');
          setIsAddLinkOpen(false);
          setEditingLink(null);
          await loadLinks();
        } else {
          error(res.message || 'Failed to update link.');
        }
      } else {
        const res = await ApiService.addQuickLink(linkForm);
        if (res.success) {
          success(`Quick Link "${linkForm.title}" added.`, 'Link Added');
          setIsAddLinkOpen(false);
          await loadLinks();
        } else {
          error(res.message || 'Failed to add link.');
        }
      }
    } catch (err: any) {
      error(err?.message || 'Error saving quick link.');
    } finally {
      setLinkSubmitting(false);
    }
  };

  const handleDeleteLink = async (id: string) => {
    if (linkSubmitting) return;
    setLinkSubmitting(true);
    try {
      const res = await ApiService.deleteQuickLink(id);
      if (res.success) {
        success('Quick Link deleted.', 'Link Deleted');
        setDeletingLinkId(null);
        await loadLinks();
      } else {
        error(res.message || 'Failed to delete link.');
      }
    } catch (err: any) {
      error(err?.message || 'Error deleting link.');
    } finally {
      setLinkSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // Tab 4: Moments / Gallery Handlers
  // -------------------------------------------------------------
  const handlePhotoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const openUploadPhoto = () => {
    setPhotoForm({
      title: '',
      description: '',
      date: new Date().toISOString().split('T')[0]
    });
    setPreviewImage(null);
    setEditingPhoto(null);
    setIsUploadOpen(true);
  };

  const openEditPhoto = (photo: GalleryItem) => {
    setEditingPhoto(photo);
    setPhotoForm({
      title: photo.title || '',
      description: photo.description || '',
      date: photo.date || new Date().toISOString().split('T')[0]
    });
    setPreviewImage(photo.imageUrl || null);
    setIsUploadOpen(true);
  };

  const handleSavePhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoForm.title.trim() || photoSubmitting) return;

    setPhotoSubmitting(true);
    try {
      if (editingPhoto) {
        const res = await ApiService.updateGalleryItem(editingPhoto.id, {
          title: photoForm.title.trim(),
          description: photoForm.description.trim(),
          date: photoForm.date
        });
        if (res.success) {
          success('Activity photo details updated.', 'Photo Updated');
          setIsUploadOpen(false);
          setEditingPhoto(null);
          await loadGallery();
        } else {
          error(res.message || 'Failed to update photo.');
        }
      } else {
        if (!previewImage) {
          error('Please select an image to upload.');
          setPhotoSubmitting(false);
          return;
        }
        const res = await ApiService.uploadImage(
          previewImage,
          photoForm.title.trim(),
          photoForm.description.trim(),
          photoForm.date
        );
        if (res.success) {
          success('Activity photo uploaded and published.', 'Photo Published');
          setIsUploadOpen(false);
          setPreviewImage(null);
          await loadGallery();
        } else {
          error(res.message || 'Failed to upload photo.');
        }
      }
    } catch (err: any) {
      error(err?.message || 'Error saving photo.');
    } finally {
      setPhotoSubmitting(false);
    }
  };

  const handleDeletePhoto = async (id: string) => {
    if (photoSubmitting) return;
    setPhotoSubmitting(true);
    try {
      const res = await ApiService.deleteGalleryItem(id);
      if (res.success) {
        success('Photo removed from highlights gallery.', 'Photo Deleted');
        setDeletingPhotoId(null);
        await loadGallery();
      } else {
        error(res.message || 'Failed to delete photo.');
      }
    } catch (err: any) {
      error(err?.message || 'Error deleting photo.');
    } finally {
      setPhotoSubmitting(false);
    }
  };

  const filteredNews = newsList.filter((n) => {
    if (!newsSearch.trim()) return true;
    const q = newsSearch.toLowerCase();
    return (
      (n.title || '').toLowerCase().includes(q) ||
      (n.summary || '').toLowerCase().includes(q) ||
      (n.category || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Admin Content Management</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-800">
              Institutional Portal CMS
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage public-facing homepage content: circulars, leadership notes, quick links, and workshop photos.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('news')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'news'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-amber-500" />
            <span>News & Circulars</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('desk')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'desk'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5 text-teal-600" />
            <span>Coordinator Desk</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('links')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'links'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Link2 className="w-3.5 h-3.5 text-blue-500" />
            <span>Quick Links</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('moments')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'moments'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Images className="w-3.5 h-3.5 text-purple-500" />
            <span>Class Photos & Moments</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: News & Circulars                                    */}
      {/* ========================================================= */}
      {activeTab === 'news' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search circulars by title or category..."
                value={newsSearch}
                onChange={(e) => setNewsSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={loadNews}
                disabled={newsLoading}
                className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold disabled:opacity-50"
                title="Refresh news"
              >
                <RefreshCw className={`w-4 h-4 ${newsLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={openAddNews}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                <span>Publish New Circular</span>
              </button>
            </div>
          </div>

          {/* News Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {newsLoading ? (
              <div className="py-20 text-center text-xs text-slate-400">Loading circulars...</div>
            ) : filteredNews.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">No circulars posted yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                      <th className="py-3 px-4 w-28">Date</th>
                      <th className="py-3 px-4 w-24">Category</th>
                      <th className="py-3 px-4">Title & Summary</th>
                      <th className="py-3 px-4 w-24">Priority</th>
                      <th className="py-3 px-4 text-right w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredNews.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {item.date}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{item.title}</div>
                          {item.summary && (
                            <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                              {item.summary}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {item.isImportant ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800">
                              URGENT
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">Standard</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEditNews(item)}
                              disabled={newsSubmitting}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md disabled:opacity-40"
                              title="Edit Circular"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingNewsId(item.id)}
                              disabled={newsSubmitting}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md disabled:opacity-40"
                              title="Delete Circular"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: CNE Coordinator Desk                               */}
      {/* ========================================================= */}
      {activeTab === 'desk' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs max-w-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Coordinator Desk Configuration</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Displays directly on the portal home sidebar for nursing staff queries and coordination.
              </p>
            </div>
            <button
              type="button"
              onClick={loadDesk}
              disabled={deskLoading || deskSaving}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 disabled:opacity-50"
              title="Reload from backend"
            >
              <RefreshCw className={`w-4 h-4 ${deskLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <form onSubmit={handleSaveDesk} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Sidebar Introductory Question / Note *
              </label>
              <textarea
                rows={2}
                required
                value={deskForm.note}
                onChange={(e) => setDeskForm({ ...deskForm, note: e.target.value })}
                placeholder="Have questions regarding class credits, attendance verification, or training schedules?"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                CNE Coordinator Names (Comma-separated) *
              </label>
              <input
                type="text"
                required
                value={deskForm.coordinatorsText}
                onChange={(e) => setDeskForm({ ...deskForm, coordinatorsText: e.target.value })}
                placeholder="e.g. Ms. Suman Choudhary, Ms. Ramya T"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
              <p className="text-[11px] text-slate-400 mt-1">Separate individual coordinator names with commas.</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Coordinator Official Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={deskForm.email}
                  onChange={(e) => setDeskForm({ ...deskForm, email: e.target.value })}
                  placeholder="training.nur@aiimsrishikesh.edu.in"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={deskSaving}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {deskSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>Saving Desk Information...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Save Coordinator Desk</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: Quick Links                                        */}
      {/* ========================================================= */}
      {activeTab === 'links' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Institutional Quick Links</h2>
              <p className="text-xs text-slate-500">Configure portal links and external guidelines</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadLinks}
                disabled={linksLoading}
                className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold disabled:opacity-50"
                title="Refresh links"
              >
                <RefreshCw className={`w-4 h-4 ${linksLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={openAddLink}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                <span>Add Quick Link</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {linksLoading ? (
              <div className="py-20 text-center text-xs text-slate-400">Loading links...</div>
            ) : linksList.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">No quick links configured.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                      <th className="py-3 px-4">Title</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Target / Action</th>
                      <th className="py-3 px-4 w-24">Badge</th>
                      <th className="py-3 px-4 text-right w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {linksList.map((link) => (
                      <tr key={link.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {link.title}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                          {link.description || '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px] max-w-xs truncate">
                          {link.target || (link as any).url || '—'}
                        </td>
                        <td className="py-3 px-4">
                          {link.badge ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {link.badge}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEditLink(link)}
                              disabled={linkSubmitting}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md disabled:opacity-40"
                              title="Edit link"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingLinkId(link.id)}
                              disabled={linkSubmitting}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md disabled:opacity-40"
                              title="Delete link"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: Previous Class Photos & Moments                    */}
      {/* ========================================================= */}
      {activeTab === 'moments' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Training Moments & Class Photos</h2>
              <p className="text-xs text-slate-500">Document clinical simulation drills and workshops</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadGallery}
                disabled={galleryLoading}
                className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold disabled:opacity-50"
                title="Refresh photos"
              >
                <RefreshCw className={`w-4 h-4 ${galleryLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={openUploadPhoto}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                <span>Upload Activity Photo</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-4">
            {galleryLoading ? (
              <div className="py-20 text-center text-xs text-slate-400">Loading activity photos...</div>
            ) : galleryList.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">No activity photos published yet.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {galleryList.map((photo) => (
                  <div
                    key={photo.id}
                    className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
                  >
                    <div className="h-40 bg-slate-900 relative overflow-hidden">
                      <img
                        src={photo.imageUrl}
                        alt={photo.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 bg-slate-900/80 text-white text-[10px] font-semibold px-2 py-0.5 rounded">
                        {photo.date}
                      </div>
                    </div>

                    <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 line-clamp-1">{photo.title}</h4>
                        {photo.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                            {photo.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditPhoto(photo)}
                          disabled={photoSubmitting}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-md disabled:opacity-40"
                          title="Edit Photo Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingPhotoId(photo.id)}
                          disabled={photoSubmitting}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-md disabled:opacity-40"
                          title="Delete Photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALS                                                    */}
      {/* ========================================================= */}

      {/* 1. Add / Edit News Modal */}
      {isAddNewsOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsAddNewsOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingNews ? 'Edit News & Circular' : 'Publish News & Circular'}
                </h3>
                <p className="text-xs text-slate-500">Posted on public portal homepage</p>
              </div>
            </div>

            <form onSubmit={handleSaveNews} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Circular Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule for Basic Life Support Simulation Workshop"
                  value={newsForm.title}
                  onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newsForm.date}
                    onChange={(e) => setNewsForm({ ...newsForm, date: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={newsForm.category}
                    onChange={(e) => setNewsForm({ ...newsForm, category: e.target.value as any })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="Circular">Circular</option>
                    <option value="Notice">Notice</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Training">Training</option>
                    <option value="Conference">Conference</option>
                    <option value="Update">Update</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Summary (Short snippet)
                </label>
                <textarea
                  rows={2}
                  value={newsForm.summary}
                  onChange={(e) => setNewsForm({ ...newsForm, summary: e.target.value })}
                  placeholder="Brief 1-2 sentence overview for the home card..."
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Full Circular Details / Notice Content
                </label>
                <textarea
                  rows={4}
                  value={newsForm.content}
                  onChange={(e) => setNewsForm({ ...newsForm, content: e.target.value })}
                  placeholder="Complete text displayed when staff click the circular..."
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Venue (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Auditorium Hall / Skills Lab"
                    value={newsForm.venue}
                    onChange={(e) => setNewsForm({ ...newsForm, venue: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Speaker / Faculty (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. A. Sharma"
                    value={newsForm.speaker}
                    onChange={(e) => setNewsForm({ ...newsForm, speaker: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-important"
                  checked={newsForm.isImportant}
                  onChange={(e) => setNewsForm({ ...newsForm, isImportant: e.target.checked })}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <label htmlFor="chk-important" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Mark as URGENT / High Priority (Red badge)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddNewsOpen(false)}
                  disabled={newsSubmitting}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newsSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {newsSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>{editingNews ? 'Updating...' : 'Publishing...'}</span>
                    </>
                  ) : (
                    <span>{editingNews ? 'Save Changes' : 'Publish Circular'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete News Confirmation */}
      {deletingNewsId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete Circular?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to remove this circular from the portal?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingNewsId(null)}
                disabled={newsSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteNews(deletingNewsId)}
                disabled={newsSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                {newsSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Circular</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Add / Edit Quick Link Modal */}
      {isAddLinkOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 relative">
            <button
              type="button"
              onClick={() => setIsAddLinkOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Link2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingLink ? 'Edit Quick Link' : 'Add Quick Link'}
                </h3>
                <p className="text-xs text-slate-500">Resource link for portal homepage</p>
              </div>
            </div>

            <form onSubmit={handleSaveLink} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Link Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AIIMS Rishikesh Nursing Manual"
                  value={linkForm.title}
                  onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Short Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Official clinical guidelines & standard protocols"
                  value={linkForm.description}
                  onChange={(e) => setLinkForm({ ...linkForm, description: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Icon
                  </label>
                  <select
                    value={linkForm.iconName}
                    onChange={(e) => setLinkForm({ ...linkForm, iconName: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="BookOpen">BookOpen</option>
                    <option value="Calendar">Calendar</option>
                    <option value="Sparkles">Sparkles</option>
                    <option value="Award">Award</option>
                    <option value="ShieldCheck">ShieldCheck</option>
                    <option value="Building2">Building2</option>
                    <option value="FileDown">FileDown</option>
                    <option value="Info">Info</option>
                    <option value="GraduationCap">GraduationCap</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Badge Tag (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PDF / Portal / External"
                    value={linkForm.badge}
                    onChange={(e) => setLinkForm({ ...linkForm, badge: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Target Destination URL or Navigation View *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. https://aiimsrishikesh.edu.in or calendar"
                  value={linkForm.target}
                  onChange={(e) => setLinkForm({ ...linkForm, target: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddLinkOpen(false)}
                  disabled={linkSubmitting}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linkSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {linkSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingLink ? 'Save Changes' : 'Add Link'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Quick Link Confirmation */}
      {deletingLinkId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete Quick Link?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to remove this link from the homepage?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingLinkId(null)}
                disabled={linkSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteLink(deletingLinkId)}
                disabled={linkSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                {linkSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Link</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Upload / Edit Photo Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 relative">
            <button
              type="button"
              onClick={() => setIsUploadOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Images className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingPhoto ? 'Edit Activity Photo Details' : 'Upload Activity Photo'}
                </h3>
                <p className="text-xs text-slate-500">Adds to CNE Highlights & Google Drive</p>
              </div>
            </div>

            <form onSubmit={handleSavePhoto} className="space-y-4 text-xs">
              {!editingPhoto && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Select Photograph (Max 5MB) *
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={handlePhotoFileSelect}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
                  />
                </div>
              )}

              {previewImage && (
                <div className="h-36 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                  <img
                    src={previewImage}
                    alt="Preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Activity Title / Workshop Station *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ICU Mechanical Ventilation Skills Station"
                  value={photoForm.title}
                  onChange={(e) => setPhotoForm({ ...photoForm, title: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Activity Date *
                </label>
                <input
                  type="date"
                  required
                  value={photoForm.date}
                  onChange={(e) => setPhotoForm({ ...photoForm, date: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Description / Session Notes
                </label>
                <textarea
                  rows={2}
                  value={photoForm.description}
                  onChange={(e) => setPhotoForm({ ...photoForm, description: e.target.value })}
                  placeholder="Brief summary of clinical objectives or attendees..."
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={photoSubmitting}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={photoSubmitting || (!editingPhoto && !previewImage)}
                  className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {photoSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>{editingPhoto ? 'Saving...' : 'Uploading...'}</span>
                    </>
                  ) : (
                    <span>{editingPhoto ? 'Save Changes' : 'Save & Publish'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Photo Confirmation */}
      {deletingPhotoId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete Photograph?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to remove this photo from the highlights gallery?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingPhotoId(null)}
                disabled={photoSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeletePhoto(deletingPhotoId)}
                disabled={photoSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                {photoSubmitting ? (
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
