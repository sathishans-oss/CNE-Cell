import React, { useState, useEffect } from 'react';
import {
  Award,
  Calendar,
  Sparkles,
  Users,
  MapPin,
  ClipboardList,
  FileDown,
  PlusCircle,
  Clock,
  ArrowRight,
  ChevronRight,
  ExternalLink,
  GraduationCap
} from 'lucide-react';
import { CNERecord, GalleryItem, SessionUser, UpcomingClass } from '../types';
import { ApiService } from '../services/api';
import { generateAnnualCNEPdf } from '../services/pdfGenerator';
import { useToast } from './Toast';

interface DashboardProps {
  user: SessionUser;
  onNavigate: (view: any) => void;
  onOpenAddCNE?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  onNavigate,
  onOpenAddCNE
}) => {
  const [cneRecords, setCneRecords] = useState<CNERecord[]>([]);
  const [upcomingClasses, setUpcomingClasses] = useState<UpcomingClass[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const { success, info } = useToast();
  const isAdmin = user.role === 'ADMIN';

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [recordsRes, upcomingRes, galleryRes] = await Promise.all([
        ApiService.getCNERecords(),
        ApiService.getUpcomingClasses(),
        ApiService.getGallery()
      ]);

      if (recordsRes.success && recordsRes.data) setCneRecords(recordsRes.data);
      if (upcomingRes.success && upcomingRes.data) setUpcomingClasses(upcomingRes.data);
      if (galleryRes.success && galleryRes.data) setGallery(galleryRes.data);
    } catch (e) {
      console.error('Error loading dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCneRecordDownload = () => {
    const currentYear = new Date().getFullYear();
    const yearRecords = cneRecords.filter((r) => {
      const recYear = new Date(r.fromDate).getFullYear();
      return recYear === currentYear;
    });

    generateAnnualCNEPdf(user, yearRecords, currentYear);
    success(`Annual CNE Report for ${currentYear} generated successfully.`, 'PDF Downloaded');
  };

  // Metrics computation
  const totalActivities = cneRecords.length;
  const currentMonthStr = `${new Date().getFullYear()}-${('0' + (new Date().getMonth() + 1)).slice(-2)}`;
  const currentMonthActivities = cneRecords.filter((r) => r.fromDate.startsWith(currentMonthStr)).length;
  const upcomingCount = upcomingClasses.filter((c) => c.status === 'OPEN').length;

  let totalStaffCount = 0;
  cneRecords.forEach((r) => {
    totalStaffCount += r.staffCount || (r.staffEmpIds ? r.staffEmpIds.length : 0);
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-64 h-64 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>AIIMS Rishikesh • Nursing Education</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome, {user.name}
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              {isAdmin
                ? 'Comprehensive administration portal for Clinical Nursing Education (CNE) records, area assignments, training workshops, and institutional credit verifications.'
                : 'Access your verified clinical education records, view upcoming hospital training workshops, and generate your annual CNE portfolio for coordinator verification.'}
            </p>
          </div>

          {/* Quick Primary Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              id="btn-dash-quick-cne-record"
              onClick={handleQuickCneRecordDownload}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>Generate CNE PDF ({new Date().getFullYear()})</span>
            </button>

            {isAdmin && onOpenAddCNE && (
              <button
                id="btn-dash-quick-add-cne"
                onClick={onOpenAddCNE}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs sm:text-sm border border-slate-700 transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                <span>Add CNE Activity</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Statistics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {isAdmin ? 'Total Activities' : 'My CNE Sessions'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {loading ? '...' : totalActivities}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span>Recorded in system</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">This Month</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {loading ? '...' : currentMonthActivities}
          </div>
          <div className="text-xs text-slate-500 mt-1">Activities logged</div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Upcoming Classes</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {loading ? '...' : upcomingCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">Available for registration</div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {isAdmin ? 'Total Participants' : 'Designation'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 truncate">
            {loading ? '...' : isAdmin ? totalStaffCount : user.designation}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {isAdmin ? 'Cumulative training touchpoints' : `Emp ID: ${user.employeeId}`}
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Activities & Upcoming Classes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent CNE Activities */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Recent CNE Activities</h2>
                <p className="text-xs text-slate-500">
                  {isAdmin
                    ? 'Latest clinical sessions conducted across departments'
                    : 'Your recent participation and training history'}
                </p>
              </div>
              <button
                id="btn-dash-view-all-cne"
                onClick={() => onNavigate(isAdmin ? 'admin-cne' : 'my-cne')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
              >
                <span>View All</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading activities...</div>
            ) : cneRecords.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                No CNE activities found.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {cneRecords.slice(0, 4).map((rec) => (
                  <div key={rec.dataId} className="py-3.5 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {rec.area}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {rec.duration || '1 hr'}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                        {rec.topic}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {rec.resourcePersonName ? `Resource Person: ${rec.resourcePersonName}` : `Emp ID: ${rec.resourcePersonEmpId}`} • Mode: {rec.modeOfTeaching}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold text-slate-800">
                        {rec.fromDate}
                      </div>
                      <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full mt-1 inline-block">
                        Completed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Showing top {Math.min(cneRecords.length, 4)} of {cneRecords.length} records
            </span>
            <button
              onClick={() => onNavigate('calendar')}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Open Calendar View</span>
            </button>
          </div>
        </div>

        {/* Right 1 Col: Upcoming CNE Workshops */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Upcoming Workshops</h3>
                <p className="text-xs text-slate-500">Scheduled clinical sessions</p>
              </div>
              <button
                id="btn-dash-view-all-upcoming"
                onClick={() => onNavigate('upcoming')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Browse</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {upcomingClasses.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No upcoming classes scheduled right now.
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingClasses.slice(0, 3).map((cls) => (
                  <div
                    key={cls.classId}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-300 transition-all"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span className="font-semibold text-slate-700 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        {cls.date}
                      </span>
                      <span>{cls.time}</span>
                    </div>
                    <h5 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                      {cls.topic}
                    </h5>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-slate-600 truncate max-w-[140px]">
                        {cls.area}
                      </span>
                      <button
                        onClick={() => onNavigate('upcoming')}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                      >
                        Apply Now →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <button
              onClick={() => onNavigate('my-applications')}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Track My Applications</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 40: Recent CNE Class Photos Carousel / Gallery Preview */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Recent CNE Activity Highlights</h3>
            <p className="text-xs text-slate-500">Photographs from clinical workshops and training stations</p>
          </div>
          <button
            id="btn-dash-view-gallery"
            onClick={() => onNavigate('gallery')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
          >
            <span>Full Gallery</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {gallery.slice(0, 4).map((item) => (
            <div
              key={item.id}
              onClick={() => onNavigate('gallery')}
              className="group cursor-pointer rounded-xl overflow-hidden border border-slate-200 bg-slate-50 transition-all hover:shadow-md"
            >
              <div className="h-36 overflow-hidden bg-slate-200 relative">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 right-2 bg-slate-900/70 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded">
                  {item.date}
                </div>
              </div>
              <div className="p-3">
                <h4 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-emerald-700">
                  {item.title}
                </h4>
                {item.description && (
                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
