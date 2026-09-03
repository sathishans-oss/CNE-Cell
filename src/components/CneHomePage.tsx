import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileDown
} from 'lucide-react';
import {
  ChairpersonMessageData,
  CNERecord,
  GalleryItem,
  NewsEventItem,
  ProgramImpactStats,
  QuickLinkItem,
  SessionUser,
  UpcomingClass,
  ViewMode
} from '../types';
import { ApiService } from '../services/api';
import { INITIAL_CHAIRPERSON_MESSAGE } from '../services/initialData';
import { generateAnnualCNEPdf } from '../services/pdfGenerator';
import { useToast } from './Toast';
import { ChangeCnoPhotoModal } from './ChangeCnoPhotoModal';

// Modular Child Widgets
import { UpcomingClassesWidget } from './home/UpcomingClassesWidget';
import { InstitutionalImpactWidget } from './home/InstitutionalImpactWidget';
import { NewsCircularsWidget } from './home/NewsCircularsWidget';
import { QuickLinksWidget } from './home/QuickLinksWidget';
import { CnoLeadershipCard } from './home/CnoLeadershipCard';
import { ClassMomentsGalleryWidget } from './home/ClassMomentsGalleryWidget';
import { SpecialtyModulesWidget } from './home/SpecialtyModulesWidget';
import { CertificationWorkflowWidget } from './home/CertificationWorkflowWidget';
import { CoordinatorDeskCard } from './home/CoordinatorDeskCard';
import { GuidelinesCard } from './home/GuidelinesCard';

interface CneHomePageProps {
  user: SessionUser | null;
  onNavigate: (view: ViewMode) => void;
  onOpenLogin: () => void;
  onOpenBackendSetup: () => void;
}

