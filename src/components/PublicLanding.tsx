import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Award,
  Calendar,
  Sparkles,
  Users,
  Images,
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  FileCheck,
  Clock,
  MapPin,
  LogIn
} from 'lucide-react';
import { GalleryItem } from '../types';
import { ApiService } from '../services/api';

interface PublicLandingProps {
  onOpenLogin?: () => void;
  onOpenBackendSetup: () => void;
}

export const PublicLanding: React.FC<PublicLandingProps> = ({
  onOpenLogin,
  onOpenBackendSetup
}) => {
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(true);

  useEffect(() => {
    loadPublicData();
  }, []);

  const loadPublicData = async () => {
    try {
      const galleryRes = await ApiService.getGallery();
      if (galleryRes.success && galleryRes.data) {
        setGallery(galleryRes.data);
      }
    } catch (e) {
      console.error('Error loading public gallery', e);
    } finally {
      setLoadingGallery(false);
    }
  };

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-xl border border-slate-800">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 px-6 py-12 sm:px-12 sm:py-16 max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-xs">
            <GraduationCap className="w-4 h-4" />
            <span>AIIMS Rishikesh • Department of Nursing Services</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Continuing Nursing Education <br className="hidden sm:inline" />
            <span className="text-emerald-400">Portal & Portfolio</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Institutional platform for clinical skill training records, accredited CNE sessions, annual credit documentation, and continuing nursing education management.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              id="btn-hero-backend-setup"
              type="button"
              onClick={onOpenBackendSetup}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-xs sm:text-sm border border-slate-700 transition-all cursor-pointer"
            >
              <span>System Deployment Info & Setup</span>
            </button>
          </div>
        </div>
      </section>

      {/* Institutional Highlights Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all space-y-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Verified CNE Portfolios</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Automated generation of annual Continuing Nursing Education certificates for verification by CNE Coordinator and Chairperson.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all space-y-3">
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Clinical Specialty Workshops</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Hands-on simulation stations across critical care, emergency, neonatal ICU, operative suites, and specialized clinical nursing wards.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all space-y-3">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Authoritative Master Roster</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Synchronized directly with institutional records, ensuring verified employee identities, secure authentication, and authenticated auditing.
          </p>
        </div>
      </section>

      {/* Leadership & Chairperson Message */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-10 relative overflow-hidden">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            <span>Leadership Message</span>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Message from the Chief Nursing Officer
            </h2>
            <blockquote className="text-sm text-slate-600 italic leading-relaxed border-l-4 border-emerald-500 pl-4 my-4">
              "Continuous clinical education and evidence-based nursing practice form the bedrock of patient safety and tertiary healthcare excellence at AIIMS Rishikesh. Every training session, hands-on workshop, and educational credit logged here empowers our nursing personnel toward clinical mastery."
            </blockquote>
            <div>
              <div className="font-bold text-slate-900 text-sm">Dr. Anita Rani Kansal</div>
              <div className="text-xs text-slate-500">Chief Nursing Officer (CNO) • AIIMS Rishikesh</div>
            </div>
          </div>
        </div>
      </section>

      {/* Public Gallery / Activity Highlights Preview */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">CNE Activity Highlights</h2>
            <p className="text-xs text-slate-500 mt-0.5">Photographs and moments from clinical training sessions</p>
          </div>
          <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
            Clinical Activity Highlights
          </span>
        </div>

        {loadingGallery ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading gallery previews...</div>
        ) : gallery.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">No activity highlights published yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {gallery.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="group rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 transition-all hover:shadow-md"
              >
                <div className="h-40 overflow-hidden bg-slate-200 relative">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 right-2 bg-slate-900/75 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded">
                    {item.date}
                  </div>
                </div>
                <div className="p-3.5 space-y-1">
                  <h3 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-emerald-700">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Staff Information Callout */}
      <section className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-8 text-white text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6 shadow-lg">
        <div className="space-y-2 max-w-2xl">
          <h2 className="text-xl sm:text-2xl font-bold">Nursing Officers & Clinical Staff</h2>
          <p className="text-xs sm:text-sm text-emerald-100">
            Log in using your registered Employee ID and default password (pass1234) to view your personal CNE credit history, apply for upcoming classes, and download certified CNE portfolios.
          </p>
        </div>
        <div className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-800/60 border border-emerald-400/30 rounded-xl text-xs font-semibold text-emerald-100">
          <span>Use "Log In" at top right to access</span>
        </div>
      </section>
    </div>
  );
};