export const CneHomePage: React.FC<CneHomePageProps> = ({
  user,
  onNavigate,
  onOpenLogin,
  onOpenBackendSetup
}) => {
  const [upcomingClasses, setUpcomingClasses] = useState<UpcomingClass[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [newsEvents, setNewsEvents] = useState<NewsEventItem[]>([]);
  const [quickLinks, setQuickLinks] = useState<QuickLinkItem[]>([]);
  const [impactStats, setImpactStats] = useState<ProgramImpactStats | null>(null);
  const [impactLoading, setImpactLoading] = useState(true);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [cnoMessage, setCnoMessage] = useState<ChairpersonMessageData>(INITIAL_CHAIRPERSON_MESSAGE);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedNews, setSelectedNews] = useState<NewsEventItem | null>(null);
  const [selectedQuickLink, setSelectedQuickLink] = useState<QuickLinkItem | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryItem | null>(null);
  const [selectedClass, setSelectedClass] = useState<UpcomingClass | null>(null);
  const [isChangePhotoModalOpen, setIsChangePhotoModalOpen] = useState(false);
  const [applyRemarks, setApplyRemarks] = useState('');
  const [applying, setApplying] = useState(false);

  const { success, error, info } = useToast();
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    // Reset impact statistics immediately on user change/logout so previous user's data does not linger
    setImpactStats(null);
    setImpactLoading(true);
    setImpactError(null);
    loadHomeData();
  }, [user?.employeeId]);

  const loadHomeData = async () => {
    setLoading(true);
    setImpactLoading(true);
    setImpactError(null);
    try {
      // Wave 1: Primary visual components (Upcoming, Gallery, CNO Message)
      const [upcomingRes, galleryRes, cnoRes] = await Promise.all([
        ApiService.getUpcomingClasses(),
        ApiService.getGallery(),
        ApiService.getChairpersonMessage()
      ]);

      if (upcomingRes.success && upcomingRes.data) setUpcomingClasses(upcomingRes.data);
      if (galleryRes.success && galleryRes.data) setGallery(galleryRes.data);
      if (cnoRes.success && cnoRes.data) setCnoMessage(cnoRes.data);

      // Wave 2: News events & Quick Links
      const [newsRes, quickRes] = await Promise.all([
        ApiService.getNewsEvents(),
        ApiService.getQuickLinks()
      ]);

      if (newsRes.success && newsRes.data) setNewsEvents(newsRes.data);
      if (quickRes.success && quickRes.data) setQuickLinks(quickRes.data);

      // Wave 3: Live Program Impact from Data tab (institutional when unauthenticated, user-specific when logged in)
      const impactRes = await ApiService.getProgramImpact();
      if (impactRes.success && impactRes.data) {
        setImpactStats(impactRes.data);
      } else {
        setImpactError(impactRes.message || 'Unable to load impact metrics');
      }
    } catch (e) {
      console.error('Error loading home data', e);
      setImpactError('Unable to load impact metrics');
    } finally {
      setLoading(false);
      setImpactLoading(false);
    }
  };

  const handleApplyClass = async (c: UpcomingClass) => {
    if (!user || !user.employeeId) {
      info('Please log in with your Employee ID to apply for CNE classes.', 'Authentication Required');
      onOpenLogin();
      return;
    }

    setApplying(true);
    try {
      const res = await ApiService.applyForClass(c.classId, applyRemarks.trim());
      if (res.success) {
        success(`Application for "${c.topic}" submitted successfully.`, 'Enrolled');
        setSelectedClass(null);
        setApplyRemarks('');
        loadHomeData();
      } else {
        error(res.message || 'Failed to submit application.');
      }
    } catch (e: any) {
      error('Error submitting application.');
    } finally {
      setApplying(false);
    }
  };

  const handleQuickLinkClick = (item: QuickLinkItem) => {
    if (!item) return;
    if (item.actionType === 'navigate' && item.target) {
      onNavigate(item.target as ViewMode);
    } else if (item.actionType === 'modal' || item.modalContent) {
      setSelectedQuickLink(item);
    } else if (item.actionType === 'external' && item.target) {
      window.open(item.target, '_blank');
    } else if ((item as any).url) {
      window.open((item as any).url, '_blank');
    } else if (item.target && item.target.startsWith('http')) {
      window.open(item.target, '_blank');
    }
  };

  // Open upcoming classes filter
  const openClasses = upcomingClasses.filter((c) => c.status === 'OPEN').slice(0, 4);

  return (
    <div className="space-y-8 pb-16">
      {/* Streamlined 2-Column Nordic Clinical Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols: Leadership, Active Classes, Moments) */}
        <main className="lg:col-span-7 space-y-6">
          <CnoLeadershipCard
            cnoMessage={cnoMessage}
            isAdmin={isAdmin}
            onOpenChangePhoto={() => setIsChangePhotoModalOpen(true)}
            accentColor="teal"
          />
          <UpcomingClassesWidget
            openClasses={openClasses}
            loading={loading}
            onNavigate={onNavigate}
            onSelectClass={(c) => setSelectedClass(c)}
            accentColor="teal"
          />
          <ClassMomentsGalleryWidget
            gallery={gallery}
            loading={loading}
            onNavigate={onNavigate}
            onSelectPhoto={(photo) => setSelectedPhoto(photo)}
            accentColor="teal"
          />
        </main>

        {/* Right Column (5 cols: Impact, Circulars, Guidelines, Desk, Quick Links, Modules) */}
        <aside className="lg:col-span-5 space-y-6">
          <InstitutionalImpactWidget
            totalCompletedClasses={impactStats?.totalCompletedClasses ?? 0}
            uniqueStaffTrained={impactStats?.uniqueStaffTrained ?? 0}
            uniqueWardsCount={impactStats?.uniqueWardsCount ?? 0}
            attendanceComplianceRate={impactStats?.attendanceComplianceRate ?? 'N/A'}
            loading={impactLoading}
            error={impactError}
            scope={impactStats?.scope || (user ? 'user' : 'institutional')}
            accentColor="teal"
          />
          <NewsCircularsWidget
            newsEvents={newsEvents}
            onSelectNews={(news) => setSelectedNews(news)}
            accentColor="teal"
          />
          <GuidelinesCard accentColor="teal" />
          <CoordinatorDeskCard accentColor="teal" />
          <QuickLinksWidget
            quickLinks={quickLinks}
            onNavigate={onNavigate}
            onQuickLinkClick={handleQuickLinkClick}
            accentColor="teal"
          />
          <SpecialtyModulesWidget accentColor="teal" />
          <CertificationWorkflowWidget accentColor="teal" />
        </aside>
      </div>

      {/* ========================================================= */}
      {/* MODALS: News Detail, QuickLink Content, Photo Lightbox,   */}
      {/* and Class Apply Modal                                     */}
      {/* ========================================================= */}

      {/* 1. News / Circular Modal */}
      {selectedNews && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-800 uppercase bg-slate-100 px-2 py-0.5 rounded">
                  {selectedNews.category || 'Official Circular'}
                </span>
                <span className="text-xs text-slate-400 ml-2">{selectedNews.date}</span>
                <h3 className="text-base font-bold text-slate-900 mt-1.5">{selectedNews.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNews(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-700 leading-relaxed space-y-2 border-t border-slate-100 pt-3">
              <p>{selectedNews.content || selectedNews.summary}</p>
              {selectedNews.venue && (
                <p className="text-[11px] text-slate-500">
                  <strong>Venue:</strong> {selectedNews.venue}
                </p>
              )}
              {selectedNews.speaker && (
                <p className="text-[11px] text-slate-500">
                  <strong>Resource Person / Speaker:</strong> {selectedNews.speaker}
                </p>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedNews(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Quick Link Modal */}
      {selectedQuickLink && selectedQuickLink.modalContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-800 uppercase bg-slate-100 px-2 py-0.5 rounded">
                  {selectedQuickLink.badge || 'Document'}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {selectedQuickLink.modalContent.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQuickLink(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-700 leading-relaxed space-y-2.5 border-t border-slate-100 pt-3">
              {selectedQuickLink.modalContent.body.map((para, i) => (
                <p key={i} className="leading-relaxed">
                  {para}
                </p>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedQuickLink(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Photo Lightbox Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-800 space-y-0 animate-in fade-in zoom-in-95">
            <div className="relative aspect-16/10 bg-slate-900">
              <img
                src={selectedPhoto.imageUrl}
                alt={selectedPhoto.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-3 right-3 p-1.5 text-white bg-black/60 hover:bg-black rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                  {selectedPhoto.date}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">{selectedPhoto.title}</h3>
              {selectedPhoto.description && (
                <p className="text-xs text-slate-600 leading-relaxed">{selectedPhoto.description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Class Details & Apply Modal */}
      {selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                    {selectedClass.duration || '2:00'} Hrs CNE Duration
                  </span>
                  <span className="text-xs text-slate-400">{selectedClass.area}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{selectedClass.topic}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClass(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-xs text-slate-700 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Scheduled Date:</span>
                <span className="font-bold text-slate-900">{selectedClass.date}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Session Time:</span>
                <span className="font-bold text-slate-900">{selectedClass.time || '09:00 AM - 01:00 PM'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Venue / Location:</span>
                <span className="font-bold text-slate-900">{selectedClass.area || 'Clinical Skills Lab'}</span>
              </div>
              {(selectedClass.resourcePersonName || selectedClass.resourcePersonEmpId) && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Resource Person:</span>
                  <span className="font-bold text-slate-900">
                    {selectedClass.resourcePersonName || selectedClass.resourcePersonEmpId}
                  </span>
                </div>
              )}
            </div>

            {selectedClass.description && (
              <p className="text-xs text-slate-600 leading-relaxed">{selectedClass.description}</p>
            )}

            {/* Application Remarks Input */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-bold text-slate-700">
                Application Remarks / Departmental Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={applyRemarks}
                onChange={(e) => setApplyRemarks(e.target.value)}
                placeholder="e.g. ICU Shift assigned; registered with Area Incharge..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedClass(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={applying}
                onClick={() => handleApplyClass(selectedClass)}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                {applying ? 'Submitting...' : user ? 'Confirm Application' : 'Log In & Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Change CNO Photo Modal */}
      <ChangeCnoPhotoModal
        isOpen={isChangePhotoModalOpen}
        onClose={() => setIsChangePhotoModalOpen(false)}
        currentData={cnoMessage}
        onSuccess={(updated) => setCnoMessage(updated)}
      />
    </div>
  );
};
